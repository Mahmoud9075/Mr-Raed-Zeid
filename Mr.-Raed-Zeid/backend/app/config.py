from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Mr. Raed Zeid Platform API"
    env: str = "development"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./raed.db"
    jwt_secret: str = "CHANGE_ME_TO_A_LONG_RANDOM_SECRET_BEFORE_PRODUCTION"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    admin_email: str = "m47662226@gmail.com"
    admin_password: str = "ChangeMe123!"
    rate_limit_per_minute: int = 120
    auth_rate_limit_per_minute: int = 12
    assistant_rate_limit_per_minute: int = 30
    upload_dir: str = "./uploads"
    max_upload_mb: int = 5
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    admin_otp_required: bool = True
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [x.strip().rstrip("/") for x in self.allowed_origins.split(",") if x.strip()]

    def validate_production(self) -> None:
        if self.env != "production":
            return
        problems: list[str] = []
        if self.database_url.startswith("sqlite"):
            problems.append("DATABASE_URL must use a production database")
        if self.jwt_secret.startswith("CHANGE_ME") or len(self.jwt_secret) < 32:
            problems.append("JWT_SECRET must be a strong production secret")
        if self.admin_password == "ChangeMe123!" or len(self.admin_password) < 10:
            problems.append("ADMIN_PASSWORD must be changed before production")
        if not self.origins:
            problems.append("ALLOWED_ORIGINS must contain the frontend origin")
        if problems:
            raise RuntimeError("; ".join(problems))


@lru_cache
def get_settings() -> Settings:
    return Settings()
