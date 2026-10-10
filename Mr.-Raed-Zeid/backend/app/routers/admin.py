from datetime import datetime, timedelta, timezone
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload
from ..db import get_db
from ..deps import admin_user, owner_user
from ..models import User, Quiz, Question, Choice, Review, ContactMessage, QuizAttempt, AuditLog, SiteSetting, SitePage, Notification, AdminInvite, ChatKnowledge
from ..schemas import QuizCreateIn, QuestionCreateIn, SitePageIn, SiteSettingsIn, NotificationIn, AdminInviteIn, ChatKnowledgeIn
from ..security import token_hash

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(admin_user)])


def audit(db: Session, actor_id: int, action: str, entity_type: str, entity_id: str | int | None = None, metadata: str = "{}"):
    db.add(AuditLog(actor_user_id=actor_id, action=action, entity_type=entity_type, entity_id=str(entity_id) if entity_id is not None else None, metadata_json=metadata))


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    def count(model):
        return db.scalar(select(func.count()).select_from(model)) or 0
    return {
        "users": count(User), "quizzes": count(Quiz), "attempts": count(QuizAttempt),
        "pending_reviews": db.scalar(select(func.count()).select_from(Review).where(Review.status == "pending")) or 0,
        "new_messages": db.scalar(select(func.count()).select_from(ContactMessage).where(ContactMessage.status == "new")) or 0,
        "admins": db.scalar(select(func.count()).select_from(User).where(User.role.in_(["admin", "owner"]))) or 0,
    }


@router.get("/users")
def users(db: Session = Depends(get_db)):
    rows = db.scalars(select(User).order_by(User.created_at.desc()).limit(1000)).all()
    return [{
        "id": u.id, "name": f"{u.first_name} {u.last_name}", "email": u.email, "phone": u.phone,
        "guardian_phone": u.guardian_phone, "stage": u.stage, "education_type": u.education_type,
        "grade": u.grade, "role": u.role, "active": u.is_active, "profile_image": u.profile_image,
        "created_at": u.created_at
    } for u in rows]


@router.patch("/users/{user_id}/active")
def set_user_active(user_id: int, active: bool, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "الحساب غير موجود")
    if user.role == "owner" and actor.role != "owner":
        raise HTTPException(403, "لا يمكن تعديل حساب المالك")
    user.is_active = active; audit(db, actor.id, "user_active_changed", "user", user.id, f'{{"active":{str(active).lower()}}}'); db.commit()
    return {"active": active}


@router.get("/admins")
def admins(db: Session = Depends(get_db)):
    rows = db.scalars(select(User).where(User.role.in_(["admin", "owner"])).order_by(User.created_at)).all()
    return [{"id":u.id,"name":f"{u.first_name} {u.last_name}","email":u.email,"role":u.role,"active":u.is_active} for u in rows]


@router.post("/admins/invite", dependencies=[Depends(owner_user)])
def invite_admin(data: AdminInviteIn, db: Session = Depends(get_db), actor: User = Depends(owner_user)):
    email = data.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "الإيميل لديه حساب بالفعل")
    if data.role not in {"admin"}:
        raise HTTPException(422, "الدعوة متاحة لحساب Admin فقط")
    raw = secrets.token_urlsafe(32)
    invite = AdminInvite(email=email, token_hash=token_hash(raw), role=data.role, expires_at=datetime.now(timezone.utc)+timedelta(days=2), created_by=actor.id)
    db.add(invite); audit(db, actor.id, "admin_invited", "admin_invite", email); db.commit()
    # لا نرسل كلمة سر أو أسرار بالبريد. يمكن إرسال الرابط يدويًا أو ربط SMTP لاحقًا.
    return {"email": email, "token": raw, "expires_in_hours": 48}


@router.patch("/admins/{user_id}/role", dependencies=[Depends(owner_user)])
def change_admin_role(user_id: int, role: str, db: Session = Depends(get_db), actor: User = Depends(owner_user)):
    if role not in {"admin", "student"}:
        raise HTTPException(422, "الصلاحية غير مدعومة")
    user = db.get(User, user_id)
    if not user or user.role == "owner":
        raise HTTPException(404, "الحساب غير متاح للتعديل")
    user.role = role; audit(db, actor.id, "admin_role_changed", "user", user.id, f'{{"role":"{role}"}}'); db.commit()
    return {"role": role}


