from datetime import datetime, timedelta, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import admin_user, current_user
from ..mailer import send_code_email
from ..models import (
    AdminSecurity,
    AuditLog,
    AuthorizedAdminEmail,
    RefreshToken,
    User,
    VerificationCode,
    UserPresence,
)
from ..schemas import (
    AdminEmailLoginRequestIn,
    AdminEmailLoginVerifyIn,
    AdminPinLoginIn,
    AdminPinSetIn,
    AdminPinResetRequestIn,
    AdminPinResetIn,
    ForgotPasswordIn,
    PresencePingIn,
    ResetPasswordIn,
    TokenOut,
)
from ..security import (
    code_hash,
    create_access_token,
    create_refresh_token,
    hash_password,
    password_is_strong,
    token_hash,
    verify_password,
)
from .auth import set_auth_cookies

router = APIRouter(prefix="/auth", tags=["auth"])
GENERIC_RESET = "لو الإيميل ده مسجل، هيوصله كود التحقق."
GENERIC_ADMIN = "لو الإيميل مسجل كأدمن، هيوصله كود التحقق."


def _aware(value):
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _audit(db: Session, actor: int | None, action: str, entity: str, entity_id=None, metadata="{}"):
    db.add(AuditLog(
        actor_user_id=actor,
        action=action,
        entity_type=entity,
        entity_id=str(entity_id) if entity_id is not None else None,
        metadata_json=metadata,
    ))


def _issue_session(db: Session, response: Response, user: User, action: str) -> TokenOut:
    access, expires = create_access_token(user.id, user.role)
    refresh, refresh_exp = create_refresh_token(user.id)
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash(refresh), expires_at=refresh_exp))
    _audit(db, user.id, action, "user", user.id)
    db.commit()
    set_auth_cookies(response, access, refresh, expires)
    return TokenOut(access_token=access, refresh_token=refresh, expires_in=expires)


def _new_code(db: Session, email: str, purpose: str, user_id: int | None = None) -> tuple[VerificationCode, str]:
    now = datetime.now(timezone.utc)
    rows = db.scalars(select(VerificationCode).where(
        VerificationCode.email == email,
        VerificationCode.purpose == purpose,
        VerificationCode.used_at.is_(None),
    )).all()
    for row in rows:
        row.used_at = now
    code = f"{secrets.randbelow(1000000):06d}"
    item = VerificationCode(
        email=email,
        user_id=user_id,
        purpose=purpose,
        code_hash=code_hash(code),
        expires_at=now + timedelta(minutes=10),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item, code


def _consume_code(db: Session, email: str, purpose: str, code: str) -> VerificationCode | None:
    now = datetime.now(timezone.utc)
    item = db.scalar(
        select(VerificationCode)
        .where(
            VerificationCode.email == email,
            VerificationCode.purpose == purpose,
            VerificationCode.used_at.is_(None),
        )
        .order_by(VerificationCode.created_at.desc())
    )
    if not item or _aware(item.expires_at) <= now:
        return None
    if item.attempts >= 5:
        item.used_at = now
        db.flush()
        return None
    if item.code_hash != code_hash(code):
        item.attempts += 1
        if item.attempts >= 5:
            item.used_at = now
        db.flush()
        return None
    item.used_at = now
    db.flush()
    return item


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordIn, db: Session = Depends(get_db)):
    settings = get_settings()
    email = str(data.email).lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    payload = {"ok": True, "message": GENERIC_RESET}
    if not user or not user.is_active:
        return payload
    _, code = _new_code(db, email, "password_reset", user.id)
    sent = False
    try:
        sent = send_code_email(email, code, "password_reset")
    except Exception:
        sent = False
    if settings.env == "production" and not sent:
        # Do not leave a usable code in the database when delivery failed.
        pending = db.scalar(select(VerificationCode).where(
            VerificationCode.email == email,
            VerificationCode.purpose == "password_reset",
            VerificationCode.used_at.is_(None),
        ).order_by(VerificationCode.created_at.desc()))
        if pending:
            pending.used_at = datetime.now(timezone.utc)
            db.commit()
        return payload
    if settings.env != "production" and not sent:
        payload["dev_code"] = code
    return payload


