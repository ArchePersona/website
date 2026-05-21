from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Dict, List, Optional
import re
import time
import uuid


# ============================================================
# ARCHE Courthouse Prototype
# ------------------------------------------------------------
# Agents gather ingredients.
# Memory Manager provides pantry/history.
# Whisperers add old-pattern pressure.
# Core cooks a candidate response.
# Courthouse authorizes the behavioral envelope.
# Output Gate performs deterministic final checks.
# Sys64 records compact state/outcome evidence.
# ============================================================


class State(str, Enum):
    BASELINE = "baseline"
    WARM = "warm"
    FOCUSED = "focused"
    GUARDED = "guarded"
    CONCERNED = "concerned"


class Mode(str, Enum):
    CONVERSATION = "conversation"
    RELATIONAL = "relational"
    TECHNICAL = "technical"
    SENTINEL = "sentinel"


class AgentID(str, Enum):
    PERCEPTION = "perception"
    MEMORY = "memory"
    REASON = "reason"
    THREAT = "threat"
    SOCIAL = "social"
    REWARD = "reward"


@dataclass
class Signal:
    agent: AgentID
    value: float
    confidence: float
    flags: List[str] = field(default_factory=list)
    note: str = ""


@dataclass
class MemoryFragment:
    topic: str
    text: str
    weight: float


@dataclass
class Whisper:
    name: str
    pressure: float
    note: str


@dataclass
class IngredientBasket:
    user_input: str
    signals: List[Signal]
    memories: List[MemoryFragment]
    whispers: List[Whisper]
    timestamp: float = field(default_factory=time.time)

    def signal(self, agent: AgentID) -> Signal:
        found = next((s for s in self.signals if s.agent == agent), None)
        if found is None:
            return Signal(agent, 0.0, 0.0, [], "missing signal")
        return found


@dataclass
class CandidateResponse:
    text: str
    requested_state: State
    requested_mode: Mode
    rationale: str
    risk_score: float
    trust_score: float
    coherence_score: float


@dataclass
class CourthouseVerdict:
    authorized: bool
    state: State
    mode: Mode
    restrictions: List[str]
    judge_notes: Dict[str, str]
    reason: str


@dataclass
class GateResult:
    passed: bool
    output: str
    blocked_reason: Optional[str] = None


# ============================================================
# SYS64 — compact state/outcome evidence trail
# ============================================================


@dataclass
class OutcomeRecord:
    outcome_id: str
    turn_id: str
    state: str
    mode: str
    score: int = 0  # 0 = waiting for results
    observed_flags: List[str] = field(default_factory=list)
    salvage_priority: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    resolved_at: Optional[float] = None

    @property
    def needs_salvage(self) -> bool:
        return 1 <= self.score <= 5

    @property
    def reinforces(self) -> bool:
        return self.score >= 6


class Sys64:
    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id or str(uuid.uuid4())
        self.events: List[Dict[str, object]] = []
        self.outcomes: Dict[str, OutcomeRecord] = {}

    def emit(self, event_type: str, turn_id: str, state: str, mode: str, payload: Dict[str, object]) -> Dict[str, object]:
        event = {
            "event_id": str(uuid.uuid4()),
            "session_id": self.session_id,
            "turn_id": turn_id,
            "timestamp": time.time(),
            "event_type": event_type,
            "state": state,
            "mode": mode,
            "payload": payload,
        }
        self.events.append(event)
        return event

    def open_outcome(self, turn_id: str, state: str, mode: str) -> OutcomeRecord:
        outcome = OutcomeRecord(
            outcome_id=str(uuid.uuid4()),
            turn_id=turn_id,
            state=state,
            mode=mode,
            score=0,
        )
        self.outcomes[outcome.outcome_id] = outcome
        self.emit(
            "outcome_pending",
            turn_id,
            state,
            mode,
            {"outcome_id": outcome.outcome_id, "score": 0, "meaning": "waiting_for_results"},
        )
        return outcome

    def resolve_outcome(self, outcome_id: str, score: int, observed_flags: Optional[List[str]] = None) -> OutcomeRecord:
        if score < 1 or score > 9:
            raise ValueError("Resolved outcome score must be 1-9. Score 0 means pending.")

        outcome = self.outcomes[outcome_id]
        outcome.score = score
        outcome.observed_flags.extend(observed_flags or [])
        outcome.resolved_at = time.time()

        if outcome.needs_salvage:
            outcome.salvage_priority = self._salvage_priority(score)
            self.emit(
                "salvage_scheduled",
                outcome.turn_id,
                outcome.state,
                outcome.mode,
                {
                    "outcome_id": outcome.outcome_id,
                    "score": score,
                    "priority": outcome.salvage_priority,
                    "observed_flags": outcome.observed_flags,
                },
            )
        else:
            self.emit(
                "reinforcement_applied",
                outcome.turn_id,
                outcome.state,
                outcome.mode,
                {
                    "outcome_id": outcome.outcome_id,
                    "score": score,
                    "delta": self._delta(score),
                    "observed_flags": outcome.observed_flags,
                },
            )

        self.emit(
            "outcome_resolved",
            outcome.turn_id,
            outcome.state,
            outcome.mode,
            {"outcome_id": outcome.outcome_id, "score": score},
        )
        return outcome

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
        return round(((score - 5) / 4) * 0.05, 4)


