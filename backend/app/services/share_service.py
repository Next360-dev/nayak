"""
services/share_service.py - the sharing rules (core business logic, no HTTP here).

  staff     -> may share ONLY to the MLA/minister they work for
  mla/min.  -> may share ONLY to their own active staff
  admin     -> never shares, never replies, never changes a status; may only READ everything
  nobody    -> may broadcast (all MLAs / a district) or share to themselves

The same pairing is also enforced by the database (migration 004), so a bug or a direct
SQL insert cannot create a forbidden share.
"""
from app.repositories import user_repository

MAX_RECIPIENTS = 200


class ShareRuleError(Exception):
    """A sharing rule was broken. `status` is the HTTP status the API should answer with."""

    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def target_rows(user: dict) -> list[dict]:
    """The people this user may share to, as display rows (empty for admin)."""
    role = user["role"]
    if role == "staff":
        boss = user_repository.find_user_by_username(user.get("mla_username") or "")
        if boss and boss["role"] in ("mla", "minister"):
            return [{
                "username": boss["username"], "role": boss["role"],
                "politician_name": boss["politician_name"],
                "constituency_name": boss["constituency_name"] if boss["constituency_name"] != "All" else "",
                "district_name": boss["district_name"] if boss["district_name"] != "All" else "",
            }]
        return []
    if role in ("mla", "minister"):
        return [{"username": m["username"], "role": "staff", "politician_name": m["username"],
                 "constituency_name": "", "district_name": ""}
                for m in user_repository.list_staff_of(user["username"]) if m["is_active"]]
    return []


def allowed_recipients(user: dict) -> set[str]:
    return {r["username"].lower() for r in target_rows(user)}


def check_can_create(user: dict, requested: list[str], broadcast: bool) -> list[str]:
    """Returns the clean, sorted recipient list or raises ShareRuleError."""
    if user["role"] == "admin":
        raise ShareRuleError(403, "The master admin monitors the system and does not share.")
    if broadcast:
        raise ShareRuleError(403, "Broadcast sharing is not available.")
    me = user["username"].lower()
    recipients = {r.strip().lower() for r in requested if r and r.strip()}
    recipients.discard(me)  # never deliver to yourself
    if not recipients:
        raise ShareRuleError(422, "Pick at least one recipient.")
    if len(recipients) > MAX_RECIPIENTS:
        raise ShareRuleError(422, f"Too many recipients (max {MAX_RECIPIENTS}).")
    not_allowed = recipients - allowed_recipients(user)
    if not_allowed:
        raise ShareRuleError(403, f"You cannot share to: {', '.join(sorted(not_allowed))}")
    return sorted(recipients)


def check_not_admin(user: dict) -> None:
    """Replying and changing a status are for participants only; the admin view is read-only."""
    if user["role"] == "admin":
        raise ShareRuleError(403, "The master admin view is read-only.")


def can_read_all_threads(user: dict, share: dict) -> bool:
    return user["role"] == "admin" or share["sender"] == user["username"].lower()
