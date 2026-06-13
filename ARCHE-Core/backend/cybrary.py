"""
Brunel Cybrary primitives.

The Cybrary is the canonical place for uploaded, linked, and generated artifacts.
Chat should reference Cybrary item IDs instead of owning raw files or URLs.
"""

from __future__ import annotations

import base64
import csv
import io
import re
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from supabase_helper import get_current_user

MAX_CYBRARY_BYTES = 20 * 1024 * 1024
TEXT_LIMIT = 12000
TEXT_MIME_PREFIXES = ("text/",)
TEXT_MIME_TYPES = {
    "application/json",
    "application/xml",
    "application/javascript",
    "application/x-javascript",
    "application/x-python-code",
    "text/csv",
    "text/markdown",
}
IMAGE_MIME_PREFIXES = ("image/",)
AUDIO_MIME_PREFIXES = ("audio/",)
VIDEO_MIME_PREFIXES = ("video/",)
URL_RE = re.compile(r"^(https?://|www\.)[^\s]+$", re.IGNORECASE)


class UrlReferencePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    url: str = Field(min_length=3)
    title: str | None = None


class GeneratedArtifactPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(default="generated-artifact.md")
    mime_type: str = Field(default="text/markdown")
    content: str = Field(min_length=1)
    kind: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


def normalize_url(value: str) -> str:
    url = value.strip()
    if not URL_RE.match(url):
        raise HTTPException(status_code=400, detail="invalid URL reference")
    if url.lower().startswith("www."):
        url = f"https://{url}"
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="invalid URL reference")
    return url


def classify_mime(mime_type: str) -> str:
    mime = (mime_type or "application/octet-stream").split(";", 1)[0].strip().lower()
    if mime.startswith(IMAGE_MIME_PREFIXES):
        return "image"
    if mime.startswith(AUDIO_MIME_PREFIXES):
        return "audio"
    if mime.startswith(VIDEO_MIME_PREFIXES):
        return "video"
    if mime.startswith(TEXT_MIME_PREFIXES) or mime in TEXT_MIME_TYPES:
        return "text"
    if mime in {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }:
        return "document"
    if mime in {"application/zip", "application/x-zip-compressed"}:
        return "archive"
    return "file"


def safe_text_preview(blob: bytes, limit: int = TEXT_LIMIT) -> str | None:
    if not blob:
        return None
    chunk = blob[:limit]
    try:
        return chunk.decode("utf-8", errors="replace")
    except Exception:
        return None


def extract_docx_text(blob: bytes, limit: int = TEXT_LIMIT) -> str | None:
    try:
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            xml = z.read("word/document.xml")
        root = ET.fromstring(xml)
        parts = [node.text for node in root.iter() if node.text]
        text = " ".join(parts).strip()
        return text[:limit] if text else None
    except Exception:
        return None


def extract_csv_text(blob: bytes, limit: int = TEXT_LIMIT) -> str | None:
    raw = safe_text_preview(blob, limit=limit)
    if not raw:
        return None
    try:
        rows = list(csv.reader(io.StringIO(raw)))[:50]
        return "\n".join(" | ".join(cell.strip() for cell in row) for row in rows)[:limit]
    except Exception:
        return raw[:limit]


def sniff_pdf_text(blob: bytes, limit: int = TEXT_LIMIT) -> str | None:
    raw = blob[: min(len(blob), 512_000)].decode("latin-1", errors="ignore")
    candidates = re.findall(r"\(([^()]{3,500})\)", raw)
    text = "\n".join(candidates)
    text = re.sub(r"\\[nrt]", " ", text).strip()
    return text[:limit] if text else None


