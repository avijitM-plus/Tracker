from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database.database import engine, Base
from tracker.app_tracker import AppTracker
from tracker.idle_tracker import IdleTracker
from tracker.screenshot_tracker import ScreenshotTracker
from api.websockets import websocket_router, manager
from api.routes import router as api_router, current_website_state, classify_shortform_url
import threading
import asyncio
import time
import os
from datetime import datetime

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="NeuroTrack API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure data dir exists
os.makedirs("./data/screenshots", exist_ok=True)
app.mount("/screenshots", StaticFiles(directory="./data/screenshots"), name="screenshots")

app.include_router(websocket_router)
app.include_router(api_router)

# Start background trackers
app_tracker = AppTracker()
idle_tracker = IdleTracker(idle_timeout=60)
screenshot_tracker = ScreenshotTracker()

app_tracker_thread = threading.Thread(target=app_tracker.run, daemon=True)
idle_tracker_thread = threading.Thread(target=idle_tracker.run, daemon=True)
screenshot_tracker_thread = threading.Thread(target=screenshot_tracker.run, daemon=True)

app_tracker_thread.start()
idle_tracker_thread.start()
screenshot_tracker_thread.start()

async def broadcast_loop():
    while True:
        try:
            if len(manager.active_connections) > 0:
                payload = {
                    "app_name": app_tracker.current_app,
                    "process_name": app_tracker.current_process_name,
                    "window_title": app_tracker.current_window_title,
                    "session_start": app_tracker.session_start.isoformat() if app_tracker.session_start else None,
                    "is_idle": idle_tracker.is_idle,
                    "apm": idle_tracker.get_apm()
                }
                website_start = current_website_state.get("start_timestamp")
                shortform_kind = classify_shortform_url(
                    current_website_state.get("url"),
                    current_website_state.get("title")
                )
                payload.update({
                    "website_domain": current_website_state.get("domain"),
                    "website_url": current_website_state.get("url"),
                    "website_title": current_website_state.get("title"),
                    "website_start": website_start.isoformat() if website_start else None,
                    "shortform_kind": shortform_kind,
                    "shortform_elapsed_seconds": (
                        (datetime.utcnow() - website_start).total_seconds()
                        if shortform_kind and website_start else 0
                    )
                })
                await manager.broadcast(payload)
        except Exception as e:
            print(f"Broadcast error: {e}")
        await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(broadcast_loop())

@app.get("/api/status")
def get_status():
    return {"status": "running"}
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
