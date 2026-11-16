import React from 'react';
import { FileText, Inbox, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLang, useTimeAgo } from '../../i18n/LangContext';
import { Empty, Page, Section, Stats, StatusBadge } from './shared';
import StoryRow from './StoryRow';
import InboxList from './InboxList';
import RefreshNews from '../RefreshNews';

export default function StaffHome({ data, onRefreshed, onShare, onTask, onOpenBoard, onOpenInbox, onOpenNews, onOpenBriefing }) {
  const { tr } = useLang();
  const ago = useTimeAgo();
  const { news, shares, leader, board } = data;
  const leaderName = leader?.name || tr('staff.yourLeader');
  const l = tr(`staff.lbl.${leader ? (leader.role === 'minister' ? 'minister' : 'mla') : 'leader'}`);

  return (
    <Page title={tr('staff.title')} subtitle={tr('staff.sub', { leader: leaderName })}
          actions={<><RefreshNews onDone={onRefreshed} /><Button variant="outline" size="sm" onClick={onOpenBriefing}><FileText /> {tr('brief.btn')}</Button><Button variant="outline" size="sm" onClick={onOpenNews}>{tr('btn.openFeed')}</Button></>}>
      <Stats items={[
        { label: tr('staff.kpi.stories'), value: news.error ? '–' : news.today, hint: news.error ? news.error : tr('staff.kpi.urgentN', { n: news.urgent }), tone: news.urgent ? 'warn' : 'default' },
        { label: tr('staff.kpi.waiting', { l }), value: shares.sent.waiting, hint: tr('staff.kpi.waitingHint') },
        { label: tr('staff.kpi.acting'), value: shares.sent.acting, hint: tr('staff.kpi.actingHint', { l }) },
        { label: tr('staff.kpi.done'), value: shares.sent.done, hint: tr('staff.kpi.doneHint'), tone: shares.sent.done ? 'good' : 'default' },
      ]} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Section title={tr('staff.review.title')} 
                 description={leader ? tr('staff.review.desc', { leader: leaderName }) : tr('staff.review.noLeader')}>
          {news.error ? <Empty>{news.error}</Empty>
            : news.attention.length === 0 ? <Empty>{tr('leader.noStories')}</Empty>
            : <ul className="list-none divide-y">{news.attention.map((s) => (
                <StoryRow key={s.id} story={s} sendLabel={leader ? tr('staff.send', { l }) : null} onShare={onShare} onTask={leader ? onTask : null} />
              ))}</ul>}
        </Section>

        <div className="space-y-6">
          {board && (
            <Section title={tr('board.title')} description={tr('board.home.desc')}
                     action={<Button size="sm" variant="ghost" onClick={() => onOpenBoard()} id="btn-open-board"><ListChecks /> {tr('board.home.open')}</Button>}>
              <p className="text-sm font-medium">{tr('board.line', board)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{tr('board.home.mine', { n: board.mine })}{board.overdue ? ` · ${tr('board.home.overdue', { n: board.overdue })}` : ''}</p>
            </Section>
          )}
          <Section title={tr('staff.sent.title')} description={tr('staff.sent.desc')}>
            {shares.sent.recent.length === 0 ? <Empty>{tr('staff.sent.empty')}</Empty> : (
              <ul className="list-none divide-y">
                {shares.sent.recent.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={onOpenInbox}
                            className="flex w-full items-start justify-between gap-3 rounded-md py-3 text-left transition-colors hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium leading-snug">{s.title}</span>
                        <span className="block text-xs text-muted-foreground">{ago(s.created_at)}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        {s.recipients.map((r) => <StatusBadge key={r.recipient} status={r.status} />)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={tr('staff.from.title', { leader: leaderName })} description={tr('staff.from.desc')}
                   action={<Button variant="ghost" size="sm" onClick={onOpenInbox}><Inbox /> {tr('btn.open')}</Button>}>
            <InboxList items={shares.inbox.recent} emptyText={tr('staff.from.empty')} onOpen={onOpenInbox} />
          </Section>
        </div>
      </div>
    </Page>
  );
}
