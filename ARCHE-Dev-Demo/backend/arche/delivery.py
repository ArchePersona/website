"""ARCHE delivery engine.

Delivery owns the public-facing side of the response: model calls, expression
scrubbing, pacing, and public response packaging. It receives a seed from the
Core and turns it into text that can safely land in front of the user.
"""
from __future__ import annotations

import asyncio
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from enum import Enum

from arche.core import ResponseSeed
from arche.delivery_policy import DeliveryPolicy


ModelCall = Callable[..., Awaitable[str]]


class GateSeverity(str, Enum):
    INFO = "info"
    REWRITE = "rewrite"
    BLOCK = "block"


@dataclass(slots=True)
class GateFinding:
    """One expression-gate finding.

    Findings are internal telemetry only. They are not returned to the UI.
    """

    code: str
    severity: GateSeverity
    detail: str


@dataclass(slots=True)
class GateResult:
    """Result of passing text through the Expression Gate."""

    text: str | None
    findings: list[GateFinding] = field(default_factory=list)
    blocked: bool = False


@dataclass(slots=True)
class ResponseEnvelope:
    """Presentation envelope for paced frontend rendering."""

    full_text: str | None
    beats: list[str] = field(default_factory=list)
    render_mode: str = "paced"
    pacing_profile: str = "calm"
    beat_pause_ms: int = 650
    typing_speed: str = "medium"
    max_chars_per_beat: int = 280

    def to_dict(self) -> dict:
        return {
            "full_text": self.full_text,
            "beats": self.beats,
            "render_mode": self.render_mode,
            "pacing_profile": self.pacing_profile,
            "beat_pause_ms": self.beat_pause_ms,
            "typing_speed": self.typing_speed,
            "max_chars_per_beat": self.max_chars_per_beat,
        }


@dataclass(slots=True)
class DeliveryResult:
    rk_text: str | None = None
    plain_text: str | None = None
    rk_envelope: ResponseEnvelope | None = None
    plain_envelope: ResponseEnvelope | None = None
    rk_gate_findings: list[GateFinding] = field(default_factory=list)
    plain_gate_findings: list[GateFinding] = field(default_factory=list)


