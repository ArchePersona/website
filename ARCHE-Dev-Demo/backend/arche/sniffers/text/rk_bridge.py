"""Bridge from staged ARCHE text signals into legacy RK flag shape.

This keeps the new sniffer subsystem separate while letting the existing
BRUNEL/RK engine consume upgraded signals when we wire it in.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from arche.signals import Signal
from arche.sniffers.text.adapter import TextSignalAdapter


@dataclass(slots=True)
class LegacyFlagLike:
    """Small compatibility object matching rk_engine.Flag's public fields."""

    token_id: int
    matched: str
    weight: int
    channels: tuple[str, ...]

    @property
    def hex_id(self) -> str:
        return f"0x{self.token_id:04X}"


# Reserved ARCHE text/security token range. The old table currently uses
# 0x0010-0x00B1. Keep upgraded sniffer bridge flags in 0xA000+.
#
# Nibble rule: collapsed repeat amount can occupy the last nibble.
# Example: 0xA011..0xA019 = lexical security repeat level 1..9.
_SIGNAL_TO_LEGACY_FLAG: dict[str, tuple[int, tuple[str, ...]]] = {
    "lexical_security_match": (0xA010, ("threat", "reason")),
    "semantic_security_intent": (0xA020, ("threat", "reason", "perception")),
    "low_entropy_loop": (0xA030, ("reason", "perception")),
    "high_compression_repetition": (0xA040, ("reason", "perception")),
    "text_lockdown_threshold": (0xA0F0, ("threat", "reason", "perception")),
}


# Same-message duplicate collapse policy. These signal types should not spray
# identical flags forever. Their repeated presence should increase weight,
# carry a repeat count as evidence, and encode repeat intensity in the final
# token-id nibble.
_COLLAPSE_BY_SIGNAL_TYPE = {
    "lexical_security_match",
    "semantic_security_intent",
}


def arche_text_signals_to_legacy_flags(signals: list[Signal]) -> list[LegacyFlagLike]:
    """Convert normalized ARCHE text signals into old flag-compatible objects.

    Repeated same-message lexical/semantic hits collapse into one stronger flag
    with repeat amount encoded in the final token nibble. Separate repetition /
    loop signals still pass through as their own 0xA030/0xA040 flags when
    detected.
    """
    collapsed: dict[str, list[Signal]] = defaultdict(list)
    passthrough: list[Signal] = []

    for signal in signals:
        if signal.signal_type in _COLLAPSE_BY_SIGNAL_TYPE:
            collapsed[signal.signal_type].append(signal)
        else:
            passthrough.append(signal)

    flags: list[LegacyFlagLike] = []

    for signal_type, grouped_signals in collapsed.items():
        mapped = _SIGNAL_TO_LEGACY_FLAG.get(signal_type)
        if not mapped:
            continue
        base_token_id, channels = mapped
        repeat_count = len(grouped_signals)
        repeat_level = _repeat_level(repeat_count)
        token_id = _with_repeat_nibble(base_token_id, repeat_level)
        combined_effective_weight = sum(signal.effective_weight for signal in grouped_signals)
        # Collapsed duplicate hits should get stronger but still cap at 9.
        weight = max(1, min(9, round(combined_effective_weight * 9)))
        evidence_terms = _unique_evidence_terms(grouped_signals)
        evidence = ", ".join(evidence_terms) if evidence_terms else signal_type
        if repeat_count > 1:
            evidence = f"{evidence} repeated x{repeat_count}"
        flags.append(LegacyFlagLike(
            token_id=token_id,
            matched=evidence,
            weight=weight,
            channels=channels,
        ))

    for signal in passthrough:
        mapped = _SIGNAL_TO_LEGACY_FLAG.get(signal.signal_type)
        if not mapped:
            continue
        token_id, channels = mapped
        # Legacy flag weights are 0-9. Keep a floor of 1 for real signals.
        weight = max(1, min(9, round(signal.effective_weight * 9)))
        flags.append(LegacyFlagLike(
            token_id=token_id,
            matched=signal.evidence or signal.signal_type,
            weight=weight,
            channels=channels,
        ))

    return flags


def _repeat_level(repeat_count: int) -> int:
    """Return 0-9 repeat intensity for use in the final token nibble."""
    return max(0, min(9, int(repeat_count)))


def _with_repeat_nibble(base_token_id: int, repeat_level: int) -> int:
    """Replace the final nibble with repeat level 0-9."""
    return (base_token_id & 0xFFF0) | _repeat_level(repeat_level)


def _unique_evidence_terms(signals: list[Signal]) -> list[str]:
    """Return short unique evidence strings in first-seen order."""
    seen: set[str] = set()
    out: list[str] = []
    for signal in signals:
        evidence = (signal.evidence or signal.signal_type).strip()
        if not evidence or evidence in seen:
            continue
        seen.add(evidence)
        out.append(evidence)
    return out


def run_arche_text_sniffer_flags(message: str, source_id: str = "local") -> list[LegacyFlagLike]:
    """Run upgraded ARCHE text sniffers and return legacy-compatible flags.

    This is intentionally additive. If the new sniffer dependencies are not
    installed in a deployment environment, the caller should catch the import
    or runtime failure and fall back to the old regex sniffer path.
    """
    adapter = TextSignalAdapter()
    signals = adapter.scan_to_signals(message, source_id=source_id)
    return arche_text_signals_to_legacy_flags(signals)
