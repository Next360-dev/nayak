"""Generate grounded office recommendations from current, stored issue data."""
import json
import logging

from app.core.config import settings
from app.repositories import user_repository
from app.services.sentiment_service import _call_gemini_with_fallback, get_genai_client
from app.services.top_alerts_service import top5_for_constituency
from app.services.watchlist_service import get_watchlist

logger = logging.getLogger(__name__)


def _suggest_issue_actions(stories: list[dict]) -> dict[int, str]:
    """Ask Gemini for modest, verifiable next steps; return empty when AI is unavailable."""
    if not stories or not (settings.GEMINI_API_KEY or "").strip():
        return {}
    client = get_genai_client()
    if not client:
        return {}

    source = [{
        "index": i,
        "headline": (s.get("title") or "")[:500],
        "summary": (s.get("summary") or "")[:1200],
        "district": (s.get("district") or "")[:100],
        "sentiment": (s.get("sentiment") or "")[:30],
        "priority": (s.get("priority") or "")[:30],
    } for i, s in enumerate(stories)]
    prompt = (
        "You assist a nonpartisan public-service office in Telangana, India. Based only on the issue details below, "
        "suggest one practical next step for each issue. Focus on fact-checking, contacting the responsible department, "
        "checking status on the ground, or giving citizens a clear update. Do not make political or campaign advice, "
        "assign blame, invent facts, claim that an action has happened, promise an outcome, or recommend anything unsafe or unlawful. "
        "If details are insufficient, make the first step verification. Keep each action under 45 words. "
        "Return only JSON: {\"recommendations\":[{\"index\":0,\"action\":\"...\",\"reason\":\"...\"}]}. "
        "Use only the provided index values.\nISSUES:\n" + json.dumps(source, ensure_ascii=False)
    )
    raw = _call_gemini_with_fallback(client, prompt)
    if not raw:
        return {}
    try:
        # Accept either plain JSON or a model response wrapped in a JSON code fence.
        start, end = raw.find("{"), raw.rfind("}")
        parsed = json.loads(raw[start:end + 1]) if start >= 0 and end > start else {}
        result = {}
        for row in parsed.get("recommendations", []):
            index = row.get("index")
            action = " ".join(str(row.get("action") or "").split())[:360]
            reason = " ".join(str(row.get("reason") or "").split())[:240]
            if isinstance(index, int) and 0 <= index < len(stories) and action:
                result[index] = action + (f" Why: {reason}" if reason else "")
        return result
    except (ValueError, TypeError, AttributeError):
        logger.warning("Gemini returned an unusable office recommendation response")
        return {}


def _recommendation_key(source: str, item_id: str) -> tuple[str, str]:
    """Treat AI and fallback recommendations for the same alert as one item."""
    return ("alert" if source.startswith("alert") else source, item_id)


def recommend_for_leader(leader_username: str, exclude: set[tuple[str, str]] | None = None) -> list[dict]:
    """Return deduplicated, actionable suggestions; never fabricate a source story."""
    leader_username = leader_username.strip().lower()
    leader = next((row for row in user_repository.leaders_overview()
                   if row["username"].lower() == leader_username), None)
    if not leader:
        return []

    recommendations: list[dict] = []
    seen: set[tuple[str, str]] = set()

    stories = top5_for_constituency(leader.get("constituency_name"))
    stories = [s for s in stories if ("alert", (s.get("title") or "").strip()) not in (exclude or set())]
    ai_actions = _suggest_issue_actions(stories)
    for i, story in enumerate(stories):
        title = (story.get("title") or "").strip()
        if not title or ("alert", title) in seen or ("alert", title) in (exclude or set()):
            continue
        seen.add(("alert", title))
        ai_action = ai_actions.get(i)
        recommendations.append({
            "source": "alert_ai" if ai_action else "alert_rule",
            "item_id": title,
            "title": title,
            "suggestion": ai_action or "Verify the issue with the relevant department, then assign a staff member to follow up.",
        })

    for entry in get_watchlist(leader_username):
        name = (entry.get("name") or "").strip()
        if not name or ("watchlist", name) in seen or ("watchlist", name) in (exclude or set()):
            continue
        seen.add(("watchlist", name))
        recommendations.append({
            "source": "watchlist",
            "item_id": name,
            "title": name,
            "suggestion": f"Review public activity related to {name}.",
        })

    return recommendations
