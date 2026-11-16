import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fetchShareTargets, createShare } from '../utils/api';
import { useLang } from '../i18n/LangContext';

export default function ShareModal({ article, currentUser, onClose, onShared }) {
  const { tr } = useLang();
  const isStaff = currentUser?.role === 'staff';
  const [targets, setTargets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState(new Set());
  const [note, setNote] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchShareTargets()
      .then((d) => {
        const list = d.targets || [];
        setTargets(list);
        if (list.length === 1) setPicked(new Set([list[0].username]));  // only one choice: preselect
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);

  const toggle = (u) => setPicked((prev) => {
    const next = new Set(prev);
    next.has(u) ? next.delete(u) : next.add(u);
    return next;
  });

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await createShare({
        article_id: Number(article.id) || null,
        title: article.headline,
        url: article.url || null,
        summary: article.summary || null,
        district_name: article.district_name || null,
        constituency_name: article.constituency_name || null,
        note: note.trim() || null,
        priority: urgent ? 'urgent' : 'normal',
        recipients: [...picked],
      });
      onShared(res.recipient_count);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isStaff ? tr('share.titleStaff') : tr('share.titleLeader')}</DialogTitle>
          <DialogDescription className="line-clamp-3 border-l-2 pl-3 text-foreground/80">{article.headline}</DialogDescription>
        </DialogHeader>

        <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border p-1">
          {loaded && targets.length === 0 && (
            <p className="p-3 text-center text-sm text-muted-foreground">{isStaff ? tr('share.emptyStaff') : tr('share.emptyLeader')}</p>
          )}
          {targets.map((t) => (
            <Label key={t.username} className="flex cursor-pointer items-center gap-3 rounded-md p-2.5 hover:bg-accent/60">
              <Checkbox checked={picked.has(t.username)} onCheckedChange={() => toggle(t.username)} />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t.politician_name || t.username}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {[t.constituency_name, t.district_name].filter(Boolean).join(' · ') || t.role}
                </span>
              </span>
            </Label>
          ))}
        </div>

        <Textarea rows={2} maxLength={2000} placeholder={tr('share.notePh')} value={note} onChange={(e) => setNote(e.target.value)} />
        <Label className="cursor-pointer gap-2.5 font-normal">
          <Checkbox checked={urgent} onCheckedChange={(v) => setUrgent(v === true)} /> {tr('share.urgent')}
        </Label>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tr('btn.cancel')}</Button>
          <Button disabled={busy || picked.size === 0} onClick={submit}>{busy ? tr('btn.sending') : tr('btn.send')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
