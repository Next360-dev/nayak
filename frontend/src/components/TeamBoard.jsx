import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { addTaskNote, createTask, fetchBoard, fetchTaskNotes, updateTask } from '../utils/api';
import { useLang, useTimeAgo } from '../i18n/LangContext';

const COLS = ['todo', 'doing', 'done'];
const SELECT = 'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-ring';

function Notes({ task, onCount }) {
  const { tr } = useLang();
  const ago = useTimeAgo();
  const [notes, setNotes] = useState(null);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { fetchTaskNotes(task.id).then((r) => setNotes(r.notes)).catch((e) => setErr(e.message)); }, [task.id]);
  const send = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    try { const r = await addTaskNote(task.id, draft.trim()); setNotes((n) => [...(n || []), r.note]); setDraft(''); setErr(''); onCount(); }
    catch (x) { setErr(x.message); }
  };
  return (
    <div className="mt-2 space-y-2 border-t pt-2">
      {notes === null && !err && <p className="text-xs text-muted-foreground">{tr('home.loading')}</p>}
      {(notes || []).map((n) => (
        <p key={n.id} className="text-sm leading-snug"><span className="font-medium">{n.author}</span> <span className="text-xs text-muted-foreground">{ago(n.created_at)}</span><br />{n.body}</p>
      ))}
      <form onSubmit={send} className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={tr('board.note.ph')} aria-label={tr('board.note.ph')} maxLength={1000} />
        <Button type="submit" size="sm" disabled={!draft.trim()}>{tr('board.note.send')}</Button>
      </form>
      {err && <p role="alert" className="text-xs text-red-700">{err}</p>}
    </div>
  );
}

function TaskCard({ task, members, canManage, onPatch, onReload }) {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);
  const overdue = task.status !== 'done' && task.due_date && task.due_date < new Date().toISOString().slice(0, 10);
  const move = (status, label, variant = 'outline') => canManage && <Button type="button" size="sm" variant={variant} onClick={() => onPatch(task.id, { status })}>{label}</Button>;
  return (
    <li className="rounded-lg border bg-card p-3 text-sm shadow-xs" data-task-id={task.id}>
      <p className="font-medium leading-snug">{task.url ? <a href={task.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{task.title}</a> : task.title}</p>
      {task.note && <p className="mt-1 text-xs text-muted-foreground">{task.note}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>{tr('board.by', { u: task.created_by })}</span>
        {task.due_date && <Badge variant={overdue ? 'destructive' : 'outline'}>{overdue ? tr('board.overdue') : tr('board.due', { d: task.due_date })}</Badge>}
      </div>
      {canManage ? (
        <select className={cn(SELECT, 'mt-2')} value={task.assigned_to || ''} aria-label={tr('board.f.who')} onChange={(e) => onPatch(task.id, { assigned_to: e.target.value })}>
          <option value="">{tr('board.nobody')}</option>
          {members.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      ) : <p className="mt-2 text-xs">{task.assigned_to || tr('board.nobody')}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {task.status === 'todo' && <>{move('doing', tr('board.start'))}{move('done', tr('board.finish'), 'default')}</>}
        {task.status === 'doing' && <>{move('todo', tr('board.back'))}{move('done', tr('board.finish'), 'default')}</>}
        {task.status === 'done' && move('todo', tr('board.reopen'))}
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}><MessageSquare /> {tr('board.notes', { n: task.notes })}</Button>
      </div>
      {open && <Notes task={task} onCount={onReload} />}
    </li>
  );
}

/** The team's task board. Staff add and move tasks; the leader can read it and write notes. */
export default function TeamBoard({ onClose, prefill }) {
  const { tr } = useLang();
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: prefill?.title || '', url: prefill?.url || '', note: '', assigned_to: '', due_date: '' });

  const load = useCallback(async () => {
    try { setData(await fetchBoard()); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = async (id, body) => {
    setMsg(null);
    try { await updateTask(id, body); await load(); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const add = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setMsg({ ok: false, text: tr('board.enterTitle') }); return; }
    setBusy(true); setMsg(null);
    try {
      await createTask({ title: form.title.trim(), url: form.url || null, note: form.note.trim() || null, assigned_to: form.assigned_to || null, due_date: form.due_date || null });
      setForm({ title: '', url: '', note: '', assigned_to: '', due_date: '' });
      setMsg({ ok: true, text: tr('board.added') }); await load();
    } catch (x) { setMsg({ ok: false, text: x.message }); }
    finally { setBusy(false); }
  };

  const tasks = data?.tasks || [];
  const canManage = !!data?.can_manage;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{tr('board.title')}</DialogTitle>
          <DialogDescription>{canManage ? tr('board.descStaff') : tr('board.descLeader')}</DialogDescription>
        </DialogHeader>

        {canManage && (
          <form onSubmit={add} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5"><Label htmlFor="task-title">{tr('board.f.title')}</Label>
              <Input id="task-title" value={form.title} maxLength={300} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="task-who">{tr('board.f.who')}</Label>
              <select id="task-who" className={SELECT} value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">{tr('board.nobody')}</option>
                {(data?.members || []).map((m) => <option key={m} value={m}>{m}</option>)}
              </select></div>
            <div className="space-y-1.5"><Label htmlFor="task-due">{tr('board.f.due')}</Label>
              <Input id="task-due" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <Button type="submit" disabled={busy}><Plus /> {tr('board.add')}</Button>
            <div className="space-y-1.5 sm:col-span-4"><Label htmlFor="task-note">{tr('board.f.note')}</Label>
              <Input id="task-note" value={form.note} maxLength={1000} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          </form>
        )}

        {msg && <p role="alert" className={cn('rounded-lg border px-3 py-2 text-sm', msg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800')}>{msg.text}</p>}
        {!data && !msg && <p className="text-center text-sm text-muted-foreground">{tr('home.loading')}</p>}

        {data && (
          <div className="grid gap-4 md:grid-cols-3">
            {COLS.map((c) => {
              const list = tasks.filter((t) => t.status === c);
              return (
                <section key={c} aria-label={tr(`board.col.${c}`)} className="space-y-2">
                  <h3 className="text-sm font-semibold">{tr(`board.col.${c}`)} <span className="text-muted-foreground">({list.length})</span></h3>
                  {list.length === 0 ? <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{tr('board.empty')}</p>
                    : <ul className="list-none space-y-2">{list.map((t) => <TaskCard key={t.id} task={t} members={data.members} canManage={canManage} onPatch={patch} onReload={load} />)}</ul>}
                </section>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
