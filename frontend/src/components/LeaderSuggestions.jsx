import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw, ShieldAlert, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { approveSuggestion, createShare, fetchShareTargets, fetchSuggestions } from '../utils/api';
import { useLang } from '../i18n/LangContext';

export default function LeaderSuggestions({ user }) {
  const { tr } = useLang();
  const [suggestions, setSuggestions] = useState([]);
  const [targets, setTargets] = useState([]);
  const [assignees, setAssignees] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [suggestionData, targetData] = await Promise.all([fetchSuggestions(), fetchShareTargets()]);
      setSuggestions(suggestionData.suggestions || []);
      setTargets(targetData.targets || []);
    } catch (e) { setError(e.message || 'Could not load suggested next steps.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const assign = async (item) => {
    const recipient = assignees[item.id];
    if (!recipient) return;
    setBusyId(item.id); setError(''); setSuccess('');
    let shareSent = false;
    try {
      await createShare({
        title: item.title,
        summary: item.suggestion,
        note: 'Please review this suggested next step and follow up with the office.',
        article_id: null,
        url: null,
        district_name: user?.district_name || null,
        constituency_name: user?.constituency_name || null,
        priority: 'normal',
        recipients: [recipient],
      });
      shareSent = true;
      setSuggestions((items) => items.map((s) => s.id === item.id ? { ...s, status: 'assigned', assigned_to: recipient } : s));
      await approveSuggestion(item.id, recipient);
      const staff = targets.find((t) => t.username === recipient);
      setSuccess(`Assigned to ${staff?.politician_name || recipient}.`);
    } catch (e) {
      if (shareSent) setSuccess('The follow-up was sent to staff. Refresh later to sync the suggestion status.');
      else setError(e.message || 'Could not assign this follow-up.');
    }
    finally { setBusyId(null); }
  };

  if (loading) return null;

  return (
    <Card className="gap-4 rounded-xl border-slate-200 bg-white py-5 shadow-[0_2px_10px_rgba(15,23,42,.035)]">
      <CardHeader className="flex-row items-start gap-3 pb-0">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-700"><ShieldAlert className="size-4" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1"><CardTitle className="text-[15px] font-semibold">{tr('sug.title')}</CardTitle><CardDescription className="mt-1">{tr('sug.sub')}</CardDescription></div>
        <Button type="button" variant="ghost" size="icon" aria-label={tr('btn.retry')} onClick={load}><RefreshCw className="size-4" /></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {success && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</p>}
        {suggestions.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">{tr('sug.empty')}</p> : (
          <ul className="grid list-none gap-3 md:grid-cols-2">
            {suggestions.map((item) => {
              const assigned = item.status === 'assigned' || (item.status === 'approved' && item.assigned_to);
              const reviewed = item.status === 'approved' && !item.assigned_to;
              const isAlert = item.source.startsWith('alert');
              const staffName = targets.find((t) => t.username === item.assigned_to)?.politician_name || item.assigned_to;
              return <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={isAlert ? 'border-orange-200 bg-orange-50 text-orange-800' : 'border-blue-200 bg-blue-50 text-blue-800'}>{item.source === 'alert_ai' ? 'AI-assisted' : isAlert ? 'Priority story' : 'Watchlist follow-up'}</Badge>
                  <Badge variant="outline" className={assigned ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : reviewed ? 'border-slate-200 bg-white text-slate-600' : 'border-amber-200 bg-amber-50 text-amber-800'}>{assigned ? 'Assigned' : reviewed ? 'Reviewed' : 'Needs review'}</Badge>
                </div>
                <h3 className="mt-3 text-sm font-semibold leading-5 text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm leading-5 text-slate-600">{isAlert && item.source !== 'alert_ai' ? 'Review the report and assign a staff member to follow up.' : item.suggestion}</p>
                {assigned ? <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-800"><UserRound className="size-4" />Following up: {staffName}</p> : reviewed ? <p className="mt-3 text-sm text-slate-600">This suggestion was reviewed.</p> : (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <label className="sr-only" htmlFor={`suggestion-assignee-${item.id}`}>Choose a staff member</label>
                    <select id={`suggestion-assignee-${item.id}`} value={assignees[item.id] || ''} onChange={(e) => setAssignees((s) => ({ ...s, [item.id]: e.target.value }))} className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" disabled={!targets.length}>
                      <option value="">{targets.length ? 'Choose staff member' : 'No active staff available'}</option>
                      {targets.map((target) => <option key={target.username} value={target.username}>{target.politician_name || target.username}</option>)}
                    </select>
                    <Button type="button" disabled={!assignees[item.id] || busyId === item.id} onClick={() => assign(item)}>{busyId === item.id ? 'Assigning…' : <><ArrowUpRight className="size-4" />Assign follow-up</>}</Button>
                  </div>
                )}
              </li>;
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
