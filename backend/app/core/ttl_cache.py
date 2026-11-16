"""
core/ttl_cache.py - a tiny in-process cache with a time limit and "single flight":
if ten requests need the same value at once, ONE computes it and the others wait and reuse it.

The key must contain everything that can change the answer (including the caller's scope), so one person can never be
served another scope's data. Values are shared, so callers must treat them as read-only.
"""
import threading
import time


class TTLCache:
    def __init__(self, max_entries: int = 256):
        self._data: dict = {}
        self._locks: dict = {}
        self._guard = threading.Lock()
        self._max = max_entries

    def get_or_compute(self, key, ttl_seconds: float, compute):
        now = time.monotonic()
        hit = self._data.get(key)
        if hit and hit[0] > now:
            return hit[1]
        with self._guard:
            lock = self._locks.setdefault(key, threading.Lock())
        with lock:                                   # single flight: the first caller computes, the rest wait here
            hit = self._data.get(key)
            if hit and hit[0] > time.monotonic():
                return hit[1]
            value = compute()
            with self._guard:
                if len(self._data) >= self._max:
                    # drop the entries that expire soonest
                    for k, _ in sorted(self._data.items(), key=lambda kv: kv[1][0])[: self._max // 4 or 1]:
                        self._data.pop(k, None); self._locks.pop(k, None)
                self._data[key] = (time.monotonic() + ttl_seconds, value)
            return value

    def clear(self):
        with self._guard:
            self._data.clear(); self._locks.clear()
