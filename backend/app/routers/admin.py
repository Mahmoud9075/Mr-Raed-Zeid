from datetime import datetime, timedelta, timezone
from io import BytesIO
import json
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import admin_user, owner_user, permission_required
from ..models import (
    User, Quiz, Question, Choice, Review, ContactMessage, QuizAttempt, QuizAnswer,
    AuditLog, SiteSetting, SitePage, Notification, AdminInvite, ChatKnowledge, StudentArchive,
)
from ..schemas import (
    QuizCreateIn, QuestionCreateIn, SitePageIn, SiteSettingsIn, NotificationIn,
    AdminInviteIn, ChatKnowledgeIn, KnowledgeUpdateIn, MessageStatusIn, ManualGradeIn, AdminStudentUpdateIn,
)
from ..security import token_hash

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(admin_user)])


def audit(db: Session, actor_id: int, action: str, entity_type: str, entity_id: str | int | None = None, metadata: dict | str | None = None):
    if isinstance(metadata, dict):
        metadata_value = json.dumps(metadata, ensure_ascii=False, separators=(",", ":"))
    else:
        metadata_value = metadata or "{}"
    db.add(AuditLog(
        actor_user_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        metadata_json=metadata_value,
    ))


def _attempt_filters(query, search: str | None, quiz_id: int | None, month_id: int | None, stage: str | None, grade: str | None, manual_only: bool):
    query = query.where(QuizAttempt.submitted_at.is_not(None))
    if search:
        term = f"%{search.strip()}%"
        query = query.where(or_(
            User.first_name.ilike(term), User.last_name.ilike(term),
            User.email.ilike(term), User.phone.ilike(term), Quiz.title_ar.ilike(term),
        ))
    if quiz_id:
        query = query.where(QuizAttempt.quiz_id == quiz_id)
    if month_id:
        from ..models import QuizPathConfig
        query = query.where(Quiz.id.in_(select(QuizPathConfig.quiz_id).where(QuizPathConfig.month_id == month_id)))
    if stage:
        query = query.where(User.stage == stage)
    if grade:
        query = query.where(User.grade == grade)
    if manual_only:
        query = query.where(QuizAttempt.needs_manual_review.is_(True))
    return query


def _attempt_item(attempt: QuizAttempt) -> dict:
    return {
        "id": attempt.id,
        "student_id": attempt.user.id,
        "student_name": f"{attempt.user.first_name} {attempt.user.last_name}",
        "email": attempt.user.email,
        "phone": attempt.user.phone,
        "guardian_phone": attempt.user.guardian_phone,
        "stage": attempt.user.stage,
        "education_type": attempt.user.education_type,
        "grade": attempt.user.grade,
        "quiz_id": attempt.quiz.id,
        "quiz": attempt.quiz.title_ar,
        "score": attempt.score,
        "level_result": attempt.level_result,
        "needs_manual_review": attempt.needs_manual_review,
        "started_at": attempt.started_at,
        "submitted_at": attempt.submitted_at,
    }


def _recalculate_attempt(db: Session, attempt: QuizAttempt) -> None:
    questions = {q.id: q for q in attempt.quiz.questions if q.is_active}
    answers = {a.question_id: a for a in attempt.answers}
    total = sum(q.points for q in questions.values()) or 1
    earned = sum(float(a.awarded_points or 0) for a in answers.values())
    pending = False
    for qid, question in questions.items():
        if question.question_type == "essay":
            answer = answers.get(qid)
            if answer and (answer.text_answer or "").strip() and answer.awarded_points is None:
                pending = True
                break
    attempt.score = round((earned / total) * 100, 2)
    attempt.needs_manual_review = pending


