"""
services/news_service.py
Business logic layer for news:
  - Priority scoring
  - Department inference
  - Leader / constituency attribution
  - Runtime deduplication
Calls news_repository for raw data, applies business rules, returns
clean dicts ready for the route handler to return as JSON.
"""

import re
from typing import Any
from app.repositories import news_repository

# In-memory cache for constituency sentiment counts:
# (constituency, district, period, specific_date, date_range) -> (positive_count, negative_count)
_SENTIMENT_COUNTS_CACHE: dict[tuple, tuple[int, int]] = {}

# ─────────────────────────────────────────────────────────────────────────────
# Business rule helpers
# ─────────────────────────────────────────────────────────────────────────────

def infer_department(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ["farmer", "paddy", "rythu", "crop", "agriculture",
                              "procurement", "fertilizer", "subsidy",
                              "రైతు", "ధాన్యం", "వ్యవసాయం"]):
        return "Agriculture & Farmers Welfare Dept"
    if any(k in t for k in ["water", "irrigation", "dam", "canal", "reservoir",
                              "lift", "kaleshwaram", "flood", "drainage",
                              "నీరు", "సాగునీరు", "కాలువ"]):
        return "Irrigation & Water Resources Dept"
    if any(k in t for k in ["power", "electricity", "discom", "transco",
                              "substation", "current", "outage",
                              "విద్యుత్", "కరెంట్"]):
        return "Energy & Power Supply Dept"
    if any(k in t for k in ["road", "bridge", "ghmc", "municipal", "sanitation",
                              "cleanliness", "drain", "garbage", "street light",
                              "రోడ్డు", "మున్సిపల్"]):
        return "Municipal Administration & Urban Development"
    if any(k in t for k in ["hospital", "health", "doctor", "medicine",
                              "outbreak", "dengue", "ambulance", "clinic",
                              "ఆసుపత్రి", "వైద్యం", "డాక్టర్"]):
        return "Health, Medical & Family Welfare Dept"
    if any(k in t for k in ["school", "college", "education", "university",
                              "student", "exam", "teacher", "fee",
                              "పాఠశాల", "కళాశాల", "విద్యార్థి"]):
        return "Education & Human Resources Dept"
    if any(k in t for k in ["police", "crime", "accident", "fire", "arrest",
                              "theft", "traffic", "safety", "cyber",
                              "పోలీస్", "నేరం", "ప్రమాదం"]):
        return "Home Affairs & Police Command Center"
    if any(k in t for k in ["land", "revenue", "registration", "survey",
                              "dharani", "passbook", "భూమి", "రిజిస్ట్రేషన్"]):
        return "Revenue & Land Records Dept"
    return "District Collectorate & Administration"


def infer_priority(text: str, source_count: int = 1) -> int:
    """
    P1 = Genuine civic emergency (life/safety, natural disaster, mass casualty).
    P2 = Important civic issue (development, fund sanction, govt scheme).
    P3 = General news.
    """
    t = text.lower()
    p1 = ["flood", "fire", "blast", "collapse", "landslide", "earthquake",
          "death", "casualty", "killed", "dead", "dies", "deceased", "fatal",
          "outbreak", "epidemic", "crisis", "emergency", "rescue", "relief camp",
          "water shortage", "severe drought", "bridge collapse", "building collapse",
          "road accident", "train accident", "bus accident",
          "మృతి", "మరణం", "వరద", "అగ్నిప్రమాదం", "విపత్తు", "భూకంపం",
          "వ్యాధి వ్యాప్తి", "ప్రమాదం", "ఆత్మహత్య", "కుప్పకూలింది", "ధర్నా"]
    if any(k in t for k in p1):
        return 1

    p2 = ["sanction", "fund", "subsidy", "inspection", "project", "scheme",
          "construction", "road", "pipeline", "paddy", "procurement",
          "development", "modernization", "review", "inauguration",
          "protest", "strike",
          "నిధులు", "పథకం", "నిర్మాణం", "రోడ్డు", "సేకరణ", "అభివృద్ధి",
          "ప్రారంభం", "నిరసన", "సమ్మె"]
    if any(k in t for k in p2):
        return 2

    return 3


