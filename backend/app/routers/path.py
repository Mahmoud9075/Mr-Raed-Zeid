from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import Quiz, QuizAttempt, QuizPathConfig, StudyMonth, User
from ..path_service import path_lock_state

router = APIRouter(prefix="/path", tags=["student-path"])


def aware(value):
    if not value:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def matches(value: str | None, actual: str | None) -> bool:
    return not value or value == actual


@router.get("")
def student_path(db: Session = Depends(get_db), user: User = Depends(current_user)):
    now = datetime.now(timezone.utc)
    months = db.scalars(select(StudyMonth).where(StudyMonth.is_visible.is_(True)).order_by(StudyMonth.sort_order, StudyMonth.id)).all()
    configs = db.scalars(select(QuizPathConfig).order_by(QuizPathConfig.sort_order, QuizPathConfig.id)).all()
    quizzes = {q.id: q for q in db.scalars(select(Quiz).where(Quiz.is_archived.is_(False))).all()}
    attempts = db.scalars(select(QuizAttempt).where(QuizAttempt.user_id == user.id)).all()
    by_quiz: dict[int, list[QuizAttempt]] = {}
    for attempt in attempts:
        by_quiz.setdefault(attempt.quiz_id, []).append(attempt)

    month_map = {m.id: m for m in months if matches(m.stage, user.stage) and matches(m.education_type, user.education_type) and matches(m.grade, user.grade)}
    result = []
    for month in month_map.values():
        items = []
        month_configs = [c for c in configs if c.month_id == month.id]
        month_configs.sort(key=lambda c: (c.sort_order, c.id))
        for config in month_configs:
            quiz = quizzes.get(config.quiz_id)
            if not quiz or not quiz.is_published:
                continue
            if not matches(quiz.stage, user.stage) or not matches(quiz.education_type, user.education_type) or not matches(quiz.grade, user.grade):
                continue
            locked, reason = path_lock_state(db, user, quiz, config)
            q_attempts = by_quiz.get(quiz.id, [])
            submitted = [a for a in q_attempts if a.submitted_at is not None and a.score is not None]
            in_progress = next((a for a in q_attempts if a.submitted_at is None), None)
            best = max((float(a.score) for a in submitted), default=None)
            passed = best is not None and best >= quiz.passing_score
            status = "passed" if passed else "in_progress" if in_progress else "attempted" if submitted else "available"
            if not passed:
                if month.starts_at and aware(month.starts_at) > now:
                    status = "scheduled"
                    locked = True
                    reason = "الشهر / الوحدة هيفتح في الموعد المحدد"
                elif month.ends_at and aware(month.ends_at) < now:
                    status = "expired"
                    locked = True
                    reason = "انتهى موعد الشهر / الوحدة"
                elif quiz.starts_at and aware(quiz.starts_at) > now:
                    status = "scheduled"
                    locked = True
                    reason = "الاختبار هيفتح في موعده المحدد"
                elif quiz.ends_at and aware(quiz.ends_at) < now:
                    status = "expired"
                    locked = True
                    reason = "انتهى موعد الاختبار"
                elif locked:
                    status = "locked"
            if locked and not config.show_when_locked:
                continue
            items.append({
                "quiz_id": quiz.id,
                "slug": quiz.slug,
                "title": quiz.title_ar,
                "description": quiz.description_ar,
                "week_label": config.week_label,
                "sort_order": config.sort_order,
                "status": status,
                "locked": locked,
                "lock_reason": reason,
                "best_score": best,
                "passing_score": quiz.passing_score,
                "duration_minutes": quiz.duration_minutes,
                "max_attempts": quiz.max_attempts,
                "attempts_used": len(submitted),
                "starts_at": quiz.starts_at,
                "ends_at": quiz.ends_at,
            })
        if items:
            result.append({
                "id": month.id,
                "title": month.title,
                "stage": month.stage,
                "education_type": month.education_type,
                "grade": month.grade,
                "starts_at": month.starts_at,
                "ends_at": month.ends_at,
                "quizzes": items,
            })
    return result
