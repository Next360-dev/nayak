import React from 'react';
import { Siren } from 'lucide-react';

/** A calm "urgent now" strip: the top high-priority stories, one click to jump to each. No scrolling ticker. */
export default function UrgentAlertBanner({ alerts, activeConst, currentLang, onArticleClick }) {
  if (!alerts || alerts.length === 0) return null;
  const te = currentLang === 'te';
  const top = alerts[0];
  const more = alerts.length - 1;
  const title = te ? 'అత్యవసర వార్తలు' : 'Urgent now';

  return (
    <section id="urgent-alert-banner" className="shadcn-scope flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-orange-200 border-l-4 border-l-orange-600 bg-white px-3 py-2 shadow-sm sm:px-4" aria-label={title}>
      <div className="flex shrink-0 items-center gap-2 rounded-md bg-[#0b142b] px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
        <Siren className="size-4 text-orange-300" aria-hidden="true" />
        <span id="urgent-banner-title">{te ? 'తాజా అత్యవసర వార్త' : 'URGENT UPDATE'}</span>
        <span id="urgent-alert-count" className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] tabular-nums">{alerts.length}</span>
      </div>
      <button type="button" onClick={() => onArticleClick(top.id)} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-800 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-ring">
        {activeConst ? <span className="mr-2 font-semibold text-orange-700">{activeConst}</span> : null}{(top.headline || '').trim()}
      </button>
      {more > 0 && <span className="hidden shrink-0 text-xs font-medium text-slate-500 sm:inline">{te ? `మరిన్ని ${more}` : `+${more} more`}</span>}
    </section>
  );
}
