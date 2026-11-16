"""The independent watchdog: alerts once after 2 failures, once on recovery, and never spams."""
import importlib.util
import json
import pathlib
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("watchdog", ROOT / "scripts" / "watchdog.py")
watchdog = importlib.util.module_from_spec(spec); spec.loader.exec_module(watchdog)


class Health(BaseHTTPRequestHandler):
    answer = {"status": "ok", "database": "up"}
    def do_GET(self):
        body = json.dumps(Health.answer).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body)
    def log_message(self, *a): pass


def serve():
    srv = HTTPServer(("127.0.0.1", 0), Health)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_port}/api/health"


def test_alerts_once_after_two_failures_and_once_on_recovery(tmp_path):
    state, mails = tmp_path / "state.json", []
    send = lambda s, b: mails.append(s)
    dead = "http://127.0.0.1:1/api/health"                       # nothing listens here
    assert watchdog.check_once(dead, state, send) == 1 and mails == []          # first failure: wait
    assert watchdog.check_once(dead, state, send) == 1 and mails == ["Nayak is DOWN"]
    assert watchdog.check_once(dead, state, send) == 1 and len(mails) == 1       # still down: no repeat
    srv, up = serve()
    try:
        assert watchdog.check_once(up, state, send) == 0
        assert mails == ["Nayak is DOWN", "Nayak is back"]
        assert watchdog.check_once(up, state, send) == 0 and len(mails) == 2     # healthy again: quiet
    finally:
        srv.shutdown()


def test_database_down_counts_as_unhealthy_and_a_single_blip_does_not_alert(tmp_path):
    state, mails = tmp_path / "s.json", []
    srv, url = serve()
    try:
        Health.answer = {"status": "error", "database": "down"}
        assert watchdog.check_once(url, state, lambda s, b: mails.append(s)) == 1 and mails == []
        Health.answer = {"status": "ok", "database": "up"}
        assert watchdog.check_once(url, state, lambda s, b: mails.append(s)) == 0
        assert mails == []                                                       # recovered before the 2nd failure: never alerted
    finally:
        Health.answer = {"status": "ok", "database": "up"}; srv.shutdown()
