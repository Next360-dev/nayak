import React from 'react';

export default function Header({ currentUser, onLogout, t }) {
  const subtitle = currentUser?.role === 'admin'
    ? 'Telangana State Government Command Center'
    : currentUser?.constituency_name
      ? `${currentUser.constituency_name} Constituency`
      : t.portalSubtitle;

  const displayName = currentUser?.politician_name || currentUser?.username || t.loggedIn;

  return (
    <header className="app-header">
      <div className="brand-container">
        <svg className="brand-logo-img" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="#0D9488" stroke="#0284C7" strokeWidth="4" />
          <circle cx="50" cy="50" r="38" fill="#FFFFFF" stroke="#D97706" strokeWidth="3" />
          <path d="M 28 68 L 28 42 C 28 26, 72 26, 72 42 L 72 68 M 38 68 L 38 46 C 38 34, 62 34, 62 46 L 62 68 M 46 68 L 46 54 C 46 50, 54 50, 54 54 L 54 68" fill="none" stroke="#0284C7" strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="22" r="5" fill="#D97706" />
        </svg>
        <div>
          <div className="brand-title" id="header-portal-title">
            SMART OFFICE
          </div>
          <div className="brand-subtitle" id="header-portal-subtitle">
            {subtitle}
          </div>
        </div>
      </div>

      <div className="header-controls">
        <div id="user-profile-badge" className="status-indicator" style={{ background: '#EFF6FF', borderColor: '#BFDBFE', color: '#1D4ED8' }}>
          <span id="user-display-name">{displayName}</span>
        </div>
        <button className="btn-primary" id="btn-logout" onClick={onLogout} style={{ background: '#64748B' }}>
          {t.logout || '🚪 Logout'}
        </button>
      </div>
    </header>
  );
}
