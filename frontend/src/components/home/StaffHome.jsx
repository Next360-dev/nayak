import React from 'react';
import { ArrowUpRight, CheckCircle2, Clock3, FileText, Inbox, ListChecks, MessageSquareText, Presentation, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLang, useTimeAgo } from '../../i18n/LangContext';
import { Empty, Page, Section, StatusBadge } from './shared';
import StoryRow from './StoryRow';
import InboxList from './InboxList';
import RefreshNews from '../RefreshNews';
import Watchlist from './Watchlist';
import WhatsAppUploads from '../WhatsAppUploads';
import SurveyInbox from './SurveyInbox';

function WorkStatus({ items }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,.035)] sm:grid-cols-4">
      {items.map(({ label, value, hint, icon: Icon, tone }, index) => (
        <div key={label} className={`min-w-0 px-4 py-4 sm:px-5 ${index > 0 ? 'border-l border-slate-100' : ''}`}>
          <dt className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.08em] text-slate-500"><Icon className={`size-4 shrink-0 ${tone || 'text-slate-400'}`} aria-hidden="true" />{label}</dt>
          <dd className="mt-2 text-2xl font-semibold leading-none tracking-tight tabular-nums text-slate-900">{value ?? '–'}</dd>
          <dd className="mt-1.5 truncate text-xs text-slate-500">{hint}</dd>
        </div>
      ))}
    </dl>
  );
}

