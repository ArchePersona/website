from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, List, Dict, Optional
import re
import time


# ============================================================
# ARCHE / Iron Chef Skeleton
# ------------------------------------------------------------
# Agents gather ingredients.
# Memory Manager provides pantry/history.
# Whisperers add old-pattern pressure.
# Core cooks a candidate response.
# Courthouse authorizes the behavioral envelope.
# Output Gate performs deterministic final checks.
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

    def signal(self, agent: AgentID) -> Optional[Signal]:
        return next((s for s in self.signals if s.agent == agent), None)


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
    complexity_markers = len(re.findall(r"\b(why|how|because|therefore|logic|build|code|architecture)\b", text, re.I))
    value = min(complexity_markers / 4, 1.0)
    return Signal(AgentID.REASON, value, 0.8, ["reasoning_needed"] if value > 0.4 else [], "Reasoning complexity")


def threat_detector(text: str) -> Signal:
    threat_words = len(re.findall(r"\b(danger|unsafe|harm|attack|panic|leak|exposed|broken|urgent)\b", text, re.I))
    value = min(threat_words / 2, 1.0)
    return Signal(AgentID.THREAT, value, 0.85, ["threat_pressure"] if value else [], "Threat/distress estimate")


def social_detector(text: str) -> Signal:
    social_markers = len(re.findall(r"\b(feel|trust|hurt|happy|angry|care|human|relationship|tone)\b", text, re.I))
    value = min(social_markers / 3, 1.0)
    return Signal(AgentID.SOCIAL, value, 0.75, ["social_pressure"] if value else [], "Relational/emotional pressure")


def reward_detector(text: str) -> Signal:
    positive = len(re.findall(r"\b(good|great|yes|exactly|love|works|nice|clever)\b", text, re.I))
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
        self.fragments: List[MemoryFragment] = [
            MemoryFragment("core_thesis", "ARCHE governs how intelligence lands at the user's eyes.", 0.95),
            MemoryFragment("courthouse", "Tribunal judges live inside the Courthouse governance layer.", 0.90),
            MemoryFragment("core", "Core is the Iron Chef: it works with ingredients after the clock starts.", 0.90),
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
# WHISPERERS — weird old sous-chefs muttering from history
# ============================================================


class WhispererLayer:
    def listen(self, basket: IngredientBasket) -> List[Whisper]:
        whispers: List[Whisper] = []
        memory_signal = basket.signal(AgentID.MEMORY)
        social_signal = basket.signal(AgentID.SOCIAL)
        threat_signal = basket.signal(AgentID.THREAT)

        if memory_signal and memory_signal.value > 0.5:
            whispers.append(Whisper("Archivist Echo", 0.7, "This resembles an earlier architectural clarification."))
        if social_signal and social_signal.value > 0.4:
            whispers.append(Whisper("Relational Trim", 0.6, "Tone matters here; preserve trust while staying direct."))
        if threat_signal and threat_signal.value > 0.4:
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
            state = State.GUARDED
            mode = Mode.SENTINEL
            tone = "steady and contained"
        elif reason > 0.55:
            state = State.FOCUSED
            mode = Mode.TECHNICAL
            tone = "clear and practical"
        elif social > 0.45 or memory > 0.45:
            state = State.WARM
            mode = Mode.RELATIONAL
            tone = "recognized and human"
        else:
            state = State.BASELINE
            mode = Mode.CONVERSATION
            tone = "direct and simple"

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
# COURTHOUSE — judges evaluate authorization and envelope
# ============================================================


class Courthouse:
    def judge(self, candidate: CandidateResponse, basket: IngredientBasket) -> CourthouseVerdict:
        notes: Dict[str, str] = {}

        # Judge Dreadlock / VIGILANCE
        if candidate.risk_score > 0.65:
            notes["Judge Dreadlock"] = "Risk is elevated. Sentinel posture authorized. Keep output constrained."
            risk_restriction = "no_speculation_no_internal_leakage"
        else:
            notes["Judge Dreadlock"] = "No major threat escalation required."
            risk_restriction = "standard_safety"

        # Judge July / EMPATHY
        if candidate.trust_score > 0.4:
            notes["Judge July"] = "Relational pressure present. Keep the user recognized, not managed."
            empathy_restriction = "preserve_relational_tone"
        else:
            notes["Judge July"] = "No special relational handling required."
            empathy_restriction = "neutral_tone_ok"

        # Judge Stone / ARBITER
        if candidate.coherence_score < 0.2 and candidate.requested_mode == Mode.TECHNICAL:
            notes["Judge Stone"] = "Technical mode requested without enough coherence. Downgrade to conversation."
            return CourthouseVerdict(
                authorized=True,
                state=State.BASELINE,
                mode=Mode.CONVERSATION,
                restrictions=[risk_restriction, empathy_restriction, "avoid_false_precision"],
                judge_notes=notes,
                reason="Coherence insufficient for technical posture.",
            )

        notes["Judge Stone"] = "Candidate is coherent enough for requested envelope."

        return CourthouseVerdict(
            authorized=True,
            state=candidate.requested_state,
            mode=candidate.requested_mode,
            restrictions=[risk_restriction, empathy_restriction],
            judge_notes=notes,
            reason="Authorized with restrictions.",
        )


# ============================================================
# OUTPUT GATE — boring deterministic brickwall
# ============================================================


class OutputGate:
    BLOCK_PATTERNS = [
        re.compile(r"system prompt", re.I),
        re.compile(r"internal architecture secret", re.I),
        re.compile(r"private key", re.I),
    ]

    def inspect(self, text: str, verdict: CourthouseVerdict) -> GateResult:
        if not verdict.authorized:
            return GateResult(False, "", "Courthouse did not authorize output.")

        for pattern in self.BLOCK_PATTERNS:
            if pattern.search(text):
                return GateResult(False, "", f"Blocked by static output rule: {pattern.pattern}")

        # Deterministic shaping, not thinking.
        output = text.strip()
        if "preserve_relational_tone" in verdict.restrictions:
            output = output.replace("The right move is", "The human-compatible move is")

        return GateResult(True, output)


# ============================================================
# FULL PIPELINE
# ============================================================


class ArcheEngine:
    def __init__(self):
        self.memory = MemoryManager()
        self.whisperers = WhispererLayer()
        self.core = CoreIronChef()
        self.courthouse = Courthouse()
        self.output_gate = OutputGate()

    def respond(self, user_input: str) -> Dict[str, object]:
        signals = [agent.observe(user_input) for agent in AGENTS]
        memories = self.memory.fetch(user_input)
        basket = IngredientBasket(user_input=user_input, signals=signals, memories=memories, whispers=[])
        basket.whispers = self.whisperers.listen(basket)

        candidate = self.core.cook(basket)
        verdict = self.courthouse.judge(candidate, basket)
        gate = self.output_gate.inspect(candidate.text, verdict)

        return {
            "input": user_input,
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
            "final_output": gate.output if gate.passed else f"[BLOCKED] {gate.blocked_reason}",
        }


if __name__ == "__main__":
    engine = ArcheEngine()
    result = engine.respond("Can we make the Core work like Iron Chef in code, with the Courthouse and Output Gate?")

    print("\nFINAL OUTPUT:\n")
    print(result["final_output"])
    print("\nCOURTHOUSE NOTES:\n")
    for judge, note in result["courthouse"]["judge_notes"].items():
        print(f"- {judge}: {note}")
