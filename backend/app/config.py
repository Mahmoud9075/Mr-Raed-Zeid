from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
DEFAULT_DB_PATH = (BACKEND_DIR / "raed.db").resolve()
DEFAULT_UPLOAD_DIR = (BACKEND_DIR / "uploads").resolve()


class Settings(BaseSettings):
    app_name: str = "Mr. Raed Zeid Platform API"
    env: str = "development"
    api_prefix: str = "/api/v1"
    database_url: str = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"
    jwt_secret: str = "CHANGE_ME_TO_A_LONG_RANDOM_SECRET_BEFORE_PRODUCTION"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    allowed_origins: str = "http://localhost:3100,http://127.0.0.1:3100,http://localhost:3000,http://127.0.0.1:3000"
    admin_email: str = "m47662226@gmail.com"
    admin_password: str = ""
    rate_limit_per_minute: int = 120
    auth_rate_limit_per_minute: int = 12
    assistant_rate_limit_per_minute: int = 30
    upload_dir: str = str(DEFAULT_UPLOAD_DIR)
    max_upload_mb: int = 5
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    admin_otp_required: bool = False
    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_ROOT / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def origins(self) -> list[str]:
        return [x.strip().rstrip("/") for x in self.allowed_origins.split(",") if x.strip()]

    def validate_production(self) -> None:
        if self.env != "production":
            return
        problems: list[str] = []
        if self.database_url.startswith("sqlite"):
            problems.append("DATABASE_URL must use a production database")
        jwt_secret = self.jwt_secret.strip()
        if (
            len(jwt_secret) < 32
            or "CHANGE_ME" in jwt_secret.upper()
            or "LOCALJWTONLY" in jwt_secret.upper()
            or "REPLACE_WITH" in jwt_secret.upper()
        ):
            problems.append("JWT_SECRET must be a strong production secret")
        admin_password = self.admin_password.strip()
        if (
            len(admin_password) < 16
            or "CHANGE_ME" in admin_password.upper()
            or "CHANGEBEFOREDEPLOY" in admin_password.upper()
            or "LOCALONLY" in admin_password.upper()
            or "REPLACE_WITH" in admin_password.upper()
        ):
            problems.append("ADMIN_PASSWORD must be a unique, strong production password")
        if not self.origins:
            problems.append("ALLOWED_ORIGINS must contain the frontend origin")
        if problems:
            raise RuntimeError("; ".join(problems))


@lru_cache
def get_settings() -> Settings:
    return Settings()