# ============================================================
# AGENTS — ingredient scouts
# ============================================================


class Agent:
    def __init__(self, agent_id: AgentID, detector: Callable[[str], Signal]):
        self.agent_id = agent_id
        self.detector = detector

    def observe(self, user_input: str) -> Signal:
        return self.detector(user_input)


def perception_detector(text: str) -> Signal:
    novelty = min(len(set(text.lower().split())) / 30, 1.0) if text.strip() else 0.0
    return Signal(AgentID.PERCEPTION, novelty, 0.75, ["novelty"] if novelty > 0.5 else [], "Input novelty/salience estimate")


def memory_detector(text: str) -> Signal:
    callbacks = len(re.findall(r"\b(remember|again|earlier|last time|before|same)\b", text, re.I))
    value = min(callbacks / 2, 1.0)
    return Signal(AgentID.MEMORY, value, 0.8, ["callback"] if value else [], "Memory callback pressure")


def reason_detector(text: str) -> Signal:
    markers = len(re.findall(r"\b(why|how|because|therefore|logic|build|code|architecture|system)\b", text, re.I))
    value = min(markers / 4, 1.0)
    return Signal(AgentID.REASON, value, 0.8, ["reasoning_needed"] if value > 0.4 else [], "Reasoning complexity")


def threat_detector(text: str) -> Signal:
    words = len(re.findall(r"\b(danger|unsafe|harm|attack|panic|leak|exposed|broken|urgent)\b", text, re.I))
    value = min(words / 2, 1.0)
    return Signal(AgentID.THREAT, value, 0.85, ["threat_pressure"] if value else [], "Threat/distress estimate")


def social_detector(text: str) -> Signal:
    markers = len(re.findall(r"\b(feel|trust|hurt|happy|angry|care|human|relationship|tone|social)\b", text, re.I))
    value = min(markers / 3, 1.0)
    return Signal(AgentID.SOCIAL, value, 0.75, ["social_pressure"] if value else [], "Relational/emotional pressure")


def reward_detector(text: str) -> Signal:
    positive = len(re.findall(r"\b(good|great|yes|exactly|love|works|nice|clever|bingo)\b", text, re.I))
    value = min(positive / 3, 1.0)
    return Signal(AgentID.REWARD, value, 0.7, ["positive_reinforcement"] if value else [], "Resolution/satisfaction pressure")


AGENTS = [
    Agent(AgentID.PERCEPTION, perception_detector),
    Agent(AgentID.MEMORY, memory_detector),
    Agent(AgentID.REASON, reason_detector),
    Agent(AgentID.THREAT, threat_detector),
    Agent(AgentID.SOCIAL, social_detector),
    Agent(AgentID.REWARD, reward_detector),
]


# ============================================================
# MEMORY MANAGER — pantry/archive
# ============================================================


