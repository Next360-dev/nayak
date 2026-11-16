import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export default function SidebarFilters({
  isOpen,
  onClose,
  currentUser,
  districts,
  allPoliticians,
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
  const isMla = currentUser?.scoped;

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

  const te = t && t.applyFilters && /[\u0C00-\u0C7F]/.test(t.applyFilters);
  const selectCls = 'h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring';
  const Field = ({ id, label, children }) => (
    <div className="space-y-1.5" id={`group-${id}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );

  return (
    <Sheet open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md" id="sidebar-panel">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{t.filterHeader || 'Filters'}</SheetTitle>
          <SheetDescription>{te ? 'ఫలితాలను తగ్గించడానికి ఎంచుకోండి.' : 'Narrow the stories you see.'}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5" onKeyDown={handleKeyDown}>
          <Field id="filter-district" label={t.districtLabel || 'District'}>
            <select id="filter-district" className={selectCls} disabled={isMla}
                    value={isMla ? (currentUser?.district_name || '') : selectedDistrict} onChange={handleDistrictChange}>
              {!isMla && <option value="All">{t.districtAll || 'All 33 Districts'}</option>}
              {isMla ? <option value={currentUser?.district_name}>{currentUser?.district_name}</option>
                : (districts || []).map((dist) => <option key={dist} value={dist}>{dist}</option>)}
            </select>
          </Field>

          <Field id="filter-politician" label={t.politicianLabel || 'Politician / MLA'}>
            <select id="filter-politician" className={selectCls} disabled={isMla}
                    value={isMla ? (currentUser?.politician_name || '') : selectedPolitician} onChange={handlePoliticianChange}>
              {!isMla && <option value="All">{t.politicianAll || 'All 119 MLAs & CM'}</option>}
              {isMla ? <option value={currentUser?.politician_name}>{currentUser?.politician_name} ({currentUser?.constituency_name})</option>
                : filteredPoliticians.map((p) => <option key={p.name} value={p.name}>{p.name} ({p.constituency_name})</option>)}
            </select>
          </Field>

          <Field id="filter-constituency" label={t.constituencyLabel || 'Constituency'}>
            <select id="filter-constituency" className={selectCls} disabled={isMla}
                    value={isMla ? (currentUser?.constituency_name || '') : selectedConstituency} onChange={handleConstituencyChange}>
              {!isMla && <option value="All">{t.constituencyAll || 'All Assembly Constituencies'}</option>}
              {isMla ? <option value={currentUser?.constituency_name}>{currentUser?.constituency_name}</option>
                : availableConstituencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field id="filter-priority" label={t.priorityLabel || 'Priority'}>
            <select id="filter-priority" className={selectCls} value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)}>
              <option value="0">{t.priorityAll || 'All stories'}</option>
              <option value="1">{t.priorityP1 || 'Urgent only'}</option>
              <option value="2">{t.priorityP2 || 'Civic'}</option>
              <option value="3">{t.priorityP3 || 'Standard'}</option>
            </select>
          </Field>
        </div>

        <SheetFooter className="flex-row gap-2 border-t px-6 py-4">
          <Button id="btn-apply-filters" className="flex-1" onClick={() => { onApplyFilters(); onClose(); }}>{t.applyFilters || 'Apply filters'}</Button>
          <Button id="btn-reset-filters" variant="outline" className="flex-1" onClick={() => { onResetFilters(); onClose(); }}>{t.resetFilters || 'Reset'}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
