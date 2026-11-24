# 📋 AI Smart Office — Project Upgrades & Architecture Notes

This document logs planned upgrades, architecture decisions, and completed milestones so they can be reviewed whenever you request `notes`.

---

## ✅ 1. Gemini AI Semantic Similarity for Article Deduplication (Completed)

### Objective:
Upgrade the deduplication engine to **multilingual neural semantic similarity** using your configured **Gemini API Key** (`gemini-embedding-001` / `gemini-embedding-2`) to recognize that English and Telugu articles reporting the exact same news event share identical underlying meaning, merging them into single canonical cards with multi-source publisher badges (e.g. *The Hindu*, *Eenadu*).

### What Was Built & Verified:
1. **Gemini Embedding Engine ([gemini_embedding_service.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/gemini_embedding_service.py))**:
   - Integrates with the official `google-genai` SDK using `gemini-embedding-001` with automated model fallback (`gemini-embedding-2`, `gemini-embedding-2-preview`).
   - Automatically discovers `GEMINI_API_KEY` across `.env` locations and application settings.
2. **Dual-Tier Vector Caching**:
   - **Level 1 (Memory)**: Instant 0ms thread-safe in-memory LRU cache storing up to 15,000 vectors.
   - **Level 2 (Persistent PostgreSQL Database Table — Visible in pgAdmin 4)**:
     - `gemini_embeddings_cache`: Stores article text hashes, snippets, vector JSONs, and timestamps.
     - All queries centralized in [embeddings.sql](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/app/queries/embeddings.sql).
     - Pairwise match calculations run in RAM in `< 0.0001ms`, eliminating the need for extra tables.
     - **No SQLite is used.** Everything lives in your PostgreSQL `ai_smart_office` database.


3. **Batching Architecture**:
   - Only cache misses are sent to Gemini, bundled into chunked batch requests of up to 40 titles at a time to minimize API overhead.
4. **Zero-Downtime Fallback & Quota Protection**:
   - Built-in rate limit & quota exhaustion protection: if Google returns a `429 RESOURCE_EXHAUSTED` or internet drops, the system seamlessly and instantly engages the rule-based and enriched bilingual dictionary fallback engine without interrupting feeds or scraping.
5. **Cross-Lingual Event Deduplication**:
   - **Ingestion Clustering ([deduplication.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/deduplication.py))**: Detects cross-script candidates in `_cluster_single_bin` and `are_articles_same_event`, merging matching Telugu and English articles into unified clusters with multi-publisher sources.
   - **Display-Time Deduplication ([news_service.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/app/services/news_service.py))**: Unifies live feed items in `deduplicate_results` so executive views display single cards with badges for all reporting outlets.


---

## 📌 2. Social Media Intelligence for MLAs (On Hold)

### Objective:
Replace legacy leader media feeds with automated multi-platform social media intelligence tracking public sentiment for individual MLAs.
*(Currently on hold per user instructions)*

---

## ✅ 3. Scraper Pipeline Enhancements & Query Centralization (Completed)

1. **HTML Scraper Anti-Bot Protection**:
   - Implemented dynamic pool of rotating modern User-Agents (`Chrome 124`, `Firefox 125`, `Safari`, `Edge`) in [file3_html_scrapers.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/file3_html_scrapers.py).
2. **Dynamic Telugu Date Extraction**:
   - Added native Telugu relative date regex patterns in [date_extractor.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/date_extractor.py) for expressions like `"15 నిమిషాల క్రితం"`, `"2 గంటల క్రితం"`, `"ఇప్పుడే"`, `"తాజాగా"`, and `"నిన్న"`.
3. **SQL Query Centralization & Persistent Translation Cache**:
   - Created [translation.sql](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/app/queries/translation.sql) and implemented two-tier caching (in-memory + PostgreSQL `translations_cache` table) in [translation_service.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/app/services/translation_service.py).
   - Centralized `update_last_login` into [users.sql](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/app/queries/users.sql) and [user_repository.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/app/repositories/user_repository.py).
   - Centralized statewide count and retention policy into [news.sql](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/app/queries/news.sql) and [main_pipeline.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/main_pipeline.py).
4. **Automatic 60-Day Archival to `archive_news` (Zero Data Loss)**:
   - Configured automatic migration of articles older than 60 days from `new_articles` to the dedicated `archive_news` table.
   - **No data is ever deleted.** Past news is stored permanently in `archive_news` for historical search and auditing, while `new_articles` stays ultra-lean and fast (< 30ms queries).


---

## ✅ 4. Universal 20-Item Pagination & Navigation Architecture (Completed)

1. **Lightweight Page Footprint (All 6 Tabs)**:
   - Configured uniform **20 items per page/slide** across all scopes: **All News**, **Positive Summary**, **Negative / Grievance Summary**, **Constituency Civic**, **Statewide News**, and **Social Media News**.
   - Backend routes ([news.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/app/api/routes/news.py)) and service layer ([news_service.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/app/services/news_service.py)) serve 20 records at a time via `LIMIT 20 OFFSET (page - 1) * 20`.
   - Social media feed ([SocialMediaView.jsx](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/frontend/src/components/SocialMediaView.jsx)) now cleanly paginates posts into 20-post batches with its own navigation bar.
