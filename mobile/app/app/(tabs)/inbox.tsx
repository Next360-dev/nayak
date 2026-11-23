import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../src/hooks/useAuth';
import { fetchInbox, fetchSent, updateStatus } from '../../src/api/shares';
import { Share } from '../../src/types';
import { Badge, Button, EmptyState, ErrorState, FilterChips, ScreenHeader, ShareRow, StickyBar, Toast } from '../../src/ui';
import { Segmented } from '../../src/ui/NewsParts';
import { relativeTime } from '../../src/lib/time';
import { space, surface, type, useTheme } from '../../src/theme';

type Filter = 'all' | 'new' | 'acting' | 'done';
const DONE_MESSAGE: Record<string, string> = { seen: 'Marked as seen', acting: "Marked as acting", done: 'Marked as done' };

function InboxSkeleton() {
  const { c } = useTheme();
  const bar = (w: string, h = 12) => <View style={{ width: w as `${number}%`, height: h, borderRadius: 6, backgroundColor: c.surface }} />;
  return (
    <View style={{ padding: space.lg, gap: space.lg }} accessibilityLabel="Loading shares">
      {[0, 1, 2, 3].map((i) => <View key={i} style={{ gap: space.sm }}>{bar('80%', 16)}{bar('45%')}</View>)}
    </View>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { sent, filter: filterParam, ts } = useLocalSearchParams<{ sent?: string; filter?: string; ts?: string }>();
  const { user } = useAuth();
  const { c } = useTheme();
  const canShare = !!user && user.role !== 'admin';
  const [view, setView] = useState<'received' | 'sent'>(sent ? 'sent' : 'received');
  const [filter, setFilter] = useState<Filter>('all');
  // A tap on a Home tile arrives as params. Apply each new request once (render-time sync, no effect needed).
  const [appliedKey, setAppliedKey] = useState<string | undefined>();
  const requestKey = filterParam || sent ? `${filterParam ?? ''}|${sent ?? ''}|${ts ?? ''}` : undefined;
  if (requestKey && requestKey !== appliedKey) {
    setAppliedKey(requestKey);
    if (sent) setView('sent');
    else { setView('received'); setFilter((['new', 'acting', 'done'] as const).find((f) => f === filterParam) ?? 'all'); }
  }
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);

  const inboxQ = useQuery({ queryKey: ['inbox'], queryFn: fetchInbox });
  const sentQ = useQuery({ queryKey: ['sent'], queryFn: fetchSent, enabled: view === 'sent' });

  const mutate = useMutation({
    mutationFn: ({ id, to }: { id: number; to: string }) => updateStatus(id, to),
    onSuccess: (_d, v) => {
      setToast({ message: DONE_MESSAGE[v.to] ?? 'Updated', visible: true });
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      void qc.invalidateQueries({ queryKey: ['unread-count'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => setToast({ message: 'Could not update. Try again.', visible: true }),
  });

  const all = useMemo(() => (inboxQ.data || []) as Share[], [inboxQ.data]);
  const received = useMemo(() => {
    const items = filter === 'all' ? [...all] : all.filter((s) => s.status === filter);
    return items.sort((a, b) => (a.priority === 'urgent' ? 0 : 1) - (b.priority === 'urgent' ? 0 : 1) || (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
  }, [all, filter]);
  const newCount = all.filter((s) => s.status === 'new').length;

  const list = view === 'received' ? received : (sentQ.data || []);
  const loading = view === 'received' ? inboxQ.isLoading : sentQ.isLoading;
  const failed = view === 'received' ? inboxQ.isError : sentQ.isError;
  const refetch = () => { void (view === 'received' ? inboxQ.refetch() : sentQ.refetch()); };

  const empty = loading ? <InboxSkeleton /> : failed ? (
    <ErrorState message="Could not load your shares." onRetry={refetch} />
  ) : view === 'received' && filter !== 'all' ? (
    <EmptyState icon="filter-list" title="Nothing with this status" hint="Pick All to see every share." />
  ) : (
    <View style={{ paddingHorizontal: space.lg, paddingVertical: space.xl, alignItems: 'center', gap: space.md }}>
      <EmptyState icon="mail-outline" title={view === 'received' ? 'Nothing waiting for you' : 'You have not shared anything yet'} hint={view === 'received' ? 'When someone shares a story with you it appears here.' : 'Open a story and tap Share.'} />
      {canShare ? <Button label={user?.role === 'staff' ? 'Find a story to share' : 'Share a story'} onPress={() => router.push(user?.role === 'staff' ? '/(tabs)/news' : '/share/create')} /> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: surface }}>
      <View style={{ backgroundColor: surface }}>
        <ScreenHeader title="Inbox" subtitle={all.length > 0 ? `${newCount} new · ${all.length} received` : undefined} actions={[]} />
      </View>
      <StickyBar>
        <Segmented options={[{ id: 'received', label: 'Received' }, { id: 'sent', label: 'Sent' }]} value={view} onChange={(v) => setView(v === 'received' ? 'received' : 'sent')} />
        {view === 'received' ? (
          <FilterChips options={[{ key: 'all', label: 'All' }, { key: 'new', label: 'New', count: newCount }, { key: 'acting', label: 'Acting' }, { key: 'done', label: 'Done' }]} value={filter} onChange={(k) => setFilter(k as Filter)} />
        ) : null}
      </StickyBar>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: space.xl, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        data={loading || failed ? [] : (list as any[])}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item, index }) => {
          if (view === 'sent') {
            const s = item as any;
            const recipients: { recipient: string; status: string }[] = Array.isArray(s.recipients) ? s.recipients : [];
            return (
              <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md + 2, gap: 6, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <Text style={[type.body, { color: c.text, fontWeight: '700' }]} numberOfLines={2}>{s.title}</Text>
                <Text style={[type.caption, { color: c.muted }]}>{`to ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}${s.created_at ? ` · ${relativeTime(s.created_at)}` : ''}`}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {recipients.map((r) => <Badge key={r.recipient} label={`${r.recipient}: ${r.status}`} tone={r.status === 'done' ? 'success' : r.status === 'new' ? 'attention' : 'neutral'} />)}
                </View>
              </View>
            );
          }
          const s = item as Share;
          return (
            <ShareRow
              share={s}
              last={index === received.length - 1}
              busy={mutate.isPending}
              onOpen={() => router.push(`/share/${s.id}`)}
              onStatus={(to) => mutate.mutate({ id: s.id, to })}
            />
          );
        }}
        ListFooterComponent={view === 'received' && received.length > 0 && newCount === 0 ? (
          <View style={{ padding: space.xl, alignItems: 'center' }}>
            <Text style={[type.caption, { color: c.muted }]}>You are all caught up.</Text>
          </View>
        ) : undefined}
        ListEmptyComponent={empty}
        refreshControl={<RefreshControl refreshing={inboxQ.isRefetching} onRefresh={refetch} tintColor={c.accent} />}
      />
      {toast ? <Toast message={toast.message} visible={toast.visible} onDismiss={() => setToast(null)} /> : null}
    </View>
  );
}
