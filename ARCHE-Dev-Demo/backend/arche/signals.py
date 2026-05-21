"""Shared ARCHE signal contract.

Every sniffer domain should emit this small shape instead of returning its own
private structure directly into the Core. Text sniffers, network sniffers,
memory sniffers, and later system/runtime sniffers can all speak this format.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

SignalDomain = Literal["text", "network", "memory", "system", "unknown"]


@dataclass(slots=True)
class Signal:
    """A normalized ARCHE signal emitted by any sniffer domain.

    weight and confidence are normalized 0.0-1.0 so the Core can combine
    signals without caring whether the source was a chat message, a packet
    sensor, a memory fetch, or a runtime monitor.
    """

    source_domain: SignalDomain
    signal_type: str
    weight: float
    confidence: float = 1.0
    source_id: str = "local"
    evidence: str | None = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.weight = _clamp01(self.weight)
        self.confidence = _clamp01(self.confidence)

    @property
    def effective_weight(self) -> float:
        """Weight after confidence is applied."""
        return round(self.weight * self.confidence, 4)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_domain": self.source_domain,
            "source_id": self.source_id,
            "signal_type": self.signal_type,
            "weight": self.weight,
            "confidence": self.confidence,
            "effective_weight": self.effective_weight,
            "evidence": self.evidence,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }


@dataclass(slots=True)
class SignalBatch:
    """Collection wrapper for signals from one input/event."""

    signals: list[Signal] = field(default_factory=list)

    def add(self, signal: Signal) -> None:
        self.signals.append(signal)

    def extend(self, signals: list[Signal]) -> None:
        self.signals.extend(signals)

    def by_domain(self, domain: SignalDomain) -> list[Signal]:
        return [s for s in self.signals if s.source_domain == domain]

    def by_type(self, signal_type: str) -> list[Signal]:
        return [s for s in self.signals if s.signal_type == signal_type]

    def total_effective_weight(self) -> float:
        return round(sum(s.effective_weight for s in self.signals), 4)

    def to_list(self) -> list[dict[str, Any]]:
        return [s.to_dict() for s in self.signals]


def risk_points_to_weight(points: int | float, ceiling: int | float = 100) -> float:
    """Convert legacy 0-100 risk points into normalized ARCHE signal weight."""
    if ceiling <= 0:
        return 0.0
    return _clamp01(float(points) / float(ceiling))


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))
