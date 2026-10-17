import json

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session
from .db import get_db
from .models import AdminSecurity, User
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


STANDARD_ADMIN_PERMISSIONS = {
    "dashboard", "students", "results", "reviews", "months", "quizzes", "content",
    "assistant", "settings", "analytics", "notifications", "admins",
}

def permission_required(permission: str):
    def dependency(user: User = Depends(admin_user), db: Session = Depends(get_db)) -> User:
        if user.role == "owner":
            return user
        security = db.scalar(select(AdminSecurity).where(AdminSecurity.user_id == user.id))
        if not security or not getattr(security, "permissions_customized", False):
            allowed = STANDARD_ADMIN_PERMISSIONS
        else:
            try:
                values = json.loads(security.permissions_json or "[]")
            except Exception:
                values = []
            allowed = {str(value) for value in values}
        if permission not in allowed:
            raise HTTPException(status_code=403, detail="معندكش صلاحية للجزء ده من لوحة الإدارة")
        return user
    return dependency