def enrich_articles(raw_rows, *, constituency=None, politician=None, news_scope="all"):
    """
    Takes raw rows from news_repository.fetch_articles() and applies:
      - MLA / constituency attribution
      - news_type classification (civic / leader / civic_and_leader)
      - department & priority inference
      - source type detection (TV Channel vs Newspaper)
    Returns list of enriched dicts.
    """
    from data.constituency_mappings import (
        get_canonical_district, detect_all_mlas_in_text, get_mla_for_constituency, area_members
    )
    from deduplication import deduplicate_sources, normalize_title_for_comparison, fuzzy_title_similarity

    results = []

    for row in raw_rows:
        art_id = row["id"]
        title = row["title"]
        desc = row["description"]
        dist = row["district"]
        const = row["constituency"]
        sources = deduplicate_sources(row["sources"])
        pub_at = row["published_at"]
        art_consts = row.get("constituencies") or []
        civic_consts = row.get("civic_constituencies") or []
        is_district_fallback = row.get("_is_district_fallback", False)

        full_text = f"{title} {desc}"
        detected_mlas = detect_all_mlas_in_text(full_text)
        detected_names = [m["leader_name"] for m in detected_mlas]

        if constituency and constituency not in ("All", "All Assembly Constituencies", "All Constituencies", "Statewide"):
            members = area_members(constituency)
            # An area (an MP's seat): label each story with ITS OWN member constituency; stories about the leader themselves stay at area level.
            own = next((c for c in [row["constituency"], *art_consts, *civic_consts] if members and c in members), None) if members else None
            place = own or constituency
            target_mla = get_mla_for_constituency(place)
            target_mla_name = target_mla["name"] if target_mla else ""
            const = place
            dist = get_canonical_district(place) if (own or not members) else ""
            politician_name = target_mla_name if target_mla_name else "Constituency Representative"
            news_type = "civic"
            is_mla_news = bool(target_mla_name and (target_mla_name in full_text or any(m.get("leader_name") == target_mla_name for m in detected_mlas)))
        else:
            news_type = "civic"
            if detected_names:
                politician_name = ", ".join(dict.fromkeys(detected_names))
            elif const and const != "Statewide":
                mla_rec = get_mla_for_constituency(const)
                politician_name = mla_rec["name"] if mla_rec else "Constituency Representative"
            else:
                politician_name = "State Administration"

            if art_consts:
                const = ", ".join(dict.fromkeys(art_consts))
                parent_dists = [get_canonical_district(c) for c in art_consts if c != "Statewide"]
                dist = ", ".join(dict.fromkeys(parent_dists)) or dist
            elif const and const != "Statewide":
                canon_dist = get_canonical_district(const)
                if canon_dist and canon_dist != "Statewide":
                    dist = canon_dist
            is_mla_news = bool(detected_names)

        first_src = sources[0] if sources else {}
        source_name = first_src.get("publisher", "News Source")
        url = first_src.get("url", "")
        is_tv = any(tv in source_name.lower() for tv in ["tv9", "tv5", "10tv", "ntv", "hmtv", "big tv", "rtv"])
        s_type = "TV Channel" if is_tv else "Newspaper"
        p_score = infer_priority(full_text, len(sources))
        dept = infer_department(full_text)

        results.append({
            "id": art_id,
            "title": title,
            "description": desc,
            "url": url,
            "source_name": source_name,
            "district_name": dist,
            "constituency_name": const,
            "politician_name": politician_name,
            "solver_official": dept,
            "published_at": str(pub_at),
            "priority_score": p_score,
            "category": dept,
            "source_type": s_type,
            "sources": sources,
            "image_url": next((s.get("image_url") for s in sources if isinstance(s, dict) and s.get("image_url")), None),
            "source_count": len(sources),
            "civic_constituencies": civic_consts,
            "news_type": news_type,
            "is_civic": True,
            "is_mla_news": is_mla_news,
            "detected_leaders": detected_names,
            "is_district_update": is_district_fallback,
            "english_title": row.get("english_title", ""),
            "sentiment": row.get("sentiment", "positive"),
            "is_statewide": row.get("is_statewide", False),
        })

    return results


