import React, { useState } from 'react';
import {
  Activity, CircleAlert, CircleCheck, Database, FileText, Info, Newspaper, Play, RefreshCw, TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { triggerScraper } from '../../utils/api';
import { useLang, useTimeAgo, useTimeUntil } from '../../i18n/LangContext';
import { Empty, Page, Section, Stats, StatusBadge } from './shared';
import { AuditLine } from '../AuditDialog';

const LEVEL = {
  bad: { icon: CircleAlert, cls: 'text-red-700 bg-red-50' },
  warn: { icon: TriangleAlert, cls: 'text-amber-700 bg-amber-50' },
  info: { icon: Info, cls: 'text-brand bg-blue-50' },
};

function Dot({ ok }) {
  return <span className={`inline-block size-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" />;
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" aria-hidden="true" />{label}</span>
      <span className="flex items-center gap-1.5 text-right font-medium">{children}</span>
    </div>
  );
}

export default function AdminHome({ data, onRefresh, onOpenUsers, onOpenInbox, onOpenAudit, onOpenBriefing }) {
  const { tr } = useLang();
  const ago = useTimeAgo();
  const until = useTimeUntil();
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState('');
  const { system: sys, attention, users, shares, leaders, activity, audit = [], quality, app_feedback: appFeedback = [] } = data;
  const sc = sys.scraper;

  const runScraper = async () => {
    setRunning(true); setNote('');
    try { await triggerScraper(); setNote(tr('admin.sys.started')); }
    catch (e) { setNote(e.message); }
    setRunning(false);
  };
  const act = (a) => (a === 'users' ? onOpenUsers : a === 'shares' ? onOpenInbox : a === 'run_scraper' ? runScraper : null);
  const attnText = (a) => (a.code ? tr(`attn.${a.code}`, a.params || {}) : a.text);

  return (
    <Page
      title={tr('admin.title')}
      subtitle={tr('admin.sub')}
      actions={<><Button variant="outline" size="sm" onClick={onOpenBriefing}><FileText /> {tr('brief.btn')}</Button><Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw /> {tr('btn.refresh')}</Button></>}
    >
      <Stats items={[
        { label: tr('admin.kpi.leaders'), value: users.by_role.mla + users.by_role.minister, hint: tr('admin.kpi.leadersHint', { mla: users.by_role.mla, min: users.by_role.minister }) },
        { label: tr('admin.kpi.staff'), value: users.by_role.staff, hint: users.never_logged_in ? tr('admin.kpi.neverN', { n: users.never_logged_in }) : tr('admin.kpi.allLoggedIn'), tone: users.never_logged_in ? 'warn' : 'default' },
        { label: tr('admin.kpi.shares'), value: shares.total, hint: shares.resolved_pct == null ? tr('admin.kpi.none') : tr('admin.kpi.resolved', { pct: shares.resolved_pct, n: shares.new }), tone: shares.new ? 'warn' : 'default' },
        { label: tr('admin.kpi.news'), value: sys.articles_last_24h, hint: sys.latest_article_at ? tr('admin.kpi.newest', { t: ago(sys.latest_article_at) }) : tr('admin.kpi.noNews'), tone: sys.news_is_stale ? 'bad' : 'default' },
      ]} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <Section title={tr('admin.attn.title')} description={tr('admin.attn.desc')}>
          {attention.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-5 text-sm text-emerald-800">
              <CircleCheck className="size-5" aria-hidden="true" /> {tr('admin.attn.clear')}
            </div>
          ) : (
            <ul className="list-none space-y-2">
              {attention.map((a, i) => {
                const L = LEVEL[a.level] || LEVEL.info;
                const handler = act(a.action);
                return (
                  <li key={i} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${L.cls}`}>
                      <L.icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 text-sm">{attnText(a)}</span>
                    {handler && (
                      <Button variant="outline" size="sm" onClick={handler} disabled={a.action === 'run_scraper' && (running || sc?.is_running)}>
                        {a.action === 'users' ? tr('admin.attn.users') : a.action === 'shares' ? tr('admin.attn.shares') : tr('admin.attn.run')}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title={tr('admin.sys.title')} description={tr('admin.sys.desc')}>
          <div className="space-y-3">
            <Row icon={Database} label={tr('admin.sys.db')}><Dot ok={sys.database === 'up'} /> {sys.database === 'up' ? tr('admin.sys.working') : tr('admin.sys.down')}</Row>
            <Row icon={Newspaper} label={tr('admin.sys.news')}><Dot ok={!sys.news_is_stale} /> {sys.news_is_stale ? tr('admin.sys.stale') : tr('admin.sys.fresh')}</Row>
            <Row icon={Activity} label={tr('admin.sys.scraper')}>
              {!sc ? tr('common.notAvailable')
                : sc.is_running ? tr('admin.sys.running')
                : sc.last_run_end ? tr('admin.sys.ran', { t: ago(sc.last_run_end) }) : tr('admin.sys.notRun')}
            </Row>
            {sc && !sc.is_running && sc.next_run && (
              <p className="text-right text-xs text-muted-foreground">{tr('admin.sys.next', { t: until(sc.next_run) })}</p>
            )}
            <Separator />
            <Button className="w-full" variant="outline" size="sm" onClick={runScraper} disabled={running || sc?.is_running}>
              <Play /> {running ? tr('admin.sys.starting') : tr('admin.sys.run')}
            </Button>
            {note && <p className="text-center text-xs text-muted-foreground">{note}</p>}
          </div>
        </Section>
      </div>

      <Section title={tr('admin.leaders.title')} description={tr('admin.leaders.desc')}
               action={<Button variant="ghost" size="sm" onClick={onOpenInbox}>{tr('btn.allShares')}</Button>}>
        {leaders.length === 0 ? <Empty>{tr('admin.leaders.empty')}</Empty> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr('admin.leaders.leader')}</TableHead>
                <TableHead>{tr('admin.leaders.place')}</TableHead>
                <TableHead>{tr('admin.leaders.lastLogin')}</TableHead>
                <TableHead>{tr('admin.leaders.shares')}</TableHead>
                <TableHead className="text-right">{tr('admin.leaders.team')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaders.map((l) => {
                const place = [l.constituency_name, l.district_name].filter((x) => x && x !== 'All').join(' · ') || tr('common.statewide');
                return (
                  <TableRow key={l.username}>
                    <TableCell>
                      <div className="font-medium">{l.politician_name || l.username}</div>
                      <Badge variant="secondary" className="mt-1">{l.role === 'minister' ? tr('role.minister') : l.leader_title === 'MP' ? tr('role.mp') : tr('role.mla')}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{place}</TableCell>
                    <TableCell>
                      {l.last_login ? ago(l.last_login) : <span className="font-medium text-red-600">{tr('common.neverLoggedIn')}</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge status="new" count={l.shares.new} />
                        <StatusBadge status="seen" count={l.shares.seen} />
                        <StatusBadge status="acting" count={l.shares.acting} />
                        <StatusBadge status="done" count={l.shares.done} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.staff_count}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section title={tr('admin.activity.title')} description={tr('admin.activity.desc')}>
        {activity.length === 0 ? <Empty>{tr('admin.activity.empty')}</Empty> : (
          <ul className="list-none divide-y">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.priority === 'urgent' && <Badge variant="destructive" className="mr-2">{tr('pri.urgent')}</Badge>}{a.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.sender} → {a.recipients.map((r) => r.recipient).join(', ')} · {ago(a.created_at)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {a.recipients.map((r) => <StatusBadge key={r.recipient} status={r.status} />)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section title={tr('quality.title')} description={tr('quality.desc')}>
          {!quality || quality.total === 0 ? <Empty>{tr('quality.none')}</Empty> : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{tr('quality.notRelevant')} {quality.by_kind.not_relevant}</Badge>
                <Badge variant="secondary">{tr('quality.wrongPriority')} {quality.by_kind.wrong_priority}</Badge>
                <Badge variant="secondary">{tr('quality.wrongTone')} {quality.by_kind.wrong_sentiment}</Badge>
              </div>
              <ul className="list-none divide-y">
                {quality.top.map((t) => (
                  <li key={t.article_id ?? t.title} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 leading-snug">{t.title}</span>
                    <Badge variant="outline" className="shrink-0">{tr('quality.reports', { n: t.reports })}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section title={tr('pilot.title')} description={tr('pilot.desc')}>
          {appFeedback.length === 0 ? <Empty>{tr('pilot.none')}</Empty> : (
            <ul className="list-none divide-y">
              {appFeedback.map((f, i) => (
                <li key={i} className="py-2.5 text-sm">
                  <p className="whitespace-pre-wrap leading-snug">{f.message}</p>
                  <p className="text-xs text-muted-foreground">{f.username} · {ago(f.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title={tr('audit.title')} description={tr('audit.desc')}
               action={<Button variant="ghost" size="sm" onClick={onOpenAudit}>{tr('audit.viewAll')}</Button>}>
        {audit.length === 0 ? <Empty>{tr('audit.none')}</Empty> : <ul className="list-none divide-y">{audit.map((e) => <AuditLine key={e.id} e={e} />)}</ul>}
      </Section>
    </Page>
  );
}
