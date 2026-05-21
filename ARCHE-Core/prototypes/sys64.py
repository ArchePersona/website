from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional
import json
import time
import uuid


# ============================================================
# SYS64 Prototype
# ------------------------------------------------------------
# Compact state/outcome ledger for ARCHE.
#
# Sys64 is not full transcript storage.
# It records the operational evidence trail:
# - what state/mode was active
# - what signals mattered
# - what the Courthouse decided
# - what the Output Gate did
# - what result came back
# - whether the outcome reinforced or entered salvage
#
# Principle:
# Everything should leave evidence.
# But not bloat.
# ============================================================


class Sys64EventType(str, Enum):
    INPUT_RECEIVED = "input_received"
    SIGNALS_CAPTURED = "signals_captured"
    CORE_CANDIDATE = "core_candidate"
    COURTHOUSE_VERDICT = "courthouse_verdict"
    OUTPUT_GATE_RESULT = "output_gate_result"
    RESPONSE_EMITTED = "response_emitted"
    OUTCOME_PENDING = "outcome_pending"
    OUTCOME_RESOLVED = "outcome_resolved"
    SALVAGE_SCHEDULED = "salvage_scheduled"
    REINFORCEMENT_APPLIED = "reinforcement_applied"
    STATE_TRANSITION = "state_transition"
    HEIGHTENED_CONCERN = "heightened_concern"


class OutcomeScore(int, Enum):
    PENDING = 0
    VERY_POOR = 1
    POOR = 2
    WEAK = 3
    MIXED = 4
    NEUTRAL = 5
    USEFUL = 6
    GOOD = 7
    STRONG = 8
    EXCELLENT = 9


@dataclass
class Sys64Event:
    event_id: str
    event_type: Sys64EventType
    session_id: str
    turn_id: str
    timestamp: float
    state: str
    mode: str
    payload: Dict[str, Any] = field(default_factory=dict)

    def to_jsonl(self) -> str:
        data = asdict(self)
        data["event_type"] = self.event_type.value
        return json.dumps(data, separators=(",", ":"), ensure_ascii=False)


@dataclass
class Sys64Outcome:
    outcome_id: str
    session_id: str
    turn_id: str
    response_event_id: str
    state: str
    mode: str
    score: int = 0  # 0 means waiting for results / superimposed outcome
    observed_flags: List[str] = field(default_factory=list)
    salvage_priority: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    resolved_at: Optional[float] = None

    @property
    def pending(self) -> bool:
        return self.score == 0

    @property
    def needs_salvage(self) -> bool:
        return 1 <= self.score <= 5

    @property
    def reinforces(self) -> bool:
        return self.score >= 6


