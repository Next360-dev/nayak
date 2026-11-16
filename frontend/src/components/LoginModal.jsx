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
    <main id="login-overlay" className="shadcn-scope fixed inset-0 z-[2000] overflow-y-auto bg-background">
      <div className="grid min-h-full lg:grid-cols-[1fr_1fr]">
        {/* Brand panel (large screens): solid ink, type only */}
        <aside className="bg-primary p-14 text-primary-foreground max-lg:hidden lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <Logo className="size-10 rounded-[10px] ring-1 ring-white/25" />
            <span className="text-lg font-semibold tracking-tight">{tr('login.brand')}</span>
          </div>

          <div className="max-w-md space-y-10">
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight">{tr('login.tagline')}</h1>
              <p className="text-base leading-relaxed text-white/75">{tr('login.lead')}</p>
            </div>
            <ul className="list-none divide-y divide-white/15 border-y border-white/15 text-sm text-white/90">
              {features.map(({ text }) => (
                <li key={text} className="py-3.5 leading-snug">{text}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/60">{tr('login.footer')}</p>
        </aside>

        {/* Form side */}
        <section className="flex flex-col px-6 py-6 sm:px-12 lg:py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 lg:invisible">
              <Logo className="size-9 rounded-[9px]" />
              <span className="text-sm font-semibold tracking-wide">{tr('login.brand')}</span>
            </div>
            {onToggleLang && (
              <Button id="btn-lang-login" type="button" variant="ghost" size="sm" onClick={onToggleLang} aria-label={`${tr('btn.lang')} (Language / భాష)`}>
                <Languages /> {tr('btn.lang')}
              </Button>
            )}
          </div>

          <div className="mx-auto my-auto w-full max-w-sm py-10">
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

              <Button id="btn-login" type="submit" size="lg" className="h-11 w-full text-base" disabled={isLoading}>
                {isLoading ? <><LoaderCircle className="animate-spin" /> {tr('login.submitting')}</> : tr('login.submit')}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">{tr('login.forgot')}</p>
          </div>

          <p className="text-center text-xs text-muted-foreground lg:hidden">{tr('login.footer')}</p>
        </section>
      </div>
    </main>
  );
}
