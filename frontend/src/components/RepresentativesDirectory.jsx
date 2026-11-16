import React from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/** The leader profile(s) for the current selection. Missing contact data stays "Not available" (never invented). */
export default function RepresentativesDirectory({ reps, isLoading, error, onRetry, currentLang, t }) {
  const te = currentLang === 'te';
  const list = reps || [];
  const na = te ? 'అందుబాటులో లేదు' : 'Not available';
  const count = `${list.length} ${list.length === 1 ? (te ? 'నియోజకవర్గం' : 'representative') : (te ? 'నియోజకవర్గాలు' : 'representatives')}`;

  return (
    <section className="shadcn-scope space-y-3" aria-labelledby="reps-section-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-base font-semibold tracking-tight" id="reps-section-title">{t.repsTitle || 'Constituency representative'}</h2>
        <span className="text-sm text-muted-foreground" id="rep-count-badge">{count}</span>
      </div>

      <div className="grid gap-3 xl:grid-cols-1 sm:grid-cols-2" id="reps-grid-container">
        {isLoading && <p className="text-sm text-muted-foreground">{te ? 'లోడ్ అవుతోంది…' : 'Loading…'}</p>}
        {!isLoading && error && (
          <p role="alert" className="flex items-center gap-3 text-sm text-red-800">
            {te ? 'ప్రజాప్రతినిధులను లోడ్ చేయలేకపోయాం.' : "Couldn't load representatives."}
            {onRetry && <Button type="button" size="sm" variant="outline" onClick={onRetry}>{te ? 'మళ్లీ ప్రయత్నించు' : 'Retry'}</Button>}
          </p>
        )}
        {!isLoading && !error && list.length === 0 && (
          <p className="text-sm text-muted-foreground">{te ? 'ప్రస్తుత ఎంపికకు ప్రజాప్రతినిధులు లేరు.' : 'No representative matches the current selection.'}</p>
        )}
        {!isLoading && list.map((r, idx) => (
          <article key={r.id || `${r.name}-${idx}`} className="rep-card space-y-3 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground" aria-hidden="true">{r.name ? r.name.charAt(0) : '?'}</span>
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold leading-tight">{r.name}</h3>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {r.party && <Badge variant="secondary">{r.party}</Badge>}
                  {r.role_type && <span>{r.role_type}</span>}
                </p>
              </div>
            </div>
            <dl className="grid gap-1.5 text-sm">
              <div className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><dt className="sr-only">{te ? 'నియోజకవర్గం' : 'Constituency'}</dt><dd>{[r.constituency_name, r.district_name].filter(Boolean).join(' · ')}</dd></div>
              <div className="flex items-start gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><dt className="sr-only">{te ? 'ఫోన్' : 'Phone'}</dt><dd className={r.contact_phone ? '' : 'text-muted-foreground'}>{r.contact_phone || na}</dd></div>
              <div className="flex items-start gap-2"><Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><dt className="sr-only">{te ? 'ఈమెయిల్' : 'Email'}</dt><dd className={r.email ? 'break-all' : 'text-muted-foreground'}>{r.email || na}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
