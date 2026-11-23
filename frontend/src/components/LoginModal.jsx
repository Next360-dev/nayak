import React, { useState } from 'react';
import { CircleAlert, Eye, EyeOff, Languages, LoaderCircle, Lock, TriangleAlert, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginUser } from '../utils/api';
import { useLang } from '../i18n/LangContext';
import Logo from './Logo';

/** The sign-in page: a brand panel beside a clean form (stacked on phones). */
export default function LoginModal({ isOpen, onLoginSuccess, notice, onToggleLang }) {
  const { tr } = useLang();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [errorCode, setErrorCode] = useState('');   // 'empty' | 'invalid' | 'locked' | 'network' (translated when shown)
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorCode('');
    const u = username.trim().toLowerCase();
    const p = password.trim();
    if (!u || !p) { setErrorCode('empty'); return; }

    setIsLoading(true);
    try {
      const data = await loginUser(u, p);
      if (data && data.status === 'success' && data.user) {
        setIsLoading(false);
        onLoginSuccess(data.user, data.token);
      } else {
        setIsLoading(false);
        setErrorCode('invalid');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorCode(err && err.status === 429 ? 'locked' : 'network');
    }
  };

  const features = [
    { text: tr('login.b1') },
    { text: tr('login.b2') },
    { text: tr('login.b3') },
  ];

  return (
    <main id="login-overlay" className="shadcn-scope fixed inset-0 z-[2000] overflow-y-auto bg-[#f7f8f6]">
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-10 h-1.5 bg-[linear-gradient(90deg,#ff9933_0%,#ff9933_33.333%,#fff_33.333%,#fff_66.666%,#138808_66.666%,#138808_100%)] shadow-sm" />
      <div className="grid min-h-full lg:grid-cols-[1.05fr_.95fr]">
        {/* Brand panel */}
        <aside className="relative isolate overflow-hidden bg-[#101a32] p-8 pt-12 text-white sm:p-12 sm:pt-14 lg:flex lg:flex-col lg:justify-between lg:p-14 lg:pt-16">
          <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 size-[26rem] rounded-full border border-white/10 after:absolute after:inset-8 after:rounded-full after:border after:border-[#ff9933]/25 before:absolute before:inset-16 before:rounded-full before:border before:border-[#138808]/30" />
          <div aria-hidden="true" className="absolute bottom-0 left-0 h-1 w-full bg-[linear-gradient(90deg,#ff9933_0%,#ff9933_33.333%,#fff_33.333%,#fff_66.666%,#138808_66.666%,#138808_100%)]" />
          <div className="relative flex items-center gap-3">
            <span className="relative grid size-12 place-items-center rounded-2xl bg-white shadow-[0_8px_24px_rgba(255,153,51,.22)] ring-1 ring-white/60">
              <Logo className="size-9 rounded-xl" />
            </span>
            <span>
              <span className="block text-lg font-semibold tracking-tight">{tr('login.brand')}</span>
              <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[.18em] text-white/60">{tr('login.eyebrow')}</span>
            </span>
          </div>

          <div className="relative mt-10 max-w-lg space-y-8 lg:mt-0">
            <div className="space-y-4">
              <h1 className="max-w-md text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">{tr('login.tagline')}</h1>
              <p className="max-w-md text-base leading-relaxed text-white/70">{tr('login.lead')}</p>
            </div>
            <ul className="list-none divide-y divide-white/10 border-y border-white/10 text-sm text-white/85">
              {features.map(({ text }) => (
                <li key={text} className="flex items-start gap-3 py-4 leading-snug">
                  <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-[#ff9933] shadow-[0_0_0_3px_rgba(255,153,51,.14)]" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative mt-8 text-xs text-white/55 lg:mt-0">{tr('login.footer')}</p>
        </aside>

        {/* Form side */}
        <section className="flex min-h-[70vh] flex-col bg-[radial-gradient(ellipse_at_top_right,rgba(255,153,51,.09),transparent_36%),radial-gradient(ellipse_at_bottom_left,rgba(19,136,8,.07),transparent_32%),#fbfcfa] px-6 py-6 pt-10 sm:px-12 lg:min-h-screen lg:py-8 lg:pt-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 lg:invisible">
              <Logo className="size-9 rounded-[9px] ring-1 ring-orange-200" />
              <span className="text-sm font-semibold tracking-wide">{tr('login.brand')}</span>
            </div>
            {onToggleLang && (
              <Button id="btn-lang-login" type="button" variant="ghost" size="sm" onClick={onToggleLang} aria-label={`${tr('btn.lang')} (Language / భాష)`}>
                <Languages /> {tr('btn.lang')}
              </Button>
            )}
          </div>

          <div className="mx-auto my-auto w-full max-w-sm py-10">
            <div aria-hidden="true" className="mb-7 flex items-center gap-2">
              <span className="h-1 w-10 rounded-full bg-[#ff9933]" />
              <span className="h-1 w-10 rounded-full bg-[#138808]" />
              <span className="text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500">{tr('login.eyebrow')}</span>
            </div>
            <div className="mb-8 space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">{tr('login.title')}</h2>
              <p className="text-sm text-muted-foreground">{tr('login.desc')}</p>
            </div>

            {notice === 'expired' && !errorCode && (
              <p id="login-notice-msg" role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {tr('login.expired')}
              </p>
            )}

            <form id="login-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="login-username">{tr('login.user')}</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input id="login-username" type="text" className="h-11 pl-9" autoComplete="username" autoCapitalize="none" autoCorrect="off"
                         spellCheck={false} autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">{tr('login.pass')}</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input id="login-password" type={showPassword ? 'text' : 'password'} className="h-11 pl-9 pr-11" autoComplete="current-password"
                         value={password} onChange={(e) => setPassword(e.target.value)}
                         onKeyUp={(e) => setCapsLock(!!(e.getModifierState && e.getModifierState('CapsLock')))} onBlur={() => setCapsLock(false)} />
                  <Button type="button" variant="ghost" size="icon-sm" className="absolute right-1.5 top-1/2 -translate-y-1/2"
                          onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}
                          aria-label={showPassword ? tr('login.hide') : tr('login.show')} title={showPassword ? tr('login.hide') : tr('login.show')}>
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
                {capsLock && (
                  <p role="status" className="flex items-center gap-1.5 text-xs text-amber-700">
                    <TriangleAlert className="size-3.5" aria-hidden="true" /> {tr('login.caps')}
                  </p>
                )}
              </div>

              {errorCode && (
                <p id="login-error-msg" role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {tr(`login.err.${errorCode}`)}
                </p>
              )}

              <Button id="btn-login" type="submit" size="lg" className="h-11 w-full border-0 bg-[#e87916] text-base font-semibold text-white shadow-[0_6px_16px_rgba(232,121,22,.22)] hover:bg-[#cf6410] focus-visible:ring-[#e87916]" disabled={isLoading}>
                {isLoading ? <><LoaderCircle className="animate-spin" /> {tr('login.submitting')}</> : tr('login.submit')}
              </Button>
            </form>

            <div className="mt-6 space-y-3 text-center">
              <p className="text-sm text-muted-foreground">{tr('login.forgot')}</p>
              <a href="/survey" className="inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{tr('login.publicSurvey')}</a>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground lg:hidden">{tr('login.footer')}</p>
        </section>
      </div>
    </main>
  );
}
