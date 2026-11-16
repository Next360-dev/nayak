import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { changeMyPassword, fetchProfile, saveProfile, sendTestEmail } from '../utils/api';
import { useLang } from '../i18n/LangContext';
import * as browserAlerts from '../lib/browserAlerts';

const NATIVE_SELECT = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function Notice({ msg }) {
  if (!msg) return null;
  return <p role="alert" className={cn('rounded-lg border px-3 py-2 text-sm', msg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800')}>{msg.text}</p>;
}

function ContactTab() {
  const { tr } = useLang();
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [browserOn, setBrowserOn] = useState(browserAlerts.enabled());

  useEffect(() => { fetchProfile().then(setP).catch((e) => setMsg({ ok: false, text: e.message })); }, []);
  if (!p) return <p className="text-sm text-muted-foreground">{msg ? <Notice msg={msg} /> : tr('home.loading')}</p>;

  const set = (k) => (e) => setP((prev) => ({ ...prev, [k]: e.target.value }));
  const save = async () => {
    setBusy(true); setMsg(null);
    try { setP({ ...p, ...(await saveProfile({ email: p.email || '', phone: p.phone || '', alerts_enabled: p.alerts_enabled, lang: p.lang })) }); setMsg({ ok: true, text: tr('acct.saved') }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };
  const test = async () => {
    setBusy(true); setMsg(null);
    try { const r = await sendTestEmail(); setMsg({ ok: true, text: tr('acct.testSent', { to: r.sent_to }) }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };
  const toggleBrowser = async () => {
    if (browserOn) { browserAlerts.turnOff(); setBrowserOn(false); return; }
    const res = await browserAlerts.turnOn();
    if (res === 'granted') setBrowserOn(true);
    else setMsg({ ok: false, text: tr('acct.browserBlocked') });
  };

  return (
    <div className="space-y-4">
      {!p.email_configured && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{tr('acct.noServer')}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="ac-email">{tr('acct.email')}</Label>
          <Input id="ac-email" type="email" autoComplete="email" value={p.email || ''} onChange={set('email')} /></div>
        <div className="space-y-1.5"><Label htmlFor="ac-phone">{tr('acct.phone')}</Label>
          <Input id="ac-phone" type="tel" autoComplete="tel" value={p.phone || ''} onChange={set('phone')} /></div>
      </div>
      <Label className="cursor-pointer gap-2.5 font-normal">
        <Checkbox checked={p.alerts_enabled} onCheckedChange={(v) => setP((prev) => ({ ...prev, alerts_enabled: v === true }))} /> {tr('acct.alerts')}
      </Label>
      <div className="space-y-1.5"><Label htmlFor="ac-lang">{tr('acct.lang')}</Label>
        <select id="ac-lang" className={NATIVE_SELECT} value={p.lang} onChange={set('lang')}><option value="en">English</option><option value="te">తెలుగు</option></select></div>
      {browserAlerts.supported() && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span>{tr('acct.browser')}</span>
          <Button size="sm" variant={browserOn ? 'secondary' : 'outline'} onClick={toggleBrowser}>{browserOn ? tr('acct.browserOn') : tr('acct.browserOff')}</Button>
        </div>
      )}
      <Notice msg={msg} />
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="outline" disabled={busy || !p.email || !p.email_configured} onClick={test}>{tr('acct.testEmail')}</Button>
        <Button type="button" disabled={busy} onClick={save}>{tr('acct.save')}</Button>
      </div>
    </div>
  );
}

function PasswordTab({ onChanged }) {
  const { tr } = useLang();
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (f.next !== f.again) { setMsg({ ok: false, text: tr('pw.mismatch') }); return; }
    setBusy(true);
    try {
      const res = await changeMyPassword(f.current, f.next);
      onChanged(res.token);
      setMsg({ ok: true, text: tr('pw.done') });
      setF({ current: '', next: '', again: '' });
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <p className="text-sm text-muted-foreground">{tr('pw.desc')}</p>
      <div className="space-y-1.5"><Label htmlFor="pw-cur">{tr('pw.current')}</Label>
        <Input id="pw-cur" type="password" required autoComplete="current-password" value={f.current} onChange={set('current')} /></div>
      <div className="space-y-1.5"><Label htmlFor="pw-new">{tr('pw.new')}</Label>
        <Input id="pw-new" type="password" required autoComplete="new-password" value={f.next} onChange={set('next')} /></div>
      <div className="space-y-1.5"><Label htmlFor="pw-again">{tr('pw.confirm')}</Label>
        <Input id="pw-again" type="password" required autoComplete="new-password" value={f.again} onChange={set('again')} /></div>
      <Notice msg={msg} />
      <div className="flex justify-end"><Button type="submit" disabled={busy || !f.current || !f.next}>{busy ? tr('pw.saving') : tr('pw.save')}</Button></div>
    </form>
  );
}

/** My account: contact details + alert switches, and my own password. */
export default function AccountDialog({ onClose, onPasswordChanged }) {
  const { tr } = useLang();
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tr('acct.title')}</DialogTitle>
          <DialogDescription>{tr('acct.desc')}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="contact">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contact">{tr('acct.tabContact')}</TabsTrigger>
            <TabsTrigger value="password">{tr('acct.tabPassword')}</TabsTrigger>
          </TabsList>
          <TabsContent value="contact" className="mt-4"><ContactTab /></TabsContent>
          <TabsContent value="password" className="mt-4"><PasswordTab onChanged={onPasswordChanged} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
