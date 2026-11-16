"""
services/notify_service.py - sends one message to one person by email, at most once per (kind, key).

Email is OFF until SMTP_HOST and SMTP_FROM are configured; nothing is ever sent without that. Every attempt is logged in
notification_log so the same alert is never sent twice, even across restarts. Never raises: a failed email must not break
the action that caused it.
"""
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings
from app.repositories import notification_repository, user_repository

logger = logging.getLogger(__name__)


def email_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM)


def _smtp_send(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = settings.SMTP_FROM, to, subject
    msg.set_content(body)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        if settings.SMTP_STARTTLS:
            smtp.starttls(context=ssl.create_default_context())
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(msg)


def deliver(kind: str, key: str, username: str, subject: str, body: str, force: bool = False) -> str:
    """Returns 'sent', 'skipped:<why>' or 'failed'. `force` ignores the alerts switch and the send-once rule (test emails)."""
    try:
        who = user_repository.contact_of(username)
        if not who or not who["email"]:
            return "skipped:no_email"
        if not who["alerts_enabled"] and not force:
            return "skipped:alerts_off"
        if not email_configured():
            return "skipped:not_configured"
        if not force and notification_repository.already_sent(kind, key, who["username"]):
            return "skipped:duplicate"
        try:
            _smtp_send(who["email"], subject, body)
        except Exception as exc:  # network, auth, refused...
            logger.warning("email to %s failed: %s", who["username"], exc)
            notification_repository.record(kind, key, who["username"], False, str(exc))
            return "failed"
        if not force:
            notification_repository.record(kind, key, who["username"], True)
        return "sent"
    except Exception:
        logger.warning("notify %s/%s crashed", kind, username, exc_info=True)
        return "failed"
