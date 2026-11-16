"""
The optional local-AI tone (Ollama): used when healthy, harmless when not. Uses a FAKE Ollama server, so no model is needed.
"""
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from app.core.config import settings
from app.services import sentiment_service as ss


class Fake(BaseHTTPRequestHandler):
    calls = 0
    mode = "normal"          # normal | down | slow | garbage

    def do_POST(self):
        Fake.calls += 1
        n = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(n))
        text = body["messages"][-1]["content"].upper()
        assert body["model"] == "fake-model" and body["stream"] is False and body["options"]["temperature"] == 0
        if Fake.mode == "slow":
            time.sleep(2)
        if Fake.mode == "down":
            self.send_response(500); self.end_headers(); return
        answer = ("I'm not sure" if Fake.mode == "garbage" else
                  "Positive." if "AWARD" in text else "NEGATIVE" if "ACCIDENT" in text else "neutral" if "MEETING" in text else "maybe")
        out = json.dumps({"message": {"role": "assistant", "content": answer}}).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(out)

    def log_message(self, *a): pass


@pytest.fixture()
def ollama(monkeypatch):
    srv = HTTPServer(("127.0.0.1", 0), Fake)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    Fake.calls, Fake.mode = 0, "normal"
    monkeypatch.setattr(settings, "OLLAMA_URL", f"http://127.0.0.1:{srv.server_port}")
    monkeypatch.setattr(settings, "OLLAMA_MODEL", "fake-model")
    monkeypatch.setattr(settings, "OLLAMA_TIMEOUT_SECONDS", 1)
    monkeypatch.setattr(settings, "SENTIMENT_NEUTRAL_FALLBACK", False)
    ss._AI_CACHE.clear(); ss.begin_cycle()
    yield Fake
    srv.shutdown()


def test_it_is_off_without_a_model_and_makes_no_network_call(monkeypatch):
    monkeypatch.setattr(settings, "OLLAMA_MODEL", "")
    monkeypatch.setattr(ss, "_ollama_label", lambda *a, **k: pytest.fail("must not be called when off"))
    assert ss.classify_tone("Hospital upgrade announced") == "positive"          # plain rules (original behaviour)


def test_the_model_decides_when_it_is_healthy(ollama):
    assert ss.classify_tone("Culture AWARD for district poet") == "positive"
    assert ss.classify_tone("Bus ACCIDENT near the ring road") == "negative"
    assert ollama.calls == 2


def test_it_can_fix_a_rule_mistake_in_either_direction(ollama):
    # "ఆందోళన" is a negative KEYWORD, but here the model reads the whole headline as an award
    assert ss._fallback_sentiment("AWARD for ఆందోళన relief team") == "negative"
    assert ss.classify_tone("AWARD for ఆందోళన relief team") == "positive"


def test_neutral_only_when_the_neutral_option_is_on(ollama, monkeypatch):
    assert ss.classify_tone("Review MEETING of officials") == "positive"           # binary design: falls back to the rules' answer
    ss._AI_CACHE.clear()
    monkeypatch.setattr(settings, "SENTIMENT_NEUTRAL_FALLBACK", True)
    assert ss.classify_tone("Review MEETING of officials") == "neutral"


def test_an_urgent_story_is_never_sent_to_the_model_or_downgraded(ollama):
    assert ss.classify_tone("Worker AWARD ceremony turned tragic", priority_score=1) == "negative"
    assert ollama.calls == 0


def test_repeated_headlines_are_asked_only_once(ollama):
    for _ in range(5):
        ss.classify_tone("Same AWARD headline")
    assert ollama.calls == 1


def test_unclear_or_failing_answers_fall_back_to_the_rules(ollama):
    ollama.mode = "garbage"
    assert ss.classify_tone("Some unclear headline one") == "positive"            # rules: no negative word
    ollama.mode = "down"
    assert ss.classify_tone("Bus accident reported two") == "negative"            # rules: negative word


def test_a_slow_server_times_out_and_the_rules_answer(ollama):
    ollama.mode = "slow"
    t = time.monotonic()
    assert ss.classify_tone("Road ACCIDENT slow case") == "negative"
    assert time.monotonic() - t < 1.9


def test_after_three_failures_the_ai_is_skipped_for_the_rest_of_the_cycle(ollama):
    ollama.mode = "down"
    for i in range(3):
        ss.classify_tone(f"failing headline {i}")
    assert ollama.calls == 3
    ollama.mode = "normal"
    assert ss.classify_tone("Culture AWARD after the outage") == "positive"       # rules answer, no new call
    assert ollama.calls == 3
    ss.begin_cycle()                                                              # next cycle: it gets another chance
    assert ss.classify_tone("Second AWARD after recovery") == "positive" and ollama.calls == 4


def test_the_per_cycle_story_budget_is_respected(ollama, monkeypatch):
    monkeypatch.setattr(settings, "OLLAMA_MAX_PER_CYCLE", 2)
    for i in range(5):
        ss.classify_tone(f"AWARD number {i}")
    assert ollama.calls == 2


def test_nothing_is_reachable_means_the_rules_answer_instantly(monkeypatch):
    monkeypatch.setattr(settings, "OLLAMA_URL", "http://127.0.0.1:1")
    monkeypatch.setattr(settings, "OLLAMA_MODEL", "fake-model")
    ss._AI_CACHE.clear(); ss.begin_cycle()
    assert ss.classify_tone("Hospital fire reported") == "negative"
