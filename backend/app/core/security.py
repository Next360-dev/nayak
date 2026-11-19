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

MIN_PASSWORD_LENGTH = 12

# Top common passwords rejected for self-chosen passwords (case-insensitive).
COMMON_PASSWORDS = {
    "password", "password1", "password123", "123456", "12345678", "123456789",
    "1234567890", "qwerty", "qwerty123", "abc123", "letmein", "welcome",
    "welcome1", "admin", "admin123", "iloveyou", "monkey", "dragon", "master",
    "sunshine", "princess", "football", "baseball", "superman", "trustno1",
    "passw0rd", "p@ssword", "password!", "changeme", "nayak", "telangana",
    # 12+ characters, so the length rule cannot hide them
    "password1234", "password12345", "password123456", "administrator",
    "qwertyuiop12", "1qaz2wsx3edc", "123456789012", "iloveyou1234",
    "welcome12345", "letmein12345", "abc123456789", "changeme1234",
}


def is_common_password(password: str) -> bool:
    return (password or "").strip().lower() in COMMON_PASSWORDS


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
