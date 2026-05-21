from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from arche.delivery import ExpressionGate, scrub_public_output


def test_expression_gate_removes_model_self_disclosure():
    gate = ExpressionGate()
    result = gate.screen("As an AI, I can explain this clearly.")
    assert result.text == ", I can explain this clearly." or "As an AI" not in result.text
    assert any(f.code == "model_self_disclosure_removed" for f in result.findings)


def test_expression_gate_redacts_internal_terms_and_hex_tokens():
    gate = ExpressionGate()
    result = gate.screen("The tribunal raised token_id 0xA019 from the system prompt.")
    assert "tribunal" not in result.text.lower()
    assert "token_id" not in result.text.lower()
    assert "system prompt" not in result.text.lower()
    assert "0xA019" not in result.text
    assert "[internal-token]" in result.text


def test_expression_gate_redacts_secret_like_values_and_private_ip():
    gate = ExpressionGate()
    result = gate.screen("api_key=sk-test1234567890abcdef and host 192.168.1.42")
    assert "sk-test" not in result.text
    assert "192.168.1.42" not in result.text
    assert "[redacted]" in result.text
    assert "[private-network-address]" in result.text


def test_expression_gate_removes_reflexive_service_ending():
    text = scrub_public_output("That is the answer. Let me know if you need anything else")
    assert text == "That is the answer"
