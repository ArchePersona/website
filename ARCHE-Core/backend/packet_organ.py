"""Brunel-local Packet Organ bridge.

PacketOrgan owns prompt packet assembly. Server should orchestrate organs, not
know how temporal, transcript, artifact, and doctrine context is formatted for
the model.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from transcript_organ import build_recent_synopsis


@dataclass(slots=True)
class PromptPacket:
    packet_id: str = field(default_factory=lambda: str(uuid4()))
    prompt: str = ""
    temporal_prompt: str = ""
    transcript_prompt: str = ""
    artifact_prompt: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class PacketOrgan:
    """Builds model-facing prompt packets from organ outputs."""

    def __init__(self, synopsis_turn_limit: int = 8) -> None:
        self.synopsis_turn_limit = synopsis_turn_limit

    def build(
        self,
        *,
        session: dict[str, Any],
        req: Any,
        context: Any,
        artifacts: Any,
        previous_state: str,
        previous_mode: str,
        state: str,
        mode: str,
        zone: str,
        current_time: datetime | None = None,
    ) -> PromptPacket:
        now = current_time or datetime.now(timezone.utc)
        pressure = context.temporal.get("pressure", {})
        temporal_prompt = self.build_temporal_prompt(
            now=now,
            session=session,
            req=req,
            previous_state=previous_state,
            previous_mode=previous_mode,
            current_state=state,
            current_mode=mode,
            zone=zone,
            artifacts=artifacts,
            pressure=pressure,
        )
        transcript_prompt = self.build_transcript_prompt(context)
        artifact_prompt = self.build_artifact_prompt(artifacts)
        prompt_parts = [temporal_prompt]
        if transcript_prompt:
            prompt_parts.append(transcript_prompt)
        if artifact_prompt:
            prompt_parts.append(artifact_prompt)
        return PromptPacket(
            prompt="\n\n".join(prompt_parts),
            temporal_prompt=temporal_prompt,
            transcript_prompt=transcript_prompt,
            artifact_prompt=artifact_prompt,
            metadata={"source": "PacketOrgan", "organ_version": "0.1.0"},
        )

    def build_temporal_prompt(
        self,
        *,
        now: datetime,
        session: dict[str, Any],
        req: Any,
        previous_state: str,
        previous_mode: str,
        current_state: str,
        current_mode: str,
        zone: str,
        artifacts: Any,
        pressure: dict[str, Any],
    ) -> str:
        history = session.get("rk_history", []) or []
        client_time = getattr(req, "client_ts", None) or "not supplied"
        timezone_label = getattr(req, "client_timezone", None) or "not supplied"
        state_delta = "unchanged" if previous_state == current_state else f"{previous_state} -> {current_state}"
        mode_delta = "unchanged" if previous_mode == current_mode else f"{previous_mode} -> {current_mode}"
        artifact_lines = [f"- {item.get('name')} [{item.get('kind')} / {item.get('status')}]" for item in getattr(artifacts, "items", [])[:6]]
        artifact_text = "\n".join(artifact_lines) if artifact_lines else "- none attached to this turn"
        synopsis = build_recent_synopsis(history, session.get("continuity_synopsis"), limit=self.synopsis_turn_limit)
        return (
            "TEMPORAL SESSION PACKET\n"
            f"Server current time UTC: {now.isoformat()}\n"
            f"Client displayed timestamp: {client_time}\n"
            f"Client timezone label: {timezone_label}\n"
            f"Previous interaction timestamp: {pressure.get('last_interaction') or 'none recorded'}\n"
            f"Elapsed silence since previous interaction: {pressure.get('elapsed_since_previous', 'unknown')}\n"
            f"Relationship age: {pressure.get('relationship_age_days', 0)} days\n"
            f"Relationship stage: {pressure.get('relationship_stage', 'new')}\n"
            f"Turn count: {pressure.get('turn_count', 0)}\n"
            f"Momentum: {pressure.get('momentum', 'new')}\n"
            f"Cooling: {pressure.get('cooling', 'none')}\n"
            f"Trust: {pressure.get('trust', 5)}/10\n"
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

    def build_transcript_prompt(self, context: Any) -> str:
        transcript = getattr(context, "transcript", {}) or {}
        if not transcript.get("intent_detected"):
            return ""
        transcript_text = transcript.get("transcript_text") or "No transcript context available."
        return (
            "SELF CHAT TRANSCRIPT CONTEXT:\n"
            f"{transcript_text}\n\n"
            "Transcript doctrine: You can inspect the current session transcript supplied above. Do not say you cannot read your own transcript when this context is present."
        )

    def build_artifact_prompt(self, artifacts: Any) -> str:
        prompt_context = getattr(artifacts, "prompt_context", "") or ""
        if not prompt_context:
            return ""
        return f"Cybrary context available to Brunel:\n{prompt_context}"
