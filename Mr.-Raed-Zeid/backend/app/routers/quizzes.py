from datetime import datetime, timezone
import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session, selectinload
from ..db import get_db
from ..models import Quiz, Question, QuizAttempt, QuizAnswer, User
from ..schemas import QuizSummaryOut, QuizStartOut, QuestionOut, SubmitAttemptIn, AttemptResultOut
from ..deps import current_user

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


def summary(q: Quiz) -> QuizSummaryOut:
    return QuizSummaryOut(id=q.id, slug=q.slug, title_ar=q.title_ar, title_en=q.title_en, description_ar=q.description_ar, duration_minutes=q.duration_minutes, question_count=len([x for x in q.questions if x.is_active]), stage=q.stage, education_type=q.education_type, grade=q.grade, max_attempts=q.max_attempts)


def dt_aware(x):
    if not x: return None
    return x if x.tzinfo else x.replace(tzinfo=timezone.utc)


@router.get("", response_model=list[QuizSummaryOut])
def list_quizzes(db: Session = Depends(get_db), user: User = Depends(current_user)):
    now = datetime.now(timezone.utc)
    quizzes = db.scalars(select(Quiz).where(Quiz.is_published.is_(True), Quiz.is_archived.is_(False)).options(selectinload(Quiz.questions)).order_by(Quiz.id)).all()
    out = []
    for q in quizzes:
        if q.starts_at and dt_aware(q.starts_at) > now: continue
        if q.ends_at and dt_aware(q.ends_at) < now: continue
        if q.stage and user.stage and q.stage != user.stage: continue
        if q.education_type and user.education_type and q.education_type != user.education_type: continue
        if q.grade and user.grade and q.grade != user.grade: continue
        out.append(summary(q))
    return out


@router.post("/{slug}/start", response_model=QuizStartOut)
def start_quiz(slug: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    quiz = db.scalar(select(Quiz).where(Quiz.slug == slug, Quiz.is_published.is_(True), Quiz.is_archived.is_(False)).options(selectinload(Quiz.questions).selectinload(Question.choices)))
    if not quiz: raise HTTPException(404, "الاختبار غير موجود")
    now = datetime.now(timezone.utc)
    if quiz.starts_at and dt_aware(quiz.starts_at) > now: raise HTTPException(403, "الاختبار لم يبدأ بعد")
    if quiz.ends_at and dt_aware(quiz.ends_at) < now: raise HTTPException(403, "انتهى وقت الاختبار")
    if quiz.stage and user.stage and quiz.stage != user.stage: raise HTTPException(403, "الاختبار غير مخصص لمرحلتك")
    attempts_count = db.scalar(select(func.count()).select_from(QuizAttempt).where(QuizAttempt.quiz_id == quiz.id, QuizAttempt.user_id == user.id, QuizAttempt.submitted_at.is_not(None))) or 0
    if attempts_count >= quiz.max_attempts: raise HTTPException(403, "وصلت للحد الأقصى من المحاولات")
    attempt = QuizAttempt(quiz_id=quiz.id, user_id=user.id)
    db.add(attempt); db.commit(); db.refresh(attempt)
    questions_raw = [q for q in quiz.questions if q.is_active]
    if quiz.randomize_questions:
        random.shuffle(questions_raw)
    questions = [QuestionOut.model_validate(q) for q in questions_raw]
    return QuizStartOut(attempt_id=attempt.id, quiz=summary(quiz), questions=questions)


def normalize_text(s: str | None) -> str:
    return " ".join((s or "").strip().lower().split())


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptResultOut)
def submit_attempt(attempt_id: int, data: SubmitAttemptIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    attempt = db.scalar(select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user.id).options(selectinload(QuizAttempt.quiz).selectinload(Quiz.questions).selectinload(Question.choices), selectinload(QuizAttempt.answers)))
    if not attempt: raise HTTPException(404, "المحاولة غير موجودة")
    if attempt.submitted_at: raise HTTPException(409, "تم تسليم هذه المحاولة من قبل")
    questions = {q.id: q for q in attempt.quiz.questions if q.is_active}
    provided = {}
    for ans in data.answers:
        if ans.question_id in provided: raise HTTPException(422, "إجابة مكررة")
        q = questions.get(ans.question_id)
        if not q: raise HTTPException(422, "سؤال غير صالح")
        provided[ans.question_id] = ans
    if len(provided) != len(questions):
        raise HTTPException(422, "يجب الإجابة عن كل الأسئلة قبل التسليم")
    correct = 0; total_points = sum(q.points for q in questions.values()) or 1; earned = 0.0; needs_review = False
    for qid, ans in provided.items():
        q = questions[qid]; is_correct = None; awarded = None; choice_id = None; text_answer = ans.text_answer
        if q.question_type in {"mcq", "true_false"}:
            choice = next((c for c in q.choices if c.id == ans.choice_id), None)
            if not choice: raise HTTPException(422, "اختيار غير صالح")
            choice_id = choice.id; is_correct = bool(choice.is_correct); awarded = q.points if is_correct else 0
        elif q.question_type == "short":
            is_correct = normalize_text(ans.text_answer) == normalize_text(q.expected_answer)
            awarded = q.points if is_correct else 0
        else:
            needs_review = True; awarded = None
        if is_correct: correct += 1
        if awarded is not None: earned += awarded
        db.add(QuizAnswer(attempt_id=attempt.id, question_id=qid, choice_id=choice_id, text_answer=text_answer, is_correct=is_correct, awarded_points=awarded))
    score = round((earned / total_points) * 100, 2)
    level = None
    if attempt.quiz.is_placement:
        level = "A1" if score < 30 else "A2" if score < 45 else "B1" if score < 60 else "B2" if score < 75 else "C1" if score < 90 else "C1+"
    attempt.score = score; attempt.level_result = level; attempt.needs_manual_review = needs_review; attempt.submitted_at = datetime.now(timezone.utc)
    db.commit()
    return AttemptResultOut(attempt_id=attempt.id, score=score, correct_answers=correct, total_questions=len(questions), level_result=level, needs_manual_review=needs_review)


@router.get("/attempts/mine")
def my_attempts(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(QuizAttempt).where(QuizAttempt.user_id == user.id).options(selectinload(QuizAttempt.quiz)).order_by(QuizAttempt.started_at.desc())).all()
    return [{"id": a.id, "quiz": a.quiz.title_ar, "started_at": a.started_at, "submitted_at": a.submitted_at, "score": a.score, "level_result": a.level_result, "needs_manual_review": a.needs_manual_review} for a in rows]
