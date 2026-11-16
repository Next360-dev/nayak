import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { sendAppFeedback } from '../utils/api';
import { useLang } from '../i18n/LangContext';

/** Free-text feedback about the app, read by the admin. */
export default function FeedbackDialog({ onClose }) {
  const { tr } = useLang();
  const [text, setText] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true); setMsg(null);
    try { await sendAppFeedback(text.trim()); setMsg({ ok: true, text: tr('fb.thanks') }); setText(''); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tr('fb.title')}</DialogTitle>
          <DialogDescription>{tr('fb.desc')}</DialogDescription>
        </DialogHeader>
        <Textarea rows={5} maxLength={2000} placeholder={tr('fb.ph')} value={text} onChange={(e) => setText(e.target.value)} aria-label={tr('fb.title')} />
        {msg && <p role="alert" className={cn('rounded-lg border px-3 py-2 text-sm', msg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800')}>{msg.text}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tr('btn.close')}</Button>
          <Button onClick={send} disabled={busy || text.trim().length < 3}>{tr('btn.send')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
