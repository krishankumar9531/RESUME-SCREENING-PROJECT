"""HR authentication, password hashing, SQLite user store, and signed session tokens."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from pathlib import Path
from typing import Any

from fastapi import Cookie, Depends, Header, HTTPException, status

BACKEND_DIR = Path(__file__).resolve().parent
DB_PATH = BACKEND_DIR / "hr_users.db"
SECRET_PATH = BACKEND_DIR / ".auth_secret"
SESSION_COOKIE_NAME = "talentlens_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days

DEFAULT_HR_EMAIL = "hr@talentlens.ai"
DEFAULT_HR_PASSWORD = os.environ.get("TALENTLENS_DEMO_HR_PASSWORD", "Admin@123")
DEMO_LOGIN_ENABLED = os.environ.get("TALENTLENS_DISABLE_DEMO_LOGIN", "").strip().lower() not in {
    "1", "true", "yes", "on"
}


def _get_signing_secret() -> bytes:
    env_secret = os.environ.get("HR_AUTH_SECRET")
    if env_secret:
        return env_secret.encode("utf-8")
    if SECRET_PATH.exists():
        return SECRET_PATH.read_text(encoding="utf-8").strip().encode("utf-8")
    generated = secrets.token_hex(32)
    SECRET_PATH.write_text(generated, encoding="utf-8")
    return generated.encode("utf-8")


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt_bytes = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, 200_000)
    return f"{base64.b64encode(salt_bytes).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_b64, digest_b64 = stored_hash.split("$", 1)
        salt_bytes = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
    except Exception:  # noqa: BLE001
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, 200_000)
    return hmac.compare_digest(actual, expected)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_auth_db() -> None:
    """Create HR users table and seed the demo account unless explicitly disabled."""
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS hr_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                role TEXT NOT NULL DEFAULT 'HR Recruiter',
                password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """
        )
        existing = conn.execute(
            "SELECT id FROM hr_users WHERE email = ?", (DEFAULT_HR_EMAIL,)
        ).fetchone()
        if DEMO_LOGIN_ENABLED and existing is None:
            conn.execute(
                "INSERT INTO hr_users (name, email, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                (
                    "HR Admin",
                    DEFAULT_HR_EMAIL,
                    "Lead HR Recruiter",
                    hash_password(DEFAULT_HR_PASSWORD),
                    int(time.time()),
                ),
            )
        conn.commit()


def _public_user(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "name": str(row["name"]),
        "email": str(row["email"]),
        "role": str(row["role"]),
    }


def authenticate_hr_user(email: str, password: str) -> dict[str, Any] | None:
    init_auth_db()
    clean_email = email.strip().lower()
    with _connect() as conn:
        row = conn.execute("SELECT * FROM hr_users WHERE email = ?", (clean_email,)).fetchone()
    if row is None or not verify_password(password, row["password_hash"]):
        return None
    return _public_user(row)


def create_hr_user(name: str, email: str, password: str, role: str = "HR Recruiter") -> dict[str, Any]:
    init_auth_db()
    clean_email = email.strip().lower()
    clean_name = name.strip()
    clean_role = role.strip() or "HR Recruiter"
    if not clean_name:
        raise ValueError("Full name is required.")
    if "@" not in clean_email or "." not in clean_email.split("@")[-1]:
        raise ValueError("Please enter a valid work email address.")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")

    with _connect() as conn:
        existing = conn.execute("SELECT id FROM hr_users WHERE email = ?", (clean_email,)).fetchone()
        if existing is not None:
            raise ValueError("An HR account with this email already exists.")
        cursor = conn.execute(
            "INSERT INTO hr_users (name, email, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
            (clean_name, clean_email, clean_role, hash_password(password), int(time.time())),
        )
        conn.commit()
        user_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM hr_users WHERE id = ?", (user_id,)).fetchone()
    return _public_user(row)


def get_hr_user_by_id(user_id: int) -> dict[str, Any] | None:
    init_auth_db()
    with _connect() as conn:
        row = conn.execute("SELECT * FROM hr_users WHERE id = ?", (user_id,)).fetchone()
    return _public_user(row) if row is not None else None


def create_session_token(user: dict[str, Any]) -> str:
    payload = {
        "uid": user["id"],
        "email": user["email"],
        "exp": int(time.time()) + SESSION_TTL_SECONDS,
    }
    raw = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")).decode("ascii")
    sig = hmac.new(_get_signing_secret(), raw.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{raw}.{sig}"


def verify_session_token(token: str) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None
    try:
        raw, sig = token.rsplit(".", 1)
        expected_sig = hmac.new(_get_signing_secret(), raw.encode("ascii"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload = json.loads(base64.urlsafe_b64decode(raw.encode("ascii")).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return get_hr_user_by_id(int(payload["uid"]))
    except Exception:  # noqa: BLE001
        return None


def require_hr_user(
    session_cookie: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    elif session_cookie:
        token = session_cookie

    user = verify_session_token(token) if token else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="HR authentication required. Please sign in.",
        )
    return user