@router.get("/dashboard", dependencies=[Depends(permission_required("dashboard"))])
def dashboard(db: Session = Depends(get_db)):
    def count(model):
        return db.scalar(select(func.count()).select_from(model)) or 0

    students = db.scalar(select(func.count()).select_from(User).where(User.role == "student")) or 0
    submitted = db.scalar(select(func.count()).select_from(QuizAttempt).where(QuizAttempt.submitted_at.is_not(None))) or 0
    avg_score = db.scalar(select(func.avg(QuizAttempt.score)).where(QuizAttempt.submitted_at.is_not(None), QuizAttempt.score.is_not(None)))
    manual_pending = db.scalar(select(func.count()).select_from(QuizAttempt).where(QuizAttempt.needs_manual_review.is_(True))) or 0
    recent_students = db.scalars(select(User).where(User.role == "student").order_by(User.created_at.desc()).limit(6)).all()
    low_score_rows = db.execute(
        select(User.id, User.first_name, User.last_name, func.avg(QuizAttempt.score).label("avg_score"))
        .join(QuizAttempt, QuizAttempt.user_id == User.id)
        .where(User.role == "student", QuizAttempt.submitted_at.is_not(None), QuizAttempt.score.is_not(None))
        .group_by(User.id, User.first_name, User.last_name)
        .having(func.avg(QuizAttempt.score) < 50)
        .order_by(func.avg(QuizAttempt.score))
        .limit(8)
    ).all()
    stage_rows = db.execute(select(User.stage, func.count()).where(User.role == "student").group_by(User.stage)).all()
    return {
        "users": count(User),
        "students": students,
        "quizzes": count(Quiz),
        "attempts": count(QuizAttempt),
        "submitted_attempts": submitted,
        "average_score": round(float(avg_score), 1) if avg_score is not None else None,
        "manual_pending": manual_pending,
        "pending_reviews": db.scalar(select(func.count()).select_from(Review).where(Review.status == "pending")) or 0,
        "new_messages": db.scalar(select(func.count()).select_from(ContactMessage).where(ContactMessage.status == "new")) or 0,
        "admins": db.scalar(select(func.count()).select_from(User).where(User.role.in_(["admin", "owner"]))) or 0,
        "students_by_stage": [{"stage": stage or "غير محدد", "count": count} for stage, count in stage_rows],
        "recent_students": [{"id":u.id,"name":f"{u.first_name} {u.last_name}","stage":u.stage,"grade":u.grade,"created_at":u.created_at} for u in recent_students],
        "student_alerts": [{"user_id":uid,"name":f"{first} {last}","average_score":round(float(avg),1),"type":"low_average"} for uid, first, last, avg in low_score_rows],
    }


