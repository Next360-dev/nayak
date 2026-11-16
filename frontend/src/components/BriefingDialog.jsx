import React, { useEffect, useState } from 'react';
import { Copy, Mail, MessageCircle, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { emailBriefing, fetchBriefing, fetchTeamBriefing, resetTeamBriefing, saveTeamBriefing } from '../utils/api';
import { useLang } from '../i18n/LangContext';

/**
 * Today's briefing as plain text, ready to paste into WhatsApp.
 * Leaders read it. Staff EDIT the leader's version (it goes out in the morning) and can reset it to the automatic text.
 */
export default function BriefingDialog({ onClose, role }) {
  const { tr, lang } = useLang();
  const isStaff = role === 'staff';
  const [text, setText] = useState('');
  const [leader, setLeader] = useState('');
  const [editedBy, setEditedBy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const apply = (b) => { setText(b.text); setEditedBy(b.edited_by || null); if (b.leader) setLeader(b.leader); };
  useEffect(() => {
    setMsg(null);
    (isStaff ? fetchTeamBriefing(lang) : fetchBriefing(lang)).then(apply).catch((e) => setMsg({ ok: false, text: e.message }));
  }, [lang, isStaff]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setMsg({ ok: false, text: 'Copy failed: select the text and copy it by hand.' }); }
  };
  const email = async () => {
    setMsg(null);
    try { const r = await emailBriefing(lang); setMsg({ ok: true, text: tr('brief.emailed', { to: r.sent_to }) }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const save = async () => {
    setBusy(true); setMsg(null);
    try { await saveTeamBriefing(lang, text); apply(await fetchTeamBriefing(lang)); setMsg({ ok: true, text: tr('brief.edit.saved') }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    setBusy(true); setMsg(null);
    try { await resetTeamBriefing(lang); apply(await fetchTeamBriefing(lang)); setMsg({ ok: true, text: tr('brief.edit.resetDone') }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tr('brief.title')}</DialogTitle>
          <DialogDescription>{isStaff ? tr('brief.edit.hint', { leader: leader || '…' }) : tr('brief.desc')}</DialogDescription>
        </DialogHeader>
        {!text && !msg && <p className="text-sm text-muted-foreground">{tr('home.loading')}</p>}
        {editedBy && <p className="text-xs text-muted-foreground" id="briefing-edited-note">{isStaff ? tr('brief.edit.by', { u: editedBy }) : tr('brief.edited.leader', { u: editedBy })}</p>}
        {text && (isStaff
          ? <Textarea id="briefing-text" value={text} onChange={(e) => setText(e.target.value)} rows={14} aria-label={tr('brief.edit.label')} className="max-h-[50vh] font-sans text-sm leading-relaxed" maxLength={4000} />
          : <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 font-sans text-sm leading-relaxed">{text}</pre>)}
        {msg && <p role="alert" className={cn('rounded-lg border px-3 py-2 text-sm', msg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800')}>{msg.text}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {isStaff && <Button variant="outline" onClick={reset} disabled={busy || !editedBy}><RotateCcw /> {tr('brief.edit.reset')}</Button>}
          <Button variant="outline" disabled={!text} asChild={!!text}>
            {text ? <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle /> {tr('brief.whatsapp')}</a> : <span><MessageCircle /> {tr('brief.whatsapp')}</span>}
          </Button>
          {!isStaff && <Button variant="outline" onClick={email} disabled={!text}><Mail /> {tr('brief.email')}</Button>}
          <Button variant={isStaff ? 'outline' : 'default'} onClick={copy} disabled={!text}><Copy /> {copied ? tr('brief.copied') : tr('brief.copy')}</Button>
          {isStaff && <Button onClick={save} disabled={busy || !text}><Save /> {tr('brief.edit.save')}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
