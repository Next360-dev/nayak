import React from 'react';
import { Siren } from 'lucide-react';

/** A calm "urgent now" strip: the top high-priority stories, one click to jump to each. No scrolling ticker. */
export default function UrgentAlertBanner({ alerts, activeConst, currentLang, onArticleClick }) {
  if (!alerts || alerts.length === 0) return null;
  const te = currentLang === 'te';
  const top = alerts.slice(0, 3);
  const more = alerts.length - top.length;
  const title = te ? 'అత్యవసర వార్తలు' : 'Urgent now';

  return (
    <section id="urgent-alert-banner" className="shadcn-scope overflow-hidden rounded-lg border bg-card" aria-label={title}>
      <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold text-attention">
        <Siren className="size-4" aria-hidden="true" />
        <span id="urgent-banner-title">{title}{activeConst ? ` · ${activeConst}` : ''}</span>
        <span id="urgent-alert-count" className="ml-1 rounded bg-amber-100 px-1.5 text-xs tabular-nums text-amber-900">{alerts.length}</span>
      </div>
      <ul className="list-none divide-y" id="urgent-alert-track">
        {top.map((art, i) => {
          const place = art.constituency_name || art.district_name || (te ? 'రాష్ట్రం' : 'Telangana');
          return (
            <li key={art.id} className={i > 0 ? 'max-sm:hidden' : undefined}>
              <button type="button" onClick={() => onArticleClick(art.id)}
                      className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-left text-sm text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring">
                <span className="text-xs font-medium text-muted-foreground">{place}</span>
                <span className="min-w-0 flex-1 font-medium leading-snug">{(art.headline || '').trim()}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {alerts.length > 1 && (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          <span className="max-sm:hidden">{more > 0 ? (te ? `మరో ${more} అత్యవసర వార్తలు ఫీడ్‌లో ఉన్నాయి` : `${more} more urgent in the feed below`) : null}</span>
          <span className="sm:hidden">{te ? `మరో ${alerts.length - 1} అత్యవసర వార్తలు ఫీడ్‌లో ఉన్నాయి` : `${alerts.length - 1} more urgent in the feed below`}</span>
        </p>
      )}
    </section>
  );
}
