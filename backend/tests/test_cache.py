"""The short-lived shared cache: shares work, never mixes scopes, expires, and only one caller computes at once."""
import threading
import time

from app.core.ttl_cache import TTLCache


def test_same_key_is_computed_once_until_it_expires():
    c, calls = TTLCache(), []
    f = lambda: calls.append(1) or "v"
    assert c.get_or_compute("k", 0.2, f) == "v" and c.get_or_compute("k", 0.2, f) == "v"
    assert len(calls) == 1
    time.sleep(0.25)
    c.get_or_compute("k", 0.2, f)
    assert len(calls) == 2


def test_different_keys_never_share_a_value():
    c = TTLCache()
    assert c.get_or_compute(("mla", "Sircilla"), 5, lambda: "sircilla") == "sircilla"
    assert c.get_or_compute(("mla", "Mulugu"), 5, lambda: "mulugu") == "mulugu"
    assert c.get_or_compute(("statewide",), 5, lambda: "all") == "all"


def test_only_one_of_many_simultaneous_callers_computes():
    c, calls, out = TTLCache(), [], []
    def slow():
        calls.append(1); time.sleep(0.3); return "done"
    ts = [threading.Thread(target=lambda: out.append(c.get_or_compute("k", 5, slow))) for _ in range(12)]
    [t.start() for t in ts]; [t.join() for t in ts]
    assert len(calls) == 1 and out == ["done"] * 12


def test_it_never_grows_without_limit():
    c = TTLCache(max_entries=8)
    for i in range(50):
        c.get_or_compute(i, 60, lambda i=i: i)
    assert len(c._data) <= 8
