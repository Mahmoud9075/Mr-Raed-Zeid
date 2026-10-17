from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Quiz, QuizAttempt, QuizPathConfig, StudyMonth, User


def _aware(value):
    if not value:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _best_score(db: Session, user_id: int, quiz_id: int) -> float | None:
    scores = db.scalars(
        select(QuizAttempt.score).where(
            QuizAttempt.user_id == user_id,
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.submitted_at.is_not(None),
            QuizAttempt.score.is_not(None),
        )
    ).all()
    return max((float(x) for x in scores), default=None)


def _previous_quiz_id(db: Session, config: QuizPathConfig) -> int | None:
    if not config.month_id:
        return None
    previous = db.scalar(
        select(QuizPathConfig.quiz_id)
        .where(
            QuizPathConfig.month_id == config.month_id,
            QuizPathConfig.sort_order < config.sort_order,
        )
        .order_by(QuizPathConfig.sort_order.desc(), QuizPathConfig.id.desc())
    )
    return previous


def path_lock_state(db: Session, user: User, quiz: Quiz, config: QuizPathConfig | None = None) -> tuple[bool, str | None]:
    config = config or db.scalar(select(QuizPathConfig).where(QuizPathConfig.quiz_id == quiz.id))
    if not config:
        return False, None
    if config.month_id:
        month = db.get(StudyMonth, config.month_id)
        if month:
            now = datetime.now(timezone.utc)
            if month.starts_at and _aware(month.starts_at) > now:
                return True, "الشهر / الوحدة هيفتح في الموعد المحدد"
            if month.ends_at and _aware(month.ends_at) < now:
                return True, "انتهى موعد الشهر / الوحدة"
    prerequisite_id = config.unlock_after_quiz_id
    if not prerequisite_id and config.requires_previous:
        prerequisite_id = _previous_quiz_id(db, config)
    if not prerequisite_id:
        return False, None
    score = _best_score(db, user.id, prerequisite_id)
    if score is None or score < config.min_previous_score:
        prereq = db.get(Quiz, prerequisite_id)
        name = prereq.title_ar if prereq else "الاختبار السابق"
        return True, f"لازم تنجح في {name} بنسبة {config.min_previous_score}% على الأقل"
    return False, None


def assert_path_access(db: Session, user: User, quiz: Quiz) -> None:
    locked, reason = path_lock_state(db, user, quiz)
    if locked:
        raise HTTPException(403, reason or "الاختبار مقفول حاليًا")
