"""
main.py — FastAPI application entry point
Scalability: Rate limiting, GZip compression, request timing, WebSocket support
"""
import time
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from database import init_db, init_mongo_indexes, get_settings
from routes import auth, employees, attendance, leave, payroll, recruitment, performance, ai, dashboard
from websocket_manager import manager as ws_manager

settings = get_settings()
logger = logging.getLogger("uvicorn.error")

# ─── Rate Limiter ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("[AI-HRMS] Starting backend server...")
    await init_db()
    await init_mongo_indexes()
    print("[AI-HRMS] Database tables created / verified")
    print("[AI-HRMS] MongoDB indexes initialized")
    print(f"[AI-HRMS] WebSocket manager ready")
    print("[AI-HRMS] Server ready at http://localhost:8000")
    yield
    print("[AI-HRMS] Shutting down...")


app = FastAPI(
    title="AI-HRMS API",
    description="""\
# AI-Powered Human Resource Management System

A full-featured HRMS with AI capabilities powered by **Groq Cloud API (Llama 3)**:
- **Resume Screening** — AI-powered candidate scoring with skills matching
- **Voice Interview** — AI voice screening with transcript evaluation
- **HR Chatbot "Alex"** — Conversational AI assistant with voice I/O
- **Performance Summaries** — AI-written professional review reports
- **Payroll Anomaly Detection** — Intelligent audit alerts
- **Workforce Insights** — Data-driven HR analytics
- **Real-Time Updates** — WebSocket-powered live dashboard

## Authentication
Use `/auth/login/json` to get a JWT token. Include as `Authorization: Bearer <token>`.
    """,
    version="2.0.0",
    contact={
        "name": "AI-HRMS Team",
        "url": "https://github.com/ai-hrms",
    },
    lifespan=lifespan,
)

# ─── Rate Limiter Setup ───────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Middleware ───────────────────────────────────────────────────────────────

# GZip all responses > 1KB for bandwidth efficiency
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
import os

# Mount static folder for uploads (video interviews, etc.)
os.makedirs(os.path.join("uploads", "video_interviews"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Adds X-Process-Time header for performance monitoring."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = round((time.perf_counter() - start) * 1000, 2)
    response.headers["X-Process-Time"] = f"{elapsed}ms"
    return response


# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(attendance.router)
app.include_router(leave.router)
app.include_router(payroll.router)
app.include_router(recruitment.router)
app.include_router(performance.router)
app.include_router(ai.router)
app.include_router(dashboard.router)


# ─── WebSocket Endpoint ───────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Real-time WebSocket endpoint.
    Client connects with ?token=<jwt> query param.
    Authenticated users receive role-specific live events:
      - attendance_update   — someone clocked in/out
      - leave_update        — leave request approved/rejected
      - employee_added      — new employee joined
      - notification        — general alert
    """
    from auth.jwt_handler import decode_token
    from database import get_mongo_db

    token = websocket.query_params.get("token")
    user_id = None

    try:
        if token:
            payload = decode_token(token)
            user_id = int(payload.get("sub", 0))
        else:
            user_id = 0  # anonymous — still connected, won't receive targeted messages
    except Exception:
        user_id = 0

    await ws_manager.connect(websocket, user_id)
    try:
        # Send initial connection ack
        import json
        await websocket.send_text(json.dumps({
            "event": "connected",
            "data": {
                "user_id": user_id,
                "connected_users": ws_manager.connected_count,
                "message": "Real-time connection established",
            }
        }))

        # Keep alive — listen for pings from client
        while True:
            data = await websocket.receive_text()
            parsed = json.loads(data) if data else {}
            if parsed.get("event") == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.warning(f"[WS] Error for user {user_id}: {e}")
        ws_manager.disconnect(websocket, user_id)


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "ok",
        "app": "AI-HRMS API",
        "version": "2.0.0",
        "docs": "/docs",
        "realtime_connections": ws_manager.connected_count,
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "timestamp": __import__("datetime").datetime.now().isoformat(),
        "realtime_connections": ws_manager.connected_count,
    }


# ─── Run directly ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