@router.get("/site-settings")
def get_site_settings(db: Session = Depends(get_db)):
    rows = db.scalars(select(SiteSetting)).all(); return {r.key:r.value for r in rows}


@router.put("/site-settings")
def update_site_settings(data: SiteSettingsIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    payload = data.model_dump(exclude_none=True)
    for key, value in payload.items():
        string_value = "true" if value is True else "false" if value is False else str(value)
        row = db.get(SiteSetting, key)
        if row: row.value = string_value
        else: db.add(SiteSetting(key=key, value=string_value))
    audit(db, actor.id, "site_settings_updated", "site_settings"); db.commit(); return payload


@router.get("/pages")
def pages(db: Session = Depends(get_db)):
    rows = db.scalars(select(SitePage).where(SitePage.archived_at.is_(None)).order_by(SitePage.sort_order, SitePage.id)).all()
    return [{"id":p.id,"slug":p.slug,"title":p.title,"path":p.path,"is_visible":p.is_visible,"sort_order":p.sort_order,"is_system":p.is_system,"content_json":p.content_json} for p in rows]


@router.post("/pages", status_code=201)
def create_page(data: SitePageIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    if db.scalar(select(SitePage).where(SitePage.slug == data.slug)):
        raise HTTPException(409, "اسم الصفحة مستخدم")
    p = SitePage(**data.model_dump(), is_system=False); db.add(p); db.flush(); audit(db, actor.id, "page_created", "page", p.id); db.commit(); db.refresh(p)
    return {"id":p.id}


@router.patch("/pages/{page_id}/visibility")
def page_visibility(page_id: int, visible: bool, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    p = db.get(SitePage, page_id)
    if not p: raise HTTPException(404, "الصفحة غير موجودة")
    p.is_visible = visible; audit(db, actor.id, "page_visibility_changed", "page", p.id, f'{{"visible":{str(visible).lower()}}}'); db.commit(); return {"is_visible":visible}


@router.delete("/pages/{page_id}")
def archive_page(page_id: int, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    p = db.get(SitePage, page_id)
    if not p: raise HTTPException(404, "الصفحة غير موجودة")
    if p.is_system: raise HTTPException(409, "الصفحة الأساسية يمكن إخفاؤها لكن لا تُحذف")
    p.archived_at = datetime.now(timezone.utc); audit(db, actor.id, "page_archived", "page", p.id); db.commit(); return {"archived":True}


@router.get("/quizzes")
def admin_quizzes(db: Session = Depends(get_db)):
    rows = db.scalars(select(Quiz).where(Quiz.is_archived.is_(False)).options(selectinload(Quiz.questions)).order_by(Quiz.created_at.desc())).all()
    return [{"id":q.id,"slug":q.slug,"title_ar":q.title_ar,"stage":q.stage,"education_type":q.education_type,"grade":q.grade,"published":q.is_published,"questions":len(q.questions),"max_attempts":q.max_attempts,"duration_minutes":q.duration_minutes} for q in rows]


@router.post("/quizzes", status_code=201)
def create_quiz(data: QuizCreateIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    if db.scalar(select(Quiz).where(Quiz.slug == data.slug)):
        raise HTTPException(409, "slug مستخدم")
    q = Quiz(**data.model_dump()); db.add(q); db.flush(); audit(db, actor.id, "quiz_created", "quiz", q.id); db.commit(); db.refresh(q); return {"id":q.id,"slug":q.slug}


@router.post("/quizzes/{quiz_id}/questions", status_code=201)
def add_question(quiz_id: int, data: QuestionCreateIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    quiz = db.get(Quiz, quiz_id)
    if not quiz: raise HTTPException(404, "الاختبار غير موجود")
    q = Question(quiz_id=quiz_id, prompt=data.prompt, explanation=data.explanation, level=data.level, question_type=data.question_type, expected_answer=data.expected_answer, position=data.position, points=data.points)
    db.add(q); db.flush()
    for idx,(text,ok) in enumerate(data.choices,1):
        db.add(Choice(question_id=q.id, text=text, is_correct=ok, position=idx))
    audit(db, actor.id, "question_added", "question", q.id); db.commit(); return {"id":q.id}


@router.patch("/quizzes/{quiz_id}/publish")
def publish_quiz(quiz_id: int, published: bool = True, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    quiz = db.get(Quiz, quiz_id)
    if not quiz: raise HTTPException(404, "الاختبار غير موجود")
    quiz.is_published = published; audit(db, actor.id, "quiz_publish_changed", "quiz", quiz.id, f'{{"published":{str(published).lower()}}}'); db.commit(); return {"published":published}


@router.delete("/quizzes/{quiz_id}")
def archive_quiz(quiz_id: int, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    quiz = db.get(Quiz, quiz_id)
    if not quiz: raise HTTPException(404, "الاختبار غير موجود")
    quiz.is_archived = True; quiz.is_published = False; audit(db, actor.id, "quiz_archived", "quiz", quiz.id); db.commit(); return {"archived":True}


@router.get("/reviews")
def reviews(db: Session = Depends(get_db)):
    rows = db.scalars(select(Review).order_by(Review.created_at.desc()).limit(300)).all()
    return [{"id":r.id,"name":r.display_name,"stage":r.student_stage,"rating":r.rating,"body":r.body,"status":r.status,"created_at":r.created_at} for r in rows]


@router.patch("/reviews/{review_id}")
def moderate_review(review_id: int, status: str, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    if status not in {"approved","rejected","pending"}: raise HTTPException(422, "حالة غير صالحة")
    review = db.get(Review, review_id)
    if not review: raise HTTPException(404, "التقييم غير موجود")
    review.status = status; audit(db, actor.id, "review_moderated", "review", review.id, f'{{"status":"{status}"}}'); db.commit(); return {"status":status}


@router.get("/messages")
def messages(db: Session = Depends(get_db)):
    rows = db.scalars(select(ContactMessage).order_by(ContactMessage.created_at.desc()).limit(300)).all()
    return [{"id":m.id,"name":m.name,"phone":m.phone,"message":m.message,"status":m.status,"created_at":m.created_at} for m in rows]


@router.get("/notifications")
def admin_notifications(db: Session = Depends(get_db)):
    rows = db.scalars(select(Notification).order_by(Notification.created_at.desc()).limit(300)).all()
    return [{"id":n.id,"title":n.title,"body":n.body,"stage":n.stage,"education_type":n.education_type,"grade":n.grade,"user_id":n.user_id,"active":n.is_active,"created_at":n.created_at} for n in rows]


@router.post("/notifications", status_code=201)
def create_notification(data: NotificationIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    n = Notification(**data.model_dump()); db.add(n); db.flush(); audit(db, actor.id, "notification_created", "notification", n.id); db.commit(); return {"id":n.id}


@router.get("/knowledge")
def knowledge(db: Session = Depends(get_db)):
    rows = db.scalars(select(ChatKnowledge).order_by(ChatKnowledge.category, ChatKnowledge.id)).all()
    return [{"id":x.id,"category":x.category,"question":x.question,"answer":x.answer,"keywords":x.keywords,"active":x.is_active} for x in rows]


@router.post("/knowledge", status_code=201)
def add_knowledge(data: ChatKnowledgeIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    x = ChatKnowledge(**data.model_dump()); db.add(x); db.flush(); audit(db, actor.id, "knowledge_added", "chat_knowledge", x.id); db.commit(); return {"id":x.id}


@router.patch("/knowledge/{item_id}/active")
def knowledge_active(item_id: int, active: bool, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    x = db.get(ChatKnowledge, item_id)
    if not x: raise HTTPException(404, "العنصر غير موجود")
    x.is_active = active; audit(db, actor.id, "knowledge_active_changed", "chat_knowledge", x.id); db.commit(); return {"active":active}


@router.get("/audit")
def audit_log(db: Session = Depends(get_db)):
    rows = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(500)).all()
    return [{"id":x.id,"actor":x.actor_user_id,"action":x.action,"entity":x.entity_type,"entity_id":x.entity_id,"created_at":x.created_at} for x in rows]
