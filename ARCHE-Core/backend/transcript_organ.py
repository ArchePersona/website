"""Brunel-local transcript organ bridge.

This mirrors the ARCHEngine TranscriptOrgan shape while keeping the website
backend standalone.
"""

from __future__ import annotations

import re
from typing import Any

TRANSCRIPT_TURN_LIMIT = 40
TRANSCRIPT_PROMPT_CHAR_LIMIT = 10000
TRANSCRIPT_INTENT_RE = re.compile(
    r"\b(transcript|chat history|conversation history|what (?:did|were) we|what have we|recap|summari[sz]e (?:this|our)|previous messages?|earlier in this chat)\b",
    re.IGNORECASE,
)


def compact_text(value: str, limit: int = 180) -> str:
    text = re.sub(r"\s+", " ", (value or "")).strip()
    return text[: limit - 1] + "..." if len(text) > limit else text


def build_recent_synopsis(history: list[dict[str, Any]], prior_synopsis: str | None = None, limit: int = 8) -> str:
    if not history:
        return prior_synopsis or "No prior user/Brunel exchange is recorded for this session."
    lines: list[str] = []
    for turn in history[-max(1, limit):]:
        user_text = compact_text(turn.get("user", ""), 140)
        assistant_text = compact_text(turn.get("assistant", ""), 140)
        state = turn.get("state") or "unknown"
        mode = turn.get("mode") or "unknown"
        if user_text:
            lines.append(f"User: {user_text}")
        if assistant_text:
            lines.append(f"Brunel [{state}/{mode}]: {assistant_text}")
    synopsis = "\n".join(lines[-12:]).strip()
    return synopsis or prior_synopsis or "No usable continuity synopsis yet."


def format_turn_for_transcript(turn: dict[str, Any], index: int) -> str:
    ts = turn.get("client_ts") or turn.get("ts") or "time unknown"
    elapsed = turn.get("elapsed_since_previous")
    state = turn.get("state") or "unknown"
    mode = turn.get("mode") or "unknown"
    user_text = (turn.get("user") or "").strip()
    assistant_text = (turn.get("assistant") or "").strip()
    parts = [f"Turn {index} - {ts} - State {state} - Mode {mode}"]
    if elapsed:
        parts[0] += f" - elapsed since prior: {elapsed}"
    if user_text:
        parts.append(f"User: {user_text}")
    if assistant_text:
        parts.append(f"Brunel: {assistant_text}")
    return "\n".join(parts)


def build_session_transcript(history: list[dict[str, Any]], limit: int = TRANSCRIPT_TURN_LIMIT, char_limit: int | None = None) -> str:
    if not history:
        return "No chat transcript is recorded for this session yet."
    selected = history[-max(1, limit):]
    start_index = len(history) - len(selected) + 1
    blocks = [format_turn_for_transcript(turn, start_index + i) for i, turn in enumerate(selected)]
    text = "\n\n---\n\n".join(blocks)
    if char_limit and len(text) > char_limit:
        return "[Transcript truncated to most recent readable segment.]\n" + text[-char_limit:]
    return text


def wants_transcript_context(message: str) -> bool:
    return bool(TRANSCRIPT_INTENT_RE.search(message or ""))
