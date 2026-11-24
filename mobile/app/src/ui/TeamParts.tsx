import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addTaskNote, fetchTaskNotes, TeamTask, updateTask } from '../api/board';
import { radius, space, type, useTheme } from '../theme';
import { relativeTime } from '../lib/time';
import { Badge } from './primitives';
import { Button } from './Button';
import { TextField } from './TextField';

const todayIso = () => new Date().toISOString().slice(0, 10);
export const isOverdue = (t: TeamTask) => t.status !== 'done' && !!t.due_date && t.due_date.slice(0, 10) < todayIso();

function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      accessibilityLabel={label}
      style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentBg : c.card, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
    >
      <Text style={[type.caption, { color: on ? c.accentText : c.text, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

function Notes({ task, onToast }: { task: TeamTask; onToast: (m: string) => void }) {
  const { c } = useTheme();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['task-notes', task.id], queryFn: () => fetchTaskNotes(task.id) });
  const send = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await addTaskNote(task.id, draft.trim());
      setDraft('');
      void qc.invalidateQueries({ queryKey: ['task-notes', task.id] });
      void qc.invalidateQueries({ queryKey: ['board'] });
    } catch { onToast('Could not add the note'); } finally { setBusy(false); }
  };
  return (
    <View style={{ gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: c.border }}>
      {q.isLoading ? <Text style={[type.caption, { color: c.muted }]}>Loading notes</Text> : null}
      {(q.data?.notes ?? []).map((n) => (
        <View key={n.id}>
          <Text style={[type.caption, { color: c.muted }]}>{n.author} · {relativeTime(n.created_at)}</Text>
          <Text style={[type.body, { color: c.text }]}>{n.body}</Text>
        </View>
      ))}
      <TextField label="Add a note" value={draft} onChangeText={setDraft} maxLength={1000} multiline textAlignVertical="top" />
      <Button label="Add note" variant="secondary" onPress={send} loading={busy} disabled={!draft.trim()} />
    </View>
  );
}

export function TaskCard({
  task, members, canManage, onChanged, onToast,
}: { task: TeamTask; members: string[]; canManage: boolean; onChanged: () => void; onToast: (m: string) => void }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const overdue = isOverdue(task);
  const patch = async (p: { status?: string; assigned_to?: string | null }, msg: string) => {
    setBusy(true);
    try { await updateTask(task.id, p); onChanged(); onToast(msg); } catch { onToast('Could not update the task'); } finally { setBusy(false); }
  };
  return (
    <View style={{ padding: space.lg, gap: space.sm, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${task.title}. ${open ? 'Hide' : 'Show'} notes`} style={{ gap: 6 }}>
        <Text style={[type.body, { color: c.text, fontWeight: '700' }]}>{task.title}</Text>
        {task.note ? <Text style={[type.caption, { color: c.muted }]}>{task.note}</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
          {overdue ? <Badge label="Overdue" tone="danger" /> : task.due_date ? <Badge label={`Due ${task.due_date.slice(0, 10)}`} tone="neutral" /> : null}
          <Text style={[type.caption, { color: c.muted }]}>{task.assigned_to ? `for ${task.assigned_to}` : 'Unassigned'} · by {task.created_by}{(task.notes ?? 0) > 0 ? ` · ${task.notes} notes` : ''}</Text>
        </View>
      </Pressable>
      {canManage ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {task.status !== 'todo' ? <Chip label="To do" onPress={() => { void patch({ status: 'todo' }, 'Moved to To do'); }} /> : null}
            {task.status !== 'doing' ? <Chip label="Start" onPress={() => { void patch({ status: 'doing' }, 'Moved to Doing'); }} /> : null}
            {task.status !== 'done' ? <Chip label="Done" on onPress={() => { void patch({ status: 'done' }, 'Marked as done'); }} /> : null}
          </View>
          {members.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, opacity: busy ? 0.5 : 1 }}>
              {members.map((m) => <Chip key={m} label={m} on={task.assigned_to === m} onPress={() => { void patch({ assigned_to: task.assigned_to === m ? '' : m }, task.assigned_to === m ? 'Unassigned' : `Assigned to ${m}`); }} />)}
            </View>
          ) : null}
        </>
      ) : null}
      {open ? <Notes task={task} onToast={onToast} /> : null}
    </View>
  );
}
