import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useLang } from '../../i18n/LangContext';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATUS = {
  new: 'border-amber-300 bg-amber-50 text-amber-900',
  seen: 'border-border bg-secondary text-secondary-foreground',
  acting: 'border-blue-200 bg-blue-50 text-brand',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

/** A share status pill. Pass `count` to show "New 3"; leave it out to show just "New". */
export function StatusBadge({ status, count }) {
  const { tr } = useLang();
  const label = count == null ? tr(`st.${status}`) : tr(`st.${status}N`, { n: count });
  return <Badge variant="outline" className={cn(STATUS[status])}>{label}</Badge>;
}

const TONE = { default: 'text-foreground', warn: 'text-attention', bad: 'text-destructive', good: 'text-emerald-700' };

/**
 * The numbers at the top of a home screen: ONE bordered strip with hairline dividers, not a row of cards.
 * items: [{ label, value, hint, tone }]. Colour is used only when a number needs a person to act.
 */
export function Stats({ items, big = false }) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'lg:grid-cols-4' }[items.length] || 'lg:grid-cols-4';
  const oddSpan = items.length === 4 ? '[&>*:last-child:nth-child(odd)]:sm:col-span-2 [&>*:last-child:nth-child(odd)]:lg:col-span-1' : '';
  return (
    <dl className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', cols, oddSpan)}>
      {items.map((it) => (
        <div key={it.label} className={cn('relative overflow-hidden rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_2px_8px_rgba(15,23,42,.04)] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-orange-500', big && 'py-5')}>
          <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{it.label}</dt>
          <dd className={cn('mt-1 font-semibold tracking-tight tabular-nums', big ? 'text-4xl' : 'text-3xl', TONE[it.tone || 'default'])}>{it.value ?? '–'}</dd>
          {it.hint && <dd className="mt-1 text-xs text-slate-500">{it.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** A titled card; children go in the body. */
export function Section({ title, description, action, className, children }) {
  return (
    <Card className={cn('gap-3 rounded-xl border-slate-200 bg-white py-5 shadow-[0_2px_10px_rgba(15,23,42,.035)]', className)}>
      <CardHeader className="pb-0">
        <CardTitle className="text-[15px] font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-[13px]">{description}</CardDescription>}
        {action && <CardAction className="row-span-1">{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Empty({ children }) {
  return <p className="py-2 text-sm text-muted-foreground">{children}</p>;
}

/** Page frame shared by every home screen. `narrow` is for the leader: a calmer, shorter line length. */
export function Page({ title, subtitle, actions, narrow = false, children }) {
  return (
    <main className="shadcn-scope min-h-[calc(100vh-120px)] bg-[#f5f6f8]">
      <div className={cn('mx-auto w-full space-y-6 px-4 py-6 md:px-8 md:py-8 lg:px-10', narrow ? 'max-w-4xl' : 'max-w-[1800px]')}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </main>
  );
}

/** Consistent frame for full-screen work areas such as Compose and Projects. */
export function FeaturePage({ title, subtitle, onBack, children }) {
  const { tr } = useLang();
  return (
    <main className="shadcn-scope min-h-[calc(100vh-120px)] bg-[#f5f6f8]">
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {onBack && <Button type="button" variant="outline" onClick={onBack}><ArrowLeft aria-hidden="true" />{tr('nav.home')}</Button>}
        </div>
        {children}
      </div>
    </main>
  );
}

/** Placeholder shown while a home screen loads (same shape as the real thing). */
export function HomeSkeleton() {
  return (
    <main className="shadcn-scope min-h-[calc(100vh-120px)] bg-background" aria-busy="true">
      <div className="mx-auto w-full max-w-[1800px] space-y-6 px-4 py-6 md:px-8 md:py-8 lg:px-10">
        <h1 className="sr-only">Loading</h1>
        <div className="space-y-2"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-80 max-w-full" /></div>
        <Skeleton className="h-24 rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-lg lg:col-span-2" /><Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    </main>
  );
}