def deduplicate_results(results: list) -> list:
    """Runtime fast cross-source headline deduplication on already-enriched results (O(1) fast-path)."""
    from deduplication import (
        deduplicate_sources, normalize_title_for_comparison, fuzzy_title_similarity, are_articles_same_event
    )
    deduped = []
    norm_title_to_idx: dict[str, int] = {}
    tokens_list: list[set] = []

    for item in results:
        norm_title = normalize_title_for_comparison(item.get("title", ""))
        if not norm_title:
            deduped.append(item)
            tokens_list.append(set())
            continue

        matched_idx = None

        # 1. Fast O(1) exact normalized match
        if norm_title in norm_title_to_idx:
            matched_idx = norm_title_to_idx[norm_title]
        else:
            # 2. Token overlap pre-check: only test articles that share >= 2 significant words
            words = set(norm_title.split())
            for idx, existing_words in enumerate(tokens_list):
                if not existing_words:
                    continue
                # Length filter
                len_ratio = len(norm_title) / max(1, len(deduped[idx].get("_norm_t", "")))
                if len_ratio < 0.50 or len_ratio > 2.0:
                    continue
                # Common token overlap filter
                if len(words & existing_words) < 2:
                    continue
                if are_articles_same_event(item, deduped[idx]):
                    matched_idx = idx
                    break

            # 3. Cross-lingual Semantic Match check (bridges English & Telugu reporting)
            if matched_idx is None:
                is_te_curr = any("\u0c00" <= ch <= "\u0c7f" for ch in norm_title)
                for idx, existing_item in enumerate(deduped):
                    ex_norm = existing_item.get("_norm_t", "")
                    is_te_ex = any("\u0c00" <= ch <= "\u0c7f" for ch in ex_norm)
                    if is_te_curr != is_te_ex:
                        if are_articles_same_event(item, existing_item):
                            matched_idx = idx
                            break

        if matched_idx is not None:
            existing = deduped[matched_idx]
            merged = deduplicate_sources(
                (existing.get("sources") or []) + (item.get("sources") or [])
            )
            existing["sources"] = merged
            existing["image_url"] = existing.get("image_url") or next((x.get("image_url") for x in merged if isinstance(x, dict) and x.get("image_url")), None)
            existing["source_count"] = len(merged)
            if merged:
                existing["url"] = merged[0].get("url", existing.get("url", ""))
                existing["source_name"] = merged[0].get("publisher", existing.get("source_name", ""))
            curr_desc = item.get("description") or ""
            if len(curr_desc.strip()) > len((existing.get("description") or "").strip()):
                existing["description"] = curr_desc
            existing["civic_constituencies"] = list(dict.fromkeys((existing.get("civic_constituencies") or []) + (item.get("civic_constituencies") or [])))
            existing["priority_score"] = min(existing.get("priority_score", 3), item.get("priority_score", 3))
        else:
            item["_norm_t"] = norm_title
            norm_title_to_idx[norm_title] = len(deduped)
            tokens_list.append(set(norm_title.split()))
            deduped.append(item)

    # Clean up internal helper key
    for d in deduped:
        d.pop("_norm_t", None)

    return deduped


