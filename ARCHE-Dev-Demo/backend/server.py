"""
ArchePersona RK 2 Demo — Backend
=================================
Side-by-side comparison of RK 2 (full cognitive pipeline + persistent memory)
vs Plain LLM (stateless, vanilla Claude).
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from anthropic import AsyncAnthropic
from dotenv import load_dotenv
from emergentintegrations.llm.openai import OpenAISpeechToText
from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

from arche.core import apply_delivery_to_session, generate_response_seed, validate_chat_input
from arche.delivery import deliver_response
from rk_engine import PLAIN_LLM_SYSTEM_PROMPT, default_signals, extract_facts
from supabase_helper import (
    categorize_fact,
    fetch_recent_memories,
    get_current_user,
    insert_memory,
    supabase_configured,
)

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("rk2")

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[db_name]

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")
anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

# Whisper transcription — uses Emergent universal LLM key
_emergent_key = os.environ.get("EMERGENT_LLM_KEY", "")
stt_client: OpenAISpeechToText | None = (
    OpenAISpeechToText(api_key=_emergent_key) if _emergent_key else None
)

MEMORY_TURN_CAP = 200          # how many full turns we KEEP in storage (cheap)
PROMPT_HISTORY_TURNS = 8       # how many turns we SEND to Claude per call (expensive)
FACTS_IN_PROMPT = 6            # durable facts surfaced in system prompt
SESSION_TTL_DAYS = 90          # bumped 7 -> 90 to protect demo + early-user sessions
SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60
RESPONSE_MAX_TOKENS = 700

# ---------------------------------------------------------------------------
# Admin gate — only emails in ADMIN_EMAILS env var (comma-separated) can
# read/write engine overrides. Empty list = admin endpoints disabled.
# ---------------------------------------------------------------------------
ADMIN_EMAILS: set[str] = {
    e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()
}


def require_admin(current_user: dict) -> None:
    email = (current_user.get("email") or "").lower()
    if not ADMIN_EMAILS or email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="admin only")


# Valid override values — guards against typos / injection.
VALID_STATES = {
    "Warm", "Curious", "Focused",
    "Guarded", "Avoidant", "Stuck",
    "Retreating", "Gentle", "Shutdown",
}
VALID_MODES = {"NORMAL", "RELATIONAL", "EXPLORATORY", "CLINICAL", "PROTECTIVE"}

app = FastAPI(title="BRUNEL — Powered by ARCHE")
api = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    message: str
    target: str = Field(
        default="both", description="rk_only | plain_only | both"
    )


class DeliveryEnvelopeModel(BaseModel):
    full_text: str | None = None
    beats: list[str] = []
    render_mode: str = "paced"
    pacing_profile: str = "calm"
    beat_pause_ms: int = 650
    typing_speed: str = "medium"
    max_chars_per_beat: int = 280


class ChatResponse(BaseModel):
    """Public chat response — text plus optional paced delivery envelopes.

    Internal pipeline state (mode, directive, flags, weights, tribunal) stays
    server-side. The delivery envelope contains presentation metadata only.
    """
    turn: int
    rk_response: str | None = None
    plain_response: str | None = None
    rk_delivery: DeliveryEnvelopeModel | None = None
    plain_delivery: DeliveryEnvelopeModel | None = None


class TurnPayload(BaseModel):
    """Internal-only payload — full pipeline state. NOT returned over HTTP."""
    turn: int
    user_message: str
    rk_response: str | None = None
    plain_response: str | None = None
    state: str
    zone: str
    mode: str
    directive: str
    flags: list[str]
    weights: dict[str, float]
    target: str


class SessionState(BaseModel):
    """Public session hydration response — only conversation history.
    Internal state (mode/weights/flags/etc.) is not exposed."""
    session_id: str
    rk_history: list[dict]


# ---------------------------------------------------------------------------
# Mongo helpers
# ---------------------------------------------------------------------------
async def get_or_create_session(session_id: str) -> dict:
    doc = await db.sessions.find_one({"session_id": session_id}, {"_id": 0})
    if doc:
        return doc
    doc = {
        "session_id": session_id,
        "created": datetime.now(timezone.utc).isoformat(),
        "updated": datetime.now(timezone.utc),
        "rk_history": [],          # full RK 2 turns
        "plain_history": [],       # plain LLM (stateless, but we log for UI replay)
        "rk_facts": [],            # extracted facts about the user
        "signals": default_signals(),
        "last_state": "Focused",
        "last_zone": "engaged",
        "last_mode": "NORMAL",
        "last_flags": [],
        "topic_entropy": {},        # token -> weight; updated each user turn
    }
    await db.sessions.insert_one(dict(doc))
    return doc


async def save_session(session: dict) -> None:
    session["updated"] = datetime.now(timezone.utc)
    await db.sessions.replace_one(
        {"session_id": session["session_id"]},
        {k: v for k, v in session.items() if k != "_id"},
        upsert=True,
    )


# ---------------------------------------------------------------------------
# Claude calls — delivery engine invokes these, but API owns the configured
# Anthropic client for now.
# ---------------------------------------------------------------------------
async def call_rk2(user_message: str, system_prompt: str, rk_history: list[dict]) -> str:
    """RK 2 call — only the most recent N turns are sent to Claude.
    Older turns remain in storage for fact extraction + future eviction policy,
    but we don't waste tokens replaying them every turn."""
    messages: list[dict[str, str]] = []
    for turn in rk_history[-PROMPT_HISTORY_TURNS:]:
        if turn.get("user"):
            messages.append({"role": "user", "content": turn["user"]})
        if turn.get("assistant"):
            messages.append({"role": "assistant", "content": turn["assistant"]})
    messages.append({"role": "user", "content": user_message})

    resp = await anthropic_client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=RESPONSE_MAX_TOKENS,
        system=system_prompt,
        messages=messages,
    )
    return resp.content[0].text.strip()


