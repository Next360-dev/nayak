"""Ingestion filter + cross-district duplicate merge (pure logic, no database needed)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from deduplication import is_non_governance_content, merge_cross_bin_duplicates

TT = "https://telanganatoday.com/"


def test_andhra_story_from_telangana_publisher_is_rejected():
    # The publisher's domain must not count as Telangana context.
    assert is_non_governance_content("Andhra Pradesh seeks national law to protect investors", "", TT + "andhra-pradesh-seeks-national-law")
    assert is_non_governance_content("Chandrababu Naidu meets Japanese envoy", "", TT + "chandrababu-naidu-meets-japanese-envoy")


def test_other_state_story_from_telangana_publisher_is_rejected():
    assert is_non_governance_content("Bulldozer removes shed outside MP's residence in Kolkata", "", TT + "bulldozer-kolkata")


def test_genuine_telangana_story_is_kept():
    assert not is_non_governance_content("Revanth Reddy inaugurates road in Sircilla", "", TT + "revanth-reddy-road")
    assert not is_non_governance_content("Chandrababu Naidu meets Revanth Reddy over Krishna water dispute in Hyderabad", "", "")


def _c(title, district, constituency, publisher, url):
    return {"title": title, "district": district, "constituency": constituency, "constituencies": [],
            "civic_constituencies": [], "summary": "s", "sources": [{"publisher": publisher, "url": url}]}


def test_same_story_in_statewide_and_district_is_merged_with_both_sources():
    out = merge_cross_bin_duplicates([
        _c("Water crisis hits city", "Statewide", "Statewide", "Sakshi", "http://a/1"),
        _c("Water crisis hits city", "Hyderabad", "Statewide", "Eenadu", "http://b/2"),
    ])
    assert len(out) == 1
    assert out[0]["district"] == "Hyderabad"
    assert len(out[0]["sources"]) == 2


def test_generic_title_in_two_different_districts_is_not_merged():
    out = merge_cross_bin_duplicates([
        _c("Farmer ends life over debts", "Adilabad", "Statewide", "Sakshi", "http://a/1"),
        _c("Farmer ends life over debts", "Mancherial", "Statewide", "Eenadu", "http://b/2"),
    ])
    assert len(out) == 2


# ── rules added after a spot check of real headlines ─────────────────────────
def test_kashmir_ladakh_and_sports_and_price_tickers_are_filtered():
    assert is_non_governance_content("Searches continue for Kulgam terrorists", "", "https://x.example/a")
    assert is_non_governance_content("Leh protest to intensify, Wangchuk says he is under house detention", "", "https://x.example/b")
    assert is_non_governance_content("అట్టహాసంగా హ్యాండ్‌బాల్‌ టోర్నీ", "", "https://x.example/c")
    assert is_non_governance_content("క్వింటాల్‌ పత్తి రూ.8,810", "", "https://x.example/d")


def test_real_telangana_stories_are_still_kept():
    assert not is_non_governance_content("రైతులకు మద్దతు ధర ప్రకటించిన ప్రభుత్వం", "", "https://x.example/e")      # policy news about prices stays
    assert not is_non_governance_content("Revanth Reddy reviews Kashmir flood relief aid sent from Hyderabad", "", "https://x.example/f")  # Telangana context wins


def test_clearly_negative_telugu_headlines_are_not_shown_as_positive():
    from app.services.sentiment_service import _fallback_sentiment
    for title in ("కానిస్టేబుళ్ల కారు బీభత్సం", "దుబాయ్‌ కల చెదిరింది!", "అదే చిన్నచూపు..!"):
        assert _fallback_sentiment(title) == "negative", title
    assert _fallback_sentiment("జిల్లా కవికి కాళోజీ పురస్కారం") == "positive"


# ── speed-ups must never change an answer ────────────────────────────────────
def test_similarity_shortcut_always_agrees_with_the_full_calculation():
    import itertools
    import random
    from difflib import SequenceMatcher
    from deduplication import _similar
    random.seed(3)
    words = ["water", "road", "repair", "hospital", "school", "protest", "bridge", "fire", "metro", "ration", "ఆసుపత్రి", "రోడ్డు", "నీరు"]
    titles = [" ".join(random.sample(words, random.randint(2, 6))) for _ in range(60)]
    for a, b in itertools.combinations(titles, 2):
        assert _similar(a, b, 0.70) == (SequenceMatcher(None, a, b).ratio() >= 0.70), (a, b)


def test_cached_keywords_cannot_be_changed_by_a_caller():
    from deduplication import extract_core_keywords
    first = extract_core_keywords("Hospital upgrade announced in Siddipet district")
    first.add("poison")
    assert "poison" not in extract_core_keywords("Hospital upgrade announced in Siddipet district")


# ── optional honest "neutral" tone (OFF by default) ──────────────────────────
def test_neutral_tone_is_off_by_default_and_changes_nothing_then():
    from app.services.sentiment_service import _fallback_sentiment
    assert _fallback_sentiment("ఎంఎస్‌టీ కింద అదనపు సౌకర్యాలు: ఆర్‌ఎం") == "positive"       # original behaviour


def test_neutral_tone_when_switched_on():
    from app.services.sentiment_service import _fallback_sentiment as f
    assert f("ఎంఎస్‌టీ కింద అదనపు సౌకర్యాలు: ఆర్‌ఎం", neutral_fallback=True) == "neutral"          # nothing clear either way
    assert f("Minister inaugurates new bridge in Karimnagar", neutral_fallback=True) == "positive"
    assert f("జిల్లా కవికి కాళోజీ పురస్కారం", neutral_fallback=True) == "positive"
    assert f("కానిస్టేబుళ్ల కారు బీభత్సం", neutral_fallback=True) == "negative"                   # negatives are unaffected
    assert f("Road accident on highway", neutral_fallback=True) == "negative"


def test_the_switch_is_read_from_settings(monkeypatch):
    from app.core.config import settings
    from app.services.sentiment_service import _fallback_sentiment as f
    monkeypatch.setattr(settings, "SENTIMENT_NEUTRAL_FALLBACK", True)
    assert f("Weekly review meeting held") == "neutral"
