import React, { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { fetchAudit } from '../utils/api';
import { useLang, useTimeAgo } from '../i18n/LangContext';

export const ACTIONS = ['login_failed', 'login_ok', 'password_changed', 'password_change_failed', 'password_reset',
  'user_created', 'user_disabled', 'user_enabled', 'share_created', 'share_status', 'profile_updated', 'story_feedback', 'app_feedback', 'contacts_imported', 'task_created', 'task_updated', 'news_refresh', 'briefing_edited', 'briefing_reset'];
const BAD = new Set(['login_failed', 'password_change_failed']);

/** One audit line, shared by the Control Room card and the full dialog. */
export function AuditLine({ e }) {
  const { tr } = useLang();
  const ago = useTimeAgo();
  const d = e.detail || {};
  const extra = [d.role, d.status, d.title, d.urgent ? '!' : null].filter(Boolean).join(' · ');
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
      <span className="min-w-0">
        <span className="font-medium">{e.actor || tr('audit.system')}</span>{' '}
        <Badge variant={BAD.has(e.action) ? 'destructive' : 'secondary'}>{tr(`audit.${e.action}`)}</Badge>{' '}
        {e.target && <span className="text-muted-foreground">{e.target}</span>}
        {extra && <span className="block text-xs text-muted-foreground">{extra}</span>}
      </span>
      <span className="text-xs text-muted-foreground">{ago(e.at)}{e.ip ? ` · ${e.ip}` : ''}</span>
    </li>
  );
}

export default function AuditDialog({ onClose }) {
  const { tr } = useLang();
  const [entries, setEntries] = useState([]);
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries((await fetchAudit({ limit: 200, q, action })).entries || []); setError(''); }
    catch (e) { setError(e.message); }
    setLoading(false);
  }, [q, action]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tr('audit.dialog')}</DialogTitle>
          <DialogDescription>{tr('audit.desc')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Input className="min-w-48 flex-1" placeholder={tr('audit.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr('audit.search')} />
          <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={action} onChange={(e) => setAction(e.target.value)} aria-label={tr('audit.allActions')}>
            <option value="">{tr('audit.allActions')}</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{tr(`audit.${a}`)}</option>)}
          </select>
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {loading && entries.length === 0 && <p className="text-center text-sm text-muted-foreground">{tr('home.loading')}</p>}
        {!loading && !error && entries.length === 0 && <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{tr('audit.none')}</p>}
        <ul className="max-h-[55vh] divide-y overflow-y-auto">{entries.map((e) => <AuditLine key={e.id} e={e} />)}</ul>
      </DialogContent>
    </Dialog>
  );
}
