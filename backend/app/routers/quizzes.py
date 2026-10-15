from datetime import datetime, timezone, timedelta
import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..models import Quiz, Question, QuizAttempt, QuizAnswer, User
from ..schemas import (
    QuizSummaryOut,
    QuizStartOut,
    QuestionOut,
    SubmitAttemptIn,
    SaveAttemptIn,
    AttemptResultOut,
    SavedAnswerOut,
)
from ..deps import current_user

router = APIRouter(prefix="/quizzes", tags=["quizzes"])

PLACEMENT_QUESTION_COUNT = 50


def summary(q: Quiz) -> QuizSummaryOut:
    active_count = len([x for x in q.questions if x.is_active])
    display_count = min(PLACEMENT_QUESTION_COUNT, active_count) if q.is_placement else active_count
    return QuizSummaryOut(
        id=q.id,
        slug=q.slug,
        title_ar=q.title_ar,
        title_en=q.title_en,
        description_ar=q.description_ar,
        duration_minutes=q.duration_minutes,
        question_count=display_count,
        stage=q.stage,
        education_type=q.education_type,
        grade=q.grade,
        max_attempts=q.max_attempts,
    )


def dt_aware(value):
    if not value:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _quiz_allowed(quiz: Quiz, user: User, now: datetime | None = None) -> None:
    now = now or datetime.now(timezone.utc)
    if quiz.starts_at and dt_aware(quiz.starts_at) > now:
        raise HTTPException(403, "الاختبار لم يبدأ بعد")
    if quiz.ends_at and dt_aware(quiz.ends_at) < now:
        raise HTTPException(403, "انتهى وقت الاختبار")
    if quiz.stage and quiz.stage != user.stage:
        raise HTTPException(403, "الاختبار غير مخصص لمرحلتك")
    if quiz.education_type and quiz.education_type != user.education_type:
        raise HTTPException(403, "الاختبار غير مخصص لنوع تعليمك")
    if quiz.grade and quiz.grade != user.grade:
        raise HTTPException(403, "الاختبار غير مخصص لصفك")


def _deadline(attempt: QuizAttempt) -> datetime | None:
    started = dt_aware(attempt.started_at)
    if not started or not attempt.quiz.duration_minutes:
        return None
    return started.replace(microsecond=0) + timedelta(minutes=attempt.quiz.duration_minutes)


