"""
app/main.py - Application Entry Point
Creates the FastAPI app, registers all routers, starts background automation.
Run with: uvicorn app.main:app --reload  (from the backend/ directory)
"""

import os
import sys

# Ensure the backend root is always in sys.path so the old flat files
# (deduplication.py, constituency_mappings.py, etc.) remain importable.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.deps import require_admin
from app.api.routes import auth, devices, news, politicians, translation, social_media, shares, team, dashboard, audit, account, feedback, contacts, board
from app.core.config import settings

app = FastAPI(title="Nayak API")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,  # auth uses a Bearer header, not cookies
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",   # React inline styles + Google Fonts CSS
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",                                # news thumbnails come from many sites
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    # Content-Security-Policy for the web app. The API docs page (/docs) loads its own scripts, so it is left out.
    if not request.url.path.startswith(("/docs", "/redoc", "/openapi.json")):
        response.headers.setdefault("Content-Security-Policy", CSP)
    # Only meaningful (and only sent) when the app is served over HTTPS, directly or behind a proxy that sets the header.
    if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


@app.get("/api/health")
def health():
    """Liveness + DB check for uptime monitors. No auth, no data returned."""
    from fastapi.responses import JSONResponse
    from app.core.database import get_connection
    try:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.close()
        finally:
            conn.close()
    except Exception:
        return JSONResponse({"status": "error", "database": "down"}, status_code=503)
    return {"status": "ok", "database": "up"}


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(news.router)
app.include_router(politicians.router)
app.include_router(translation.router)
app.include_router(social_media.router)
app.include_router(shares.router)
app.include_router(team.router)
app.include_router(dashboard.router)
app.include_router(audit.router)
app.include_router(account.router)
app.include_router(feedback.router)
app.include_router(contacts.router)
app.include_router(board.router)
app.include_router(devices.router)

# ── Background Automation (Immediate on Boot, then Every 3 Hours) ────────────
@app.on_event("startup")
def start_background_scraper():
    if os.getenv("DEMO_FREEZE") == "1":     # demo mode: keep the stored news exactly as it is
        return
    from automation.manager import automation_manager
    automation_manager.start_scheduler()

@app.on_event("startup")
def start_alert_scheduler():
    if os.getenv("DEMO_FREEZE") == "1":
        return
    from app.services import alerts_service
    alerts_service.start_scheduler()


@app.get("/api/automation/status")
def get_automation_status(admin: dict = Depends(require_admin)):
    from automation.manager import automation_manager
    return {"status": "success", "data": automation_manager.get_status()}

@app.post("/api/automation/trigger")
def trigger_manual_automation(admin: dict = Depends(require_admin)):
    from automation.manager import automation_manager
    return automation_manager.trigger_async()

# ── Serve Frontend Production Build (if built) ────────────────────────────────
_DIST_DIR = os.path.abspath(os.path.join(_BACKEND_DIR, "..", "frontend", "dist"))
if os.path.isdir(_DIST_DIR):
    app.mount("/", StaticFiles(directory=_DIST_DIR, html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return {
            "status": "online",
            "message": "Nayak Backend API is running.",
            "api_docs": f"http://{settings.HOST}:{settings.PORT}/docs",
            "frontend_ui": "http://localhost:5173"
        }

if __name__ == "__main__":
    import uvicorn
    print(f"Starting Nayak Backend on http://{settings.HOST}:{settings.PORT} ...")
    # Auto-reload is for development only: set UVICORN_RELOAD=1 locally. Production runs a single process.
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=os.getenv("UVICORN_RELOAD") == "1")
