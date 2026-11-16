"""
Independent health watcher: run it every few minutes from cron. It lives OUTSIDE the app, so it can tell you when the app
itself is down (the app cannot email you about its own death).

  - Checks WATCHDOG_URL (default http://127.0.0.1:<PORT>/api/health).
  - After 2 failures in a row it emails WATCHDOG_EMAIL_TO once ("DOWN"); when it is healthy again it emails once ("back").
  - Uses the same SMTP_* settings as the app (./local.sh email-setup). Exit code 0 = healthy, 1 = unhealthy.
Does not need the database, so it still works when the database is the thing that is down.
"""
import json
import os
import pathlib
import sys
import time
import urllib.request

FAILS_BEFORE_ALERT = 2


def is_healthy(url: str, timeout: float = 10) -> tuple[bool, str]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            body = json.loads(r.read().decode("utf-8", "replace") or "{}")
        if r.status == 200 and body.get("status") == "ok" and body.get("database") == "up":
            return True, "ok"
        return False, f"unhealthy answer: {body}"
    except Exception as e:  # refused, timeout, 5xx, bad JSON ...
        return False, f"{e.__class__.__name__}: {e}"


def check_once(url: str, state_path: pathlib.Path, send) -> int:
    """One check. `send(subject, body)` emails the owner. Returns 0 healthy / 1 unhealthy."""
    state = {"fails": 0, "alerted": False}
    if state_path.exists():
        try:
            state.update(json.loads(state_path.read_text()))
        except Exception:
            pass
    ok, why = is_healthy(url)
    if ok:
        if state["alerted"]:
            send("Nayak is back", f"The app answered again at {time.strftime('%Y-%m-%d %H:%M')}.\n{url}")
        state = {"fails": 0, "alerted": False}
    else:
        state["fails"] += 1
        if state["fails"] >= FAILS_BEFORE_ALERT and not state["alerted"]:
            send("Nayak is DOWN", f"{url} failed {state['fails']} checks in a row.\nLast problem: {why}\n\nOn the server run: ./local.sh status  and  ./local.sh logs")
            state["alerted"] = True
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state))
    return 0 if ok else 1


def main():
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    url = os.environ.get("WATCHDOG_URL") or f"http://127.0.0.1:{os.environ.get('PORT', '8000')}/api/health"
    state = pathlib.Path(os.environ.get("WATCHDOG_STATE") or pathlib.Path.home() / ".config" / "ai-smart-office" / "watchdog.json")
    to = os.environ.get("WATCHDOG_EMAIL_TO", "").strip()

    def send(subject, body):
        if not to:
            print("(no WATCHDOG_EMAIL_TO set, so no email was sent)", subject)
            return
        from app.services import notify_service
        if not notify_service.email_configured():
            print("(email is not set up: run ./local.sh email-setup)", subject)
            return
        try:
            notify_service._smtp_send(to, subject, body)
        except Exception as e:
            print("could not send the alert email:", e)

    code = check_once(url, state, send)
    print("healthy" if code == 0 else "UNHEALTHY")
    sys.exit(code)


if __name__ == "__main__":
    main()
