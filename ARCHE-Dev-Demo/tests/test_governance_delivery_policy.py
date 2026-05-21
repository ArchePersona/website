from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from arche.delivery import build_response_envelope, split_into_beats
from arche.delivery_policy import PacingProfile, build_delivery_policy
from arche.laws import STATIC_LAW_IDS, STATIC_LAWS


def test_static_laws_include_core_boundaries():
    assert "LAW_INTERNAL_PRIVACY" in STATIC_LAW_IDS
    assert "LAW_GOVERNED_DELIVERY" in STATIC_LAW_IDS
    assert "LAW_LOW_COGNITIVE_LOAD" in STATIC_LAW_IDS
    assert len(STATIC_LAWS) >= 6


def test_delivery_policy_changes_for_protective_mode():
    policy = build_delivery_policy(
        state="Guarded",
        zone="mobilized",
        mode="PROTECTIVE",
        agent_signals={"threat": 0.8, "social": 0.2, "reason": 0.4, "reward": 0.1},
    )
    assert policy.pacing_profile == PacingProfile.GENTLE
    assert policy.humor_allowed is False
    assert policy.question_policy.allowed is False
    assert policy.max_words <= 180


def test_delivery_policy_allows_one_question_when_reasoning_without_threat():
    policy = build_delivery_policy(
        state="Focused",
        zone="engaged",
        mode="NORMAL",
        agent_signals={"threat": 0.1, "social": 0.3, "reason": 0.8, "reward": 0.2},
    )
    assert policy.question_policy.allowed is True
    assert policy.question_policy.max_questions == 1
    assert policy.question_policy.question_type == "clarifying"


def test_split_into_beats_uses_human_sized_chunks():
    text = "First sentence. Second sentence that is a little longer. Third sentence lands cleanly."
    beats = split_into_beats(text, max_chars=35)
    assert len(beats) >= 2
    assert all(len(beat) <= 45 for beat in beats)


def test_response_envelope_uses_policy_pacing():
    policy = build_delivery_policy(
        state="Warm",
        zone="engaged",
        mode="RELATIONAL",
        agent_signals={"threat": 0.1, "social": 0.8, "reason": 0.2, "reward": 0.7},
    )
    envelope = build_response_envelope("One thought. Another thought.", policy)
    assert envelope is not None
    assert envelope.pacing_profile == policy.pacing_profile.value
    assert envelope.beat_pause_ms == policy.beat_pause_ms
    assert envelope.beats
