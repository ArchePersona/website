"""Brunel-local State Organ bridge.

StateOrgan owns the Lords/Tribunal/State/Mode path for Brunel's current demo
runtime. Server should ask for state context, not assemble it directly.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any
from uuid import uuid4

from rk_engine import (
    compute_agent_signals,
    compute_tribunal,
    emerge_state,
    map_state_to_mode,
    public_flag_chips,
    run_sniffers,
)


@dataclass(slots=True)
class StatePacket:
    packet_id: str = field(default_factory=lambda: str(uuid4()))
    flags: dict[str, Any] = field(default_factory=dict)
    chips: list[str] = field(default_factory=list)
    signals: dict[str, Any] = field(default_factory=dict)
    tribunal: dict[str, Any] = field(default_factory=dict)
    zone: str = "engaged"
    state: str = "Focused"
    mode: str = "NORMAL"
    directive: str = ""
    previous_state: str = "unknown"
    previous_mode: str = "unknown"
    override_applied: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class StateOrgan:
    """Evaluates Brunel's state, mode, and tribunal context."""

    def __init__(self, valid_states: set[str], valid_modes: set[str]) -> None:
        self.valid_states = valid_states
        self.valid_modes = valid_modes

    def evaluate(
        self,
        *,
        message: str,
        session: dict[str, Any],
        state_bias: str | None = None,
    ) -> StatePacket:
        previous_state = session.get("last_state", "unknown")
        previous_mode = session.get("last_mode", "unknown")
        flags = run_sniffers(message)
        chips = public_flag_chips(flags)
        signals = compute_agent_signals(flags=flags, history=session.get("rk_history", []), prev_signals=session.get("signals"))
        tribunal = compute_tribunal(signals)
        zone, state = emerge_state(signals, tribunal, state_bias=state_bias)
        mode, directive = map_state_to_mode(state)
        override = session.get("admin_override") or {}
        override_applied: dict[str, Any] = {}
        forced_state = override.get("state")
        forced_mode = override.get("mode")
        if forced_state and forced_state in self.valid_states:
            state = forced_state
            mode, directive = map_state_to_mode(state)
            override_applied["state"] = forced_state
        if forced_mode and forced_mode in self.valid_modes:
            mode = forced_mode
            override_applied["mode"] = forced_mode
        return StatePacket(
            flags=flags,
            chips=chips,
            signals=signals,
            tribunal=tribunal,
            zone=zone,
            state=state,
            mode=mode,
            directive=directive,
            previous_state=previous_state,
            previous_mode=previous_mode,
            override_applied=override_applied,
            metadata={"source": "StateOrgan", "organ_version": "0.1.0", "state_bias": state_bias},
        )
