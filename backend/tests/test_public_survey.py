"""Public survey: input limits and rate limit (pure logic, no database)."""
import pytest

from app.services import public_survey_service as svc


def test_inputs_are_trimmed_and_bounded():
    role, cat, msg, name, email = svc.clean_submission(" citizen ", "roads", "  Fix the road  ", " Ravi ", " r@x.in ")
    assert (role, cat, msg, name, email) == ("citizen", "roads", "Fix the road", "Ravi", "r@x.in")


@pytest.mark.parametrize("bad", [
    dict(message="   "),
    dict(message="x" * (svc.MAX_MESSAGE + 1)),
    dict(name="n" * (svc.MAX_SHORT + 1)),
    dict(category="c" * (svc.MAX_SHORT + 1)),
    dict(email="not-an-email"),
    dict(email="a b@x.in"),
])
def test_bad_submissions_are_refused(bad):
    args = dict(role="citizen", category="roads", message="ok", name="Ravi", email="")
    args.update(bad)
    with pytest.raises(ValueError):
        svc.clean_submission(**args)


def test_rate_limit_is_per_ip_and_blocks_after_the_limit():
    svc._hits.clear()
    assert all(svc._allow_ip("1.1.1.1") for _ in range(svc._RATE_LIMIT))
    assert svc._allow_ip("1.1.1.1") is False
    assert svc._allow_ip("2.2.2.2") is True          # another visitor is unaffected
    svc._hits.clear()


def test_results_never_include_the_respondent_ip(monkeypatch):
    class Cur:
        def execute(self, sql, *a): self.sql = sql
        def fetchall(self): return [(1, "citizen", "roads", "msg", "Ravi", "r@x.in", None)]
        def __enter__(self): return self
        def __exit__(self, *a): return False
    class Conn:
        def cursor(self): return Cur()
        def close(self): pass
    monkeypatch.setattr(svc, "get_connection", lambda: Conn())
    rows = svc.list_responses("mla_a")
    assert "ip" not in rows[0] and rows[0]["message"] == "msg" and rows[0]["name"] == "Ravi"


def test_a_survey_needs_a_real_leader(monkeypatch):
    users = {"mla_a": {"role": "mla"}, "staff_a": {"role": "staff"}, "boss": {"role": "admin"}}
    monkeypatch.setattr(svc.user_repository, "find_user_by_username", lambda u: users.get(u))
    assert svc.valid_leader(" MLA_A ") == "mla_a"                       # case and spaces are tolerated
    for bad in ("", None, "nobody", "staff_a", "boss"):                 # unknown, staff and admin cannot own responses
        with pytest.raises(ValueError):
            svc.valid_leader(bad)


def test_results_are_filtered_to_one_leader(monkeypatch):
    seen = {}
    class Cur:
        def execute(self, sql, params=None): seen["sql"], seen["params"] = sql, params
        def fetchall(self): return []
        def __enter__(self): return self
        def __exit__(self, *a): return False
    class Conn:
        def cursor(self): return Cur()
        def close(self): pass
    monkeypatch.setattr(svc, "get_connection", lambda: Conn())
    svc.list_responses("mla_a")
    assert "WHERE leader_username = %s" in seen["sql"] and seen["params"] == ("mla_a",)
