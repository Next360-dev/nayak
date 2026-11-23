import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../src/hooks/useAuth';
import { createTask, fetchBoard, fetchTeamBriefing, resetTeamBriefing, saveTeamBriefing } from '../../src/api/board';
import { Button, Card, EmptyState, ErrorState, ScreenHeader, SectionHeader, StatStrip, TextField, Toast } from '../../src/ui';
import { Segmented } from '../../src/ui/NewsParts';
import { isOverdue, TaskCard } from '../../src/ui/TeamParts';
import { space, surface, type, useTheme } from '../../src/theme';

type Col = 'todo' | 'doing' | 'done';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type BriefingData = NonNullable<Awaited<ReturnType<typeof fetchTeamBriefing>>>;

// Mounted only after the server text has loaded, and re-keyed on every save/reset, so the box always starts from the real text.
function BriefingEditor({ lang, data, onToast }: { lang: 'en' | 'te'; data: BriefingData; onToast: (m: string) => void }) {
  const { c } = useTheme();
  const qc = useQueryClient();
  const [text, setText] = useState(data.text);
  const [busy, setBusy] = useState(false);
  const dirty = text.trim() !== data.text.trim();
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); await qc.invalidateQueries({ queryKey: ['briefing', lang] }); onToast(ok); } catch { onToast('Could not save the briefing'); } finally { setBusy(false); }
  };
  return (
    <>
      <Text style={[type.caption, { color: c.muted }]}>{data.edited ? `Edited${data.edited_by ? ` by ${data.edited_by}` : ''}` : 'Written automatically from today’s news'}</Text>
      <TextField label="Briefing" value={text} onChangeText={setText} multiline textAlignVertical="top" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><Button label="Save" onPress={() => { void run(() => saveTeamBriefing(lang, text.trim()), 'Briefing saved'); }} loading={busy} disabled={!dirty || !text.trim()} /></View>
        {data.edited ? <View style={{ flex: 1 }}><Button label="Reset" variant="secondary" onPress={() => { void run(() => resetTeamBriefing(lang), 'Back to automatic'); }} disabled={busy} /></View> : null}
      </View>
    </>
  );
}

function Briefing({ onToast }: { onToast: (m: string) => void }) {
  const { c } = useTheme();
  const [lang, setLang] = useState<'en' | 'te'>('en');
  const q = useQuery({ queryKey: ['briefing', lang], queryFn: () => fetchTeamBriefing(lang) });
  return (
    <Card style={{ padding: space.lg, gap: space.md }}>
      <Segmented options={[{ id: 'en', label: 'English' }, { id: 'te', label: 'తెలుగు' }]} value={lang} onChange={(v) => setLang(v === 'te' ? 'te' : 'en')} />
      {q.isLoading ? <Text style={[type.caption, { color: c.muted }]}>Loading</Text> : q.isError || !q.data ? <Text style={[type.caption, { color: c.danger }]}>Could not load the briefing.</Text> : (
        <BriefingEditor key={`${lang}-${q.data.edited}-${q.data.updated_at ?? ''}`} lang={lang} data={q.data} onToast={onToast} />
      )}
    </Card>
  );
}

function AddTask({ members, onDone, onToast }: { members: string[]; onDone: () => void; onToast: (m: string) => void }) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [due, setDue] = useState('');
  const [who, setWho] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dueBad = due.trim() !== '' && !DATE_RE.test(due.trim());
  const save = async () => {
    setBusy(true);
    try {
      await createTask({ title: title.trim(), note: note.trim() || null, due_date: due.trim() || null, assigned_to: who });
      onToast('Task added');
      onDone();
    } catch { onToast('Could not add the task'); } finally { setBusy(false); }
  };
  return (
    <Card style={{ padding: space.lg, gap: space.md }}>
      <TextField label="Task" value={title} onChangeText={setTitle} maxLength={200} />
      <TextField label="Detail (optional)" value={note} onChangeText={setNote} multiline textAlignVertical="top" />
      <TextField label="Due date (YYYY-MM-DD, optional)" value={due} onChangeText={setDue} error={dueBad ? 'Use the form 2026-12-31' : undefined} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
      {members.length > 0 ? (
        <Segmented options={[{ id: '', label: 'Nobody' }, ...members.slice(0, 3).map((m) => ({ id: m, label: m }))]} value={who ?? ''} onChange={(v) => setWho(v || null)} />
      ) : null}
      <Button label="Add task" onPress={save} loading={busy} disabled={!title.trim() || dueBad} />
    </Card>
  );
}

