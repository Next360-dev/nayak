"""
services/work_item_service.py - letters & petitions approval rules (core business logic, no HTTP).

  staff     -> may create/edit/submit/close items in their own team; never decide
  mla/minister -> may create/edit/submit/decide/close items in their own team
  admin     -> no access to item content (404, never reveals existence)

Status machine (DB-enforced too, migration 010):
  draft -> submitted -> approved | rejected | changes_requested
  changes_requested -> submitted; approved -> closed; rejected -> closed
"""
from app.repositories import audit_repository, work_item_repository


class WorkItemRuleError(Exception):
    """A work-item rule was broken. `status` is the HTTP status the API should answer with."""

    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def team_of(user: dict) -> str:
    """The leader's username for this person's team (a leader's team is their own)."""
    role = user["role"]
    if role in ("mla", "minister"):
        return user["username"].lower()
    if role == "staff":
        return (user.get("mla_username") or "").lower()
    raise WorkItemRuleError(404, "Work item not found")  # admin: no item content, ever


def _require_member(team_leader: str, who: str) -> None:
    if not work_item_repository.in_team(team_leader, who):
        raise WorkItemRuleError(404, "Work item not found")


def _can(status: str, user: dict, team_leader: str) -> dict:
    me = user["username"].lower()
    leader = team_leader  # user's own team leader
    is_leader = user["role"] in ("mla", "minister") and me == leader
    return {
        "edit": status in ("draft", "changes_requested"),
        "submit": status == "draft",
        "decide": status == "submitted" and is_leader,
        "close": status in ("approved", "rejected"),
        "comment": True,
    }


def create_item(user: dict, kind: str, direction: str, title: str, body: str | None,
                reference_no: str | None, counterpart: str | None, priority: str,
                due_date, assignee: str | None) -> dict:
    team_leader = team_of(user)
    me = user["username"].lower()
    _require_member(team_leader, me)
    if assignee and not work_item_repository.in_team(team_leader, assignee.lower()):
        raise WorkItemRuleError(422, "Assignee is not in your team.")
    item = work_item_repository.create_item(
        team_leader, me, kind, direction, title, body, reference_no, counterpart,
        priority, due_date, assignee)
    audit_repository.log("work_item_created", actor=me, target=team_leader,
                         detail={"item": item["id"], "kind": kind})
    return item


def list_items(user: dict, status: str | None, kind: str | None, mine: bool,
               limit: int, offset: int) -> dict:
    team_leader = team_of(user)
    me = user["username"].lower()
    _require_member(team_leader, me)
    items, total = work_item_repository.list_items(team_leader, me, status, kind, mine, limit, offset)
    return {"items": items, "total": total}


def get_item(user: dict, item_id: int) -> dict:
    team_leader = team_of(user)
    me = user["username"].lower()
    _require_member(team_leader, me)
    item = work_item_repository.get_item(team_leader, item_id)
    if not item:
        raise WorkItemRuleError(404, "Work item not found.")
    item["can"] = _can(item["status"], user, team_leader)
    item["events"] = work_item_repository.events_for(item_id)
    return item


def update_item(user: dict, item_id: int, fields: dict) -> dict:
    team_leader = team_of(user)
    me = user["username"].lower()
    _require_member(team_leader, me)
    item = work_item_repository.get_item(team_leader, item_id)
    if not item:
        raise WorkItemRuleError(404, "Work item not found.")
    if item["status"] not in ("draft", "changes_requested"):
        raise WorkItemRuleError(409, f"Cannot edit while status is {item['status']}.")
    if "assignee" in fields and fields["assignee"] is not None:
        if not work_item_repository.in_team(team_leader, fields["assignee"].lower()):
            raise WorkItemRuleError(422, "Assignee is not in your team.")
    old_assignee = item.get("assignee")
    item = work_item_repository.update_item(team_leader, item_id, fields)
    audit_repository.log("work_item_edited", actor=me, target=team_leader,
                         detail={"item": item_id, "fields": sorted(fields)})
    new_assignee = item.get("assignee") if item else None
    if old_assignee != new_assignee:
        work_item_repository.add_event(item_id, me, "assigned",
                                       f"Assigned to {new_assignee}" if new_assignee else "Assignment cleared")
    else:
        work_item_repository.add_event(item_id, me, "edited", "Edited the work item.")
    return item


def submit_item(user: dict, item_id: int, note: str | None) -> dict:
    team_leader = team_of(user)
    me = user["username"].lower()
    _require_member(team_leader, me)
    item = work_item_repository.get_item(team_leader, item_id)
    if not item:
        raise WorkItemRuleError(404, "Work item not found.")
    if item["status"] not in ("draft", "changes_requested"):
        raise WorkItemRuleError(409, f"Cannot submit while status is {item['status']}.")
    item = work_item_repository.submit_item(team_leader, item_id, me, note)
    audit_repository.log("work_item_submitted", actor=me, target=team_leader,
                         detail={"item": item_id})
    return item


def decide_item(user: dict, item_id: int, decision: str, note: str | None) -> dict:
    if decision not in ("approve", "reject", "changes"):
        raise WorkItemRuleError(422, "Decision must be approve, reject or changes.")
    if decision in ("reject", "changes") and not note:
        raise WorkItemRuleError(422, f"A note is required to {decision}.")
    team_leader = team_of(user)
    me = user["username"].lower()
    item = work_item_repository.get_item(team_leader, item_id)
    if not item:
        raise WorkItemRuleError(404, "Work item not found.")
    if user["role"] not in ("mla", "minister") or me != team_leader:
        raise WorkItemRuleError(403, "Only the team leader (MLA/minister) can decide.")
    if item["status"] != "submitted":
        raise WorkItemRuleError(409, f"Cannot decide while status is {item['status']}.")
    item = work_item_repository.decide_item(team_leader, item_id, me, decision, note)
    audit_repository.log("work_item_decided", actor=me, target=team_leader,
                         detail={"item": item_id, "decision": decision})
    return item


def comment_item(user: dict, item_id: int, body: str) -> dict:
    body = (body or "").strip()
    if not body or len(body) > 2000:
        raise WorkItemRuleError(422, "Comment must be between 1 and 2000 characters.")
    team_leader = team_of(user)
    me = user["username"].lower()
    _require_member(team_leader, me)
    item = work_item_repository.get_item(team_leader, item_id)
    if not item:
        raise WorkItemRuleError(404, "Work item not found.")
    event = work_item_repository.add_event(item_id, me, "commented", body)
    audit_repository.log("work_item_commented", actor=me, target=team_leader,
                         detail={"item": item_id})
    return event


def close_item(user: dict, item_id: int, note: str | None) -> dict:
    team_leader = team_of(user)
    me = user["username"].lower()
    _require_member(team_leader, me)
    item = work_item_repository.get_item(team_leader, item_id)
    if not item:
        raise WorkItemRuleError(404, "Work item not found.")
    if item["status"] not in ("approved", "rejected"):
        raise WorkItemRuleError(409, f"Cannot close while status is {item['status']}.")
    item = work_item_repository.close_item(team_leader, item_id, me, note)
    audit_repository.log("work_item_closed", actor=me, target=team_leader,
                         detail={"item": item_id})
    return item


def pending_count(user: dict) -> dict:
    team_leader = team_of(user)
    if user["role"] != "staff":
        _require_member(team_leader, user["username"].lower())
    count = work_item_repository.pending_count(team_leader) if user["role"] != "staff" else 0
    return {"count": count}
