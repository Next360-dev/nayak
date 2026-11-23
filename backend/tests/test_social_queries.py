"""Query building and relevance filtering for the social scraper (pure logic, no database, no network)."""
import urllib.error
from unittest import mock

import social_media_scraper as sm


def test_name_variants_drop_titles_and_keep_last_two_words():
    assert sm.name_variants("Dr. Chikudu Vamshi Krishna") == ("Chikudu Vamshi Krishna", "Vamshi Krishna")
    assert sm.name_variants("Sri Anumula Revanth Reddy") == ("Anumula Revanth Reddy", "Revanth Reddy")
    assert sm.name_variants("K. T. Rama Rao") == ("K T Rama Rao", "Rama Rao")
    assert sm.name_variants("Harish Rao") == ("Harish Rao", "Harish Rao")


def test_constituency_suffix_is_removed():
    assert sm.constituency_base("Achampet (SC)") == "Achampet"
    assert sm.constituency_base("Sircilla") == "Sircilla"


def test_queries_go_from_exact_to_loose_without_duplicates():
    qs = sm.search_queries("Dr. Chikudu Vamshi Krishna", "Achampet (SC)", "site:x.com")
    assert qs == ['"Chikudu Vamshi Krishna" site:x.com', '"Vamshi Krishna" Achampet site:x.com']
    assert sm.search_queries("Harish Rao", "Siddipet", "site:x.com") == ['"Harish Rao" site:x.com']


def test_only_items_naming_the_person_are_kept():
    name = "Dr. Chikudu Vamshi Krishna"
    assert sm.mentions_leader("MLA Vamshi Krishna inaugurates health camp in Achampet", name)
    assert sm.mentions_leader("Chikudu Vamshi Krishna speaks", name)
    assert not sm.mentions_leader("Achampet municipality road works begin", name)
    assert not sm.mentions_leader("", name)


def test_rate_limit_is_retried_once_then_reported(caplog):
    err = urllib.error.HTTPError("u", 429, "Too Many Requests", {}, None)
    with mock.patch.object(sm.urllib.request, "urlopen", side_effect=err) as op, mock.patch.object(sm.time, "sleep"):
        with caplog.at_level("WARNING"):
            assert sm._fetch_feed("http://x", "twitter", "q") is None
    assert op.call_count == 2                       # tried again once
    assert "HTTP 429" in caplog.text                # and said so, instead of failing silently


def test_description_that_only_repeats_the_title_is_not_added_twice():
    assert sm.join_title_and_description("MLA opens clinic", "MLA opens clinic YouTube") == "MLA opens clinic"
    assert sm.join_title_and_description("MLA opens clinic", "") == "MLA opens clinic"
    assert sm.join_title_and_description("MLA opens clinic", "Crowd gathered at the village hall") == "MLA opens clinic. Crowd gathered at the village hall"


# ── automatic background refresh ─────────────────────────────────────────────
import pytest

from app.services import social_media_service as svc


class _InlineThread:
    """Runs the crawl immediately so the test can see its effect."""
    def __init__(self, target, args=(), **_):
        self._target, self._args = target, args

    def start(self):
        self._target(*self._args)


@pytest.fixture()
def crawler(monkeypatch):
    monkeypatch.setenv("SOCIAL_AUTO_CRAWL", "1")
    monkeypatch.setattr(svc.threading, "Thread", _InlineThread)
    svc._crawling.clear()
    svc._last_crawl.clear()
    calls = []
    monkeypatch.setattr(svc, "trigger_social_media_scrape", lambda c, m=None, force=False: calls.append((c, m)) or {"status": "success"})
    yield calls
    svc._crawling.clear()
    svc._last_crawl.clear()


def test_stale_constituency_gets_one_background_crawl_then_is_fresh(crawler):
    assert svc.kick_crawl_if_stale("Achampet (SC)", "Dr. Chikudu Vamshi Krishna") is True
    assert crawler == [("Achampet (SC)", "Dr. Chikudu Vamshi Krishna")]
    assert svc.kick_crawl_if_stale("Achampet (SC)", "Dr. Chikudu Vamshi Krishna") is False   # just crawled: no second crawl
    assert len(crawler) == 1
    assert not svc.is_crawling("Achampet (SC)")


def test_crawl_runs_again_once_the_data_is_older_than_the_limit(crawler):
    svc.kick_crawl_if_stale("Achampet", None)
    svc._last_crawl[svc._crawl_key("Achampet")] -= svc.CRAWL_STALE_SECONDS + 1
    assert svc.kick_crawl_if_stale("Achampet", None) is True
    assert len(crawler) == 2


def test_a_crawl_already_running_is_not_started_twice(crawler):
    svc._crawling.add(svc._crawl_key("Achampet (SC)"))
    assert svc.kick_crawl_if_stale("Achampet", None) is True    # reported as refreshing, but no new crawl
    assert crawler == []
    assert svc.is_crawling("Achampet (SC)")


def test_no_crawl_without_a_specific_constituency(crawler):
    for c in (None, "", "All", "Statewide"):
        assert svc.kick_crawl_if_stale(c, None) is False
    assert crawler == []


