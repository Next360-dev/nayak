# AI Smart Office 🏢✨
> **AI-Powered Governance & Political Intelligence Platform for Telangana State**

An end-to-end civic intelligence, media monitoring, and office automation platform tailored for the 119 Assembly Constituencies and 33 Districts of Telangana. Built with a high-performance Python FastAPI backend, PostgreSQL database engine, multi-source ingestion scrapers, and a responsive glassmorphic Web UI.

---

## 🏗️ System Architecture

```text
                               TELANGANA NEWS & CIVIC PLATFORM
                                              │
              ┌───────────────────────────────┴───────────────────────────────┐
              │                                                               │
        LIVE INGESTION                                                 HISTORY ARCHIVE
              │                                                               │
    3-Stage Multi-Source Pipeline                                   Daily Archive & Sitemaps
  ┌────────────────────────────────────────┐                       (Historical Search & Backfill)
  │ • file1_google_rss.py (District/MLA)   │                                  │
  │ • file2_publisher_rss.py (Eenadu, TV9) │                                  │
  │ • file3_html_scrapers.py (Deep HTML)    │                                  │
  └────────────────────────────────────────┘                                  │
              │                                                               │
              └───────────────────────────────┬───────────────────────────────┘
                                              │
                                      PostgreSQL Engine
                                 (ai_smart_office Database)
                               • 17,500+ Verified Clean Articles
                               • Strict Regional Filtering (Telangana-Only)
                               • Multi-Source Deduplication & Merging
                                              │
              ┌───────────────────────────────┴───────────────────────────────┐
              │                                                               │
       FastAPI REST API                                                Web Dashboard
    (http://localhost:8080)                                       (http://localhost:5173)
              │                                                               │
   • Regional & MLA Classification                             • Glassmorphic Theme & Responsive UI
   • Telugu Word-Boundary Stemming                             • Today's Live vs. History Archive
   • Automated Scraping Loop                                   • Multi-Platform Social Media Intelligence
   • Image Proxy & Fallbacks                                   • Unified 🔴 Priority Alert Banner
   • Representatives Directory                                 • Clean Multi-User Session Isolation
```

---

## 🌟 Core Features & Capabilities

### 1. 📰 3-Tier Multi-Source News Ingestion
* **Multi-Stage Scrapers**:
  * **Stage 1 (`file1_google_rss.py`)**: Real-time Google News RSS crawler tracking all 33 districts and 119 MLAs.
  * **Stage 2 (`file2_publisher_rss.py`)**: Direct RSS feeds from major Telugu and English media (*Eenadu*, *Andhra Jyothy*, *TV9 Telugu*, *NTV Telugu*, *Namasthe Telangana*, *V6 Velugu*, *The Hindu*, *Deccan Chronicle*).
  * **Stage 3 (`file3_html_scrapers.py`)**: Targeted regional HTML web scrapers with IST date parsing and anti-bot headers.
* **Strict Regional Filtering**: Ingestion filters automatically reject non-Telangana content (Andhra Pradesh news, international tragedies, cinema gossip, astrology, and commodity rate tickers).

### 2. 🗺️ Hyperlocal Regional & Politician Categorization
* **Complete State Mapping**: Exhaustive database of all **33 Districts**, **119 Assembly Constituencies**, **612 Mandals**, and **119 MLAs & Key Ministers** (`backend/constituency_mappings.py`).
* **Pre-Compiled Telugu Boundary Matching**: Eliminates false positives (e.g. *తుమ్మలగుంట* in Tirupati does not falsely match Khammam MLA *తుమ్మల*) with 37x faster classification speeds.
* **Zero Artificial Injection**: Articles mentioning only a district stay at the district level without bleeding into individual constituency feeds.
* **Seamless District Fallback**: If a constituency has 0 direct civic reports today, the dashboard cleanly surfaces parent district news with a clear fallback indicator.

### 3. 🎯 Multi-Platform Social Media News & Sentiment Intelligence
* **Cross-Platform Scraping**: Real-time monitoring of **Instagram**, **Twitter / X**, **YouTube**, and **Facebook** for mentions, videos, and discussions of each individual MLA.
* **Positive vs. Negative Sentiment Breakdown**: Automatic classification of social posts as **Positive** or **Negative** for the individual MLA, complete with engagement metrics (likes, views, shares, comments) and interactive filter tabs.
* **Today's Live vs. History Archive**: Switch between real-time breaking news and historical archives with single-click presets (`Past 24h`, `3 Days`, `7 Days`, `14 Days`, `All Past`) and date pickers.
* **Category Filtering**:
  * **🏛️ Constituency Civic News**: Local issues, road repairs, drinking water, hospital facilities, agriculture, and grievances.
  * **📱 Social Media News**: Multi-platform MLA sentiment tracking, viral public discussions, positive testimonials, and critical feedback.

### 4. 🔴 High-Priority Emergency Ticker
* Replaced fragmented priority badges with a unified, high-visibility **`🔴 PRIORITY ALERT`** ticker scrolling at the top of the portal for genuine civic emergencies.
* Includes a 3-line filter toggle button on the banner for instant access to search filters.

### 5. 🛡️ Robust Multi-User Session State Isolation
* Instant DOM and state wipe (`clearDashboardState`) upon logout to prevent any flashing or leakage of previously viewed constituency data.
* Network request epoch guards discard stale in-flight API responses when switching between users or opening the Admin console.

