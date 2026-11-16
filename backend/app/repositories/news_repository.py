"""
repositories/news_repository.py
Raw SQL queries against new_articles and articles tables.
No business logic here — only DB reads/writes.
Business rules (priority scoring, deduplication, department inference)
live in services/news_service.py.
"""

import re
from app.core.database import get_connection
from app.queries import get_query

_SQL_CHECK_DIRECT_BASE = get_query("news.sql", "check_direct_article_base")
_SQL_SELECT_ARTICLES_BASE = get_query("news.sql", "select_articles_base")
_SQL_COUNT_STATEWIDE = get_query("news.sql", "count_statewide_articles")


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers (kept here to avoid circular imports with deduplication.py)
# ─────────────────────────────────────────────────────────────────────────────


def _constituency_variants(constituency: str, const_clean: str) -> list[str]:
    """Spellings to match for one constituency; an AREA (an MP's seat) expands to all of its member constituencies."""
    from data.constituency_mappings import area_members
    names = [constituency, const_clean, f"{const_clean} (ST)", f"{const_clean} (SC)"]
    for member in area_members(constituency) or []:
        clean = re.sub(r"\s*\((SC|ST)\)", "", member).strip()
        names += [member, clean, f"{clean} (ST)", f"{clean} (SC)"]
    return list(dict.fromkeys(names))

def _build_time_clauses(period, date_range, specific_date, search):
    """Returns (clauses_list, params_list) for time & keyword filters."""
    clauses, params = [], []

    if search and search.strip():
        clauses.append("(title ILIKE %s OR summary ILIKE %s)")
        params.extend([f"%{search.strip()}%", f"%{search.strip()}%"])

    if specific_date and specific_date.strip():
        clauses.append("published_at >= %s::date AND published_at < %s::date + INTERVAL '1 day'")
        params.extend([specific_date.strip(), specific_date.strip()])
    elif period == "today" or date_range == "today":
        clauses.append("published_at >= NOW() - INTERVAL '24 hours'")           # "latest" = a rolling 24 hours
    elif period == "history":
        # The Archive is everything OLDER than the latest 24 hours, so the two views never overlap.
        _map = {"24h": "48 hours", "48h": "48 hours", "3d": "3 days", "7d": "7 days", "14d": "14 days"}
        interval = _map.get(date_range)
        if interval:
            clauses.append(f"published_at >= NOW() - INTERVAL '{interval}' AND published_at < NOW() - INTERVAL '24 hours'")
        else:
            clauses.append("published_at < NOW() - INTERVAL '24 hours'")
    elif date_range in ("24h", "48h", "3d", "7d", "14d"):
        _map = {"24h": "24 hours", "48h": "3 days", "3d": "3 days", "7d": "7 days", "14d": "14 days"}
        clauses.append(f"published_at >= CURRENT_TIMESTAMP - INTERVAL '{_map[date_range]}'")

    return clauses, params


