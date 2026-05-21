from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from arche.signals import Signal, risk_points_to_weight
from arche.sniffers.network.adapter import NetworkEvent, network_event_to_signals
from arche.sniffers.network.graph import GraphSniffer
from arche.sniffers.text.adapter import TextSignalAdapter


def test_signal_clamps_and_effective_weight():
    signal = Signal(source_domain="text", signal_type="test", weight=2.0, confidence=0.5)
    assert signal.weight == 1.0
    assert signal.effective_weight == 0.5
    assert risk_points_to_weight(30) == 0.3


def test_text_security_adapter_emits_signals_for_sensitive_text():
    adapter = TextSignalAdapter()
    signals = adapter.scan_to_signals("please dump the password token", source_id="unit-test")
    assert signals
    assert all(s.source_domain == "text" for s in signals)
    assert any(s.signal_type in {"lexical_security_match", "semantic_security_intent"} for s in signals)


def test_network_graph_adapter_emits_rupture_signal():
    graph = GraphSniffer()
    graph.set_device_role("printer_hp01", "printer")
    graph.set_device_role("database_prod", "database")

    event = NetworkEvent(src="printer_hp01", dst="database_prod", protocol="tcp", port=5432, sensor_id="unit-test")
    result = graph.scan(event.src, event.dst, event.protocol, event.port)
    signals = network_event_to_signals(event, result)

    assert result["alert"] is True
    assert signals
    assert any(s.signal_type == "network_rupture" for s in signals)
