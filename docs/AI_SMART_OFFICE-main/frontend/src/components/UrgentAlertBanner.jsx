import React from 'react';

export default function UrgentAlertBanner({
  alerts,
  activeConst,
  currentLang,
  isSidebarOpen,
  onToggleSidebar,
  onArticleClick
}) {
  if (!alerts || alerts.length === 0) return null;

  const title = activeConst
    ? currentLang === 'te'
      ? `అధిక ప్రాధాన్యత వార్తలు - ${activeConst}`
      : `HIGH PRIORITY ALERTS - ${activeConst.toUpperCase()}`
    : currentLang === 'te'
      ? 'అధిక ప్రాధాన్యత ప్రజా సమస్యలు'
      : 'HIGH PRIORITY CIVIC ALERTS';

  const repeatCount = Math.max(2, Math.ceil(8 / alerts.length));
  const repeatedAlerts = [];
  for (let i = 0; i < repeatCount; i++) {
    alerts.forEach((alert, idx) => {
      repeatedAlerts.push({ ...alert, _uniqueKey: `${alert.id}-${i}-${idx}` });
    });
  }

  return (
    <div id="urgent-alert-banner" className="urgent-banner" style={{ display: 'flex' }}>
      <button
        type="button"
        className={`btn-banner-filter-menu ${isSidebarOpen ? 'active' : ''}`}
        id="btn-banner-filter-menu"
        title="Toggle Search Filters"
        aria-label="Toggle Filters"
        onClick={onToggleSidebar}
      >
        <span className="hamburger-3lines" aria-hidden="true">
          <span className="line"></span>
          <span className="line"></span>
          <span className="line"></span>
        </span>
      </button>

      <div className="urgent-banner-label">
        <div className="radar-ping-container">
          <span className="radar-ring ring-1"></span>
          <span className="radar-ring ring-2"></span>
          <span className="urgent-pulse-dot"></span>
        </div>
        <span className="urgent-title" id="urgent-banner-title">{title}</span>
        <span id="urgent-alert-count" className="urgent-count-badge">{alerts.length}</span>
        <span className="urgent-live-badge">LIVE 🔴</span>
      </div>

      <div className="urgent-ticker-viewport" id="urgent-ticker-viewport">
        <div className="urgent-ticker-track ticker-ltr" id="urgent-alert-track">
          {repeatedAlerts.map(art => {
            const place = art.constituency_name || art.district_name || (currentLang === 'te' ? 'రాష్ట్రం' : 'Telangana');
            const headline = (art.headline || '').trim();
            const pScore = Number(art.priority_score) || 3;
            const pBadge = pScore === 1 ? '🔴 PRIORITY ALERT' : '⚡';

            return (
              <div
                key={art._uniqueKey}
                className="urgent-ticker-item"
                onClick={() => onArticleClick(art.id)}
                title="Click to view story in feed / Hover to pause"
                style={{ cursor: 'pointer' }}
              >
                <span className="urgent-item-badge">📍 {place} {pBadge}</span>
                <span className="urgent-item-headline">{headline}</span>
                <span className="urgent-item-sep">⚡</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="urgent-aurora-border"></div>
    </div>
  );
}