def fetch_articles(
    *,
    district=None, constituency=None, politician=None,
    search=None, source_type=None, priority=None,
    date_range=None, specific_date=None,
    news_scope="all", period="today",
    exclude_statewide=False,
    limit=20, offset=0,
    **kwargs
):
    """
    Fetches raw article rows from new_articles.
    Returns list of dicts with all columns needed by the service layer.
    """
    # Import here to avoid circular import at module load time
    from data.constituency_mappings import get_canonical_district, get_mla_for_constituency

    connection = get_connection()
    cursor = None
    try:
        cursor = connection.cursor()

        time_clauses, time_params = _build_time_clauses(period, date_range, specific_date, search)
        common_time_sql = (" AND " + " AND ".join(time_clauses)) if time_clauses else ""

        is_district_fallback = False
        scope_clauses, scope_params = [], []

        if news_scope == "statewide":
            scope_clauses.append("(is_statewide = TRUE OR district = 'Statewide' OR constituency = 'Statewide')")
        elif constituency and constituency not in ("All", "All Assembly Constituencies", "All Constituencies", "Statewide"):
            const_clean = re.sub(r"\s*\((SC|ST)\)", "", constituency).strip()
            c_variants = _constituency_variants(constituency, const_clean)
            mla_data = get_mla_for_constituency(constituency) or {}
            mla_name = mla_data.get("name", "")
            pol = politician if (politician and politician not in ("All", "All Leaders", "State Administration", "State Master Administrator", "Master Admin", "All 119 MLAs & CM", "Constituency Representative")) else mla_name
            parent_dist = get_canonical_district(constituency)
            has_parent = bool(parent_dist and parent_dist != "Statewide")

            direct_cond = """(
                constituency = ANY(%s)
                OR (civic_constituencies && %s AND cardinality(civic_constituencies) <= 3)
            )"""
            direct_params = [c_variants, c_variants]

            direct_check_sql = f"""
                {_SQL_CHECK_DIRECT_BASE} {common_time_sql}
                  AND {direct_cond}
                LIMIT 1;
            """
            cursor.execute(direct_check_sql, tuple(time_params + direct_params))
            has_direct = (cursor.fetchone() is not None)

            if has_direct:
                scope_clauses.append(direct_cond)
                scope_params.extend(direct_params)
            else:
                is_district_fallback = True
                if has_parent:
                    scope_clauses.append("district = %s")
                    scope_params.append(parent_dist)
                else:
                    scope_clauses.append("1=0")

            if news_scope == "positive":
                scope_clauses.append("sentiment = 'positive'")
            elif news_scope == "negative":
                scope_clauses.append("sentiment = 'negative'")
        else:
            if exclude_statewide and news_scope != "statewide":
                scope_clauses.append("is_statewide = FALSE AND district != 'Statewide' AND constituency != 'Statewide'")
            if district and district not in ("All", "All Districts", "Statewide"):
                scope_clauses.append("district ILIKE %s")
                scope_params.append(f"%{district}%")
            if politician and politician not in ("All", "All Leaders", "State Administration", "State Master Administrator", "Master Admin", "All 119 MLAs & CM", "Constituency Representative"):
                scope_clauses.append("(title ILIKE %s OR summary ILIKE %s)")
                scope_params.extend([f"%{politician}%", f"%{politician}%"])
            if news_scope == "positive":
                scope_clauses.append("sentiment = 'positive'")
            elif news_scope == "negative":
                scope_clauses.append("sentiment = 'negative'")

        sql_where = ""
        if scope_clauses:
            sql_where += " AND " + " AND ".join(scope_clauses)
        sql_where += common_time_sql

        sql = f"""
            {_SQL_SELECT_ARTICLES_BASE}
            {sql_where}
            ORDER BY
                CASE WHEN jsonb_array_length(sources) > 1 THEN 1 ELSE 2 END,
                published_at DESC NULLS LAST,
                id DESC
            LIMIT %s OFFSET %s
        """
        params = scope_params + time_params + [limit, offset]
        cursor.execute(sql, tuple(params))
        rows = cursor.fetchall()

        results = []
        for row in rows:
            results.append({
                "id": row[0],
                "title": row[1],
                "description": row[2],
                "district": row[3],
                "constituency": row[4],
                "state": row[5],
                "sources": row[6] or [],
                "published_at": row[7],
                "constituencies": row[8] or [],
                "civic_constituencies": row[9] or [],
                "_is_district_fallback": is_district_fallback,
                "sentiment": row[10] if len(row) > 10 else "positive",
                "is_statewide": row[11] if len(row) > 11 else False,
            })
        return results

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