function SentItems({ items, onOpen, ago, emptyText }) {
  if (!items.length) return <Empty>{emptyText}</Empty>;
  return (
    <ul className="list-none divide-y divide-slate-100">
      {items.slice(0, 4).map((share) => (
        <li key={share.id}>
          <button type="button" onClick={onOpen} className="flex w-full items-start justify-between gap-3 rounded-md py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-ring">
            <span className="min-w-0">
              <span className="block line-clamp-2 text-sm font-medium leading-snug text-slate-800">{share.title}</span>
              <span className="mt-1 block text-xs text-slate-500">{ago(share.created_at)}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">{share.recipients.map((recipient) => <StatusBadge key={recipient.recipient} status={recipient.status} />)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Staff operations desk: review and route work first, then use intake and setup tools. */
export default function StaffHome({ data, currentUser, onRefreshed, onShare, onTask, onOpenBoard, onOpenInbox, onOpenNews, onOpenBriefing, onOpenCompose, onOpenProjects, onOpenDemo }) {
  const { tr } = useLang();
  const ago = useTimeAgo();
  const { news, shares, leader, board } = data;
  const leaderName = leader?.name || tr('staff.yourLeader');
  const leaderRole = tr(`staff.lbl.${leader ? (leader.role === 'minister' ? 'minister' : leader.title === 'MP' ? 'mp' : 'mla') : 'leader'}`);
  const stories = news.attention || [];

  return (
    <Page title={tr('staff.title')} subtitle={tr('staff.sub', { leader: leaderName })}
      actions={(
        <div className="flex flex-col items-start gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[.08em] text-slate-500">{tr('staff.quickActions')}</span>
          <div className="flex flex-wrap items-center gap-2">
            <RefreshNews onDone={onRefreshed} />
            <Button type="button" variant="outline" onClick={onOpenProjects}><ListChecks />{tr('proj.title')}</Button>
            <Button type="button" onClick={onOpenCompose}><FileText />{tr('compose.title')}</Button>
            <Button type="button" variant="outline" onClick={onOpenDemo}><Presentation />{tr('workspace.openStaff')}</Button>
            <Button type="button" variant="outline" onClick={onOpenBriefing}><FileText />{tr('brief.btn')}</Button>
          </div>
        </div>
      )}>
      <WorkStatus items={[
        { label: tr('staff.kpi.stories'), value: news.error ? '–' : news.today, hint: news.error || tr('staff.kpi.urgentN', { n: news.urgent }), icon: ShieldAlert, tone: news.urgent ? 'text-amber-600' : '' },
        { label: tr('staff.kpi.waiting', { l: leaderRole }), value: shares.sent.waiting, hint: tr('staff.kpi.waitingHint'), icon: Send, tone: 'text-blue-600' },
        { label: tr('staff.kpi.acting'), value: shares.sent.acting, hint: tr('staff.kpi.actingHint', { l: leaderRole }), icon: Clock3, tone: 'text-orange-600' },
        { label: tr('staff.kpi.done'), value: shares.sent.done, hint: tr('staff.kpi.doneHint'), icon: CheckCircle2, tone: 'text-emerald-600' },
      ]} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,.85fr)]">
        <div className="space-y-5">
          <Section title={tr('staff.review.title')} description={leader ? tr('staff.review.desc', { leader: leaderName }) : tr('staff.review.noLeader')}
            action={<div className="flex items-center gap-2"><Badge variant="secondary">{stories.length}</Badge><Button type="button" size="sm" variant="ghost" onClick={onOpenNews}>{tr('btn.openFeed')}<ArrowUpRight /></Button></div>}>
            {news.error ? <div className="flex flex-wrap items-center justify-between gap-3"><Empty>{news.error}</Empty><Button type="button" size="sm" variant="outline" onClick={onRefreshed}><RefreshCw />{tr('btn.retry')}</Button></div>
              : stories.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6"><p className="text-sm font-medium text-slate-800">{tr('leader.noStories')}</p><p className="mt-1 text-xs text-slate-500">{tr('staff.review.desc', { leader: leaderName })}</p><Button type="button" size="sm" variant="outline" className="mt-3" onClick={onOpenNews}>{tr('btn.openFeed')}<ArrowUpRight /></Button></div>
              : <ul className="list-none divide-y divide-slate-100">{stories.slice(0, 8).map((story) => (
                <StoryRow key={story.id} story={story} sendLabel={leader ? tr('staff.send', { l: leaderRole }) : null} onShare={onShare} onTask={leader ? onTask : null} />
              ))}</ul>}
          </Section>

          <SurveyInbox />
        </div>

        <aside className="space-y-5" aria-label={tr('staff.side.label')}>
          {board && <Section title={tr('board.title')} description={tr('board.home.desc')}
            action={<Button size="sm" variant="ghost" onClick={() => onOpenBoard()} id="btn-open-board">{tr('board.home.open')}<ArrowUpRight /></Button>}>
            <p className="text-sm font-semibold text-slate-800">{tr('board.line', board)}</p>
            <p className="mt-1 text-xs text-slate-500">{tr('board.home.mine', { n: board.mine })}{board.overdue ? ` · ${tr('board.home.overdue', { n: board.overdue })}` : ''}</p>
            {board.overdue > 0 && <Badge variant="outline" className="mt-3 border-amber-200 bg-amber-50 text-amber-800">{tr('board.home.overdue', { n: board.overdue })}</Badge>}
          </Section>}

          <Section title={tr('staff.from.title', { leader: leaderName })} description={tr('staff.from.desc')}
            action={<Button variant="ghost" size="sm" onClick={onOpenInbox}><Inbox />{tr('btn.open')}</Button>}>
            <InboxList items={shares.inbox.recent.slice(0, 4)} emptyText={tr('staff.from.empty')} onOpen={onOpenInbox} />
          </Section>

          <Section title={tr('staff.sent.title')} description={tr('staff.sent.desc')}>
            <SentItems items={shares.sent.recent} onOpen={onOpenInbox} ago={ago} emptyText={tr('staff.sent.empty')} />
          </Section>

        </aside>
      </div>

      <section className="space-y-3" aria-labelledby="staff-tools-title">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 pb-3">
          <div><h2 id="staff-tools-title" className="text-base font-semibold text-slate-900">{tr('staff.tools')}</h2><p className="mt-1 text-sm text-slate-600">{tr('staff.tools.desc')}</p></div>
          <Badge variant="outline" className="border-slate-200 bg-white"><MessageSquareText className="mr-1 size-3.5" />{tr('staff.tools.badge')}</Badge>
        </div>
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <WhatsAppUploads user={currentUser} />
          <Watchlist user={currentUser} />
        </div>
      </section>
    </Page>
  );
}
