"""Brunel-local Memory Organ bridge.

MemoryOrgan owns memory retrieval, working-memory synopsis construction, topic
entropy update, and fact learning. Server should orchestrate memory, not know
how memory is fetched, summarized, or written.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any
from uuid import uuid4

from rk_engine import build_working_memory_synopsis, extract_facts, update_topic_entropy
from supabase_helper import categorize_fact, fetch_recent_memories, insert_memory, supabase_configured
from time_pressure import apply_time_decay_to_topic_entropy


@dataclass(slots=True)
class MemoryPacket:
    packet_id: str = field(default_factory=lambda: str(uuid4()))
    facts: list[str] = field(default_factory=list)
    recent_memories: list[dict[str, Any]] = field(default_factory=list)
    topic_entropy: dict[str, Any] = field(default_factory=dict)
    working_memory: str = ""
    new_fact_candidates: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class MemoryOrgan:
    """Evaluates and learns Brunel memory context."""

    def evaluate(
        self,
        *,
        session: dict[str, Any],
        user_id: str,
        user_jwt: str,
        message: str,
        pressure: dict[str, Any],
        signals: dict[str, Any],
    ) -> MemoryPacket:
        recent_memories = fetch_recent_memories(user_jwt=user_jwt, user_id=user_id) if supabase_configured() else []
        facts = [m.get("memory_text", "") for m in recent_memories if m.get("memory_text")]
        raw_topic_entropy = update_topic_entropy(session.get("topic_entropy", {}) or {}, message, agents=signals)
        topic_entropy = apply_time_decay_to_topic_entropy(raw_topic_entropy, pressure)
        working_memory = build_working_memory_synopsis(topic_entropy)
        new_fact_candidates = extract_facts(message)
        return MemoryPacket(
            facts=facts,
            recent_memories=recent_memories,
            topic_entropy=topic_entropy,
            working_memory=working_memory,
            new_fact_candidates=new_fact_candidates,
            metadata={"source": "MemoryOrgan", "organ_version": "0.1.0", "supabase_configured": supabase_configured()},
        )

    def learn(self, *, user_id: str, user_jwt: str, packet: MemoryPacket) -> None:
        if not supabase_configured():
            return
        existing_texts = {m.get("memory_text") for m in packet.recent_memories}
        for fact in packet.new_fact_candidates:
            if fact in existing_texts:
                continue
            insert_memory(user_jwt=user_jwt, user_id=user_id, memory_text=fact, category=categorize_fact(fact))
