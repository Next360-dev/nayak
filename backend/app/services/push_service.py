"""
services/push_service.py
Sends push notifications via the Expo Push API.

Used as a FastAPI BackgroundTask after a share is created. Failures are
swallowed so the share operation never fails because of push.
"""

import logging

import httpx

from app.repositories import user_repository

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
logger = logging.getLogger(__name__)


def send_share_push(sender: str, share_title: str, share_id: int,
                    recipients: list[str], urgent: bool = False) -> None:
    """Send a push to every device token of every recipient. Never raises."""
    try:
        messages = []
        tokens: list[str] = []
        for rcpt in recipients or []:
            for tok in user_repository.list_device_tokens(rcpt):
                msg = {
                    "to": tok,
                    "title": sender,
                    "body": share_title,
                    "data": {"share_id": share_id},
                }
                if urgent:
                    msg["priority"] = "high"
                messages.append(msg)
                tokens.append(tok)

        if not messages:
            return

        try:
            resp = httpx.post(EXPO_PUSH_URL, json=messages, timeout=10.0)
            resp.raise_for_status()
            payload = resp.json()
        except Exception as exc:  # network / HTTP / parse errors
            logger.warning("Expo push send failed: %s", exc)
            return

        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, list):
            return
        for tok, result in zip(tokens, data):
            if isinstance(result, dict) and result.get("status") == "error":
                details = result.get("details") or {}
                if details.get("error") == "DeviceNotRegistered":
                    try:
                        user_repository.delete_device_token(tok)
                    except Exception:  # pragma: no cover
                        logger.warning("Failed to remove unregistered token %s", tok)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Unexpected push error: %s", exc)
        return


def send_work_item_push(sender: str, title: str, item_id: int,
                        recipients: list[str]) -> None:
    """Send a push about a work item to every device token of every recipient.

    The payload carries ``work_item_id`` (never ``share_id``). Never raises:
    failures are swallowed so the work-item operation never fails because of push.
    """
    try:
        messages = []
        tokens: list[str] = []
        for rcpt in recipients or []:
            for tok in user_repository.list_device_tokens(rcpt):
                msg = {
                    "to": tok,
                    "title": sender,
                    "body": title,
                    "data": {"work_item_id": item_id},
                }
                messages.append(msg)
                tokens.append(tok)

        if not messages:
            return

        try:
            resp = httpx.post(EXPO_PUSH_URL, json=messages, timeout=10.0)
            resp.raise_for_status()
            payload = resp.json()
        except Exception as exc:  # network / HTTP / parse errors
            logger.warning("Expo work-item push send failed: %s", exc)
            return

        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, list):
            return
        for tok, result in zip(tokens, data):
            if isinstance(result, dict) and result.get("status") == "error":
                details = result.get("details") or {}
                if details.get("error") == "DeviceNotRegistered":
                    try:
                        user_repository.delete_device_token(tok)
                    except Exception:  # pragma: no cover
                        logger.warning("Failed to remove unregistered token %s", tok)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Unexpected work-item push error: %s", exc)
        return
