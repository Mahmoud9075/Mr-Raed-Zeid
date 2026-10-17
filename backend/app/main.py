import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from .config import get_settings
from .seed import run_seed
from .routers import auth, quizzes, reviews, public, admin, notifications, assistant, search

settings = get_settings()



@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_production()
    run_seed()
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
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
_LAST_BUCKET_CLEANUP = 0.0


@app.middleware("http")
async def security_and_rate_limit(request: Request, call_next):
    global _LAST_BUCKET_CLEANUP
    path = request.url.path
    ip = request.client.host if request.client else "unknown"
    if "/auth/" in path:
        limit = settings.auth_rate_limit_per_minute
        scope = "auth"
    elif "/assistant/" in path:
        limit = settings.assistant_rate_limit_per_minute
        scope = "assistant"
    elif request.method == "POST" and path in {f"{settings.api_prefix}/contact", f"{settings.api_prefix}/reviews"}:
        limit = min(settings.rate_limit_per_minute, 20)
        scope = "public-write"
    else:
        limit = settings.rate_limit_per_minute
        scope = "global"

    # Reject unexpectedly large requests before parsing them. Profile uploads are
    # already capped more tightly by their own endpoint.
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            max_request = max(settings.max_upload_mb + 2, 8) * 1024 * 1024
            if int(content_length) > max_request:
                return JSONResponse({"detail": "حجم الطلب أكبر من المسموح"}, status_code=413)
        except ValueError:
            return JSONResponse({"detail": "Content-Length غير صالح"}, status_code=400)

    key = f"{ip}:{scope}"
    now = time.time()
    # Prevent unbounded growth if many one-off client IPs hit the service.
    if now - _LAST_BUCKET_CLEANUP > 600:
        stale = [bucket_key for bucket_key, values in _BUCKETS.items() if not values or values[-1] < now - 120]
        for bucket_key in stale:
            _BUCKETS.pop(bucket_key, None)
        _LAST_BUCKET_CLEANUP = now
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
    if path.startswith(f"{settings.api_prefix}/auth/") or path.startswith(f"{settings.api_prefix}/admin/"):
        response.headers["Cache-Control"] = "no-store"
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
