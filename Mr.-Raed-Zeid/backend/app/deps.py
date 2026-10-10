from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .db import get_db
from .models import User
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def current_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    token = credentials.credentials if credentials else request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="مطلوب تسجيل الدخول")
    try:
        data = decode_token(token)
        if data.get("type") != "access":
            raise ValueError
        user = db.get(User, int(data["sub"]))
    except Exception:
        user = None
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="جلسة غير صالحة")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role not in {"admin", "owner"}:
        raise HTTPException(status_code=403, detail="صلاحية الأدمن مطلوبة")
    return user


def owner_user(user: User = Depends(current_user)) -> User:
    if user.role != "owner":
        raise HTTPException(status_code=403, detail="صلاحية المالك مطلوبة")
    return user
