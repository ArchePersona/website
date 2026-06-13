"""
Time pressure primitives for ARCHE/Brunel.

This module exists so time can become a first-class behavioral signal instead
of only being displayed in the UI or copied into a prompt.

The intended flow is:

elapsed silence -> time decay -> topic entropy pressure -> state drift -> mode/behavior
"""

from __future__ import annotations

from typing import Any


def compute_time_decay(elapsed_seconds: float | None) -> float:
    """
    Return a normalized decay pressure from 0.0 to 1.0.

    This is not a clock display. It is behavioral pressure caused by silence.
    """
    if elapsed_seconds is None:
        return 0.0
    hours = max(0.0, elapsed_seconds) / 3600.0
    if hours < 1:
        return 0.0
    if hours < 6:
        return 0.05
    if hours < 24:
        return 0.12
    if hours < 24 * 3:
        return 0.22
    if hours < 24 * 7:
        return 0.35
    if hours < 24 * 30:
        return 0.55
    if hours < 24 * 90:
        return 0.75
    return 0.9


def compute_time_entropy_pressure(elapsed_seconds: float | None, cooling: str = "none", momentum: str = "active") -> dict[str, Any]:
    """
    Convert elapsed time into explicit entropy pressure.

    The output is designed to be carried in the temporal session packet and
    later fed into signal/state emergence.
    """
    decay = compute_time_decay(elapsed_seconds)
    cooling_boost = {
        "none": 0.0,
        "slight": 0.05,
        "moderate": 0.15,
        "strong": 0.30,
        "cold": 0.45,
    }.get(cooling, 0.0)
    momentum_offset = {
        "high": -0.08,
        "active": -0.03,
        "settling": 0.04,
        "cooling": 0.12,
        "dormant": 0.25,
        "new": 0.0,
    }.get(momentum, 0.0)
    pressure = max(0.0, min(1.0, decay + cooling_boost + momentum_offset))
    if pressure < 0.10:
        band = "stable"
    elif pressure < 0.25:
        band = "light_decay"
    elif pressure < 0.50:
        band = "noticeable_decay"
    elif pressure < 0.75:
        band = "strong_decay"
    else:
        band = "dormant_decay"
    return {
        "time_decay": round(decay, 3),
        "entropy_pressure": round(pressure, 3),
        "entropy_band": band,
        "cooling": cooling,
        "momentum": momentum,
    }


def apply_time_decay_to_topic_entropy(topic_entropy: dict[str, Any] | None, pressure: dict[str, Any]) -> dict[str, Any]:
    """
    Apply decay metadata to the topic entropy map without destroying topics.

    This is intentionally conservative. It marks and scales numeric topic
    weights, but keeps the original topic keys so archive continuity survives.
    """
    source = topic_entropy or {}
    entropy_pressure = float(pressure.get("entropy_pressure", 0.0) or 0.0)
    decay_factor = max(0.0, min(1.0, 1.0 - entropy_pressure))
    out: dict[str, Any] = {}
    for key, value in source.items():
        if isinstance(value, (int, float)):
            out[key] = round(float(value) * decay_factor, 4)
        elif isinstance(value, dict):
            item = dict(value)
            if isinstance(item.get("weight"), (int, float)):
                item["weight"] = round(float(item["weight"]) * decay_factor, 4)
            item["time_decay_applied"] = entropy_pressure
            out[key] = item
        else:
            out[key] = value
    out["_time_pressure"] = pressure
    return out


def suggest_time_state_bias(pressure: dict[str, Any]) -> str:
    """
    Provide a soft state bias from time alone.

    This is not a forced state. It is a hint for the state emergence layer.
    """
    band = pressure.get("entropy_band")
    if band in {"stable", "light_decay"}:
        return "maintain"
    if band == "noticeable_decay":
        return "soften"
    if band == "strong_decay":
        return "reorient"
    if band == "dormant_decay":
        return "reacquaint"
    return "maintain"
