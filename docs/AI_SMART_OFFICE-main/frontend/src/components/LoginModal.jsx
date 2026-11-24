import React, { useState } from 'react';
import { loginUser } from '../utils/api';

export default function LoginModal({ isOpen, onLoginSuccess, allPoliticians }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    const u = username.trim().toLowerCase();
    const p = password.trim();

    if (!u || !p) {
      setErrorMessage('Please provide both username and password.');
      return;
    }

    setIsLoading(true);

    try {
      const data = await loginUser(u, p);
      if (data && data.status === 'success' && data.user) {
        setIsLoading(false);
        onLoginSuccess(data.user);
      } else {
        setIsLoading(false);
        setErrorMessage(data?.message || 'Invalid username or password. Please try again.');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('Unable to connect to backend server. Please verify your connection.');
    }
  };

  return (
    <div id="login-overlay" class="login-modal-overlay" style={{ display: 'flex' }}>
      <div className="login-bg-layer"></div>
      <div className="login-bg-overlay"></div>
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <svg className="brand-logo-img" style={{ width: '64px', height: '64px' }} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="46" fill="#0D9488" stroke="#0284C7" strokeWidth="4" />
            <circle cx="50" cy="50" r="38" fill="#FFFFFF" stroke="#D97706" strokeWidth="3" />
            <path d="M 28 68 L 28 42 C 28 26, 72 26, 72 42 L 72 68 M 38 68 L 38 46 C 38 34, 62 34, 62 46 L 62 68 M 46 68 L 46 54 C 46 50, 54 50, 54 54 L 54 68" fill="none" stroke="#0284C7" strokeWidth="4" strokeLinecap="round" />
            <circle cx="50" cy="22" r="5" fill="#D97706" />
          </svg>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.45rem', color: '#0F172A', marginTop: '0.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            SMART OFFICE
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#64748B', marginTop: '0.25rem' }}>
            Telangana State Government Political Portal Login
          </p>
        </div>

        <form id="login-form" onSubmit={handleSubmit}>
          <div className="filter-group" style={{ marginBottom: '1rem' }}>
            <label className="filter-label" htmlFor="login-username" style={{ fontWeight: 600, fontSize: '0.82rem', color: '#334155', marginBottom: '0.35rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Username
            </label>
            <input
              type="text"
              id="login-username"
              className="form-input"
              placeholder="Enter Username"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="filter-group" style={{ marginBottom: '1.25rem' }}>
            <label className="filter-label" htmlFor="login-password" style={{ fontWeight: 600, fontSize: '0.82rem', color: '#334155', marginBottom: '0.35rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Password
            </label>
            <input
              type="password"
              id="login-password"
              className="form-input"
              placeholder="Enter Password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading}
            style={{ width: '100%', padding: '0.8rem 1rem', fontSize: '0.95rem', fontWeight: 600, borderRadius: '10px', background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)', border: 'none', cursor: 'pointer', transition: 'all 0.2s ease', opacity: isLoading ? 0.8 : 1 }}
          >
            {isLoading ? 'Verifying...' : 'Secure Login'}
          </button>
        </form>

        {errorMessage && (
          <div id="login-error-msg" style={{ color: '#E11D48', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center', marginTop: '0.85rem' }}>
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