def _remaining_seconds(attempt: QuizAttempt, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    deadline = _deadline(attempt)
    if not deadline:
        return 24 * 60 * 60
    return max(0, int((deadline - now).total_seconds()))


def _ordered_questions(quiz: Quiz, attempt_id: int) -> list[Question]:
    questions = [q for q in quiz.questions if q.is_active]
    # Placement attempts are always randomized. The attempt id is used as a stable
    # seed so refresh/resume keeps the exact same questions and order.
    if quiz.randomize_questions or quiz.is_placement:
        random.Random(attempt_id).shuffle(questions)
    if quiz.is_placement:
        questions = questions[:PLACEMENT_QUESTION_COUNT]
    return questions


def _answer_has_value(question: Question, answer: QuizAnswer) -> bool:
    if question.question_type in {"mcq", "true_false"}:
        return answer.choice_id is not None
    return bool((answer.text_answer or "").strip())


def _upsert_answers(db: Session, attempt: QuizAttempt, incoming) -> None:
    questions = {q.id: q for q in _ordered_questions(attempt.quiz, attempt.id)}
    existing = {a.question_id: a for a in attempt.answers}
    seen: set[int] = set()
    for ans in incoming:
        if ans.question_id in seen:
            raise HTTPException(422, "إجابة مكررة")
        seen.add(ans.question_id)
        question = questions.get(ans.question_id)
        if not question:
            raise HTTPException(422, "سؤال غير صالح")
        choice_id = None
        text_answer = (ans.text_answer or "").strip() or None
        if question.question_type in {"mcq", "true_false"}:
            choice = next((c for c in question.choices if c.id == ans.choice_id), None)
            if not choice:
                raise HTTPException(422, "اختيار غير صالح")
            choice_id = choice.id
            text_answer = None
        row = existing.get(ans.question_id)
        if row is None:
            row = QuizAnswer(attempt_id=attempt.id, question_id=ans.question_id)
            db.add(row)
            attempt.answers.append(row)
            existing[ans.question_id] = row
        row.choice_id = choice_id
        row.text_answer = text_answer
        # Clear previous grading when an answer is changed before final submission.
        row.is_correct = None
        row.awarded_points = None



def _existing_result(attempt: QuizAttempt) -> AttemptResultOut:
    correct = sum(1 for answer in attempt.answers if answer.is_correct is True)
    return AttemptResultOut(
        attempt_id=attempt.id,
        score=float(attempt.score or 0),
        correct_answers=correct,
        total_questions=len(attempt.answers),
        level_result=attempt.level_result,
        needs_manual_review=attempt.needs_manual_review,
    )

def normalize_text(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


def _finalize_attempt(db: Session, attempt: QuizAttempt, now: datetime | None = None) -> AttemptResultOut:
    now = now or datetime.now(timezone.utc)
    questions = {q.id: q for q in _ordered_questions(attempt.quiz, attempt.id)}
    answers = {a.question_id: a for a in attempt.answers}
    correct = 0
    total_points = sum(q.points for q in questions.values()) or 1
    earned = 0.0
    needs_review = False

    for qid, question in questions.items():
        answer = answers.get(qid)
        if answer is None:
            answer = QuizAnswer(attempt_id=attempt.id, question_id=qid)
            db.add(answer)
            attempt.answers.append(answer)
            answers[qid] = answer

        is_correct = False
        awarded: float | None = 0.0
        if question.question_type in {"mcq", "true_false"}:
            choice = next((c for c in question.choices if c.id == answer.choice_id), None)
            is_correct = bool(choice and choice.is_correct)
            awarded = float(question.points if is_correct else 0)
        elif question.question_type == "short":
            has_text = bool((answer.text_answer or "").strip())
            is_correct = has_text and normalize_text(answer.text_answer) == normalize_text(question.expected_answer)
            awarded = float(question.points if is_correct else 0)
        else:  # essay
            if (answer.text_answer or "").strip():
                is_correct = None
                awarded = None
                needs_review = True
            else:
                is_correct = False
                awarded = 0.0

        answer.is_correct = is_correct
        answer.awarded_points = awarded
        if is_correct is True:
            correct += 1
        if awarded is not None:
            earned += awarded

    score = round((earned / total_points) * 100, 2)
    level = None
    if attempt.quiz.is_placement:
        level = "A1" if score < 30 else "A2" if score < 45 else "B1" if score < 60 else "B2" if score < 75 else "C1" if score < 90 else "C1+"

    attempt.score = score
    attempt.level_result = level
    attempt.needs_manual_review = needs_review
    attempt.submitted_at = now
    db.flush()
    return AttemptResultOut(
        attempt_id=attempt.id,
        score=score,
        correct_answers=correct,
        total_questions=len(questions),
        level_result=level,
        needs_manual_review=needs_review,
    )


@router.get("", response_model=list[QuizSummaryOut])
def list_quizzes(db: Session = Depends(get_db), user: User = Depends(current_user)):
    now = datetime.now(timezone.utc)
    quizzes = db.scalars(
        select(Quiz)
        .where(Quiz.is_published.is_(True), Quiz.is_archived.is_(False))
        .options(selectinload(Quiz.questions))
        .order_by(Quiz.id)
    ).all()
    out = []
    for quiz in quizzes:
        try:
            _quiz_allowed(quiz, user, now)
        except HTTPException:
            continue
        out.append(summary(quiz))
    return out


@router.post("/{slug}/start", response_model=QuizStartOut)
def start_quiz(slug: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    quiz = db.scalar(
        select(Quiz)
        .where(Quiz.slug == slug, Quiz.is_published.is_(True), Quiz.is_archived.is_(False))
        .options(selectinload(Quiz.questions).selectinload(Question.choices))
    )
    if not quiz:
        raise HTTPException(404, "الاختبار غير موجود")
    now = datetime.now(timezone.utc)
    _quiz_allowed(quiz, user, now)

    active = db.scalar(
        select(QuizAttempt)
        .where(
            QuizAttempt.quiz_id == quiz.id,
            QuizAttempt.user_id == user.id,
            QuizAttempt.submitted_at.is_(None),
        )
        .options(selectinload(QuizAttempt.answers), selectinload(QuizAttempt.quiz).selectinload(Quiz.questions).selectinload(Question.choices))
        .order_by(QuizAttempt.started_at.desc())
    )
    if active:
        remaining = _remaining_seconds(active, now)
        if remaining > 0:
            questions = [QuestionOut.model_validate(q) for q in _ordered_questions(quiz, active.id)]
            saved = [SavedAnswerOut(question_id=a.question_id, choice_id=a.choice_id, text_answer=a.text_answer) for a in active.answers]
            return QuizStartOut(
                attempt_id=active.id,
                quiz=summary(quiz),
                questions=questions,
                remaining_seconds=remaining,
                resumed=True,
                saved_answers=saved,
            )
        # Finalize an expired in-progress attempt, but return that same attempt once
        # so the frontend can show the result instead of silently consuming a new try.
        _finalize_attempt(db, active, now)
        db.commit()
        db.refresh(active)
        questions = [QuestionOut.model_validate(q) for q in _ordered_questions(quiz, active.id)]
        saved = [SavedAnswerOut(question_id=a.question_id, choice_id=a.choice_id, text_answer=a.text_answer) for a in active.answers]
        return QuizStartOut(
            attempt_id=active.id,
            quiz=summary(quiz),
            questions=questions,
            remaining_seconds=0,
            resumed=True,
            saved_answers=saved,
        )

    attempts_count = db.scalar(
        select(func.count()).select_from(QuizAttempt).where(
            QuizAttempt.quiz_id == quiz.id,
            QuizAttempt.user_id == user.id,
            QuizAttempt.submitted_at.is_not(None),
        )
    ) or 0
    if attempts_count >= quiz.max_attempts:
        raise HTTPException(403, "وصلت للحد الأقصى من المحاولات")

    attempt = QuizAttempt(quiz_id=quiz.id, user_id=user.id)
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    questions = [QuestionOut.model_validate(q) for q in _ordered_questions(quiz, attempt.id)]
    return QuizStartOut(
        attempt_id=attempt.id,
        quiz=summary(quiz),
        questions=questions,
        remaining_seconds=quiz.duration_minutes * 60,
        resumed=False,
        saved_answers=[],
    )


@router.put("/attempts/{attempt_id}/answers")
def save_attempt_answers(attempt_id: int, data: SaveAttemptIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    attempt = db.scalar(
        select(QuizAttempt)
        .where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user.id)
        .options(
            selectinload(QuizAttempt.quiz).selectinload(Quiz.questions).selectinload(Question.choices),
            selectinload(QuizAttempt.answers),
        )
    )
    if not attempt:
        raise HTTPException(404, "المحاولة غير موجودة")
    if attempt.submitted_at:
        raise HTTPException(409, "تم إنهاء هذه المحاولة")
    if _remaining_seconds(attempt) <= 0:
        _finalize_attempt(db, attempt)
        db.commit()
        raise HTTPException(408, "انتهى وقت الاختبار وتم حفظ آخر إجابات وصلت قبل انتهاء الوقت")
    _upsert_answers(db, attempt, data.answers)
    db.commit()
    return {"saved": True, "remaining_seconds": _remaining_seconds(attempt)}


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptResultOut)
def submit_attempt(attempt_id: int, data: SubmitAttemptIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    attempt = db.scalar(
        select(QuizAttempt)
        .where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user.id)
        .options(
            selectinload(QuizAttempt.quiz).selectinload(Quiz.questions).selectinload(Question.choices),
            selectinload(QuizAttempt.answers),
        )
    )
    if not attempt:
        raise HTTPException(404, "المحاولة غير موجودة")
    if attempt.submitted_at:
        return _existing_result(attempt)

    expired = _remaining_seconds(attempt) <= 0
    if not expired:
        _upsert_answers(db, attempt, data.answers)
        db.flush()
        questions = {q.id: q for q in _ordered_questions(attempt.quiz, attempt.id)}
        saved = {a.question_id: a for a in attempt.answers}
        missing = [qid for qid, q in questions.items() if qid not in saved or not _answer_has_value(q, saved[qid])]
        if missing:
            db.rollback()
            raise HTTPException(422, "يجب الإجابة عن كل الأسئلة قبل التسليم")
    # If time already expired, incoming data is deliberately ignored. Only answers
    # that reached the server before the deadline can affect the final result.
    result = _finalize_attempt(db, attempt)
    db.commit()
    return result


@router.get("/attempts/mine")
def my_attempts(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(
        select(QuizAttempt)
        .where(QuizAttempt.user_id == user.id)
        .options(selectinload(QuizAttempt.quiz))
        .order_by(QuizAttempt.started_at.desc())
    ).all()
    return [
        {
            "id": a.id,
            "quiz": a.quiz.title_ar,
            "started_at": a.started_at,
            "submitted_at": a.submitted_at,
            "score": a.score,
            "level_result": a.level_result,
            "needs_manual_review": a.needs_manual_review,
            "status": "submitted" if a.submitted_at else "in_progress",
        }
        for a in rows
    ]