def get_news_feed(
    *,
    district: str | None = None,
    constituency: str | None = None,
    politician: str | None = None,
    search: str | None = None,
    source_type: str | None = None,
    priority: int | None = None,
    date_range: str | None = None,
    specific_date: str | None = None,
    news_scope: str = "all",
    period: str = "today",
    page: int = 1,
    limit: int = 20,
    offset: int | None = None,
    user_role: str | None = None,
    user_constituency: str | None = None,
    user_district: str | None = None,
    user_politician: str | None = None,
) -> dict[str, Any]:
    """
    Main business orchestration service for news feeds:
    - Normalizes filters & MLA user roles
    - Fetches raw rows via repository with pagination (page, limit, offset)
    - Applies enrichment & deduplication
    - Formats output for frontend presentation with pagination metadata
    """
    from data.constituency_mappings import get_canonical_district

    page = max(1, page or 1)
    limit = max(1, min(200, limit or 20))
    calc_offset = offset if offset is not None else ((page - 1) * limit)

    admin_politicians = {
        "All", "All Leaders", "State Administration", "State Master Administrator",
        "Master Admin", "All 119 MLAs & CM", "Constituency Representative"
    }
    if politician in admin_politicians:
        politician = None
    if district in ("All", "All 33 Districts", "All Districts", "Statewide"):
        district = None
    if constituency in ("All", "All Assembly Constituencies", "All Constituencies", "Statewide"):
        constituency = None

    is_mla = (user_role == "mla")
    if is_mla:
        if user_constituency and user_constituency not in ("All", "All Assembly Constituencies", "Statewide"):
            constituency = user_constituency
        if user_district and user_district not in ('All', 'All Districts') and not district:
            district = user_district
        if user_politician and user_politician not in admin_politicians and not politician:
            politician = user_politician
        if not district and constituency:
            district = get_canonical_district(constituency) or ""

    # Preserve active constituency/district filter for calculating dashboard scope_counts
    active_district = district
    active_constituency = constituency
    active_politician = politician

    # If news_scope is 'social', delegate directly to social_media_service
    if news_scope == "social":
        from app.services import social_media_service
        social_feed = social_media_service.get_social_feed(
            constituency=active_constituency,
            mla_name=active_politician,
            district=active_district,
            search=search,
            period=period
        )
        scope_counts = news_repository.fetch_scope_counts(
            district=active_district if not is_mla else None,
            constituency=active_constituency,
            search=search,
            specific_date=specific_date,
            date_range=date_range,
            period=period,
            exclude_statewide=is_mla or bool(active_constituency),
        )
        if isinstance(scope_counts, dict):
            scope_counts["positive"] = social_feed["stats"]["positive_posts"]
            scope_counts["negative"] = social_feed["stats"]["negative_posts"]

        total_social = scope_counts.get("social", len(social_feed.get("posts", []))) if isinstance(scope_counts, dict) else len(social_feed.get("posts", []))
        return {
            "status": "success",
            "articles": social_feed["articles"],
            "social_posts": social_feed["posts"],
            "social_stats": social_feed["stats"],
            "social_mla": social_feed["mla"],
            "scope_counts": scope_counts,
            "pagination": {
                "page": 1,
                "limit": limit,
                "offset": 0,
                "total_records": total_social,
                "total_pages": 1,
                "has_next": False,
                "has_prev": False,
            },
            "period": period
        }

    # For fetching feed articles:
    if news_scope == "statewide":
        fetch_district = None
        fetch_constituency = None
        fetch_politician = None
    else:
        fetch_district = district
        fetch_constituency = constituency
        fetch_politician = politician

    # 1. Fetch raw rows from repository with pagination
    raw_rows = news_repository.fetch_articles(
        district=fetch_district if not is_mla else None,
        constituency=fetch_constituency,
        politician=fetch_politician,
        search=search,
        source_type=source_type,
        priority=priority,
        date_range=date_range,
        specific_date=specific_date,
        news_scope=news_scope,
        period=period,
        exclude_statewide=is_mla if news_scope != "statewide" else False,
        limit=limit,
        offset=calc_offset,
    )

    # 2. Apply business rules / enrichment
    enriched = enrich_articles(
        raw_rows,
        constituency=fetch_constituency,
        politician=fetch_politician,
        news_scope=news_scope
    )

    # 3. Post-enrichment filters
    if source_type and source_type != "All":
        enriched = [a for a in enriched if a.get("source_type") == source_type]
    if priority and priority != 0:
        enriched = [a for a in enriched if a.get("priority_score") == priority]

    # 4. Runtime deduplication
    enriched = deduplicate_results(enriched)

    # 5. Format for frontend
    formatted = []
    for item in enriched:
        full_text = item.get("description") or item.get("title") or ""
        summary = full_text[:280].strip()
        if len(full_text) > 280:
            last_space = summary.rfind(" ")
            if last_space > 150:
                summary = summary[:last_space]
            summary += "…"

        formatted.append({
            "id": item["id"],
            "title": item["title"],
            "headline": item["title"],
            "summary": summary,
            "full_description": full_text,
            "url": item.get("url", ""),
            "priority_score": item["priority_score"],
            "source_type": item.get("source_type", "Newspaper"),
            "newspaper_name": item["source_name"],
            "district_name": item["district_name"],
            "constituency_name": item["constituency_name"],
            "politician_name": item["politician_name"],
            "solver_official": item["solver_official"],
            "department": item["solver_official"],
            "category": item.get("category", item["solver_official"]),
            "date_time": item["published_at"],
            "sources": item.get("sources", []),
            "image_url": item.get("image_url"),
            "source_count": item.get("source_count", 1),
            "civic_constituencies": item.get("civic_constituencies", []),
            "news_type": item.get("news_type", "civic"),
            "is_civic": True,
            "is_mla_news": item.get("is_mla_news", False),
            "detected_leaders": item.get("detected_leaders", []),
            "is_district_update": item.get("is_district_update", False),
            "sentiment": item.get("sentiment", "positive"),
            "is_statewide": item.get("is_statewide", False),
        })

    # 6. Statewide Governance Verification
    for a in formatted:
        if a.get("district_name") == "Statewide" or a.get("constituency_name") == "Statewide" or news_scope == "statewide":
            a["is_statewide"] = True
            a["governance_classification"] = "TG_STATEWIDE"

    scope_counts = news_repository.fetch_scope_counts(
        district=active_district if not is_mla else None,
        constituency=active_constituency,
        search=search,
        specific_date=specific_date,
        date_range=date_range,
        period=period,
        exclude_statewide=is_mla or bool(active_constituency),
    )
    # 7. Compute pagination metadata based on the active scope count
    total_for_scope = 0
    if isinstance(scope_counts, dict):
        total_for_scope = scope_counts.get(news_scope, scope_counts.get("all", 0))
    if not total_for_scope:
        total_for_scope = len(formatted)

    total_pages = max(1, (total_for_scope + limit - 1) // limit) if total_for_scope > 0 else 1

    pagination = {
        "page": page,
        "limit": limit,
        "offset": calc_offset,
        "total_records": total_for_scope,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }

    return {
        "status": "success",
        "articles": formatted,
        "scope_counts": scope_counts,
        "pagination": pagination,
        "period": period,
    }

