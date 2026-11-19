import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchWorkItem, createWorkItem, updateWorkItem, CreateWorkItemPayload } from '../../src/api/workItems';
import { fetchTargets } from '../../src/api/shares';
import { WorkItemDirection, WorkItemKind, WorkItemPriority } from '../../src/types';
import { Button, Card, ScreenHeader, TextField, Toast } from '../../src/ui';
import { SegmentedRow } from '../../src/ui/WorkParts';
import { radius, shadowBar, space, surface, type, useTheme } from '../../src/theme';

const KINDS: { id: WorkItemKind; label: string }[] = [{ id: 'letter', label: 'Letter' }, { id: 'petition', label: 'Petition' }];
const DIRECTIONS: { id: WorkItemDirection; label: string }[] = [{ id: 'incoming', label: 'Received' }, { id: 'outgoing', label: 'To send' }];
const PRIORITIES: { id: WorkItemPriority; label: string }[] = [{ id: 'normal', label: 'Normal' }, { id: 'urgent', label: 'Urgent' }];

const pad = (n: number) => String(n).padStart(2, '0');
const isoIn = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());

function Label({ children }: { children: string }) {
  const { c } = useTheme();
  return <Text style={[type.caption, { color: c.muted, fontWeight: '700' }]}>{children}</Text>;
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => ({ minHeight: 38, paddingHorizontal: 14, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentBg : surface, opacity: pressed ? 0.75 : 1 })}
    >
      <Text style={{ color: on ? c.accentText : c.text, fontSize: 13, fontWeight: on ? '700' : '600' }}>{label}</Text>
    </Pressable>
  );
}

export default function WorkNewScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [dueError, setDueError] = useState('');

  const [kind, setKind] = useState<WorkItemKind>('letter');
  const [direction, setDirection] = useState<WorkItemDirection>('incoming');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [counterpart, setCounterpart] = useState('');
  const [priority, setPriority] = useState<WorkItemPriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState('');

  const { data } = useQuery({
    queryKey: ['work-item', editId],
    queryFn: () => fetchWorkItem(editId as number),
    enabled: !!editId,
  });
  const { data: targets } = useQuery({ queryKey: ['share-targets'], queryFn: fetchTargets });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const it = data?.item;
    if (!it) return;
    setKind(it.kind);
    setDirection(it.direction);
    setTitle(it.title);
    setBody(it.body || '');
    setReferenceNo(it.reference_no || '');
    setCounterpart(it.counterpart || '');
    setPriority(it.priority);
    setDueDate(it.due_date || '');
    setAssignee(it.assignee || '');
  }, [data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const showToast = (m: string) => setToast({ message: m, visible: true });

  const onSave = async () => {
    let bad = false;
    if (!title.trim()) { setTitleError('Give it a short title.'); bad = true; }
    if (dueDate.trim() && !validDate(dueDate.trim())) { setDueError('Use the format YYYY-MM-DD, for example 2026-12-05.'); bad = true; }
    if (bad) return;
    const payload: CreateWorkItemPayload = {
      kind,
      direction,
      title: title.trim(),
      body: body.trim() || null,
      reference_no: referenceNo.trim() || null,
      counterpart: counterpart.trim() || null,
      priority,
      due_date: dueDate.trim() || null,
      assignee: assignee || null,
    };
    setSaving(true);
    try {
      let newId: number | null = null;
      if (editId) {
        await updateWorkItem(editId, payload);
      } else {
        const res = await createWorkItem(payload);
        newId = res?.item?.id ?? null;
      }
      void qc.invalidateQueries({ queryKey: ['work-items'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      if (editId) void qc.invalidateQueries({ queryKey: ['work-item', editId] });
      if (newId) router.replace(`/work/${newId}`);
      else router.back();
    } catch (e: any) {
      showToast(e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const party = direction === 'incoming' ? 'From' : 'To';
  const people = targets || [];

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={editId ? 'Edit' : 'New letter'} subtitle={editId ? undefined : 'Saved as a draft first'} onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Card style={{ padding: space.lg, gap: space.lg }}>
            <View style={{ gap: space.sm }}>
              <Label>WHAT IS IT</Label>
              <SegmentedRow options={KINDS} value={kind} onChange={setKind} />
            </View>
            <View style={{ gap: space.sm }}>
              <Label>WHICH WAY</Label>
              <SegmentedRow options={DIRECTIONS} value={direction} onChange={setDirection} />
            </View>
          </Card>

          <Card style={{ padding: space.lg, gap: space.lg }}>
            <TextField label="Title" value={title} onChangeText={(t: string) => { setTitle(t); if (titleError) setTitleError(''); }} error={titleError} maxLength={200} />
            <TextField label={`${party} (person or department)`} value={counterpart} onChangeText={setCounterpart} />
            <TextField label="Reference number (optional)" value={referenceNo} onChangeText={setReferenceNo} autoCapitalize="characters" />
            <TextField label="Content (optional)" value={body} onChangeText={setBody} multiline textAlignVertical="top" />
          </Card>

          <Card style={{ padding: space.lg, gap: space.lg }}>
            <View style={{ gap: space.sm }}>
              <Label>PRIORITY</Label>
              <SegmentedRow options={PRIORITIES} value={priority} onChange={setPriority} />
            </View>
            <View style={{ gap: space.sm }}>
              <Label>DUE DATE</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                <Chip label="None" on={!dueDate} onPress={() => { setDueDate(''); setDueError(''); }} />
                <Chip label="Tomorrow" on={dueDate === isoIn(1)} onPress={() => { setDueDate(isoIn(1)); setDueError(''); }} />
                <Chip label="In a week" on={dueDate === isoIn(7)} onPress={() => { setDueDate(isoIn(7)); setDueError(''); }} />
              </View>
              <TextField label="Or type a date (YYYY-MM-DD)" value={dueDate} onChangeText={(t: string) => { setDueDate(t); if (dueError) setDueError(''); }} error={dueError} keyboardType="numbers-and-punctuation" maxLength={10} />
            </View>
            {people.length > 0 ? (
              <View style={{ gap: space.sm }}>
                <Label>ASSIGN TO (OPTIONAL)</Label>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  <Chip label="No one" on={!assignee} onPress={() => setAssignee('')} />
                  {people.map((p) => (
                    <Chip key={p.username} label={p.name || p.username} on={assignee === p.username} onPress={() => setAssignee(p.username)} />
                  ))}
                </View>
              </View>
            ) : null}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: surface, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md, boxShadow: shadowBar }}>
        <Button label={editId ? 'Save changes' : 'Save draft'} variant="primary" loading={saving} onPress={() => { void onSave(); }} />
      </View>
      {toast && <Toast message={toast.message} visible={toast.visible} onDismiss={() => setToast(null)} />}
    </View>
  );
}
