"""ARCHE Core seed engine.

The Core owns internal decision assembly. It does not call the LLM and it does
not decide final public wording. It produces the response seed: sniffed flags,
agent weights, Tribunal result, state/mode/directive, memory presearch, memory
synopsis, dynamic delivery policy, and the system prompt ingredients needed by
the delivery engine.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from arche.delivery_policy import DeliveryPolicy, build_delivery_policy
from arche.memory_manager import MemoryManager, PresearchBuffer
from rk_engine import (
    build_rk_system_prompt,
    build_working_memory_synopsis,
    compute_agent_signals,
    compute_tribunal,
    emerge_state,
    map_state_to_mode,
    public_flag_chips,
    run_sniffers,
    update_topic_entropy,
)


@dataclass(slots=True)
class ResponseSeed:
    """Internal-only seed produced by the Core.

    This is not returned to the browser. It is the private handoff from the
    seed engine to the delivery engine.
    """

    flags: list[Any]
    chips: list[str]
    agent_signals: dict[str, float]
    tribunal: dict[str, int]
    zone: str
    state: str
    mode: str
    directive: str
    memory_presearch: PresearchBuffer
    topic_entropy: dict
    working_memory: str
    delivery_policy: DeliveryPolicy
    rk_system_prompt: str


VALID_TARGETS = {"rk_only", "plain_only", "both"}


def validate_chat_input(message: str, target: str) -> None:
    """Pure validation used by the API doorway before Core execution."""
    if not message.strip():
        raise ValueError("message is required")
    if target not in VALID_TARGETS:
        raise ValueError("invalid target")


def normalize_recall_signals(signals: dict[str, float] | None) -> dict[str, float]:
    """Return a canonical signal map using Recall instead of legacy Memory.

    The demo still has older code paths and stored sessions that may use the
    key 'memory'. The Core treats that as the Recall agent now.
    """
    normalized = dict(signals or {})
    if "recall" not in normalized and "memory" in normalized:
        normalized["recall"] = normalized["memory"]
    normalized.pop("memory", None)
    return normalized


def generate_response_seed(
    *,
    message: str,
    session: dict,
    memory_strings: list[str],
    valid_states: set[str],
    valid_modes: set[str],
) -> ResponseSeed:
    """Generate the internal response seed for a user message.

    This function is deliberately side-effect-free: it reads session state and
    returns the next seed, but does not mutate/persist the session and does not
    call a model.
    """
    session["signals"] = normalize_recall_signals(session.get("signals"))
    flags = run_sniffers(message)
    chips = public_flag_chips(flags)

    raw_agent_signals = compute_agent_signals(
        flags=flags,
        history=session["rk_history"],
        prev_signals=session["signals"],
    )
    agent_signals = normalize_recall_signals(raw_agent_signals)

    memory_presearch = MemoryManager().prepare_presearch(
        message=message,
        recall_strength=agent_signals.get("recall", agent_signals.get("memory", 0.0)),
        session=session,
        external_memories=memory_strings,
    )

    tribunal = compute_tribunal(raw_agent_signals)
    zone, state = emerge_state(raw_agent_signals, tribunal)
    mode, directive = map_state_to_mode(state)

    override = session.get("admin_override") or {}
    forced_state = override.get("state")
    forced_mode = override.get("mode")
    if forced_state and forced_state in valid_states:
        state = forced_state
        mode, directive = map_state_to_mode(state)
    if forced_mode and forced_mode in valid_modes:
        mode = forced_mode

    delivery_policy = build_delivery_policy(
        state=state,
        zone=zone,
        mode=mode,
        agent_signals=agent_signals,
    )

    topic_entropy = update_topic_entropy(
        session.get("topic_entropy", {}) or {},
        message,
        agents=agent_signals,
    )
    working_memory = build_working_memory_synopsis(topic_entropy)

    rk_system_prompt = build_rk_system_prompt(
        agents=agent_signals,
        state=state,
        zone=zone,
        mode=mode,
        directive=directive,
        flags=flags,
        history_count=len(session["rk_history"]),
        facts=memory_strings,
        working_memory=working_memory,
    )

    return ResponseSeed(
        flags=flags,
        chips=chips,
        agent_signals=agent_signals,
        tribunal=tribunal,
        zone=zone,
        state=state,
        mode=mode,
        directive=directive,
        memory_presearch=memory_presearch,
        topic_entropy=topic_entropy,
        working_memory=working_memory,
        delivery_policy=delivery_policy,
        rk_system_prompt=rk_system_prompt,
    )


def apply_delivery_to_session(
    *,
    session: dict,
    seed: ResponseSeed,
    user_message: str,
    rk_text: str | None,
    plain_text: str | None,
) -> None:
    """Apply delivered text back into mutable session state.

    Persistence to Mongo remains outside this function; this only mutates the
    provided session dict after delivery has produced public text.
    """
    if rk_text is not None:
        session["rk_history"].append({
            "user": user_message,
            "assistant": rk_text,
            "ts": datetime.now(timezone.utc).isoformat(),
            "state": seed.state,
            "zone": seed.zone,
            "mode": seed.mode,
            "weights": seed.agent_signals,
            "flags": seed.chips,
            "tribunal": seed.tribunal,
            "memory_presearch": seed.memory_presearch.to_dict(),
            "delivery_policy": seed.delivery_policy.to_dict(),
        })
        session["signals"] = seed.agent_signals
        session["last_state"] = seed.state
        session["last_zone"] = seed.zone
        session["last_mode"] = seed.mode
        session["last_flags"] = seed.chips
        session["last_memory_presearch"] = seed.memory_presearch.to_dict()
        session["last_delivery_policy"] = seed.delivery_policy.to_dict()
        session["topic_entropy"] = seed.topic_entropy

    if plain_text is not None:
        session["plain_history"].append({
            "user": user_message,
            "assistant": plain_text,
            "ts": datetime.now(timezone.utc).isoformat(),
        })
