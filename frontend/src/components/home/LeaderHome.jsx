import React, { useState } from 'react';
import { Clock, FileText, ListChecks, Presentation, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLang, useTimeAgo } from '../../i18n/LangContext';
import { updateShareStatus } from '../../utils/api';
import { Empty, Page, Section, Stats } from './shared';
import StoryRow from './StoryRow';
import RefreshNews from '../RefreshNews';
import TopAlerts from './TopAlerts';
import LeaderSuggestions from '../LeaderSuggestions';
import WatchlistActivity from './WatchlistActivity';
import LeaderVoiceAssistant from './LeaderVoiceAssistant';

const STEPS = ['seen', 'acting', 'done'];

/** One story the team picked for the leader, with one-tap answers (no typing). */
function Pick({ item, onChanged }) {
  const { tr } = useLang();
  const ago = useTimeAgo();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const next = STEPS.slice(STEPS.indexOf(item.status) + 1);   // 'new' -> all three

  const answer = async (status) => {
    setBusy(true); setErr('');
    try { await updateShareStatus(item.id, status); await onChanged(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <li className="space-y-3 py-4">
      <div>
        <p className="text-lg font-semibold leading-snug">
          {item.priority === 'urgent' && <Badge variant="destructive" className="mr-2 align-middle">{tr('pri.urgent')}</Badge>}{item.title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{tr('inbox.from', { sender: item.sender })} · {ago(item.created_at)}</p>
      </div>
      {item.note && <p className="rounded-md bg-secondary px-3 py-2 text-base leading-snug">{item.note}</p>}
      <div className="flex flex-wrap gap-2">
        {next.map((st) => (
          <Button key={st} type="button" size="lg" variant={st === 'done' ? 'default' : 'outline'} className="h-12 min-w-28 text-base"
                  disabled={busy} onClick={() => answer(st)} data-pick-answer={st}>
            {tr(`leader.pick.${st}`)}
          </Button>
        ))}
      </div>
      {err && <p role="alert" className="text-sm text-destructive">{tr('home.loadError', { e: err })}</p>}
    </li>
  );
}

/** The leader's home: review office work, set priorities, and track progress. */
export default function LeaderHome({ data, currentUser, onRefreshed, onChanged, onShare, onOpenBoard, onOpenInbox, onOpenTeam, onOpenCompose, onOpenProjects, onOpenNews, onOpenBriefing, onOpenDemo }) {
  const { tr } = useLang();
  const ago = useTimeAgo();
  const isMinister = data.kind === 'minister';
  const { news, shares, team, board } = data;
  const staffCount = team.filter((t) => t.is_active).length;
  const decisionCount = shares.inbox.new + (data.approvals?.pending || 0);
  const openTaskCount = (board?.todo || 0) + (board?.doing || 0);

  return (
      <Page title={isMinister ? tr('leader.title.minister') : data.title === 'MP' ? data.scope.label : tr('leader.title.mla', { place: data.scope.label })}
          subtitle={isMinister ? tr('leader.sub.minister') : tr('leader.sub.mla')}
          actions={<><LeaderVoiceAssistant data={data} /><RefreshNews onDone={onRefreshed} /></>}>
      <Stats big items={[
        { label: tr('leader.kpi.decisions'), value: decisionCount, hint: tr('leader.kpi.decisionsHint', { shares: shares.inbox.new, posts: data.approvals?.pending || 0 }), tone: decisionCount ? 'warn' : 'default' },
        { label: tr('leader.kpi.urgent'), value: news.error ? '–' : news.urgent, hint: news.error || tr(news.urgent ? 'leader.kpi.urgentHint' : 'leader.kpi.urgentClear'), tone: news.urgent ? 'bad' : 'default' },
        { label: tr('leader.kpi.negative'), value: news.error ? '–' : news.negative, hint: news.error || tr(news.negative ? 'leader.kpi.negativeHint' : 'leader.kpi.negativeClear'), tone: news.negative ? 'warn' : 'default' },
        { label: tr('leader.kpi.teamWork'), value: openTaskCount, hint: tr('leader.kpi.teamWorkHint', { todo: board?.todo || 0, doing: board?.doing || 0 }), tone: board?.overdue ? 'warn' : 'default' },
      ]} />

      <Section title={tr('leader.actions.title')} description={tr('leader.actions.desc')}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Button variant="outline" size="sm" className="justify-start" onClick={onOpenCompose}><FileText /> {tr('compose.reviewTitle')}</Button>
          <Button variant="outline" size="sm" className="justify-start" onClick={onOpenProjects}>{tr('proj.title')}</Button>
          <Button variant="outline" size="sm" className="justify-start border-orange-200 bg-orange-50/60 text-orange-900 hover:bg-orange-100" onClick={onOpenDemo}><Presentation /> {tr('workspace.openLeader')}</Button>
          <Button variant="outline" size="sm" className="justify-start" onClick={onOpenBriefing}><FileText /> {tr('brief.btn')}</Button>
          <Button variant="ghost" size="sm" className="justify-start" onClick={onOpenNews}>{tr('btn.openFeed')}</Button>
        </div>
      </Section>

      <LeaderSuggestions user={currentUser} />
      <WatchlistActivity />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          {shares.inbox.recent.length === 0 ? (
            <p className="flex items-center justify-between gap-3 rounded-lg border bg-card px-5 py-3.5 text-sm text-muted-foreground">
              <span>{tr('leader.team.nothing')}</span>
              <Button variant="ghost" size="sm" onClick={onOpenInbox}>{tr('leader.pick.openAll')}</Button>
            </p>
          ) : (
            <Section title={tr('leader.pick.title')} description={tr('leader.pick.desc')}
                     action={<Button variant="ghost" size="sm" onClick={onOpenInbox}>{tr('leader.pick.openAll')}</Button>}>
              <ul className="list-none divide-y">{shares.inbox.recent.map((i) => <Pick key={i.id} item={i} onChanged={onChanged} />)}</ul>
            </Section>
          )}

          <Section title={tr('leader.attn.title')} description={tr('leader.attn.desc')}>
            {news.error ? <Empty>{news.error}</Empty>
              : news.attention.length === 0 ? <Empty>{tr('leader.noStories')}</Empty>
              : <ul className="list-none divide-y">{news.attention.slice(0, 5).map((s) => (
                  <StoryRow key={s.id} story={s} sendLabel={staffCount ? tr('leader.sendTeam') : null} onShare={onShare} />
                ))}</ul>}
          </Section>
          {isMinister && news.districts && news.districts.length > 0 && (
            <Section title={tr('leader.dist.title')} description={tr('leader.dist.desc')}>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>{tr('leader.dist.district')}</TableHead>
                    <TableHead className="text-right">{tr('leader.dist.urgent')}</TableHead>
                    <TableHead className="text-right">{tr('leader.dist.negative')}</TableHead>
                    <TableHead className="text-right">{tr('leader.dist.stories')}</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {news.districts.map((d) => (
                    <TableRow key={d.district}>
                      <TableCell className="font-medium">{d.district}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.urgent ? <Badge variant="destructive">{d.urgent}</Badge> : 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.negative}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{d.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          )}
        </div>

        <div className="space-y-6">
        <TopAlerts user={currentUser} />
        <Section title={tr('btn.myTeam')}>
          <div className="space-y-4 text-sm">
            <p className="flex items-start gap-2 text-muted-foreground">
              <Users className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{staffCount ? tr('leader.team.line', { n: staffCount }) : tr('leader.team.noStaff')}
                {team.length > 0 && <span className="mt-0.5 flex items-center gap-1 text-xs"><Clock className="size-3" aria-hidden="true" />{team.some((t) => t.last_login) ? ago(team.map((t) => t.last_login).filter(Boolean).sort().pop()) : tr('leader.team.never')}</span>}
              </span>
            </p>
            {board && <p className="text-muted-foreground">{tr('board.line', board)}</p>}
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={onOpenBoard} id="btn-open-board"><ListChecks /> {tr('board.title')}</Button>
              <Button variant="ghost" size="sm" onClick={onOpenTeam}>{tr('btn.manage')}</Button>
            </div>
          </div>
        </Section>
        </div>
      </div>
    </Page>
  );
}
