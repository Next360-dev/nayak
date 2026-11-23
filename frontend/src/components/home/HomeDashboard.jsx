import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { fetchDashboard } from '../../utils/api';
import AdminHome from './AdminHome';
import LeaderHome from './LeaderHome';
import StaffHome from './StaffHome';
import { HomeSkeleton, Page } from './shared';
import { useLang } from '../../i18n/LangContext';

/** Loads the caller's own dashboard and shows the right home screen for their role. */
export default function HomeDashboard({ refreshKey, currentUser, onShare, onTask, onOpenBoard, onOpenInbox, onOpenUsers, onOpenTeam, onOpenCompose, onOpenProjects, onOpenNews, onOpenAudit, onOpenBriefing, onOpenDemo }) {
  const { tr } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setData(await fetchDashboard()); setError(''); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load, refreshKey]);

  if (!data && error) {
    return (
      <Page title={tr('home.loading')}>
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {tr('home.loadError', { e: error })} <Button size="sm" variant="outline" onClick={load}>{tr('btn.retry')}</Button>
        </div>
      </Page>
    );
  }
  if (!data) return <HomeSkeleton />;

  if (data.kind === 'admin') return <AdminHome data={data} currentUser={currentUser} onRefresh={load} onOpenUsers={onOpenUsers} onOpenInbox={onOpenInbox} onOpenAudit={onOpenAudit} onOpenBriefing={onOpenBriefing} onOpenCompose={onOpenCompose} onOpenProjects={onOpenProjects} />;
  if (data.kind === 'staff') return <StaffHome data={data} currentUser={currentUser} onRefreshed={load} onShare={onShare} onTask={onTask} onOpenBoard={onOpenBoard} onOpenInbox={onOpenInbox} onOpenNews={onOpenNews} onOpenBriefing={onOpenBriefing} onOpenCompose={onOpenCompose} onOpenProjects={onOpenProjects} onOpenDemo={onOpenDemo} />;
  return <LeaderHome data={data} currentUser={currentUser} onRefreshed={load} onChanged={load} onShare={onShare} onOpenBoard={onOpenBoard} onOpenInbox={onOpenInbox} onOpenTeam={onOpenTeam} onOpenNews={onOpenNews} onOpenBriefing={onOpenBriefing} onOpenCompose={onOpenCompose} onOpenProjects={onOpenProjects} onOpenDemo={onOpenDemo} />;
}
