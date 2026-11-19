import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/hooks/useAuth';
import { fetchBoard, createTask, updateTask, addTaskNote } from '../../src/api/board';
import { Badge, Button, GroupedList, ScreenHeader, StickyBar, TextField, Toast } from '../../src/ui';
import { Segmented } from '../../src/ui/NewsParts';
import { hairline, radius, shadowCard, space, surface, useTheme } from '../../src/theme';

function relativeTime(s?: string | null) {
  if (!s) return '';
  const diff = (Date.now() - new Date(s).getTime()) / 1000;
  if (Number.isNaN(diff)) return '';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function TeamScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { c } = useTheme();
  const isLeader = user?.role === 'mla' || user?.role === 'minister';
  const canManage = user?.role === 'staff';
  const leaderName = user?.politician_name || user?.username || '';
  const members = (user as any)?.members || [];

  const { data: board, isError, refetch } = useQuery({ queryKey: ['board'], queryFn: () => import('../../src/api/board').then((m) => m.fetchBoard()) });
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
  const [briefingLang, setBriefingLang] = useState<'en' | 'te'>('en');

  const showToast = useCallback((m: string) => setToast({ message: m, visible: true }), []);

  const tasks = (board?.tasks || []) as any[];
  const counts = useMemo(() => {
    const c = { todo: 0, doing: 0, done: 0 };
    for (const t of tasks) { const s = t.status as keyof typeof c; c[s] = (c[s] || 0) + 1; }
    return c;
  }, [tasks]);
  const overdue = tasks.filter((t) => t.status !== 'done' && t.due_date && new Date(t.due_date) < new Date()).length;

  const byStatus = useMemo(() => ({
    todo: tasks.filter((t) => t.status === 'todo'),
    doing: tasks.filter((t) => t.status === 'doing'),
    done: tasks.filter((t) => t.status === 'done'),
  }), [tasks]);

  const moveTask = useCallback(async (taskId: number, status: 'todo' | 'doing' | 'done') => {
    try {
      await updateTask(taskId, { status });
      void refetch();
      showToast(`Moved to ${status}`);
    } catch { showToast('Failed to move task'); }
  }, [refetch, showToast]);

  const addNote = useCallback(async (taskId: number, body: string) => {
    try {
      await addTaskNote(taskId, body);
      void refetch();
      showToast('Note added');
    } catch { showToast('Failed to add note'); }
  }, [refetch, showToast]);

  const saveBriefing = useCallback(async (body: string) => {
    try {
      const m = await import('../../src/api/board');
      await m.saveTeamBriefing(briefingLang, body);
      showToast('Briefing saved');
    } catch { showToast('Failed to save'); }
  }, [briefingLang, showToast]);

  const resetBriefing = useCallback(async () => {
    try {
      const m = await import('../../src/api/board');
      await m.resetTeamBriefing(briefingLang);
      showToast('Reset to automatic');
    } catch { showToast('Failed to reset'); }
  }, [briefingLang, showToast]);

  const header = (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, backgroundColor: surface, borderBottomWidth: 1, borderBottomColor: hairline }}>
      <ScreenHeader title="Team" actions={isLeader ? [{ icon: 'groups', label: 'My team', onPress: () => router.push('/my-team') }] : undefined} />
    </View>
  );

  const summary = (
    <View style={{ marginHorizontal: space.lg, marginTop: space.sm }}>
      <View style={[styles.summaryCard, { boxShadow: shadowCard }]}>
        <Text style={styles.summaryTitle}>Team of {leaderName}</Text>
        <View style={styles.avatarRow}>
          {members.slice(0, 5).map((m: any) => (
            <View key={m} style={styles.avatar} />
          ))}
          {members.length > 5 ? <Text style={styles.plusCount}>+{members.length - 5}</Text> : null}
        </View>
        <Text style={styles.summaryCaption}>{canManage ? 'You manage tasks' : 'You can view tasks and add notes'}</Text>
      </View>
    </View>
  );

  const column = (id: 'todo' | 'doing' | 'done', title: string, color: string) => {
    const items = byStatus[id];
    return (
      <View key={id} style={{ marginHorizontal: space.lg, marginTop: space.sm }}>
        <View style={{ flexDirection: 'row' as const, alignItems: 'center', gap: space.sm, marginBottom: space.sm }}>
          <Text style={styles.colTitle}>{title}</Text>
          <Text style={[styles.colCount, { color }]}>{items.length}</Text>
        </View>
        {items.length === 0 ? (
          <View style={[styles.emptyCard, { boxShadow: shadowCard }]}>
            <Text style={styles.emptyText}>Nothing here yet</Text>
          </View>
        ) : (
          <GroupedList sections={[{
            rows: items.map((t) => ({
              icon: 'checkbox-outline',
              iconColor: c.muted,
              title: t.title,
              value: `${t.assigned_to || 'Unassigned'} · due ${relativeTime(t.due_date)}`,
            }))
          }]} />
        )}
      </View>
    );
  };

  const briefing = canManage;

  return (
    <View style={{ flex: 1, backgroundColor: surface }}>
      {header}
      {summary}
      <StickyBar>
        <Segmented options={[{ id: 'todo', label: 'To do' }, { id: 'doing', label: 'Doing' }, { id: 'done', label: 'Done' }]} value='todo' onChange={() => { }} />
      </StickyBar>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: space.xl }}
        showsVerticalScrollIndicator={false}
        data={[{ id: 'todo' }, { id: 'doing' }, { id: 'done' }]}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => column(item.id as 'todo' | 'doing' | 'done',
          item.id === 'todo' ? 'To do' : item.id === 'doing' ? 'Doing' : 'Done',
          item.id === 'todo' ? c.text : item.id === 'doing' ? c.accent : c.ok)}
      />
      {canManage ? (
        <View style={{ paddingHorizontal: space.lg, marginTop: space.sm }}>
          <Button label="Add task" onPress={() => { }} />
        </View>
      ) : null}
      {briefing ? (
        <View style={{ marginHorizontal: space.lg, marginTop: space.sm }}>
          <View style={[styles.summaryCard, { boxShadow: shadowCard }]}>
            <Segmented options={[{ id: 'en', label: 'English' }, { id: 'te', label: 'తెలుగు' }]} value={briefingLang} onChange={(v) => setBriefingLang(v as 'en' | 'te')} />
            <TextField label="Briefing" value="" onChangeText={(b) => { }} multiline minHeight={104} />
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
              <Button label="Save" onPress={() => saveBriefing('')} variant="primary" />
              <Button label="Reset to automatic" onPress={resetBriefing} variant="secondary" />
            </View>
          </View>
        </View>
      ) : null}
      {toast && <Toast message={toast.message} visible={toast.visible} onDismiss={() => setToast(null)} />}
    </View>
  );
}

const styles = {
  summaryCard: { padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: hairline, backgroundColor: surface },
  summaryTitle: { fontSize: 15, fontWeight: '700' as const, color: '#171717', marginBottom: space.sm },
  avatarRow: { flexDirection: 'row' as const, gap: 6, marginBottom: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F2EEE6' },
  plusCount: { fontSize: 13, color: '#171717' },
  summaryCaption: { fontSize: 13, color: '#6B6B6B' },
  colTitle: { fontSize: 15, fontWeight: '700' as const },
  colCount: { fontSize: 13, fontWeight: '700' as const },
  emptyCard: { padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: hairline, backgroundColor: surface, alignItems: 'center' as const, justifyContent: 'center' as const, minHeight: 120 },
  emptyText: { fontSize: 14, color: '#6B6B6B' },
};
