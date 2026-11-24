"""The portfolio response carries the LEADER's identity for both the leader and their staff (pure logic, no database)."""
from app.api.routes import portfolio

LEADER = {"username": "mla_a", "role": "mla", "politician_name": "Dr A", "leader_title": "MLA", "leader_party": "INC",
          "constituency_name": "Vemulawada", "district_name": "Rajanna Sircilla"}


def _patch(monkeypatch, saved):
    monkeypatch.setattr(portfolio.portfolio_repository, "get_portfolio", lambda leader: saved if leader == "mla_a" else None)
    monkeypatch.setattr(portfolio.user_repository, "find_user_by_username", lambda u: LEADER if u == "mla_a" else None)


def test_leader_and_staff_get_the_same_leader_identity_and_photo(monkeypatch):
    _patch(monkeypatch, {"content": {"avatar_url": "https://x/p.jpg", "full_name": "Dr A"}, "published": True})
    staff = {"username": "staff_a", "role": "staff", "mla_username": "mla_a"}
    for who in (LEADER, staff):
        r = portfolio.get_portfolio(who)
        assert r["leader_username"] == "mla_a"
        assert r["content"]["avatar_url"] == "https://x/p.jpg"      # staff see their leader's photo
        assert (r["leader_party"], r["leader_title"], r["constituency_name"]) == ("INC", "MLA", "Vemulawada")


def test_no_saved_portfolio_means_no_photo_not_someone_elses(monkeypatch):
    _patch(monkeypatch, None)
    r = portfolio.get_portfolio({"username": "staff_a", "role": "staff", "mla_username": "mla_a"})
    assert r["content"] == {} and r["published"] is False
