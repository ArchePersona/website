"""Text sniffer adapter.

Converts the staged Tier 1-3 text/security sniffer output into the shared
ARCHE Signal contract.
"""
from __future__ import annotations

from typing import Any

from arche.signals import Signal, risk_points_to_weight
from arche.sniffers.text.security import TextSecuritySniffer


class TextSignalAdapter:
    """Run local text sniffers and emit normalized ARCHE signals."""

    def __init__(self) -> None:
        self.sniffer = TextSecuritySniffer()

    def scan_to_signals(self, text: str, source_id: str = "local") -> list[Signal]:
        result = self.sniffer.scan(text)
        return text_scan_to_signals(result, source_id=source_id)


def text_scan_to_signals(result: dict[str, Any], source_id: str = "local") -> list[Signal]:
    signals: list[Signal] = []

    tier_1 = result.get("tier_1") or {}
    for match in tier_1.get("matches") or []:
        signals.append(Signal(
            source_domain="text",
            source_id=source_id,
            signal_type="lexical_security_match",
            weight=risk_points_to_weight(match.get("risk_points", 0)),
            confidence=float(match.get("similarity", 100)) / 100.0,
            evidence=f"{match.get('detected_token')} ≈ {match.get('keyword')}",
            metadata=match,
        ))

    tier_2 = result.get("tier_2") or {}
    for match in tier_2.get("matches") or []:
        signals.append(Signal(
            source_domain="text",
            source_id=source_id,
            signal_type="semantic_security_intent",
            weight=risk_points_to_weight(match.get("risk_points", 0)),
            confidence=float(match.get("similarity", 0.0)),
            evidence=match.get("intent"),
            metadata=match,
        ))

    tier_3 = result.get("tier_3") or {}
    if tier_3.get("entropy_alert"):
        signals.append(Signal(
            source_domain="text",
            source_id=source_id,
            signal_type="low_entropy_loop",
            weight=risk_points_to_weight(30),
            confidence=0.85,
            evidence=f"entropy={tier_3.get('entropy')}",
            metadata=tier_3,
        ))
    if tier_3.get("compression_alert"):
        signals.append(Signal(
            source_domain="text",
            source_id=source_id,
            signal_type="high_compression_repetition",
            weight=risk_points_to_weight(40),
            confidence=0.85,
            evidence=f"compression_ratio={tier_3.get('compression_ratio')}",
            metadata=tier_3,
        ))

    if result.get("total_risk_points", 0) >= 100:
        signals.append(Signal(
            source_domain="text",
            source_id=source_id,
            signal_type="text_lockdown_threshold",
            weight=1.0,
            confidence=1.0,
            evidence="text sniffer risk reached lockdown threshold",
            metadata={"total_risk_points": result.get("total_risk_points"), "status": result.get("status")},
        ))

    return signals
