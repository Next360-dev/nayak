"""
automation_manager.py - Persistent 24/7 Background Automation Engine
Manages continuous scheduled and on-demand news scraping across all 3 collectors:
  - file1_google_rss.py (Google News RSS bilingual, 119 constituencies in native Telugu & English)
  - file2_publisher_rss.py (Top Telugu & English newspaper RSS feeds)
  - file3_html_scrapers.py (Direct 33 district HTML scrapers)

Runs continuously in the background until the server goes down.
"""

import os
import sys
import time
import json
import logging
import threading
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List

logger = logging.getLogger("automation_manager")


class AutomationManager:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(AutomationManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, interval_seconds: int = 10800, initial_delay_seconds: int = 5):
        if getattr(self, "_initialized", False):
            return
        self._initialized = True
        try:
            from app.core.config import settings
            self.interval_seconds = getattr(settings, "SCRAPE_INTERVAL_SECONDS", 10800)
            self.initial_delay_seconds = getattr(settings, "SCRAPE_INITIAL_DELAY_SECONDS", 5)
        except Exception:
            self.interval_seconds = interval_seconds  # Default 3 hours (10800s)
            self.initial_delay_seconds = initial_delay_seconds  # 5s grace period on boot to scrape immediately
        self.is_running = False
        self.lock = threading.Lock()

        self.last_run_start: datetime | None = None
        self.last_run_end: datetime | None = None
        self.next_scheduled_run: datetime | None = None
        self.total_runs_completed = 0
        self.current_stage = "Idle"

        self.last_summary: Dict[str, Any] = {
            "status": "idle",
            "duration_seconds": 0,
            "raw_collected": 0,
            "collector_breakdown": {
                "file1_google_rss": 0,
                "file2_publisher_rss": 0,
                "file3_html_scrapers": 0
            },
            "unique_clusters": 0,
            "multi_publisher_clusters": 0,
            "db_inserted": 0,
            "db_updated": 0,
            "timestamp": None
        }

        self.max_logs = 100
        self.logs_buffer: List[str] = []
        self.log_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "scraper_automation.log"
        )
        self.scheduler_thread: threading.Thread | None = None

    def add_log(self, message: str):
        """Appends log entry to memory buffer and local log file."""
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{ts}] {message}"
        self.logs_buffer.append(log_entry)
        if len(self.logs_buffer) > self.max_logs:
            self.logs_buffer.pop(0)
        try:
            with open(self.log_file_path, "a", encoding="utf-8") as f:
                f.write(log_entry + "\n")
        except Exception:
            pass

    def run_cycle_sync(self, trigger_type: str = "scheduled") -> Dict[str, Any]:
        """Runs one full scraping cycle across all 3 files synchronously."""
        if not self.lock.acquire(blocking=False):
            self.add_log(f"Scraper cycle already running. Skipping concurrent trigger ({trigger_type}).")
            return {
                "status": "already_running",
                "message": "Scraper is currently active and ingesting news across all 3 files.",
                "current_stage": self.current_stage
            }

        try:
            self.is_running = True
            self.last_run_start = datetime.now()
            self.current_stage = "Initializing"
            self.add_log(f"=== Starting 3-Source Scraper Cycle (Trigger: {trigger_type}) ===")

            backend_dir = os.path.dirname(os.path.abspath(__file__))
            t0 = time.time()
            collector_counts = {"file1_google_rss": 0, "file2_publisher_rss": 0, "file3_html_scrapers": 0}
            db_inserted = 0
            db_updated = 0

            proc = subprocess.Popen(
                [sys.executable, "main_pipeline.py"],
                cwd=backend_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1
            )

            # Stream output line by line in real time
            for line in iter(proc.stdout.readline, ''):
                clean_line = line.strip()
                if clean_line:
                    self.add_log(clean_line)
                    # Track stage transitions
                    if "file1_google_rss" in clean_line and "finished" in clean_line:
                        self.current_stage = "File 1 (Google RSS) Done"
                    elif "file2_publisher_rss" in clean_line and "finished" in clean_line:
                        self.current_stage = "File 2 (Publisher RSS) Done"
                    elif "file3_html_scrapers" in clean_line and "finished" in clean_line:
                        self.current_stage = "File 3 (HTML Scrapers) Done"
                    elif "LAYER 2" in clean_line or "Deduplication" in clean_line:
                        self.current_stage = "Deduplicating & Clustering"
                    elif "LAYER 3" in clean_line or "PERSISTING" in clean_line:
                        self.current_stage = "Saving to Database"
                    elif "Database sync complete" in clean_line:
                        # Extract inserted/updated numbers
                        import re
                        m = re.search(r'(\d+)\s+inserted,\s+(\d+)\s+updated', clean_line)
                        if m:
                            db_inserted = int(m.group(1))
                            db_updated = int(m.group(2))

            proc.wait()
            duration = round(time.time() - t0, 2)
            self.total_runs_completed += 1
            self.last_run_end = datetime.now()
            self.current_stage = "Completed"

            self.add_log(f"=== Scraping cycle finished in {duration}s (Exit code: {proc.returncode}) ===")

            summary = {
                "status": "success" if proc.returncode == 0 else "error",
                "duration_seconds": duration,
                "db_inserted": db_inserted,
                "db_updated": db_updated,
                "exit_code": proc.returncode,
                "timestamp": self.last_run_end.isoformat()
            }
            self.last_summary = summary
            return summary

        except Exception as e:
            self.add_log(f"Scraping cycle error: {e}")
            summary = {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
            self.last_summary = summary
            return summary
        finally:
            self.is_running = False
            self.current_stage = "Idle"
            self.next_scheduled_run = datetime.now() + timedelta(seconds=self.interval_seconds)
            self.add_log(f"Next automated run scheduled at: {self.next_scheduled_run.strftime('%I:%M:%S %p')}")
            self.lock.release()

    def trigger_async(self) -> Dict[str, Any]:
        """Triggers a scraping cycle asynchronously in a background worker thread."""
        if self.is_running:
            return {
                "status": "already_running",
                "message": "Scraper is currently active and ingesting news across all 3 files.",
                "current_stage": self.current_stage
            }

        t = threading.Thread(target=self.run_cycle_sync, args=("manual_ui",), daemon=True)
        t.start()
        return {
            "status": "triggered",
            "message": "Daily news scraping started in background across Google RSS, Publisher RSS, and District HTML crawlers.",
            "current_stage": "Starting"
        }

    def _loop(self):
        """Infinite scheduler loop: runs immediately on server boot, then every 3 hours continuously."""
        interval_hrs = self.interval_seconds / 3600
        self.add_log(f"Automation manager loop started. Initial boot scraping begins in {self.initial_delay_seconds}s, recurring every {interval_hrs:.1f} hours ({self.interval_seconds}s).")
        time.sleep(self.initial_delay_seconds)

        while True:
            try:
                run_type = "server_startup" if self.total_runs_completed == 0 else f"scheduled_{int(interval_hrs)}h_cycle"
                self.run_cycle_sync(trigger_type=run_type)
            except Exception as e:
                self.add_log(f"Unhandled error in scheduler loop: {e}")

            self._wait_until_due()

    def _wait_until_due(self, sleep=time.sleep, now=datetime.now):
        """Waits for the next run by comparing the REAL clock (not by counting sleeps).
        A laptop that was suspended does not count sleep time, so counting would stall the 3-hour timer for as long as the
        machine slept; with the real clock the next cycle starts within a few seconds of waking. A manual run pushes
        `next_scheduled_run` forward, which is re-read each time so it never causes a double run."""
        fallback = now() + timedelta(seconds=self.interval_seconds)
        while now() < (self.next_scheduled_run or fallback):
            sleep(5)

    def start_scheduler(self):
        """Starts the persistent background daemon thread."""
        if self.scheduler_thread and self.scheduler_thread.is_alive():
            return
        self.scheduler_thread = threading.Thread(target=self._loop, daemon=True, name="AutoScraperDaemon")
        self.scheduler_thread.start()
        interval_hrs = self.interval_seconds / 3600
        self.add_log(f"Persistent 24/7 background scraper daemon activated (Every {interval_hrs:.1f} hours).")

    def get_status(self) -> Dict[str, Any]:
        """Returns current operational status and countdown for frontend display."""
        now = datetime.now()
        seconds_until_next = 0
        if self.next_scheduled_run and self.next_scheduled_run > now:
            seconds_until_next = int((self.next_scheduled_run - now).total_seconds())

        return {
            "is_running": self.is_running,
            "current_stage": self.current_stage,
            "last_run_start": self.last_run_start.isoformat() if self.last_run_start else None,
            "last_run_end": self.last_run_end.isoformat() if self.last_run_end else None,
            "next_scheduled_run": self.next_scheduled_run.isoformat() if self.next_scheduled_run else None,
            "seconds_until_next": seconds_until_next,
            "interval_hours": round(self.interval_seconds / 3600, 2),
            "interval_minutes": self.interval_seconds // 60,
            "total_runs_completed": self.total_runs_completed,
            "last_summary": self.last_summary
        }

    def get_logs(self, limit: int = 50) -> List[str]:
        """Returns the most recent log lines."""
        return self.logs_buffer[-limit:]


# Singleton global manager instance
automation_manager = AutomationManager()
