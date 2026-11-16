"""
news_window.py - how far back the collectors look. ONE place, shared by all three collectors and the quick refresh.

NEWS_WINDOW_HOURS (default 48): every run collects the last 48 hours, so a gap (a sleeping laptop, a missed run) is
filled on the next run, and stories are stored for 60 days anyway (nothing is overwritten; repeats are merged).
The app shows the last 24 hours as "latest" and 24 to 48 hours (and older) in the Archive.
"""
import math
import os

NEWS_WINDOW_HOURS = float(os.getenv("NEWS_WINDOW_HOURS", "48"))
GOOGLE_WHEN = f"{max(1, math.ceil(NEWS_WINDOW_HOURS / 24))}d"       # Google News "when:2d"
