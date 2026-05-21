# SYS64 v1
# Compact state and outcome ledger prototype for ARCHE.

from dataclasses import dataclass, field
import time
import uuid


@dataclass
class Outcome:
    outcome_id: str
    state: str
    mode: str
    score: int = 0  # 0 = waiting for results
    observed_flags: list[str] = field(default_factory=list)
    salvage_priority: str | None = None
    created_at: float = field(default_factory=time.time)

    @property
    def pending(self):
        return self.score == 0

    @property
    def needs_salvage(self):
        return 1 <= self.score <= 5

    @property
    def reinforces(self):
        return self.score >= 6


class Sys64:
    def __init__(self):
        self.events = []
        self.outcomes = {}

    def emit(self, event_type, payload):
        event = {
            "event_id": str(uuid.uuid4()),
            "timestamp": time.time(),
            "event_type": event_type,
            "payload": payload,
        }
        self.events.append(event)
        return event

    def open_outcome(self, state, mode):
        outcome = Outcome(
            outcome_id=str(uuid.uuid4()),
            state=state,
            mode=mode,
            score=0,
        )

        self.outcomes[outcome.outcome_id] = outcome

        self.emit(
            "outcome_pending",
            {
                "outcome_id": outcome.outcome_id,
                "score": 0,
                "meaning": "waiting_for_results",
            },
        )

        return outcome

    def resolve_outcome(self, outcome_id, score, observed_flags=None):
        if score < 1 or score > 9:
            raise ValueError("Resolved score must be 1-9. 0 means pending.")

        outcome = self.outcomes[outcome_id]
        outcome.score = score
        outcome.observed_flags.extend(observed_flags or [])

        if outcome.needs_salvage:
            outcome.salvage_priority = self._priority(score)

            self.emit(
                "salvage_scheduled",
                {
                    "outcome_id": outcome.outcome_id,
                    "score": score,
                    "priority": outcome.salvage_priority,
                },
            )

        else:
            self.emit(
                "reinforcement_applied",
                {
                    "outcome_id": outcome.outcome_id,
                    "score": score,
                    "delta": self._delta(score),
                },
            )

        return outcome

    def _priority(self, score):
        if score <= 2:
            return "urgent"
        if score == 3:
            return "high"
        if score == 4:
            return "medium"
        return "low"

    def _delta(self, score):
        return round(((score - 5) / 4) * 0.05, 4)


if __name__ == "__main__":
    sys64 = Sys64()

    outcome = sys64.open_outcome("focused", "technical")

    sys64.resolve_outcome(
        outcome.outcome_id,
        8,
        ["user_engaged", "architecture_progressed"],
    )

    print(sys64.events)
