"""
Sends ONE test email through the configured SMTP settings and says plainly what went wrong if it fails.
  python scripts/email_test.py you@example.com
"""
import os
import smtplib
import socket
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings
from app.services import notify_service


def main():
    if len(sys.argv) < 2 or "@" not in sys.argv[1]:
        sys.exit("Usage: email_test.py you@example.com")
    to = sys.argv[1]
    if not notify_service.email_configured():
        sys.exit("Email is not set up yet. Run ./local.sh email-setup first.")
    try:
        notify_service._smtp_send(to, "Nayak test message", "If you can read this, alerts and the daily briefing can reach you.")
    except smtplib.SMTPAuthenticationError:
        sys.exit("The mail server refused the username or password. With Gmail you need an 'app password', not your normal password (see docs/EMAIL_SETUP.md).")
    except smtplib.SMTPNotSupportedError as e:
        if "AUTH" in str(e).upper():
            sys.exit("This mail server does not support logging in, but a username is set. Leave the username empty only for a local test server.")
        sys.exit("The server does not offer a secure connection on this port. Try port 587 (or 465), or set SMTP_STARTTLS=false only for a local test server.")
    except smtplib.SMTPSenderRefused:
        sys.exit(f"The mail server does not allow sending from '{settings.SMTP_FROM}'. Use the same address you log in with.")
    except (socket.gaierror, ConnectionRefusedError, TimeoutError, OSError) as e:
        sys.exit(f"Could not reach {settings.SMTP_HOST}:{settings.SMTP_PORT} ({e.__class__.__name__}). Check the server name and port.")
    except Exception as e:
        sys.exit(f"The email could not be sent: {e}")
    print(f"Test email sent to {to}. Check the inbox (and the spam folder).")


if __name__ == "__main__":
    main()
