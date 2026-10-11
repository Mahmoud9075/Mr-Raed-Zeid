import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select, text
from .config import get_settings
from .db import Base, SessionLocal, engine
from .models import Quiz, QuizAttempt
from .routers import auth, quizzes, reviews, public, admin, notifications, assistant, search

settings = get_settings()


def archive_unused_demo_quiz() -> None:
    db = SessionLocal()
    try:
        quiz = db.scalar(select(Quiz).where(Quiz.slug == "english-placement-50"))
        if not quiz:
            return
        attempts = db.scalar(select(func.count()).select_from(QuizAttempt).where(QuizAttempt.quiz_id == quiz.id)) or 0
        if attempts == 0:
            quiz.is_published = False
            quiz.is_archived = True
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_production()
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            conn.execute(text("SELECT pg_advisory_xact_lock(987654321)"))
        Base.metadata.create_all(bind=conn)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    archive_unused_demo_quiz()
    yield


app = FastAPI(
    title=settings.app_name,
    version="3.0.0",
    docs_url="/docs" if settings.env != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept-Language"],
)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir, check_dir=False), name="uploads")

_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


@app.middleware("http")
async def security_and_rate_limit(request: Request, call_next):
    path = request.url.path
    ip = request.client.host if request.client else "unknown"
    if "/auth/" in path:
        limit = settings.auth_rate_limit_per_minute
        scope = "auth"
    elif "/assistant/" in path:
        limit = settings.assistant_rate_limit_per_minute
        scope = "assistant"
    else:
        limit = settings.rate_limit_per_minute
        scope = "global"

    key = f"{ip}:{scope}"
    now = time.time()
    bucket = _BUCKETS[key]
    while bucket and bucket[0] < now - 60:
        bucket.popleft()
    if len(bucket) >= limit:
        return JSONResponse({"detail": "حاول مرة تانية بعد دقيقة."}, status_code=429, headers={"Retry-After": "60"})
    bucket.append(now)

    if settings.env == "production" and request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") not in settings.origins:
            return JSONResponse({"detail": "Request origin is not allowed"}, status_code=403)

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    if settings.env == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "status": "ready",
        "version": "3.0.0",
        "docs": "/docs" if settings.env != "production" else None,
    }


for router in (public.router, auth.router, quizzes.router, reviews.router, admin.router, notifications.router, assistant.router, search.router):
    app.include_router(router, prefix=settings.api_prefix)
