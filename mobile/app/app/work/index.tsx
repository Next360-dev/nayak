import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchWorkItems } from '../../src/api/workItems';
import { useAuth } from '../../src/hooks/useAuth';
import { WorkItem } from '../../src/types';
import { Card, EmptyState, ErrorState, ScreenHeader } from '../../src/ui';
import { StatusChips, WorkCard } from '../../src/ui/WorkParts';
import { radius, space, type, useTheme } from '../../src/theme';

const FILTERS: { key: string; label: string; match: (i: WorkItem) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'waiting', label: 'Waiting', match: (i) => i.status === 'submitted' },
  { key: 'changes', label: 'Changes', match: (i) => i.status === 'changes_requested' },
  { key: 'draft', label: 'Drafts', match: (i) => i.status === 'draft' },
  { key: 'approved', label: 'Approved', match: (i) => i.status === 'approved' },
  { key: 'done', label: 'Closed', match: (i) => i.status === 'closed' || i.status === 'rejected' },
];

export default function WorkListScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isLeader = user?.role === 'mla' || user?.role === 'minister';
  const [filter, setFilter] = useState('all');
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['work-items'],
    queryFn: () => fetchWorkItems({}),
  });

  const items: WorkItem[] = useMemo(() => data?.items || [], [data]);
  const chips = useMemo(() => FILTERS.map((f) => ({ key: f.key, label: f.label, count: items.filter(f.match).length })), [items]);
  const shown = useMemo(() => items.filter((FILTERS.find((f) => f.key === filter) || FILTERS[0]).match), [items, filter]);
  const waiting = chips.find((x) => x.key === 'waiting')?.count || 0;

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Letters & petitions"
        subtitle={isLeader ? 'Your office sends these for your decision' : 'Prepare and send for approval'}
        onBack={() => router.back()}
      />
      {isLoading ? (
        <View style={{ padding: space.lg, gap: space.md }} accessibilityLabel="Loading">
          <Card style={{ padding: space.lg, gap: space.md }}>
            {[0, 1, 2].map((n) => (
              <View key={n} style={{ gap: 8 }}>
                <View style={{ width: '80%', height: 14, borderRadius: radius.skeleton, backgroundColor: c.surface }} />
                <View style={{ width: '50%', height: 10, borderRadius: radius.skeleton, backgroundColor: c.surface }} />
              </View>
            ))}
          </Card>
          <ActivityIndicator color={c.muted} />
        </View>
      ) : isError ? (
        <ErrorState message="Could not load your letters." onRetry={() => { void refetch(); }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + 96 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} tintColor={c.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {isLeader && waiting > 0 && filter !== 'waiting' ? (
            <Pressable
              onPress={() => setFilter('waiting')}
              accessibilityRole="button"
              accessibilityLabel={`${waiting} waiting for your decision`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md + 2, borderRadius: radius.row, backgroundColor: c.attentionBg, opacity: pressed ? 0.8 : 1 })}
            >
              <MaterialIcons name="hourglass-top" size={20} color={c.attention} />
              <Text style={[type.body, { flex: 1, color: c.attention, fontWeight: '700' }]}>{waiting} waiting for your decision</Text>
              <MaterialIcons name="chevron-right" size={22} color={c.attention} />
            </Pressable>
          ) : null}

          {items.length > 0 ? <StatusChips options={chips} value={filter} onChange={setFilter} /> : null}

          <Card>
            {shown.length === 0 ? (
              items.length === 0 ? (
                <EmptyState
                  icon="mail-outline"
                  title="No letters or petitions yet"
                  hint={isLeader ? 'When your office sends one for approval it appears here.' : 'Tap New letter to prepare one and send it for approval.'}
                />
              ) : (
                <EmptyState icon="inbox" title="Nothing here" hint="Try another filter." />
              )
            ) : (
              shown.map((it, i) => <WorkCard key={it.id} item={it} last={i === shown.length - 1} onPress={() => router.push(`/work/${it.id}`)} />)
            )}
          </Card>
        </ScrollView>
      )}

      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.md }}>
        <Pressable
          onPress={() => router.push('/work/new')}
          accessibilityRole="button"
          accessibilityLabel="New letter or petition"
          style={({ pressed }) => ({ minHeight: 54, borderRadius: radius.pill, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, opacity: pressed ? 0.85 : 1, boxShadow: '0 8px 20px rgba(23,23,23,0.18)' })}
        >
          <MaterialIcons name="add" size={22} color={c.onAccent} />
          <Text style={[type.headline, { color: c.onAccent, fontWeight: '700' }]}>New letter</Text>
        </Pressable>
      </View>
    </View>
  );
}
