import React, { useEffect, useState } from 'react';
import { Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDashboard } from '../../src/api/dashboard';
import { useAuth } from '../../src/hooks/useAuth';
import { DashboardAttention, DashboardResponse, DashboardShares, LeaderOverview, UnreadCountResponse } from '../../src/types';
import { space, type, useTheme } from '../../src/theme';
import { Badge, Card, EmptyState, ErrorState, HomeSkeleton, Pill, Row, SectionHeader, ShareRow, StatStrip, Toast } from '../../src/ui';
import { updateStatus } from '../../src/api/shares';
import { Hero, NewsItem, ReachCard, SectionTitle, ShortcutGrid, ShortcutTile, StatusBrief, TextLink } from '../../src/ui/HomeParts';
import { fetchSaved } from '../../src/api/saved';
import { useLang } from '../../src/i18n';
import { apiFetch } from '../../src/api/client';
import { relativeTime } from '../../src/lib/time';
import { rememberStory } from '../../src/lib/storyCache';
import { getPushToken } from '../../src/lib/storage';

// `ts` makes every tap a fresh request, so the target screen re-applies its filter even when the same one was used before.
function pushFresh(router: ReturnType<typeof useRouter>, pathname: string, params: Record<string, string>) {
  router.push({ pathname, params: { ...params, ts: String(Date.now()) } } as never);
}

const ADMIN_LEADERS_SHOWN = 5;
// Push cannot work in Expo Go or in a browser, so do not offer it there.
const PUSH_UNAVAILABLE = Constants.appOwnership === 'expo' || Platform.OS === 'web';

function ShareShortcuts({ shares, onInbox, onSent }: { shares: DashboardShares; onInbox: () => void; onSent: () => void }) {
  const inbox = shares.inbox;
  const sent = shares.sent;
  if (!inbox && !sent) {
    const open = (shares.new ?? 0) + (shares.acting ?? 0);
    return (
      <Card>
        <Row title={`${open} shares open`} meta={`${shares.done ?? 0} done${shares.resolved_pct == null ? '' : ` · ${shares.resolved_pct}% resolved`}`} last />
      </Card>
    );
  }
  const inboxLabel = !inbox ? '' : inbox.new > 0 ? `Inbox · ${inbox.new} new` : inbox.acting > 0 ? `Inbox · ${inbox.acting} acting` : 'Inbox · all clear';
  const sentLabel = !sent ? '' : (sent.waiting ?? 0) > 0 ? `Sent · ${sent.waiting} waiting` : sent.acting > 0 ? `Sent · ${sent.acting} acting` : 'Sent · all clear';
  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      {inbox ? <Pill icon="inbox" label={inboxLabel} onPress={onInbox} tone={inbox.new > 0 ? 'danger' : undefined} /> : null}
      {sent ? <Pill icon="send" label={sentLabel} onPress={onSent} tone={(sent.waiting ?? 0) > 0 ? 'attention' : undefined} /> : null}
    </View>
  );
}

function AttentionList({ items }: { items: DashboardAttention[] }) {
  if (items.length === 0) return <Card><EmptyState icon="check-circle-outline" title="Nothing needs attention" /></Card>;
  return (
    <Card>
      {items.map((a, i) => (
        <Row
          key={`${a.code}-${i}`}
          title={a.text}
          last={i === items.length - 1}
          badges={<Badge label={a.level === 'bad' ? 'Action' : a.level === 'warn' ? 'Check' : 'Info'} tone={a.level === 'bad' ? 'danger' : a.level === 'warn' ? 'attention' : 'neutral'} />}
        />
      ))}
    </Card>
  );
}

function LeaderList({ leaders, onOpenAll }: { leaders: LeaderOverview[]; onOpenAll: () => void }) {
  if (leaders.length === 0) return <Card><EmptyState icon="groups" title="No leader accounts yet" /></Card>;
  const shown = leaders.slice(0, ADMIN_LEADERS_SHOWN);
  return (
    <>
      <Card>
        {shown.map((l, i) => {
          const newCount = l.shares?.new ?? 0;
          return (
            <Row
              key={l.username}
              title={l.politician_name || l.username}
              titleLines={1}
              last={i === shown.length - 1}
              meta={`${[l.leader_title, l.constituency_name].filter(Boolean).join(' · ')} · ${l.staff_count ?? 0} staff · last login ${l.last_login ? relativeTime(l.last_login) : 'never'}`}
              trailing={newCount > 0 ? <Badge label={`${newCount} new`} tone="danger" /> : undefined}
            />
          );
        })}
      </Card>
      {leaders.length > shown.length ? (
        <SectionHeader title={`Showing ${shown.length} of ${leaders.length}`} action="See all users" onAction={onOpenAll} />
      ) : null}
    </>
  );
}

