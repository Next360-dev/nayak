import React, { useState, useMemo } from 'react';
import NewsCard from './NewsCard';
import SocialMediaView from './SocialMediaView';

export default function NewsFeed({
  articles,
  isLoading,
  error,
  currentUser,
  currentLang,
  period,
  onPeriodChange,
  historyDateRange,
  onHistoryDateRangeChange,
  historySpecificDate,
  onHistorySpecificDateChange,
  newsScope,
  onNewsScopeChange,
  scopeCounts,
  currentPage = 1,
  pagination = null,
  onPageChange = () => {},
  onOpenOutletsModal,
  t,
  selectedConstituency,
  selectedPolitician,
  allPoliticians
}) {

  const activeConstituency = (currentUser && currentUser.role === 'mla' && currentUser.constituency_name)
    ? currentUser.constituency_name
    : (selectedConstituency && selectedConstituency !== 'All' && selectedConstituency !== 'All Assembly Constituencies' && selectedConstituency !== 'Statewide' ? selectedConstituency : null);

  const activeMlaName = useMemo(() => {
    if (currentUser && currentUser.role === 'mla' && currentUser.politician_name) {
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
    : ((currentUser && currentUser.role === 'mla')
      ? currentUser.constituency_name
      : 'Telangana State');

  const feedTitle = period === 'today'
    ? (currentLang === 'te' ? '📰 నేటి ప్రత్యక్ష వార్తల ఫీడ్' : "📰 Today's Live News Feed")
    : (currentLang === 'te' ? '📜 చారిత్రక వార్తల ఆర్కైవ్ ఫీడ్' : "📜 News History & Archives");

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

  // Total count for current active scope
  const activeScopeTotal = useMemo(() => {
    if (newsScope === 'statewide') return scopeCounts?.statewide ?? (pagination?.total_records || displayedArticles.length);
    if (newsScope === 'all') return scopeCounts?.all ?? (pagination?.total_records || displayedArticles.length);
    if (newsScope === 'positive') return scopeCounts?.positive ?? displayedArticles.length;
    if (newsScope === 'negative') return scopeCounts?.negative ?? displayedArticles.length;
    if (newsScope === 'civic') return scopeCounts?.civic ?? displayedArticles.length;
    if (newsScope === 'social') return scopeCounts?.social ?? 0;
    return pagination?.total_records || displayedArticles.length;
  }, [newsScope, scopeCounts, pagination, displayedArticles.length]);

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

  const allAreDistrictUpdates = sortedArticles.length > 0 && sortedArticles.every(a => a.is_district_update);
  const fallbackDist = allAreDistrictUpdates ? (sortedArticles[0].district_name || 'District') : '';

  let activeArchiveLabel = currentLang === 'te' ? 'అన్ని గత వార్తలు' : 'All Past News';
  if (historySpecificDate) {
    activeArchiveLabel = `${currentLang === 'te' ? 'తేదీ' : 'Date'}: ${historySpecificDate}`;
  } else if (historyDateRange === '24h') {
    activeArchiveLabel = currentLang === 'te' ? 'గత 24 గంటలు' : 'Past 24 Hours';
  } else if (historyDateRange === '3d') {
    activeArchiveLabel = currentLang === 'te' ? 'గత 3 రోజులు' : 'Past 3 Days';
  } else if (historyDateRange === '7d') {
    activeArchiveLabel = currentLang === 'te' ? 'గత 7 రోజులు' : 'Past 7 Days (1 Week)';
  } else if (historyDateRange === '14d') {
    activeArchiveLabel = currentLang === 'te' ? 'గత 14 రోజులు' : 'Past 14 Days (2 Weeks)';
  }

  const countStr = activeScopeTotal > 0 ? ` (${activeScopeTotal.toLocaleString()} ${t.storiesSuffix || 'articles'})` : '';

  const pageInfoStr = pagination && pagination.total_pages > 1
    ? (currentLang === 'te'
        ? ` • పేజీ ${currentPage} / ${pagination.total_pages}`
        : ` • Page ${currentPage} of ${pagination.total_pages}`)
    : '';

  const feedSubtitle = period === 'today'
    ? (currentLang === 'te'
        ? `నేటి తాజా వార్తలు (${cName})${pageInfoStr}.`
        : `Showing today's latest daily news for ${cName}${pageInfoStr}.`)
    : (currentLang === 'te'
        ? `చారిత్రక వార్తల ఆర్కైవ్: ${activeArchiveLabel}${countStr} (${cName})${pageInfoStr}.`
        : `Historical news archive: ${activeArchiveLabel}${countStr} for ${cName}${pageInfoStr}.`);

  return (
    <div className="card">
      {/* Card Header with Today/History Navigation */}
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div className="card-title" id="feed-title" style={{ marginBottom: 0 }}>
            {feedTitle}
          </div>
          <span className="badge badge-district" id="news-count-badge">
            {isLoading && totalCount === 0
              ? '...'
              : `${activeScopeTotal.toLocaleString()} ${t.storiesSuffix || 'News Stories'}`
            }
          </span>
          {pagination && pagination.total_pages > 1 && (
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#4F46E5', background: '#EEF2FF', padding: '0.2rem 0.6rem', borderRadius: '12px', border: '1px solid #C7D2FE' }}>
              {currentLang === 'te' ? `పేజీ ${currentPage} / ${pagination.total_pages}` : `Page ${currentPage} of ${pagination.total_pages}`}
            </span>
          )}
        </div>

        <div className="feed-header-controls" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="top-nav-switcher" id="top-nav-switcher">
            <button
              type="button"
              className={`top-nav-btn ${period === 'today' ? 'active' : ''}`}
              id="view-btn-today"
              data-view="today"
              title="View Today's Live News"
              onClick={() => onPeriodChange('today')}
            >
              <span className="top-nav-dot"></span>
              <span id="view-label-today">{t.viewToday || "Today's Live"}</span>
            </button>
            <button
              type="button"
              className={`top-nav-btn ${period === 'history' ? 'active' : ''}`}
              id="view-btn-history"
              data-view="history"
              title="View Past Historical Archives"
              onClick={() => onPeriodChange('history')}
            >
              <span className="top-nav-icon">📜</span>
              <span id="view-label-history">{t.viewHistory || "History Archive"}</span>
            </button>
          </div>
        </div>
      </div>

      <p style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '0.85rem' }} id="feed-subtitle">
        {feedSubtitle}
      </p>

      {/* History Toolbar (Active only in History Mode) */}
      {period === 'history' && (
        <div className="history-toolbar" id="history-toolbar">
          <div className="history-toolbar-inner">
            <div className="history-filter-item">
              <label htmlFor="history-specific-date" className="history-filter-label">
                📅 {currentLang === 'te' ? 'నిర్దిష్ట తేదీ:' : 'Filter Past Date:'}
              </label>
              <input
                type="date"
                id="history-specific-date"
                className="history-date-input"
                value={historySpecificDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => onHistorySpecificDateChange(e.target.value)}
              />
              {historySpecificDate && (
                <button
                  type="button"
                  onClick={() => onHistoryDateRangeChange('all')}
                  style={{
                    background: '#E2E8F0',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    color: '#334155',
                    fontWeight: 600
                  }}
                  title="Clear specific date"
                >
                  ✕ Clear
                </button>
              )}
            </div>
            <div className="history-filter-item">
              <label className="history-filter-label">
                ⏱️ {currentLang === 'te' ? 'ఆర్కైవ్ ఎంపికలు:' : 'Quick Archive Presets:'}
              </label>
              <div className="history-presets-group" id="history-presets-group">
                {[
                  { range: 'all', label: currentLang === 'te' ? 'అన్ని గత వార్తలు' : 'All Past News' },
                  { range: '24h', label: currentLang === 'te' ? 'గత 24 గంటలు' : 'Past 24h' },
                  { range: '3d', label: currentLang === 'te' ? 'గత 3 రోజులు' : 'Past 3 Days' },
                  { range: '7d', label: currentLang === 'te' ? 'గత 7 రోజులు' : 'Past 7 Days' },
                  { range: '14d', label: currentLang === 'te' ? 'గత 14 రోజులు' : 'Past 14 Days' }
                ].map(preset => (
                  <button
                    key={preset.range}
                    type="button"
                    data-range={preset.range}
                    className={`history-preset-btn ${!historySpecificDate && historyDateRange === preset.range ? 'active' : ''}`}
                    onClick={() => onHistoryDateRangeChange(preset.range)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Quick Date Shortcuts for dates with actual news articles in DB */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem', color: '#64748B', marginTop: '0.45rem', paddingTop: '0.4rem', borderTop: '1px dashed #E2E8F0', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{currentLang === 'te' ? 'ఆర్కైవ్‌లో ఉన్న ఇటీవలి తేదీలు:' : 'Recent dates with news:'}</span>
            {[
              { date: '2026-09-23', label: 'Sep 23' },
              { date: '2026-09-20', label: 'Sep 20' },
              { date: '2026-09-19', label: 'Sep 19' },
              { date: '2026-09-18', label: 'Sep 18' },
              { date: '2026-09-17', label: 'Sep 17' },
              { date: '2026-09-16', label: 'Sep 16' },
            ].map(d => (
              <button
                key={d.date}
                type="button"
                onClick={() => onHistorySpecificDateChange(d.date)}
                style={{
                  background: historySpecificDate === d.date ? '#1E293B' : '#FFFFFF',
                  color: historySpecificDate === d.date ? '#FFFFFF' : '#334155',
                  border: '1px solid #CBD5E1',
                  borderRadius: '5px',
                  padding: '0.15rem 0.5rem',
                  cursor: 'pointer',
                  fontWeight: historySpecificDate === d.date ? 700 : 500,
                  fontSize: '0.73rem',
                  boxShadow: historySpecificDate === d.date ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dual-Mode News Scope Segmented Toggle Bar */}
      <div className="news-scope-toggle-bar" id="news-scope-toggle-bar">
        {/* 1. All News */}
        <button
          type="button"
          className={`scope-tab-btn ${newsScope === 'all' ? 'active' : ''}`}
          id="scope-btn-all"
          data-scope="all"
          onClick={() => onNewsScopeChange('all')}
        >
          <span className="scope-icon-wrapper">
            <svg className="scope-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </span>
          <span className="scope-label" id="scope-label-all">{t.scopeAll}</span>
          <span className="scope-badge" id="scope-badge-all">{computedCounts.all}</span>
        </button>

        {/* 2. Positive Summary (BESIDE ALL NEWS) */}
        <button
          type="button"
          className={`scope-tab-btn ${newsScope === 'positive' ? 'active' : ''}`}
          id="scope-btn-positive"
          data-scope="positive"
          onClick={() => onNewsScopeChange('positive')}
          title={activeConstituency && activeMlaName ? (currentLang === 'te' ? `ఎమ్మెల్యే ${activeMlaName} పాజిటివ్ వార్తలు` : `Positive News about MLA ${activeMlaName}`) : "View Positive News & Growth Summary"}
        >
          <span className="scope-icon-wrapper" style={{ color: newsScope === 'positive' ? '#A7F3D0' : '#059669' }}>
            <svg className="scope-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
            </svg>
          </span>
          <span className="scope-label" id="scope-label-positive">
            {activeConstituency && activeMlaName
              ? (currentLang === 'te' ? 'ఎమ్మెల్యే పాజిటివ్' : 'MLA Positive')
              : t.scopePositive}
          </span>
          <span className="scope-badge" id="scope-badge-positive" style={{ background: newsScope === 'positive' ? 'rgba(255,255,255,0.25)' : '#DCFCE7', color: newsScope === 'positive' ? '#FFF' : '#15803D' }}>
            {computedCounts.positive}
          </span>
        </button>

        {/* 3. Negative Summary (BESIDE ALL NEWS) */}
        <button
          type="button"
          className={`scope-tab-btn ${newsScope === 'negative' ? 'active' : ''}`}
          id="scope-btn-negative"
          data-scope="negative"
          onClick={() => onNewsScopeChange('negative')}
          title={activeConstituency && activeMlaName ? (currentLang === 'te' ? `ఎమ్మెల్యే ${activeMlaName} ప్రతికూల / విమర్శల వార్తలు` : `Critical / Negative News about MLA ${activeMlaName}`) : "View Negative News & Critical Grievances"}
        >
          <span className="scope-icon-wrapper" style={{ color: newsScope === 'negative' ? '#FECDD3' : '#E11D48' }}>
            <svg className="scope-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
            </svg>
          </span>
          <span className="scope-label" id="scope-label-negative">
            {activeConstituency && activeMlaName
              ? (currentLang === 'te' ? 'ఎమ్మెల్యే నెగటివ్' : 'MLA Negative')
              : t.scopeNegative}
          </span>
          <span className="scope-badge" id="scope-badge-negative" style={{ background: newsScope === 'negative' ? 'rgba(255,255,255,0.25)' : '#FFE4E6', color: newsScope === 'negative' ? '#FFF' : '#BE123C' }}>
            {computedCounts.negative}
          </span>
        </button>

        {/* 4. Statewide News (BESIDE ALL NEWS) */}
        <button
          type="button"
          className={`scope-tab-btn ${newsScope === 'statewide' ? 'active' : ''}`}
          id="scope-btn-statewide"
          data-scope="statewide"
          onClick={() => onNewsScopeChange('statewide')}
          title="View Statewide Governance News"
        >
          <span className="scope-icon-wrapper" style={{ color: newsScope === 'statewide' ? '#C7D2FE' : '#4F46E5' }}>
            <svg className="scope-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
          </span>
          <span className="scope-label" id="scope-label-statewide">{t.scopeStatewide}</span>
          <span className="scope-badge" id="scope-badge-statewide" style={{ background: newsScope === 'statewide' ? 'rgba(255,255,255,0.25)' : '#EEF2FF', color: newsScope === 'statewide' ? '#FFF' : '#3730A3' }}>
            {computedCounts.statewide}
          </span>
        </button>

        {/* 5. Constituency Civic News */}
        <button
          type="button"
          className={`scope-tab-btn ${newsScope === 'civic' ? 'active' : ''}`}
          id="scope-btn-civic"
          data-scope="civic"
          onClick={() => onNewsScopeChange('civic')}
        >
          <span className="scope-icon-wrapper">
            <svg className="scope-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18"></path>
              <path d="M5 21V10"></path>
              <path d="M9 21V10"></path>
              <path d="M15 21V10"></path>
              <path d="M19 21V10"></path>
              <path d="M2 10h20"></path>
              <path d="M12 3L2 10h20L12 3z"></path>
            </svg>
          </span>
          <span className="scope-label" id="scope-label-civic">{t.scopeCivic}</span>
          <span className="scope-badge" id="scope-badge-civic">{computedCounts.civic}</span>
        </button>

        {/* 6. Social Media News */}
        <button
          type="button"
          className={`scope-tab-btn ${newsScope === 'social' ? 'active' : ''}`}
          id="scope-btn-social"
          data-scope="social"
          onClick={() => onNewsScopeChange('social')}
        >
          <span className="scope-icon-wrapper">
            <svg className="scope-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
            </svg>
          </span>
          <span className="scope-label" id="scope-label-social">{t.scopeSocial || 'Social Media News'}</span>
          <span className="scope-badge" id="scope-badge-social">{computedCounts.social}</span>
        </button>
      </div>


      {/* Feed Area: Social Media View or Regular Articles Feed */}
      {newsScope === 'social' ? (
        <SocialMediaView
          activeConstituency={activeConstituency}
          activeMlaName={activeMlaName}
          period={period}
          currentLang={currentLang}
          currentUser={currentUser}
          t={t}
        />
      ) : (
        <div className="articles-feed" id="news-cards-container">
          {isLoading && (
            <div style={{ textAlign: 'center', color: '#64748B', padding: '2.5rem 1rem' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>⏳</div>
              <div style={{ fontWeight: 600, color: '#334155' }}>
                {currentLang === 'te' ? 'వార్తలను లోడ్ చేస్తోంది...' : 'Loading News Feed...'}
              </div>
            </div>
          )}

          {!isLoading && error && (
            <div style={{ color: '#E11D48', padding: '1.5rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {!isLoading && !error && allAreDistrictUpdates && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#1E40AF' }}>
              <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
              <div>
                <strong>{currentLang === 'te' ? 'జిల్లా సమాచారం' : 'District Fallback Updates'}:</strong>{' '}
                {currentLang === 'te'
                  ? `ఈ నియోజకవర్గానికి ఈరోజు నేరుగా ప్రత్యేక వార్తలు లేవు. కాబట్టి ${fallbackDist} జిల్లా వార్తలు చూపించబడుతున్నాయి.`
                  : `No direct local news was reported specifically for this constituency today. Showing parent district (${fallbackDist}) updates so your dashboard remains informative.`}
              </div>
            </div>
          )}

          {!isLoading && !error && displayedArticles.length === 0 && (
            period === 'today' ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748B' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                  {newsScope === 'positive' ? '✨' : (newsScope === 'negative' ? '⚠️' : '📅')}
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.15rem', color: '#0F172A' }}>
                  {newsScope === 'positive'
                    ? (currentLang === 'te'
                        ? (activeConstituency && activeMlaName ? `ఎమ్మెల్యే ${activeMlaName} పై నేడు సానుకూల కథనాలు నమోదు కాలేదు` : 'ఈ కేటగిరీలో సానుకూల వార్తలు ఏవీ లేవు')
                        : (activeConstituency && activeMlaName ? `No Positive Stories Recorded Today for MLA ${activeMlaName}` : 'No Positive Stories Recorded Today'))
                    : (newsScope === 'negative'
                        ? (currentLang === 'te'
                            ? (activeConstituency && activeMlaName ? `ఎమ్మెల్యే ${activeMlaName} పై నేడు ఎటువంటి విమర్శలు లేదా ప్రతికూల కథనాలు లేవు` : 'ఈ కేటగిరీలో ఎటువంటి సమస్యల వార్తలు లేవు')
                            : (activeConstituency && activeMlaName ? `No Critical Coverage / Negative News Reported Today for MLA ${activeMlaName}` : 'No Critical Grievances Reported Today'))
                        : (t.noTodayNewsTitle || "No Live News Articles Reported Yet For Today"))}
                </div>
                <div style={{ fontSize: '0.88rem', marginTop: '0.35rem', color: '#64748B' }}>
                  {newsScope === 'positive' && activeConstituency && activeMlaName
                    ? (currentLang === 'te' ? `ఎమ్మెల్యే ${activeMlaName} మరియు నియోజకవర్గ గత వార్తలను చూడటానికి ఆర్కైవ్‌ను సందర్శించండి.` : `Continuous news ingestion active for ${activeMlaName}. Click below to browse historical archives.`)
                    : (newsScope === 'negative' && activeConstituency && activeMlaName
                        ? (currentLang === 'te' ? `ఎమ్మెల్యే ${activeMlaName} పై ఎటువంటి విమర్శలు లేదా ఆరోపణలు నివేదించబడలేదు.` : `No critical grievances or political controversies flagged for ${activeMlaName}.`)
                        : (t.noTodayNewsSubtitle || "Continuous news ingestion is active. Click below to browse historical archives."))}
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  id="btn-empty-go-history"
                  style={{ marginTop: '1rem', background: '#1E293B', fontSize: '0.85rem', padding: '0.5rem 1rem', borderRadius: '8px' }}
                  onClick={() => onPeriodChange('history')}
                >
                  {t.browseHistoryBtn || "Browse History Archive"}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748B' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#334155' }}>
                  {historySpecificDate
                    ? (currentLang === 'te'
                        ? `${historySpecificDate} తేదీకి వార్తలు లేవు`
                        : `No news found for ${historySpecificDate}`)
                    : t.noNewsTitle}
                </div>
                <div style={{ fontSize: '0.85rem', marginTop: '0.35rem', color: '#64748B', maxWidth: '480px', margin: '0.35rem auto 0' }}>
                  {historySpecificDate
                    ? (currentLang === 'te'
                        ? 'ఈ తేదీకి ఎటువంటి వార్తలు నమోదు కాలేదు. దయచేసి ఇతర తేదీలను లేదా ప్రీసెట్లను ఎంచుకోండి.'
                        : `No news archived for ${historySpecificDate}. Try selecting an available date.`)
                    : t.noNewsSubtitle}
                </div>
              </div>
            )
          )}

          {!isLoading && !error && displayedArticles.length > 0 && (
            displayedArticles.map(art => (
              <NewsCard
                key={art.id}
                art={art}
                currentLang={currentLang}
                t={t}
                onOpenOutletsModal={onOpenOutletsModal}
              />
            ))
          )}

          {/* Executive News Feed Pagination Bar */}
          {newsScope !== 'social' && !isLoading && !error && displayedArticles.length > 0 && pagination && pagination.total_pages > 1 && (
            <div className="feed-pagination-bar" id="feed-pagination-bar">
              <div className="pagination-info">
                <span className="pagination-info-dot"></span>
                <span className="pagination-range-text">
                  {currentLang === 'te'
                    ? `కథనాలు ${(pagination.offset || 0) + 1}–${Math.min((pagination.offset || 0) + displayedArticles.length, activeScopeTotal)} (మొత్తం ${activeScopeTotal.toLocaleString()})`
                    : `Showing ${(pagination.offset || 0) + 1}–${Math.min((pagination.offset || 0) + displayedArticles.length, activeScopeTotal)} of ${activeScopeTotal.toLocaleString()} stories`}
                </span>
                <span className="pagination-page-pill">
                  {currentLang === 'te' ? `పేజీ ${currentPage} / ${pagination.total_pages}` : `Page ${currentPage} of ${pagination.total_pages}`}
                </span>
              </div>

              <div className="pagination-controls">
                {/* Previous Button */}
                <button
                  type="button"
                  className="pagination-nav-btn prev-btn"
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => onPageChange(currentPage - 1)}
                  title={currentLang === 'te' ? 'మునుపటి పేజీ' : 'Previous Page'}
                  id="pagination-prev-btn"
                >
                  <svg className="pagination-arrow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                  <span>{currentLang === 'te' ? 'మునుపటి' : 'Previous'}</span>
                </button>

                {/* Numbered Page Buttons with smart ellipsis */}
                <div className="pagination-numbers">
                  {pageNumbers.map((p, idx) => {
                    if (p === '...') {
                      return <span key={`ellipsis-${idx}`} className="pagination-ellipsis">…</span>;
                    }
                    const isActive = p === currentPage;
                    return (
                      <button
                        key={`page-${p}`}
                        type="button"
                        className={`pagination-num-btn ${isActive ? 'active' : ''}`}
                        onClick={() => onPageChange(p)}
                        disabled={isActive || isLoading}
                        id={`pagination-page-${p}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>

                {/* Next Button */}
                <button
                  type="button"
                  className="pagination-nav-btn next-btn"
                  disabled={currentPage >= pagination.total_pages || isLoading}
                  onClick={() => onPageChange(currentPage + 1)}
                  title={currentLang === 'te' ? 'తదుపరి పేజీ' : 'Next Page'}
                  id="pagination-next-btn"
                >
                  <span>{currentLang === 'te' ? 'తదుపరి' : 'Next'}</span>
                  <svg className="pagination-arrow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
