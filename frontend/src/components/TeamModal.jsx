import React, { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { fetchTeam, createTeamMember, resetTeamPassword, setTeamActive } from '../utils/api';
import { useLang, useTimeAgo } from '../i18n/LangContext';

export default function TeamModal({ onClose }) {
  const { tr } = useLang();
  const ago = useTimeAgo();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null); // { ok, text }
  const [form, setForm] = useState({ username: '', password: '' });
  const [resetFor, setResetFor] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setStaff((await fetchTeam()).staff || []); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, okText) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: okText }); await load(); return true; }
    catch (err) { setMsg({ ok: false, text: err.message }); return false; }
    finally { setBusy(false); }
  };

  const add = async (e) => {
    e.preventDefault();
    const u = form.username.trim().toLowerCase();
    if (!u || !form.password) { setMsg({ ok: false, text: tr('team.enterBoth') }); return; }
    if (await run(() => createTeamMember(u, form.password), tr('team.added', { u }))) setForm({ username: '', password: '' });
  };

  const doReset = async (username) => {
    if (!newPw) { setMsg({ ok: false, text: tr('team.enterPw') }); return; }
    if (await run(() => resetTeamPassword(username, newPw), tr('team.resetDone', { u: username }))) { setResetFor(null); setNewPw(''); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tr('team.title')}</DialogTitle>
          <DialogDescription>{tr('team.desc')}</DialogDescription>
        </DialogHeader>

        {loading && <p className="text-center text-sm text-muted-foreground">{tr('home.loading')}</p>}
        {!loading && staff.length === 0 && <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">{tr('team.none')}</p>}

        <div className="space-y-2">
          {staff.map((s) => (
            <div key={s.username} className={cn('space-y-2 rounded-lg border p-3', !s.is_active && 'bg-muted/50 opacity-70')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">{s.username} {!s.is_active && <Badge variant="secondary">{tr('team.disabled')}</Badge>}</span>
                <span className="text-xs text-muted-foreground">{s.last_login ? tr('team.lastLogin', { t: ago(s.last_login) }) : tr('team.never')}</span>
              </div>
              {resetFor === s.username ? (
                <div className="flex flex-wrap gap-2">
                  <Input className="min-w-40 flex-1" type="password" placeholder={tr('team.newPw')} value={newPw} autoComplete="new-password"
                         onChange={(e) => setNewPw(e.target.value)} aria-label={`${tr('team.newPw')} · ${s.username}`} />
                  <Button size="sm" disabled={busy} onClick={() => doReset(s.username)}>{tr('team.save')}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setResetFor(null); setNewPw(''); }}>{tr('btn.cancel')}</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setResetFor(s.username); setNewPw(''); setMsg(null); }}>{tr('team.reset')}</Button>
                  <Button size="sm" variant="outline" disabled={busy}
                          onClick={() => run(() => setTeamActive(s.username, !s.is_active), tr(s.is_active ? 'team.disabledMsg' : 'team.enabledMsg', { u: s.username }))}>
                    {s.is_active ? tr('team.disable') : tr('team.enable')}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <Separator />
        <form onSubmit={add} className="space-y-3">
          <h3 className="text-sm font-semibold">{tr('team.add')}</h3>
          <div className="space-y-1.5"><Label htmlFor="team-u">{tr('team.username')}</Label>
            <Input id="team-u" value={form.username} autoComplete="off" onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label htmlFor="team-p">{tr('team.password')}</Label>
            <Input id="team-p" type="password" value={form.password} autoComplete="new-password" onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></div>
          {msg && <p role="alert" className={cn('rounded-lg border px-3 py-2 text-sm', msg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800')}>{msg.text}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>{tr('btn.close')}</Button>
            <Button type="submit" disabled={busy}>{busy ? tr('team.saving') : tr('team.addBtn')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
