import base64, hashlib, hmac, os, secrets
from datetime import datetime, timedelta, timezone
import jwt
from .config import get_settings

settings = get_settings()

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=64)
    return "scrypt$" + base64.urlsafe_b64encode(salt).decode() + "$" + base64.urlsafe_b64encode(key).decode()

def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, salt_b64, key_b64 = encoded.split("$", 2)
        if scheme != "scrypt": return False
        salt = base64.urlsafe_b64decode(salt_b64.encode())
        expected = base64.urlsafe_b64decode(key_b64.encode())
        actual = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=len(expected))
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False

def password_is_strong(password: str) -> bool:
    return (len(password) >= 8 and any(c.isupper() for c in password) and any(c.islower() for c in password) and any(c.isdigit() for c in password))

def create_access_token(user_id: int, role: str) -> tuple[str, int]:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.access_token_minutes)
    payload = {"sub": str(user_id), "role": role, "iat": int(now.timestamp()), "exp": exp, "type": "access", "jti": secrets.token_hex(12)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), settings.access_token_minutes * 60

def create_refresh_token(user_id: int) -> tuple[str, datetime]:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=settings.refresh_token_days)
    payload = {"sub": str(user_id), "iat": int(now.timestamp()), "exp": exp, "type": "refresh", "jti": secrets.token_hex(20)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), exp

def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])

def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
