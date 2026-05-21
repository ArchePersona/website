"""
Supabase auth + memories helpers for BRUNEL.
- Verifies user JWTs via Supabase auth API.
- Reads/writes public.memories using the user's JWT (RLS-scoped, ownership-only).
- Service role key, if present, is reserved for future admin tasks; not used in the user data path.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import Header, HTTPException, status
from supabase import Client, create_client

# Ensure .env is loaded before reading SUPABASE_* vars (this module is imported
# before server.py's top-level load_dotenv call).
load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger("brunel.supabase")

SUPABASE_URL: Optional[str] = os.environ.get("SUPABASE_URL") or None
SUPABASE_ANON_KEY: Optional[str] = os.environ.get("SUPABASE_ANON_KEY") or None
SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or None

# A single anon-key client used solely to verify JWTs.
_anon_client: Optional[Client] = None
if SUPABASE_URL and SUPABASE_ANON_KEY:
    try:
        _anon_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        logger.info("Supabase anon client initialised.")
    except Exception as e:
        logger.exception("Failed to init Supabase anon client: %s", e)


def supabase_configured() -> bool:
    return _anon_client is not None


async def get_current_user(authorization: str = Header(None)) -> dict:
    """FastAPI dependency: verify the bearer JWT against Supabase, return user dict."""
    if _anon_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth backend not configured.",
        )
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        resp = _anon_client.auth.get_user(token)
    except Exception as e:
        logger.warning("JWT verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from e
    user = getattr(resp, "user", None)
    if user is None or not getattr(user, "id", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token (no user).",
        )
    return {
        "id": user.id,
        "email": getattr(user, "email", None),
        "token": token,
    }


def _user_scoped_client(user_jwt: str) -> Client:
    """Anon-key client whose PostgREST requests are signed with the user's JWT,
    so RLS policies enforce auth.uid() = user_id automatically."""
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    # Set the auth header used by PostgREST (and downstream services).
    client.postgrest.auth(user_jwt)
    return client


def fetch_recent_memories(user_jwt: str, user_id: str, persona: str = "brunel", limit: int = 10) -> list[dict]:
    """SELECT memory_text, category, created_at FROM public.memories
    WHERE user_id = auth.uid() AND persona=? AND confirmed AND private
    ORDER BY created_at DESC LIMIT ?"""
    if _anon_client is None:
        return []
    try:
        client = _user_scoped_client(user_jwt)
        resp = (
            client.table("memories")
            .select("memory_text, category, created_at")
            .eq("user_id", user_id)
            .eq("persona", persona)
            .eq("confirmed", True)
            .eq("private", True)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return list(resp.data or [])
    except Exception as e:
        logger.warning("fetch_recent_memories failed: %s", e)
        return []


def insert_memory(
    user_jwt: str,
    user_id: str,
    memory_text: str,
    category: str = "general",
    persona: str = "brunel",
) -> bool:
    """INSERT into public.memories with persona=brunel, confirmed=true, private=true.
    user_id must match auth.uid() per RLS."""
    if _anon_client is None:
        return False
    try:
        client = _user_scoped_client(user_jwt)
        client.table("memories").insert({
            "user_id": user_id,
            "persona": persona,
            "memory_text": memory_text,
            "category": category,
            "confirmed": True,
            "private": True,
        }).execute()
        return True
    except Exception as e:
        logger.warning("insert_memory failed: %s", e)
        return False


# ---------------------------------------------------------------------------
# Light category detection for fact strings produced by rk_engine.extract_facts.
# Map "Their name is X." -> identity, "They like X" -> preference, etc.
# ---------------------------------------------------------------------------
def categorize_fact(fact: str) -> str:
    f = fact.lower()
    if f.startswith("their name is"):
        return "identity"
    if f.startswith("they like") or f.startswith("they dislike"):
        return "preference"
    if f.startswith("they have"):
        return "possession"
    if f.startswith("they work"):
        return "work"
    return "general"
