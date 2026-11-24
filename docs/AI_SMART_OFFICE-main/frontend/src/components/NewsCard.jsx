import React, { useState } from 'react';
import { deduplicateSources, isTextTelugu, classifyArticleSentiment, isStatewideArticle } from '../utils/constants';
import { translateArticle } from '../utils/api';

export default function NewsCard({ art, currentLang, t, onOpenOutletsModal }) {
  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedHeadline, setTranslatedHeadline] = useState('');
  const [translatedSummary, setTranslatedSummary] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const pScore = Number(art.priority_score) || 3;
  let pBorderColor = '#2563EB';
  let badgeClass = 'badge-p3';
  let badgeText = t.p3Badge;

  if (pScore === 1) {
    pBorderColor = '#E11D48';
    badgeClass = 'badge-p1';
    badgeText = t.p1Badge;
  } else if (pScore === 2) {
    pBorderColor = '#D97706';
    badgeClass = 'badge-p2';
    badgeText = t.p2Badge;
  }

  const formattedDate = art.date_time
    ? new Date(art.date_time).toLocaleString(currentLang === 'te' ? 'te-IN' : 'en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : (currentLang === 'te' ? 'ఇటీవల' : 'Recent');

  const rawSources = Array.isArray(art.sources) && art.sources.length > 0
    ? art.sources
    : [{ publisher: art.newspaper_name || 'News Source', url: art.url || '#' }];
  const sourcesList = deduplicateSources(rawSources);
  const primarySource = (sourcesList && sourcesList.length > 0)
    ? sourcesList[0]
    : { publisher: art.newspaper_name || 'News Source', url: art.url || '#' };
  const extraOutletsCount = Math.max(0, sourcesList.length - 1);

  const distDisplay = art.district_name || t.statewide;
  const leaderName = art.politician_name || (currentLang === 'te' ? 'రాష్ట్ర పరిపాలన' : 'State Administration');
  const constDisplay = art.constituency_name || t.statewide;

  // Scope Badge
  let scopeBadge = null;
  if (art.is_social || art.news_type === 'social') {
    scopeBadge = <span className="badge badge-social-news" style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', fontWeight: 600 }}>{t.badgeSocialNews || '📱 Social Media'}</span>;
  } else {
    scopeBadge = <span className="badge badge-civic-news">{t.badgeCivicNews}</span>;
  }

  // Sentiment and Statewide Badges
  const sentiment = art.sentiment || classifyArticleSentiment(art);
  let sentimentBadge = null;
  if (sentiment === 'positive') {
    sentimentBadge = (
      <span className="badge badge-positive" style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', fontWeight: 600 }}>
        {t.badgePositive || '✨ Positive'}
      </span>
    );
  } else if (sentiment === 'negative') {
    sentimentBadge = (
      <span className="badge badge-negative" style={{ background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', fontWeight: 600 }}>
        {t.badgeNegative || '⚠️ Grievance'}
      </span>
    );
  }

  const isStatewide = art.is_statewide !== undefined ? art.is_statewide : isStatewideArticle(art);
  const statewideBadge = isStatewide ? (
    <span className="badge badge-statewide" style={{ background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', fontWeight: 600 }}>
      {t.badgeStatewide || '🌐 Statewide'}
    </span>
  ) : null;

  const isTel = isTextTelugu(art.headline);

  const handleToggleTranslation = async () => {
    if (isTranslated) {
      setIsTranslated(false);
      return;
    }

    if (translatedHeadline) {
      setIsTranslated(true);
      return;
    }

    setIsTranslating(true);
    try {
      const data = await translateArticle(art.headline, art.summary);
      if (data.status === 'success' && data.data) {
        setTranslatedHeadline(data.data.translated_headline || art.headline);
        setTranslatedSummary(data.data.translated_summary || art.summary || '');
        setIsTranslated(true);
      } else {
        alert('Translation service is momentarily busy. Please try again.');
      }
    } catch (err) {
      console.error('Translation error:', err);
      alert('Could not connect to translation service.');
    } finally {
      setIsTranslating(false);
    }
  };

  const currentDisplayHeadline = isTranslated ? (translatedHeadline || art.headline) : art.headline;
  const currentDisplaySummary = isTranslated ? (translatedSummary || art.summary) : (art.summary || '');

  return (
    <div
      className="card article-card"
      id={`article-card-${art.id}`}
      style={{
        borderLeft: `4px solid ${pBorderColor}`,
        marginBottom: '0.65rem',
        padding: '0.85rem 1rem'
      }}
    >
      {/* Top Row: Civic Priority & Location Badges on Left, Posted Time on Right */}
      <div
        className="article-card-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: '0.4rem'
        }}
      >
        <div className="article-card-badges" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span className={`badge ${badgeClass}`}>{badgeText}</span>
          {scopeBadge}
          {sentimentBadge}
          {statewideBadge}
          <span className="badge badge-district">📍 {distDisplay}</span>
          {constDisplay && constDisplay !== 'Statewide' && constDisplay.toLowerCase() !== distDisplay.toLowerCase() && (
            <span
              className="badge"
              style={{
                background: '#ECFDF5',
                color: '#047857',
                border: '1px solid #A7F3D0',
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600
              }}
            >
              🏛️ {constDisplay}
            </span>
          )}
        </div>
        <div
          className="article-card-posted"
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#64748B',
            marginLeft: 'auto',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}
        >
          <span>🕒</span> <span>{t.postedPrefix}</span> <strong style={{ color: '#0F172A' }}>{formattedDate}</strong>
        </div>
      </div>

      <h3
        id={`article-title-${art.id}`}
        style={{
          fontSize: '1.12rem',
          fontWeight: 700,
          color: '#0F172A',
          margin: '0.35rem 0 0.3rem 0',
          lineHeight: 1.35
        }}
      >
        {currentDisplayHeadline}
      </h3>

      <p
        id={`article-summary-${art.id}`}
        style={{
          color: '#475569',
          fontSize: '0.91rem',
          lineHeight: 1.55,
          marginBottom: '0.55rem'
        }}
      >
        {currentDisplaySummary}
      </p>

      {/* Bottom Action Row: Primary Outlet, +N Outlets Pill & Leader on Left, Translation on Right */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          paddingTop: '0.45rem',
          borderTop: '1px solid #F1F5F9'
        }}
      >
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <a
            href={primarySource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="primary-outlet-link"
            title={`Open news source: ${primarySource.publisher}`}
          >
            {primarySource.publisher}
          </a>
          {extraOutletsCount > 0 && (
            <button
              type="button"
              className="btn-outlets-pill"
              onClick={() => onOpenOutletsModal(art)}
              title={`Click to view all ${sourcesList.length} media outlets for this news`}
            >
              +{extraOutletsCount}
            </button>
          )}
          {leaderName && (
            <span style={{ fontSize: '0.8rem', color: '#475569', marginLeft: '0.25rem' }}>
              👤 <strong>{t.leaderLabel}</strong> {leaderName}
            </span>
          )}
        </div>

        <button
          type="button"
          className={`btn-compact-translate ${isTranslated ? 'is-translated' : ''} ${isTranslating ? 'is-loading' : ''}`}
          id={`btn-translate-${art.id}`}
          onClick={handleToggleTranslation}
          title={isTel ? 'Translate to English' : 'Translate to Telugu'}
        >
          {isTranslating ? 'Translating...' : isTranslated ? 'Original' : 'Translate'}
        </button>
      </div>
    </div>
  );
}
