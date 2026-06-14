"""Brunel-local time organ bridge.

This keeps Brunel aligned with the ARCHEngine TemporalOrgan shape while the
website backend remains standalone.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from time_pressure import compute_time_entropy_pressure, suggest_time_state_bias


def parse_iso_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not value or not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def human_elapsed(delta_seconds: float | None) -> str:
    if delta_seconds is None:
        return "unknown"
    seconds = max(0, int(delta_seconds))
    if seconds < 60:
        return f"{seconds} seconds"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} minutes"
    hours = minutes // 60
    if hours < 24:
        rem = minutes % 60
        return f"{hours} hours" if rem == 0 else f"{hours} hours {rem} minutes"
    days = hours // 24
    rem_hours = hours % 24
    return f"{days} days" if rem_hours == 0 else f"{days} days {rem_hours} hours"


def derive_cooling(delta_seconds: float | None) -> str:
    if delta_seconds is None:
        return "none"
    hours = max(0.0, delta_seconds) / 3600.0
    if hours < 6:
        return "none"
    if hours < 24:
        return "slight"
    if hours < 24 * 7:
        return "moderate"
    if hours < 24 * 30:
        return "strong"
    return "cold"


def derive_momentum(delta_seconds: float | None, recent_turns: int = 0) -> str:
    if delta_seconds is None:
        return "new"
    minutes = max(0.0, delta_seconds) / 60.0
    if minutes < 20 and recent_turns >= 3:
        return "high"
    if minutes < 180:
        return "active"
    if minutes < 60 * 24:
        return "settling"
    if minutes < 60 * 24 * 7:
        return "cooling"
    return "dormant"


def derive_relationship_stage(first_seen: datetime | None, now: datetime, turn_count: int = 0) -> tuple[str, int]:
    if not first_seen:
        return "new", 0
    days = max(0, int((now - first_seen).total_seconds() // 86400))
    if turn_count >= 100 or days >= 30:
        return "long-term continuity", days
    if turn_count >= 25 or days >= 7:
        return "established", days
    if turn_count >= 5 or days >= 1:
        return "familiar", days
    return "new acquaintance", days


def derive_trust(previous_trust: int | float | None, cooling: str, turn_count: int = 0) -> int:
    trust = max(0, min(10, int(previous_trust if previous_trust is not None else 5)))
    if turn_count >= 25 and cooling in {"none", "slight"}:
        trust += 1
    if cooling == "strong":
        trust -= 1
    if cooling == "cold":
        trust -= 2
    return max(0, min(10, trust))


def derive_pressure(session: dict[str, Any], now: datetime) -> dict[str, Any]:
    history = session.get("rk_history", []) or []
    last_turn = history[-1] if history else None
    last_ts = parse_iso_datetime(last_turn.get("ts") if last_turn else None)
    elapsed_seconds = (now - last_ts).total_seconds() if last_ts else None
    first_seen = parse_iso_datetime(session.get("first_seen") or session.get("created"))
    prior_turn_count = int(session.get("turn_count") or len(history))
    cooling = derive_cooling(elapsed_seconds)
    momentum = derive_momentum(elapsed_seconds, len(history[-6:]))
    relationship_stage, relationship_age_days = derive_relationship_stage(first_seen, now, prior_turn_count)
    trust = derive_trust(session.get("trust", 5), cooling, prior_turn_count)
    time_pressure = compute_time_entropy_pressure(elapsed_seconds, cooling=cooling, momentum=momentum)
    pressure: dict[str, Any] = {
        "elapsed_seconds": elapsed_seconds,
        "elapsed_since_previous": human_elapsed(elapsed_seconds),
        "last_interaction": last_ts.isoformat() if last_ts else None,
        "momentum": momentum,
        "cooling": cooling,
        "trust": trust,
        "relationship_stage": relationship_stage,
        "relationship_age_days": relationship_age_days,
        "turn_count": prior_turn_count + 1,
    }
    pressure.update(time_pressure)
    pressure["state_bias"] = suggest_time_state_bias(time_pressure)
    return pressure
