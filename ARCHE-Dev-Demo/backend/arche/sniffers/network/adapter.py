"""Network sniffer adapter.

This module is the bridge between packet/network events and the shared ARCHE
Signal contract. It intentionally does not run packet capture itself. Capture
belongs to distributed sensor nodes; this adapter normalizes the event for the
ARCHE analysis/Core layers.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from arche.signals import Signal, risk_points_to_weight


@dataclass(slots=True)
class NetworkEvent:
    """Metadata emitted by a local or distributed network sensor.

    Raw packets should not cross this boundary. Sensors should send metadata
    that is useful for anomaly analysis without dragging payload or secrets
    into the Core unnecessarily.
    """

    src: str
    dst: str
    protocol: str = "tcp"
    port: int | None = None
    sensor_id: str = "local"
    timestamp: str | None = None
    payload_excerpt: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "NetworkEvent":
        return cls(
            src=str(data.get("src") or data.get("source") or "unknown"),
            dst=str(data.get("dst") or data.get("dest") or data.get("destination") or "unknown"),
            protocol=str(data.get("proto") or data.get("protocol") or "tcp"),
            port=data.get("port"),
            sensor_id=str(data.get("sensor_id") or data.get("origin") or "local"),
            timestamp=data.get("timestamp"),
            payload_excerpt=data.get("payload_excerpt"),
            metadata={k: v for k, v in data.items() if k not in {
                "src", "source", "dst", "dest", "destination", "proto", "protocol",
                "port", "sensor_id", "origin", "timestamp", "payload_excerpt",
            }},
        )


def network_event_to_signals(event: NetworkEvent, graph_result: dict[str, Any]) -> list[Signal]:
    """Convert a Tier-4/network scan result into normalized ARCHE signals.

    Expected graph_result shape is compatible with the uploaded standalone
    ARCHE sniffer package: anomalies, total_risk_points or risk_points, alert.
    """
    risk_points = graph_result.get("total_risk_points", graph_result.get("risk_points", 0)) or 0
    anomalies = graph_result.get("anomalies") or []
    alert = bool(graph_result.get("alert") or anomalies or risk_points)

    signals: list[Signal] = []

    if alert:
        signals.append(Signal(
            source_domain="network",
            source_id=event.sensor_id,
            signal_type="network_anomaly",
            weight=risk_points_to_weight(risk_points),
            confidence=1.0,
            evidence=f"{event.src} -> {event.dst}:{event.port or ''} {event.protocol}".strip(),
            metadata={
                "src": event.src,
                "dst": event.dst,
                "protocol": event.protocol,
                "port": event.port,
                "risk_points": risk_points,
                "anomalies": anomalies,
                "timestamp": event.timestamp,
            },
        ))

    for anomaly in anomalies:
        text = str(anomaly)
        signal_type = "network_rupture" if "rupture" in text.lower() else "network_anomaly"
        signals.append(Signal(
            source_domain="network",
            source_id=event.sensor_id,
            signal_type=signal_type,
            weight=risk_points_to_weight(risk_points or 50),
            confidence=0.9,
            evidence=text,
            metadata={
                "src": event.src,
                "dst": event.dst,
                "protocol": event.protocol,
                "port": event.port,
            },
        ))

    return signals
