"""
Brunel Cybrary primitives.

The Cybrary is the canonical place for uploaded and generated artifacts.
Chat should reference Cybrary item IDs instead of owning raw files.
"""

from __future__ import annotations

import base64
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from supabase_helper import get_current_user

MAX_CYBRARY_BYTES = 20 * 1024 * 1024
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


def safe_text_preview(blob: bytes, limit: int = 12000) -> str | None:
    if not blob:
        return None
    chunk = blob[:limit]
    try:
        return chunk.decode("utf-8", errors="replace")
    except Exception:
        return None


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

        now = datetime.now(timezone.utc)
        mime_type = file.content_type or "application/octet-stream"
        kind = classify_mime(mime_type)
        item_id = f"cyb-{uuid.uuid4().hex}"
        preview_text = safe_text_preview(blob) if kind == "text" else None

        item = {
            "item_id": item_id,
            "user_id": current_user["id"],
            "name": file.filename or item_id,
            "mime_type": mime_type,
            "kind": kind,
            "size": len(blob),
            "source": "upload",
            "status": "stored",
            "created_at": now,
            "updated_at": now,
            "preview_text": preview_text,
            "extracted_text": preview_text,
            "vision_summary": None,
            "metadata": {},
            "blob_b64": base64.b64encode(blob).decode("ascii"),
        }
        await db.cybrary_items.insert_one(item)

        return {
            "id": item_id,
            "name": item["name"],
            "mime_type": mime_type,
            "kind": kind,
            "size": len(blob),
            "source": "upload",
            "status": "stored",
            "preview_text": preview_text,
            "created_at": now.isoformat(),
        }

    @router.get("/items")
    async def list_cybrary_items(current_user: dict = Depends(get_current_user)) -> dict:
        cursor = db.cybrary_items.find(
            {"user_id": current_user["id"]},
            {"_id": 0, "blob_b64": 0},
        ).sort("created_at", -1).limit(50)
        items = []
        async for item in cursor:
            if hasattr(item.get("created_at"), "isoformat"):
                item["created_at"] = item["created_at"].isoformat()
            if hasattr(item.get("updated_at"), "isoformat"):
                item["updated_at"] = item["updated_at"].isoformat()
            items.append(item)
        return {"items": items}

    @router.get("/items/{item_id}")
    async def get_cybrary_item(item_id: str, current_user: dict = Depends(get_current_user)) -> dict:
        item = await db.cybrary_items.find_one(
            {"user_id": current_user["id"], "item_id": item_id},
            {"_id": 0, "blob_b64": 0},
        )
        if not item:
            raise HTTPException(status_code=404, detail="Cybrary item not found")
        if hasattr(item.get("created_at"), "isoformat"):
            item["created_at"] = item["created_at"].isoformat()
        if hasattr(item.get("updated_at"), "isoformat"):
            item["updated_at"] = item["updated_at"].isoformat()
        return item

    @router.get("/items/{item_id}/content")
    async def get_cybrary_item_content(item_id: str, current_user: dict = Depends(get_current_user)) -> Response:
        item = await db.cybrary_items.find_one({"user_id": current_user["id"], "item_id": item_id})
        if not item:
            raise HTTPException(status_code=404, detail="Cybrary item not found")
        blob = base64.b64decode(item.get("blob_b64") or "")
        return Response(
            content=blob,
            media_type=item.get("mime_type") or "application/octet-stream",
            headers={"Content-Disposition": f'inline; filename="{item.get("name", item_id)}"'},
        )

    return router
