import React, { useEffect } from 'react';
import { deduplicateSources, isTextTelugu } from '../utils/constants';

export default function OutletsModal({ isOpen, onClose, article, currentLang }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !article) return null;

  const rawSources = Array.isArray(article.sources) && article.sources.length > 0
    ? article.sources
    : [{ publisher: article.newspaper_name || 'News Source', url: article.url || '#' }];
  const sourcesList = deduplicateSources(rawSources);

  const isTel = currentLang === 'te' || isTextTelugu(article.headline);
  const modalTitle = isTel
    ? `వార్తా మాధ్యమాలు (${sourcesList.length})`
    : `Media Outlets (${sourcesList.length})`;
  const openBtnText = isTel ? 'చదవండి ↗' : 'Read Article ↗';

  return (
    <div id="outlets-modal" className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-dialog">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon">📰</div>
            <div>
              <h3 className="modal-title" id="outlets-modal-title">{modalTitle}</h3>
              <p className="modal-subtitle" id="outlets-modal-subtitle">{article.headline || ''}</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close" aria-label="Close">
            &times;
          </button>
        </div>

        <div className="modal-body" id="outlets-modal-list">
          {sourcesList.map((s, idx) => (
            <div key={`${s.publisher}-${idx}`} className="modal-outlet-item">
              <div className="modal-outlet-name">
                <span style={{ fontSize: '1.15rem' }}>🌐</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#0F172A' }}>{s.publisher}</div>
                  {idx === 0 && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: '#0369A1',
                        background: '#E0F2FE',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        display: 'inline-block',
                        marginTop: '2px'
                      }}
                    >
                      Primary Source
                    </span>
                  )}
                </div>
              </div>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="modal-outlet-btn"
              >
                📖 {openBtnText}
              </a>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
            style={{ background: '#64748B', fontSize: '0.85rem', padding: '0.45rem 1.1rem', borderRadius: '8px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
