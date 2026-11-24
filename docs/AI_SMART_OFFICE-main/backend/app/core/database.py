"""
core/database.py - PostgreSQL Connection Factory
Single place responsible for creating DB connections.
All repositories import get_connection() from here.
"""

import psycopg2
from app.core.config import settings


def get_connection():
    """Returns a new psycopg2 connection using settings from .env."""
    return psycopg2.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
    )
