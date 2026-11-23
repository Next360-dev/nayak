import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, Info, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { classifyArticleSentiment, isStatewideArticle } from '../utils/constants';
import { fetchSocialMediaPosts } from '../utils/api';
import NewsCard from './NewsCard';
import SocialMediaView, { SocialPostCard } from './SocialMediaView';
import RefreshNews from './RefreshNews';

// These three scopes show social media posts mixed in with news articles. Civic and Statewide stay
// articles-only: social posts have no civic/statewide classification in the data to filter them by.
const MIX_SOCIAL_SCOPES = ['all', 'positive', 'negative'];

export default function NewsFeed({
  articles, isLoading, error, currentUser, currentLang, period, onPeriodChange,
  historyDateRange, onHistoryDateRangeChange, historySpecificDate, onHistorySpecificDateChange,
  newsScope, onNewsScopeChange, scopeCounts, currentPage = 1, pagination = null, onPageChange = () => {},
  onOpenOutletsModal, onShare, t, selectedConstituency, selectedPolitician, allPoliticians,
  searchKeyword = '', setSearchKeyword = () => {}, onSearch = () => {}, onOpenFilters, activeFilterCount = 0, onRefreshed,
}) {
  const te = currentLang === 'te';

  const activeConstituency = (currentUser && currentUser.scoped && currentUser.constituency_name)
    ? currentUser.constituency_name
    : (selectedConstituency && selectedConstituency !== 'All' && selectedConstituency !== 'All Assembly Constituencies' && selectedConstituency !== 'Statewide' ? selectedConstituency : null);

  const activeMlaName = useMemo(() => {
    if (currentUser && currentUser.scoped && currentUser.politician_name) {
      return currentUser.politician_name;
    }
    if (selectedPolitician && selectedPolitician !== 'All' && !['All 119 MLAs & CM', 'All Leaders', 'State Administration', 'State Master Administrator', 'Master Admin', 'Constituency Representative'].includes(selectedPolitician)) {
      return selectedPolitician;
    }
    if (activeConstituency && allPoliticians && allPoliticians.length > 0) {
      const cleanActive = activeConstituency.replace(/\s*\((SC|ST)\)/i, '').trim().toLowerCase();
      const pol = allPoliticians.find(p => {
        const pConst = (p.constituency_name || '').replace(/\s*\((SC|ST)\)/i, '').trim().toLowerCase();
        return pConst === cleanActive;
      });
      if (pol) return pol.name;
    }
    return null;
  }, [currentUser, selectedPolitician, activeConstituency, allPoliticians]);

  const cName = activeConstituency
    ? activeConstituency
    : ((currentUser && currentUser.scoped)
      ? currentUser.constituency_name
      : 'Telangana State');

  // Social posts to mix into All/Positive/Negative, so those tabs aren't news-only. Civic and
  // Statewide are left alone (see MIX_SOCIAL_SCOPES). Needs a specific constituency to scope to,
  // same requirement the dedicated Social media tab already has.
  //
  // Fetched ONCE per constituency (unfiltered, not re-fetched on every tab click, and not gated to
  // only when a mixing tab is active) so all three badge numbers — All, Positive, Negative — are
  // simultaneously correct and stable no matter which tab is open. Fetching per-active-tab instead
  // made the numbers visibly jump on every click (e.g. Positive showing 6 while All was open, then
  // jumping to 50 only once you clicked into Positive) — that was the "glitch".
  const [mixedSocialPosts, setMixedSocialPosts] = useState([]);
  const [mixedSocialStats, setMixedSocialStats] = useState(null);
  const socialDataReady = !!activeConstituency && newsScope !== 'social';
  const shouldMixSocial = MIX_SOCIAL_SCOPES.includes(newsScope) && socialDataReady;

  useEffect(() => {
    if (!socialDataReady) {
      setMixedSocialPosts([]);
      setMixedSocialStats(null);
      return;
    }
    let cancelled = false;
    let timer = null;
    // The server refreshes old social data in the background by itself (`refreshing: true`).
    // Look again every few seconds until it says it is done, so new posts appear without a reload.
    const load = () => {
      fetchSocialMediaPosts({
        constituency: activeConstituency,
        mlaName: activeMlaName || 'All',
        period,
      }).then((res) => {
        if (cancelled || !res || res.status !== 'success') return;
        setMixedSocialPosts(res.posts || []);
        setMixedSocialStats(res.stats || null);
        if (res.refreshing) timer = setTimeout(load, 4000);
      }).catch(() => { if (!cancelled) { setMixedSocialPosts([]); setMixedSocialStats(null); } });
    };
    load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [socialDataReady, activeConstituency, activeMlaName, period]);

  // Classify articles with sentiment & statewide scope
  const categorizedArticles = useMemo(() => {
    return (articles || []).map(art => ({
      ...art,
      sentiment: art.sentiment || classifyArticleSentiment(art),
      is_statewide: art.is_statewide !== undefined ? art.is_statewide : isStatewideArticle(art)
    }));
  }, [articles]);

  // Direct constituency news first, then chronological
  const sortedArticles = useMemo(() => {
    return [...categorizedArticles].sort((a, b) => {
      const aDirect = !a.is_district_update ? 1 : 0;
      const bDirect = !b.is_district_update ? 1 : 0;
      if (aDirect !== bDirect) return bDirect - aDirect;

      const timeA = a.date_time ? new Date(a.date_time).getTime() : 0;
      const timeB = b.date_time ? new Date(b.date_time).getTime() : 0;
      return timeB - timeA;
    });
  }, [categorizedArticles]);

  // Compute live counts for all 6 buttons directly from DB scopeCounts (with fallback to local articles)
  const computedCounts = useMemo(() => {
    let positive = 0;
    let negative = 0;
    let statewide = 0;
    let civic = 0;

    for (const art of sortedArticles) {
      if (art.sentiment === 'positive') positive++;
      if (art.sentiment === 'negative') negative++;
      if (art.is_statewide || art.district_name === 'Statewide') statewide++;
      if (art.news_type === 'civic' || art.is_civic) civic++;
    }

    return {
      all: scopeCounts?.all !== undefined ? scopeCounts.all : sortedArticles.length,
      positive: scopeCounts?.positive !== undefined ? scopeCounts.positive : positive,
      negative: scopeCounts?.negative !== undefined ? scopeCounts.negative : negative,
      statewide: scopeCounts?.statewide !== undefined ? scopeCounts.statewide : (statewide || 0),
      civic: scopeCounts?.civic !== undefined ? scopeCounts.civic : civic,
      social: scopeCounts?.social !== undefined ? scopeCounts.social : 0
    };
  }, [sortedArticles, scopeCounts]);

  // Filter displayed articles according to active scope
  const displayedArticles = useMemo(() => {
    if (newsScope === 'social') {
      return []; // Managed by SocialMediaView
    }
    if (newsScope === 'positive') {
      const pos = sortedArticles.filter(a => a.sentiment === 'positive');
      return pos.length > 0 ? pos : sortedArticles;
    }
    if (newsScope === 'negative') {
      const neg = sortedArticles.filter(a => a.sentiment === 'negative');
      return neg.length > 0 ? neg : sortedArticles;
    }
    if (newsScope === 'statewide') {
      const sw = sortedArticles.filter(a => a.is_statewide || a.district_name === 'Statewide' || a.constituency_name === 'Statewide');
      return sw.length > 0 ? sw : sortedArticles;
    }
    if (newsScope === 'civic') {
      return sortedArticles.filter(a => a.news_type === 'civic' || a.is_civic);
    }
    return sortedArticles;
  }, [sortedArticles, newsScope]);

  // Merged list for All/Positive/Negative: matching articles plus matching social posts, sorted
  // together by time. Uses a strict sentiment filter (unlike displayedArticles' fallback-to-all
  // above) because social posts already fill the tab in when there are few or no matching articles.
  const mixedItems = useMemo(() => {
    if (!shouldMixSocial) return null;
    const strictArticles = newsScope === 'positive'
      ? sortedArticles.filter(a => a.sentiment === 'positive')
      : newsScope === 'negative'
        ? sortedArticles.filter(a => a.sentiment === 'negative')
        : sortedArticles;
    // mixedSocialPosts is fetched unfiltered (see above), so filter by sentiment here to match the tab.
    const matchingSocial = newsScope === 'positive'
      ? mixedSocialPosts.filter(p => p.sentiment === 'positive')
      : newsScope === 'negative'
        ? mixedSocialPosts.filter(p => p.sentiment === 'negative')
        : mixedSocialPosts;
    const articleItems = strictArticles.map(a => ({
      kind: 'article', key: `a-${a.id}`, ts: a.date_time ? new Date(a.date_time).getTime() : 0, data: a,
    }));
    const socialItems = matchingSocial.map(p => ({
      kind: 'social', key: `s-${p.id}`, ts: p.published_at ? new Date(p.published_at).getTime() : 0, data: p,
    }));
    return [...articleItems, ...socialItems].sort((x, y) => y.ts - x.ts);
  }, [shouldMixSocial, newsScope, sortedArticles, mixedSocialPosts]);

  // Total count for current active scope
  const activeScopeTotal = useMemo(() => {
    const base = newsScope === 'statewide' ? scopeCounts?.statewide ?? (pagination?.total_records || displayedArticles.length)
      : newsScope === 'all' ? scopeCounts?.all ?? (pagination?.total_records || displayedArticles.length)
      : newsScope === 'positive' ? scopeCounts?.positive ?? displayedArticles.length
      : newsScope === 'negative' ? scopeCounts?.negative ?? displayedArticles.length
      : newsScope === 'civic' ? scopeCounts?.civic ?? displayedArticles.length
      : newsScope === 'social' ? scopeCounts?.social ?? 0
      : pagination?.total_records || displayedArticles.length;
    if (shouldMixSocial && mixedSocialStats) {
      const extra = newsScope === 'positive' ? (mixedSocialStats.positive_posts || 0)
        : newsScope === 'negative' ? (mixedSocialStats.negative_posts || 0)
        : (mixedSocialStats.total_posts || 0);
      return base + extra;
    }
    return base;
  }, [newsScope, scopeCounts, pagination, displayedArticles.length, shouldMixSocial, mixedSocialStats]);

  // Smart page number window for pagination
  const pageNumbers = useMemo(() => {
    if (!pagination || pagination.total_pages <= 1) return [];
    const total = pagination.total_pages;
    const current = currentPage || 1;
    const delta = 2;

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages = [];
    const left = Math.max(2, current - delta);
    const right = Math.min(total - 1, current + delta);

    pages.push(1);
    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) {
      pages.push(i);
    }
    if (right < total - 1) pages.push('...');
    pages.push(total);

    return pages;
  }, [pagination, currentPage]);


  const totalCount = displayedArticles.length;
  const allAreDistrictUpdates = sortedArticles.length > 0 && sortedArticles.every((a) => a.is_district_update);
  const fallbackDist = allAreDistrictUpdates ? (sortedArticles[0].district_name || 'District') : '';
  const countLabel = isLoading && totalCount === 0 ? '…' : activeScopeTotal.toLocaleString();

  // All, Positive and Negative badges all grow by their matching social counts at once, regardless
  // of which tab is currently open — mixedSocialStats comes from one fetch per constituency (see
  // above), not a per-tab one, so these three numbers stay fixed as you click between tabs.
  const displayCounts = (socialDataReady && mixedSocialStats)
    ? {
      ...computedCounts,
      all: (computedCounts.all || 0) + (mixedSocialStats.total_posts || 0),
      positive: (computedCounts.positive || 0) + (mixedSocialStats.positive_posts || 0),
      negative: (computedCounts.negative || 0) + (mixedSocialStats.negative_posts || 0),
    }
    : computedCounts;

  const SCOPES = [
    { id: 'all', label: te ? 'అన్నీ' : 'All', count: displayCounts.all },
    { id: 'positive', label: te ? 'సానుకూలం' : 'Positive', count: displayCounts.positive },
    { id: 'negative', label: te ? 'ప్రతికూలం' : 'Negative', count: displayCounts.negative },
    { id: 'statewide', label: te ? 'రాష్ట్రవ్యాప్తం' : 'Statewide', count: displayCounts.statewide },
    { id: 'civic', label: te ? 'ప్రజా సమస్యలు' : 'Civic', count: displayCounts.civic },
    { id: 'social', label: te ? 'సోషల్ మీడియా' : 'Social media', count: displayCounts.social },
  ];
  const PRESETS = [
    { range: 'all', label: te ? 'అన్ని పాత వార్తలు' : 'All older' },
    { range: '48h', label: te ? '24–48 గంటలు' : '24–48 hours' },
    { range: '3d', label: te ? '3 రోజులు' : '3 days' },
    { range: '7d', label: te ? '7 రోజులు' : '7 days' },
    { range: '14d', label: te ? '14 రోజులు' : '14 days' },
  ];
  const pill = (active) => cn('inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground');

  const pageText = pagination && pagination.total_pages > 1
    ? (te ? `పేజీ ${currentPage} / ${pagination.total_pages}` : `Page ${currentPage} of ${pagination.total_pages}`) : null;
  const windowText = period === 'today' ? (te ? 'గత 24 గంటలు' : 'Last 24 hours') : (te ? '24 గంటల కంటే పాతవి' : 'Older than 24 hours');
  const subtitle = [cName, windowText, pageText].filter(Boolean).join(' · ');

  const emptyCopy = (() => {
    if (period === 'history') {
      return historySpecificDate
        ? { title: te ? `${historySpecificDate} తేదీకి వార్తలు లేవు` : `No stories on ${historySpecificDate}`, body: te ? 'మరొక తేదీని లేదా కాల వ్యవధిని ఎంచుకోండి.' : 'Pick another date or a longer range.' }
        : { title: t.noNewsTitle, body: t.noNewsSubtitle };
    }
    if (newsScope === 'positive') return { title: te ? 'ఈరోజు సానుకూల వార్తలు లేవు' : 'No positive stories today', body: te ? 'ఆర్కైవ్‌లో గత వార్తలు చూడండి.' : 'The archive has earlier stories.' };
    if (newsScope === 'negative') return { title: te ? 'ఈరోజు ప్రతికూల వార్తలు లేవు' : 'No negative stories today', body: te ? 'ఆర్కైవ్‌లో గత వార్తలు చూడండి.' : 'The archive has earlier stories.' };
    return { title: t.noTodayNewsTitle || 'No stories in the last 24 hours', body: te ? 'వార్తలు కొన్ని గంటలకోసారి వస్తాయి. ఆర్కైవ్‌లో పాత వార్తలు చూడండి.' : 'New stories arrive every few hours. The archive has older ones.' };
  })();

  const rangeText = pagination
    ? `${(pagination.offset || 0) + 1}–${Math.min((pagination.offset || 0) + displayedArticles.length, activeScopeTotal)}`
    : '';

  return (
    <section className="space-y-4">
      {/* Title row */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight" id="feed-title">
            {newsScope === 'social' ? (te ? 'సోషల్ మీడియా' : 'Social media') : period === 'today' ? (te ? 'తాజా వార్తలు' : 'Latest news') : (te ? 'వార్తల ఆర్కైవ్' : 'News archive')}
            {newsScope !== 'social' && <span className="ml-3 align-middle text-base font-medium text-muted-foreground" id="news-count-badge">{countLabel} {t.storiesSuffix || 'stories'}</span>}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground" id="feed-subtitle">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <RefreshNews onDone={onRefreshed} showLatest={false} />
        <div className="inline-flex rounded-md bg-secondary p-0.5" id="top-nav-switcher" role="group" aria-label={te ? 'కాలం' : 'Period'}>
          {[['today', t.viewToday || 'Today', 'view-btn-today'], ['history', t.viewHistory || 'Archive', 'view-btn-history']].map(([id, label, bid]) => (
            <button key={id} type="button" id={bid} data-view={id} aria-pressed={period === id} onClick={() => onPeriodChange(id)}
                    className={cn('h-8 rounded px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                      period === id ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* Search + filters */}
      {newsScope !== 'social' && (
      <form className="flex gap-2" role="search" onSubmit={(e) => { e.preventDefault(); onSearch(); }}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="filter-search" type="search" className="h-10 bg-card pl-9" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}
                 placeholder={te ? 'నీరు, రోడ్డు, ఆసుపత్రి…' : 'Water, road, hospital…'} aria-label={te ? 'వార్తలు శోధించండి' : 'Search stories'} />
        </div>
        <Button type="submit" className="h-10">{te ? 'వెతకండి' : 'Search'}</Button>
        {onOpenFilters && (
          <Button type="button" variant="outline" className="h-10 bg-card" onClick={onOpenFilters} id="btn-banner-filter-menu" aria-label={te ? 'ఫిల్టర్లు' : 'Filters'}>
            <Filter /> <span className="max-sm:hidden">{te ? 'ఫిల్టర్లు' : 'Filters'}</span>
            {activeFilterCount > 0 && <span className="ml-0.5 rounded bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{activeFilterCount}</span>}
          </Button>
        )}
      </form>
      )}

      {/* Scope tabs */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" id="news-scope-toggle-bar" role="group" aria-label={te ? 'వార్తల రకం' : 'News type'}>
        {SCOPES.map((sc) => (
          <button key={sc.id} type="button" id={`scope-btn-${sc.id}`} data-scope={sc.id} aria-pressed={newsScope === sc.id}
                  className={pill(newsScope === sc.id)} onClick={() => onNewsScopeChange(sc.id)}
                  title={(sc.id === 'positive' || sc.id === 'negative') && activeConstituency && activeMlaName ? activeMlaName : undefined}>
            <span id={`scope-label-${sc.id}`}>{sc.label}</span>
            {sc.id !== 'social' && <span id={`scope-badge-${sc.id}`} className={cn('text-xs tabular-nums', newsScope === sc.id ? 'text-primary-foreground/75' : 'text-muted-foreground')}>{sc.count}</span>}
          </button>
        ))}
      </div>

      {/* Archive tools */}
      {period === 'history' && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-card px-4 py-3" id="history-toolbar">
          <div className="flex items-center gap-2">
            <label htmlFor="history-specific-date" className="text-sm font-medium">{te ? 'తేదీ' : 'Date'}</label>
            <Input type="date" id="history-specific-date" className="h-9 w-auto" value={historySpecificDate} max={new Date().toISOString().split('T')[0]}
                   onChange={(e) => onHistorySpecificDateChange(e.target.value)} />
            {historySpecificDate && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onHistoryDateRangeChange('all')}><X /> {te ? 'తొలగించు' : 'Clear'}</Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1" id="history-presets-group" role="group" aria-label={te ? 'త్వరిత ఎంపికలు' : 'Quick ranges'}>
            {PRESETS.map((pr) => (
              <button key={pr.range} type="button" data-range={pr.range} aria-pressed={!historySpecificDate && historyDateRange === pr.range}
                      className={pill(!historySpecificDate && historyDateRange === pr.range)} onClick={() => onHistoryDateRangeChange(pr.range)}>{pr.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Stories */}
      {newsScope === 'social' ? (
        <SocialMediaView activeConstituency={activeConstituency} activeMlaName={activeMlaName} period={period} currentLang={currentLang} currentUser={currentUser} t={t} />
      ) : (
        <div id="news-cards-container" className="space-y-4">
          {!isLoading && !error && allAreDistrictUpdates && (
            <p className="flex items-start gap-2 rounded-lg border bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{te ? `ఈ నియోజకవర్గానికి ప్రత్యేక వార్తలు లేవు, అందుకే ${fallbackDist} జిల్లా వార్తలు చూపిస్తున్నాం.` : `No stories for this constituency itself, so these are from ${fallbackDist} district.`}</span>
            </p>
          )}

          {isLoading && (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3" aria-busy="true">
              <p className="sr-only" role="status">{te ? 'వార్తలు లోడ్ అవుతున్నాయి' : 'Loading stories'}</p>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"><Skeleton className="h-3 w-48" /><Skeleton className="h-5 w-4/5" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
          )}

          {!isLoading && !error && (shouldMixSocial ? mixedItems.length === 0 : displayedArticles.length === 0) && (
            <div className="rounded-lg border bg-card px-6 py-14 text-center">
              <p className="text-base font-semibold">{emptyCopy.title}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{emptyCopy.body}</p>
              {period === 'today' && (
                <Button type="button" variant="outline" className="mt-5" id="btn-empty-go-history" onClick={() => onPeriodChange('history')}>{t.browseHistoryBtn || 'Browse the archive'}</Button>
              )}
            </div>
          )}

          {!isLoading && !error && shouldMixSocial && mixedItems.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {mixedItems.map((item) => item.kind === 'social'
                ? <SocialPostCard key={item.key} post={item.data} te={te} />
                : <NewsCard key={item.key} art={item.data} currentLang={currentLang} t={t} onOpenOutletsModal={onOpenOutletsModal} onShare={onShare} />)}
            </div>
          )}

          {!isLoading && !error && !shouldMixSocial && displayedArticles.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {displayedArticles.map((art) => (
                <NewsCard key={art.id} art={art} currentLang={currentLang} t={t} onOpenOutletsModal={onOpenOutletsModal} onShare={onShare} />
              ))}
            </div>
          )}

          {!isLoading && !error && displayedArticles.length > 0 && pagination && pagination.total_pages > 1 && (
            <nav className="flex flex-wrap items-center justify-between gap-3" id="feed-pagination-bar" aria-label={te ? 'పేజీలు' : 'Pages'}>
              <p className="text-sm text-muted-foreground">
                {te ? `${rangeText} / ${activeScopeTotal.toLocaleString()}` : `Showing ${rangeText} of ${activeScopeTotal.toLocaleString()}`}
              </p>
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="sm" id="pagination-prev-btn" disabled={currentPage <= 1 || isLoading} onClick={() => onPageChange(currentPage - 1)}>
                  <ChevronLeft /> {te ? 'మునుపటి' : 'Previous'}
                </Button>
                {pageNumbers.map((p, idx) => (p === '...'
                  ? <span key={`e-${idx}`} className="px-1 text-muted-foreground" aria-hidden="true">…</span>
                  : <button key={`p-${p}`} type="button" id={`pagination-page-${p}`} disabled={p === currentPage || isLoading} aria-current={p === currentPage ? 'page' : undefined}
                            className={cn('inline-flex size-8 items-center justify-center rounded-md text-sm font-medium tabular-nums focus-visible:outline-2 focus-visible:outline-ring',
                              p === currentPage ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}
                            onClick={() => onPageChange(p)}>{p}</button>))}
                <Button type="button" variant="outline" size="sm" id="pagination-next-btn" disabled={currentPage >= pagination.total_pages || isLoading} onClick={() => onPageChange(currentPage + 1)}>
                  {te ? 'తదుపరి' : 'Next'} <ChevronRight />
                </Button>
              </div>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}