async def call_plain(user_message: str) -> str:
    """Plain LLM — no memory, no state. Stateless on purpose."""
    resp = await anthropic_client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=RESPONSE_MAX_TOKENS,
        system=PLAIN_LLM_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    return resp.content[0].text.strip()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@api.get("/")
async def root() -> dict:
    return {"app": "BRUNEL"}


@api.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
) -> ChatResponse:
    try:
        validate_chat_input(req.message, req.target)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    user_id: str = current_user["id"]
    user_jwt: str = current_user["token"]
    session = await get_or_create_session(user_id)
    rk_history = session["rk_history"]

    # ---- Memory context used by the seed engine ----
    sb_memories = fetch_recent_memories(user_jwt=user_jwt, user_id=user_id) if supabase_configured() else []
    memory_strings = [m.get("memory_text", "") for m in sb_memories if m.get("memory_text")]

    # ---- Seed engine: internal decision assembly, no model call ----
    seed = generate_response_seed(
        message=req.message,
        session=session,
        memory_strings=memory_strings,
        valid_states=VALID_STATES,
        valid_modes=VALID_MODES,
    )

    # ---- Delivery engine: model invocation + output scrub ----
    try:
        delivered = await deliver_response(
            target=req.target,
            user_message=req.message,
            seed=seed,
            rk_history=rk_history,
            call_rk2=call_rk2,
            call_plain=call_plain,
        )
    except Exception as e:
        logger.exception("Delivery failed")
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}") from e

    # ---- Durable memory extraction → public.memories ----
    if delivered.rk_text is not None and supabase_configured():
        existing_texts = {m.get("memory_text") for m in sb_memories}
        for fact in extract_facts(req.message):
            if fact in existing_texts:
                continue
            insert_memory(
                user_jwt=user_jwt,
                user_id=user_id,
                memory_text=fact,
                category=categorize_fact(fact),
            )

    # ---- Apply delivery back into session and persist ----
    apply_delivery_to_session(
        session=session,
        seed=seed,
        user_message=req.message,
        rk_text=delivered.rk_text,
        plain_text=delivered.plain_text,
    )
    await save_session(session)

    return ChatResponse(
        turn=len(session["rk_history"]),
        rk_response=delivered.rk_text,
        plain_response=delivered.plain_text,
        rk_delivery=delivered.rk_envelope.to_dict() if delivered.rk_envelope else None,
        plain_delivery=delivered.plain_envelope.to_dict() if delivered.plain_envelope else None,
    )


@api.post("/reset")
async def reset(current_user: dict = Depends(get_current_user)) -> dict:
    user_id = current_user["id"]
    await db.sessions.delete_one({"session_id": user_id})
    return {"ok": True}


@api.get("/session/{session_id}", response_model=SessionState)
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
) -> SessionState:
    # Users can only read their own session.
    if session_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="forbidden")
    session = await get_or_create_session(session_id)
    return SessionState(
        session_id=session["session_id"],
        rk_history=[
            {"user": t.get("user", ""), "assistant": t.get("assistant", "")}
            for t in session.get("rk_history", [])
        ],
    )


@api.get("/me")
async def me(current_user: dict = Depends(get_current_user)) -> dict:
    return {"id": current_user["id"], "email": current_user.get("email")}


# ---------------------------------------------------------------------------
# Voice-to-text — multipart audio upload → Whisper → plain text
# Browser MediaRecorder typically produces webm or mp4.
# ---------------------------------------------------------------------------
ALLOWED_AUDIO_MIME = {
    "audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3",
    "audio/wav", "audio/x-wav", "audio/m4a", "audio/x-m4a",
    "audio/ogg",
}
MAX_AUDIO_BYTES = 25 * 1024 * 1024  # 25 MB matches Whisper limit


