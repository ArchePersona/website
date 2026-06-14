"""Brunel-local Context Organ bridge.

This mirrors the heart-engine ContextOrgan shape without requiring ARCHEngine to
be installed as a package inside the website backend yet.

Purpose:
- keep Brunel moving now
- preserve the ARCHEngine organ interface
- make the later swap to backend.arche.context.ContextOrgan small
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


@dataclass(slots=True)
class BrunelContextPacket:
    packet_id: str = field(default_factory=lambda: str(uuid4()))
    temporal: dict[str, Any] = field(default_factory=dict)
    transcript: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def compact_text(value: str, limit: int = 180) -> str:
    text = " ".join((value or "").split()).strip()
    return text[: limit - 1] + "..." if len(text) > limit else text


def format_transcript_turn(turn: dict[str, Any], index: int) -> str:
    ts = turn.get("client_ts") or turn.get("ts") or "time unknown"
    elapsed = turn.get("elapsed_since_previous")
    state = turn.get("state") or "unknown"
    mode = turn.get("mode") or "unknown"
    header = f"Turn {index} - {ts} - State {state} - Mode {mode}"
    if elapsed:
        header += f" - elapsed since prior: {elapsed}"
    parts = [header]
    if turn.get("user"):
        parts.append(f"User: {turn.get('user')}")
    if turn.get("assistant"):
        parts.append(f"Brunel: {turn.get('assistant')}")
    return "\n".join(parts)


def build_transcript_text(history: list[dict[str, Any]], limit: int = 40, char_limit: int = 10000) -> str:
    if not history:
        return "No chat transcript is recorded for this session yet."
    selected = history[-max(1, limit):]
    start_index = len(history) - len(selected) + 1
    text = "\n\n---\n\n".join(format_transcript_turn(turn, start_index + i) for i, turn in enumerate(selected))
    if len(text) > char_limit:
        return "[Transcript truncated to most recent readable segment.]\n" + text[-char_limit:]
    return text


def summarize_recent(history: list[dict[str, Any]], limit: int = 8) -> str:
    if not history:
        return "No recent transcript activity is recorded."
    lines: list[str] = []
    for turn in history[-max(1, limit):]:
        user_text = compact_text(turn.get("user", ""), 120)
        state = turn.get("state") or "unknown"
        mode = turn.get("mode") or "unknown"
        if user_text:
            lines.append(f"- User: {user_text} [{state}/{mode}]")
    return "\n".join(lines) if lines else "Recent transcript exists, but no user text was available."


class BrunelContextOrgan:
    """Composes Brunel temporal pressure and transcript context."""

    def __init__(self, transcript_turn_limit: int = 40, transcript_char_limit: int = 10000) -> None:
        self.transcript_turn_limit = transcript_turn_limit
        self.transcript_char_limit = transcript_char_limit

    def evaluate(
        self,
        *,
        session: dict[str, Any],
        pressure: dict[str, Any],
        query: str = "",
        transcript_intent: bool = False,
        current_time: datetime | None = None,
    ) -> BrunelContextPacket:
        now = current_time or datetime.now(timezone.utc)
        history = list(session.get("rk_history", []) or [])
        temporal = {
            "now": now.isoformat(),
            "previous_interaction": pressure.get("last_interaction"),
            "elapsed_silence": pressure.get("elapsed_since_previous"),
            "momentum": pressure.get("momentum"),
            "cooling": pressure.get("cooling"),
            "trust": pressure.get("trust"),
            "relationship_stage": pressure.get("relationship_stage"),
            "relationship_age_days": pressure.get("relationship_age_days"),
            "turn_count": pressure.get("turn_count"),
            "time_decay": pressure.get("time_decay"),
            "entropy_pressure": pressure.get("entropy_pressure"),
            "entropy_band": pressure.get("entropy_band"),
            "state_bias": pressure.get("state_bias"),
        }
        transcript = {
            "intent_detected": transcript_intent,
            "turn_count": len(history),
            "returned_turns": min(self.transcript_turn_limit, len(history)) if transcript_intent else 0,
            "summary": summarize_recent(history) if transcript_intent else "",
            "transcript_text": build_transcript_text(history, self.transcript_turn_limit, self.transcript_char_limit) if transcript_intent else "",
        }
        return BrunelContextPacket(
            temporal=temporal,
            transcript=transcript,
            metadata={"source": "BrunelContextOrgan", "organ_version": "0.1.0", "query": query},
        )
