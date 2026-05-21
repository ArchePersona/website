from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from arche.core import generate_response_seed, normalize_recall_signals
from arche.memory_manager import MemoryManager, extract_recall_terms
from rk_engine import default_signals


def test_normalize_recall_signals_migrates_legacy_memory_key():
    signals = normalize_recall_signals({"memory": 0.8, "reason": 0.2})
    assert signals["recall"] == 0.8
    assert "memory" not in signals


def test_memory_manager_presearch_triggers_on_recall_cue():
    session = {
        "rk_history": [
            {"user": "We talked about the packet broker yesterday.", "assistant": "Yes, the broker shapes micro-events."}
        ],
        "topic_entropy": {"broker": {"w": 3.0}},
    }
    buffer = MemoryManager().prepare_presearch(
        message="remember the packet broker thing from yesterday?",
        recall_strength=0.3,
        session=session,
        external_memories=["The packet broker creates behavior packets from typing pauses."],
    )
    assert buffer.triggered is True
    assert "remember" in extract_recall_terms("remember the packet broker thing")
    assert buffer.candidates
    assert any(candidate.source in {"active_cache", "working_memory", "long_term_memory"} for candidate in buffer.candidates)


def test_core_seed_includes_memory_presearch():
    session = {
        "rk_history": [
            {"user": "We discussed Recall Agent and Memory Manager.", "assistant": "Recall detects; Memory Manager fetches."}
        ],
        "signals": default_signals(),
        "topic_entropy": {"recall": {"w": 2.5}, "memory": {"w": 2.0}},
    }
    seed = generate_response_seed(
        message="do you remember the recall agent setup?",
        session=session,
        memory_strings=["Recall Agent flags potential; Memory Manager prepares presearch."],
        valid_states={"Warm", "Curious", "Focused", "Guarded", "Avoidant", "Stuck", "Retreating", "Gentle", "Shutdown"},
        valid_modes={"NORMAL", "RELATIONAL", "EXPLORATORY", "CLINICAL", "PROTECTIVE"},
    )
    assert "recall" in seed.agent_signals
    assert "memory" not in seed.agent_signals
    assert seed.memory_presearch.triggered is True
    assert seed.memory_presearch.candidates
