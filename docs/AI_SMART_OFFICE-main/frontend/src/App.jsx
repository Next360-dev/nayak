import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import UrgentAlertBanner from './components/UrgentAlertBanner';
import SidebarFilters from './components/SidebarFilters';
import NewsFeed from './components/NewsFeed';
import RepresentativesDirectory from './components/RepresentativesDirectory';
import LoginModal from './components/LoginModal';
import OutletsModal from './components/OutletsModal';
import { TRANSLATIONS } from './utils/constants';
import {
  fetchHierarchy,
  fetchPoliticians,
  fetchNews,
  fetchUrgentAlerts,
  fetchRepresentatives
} from './utils/api';

export default function App() {
  // Session & Authentication
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('ai_office_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoginOpen, setIsLoginOpen] = useState(!currentUser);
  const sessionEpochRef = useRef(0);

  // Localization
  const [currentLang, setCurrentLang] = useState(() => {
    return localStorage.getItem('ai_office_lang') || 'en';
  });
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  // Metadata
  const [districts, setDistricts] = useState([]);
  const [allPoliticians, setAllPoliticians] = useState([]);

  // Sidebar & Navigation
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Filters
  const isMla = currentUser?.role === 'mla';
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState(isMla ? (currentUser?.district_name || 'All') : 'All');
  const [selectedPolitician, setSelectedPolitician] = useState(isMla ? (currentUser?.politician_name || 'All') : 'All');
  const [selectedConstituency, setSelectedConstituency] = useState(isMla ? (currentUser?.constituency_name || 'All') : 'All');
  const [selectedPriority, setSelectedPriority] = useState('0');

  // Feed Views & Scope
  const [period, setPeriod] = useState('today');
  const [newsScope, setNewsScope] = useState('all');
  const [historyDateRange, setHistoryDateRange] = useState('all');
  const [historySpecificDate, setHistorySpecificDate] = useState('');

  // Data & Loading
  const [articles, setArticles] = useState([]);
  const [scopeCounts, setScopeCounts] = useState({ all: 0, civic: 0, social: 0 });
  const [urgentAlerts, setUrgentAlerts] = useState([]);
  const [reps, setReps] = useState([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [newsError, setNewsError] = useState('');
  const [isLoadingReps, setIsLoadingReps] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    offset: 0,
    total_records: 0,
    total_pages: 1,
    has_next: false,
    has_prev: false
  });

  // Modal
  const [activeOutletsArticle, setActiveOutletsArticle] = useState(null);

  // Feed fetch cache
  const lastNewsRequestKeyRef = useRef('');
  const feedCacheRef = useRef(new Map());

  // Keep body class in sync with sidebar state
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
  }, [isSidebarOpen]);

  // Load Hierarchy & Politicians on mount
  useEffect(() => {
    async function loadMeta() {
      try {
        const [hRes, pRes] = await Promise.all([fetchHierarchy(), fetchPoliticians()]);
        if (hRes.status === 'success' && hRes.data?.districts) {
          setDistricts(hRes.data.districts);
        }
        if (pRes.status === 'success' && pRes.politicians) {
          setAllPoliticians(pRes.politicians);
        }
      } catch (err) {
        console.error('Failed to load initial metadata:', err);
      }
    }
    loadMeta();
  }, []);

  // Fetch News Feed
  const loadNews = useCallback(async (isSilent = false, overrideParams = {}) => {
    if (!currentUser) return;
    const thisEpoch = sessionEpochRef.current;

    const effectivePeriod = overrideParams.period !== undefined ? overrideParams.period : period;
    const effectiveScope = overrideParams.newsScope !== undefined ? overrideParams.newsScope : newsScope;
    const effectiveDateRange = overrideParams.dateRange !== undefined ? overrideParams.dateRange : historyDateRange;
    const effectiveSpecificDate = overrideParams.specificDate !== undefined ? overrideParams.specificDate : historySpecificDate;
    const effectivePage = overrideParams.page !== undefined ? overrideParams.page : (overrideParams.resetPage ? 1 : currentPage);

    // Cache key for current query parameters including page
    const cacheKey = `${effectivePeriod}|${effectiveScope}|${effectiveDateRange}|${effectiveSpecificDate}|${selectedDistrict}|${selectedPolitician}|${selectedConstituency}|${searchKeyword}|${selectedPriority}|p${effectivePage}`;

    // Instant display from client cache if available
    const cached = feedCacheRef.current.get(cacheKey);
    if (cached && !overrideParams.force) {
      setArticles(cached.articles || []);
      if (cached.pagination) {
        setPagination(cached.pagination);
      }
      if (cached.scopeCounts) {
        setScopeCounts(prev => ({
          ...prev,
          ...cached.scopeCounts,
          positive: effectiveScope === 'statewide' && prev?.positive !== undefined ? prev.positive : (cached.scopeCounts.positive ?? prev?.positive),
          negative: effectiveScope === 'statewide' && prev?.negative !== undefined ? prev.negative : (cached.scopeCounts.negative ?? prev?.negative),
          all: effectiveScope === 'statewide' && prev?.all !== undefined ? prev.all : (cached.scopeCounts.all ?? prev?.all),
          civic: effectiveScope === 'statewide' && prev?.civic !== undefined ? prev.civic : (cached.scopeCounts.civic ?? prev?.civic),
        }));
      }
      setIsLoadingNews(false);
      isSilent = true;
    }

    // Deduplicate identical consecutive requests unless forced
    const requestKey = `${thisEpoch}|${cacheKey}`;
    if (!overrideParams.force && lastNewsRequestKeyRef.current === requestKey && !isSilent) {
      return;
    }
    lastNewsRequestKeyRef.current = requestKey;

    if (!isSilent && !cached) {
      setIsLoadingNews(true);
      setNewsError('');
    }

    try {
      const data = await fetchNews({
        district: selectedDistrict,
        politician: selectedPolitician,
        constituency: selectedConstituency,
        search: searchKeyword,
        priority: selectedPriority,
        period: effectivePeriod,
        newsScope: effectiveScope,
        dateRange: effectiveDateRange,
        specificDate: effectiveSpecificDate,
        page: effectivePage,
        limit: 20,
        currentUser
      });

      if (thisEpoch !== sessionEpochRef.current) return;

      if (data.status === 'success') {
        const fetchedArticles = data.articles || [];
        setArticles(fetchedArticles);
        if (data.pagination) {
          setPagination(data.pagination);
        }
        if (data.scope_counts) {
          setScopeCounts(prev => ({
            ...prev,
            ...data.scope_counts,
            positive: effectiveScope === 'statewide' && prev?.positive !== undefined ? prev.positive : (data.scope_counts.positive ?? prev?.positive),
            negative: effectiveScope === 'statewide' && prev?.negative !== undefined ? prev.negative : (data.scope_counts.negative ?? prev?.negative),
            all: effectiveScope === 'statewide' && prev?.all !== undefined ? prev.all : (data.scope_counts.all ?? prev?.all),
            civic: effectiveScope === 'statewide' && prev?.civic !== undefined ? prev.civic : (data.scope_counts.civic ?? prev?.civic),
          }));
        }
        // Save to cache for instant tab transitions
        feedCacheRef.current.set(cacheKey, {
          articles: fetchedArticles,
          pagination: data.pagination,
          scopeCounts: data.scope_counts
        });

        // Background pre-fetch Statewide news if currently on 'all' so tab click is 0ms instant
        if (effectiveScope === 'all' && effectivePeriod === 'today') {
          const swKey = `today|statewide|${effectiveDateRange}|${effectiveSpecificDate}|${selectedDistrict}|${selectedPolitician}|${selectedConstituency}|${searchKeyword}|${selectedPriority}|p1`;
          if (!feedCacheRef.current.has(swKey)) {
            fetchNews({
              district: selectedDistrict,
              politician: selectedPolitician,
              constituency: selectedConstituency,
              search: searchKeyword,
              priority: selectedPriority,
              period: 'today',
              newsScope: 'statewide',
              dateRange: effectiveDateRange,
              specificDate: effectiveSpecificDate,
              page: 1,
              limit: 20,
              currentUser
            }).then(swData => {
              if (swData.status === 'success' && swData.articles) {
                feedCacheRef.current.set(swKey, {
                  articles: swData.articles,
                  pagination: swData.pagination,
                  scopeCounts: swData.scope_counts
                });
                if (swData.scope_counts?.statewide) {
                  setScopeCounts(prev => ({
                    ...prev,
                    statewide: swData.scope_counts.statewide
                  }));
                }
              }
            }).catch(() => { });
          }
        }
      } else {
        setNewsError(data.error || 'Failed to load news');
      }
    } catch (err) {
      if (thisEpoch !== sessionEpochRef.current) return;
      console.error('Error fetching news:', err);
      setNewsError(`Error loading news: ${err.message || 'Unable to reach backend server'}. Please ensure backend is running.`);
    } finally {
      if (thisEpoch === sessionEpochRef.current) {
        setIsLoadingNews(false);
      }
    }
  }, [
    currentUser,
    selectedDistrict,
    selectedPolitician,
    selectedConstituency,
    searchKeyword,
    selectedPriority,
    period,
    newsScope,
    historyDateRange,
    historySpecificDate,
    currentPage
  ]);

  // Fetch Urgent Alerts
  const loadAlerts = useCallback(async () => {
    if (!currentUser) {
      setUrgentAlerts([]);
      return;
    }

    const activeConst = (currentUser && currentUser.constituency_name && currentUser.constituency_name !== 'All')
      ? currentUser.constituency_name
      : (selectedConstituency && selectedConstituency !== 'All' && selectedConstituency !== 'All Assembly Constituencies' ? selectedConstituency : null);

    try {
      const alerts = await fetchUrgentAlerts({ period, activeConst });
      setUrgentAlerts(alerts || []);
    } catch (err) {
      console.warn('Error loading urgent alerts:', err);
    }
  }, [currentUser, selectedConstituency, period]);

  // Fetch Representatives
  const loadReps = useCallback(async () => {
    if (!currentUser) return;
    const thisEpoch = sessionEpochRef.current;
    setIsLoadingReps(true);

    try {
      const dist = (currentUser && currentUser.role === 'mla')
        ? currentUser.district_name
        : (selectedDistrict !== 'All' ? selectedDistrict : null);

      const data = await fetchRepresentatives(dist);
      if (thisEpoch !== sessionEpochRef.current) return;

      if (data.status === 'success') {
        let repList = data.representatives || [];
        if (currentUser && currentUser.role === 'mla') {
          const cleanUserConst = (currentUser.constituency_name || '').replace(/\s*\((SC|ST)\)/i, '').trim().toLowerCase();
          const userPol = (currentUser.politician_name || '').toLowerCase();
          const filtered = repList.filter(r =>
            r.constituency_name === currentUser.constituency_name ||
            (r.constituency_name || '').replace(/\s*\((SC|ST)\)/i, '').trim().toLowerCase() === cleanUserConst ||
            (r.name || '').toLowerCase() === userPol
          );
          if (filtered.length > 0) repList = filtered;
        } else {
          if (selectedConstituency && selectedConstituency !== 'All') {
            repList = repList.filter(r => r.constituency_name === selectedConstituency);
          }
          if (selectedPolitician && selectedPolitician !== 'All') {
            repList = repList.filter(r => r.name === selectedPolitician);
          }
        }
        setReps(repList);
      }
    } catch (err) {
      console.error('Error fetching reps:', err);
    } finally {
      if (thisEpoch === sessionEpochRef.current) {
        setIsLoadingReps(false);
      }
    }
  }, [currentUser, selectedDistrict, selectedConstituency, selectedPolitician]);

  // Trigger data loading when relevant state changes
  useEffect(() => {
    if (currentUser) {
      loadNews();
      loadAlerts();
      loadReps();
    }
  }, [
    currentUser,
    period,
    newsScope,
    historyDateRange,
    historySpecificDate,
    selectedDistrict,
    selectedPolitician,
    selectedConstituency,
    selectedPriority
  ]);

  // 30-second silent news refresh
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentUser && !isLoginOpen) {
        loadNews(true);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [currentUser, isLoginOpen, loadNews]);


  // Authentication handlers
  const handleLoginSuccess = (user) => {
    sessionEpochRef.current++;
    setCurrentUser(user);
    localStorage.setItem('ai_office_user', JSON.stringify(user));
    setIsLoginOpen(false);

    // Set initial filters for user
    if (user.role === 'mla') {
      setSelectedDistrict(user.district_name || 'All');
      setSelectedPolitician(user.politician_name || 'All');
      setSelectedConstituency(user.constituency_name || 'All');
    } else {
      setSelectedDistrict('All');
      setSelectedPolitician('All');
      setSelectedConstituency('All');
    }

    setSearchKeyword('');
    setSelectedPriority('0');
    setPeriod('today');
    setNewsScope('all');
    setHistoryDateRange('all');
    setHistorySpecificDate('');
  };

  const handleLogout = () => {
    sessionEpochRef.current++;
    setCurrentUser(null);
    localStorage.removeItem('ai_office_user');
    setIsLoginOpen(true);
    setArticles([]);
    setUrgentAlerts([]);
    setReps([]);
    setActiveOutletsArticle(null);
    setIsSidebarOpen(false);
  };

  // Scroll to article from ticker
  const handleScrollToArticle = (id) => {
    if (!id) return;
    let el = document.getElementById(`article-card-${id}`);

    if (!el && newsScope !== 'all') {
      setNewsScope('all');
      setTimeout(() => {
        const delayedEl = document.getElementById(`article-card-${id}`);
        if (delayedEl) {
          delayedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          delayedEl.classList.remove('article-target-glow');
          void delayedEl.offsetWidth;
          delayedEl.classList.add('article-target-glow');
          setTimeout(() => delayedEl.classList.remove('article-target-glow'), 3000);
        }
      }, 300);
      return;
    }

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('article-target-glow');
      void el.offsetWidth;
      el.classList.add('article-target-glow');
      setTimeout(() => el.classList.remove('article-target-glow'), 3000);
    }
  };

  const activeConstituencyForBanner = (currentUser && currentUser.constituency_name && currentUser.constituency_name !== 'All')
    ? currentUser.constituency_name
    : (selectedConstituency && selectedConstituency !== 'All' ? selectedConstituency : null);

  return (
    <>
      {/* Fullscreen Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onLoginSuccess={handleLoginSuccess}
        allPoliticians={allPoliticians}
      />

      {/* Main Authenticated Application */}
      {!isLoginOpen && currentUser && (
        <>
          <div className="sticky-top-wrapper">
            <Header
              currentUser={currentUser}
              onLogout={handleLogout}
              t={t}
            />

            <UrgentAlertBanner
              alerts={urgentAlerts}
              activeConst={activeConstituencyForBanner}
              currentLang={currentLang}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
              onArticleClick={handleScrollToArticle}
            />
          </div>

          <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : ''}`} id="app-container">
            <SidebarFilters
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              currentUser={currentUser}
              districts={districts}
              allPoliticians={allPoliticians}
              searchKeyword={searchKeyword}
              setSearchKeyword={setSearchKeyword}
              selectedDistrict={selectedDistrict}
              setSelectedDistrict={setSelectedDistrict}
              selectedPolitician={selectedPolitician}
              setSelectedPolitician={setSelectedPolitician}
              selectedConstituency={selectedConstituency}
              setSelectedConstituency={setSelectedConstituency}
              selectedPriority={selectedPriority}
              setSelectedPriority={setSelectedPriority}
              onApplyFilters={() => {
                setCurrentPage(1);
                loadNews(false, { page: 1 });
                loadReps();
              }}
              onResetFilters={() => {
                setCurrentPage(1);
                setSearchKeyword('');
                setSelectedPriority('0');
                if (currentUser.role === 'mla') {
                  setSelectedDistrict(currentUser.district_name || 'All');
                  setSelectedPolitician(currentUser.politician_name || 'All');
                  setSelectedConstituency(currentUser.constituency_name || 'All');
                } else {
                  setSelectedDistrict('All');
                  setSelectedPolitician('All');
                  setSelectedConstituency('All');
                }
                setTimeout(() => {
                  loadNews(false, { page: 1 });
                  loadReps();
                }, 50);
              }}
              t={t}
            />

            <main className="main-content">
              <NewsFeed
                articles={articles}
                isLoading={isLoadingNews}
                error={newsError}
                currentUser={currentUser}
                currentLang={currentLang}
                period={period}
                onPeriodChange={(newPeriod) => {
                  setCurrentPage(1);
                  setPeriod(newPeriod);
                  loadNews(false, { period: newPeriod, page: 1 });
                }}
                historyDateRange={historyDateRange}
                onHistoryDateRangeChange={(range) => {
                  setCurrentPage(1);
                  setHistorySpecificDate('');
                  setHistoryDateRange(range);
                  loadNews(false, { period: 'history', dateRange: range, specificDate: '', page: 1 });
                }}
                historySpecificDate={historySpecificDate}
                onHistorySpecificDateChange={(date) => {
                  setCurrentPage(1);
                  setHistoryDateRange('all');
                  setHistorySpecificDate(date);
                  loadNews(false, { period: 'history', dateRange: 'all', specificDate: date, page: 1 });
                }}
                newsScope={newsScope}
                onNewsScopeChange={(newScope) => {
                  setCurrentPage(1);
                  setNewsScope(newScope);
                  loadNews(false, { newsScope: newScope, page: 1 });
                }}
                scopeCounts={scopeCounts}
                currentPage={currentPage}
                pagination={pagination}
                onPageChange={(newPage) => {
                  setCurrentPage(newPage);
                  loadNews(false, { page: newPage });
                  const target = document.getElementById('feed-title') || document.getElementById('news-cards-container');
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                onOpenOutletsModal={(art) => setActiveOutletsArticle(art)}
                t={t}
                selectedConstituency={selectedConstituency}
                selectedPolitician={selectedPolitician}
                allPoliticians={allPoliticians}
              />

              <RepresentativesDirectory
                reps={reps}
                isLoading={isLoadingReps}
                currentLang={currentLang}
                t={t}
              />
            </main>
          </div>

          <OutletsModal
            isOpen={Boolean(activeOutletsArticle)}
            onClose={() => setActiveOutletsArticle(null)}
            article={activeOutletsArticle}
            currentLang={currentLang}
          />
        </>
      )}
    </>
  );
}