export default function TeamScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { c } = useTheme();
  const isLeader = user?.role === 'mla' || user?.role === 'minister';
  const board = useQuery({ queryKey: ['board'], queryFn: fetchBoard });
  const qc = useQueryClient();
  const [col, setCol] = useState<Col>('todo');
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
  const showToast = useCallback((m: string) => setToast({ message: m, visible: true }), []);
  const reload = useCallback(() => { void qc.invalidateQueries({ queryKey: ['board'] }); void qc.invalidateQueries({ queryKey: ['dashboard'] }); }, [qc]);

  const tasks = useMemo(() => board.data?.tasks ?? [], [board.data]);
  const members = board.data?.members ?? [];
  const canManage = !!board.data?.can_manage;
  const counts = useMemo(() => ({
    todo: tasks.filter((t) => t.status === 'todo').length,
    doing: tasks.filter((t) => t.status === 'doing').length,
    done: tasks.filter((t) => t.status === 'done').length,
    overdue: tasks.filter(isOverdue).length,
  }), [tasks]);
  const shown = tasks.filter((t) => t.status === col);
  const leaderName = board.data?.leader || user?.politician_name || user?.username || '';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title="Team board"
        subtitle={board.data ? `${leaderName} · ${members.length} ${members.length === 1 ? 'member' : 'members'}` : undefined}
        actions={isLeader ? [{ icon: 'groups', label: 'Manage my team', onPress: () => router.push('/my-team') }] : undefined}
      />
      {board.isLoading ? <View style={{ padding: space.lg }}><Text style={[type.body, { color: c.muted }]}>Loading</Text></View> : board.isError ? (
        <ErrorState message="Could not load the team board." onRetry={() => { void board.refetch(); }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={board.isRefetching} onRefresh={() => { void board.refetch(); }} tintColor={c.accent} />}
        >
          <StatStrip items={[
            { label: 'to do', value: counts.todo },
            { label: 'doing', value: counts.doing },
            { label: 'done', value: counts.done },
            { label: 'overdue', value: counts.overdue, tone: counts.overdue > 0 ? 'danger' : undefined },
          ]} />

          {canManage ? (adding ? <AddTask members={members} onToast={showToast} onDone={() => { setAdding(false); reload(); }} /> : <Button label="Add task" onPress={() => setAdding(true)} />) : (
            <Text style={[type.caption, { color: c.muted }]}>You can read tasks and add notes. Your staff manage the tasks.</Text>
          )}

          <Segmented options={[{ id: 'todo', label: `To do ${counts.todo}` }, { id: 'doing', label: `Doing ${counts.doing}` }, { id: 'done', label: `Done ${counts.done}` }]} value={col} onChange={(v) => setCol(v as Col)} />
          <Card>
            {shown.length === 0 ? (
              <EmptyState icon="check-circle-outline" title={col === 'todo' ? 'Nothing to do' : col === 'doing' ? 'Nothing in progress' : 'Nothing finished yet'} hint={canManage && col === 'todo' ? 'Add a task above.' : undefined} />
            ) : shown.map((t) => (
              <TaskCard key={t.id} task={t} members={members} canManage={canManage} onChanged={reload} onToast={showToast} />
            ))}
          </Card>

          {canManage ? (
            <>
              <SectionHeader title="Daily briefing" />
              <Briefing onToast={showToast} />
            </>
          ) : null}
        </ScrollView>
      )}
      {toast ? <Toast message={toast.message} visible={toast.visible} onDismiss={() => setToast(null)} /> : null}
    </KeyboardAvoidingView>
  );
}
