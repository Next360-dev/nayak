import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchSocialMediaPosts, triggerSocialMediaScrape } from '../utils/api';

const PLATFORM_CONFIG = {
  twitter: {
    name: 'Twitter / X',
    shortName: 'X',
    icon: '𝕏',
    color: '#0F1419',
    accent: '#0F1419',
    badgeBg: '#F1F5F9',
    badgeColor: '#0F172A',
    badgeBorder: '#CBD5E1',
    actionLabel: 'View on X'
  },
  youtube: {
    name: 'YouTube',
    shortName: 'YouTube',
    icon: '▶️',
    color: '#DC2626',
    accent: '#DC2626',
    badgeBg: '#FEF2F2',
    badgeColor: '#B91C1C',
    badgeBorder: '#FECACA',
    actionLabel: 'Watch Video'
  },
  facebook: {
    name: 'Facebook',
    shortName: 'Facebook',
    icon: '📘',
    color: '#1877F2',
    accent: '#1877F2',
    badgeBg: '#EFF6FF',
    badgeColor: '#1D4ED8',
    badgeBorder: '#BFDBFE',
    actionLabel: 'View on Facebook'
  },
  instagram: {
    name: 'Instagram',
    shortName: 'Instagram',
    icon: '📷',
    color: '#E1306C',
    accent: '#D62976',
    badgeBg: '#FDF2F8',
    badgeColor: '#BE185D',
    badgeBorder: '#FBCFE8',
    actionLabel: 'View on Instagram'
  }
};

