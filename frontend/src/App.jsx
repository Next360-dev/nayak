import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import UrgentAlertBanner from './components/UrgentAlertBanner';
import SidebarFilters from './components/SidebarFilters';
import NewsFeed from './components/NewsFeed';
import OfficialPortfolioPage from './components/OfficialPortfolioPage';
import PublicPortfolioPage from './components/PublicPortfolioPage';
import LoginModal from './components/LoginModal';
import OutletsModal from './components/OutletsModal';
import ShareModal from './components/ShareModal';
import ShareInbox from './components/ShareInbox';
import AdminUsersModal from './components/AdminUsersModal';
import HomeDashboard from './components/home/HomeDashboard';
import LeaderDemo from './components/home/LeaderDemo';
import TopAlerts from './components/home/TopAlerts';
import Watchlist from './components/home/Watchlist';
import LeaderSuggestions from './components/LeaderSuggestions';
import WhatsAppUploads from './components/WhatsAppUploads';
import ComposeScreen from './components/ComposeScreen';
import ProjectTracker from './components/ProjectTracker';
import AccountDialog from './components/AccountDialog';
import BriefingDialog from './components/BriefingDialog';
import FeedbackDialog from './components/FeedbackDialog';
import * as browserAlerts from './lib/browserAlerts';
import AuditDialog from './components/AuditDialog';
import { LangProvider } from './i18n/LangContext';
import { STRINGS } from './i18n/strings';
import NavTabs from './components/home/NavTabs';
import LeaderIdentityBar from './components/home/LeaderIdentityBar';
import TeamModal from './components/TeamModal';
import TeamBoard from './components/TeamBoard';
import SurveyPage from './components/SurveyPage';
import { TRANSLATIONS } from './utils/constants';
import {
  fetchHierarchy,
  fetchPoliticians,
  fetchNews,
  fetchUrgentAlerts,
  fetchRepresentatives,
  fetchMe,
  fetchUnreadCount,
  getToken,
  setToken,
  AUTH_EXPIRED_EVENT
} from './utils/api';

