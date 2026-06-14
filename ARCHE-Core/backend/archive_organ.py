"""Brunel-local Archive Organ bridge.

ArchiveOrgan owns turn recording and session bookkeeping. Server should hand it
completed organ packets and responses, then persist the updated session.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from transcript_organ import build_recent_synopsis


@dataclass(slots=True)
class ArchivePacket:
    packet_id: str = field(default_factory=lambda: str(uuid4()))
    turn_count: int = 0
    rk_recorded: bool = False
    plain_recorded: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class ArchiveOrgan:
    """Records model outputs and updates session continuity fields."""

    def __init__(self, synopsis_turn_limit: int = 8) -> None:
        self.synopsis_turn_limit = synopsis_turn_limit

    def summarize_artifacts(self, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {
                "item_id": item.get("item_id"),
                "name": item.get("name"),
                "kind": item.get("kind"),
                "mime_type": item.get("mime_type"),
                "size": item.get("size"),
                "status": item.get("status"),
                "url": item.get("url"),
            }
            for item in items
        ]

    def summarize_reflection(self, reflection: Any | None) -> dict[str, Any]:
        if reflection is None:
            return {}
        meaning_record = getattr(reflection, "meaning_record", None)
        return {
            "packet_id": getattr(reflection, "packet_id", None),
            "relationship_themes": getattr(reflection, "relationship_themes", []),
            "open_projects": getattr(reflection, "open_projects", []),
            "recent_concerns": getattr(reflection, "recent_concerns", []),
            "outstanding_promises": getattr(reflection, "outstanding_promises", []),
            "identity_summary": getattr(reflection, "identity_summary", []),
            "reflection_summary": getattr(reflection, "reflection_summary", ""),
            "meaning_record": meaning_record.as_dict() if hasattr(meaning_record, "as_dict") else {},
        }

    def record_turn(
        self,
        *,
        session: dict[str, Any],
        req: Any,
        now: datetime | None,
        rk_text: str | None,
        plain_text: str | None,
        pressure: dict[str, Any],
        state_packet: Any,
        memory: Any,
        artifacts: Any,
        reflection: Any | None = None,
    ) -> ArchivePacket:
        timestamp = (now or datetime.now(timezone.utc)).isoformat()
        cybrary_item_ids = getattr(artifacts, "item_ids", [])
        cybrary_items = self.summarize_artifacts(getattr(artifacts, "items", []) or [])
        reflection_snapshot = self.summarize_reflection(reflection)
        rk_recorded = False
        plain_recorded = False

        if rk_text is not None:
            session.setdefault("rk_history", []).append(
                {
                    "user": getattr(req, "message", ""),
                    "assistant": rk_text,
                    "ts": timestamp,
                    "client_ts": getattr(req, "client_ts", None),
                    "client_timezone": getattr(req, "client_timezone", None),
                    "elapsed_since_previous": pressure.get("elapsed_since_previous"),
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
                    "state": getattr(state_packet, "state", None),
                    "zone": getattr(state_packet, "zone", None),
                    "mode": getattr(state_packet, "mode", None),
                    "previous_state": getattr(state_packet, "previous_state", None),
                    "previous_mode": getattr(state_packet, "previous_mode", None),
                    "weights": getattr(state_packet, "signals", {}),
                    "flags": getattr(state_packet, "chips", []),
                    "tribunal": getattr(state_packet, "tribunal", {}),
                    "cybrary_item_ids": cybrary_item_ids,
                    "cybrary_items": cybrary_items,
                    "reflection": reflection_snapshot,
                }
            )
            session["signals"] = getattr(state_packet, "signals", {})
            session["last_state"] = getattr(state_packet, "state", session.get("last_state"))
            session["last_zone"] = getattr(state_packet, "zone", session.get("last_zone"))
            session["last_mode"] = getattr(state_packet, "mode", session.get("last_mode"))
            session["last_flags"] = getattr(state_packet, "chips", [])
            session["topic_entropy"] = getattr(memory, "topic_entropy", session.get("topic_entropy", {}))
            session["continuity_synopsis"] = build_recent_synopsis(session.get("rk_history", []), session.get("continuity_synopsis"), limit=self.synopsis_turn_limit)
            session["latest_reflection"] = reflection_snapshot
            session["reflection_summary"] = reflection_snapshot.get("reflection_summary", "")
            session["meaning_record"] = reflection_snapshot.get("meaning_record", {})
            session["turn_count"] = pressure.get("turn_count")
            session["momentum"] = pressure.get("momentum")
            session["cooling"] = pressure.get("cooling")
            session["trust"] = pressure.get("trust")
            session["relationship_stage"] = pressure.get("relationship_stage")
            session["relationship_age_days"] = pressure.get("relationship_age_days")
            session["time_decay"] = pressure.get("time_decay")
            session["entropy_pressure"] = pressure.get("entropy_pressure")
            session["entropy_band"] = pressure.get("entropy_band")
            session["state_bias"] = pressure.get("state_bias")
            rk_recorded = True

        if plain_text is not None:
            session.setdefault("plain_history", []).append(
                {
                    "user": getattr(req, "message", ""),
                    "assistant": plain_text,
                    "ts": timestamp,
                    "client_ts": getattr(req, "client_ts", None),
                    "cybrary_item_ids": cybrary_item_ids,
                }
            )
            plain_recorded = True

        return ArchivePacket(
            turn_count=len(session.get("rk_history", [])),
            rk_recorded=rk_recorded,
            plain_recorded=plain_recorded,
            metadata={"source": "ArchiveOrgan", "organ_version": "0.2.0"},
        )