def build_initial_ingestion(kind: str, mime_type: str, name: str, blob: bytes) -> dict:
    metadata: dict[str, Any] = {"ingestion_version": "v1"}
    extracted_text = None
    preview_text = None
    vision_summary = None
    status = "stored"

    lower_name = (name or "").lower()
    if kind == "text":
        extracted_text = extract_csv_text(blob) if mime_type == "text/csv" or lower_name.endswith(".csv") else safe_text_preview(blob)
        preview_text = extracted_text
        status = "ingested" if extracted_text else "stored"
    elif kind == "document":
        if mime_type.endswith("wordprocessingml.document") or lower_name.endswith(".docx"):
            extracted_text = extract_docx_text(blob)
            metadata["extractor"] = "docx-xml"
        elif mime_type == "application/pdf" or lower_name.endswith(".pdf"):
            extracted_text = sniff_pdf_text(blob)
            metadata["extractor"] = "pdf-sniff-fallback"
        else:
            extracted_text = safe_text_preview(blob)
            metadata["extractor"] = "text-fallback"
        preview_text = extracted_text
        status = "ingested" if extracted_text else "pending_ingest"
    elif kind == "image":
        vision_summary = (
            "Image stored in the Cybrary. Image inspection is not enabled in this demo session yet; "
            "when the vision organ is active, this item will hold a visual summary, OCR text, and tags."
        )
        preview_text = vision_summary
        status = "pending_vision"
        metadata["vision_status"] = "not_enabled"
    elif kind == "audio":
        preview_text = "Audio stored in the Cybrary. Transcription is pending."
        status = "pending_transcript"
    elif kind == "video":
        preview_text = "Video stored in the Cybrary. Frame sampling and transcript extraction are pending."
        status = "pending_video_ingest"

    return {
        "status": status,
        "preview_text": preview_text,
        "extracted_text": extracted_text,
        "vision_summary": vision_summary,
        "metadata": metadata,
    }


def make_artifact_item(*, user_id: str, name: str, mime_type: str, kind: str, source: str, status: str, blob: bytes, metadata: dict[str, Any] | None = None, preview_text: str | None = None, extracted_text: str | None = None, vision_summary: str | None = None, url: str | None = None) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "item_id": f"cyb-{uuid.uuid4().hex}",
        "user_id": user_id,
        "name": name,
        "mime_type": mime_type,
        "kind": kind,
        "size": len(blob) if blob else len(url or ""),
        "source": source,
        "status": status,
        "created_at": now,
        "updated_at": now,
        "preview_text": preview_text,
        "extracted_text": extracted_text,
        "vision_summary": vision_summary,
        "url": url,
        "metadata": metadata or {},
        "blob_b64": base64.b64encode(blob).decode("ascii") if blob else "",
    }


def public_item(item: dict) -> dict:
    out = {k: v for k, v in item.items() if k not in {"_id", "blob_b64"}}
    if hasattr(out.get("created_at"), "isoformat"):
        out["created_at"] = out["created_at"].isoformat()
    if hasattr(out.get("updated_at"), "isoformat"):
        out["updated_at"] = out["updated_at"].isoformat()
    out["id"] = out.get("item_id")
    return out


