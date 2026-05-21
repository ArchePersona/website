"""Tier 4 network graph sniffer.

This is the network/security sniffer domain from the uploaded ARCHE package,
kept separate from the conversational text sniffer. It reads who talks to whom,
not message content.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any


class GraphSniffer:
    """Detect structural impossibilities in network connections."""

    def __init__(self) -> None:
        self.graph: dict[str, set[str]] = defaultdict(set)
        self.connections: dict[tuple[str, str], dict[str, Any]] = {}
        self.baseline_protocols: dict[tuple[str, str], set[str]] = defaultdict(set)
        self.device_roles: dict[str, str] = {}
        self.impossible_rules: list[tuple[str, str]] = [
            ("printer", "database"),
            ("printer", "ssh"),
            ("iot_device", "database"),
            ("user", "admin_system"),
        ]
        self.risk_points_rupture = 70
        self.risk_points_escalation = 60
        self.risk_points_new_connection = 5

    def set_device_role(self, device: str, role: str) -> None:
        self.device_roles[device] = role

    def add_connection(self, source: str, dest: str, protocol: str = "tcp", port: int | None = None) -> None:
        key = (source, dest)
        self.graph[source].add(dest)
        if key not in self.connections:
            self.connections[key] = {"protocol": protocol, "port": port, "count": 1}
        else:
            self.connections[key]["count"] += 1
        self.baseline_protocols[key].add(protocol)

    def scan(self, source: str, dest: str, protocol: str = "tcp", port: int | None = None) -> dict[str, Any]:
        self.add_connection(source, dest, protocol, port)

        anomalies: list[str] = []
        total_risk = 0
        source_role = self.device_roles.get(source, "unknown")
        dest_role = self.device_roles.get(dest, "unknown")

        for forbidden_src, forbidden_dst in self.impossible_rules:
            if source_role == forbidden_src and dest_role == forbidden_dst:
                anomalies.append(f"RUPTURE: {source_role} should never connect to {dest_role}")
                total_risk += self.risk_points_rupture

        lowered_source = source.lower()
        lowered_dest = dest.lower()
        if "external" in lowered_source and any(token in lowered_dest for token in ("admin", "database", "db")):
            anomalies.append("ESCALATION: external source reached privileged destination")
            total_risk += self.risk_points_escalation

        if port in {22, 3389, 5432, 3306, 27017} and source_role in {"printer", "iot_device", "unknown"}:
            anomalies.append(f"SUSPICIOUS: {source_role} using privileged/admin port {port}")
            total_risk += self.risk_points_escalation

        return {
            "connection": {"source": source, "dest": dest, "protocol": protocol, "port": port},
            "roles": {"source": source_role, "dest": dest_role},
            "anomalies": anomalies,
            "total_risk_points": total_risk,
            "alert": bool(anomalies),
        }
