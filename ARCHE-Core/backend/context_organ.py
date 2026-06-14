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

from time_organ import derive_pressure
from transcript_organ import (
    build_recent_synopsis,
    build_session_transcript,
    wants_transcript_context,
)


@dataclass(slots=True)
class BrunelContextPacket:
    packet_id: str = field(default_factory=lambda: str(uuid4()))
    temporal: dict[str, Any] = field(default_factory=dict)
    transcript: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class BrunelContextOrgan:
    """Composes Brunel temporal pressure and transcript context."""

    def __init__(self, transcript_turn_limit: int = 40, transcript_char_limit: int = 10000, synopsis_turn_limit: int = 8) -> None:
        self.transcript_turn_limit = transcript_turn_limit
        self.transcript_char_limit = transcript_char_limit
        self.synopsis_turn_limit = synopsis_turn_limit

    def evaluate(
        self,
        *,
        session: dict[str, Any],
        query: str = "",
        current_time: datetime | None = None,
        force_transcript: bool = False,
    ) -> BrunelContextPacket:
        now = current_time or datetime.now(timezone.utc)
        history = list(session.get("rk_history", []) or [])
        pressure = derive_pressure(session, now)
        transcript_intent = force_transcript or wants_transcript_context(query)
        transcript_text = ""
        summary = ""
        if transcript_intent:
            transcript_text = build_session_transcript(history, limit=self.transcript_turn_limit, char_limit=self.transcript_char_limit)
            summary = build_recent_synopsis(history, session.get("continuity_synopsis"), limit=self.synopsis_turn_limit)
        temporal = {
            "now": now.isoformat(),
            "previous_interaction": pressure.get("last_interaction"),
            "elapsed_silence": pressure.get("elapsed_since_previous"),
            "elapsed_seconds": pressure.get("elapsed_seconds"),
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
            "pressure": pressure,
        }
        transcript = {
            "intent_detected": transcript_intent,
            "turn_count": len(history),
            "returned_turns": min(self.transcript_turn_limit, len(history)) if transcript_intent else 0,
            "summary": summary,
            "transcript_text": transcript_text,
        }
        return BrunelContextPacket(
            temporal=temporal,
            transcript=transcript,
            metadata={"source": "BrunelContextOrgan", "organ_version": "0.2.0", "query": query},
        )
