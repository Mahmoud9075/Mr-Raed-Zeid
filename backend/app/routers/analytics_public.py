from datetime import datetime, timedelta, timezone
import hashlib, hmac

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import optional_current_user
from ..models import PageVisit, User
from ..schemas import VisitIn

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _ip_hash(ip: str) -> str:
    key = get_settings().jwt_secret.encode()
    return hmac.new(key, ip.encode(), hashlib.sha256).hexdigest()


@router.post("/visit")
def track_visit(data: VisitIn, request: Request, db: Session = Depends(get_db), user: User | None = Depends(optional_current_user)):
    path = data.path.strip()
    if not path.startswith("/"):
        path = "/" + path
    ip = request.client.host if request.client else "unknown"
    digest = _ip_hash(ip)
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=5)
    recent = db.scalar(
        select(PageVisit).where(PageVisit.path == path, PageVisit.ip_hash == digest, PageVisit.visited_at >= cutoff)
    )
    if recent:
        return {"ok": True, "skipped": True}
    db.add(PageVisit(path=path, user_id=user.id if user else None, ip_hash=digest))
    db.commit()
    return {"ok": True}
