"""
services/auth_service.py
Authentication business logic:
  - Verifies credentials against the PostgreSQL users table (argon2 hashes)
  - Throttles repeated failed logins
  - Defines what each role may see (scope)
"""

import time
import threading
import hashlib
import secrets
import datetime

from app.core.security import (
    MIN_PASSWORD_LENGTH, create_access_token, hash_password, verify_password,
)
from app.core.config import settings
from app.repositories import audit_repository, user_repository

# Dummy hash so a missing user costs the same time as a wrong password.
_DUMMY_HASH = hash_password("not-a-real-password")

_MAX_FAILURES = 5
_WINDOW_SECONDS = 15 * 60

# Generic per-key rate limiting (in-memory, per process).
_RATE_LIMITS: dict[str, list[float]] = {}
_RATE_LIMIT_LOCK = threading.Lock()


def check_rate_limit(key: str, max_requests: int = 30, window_seconds: int = 60) -> bool:
    """Return True if the request is allowed, False if it exceeds the limit."""
    with _RATE_LIMIT_LOCK:
        now = time.time()
        cutoff = now - window_seconds
        recent = [t for t in _RATE_LIMITS.get(key, []) if t > cutoff]
        if len(recent) >= max_requests:
            _RATE_LIMITS[key] = recent
            return False
        recent.append(now)
        _RATE_LIMITS[key] = recent
        return True
def login_ip_blocked(key: str, max_failures: int = 20, window_seconds: int = _WINDOW_SECONDS) -> bool:
    """Check only (no counting): has this IP already failed enough times to be throttled?

    Only failed logins count towards the IP budget, so a busy shared connection where
    people log in successfully is never locked out by the spray protection.
    """
    with _RATE_LIMIT_LOCK:
        cutoff = time.time() - window_seconds
        recent = [t for t in _RATE_LIMITS.get(key, []) if t > cutoff]
        _RATE_LIMITS[key] = recent
        return len(recent) >= max_failures


def record_failed_login_ip(key: str) -> None:
    """Count one failed login against an IP's budget."""
    with _RATE_LIMIT_LOCK:
        _RATE_LIMITS.setdefault(key, []).append(time.time())


def _split_key(key: str) -> tuple[str, str]:
    username, _, ip = key.partition("|")
    return username, ip or "unknown"


def is_locked_out(key: str) -> bool:
    """Lockout is counted in the database (audit_log), so it survives restarts and works across processes."""
    username, ip = _split_key(key)
    try:
        return audit_repository.failed_logins_in_window(username, ip, _WINDOW_SECONDS) >= _MAX_FAILURES
    except Exception:
        return False  # never lock everyone out because the audit table is unreachable


def _record_failure(key: str) -> None:
    username, ip = _split_key(key)
    audit_repository.log("login_failed", target=username, ip=ip)


def _record_success(key: str) -> None:
    username, ip = _split_key(key)
    audit_repository.log("login_ok", actor=username, target=username, ip=ip)


def is_scoped(user: dict) -> bool:
    """
    MLAs, and staff working for an MLA, only see their own constituency.
    Ministers and their staff see statewide news. Fail-closed: a staff user whose boss
    role is missing or unexpected stays scoped.
    """
    if user["role"] == "mla":
        return True
    if user["role"] == "staff":
        return user.get("boss_role") != "minister"
    return False


def public_user(user: dict) -> dict:
    """The user object sent to the browser. No hash, plus derived scope flags."""
    role = user["role"]
    return {
        "username": user["username"],
        "role": role,
        "politician_name": user["politician_name"],
        "constituency_name": user["constituency_name"],
        "district_name": user["district_name"],
        "leader_title": user.get("leader_title"),
        "leader_party": user.get("leader_party"),
        "must_change_password": bool(user.get("must_change_password")),
        # scoped roles only ever see their own constituency's data
        "scoped": is_scoped(user),
        "can_share": role != "admin",      # the master admin only watches
        "can_share_to_anyone": False,      # kept for older clients; broadcast sharing was removed
    }


def authenticate(username: str, password: str, throttle_key: str | None = None):
    """
    Returns (user, token) on success, (None, None) on failure.
    A wrong password, unknown user, or legacy placeholder hash all fail the same way.
    """
    username = (username or "").strip().lower()
    key = throttle_key or username

    if is_locked_out(key):
        return None, None

    user, stored_hash = user_repository.find_user_with_hash(username)
    ok = verify_password(password or "", stored_hash if user else _DUMMY_HASH)
    if not (user and ok):
        _record_failure(key)
        return None, None

    _record_success(key)
    user_repository.update_user_last_login(user["username"])
    return user, create_access_token(user["username"])


def validate_new_user(username: str, password: str, role: str, mla_username: str | None):
    """Returns an error message, or None if the input is acceptable."""
    if not username or not username.strip():
        return "Username is required."
    if role not in user_repository.ROLES:
        return f"Role must be one of: {', '.join(user_repository.ROLES)}."
    if len(password or "") < MIN_PASSWORD_LENGTH:
        return f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
    if role == "staff":
        if not mla_username:
            return "Staff users must be linked to an MLA or minister (mla_username)."
        boss = user_repository.find_user_by_username(mla_username)
        if not boss or boss["role"] not in ("mla", "minister"):
            return "mla_username must be an existing active MLA or minister."
    return None


def create_user(username: str, password: str, politician_name: str,
                constituency_name: str, district_name: str, role: str,
                mla_username: str | None = None):
    return user_repository.create_user(
        username=username,
        password_hash=hash_password(password),
        politician_name=politician_name,
        constituency_name=constituency_name,
        district_name=district_name,
        role=role,
        mla_username=mla_username if role == "staff" else None,
        must_change_password=True,
    )


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256((token or "").encode("utf-8")).hexdigest()


def issue_refresh_token(username: str) -> str:
    """Mint a new refresh token, store its hash, return the raw token (shown once)."""
    token = secrets.token_urlsafe(48)
    token_hash = _hash_refresh_token(token)
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        days=settings.MOBILE_REFRESH_DAYS
    )
    user_repository.create_refresh_token(username, token_hash, expires_at)
    return token


def refresh_access_token(refresh_token: str):
    """Rotate a refresh token. Returns (access_token, new_refresh_token, error)."""
    if not refresh_token:
        return None, None, "missing"
    token_hash = _hash_refresh_token(refresh_token)
    row = user_repository.find_refresh_token(token_hash)
    if not row:
        return None, None, "invalid"
    username, expires_at, revoked_at, _replaced = row
    now = datetime.datetime.now(datetime.timezone.utc)
    if expires_at is not None and expires_at < now:
        user_repository.revoke_refresh_token(token_hash)
        return None, None, "expired"
    if revoked_at is not None:
        # Reuse of a revoked token: revoke the whole family for this user.
        user_repository.revoke_all_refresh_tokens(username)
        return None, None, "reuse"
    new_token = issue_refresh_token(username)
    user_repository.revoke_refresh_token(token_hash, replaced_by=_hash_refresh_token(new_token))
    access = create_access_token(username)
    return access, new_token, None


def revoke_refresh_token(refresh_token: str) -> None:
    if not refresh_token:
        return
    user_repository.revoke_refresh_token(_hash_refresh_token(refresh_token))


def revoke_all_refresh_tokens_for_user(username: str) -> None:
    user_repository.revoke_all_refresh_tokens(username)