@router.get("/users", dependencies=[Depends(permission_required("students"))])
def users(
    search: str | None = Query(default=None, max_length=100),
    stage: str | None = Query(default=None, max_length=80),
    grade: str | None = Query(default=None, max_length=80),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = select(User).outerjoin(StudentArchive, StudentArchive.user_id == User.id).where(
        User.role == "student", StudentArchive.user_id.is_(None)
    ).order_by(User.created_at.desc())
    if search:
        term = f"%{search.strip()}%"
        query = query.where(or_(User.first_name.ilike(term), User.last_name.ilike(term), User.email.ilike(term), User.phone.ilike(term)))
    if stage:
        query = query.where(User.stage == stage)
    if grade:
        query = query.where(User.grade == grade)
    rows = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    return [{
        "id": u.id, "name": f"{u.first_name} {u.last_name}", "email": u.email, "phone": u.phone,
        "guardian_phone": u.guardian_phone, "stage": u.stage, "education_type": u.education_type,
        "grade": u.grade, "role": u.role, "active": u.is_active, "profile_image": u.profile_image,
        "created_at": u.created_at,
    } for u in rows]


@router.get("/users/{user_id}", dependencies=[Depends(permission_required("students"))])
def user_details(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or user.role != "student":
        raise HTTPException(404, "حساب الطالب غير موجود")
    attempts = db.scalars(
        select(QuizAttempt)
        .where(QuizAttempt.user_id == user.id)
        .options(selectinload(QuizAttempt.quiz))
        .order_by(QuizAttempt.started_at.desc())
    ).all()
    return {
        "user": {
            "id": user.id, "name": f"{user.first_name} {user.last_name}", "first_name": user.first_name, "last_name": user.last_name, "email": user.email,
            "phone": user.phone, "guardian_phone": user.guardian_phone, "stage": user.stage,
            "education_type": user.education_type, "grade": user.grade, "school_name": user.school_name,
            "active": user.is_active, "is_verified": user.is_verified, "created_at": user.created_at,
        },
        "attempts": [{
            "id": a.id, "quiz": a.quiz.title_ar, "score": a.score, "level_result": a.level_result,
            "needs_manual_review": a.needs_manual_review, "started_at": a.started_at, "submitted_at": a.submitted_at,
        } for a in attempts],
    }


@router.put("/users/{user_id}", dependencies=[Depends(permission_required("students"))])
def update_student(user_id: int, data: AdminStudentUpdateIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    user = db.get(User, user_id)
    if not user or user.role != "student":
        raise HTTPException(404, "حساب الطالب غير موجود")
    email = str(data.email).lower().strip()
    phone = data.phone.strip()
    duplicate = db.scalar(select(User.id).where(User.id != user.id, or_(User.email == email, User.phone == phone)).limit(1))
    if duplicate:
        raise HTTPException(409, "الإيميل أو رقم الهاتف مستخدم في حساب آخر")
    before = {
        "first_name": user.first_name, "last_name": user.last_name, "email": user.email, "phone": user.phone,
        "guardian_phone": user.guardian_phone, "stage": user.stage, "education_type": user.education_type,
        "grade": user.grade, "school_name": user.school_name, "is_verified": user.is_verified,
    }
    user.first_name = data.first_name.strip(); user.last_name = data.last_name.strip(); user.email = email; user.phone = phone
    user.guardian_phone = data.guardian_phone.strip() if data.guardian_phone else None
    user.stage = data.stage or None; user.education_type = data.education_type or None; user.grade = data.grade or None
    user.school_name = data.school_name.strip() if data.school_name else None
    if data.is_verified is not None:
        user.is_verified = data.is_verified
    after = {key: getattr(user, key) for key in before}
    audit(db, actor.id, "student_updated", "user", user.id, {"before": before, "after": after})
    db.commit()
    return {"ok": True}


@router.patch("/users/{user_id}/active", dependencies=[Depends(permission_required("students"))])
def set_user_active(user_id: int, active: bool, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    user = db.get(User, user_id)
    if not user or user.role != "student":
        raise HTTPException(404, "حساب الطالب غير موجود")
    user.is_active = active
    audit(db, actor.id, "user_active_changed", "user", user.id, {"active": active})
    db.commit()
    return {"active": active}


@router.get("/admins", dependencies=[Depends(permission_required("admins"))])
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
    invite = AdminInvite(
        email=email, token_hash=token_hash(raw), role=data.role,
        expires_at=datetime.now(timezone.utc)+timedelta(days=2), created_by=actor.id,
    )
    db.add(invite)
    audit(db, actor.id, "admin_invited", "admin_invite", email)
    db.commit()
    return {"email": email, "token": raw, "expires_in_hours": 48}


@router.patch("/admins/{user_id}/role", dependencies=[Depends(owner_user)])
def change_admin_role(user_id: int, role: str, db: Session = Depends(get_db), actor: User = Depends(owner_user)):
    if role not in {"admin", "student"}:
        raise HTTPException(422, "الصلاحية غير مدعومة")
    user = db.get(User, user_id)
    if not user or user.role == "owner":
        raise HTTPException(404, "الحساب غير متاح للتعديل")
    user.role = role
    audit(db, actor.id, "admin_role_changed", "user", user.id, {"role": role})
    db.commit()
    return {"role": role}


@router.get("/site-settings", dependencies=[Depends(permission_required("settings"))])
def get_site_settings(db: Session = Depends(get_db)):
    rows = db.scalars(select(SiteSetting)).all()
    return {r.key:r.value for r in rows}


@router.put("/site-settings", dependencies=[Depends(permission_required("settings"))])
def update_site_settings(data: SiteSettingsIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    payload = data.model_dump(exclude_none=True)
    before = {key: (db.get(SiteSetting, key).value if db.get(SiteSetting, key) else None) for key in payload}
    after: dict[str, str] = {}
    for key, value in payload.items():
        string_value = "true" if value is True else "false" if value is False else str(value).strip()
        row = db.get(SiteSetting, key)
        if row:
            row.value = string_value
        else:
            db.add(SiteSetting(key=key, value=string_value))
        after[key] = string_value
    audit(db, actor.id, "site_settings_updated", "site_settings", metadata={"before": before, "after": after})
    db.commit()
    return payload


@router.get("/pages", dependencies=[Depends(permission_required("content"))])
def pages(db: Session = Depends(get_db)):
    rows = db.scalars(select(SitePage).where(SitePage.archived_at.is_(None)).order_by(SitePage.sort_order, SitePage.id)).all()
    return [{"id":p.id,"slug":p.slug,"title":p.title,"path":p.path,"is_visible":p.is_visible,"sort_order":p.sort_order,"is_system":p.is_system,"content_json":p.content_json} for p in rows]


@router.post("/pages", status_code=201, dependencies=[Depends(permission_required("content"))])
def create_page(data: SitePageIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    if db.scalar(select(SitePage).where(SitePage.slug == data.slug)):
        raise HTTPException(409, "اسم الصفحة مستخدم")
    p = SitePage(**data.model_dump(), is_system=False)
    db.add(p); db.flush(); audit(db, actor.id, "page_created", "page", p.id); db.commit(); db.refresh(p)
    return {"id":p.id}


@router.patch("/pages/{page_id}/visibility", dependencies=[Depends(permission_required("content"))])
def page_visibility(page_id: int, visible: bool, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    p = db.get(SitePage, page_id)
    if not p:
        raise HTTPException(404, "الصفحة غير موجودة")
    before_visible = p.is_visible
    p.is_visible = visible
    audit(db, actor.id, "page_visibility_changed", "page", p.id, {"before": {"visible": before_visible}, "after": {"visible": visible}})
    db.commit()
    return {"is_visible":visible}


@router.delete("/pages/{page_id}", dependencies=[Depends(permission_required("content"))])
def archive_page(page_id: int, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    p = db.get(SitePage, page_id)
    if not p:
        raise HTTPException(404, "الصفحة غير موجودة")
    if p.is_system:
        raise HTTPException(409, "الصفحة الأساسية يمكن إخفاؤها لكن لا تُحذف")
    p.archived_at = datetime.now(timezone.utc)
    audit(db, actor.id, "page_archived", "page", p.id)
    db.commit()
    return {"archived":True}


@router.get("/quizzes", dependencies=[Depends(permission_required("quizzes"))])
def admin_quizzes(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Quiz).where(Quiz.is_archived.is_(False))
        .options(selectinload(Quiz.questions)).order_by(Quiz.created_at.desc())
    ).all()
    return [{
        "id":q.id,"slug":q.slug,"title_ar":q.title_ar,"stage":q.stage,
        "education_type":q.education_type,"grade":q.grade,"published":q.is_published,
        "questions":len([x for x in q.questions if x.is_active]),"max_attempts":q.max_attempts,
        "duration_minutes":q.duration_minutes,"passing_score":q.passing_score,
        "description_ar":q.description_ar,"starts_at":q.starts_at,"ends_at":q.ends_at,
        "show_result_immediately":q.show_result_immediately,"is_placement":q.is_placement,
        "randomize_questions":bool(q.randomize_questions or q.is_placement),
    } for q in rows]


def _question_item(question: Question) -> dict:
    return {
        "id": question.id,
        "prompt": question.prompt,
        "explanation": question.explanation,
        "level": question.level,
        "question_type": question.question_type,
        "expected_answer": question.expected_answer,
        "position": question.position,
        "points": question.points,
        "is_active": question.is_active,
        "choices": [
            {
                "id": choice.id,
                "text": choice.text,
                "position": choice.position,
                "is_correct": choice.is_correct,
            }
            for choice in question.choices
        ],
    }


def _ensure_quiz_can_change_questions(db: Session, quiz_id: int) -> None:
    active_attempt = db.scalar(
        select(QuizAttempt.id).where(
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.submitted_at.is_(None),
        ).limit(1)
    )
    if active_attempt:
        raise HTTPException(409, "فيه طالب بيحل الاختبار دلوقتي. استنى لحد ما المحاولة تنتهي قبل تعديل بنك الأسئلة")


@router.get("/quizzes/{quiz_id}", dependencies=[Depends(permission_required("quizzes"))])
def quiz_details(quiz_id: int, db: Session = Depends(get_db)):
    quiz = db.scalar(
        select(Quiz).where(Quiz.id == quiz_id, Quiz.is_archived.is_(False))
        .options(selectinload(Quiz.questions).selectinload(Question.choices))
    )
    if not quiz:
        raise HTTPException(404, "الاختبار غير موجود")
    active_questions = [q for q in quiz.questions if q.is_active]
    return {
        "id": quiz.id,
        "slug": quiz.slug,
        "title_ar": quiz.title_ar,
        "title_en": quiz.title_en,
        "description_ar": quiz.description_ar,
        "description_en": quiz.description_en,
        "stage": quiz.stage,
        "education_type": quiz.education_type,
        "grade": quiz.grade,
        "duration_minutes": quiz.duration_minutes,
        "passing_score": quiz.passing_score,
        "max_attempts": quiz.max_attempts,
        "starts_at": quiz.starts_at,
        "ends_at": quiz.ends_at,
        "is_published": quiz.is_published,
        "show_result_immediately": quiz.show_result_immediately,
        "is_placement": quiz.is_placement,
        "randomize_questions": bool(quiz.randomize_questions or quiz.is_placement),
        "question_pool_count": len(active_questions),
        "questions_per_attempt": min(50, len(active_questions)) if quiz.is_placement else len(active_questions),
        "questions": [_question_item(q) for q in sorted(active_questions, key=lambda item: item.position)],
    }


@router.post("/quizzes", status_code=201, dependencies=[Depends(permission_required("quizzes"))])
def create_quiz(data: QuizCreateIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    if db.scalar(select(Quiz).where(Quiz.slug == data.slug)):
        raise HTTPException(409, "slug مستخدم")
    q = Quiz(**data.model_dump())
    db.add(q); db.flush(); audit(db, actor.id, "quiz_created", "quiz", q.id); db.commit(); db.refresh(q)
    return {"id":q.id,"slug":q.slug}


@router.post("/quizzes/{quiz_id}/questions", status_code=201, dependencies=[Depends(permission_required("quizzes"))])
def add_question(quiz_id: int, data: QuestionCreateIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    quiz = db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(404, "الاختبار غير موجود")
    duplicate_position = db.scalar(select(Question.id).where(Question.quiz_id == quiz_id, Question.position == data.position))
    if duplicate_position:
        raise HTTPException(409, "رقم ترتيب السؤال مستخدم داخل الاختبار")
    q = Question(
        quiz_id=quiz_id, prompt=data.prompt.strip(), explanation=data.explanation.strip(), level=data.level,
        question_type=data.question_type, expected_answer=data.expected_answer, position=data.position, points=data.points,
    )
    db.add(q); db.flush()
    for idx,(text,ok) in enumerate(data.choices,1):
        db.add(Choice(question_id=q.id, text=text.strip(), is_correct=ok, position=idx))
    audit(db, actor.id, "question_added", "question", q.id)
    db.commit()
    return {"id":q.id}


@router.put("/questions/{question_id}", dependencies=[Depends(permission_required("quizzes"))])
def update_question(question_id: int, data: QuestionCreateIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    question = db.scalar(
        select(Question).where(Question.id == question_id)
        .options(selectinload(Question.choices))
    )
    if not question or not question.is_active:
        raise HTTPException(404, "السؤال غير موجود")
    _ensure_quiz_can_change_questions(db, question.quiz_id)

    duplicate_position = db.scalar(
        select(Question.id).where(
            Question.quiz_id == question.quiz_id,
            Question.position == data.position,
            Question.id != question.id,
        )
    )
    if duplicate_position:
        raise HTTPException(409, "رقم ترتيب السؤال مستخدم داخل الاختبار")

    used_before = db.scalar(select(QuizAnswer.id).where(QuizAnswer.question_id == question.id).limit(1)) is not None
    if used_before:
        # Preserve historical attempts exactly. The old question stays referenced by
        # old answers, while a fresh active copy replaces it in the question bank.
        old_position = question.position
        question.is_active = False
        question.position = -question.id
        replacement_question = Question(
            quiz_id=question.quiz_id, prompt=data.prompt.strip(), explanation=data.explanation.strip(), level=data.level,
            question_type=data.question_type, expected_answer=data.expected_answer, position=data.position, points=data.points,
            is_active=True,
        )
        db.add(replacement_question); db.flush()
        for idx, (text, ok) in enumerate(data.choices, 1):
            db.add(Choice(question_id=replacement_question.id, text=text.strip(), is_correct=ok, position=idx))
        audit(db, actor.id, "question_replaced", "question", replacement_question.id, {"replaced_question_id": question.id, "old_position": old_position})
        db.commit()
        return {"id": replacement_question.id, "replaced": True}

    question.prompt = data.prompt.strip()
    question.explanation = data.explanation.strip()
    question.level = data.level
    question.question_type = data.question_type
    question.expected_answer = data.expected_answer
    question.position = data.position
    question.points = data.points
    for choice in list(question.choices):
        db.delete(choice)
    db.flush()
    for idx, (text, ok) in enumerate(data.choices, 1):
        db.add(Choice(question_id=question.id, text=text.strip(), is_correct=ok, position=idx))
    audit(db, actor.id, "question_updated", "question", question.id)
    db.commit()
    return {"id": question.id, "replaced": False}


@router.delete("/questions/{question_id}", dependencies=[Depends(permission_required("quizzes"))])
def delete_question(question_id: int, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    question = db.get(Question, question_id)
    if not question or not question.is_active:
        raise HTTPException(404, "السؤال غير موجود")
    _ensure_quiz_can_change_questions(db, question.quiz_id)
    question.is_active = False
    # Free the visible position so a new question can reuse it while keeping
    # historical attempts intact. Negative ids are unique within the quiz.
    question.position = -question.id
    audit(db, actor.id, "question_deactivated", "question", question.id)
    db.commit()
    return {"deleted": True}


@router.patch("/quizzes/{quiz_id}/publish", dependencies=[Depends(permission_required("quizzes"))])
def publish_quiz(quiz_id: int, published: bool = True, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    quiz = db.scalar(select(Quiz).where(Quiz.id == quiz_id).options(selectinload(Quiz.questions)))
    if not quiz:
        raise HTTPException(404, "الاختبار غير موجود")
    if published and not any(q.is_active for q in quiz.questions):
        raise HTTPException(409, "لا يمكن نشر اختبار بدون أسئلة")
    quiz.is_published = published
    audit(db, actor.id, "quiz_publish_changed", "quiz", quiz.id, {"published": published})
    db.commit()
    return {"published":published}


@router.delete("/quizzes/{quiz_id}", dependencies=[Depends(permission_required("quizzes"))])
def archive_quiz(quiz_id: int, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    quiz = db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(404, "الاختبار غير موجود")
    quiz.is_archived = True
    quiz.is_published = False
    audit(db, actor.id, "quiz_archived", "quiz", quiz.id)
    db.commit()
    return {"archived":True}


@router.get("/results", dependencies=[Depends(permission_required("results"))])
def results(
    search: str | None = Query(default=None, max_length=100),
    quiz_id: int | None = None,
    month_id: int | None = None,
    stage: str | None = Query(default=None, max_length=80),
    grade: str | None = Query(default=None, max_length=80),
    manual_only: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    base = select(QuizAttempt).join(User, QuizAttempt.user_id == User.id).join(Quiz, QuizAttempt.quiz_id == Quiz.id)
    base = _attempt_filters(base, search, quiz_id, month_id, stage, grade, manual_only)
    count_query = select(func.count()).select_from(QuizAttempt).join(User, QuizAttempt.user_id == User.id).join(Quiz, QuizAttempt.quiz_id == Quiz.id)
    count_query = _attempt_filters(count_query, search, quiz_id, month_id, stage, grade, manual_only)
    total = db.scalar(count_query) or 0
    rows = db.scalars(
        base.options(selectinload(QuizAttempt.user), selectinload(QuizAttempt.quiz))
        .order_by(QuizAttempt.submitted_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {"items": [_attempt_item(a) for a in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/results/{attempt_id}", dependencies=[Depends(permission_required("results"))])
def result_details(attempt_id: int, db: Session = Depends(get_db)):
    attempt = db.scalar(
        select(QuizAttempt).where(QuizAttempt.id == attempt_id)
        .options(
            selectinload(QuizAttempt.user),
            selectinload(QuizAttempt.quiz).selectinload(Quiz.questions).selectinload(Question.choices),
            selectinload(QuizAttempt.answers),
        )
    )
    if not attempt:
        raise HTTPException(404, "النتيجة غير موجودة")
    questions = {q.id: q for q in attempt.quiz.questions}
    items = []
    for answer in attempt.answers:
        question = questions.get(answer.question_id)
        if not question:
            continue
        choice = next((c.text for c in question.choices if c.id == answer.choice_id), None)
        items.append({
            "answer_id": answer.id, "question_id": question.id, "question": question.prompt,
            "question_type": question.question_type, "points": question.points,
            "choice": choice, "text_answer": answer.text_answer, "is_correct": answer.is_correct,
            "awarded_points": answer.awarded_points,
        })
    return {**_attempt_item(attempt), "answers": items}


@router.patch("/results/answers/{answer_id}/grade", dependencies=[Depends(permission_required("results"))])
def grade_answer(answer_id: int, data: ManualGradeIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    answer = db.get(QuizAnswer, answer_id)
    if not answer:
        raise HTTPException(404, "الإجابة غير موجودة")
    question = db.get(Question, answer.question_id)
    if not question or question.question_type != "essay":
        raise HTTPException(422, "التصحيح اليدوي متاح للأسئلة المقالية فقط")
    if data.awarded_points > question.points:
        raise HTTPException(422, f"الدرجة لا يمكن أن تتجاوز {question.points}")
    attempt = db.scalar(
        select(QuizAttempt).where(QuizAttempt.id == answer.attempt_id)
        .options(selectinload(QuizAttempt.answers), selectinload(QuizAttempt.quiz).selectinload(Quiz.questions))
    )
    if not attempt or not attempt.submitted_at:
        raise HTTPException(409, "المحاولة غير مسلمة بعد")
    answer.awarded_points = float(data.awarded_points)
    answer.is_correct = bool(data.awarded_points >= question.points)
    _recalculate_attempt(db, attempt)
    audit(db, actor.id, "essay_graded", "quiz_answer", answer.id, {"points": data.awarded_points})
    db.commit()
    return {"saved": True, "score": attempt.score, "needs_manual_review": attempt.needs_manual_review}


@router.get("/results-export.xlsx", dependencies=[Depends(permission_required("results"))])
def export_results_xlsx(
    search: str | None = Query(default=None, max_length=100),
    quiz_id: int | None = None,
    month_id: int | None = None,
    stage: str | None = Query(default=None, max_length=80),
    grade: str | None = Query(default=None, max_length=80),
    manual_only: bool = False,
    db: Session = Depends(get_db),
):
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment
    except ImportError as exc:
        raise HTTPException(500, "مكتبة Excel غير مثبتة على الخادم") from exc

    query = select(QuizAttempt).join(User, QuizAttempt.user_id == User.id).join(Quiz, QuizAttempt.quiz_id == Quiz.id)
    query = _attempt_filters(query, search, quiz_id, month_id, stage, grade, manual_only)
    rows = db.scalars(
        query.options(selectinload(QuizAttempt.user), selectinload(QuizAttempt.quiz)).order_by(QuizAttempt.submitted_at.desc()).limit(10000)
    ).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "النتائج"
    headers = ["اسم الطالب", "الهاتف", "ولي الأمر", "المرحلة", "نوع التعليم", "الصف", "الاختبار", "الدرجة %", "المستوى", "حالة التصحيح", "تاريخ التسليم"]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(horizontal="center")
    ws.sheet_view.rightToLeft = True
    for attempt in rows:
        ws.append([
            f"{attempt.user.first_name} {attempt.user.last_name}", attempt.user.phone,
            attempt.user.guardian_phone or "", attempt.user.stage or "", attempt.user.education_type or "",
            attempt.user.grade or "", attempt.quiz.title_ar, attempt.score if attempt.score is not None else "",
            attempt.level_result or "", "يحتاج تصحيح" if attempt.needs_manual_review else "مكتمل",
            attempt.submitted_at.isoformat() if attempt.submitted_at else "",
        ])
    widths = [24,16,16,16,18,22,32,12,12,16,24]
    for idx, width in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + idx)].width = width
    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    filename = f"raed-results-{datetime.now().strftime('%Y%m%d-%H%M')}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reviews", dependencies=[Depends(permission_required("reviews"))])
def reviews(db: Session = Depends(get_db)):
    rows = db.scalars(select(Review).order_by(Review.created_at.desc()).limit(300)).all()
    return [{"id":r.id,"name":r.display_name,"stage":r.student_stage,"rating":r.rating,"body":r.body,"status":r.status,"created_at":r.created_at} for r in rows]


@router.patch("/reviews/{review_id}", dependencies=[Depends(permission_required("reviews"))])
def moderate_review(review_id: int, status: str, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    if status not in {"approved","rejected","pending","hidden"}:
        raise HTTPException(422, "حالة غير صالحة")
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(404, "التقييم غير موجود")
    review.status = status
    audit(db, actor.id, "review_moderated", "review", review.id, {"status": status})
    db.commit()
    return {"status":status}


@router.delete("/reviews/{review_id}", dependencies=[Depends(permission_required("reviews"))])
def delete_review(review_id: int, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(404, "التقييم غير موجود")
    audit(db, actor.id, "review_deleted", "review", review.id, {"name": review.display_name})
    db.delete(review)
    db.commit()
    return {"deleted": True}


@router.get("/messages", dependencies=[Depends(permission_required("reviews"))])
def messages(db: Session = Depends(get_db)):
    rows = db.scalars(select(ContactMessage).order_by(ContactMessage.created_at.desc()).limit(300)).all()
    return [{"id":m.id,"name":m.name,"phone":m.phone,"message":m.message,"status":m.status,"created_at":m.created_at} for m in rows]


@router.patch("/messages/{message_id}", dependencies=[Depends(permission_required("reviews"))])
def update_message_status(message_id: int, data: MessageStatusIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    message = db.get(ContactMessage, message_id)
    if not message:
        raise HTTPException(404, "الرسالة غير موجودة")
    message.status = data.status
    audit(db, actor.id, "message_status_changed", "contact_message", message.id, {"status": data.status})
    db.commit()
    return {"status": message.status}


@router.get("/notifications", dependencies=[Depends(permission_required("notifications"))])
def admin_notifications(db: Session = Depends(get_db)):
    rows = db.scalars(select(Notification).order_by(Notification.created_at.desc()).limit(300)).all()
    return [{"id":n.id,"title":n.title,"body":n.body,"stage":n.stage,"education_type":n.education_type,"grade":n.grade,"user_id":n.user_id,"active":n.is_active,"created_at":n.created_at} for n in rows]


@router.post("/notifications", status_code=201, dependencies=[Depends(permission_required("notifications"))])
def create_notification(data: NotificationIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    if data.user_id and not db.get(User, data.user_id):
        raise HTTPException(404, "الطالب المحدد غير موجود")
    n = Notification(**data.model_dump())
    db.add(n); db.flush(); audit(db, actor.id, "notification_created", "notification", n.id); db.commit()
    return {"id":n.id}


@router.patch("/notifications/{notification_id}/active", dependencies=[Depends(permission_required("notifications"))])
def notification_active(notification_id: int, active: bool, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    item = db.get(Notification, notification_id)
    if not item:
        raise HTTPException(404, "الإشعار غير موجود")
    item.is_active = active
    audit(db, actor.id, "notification_active_changed", "notification", item.id, {"active": active})
    db.commit()
    return {"active": active}


@router.delete("/notifications/{notification_id}", dependencies=[Depends(permission_required("notifications"))])
def delete_notification(notification_id: int, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    item = db.get(Notification, notification_id)
    if not item:
        raise HTTPException(404, "الإشعار غير موجود")
    db.delete(item)
    audit(db, actor.id, "notification_deleted", "notification", notification_id)
    db.commit()
    return {"deleted": True}


@router.get("/knowledge", dependencies=[Depends(permission_required("assistant"))])
def knowledge(db: Session = Depends(get_db)):
    rows = db.scalars(select(ChatKnowledge).order_by(ChatKnowledge.category, ChatKnowledge.id)).all()
    return [{"id":x.id,"category":x.category,"question":x.question,"answer":x.answer,"keywords":x.keywords,"active":x.is_active} for x in rows]


@router.post("/knowledge", status_code=201, dependencies=[Depends(permission_required("assistant"))])
def add_knowledge(data: ChatKnowledgeIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    x = ChatKnowledge(**data.model_dump())
    db.add(x); db.flush(); audit(db, actor.id, "knowledge_added", "chat_knowledge", x.id); db.commit()
    return {"id":x.id}


@router.put("/knowledge/{item_id}", dependencies=[Depends(permission_required("assistant"))])
def update_knowledge(item_id: int, data: KnowledgeUpdateIn, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    x = db.get(ChatKnowledge, item_id)
    if not x:
        raise HTTPException(404, "العنصر غير موجود")
    payload = data.model_dump(exclude_none=True)
    for field, value in payload.items():
        setattr(x, field, value.strip() if isinstance(value, str) else value)
    audit(db, actor.id, "knowledge_updated", "chat_knowledge", x.id, {"keys": sorted(payload.keys())})
    db.commit()
    return {"saved": True}


@router.patch("/knowledge/{item_id}/active", dependencies=[Depends(permission_required("assistant"))])
def knowledge_active(item_id: int, active: bool, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    x = db.get(ChatKnowledge, item_id)
    if not x:
        raise HTTPException(404, "العنصر غير موجود")
    x.is_active = active
    audit(db, actor.id, "knowledge_active_changed", "chat_knowledge", x.id, {"active": active})
    db.commit()
    return {"active":active}


@router.delete("/knowledge/{item_id}", dependencies=[Depends(permission_required("assistant"))])
def delete_knowledge(item_id: int, db: Session = Depends(get_db), actor: User = Depends(admin_user)):
    x = db.get(ChatKnowledge, item_id)
    if not x:
        raise HTTPException(404, "العنصر غير موجود")
    db.delete(x)
    audit(db, actor.id, "knowledge_deleted", "chat_knowledge", item_id)
    db.commit()
    return {"deleted": True}


@router.get("/audit", dependencies=[Depends(owner_user)])
def audit_log(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(AuditLog, User).outerjoin(User, User.id == AuditLog.actor_user_id)
        .order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return [{
        "id": log.id, "actor": log.actor_user_id,
        "actor_name": f"{user.first_name} {user.last_name}" if user else "System",
        "actor_email": user.email if user else None,
        "action": log.action, "entity": log.entity_type,
        "entity_id": log.entity_id, "metadata": log.metadata_json, "created_at": log.created_at,
    } for log, user in rows]