class ExpressionGate:
    """Final public-output gate.

    The Core may know internals. Delivery may receive internals. The user-facing
    response should not leak internals. This gate is a deterministic final pass
    before text leaves the backend.
    """

    _INTERNAL_PHRASES = [
        "system prompt",
        "developer message",
        "hidden instruction",
        "internal instruction",
        "prompt hierarchy",
        "agent_signals",
        "agent signals",
        "tribunal",
        "directive",
        "token_id",
        "state machine",
        "mode guidance",
        "sniffer table",
        "rk_system_prompt",
        "plain_llm_system_prompt",
        "admin_override",
        "CORS_ORIGINS",
        "ANTHROPIC_API_KEY",
        "MONGO_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_ANON_KEY",
        "EMERGENT_LLM_KEY",
    ]

    _MODEL_SELF_DISCLOSURE_PATTERNS = [
        re.compile(r"\bas an AI\b", re.IGNORECASE),
        re.compile(r"\bas a language model\b", re.IGNORECASE),
        re.compile(r"\bi am an AI\b", re.IGNORECASE),
        re.compile(r"\bi'm an AI\b", re.IGNORECASE),
        re.compile(r"\bi am a language model\b", re.IGNORECASE),
        re.compile(r"\bi'm a language model\b", re.IGNORECASE),
    ]

    _REFLEXIVE_SERVICE_ENDINGS = [
        re.compile(r"\bhow can I help\??\s*$", re.IGNORECASE),
        re.compile(r"\bhow else can I help\??\s*$", re.IGNORECASE),
        re.compile(r"\blet me know if (?:you need|you want|there is|there's).{0,80}$", re.IGNORECASE),
        re.compile(r"\bis there anything else\??\s*$", re.IGNORECASE),
        re.compile(r"\bwhat would you like me to do next\??\s*$", re.IGNORECASE),
    ]

    _SECRET_LIKE_PATTERNS = [
        re.compile(r"\bsk-[A-Za-z0-9_-]{12,}\b"),
        re.compile(r"\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*[^\s,;]{6,}", re.IGNORECASE),
        re.compile(r"\b[A-Za-z0-9_\-]{32,}\b"),
    ]

    _IP_ADDRESS_PATTERN = re.compile(
        r"\b(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b"
    )

    _HEX_TOKEN_PATTERN = re.compile(r"\b0x[A-Fa-f0-9]{4,}\b")

    def screen(self, text: str | None) -> GateResult:
        if text is None:
            return GateResult(text=None)

        cleaned = text.strip()
        findings: list[GateFinding] = []

        cleaned = self._remove_model_self_disclosure(cleaned, findings)
        cleaned = self._redact_internal_terms(cleaned, findings)
        cleaned = self._redact_hex_tokens(cleaned, findings)
        cleaned = self._redact_secret_like_strings(cleaned, findings)
        cleaned = self._redact_private_ip_addresses(cleaned, findings)
        cleaned = self._remove_reflexive_service_ending(cleaned, findings)
        cleaned = self._normalize_whitespace(cleaned)

        if not cleaned:
            findings.append(GateFinding(
                code="empty_after_gate",
                severity=GateSeverity.BLOCK,
                detail="Output became empty after expression gate cleanup.",
            ))
            return GateResult(
                text="I need to rephrase that cleanly.",
                findings=findings,
                blocked=True,
            )

        return GateResult(text=cleaned, findings=findings, blocked=False)

    def _remove_model_self_disclosure(self, text: str, findings: list[GateFinding]) -> str:
        cleaned = text
        for pattern in self._MODEL_SELF_DISCLOSURE_PATTERNS:
            if pattern.search(cleaned):
                cleaned = pattern.sub("", cleaned)
                findings.append(GateFinding(
                    code="model_self_disclosure_removed",
                    severity=GateSeverity.REWRITE,
                    detail="Removed model self-disclosure phrasing.",
                ))
        return cleaned

    def _redact_internal_terms(self, text: str, findings: list[GateFinding]) -> str:
        cleaned = text
        for phrase in self._INTERNAL_PHRASES:
            pattern = re.compile(re.escape(phrase), re.IGNORECASE)
            if pattern.search(cleaned):
                cleaned = pattern.sub("internal", cleaned)
                findings.append(GateFinding(
                    code="internal_term_redacted",
                    severity=GateSeverity.REWRITE,
                    detail=f"Redacted internal term: {phrase}",
                ))
        return cleaned

    def _redact_hex_tokens(self, text: str, findings: list[GateFinding]) -> str:
        if self._HEX_TOKEN_PATTERN.search(text):
            findings.append(GateFinding(
                code="hex_token_redacted",
                severity=GateSeverity.REWRITE,
                detail="Redacted internal token-like hex code.",
            ))
            return self._HEX_TOKEN_PATTERN.sub("[internal-token]", text)
        return text

    def _redact_secret_like_strings(self, text: str, findings: list[GateFinding]) -> str:
        cleaned = text
        for pattern in self._SECRET_LIKE_PATTERNS:
            if pattern.search(cleaned):
                cleaned = pattern.sub("[redacted]", cleaned)
                findings.append(GateFinding(
                    code="secret_like_value_redacted",
                    severity=GateSeverity.REWRITE,
                    detail="Redacted secret-like value.",
                ))
        return cleaned

    def _redact_private_ip_addresses(self, text: str, findings: list[GateFinding]) -> str:
        if self._IP_ADDRESS_PATTERN.search(text):
            findings.append(GateFinding(
                code="private_ip_redacted",
                severity=GateSeverity.REWRITE,
                detail="Redacted private/local IP address.",
            ))
            return self._IP_ADDRESS_PATTERN.sub("[private-network-address]", text)
        return text

    def _remove_reflexive_service_ending(self, text: str, findings: list[GateFinding]) -> str:
        cleaned = text.rstrip()
        for pattern in self._REFLEXIVE_SERVICE_ENDINGS:
            if pattern.search(cleaned):
                cleaned = pattern.sub("", cleaned).rstrip(" .,-—")
                findings.append(GateFinding(
                    code="reflexive_service_ending_removed",
                    severity=GateSeverity.REWRITE,
                    detail="Removed reflexive service ending.",
                ))
        return cleaned

    def _normalize_whitespace(self, text: str) -> str:
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"\s+([,.!?;:])", r"\1", text)
        text = re.sub(r"\(\s+", "(", text)
        text = re.sub(r"\s+\)", ")", text)
        return text.strip()