function BoardStrip({ board }: { board: NonNullable<DashboardResponse['board']> }) {
  return (
    <StatStrip
      items={[
        { label: 'to do', value: board.todo },
        { label: 'doing', value: board.doing },
        { label: 'done', value: board.done },
        { label: 'overdue', value: board.overdue, tone: board.overdue > 0 ? 'danger' : undefined },
      ]}
    />
  );
}

function useUnread() {
  const { data } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => apiFetch<UnreadCountResponse>('/api/shares/unread-count'),
    refetchInterval: 60000,
  });
  return data?.count ?? 0;
}

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function HomeScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { user } = useAuth();
  const unread = useUnread();
  const qc = useQueryClient();
  const { t } = useLang();
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  useEffect(() => { void getPushToken().then((t) => setPushOn(!!t)).catch(() => setPushOn(null)); }, []);
  const savedQ = useQuery({ queryKey: ['saved'], queryFn: fetchSaved, enabled: !!user && user.role !== 'admin' });
  const answer = useMutation({
    mutationFn: ({ id, to }: { id: number; to: string }) => updateStatus(id, to),
    onSuccess: (_d, v) => {
      setToast({ message: v.to === 'done' ? 'Marked as done' : v.to === 'acting' ? 'Marked as acting' : 'Marked as seen', visible: true });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      void qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
    onError: () => setToast({ message: 'Could not update. Try again.', visible: true }),
  });
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
  });

  // There is no article detail screen yet, so a story opens the News tab.
  const openNews = () => router.push('/(tabs)/news');
  const openInbox = () => router.push('/(tabs)/inbox');
  const openSent = () => router.push('/(tabs)/sent');
  const openTeam = () => router.push('/(tabs)/team');
  const openMore = () => router.push('/(tabs)/settings');

  if (isLoading) return <View style={{ flex: 1 }}><HomeSkeleton /></View>;
  if (isError || !data) return <ErrorState message="Could not load your home screen." onRetry={() => { void refetch(); }} />;

  const name = user?.politician_name || user?.username || '';
  const isAdmin = data.kind === 'admin';
  const isStaff = data.kind === 'staff';
  const isLeader = data.kind === 'mla' || data.kind === 'minister';
  const eyebrow = isAdmin ? 'CONTROL ROOM' : isStaff ? 'WORKING FOR' : data.kind === 'minister' ? 'MY RESPONSIBILITY' : 'MY CONSTITUENCY';
  const place = isStaff ? (data.leader?.name || data.scope?.label || 'Team') : data.scope?.label || 'Telangana';
  const person = isStaff ? (user?.username || name) : name;

  const news = data.news;
  const stories = news?.attention || [];
  const reach = data.shares?.inbox ?? data.shares;
  const week = data.shares?.week;
  const inboxRows = (data.shares?.inbox?.recent ?? []).filter((r) => r.status !== 'done').slice(0, 3);

  // `ts` makes every tap a fresh request, so the target screen re-applies its filter even if the same one was used before.
  const go = (pathname: string, params: Record<string, string>) => pushFresh(router, pathname, params);

  const waitingForMe = data.shares?.inbox?.new ?? 0;
  const waitingOnLeader = data.shares?.sent?.waiting ?? 0;
  const urgentToday = news?.urgent ?? 0;
  const negativeToday = news?.negative ?? 0;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const brief = isStaff
    ? waitingForMe > 0
      ? { allClear: false, headline: `${plural(waitingForMe, 'item', 'items')} from your leader`, sub: waitingOnLeader > 0 ? `${waitingOnLeader} of yours still waiting for an answer` : 'Open them and reply.' }
      : waitingOnLeader > 0
        ? { allClear: false, headline: `${waitingOnLeader} waiting on your leader`, sub: 'You have not heard back on these yet.' }
        : { allClear: true, headline: 'Your queue is clear', sub: (news?.today ?? 0) > 0 ? `${plural(news?.today ?? 0, 'story', 'stories')} today. Find one worth sending.` : 'No new stories yet today.' }
    : waitingForMe > 0
      ? { allClear: false, headline: `${plural(waitingForMe, 'share is', 'shares are')} waiting for you`, sub: [urgentToday > 0 ? `${urgentToday} urgent today` : '', negativeToday > 0 ? `${negativeToday} negative` : ''].filter(Boolean).join(' · ') || undefined }
      : urgentToday > 0
        ? { allClear: false, headline: `${plural(urgentToday, 'urgent story', 'urgent stories')} today`, sub: negativeToday > 0 ? `${negativeToday} negative to look at` : undefined }
        : { allClear: true, headline: 'You are all caught up', sub: negativeToday > 0 ? `${plural(negativeToday, 'negative story', 'negative stories')} worth a look today.` : 'Nothing needs you right now.' };

  const savedCount = savedQ.data?.length;
  const board = data.board;
  const boardOpen = board ? board.todo + board.doing : 0;
  // Same content and order as the web: leaders get "Leader actions", staff get "Office tools".
  const go2 = (path: string) => () => router.push(path as never);
  const tiles: ShortcutTile[] = !isLeader ? [] : [
    { icon: 'edit', label: t('compose.title'), sub: 'Write and schedule a post', onPress: go2('/tools/compose'), primary: true },
    { icon: 'construction', label: t('proj.title'), sub: board ? `${boardOpen} open tasks` : 'Track development', onPress: go2('/tools/projects') },
    { icon: 'mic', label: t('voice.button'), sub: 'Ask your office', onPress: go2('/tools/voice'), highlight: true },
    { icon: 'lightbulb-outline', label: 'AI inbox', sub: 'Suggested next steps', onPress: go2('/tools/suggestions') },
    { icon: 'description', label: t('btn.briefing'), sub: 'Today in one page', onPress: go2('/tools/briefing') },
    { icon: 'sensors', label: t('btn.openFeed'), sub: (news?.today ?? 0) > 0 ? `${news?.today} today` : 'Live news', onPress: openNews },
    { icon: 'forum', label: t('survey.results.title'), sub: 'Citizen messages', onPress: go2('/tools/survey') },
    { icon: 'bookmark-border', label: t('m.saved'), sub: savedCount === undefined ? 'Reading list' : savedCount > 0 ? `${savedCount} saved` : 'Nothing saved yet', onPress: () => router.push('/saved') },
  ];
  const staffTools = !isStaff ? [] : [
    { icon: 'sensors', label: t('nav.live'), sub: 'Review the news and send what matters', go: openNews },
    { icon: 'notifications-active', label: t('top.alerts.title'), sub: t('top.alerts.sub'), go: go2('/tools/alerts') },
    { icon: 'construction', label: t('proj.title'), sub: t('proj.sub'), go: go2('/tools/projects') },
    { icon: 'edit', label: t('compose.title'), sub: 'Write, schedule, send for approval', go: go2('/tools/compose') },
    { icon: 'fact-check', label: t('m.letters'), sub: 'Letters and petitions with approval', go: go2('/work') },
    { icon: 'chat', label: t('wa.title'), sub: t('wa.sub'), go: go2('/tools/whatsapp') },
    { icon: 'visibility', label: t('watch.title'), sub: t('watch.sub'), go: go2('/tools/watchlist') },
    { icon: 'forum', label: t('survey.results.title'), sub: 'Citizen messages and the survey link', go: go2('/tools/survey') },
    { icon: 'checklist', label: 'Team board', sub: 'Tasks, notes and the daily briefing', go: openTeam },
    { icon: 'bookmark-border', label: t('m.saved'), sub: 'Your reading list', go: () => router.push('/saved') },
  ];

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: space.xl }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} tintColor={c.accent} />}
    >
      <Hero eyebrow={eyebrow} place={place} name={person} unread={unread} onBell={openInbox} onAvatar={openMore} />

      <View style={{ height: space.lg }} />

      {isAdmin ? (
        <View style={{ paddingHorizontal: space.lg }}>
          <StatStrip
            items={[
              { label: 'database', value: data.system?.database === 'up' ? 'Up' : 'Down', tone: data.system?.database === 'up' ? undefined : 'danger' },
              { label: 'stories 24h', value: data.system?.articles_last_24h ?? 'n/a' },
              { label: 'news', value: data.system?.news_is_stale ? 'Stale' : 'Fresh', tone: data.system?.news_is_stale ? 'danger' : undefined },
            ]}
          />
          <Text style={[type.caption, { color: c.muted, marginTop: space.sm, paddingHorizontal: space.xs }]}>
            Latest story {data.system?.latest_article_at ? relativeTime(data.system.latest_article_at) : 'not available'}
            {data.system?.scraper ? ` · scraper ${data.system.scraper.is_running ? 'running' : 'idle'}` : ''}
          </Text>

          <SectionHeader title="Needs attention" />
          <AttentionList items={data.attention || []} />

          <SectionHeader title="Accounts" />
          <StatStrip
            items={[
              { label: 'Leaders', value: (data.users?.by_role?.mla ?? 0) + (data.users?.by_role?.minister ?? 0) },
              { label: 'staff', value: data.users?.by_role?.staff ?? 0 },
              { label: 'never signed in', value: data.users?.never_logged_in ?? 0, tone: (data.users?.never_logged_in ?? 0) > 0 ? 'attention' : undefined },
            ]}
          />

          {data.shares ? (
            <>
              <SectionHeader title="Shares" />
              <ShareShortcuts shares={data.shares} onInbox={openInbox} onSent={openSent} />
            </>
          ) : null}

          <SectionHeader title="Leaders" />
          <LeaderList leaders={data.leaders || []} onOpenAll={() => router.push('/(tabs)/users')} />

          {data.activity && data.activity.length > 0 ? (
            <>
              <SectionHeader title="Recent share activity" />
              <Card>
                {data.activity.slice(0, 5).map((a, i, arr) => (
                  <Row
                    key={a.id}
                    title={a.title}
                    last={i === arr.length - 1}
                    meta={`${a.sender ? `from ${a.sender} · ` : ''}${relativeTime(a.created_at)}`}
                    onPress={() => router.push(`/share/${a.id}`)}
                  />
                ))}
              </Card>
            </>
          ) : null}
        </View>
      ) : (
        <>
          <StatusBrief
            allClear={brief.allClear}
            headline={brief.headline}
            sub={brief.sub}
            date={todayLabel()}
            tiles={isStaff ? [
              { icon: 'description', value: news?.today ?? 0, label: 'Stories today', tone: 'neutral', onPress: openNews },
              { icon: 'hourglass-empty', value: data.shares?.sent?.waiting ?? 0, label: 'Waiting on leader', tone: 'attention', onPress: () => go('/(tabs)/inbox', { sent: '1' }) },
              { icon: 'mail-outline', value: data.shares?.inbox?.new ?? 0, label: 'From leader', tone: 'danger', onPress: () => go('/(tabs)/inbox', { filter: 'new' }) },
            ] : [
              { icon: 'mail-outline', value: data.shares?.inbox?.new ?? 0, label: 'Waiting for me', tone: 'danger', onPress: () => go('/(tabs)/inbox', { filter: 'new' }) },
              { icon: 'local-fire-department', value: news?.urgent ?? 0, label: 'Urgent today', tone: 'danger', onPress: openNews },
              { icon: 'warning-amber', value: news?.negative ?? 0, label: 'Negative today', tone: 'attention', onPress: () => go('/(tabs)/news', { scope: 'negative' }) },
            ]}
          />
          {news?.error ? <View style={{ marginHorizontal: space.lg, marginTop: space.md }}><Card><EmptyState icon="cloud-off" title={news.error} /></Card></View> : null}

          <SectionTitle title={isStaff ? t('m.fromLeader') : t('leader.pick.title')} right={inboxRows.length > 0 ? <TextLink label="Inbox" onPress={openInbox} /> : undefined} />
          <View style={{ marginHorizontal: space.lg }}>
            <Card>
              {inboxRows.length > 0 ? inboxRows.map((r, i) => (
                <ShareRow
                  key={r.id}
                  share={r}
                  showNote
                  last={i === inboxRows.length - 1}
                  busy={answer.isPending}
                  onOpen={() => router.push(`/share/${r.id}`)}
                  onStatus={(to) => answer.mutate({ id: r.id, to })}
                />
              )) : (
                <EmptyState icon="mail-outline" title={isStaff ? 'Nothing from your leader yet' : 'No shares waiting'} hint={isStaff ? 'Find a story and send it to your leader.' : 'Stories your team shares will appear here.'} />
              )}
            </Card>
          </View>

          {isLeader ? (<><SectionTitle title={t('leader.actions.title')} /><ShortcutGrid tiles={tiles} /></>) : null}
          {isStaff ? (
            <>
              <SectionTitle title={t('staff.tools')} />
              <View style={{ marginHorizontal: space.lg }}>
                <Card>
                  {staffTools.map((x, i) => <Row key={x.label} title={x.label} meta={x.sub} onPress={x.go} last={i === staffTools.length - 1} />)}
                </Card>
              </View>
            </>
          ) : null}

          {week && (week.received + week.handled + week.sent + week.sent_done) > 0 ? (
            <View style={{ marginHorizontal: space.lg }}>
              <SectionHeader title={t('m.week')} />
              <StatStrip items={isStaff
                ? [{ label: 'sent up', value: week.sent }, { label: 'answered done', value: week.sent_done }, { label: 'from leader', value: week.received }]
                : [{ label: 'received', value: week.received }, { label: 'handled', value: week.handled }]} />
            </View>
          ) : null}

          {pushOn === false && !PUSH_UNAVAILABLE ? (
            <View style={{ marginHorizontal: space.lg, marginTop: space.lg }}>
              <Card>
                <Row title="Get a ping when something needs you" meta={isStaff ? 'Only for replies and new items from your leader.' : 'Only for new shares from your team.'} onPress={openMore} last />
              </Card>
            </View>
          ) : null}

          <SectionTitle title={isStaff ? t('m.stories.review') : t('leader.attn.title')} right={stories.length > 0 ? <TextLink label="View All" onPress={openNews} /> : undefined} />
          <View style={{ marginHorizontal: space.lg }}>
            {stories.length > 0 ? (
              <Card>
                {stories.map((st, i) => (
                  <NewsItem
                    key={st.id}
                    headline={st.headline}
                    sentiment={st.sentiment}
                    urgent={st.priority_score === 1}
                    meta={[st.district_name, relativeTime(st.date_time)].filter(Boolean).join(' · ')}
                    onPress={() => router.push(`/story/${rememberStory({ id: String(st.id), headline: st.headline, summary: st.summary, url: st.url, place: st.district_name, source: st.source, time: st.date_time, tone: st.sentiment === 'negative' ? 'negative' : st.sentiment === 'positive' ? 'positive' : 'neutral', urgent: st.priority_score === 1 })}`)}
                    last={i === stories.length - 1}
                  />
                ))}
              </Card>
            ) : (
              <Card><EmptyState icon="check-circle-outline" title="Nothing needs attention right now" hint="Pull down to refresh." /></Card>
            )}
          </View>

          {reach ? (
            <>
              <SectionTitle title="Shares & Reach" />
              <ReachCard
                metrics={[
                  { icon: 'mail-outline', label: 'New', value: reach.new ?? 0, color: c.accent },
                  { icon: 'visibility', label: 'Seen', value: reach.seen ?? 0, color: c.muted },
                  { icon: 'touch-app', label: 'Acting', value: reach.acting ?? 0, color: c.attention },
                  { icon: 'check-circle-outline', label: 'Done', value: reach.done ?? 0, color: c.ok },
                ]}
              />
            </>
          ) : null}

          {data.kind === 'minister' && (news?.districts ?? []).length > 0 ? (
            <>
              <SectionTitle title={t('leader.dist.title')} />
              <View style={{ marginHorizontal: space.lg }}>
                <Card>
                  {(news?.districts ?? []).map((d, i, arr) => (
                    <Row key={d.district} title={d.district} meta={`${d.urgent} urgent · ${d.negative} negative · ${d.total} stories`} last={i === arr.length - 1} onPress={() => go('/(tabs)/news', { district: d.district })} />
                  ))}
                </Card>
              </View>
            </>
          ) : null}

          {data.board ? (
            <View style={{ paddingHorizontal: space.lg }}>
              <SectionHeader title={t('m.teamboard')} action="Open" onAction={openTeam} />
              <BoardStrip board={data.board} />
            </View>
          ) : null}

          {isLeader && (data.approvals?.pending ?? 0) > 0 ? (
            <View style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
              <SectionHeader title="Letters & petitions" action="Open" onAction={() => router.push('/work')} />
              <Card>
                <Row
                  title={`${data.approvals?.pending} pending for approval`}
                  onPress={() => router.push('/work')}
                  last
                />
              </Card>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
      {toast ? <Toast message={toast.message} visible={toast.visible} onDismiss={() => setToast(null)} /> : null}
    </View>
  );
}
