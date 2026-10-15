from fastapi import APIRouter, Depends
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import current_user
from ..models import Notification, User

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def mine(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(Notification).where(Notification.is_active.is_(True)).order_by(Notification.created_at.desc()).limit(100)).all()
    out=[]
    for n in rows:
        if n.user_id and n.user_id != user.id: continue
        if n.stage and n.stage != user.stage: continue
        if n.education_type and n.education_type != user.education_type: continue
        if n.grade and n.grade != user.grade: continue
        out.append({"id":n.id,"title":n.title,"body":n.body,"created_at":n.created_at})
    return out
