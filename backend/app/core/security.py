"""
core/security.py - Password hashing and JWT helpers.

- Passwords: argon2id (argon2-cffi). Plain passwords are never stored or logged.
- Tokens: HS256 JWT signed with JWT_SECRET. The token carries only the username;
  role and scope are always re-read from the database on each request, so a
  role change or deactivation takes effect immediately.
"""

import time
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

from app.core.config import settings

_hasher = PasswordHasher()

MIN_PASSWORD_LENGTH = 8


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, stored_hash: str | None) -> bool:
    """True only for a valid argon2 hash that matches. Legacy placeholder hashes never match."""
    if not stored_hash or not stored_hash.startswith("$argon2"):
        return False
    try:
        return _hasher.verify(stored_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def create_access_token(username: str) -> str:
    now = time.time()
    payload = {
        "sub": username,
        "iat": now,  # sub-second precision: compared with users.password_changed_at to end old sessions
        "exp": int(now) + settings.JWT_EXPIRE_MINUTES * 60,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_access_token_full(token: str) -> tuple[str, float] | None:
    """Returns (username, issued_at_epoch_seconds) from a valid token, else None."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    sub = payload.get("sub")
    if not (isinstance(sub, str) and sub):
        return None
    return sub, float(payload.get("iat") or 0)


def decode_access_token(token: str) -> str | None:
    """Returns the username from a valid token, else None."""
    full = decode_access_token_full(token)
    return full[0] if full else None
