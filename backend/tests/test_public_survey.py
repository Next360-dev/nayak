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
    rows = svc.list_responses()
    assert "ip" not in rows[0] and rows[0]["message"] == "msg" and rows[0]["name"] == "Ravi"
