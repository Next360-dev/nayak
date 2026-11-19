import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from '../../src/api/dashboard';
import { useAuth } from '../../src/hooks/useAuth';
import { DashboardAttention, DashboardResponse, DashboardShares, LeaderOverview, UnreadCountResponse } from '../../src/types';
import { space, tints, type, useTheme } from '../../src/theme';
import { Badge, Card, EmptyState, ErrorState, HomeSkeleton, Pill, Row, SectionHeader, StatStrip } from '../../src/ui';
import { Hero, NewsItem, QuickAction, QuickActions, ReachCard, SectionTitle, SummaryCard, TextLink } from '../../src/ui/HomeParts';
import { apiFetch } from '../../src/api/client';
import { relativeTime } from '../../src/lib/time';
import { rememberStory } from '../../src/lib/storyCache';

const ADMIN_LEADERS_SHOWN = 8;

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

  const actions: QuickAction[] = isAdmin
    ? []
    : [
        { icon: 'share', label: 'Share a story', color: tints.gold, onPress: () => router.push('/share/create') },
        { icon: 'mail-outline', label: 'Inbox', color: tints.violet, onPress: openInbox, count: unread },
        { icon: isStaff ? 'checklist' : 'groups', label: isStaff ? 'Team board' : 'Team', color: tints.blue, onPress: openTeam },
        { icon: 'send', label: 'Sent', color: tints.green, onPress: openSent },
      ];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: space.xl }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} tintColor={c.accent} />}
    >
      <Hero eyebrow={eyebrow} place={place} name={person} unread={unread} onBell={openInbox} onAvatar={openMore} />

      {actions.length > 0 ? <QuickActions actions={actions} /> : <View style={{ height: space.lg }} />}

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
              { label: 'MLAs + MPs', value: (data.users?.by_role?.mla ?? 0) + (data.users?.by_role?.minister ?? 0) },
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
                {data.activity.map((a, i) => (
                  <Row
                    key={a.id}
                    title={a.title}
                    last={i === (data.activity?.length ?? 0) - 1}
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
          <SectionTitle
            title="Today's Summary"
            right={<Text style={{ color: c.muted, fontSize: 14 }}>{todayLabel()}</Text>}
          />
          {news && !news.error ? (
            <View style={{ flexDirection: 'row', gap: space.md, marginHorizontal: space.lg }}>
              <SummaryCard icon="description" value={news.today ?? 0} label="Stories" tone="ok" />
              <SummaryCard icon="local-fire-department" value={news.urgent ?? 0} label="Urgent" tone="danger" />
              <SummaryCard icon="warning-amber" value={news.negative ?? 0} label="Negative" tone="attention" />
            </View>
          ) : (
            <View style={{ marginHorizontal: space.lg }}>
              <Card><EmptyState icon="cloud-off" title={news?.error || 'News is not available right now'} /></Card>
            </View>
          )}

          <SectionTitle title="Today's News" right={stories.length > 0 ? <TextLink label="View All" onPress={openNews} /> : undefined} />
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
                  { icon: 'mail-outline', label: 'New', value: reach.new ?? 0, color: tints.blue },
                  { icon: 'visibility', label: 'Seen', value: reach.seen ?? 0, color: tints.violet },
                  { icon: 'touch-app', label: 'Acting', value: reach.acting ?? 0, color: tints.gold },
                  { icon: 'check-circle-outline', label: 'Done', value: reach.done ?? 0, color: tints.green },
                ]}
              />
            </>
          ) : null}

          {data.board ? (
            <View style={{ paddingHorizontal: space.lg }}>
              <SectionHeader title="Team board" action="Open" onAction={openTeam} />
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
  );
}
