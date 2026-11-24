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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import auth, news, politicians, tasks, translation, social_media
from app.core.config import settings

app = FastAPI(title="Telangana AI Smart Office API")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(news.router)
app.include_router(politicians.router)
app.include_router(tasks.router)
app.include_router(translation.router)
app.include_router(social_media.router)

# ── Background Automation (Immediate on Boot, then Every 3 Hours) ────────────
@app.on_event("startup")
def start_background_scraper():
    from automation.manager import automation_manager
    automation_manager.start_scheduler()

@app.get("/api/automation/status")
def get_automation_status():
    from automation.manager import automation_manager
    return {"status": "success", "data": automation_manager.get_status()}

@app.post("/api/automation/trigger")
def trigger_manual_automation():
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
            "message": "AI Smart Office Backend API is running.",
            "api_docs": f"http://{settings.HOST}:{settings.PORT}/docs",
            "frontend_ui": "http://localhost:5173"
        }

if __name__ == "__main__":
    import uvicorn
    print(f"Starting AI Smart Office Backend on http://{settings.HOST}:{settings.PORT} ...")
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
