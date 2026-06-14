"""Brunel-local Reflection Organ.

ReflectionOrgan owns meaning continuity. It converts memory, continuity synopsis,
facts, and recent project signals into a compact meaning packet for PacketOrgan.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


@dataclass(slots=True)
class MeaningRecord:
    record_id: str = field(default_factory=lambda: str(uuid4()))
    relationship_themes: list[str] = field(default_factory=list)
    open_projects: list[str] = field(default_factory=list)
    recent_concerns: list[str] = field(default_factory=list)
    outstanding_promises: list[str] = field(default_factory=list)
    identity_summary: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class ReflectionPacket:
    packet_id: str = field(default_factory=lambda: str(uuid4()))
    meaning_record: MeaningRecord = field(default_factory=MeaningRecord)
    relationship_themes: list[str] = field(default_factory=list)
    open_projects: list[str] = field(default_factory=list)
    recent_concerns: list[str] = field(default_factory=list)
    outstanding_promises: list[str] = field(default_factory=list)
    identity_summary: list[str] = field(default_factory=list)
    reflection_summary: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class ReflectionOrgan:
    """Builds meaning continuity from existing organ outputs."""

    THEME_KEYWORDS: dict[str, tuple[str, ...]] = {
        "AI architecture": ("organ", "runtime", "architecture", "packet", "reflection", "pressure", "tribunal"),
        "V-Hold": ("v-hold", "centurion", "oversight", "governance", "consequence"),
        "ARCHEngine": ("archengine", "arche", "behavior", "continuity"),
        "Yabba Dabba": ("yabba", "archive", "extension", "zip", "import"),
        "Website": ("website", "homepage", "landing", "frontend", "dashboard"),
        "Founder journey": ("founder", "investor", "deck", "pitch", "van", "company"),
    }

    PROJECTS = ("ReflectionOrgan", "PressureOrgan", "V-Hold", "Yabba Dabba", "Website", "ARCHEngine")

    def evaluate(
        self,
        *,
        session: dict[str, Any],
        memory: Any,
        context: Any,
        recent_history: list[dict[str, Any]] | None = None,
        current_time: datetime | None = None,
    ) -> ReflectionPacket:
        now = current_time or datetime.now(timezone.utc)
        history = recent_history if recent_history is not None else session.get("rk_history", [])[-12:]
        text = self._meaning_text(session=session, memory=memory, history=history)

        relationship_themes = self._relationship_themes(text)
        open_projects = self._open_projects(text)
        recent_concerns = self._recent_concerns(text)
        outstanding_promises = self._outstanding_promises(text)
        identity_summary = self._identity_summary(getattr(memory, "facts", []) or [], text)

        meaning_record = MeaningRecord(
            relationship_themes=relationship_themes,
            open_projects=open_projects,
            recent_concerns=recent_concerns,
            outstanding_promises=outstanding_promises,
            identity_summary=identity_summary,
            metadata={"source": "ReflectionOrgan", "organ_version": "0.1.0", "created_at": now.isoformat()},
        )
        reflection_summary = self._summary(meaning_record)
        return ReflectionPacket(
            meaning_record=meaning_record,
            relationship_themes=relationship_themes,
            open_projects=open_projects,
            recent_concerns=recent_concerns,
            outstanding_promises=outstanding_promises,
            identity_summary=identity_summary,
            reflection_summary=reflection_summary,
            metadata={
                "source": "ReflectionOrgan",
                "organ_version": "0.1.0",
                "created_at": now.isoformat(),
                "context_packet_id": getattr(context, "packet_id", None),
                "memory_packet_id": getattr(memory, "packet_id", None),
            },
        )

    def _meaning_text(self, *, session: dict[str, Any], memory: Any, history: list[dict[str, Any]]) -> str:
        pieces = [session.get("continuity_synopsis", "") or "", getattr(memory, "working_memory", "") or "", " ".join(getattr(memory, "facts", []) or [])]
        for turn in history[-12:]:
            pieces.append(str(turn.get("user") or ""))
        return "\n".join(piece for piece in pieces if piece).lower()

    def _relationship_themes(self, text: str) -> list[str]:
        themes = [theme for theme, keywords in self.THEME_KEYWORDS.items() if any(keyword in text for keyword in keywords)]
        return themes[:8] or ["meaning continuity"]

    def _open_projects(self, text: str) -> list[str]:
        return [project for project in self.PROJECTS if project.lower() in text][:8]

    def _recent_concerns(self, text: str) -> list[str]:
        concerns = []
        if "transcript" in text:
            concerns.append("transcript dependence")
        if "deck" in text or "pitch" in text:
            concerns.append("deck generation reliability")
        if "governance" in text or "oversight" in text:
            concerns.append("governance architecture")
        if "continuity" in text:
            concerns.append("continuity")
        return self._unique(concerns)[:8]

    def _outstanding_promises(self, text: str) -> list[str]:
        promises = []
        if "reflectionorgan" in text or "reflection organ" in text:
            promises.append("finish ReflectionOrgan integration")
        if "pressureorgan" in text or "pressure organ" in text:
            promises.append("build PressureOrgan next")
        return promises[:8]

    def _identity_summary(self, facts: list[str], text: str) -> list[str]:
        identity = [fact for fact in facts if any(word in fact.lower() for word in ("founder", "archepersona", "engineer", "van", "systems", "behavior"))]
        if "founder" in text or "archepersona" in text:
            identity.append("Founder of ArchePersona")
        if "behavior" in text:
            identity.append("Behavior-first architecture philosophy")
        return self._unique(identity)[:8]

    def _summary(self, record: MeaningRecord) -> str:
        return "\n".join(
            [
                "RelationshipThemes: " + self._join(record.relationship_themes),
                "OpenProjects: " + self._join(record.open_projects),
                "RecentConcerns: " + self._join(record.recent_concerns),
                "OutstandingPromises: " + self._join(record.outstanding_promises),
                "IdentitySummary: " + self._join(record.identity_summary),
            ]
        )

    def _join(self, items: list[str]) -> str:
        return ", ".join(items) if items else "none detected"

    def _unique(self, items: list[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for item in items:
            clean = item.strip()
            key = clean.lower()
            if clean and key not in seen:
                seen.add(key)
                result.append(clean)
        return result