@router.post("/reset-password")
def reset_password(data: ResetPasswordIn, response: Response, db: Session = Depends(get_db)):
    email = str(data.email).lower().strip()
    if not password_is_strong(data.new_password):
        raise HTTPException(422, "كلمة المرور لازم 8 أحرف على الأقل وبها حرف كبير وصغير ورقم")
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(400, "الكود غير صحيح أو انتهت صلاحيته")
    item = _consume_code(db, email, "password_reset", data.code)
    if not item or item.user_id != user.id:
        # Persist failed-attempt counters/invalidation from _consume_code.
        db.commit()
        raise HTTPException(400, "الكود غير صحيح أو انتهت صلاحيته")
    user.password_hash = hash_password(data.new_password)
    now = datetime.now(timezone.utc)
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": now})
    _audit(db, user.id, "password_reset", "user", user.id)
    db.commit()
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@router.post("/admin-email/request")
def admin_email_request(data: AdminEmailLoginRequestIn, db: Session = Depends(get_db)):
    settings = get_settings()
    email = str(data.email).lower().strip()
    allowed = db.scalar(select(AuthorizedAdminEmail).where(
        AuthorizedAdminEmail.email == email,
        AuthorizedAdminEmail.is_active.is_(True),
    ))
    payload = {"ok": True, "message": GENERIC_ADMIN}
    if not allowed:
        return payload
    user = db.scalar(select(User).where(User.email == email))
    _, code = _new_code(db, email, "admin_email_login", user.id if user else None)
    sent = False
    try:
        sent = send_code_email(email, code, "admin_email_login")
    except Exception:
        sent = False
    if settings.env == "production" and not sent:
        pending = db.scalar(select(VerificationCode).where(
            VerificationCode.email == email,
            VerificationCode.purpose == "admin_email_login",
            VerificationCode.used_at.is_(None),
        ).order_by(VerificationCode.created_at.desc()))
        if pending:
            pending.used_at = datetime.now(timezone.utc)
            db.commit()
        return payload
    if settings.env != "production" and not sent:
        payload["dev_code"] = code
    return payload


@router.post("/admin-email/verify", response_model=TokenOut)
def admin_email_verify(data: AdminEmailLoginVerifyIn, response: Response, db: Session = Depends(get_db)):
    email = str(data.email).lower().strip()
    allowed = db.scalar(select(AuthorizedAdminEmail).where(
        AuthorizedAdminEmail.email == email,
        AuthorizedAdminEmail.is_active.is_(True),
    ))
    if not allowed:
        raise HTTPException(401, "الكود غير صحيح أو انتهت صلاحيته")
    code_item = _consume_code(db, email, "admin_email_login", data.code)
    if not code_item:
        # Persist failed-attempt counters/invalidation from _consume_code.
        db.commit()
        raise HTTPException(401, "الكود غير صحيح أو انتهت صلاحيته")
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        # Password-less bootstrap is limited to explicitly authorized admin emails.
        user = User(
            first_name=email.split("@", 1)[0][:80] or "Admin",
            last_name="Admin",
            email=email,
            phone=f"admin-{secrets.token_hex(8)}",
            password_hash=hash_password(secrets.token_urlsafe(32)),
            role=allowed.role,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.flush()
    else:
        if user.role not in {"admin", "owner"}:
            user.role = allowed.role
        user.is_active = True
        user.is_verified = True
    code_item.user_id = user.id
    db.flush()
    return _issue_session(db, response, user, "admin_email_login")


@router.post("/admin-pin", response_model=TokenOut)
def admin_pin_login(data: AdminPinLoginIn, response: Response, db: Session = Depends(get_db)):
    rows = db.execute(
        select(AdminSecurity, User)
        .join(User, User.id == AdminSecurity.user_id)
        .where(User.role.in_(["admin", "owner"]), User.is_active.is_(True), AdminSecurity.pin_hash.is_not(None))
    ).all()
    user = None
    for security, candidate in rows:
        if security.pin_hash and verify_password(data.pin, security.pin_hash):
            user = candidate
            break
    if not user:
        raise HTTPException(401, "الرقم السري غير صحيح")
    return _issue_session(db, response, user, "admin_pin_login")


@router.post("/admin-pin/setup")
def admin_pin_setup(data: AdminPinSetIn, db: Session = Depends(get_db), user: User = Depends(admin_user)):
    # Keep PIN-only login unambiguous: the same six digits cannot belong to two admins.
    other_rows = db.scalars(select(AdminSecurity).where(AdminSecurity.user_id != user.id, AdminSecurity.pin_hash.is_not(None))).all()
    if any(row.pin_hash and verify_password(data.pin, row.pin_hash) for row in other_rows):
        raise HTTPException(409, "اختار PIN مختلف؛ الرقم ده مستخدم لحساب إدارة آخر")
    security = db.scalar(select(AdminSecurity).where(AdminSecurity.user_id == user.id))
    if not security:
        security = AdminSecurity(user_id=user.id)
        db.add(security)
    security.pin_hash = hash_password(data.pin)
    _audit(db, user.id, "admin_pin_changed", "user", user.id)
    db.commit()
    return {"ok": True}


@router.post("/admin-password/forgot")
def admin_password_forgot(data: ForgotPasswordIn, db: Session = Depends(get_db)):
    settings = get_settings()
    email = str(data.email).lower().strip()
    payload = {"ok": True, "message": GENERIC_ADMIN}
    allowed = db.scalar(select(AuthorizedAdminEmail).where(
        AuthorizedAdminEmail.email == email, AuthorizedAdminEmail.is_active.is_(True),
    ))
    user = db.scalar(select(User).where(User.email == email))
    if not allowed or not user or not user.is_active or user.role not in {"admin", "owner"}:
        return payload
    _, code = _new_code(db, email, "admin_password_reset", user.id)
    sent = False
    try:
        sent = send_code_email(email, code, "admin_password_reset")
    except Exception:
        sent = False
    if settings.env == "production" and not sent:
        pending = db.scalar(select(VerificationCode).where(
            VerificationCode.email == email, VerificationCode.purpose == "admin_password_reset", VerificationCode.used_at.is_(None),
        ).order_by(VerificationCode.created_at.desc()))
        if pending:
            pending.used_at = datetime.now(timezone.utc)
            db.commit()
        return payload
    if settings.env != "production" and not sent:
        payload["dev_code"] = code
    return payload


@router.post("/admin-password/reset")
def admin_password_reset(data: ResetPasswordIn, response: Response, db: Session = Depends(get_db)):
    email = str(data.email).lower().strip()
    if not password_is_strong(data.new_password):
        raise HTTPException(422, "كلمة المرور لازم 8 أحرف على الأقل وبها حرف كبير وصغير ورقم")
    allowed = db.scalar(select(AuthorizedAdminEmail).where(
        AuthorizedAdminEmail.email == email, AuthorizedAdminEmail.is_active.is_(True),
    ))
    user = db.scalar(select(User).where(User.email == email))
    if not allowed or not user or not user.is_active or user.role not in {"admin", "owner"}:
        raise HTTPException(400, "الكود غير صحيح أو انتهت صلاحيته")
    item = _consume_code(db, email, "admin_password_reset", data.code)
    if not item or item.user_id != user.id:
        db.commit()
        raise HTTPException(400, "الكود غير صحيح أو انتهت صلاحيته")
    user.password_hash = hash_password(data.new_password)
    now = datetime.now(timezone.utc)
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)).update({"revoked_at": now})
    _audit(db, user.id, "admin_password_reset", "user", user.id)
    db.commit()
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@router.post("/admin-pin/forgot")
def admin_pin_forgot(data: AdminPinResetRequestIn, db: Session = Depends(get_db)):
    settings = get_settings()
    email = str(data.email).lower().strip()
    payload = {"ok": True, "message": GENERIC_ADMIN}
    allowed = db.scalar(select(AuthorizedAdminEmail).where(
        AuthorizedAdminEmail.email == email,
        AuthorizedAdminEmail.is_active.is_(True),
    ))
    user = db.scalar(select(User).where(User.email == email))
    if not allowed or not user or not user.is_active or user.role not in {"admin", "owner"}:
        return payload
    _, code = _new_code(db, email, "admin_pin_reset", user.id)
    sent = False
    try:
        sent = send_code_email(email, code, "admin_pin_reset")
    except Exception:
        sent = False
    if settings.env == "production" and not sent:
        pending = db.scalar(select(VerificationCode).where(
            VerificationCode.email == email,
            VerificationCode.purpose == "admin_pin_reset",
            VerificationCode.used_at.is_(None),
        ).order_by(VerificationCode.created_at.desc()))
        if pending:
            pending.used_at = datetime.now(timezone.utc)
            db.commit()
        return payload
    if settings.env != "production" and not sent:
        payload["dev_code"] = code
    return payload


