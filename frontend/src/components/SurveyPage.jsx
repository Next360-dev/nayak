import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Languages, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useLang } from '../i18n/LangContext';
import { submitSurvey } from '../utils/api';

const ROLES = ['citizen', 'staff', 'mla', 'minister', 'other'];
const CATEGORIES = ['road', 'water', 'electricity', 'health', 'education', 'police', 'other'];
const EMPTY_FORM = { name: '', role: '', category: '', message: '', email: '' };

export default function SurveyPage({ onToggleLang }) {
  const { tr } = useLang();
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const send = async (event) => {
    event.preventDefault();
    setError('');
    setSending(true);
    try {
      await submitSurvey(form);
      setDone(true);
    } catch (err) {
      setError(err.message || tr('survey.error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="shadcn-scope min-h-screen bg-muted/40 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm"><a href="/"><ArrowLeft aria-hidden="true" />{tr('survey.back')}</a></Button>
          {onToggleLang && <Button type="button" variant="ghost" size="sm" onClick={onToggleLang}><Languages aria-hidden="true" />{tr('btn.lang')}</Button>}
        </header>

        <Card className="overflow-hidden shadow-sm">
          <div className="h-1.5 bg-primary" aria-hidden="true" />
          {done ? (
            <>
              <CardHeader className="items-center pt-9 text-center">
                <CheckCircle2 className="mb-2 size-12 text-emerald-600" aria-hidden="true" />
                <CardTitle className="text-2xl">{tr('survey.thanks')}</CardTitle>
                <CardDescription className="max-w-md text-sm leading-relaxed">{tr('survey.recorded')}</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center gap-3 pb-8">
                <Button type="button" variant="outline" onClick={() => { setForm(EMPTY_FORM); setDone(false); }}>{tr('survey.another')}</Button>
                <Button asChild><a href="/">{tr('survey.back')}</a></Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-3 px-6 pb-2 pt-7 sm:px-8 sm:pt-9">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><MapPin className="size-5" aria-hidden="true" /></div>
                <div className="space-y-1.5">
                  <CardTitle className="text-2xl tracking-tight">{tr('survey.title')}</CardTitle>
                  <CardDescription className="max-w-xl text-sm leading-relaxed">{tr('survey.subtitle')}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-8 pt-5 sm:px-8">
                <form onSubmit={send} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="survey-name">{tr('survey.name')} <span className="font-normal text-muted-foreground">{tr('survey.optional')}</span></Label>
                      <Input id="survey-name" autoComplete="name" value={form.name} onChange={update('name')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="survey-email">{tr('survey.email')} <span className="font-normal text-muted-foreground">{tr('survey.optional')}</span></Label>
                      <Input id="survey-email" type="email" autoComplete="email" value={form.email} onChange={update('email')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="survey-role">{tr('survey.role')}</Label>
                      <select id="survey-role" required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50" value={form.role} onChange={update('role')}>
                        <option value="">{tr('survey.selectRole')}</option>
                        {ROLES.map((role) => <option key={role} value={role}>{tr(`survey.role.${role}`)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="survey-category">{tr('survey.category')}</Label>
                      <select id="survey-category" required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50" value={form.category} onChange={update('category')}>
                        <option value="">{tr('survey.selectCategory')}</option>
                        {CATEGORIES.map((category) => <option key={category} value={category}>{tr(`survey.category.${category}`)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="survey-message">{tr('survey.message')}</Label>
                    <Textarea id="survey-message" required minLength={5} maxLength={4000} rows={6} value={form.message} onChange={update('message')} placeholder={tr('survey.messageHint')} />
                    <p className="text-right text-xs text-muted-foreground">{form.message.length}/4000</p>
                  </div>
                  {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
                  <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">{tr('survey.privacy')}</p>
                    <Button type="submit" size="lg" disabled={sending} className="w-full sm:w-auto">{sending ? tr('survey.sending') : tr('survey.submit')}</Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">{tr('survey.footer')}</p>
      </div>
    </main>
  );
}