export default function App() {
  const publicPortfolioMatch = window.location.pathname.match(/^\/public\/portfolio\/([^/]+)\/?$/);
  // Session & Authentication
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      // A saved user without a token is a stale pre-JWT session: force a fresh login.
      if (!getToken()) return null;
      const saved = localStorage.getItem('ai_office_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoginOpen, setIsLoginOpen] = useState(!currentUser);
  const sessionEpochRef = useRef(0);
  const [sessionNotice, setSessionNotice] = useState('');
  const [metaError, setMetaError] = useState(false);
  const [repsError, setRepsError] = useState(false);
  const [metaTick, setMetaTick] = useState(0);

  // Localization
  const [currentLang, setCurrentLang] = useState(() => {
    return localStorage.getItem('ai_office_lang') || 'en';
  });
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const toggleLang = useCallback(() => {
    setCurrentLang((prev) => {
      const next = prev === 'te' ? 'en' : 'te';
      try { localStorage.setItem('ai_office_lang', next); } catch { /* storage blocked */ }
      return next;
    });
  }, []);
  useEffect(() => { document.documentElement.lang = currentLang; }, [currentLang]);

  // Metadata
  const [districts, setDistricts] = useState([]);
  const [allPoliticians, setAllPoliticians] = useState([]);

  // Sidebar & Navigation
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [homeTick, setHomeTick] = useState(0);

  // Filters
  const isMla = currentUser?.scoped;
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

  // Load Hierarchy & Politicians once the user is signed in (the API requires a token)
  useEffect(() => {
    if (!currentUser) return;
    async function loadMeta() {
      setMetaError(false);
      try {
        const [hRes, pRes] = await Promise.all([fetchHierarchy(), fetchPoliticians()]);
        if (hRes.status === 'success' && hRes.data?.districts) {
          setDistricts(hRes.data.districts);
        } else {
          setMetaError(true);
        }
        if (pRes.status === 'success' && pRes.politicians) {
          setAllPoliticians(pRes.politicians);
        }
      } catch (err) {
        console.error('Failed to load initial metadata:', err);
        setMetaError(true);
      }
    }
    loadMeta();
  }, [currentUser?.username, metaTick]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setRepsError(false);

    try {
      const dist = (currentUser && currentUser.scoped)
        ? currentUser.district_name
        : (selectedDistrict !== 'All' ? selectedDistrict : null);

      const data = await fetchRepresentatives(dist);
      if (thisEpoch !== sessionEpochRef.current) return;

      if (data.status === 'success') {
        let repList = data.representatives || [];
        if (currentUser && currentUser.scoped) {
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
      } else {
        setRepsError(true);
      }
    } catch (err) {
      console.error('Error fetching reps:', err);
      if (thisEpoch === sessionEpochRef.current) setRepsError(true);
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
  const handleLoginSuccess = (user, token) => {
    sessionEpochRef.current++;
    if (token) setToken(token);
    setCurrentUser(user);
    localStorage.setItem('ai_office_user', JSON.stringify(user));
    setIsLoginOpen(false);
    setSessionNotice('');
    setView('home');

    // Set initial filters for user
    if (user.scoped) {
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

  const handleLogout = useCallback(() => {
    sessionEpochRef.current++;
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('ai_office_user');
    setIsLoginOpen(true);
    setIsUsersOpen(false);
    setView('home');
    setIsTeamOpen(false);
    setIsPasswordOpen(false);
    setIsAuditOpen(false);
    setIsBriefingOpen(false);
    setBoard(null);
    setIsFeedbackOpen(false);
    setArticles([]);
    setUrgentAlerts([]);
    setReps([]);
    setActiveOutletsArticle(null);
    setIsSidebarOpen(false);
  }, []);

  // Sharing
  const [shareArticle, setShareArticle] = useState(null);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const [view, setView] = useState('home');   // Home dashboard first; News feed is the second tab
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [board, setBoard] = useState(null);   // null = closed, otherwise { title, url } to prefill a new task
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // Pop-up on this device when a NEW share arrives while the app is open (only if the person turned it on in My account).
  const prevUnread = useRef(null);
  useEffect(() => {
    if (!currentUser) { prevUnread.current = null; return; }
    if (prevUnread.current !== null && unreadCount > prevUnread.current) {
      const L = STRINGS[currentLang] || STRINGS.en;
      browserAlerts.notify(L['notif.newShare'], L['notif.unread'].replace('{n}', String(unreadCount)));
    }
    prevUnread.current = unreadCount;
  }, [unreadCount, currentUser, currentLang]);
  const [toast, setToast] = useState('');

  const refreshUnread = useCallback(() => {
    fetchUnreadCount().then(d => setUnreadCount(d.count || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentUser) { setUnreadCount(0); return undefined; }
    refreshUnread();
    const id = setInterval(refreshUnread, 60000);
    return () => clearInterval(id);
  }, [currentUser, refreshUnread]);

  // Token expired or rejected by the server: back to the login screen.
  useEffect(() => {
    const onExpired = () => {
      setSessionNotice('expired');
      handleLogout();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [handleLogout]);

  // On load, confirm the stored token is still valid and refresh the user's role/scope.
  useEffect(() => {
    if (!getToken()) return;
    fetchMe().then((user) => {
      if (!user) return; // a 401 already triggered logout
      setCurrentUser(user);
      localStorage.setItem('ai_office_user', JSON.stringify(user));
    }).catch(() => {});
  }, []);

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

  const handlePrimaryNav = (destination) => {
    if (destination === 'home') {
      setView('home');
      return;
    }
    if (destination === 'portfolio') {
      setView('portfolio');
      loadReps();
      return;
    }
    if (destination === 'live') {
      setView('news');
      setPeriod('today');
      setNewsScope('all');
      setCurrentPage(1);
      loadNews(false, { period: 'today', newsScope: 'all', page: 1, force: true });
      return;
    }
    if (destination === 'history') {
      setView('news');
      setPeriod('history');
      setNewsScope('all');
      setCurrentPage(1);
      loadNews(false, { period: 'history', newsScope: 'all', page: 1, force: true });
      return;
    }
    if (destination === 'social') {
      setView('news');
      setPeriod('today');
      setNewsScope('social');
    }
  };

  return (
    <LangProvider lang={currentLang}>
    {publicPortfolioMatch ? <PublicPortfolioPage username={decodeURIComponent(publicPortfolioMatch[1])} /> : window.location.pathname.replace(/\/+$/, '') === '/survey' ? <SurveyPage onToggleLang={toggleLang} /> :
    <>
      {/* Fullscreen Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onLoginSuccess={handleLoginSuccess}
        allPoliticians={allPoliticians}
        notice={sessionNotice}
        onToggleLang={toggleLang}
      />

      {/* Main Authenticated Application */}
      {!isLoginOpen && currentUser && (
        <>
          <div className="sticky-top-wrapper">
            <Header
              currentUser={currentUser}
              onLogout={handleLogout}
              t={t}
              unreadCount={unreadCount}
              onOpenInbox={() => setIsInboxOpen(true)}
              onOpenUsers={() => setIsUsersOpen(true)}
              onOpenTeam={() => setIsTeamOpen(true)}
              onOpenBoard={() => setBoard({})}
              onToggleLang={toggleLang}
              onOpenPassword={() => setIsPasswordOpen(true)}
              onOpenFeedback={() => setIsFeedbackOpen(true)}
            />

            {['home', 'news', 'portfolio'].includes(view) && <LeaderIdentityBar currentUser={currentUser} />}

            <NavTabs view={view === 'news' ? (newsScope === 'social' ? 'social' : period === 'history' ? 'history' : 'live') : (view === 'demo' ? 'home' : view)} onChange={handlePrimaryNav} />

          </div>

          {(view === 'home' || view === 'news') && urgentAlerts.length > 0 && (
            <div className="shadcn-scope mx-auto w-full max-w-[1800px] px-4 pt-3 md:px-8 lg:px-10">
              <UrgentAlertBanner alerts={urgentAlerts} activeConst={activeConstituencyForBanner} currentLang={currentLang}
                onArticleClick={(id) => {
                  setView('news'); setPeriod('today'); setNewsScope('all'); setCurrentPage(1);
                  loadNews(false, { period: 'today', newsScope: 'all', page: 1, force: true });
                  window.setTimeout(() => handleScrollToArticle(id), 350);
                }} />
            </div>
          )}

          {metaError && (
            <div className="load-error-bar" role="alert">
              Couldn't load the district and leader lists.
              <button type="button" onClick={() => setMetaTick(n => n + 1)}>Retry</button>
            </div>
          )}

          {view === 'home' && (
            <HomeDashboard
              currentUser={currentUser}
              refreshKey={`${unreadCount}-${homeTick}`}
              onShare={(art) => setShareArticle(art)}
              onTask={(t) => setBoard(t)}
              onOpenBoard={() => setBoard({})}
              onOpenInbox={() => setIsInboxOpen(true)}
              onOpenUsers={() => setIsUsersOpen(true)}
              onOpenTeam={() => setIsTeamOpen(true)}
              onOpenCompose={() => setView('compose')}
              onOpenProjects={() => setView('projects')}
              onOpenNews={() => setView('news')}
              onOpenAudit={() => setIsAuditOpen(true)}
              onOpenBriefing={() => setIsBriefingOpen(true)}
              onOpenDemo={() => setView('demo')}
            />
          )}

          {view === 'demo' && <LeaderDemo currentUser={currentUser} role={currentUser?.role === 'staff' ? 'staff' : 'leader'} onBack={() => setView('home')} />}
          {view === 'compose' && <ComposeScreen user={currentUser} onBack={() => setView('home')} />}
          {view === 'projects' && <ProjectTracker user={currentUser} onBack={() => setView('home')} />}

          {view === 'portfolio' && (
            <OfficialPortfolioPage currentUser={currentUser} reps={reps} isLoadingReps={isLoadingReps} repsError={repsError} onRetryReps={loadReps} currentLang={currentLang} t={t} />
          )}

          {view === 'news' && (
          <div id="app-container">
            <SidebarFilters
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              currentUser={currentUser}
              districts={districts}
              allPoliticians={allPoliticians}
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
                if (currentUser.scoped) {
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

            <main className="shadcn-scope mx-auto w-full max-w-[1800px] px-4 py-6 md:px-8 md:py-8 lg:px-10">
              <h1 className="sr-only">{currentLang === 'te' ? 'వార్తల ఫీడ్' : 'News feed'}</h1>
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
                onShare={currentUser?.can_share === false ? undefined : (art) => setShareArticle(art)}
                t={t}
                selectedConstituency={selectedConstituency}
                selectedPolitician={selectedPolitician}
                allPoliticians={allPoliticians}
                searchKeyword={searchKeyword}
                setSearchKeyword={setSearchKeyword}
                onSearch={() => { setCurrentPage(1); loadNews(false, { page: 1 }); }}
                onOpenFilters={() => setIsSidebarOpen(true)}
                onRefreshed={() => { feedCacheRef.current.clear(); loadNews(false, { page: 1, force: true }); setHomeTick((n) => n + 1); }}
                activeFilterCount={(currentUser?.scoped ? 0 : [selectedDistrict, selectedPolitician, selectedConstituency].filter((v) => v && v !== 'All').length) + (selectedPriority !== '0' ? 1 : 0)}
              />
            </main>
          </div>
          )}

          <OutletsModal
            isOpen={Boolean(activeOutletsArticle)}
            onClose={() => setActiveOutletsArticle(null)}
            article={activeOutletsArticle}
            currentLang={currentLang}
          />

          {shareArticle && (
            <ShareModal
              article={shareArticle}
              currentUser={currentUser}
              onClose={() => setShareArticle(null)}
              onShared={(n) => {
                setShareArticle(null);
                setToast(currentLang === 'te' ? `${n} మందికి షేర్ చేశాం.` : `Shared with ${n} recipient${n === 1 ? '' : 's'}.`);
                setTimeout(() => setToast(''), 3500);
              }}
            />
          )}
          {isInboxOpen && <ShareInbox currentUser={currentUser} onClose={() => setIsInboxOpen(false)} onChanged={refreshUnread} />}
          {isUsersOpen && <AdminUsersModal onClose={() => setIsUsersOpen(false)} />}
          {isTeamOpen && <TeamModal onClose={() => setIsTeamOpen(false)} />}
          {(isPasswordOpen || !!currentUser?.must_change_password) && (
            <AccountDialog
              force={!!currentUser?.must_change_password}
              onClose={() => { if (!currentUser?.must_change_password) setIsPasswordOpen(false); }}
              onPasswordChanged={async (tok) => {
                setToken(tok);
                try {
                  const u = await fetchMe();
                  if (u) { setCurrentUser(u); localStorage.setItem('ai_office_user', JSON.stringify(u)); }
                } catch { /* keep going */ }
                setIsPasswordOpen(false);
              }}
            />
          )}
          {isBriefingOpen && <BriefingDialog role={currentUser?.role} onClose={() => setIsBriefingOpen(false)} />}
          {board && <TeamBoard prefill={board} onClose={() => setBoard(null)} />}
          {isFeedbackOpen && <FeedbackDialog onClose={() => setIsFeedbackOpen(false)} />}
          {isAuditOpen && <AuditDialog onClose={() => setIsAuditOpen(false)} />}
          {toast && <div className="shadcn-scope fixed bottom-4 left-1/2 z-[3500] -translate-x-1/2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 shadow-lg" role="status">{toast}</div>}
        </>
      )}
    </>
    }
    </LangProvider>
  );
}
