from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .db import get_db
from .models import User
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def _resolve_user(request: Request, credentials: HTTPAuthorizationCredentials | None, db: Session) -> User | None:
    token = credentials.credentials if credentials else request.cookies.get("access_token")
    if not token:
        return None
    try:
        data = decode_token(token)
        if data.get("type") != "access":
            return None
        user = db.get(User, int(data["sub"]))
    except Exception:
        return None
    if not user or not user.is_active:
        return None
    return user


def optional_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User | None:
    return _resolve_user(request, credentials, db)


def current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    user = _resolve_user(request, credentials, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="مطلوب تسجيل الدخول")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role not in {"admin", "owner"}:
        raise HTTPException(status_code=403, detail="صلاحية الأدمن مطلوبة")
    return user


def owner_user(user: User = Depends(current_user)) -> User:
    if user.role != "owner":
        raise HTTPException(status_code=403, detail="صلاحية المالك مطلوبة")
    return user