@api.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> dict:
    if stt_client is None:
        raise HTTPException(status_code=503, detail="transcription not configured")
    if audio.content_type:
        base = audio.content_type.split(";", 1)[0].strip()
        if base not in ALLOWED_AUDIO_MIME:
            raise HTTPException(status_code=400, detail=f"unsupported audio type: {audio.content_type}")
    blob = await audio.read()
    if not blob:
        raise HTTPException(status_code=400, detail="empty audio")
    if len(blob) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio too large (25MB max)")
    import io
    filename = audio.filename or "audio.webm"
    buf = io.BytesIO(blob)
    buf.name = filename
    try:
        resp = await stt_client.transcribe(
            file=buf,
            model="whisper-1",
            response_format="text",
        )
    except Exception as e:
        logger.exception("Whisper transcribe failed")
        raise HTTPException(status_code=502, detail=f"transcription failed: {e}") from e
    text = resp if isinstance(resp, str) else getattr(resp, "text", "")
    return {"text": (text or "").strip()}


# ---------------------------------------------------------------------------
# Admin override — force a specific state/mode for THIS user's next replies.
# Stored on the user's session document; cleared by explicit DELETE.
# Bypasses natural emergence; useful for validating behavior tiers.
# ---------------------------------------------------------------------------
class OverridePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    state: str | None = None
    mode: str | None = None


@api.get("/admin/override")
async def get_override(current_user: dict = Depends(get_current_user)) -> dict:
    require_admin(current_user)
    session = await get_or_create_session(current_user["id"])
    override = session.get("admin_override") or {}
    return {
        "state": override.get("state"),
        "mode": override.get("mode"),
        "valid_states": sorted(VALID_STATES),
        "valid_modes": sorted(VALID_MODES),
    }


@api.put("/admin/override")
async def set_override(
    payload: OverridePayload,
    current_user: dict = Depends(get_current_user),
) -> dict:
    require_admin(current_user)
    if payload.state and payload.state not in VALID_STATES:
        raise HTTPException(status_code=400, detail=f"invalid state: {payload.state}")
    if payload.mode and payload.mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail=f"invalid mode: {payload.mode}")
    session = await get_or_create_session(current_user["id"])
    session["admin_override"] = {
        "state": payload.state,
        "mode": payload.mode,
    }
    await save_session(session)
    return {"ok": True, "state": payload.state, "mode": payload.mode}


@api.delete("/admin/override")
async def clear_override(current_user: dict = Depends(get_current_user)) -> dict:
    require_admin(current_user)
    session = await get_or_create_session(current_user["id"])
    session["admin_override"] = {}
    await save_session(session)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Wire up
# ---------------------------------------------------------------------------
app.include_router(api)

# ---------------------------------------------------------------------------
# Origin allowlist — defends against cross-site abuse even when the ingress
# layer overrides CORS headers with a wildcard. Requests from non-whitelisted
# browser origins receive 403 before the route handler runs. Server-to-server
# clients (curl, monitoring) without an Origin header pass through.
# ---------------------------------------------------------------------------
_ALLOWED_ORIGINS = {
    o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()
}


@app.middleware("http")
async def enforce_origin_allowlist(request: Request, call_next):
    """Origin allowlist disabled — set CORS_ORIGINS to a comma-separated
    domain list to re-enable. With CORS_ORIGINS='*' (default) all browser
    origins are allowed."""
    if "*" in _ALLOWED_ORIGINS or not _ALLOWED_ORIGINS:
        return await call_next(request)
    origin = request.headers.get("origin")
    if origin and origin not in _ALLOWED_ORIGINS:
        return JSONResponse(
            status_code=403,
            content={"detail": "origin not allowed"},
        )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=list(_ALLOWED_ORIGINS) if _ALLOWED_ORIGINS else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def ensure_indexes() -> None:
    """Create a TTL index so sessions auto-delete SESSION_TTL_DAYS after
    last update. The `updated` field is a native BSON datetime."""
    try:
        await db.sessions.create_index(
            "updated",
            expireAfterSeconds=SESSION_TTL_SECONDS,
            name="sessions_ttl_updated",
        )
        logger.info(
            "TTL index ensured on sessions.updated (%d days / %d seconds)",
            SESSION_TTL_DAYS, SESSION_TTL_SECONDS,
        )
    except Exception as e:
        logger.warning("Failed to ensure TTL index: %s", e)


@app.on_event("shutdown")
async def shutdown() -> None:
    mongo_client.close()
