"""
The news robot's timer must follow the real clock: after a laptop sleeps, the next cycle starts at once (no database needed).
"""
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation_manager import AutomationManager


class FakeClock:
    def __init__(self):
        self.t = datetime(2026, 11, 15, 0, 58, 0)
        self.sleeps = 0

    def now(self):
        return self.t

    def sleep(self, seconds, jump=None):
        self.sleeps += 1
        self.t += timedelta(seconds=jump if jump is not None else seconds)


def test_waits_the_full_interval_when_the_machine_stays_awake():
    m, clock = AutomationManager(interval_seconds=60), FakeClock()
    m.next_scheduled_run = clock.now() + timedelta(seconds=60)
    m._wait_until_due(sleep=clock.sleep, now=clock.now)
    assert clock.sleeps == 12                          # 12 x 5 seconds


def test_catches_up_at_once_after_the_machine_slept_for_hours():
    m, clock = AutomationManager(interval_seconds=10800), FakeClock()
    m.next_scheduled_run = clock.now() + timedelta(seconds=10800)
    m._wait_until_due(sleep=lambda s: clock.sleep(s, jump=13 * 3600), now=clock.now)   # one nap that lasted 13 hours
    assert clock.sleeps == 1 and clock.now() > m.next_scheduled_run


def test_a_manual_run_that_pushes_the_schedule_forward_is_respected():
    m, clock = AutomationManager(interval_seconds=60), FakeClock()
    m.next_scheduled_run = clock.now() + timedelta(seconds=10)

    def sleep(s):
        clock.sleep(s)
        if clock.sleeps == 1:                           # someone pressed "Run news update now": the next run moves 60 s later
            m.next_scheduled_run = clock.now() + timedelta(seconds=60)
    m._wait_until_due(sleep=sleep, now=clock.now)
    assert clock.sleeps == 13                           # 1 + 12 more naps, not 2