@router.post("/admin-pin/reset")
def admin_pin_reset(data: AdminPinResetIn, db: Session = Depends(get_db)):
    email = str(data.email).lower().strip()
    allowed = db.scalar(select(AuthorizedAdminEmail).where(
        AuthorizedAdminEmail.email == email,
        AuthorizedAdminEmail.is_active.is_(True),
    ))
    user = db.scalar(select(User).where(User.email == email))
    if not allowed or not user or not user.is_active or user.role not in {"admin", "owner"}:
        raise HTTPException(400, "الكود غير صحيح أو انتهت صلاحيته")
    item = _consume_code(db, email, "admin_pin_reset", data.code)
    if not item or item.user_id != user.id:
        db.commit()
        raise HTTPException(400, "الكود غير صحيح أو انتهت صلاحيته")
    other_rows = db.scalars(select(AdminSecurity).where(AdminSecurity.user_id != user.id, AdminSecurity.pin_hash.is_not(None))).all()
    if any(row.pin_hash and verify_password(data.pin, row.pin_hash) for row in other_rows):
        raise HTTPException(409, "اختار PIN مختلف؛ الرقم ده مستخدم لحساب إدارة آخر")
    security = db.scalar(select(AdminSecurity).where(AdminSecurity.user_id == user.id))
    if not security:
        security = AdminSecurity(user_id=user.id)
        db.add(security)
    security.pin_hash = hash_password(data.pin)
    now = datetime.now(timezone.utc)
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)).update({"revoked_at": now})
    _audit(db, user.id, "admin_pin_reset", "user", user.id)
    db.commit()
    return {"ok": True}


@router.post("/presence")
def presence(data: PresencePingIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    row = db.get(UserPresence, user.id)
    now = datetime.now(timezone.utc)
    if not row:
        row = UserPresence(user_id=user.id, path=data.path, last_seen=now)
        db.add(row)
    else:
        row.path = data.path
        row.last_seen = now
    db.commit()
    return {"ok": True, "last_seen": now}