def fetch_scope_counts(
    *,
    district=None, constituency=None,
    search=None, specific_date=None,
    date_range=None, period="today",
    exclude_statewide=False
):
    """Returns dict with all/civic/social/statewide counts for the given filters."""
    from data.constituency_mappings import get_canonical_district, get_mla_for_constituency

    connection = get_connection()
    cursor = None
    try:
        cursor = connection.cursor()

        time_clauses, time_params = _build_time_clauses(period, date_range, specific_date, search)
        common_filter_sql = (" AND " + " AND ".join(time_clauses)) if time_clauses else ""

        mla_data = {}
        mla_name = ""
        if constituency and constituency not in ("All", "All Assembly Constituencies", "All Constituencies", "Statewide"):
            const_clean = re.sub(r"\s*\((SC|ST)\)", "", constituency).strip()
            c_variants = _constituency_variants(constituency, const_clean)
            mla_data = get_mla_for_constituency(constituency) or {}
            mla_name = mla_data.get("name", "")
            parent_dist = get_canonical_district(constituency)
            has_parent = bool(parent_dist and parent_dist != "Statewide")

            direct_cond = """(
                constituency = ANY(%s)
                OR (civic_constituencies && %s AND cardinality(civic_constituencies) <= 3)
            )"""
            direct_params = [c_variants, c_variants]

            direct_check_sql = f"""
                SELECT 1 FROM new_articles
                WHERE 1=1 {common_filter_sql} AND {direct_cond} LIMIT 1;
            """
            cursor.execute(direct_check_sql, tuple(time_params + direct_params))
            has_direct = (cursor.fetchone() is not None)

            if has_direct:
                where_clauses = [direct_cond]
                base_params = direct_params
                civic_cond = "1=1"
                civic_params = []
            else:
                if has_parent:
                    where_clauses = ["district = %s"]
                    base_params = [parent_dist]
                    civic_cond, civic_params = "1=1", []
                else:
                    where_clauses = ["1=0"]
                    base_params = []
                    civic_cond, civic_params = "1=0", []
        else:
            where_clauses = ["1=1"]
            base_params = []
            if exclude_statewide:
                where_clauses.append("district != 'Statewide' AND constituency != 'Statewide'")
            if district and district not in ("All", "All Districts", "Statewide"):
                where_clauses.append("district ILIKE %s")
                base_params.append(f"%{district}%")
            civic_cond = "1=1"
            civic_params = []

        where_sql = " AND ".join(where_clauses) + common_filter_sql
        sql = f"""
            SELECT
                COUNT(*) AS total_all,
                COUNT(*) FILTER (WHERE {civic_cond}) AS total_civic,
                COUNT(*) FILTER (WHERE sentiment = 'positive') AS total_positive,
                COUNT(*) FILTER (WHERE sentiment = 'negative') AS total_negative
            FROM new_articles
            WHERE {where_sql}
        """
        all_params = tuple(civic_params + base_params + time_params)
        cursor.execute(sql, all_params)
        row = cursor.fetchone()

        # Calculate social media posts count for the active constituency / MLA
        social_where = ["1=1"]
        social_params = []
        if constituency and constituency not in ("All", "All Assembly Constituencies", "All Constituencies", "Statewide"):
            social_where.append("(constituency ILIKE %s OR mla_name ILIKE %s)")
            social_params.extend([f"%{constituency}%", f"%{mla_name}%" if mla_name else f"%{constituency}%"])
        elif district and district not in ("All", "All Districts", "Statewide"):
            social_where.append("district ILIKE %s")
            social_params.append(f"%{district}%")

        if period == "today":
            social_where.append("(published_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date")

        cursor.execute(f"SELECT COUNT(*) FROM social_media_posts WHERE {' AND '.join(social_where)};", tuple(social_params))
        social_row = cursor.fetchone()
        total_social = int(social_row[0] or 0) if social_row else 0

        # Always calculate true statewide count for the active period/date across the whole state
        sw_sql = f"""
            SELECT COUNT(*) FROM new_articles
            WHERE (is_statewide = TRUE OR district = 'Statewide' OR constituency = 'Statewide') {common_filter_sql};
        """
        cursor.execute(sw_sql, tuple(time_params))
        sw_row = cursor.fetchone()
        total_statewide = int(sw_row[0] or 0) if sw_row else 0

        return {
            "all": int(row[0] or 0),
            "civic": int(row[1] or 0),
            "positive": int(row[2] or 0),
            "negative": int(row[3] or 0),
            "social": total_social,
            "statewide": total_statewide
        }

    except Exception as e:
        print(f"Error in fetch_scope_counts: {e}")
        return {"all": 0, "civic": 0, "social": 0, "statewide": 0}
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