class Sys64Ledger:
    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id or str(uuid.uuid4())
        self.events: List[Sys64Event] = []
        self.outcomes: Dict[str, Sys64Outcome] = {}

    def emit(
        self,
        event_type: Sys64EventType,
        turn_id: str,
        state: str,
        mode: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Sys64Event:
        event = Sys64Event(
            event_id=str(uuid.uuid4()),
            event_type=event_type,
            session_id=self.session_id,
            turn_id=turn_id,
            timestamp=time.time(),
            state=state,
            mode=mode,
            payload=payload or {},
        )
        self.events.append(event)
        return event

    def open_outcome(
        self,
        turn_id: str,
        response_event_id: str,
        state: str,
        mode: str,
    ) -> Sys64Outcome:
        outcome = Sys64Outcome(
            outcome_id=str(uuid.uuid4()),
            session_id=self.session_id,
            turn_id=turn_id,
            response_event_id=response_event_id,
            state=state,
            mode=mode,
            score=OutcomeScore.PENDING.value,
        )
        self.outcomes[outcome.outcome_id] = outcome

        self.emit(
            Sys64EventType.OUTCOME_PENDING,
            turn_id=turn_id,
            state=state,
            mode=mode,
            payload={
                "outcome_id": outcome.outcome_id,
                "score": 0,
                "meaning": "waiting_for_results",
            },
        )
        return outcome

    def resolve_outcome(
        self,
        outcome_id: str,
        score: int,
        observed_flags: Optional[List[str]] = None,
    ) -> Sys64Outcome:
        if score < 1 or score > 9:
            raise ValueError("Resolved outcome score must be 1-9. Score 0 is reserved for pending results.")

        outcome = self.outcomes[outcome_id]
        outcome.score = score
        outcome.observed_flags.extend(observed_flags or [])
        outcome.resolved_at = time.time()

        if outcome.needs_salvage:
            outcome.salvage_priority = self._salvage_priority(score)
            self.emit(
                Sys64EventType.SALVAGE_SCHEDULED,
                turn_id=outcome.turn_id,
                state=outcome.state,
                mode=outcome.mode,
                payload={
                    "outcome_id": outcome.outcome_id,
                    "score": score,
                    "priority": outcome.salvage_priority,
                    "observed_flags": outcome.observed_flags,
                },
            )
        else:
            self.emit(
                Sys64EventType.REINFORCEMENT_APPLIED,
                turn_id=outcome.turn_id,
                state=outcome.state,
                mode=outcome.mode,
                payload={
                    "outcome_id": outcome.outcome_id,
                    "score": score,
                    "observed_flags": outcome.observed_flags,
                    "state_delta": self._delta(score),
                    "mode_delta": self._delta(score),
                },
            )

        self.emit(
            Sys64EventType.OUTCOME_RESOLVED,
            turn_id=outcome.turn_id,
            state=outcome.state,
            mode=outcome.mode,
            payload={
                "outcome_id": outcome.outcome_id,
                "score": score,
                "pending": False,
            },
        )
        return outcome

    def state_transition(
        self,
        turn_id: str,
        from_state: str,
        to_state: str,
        from_mode: str,
        to_mode: str,
        reason: str,
    ) -> Sys64Event:
        return self.emit(
            Sys64EventType.STATE_TRANSITION,
            turn_id=turn_id,
            state=to_state,
            mode=to_mode,
            payload={
                "from_state": from_state,
                "to_state": to_state,
                "from_mode": from_mode,
                "to_mode": to_mode,
                "reason": reason,
            },
        )

    def heightened_concern(
        self,
        turn_id: str,
        state: str,
        mode: str,
        reason: str,
        threshold_shift: float,
    ) -> Sys64Event:
        return self.emit(
            Sys64EventType.HEIGHTENED_CONCERN,
            turn_id=turn_id,
            state=state,
            mode=mode,
            payload={
                "reason": reason,
                "threshold_shift": threshold_shift,
                "meaning": "temporary_threshold_tightening",
            },
        )

    def jsonl_dump(self) -> str:
        return "\n".join(event.to_jsonl() for event in self.events)

    def compact_summary(self) -> Dict[str, Any]:
        pending = [o for o in self.outcomes.values() if o.pending]
        salvage = [o for o in self.outcomes.values() if o.needs_salvage]
        reinforced = [o for o in self.outcomes.values() if o.reinforces]

        return {
            "session_id": self.session_id,
            "event_count": len(self.events),
            "outcome_count": len(self.outcomes),
            "pending_outcomes": len(pending),
            "salvage_outcomes": len(salvage),
            "reinforced_outcomes": len(reinforced),
        }

    @staticmethod
    def _salvage_priority(score: int) -> str:
        if score <= 2:
            return "urgent"
        if score == 3:
            return "high"
        if score == 4:
            return "medium"
        return "low"

    @staticmethod
    def _delta(score: int) -> float:
        # Neutral center is 5. Scores above 5 reinforce.
        return round(((score - 5) / 4) * 0.05, 4)


if __name__ == "__main__":
    ledger = Sys64Ledger(session_id="demo-session")
    turn_id = "turn-001"

    ledger.emit(
        Sys64EventType.INPUT_RECEIVED,
        turn_id=turn_id,
        state="focused",
        mode="technical",
        payload={"summary": "User asked to build Sys64 as state/outcome log."},
    )

    response_event = ledger.emit(
        Sys64EventType.RESPONSE_EMITTED,
        turn_id=turn_id,
        state="focused",
        mode="technical",
        payload={"summary": "Created Sys64 prototype."},
    )

    outcome = ledger.open_outcome(
        turn_id=turn_id,
        response_event_id=response_event.event_id,
        state="focused",
        mode="technical",
    )

    ledger.resolve_outcome(
        outcome_id=outcome.outcome_id,
        score=8,
        observed_flags=["user_continued", "architecture_progressed"],
    )

    print(json.dumps(ledger.compact_summary(), indent=2))
    print("\nJSONL:\n")
    print(ledger.jsonl_dump())