def build_cybrary_router(db: Any) -> APIRouter:
    router = APIRouter(prefix="/cybrary", tags=["cybrary"])

    @router.post("/upload")
    async def upload_cybrary_item(
        file: UploadFile = File(...),
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        blob = await file.read()
        if not blob:
            raise HTTPException(status_code=400, detail="empty file")
        if len(blob) > MAX_CYBRARY_BYTES:
            raise HTTPException(status_code=413, detail="file too large for Cybrary v1")

        mime_type = file.content_type or "application/octet-stream"
        kind = classify_mime(mime_type)
        name = file.filename or "uploaded-artifact"
        ingestion = build_initial_ingestion(kind, mime_type, name, blob)
        item = make_artifact_item(
            user_id=current_user["id"],
            name=name,
            mime_type=mime_type,
            kind=kind,
            source="upload",
            status=ingestion["status"],
            blob=blob,
            metadata=ingestion["metadata"],
            preview_text=ingestion["preview_text"],
            extracted_text=ingestion["extracted_text"],
            vision_summary=ingestion["vision_summary"],
        )
        await db.cybrary_items.insert_one(item)
        return public_item(item)

    @router.post("/generated")
    async def create_generated_artifact(
        payload: GeneratedArtifactPayload,
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        blob = payload.content.encode("utf-8")
        if len(blob) > MAX_CYBRARY_BYTES:
            raise HTTPException(status_code=413, detail="generated artifact too large for Cybrary v1")
        mime_type = payload.mime_type or "text/markdown"
        inferred_kind = payload.kind or classify_mime(mime_type)
        if inferred_kind == "text":
            inferred_kind = "document"
        ingestion = build_initial_ingestion("text", mime_type, payload.name, blob)
        item = make_artifact_item(
            user_id=current_user["id"],
            name=payload.name,
            mime_type=mime_type,
            kind=inferred_kind,
            source="generated",
            status="generated",
            blob=blob,
            metadata={"generated": True, **(payload.metadata or {}), **ingestion["metadata"]},
            preview_text=ingestion["preview_text"] or payload.content[:TEXT_LIMIT],
            extracted_text=ingestion["extracted_text"] or payload.content[:TEXT_LIMIT],
            vision_summary=None,
        )
        await db.cybrary_items.insert_one(item)
        return public_item(item)

    @router.post("/url")
    async def create_url_reference(
        payload: UrlReferencePayload,
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        url = normalize_url(payload.url)
        name = payload.title or urlparse(url).netloc or url
        note = (
            "This URL has been stored as a Cybrary reference. "
            "Live page-reading is not enabled in this demo session yet, so the page has not been inspected. "
            "When fetching is enabled, this same item can hold title, metadata, page text, and working context."
        )
        item = make_artifact_item(
            user_id=current_user["id"],
            name=name,
            mime_type="text/uri-list",
            kind="url",
            source="link",
            status="reference",
            blob=b"",
            metadata={"fetch_status": "not_enabled"},
            preview_text=note,
            extracted_text=None,
            vision_summary=None,
            url=url,
        )
        await db.cybrary_items.insert_one(item)
        return public_item(item)

    @router.post("/items/{item_id}/ingest")
    async def ingest_cybrary_item(item_id: str, current_user: dict = Depends(get_current_user)) -> dict:
        item = await db.cybrary_items.find_one({"user_id": current_user["id"], "item_id": item_id})
        if not item:
            raise HTTPException(status_code=404, detail="Cybrary item not found")
        if item.get("kind") == "url":
            return public_item(item)
        blob = base64.b64decode(item.get("blob_b64") or "")
        ingestion = build_initial_ingestion(item.get("kind", "file"), item.get("mime_type", ""), item.get("name", ""), blob)
        update = {
            "status": ingestion["status"],
            "preview_text": ingestion["preview_text"],
            "extracted_text": ingestion["extracted_text"],
            "vision_summary": ingestion["vision_summary"],
            "metadata": {**(item.get("metadata") or {}), **ingestion["metadata"]},
            "updated_at": datetime.now(timezone.utc),
        }
        await db.cybrary_items.update_one({"user_id": current_user["id"], "item_id": item_id}, {"$set": update})
        item.update(update)
        return public_item(item)

    @router.get("/items")
    async def list_cybrary_items(current_user: dict = Depends(get_current_user)) -> dict:
        cursor = db.cybrary_items.find(
            {"user_id": current_user["id"]},
            {"_id": 0, "blob_b64": 0},
        ).sort("created_at", -1).limit(50)
        items = []
        async for item in cursor:
            items.append(public_item(item))
        return {"items": items}

    @router.get("/items/{item_id}")
    async def get_cybrary_item(item_id: str, current_user: dict = Depends(get_current_user)) -> dict:
        item = await db.cybrary_items.find_one(
            {"user_id": current_user["id"], "item_id": item_id},
            {"_id": 0, "blob_b64": 0},
        )
        if not item:
            raise HTTPException(status_code=404, detail="Cybrary item not found")
        return public_item(item)

    @router.get("/items/{item_id}/content")
    async def get_cybrary_item_content(item_id: str, current_user: dict = Depends(get_current_user)) -> Response:
        item = await db.cybrary_items.find_one({"user_id": current_user["id"], "item_id": item_id})
        if not item:
            raise HTTPException(status_code=404, detail="Cybrary item not found")
        if item.get("kind") == "url":
            return Response(content=item.get("url") or "", media_type="text/uri-list")
        blob = base64.b64decode(item.get("blob_b64") or "")
        return Response(
            content=blob,
            media_type=item.get("mime_type") or "application/octet-stream",
            headers={"Content-Disposition": f'inline; filename="{item.get("name", item_id)}"'},
        )

    return router