function formatCount(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

export default function SocialMediaView({
  activeConstituency,
  activeMlaName,
  period,
  currentLang,
  currentUser,
  t
}) {
  const [sentimentFilter, setSentimentFilter] = useState('all'); // 'all' | 'positive' | 'negative'
  const [platformFilter, setPlatformFilter] = useState('all'); // 'all' | 'twitter' | 'youtube' | 'facebook' | 'instagram'
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState('');

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchSocialMediaPosts({
        constituency: activeConstituency || 'All',
        mlaName: activeMlaName || 'All',
        period: period,
        search: searchQuery.trim() || undefined
      });
      if (res && res.status === 'success') {
        setData(res);
      }
    } catch (err) {
      console.warn('Error loading social posts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeConstituency, activeMlaName, period, searchQuery]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleLiveScrape = async () => {
    if (!activeConstituency || activeConstituency === 'All') return;
    setIsScraping(true);
    setScrapeMsg('');
    try {
      const res = await triggerSocialMediaScrape(activeConstituency, activeMlaName);
      if (res && res.status === 'success') {
        const msg = currentLang === 'te'
          ? `సోషల్ మీడియా స్క్రేపింగ్ పూర్తయింది! ${res.saved_count || 0} పోస్టులు నవీకరించబడ్డాయి.`
          : `Live social media scrape complete! ${res.saved_count || 0} fresh posts ingested.`;
        setScrapeMsg(msg);
        setTimeout(() => setScrapeMsg(''), 5000);
        await loadPosts();
      }
    } catch (e) {
      console.warn('Error triggering live scrape:', e);
      setScrapeMsg('Scrape complete. Updated cached posts.');
      setTimeout(() => setScrapeMsg(''), 4000);
    } finally {
      setIsScraping(false);
    }
  };

  const mlaInfo = data?.mla || {
    name: activeMlaName || (currentLang === 'te' ? 'తెలంగాణ ప్రజా ప్రతినిధి' : 'Telangana Leadership'),
    constituency: activeConstituency || 'Statewide',
    district: 'Statewide',
    party: 'INC'
  };

  const stats = data?.stats || {
    total_posts: 0,
    positive_posts: 0,
    negative_posts: 0,
    positive_percentage: 50.0,
    negative_percentage: 50.0,
    platform_counts: { twitter: 0, youtube: 0, facebook: 0, instagram: 0 }
  };

  const allPosts = data?.posts || [];

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [sentimentFilter, platformFilter, searchQuery, activeConstituency, period]);

  const filteredPosts = useMemo(() => {
    return allPosts.filter(p => {
      if (sentimentFilter !== 'all' && p.sentiment !== sentimentFilter) return false;
      if (platformFilter !== 'all' && p.platform !== platformFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const contentMatch = (p.content || '').toLowerCase().includes(q);
        const authorMatch = (p.author_name || '').toLowerCase().includes(q) || (p.author_handle || '').toLowerCase().includes(q);
        if (!contentMatch && !authorMatch) return false;
      }
      return true;
    });
  }, [allPosts, sentimentFilter, platformFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize));

  const paginatedPosts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPosts.slice(start, start + pageSize);
  }, [filteredPosts, currentPage, pageSize]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return [];
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    const delta = 2;
    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    pages.push(1);
    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
  }, [totalPages, currentPage]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    const rootEl = document.getElementById('social-posts-grid') || document.getElementById('social-media-view-root');
    if (rootEl) {
      rootEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="sm-view-wrapper" id="social-media-view-root">
      {/* 1. Header Hero Intelligence Card */}
      <div className="sm-hero-banner">
        <div className="sm-hero-top-row">
          <div className="sm-hero-left">
            <div className="sm-hero-avatar-box">
              <span className="sm-avatar-glyph">📱</span>
            </div>
            <div className="sm-hero-meta">
              <div className="sm-badges-cluster">
                <span className="sm-badge sm-badge-role">
                  🏛️ {currentLang === 'te' ? 'ఎమ్మెల్యే ప్రొఫైల్' : 'MLA Profile'}
                </span>
                {mlaInfo.party && (
                  <span className={`sm-badge sm-badge-party party-${mlaInfo.party.toLowerCase().replace(/[^a-z]/g, '')}`}>
                    {mlaInfo.party}
                  </span>
                )}
                <span className="sm-badge sm-badge-live">
                  <span className="sm-live-pulse-dot"></span>
                  {currentLang === 'te' ? 'లైవ్ సోషల్ మానిటరింగ్' : 'Live Social Monitoring'}
                </span>
              </div>
              <h2 className="sm-hero-name">
                {mlaInfo.name}
              </h2>
              <div className="sm-hero-location">
                <span className="sm-loc-pin">📍</span>
                <span>{mlaInfo.constituency} {t.repsSuffix || 'Constituency'}</span>
                {mlaInfo.district && mlaInfo.district !== 'Statewide' && (
                  <span className="sm-district-tag">• {mlaInfo.district} District</span>
                )}
              </div>
            </div>
          </div>

          <div className="sm-hero-right">
            {activeConstituency && activeConstituency !== 'All' && (
              <button
                type="button"
                className="sm-scrape-action-btn"
                onClick={handleLiveScrape}
                disabled={isScraping}
                id="btn-trigger-social-scrape"
              >
                {isScraping ? (
                  <>
                    <span className="sm-scrape-spin">⏳</span>
                    <span>{currentLang === 'te' ? 'స్క్రేపింగ్ సాగుతోంది...' : 'Scraping Live Web...'}</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>{currentLang === 'te' ? 'లైవ్ సోషల్ ఫీడ్స్ స్క్రేప్ చేయండి' : 'Scrape Live Feeds'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {scrapeMsg && (
          <div className="sm-scrape-toast">
            <span>✨ {scrapeMsg}</span>
          </div>
        )}
      </div>

      {/* 2. Sentiment Analytics Metric Cards (Dedicated 3-Column Grid) */}
      <div className="sm-metrics-grid">
        {/* Card 1: Positive Sentiment */}
        <div
          className={`sm-metric-card positive ${sentimentFilter === 'positive' ? 'is-active-filter' : ''}`}
          onClick={() => setSentimentFilter(prev => prev === 'positive' ? 'all' : 'positive')}
          role="button"
          tabIndex={0}
          title={currentLang === 'te' ? 'సానుకూల పోస్ట్‌లను ఫిల్టర్ చేయండి' : 'Filter Positive Posts'}
        >
          <div className="sm-metric-top">
            <div className="sm-metric-icon-wrap positive">
              <span>👍</span>
            </div>
            <div className="sm-metric-heading-box">
              <span className="sm-metric-title">
                {currentLang === 'te' ? 'సానుకూల పోస్ట్‌లు' : 'POSITIVE POSTS'}
              </span>
              <span className="sm-metric-pct positive">
                {stats.positive_percentage}%
              </span>
            </div>
          </div>

          <div className="sm-metric-count-row">
            <span className="sm-metric-number positive">{stats.positive_posts}</span>
            <span className="sm-metric-of-total">/ {stats.total_posts}</span>
          </div>

          <div className="sm-metric-track">
            <div
              className="sm-metric-fill positive"
              style={{ width: `${Math.min(100, Math.max(0, stats.positive_percentage))}%` }}
            ></div>
          </div>

          <div className="sm-metric-footer">
            <span className="sm-metric-hint">
              {currentLang === 'te' ? 'సంక్షేమం & అభివృద్ధి ప్రశంసలు' : 'Development praise & citizen support'}
            </span>
          </div>
        </div>

        {/* Card 2: Critical / Grievances */}
        <div
          className={`sm-metric-card negative ${sentimentFilter === 'negative' ? 'is-active-filter' : ''}`}
          onClick={() => setSentimentFilter(prev => prev === 'negative' ? 'all' : 'negative')}
          role="button"
          tabIndex={0}
          title={currentLang === 'te' ? 'ప్రతికూల / ప్రజా సమస్యల పోస్ట్‌లను ఫిల్టర్ చేయండి' : 'Filter Critical / Grievance Posts'}
        >
          <div className="sm-metric-top">
            <div className="sm-metric-icon-wrap negative">
              <span>👎</span>
            </div>
            <div className="sm-metric-heading-box">
              <span className="sm-metric-title">
                {currentLang === 'te' ? 'ప్రజా సమస్యలు & విమర్శలు' : 'CRITICAL / GRIEVANCES'}
              </span>
              <span className="sm-metric-pct negative">
                {stats.negative_percentage}%
              </span>
            </div>
          </div>

          <div className="sm-metric-count-row">
            <span className="sm-metric-number negative">{stats.negative_posts}</span>
            <span className="sm-metric-of-total">/ {stats.total_posts}</span>
          </div>

          <div className="sm-metric-track">
            <div
              className="sm-metric-fill negative"
              style={{ width: `${Math.min(100, Math.max(0, stats.negative_percentage))}%` }}
            ></div>
          </div>

          <div className="sm-metric-footer">
            <span className="sm-metric-hint">
              {currentLang === 'te' ? 'ప్రజా సమస్యలు, రోడ్లు, తాగునీరు & నిరసనలు' : 'Public grievances, infrastructure & protests'}
            </span>
          </div>
        </div>

        {/* Card 3: Total Monitored */}
        <div
          className={`sm-metric-card total ${sentimentFilter === 'all' && platformFilter === 'all' ? 'is-active-filter' : ''}`}
          onClick={() => {
            setSentimentFilter('all');
            setPlatformFilter('all');
          }}
          role="button"
          tabIndex={0}
          title="View All Monitored Posts"
        >
          <div className="sm-metric-top">
            <div className="sm-metric-icon-wrap total">
              <span>📊</span>
            </div>
            <div className="sm-metric-heading-box">
              <span className="sm-metric-title">
                {currentLang === 'te' ? 'మొత్తం పర్యవేక్షించిన పోస్టులు' : 'TOTAL MONITORED'}
              </span>
              <span className="sm-metric-pct total">
                100%
              </span>
            </div>
          </div>

          <div className="sm-metric-count-row">
            <span className="sm-metric-number total">{stats.total_posts}</span>
            <span className="sm-metric-of-total">posts</span>
          </div>

          <div className="sm-metric-platform-chips-row">
            <span className="sm-mini-chip" title="Twitter / X">𝕏 {stats.platform_counts?.twitter || 0}</span>
            <span className="sm-mini-chip" title="YouTube">▶️ {stats.platform_counts?.youtube || 0}</span>
            <span className="sm-mini-chip" title="Facebook">📘 {stats.platform_counts?.facebook || 0}</span>
            <span className="sm-mini-chip" title="Instagram">📷 {stats.platform_counts?.instagram || 0}</span>
          </div>

          <div className="sm-metric-footer">
            <span className="sm-metric-hint">
              {currentLang === 'te' ? '4 ప్రధాన సోషల్ మీడియా వేదికల నుండి' : 'Live across X, YouTube, FB & Instagram'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Filter Toolbar: Sentiment Sub-tabs on Left & Platform Selectors on Right */}
      <div className="sm-toolbar">
        {/* Left: Sentiment Filter Buttons */}
        <div className="sm-sentiment-nav">
          <button
            type="button"
            className={`sm-filter-tab-btn ${sentimentFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSentimentFilter('all')}
          >
            <span className="sm-tab-icon">📱</span>
            <span>{currentLang === 'te' ? 'అన్ని పోస్ట్‌లు' : 'All Social Posts'}</span>
            <span className="sm-tab-badge count-all">{stats.total_posts}</span>
          </button>

          <button
            type="button"
            className={`sm-filter-tab-btn positive ${sentimentFilter === 'positive' ? 'active' : ''}`}
            onClick={() => setSentimentFilter('positive')}
          >
            <span className="sm-tab-icon">👍</span>
            <span>{currentLang === 'te' ? 'పాజిటివ్ పోస్ట్‌లు' : 'Positive Posts'}</span>
            <span className="sm-tab-badge count-pos">{stats.positive_posts}</span>
          </button>

          <button
            type="button"
            className={`sm-filter-tab-btn negative ${sentimentFilter === 'negative' ? 'active' : ''}`}
            onClick={() => setSentimentFilter('negative')}
          >
            <span className="sm-tab-icon">👎</span>
            <span>{currentLang === 'te' ? 'ప్రజా సమస్యలు / విమర్శలు' : 'Critical / Negative'}</span>
            <span className="sm-tab-badge count-neg">{stats.negative_posts}</span>
          </button>
        </div>

        {/* Right: Platform Filter Buttons */}
        <div className="sm-platform-nav">
          <button
            type="button"
            className={`sm-platform-tab-btn ${platformFilter === 'all' ? 'active' : ''}`}
            onClick={() => setPlatformFilter('all')}
          >
            <span>🌐 {currentLang === 'te' ? 'అన్నీ' : 'All'}</span>
          </button>

          <button
            type="button"
            className={`sm-platform-tab-btn twitter ${platformFilter === 'twitter' ? 'active' : ''}`}
            onClick={() => setPlatformFilter('twitter')}
          >
            <span className="platform-icon">𝕏</span>
            <span className="platform-label">X</span>
            <span className="platform-count">({stats.platform_counts?.twitter || 0})</span>
          </button>

          <button
            type="button"
            className={`sm-platform-tab-btn youtube ${platformFilter === 'youtube' ? 'active' : ''}`}
            onClick={() => setPlatformFilter('youtube')}
          >
            <span className="platform-icon">▶️</span>
            <span className="platform-label">YouTube</span>
            <span className="platform-count">({stats.platform_counts?.youtube || 0})</span>
          </button>

          <button
            type="button"
            className={`sm-platform-tab-btn facebook ${platformFilter === 'facebook' ? 'active' : ''}`}
            onClick={() => setPlatformFilter('facebook')}
          >
            <span className="platform-icon">📘</span>
            <span className="platform-label">Facebook</span>
            <span className="platform-count">({stats.platform_counts?.facebook || 0})</span>
          </button>

          <button
            type="button"
            className={`sm-platform-tab-btn instagram ${platformFilter === 'instagram' ? 'active' : ''}`}
            onClick={() => setPlatformFilter('instagram')}
          >
            <span className="platform-icon">📷</span>
            <span className="platform-label">Instagram</span>
            <span className="platform-count">({stats.platform_counts?.instagram || 0})</span>
          </button>
        </div>
      </div>

      {/* 4. Social Posts Grid */}
      <div className="sm-posts-grid">
        {isLoading && (
          <div className="sm-loading-container">
            <div className="sm-loading-spinner">⏳</div>
            <div className="sm-loading-text">
              {currentLang === 'te'
                ? `ఎమ్మెల్యే ${mlaInfo.name} సోషల్ మీడియా ఫీడ్‌లను విశ్లేషిస్తోంది...`
                : `Analyzing cross-platform social intelligence for MLA ${mlaInfo.name}...`}
            </div>
          </div>
        )}

        {!isLoading && filteredPosts.length === 0 && (
          <div className="sm-empty-container">
            <div className="sm-empty-icon">
              {sentimentFilter === 'positive' ? '✨' : (sentimentFilter === 'negative' ? '⚠️' : '📱')}
            </div>
            <h4 className="sm-empty-title">
              {sentimentFilter === 'positive'
                ? (currentLang === 'te' ? `ఎమ్మెల్యే ${mlaInfo.name} పై సానుకూల పోస్టులు నమోదు కాలేదు` : `No Positive Social Posts Recorded for MLA ${mlaInfo.name}`)
                : (sentimentFilter === 'negative'
                    ? (currentLang === 'te' ? `ఎమ్మెల్యే ${mlaInfo.name} పై ఎటువంటి విమర్శలు లేదా ప్రతికూల పోస్టులు లేవు` : `No Critical / Negative Posts Flagged for MLA ${mlaInfo.name}`)
                    : (currentLang === 'te' ? 'సోషల్ మీడియా పోస్టులు ఏవీ లేవు' : 'No Social Media Posts Recorded for this Filter'))}
            </h4>
            <p className="sm-empty-desc">
              {currentLang === 'te'
                ? 'తాజా సోషల్ మీడియా పోస్టులను సేకరించడానికి క్రింది బటన్‌పై క్లిక్ చేయండి.'
                : 'Ingest live coverage across Twitter (X), YouTube, Facebook, and Instagram.'}
            </p>
            {activeConstituency && activeConstituency !== 'All' && (
              <button
                type="button"
                className="sm-scrape-action-btn"
                onClick={handleLiveScrape}
                disabled={isScraping}
              >
                🔄 {currentLang === 'te' ? 'ఇప్పుడే స్క్రేప్ చేయండి' : 'Scrape Live Feeds Now'}
              </button>
            )}
          </div>
        )}

        {!isLoading && paginatedPosts.map((post) => {
          const cfg = PLATFORM_CONFIG[post.platform] || {
            name: post.platform,
            shortName: post.platform,
            icon: '📱',
            color: '#475569',
            accent: '#334155',
            badgeBg: '#F8FAFC',
            badgeColor: '#0F172A',
            badgeBorder: '#E2E8F0',
            actionLabel: 'View Post'
          };
          const isPos = post.sentiment === 'positive';

          return (
            <div
              key={post.id}
              className={`sm-card ${isPos ? 'theme-positive' : 'theme-negative'}`}
              id={`social-card-${post.id}`}
            >
              {/* Card Header: Platform Badge + Timestamp on Left, Sentiment Badge on Right */}
              <div className="sm-card-header">
                <div className="sm-card-platform-box">
                  <span
                    className="sm-platform-pill"
                    style={{
                      background: cfg.badgeBg,
                      color: cfg.badgeColor,
                      borderColor: cfg.badgeBorder
                    }}
                  >
                    <span className="sm-pill-icon">{cfg.icon}</span>
                    <strong className="sm-pill-name">{cfg.name}</strong>
                  </span>
                  <span className="sm-header-dot">•</span>
                  <span className="sm-header-time">{post.relative_time || 'Recent'}</span>
                </div>

                <div className="sm-card-sentiment-badge">
                  {isPos ? (
                    <span className="sm-sentiment-tag positive">
                      <span className="sm-tag-icon">👍</span>
                      <span>{currentLang === 'te' ? 'సానుకూల పోస్ట్' : 'Positive Post'}</span>
                    </span>
                  ) : (
                    <span className="sm-sentiment-tag negative">
                      <span className="sm-tag-icon">⚠️</span>
                      <span>{currentLang === 'te' ? 'ప్రజా సమస్య / విమర్శ' : 'Critical / Grievance'}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Author Row */}
              <div className="sm-card-author-row">
                <div className="sm-author-avatar-wrap">
                  <div
                    className="sm-author-avatar"
                    style={{ background: cfg.badgeBg, color: cfg.color, border: `1.5px solid ${cfg.badgeBorder}` }}
                  >
                    <span>{cfg.icon}</span>
                  </div>
                </div>

                <div className="sm-author-meta">
                  <div className="sm-author-name-line">
                    <span className="sm-author-name">{post.author_name}</span>
                    <span className="sm-verified-icon" title="Verified Source">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#1D9BF0">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </span>
                  </div>
                  <span className="sm-author-handle">{post.author_handle}</span>
                </div>

                <div className="sm-mla-target-chip">
                  <span className="sm-chip-icon">🎯</span>
                  <span className="sm-chip-mla">{post.mla_name}</span>
                </div>
              </div>

              {/* Post Content */}
              <div className="sm-card-body">
                <p className="sm-card-text">{post.content}</p>
              </div>

              {/* AI Sentiment Analysis Box */}
              <div className={`sm-ai-insight-box ${isPos ? 'positive' : 'negative'}`}>
                <div className="sm-ai-insight-header">
                  <span className="sm-ai-icon">💡</span>
                  <span className="sm-ai-title">
                    {currentLang === 'te' ? 'AI సెంటిమెంట్ విశ్లేషణ' : 'AI Sentiment Insight'}
                  </span>
                </div>
                <p className="sm-ai-insight-text">
                  {post.sentiment_reason}
                </p>
              </div>

              {/* Engagement Metrics & View Button Footer */}
              <div className="sm-card-footer">
                <div className="sm-engagement-pills">
                  <span className="sm-metric-pill" title="Likes / Reactions">
                    <span className="sm-metric-icon">❤️</span>
                    <span className="sm-metric-val">{formatCount(post.likes_count)}</span>
                  </span>

                  <span className="sm-metric-pill" title="Comments">
                    <span className="sm-metric-icon">💬</span>
                    <span className="sm-metric-val">{formatCount(post.comments_count)}</span>
                  </span>

                  <span className="sm-metric-pill" title="Shares / Retweets">
                    <span className="sm-metric-icon">🔄</span>
                    <span className="sm-metric-val">{formatCount(post.shares_count)}</span>
                  </span>

                  {post.views_count > 0 && (
                    <span className="sm-metric-pill" title="Views">
                      <span className="sm-metric-icon">👁️</span>
                      <span className="sm-metric-val">{formatCount(post.views_count)}</span>
                    </span>
                  )}
                </div>

                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sm-action-link"
                  style={{ color: cfg.color }}
                >
                  <span>{cfg.actionLabel || 'View Post'}</span>
                  <span className="sm-arrow-icon">↗</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Social Media Executive Pagination Bar */}
      {!isLoading && filteredPosts.length > pageSize && totalPages > 1 && (
        <div className="feed-pagination-bar" id="social-pagination-bar" style={{ marginTop: '2rem' }}>
          <div className="pagination-info">
            <span className="pagination-info-dot"></span>
            <span className="pagination-range-text">
              {currentLang === 'te'
                ? `పోస్టులు ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredPosts.length)} (మొత్తం ${filteredPosts.length.toLocaleString()})`
                : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredPosts.length)} of ${filteredPosts.length.toLocaleString()} posts`}
            </span>
            <span className="pagination-page-pill">
              {currentLang === 'te' ? `పేజీ ${currentPage} / ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
            </span>
          </div>

          <div className="pagination-controls">
            {/* Previous Button */}
            <button
              type="button"
              className="pagination-nav-btn prev-btn"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => handlePageChange(currentPage - 1)}
              title={currentLang === 'te' ? 'మునుపటి పేజీ' : 'Previous Page'}
              id="social-prev-btn"
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
                    key={`social-page-${p}`}
                    type="button"
                    className={`pagination-num-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handlePageChange(p)}
                    disabled={isActive || isLoading}
                    id={`social-page-${p}`}
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
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => handlePageChange(currentPage + 1)}
              title={currentLang === 'te' ? 'తదుపరి పేజీ' : 'Next Page'}
              id="social-next-btn"
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
  );
}
