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
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from anthropic import AsyncAnthropic
from dotenv import load_dotenv
from emergentintegrations.llm.openai import OpenAISpeechToText
from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

from cybrary import build_cybrary_router
from rk_engine import (
    PLAIN_LLM_SYSTEM_PROMPT,
    build_rk_system_prompt,
    build_working_memory_synopsis,
    compute_agent_signals,
    compute_tribunal,
    default_signals,
    emerge_state,
    extract_facts,
    map_state_to_mode,
    public_flag_chips,
    run_sniffers,
    update_topic_entropy,
)
from supabase_helper import (
    categorize_fact,
    fetch_recent_memories,
    get_current_user,
    insert_memory,
    supabase_configured,
)
from time_organ import derive_pressure as organ_derive_pressure
from time_pressure import (
    apply_time_decay_to_topic_entropy,
    compute_time_entropy_pressure,
    suggest_time_state_bias,
)
from transcript_organ import (
    TRANSCRIPT_PROMPT_CHAR_LIMIT,
    TRANSCRIPT_TURN_LIMIT,
    build_recent_synopsis as organ_build_recent_synopsis,
    build_session_transcript as organ_build_session_transcript,
    wants_transcript_context as organ_wants_transcript_context,
)

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
URL_ONLY_RE = re.compile(r"^(https?://|www\.)[^\s]+$", re.IGNORECASE)

ADMIN_EMAILS: set[str] = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}


def require_admin(current_user: dict) -> None:
    email = (current_user.get("email") or "").lower()
    if not ADMIN_EMAILS or email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="admin only")


VALID_STATES = {"Warm", "Curious", "Focused", "Guarded", "Avoidant", "Stuck", "Retreating", "Gentle", "Shutdown"}
VALID_MODES = {"NORMAL", "RELATIONAL", "EXPLORATORY", "CLINICAL", "PROTECTIVE"}

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


# ---------------------------------------------------------------------------
# DEPRECATED SERVER-LOCAL ORGANS
#
# Ownership has moved to:
#   - time_organ.py
#   - transcript_organ.py
#
# These functions are retained temporarily as a safety fallback during the
# migration. Active call sites below now route through the daughter files.
# Remove after deployment verification.
# ---------------------------------------------------------------------------


def parse_iso_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not value or not isinstance(value, str):
        return None
    try:
        cleaned = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(cleaned)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def human_elapsed(delta_seconds: float | None) -> str:
    if delta_seconds is None:
        return "unknown"
    seconds = max(0, int(delta_seconds))
    if seconds < 60:
        return f"{seconds} seconds"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} minutes"
    hours = minutes // 60
    if hours < 24:
        rem = minutes % 60
        return f"{hours} hours" if rem == 0 else f"{hours} hours {rem} minutes"
    days = hours // 24
    rem_hours = hours % 24
    return f"{days} days" if rem_hours == 0 else f"{days} days {rem_hours} hours"


def compact_text(value: str, limit: int = 180) -> str:
    text = re.sub(r"\s+", " ", (value or "")).strip()
    return text[: limit - 1] + "…" if len(text) > limit else text


def build_recent_synopsis(history: list[dict], prior_synopsis: str | None = None) -> str:
    return organ_build_recent_synopsis(history, prior_synopsis, limit=SYNOPSIS_TURNS)


def format_turn_for_transcript(turn: dict, index: int) -> str:
    ts = turn.get("client_ts") or turn.get("ts") or "time unknown"
    elapsed = turn.get("elapsed_since_previous")
    state = turn.get("state") or "unknown"
    mode = turn.get("mode") or "unknown"
    user_text = (turn.get("user") or "").strip()
    assistant_text = (turn.get("assistant") or "").strip()
    parts = [f"Turn {index} · {ts} · State {state} · Mode {mode}"]
    if elapsed:
        parts[0] += f" · elapsed since prior: {elapsed}"
    if user_text:
        parts.append(f"User: {user_text}")
    if assistant_text:
        parts.append(f"Brunel: {assistant_text}")
    return "\n".join(parts)


def build_session_transcript(history: list[dict], limit: int = TRANSCRIPT_TURN_LIMIT, char_limit: int | None = None) -> str:
    return organ_build_session_transcript(history, limit=limit, char_limit=char_limit)


def wants_transcript_context(message: str) -> bool:
    return organ_wants_transcript_context(message)


def derive_cooling(delta_seconds: float | None) -> str:
    if delta_seconds is None:
        return "none"
    hours = max(0, delta_seconds) / 3600
    if hours < 6:
        return "none"
    if hours < 24:
        return "slight"
    if hours < 24 * 7:
        return "moderate"
    if hours < 24 * 30:
        return "strong"
    return "cold"


