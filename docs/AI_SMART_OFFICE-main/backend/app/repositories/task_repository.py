"""
repositories/task_repository.py
Dispatches task queries loaded from queries/tasks.sql.
"""

import os
from app.core.database import get_connection
from app.queries import get_query

_SQL_FETCH_TASKS = get_query("tasks.sql", "fetch_tasks")
_SQL_INSERT_TASK = get_query("tasks.sql", "insert_task")


def fetch_tasks(constituency: str | None = None):
    """Fetches recently assigned tasks."""
    connection = get_connection()
    cursor = None
    try:
        cursor = connection.cursor()
        cursor.execute(_SQL_FETCH_TASKS)
        rows = cursor.fetchall()
        return [
            {
                "id": r[0], "title": r[1],
                "department": r[2] or "Constituency Cell",
                "status": str(r[3]), "priority": str(r[4]),
            }
            for r in rows
        ]
    finally:
        if cursor: cursor.close()
        if connection: connection.close()


def insert_task(title: str, department: str, priority: str = "High"):
    """Inserts a new task."""
    connection = get_connection()
    cursor = None
    try:
        cursor = connection.cursor()
        task_id = f"TSK-{os.urandom(2).hex().upper()}"
        cursor.execute(_SQL_INSERT_TASK, (task_id, title, department, priority, "Assigned"))
        connection.commit()
        return {
            "id": task_id, "title": title, "department": department,
            "status": "Assigned", "priority": priority
        }
    finally:
        if cursor: cursor.close()
        if connection: connection.close()
