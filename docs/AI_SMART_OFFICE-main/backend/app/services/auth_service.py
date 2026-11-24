"""
services/auth_service.py
Authentication business logic:
  - Validates credentials strictly against PostgreSQL users table
"""

from app.repositories import user_repository


def authenticate(username: str, password: str):
    """
    Returns user dict on success, None on failure.
    Authenticates directly from PostgreSQL users table.
    """
    username = username.strip().lower()

    # 1. Direct database lookup in users table
    db_user = user_repository.find_user_by_username(username)
    if db_user:
        return db_user

    # 2. Support without 'mla_' prefix (e.g. typing "mulugu" -> looks up "mla_mulugu" in DB)
    if not username.startswith("mla_"):
        db_user = user_repository.find_user_by_username(f"mla_{username}")
        if db_user:
            return db_user

    return None
