"""Brunel-local Artifact Organ bridge.

Cybrary owns artifacts. Chat should ask the Artifact Organ for artifact context
instead of knowing how URLs and stored items are represented.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

URL_ONLY_RE = re.compile(r"^(https?://|www\.)[^\s]+$", re.IGNORECASE)


@dataclass(slots=True)
class ArtifactPacket:
    item_ids: list[str] = field(default_factory=list)
    items: list[dict[str, Any]] = field(default_factory=list)
    prompt_context: str = ""
    auto_created_urls: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def normalize_url_reference(value: str) -> str | None:
    raw = (value or "").strip()
    if not URL_ONLY_RE.match(raw):
        return None
    if raw.lower().startswith("www."):
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return raw


class ArtifactOrgan:
    """Evaluates Cybrary artifacts and URL references into prompt context."""

    def __init__(self, db: Any, prompt_char_limit: int = 12000) -> None:
        self.db = db
        self.prompt_char_limit = prompt_char_limit

    async def evaluate(self, *, user_id: str, message: str, item_ids: list[str] | None = None) -> ArtifactPacket:
        clean_ids = [item_id for item_id in (item_ids or []) if item_id]
        auto_created_urls: list[str] = []
        auto_url = normalize_url_reference(message) if not clean_ids else None
        if auto_url:
            item = await self.create_url_reference(user_id=user_id, url=auto_url)
            clean_ids.append(item["item_id"])
            auto_created_urls.append(auto_url)
        prompt_context, items = await self.build_context(user_id=user_id, item_ids=clean_ids)
        return ArtifactPacket(
            item_ids=clean_ids,
            items=items,
            prompt_context=prompt_context,
            auto_created_urls=auto_created_urls,
            metadata={"source": "ArtifactOrgan", "organ_version": "0.1.0"},
        )

    async def create_url_reference(self, *, user_id: str, url: str) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        item_id = f"cyb-{uuid.uuid4().hex}"
        note = "This URL has been stored as a Cybrary reference. Live page-reading is not enabled in this demo session yet, so the page has not been inspected. When retrieval is enabled, this same item can hold title, metadata, page text, and working context."
        item = {
            "item_id": item_id,
            "user_id": user_id,
            "name": urlparse(url).netloc or url,
            "mime_type": "text/uri-list",
            "kind": "url",
            "size": len(url),
            "source": "link",
            "status": "reference",
            "created_at": now,
            "updated_at": now,
            "preview_text": note,
            "extracted_text": None,
            "vision_summary": None,
            "url": url,
            "metadata": {"fetch_status": "not_enabled", "auto_captured": True},
            "blob_b64": "",
        }
        await self.db.cybrary_items.insert_one(item)
        return item

    async def build_context(self, *, user_id: str, item_ids: list[str]) -> tuple[str, list[dict[str, Any]]]:
        clean_ids = [item_id for item_id in item_ids if item_id]
        if not clean_ids:
            return "", []
        cursor = self.db.cybrary_items.find({"user_id": user_id, "item_id": {"$in": clean_ids}}, {"_id": 0, "blob_b64": 0})
        items: list[dict[str, Any]] = []
        async for item in cursor:
            items.append(item)
        if not items:
            return "", []
        blocks: list[str] = []
        budget = self.prompt_char_limit
        for item in items:
            label = f"{item.get('name', item.get('item_id'))} ({item.get('kind', 'file')} · {item.get('mime_type', 'unknown')} · {item.get('status', 'stored')})"
            text = item.get("extracted_text") or item.get("preview_text") or item.get("vision_summary")
            if text:
                body = str(text)[:budget]
                budget -= len(body)
                blocks.append(f"[Cybrary item: {label}]\n{body}")
            else:
                blocks.append(f"[Cybrary item: {label}]\nThe artifact exists in the Cybrary, but its analysis organ has not populated working context yet.")
            if budget <= 0:
                break
        return "\n\n".join(blocks), items
