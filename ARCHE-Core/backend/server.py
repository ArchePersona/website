"""
ArchePersona RK 2 Demo — Backend
=================================
Side-by-side comparison of RK 2 (full cognitive pipeline + persistent memory)
vs Plain LLM (stateless, vanilla Claude).
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from anthropic import AsyncAnthropic
from archive_organ import ArchiveOrgan
from artifact_organ import ArtifactOrgan
from context_organ import BrunelContextOrgan
from cybrary import build_cybrary_router
from dotenv import load_dotenv
from emergentintegrations.llm.openai import OpenAISpeechToText
from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from memory_organ import MemoryOrgan
from motor.motor_asyncio import AsyncIOMotorClient
from packet_organ import PacketOrgan
from pydantic import BaseModel, ConfigDict, Field
from reflection_organ import ReflectionOrgan
from rk_engine import PLAIN_LLM_SYSTEM_PROMPT, build_rk_system_prompt, default_signals
from starlette.middleware.cors import CORSMiddleware
from state_organ import StateOrgan
from supabase_helper import get_current_user
from transcript_organ import TRANSCRIPT_PROMPT_CHAR_LIMIT, TRANSCRIPT_TURN_LIMIT, build_session_transcript as organ_build_session_transcript

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("rk2")

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[db_name]

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")
anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

_emergent_key = os.environ.get("EMERGENT_LLM_KEY", "")
stt_client: OpenAISpeechToText | None = OpenAISpeechToText(api_key=_emergent_key) if _emergent_key else None

MEMORY_TURN_CAP = 200
PROMPT_HISTORY_TURNS = 2
FACTS_IN_PROMPT = 6
SESSION_TTL_DAYS = 90
SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60
RESPONSE_MAX_TOKENS = 700
CYBRARY_PROMPT_CHAR_LIMIT = 12000
SYNOPSIS_TURNS = 8
VALID_STATES = {"Warm", "Curious", "Focused", "Guarded", "Avoidant", "Stuck", "Retreating", "Gentle", "Shutdown"}
VALID_MODES = {"NORMAL", "RELATIONAL", "EXPLORATORY", "CLINICAL", "PROTECTIVE"}

context_organ = BrunelContextOrgan(
    transcript_turn_limit=TRANSCRIPT_TURN_LIMIT,
    transcript_char_limit=TRANSCRIPT_PROMPT_CHAR_LIMIT,
    synopsis_turn_limit=SYNOPSIS_TURNS,
)
artifact_organ = ArtifactOrgan(db=db, prompt_char_limit=CYBRARY_PROMPT_CHAR_LIMIT)
packet_organ = PacketOrgan(synopsis_turn_limit=SYNOPSIS_TURNS)
memory_organ = MemoryOrgan()
reflection_organ = ReflectionOrgan()
state_organ = StateOrgan(valid_states=VALID_STATES, valid_modes=VALID_MODES)
archive_organ = ArchiveOrgan(synopsis_turn_limit=SYNOPSIS_TURNS)

ADMIN_EMAILS: set[str] = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}


def require_admin(current_user: dict) -> None:
    email = (current_user.get("email") or "").lower()
    if not ADMIN_EMAILS or email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="admin only")


app = FastAPI(title="BRUNEL — Powered by ARCHE")
api = APIRouter(prefix="/api")


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    message: str
    target: str = Field(default="both", description="rk_only | plain_only | both")
    cybrary_item_ids: list[str] = Field(default_factory=list)
    client_ts: str | None = None
    client_timezone: str | None = None


class ChatResponse(BaseModel):
    turn: int
    rk_response: str | None = None
    plain_response: str | None = None


class SessionState(BaseModel):
    session_id: str
    rk_history: list[dict]


class OverridePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    state: str | None = None
    mode: str | None = None


async def get_or_create_session(session_id: str) -> dict:
    doc = await db.sessions.find_one({"session_id": session_id}, {"_id": 0})
    if doc:
        return doc
    now = datetime.now(timezone.utc)
    doc = {
        "session_id": session_id,
        "created": now.isoformat(),
        "first_seen": now.isoformat(),
        "updated": now,
        "rk_history": [],
        "plain_history": [],
        "rk_facts": [],
        "signals": default_signals(),
        "last_state": "Focused",
        "last_zone": "engaged",
        "last_mode": "NORMAL",
        "last_flags": [],
        "topic_entropy": {},
        "continuity_synopsis": "No prior session synopsis yet.",
        "turn_count": 0,
        "trust": 5,
        "momentum": "new",
        "cooling": "none",
    }
    await db.sessions.insert_one(dict(doc))
    return doc


async def save_session(session: dict) -> None:
    session["updated"] = datetime.now(timezone.utc)
    await db.sessions.replace_one({"session_id": session["session_id"]}, {k: v for k, v in session.items() if k != "_id"}, upsert=True)


async def call_rk2(user_message: str, system_prompt: str, rk_history: list[dict]) -> str:
    messages: list[dict[str, str]] = []
    for turn in rk_history[-PROMPT_HISTORY_TURNS:]:
        if turn.get("user"):
            messages.append({"role": "user", "content": turn["user"]})
        if turn.get("assistant"):
            messages.append({"role": "assistant", "content": turn["assistant"]})
    messages.append({"role": "user", "content": user_message})
    resp = await anthropic_client.messages.create(model=ANTHROPIC_MODEL, max_tokens=RESPONSE_MAX_TOKENS, system=system_prompt, messages=messages)
    return resp.content[0].text.strip()


async def call_plain(user_message: str) -> str:
    resp = await anthropic_client.messages.create(model=ANTHROPIC_MODEL, max_tokens=RESPONSE_MAX_TOKENS, system=PLAIN_LLM_SYSTEM_PROMPT, messages=[{"role": "user", "content": user_message}])
    return resp.content[0].text.strip()


@api.get("/")
async def root() -> dict:
    return {"app": "BRUNEL"}


@api.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, current_user: dict = Depends(get_current_user)) -> ChatResponse:
    if not req.message.strip() and not req.cybrary_item_ids:
        raise HTTPException(status_code=400, detail="message or Cybrary item is required")
    if req.target not in ("rk_only", "plain_only", "both"):
        raise HTTPException(status_code=400, detail="invalid target")

    now = datetime.now(timezone.utc)
    user_id: str = current_user["id"]
    user_jwt: str = current_user["token"]
    session = await get_or_create_session(user_id)
    context = context_organ.evaluate(session=session, query=req.message, current_time=now)
    pressure = context.temporal["pressure"]
    artifacts = await artifact_organ.evaluate(user_id=user_id, message=req.message, item_ids=req.cybrary_item_ids)
    cybrary_item_ids = artifacts.item_ids

    state_packet = state_organ.evaluate(message=req.message, session=session, state_bias=context.temporal.get("state_bias"))
    flags = state_packet.flags
    new_signals = state_packet.signals
    zone = state_packet.zone
    state = state_packet.state
    mode = state_packet.mode
    directive = state_packet.directive

    rk_text: str | None = None
    plain_text: str | None = None
    rk_history = session["rk_history"]
    memory = memory_organ.evaluate(
        session=session,
        user_id=user_id,
        user_jwt=user_jwt,
        message=req.message,
        pressure=pressure,
        signals=new_signals,
    )
    reflection = reflection_organ.evaluate(
        session=session,
        memory=memory,
        context=context,
        recent_history=rk_history,
        current_time=now,
    )
    packet = packet_organ.build(
        session=session,
        req=req,
        context=context,
        artifacts=artifacts,
        previous_state=state_packet.previous_state,
        previous_mode=state_packet.previous_mode,
        state=state,
        mode=mode,
        zone=zone,
        current_time=now,
        reflection=reflection,
    )
    llm_message = f"{req.message}\n\n{packet.prompt}"
    rk_system_prompt = build_rk_system_prompt(agents=new_signals, state=state, zone=zone, mode=mode, directive=directive, flags=flags, history_count=len(rk_history), facts=memory.facts, working_memory=memory.working_memory)
    rk_system_prompt += (
        "\n\nCybrary doctrine: Chat owns conversation; Cybrary owns artifacts. Do not describe missing tools as permanent personal inability. Say the current demo session has not enabled the relevant organ, or that the Cybrary item exists but has not yet been inspected."
        "\n\nTemporal doctrine: ARCHE is time-aware. Prefer the temporal session packet over raw transcript. Use elapsed silence, current timestamp, previous state/mode, current state/mode, state drift, active artifacts, continuity synopsis, momentum, cooling, trust, relationship age, turn count, time decay, entropy pressure, entropy band, and time state bias. Never deny awareness of timestamps or session timing when they are supplied in the packet or visible in the conversation."
        "\n\nReflection doctrine: Prefer the reflection packet for stable meaning continuity, open projects, outstanding promises, and identity summary. Use transcript context as evidence, not as the primary continuity substrate."
        "\n\nTranscript doctrine: When a SELF CHAT TRANSCRIPT CONTEXT block is supplied, treat it as readable current-session evidence. You may summarize it, answer questions about it, and quote small relevant fragments. Do not claim that chat transcripts are unavailable when that block is present."
    )

    try:
        if req.target == "rk_only":
            rk_text = await call_rk2(llm_message, rk_system_prompt, rk_history)
        elif req.target == "plain_only":
            plain_text = await call_plain(llm_message)
        else:
            rk_text, plain_text = await asyncio.gather(call_rk2(llm_message, rk_system_prompt, rk_history), call_plain(llm_message))
    except Exception as e:
        logger.exception("Claude call failed")
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}") from e

    if rk_text is not None:
        memory_organ.learn(user_id=user_id, user_jwt=user_jwt, packet=memory)
    archive = archive_organ.record_turn(
        session=session,
        req=req,
        now=now,
        rk_text=rk_text,
        plain_text=plain_text,
        pressure=pressure,
        state_packet=state_packet,
        memory=memory,
        artifacts=artifacts,
    )

    await save_session(session)
    return ChatResponse(turn=archive.turn_count, rk_response=rk_text, plain_response=plain_text)


@api.post("/reset")
async def reset(current_user: dict = Depends(get_current_user)) -> dict:
    await db.sessions.delete_one({"session_id": current_user["id"]})
    return {"ok": True}


@api.get("/session/{session_id}", response_model=SessionState)
async def get_session(session_id: str, current_user: dict = Depends(get_current_user)) -> SessionState:
    if session_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="forbidden")
    session = await get_or_create_session(session_id)
    return SessionState(session_id=session["session_id"], rk_history=[{"user": t.get("user", ""), "assistant": t.get("assistant", ""), "ts": t.get("ts"), "client_ts": t.get("client_ts"), "elapsed_since_previous": t.get("elapsed_since_previous"), "momentum": t.get("momentum"), "cooling": t.get("cooling"), "trust": t.get("trust"), "time_decay": t.get("time_decay"), "entropy_pressure": t.get("entropy_pressure"), "entropy_band": t.get("entropy_band"), "state_bias": t.get("state_bias"), "attachment": (t.get("cybrary_items") or [None])[0]} for t in session.get("rk_history", [])])


@api.get("/session-transcript")
async def get_session_transcript(current_user: dict = Depends(get_current_user), limit: int = TRANSCRIPT_TURN_LIMIT) -> dict:
    session = await get_or_create_session(current_user["id"])
    safe_limit = max(1, min(200, int(limit or TRANSCRIPT_TURN_LIMIT)))
    transcript = organ_build_session_transcript(session.get("rk_history", []), limit=safe_limit, char_limit=None)
    return {"session_id": session["session_id"], "turn_count": len(session.get("rk_history", [])), "returned_turns": min(safe_limit, len(session.get("rk_history", []))), "transcript": transcript}


@api.get("/session-packet")
async def get_session_packet(current_user: dict = Depends(get_current_user)) -> dict:
    now = datetime.now(timezone.utc)
    session = await get_or_create_session(current_user["id"])
    context = context_organ.evaluate(session=session, query="", current_time=now)
    pressure = context.temporal["pressure"]
    empty_req = ChatRequest(message="", target="rk_only", client_ts=now.isoformat(), client_timezone="server/UTC")
    empty_artifacts = await artifact_organ.evaluate(user_id=current_user["id"], message="", item_ids=[])
    state_packet = state_organ.evaluate(message="", session=session, state_bias=context.temporal.get("state_bias"))
    memory = memory_organ.evaluate(
        session=session,
        user_id=current_user["id"],
        user_jwt=current_user["token"],
        message="",
        pressure=pressure,
        signals=state_packet.signals,
    )
    reflection = reflection_organ.evaluate(
        session=session,
        memory=memory,
        context=context,
        recent_history=session.get("rk_history", []),
        current_time=now,
    )
    packet = packet_organ.build(
        session=session,
        req=empty_req,
        context=context,
        artifacts=empty_artifacts,
        previous_state=state_packet.previous_state,
        previous_mode=state_packet.previous_mode,
        state=state_packet.state,
        mode=state_packet.mode,
        zone=state_packet.zone,
        current_time=now,
        reflection=reflection,
    )
    return {"packet": packet.as_dict(), "context": context.as_dict(), "state_packet": state_packet.as_dict(), "memory": memory.as_dict(), "reflection": reflection.as_dict(), "pressure": pressure, "state": session.get("last_state"), "mode": session.get("last_mode"), "zone": session.get("last_zone"), "continuity_synopsis": session.get("continuity_synopsis"), "topic_entropy": session.get("topic_entropy")}


@api.get("/me")
async def me(current_user: dict = Depends(get_current_user)) -> dict:
    return {"id": current_user["id"], "email": current_user.get("email")}


ALLOWED_AUDIO_MIME = {"audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/m4a", "audio/x-m4a", "audio/ogg"}
MAX_AUDIO_BYTES = 25 * 1024 * 1024


@api.post("/transcribe")
async def transcribe(audio: UploadFile = File(...), current_user: dict = Depends(get_current_user)) -> dict:
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
        resp = await stt_client.transcribe(file=buf, model="whisper-1", response_format="text")
    except Exception as e:
        logger.exception("Whisper transcribe failed")
        raise HTTPException(status_code=502, detail=f"transcription failed: {e}") from e
    text = resp if isinstance(resp, str) else getattr(resp, "text", "")
    return {"text": (text or "").strip()}


@api.get("/admin/override")
async def get_override(current_user: dict = Depends(get_current_user)) -> dict:
    require_admin(current_user)
    session = await get_or_create_session(current_user["id"])
    override = session.get("admin_override") or {}
    return {"state": override.get("state"), "mode": override.get("mode"), "valid_states": sorted(VALID_STATES), "valid_modes": sorted(VALID_MODES)}


@api.put("/admin/override")
async def set_override(payload: OverridePayload, current_user: dict = Depends(get_current_user)) -> dict:
    require_admin(current_user)
    if payload.state and payload.state not in VALID_STATES:
        raise HTTPException(status_code=400, detail=f"invalid state: {payload.state}")
    if payload.mode and payload.mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail=f"invalid mode: {payload.mode}")
    session = await get_or_create_session(current_user["id"])
    session["admin_override"] = {"state": payload.state, "mode": payload.mode}
    await save_session(session)
    return {"ok": True, "state": payload.state, "mode": payload.mode}


@api.delete("/admin/override")
async def clear_override(current_user: dict = Depends(get_current_user)) -> dict:
    require_admin(current_user)
    session = await get_or_create_session(current_user["id"])
    session["admin_override"] = {}
    await save_session(session)
    return {"ok": True}


api.include_router(build_cybrary_router(db))
app.include_router(api)

_ALLOWED_ORIGINS = {o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()}


@app.middleware("http")
async def enforce_origin_allowlist(request: Request, call_next):
    if "*" in _ALLOWED_ORIGINS or not _ALLOWED_ORIGINS:
        return await call_next(request)
    origin = request.headers.get("origin")
    if origin and origin not in _ALLOWED_ORIGINS:
        return JSONResponse(status_code=403, content={"detail": "origin not allowed"})
    return await call_next(request)


app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=list(_ALLOWED_ORIGINS) if _ALLOWED_ORIGINS else ["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def ensure_indexes() -> None:
    try:
        await db.sessions.create_index("updated", expireAfterSeconds=SESSION_TTL_SECONDS, name="sessions_ttl_updated")
        await db.cybrary_items.create_index([("user_id", 1), ("created_at", -1)], name="cybrary_user_created")
        await db.cybrary_items.create_index([("user_id", 1), ("item_id", 1)], unique=True, name="cybrary_user_item")
        logger.info("TTL/session and Cybrary indexes ensured")
    except Exception as e:
        logger.warning("Failed to ensure indexes: %s", e)


@app.on_event("shutdown")
async def shutdown() -> None:
    mongo_client.close()
