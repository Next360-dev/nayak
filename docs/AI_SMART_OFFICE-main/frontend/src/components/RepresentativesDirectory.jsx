import React from 'react';

export default function RepresentativesDirectory({ reps, isLoading, currentLang, t }) {
  const getPartyBg = (party) => {
    switch (party) {
      case 'BRS': return '#F472B6';
      case 'INC': return '#60A5FA';
      case 'BJP': return '#F97316';
      case 'AIMIM': return '#34D399';
      default: return '#A7F3D0';
    }
  };

  const countBadgeText = `${(reps || []).length} ${(reps || []).length === 1 ? (currentLang === 'te' ? 'నియోజకవర్గం' : 'Representative') : (currentLang === 'te' ? 'నియోజకవర్గాలు' : 'Representatives')}`;

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div className="card-header">
        <div className="card-title" id="reps-section-title">
          {t.repsTitle || '🏛️ Constituency Representative Profile'}
        </div>
        <span className="badge badge-constituency" id="rep-count-badge">
          {countBadgeText}
        </span>
      </div>

      <div className="rep-grid" id="reps-grid-container">
        {isLoading && (
          <div style={{ color: '#64748B', padding: '1rem' }}>
            {currentLang === 'te' ? 'ప్రజాప్రతినిధులను లోడ్ చేస్తోంది...' : 'Loading Representatives...'}
          </div>
        )}

        {!isLoading && (!reps || reps.length === 0) && (
          <div style={{ color: '#64748B', fontSize: '0.9rem', padding: '1rem' }}>
            {currentLang === 'te'
              ? 'ప్రస్తుత ఎంపికకు ప్రజాప్రతినిధులు లేరు.'
              : 'No representative profiles match the current selection.'}
          </div>
        )}

        {!isLoading && reps && reps.length > 0 && (
          reps.map((r, idx) => (
            <div
              key={r.id || `${r.name}-${idx}`}
              className="rep-card"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                marginBottom: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.65rem' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: '#0D9488',
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.3rem',
                    fontWeight: 700
                  }}
                >
                  {r.name ? r.name.charAt(0) : '🏛️'}
                </div>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    {r.name}
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: '#64748B', display: 'flex', gap: '0.35rem', alignItems: 'center', marginTop: '0.2rem' }}>
                    <span style={{ background: getPartyBg(r.party_affiliation), color: '#0F172A', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.7rem' }}>
                      {r.party_affiliation}
                    </span>
                    <span>• {r.role_type}</span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.82rem', color: '#334155', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <div>🏛️ <strong>{currentLang === 'te' ? 'నియోజకవర్గం' : 'Constituency'}:</strong> {r.constituency_name}</div>
                <div>📍 <strong>{currentLang === 'te' ? 'జిల్లా' : 'District'}:</strong> {r.district_name}</div>
                <div>📞 <strong>{currentLang === 'te' ? 'ఫోన్' : 'Contact'}:</strong> {r.contact_number || 'N/A'}</div>
                <div>✉️ <strong>{currentLang === 'te' ? 'ఈమెయిల్' : 'Email'}:</strong> {r.email_id || 'N/A'}</div>
                <div>👥 <strong>{currentLang === 'te' ? 'ఓటర్ల సంఖ్య' : 'Voter Base'}:</strong> {r.voter_base ? r.voter_base.toLocaleString() : 'N/A'}</div>
                <div>🏢 <strong>{currentLang === 'te' ? 'కార్యాలయం' : 'Office'}:</strong> {r.office_address || (currentLang === 'te' ? 'నియోజకవర్గ కార్యాలయం' : 'Constituency Office')}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
