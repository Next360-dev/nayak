import React, { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { createUser, resetPassword, fetchAllUsers, setUserActive, importContacts } from '../utils/api';
import { useLang, useTimeAgo } from '../i18n/LangContext';

const EMPTY = { username: '', password: '', role: 'mla', politician_name: '', constituency_name: '', district_name: '', mla_username: '' };
const NATIVE_SELECT = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function Notice({ msg }) {
  if (!msg) return null;
  return <p role="alert" className={cn('rounded-lg border px-3 py-2 text-sm', msg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800')}>{msg.text}</p>;
}

function UsersList() {
  const { tr } = useLang();
  const ago = useTimeAgo();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [resetFor, setResetFor] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers((await fetchAllUsers()).users || []); }
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

  const shown = users.filter((u) =>
    `${u.username} ${u.role} ${u.politician_name || ''} ${u.constituency_name || ''} ${u.works_for || ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-3">
      <Input placeholder="Search by name, role, constituency…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
      <Notice msg={msg} />
      {loading && <p className="text-center text-sm text-muted-foreground">{tr('home.loading')}</p>}
      {!loading && shown.length === 0 && <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">No users match.</p>}
      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {shown.map((u) => {
          const place = [u.constituency_name, u.district_name].filter((x) => x && x !== 'All').join(' · ');
          return (
            <div key={u.username} className={cn('space-y-2 rounded-lg border p-3', !u.is_active && 'bg-muted/50 opacity-70')}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {u.username} <Badge variant="secondary">{u.role}</Badge>
                    {!u.is_active && <Badge variant="outline">{tr('team.disabled')}</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {u.role === 'staff' ? `works for ${u.works_for || '?'}` : (u.politician_name && u.politician_name !== u.username ? u.politician_name : '')}{place ? ` · ${place}` : ''}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{u.last_login ? tr('team.lastLogin', { t: ago(u.last_login) }) : <span className="font-medium text-red-600">{tr('common.neverLoggedIn')}</span>}</span>
              </div>
              {resetFor === u.username ? (
                <div className="flex flex-wrap gap-2">
                  <Input className="min-w-40 flex-1" type="password" placeholder={tr('team.newPw')} value={newPw} autoComplete="new-password"
                         onChange={(e) => setNewPw(e.target.value)} aria-label={`${tr('team.newPw')} · ${u.username}`} />
                  <Button size="sm" disabled={busy || !newPw}
                          onClick={async () => { if (await run(() => resetPassword(u.username, newPw), tr('team.resetDone', { u: u.username }))) { setResetFor(null); setNewPw(''); } }}>{tr('team.save')}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setResetFor(null); setNewPw(''); }}>{tr('btn.cancel')}</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setResetFor(u.username); setNewPw(''); setMsg(null); }}>{tr('team.reset')}</Button>
                  {u.role !== 'admin' && (
                    <Button size="sm" variant="outline" disabled={busy}
                            onClick={() => run(() => setUserActive(u.username, !u.is_active), tr(u.is_active ? 'team.disabledMsg' : 'team.enabledMsg', { u: u.username }))}>
                      {u.is_active ? tr('team.disable') : tr('team.enable')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CreateUser({ onCreated }) {
  const { tr } = useLang();
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));
  const isStaff = f.role === 'staff';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const body = { ...f, username: f.username.trim().toLowerCase(), mla_username: isStaff ? f.mla_username.trim().toLowerCase() : null };
      const res = await createUser(body);
      setMsg({ ok: true, text: `Created ${res.user.username} (${res.user.role}).` });
      setF(EMPTY);
      onCreated && onCreated();
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5"><Label htmlFor="cu-role">Role</Label>
        <select id="cu-role" className={NATIVE_SELECT} value={f.role} onChange={set('role')}>
          <option value="mla">MLA</option><option value="minister">Minister</option><option value="staff">Staff (works for an MLA or minister)</option><option value="admin">Admin</option>
        </select></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="cu-u">{tr('team.username')}</Label><Input id="cu-u" required value={f.username} onChange={set('username')} autoComplete="off" /></div>
        <div className="space-y-1.5"><Label htmlFor="cu-p">{tr('team.password')}</Label><Input id="cu-p" type="password" required value={f.password} onChange={set('password')} autoComplete="new-password" /></div>
      </div>
      {isStaff ? (
        <div className="space-y-1.5"><Label htmlFor="cu-boss">Works for (MLA or minister username)</Label><Input id="cu-boss" required value={f.mla_username} onChange={set('mla_username')} /></div>
      ) : (
        <>
          <div className="space-y-1.5"><Label htmlFor="cu-name">Full name</Label><Input id="cu-name" value={f.politician_name} onChange={set('politician_name')} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="cu-c">Constituency</Label><Input id="cu-c" value={f.constituency_name} onChange={set('constituency_name')} /></div>
            <div className="space-y-1.5"><Label htmlFor="cu-d">District</Label><Input id="cu-d" value={f.district_name} onChange={set('district_name')} /></div>
          </div>
        </>
      )}
      <Notice msg={msg} />
      <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? tr('team.saving') : 'Create user'}</Button></div>
    </form>
  );
}

const CSV_HELP = 'constituency,name,phone,email,party,role_type,district';
const downloadTemplate = () => {
  const blob = new Blob(['\ufeff' + CSV_HELP + '\n'], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'contacts-template.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

function ImportContacts() {
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name); setResult(null); setMsg(null);
    setCsv(await f.text());
  };
  const run = async (dry) => {
    setBusy(true); setMsg(null);
    try {
      const r = await importContacts(csv, dry);
      setResult(r);
      if (!dry) setMsg({ ok: true, text: `Done: ${r.updated} updated, ${r.added} added, ${r.errors.length} skipped.` });
    } catch (e) { setMsg({ ok: false, text: e.message }); setResult(null); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Upload a CSV with real phone numbers and emails for MLAs, and rows for the CM and ministers. First row (header):{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">{CSV_HELP}</code>. An MLA row needs the constituency plus a phone or email.
        A row with <code className="rounded bg-muted px-1 py-0.5 text-xs">role_type</code> such as CM or Minister adds that person. Blank cells stay blank.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="file" accept=".csv,text/csv" onChange={onFile} aria-label="CSV file" className="min-w-48 flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>Download template</Button>
      </div>
      <Notice msg={msg} />
      {result && (
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <p className="font-medium">{result.dry_run ? 'Preview (nothing saved yet)' : 'Saved'}: {result.will_update} to update, {result.will_add} to add, {result.errors.length} problems{result.skipped_blank ? `, ${result.skipped_blank} rows skipped (no phone or email)` : ''}.</p>
          {result.errors.slice(0, 8).map((e) => <p key={e.row} className="text-red-700">Row {e.row}: {e.error}</p>)}
          {result.warnings.slice(0, 5).map((w) => <p key={w.row} className="text-amber-700">Row {w.row}: {w.warning}</p>)}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={!csv || busy} onClick={() => run(true)}>Preview</Button>
        <Button disabled={!csv || busy || !result?.dry_run || (result.will_update + result.will_add === 0)} onClick={() => run(false)}>Apply</Button>
      </div>
      {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
    </div>
  );
}

export default function AdminUsersModal({ onClose }) {
  const { tr } = useLang();
  const [tab, setTab] = useState('all');
  const [version, setVersion] = useState(0);   // reloads the list after a user is created
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tr('btn.users')}</DialogTitle>
          <DialogDescription>Create accounts, reset passwords and switch logins on or off.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All users</TabsTrigger>
            <TabsTrigger value="create">Create user</TabsTrigger>
            <TabsTrigger value="contacts">Import contacts</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-3"><UsersList key={version} /></TabsContent>
          <TabsContent value="create" className="mt-3"><CreateUser onCreated={() => setVersion((v) => v + 1)} /></TabsContent>
          <TabsContent value="contacts" className="mt-3"><ImportContacts /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