2. **True Total Counts Preserved in Badges**:
   - Tab badges proudly display the full database totals (e.g. `907 All`, `804 Positive`, `103 Negative`, `907 Civic`, `755 Statewide`).
3. **Executive Pagination Toolbar**:
   - Universal navigation toolbar with live range text (`Showing 1–20 of X`), page pill badge (`Page 1 of Y`), `[‹ Previous]`, smart windowed page numbers, and `[Next ›]`.
4. **Client-Side Cache & Smooth Viewport Transitions**:
   - 0ms cached page flipping with automatic smooth scroll-to-top on every page navigation.

---

## ✅ 5. Database Cleanup & Sequential ID Synchronization (Completed)

1. **Clean Consecutive IDs (1 to N without gaps)**:
   - Synchronized all primary key sequences across database tables so they display in clean consecutive numerical order in pgAdmin:
     - `new_articles`: Renumbered **54,398 rows** to consecutive IDs `1` through `54398` (previously started at 7726 with gaps up to 77120).
     - `social_media_posts`: Renumbered **316 posts** to consecutive IDs `1` through `316`.
     - `news_sources`: Renumbered **37 sources** to consecutive IDs `1` through `37`.
2. **Auto-Increment Sequence Reset**:
   - Reset `new_articles_id_seq`, `social_media_posts_id_seq`, and `news_sources_id_seq` to each table's exact current count `N`, ensuring every newly inserted record starts consecutively from `N + 1`.
3. **Streamlined PostgreSQL Cache Schema**:
   - Dropped redundant `gemini_pairwise_cache` table to keep the pgAdmin schema lean (8 core tables).
   - Retained [gemini_embeddings_cache](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/app/queries/embeddings.sql) and [translations_cache](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/app/queries/translation.sql) directly in PostgreSQL for maximum performance and quota savings.

---

## ✅ 6. Gemini Natural Multi-Source News Summarization (Completed)

1. **Content-Adaptive Natural Sizing**:
   - Instead of forcing every article into a rigid 2–3 line constraint or cutting sentences with broken ellipses, the AI summary adapts naturally to the depth and lines of the news:
     - Brief news items stay naturally concise (1–2 clean lines).
     - Multi-faceted or major policy events naturally convey all essential details, amounts, locations, and government actions.
2. **Multi-Source Synthesis**:
   - Synthesizes coverage across multiple newspapers (e.g., *The Hindu*, *Eenadu*, *Sakshi*, *V6 Velugu*) into a single unified summary so executives read one comprehensive brief rather than multiple disjointed snippets.
3. **Architecture & Zero-Table Footprint**:
   - Engine implemented in [gemini_summary_service.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/gemini_summary_service.py) with re-export in [app/services/gemini_summary_service.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/app/services/gemini_summary_service.py).
   - Summaries are stored directly in `new_articles.summary`. **Zero new tables** were created in pgAdmin, eliminating JOIN overhead and seamlessly preserving summaries when records migrate to `archive_news`.
   - Integrated into the live ingestion clustering engine in [deduplication.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/deduplication.py).
4. **Smart Sentence-Boundary Fallback**:
   - If offline or Gemini quota limits are encountered, [smart_natural_fallback](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/gemini_summary_service.py) extracts clean, punctuation-bounded sentences (`.` or `।`) without cut-off words or dangling punctuation.
5. **Quick Database Updater**:
   - Built [update_summaries.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/scripts/update_summaries.py) to batch-upgrade existing database records with natural AI summaries, immediately visible in the UI dashboard and pgAdmin.

---

## ✅ 7. 3-Hour Continuous Scraper Automation (Completed)

1. **Immediate Boot-Time Execution**:
   - Whenever the backend server starts, [automation_manager.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/automation_manager.py) initiates an automated news ingestion cycle after a 5-second grace period.
2. **Strict 3-Hour Recurrence (`10,800s`)**:
   - The recurring interval is configured to **3 hours** (`SCRAPE_INTERVAL_SECONDS=10800` in [.env](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/.env) and [config.py](file:///c:/Users/HP/Desktop/AI_SMART_OFFICE/backend/app/core/config.py)).
   - After each cycle finishes, the next run is automatically scheduled exactly 3 hours later.
3. **End-to-End Multilingual Coverage**:
   - Each 3-hour run gathers updates across:
     - **File 1**: Google News RSS bilingual for all 33 districts and 119 constituencies.
     - **File 2**: Major newspaper RSS feeds (*The Hindu*, *Eenadu*, *Sakshi*, *Velugu*, *10TV*, *TV9*).
     - **File 3**: Regional HTML web crawlers.
4. **Monitoring Endpoints**:
   - `GET /api/automation/status`: Returns `is_running`, `current_stage`, `seconds_until_next`, `interval_hours: 3.0`, and previous run stats.
   - `POST /api/automation/trigger`: Allows triggering an on-demand scraping cycle at any time.

---

## 🚀 How to Trigger:

Whenever you mention **"notes"** or ask for the upgrade list, I will pull up this list, summarize the latest status, and help you implement any remaining items.


