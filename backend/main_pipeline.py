"""
main_pipeline.py - Master Orchestrator for Layers 1, 2, and 3
Runs concurrent scraper collectors (Google RSS, Publisher RSS, HTML Crawlers),
invokes deduplication & clustering engine, and stores canonical stories directly
into PostgreSQL table `new_articles`.
"""

import os
import sys
import json
import logging
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Tuple

import psycopg2
from psycopg2.extras import execute_values, Json

from file1_google_rss import collect_google_rss
from file2_publisher_rss import collect_publisher_rss
from file3_html_scrapers import collect_html_scrapers
from deduplication import (
    deduplicate_and_cluster, canonicalize_url, get_canonical_publisher,
    deduplicate_sources, normalize_title_for_comparison, are_articles_same_event,
    get_english_text_representation, extract_core_keywords
)

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.core.config import settings
from app.core.database import get_connection

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("main_pipeline")

def get_db_connection():
    """Returns a new connection to PostgreSQL using unified settings from .env."""
    return get_connection()

def ensure_schema():
    """Ensures that the new_articles table exists with all indexes."""
    ddl = """
    CREATE TABLE IF NOT EXISTS new_articles (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        district VARCHAR(100) NOT NULL,
        constituency VARCHAR(100) DEFAULT 'Statewide',
        state VARCHAR(100) NOT NULL DEFAULT 'Telangana',
        summary TEXT,
        sources JSONB NOT NULL DEFAULT '[]'::jsonb,
        published_at TIMESTAMPTZ DEFAULT now(),
        created_at TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE new_articles ADD COLUMN IF NOT EXISTS constituency VARCHAR(100) DEFAULT 'Statewide';
    ALTER TABLE new_articles ADD COLUMN IF NOT EXISTS constituencies TEXT[] DEFAULT '{}';
    ALTER TABLE new_articles ADD COLUMN IF NOT EXISTS civic_constituencies TEXT[] DEFAULT '{}';
    CREATE INDEX IF NOT EXISTS idx_new_articles_district ON new_articles(district);
    CREATE INDEX IF NOT EXISTS idx_new_articles_constituency ON new_articles(constituency);
    CREATE INDEX IF NOT EXISTS idx_new_articles_constituencies ON new_articles USING gin (constituencies);
    CREATE INDEX IF NOT EXISTS idx_new_articles_civic_constituencies ON new_articles USING gin (civic_constituencies);
    CREATE INDEX IF NOT EXISTS idx_new_articles_published ON new_articles(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_new_articles_sources ON new_articles USING gin (sources);

    -- Historical News Archive Table (Never deleted; preserves all past news)
    CREATE TABLE IF NOT EXISTS archive_news (
        id BIGINT PRIMARY KEY,
        title TEXT NOT NULL,
        district VARCHAR(100) NOT NULL DEFAULT 'Statewide',
        constituency VARCHAR(100) DEFAULT 'Statewide',
        constituencies TEXT[] DEFAULT '{}',
        civic_constituencies TEXT[] DEFAULT '{}',
        state VARCHAR(100) NOT NULL DEFAULT 'Telangana',
        summary TEXT,
        sources JSONB NOT NULL DEFAULT '[]'::jsonb,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ,
        sentiment VARCHAR(20) DEFAULT 'positive',
        is_statewide BOOLEAN DEFAULT FALSE,
        archived_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_archive_news_district ON archive_news(district);
    CREATE INDEX IF NOT EXISTS idx_archive_news_constituency ON archive_news(constituency);
    CREATE INDEX IF NOT EXISTS idx_archive_news_published ON archive_news(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_archive_news_archived_at ON archive_news(archived_at DESC);
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(ddl)
            # Automatic Archival Policy: Safely move articles older than 60 days to archive_news
            cur.execute("""
                WITH moved_rows AS (
                    DELETE FROM new_articles
                    WHERE published_at < NOW() - INTERVAL '60 days'
                    RETURNING id, title, district, constituency, constituencies, civic_constituencies, state, summary, sources, published_at, created_at, sentiment, is_statewide
                )
                INSERT INTO archive_news (
                    id, title, district, constituency, constituencies, civic_constituencies, state, summary, sources, published_at, created_at, sentiment, is_statewide, archived_at
                )
                SELECT 
                    id, title, district, constituency, constituencies, civic_constituencies, state, summary, sources, published_at, created_at, sentiment, is_statewide, NOW()
                FROM moved_rows
                ON CONFLICT (id) DO UPDATE
                SET title = EXCLUDED.title,
                    summary = EXCLUDED.summary,
                    sources = EXCLUDED.sources,
                    sentiment = EXCLUDED.sentiment,
                    archived_at = NOW();
            """)
            archived_count = cur.rowcount
        conn.commit()
    logger.info(f"Database schema verified & 60-day archival checked. Archived to archive_news: {archived_count} articles.")


def run_collectors_concurrently() -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """Runs all 3 Layer 1 collectors concurrently and aggregates raw records."""
    logger.info("=== LAYER 1: STARTING CONCURRENT COLLECTORS ===")
    raw_records: List[Dict[str, Any]] = []
    stats: Dict[str, int] = {}
    
    collectors = {
        "file1_google_rss": collect_google_rss,
        "file2_publisher_rss": collect_publisher_rss,
        "file3_html_scrapers": collect_html_scrapers,
    }
    
    with ThreadPoolExecutor(max_workers=3) as executor:
        future_to_name = {executor.submit(func): name for name, func in collectors.items()}
        for future in as_completed(future_to_name):
            name = future_to_name[future]
            try:
                records = future.result()
                stats[name] = len(records)
                raw_records.extend(records)
                logger.info(f"Collector [{name}] finished with {len(records)} records.")
            except Exception as exc:
                logger.error(f"Collector [{name}] failed: {exc}")
                stats[name] = 0
                
    logger.info(f"Layer 1 total raw records collected: {len(raw_records)}")
    return raw_records, stats

def store_clusters_in_db(clusters: List[Dict[str, Any]]) -> Tuple[int, int]:
    """
    Inserts or updates clustered records into PostgreSQL new_articles.
    Avoids duplicate entries by checking existing URLs in the sources JSONB.
    Returns: (inserted_count, updated_count)
    """
    logger.info(f"=== LAYER 3: PERSISTING {len(clusters)} CLUSTERS TO POSTGRESQL ===")
    ensure_schema()
    
    conn = get_db_connection()
    inserted = 0
    updated = 0
    
    try:
        with conn.cursor() as cur:
            # Query recent articles to map existing sources in DB (past 3 days)
            cur.execute("""
                SELECT id, title, summary, district, sources 
                FROM new_articles
                WHERE published_at >= NOW() - INTERVAL '3 days';
            """)
            existing_rows = cur.fetchall()
            
            # Map existing canonical URLs and titles to article ID and existing sources
            url_to_id: Dict[str, int] = {}
            title_to_id: Dict[str, int] = {}
            id_to_sources: Dict[int, List[Dict[str, str]]] = {}
            id_to_summary: Dict[int, str] = {}
            row_by_id: Dict[int, tuple] = {}
            
            from collections import defaultdict
            kw_to_ids_map = defaultdict(list)
            
            for row in existing_rows:
                art_id, art_title, art_summary, art_dist, art_sources = row
                row_by_id[art_id] = row
                id_to_sources[art_id] = art_sources or []
                id_to_summary[art_id] = art_summary or ""
                norm_t = normalize_title_for_comparison(art_title)
                if norm_t and len(norm_t) > 8:
                    title_to_id[norm_t] = art_id
                if isinstance(art_sources, list):
                    for s in art_sources:
                        s_url = canonicalize_url(s.get("url", ""))
                        if s_url:
                            url_to_id[s_url] = art_id
                # Build keyword index for fast candidate selection
                for kw in extract_core_keywords(art_title):
                    kw_to_ids_map[kw].append(art_id)
                            
            # Process incoming clusters (already clustered by Layer 2)
            pending_clusters: List[Dict[str, Any]] = []
            
            for c in clusters:
                cluster_urls = [canonicalize_url(s.get("url", "")) for s in c["sources"] if s.get("url")]
                
                # Check 1: Match by URL (O(1))
                matched_id = None
                for u in cluster_urls:
                    if u in url_to_id and url_to_id[u] > 0:
                        matched_id = url_to_id[u]
                        break
                        
                # Check 2: Match by exact normalized title (O(1))
                norm_c_title = normalize_title_for_comparison(c.get("title", ""))
                if not matched_id and norm_c_title and norm_c_title in title_to_id and title_to_id[norm_c_title] > 0:
                    matched_id = title_to_id[norm_c_title]
                
                # Check 3: Semantic event comparison against high-overlap candidate articles
                if not matched_id:
                    c_title = c.get("title", "")
                    c_kws = extract_core_keywords(c_title)
                    if c_kws:
                        cand_scores = defaultdict(int)
                        for kw in c_kws:
                            for cand_id in kw_to_ids_map.get(kw, []):
                                cand_scores[cand_id] += 1
                        
                        c_dist = c.get("district", "Statewide")
                        # Only test candidates with >= 2 matching core keywords
                        top_candidates = sorted(cand_scores.items(), key=lambda x: x[1], reverse=True)[:8]
                        for cand_id, score in top_candidates:
                            if score < 2:
                                break
                            r = row_by_id.get(cand_id)
                            if not r:
                                continue
                            art_id, art_title, art_summary, art_dist, art_sources = r
                            if art_dist == c_dist or art_dist == "Statewide" or c_dist == "Statewide":
                                if are_articles_same_event(c, {"title": art_title, "summary": art_summary}):
                                    matched_id = art_id
                                    break
                        
                if matched_id:
                    # Merge any new sources into the existing DB record
                    current_sources = id_to_sources.get(matched_id, [])
                    existing_pubs = {get_canonical_publisher(s.get("publisher", ""), s.get("url", "")) for s in current_sources}
                    existing_urls = {canonicalize_url(s.get("url", "")) for s in current_sources}
                    new_sources_added = False
                    
                    for s in c["sources"]:
                        s_pub = get_canonical_publisher(s.get("publisher", ""), s.get("url", ""))
                        s_url = canonicalize_url(s.get("url", ""))
                        if s_pub not in existing_pubs and (not s_url or s_url not in existing_urls):
                            current_sources.append({
                                "publisher": s_pub,
                                "url": s.get("url", "")
                            })
                            existing_pubs.add(s_pub)
                            if s_url:
                                existing_urls.add(s_url)
                            new_sources_added = True
                            
                    summary_updated = False
                    old_summary = id_to_summary.get(matched_id, "")
                    new_summary = c.get("summary", "")
                    if len(new_summary.strip()) > len(old_summary.strip()):
                        old_summary = new_summary
                        id_to_summary[matched_id] = new_summary
                        summary_updated = True
                            
                    if new_sources_added or summary_updated:
                        current_sources = deduplicate_sources(current_sources)
                        cur.execute(
                            "UPDATE new_articles SET sources = %s, summary = %s WHERE id = %s;",
                            (Json(current_sources), old_summary, matched_id)
                        )
                        updated += 1
                else:
                    # Layer 2 already deduplicated this batch; append directly to pending insert
                    pending_clusters.append(c)

            from app.services.sentiment_service import begin_cycle, classify_tone
            begin_cycle()   # fresh budget for the optional local AI

            # Bulk insert new unique clusters with persistent sentiment & is_statewide
            to_insert = [
                (
                    pc["title"],
                    pc["district"],
                    pc.get("constituency", "Statewide"),
                    pc.get("constituencies") or ([pc.get("constituency")] if pc.get("constituency") and pc.get("constituency") != "Statewide" else []),
                    pc.get("civic_constituencies") or [],
                    pc.get("state", "Telangana"),
                    pc["summary"],
                    Json(pc["sources"]),
                    pc["published_at"],
                    pc["created_at"],
                    classify_tone(pc["title"], pc.get("summary", "")),
                    bool(pc.get("district") == "Statewide" or pc.get("constituency") == "Statewide")
                )
                for pc in pending_clusters
            ]
            
            if to_insert:
                insert_sql = """
                INSERT INTO new_articles (
                    title, district, constituency, constituencies, civic_constituencies, state, summary, sources, published_at, created_at, sentiment, is_statewide
                ) VALUES %s;
                """
                execute_values(cur, insert_sql, to_insert, page_size=200)
                inserted = len(to_insert)
                
        conn.commit()
    finally:
        conn.close()
        
    logger.info(f"Database sync complete: {inserted} inserted, {updated} updated.")
    return inserted, updated

def run_pipeline() -> Dict[str, Any]:
    """
    Executes the entire end-to-end pipeline:
    1. Collect raw news from Google RSS, Publisher RSS, and HTML Crawlers
    2. Cluster and deduplicate with SequenceMatcher
    3. Persist canonical stories into PostgreSQL `new_articles`
    """
    start_time = datetime.now(timezone.utc)
    logger.info(">>> STARTING NAYAK INGESTION & DEDUPLICATION PIPELINE <<<")
    
    # 1. Layer 1: Concurrent Data Ingestion
    raw_records, collector_stats = run_collectors_concurrently()
    
    # 2. Layer 2: Clustering & Deduplication Engine
    logger.info("=== LAYER 2: RUNNING DEDUPLICATION & CLUSTERING ENGINE ===")
    clusters = deduplicate_and_cluster(raw_records, similarity_threshold=0.70)
    
    multi_source_clusters = [c for c in clusters if len(c["sources"]) > 1]
    logger.info(
        f"Clustering complete: {len(raw_records)} raw records -> "
        f"{len(clusters)} canonical clusters "
        f"({len(multi_source_clusters)} cross-reported events)."
    )
    
    # 3. Layer 3: Single-Table Storage (PostgreSQL)
    inserted, updated = store_clusters_in_db(clusters)
    
    end_time = datetime.now(timezone.utc)
    duration_secs = round((end_time - start_time).total_seconds(), 2)
    
    summary = {
        "status": "success",
        "duration_seconds": duration_secs,
        "raw_collected": len(raw_records),
        "collector_breakdown": collector_stats,
        "unique_clusters": len(clusters),
        "multi_publisher_clusters": len(multi_source_clusters),
        "db_inserted": inserted,
        "db_updated": updated,
        "timestamp": end_time.isoformat()
    }
    
    logger.info(f">>> PIPELINE EXECUTION FINISHED IN {duration_secs}s <<<")
    logger.info(json.dumps(summary, indent=2))
    return summary


def run_quick_refresh(constituency: str, district: str | None = None) -> Dict[str, Any]:
    """A FAST, narrow refresh for one team: that constituency's news, the people we follow by name there, and its district.
    A handful of web requests (seconds), instead of the full run over all 119 constituencies, 33 districts and the publishers.
    Goes through the same de-duplication and storage as the full run, so the result looks exactly the same."""
    import httpx
    from file1_google_rss import CONSTITUENCY_TELUGU, HEADERS, WATCHED_PEOPLE, fetch_constituency_rss, fetch_district_rss

    t0 = datetime.now(timezone.utc)
    te_kw = next((k for k, canon in CONSTITUENCY_TELUGU.items() if canon == constituency), None)
    records: List[Dict[str, Any]] = []
    with httpx.Client(headers=HEADERS, follow_redirects=True) as client, ThreadPoolExecutor(max_workers=6) as ex:
        jobs = []
        if te_kw:
            jobs.append(ex.submit(fetch_constituency_rss, client, constituency, te_kw))
        for canon, name_kw in WATCHED_PEOPLE:
            if canon == constituency:
                jobs.append(ex.submit(fetch_constituency_rss, client, canon, name_kw))
        if district and district not in ("All", "Statewide"):
            jobs.append(ex.submit(fetch_district_rss, client, district, "en"))
            jobs.append(ex.submit(fetch_district_rss, client, district, "te"))
        for job in as_completed(jobs):
            try:
                records.extend(job.result())
            except Exception as exc:
                logger.error(f"Quick refresh collector failed: {exc}")
    clusters = deduplicate_and_cluster(records, similarity_threshold=0.70) if records else []
    inserted, updated = store_clusters_in_db(clusters) if clusters else (0, 0)
    end = datetime.now(timezone.utc)
    return {"found": len(records), "new": inserted, "updated": updated,
            "seconds": round((end - t0).total_seconds(), 1), "at": end.isoformat()}


if __name__ == "__main__":
    result = run_pipeline()
    print("\n--- Pipeline Summary ---")
    for k, v in result.items():
        print(f"{k}: {v}")
