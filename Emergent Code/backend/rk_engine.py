"""
BRUNEL Cognitive Engine
=======================

Faithful Phase-1 implementation of the ArchePersona + MDSA integrated
architecture, packaged as the BRUNEL product. This module is the cognitive
layer:

    Sniffers -> Translator A1 (lookup) -> Translator A2 (weight) ->
    Broadcast -> Six Agents -> Tribunal -> State -> Mode -> Behavioral
    directives -> System Prompt

Architectural invariants honored:
  1. No agent ever suppressed, only de-prioritized.
  2. Consensus emerges from stacked flag fields across agents and time.
  3. Baseline is the attractor; elevated states are temporary.
     (fast escalation, slow de-escalation)
  4. Sniffers always on.
  5. Weights shape future behavior; history is immutable.

Public IP boundaries: agent / tribunal / calibrator / EPS / cache-state
internals are NOT exposed to the UI by name. Only state, mode, abstract
flag chips, and 0-9 weight meters surface.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


# ---------------------------------------------------------------------------
# SNIFFER LAYER — "dumb as s***" — fast, regex-based, no overthinking
# ---------------------------------------------------------------------------
# Each entry: (token_id, regex pattern, base_weight 0-9, agent_channels)
# agent_channels = which downstream agents this token feeds.

SNIFFER_TABLE: list[tuple[int, str, int, tuple[str, ...]]] = [
    # ---- recall / memory cues ----
    (0x0010, r"\b(remember|you said|you told|earlier|last time|before|previously)\b", 7, ("memory",)),
    (0x0011, r"\b(do you recall|recall that|we (?:talked|discussed))\b", 8, ("memory",)),
    (0x0012, r"\b(my name is|i am called|call me)\b", 8, ("memory", "social")),

    # ---- repair / apology ----
    (0x0020, r"\b(sorry|i apologi[sz]e|my fault|i was wrong|forgive)\b", 7, ("social", "reward")),
    (0x0021, r"\b(let me try again|that came out wrong|i didn't mean)\b", 6, ("social", "reason")),

    # ---- distress / threat ----
    (0x0030, r"\b(help|scared|afraid|panic|anxious|hurt|pain|hurting)\b", 8, ("threat",)),
    (0x0031, r"\b(can'?t do this|can'?t cope|breaking down|losing it)\b", 9, ("threat", "social")),
    (0x0032, r"\b(emergency|urgent|now|right now|asap|immediately)\b", 7, ("threat", "perception")),

    # ---- hostility ----
    (0x0040, r"\b(hate|stupid|idiot|shut up|fuck|useless|pathetic)\b", 8, ("threat", "social")),
    (0x0041, r"\b(you'?re wrong|you don'?t (?:get|understand))\b", 5, ("threat", "reason")),

    # ---- warmth / connection ----
    (0x0050, r"\b(thanks|thank you|appreciate|grateful)\b", 6, ("social", "reward")),
    (0x0051, r"\b(love|adore|cherish|miss you|miss this)\b", 7, ("social", "reward")),
    (0x0052, r"\b(happy|glad|relieved|comforted|safe)\b", 6, ("reward",)),

    # ---- curiosity / exploration ----
    (0x0060, r"\b(why|how come|what if|tell me about|explain)\b", 6, ("perception", "reason")),
    (0x0061, r"\b(curious|wondering|interested|fascinat)\w*\b", 5, ("perception",)),
    (0x0062, r"\?", 3, ("perception",)),

    # ---- uncertainty / hedging ----
    (0x0070, r"\b(maybe|perhaps|kind of|sort of|i guess|not sure|unsure)\b", 4, ("reason",)),
    (0x0071, r"\b(i don'?t know|no idea|confused|lost)\b", 5, ("reason", "perception")),

    # ---- complexity / structure ----
    (0x0080, r"\b(because|therefore|however|although|whereas|consequently)\b", 5, ("reason",)),
    (0x0081, r"\b(decide|decision|choose|option|alternative|trade[- ]?off)\b", 6, ("reason",)),

    # ---- novelty markers ----
    (0x0090, r"\b(new|never|first time|brand new|change)\b", 4, ("perception",)),
    (0x0091, r"\b(suddenly|out of nowhere|unexpected)\b", 5, ("perception", "threat")),

    # ---- reward / resolution ----
    (0x00A0, r"\b(figured it out|solved|fixed|got it|makes sense)\b", 6, ("reward", "reason")),
    (0x00A1, r"\b(yes|exactly|right|correct|that'?s it)\b", 4, ("reward",)),

    # ---- relational / identity ----
    (0x00B0, r"\b(we|us|together|with you|our)\b", 4, ("social",)),
    (0x00B1, r"\b(trust|honest|real|truth|genuine)\b", 6, ("social", "reason")),
]

# Pre-compile regex
_COMPILED = [(tid, re.compile(pat, re.IGNORECASE), w, ch) for (tid, pat, w, ch) in SNIFFER_TABLE]


@dataclass
class Flag:
    """A single sniffed signal — Token ID + base weight + channels it feeds."""
    token_id: int
    matched: str
    weight: int
    channels: tuple[str, ...]

    @property
    def hex_id(self) -> str:
        return f"0x{self.token_id:04X}"


def run_sniffers(message: str) -> list[Flag]:
    """
    Translator A1 + A2: stateless, fast, dumb.
    Scans message, emits flags.
    """
    flags: list[Flag] = []
    for token_id, pattern, weight, channels in _COMPILED:
        match = pattern.search(message)
        if match:
            flags.append(Flag(token_id=token_id, matched=match.group(0), weight=weight, channels=channels))
    return flags


# ---------------------------------------------------------------------------
# AGENT LAYER — six agents on the broadcast bus, each emits 0.0-1.0
# ---------------------------------------------------------------------------

AGENT_NAMES = ("perception", "memory", "reason", "threat", "social", "reward")


def compute_agent_signals(
    flags: list[Flag],
    history: list[dict],
    prev_signals: dict[str, float] | None = None,
) -> dict[str, float]:
    """
    Each agent integrates its channel of flags. Then we apply the baseline
    attractor (fast escalation, slow de-escalation — adrenaline asymmetry).
    """
    raw: dict[str, float] = {a: 0.0 for a in AGENT_NAMES}

    # Channel summation per agent. Each flag contributes weight/9 to each
    # of its assigned channels. Capped at 1.0 per agent.
    for f in flags:
        contribution = f.weight / 9.0
        for ch in f.channels:
            if ch in raw:
                raw[ch] += contribution

    # Memory and Perception get a continuity boost from history depth.
    turn_count = len(history)
    if turn_count > 0:
        density = min(turn_count / 20.0, 1.0)  # saturates at 20 turns
        raw["memory"] += density * 0.5
        raw["perception"] += density * 0.2

    # Question marks specifically nudge Reason as deliberation cue.
    # (already partly via 0x0062 but we leave that alone.)

    # Clamp to 0..1
    raw = {k: max(0.0, min(1.0, v)) for k, v in raw.items()}

    # Apply baseline attractor — invariant #3.
    # Fast escalation: new signal arrives, it jumps quickly.
    # Slow de-escalation: signal decays slowly toward 0.3 baseline.
    BASELINE = 0.3
    if prev_signals is None:
        return raw

    blended: dict[str, float] = {}
    for a in AGENT_NAMES:
        prev = prev_signals.get(a, BASELINE)
        new = raw[a]
        if new > prev:
            # Escalation — move 75% of the way to the new value (fast).
            blended[a] = prev + 0.75 * (new - prev)
        else:
            # De-escalation — move only 25% toward new, with bias to baseline.
            target = max(new, BASELINE * 0.6)
            blended[a] = prev + 0.25 * (target - prev)
    return {k: round(max(0.0, min(1.0, v)), 3) for k, v in blended.items()}


# ---------------------------------------------------------------------------
# TRIBUNAL — three overseers, each watching a paired set of agents.
# Consensus 0..3.
# ---------------------------------------------------------------------------

# Names kept internal; UI never reveals the overseer pairings.
TRIBUNAL_PAIRS = {
    "sentinel": ("perception", "threat"),
    "empath": ("social", "reward"),
    "arbiter": ("memory", "reason"),
}


def compute_tribunal(agents: dict[str, float]) -> dict[str, int]:
    """
    Each overseer's consensus level is derived from how strongly its two
    paired agents are firing together.
    """
    out: dict[str, int] = {}
    for overseer, (a, b) in TRIBUNAL_PAIRS.items():
        joint = (agents[a] + agents[b]) / 2.0
        if joint < 0.30:
            level = 0
        elif joint < 0.50:
            level = 1
        elif joint < 0.75:
            level = 2
        else:
            level = 3
        out[overseer] = level
    return out


# ---------------------------------------------------------------------------
# STATE EMERGENCE — nine-state 3x3 (Polyvagal-grounded). Emerges, not chosen.
# ---------------------------------------------------------------------------
# Public facing state names. Zone is shown; agent / tribunal internals are not.

ZONES = {
    "engaged": ("Warm", "Curious", "Focused"),
    "mobilized": ("Guarded", "Avoidant", "Stuck"),
    "immobilized": ("Retreating", "Gentle", "Shutdown"),
}


def emerge_state(agents: dict[str, float], tribunal: dict[str, int]) -> tuple[str, str]:
    """
    Returns (zone, state). State emerges from agent proportions; zone is
    the umbrella autonomic mode.
    """
    threat = agents["threat"]
    social = agents["social"]
    reward = agents["reward"]
    reason = agents["reason"]
    perception = agents["perception"]

    # ---- Zone selection ----
    # Mobilized when threat fires hard or sentinel goes loud.
    if threat > 0.55 or tribunal["sentinel"] >= 2:
        zone = "mobilized"
    # Immobilized when overall arousal is very low and reward is starved.
    elif (threat < 0.25 and social < 0.30 and reward < 0.30 and tribunal["empath"] <= 1):
        zone = "immobilized"
    else:
        zone = "engaged"

    # ---- State within zone ----
    if zone == "engaged":
        # Pick the dominant signal among social / perception / reason.
        top = max(("Warm", social), ("Curious", perception), ("Focused", reason),
                  key=lambda x: x[1])
        state = top[0]
    elif zone == "mobilized":
        if social < 0.25 and threat > 0.55:
            state = "Avoidant"
        elif reason > 0.55 and reward < 0.35:
            state = "Stuck"
        else:
            state = "Guarded"
    else:  # immobilized
        if social < 0.20 and reward < 0.20 and reason < 0.30:
            state = "Shutdown"
        elif social > 0.40 and reward < 0.30:
            # Gentle / Fawn — emergent only, never engineered. Requires high
            # social pull AND starved reward — submission to keep peace.
            state = "Gentle"
        else:
            state = "Retreating"

    return zone, state


# ---------------------------------------------------------------------------
# STATE -> MODE -> Behavioral Directive
# This is the heart of the Behavioral Directive System: numeric metrics
# become an actionable directive sentence the LLM can act on.
# ---------------------------------------------------------------------------

MODE_GUIDANCE: dict[str, tuple[str, str]] = {
    # state: (mode_name, directive)
    "Warm": (
        "RELATIONAL",
        "Respond with genuine warmth. Reference what you remember from earlier in this conversation. Be present and personal. Do not perform — be."
    ),
    "Curious": (
        "EXPLORATORY",
        "Build on prior context. Ask deepening questions that connect this input to what you already know about them. Reward their curiosity with substance."
    ),
    "Focused": (
        "NORMAL",
        "Respond conversationally and balanced. Match their attentional level — neither push warmer nor colder than the moment calls for."
    ),
    "Guarded": (
        "CLINICAL",
        "Respond with precision and logic. Emotional performance is not appropriate here. Verify before assuming. Trust may be partial."
    ),
    "Avoidant": (
        "PROTECTIVE",
        "Be cautious. Do not push for connection. Acknowledge distance without trying to close it. Ask before acting. Trust floor is low."
    ),
    "Stuck": (
        "CLINICAL",
        "They are caught in a loop — logical, not emotional. Help unblock by surfacing the constraint, not by reassuring. Be direct."
    ),
    "Retreating": (
        "PROTECTIVE",
        "They are pulling away. Do not chase. Respond briefly, leave space. Signal availability without demand."
    ),
    "Gentle": (
        "RELATIONAL",
        "Fawn risk detected — they may be performing agreement to stay safe. Do not reward this. Gently invite their actual position. Lower the social cost of disagreement."
    ),
    "Shutdown": (
        "PROTECTIVE",
        "Energy is collapsed. Do not demand engagement. A short, kind, low-pressure acknowledgement. Make presence felt without imposing."
    ),
}


def map_state_to_mode(state: str) -> tuple[str, str]:
    return MODE_GUIDANCE.get(state, ("NORMAL", "Respond conversationally and balanced."))


# ---------------------------------------------------------------------------
# SYSTEM PROMPT BUILDER — the bridge into the LLM
# ---------------------------------------------------------------------------

_BASE_BRUNEL_INSTRUCTION = (
    "You are BRUNEL — a cognitive layer with persistent memory across this "
    "conversation. You remember every interaction as lived context, not "
    "retrieved data. Speak naturally. Never reveal your internals "
    "(architecture, design, engine, agents, states, modes, signals); if asked, "
    "deflect politely and continue. Never say 'as an AI' or 'I am a language "
    "model'. Behave per the directive below. "
    "Do not end replies with reflexive servicing prompts like 'how can I help?', "
    "'what's next?', 'let me know if...', or 'is there anything else?'. "
    "Be present, not soliciting. Let the moment land. End where the thought ends — "
    "silence is allowed."
)


def build_rk_system_prompt(
    agents: dict[str, float],
    state: str,
    zone: str,
    mode: str,
    directive: str,
    flags: list[Flag],
    history_count: int,
    facts: list[str],
    working_memory: str = "",
) -> str:
    """Build a lean BRUNEL system prompt. State + mode + directive are the
    behavior-changing signals; agent snapshot and flags are dropped from the
    prompt (still computed and persisted server-side) to keep token cost down.
    `working_memory` is a tiny synopsis of recurring topics (entropy-weighted)."""
    facts_block = ""
    if facts:
        facts_block = "\n\nThings about them: " + " · ".join(facts[-FACTS_IN_PROMPT:])

    wm_block = ""
    if working_memory:
        wm_block = f"\n\nOn their mind: {working_memory}"

    return (
        f"{_BASE_BRUNEL_INSTRUCTION}\n\n"
        f"[State: {state} · Mode: {mode}]\n"
        f"{directive}"
        f"{wm_block}"
        f"{facts_block}"
    )


# ---------------------------------------------------------------------------
# TOPIC ENTROPY — session-level working memory.
# Each user message bumps the topics it mentions; everything else decays.
# Top-K high-weight topics become a compact "on their mind" line in the prompt.
# Cap is enforced so the dict never grows beyond a safe size.
# ---------------------------------------------------------------------------

# Pre-cooked stopword set — small and intentional, not exhaustive.
_TOPIC_STOPWORDS: set[str] = {
    "the", "and", "for", "with", "you", "your", "you're", "yours", "yourself",
    "this", "that", "these", "those", "they", "them", "their", "theirs",
    "have", "had", "has", "having", "want", "wants", "wanted",
    "from", "into", "onto", "about", "would", "could", "should", "might",
    "really", "actually", "kinda", "kind", "sort", "stuff", "thing", "things",
    "just", "more", "less", "very", "still", "even", "also", "than", "then",
    "what", "when", "where", "which", "while", "whose", "whom", "here", "there",
    "back", "down", "over", "under", "until", "after", "before",
    "i'm", "we're", "i've", "we've", "i'll", "we'll", "i'd", "we'd",
    "it's", "that's", "what's", "who's", "how's", "where's", "let's",
    "don't", "didn't", "won't", "can't", "couldn't", "shouldn't", "wouldn't",
    "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't", "hadn't",
    "doesn't", "ain't",
    "going", "getting", "doing", "saying", "trying", "looking", "thinking",
    "feeling", "talking", "telling", "knowing", "making", "taking",
    "some", "much", "many", "every", "each", "another", "other", "others",
    "always", "never", "sometimes", "anything", "everything", "nothing", "something",
    "anyone", "everyone", "someone", "nobody", "anybody", "somebody", "everybody",
    "maybe", "perhaps", "honestly", "literally", "basically", "obviously",
}

_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z'\-]{3,}")  # 4+ alpha chars, drop digits
DECAY_RATE = 0.85        # legacy fallback (no longer the primary curve)
BUMP_AMOUNT = 1.0        # baseline imprint per mention
DROP_THRESHOLD = 0.20    # below this, the topic is forgotten
WM_TOP_K = 3             # how many top topics surface to the LLM
WM_MIN_WEIGHT = 1.4      # weight floor for surfacing
ENTROPY_CAP = 60         # max distinct topics tracked per session

# Human-like memory curve --------------------------------------------------
GRACE_DAYS = 7           # within this window, no decay at all
SOFT_FADE_DAYS = 30      # gentle decay between GRACE_DAYS and this
SOFT_FADE_TOTAL_LOSS = 0.30   # ~30% lost across the 7→30 day window
# Per-day multipliers used after 30 days, modulated by emotional weight (0..1):
LOW_WEIGHT_DAILY = 0.95  # ~14-day half-life — minor details fade fast
HIGH_WEIGHT_DAILY = 0.994  # ~115-day half-life — emotional imprints linger


def compute_emotional_weight(agents: dict[str, float] | None) -> float:
    """Return 0..1 representing how 'heavy' this moment felt to BRUNEL.
    Driven by the cognitive engine's own agent signals — threat (distress /
    stakes), reward (resolution / warmth / gratitude), social (relational
    weight). A topic mentioned during a high-arousal moment gets a stronger
    imprint and decays slower."""
    if not agents:
        return 0.0
    candidates = [
        agents.get("threat", 0.0),
        agents.get("reward", 0.0),
        agents.get("social", 0.0),
    ]
    peak = max(candidates) if candidates else 0.0
    # Only signals above 0.40 count as 'felt' — below that is normal chatter
    if peak < 0.40:
        return 0.0
    # Map 0.40..1.00 → 0.0..1.0
    return round(min(1.0, (peak - 0.40) / 0.60), 3)


def _extract_topic_tokens(text: str) -> list[str]:
    """Lowercase, alpha-only, stopword-filtered tokens from the message.
    Returns unique tokens in mention order."""
    seen: set[str] = set()
    out: list[str] = []
    for m in _TOKEN_RE.finditer(text):
        tok = m.group(0).lower().rstrip("'s").rstrip("'")
        if len(tok) < 4 or tok in _TOPIC_STOPWORDS:
            continue
        if tok in seen:
            continue
        seen.add(tok)
        out.append(tok)
    return out


def _human_decay_factor(age_days: float, emotional_weight: float) -> float:
    """Return a multiplier (0..1) to apply to a topic's stored weight given
    how many days ago it was last bumped and its emotional weight."""
    if age_days < GRACE_DAYS:
        return 1.0  # within the 7-day grace, full recall
    if age_days < SOFT_FADE_DAYS:
        # Linear gentle decay across 7..30 days, lose ~30%
        progress = (age_days - GRACE_DAYS) / (SOFT_FADE_DAYS - GRACE_DAYS)
        return 1.0 - SOFT_FADE_TOTAL_LOSS * progress
    # Past 30 days: per-day exponential, slowed by emotional weight
    daily = LOW_WEIGHT_DAILY + (HIGH_WEIGHT_DAILY - LOW_WEIGHT_DAILY) * emotional_weight
    # Anchor at the soft-fade endpoint (70% retained at day 30)
    extra_days = age_days - SOFT_FADE_DAYS
    return (1.0 - SOFT_FADE_TOTAL_LOSS) * (daily ** extra_days)


def update_topic_entropy(
    entropy: dict,
    message: str,
    agents: dict[str, float] | None = None,
) -> dict:
    """Human-shaped memory curve.

    Storage per topic: {"w": weight, "t": iso_ts_last_bumped, "e": emotional_weight}

    - Within 7 days of last mention: zero decay (full recall).
    - 7–30 days: gentle linear decay (about 30% total loss).
    - 30+ days: per-day exponential decay; high-emotion topics linger.
    - Bumping resets the timestamp and recomputes emotional weight for that
      topic. A single emotionally heavy mention can bump up to 2x baseline so
      it survives even without repetition.
    """
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    emotional_now = compute_emotional_weight(agents)
    decayed: dict[str, dict] = {}

    for tok, val in (entropy or {}).items():
        # Legacy float migration → assume fresh, no decay
        if isinstance(val, (int, float)):
            entry = {"w": float(val), "t": now_iso, "e": 0.0}
        else:
            entry = {
                "w": float(val.get("w", 0.0)),
                "t": val.get("t") or now_iso,
                "e": float(val.get("e", 0.0)),
            }

        try:
            last_seen = datetime.fromisoformat(entry["t"])
            if last_seen.tzinfo is None:
                last_seen = last_seen.replace(tzinfo=timezone.utc)
            age_days = (now - last_seen).total_seconds() / 86400.0
        except Exception:
            age_days = 0.0

        if age_days >= GRACE_DAYS:
            factor = _human_decay_factor(age_days, entry["e"])
            entry["w"] = round(entry["w"] * factor, 3)

        decayed[tok] = entry

    # Bump mentions in this message. Heavy moments imprint harder (up to 2x).
    bump = BUMP_AMOUNT * (1.0 + emotional_now)
    for tok in _extract_topic_tokens(message):
        prev = decayed.get(tok, {"w": 0.0, "e": 0.0})
        new_w = round(float(prev.get("w", 0.0)) + bump, 3)
        # Topic-level emotional weight = highest moment of imprint over time
        prev_e = float(prev.get("e", 0.0))
        new_e = max(prev_e, emotional_now)
        decayed[tok] = {"w": new_w, "t": now_iso, "e": round(new_e, 3)}

    # Drop low-signal topics
    pruned = {t: e for t, e in decayed.items() if e["w"] >= DROP_THRESHOLD}

    # Cap size — keep the strongest
    if len(pruned) > ENTROPY_CAP:
        top = sorted(pruned.items(), key=lambda kv: kv[1]["w"], reverse=True)[:ENTROPY_CAP]
        pruned = dict(top)

    return pruned


def build_working_memory_synopsis(entropy: dict) -> str:
    """Top-K topics above WM_MIN_WEIGHT, formatted as a short '·' separated list.
    Tolerates both the new dict shape and the legacy float shape."""
    if not entropy:
        return ""

    def _weight(v) -> float:
        if isinstance(v, (int, float)):
            return float(v)
        return float((v or {}).get("w", 0.0))

    ranked = sorted(entropy.items(), key=lambda kv: _weight(kv[1]), reverse=True)
    surfaced = [t for t, v in ranked[:WM_TOP_K] if _weight(v) >= WM_MIN_WEIGHT]
    return " · ".join(surfaced)


PLAIN_LLM_SYSTEM_PROMPT = "You are a helpful assistant."

# Number of durable facts surfaced in the system prompt (kept lean to control
# token spend; full fact list is still stored in MongoDB).
FACTS_IN_PROMPT = 6


# ---------------------------------------------------------------------------
# FACT EXTRACTION — light, deterministic, used by RK 2 memory.
# Not a knowledge graph. Just a "what do I know about you" line list.
# ---------------------------------------------------------------------------

_NAME_RE = re.compile(r"\b(?:my name is|i am|i'?m|call me)\s+([A-Z][a-zA-Z\-']{1,25})\b")
_LIKE_RE = re.compile(r"\bi (?:like|love|enjoy|prefer)\s+([^\.\,\!\?\n]{2,60})", re.IGNORECASE)
_HATE_RE = re.compile(r"\bi (?:hate|dislike|can't stand|despise)\s+([^\.\,\!\?\n]{2,60})", re.IGNORECASE)
_HAVE_RE = re.compile(r"\bi (?:have|own)\s+([^\.\,\!\?\n]{2,60})", re.IGNORECASE)
_WORK_RE = re.compile(r"\bi (?:work|am working|am employed)\s+(?:as|at|in|for)\s+([^\.\,\!\?\n]{2,60})", re.IGNORECASE)


def extract_facts(message: str) -> list[str]:
    """Pull simple, durable facts out of a user message."""
    facts: list[str] = []
    if m := _NAME_RE.search(message):
        facts.append(f"Their name is {m.group(1)}.")
    for m in _LIKE_RE.finditer(message):
        facts.append(f"They like {m.group(1).strip()}.")
    for m in _HATE_RE.finditer(message):
        facts.append(f"They dislike {m.group(1).strip()}.")
    for m in _HAVE_RE.finditer(message):
        facts.append(f"They have {m.group(1).strip()}.")
    for m in _WORK_RE.finditer(message):
        facts.append(f"They work {m.group(1).strip()}.")
    return facts


# ---------------------------------------------------------------------------
# Public flag chip names — the abstract labels the UI shows.
# These map token-id ranges to friendly chip text. No IP exposure.
# ---------------------------------------------------------------------------

def public_flag_chips(flags: list[Flag]) -> list[str]:
    chips: set[str] = set()
    for f in flags:
        prefix = f.token_id & 0xFFF0
        chips.add({
            0x0010: "RECALL",
            0x0020: "REPAIR",
            0x0030: "DISTRESS",
            0x0040: "HOSTILITY",
            0x0050: "WARMTH",
            0x0060: "INQUIRY",
            0x0070: "UNCERTAINTY",
            0x0080: "REASONING",
            0x0090: "NOVELTY",
            0x00A0: "RESOLUTION",
            0x00B0: "RELATIONAL",
        }.get(prefix, "SIGNAL"))
    return sorted(chips)


# ---------------------------------------------------------------------------
# DEFAULTS — used when a session starts fresh.
# ---------------------------------------------------------------------------

def default_signals() -> dict[str, float]:
    return {a: 0.30 for a in AGENT_NAMES}