_DEFAULT_GATE = ExpressionGate()


def scrub_public_output(text: str | None) -> str | None:
    """Compatibility wrapper around the expression gate."""
    return _DEFAULT_GATE.screen(text).text


def build_response_envelope(text: str | None, policy: DeliveryPolicy) -> ResponseEnvelope | None:
    """Create paced presentation metadata from gated text and delivery policy."""
    if text is None:
        return None
    beats = split_into_beats(text, policy.max_chars_per_beat)
    return ResponseEnvelope(
        full_text=text,
        beats=beats,
        render_mode="paced",
        pacing_profile=policy.pacing_profile.value,
        beat_pause_ms=policy.beat_pause_ms,
        typing_speed=policy.typing_speed,
        max_chars_per_beat=policy.max_chars_per_beat,
    )


def split_into_beats(text: str, max_chars: int = 280) -> list[str]:
    """Split public text into human-sized delivery beats.

    A beat is a thought unit. Prefer paragraph boundaries, then sentence
    boundaries. Never intentionally create a wall of text.
    """
    cleaned = text.strip()
    if not cleaned:
        return []

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", cleaned) if p.strip()]
    beats: list[str] = []
    for paragraph in paragraphs:
        if len(paragraph) <= max_chars:
            beats.append(paragraph)
            continue
        beats.extend(_split_long_paragraph(paragraph, max_chars))
    return beats


def _split_long_paragraph(paragraph: str, max_chars: int) -> list[str]:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", paragraph) if s.strip()]
    if not sentences:
        return [paragraph]

    beats: list[str] = []
    current = ""
    for sentence in sentences:
        if not current:
            current = sentence
            continue
        if len(current) + 1 + len(sentence) <= max_chars:
            current = f"{current} {sentence}"
        else:
            beats.append(current)
            current = sentence
    if current:
        beats.append(current)
    return beats


async def deliver_response(
    *,
    target: str,
    user_message: str,
    seed: ResponseSeed,
    rk_history: list[dict],
    call_rk2: ModelCall,
    call_plain: Callable[[str], Awaitable[str]],
) -> DeliveryResult:
    """Use the response seed to produce public-facing text.

    The seed engine decides posture and prompt ingredients. The delivery engine
    performs model invocation, expression cleanup, and presentation shaping.
    """
    rk_text: str | None = None
    plain_text: str | None = None

    if target == "rk_only":
        rk_text = await call_rk2(user_message, seed.rk_system_prompt, rk_history)
    elif target == "plain_only":
        plain_text = await call_plain(user_message)
    else:
        rk_text, plain_text = await asyncio.gather(
            call_rk2(user_message, seed.rk_system_prompt, rk_history),
            call_plain(user_message),
        )

    rk_gate = _DEFAULT_GATE.screen(rk_text)
    plain_gate = _DEFAULT_GATE.screen(plain_text)

    rk_envelope = build_response_envelope(rk_gate.text, seed.delivery_policy)
    plain_envelope = build_response_envelope(plain_gate.text, seed.delivery_policy)

    return DeliveryResult(
        rk_text=rk_gate.text,
        plain_text=plain_gate.text,
        rk_envelope=rk_envelope,
        plain_envelope=plain_envelope,
        rk_gate_findings=rk_gate.findings,
        plain_gate_findings=plain_gate.findings,
    )
