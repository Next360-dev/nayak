import React, { useMemo } from 'react';

export default function SidebarFilters({
  isOpen,
  onClose,
  currentUser,
  districts,
  allPoliticians,
  searchKeyword,
  setSearchKeyword,
  selectedDistrict,
  setSelectedDistrict,
  selectedPolitician,
  setSelectedPolitician,
  selectedConstituency,
  setSelectedConstituency,
  selectedPriority,
  setSelectedPriority,
  onApplyFilters,
  onResetFilters,
  t
}) {
  const isMla = currentUser?.role === 'mla';

  // Filtered list of politicians based on district
  const filteredPoliticians = useMemo(() => {
    if (isMla) {
      return [{
        name: currentUser.politician_name || 'Constituency Representative',
        constituency_name: currentUser.constituency_name || 'Constituency',
        district_name: currentUser.district_name || 'District'
      }];
    }
    if (selectedDistrict && selectedDistrict !== 'All') {
      return (allPoliticians || []).filter(p => p.district_name === selectedDistrict);
    }
    return allPoliticians || [];
  }, [allPoliticians, selectedDistrict, isMla, currentUser]);

  // Unique constituencies based on filtered politicians
  const availableConstituencies = useMemo(() => {
    if (isMla) {
      return [currentUser.constituency_name || 'Constituency'];
    }
    return Array.from(new Set(filteredPoliticians.map(p => p.constituency_name).filter(Boolean))).sort();
  }, [filteredPoliticians, isMla, currentUser]);

  const handleDistrictChange = (e) => {
    const dist = e.target.value;
    setSelectedDistrict(dist);
    setSelectedPolitician('All');
    setSelectedConstituency('All');
  };

  const handlePoliticianChange = (e) => {
    const polName = e.target.value;
    setSelectedPolitician(polName);

    if (polName !== 'All') {
      const match = (allPoliticians || []).find(p => p.name === polName);
      if (match) {
        if (selectedDistrict !== match.district_name) {
          setSelectedDistrict(match.district_name);
        }
        if (match.constituency_name) {
          setSelectedConstituency(match.constituency_name);
        }
      }
    }
  };

  const handleConstituencyChange = (e) => {
    const constName = e.target.value;
    setSelectedConstituency(constName);
    if (constName && constName !== 'All') {
      const match = (allPoliticians || []).find(p => p.constituency_name === constName);
      if (match) {
        setSelectedPolitician(match.name);
        if (selectedDistrict !== match.district_name) {
          setSelectedDistrict(match.district_name);
        }
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onApplyFilters();
    }
  };

  return (
    <aside className="sidebar" id="sidebar-panel">
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title">{t.filterHeader || 'Search Filters'}</div>
          <button type="button" id="btn-close-sidebar" className="btn-close-sidebar" title="Hide Filters" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Search Keyword Filter */}
        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-search">{t.searchLabel || 'Search Keyword'}</label>
          <input
            type="text"
            id="filter-search"
            className="form-input"
            placeholder={t.searchPlaceholder || 'e.g. water, road, bus, ICU...'}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* District Filter */}
        <div className="filter-group" id="group-filter-district">
          <label className="filter-label" htmlFor="filter-district">{t.districtLabel || 'District'}</label>
          <select
            id="filter-district"
            className="filter-select"
            disabled={isMla}
            value={isMla ? (currentUser?.district_name || '') : selectedDistrict}
            onChange={handleDistrictChange}
          >
            {!isMla && <option value="All">{t.districtAll || 'All 33 Districts'}</option>}
            {isMla ? (
              <option value={currentUser?.district_name}>{currentUser?.district_name}</option>
            ) : (
              (districts || []).map(dist => (
                <option key={dist} value={dist}>{dist}</option>
              ))
            )}
          </select>
        </div>

        {/* Politician / MLA Filter */}
        <div className="filter-group" id="group-filter-politician">
          <label className="filter-label" htmlFor="filter-politician">{t.politicianLabel || 'Politician / MLA'}</label>
          <select
            id="filter-politician"
            className="filter-select"
            disabled={isMla}
            value={isMla ? (currentUser?.politician_name || '') : selectedPolitician}
            onChange={handlePoliticianChange}
          >
            {!isMla && <option value="All">{t.politicianAll || 'All 119 MLAs & CM'}</option>}
            {isMla ? (
              <option value={currentUser?.politician_name}>
                {currentUser?.politician_name} ({currentUser?.constituency_name})
              </option>
            ) : (
              filteredPoliticians.map(p => (
                <option key={p.name} value={p.name}>
                  {p.name} ({p.constituency_name})
                </option>
              ))
            )}
          </select>
        </div>

        {/* Constituency Filter */}
        <div className="filter-group" id="group-filter-constituency">
          <label className="filter-label" htmlFor="filter-constituency">{t.constituencyLabel || 'Constituency'}</label>
          <select
            id="filter-constituency"
            className="filter-select"
            disabled={isMla}
            value={isMla ? (currentUser?.constituency_name || '') : selectedConstituency}
            onChange={handleConstituencyChange}
          >
            {!isMla && <option value="All">{t.constituencyAll || 'All Assembly Constituencies'}</option>}
            {isMla ? (
              <option value={currentUser?.constituency_name}>{currentUser?.constituency_name}</option>
            ) : (
              availableConstituencies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))
            )}
          </select>
        </div>

        {/* Priority Level Filter */}
        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-priority">{t.priorityLabel || 'Priority Level'}</label>
          <select
            id="filter-priority"
            className="filter-select"
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
          >
            <option value="0">{t.priorityAll || 'All Civic & Priority Problems'}</option>
            <option value="1">{t.priorityP1 || 'High Priority Civic Problem'}</option>
            <option value="2">{t.priorityP2 || '⚡ Civic Problem'}</option>
            <option value="3">{t.priorityP3 || '🛠️ Standard Civic Problem'}</option>
          </select>
        </div>

        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button className="btn-primary" id="btn-apply-filters" style={{ width: '100%' }} onClick={onApplyFilters}>
            {t.applyFilters || 'Apply Filters'}
          </button>
          <button className="btn-primary" id="btn-reset-filters" style={{ width: '100%', background: '#64748B' }} onClick={onResetFilters}>
            {t.resetFilters || 'Reset Filters'}
          </button>
        </div>
      </div>
    </aside>
  );
}
