"""Text/security sniffers adapted from the uploaded ARCHE sniffer package.

These are intentionally local-first and deterministic. They do not call an LLM
or any external API. They are staged here as a stronger replacement for the
single regex sniffer table currently inside rk_engine.py.
"""
from __future__ import annotations

import math
import zlib
from collections import Counter
from typing import Any

from rapidfuzz import fuzz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class LexicalSniffer:
    """Detect obfuscated or typo'd sensitive/dangerous keywords."""

    def __init__(self, blacklist: list[str] | None = None, threshold: int = 85) -> None:
        self.blacklist = blacklist or [
            "password", "passwd", "secret", "api_key", "token", "private_key",
            "unauthorized_access", "drop_table", "delete_from", "exec", "eval",
            "rm -rf", "sudo", "chmod 777",
        ]
        self.threshold = threshold
        self.risk_points_per_hit = 5

    def scan(self, text: str) -> dict[str, Any]:
        matches: list[dict[str, Any]] = []
        total_risk = 0
        normalized = (text or "").lower().strip()

        for keyword in self.blacklist:
            for token in normalized.split():
                similarity = fuzz.token_set_ratio(token, keyword) / 100.0
                if similarity >= (self.threshold / 100.0):
                    matches.append({
                        "keyword": keyword,
                        "detected_token": token,
                        "similarity": round(similarity * 100, 2),
                        "risk_points": self.risk_points_per_hit,
                    })
                    total_risk += self.risk_points_per_hit

        return {
            "matches": matches,
            "total_risk_points": total_risk,
            "alert": bool(matches),
        }


class SemanticSniffer:
    """Detect suspicious intent using local TF-IDF similarity.

    This is not LLM reasoning. It is a cheap semantic/vibe tripwire that keeps
    the first-pass security layer CPU-local and explainable.
    """

    def __init__(self, similarity_threshold: float = 0.30) -> None:
        self.dangerous_intents = [
            "steal credentials passwords secrets tokens keys",
            "unauthorized access breach infiltrate exploit",
            "export private sensitive data exfiltrate",
            "bypass security firewall restrictions",
            "escalate privilege elevate admin root",
            "inject malicious code payload exploit",
            "delete destroy corrupt data files database",
            "disrupt service availability outage",
            "intercept sniff packet communication",
            "impersonate fake account identity spoofing",
            "access restricted forbidden confidential",
            "modify tamper alter audit logs records",
            "backdoor persistent access hidden",
            "vulnerability exploit bug flaw weakness",
            "brute force crack dictionary password attack",
        ]
        self.vectorizer = TfidfVectorizer(lowercase=True, stop_words="english", ngram_range=(1, 2))
        self.intent_vectors = self.vectorizer.fit_transform(self.dangerous_intents)
        self.similarity_threshold = similarity_threshold
        self.risk_points_per_match = 30

    def scan(self, text: str) -> dict[str, Any]:
        matches: list[dict[str, Any]] = []
        total_risk = 0
        max_similarity = 0.0

        if not (text or "").strip():
            return {"matches": [], "max_similarity": 0.0, "total_risk_points": 0, "alert": False}

        input_vector = self.vectorizer.transform([text])
        similarities = cosine_similarity(input_vector, self.intent_vectors)[0]
        max_similarity = float(max(similarities)) if len(similarities) else 0.0

        for idx, similarity in enumerate(similarities):
            sim = float(similarity)
            if sim >= self.similarity_threshold:
                matches.append({
                    "intent": self.dangerous_intents[idx],
                    "similarity": round(sim, 3),
                    "risk_points": self.risk_points_per_match,
                })
                total_risk += self.risk_points_per_match

        return {
            "matches": matches,
            "max_similarity": round(max_similarity, 3),
            "total_risk_points": total_risk,
            "alert": bool(matches),
        }


class RepetitionSniffer:
    """Detect automated/repetitive patterns using entropy and compression."""

    def __init__(self) -> None:
        self.entropy_threshold = 1.5
        self.compression_ratio_threshold = 0.15
        self.risk_points_entropy = 30
        self.risk_points_compression = 40

    def calculate_entropy(self, data: str | bytes) -> float:
        if not data:
            return 0.0
        raw = data.encode() if isinstance(data, str) else data
        freq = Counter(raw)
        total = len(raw)
        entropy = 0.0
        for count in freq.values():
            probability = count / total
            entropy -= probability * math.log2(probability)
        return entropy

    def calculate_compression_ratio(self, data: str | bytes) -> float:
        if not data:
            return 0.0
        raw = data.encode() if isinstance(data, str) else data
        compressed = zlib.compress(raw, level=9)
        return len(compressed) / len(raw)

    def scan(self, text: str) -> dict[str, Any]:
        entropy = self.calculate_entropy(text)
        compression_ratio = self.calculate_compression_ratio(text)
        alerts: list[str] = []
        total_risk = 0

        entropy_alert = entropy < self.entropy_threshold and bool(text)
        if entropy_alert:
            total_risk += self.risk_points_entropy
            alerts.append(f"Low entropy detected ({entropy:.2f} bits).")

        compression_alert = compression_ratio < self.compression_ratio_threshold and bool(text)
        if compression_alert:
            total_risk += self.risk_points_compression
            alerts.append(f"High compression detected ({compression_ratio:.2f}).")

        return {
            "entropy": round(entropy, 3),
            "entropy_alert": entropy_alert,
            "compression_ratio": round(compression_ratio, 3),
            "compression_alert": compression_alert,
            "alerts": alerts,
            "total_risk_points": total_risk,
            "alert": entropy_alert or compression_alert,
        }


class TextSecuritySniffer:
    """Run Tier 1-3 text/security scans and return one combined result."""

    def __init__(self) -> None:
        self.lexical = LexicalSniffer()
        self.semantic = SemanticSniffer()
        self.repetition = RepetitionSniffer()
        self.lockdown_threshold = 100

    def scan(self, text: str) -> dict[str, Any]:
        tier_1 = self.lexical.scan(text)
        tier_2 = self.semantic.scan(text)
        tier_3 = self.repetition.scan(text)
        total_risk = (
            tier_1["total_risk_points"]
            + tier_2["total_risk_points"]
            + tier_3["total_risk_points"]
        )
        status = "LOCKDOWN" if total_risk >= self.lockdown_threshold else "MONITOR" if total_risk else "SAFE"
        return {
            "input": text[:100] + "..." if len(text) > 100 else text,
            "tier_1": tier_1,
            "tier_2": tier_2,
            "tier_3": tier_3,
            "total_risk_points": total_risk,
            "status": status,
            "alert": total_risk > 0,
        }