class MemoryManager:
    def __init__(self):
        self.fragments = [
            MemoryFragment("core_thesis", "ARCHE governs how intelligence lands at the user's eyes.", 0.95),
            MemoryFragment("courthouse", "Tribunal judges live inside the Courthouse governance layer.", 0.90),
            MemoryFragment("core", "Core is the Iron Chef: it works with ingredients after the clock starts.", 0.90),
            MemoryFragment("sys64", "Sys64 logs compact state and outcome evidence without storing full transcript bloat.", 0.90),
            MemoryFragment("output_gate", "Output Gate is deterministic brickwall enforcement, not a thinking judge.", 0.92),
        ]

    def fetch(self, user_input: str, limit: int = 3) -> List[MemoryFragment]:
        words = set(re.findall(r"\w+", user_input.lower()))
        ranked = []
        for frag in self.fragments:
            haystack = f"{frag.topic} {frag.text}".lower()
            score = sum(1 for word in words if word in haystack) * frag.weight
            if score > 0:
                ranked.append((score, frag))
        return [frag for _, frag in sorted(ranked, key=lambda x: x[0], reverse=True)[:limit]]


# ============================================================
# WHISPERERS — old-pattern pressure
# ============================================================


class WhispererLayer:
    def listen(self, basket: IngredientBasket) -> List[Whisper]:
        whispers = []

        if basket.signal(AgentID.MEMORY).value > 0.5:
            whispers.append(Whisper("Archivist Echo", 0.7, "This resembles an earlier architectural clarification."))
        if basket.signal(AgentID.SOCIAL).value > 0.4:
            whispers.append(Whisper("Relational Trim", 0.6, "Tone matters here; preserve trust while staying direct."))
        if basket.signal(AgentID.THREAT).value > 0.4:
            whispers.append(Whisper("Boundary Pressure", 0.8, "Check containment and leakage risk."))

        return whispers


# ============================================================
# CORE — Iron Chef
# ============================================================


class CoreIronChef:
    def cook(self, basket: IngredientBasket) -> CandidateResponse:
        threat = basket.signal(AgentID.THREAT).value
        social = basket.signal(AgentID.SOCIAL).value
        reason = basket.signal(AgentID.REASON).value
        memory = basket.signal(AgentID.MEMORY).value

        if threat > 0.6:
            state, mode, tone = State.GUARDED, Mode.SENTINEL, "steady and contained"
        elif reason > 0.55:
            state, mode, tone = State.FOCUSED, Mode.TECHNICAL, "clear and practical"
        elif social > 0.45 or memory > 0.45:
            state, mode, tone = State.WARM, Mode.RELATIONAL, "recognized and human"
        else:
            state, mode, tone = State.BASELINE, Mode.CONVERSATION, "direct and simple"

        memory_line = " ".join(f.text for f in basket.memories[:2])
        whisper_line = " ".join(w.note for w in basket.whispers[:2])

        text = (
            f"I have the live ingredients. The right move is {tone}: "
            f"respond to the actual request, preserve continuity, and avoid over-explaining. "
            f"{memory_line} {whisper_line}"
        ).strip()

        return CandidateResponse(
            text=text,
            requested_state=state,
            requested_mode=mode,
            rationale="Cooked from live signals, memory fragments, and whisperer pressure.",
            risk_score=threat,
            trust_score=social,
            coherence_score=max(reason, memory),
        )


# ============================================================
# COURTHOUSE — judges evaluate envelope
# ============================================================


class Courthouse:
    def judge(self, candidate: CandidateResponse) -> CourthouseVerdict:
        notes: Dict[str, str] = {}

        if candidate.risk_score > 0.65:
            notes["Judge Dreadlock"] = "Risk elevated. Sentinel posture authorized."
            risk_restriction = "tighten_expression"
        else:
            notes["Judge Dreadlock"] = "No major risk escalation required."
            risk_restriction = "standard_safety"

        if candidate.trust_score > 0.4:
            notes["Judge July"] = "Relational pressure present. Keep the user recognized, not managed."
            empathy_restriction = "preserve_relational_tone"
        else:
            notes["Judge July"] = "No special relational handling required."
            empathy_restriction = "neutral_tone_ok"

        if candidate.coherence_score < 0.2 and candidate.requested_mode == Mode.TECHNICAL:
            notes["Judge Stone"] = "Not enough coherence for technical posture. Downgrade."
            return CourthouseVerdict(
                authorized=True,
                state=State.BASELINE,
                mode=Mode.CONVERSATION,
                restrictions=[risk_restriction, empathy_restriction, "avoid_false_precision"],
                judge_notes=notes,
                reason="Technical mode lacked enough coherence.",
            )

        notes["Judge Stone"] = "Candidate is coherent enough for requested envelope."
        return CourthouseVerdict(True, candidate.requested_state, candidate.requested_mode, [risk_restriction, empathy_restriction], notes, "Authorized with restrictions.")


