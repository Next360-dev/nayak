import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View, ViewStyle, TextStyle } from 'react-native';import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/hooks/useAuth';
import { fetchInbox, fetchSent } from '../../src/api/shares';
import { Share } from '../../src/types';
import { Badge, Button, FilterChips, GroupedList, ScreenHeader, StickyBar, Toast } from '../../src/ui';
import { Segmented } from '../../src/ui/NewsParts';
import { hairline, space, surface, useTheme } from '../../src/theme';

function relativeTime(s?: string | null) {
  if (!s) return '';
  const diff = (Date.now() - new Date(s).getTime()) / 1000;
  if (Number.isNaN(diff)) return '';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const STATUS_BADGE: Record<string, { tone: 'attention' | 'neutral' | 'success'; label: string }> = {
  new: { tone: 'attention', label: 'New' },
  seen: { tone: 'neutral', label: 'Seen' },
  acting: { tone: 'attention', label: 'Acting' },
  done: { tone: 'success', label: 'Done' },
};

export default function InboxScreen() {
  const router = useRouter();
  const { sent } = useLocalSearchParams<{ sent?: string }>();
  const { user } = useAuth();
  const { c } = useTheme();
  const canShare = !!user && user.role !== 'admin';
  const [view, setView] = useState<'received' | 'sent'>(sent ? 'sent' : 'received');
  const [filter, setFilter] = useState<'all' | 'new' | 'acting' | 'done'>('all');
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);

  const { data: inbox, isRefetching: refreshingInbox, refetch: refetchInbox } = useQuery({ queryKey: ['inbox'], queryFn: fetchInbox });
  const { data: sentData } = useQuery({ queryKey: ['sent'], queryFn: fetchSent, enabled: view === 'sent' });

  const received = useMemo(() => {
    let items = (inbox || []) as Share[];
    if (filter !== 'all') items = items.filter((s) => s.status === filter);
    return items.sort((a, b) => (a.priority === 'urgent' ? 0 : 1) - (b.priority === 'urgent' ? 0 : 1) || (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
  }, [inbox, filter]);

  const header = (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, backgroundColor: surface, borderBottomWidth: 1, borderBottomColor: hairline }}>
      <ScreenHeader title="Inbox" subtitle={received.length > 0 ? `${received.filter((s) => s.status === 'new').length} new · ${received.length} received` : 'No shares yet'} actions={[]} />
    </View>
  );

  const receivedSections = [
    {
      rows: received.map((s) => ({
        icon: 'mail-outline',
        iconColor: s.status === 'new' ? c.accent : c.muted,
        title: s.title,
        value: `from ${s.sender} · ${relativeTime(s.created_at)}`,
        onPress: () => router.push(`/share/${s.id}`),
      })),
    },
  ];

  const empty = (
    <View style={{ paddingHorizontal: space.lg, paddingVertical: space.xl, alignItems: 'center' }}>
      <TextFieldLike title="No shares yet" hint="When someone shares a story with you it appears here." />
      {canShare ? <Button label="Share a story" onPress={() => router.push('/share/create')} /> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: surface }}>
      {header}
      <StickyBar>
        <Segmented options={[{ id: 'received', label: 'Received' }, { id: 'sent', label: 'Sent' }]} value={view} onChange={(v) => setView(v === 'received' ? 'received' : 'sent')} />
        {view === 'received' ? (
          <FilterChips options={[{ key: 'all', label: 'All' }, { key: 'new', label: 'New' }, { key: 'acting', label: 'Acting' }, { key: 'done', label: 'Done' }]} value={filter} onChange={(k) => setFilter(k as any)} />
        ) : null}
      </StickyBar>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: space.xl }}
        showsVerticalScrollIndicator={false}
        data={view === 'received' ? received : (sentData || [])}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => {
          if (view === 'sent') {
            const s = item as any;
            return (
              <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: hairline }]}>
                <Text style={[styles.rowTitle, { fontWeight: '700' }]}>{s.title}</Text>
                <Text style={styles.rowMeta}>to {Array.isArray(s.recipients) ? s.recipients.length : 0} people</Text>
                <View style={styles.rowChips}>
                  {(Array.isArray(s.recipients) ? s.recipients : []).map((r: any) => (
                    <Text key={r.recipient} style={[styles.chip, { borderColor: r.status === 'done' ? c.ok : c.border, color: r.status === 'done' ? c.ok : c.muted }]}>{r.recipient}: {r.status}</Text>
                  ))}
                </View>
              </View>
            );
          }
          const s = item as Share;
          const st = STATUS_BADGE[s.status] ?? STATUS_BADGE.seen;
          return (
            <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: hairline }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                {s.status === 'new' ? <View style={[styles.dot, { backgroundColor: c.accent }]} /> : null}
                <Text style={[styles.rowTitle, { fontWeight: '700' }]} numberOfLines={2}>{s.title}</Text>
                {s.priority === 'urgent' ? <Badge label="Urgent" tone="danger" /> : null}
                <Badge label={st.label} tone={st.tone} />
              </View>
              <Text style={styles.rowMeta}>from {s.sender} · {relativeTime(s.created_at)}</Text>
              {(s.reply_count ?? 0) > 0 ? <Text style={[styles.rowMeta, { color: c.accentText, fontWeight: '700' }]}>{s.reply_count} replies</Text> : null}
            </View>
          );
        }}
        ListHeaderComponent={view === 'received' ? <GroupedList sections={receivedSections} /> : undefined}
        ListEmptyComponent={empty}
        refreshControl={<RefreshControl refreshing={refreshingInbox} onRefresh={() => { void refetchInbox(); }} />}
      />
      {toast && <Toast message={toast.message} visible={toast.visible} onDismiss={() => setToast(null)} />}
    </View>
  );
}

function TextFieldLike({ title, hint }: { title: string; hint: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={[styles.emptyHint, { color: c.muted }]}>{hint}</Text>
    </View>
  );
}

const styles: {
  row: ViewStyle;
  rowTitle: TextStyle;
  rowMeta: TextStyle;
  rowChips: ViewStyle;
  chip: TextStyle;
  emptyTitle: TextStyle;
  emptyHint: TextStyle;
  dot: ViewStyle;
} = {
  row: { paddingHorizontal: space.lg, paddingVertical: 16 },
  rowTitle: { fontSize: 15, fontWeight: '700' as const },
  rowMeta: { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  rowChips: { flexDirection: 'row', gap: 6, marginTop: 4 },
  chip: { fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderRadius: 999 },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, color: '#171717', marginBottom: 4 },
  emptyHint: { fontSize: 13, color: '#6B6B6B', textAlign: 'center', marginBottom: space.lg },
  dot: { width: 8, height: 8, borderRadius: 4 },
};
