import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { STRINGS } from './strings';

const LangContext = createContext({ lang: 'en', tr: (k) => k });

/** Provides `tr(key, vars)` for the current language ('en' | 'te'). Falls back to English, then to the key. */
export function LangProvider({ lang, children }) {
  const tr = useCallback((key, vars) => {
    let s = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }, [lang]);
  const value = useMemo(() => ({ lang, tr }), [lang, tr]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** Relative time ("5 min ago") in the current language. */
export function useTimeAgo() {
  const { tr } = useLang();
  return useCallback((iso) => {
    if (!iso) return null;
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return tr('time.now');
    if (mins < 60) return tr('time.min', { n: mins });
    const h = Math.round(mins / 60);
    if (h < 48) return tr('time.h', { n: h });
    return tr('time.d', { n: Math.round(h / 24) });
  }, [tr]);
}

export function useTimeUntil() {
  const { tr } = useLang();
  return useCallback((iso) => {
    if (!iso) return null;
    const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
    if (mins <= 0) return tr('time.due');
    if (mins < 60) return tr('time.inMin', { n: mins });
    return tr('time.inH', { n: Math.round(mins / 60) });
  }, [tr]);
}
