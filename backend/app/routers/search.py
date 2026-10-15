from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..deps import current_user
from ..models import Quiz, ChatKnowledge, User

router = APIRouter(prefix="/search", tags=["search"])


def aware(value):
    if not value:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


@router.get("")
def search(q: str = Query(min_length=2,max_length=100), db: Session = Depends(get_db), user: User = Depends(current_user)):
    needle = q.lower().strip()
    results = []
    now = datetime.now(timezone.utc)
    quizzes = db.scalars(
        select(Quiz)
        .where(Quiz.is_published.is_(True), Quiz.is_archived.is_(False))
        .options(selectinload(Quiz.questions))
    ).all()
    for item in quizzes:
        if item.starts_at and aware(item.starts_at) > now:
            continue
        if item.ends_at and aware(item.ends_at) < now:
            continue
        if item.stage and item.stage != user.stage:
            continue
        if item.education_type and item.education_type != user.education_type:
            continue
        if item.grade and item.grade != user.grade:
            continue
        hay = f"{item.title_ar} {item.title_en} {item.description_ar} {item.stage or ''} {item.grade or ''}".lower()
        if needle in hay:
            results.append({"type":"quiz","title":item.title_ar,"subtitle":item.description_ar,"href":f"/quizzes/{item.slug}"})

    knowledge = db.scalars(select(ChatKnowledge).where(ChatKnowledge.is_active.is_(True))).all()
    for item in knowledge:
        hay = f"{item.question} {item.answer} {item.keywords}".lower()
        if needle in hay:
            results.append({"type":"info","title":item.question,"subtitle":item.answer,"href":"/student/assistant"})
    return results[:50]
