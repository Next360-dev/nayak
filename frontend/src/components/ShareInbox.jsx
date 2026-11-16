import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { fetchInbox, fetchSent, updateShareStatus, fetchReplies, postReply } from '../utils/api';
import { useLang, useTimeAgo } from '../i18n/LangContext';
import { StatusBadge } from './home/shared';

const NEXT = { new: 'seen', seen: 'acting', acting: 'done' };

function Thread({ shareId, recipient, onChange, readOnly = false }) {
  const { tr } = useLang();
  const ago = useTimeAgo();
  const [replies, setReplies] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetchReplies(shareId, recipient).then((d) => setReplies(d.replies || [])).catch((e) => setError(e.message));
  }, [shareId, recipient]);
  useEffect(load, [load]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await postReply(shareId, text.trim(), recipient);
      setText('');
      load();
      onChange && onChange();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-2 rounded-lg bg-muted/50 p-3">
      {replies.map((r) => (
        <div key={r.id} className="text-sm">
          <span className="font-medium">{r.author}</span> <span className="text-xs text-muted-foreground">{ago(r.created_at)}</span>
          <p className="whitespace-pre-wrap">{r.body}</p>
        </div>
      ))}
      {replies.length === 0 && readOnly && <p className="text-xs text-muted-foreground">{tr('inbox.noReplies')}</p>}
      {!readOnly && (
        <form onSubmit={send} className="flex gap-2">
          <Input value={text} maxLength={2000} placeholder={tr('inbox.replyPh')} onChange={(e) => setText(e.target.value)} aria-label={tr('inbox.replyPh')} />
          <Button type="submit" size="sm" disabled={!text.trim()}>{tr('inbox.reply')}</Button>
        </form>
      )}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

function Card({ s, mode, onRefresh, readOnly = false }) {
  const { tr } = useLang();
  const ago = useTimeAgo();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const advance = async () => {
    try { await updateShareStatus(s.id, NEXT[s.status]); onRefresh(); } catch (e) { setError(e.message); }
  };
  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && mode === 'inbox' && s.status === 'new') {
      try { await updateShareStatus(s.id, 'seen'); onRefresh(); } catch { /* shown on next refresh */ }
    }
  };
  const recips = (s.recipients || []).map((r) => r.recipient).join(', ');
  const meta = mode === 'inbox' ? tr('inbox.from', { sender: s.sender })
    : readOnly ? `${s.sender} → ${recips}` : tr('inbox.to', { x: recips });

  return (
    <div className={cn('rounded-xl border bg-card', s.priority === 'urgent' && 'border-red-200', s.status === 'done' && mode === 'inbox' && 'opacity-70')}>
      <button type="button" onClick={toggle} aria-expanded={open}
              className="flex w-full items-start justify-between gap-3 rounded-xl p-3 text-left focus-visible:outline-2 focus-visible:outline-ring">
        <span className="min-w-0">
          <span className="block text-sm font-medium leading-snug">
            {s.priority === 'urgent' && <Badge variant="destructive" className="mr-2">{tr('pri.urgent')}</Badge>}
            {mode === 'inbox' && s.status === 'new' && <span className="mr-1.5 inline-block size-2 rounded-full bg-amber-500" aria-label={tr('st.new')} />}
            {s.title}
          </span>
          <span className="block text-xs text-muted-foreground">{meta} · {ago(s.created_at)}</span>
        </span>
        <ChevronDown className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className="space-y-3 border-t p-3">
          {s.note && <p className="border-l-2 pl-3 text-sm italic">“{s.note}”</p>}
          {s.summary && <p className="text-sm text-muted-foreground">{s.summary}</p>}
          {s.url && (
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-sky-700 underline-offset-4 hover:underline">
              {tr('inbox.openSource')} <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}

          {mode === 'inbox' ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">{tr('inbox.status')}</span> <StatusBadge status={s.status} />
                {NEXT[s.status] && <Button variant="outline" size="sm" onClick={advance}>{tr('inbox.mark', { status: tr(`st.${NEXT[s.status]}`) })}</Button>}
              </div>
              <Thread shareId={s.id} onChange={onRefresh} />
            </>
          ) : (
            (s.recipients || []).map((r) => (
              <div key={r.recipient} className="space-y-2">
                <div className="flex items-center gap-2 text-sm"><span className="font-medium">{r.recipient}</span> <StatusBadge status={r.status} /></div>
                <Thread shareId={s.id} recipient={r.recipient} readOnly={readOnly} />
              </div>
            ))
          )}
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function ShareInbox({ currentUser, onClose, onChanged }) {
  const { tr } = useLang();
  const isAdmin = currentUser?.role === 'admin';   // the master admin only watches: every share, read-only
  const [tab, setTab] = useState(isAdmin ? 'sent' : 'inbox');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    (tab === 'inbox' ? fetchInbox() : fetchSent())
      .then((d) => { setItems(d.shares || []); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    onChanged && onChanged();
  }, [tab, onChanged]);

  // Clear the old tab's items first: an inbox item has no `recipients`, so rendering it as a Sent card would crash.
  useEffect(() => { setItems([]); setLoading(true); refresh(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = isAdmin ? tr('inbox.titleAdmin') : tr('inbox.title');
  const emptyText = isAdmin ? tr('inbox.emptyAdmin') : tab === 'inbox' ? tr('inbox.emptyInbox') : tr('inbox.emptySent');

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="sr-only">{title}</SheetDescription>
        </SheetHeader>
        {!isAdmin && (
          <Tabs value={tab} onValueChange={setTab} className="border-b p-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="inbox">{tr('inbox.tabInbox')}</TabsTrigger>
              <TabsTrigger value="sent">{tr('inbox.tabSent')}</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading && <p className="text-center text-sm text-muted-foreground">{tr('home.loading')}</p>}
          {!loading && !error && items.length === 0 && <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          {items.map((s) => <Card key={`${tab}-${s.id}`} s={s} mode={tab} onRefresh={refresh} readOnly={isAdmin} />)}
        </div>
      </SheetContent>
    </Sheet>
  );
}
