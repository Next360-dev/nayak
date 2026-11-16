"""
services/briefing_service.py - the morning briefing: a short, copy-and-paste-friendly text (works in WhatsApp too).

It reuses the same scoped numbers as the Home screen, so the briefing always matches what the person sees in the app.
Languages: 'en' and 'te'.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.repositories import board_repository
from app.services import dashboard_service

T = {
    "en": {
        "greet": "Good morning", "control": "Control Room", "today": "Today: {today} stories · {urgent} urgent · {negative} negative",
        "foryou": "For you: {waiting} waiting · {acting} in progress", "top": "Top stories", "none": "No stories yet today.",
        "open": "Open the app", "db": "Database: {v}", "up": "working", "down": "DOWN", "news": "News: {n} stories in 24 h ({v})",
        "fresh": "fresh", "stale": "STALE", "accounts": "Accounts: {mla} MLAs · {min} ministers · {staff} staff · {never} never logged in",
        "shares": "Shares: {total} total · {resolved}% resolved · {new} unopened", "attn": "Needs attention", "clear": "All clear.",
        "sent": "My sent: {waiting} waiting · {acting} in progress · {done} done", "urgent": "URGENT",
    },
    "te": {
        "greet": "శుభోదయం", "control": "కంట్రోల్ రూమ్", "today": "ఈ రోజు: {today} వార్తలు · {urgent} అత్యవసరం · {negative} ప్రతికూలం",
        "foryou": "మీ కోసం: {waiting} వేచి ఉన్నవి · {acting} జరుగుతున్నవి", "top": "ముఖ్య వార్తలు", "none": "ఈ రోజు ఇంకా వార్తలు లేవు.",
        "open": "యాప్ తెరవండి", "db": "డేటాబేస్: {v}", "up": "పనిచేస్తోంది", "down": "పనిచేయడం లేదు", "news": "వార్తలు: 24 గంటల్లో {n} ({v})",
        "fresh": "తాజాగా", "stale": "పాతబడ్డాయి", "accounts": "ఖాతాలు: ఎమ్మెల్యేలు {mla} · మంత్రులు {min} · సిబ్బంది {staff} · ఎప్పుడూ లాగిన్ కానివారు {never}",
        "shares": "షేర్లు: మొత్తం {total} · {resolved}% పూర్తి · {new} తెరవలేదు", "attn": "దృష్టి అవసరమైనవి", "clear": "అంతా బాగుంది.",
        "sent": "నేను పంపినవి: {waiting} వేచి ఉన్నవి · {acting} జరుగుతున్నవి · {done} పూర్తి", "urgent": "అత్యవసరం",
    },
}
ATTN_TE = {
    "db_down": "డేటాబేస్ స్పందించడం లేదు.",
    "news_stale": "6 గంటలకు పైగా కొత్త వార్తలు లేవు. స్క్రాపర్ ఆగిపోయి ఉండవచ్చు.",
    "leader_unopened": "{name} కు చెందిన {n} షేర్లను ఒక రోజుకు పైగా తెరవలేదు.",
    "never_logged_in": "{n} ఖాతాలు ఎప్పుడూ లాగిన్ కాలేదు: {names}.",
    "disabled": "{n} ఖాతాలు నిలిపివేయబడ్డాయి.",
}


def today():
    """Today's date in the office timezone (a staff edit of the briefing is valid for this date only)."""
    return datetime.now(ZoneInfo(settings.TIMEZONE)).date()


def _today_label() -> str:
    return datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%d %b %Y")


def _attn_text(a: dict, lang: str) -> str:
    if lang == "te" and a.get("code") in ATTN_TE:
        return ATTN_TE[a["code"]].format(**a.get("params", {}))
    return a["text"]


def _stories(stories: list[dict], t: dict) -> list[str]:
    lines = []
    for i, s in enumerate(stories[:5], 1):
        place = ", ".join(x for x in (s.get("constituency_name"), s.get("district_name")) if x and x != "Statewide")
        mark = f"🔴 {t['urgent']}: " if s.get("priority_score") == 1 else ""
        lines.append(f"{i}. {mark}{s['headline']}" + (f" ({place})" if place else ""))
    return lines or [t["none"]]


def build(user: dict, lang: str = "en", use_edit: bool = True) -> dict:
    lang = lang if lang in T else "en"
    t = T[lang]
    d = dashboard_service.build(user)
    name = user["username"] if user["role"] == "staff" else (user.get("politician_name") or user["username"])
    link = f"{t['open']}: {settings.APP_BASE_URL}"

    if d["kind"] == "admin":
        s, u, sh = d["system"], d["users"], d["shares"]
        lines = [f"*{t['control']}* · {_today_label()}",
                 t["db"].format(v=t["up"] if s["database"] == "up" else t["down"]),
                 t["news"].format(n=s.get("articles_last_24h") if s.get("articles_last_24h") is not None else "?", v=t["stale"] if s["news_is_stale"] else t["fresh"]),
                 t["accounts"].format(mla=u["by_role"]["mla"], min=u["by_role"]["minister"], staff=u["by_role"]["staff"], never=u["never_logged_in"]),
                 t["shares"].format(total=sh["total"], resolved=sh["resolved_pct"] if sh["resolved_pct"] is not None else 0, new=sh["new"]),
                 "", f"{t['attn']}:"]
        lines += [f"- {_attn_text(a, lang)}" for a in d["attention"]] or [f"- {t['clear']}"]
        title = f"{t['control']} · {_today_label()}"
    else:
        n, sh = d["news"], d["shares"]
        lines = [f"*{t['greet']}, {name}* · {_today_label()}", d["scope"]["label"], ""]
        if n.get("error"):
            lines.append(n["error"])
        else:
            lines.append(t["today"].format(today=n["today"], urgent=n["urgent"], negative=n["negative"]))
        if d["kind"] == "staff":
            lines.append(t["sent"].format(waiting=sh["sent"]["waiting"], acting=sh["sent"]["acting"], done=sh["sent"]["done"]))
        else:
            lines.append(t["foryou"].format(waiting=sh["inbox"]["new"], acting=sh["inbox"]["acting"]))
        lines += ["", f"{t['top']}:"] + _stories(n.get("attention", []), t)
        title = f"{t['greet']}, {name} · {_today_label()}"
    lines += ["", link]
    out = {"title": title, "text": "\n".join(lines), "lang": lang, "kind": d["kind"], "edited_by": None}
    if use_edit and d["kind"] in ("mla", "minister"):                 # the leader's staff may have rewritten today's text
        edit = board_repository.get_briefing_edit(user["username"].lower(), lang, today())
        if edit:
            out["text"], out["edited_by"] = edit["body"], edit["edited_by"]
    return out
