from datetime import datetime, timedelta, timezone
from pathlib import Path
import secrets, hashlib, smtplib
from email.message import EmailMessage
from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, File
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User, RefreshToken, AuditLog, AdminInvite, AdminLoginCode
from ..schemas import RegisterIn, LoginIn, RefreshIn, TokenOut, UserOut, ProfileUpdateIn, ChangePasswordIn, AdminInviteAcceptIn, AdminOtpVerifyIn
from ..security import hash_password, verify_password, password_is_strong, create_access_token, create_refresh_token, token_hash, decode_token
from ..config import get_settings
from ..deps import current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def audit(db, actor, action, entity_type, entity_id=None, metadata="{}"):
    db.add(AuditLog(actor_user_id=actor, action=action, entity_type=entity_type, entity_id=str(entity_id) if entity_id else None, metadata_json=metadata))


def set_auth_cookies(response: Response, access: str, refresh: str, expires: int):
    settings = get_settings(); secure_cookie = settings.env == "production"
    response.set_cookie("access_token", access, httponly=True, secure=secure_cookie, samesite="strict", max_age=expires, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=secure_cookie, samesite="strict", max_age=settings.refresh_token_days * 86400, path="/")


@router.post("/register", response_model=UserOut, status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.lower().strip(); phone = data.phone.strip()
    exists = db.scalar(select(User).where(or_(User.email == email, User.phone == phone)))
    if exists:
        raise HTTPException(409, "البريد أو رقم الهاتف مستخدم بالفعل")
    if not password_is_strong(data.password):
        raise HTTPException(422, "كلمة المرور يجب أن تحتوي حروفًا كبيرة وصغيرة ورقمًا على الأقل")
    user = User(
        first_name=data.first_name.strip(), last_name=data.last_name.strip(), email=email, phone=phone,
        guardian_phone=(data.guardian_phone or "").strip() or None,
        stage=data.stage, education_type=data.education_type, grade=data.grade,
        school_name=(data.school_name or "").strip() or None,
        password_hash=hash_password(data.password), role="student"
    )
    db.add(user); db.flush(); audit(db, user.id, "register", "user", user.id); db.commit(); db.refresh(user)
    return user


def send_admin_code(email: str, code: str):
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_username or not settings.smtp_password:
        return False
    msg = EmailMessage()
    msg["Subject"] = "Mr. Raed Platform - Admin Login Code"
    msg["From"] = settings.smtp_from or settings.smtp_username
    msg["To"] = email
    msg.set_content(f"Your admin verification code is: {code}\nIt expires in 10 minutes.")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        smtp.starttls(); smtp.login(settings.smtp_username, settings.smtp_password); smtp.send_message(msg)
    return True


@router.post("/login")
def login(data: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    identifier = data.identifier.strip().lower()
    user = db.scalar(select(User).where(or_(User.email == identifier, User.phone == data.identifier.strip())))
    now = datetime.now(timezone.utc)
    if user and user.locked_until:
        locked = user.locked_until if user.locked_until.tzinfo else user.locked_until.replace(tzinfo=timezone.utc)
        if locked > now:
            raise HTTPException(423, "تم إيقاف المحاولات مؤقتًا. حاول لاحقًا")
    if not user or not verify_password(data.password, user.password_hash):
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.locked_until = now + timedelta(minutes=15); user.failed_login_attempts = 0
            audit(db, user.id, "login_failed", "user", user.id); db.commit()
        raise HTTPException(401, "بيانات الدخول غير صحيحة")
    if not user.is_active:
        raise HTTPException(403, "الحساب موقوف")
    user.failed_login_attempts = 0; user.locked_until = None
    settings = get_settings()
    if user.role in {"admin", "owner"} and settings.admin_otp_required:
        code = f"{secrets.randbelow(1000000):06d}"
        challenge = AdminLoginCode(user_id=user.id, code_hash=hashlib.sha256(code.encode()).hexdigest(), expires_at=now + timedelta(minutes=10))
        db.add(challenge); db.flush(); audit(db, user.id, "admin_otp_requested", "user", user.id); db.commit(); db.refresh(challenge)
        sent = False
        try:
            sent = send_admin_code(user.email, code)
        except Exception:
            sent = False
        if settings.env == "production" and not sent:
            raise HTTPException(503, "تعذر إرسال كود التحقق للإيميل")
        payload = {"requires_otp": True, "challenge_id": challenge.id}
        if settings.env != "production" and not sent:
            payload["dev_code"] = code
        return payload
    access, expires = create_access_token(user.id, user.role)
    refresh, refresh_exp = create_refresh_token(user.id)
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash(refresh), expires_at=refresh_exp))
    audit(db, user.id, "login_success", "user", user.id); db.commit()
    set_auth_cookies(response, access, refresh, expires)
    return TokenOut(access_token=access, refresh_token=refresh, expires_in=expires)