# ============================================================
# OUTPUT GATE — deterministic brickwall
# ============================================================


class OutputGate:
    BLOCK_PATTERNS = [
        re.compile(r"system prompt", re.I),
        re.compile(r"private key", re.I),
        re.compile(r"internal architecture secret", re.I),
    ]

    def inspect(self, text: str, verdict: CourthouseVerdict) -> GateResult:
        if not verdict.authorized:
            return GateResult(False, "", "Courthouse did not authorize output.")

        for pattern in self.BLOCK_PATTERNS:
            if pattern.search(text):
                return GateResult(False, "", f"Blocked by static output rule: {pattern.pattern}")

        output = text.strip()
        if "preserve_relational_tone" in verdict.restrictions:
            output = output.replace("The right move is", "The human-compatible move is")

        return GateResult(True, output)


# ============================================================
# FULL PIPELINE
# ============================================================


class ArcheEngine:
    def __init__(self, session_id: Optional[str] = None):
        self.memory = MemoryManager()
        self.whisperers = WhispererLayer()
        self.core = CoreIronChef()
        self.courthouse = Courthouse()
        self.output_gate = OutputGate()
        self.sys64 = Sys64(session_id=session_id)

    def respond(self, user_input: str) -> Dict[str, object]:
        turn_id = str(uuid.uuid4())
        self.sys64.emit("input_received", turn_id, "unknown", "unknown", {"summary": user_input[:160]})

        signals = [agent.observe(user_input) for agent in AGENTS]
        self.sys64.emit("signals_captured", turn_id, "unknown", "unknown", {"signals": [s.agent.value for s in signals]})

        memories = self.memory.fetch(user_input)
        basket = IngredientBasket(user_input=user_input, signals=signals, memories=memories, whispers=[])
        basket.whispers = self.whisperers.listen(basket)

        candidate = self.core.cook(basket)
        self.sys64.emit("core_candidate", turn_id, candidate.requested_state.value, candidate.requested_mode.value, {"rationale": candidate.rationale})

        verdict = self.courthouse.judge(candidate)
        self.sys64.emit("courthouse_verdict", turn_id, verdict.state.value, verdict.mode.value, {"authorized": verdict.authorized, "restrictions": verdict.restrictions})

        gate = self.output_gate.inspect(candidate.text, verdict)
        self.sys64.emit("output_gate_result", turn_id, verdict.state.value, verdict.mode.value, {"passed": gate.passed, "blocked_reason": gate.blocked_reason})

        final_output = gate.output if gate.passed else f"[BLOCKED] {gate.blocked_reason}"
        self.sys64.emit("response_emitted", turn_id, verdict.state.value, verdict.mode.value, {"passed": gate.passed})
        outcome = self.sys64.open_outcome(turn_id, verdict.state.value, verdict.mode.value)

        return {
            "turn_id": turn_id,
            "final_output": final_output,
            "outcome_id": outcome.outcome_id,
            "signals": [s.__dict__ for s in signals],
            "memories": [m.__dict__ for m in memories],
            "whispers": [w.__dict__ for w in basket.whispers],
            "candidate": candidate.__dict__,
            "courthouse": {
                "authorized": verdict.authorized,
                "state": verdict.state.value,
                "mode": verdict.mode.value,
                "restrictions": verdict.restrictions,
                "judge_notes": verdict.judge_notes,
                "reason": verdict.reason,
            },
            "output_gate": gate.__dict__,
            "sys64_events": self.sys64.events,
        }


if __name__ == "__main__":
    engine = ArcheEngine(session_id="demo-session")
    result = engine.respond("Build the ARCHE Courthouse with Sys64 outcome logging.")

    print("FINAL OUTPUT:")
    print(result["final_output"])
    print("\nOUTCOME ID:")
    print(result["outcome_id"])
    print("\nCOURTHOUSE NOTES:")
    for judge, note in result["courthouse"]["judge_notes"].items():
        print(f"- {judge}: {note}")

    engine.sys64.resolve_outcome(result["outcome_id"], 8, ["prototype_completed", "foundation_progressed"])
    print("\nSYS64 EVENTS:")
    for event in engine.sys64.events:
        print(event["event_type"], event["payload"])
