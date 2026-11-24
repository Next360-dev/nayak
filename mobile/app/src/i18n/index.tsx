import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SecureStore } from '../lib/storage';
import { WEB_STRINGS } from './strings.generated';
import { MOBILE_STRINGS } from './mobile-strings';

export type Lang = 'en' | 'te';
const KEY = 'aso_lang';

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, vars?: Record<string, string | number>) => string };
const LangContext = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (k) => k });

// Lookup order: phone-only strings, then the web strings, then English, then the key itself (so a gap is visible, not blank).
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = MOBILE_STRINGS[lang][key] ?? WEB_STRINGS[lang][key] ?? MOBILE_STRINGS.en[key] ?? WEB_STRINGS.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((v) => { if (v === 'te' || v === 'en') setLangState(v); }).catch(() => {});
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    SecureStore.setItemAsync(KEY, l).catch(() => {});
  }, []);
  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
