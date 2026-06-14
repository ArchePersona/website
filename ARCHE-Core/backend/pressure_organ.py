"""Brunel-local Pressure Organ.

PressureOrgan owns behavioral pressure derived from time, continuity, cooling,
trust, entropy, state drift, and mode drift. It wraps existing time pressure
primitives in the standard organ pattern so server orchestration can eventually
move pressure out of ContextOrgan and TimeOrgan helper functions.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from time_organ import derive_pressure


@dataclass(slots=True)
class PressurePacket:
    packet_id: str = field(default_factory=lambda: str(uuid4()))
    pressure: dict[str, Any] = field(default_factory=dict)
    elapsed_silence: str = "unknown"
    relationship_age_days: int = 0
    momentum: str = "new"
    cooling: str = "none"
    trust: int = 5
    time_decay: float = 0.0
    entropy_pressure: float = 0.0
    entropy_band: str = "stable"
    state_bias: str = "maintain"
    state_drift: str = "unknown"
    mode_drift: str = "unknown"
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class PressureOrgan:
    """Evaluates pressure signals without owning state or memory."""

    def evaluate(
        self,
        *,
        session: dict[str, Any],
        now: datetime | None = None,
        previous_state: str | None = None,
        previous_mode: str | None = None,
        current_state: str | None = None,
        current_mode: str | None = None,
    ) -> PressurePacket:
        current_time = now or datetime.now(timezone.utc)
        pressure = derive_pressure(session=session, now=current_time)
        state_drift = self._drift(previous_state, current_state)
        mode_drift = self._drift(previous_mode, current_mode)
        return PressurePacket(
            pressure=pressure,
            elapsed_silence=pressure.get("elapsed_since_previous", "unknown"),
            relationship_age_days=int(pressure.get("relationship_age_days", 0) or 0),
            momentum=pressure.get("momentum", "new"),
            cooling=pressure.get("cooling", "none"),
            trust=int(pressure.get("trust", 5) or 5),
            time_decay=float(pressure.get("time_decay", 0.0) or 0.0),
            entropy_pressure=float(pressure.get("entropy_pressure", 0.0) or 0.0),
            entropy_band=pressure.get("entropy_band", "stable"),
            state_bias=pressure.get("state_bias", "maintain"),
            state_drift=state_drift,
            mode_drift=mode_drift,
            metadata={"source": "PressureOrgan", "organ_version": "0.1.0", "created_at": current_time.isoformat()},
        )

    def _drift(self, previous: str | None, current: str | None) -> str:
        if not previous and not current:
            return "unknown"
        if previous == current:
            return "unchanged"
        return f"{previous or 'unknown'} -> {current or 'unknown'}"