def test_the_switch_turns_auto_crawl_off(crawler, monkeypatch):
    monkeypatch.setenv("SOCIAL_AUTO_CRAWL", "0")
    assert svc.kick_crawl_if_stale("Achampet", None) is False
    assert crawler == []


def test_a_failed_crawl_does_not_crash_and_is_retried_sooner(crawler, monkeypatch):
    def boom(c, m=None, force=False):
        raise RuntimeError("network down")
    monkeypatch.setattr(svc, "trigger_social_media_scrape", boom)
    assert svc.kick_crawl_if_stale("Achampet", None) is True    # no exception escapes
    assert not svc.is_crawling("Achampet")                       # the "running" flag is always cleared
    age = svc.time.time() - svc._last_crawl[svc._crawl_key("Achampet")]
    assert svc.CRAWL_STALE_SECONDS - age == pytest.approx(svc.CRAWL_RETRY_AFTER_FAILURE_SECONDS, abs=5)


def test_description_that_differs_only_by_the_platform_tail_is_still_a_repeat():
    title = "Union Minister said Karimnagar is a stronghold. The event was att - Instagram"
    desc = "Union Minister said Karimnagar is a stronghold. The event was att Instagram"
    assert sm.join_title_and_description(title, desc) == title


# ── honest tone, ids, authors, dates ─────────────────────────────────────────
from datetime import datetime


def test_post_without_tone_words_is_neutral_not_positive():
    tone, why = sm.classify_social_post_sentiment("MLA attends meeting at the mandal office", "Dr. X", "youtube")
    assert tone == "neutral" and "not clear" in why


def test_reason_names_the_words_that_decided_it():
    tone, why = sm.classify_social_post_sentiment("MLA inaugurates new hospital block", "Dr. X", "youtube")
    assert tone == "positive" and '"inaugurat"' in why and '"hospital"' in why
    tone, why = sm.classify_social_post_sentiment("Farmers protest over water shortage", "Dr. X", "youtube")
    assert tone == "negative" and '"protest"' in why


def test_short_words_do_not_fire_inside_other_words():
    # "fir" used to match "first" and "confirm"; "fund" used to match "refund"
    assert sm.classify_social_post_sentiment("First meeting confirmed, refund announced", "Dr. X", "x")[0] == "neutral"
    assert sm.classify_social_post_sentiment("FIR filed against contractor", "Dr. X", "x")[0] == "negative"


def test_mixed_signals_are_flagged_and_labelled_mixed():
    tone, why = sm.classify_social_post_sentiment("Opposition slams delay in hospital works", "Dr. X", "x")
    assert tone == "negative" and why.startswith("Mixed")


def test_telugu_tone_words_still_work():
    assert sm.classify_social_post_sentiment("రోడ్డు అభివృద్ధి పనులు ప్రారంభం", "Dr. X", "x")[0] == "positive"
    assert sm.classify_social_post_sentiment("తాగునీటి కొరతపై నిరసన", "Dr. X", "x")[0] == "negative"


def test_post_ids_are_stable_not_process_random():
    assert sm.make_post_id("youtube", "https://news.google.com/rss/articles/abc") == "youtube_c54b36c82092"   # fixed value: same on every run
    assert sm.make_post_id("youtube", "https://a") != sm.make_post_id("youtube", "https://b")


def test_authors_are_never_invented():
    assert sm.extract_author_handle("instagram", "Some post - Instagram", "") == (None, None)
    assert sm.extract_author_handle("facebook", "Some post", "Local Daily") == ("Local Daily", None)   # a real publisher, no fake handle
    assert sm.extract_author_handle("twitter", "Thread by @realuser on roads", "") == ("@realuser", "@realuser")
    name, handle = sm.extract_author_handle("youtube", "Speech | V6 News - YouTube", "YouTube")
    assert name == "V6 News" and handle is None


def test_a_missing_or_bad_date_is_not_replaced_by_now():
    assert sm.parse_date("") is None
    assert sm.parse_date("not a date") is None
    assert isinstance(sm.parse_date("Mon, 23 Nov 2026 10:00:00 GMT"), datetime)


# ── limits on crawling ───────────────────────────────────────────────────────
def test_manual_scrape_right_after_a_crawl_is_skipped_and_says_so(monkeypatch):
    svc._last_crawl.clear(); svc._crawling.clear()
    scraped = []
    monkeypatch.setattr(svc, "scrape_social_media_for_mla", lambda *a, **k: scraped.append(a) or [])
    monkeypatch.setattr(svc, "save_social_posts_to_db", lambda posts: (0, 0))
    first = svc.trigger_social_media_scrape("Achampet", "Dr. X")
    second = svc.trigger_social_media_scrape("Achampet", "Dr. X")
    assert "skipped" not in first and second["skipped"] == "recent"
    assert len(scraped) == 1                       # Google was asked once, not twice
    svc._last_crawl.clear()


def test_no_more_than_the_limit_of_crawls_run_at_once(crawler):
    for i in range(svc.MAX_CONCURRENT_CRAWLS):
        svc._crawling.add(f"busy-{i}")
    assert svc.kick_crawl_if_stale("Achampet", None) is False
    assert crawler == []
