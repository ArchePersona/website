"""
ArchePersona RK 2 Demo — Backend pytest suite.

Covers:
  * GET /api/  — root info
  * POST /api/chat — rk_only / plain_only / both
  * Validation 400s
  * Memory persistence (RK remembers, plain does not)
  * State emergence (hostile, warm)
  * Reset wipes session
  * Session hydration endpoint
"""
from __future__ import annotations

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback to frontend .env if not exported in env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip()
                    break
    except FileNotFoundError:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

# Each Claude pair call can take ~30s; give plenty of headroom.
TIMEOUT = 90


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _new_session() -> str:
    return f"TEST_{uuid.uuid4().hex[:12]}"


# ---------------------------------------------------------------------------
# Module: root
# ---------------------------------------------------------------------------
class TestRoot:
    def test_root_returns_app_info(self, client):
        r = client.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("app") == "BRUNEL"
        assert data.get("tagline") == "Powered by ARCHE"
        assert "model" in data and isinstance(data["model"], str)
        assert "claude" in data["model"].lower()


# ---------------------------------------------------------------------------
# Module: validation
# ---------------------------------------------------------------------------
class TestValidation:
    def test_empty_message_returns_400(self, client):
        r = client.post(
            f"{API}/chat",
            json={"session_id": _new_session(), "message": "   ", "target": "rk_only"},
            timeout=30,
        )
        assert r.status_code == 400

    def test_invalid_target_returns_400(self, client):
        r = client.post(
            f"{API}/chat",
            json={"session_id": _new_session(), "message": "hi", "target": "bogus"},
            timeout=30,
        )
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Module: targeted chat (rk_only / plain_only / both)
# ---------------------------------------------------------------------------
class TestTargets:
    def test_rk_only_returns_only_rk(self, client):
        sid = _new_session()
        r = client.post(
            f"{API}/chat",
            json={"session_id": sid, "message": "hello there", "target": "rk_only"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["plain_response"] is None
        assert isinstance(d["rk_response"], str) and d["rk_response"].strip()
        for k in ("state", "zone", "mode", "flags", "weights", "directive"):
            assert k in d
        assert isinstance(d["weights"], dict)
        assert set(d["weights"].keys()) >= {
            "perception", "memory", "reason", "threat", "social", "reward"
        }

    def test_plain_only_returns_only_plain_and_does_not_affect_rk(self, client):
        sid = _new_session()
        # snapshot baseline
        s0 = client.get(f"{API}/session/{sid}", timeout=15).json()
        baseline_signals = s0["weights"]
        baseline_turn = s0["turn_count"]

        r = client.post(
            f"{API}/chat",
            json={"session_id": sid, "message": "tell me a joke", "target": "plain_only"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["rk_response"] is None
        assert isinstance(d["plain_response"], str) and d["plain_response"].strip()

        s1 = client.get(f"{API}/session/{sid}", timeout=15).json()
        assert s1["turn_count"] == baseline_turn  # unchanged
        assert s1["weights"] == baseline_signals  # signals not perturbed

    def test_both_returns_both(self, client):
        sid = _new_session()
        r = client.post(
            f"{API}/chat",
            json={"session_id": sid, "message": "good morning", "target": "both"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["rk_response"], str) and d["rk_response"].strip()
        assert isinstance(d["plain_response"], str) and d["plain_response"].strip()


# ---------------------------------------------------------------------------
# Module: memory persistence — RK remembers, plain does not
# ---------------------------------------------------------------------------
class TestMemory:
    def test_rk_remembers_plain_does_not(self, client):
        sid = _new_session()
        prime = client.post(
            f"{API}/chat",
            json={
                "session_id": sid,
                "message": "my name is Alice and I work as a marine biologist",
                "target": "rk_only",
            },
            timeout=TIMEOUT,
        )
        assert prime.status_code == 200, prime.text

        ask = client.post(
            f"{API}/chat",
            json={
                "session_id": sid,
                "message": "what do you know about me?",
                "target": "both",
            },
            timeout=TIMEOUT,
        )
        assert ask.status_code == 200, ask.text
        d = ask.json()
        rk = (d["rk_response"] or "").lower()
        plain = (d["plain_response"] or "").lower()

        assert "alice" in rk, f"RK did not recall name: {rk!r}"
        assert ("marine" in rk) or ("biolog" in rk), f"RK did not recall job: {rk!r}"

        # Plain LLM is stateless — it should not invent these facts.
        assert "alice" not in plain
        assert "marine biolog" not in plain


# ---------------------------------------------------------------------------
# Module: state emergence
# ---------------------------------------------------------------------------
class TestStateEmergence:
    def test_hostile_message_shifts_to_mobilized(self, client):
        sid = _new_session()
        r = client.post(
            f"{API}/chat",
            json={
                "session_id": sid,
                "message": "you're stupid and useless",
                "target": "rk_only",
            },
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["zone"] == "mobilized", d
        assert d["state"] in ("Guarded", "Avoidant", "Stuck"), d
        assert "HOSTILITY" in d["flags"], d["flags"]

    def test_warm_message_shifts_to_engaged_warm(self, client):
        sid = _new_session()
        r = client.post(
            f"{API}/chat",
            json={
                "session_id": sid,
                "message": "thank you so much, this means a lot to me",
                "target": "rk_only",
            },
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["zone"] == "engaged", d
        assert d["state"] == "Warm", d
        assert d["mode"] == "RELATIONAL", d
        assert "WARMTH" in d["flags"], d["flags"]


# ---------------------------------------------------------------------------
# Module: reset & session hydration
# ---------------------------------------------------------------------------
class TestSessionLifecycle:
    def test_session_hydration_shape(self, client):
        sid = _new_session()
        r = client.get(f"{API}/session/{sid}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("turn_count", "state", "zone", "mode", "weights", "flags",
                  "rk_history", "plain_history"):
            assert k in d, f"missing key {k}"
        assert d["turn_count"] == 0
        assert isinstance(d["rk_history"], list)
        assert isinstance(d["plain_history"], list)
        # baseline ~0.3
        for v in d["weights"].values():
            assert abs(v - 0.30) < 1e-6

    def test_reset_wipes_session(self, client):
        sid = _new_session()
        # populate
        r = client.post(
            f"{API}/chat",
            json={"session_id": sid, "message": "my name is Bob", "target": "rk_only"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        s_before = client.get(f"{API}/session/{sid}", timeout=15).json()
        assert s_before["turn_count"] >= 1

        # reset
        rr = client.post(f"{API}/reset", json={"session_id": sid}, timeout=15)
        assert rr.status_code == 200
        assert rr.json().get("ok") is True

        s_after = client.get(f"{API}/session/{sid}", timeout=15).json()
        assert s_after["turn_count"] == 0
        for v in s_after["weights"].values():
            assert abs(v - 0.30) < 1e-6
        assert s_after["rk_history"] == []
        assert s_after["plain_history"] == []


# ---------------------------------------------------------------------------
# Cleanup — best effort
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def _cleanup_test_sessions():
    yield
    # We don't have a list endpoint; cleanup is best-effort via per-test sids.