def derive_momentum(delta_seconds: float | None, recent_turns: int) -> str:
    if delta_seconds is None:
        return "new"
    minutes = max(0, delta_seconds) / 60
    if minutes < 20 and recent_turns >= 3:
        return "high"
    if minutes < 180:
        return "active"
    if minutes < 60 * 24:
        return "settling"
    if minutes < 60 * 24 * 7:
        return "cooling"
    return "dormant"


def derive_relationship_stage(first_seen: datetime | None, now: datetime, turn_count: int) -> tuple[str, int]:
    if not first_seen:
        return "new", 0
    days = max(0, int((now - first_seen).total_seconds() // 86400))
    if turn_count >= 100 or days >= 30:
        return "long-term continuity", days
    if turn_count >= 25 or days >= 7:
        return "established", days
    if turn_count >= 5 or days >= 1:
        return "familiar", days
    return "new acquaintance", days


def derive_trust(previous_trust: int, cooling: str, turn_count: int) -> int:
    trust = max(0, min(10, int(previous_trust or 5)))
    if turn_count >= 25 and cooling in {"none", "slight"}:
        trust += 1
    if cooling == "strong":
        trust -= 1
    if cooling == "cold":
        trust -= 2
    return max(0, min(10, trust))


def derive_pressure(session: dict, now: datetime) -> dict:
    return organ_derive_pressure(session, now)


def build_temporal_packet(*, now: datetime, session: dict, req: ChatRequest, previous_state: str, previous_mode: str, current_state: str, current_mode: str, zone: str, cybrary_items: list[dict], pressure: dict) -> str:
    history = session.get("rk_history", []) or []
    client_time = req.client_ts or "not supplied"
    timezone_label = req.client_timezone or "not supplied"
    state_delta = "unchanged" if previous_state == current_state else f"{previous_state} -> {current_state}"
    mode_delta = "unchanged" if previous_mode == current_mode else f"{previous_mode} -> {current_mode}"
    artifact_lines = [f"- {item.get('name')} [{item.get('kind')} / {item.get('status')}]" for item in cybrary_items[:6]]
    artifact_text = "\n".join(artifact_lines) if artifact_lines else "- none attached to this turn"
    synopsis = organ_build_recent_synopsis(history, session.get("continuity_synopsis"), limit=SYNOPSIS_TURNS)
    return (
        "TEMPORAL SESSION PACKET\n"
        f"Server current time UTC: {now.isoformat()}\n"
        f"Client displayed timestamp: {client_time}\n"
        f"Client timezone label: {timezone_label}\n"
        f"Previous interaction timestamp: {pressure.get('last_interaction') or 'none recorded'}\n"
        f"Elapsed silence since previous interaction: {pressure['elapsed_since_previous']}\n"
        f"Relationship age: {pressure['relationship_age_days']} days\n"
        f"Relationship stage: {pressure['relationship_stage']}\n"
        f"Turn count: {pressure['turn_count']}\n"
        f"Momentum: {pressure['momentum']}\n"
        f"Cooling: {pressure['cooling']}\n"
        f"Trust: {pressure['trust']}/10\n"
        f"Time decay: {pressure.get('time_decay', 0.0)}\n"
        f"Entropy pressure: {pressure.get('entropy_pressure', 0.0)}\n"
        f"Entropy band: {pressure.get('entropy_band', 'stable')}\n"
        f"Time state bias: {pressure.get('state_bias', 'maintain')}\n"
        f"Previous state/mode: {previous_state} / {previous_mode}\n"
        f"Current inferred state/mode/zone: {current_state} / {current_mode} / {zone}\n"
        f"State drift: {state_delta}\n"
        f"Mode drift: {mode_delta}\n"
        "Continuity synopsis, not raw transcript:\n"
        f"{synopsis}\n"
        "Active Cybrary artifacts this turn:\n"
        f"{artifact_text}\n"
        "Temporal doctrine: ARCHE is time-aware. Use current time, prior interaction time, elapsed silence, momentum, cooling, trust, relationship age, time decay, entropy pressure, state bias, state drift, and synopsis as working context. "
        "If timestamps are visible or supplied in the packet, do not deny awareness of them. Answer from session evidence before claiming limitation."
    )


def normalize_url_reference(value: str) -> str | None:
    raw = (value or "").strip()
    if not URL_ONLY_RE.match(raw):
        return None
    if raw.lower().startswith("www."):
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return raw


async def create_url_cybrary_reference(user_id: str, url: str) -> dict:
    now = datetime.now(timezone.utc)
    item_id = f"cyb-{uuid.uuid4().hex}"
    note = "This URL has been stored as a Cybrary reference. Live page-reading is not enabled in this demo session yet, so the page has not been inspected. When retrieval is enabled, this same item can hold title, metadata, page text, and working context."
    item = {"item_id": item_id, "user_id": user_id, "name": urlparse(url).netloc or url, "mime_type": "text/uri-list", "kind": "url", "size": len(url), "source": "link", "status": "reference", "created_at": now, "updated_at": now, "preview_text": note, "extracted_text": None, "vision_summary": None, "url": url, "metadata": {"fetch_status": "not_enabled", "auto_captured": True}, "blob_b64": ""}
    await db.cybrary_items.insert_one(item)
    return item


async def build_cybrary_context(user_id: str, item_ids: list[str]) -> tuple[str, list[dict]]:
    clean_ids = [item_id for item_id in item_ids if item_id]
    if not clean_ids:
        return "", []
    cursor = db.cybrary_items.find({"user_id": user_id, "item_id": {"$in": clean_ids}}, {"_id": 0, "blob_b64": 0})
    items: list[dict] = []
    async for item in cursor:
        items.append(item)
    if not items:
        return "", []
    blocks: list[str] = []
    budget = CYBRARY_PROMPT_CHAR_LIMIT
    for item in items:
        label = f"{item.get('name', item.get('item_id'))} ({item.get('kind', 'file')} · {item.get('mime_type', 'unknown')} · {item.get('status', 'stored')})"
        text = item.get("extracted_text") or item.get("preview_text") or item.get("vision_summary")
        if text:
            body = str(text)[:budget]
            budget -= len(body)
            blocks.append(f"[Cybrary item: {label}]\n{body}")
        else:
            blocks.append(f"[Cybrary item: {label}]\nThe artifact exists in the Cybrary, but its analysis organ has not populated working context yet.")
        if budget <= 0:
            break
    return "\n\n".join(blocks), items


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
    previous_state = session.get("last_state", "unknown")
    previous_mode = session.get("last_mode", "unknown")
    pressure = organ_derive_pressure(session, now)

    cybrary_item_ids = list(req.cybrary_item_ids)
    auto_url = normalize_url_reference(req.message) if not cybrary_item_ids else None
    if auto_url:
        url_item = await create_url_cybrary_reference(user_id, auto_url)
        cybrary_item_ids.append(url_item["item_id"])

    cybrary_context, cybrary_items = await build_cybrary_context(user_id, cybrary_item_ids)

    flags = run_sniffers(req.message)
    chips = public_flag_chips(flags)
    new_signals = compute_agent_signals(flags=flags, history=session["rk_history"], prev_signals=session["signals"])
    tribunal = compute_tribunal(new_signals)
    zone, state = emerge_state(new_signals, tribunal, state_bias=pressure.get("state_bias"))
    mode, directive = map_state_to_mode(state)

    override = session.get("admin_override") or {}
    forced_state = override.get("state")
    forced_mode = override.get("mode")
    if forced_state and forced_state in VALID_STATES:
        state = forced_state
        mode, directive = map_state_to_mode(state)
    if forced_mode and forced_mode in VALID_MODES:
        mode = forced_mode

    temporal_packet = build_temporal_packet(now=now, session=session, req=req, previous_state=previous_state, previous_mode=previous_mode, current_state=state, current_mode=mode, zone=zone, cybrary_items=cybrary_items, pressure=pressure)
    llm_message = f"{req.message}\n\n{temporal_packet}"
    if organ_wants_transcript_context(req.message):
        transcript_text = organ_build_session_transcript(session.get("rk_history", []), limit=TRANSCRIPT_TURN_LIMIT, char_limit=TRANSCRIPT_PROMPT_CHAR_LIMIT)
        llm_message = f"{llm_message}\n\nSELF CHAT TRANSCRIPT CONTEXT:\n{transcript_text}\n\nTranscript doctrine: You can inspect the current session transcript supplied above. Do not say you cannot read your own transcript when this context is present."
    if cybrary_context:
        llm_message = f"{llm_message}\n\nCybrary context available to Brunel:\n{cybrary_context}"

    rk_text: str | None = None
    plain_text: str | None = None
    rk_history = session["rk_history"]
    sb_memories = fetch_recent_memories(user_jwt=user_jwt, user_id=user_id) if supabase_configured() else []
    memory_strings = [m.get("memory_text", "") for m in sb_memories if m.get("memory_text")]
    raw_topic_entropy = update_topic_entropy(session.get("topic_entropy", {}) or {}, req.message, agents=new_signals)
    topic_entropy = apply_time_decay_to_topic_entropy(raw_topic_entropy, pressure)
    working_memory_synopsis = build_working_memory_synopsis(topic_entropy)
    rk_system_prompt = build_rk_system_prompt(agents=new_signals, state=state, zone=zone, mode=mode, directive=directive, flags=flags, history_count=len(rk_history), facts=memory_strings, working_memory=working_memory_synopsis)
    rk_system_prompt += (
        "\n\nCybrary doctrine: Chat owns conversation; Cybrary owns artifacts. Do not describe missing tools as permanent personal inability. Say the current demo session has not enabled the relevant organ, or that the Cybrary item exists but has not yet been inspected."
        "\n\nTemporal doctrine: ARCHE is time-aware. Prefer the temporal session packet over raw transcript. Use elapsed silence, current timestamp, previous state/mode, current state/mode, state drift, active artifacts, continuity synopsis, momentum, cooling, trust, relationship age, turn count, time decay, entropy pressure, entropy band, and time state bias. Never deny awareness of timestamps or session timing when they are supplied in the packet or visible in the conversation."
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

    cybrary_public = [{"item_id": i.get("item_id"), "name": i.get("name"), "kind": i.get("kind"), "mime_type": i.get("mime_type"), "size": i.get("size"), "status": i.get("status"), "url": i.get("url")} for i in cybrary_items]
    if rk_text is not None:
        session["rk_history"].append({"user": req.message, "assistant": rk_text, "ts": now.isoformat(), "client_ts": req.client_ts, "client_timezone": req.client_timezone, "elapsed_since_previous": pressure["elapsed_since_previous"], "momentum": pressure["momentum"], "cooling": pressure["cooling"], "trust": pressure["trust"], "relationship_stage": pressure["relationship_stage"], "relationship_age_days": pressure["relationship_age_days"], "turn_count": pressure["turn_count"], "time_decay": pressure.get("time_decay"), "entropy_pressure": pressure.get("entropy_pressure"), "entropy_band": pressure.get("entropy_band"), "state_bias": pressure.get("state_bias"), "state": state, "zone": zone, "mode": mode, "previous_state": previous_state, "previous_mode": previous_mode, "weights": new_signals, "flags": chips, "tribunal": tribunal, "cybrary_item_ids": cybrary_item_ids, "cybrary_items": cybrary_public})
        if supabase_configured():
            existing_texts = {m.get("memory_text") for m in sb_memories}
            for fact in extract_facts(req.message):
                if fact in existing_texts:
                    continue
                insert_memory(user_jwt=user_jwt, user_id=user_id, memory_text=fact, category=categorize_fact(fact))
        session["signals"] = new_signals
        session["last_state"] = state
        session["last_zone"] = zone
        session["last_mode"] = mode
        session["last_flags"] = chips
        session["topic_entropy"] = topic_entropy
        session["continuity_synopsis"] = organ_build_recent_synopsis(session.get("rk_history", []), session.get("continuity_synopsis"), limit=SYNOPSIS_TURNS)
        session["turn_count"] = pressure["turn_count"]
        session["momentum"] = pressure["momentum"]
        session["cooling"] = pressure["cooling"]
        session["trust"] = pressure["trust"]
        session["relationship_stage"] = pressure["relationship_stage"]
        session["relationship_age_days"] = pressure["relationship_age_days"]
        session["time_decay"] = pressure.get("time_decay")
        session["entropy_pressure"] = pressure.get("entropy_pressure")
        session["entropy_band"] = pressure.get("entropy_band")
        session["state_bias"] = pressure.get("state_bias")

    if plain_text is not None:
        session["plain_history"].append({"user": req.message, "assistant": plain_text, "ts": now.isoformat(), "client_ts": req.client_ts, "cybrary_item_ids": cybrary_item_ids})

    await save_session(session)
    return ChatResponse(turn=len(session["rk_history"]), rk_response=rk_text, plain_response=plain_text)


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
    pressure = organ_derive_pressure(session, now)
    packet_req = ChatRequest(message="", target="rk_only", client_ts=now.isoformat(), client_timezone="server/UTC")
    packet = build_temporal_packet(now=now, session=session, req=packet_req, previous_state=session.get("last_state", "unknown"), previous_mode=session.get("last_mode", "unknown"), current_state=session.get("last_state", "unknown"), current_mode=session.get("last_mode", "unknown"), zone=session.get("last_zone", "unknown"), cybrary_items=[], pressure=pressure)
    return {"packet": packet, "pressure": pressure, "state": session.get("last_state"), "mode": session.get("last_mode"), "zone": session.get("last_zone"), "continuity_synopsis": session.get("continuity_synopsis"), "topic_entropy": session.get("topic_entropy")}


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