---

## 📁 Repository Structure

```text
AI_SMART_OFFICE/
├── backend/                      # Python REST API & Intelligence Engine
│   ├── api/                      # FastAPI Application
│   │   ├── main.py               # API Routes & Lifespan Automation Scheduler
│   │   ├── db.py                 # Core Query Engine & Regional Aggregations
│   │   ├── image_proxy.py        # Referer-Bypassing Publisher Image Proxy
│   │   └── schemas.py            # Pydantic Schemas & Type Definitions
│   ├── automation_manager.py     # Background Scheduler & Ingestion Coordinator
│   ├── constituency_mappings.py  # 33 Districts, 119 Constituencies & Telugu Stemming
│   ├── content_extractor.py      # Article Body & Metadata Parser
│   ├── date_extractor.py         # Strict IST Publication Date Verifier
│   ├── deduplication.py          # Fuzzy URL & Headline Deduplication Layer
│   ├── district_data.py          # Comprehensive District & Mandal Data
│   ├── file1_google_rss.py       # Stage 1: Google News RSS Scraper
│   ├── file2_publisher_rss.py    # Stage 2: News Publisher Direct RSS Ingestion
│   ├── file3_html_scrapers.py    # Stage 3: Regional Portal HTML Scrapers
│   ├── main_pipeline.py          # Unified Multi-Stage Scraper Orchestrator
│   ├── purge_and_reclassify.py   # Database Sanitization & Reclassification Utility
│   ├── requirements.txt          # Python Dependencies
│   └── .env.example              # Template Environment Configuration
├── frontend/                     # React + Vite Client Application
│   ├── src/                      # React Source Code
│   │   ├── components/           # UI Components (LoginModal, Header, NewsFeed, etc.)
│   │   ├── utils/                # API Client & Localization Constants
│   │   ├── App.jsx               # Application State & Orchestration
│   │   └── main.jsx              # React DOM Mount Entry Point
│   ├── public/                   # Public Static Assets (login-bg.jpg)
│   ├── index.html                # Vite HTML Root Entry
│   ├── styles.css                # Original Glassmorphic Design System
│   ├── login-bg.jpg              # Original Login Background
│   ├── vite.config.js            # Vite Configuration & Backend Proxy (/api -> 8080)
│   └── package.json              # Frontend Dependencies & Scripts
├── .gitignore                    # Git Exclusion Rules
└── README.md                     # Master Platform Documentation
```

---

## 🚀 Developer Quickstart Guide

### 1. Prerequisites
* **Python 3.10+**
* **Node.js 18+ & npm**
* **PostgreSQL Database Server** (v14+)
* **Git**

---

### 2. Clone Repository & Set Up Virtual Environment

```powershell
# Clone repository
git clone https://github.com/vineethreddy09/AI_SMART_OFFICE.git
cd AI_SMART_OFFICE

# Create virtual environment inside backend
python -m venv backend/venv

# Activate virtual environment
# Windows PowerShell:
.\backend\venv\Scripts\Activate.ps1
# Linux / macOS:
source backend/venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

---

### 3. Configure Database & Environment

1. **Create PostgreSQL Database**:
   ```sql
   CREATE DATABASE ai_smart_office;
   ```

2. **Configure Environment File**:
   Copy `backend/.env.example` to `backend/.env` and update your PostgreSQL credentials:
   ```ini
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=ai_smart_office
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   ```

3. **Restore Database Dump (Optional)**:
   If restoring from a backup dump:
   ```powershell
   psql -U postgres -d ai_smart_office -f ai_smart_office.sql
   ```

---

### 4. Start the Application

#### Terminal 1: FastAPI Backend Server
```powershell
cd backend
.\venv\Scripts\python.exe -m app.main
```
* API Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* Health Status: [http://127.0.0.1:8000/api/news/automation_status](http://127.0.0.1:8000/api/news/automation_status)

#### Terminal 2: React + Vite Frontend
```powershell
cd frontend
npm install
npm run dev
```
* Dashboard URL: 👉 **[http://localhost:5173](http://localhost:5173)**
* **Backend Communication**: Vite automatically proxies all `/api/*` network requests to `http://127.0.0.1:8080` without requiring any CORS or backend server configuration changes.

For production builds:
```powershell
cd frontend
npm run build
npm run preview
```

---

## 🔑 Login & Access Roles

The portal supports role-based access for Telangana leadership and administration:

| Role | Username Example | Access Scope |
|---|---|---|
| **Master Admin** | `admin` | Statewide aggregate view, all 33 districts, all 119 MLAs, and full system management. |
| **Constituency MLA** | `mla_sircilla`, `mla_mulugu`, `mla_gajwel`, etc. | Automatically locked to representative's constituency, localized civic issues, and personal media footprint. |

---

## 🛠️ Maintenance & Utility Scripts

* **Database Reclassification & Purge**:
  ```powershell
  .\backend\venv\Scripts\python.exe backend/purge_and_reclassify.py
  ```
  Scans all articles, strips false constituency tags, purges unrelated news, and verifies database integrity.

* **Run Master Scraping Pipeline Manually**:
  ```powershell
  .\backend\venv\Scripts\python.exe backend/main_pipeline.py
  ```

---

## 📜 License
Proprietary governance intelligence platform developed for Telangana State Government and elected representatives. All rights reserved.
