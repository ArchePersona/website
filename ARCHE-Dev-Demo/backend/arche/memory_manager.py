"""ARCHE Memory Manager.

The Recall agent detects memory relevance. The Memory Manager owns memory work:
presearch, candidate preparation, later fetch, compression, movement, and archive.

This first pass adds a deterministic presearch buffer for the active turn.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


_RECALL_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z'\-]{3,}")

_RECALL_STOPWORDS = {
    "about", "after", "again", "also", "because", "before", "could", "every",
    "from", "have", "here", "just", "like", "more", "need", "never", "only",
    "really", "should", "something", "still", "that", "their", "them", "then",
    "there", "these", "thing", "things", "this", "those", "want", "what", "when",
    "where", "which", "with", "would", "your",
}

_RECALL_CUES = {
    "remember", "recall", "earlier", "before", "previously", "yesterday",
    "last", "again", "talked", "discussed", "said", "told",
}


@dataclass(slots=True)
class MemoryCandidate:
    source: str
    text: str
    score: float
    reason: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "text": self.text,
            "score": round(self.score, 3),
            "reason": self.reason,
            "metadata": self.metadata,
        }


@dataclass(slots=True)
class PresearchBuffer:
    triggered: bool
    recall_strength: float
    query_terms: list[str]
    candidates: list[MemoryCandidate]
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "triggered": self.triggered,
            "recall_strength": round(self.recall_strength, 3),
            "query_terms": self.query_terms,
            "candidates": [candidate.to_dict() for candidate in self.candidates],
            "timestamp": self.timestamp,
        }


class MemoryManager:
    """Owns memory preparation for the active turn."""

    def prepare_presearch(
        self,
        *,
        message: str,
        recall_strength: float,
        session: dict,
        external_memories: list[str] | None = None,
        max_candidates: int = 5,
    ) -> PresearchBuffer:
        query_terms = extract_recall_terms(message)
        triggered = should_presearch(message=message, recall_strength=recall_strength, query_terms=query_terms)
        if not triggered:
            return PresearchBuffer(False, recall_strength, query_terms, [])

        candidates: list[MemoryCandidate] = []
        candidates.extend(_session_history_candidates(query_terms, session.get("rk_history", [])))
        candidates.extend(_topic_entropy_candidates(query_terms, session.get("topic_entropy", {}) or {}))
        candidates.extend(_external_memory_candidates(query_terms, external_memories or []))

        ranked = sorted(candidates, key=lambda candidate: candidate.score, reverse=True)[:max_candidates]
        return PresearchBuffer(True, recall_strength, query_terms, ranked)


def extract_recall_terms(text: str) -> list[str]:
    seen: set[str] = set()
    terms: list[str] = []
    for match in _RECALL_TOKEN_RE.finditer(text or ""):
        token = match.group(0).lower().strip("'").rstrip("'s")
        if len(token) < 4 or token in _RECALL_STOPWORDS:
            continue
        if token in seen:
            continue
        seen.add(token)
        terms.append(token)
    return terms[:12]


def should_presearch(*, message: str, recall_strength: float, query_terms: list[str]) -> bool:
    lowered = (message or "").lower()
    cue_hit = any(cue in lowered for cue in _RECALL_CUES)
    return recall_strength >= 0.42 or cue_hit or len(query_terms) >= 3


def _session_history_candidates(query_terms: list[str], history: list[dict]) -> list[MemoryCandidate]:
    candidates: list[MemoryCandidate] = []
    term_set = set(query_terms)
    if not term_set:
        return candidates

    for idx, turn in enumerate(reversed(history[-20:])):
        text = " ".join([str(turn.get("user", "")), str(turn.get("assistant", ""))]).strip()
        if not text:
            continue
        score = _overlap_score(term_set, text)
        if score <= 0:
            continue
        candidates.append(MemoryCandidate(
            source="active_cache",
            text=text[:240],
            score=score,
            reason="query terms overlapped recent turn cache",
            metadata={"reverse_index": idx},
        ))
    return candidates


def _topic_entropy_candidates(query_terms: list[str], entropy: dict) -> list[MemoryCandidate]:
    candidates: list[MemoryCandidate] = []
    for term in query_terms:
        entry = entropy.get(term)
        if entry is None:
            continue
        weight = float(entry if isinstance(entry, (int, float)) else entry.get("w", 0.0))
        if weight <= 0:
            continue
        candidates.append(MemoryCandidate(
            source="working_memory",
            text=term,
            score=min(1.0, weight / 5.0),
            reason="term is already weighted in working memory",
            metadata={"weight": weight},
        ))
    return candidates


def _external_memory_candidates(query_terms: list[str], memories: list[str]) -> list[MemoryCandidate]:
    candidates: list[MemoryCandidate] = []
    term_set = set(query_terms)
    if not term_set:
        return candidates
    for idx, memory in enumerate(memories):
        score = _overlap_score(term_set, memory)
        if score <= 0:
            continue
        candidates.append(MemoryCandidate(
            source="long_term_memory",
            text=memory[:240],
            score=score,
            reason="query terms overlapped durable memory",
            metadata={"index": idx},
        ))
    return candidates


def _overlap_score(term_set: set[str], text: str) -> float:
    lowered = (text or "").lower()
    hits = sum(1 for term in term_set if term in lowered)
    if hits == 0:
        return 0.0
    return min(1.0, hits / max(3, len(term_set)))
