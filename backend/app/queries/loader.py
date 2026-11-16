"""
queries/loader.py - Zero-dependency SQL Query Loader
Loads and caches pure .sql files by query name using the standard
`-- name: <query_name>` convention (similar to aiosql / yesql).
"""

import os
from functools import lru_cache

_QUERIES_DIR = os.path.dirname(os.path.abspath(__file__))


@lru_cache(maxsize=None)
def load_queries(filename: str) -> dict[str, str]:
    """
    Parses a .sql file containing queries formatted with `-- name: <query_name>`.
    Returns a dict mapping query_name -> sql_string.
    """
    filepath = os.path.join(_QUERIES_DIR, filename)
    if not os.path.isfile(filepath):
        raise FileNotFoundError(f"SQL file not found: {filepath}")

    queries: dict[str, str] = {}
    current_name: str | None = None
    current_lines: list[str] = []

    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if stripped.startswith("-- name:"):
                if current_name and current_lines:
                    queries[current_name] = "".join(current_lines).strip()
                    current_lines = []
                current_name = stripped.split(":", 1)[1].strip()
            else:
                if current_name is not None:
                    current_lines.append(line)

        if current_name and current_lines:
            queries[current_name] = "".join(current_lines).strip()

    return queries


def get_query(filename: str, query_name: str) -> str:
    """Returns the SQL query string for a given filename and query name."""
    queries = load_queries(filename)
    if query_name not in queries:
        raise KeyError(f"Query '{query_name}' not found in {filename}. Available: {list(queries.keys())}")
    return queries[query_name]