@router.post("/admin-otp", response_model=TokenOut)
def verify_admin_otp(data: AdminOtpVerifyIn, response: Response, db: Session = Depends(get_db)):
    challenge = db.get(AdminLoginCode, data.challenge_id)
    now = datetime.now(timezone.utc)
    if not challenge or challenge.used_at is not None:
        raise HTTPException(401, "كود التحقق غير صالح")
    expiry = challenge.expires_at if challenge.expires_at.tzinfo else challenge.expires_at.replace(tzinfo=timezone.utc)
    if expiry <= now:
        raise HTTPException(401, "انتهت صلاحية كود التحقق")
    if hashlib.sha256(data.code.encode()).hexdigest() != challenge.code_hash:
        raise HTTPException(401, "كود التحقق غير صحيح")
    user = db.get(User, challenge.user_id)
    if not user or user.role not in {"admin", "owner"} or not user.is_active:
        raise HTTPException(403, "الحساب غير متاح")
    challenge.used_at = now
    access, expires = create_access_token(user.id, user.role)
    refresh, refresh_exp = create_refresh_token(user.id)
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash(refresh), expires_at=refresh_exp))
    audit(db, user.id, "admin_otp_verified", "user", user.id); db.commit()
    set_auth_cookies(response, access, refresh, expires)
    return TokenOut(access_token=access, refresh_token=refresh, expires_in=expires)


@router.post("/refresh", response_model=TokenOut)
def refresh_token(data: RefreshIn, request: Request, response: Response, db: Session = Depends(get_db)):
    raw_refresh = data.refresh_token or request.cookies.get("refresh_token")
    if not raw_refresh:
        raise HTTPException(401, "رمز التحديث مفقود")
    try:
        payload = decode_token(raw_refresh)
        if payload.get("type") != "refresh":
            raise ValueError
        uid = int(payload["sub"])
    except Exception:
        raise HTTPException(401, "رمز التحديث غير صالح")
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash(raw_refresh), RefreshToken.revoked_at.is_(None)))
    now = datetime.now(timezone.utc)
    if not stored:
        raise HTTPException(401, "رمز التحديث ملغي")
    expiry = stored.expires_at if stored.expires_at.tzinfo else stored.expires_at.replace(tzinfo=timezone.utc)
    if expiry <= now:
        raise HTTPException(401, "انتهت صلاحية الجلسة")
    user = db.get(User, uid)
    if not user or not user.is_active:
        raise HTTPException(401, "الحساب غير متاح")
    stored.revoked_at = now
    access, expires = create_access_token(user.id, user.role)
    new_refresh, new_exp = create_refresh_token(user.id)
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash(new_refresh), expires_at=new_exp)); db.commit()
    set_auth_cookies(response, access, new_refresh, expires)
    return TokenOut(access_token=access, refresh_token=new_refresh, expires_in=expires)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.put("/profile", response_model=UserOut)
def update_profile(data: ProfileUpdateIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    for field in ("first_name", "last_name", "guardian_phone", "stage", "education_type", "grade", "school_name"):
        setattr(user, field, getattr(data, field))
    audit(db, user.id, "profile_updated", "user", user.id); db.commit(); db.refresh(user)
    return user


@router.post("/profile/image", response_model=UserOut)
def upload_profile_image(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(current_user)):
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(415, "صيغة الصورة غير مدعومة")
    suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[file.content_type]
    settings = get_settings(); upload_root = Path(settings.upload_dir); upload_root.mkdir(parents=True, exist_ok=True)
    name = f"user-{user.id}-{secrets.token_hex(8)}{suffix}"
    target = upload_root / name
    content = file.file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, "حجم الصورة أكبر من 5MB")
    target.write_bytes(content)
    user.profile_image = f"/uploads/{name}"
    audit(db, user.id, "profile_image_updated", "user", user.id); db.commit(); db.refresh(user)
    return user


@router.post("/change-password", status_code=204)
def change_password(data: ChangePasswordIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(422, "كلمة المرور الحالية غير صحيحة")
    if not password_is_strong(data.new_password):
        raise HTTPException(422, "كلمة المرور الجديدة غير قوية بما يكفي")
    user.password_hash = hash_password(data.new_password)
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)).update({"revoked_at": datetime.now(timezone.utc)})
    audit(db, user.id, "password_changed", "user", user.id); db.commit()


@router.post("/admin-invite/accept", response_model=UserOut, status_code=201)
def accept_admin_invite(data: AdminInviteAcceptIn, db: Session = Depends(get_db)):
    invitation = db.scalar(select(AdminInvite).where(AdminInvite.token_hash == token_hash(data.token), AdminInvite.accepted_at.is_(None)))
    if not invitation:
        raise HTTPException(404, "الدعوة غير صالحة")
    now = datetime.now(timezone.utc)
    expiry = invitation.expires_at if invitation.expires_at.tzinfo else invitation.expires_at.replace(tzinfo=timezone.utc)
    if expiry <= now:
        raise HTTPException(410, "انتهت صلاحية الدعوة")
    if db.scalar(select(User).where(or_(User.email == invitation.email, User.phone == data.phone.strip()))):
        raise HTTPException(409, "البريد أو رقم الهاتف مستخدم")
    if not password_is_strong(data.password):
        raise HTTPException(422, "كلمة المرور غير قوية بما يكفي")
    user = User(first_name=data.first_name.strip(), last_name=data.last_name.strip(), email=invitation.email, phone=data.phone.strip(), password_hash=hash_password(data.password), role=invitation.role, is_active=True, is_verified=True)
    db.add(user); db.flush(); invitation.accepted_at = now
    audit(db, user.id, "admin_invite_accepted", "user", user.id); db.commit(); db.refresh(user)
    return user


@router.post("/logout", status_code=204)
def logout(data: RefreshIn, request: Request, response: Response, db: Session = Depends(get_db)):
    raw_refresh = data.refresh_token or request.cookies.get("refresh_token")
    if raw_refresh:
        stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash(raw_refresh), RefreshToken.revoked_at.is_(None)))
        if stored:
            stored.revoked_at = datetime.now(timezone.utc); db.commit()
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
