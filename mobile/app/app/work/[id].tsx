import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchWorkItem, submitWorkItem, decideWorkItem, commentWorkItem, closeWorkItem } from '../../src/api/workItems';
import { WorkItem, WorkItemEvent } from '../../src/types';
import { BottomSheet, Button, Card, ErrorState, ScreenHeader, TextField, Toast } from '../../src/ui';
import { EVENT_LABEL, FactRow, Stepper, StatusPill, formatDue, kindLabel, useToneColors } from '../../src/ui/WorkParts';
import { relativeTime } from '../../src/lib/time';
import { hairline, radius, shadowBar, space, surface, type, useTheme } from '../../src/theme';

const EVENT_TONE: Record<string, 'neutral' | 'attention' | 'success' | 'danger'> = {
  approved: 'success',
  rejected: 'danger',
  changes_requested: 'attention',
  submitted: 'attention',
};

function nameOf(item: WorkItem, username: string) {
  if (username === item.created_by) return item.creator_name || username;
  if (username === item.team_leader) return item.leader_name || username;
  if (username === item.assignee) return item.assignee_name || username;
  return username;
}

export default function WorkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const tones = useToneColors();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
  const [sheet, setSheet] = useState<null | 'changes' | 'reject'>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['work-item', itemId],
    queryFn: () => fetchWorkItem(itemId),
    enabled: !!itemId,
  });

  const item = data?.item;
  const events: WorkItemEvent[] = data?.events || [];
  const can = data?.can;

  const showToast = useCallback((m: string) => setToast({ message: m, visible: true }), []);
  const ok = () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['work-items'] });
    void qc.invalidateQueries({ queryKey: ['work-item', itemId] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const run = async (fn: () => Promise<unknown>, done: string, fail: string) => {
    setBusy(true);
    try {
      await fn();
      invalidate();
      ok();
      showToast(done);
      return true;
    } catch (e: any) {
      showToast(e?.message || fail);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const doSubmit = () => run(() => submitWorkItem(itemId), 'Sent for decision', 'Could not send');
  const doApprove = () => run(() => decideWorkItem(itemId, 'approve'), 'Approved', 'Could not approve');
  const doClose = () => run(() => closeWorkItem(itemId), 'Closed', 'Could not close');

  const doNeedsNote = async () => {
    if (!sheet) return;
    if (!decisionNote.trim()) {
      setNoteError(sheet === 'reject' ? 'Write why you are rejecting this.' : 'Tell your team what to change.');
      return;
    }
    const passed = await run(
      () => decideWorkItem(itemId, sheet, decisionNote.trim()),
      sheet === 'reject' ? 'Rejected' : 'Sent back for changes',
      'Could not save your decision',
    );
    if (passed) { setSheet(null); setDecisionNote(''); setNoteError(''); }
  };

  const doComment = async () => {
    if (!commentText.trim()) return;
    const passed = await run(() => commentWorkItem(itemId, commentText.trim()), 'Comment added', 'Could not add comment');
    if (passed) setCommentText('');
  };

  const closeSheet = () => { setSheet(null); setNoteError(''); };

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Letter" onBack={() => router.back()} />
        <View style={{ padding: space.lg, gap: space.md }} accessibilityLabel="Loading">
          <Card style={{ padding: space.lg, gap: space.md }}>
            <View style={{ width: '40%', height: 12, borderRadius: radius.skeleton, backgroundColor: c.surface }} />
            <View style={{ width: '90%', height: 22, borderRadius: radius.skeleton, backgroundColor: c.surface }} />
            <View style={{ width: '70%', height: 22, borderRadius: radius.skeleton, backgroundColor: c.surface }} />
          </Card>
          <ActivityIndicator color={c.muted} />
        </View>
      </View>
    );
  }
  if (isError || !item) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Letter" onBack={() => router.back()} />
        <ErrorState message="This letter could not be opened. It may belong to another office." onRetry={() => { void refetch(); }} />
      </View>
    );
  }

  const due = item.status === 'approved' || item.status === 'closed' || item.status === 'rejected' ? null : formatDue(item.due_date);
  const hasAction = !!(can?.decide || can?.submit || can?.close);
  const outcome = item.decision_note && (item.status === 'approved' || item.status === 'rejected' || item.status === 'changes_requested')
    ? tones[item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'attention']
    : null;
  const outcomeTitle = item.status === 'approved' ? 'Note from the leader' : item.status === 'rejected' ? 'Why it was rejected' : 'What to change';

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title={item.kind === 'letter' ? 'Letter' : 'Petition'}
        subtitle={kindLabel(item)}
        onBack={() => router.back()}
        actions={can?.edit ? [{ icon: 'edit', label: 'Edit', onPress: () => router.push(`/work/new?id=${item.id}`) }] : undefined}
      />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: hasAction ? insets.bottom + 112 : insets.bottom + space.xl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} tintColor={c.accent} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ padding: space.lg, gap: space.lg }}>
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
              <StatusPill status={item.status} />
              {item.priority === 'urgent' ? (
                <View style={{ backgroundColor: c.dangerBg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ color: c.danger, fontSize: 12, fontWeight: '700' }}>Urgent</Text>
                </View>
              ) : null}
            </View>
            <Text selectable style={[type.display, { color: c.text }]}>{item.title}</Text>
          </View>
          <Stepper status={item.status} />
        </Card>

        {outcome ? (
          <View style={{ padding: space.lg, borderRadius: radius.card, backgroundColor: outcome.bg, gap: 4 }}>
            <Text style={{ color: outcome.fg, fontSize: 12, fontWeight: '700' }}>{outcomeTitle}</Text>
            <Text selectable style={[type.body, { color: c.text, lineHeight: 22 }]}>{item.decision_note}</Text>
            {item.decided_by ? <Text style={[type.caption, { color: c.muted }]}>{nameOf(item, item.decided_by)}{item.decided_at ? ` · ${relativeTime(item.decided_at)}` : ''}</Text> : null}
          </View>
        ) : null}

        <Card style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>
          <FactRow icon={item.direction === 'incoming' ? 'call-received' : 'call-made'} label={item.direction === 'incoming' ? 'From' : 'To'} value={item.counterpart || 'Not set'} />
          {item.reference_no ? <FactRow icon="tag" label="Reference" value={item.reference_no} /> : null}
          {due ? <FactRow icon="event" label="Due" value={due.text} tone={due.overdue ? 'danger' : undefined} /> : null}
          <FactRow icon="person-outline" label="Prepared by" value={item.creator_name || item.created_by} />
          {item.assignee ? <FactRow icon="assignment-ind" label="Assigned to" value={item.assignee_name || item.assignee} /> : null}
          <FactRow icon="account-balance" label="Decides" value={item.leader_name || item.team_leader} />
        </Card>

        {item.body ? (
          <Card style={{ padding: space.lg, gap: space.sm }}>
            <Text style={[type.caption, { color: c.muted, fontWeight: '700' }]}>CONTENT</Text>
            <Text selectable style={[type.reading, { color: c.text }]}>{item.body}</Text>
          </Card>
        ) : null}

        <View>
          <Text style={[type.headline, { color: c.text, marginBottom: space.sm, paddingHorizontal: space.xs }]} accessibilityRole="header">History</Text>
          <Card style={{ padding: space.lg }}>
            {events.length === 0 ? (
              <Text style={[type.caption, { color: c.muted }]}>Nothing has happened yet.</Text>
            ) : (
              events.map((e, i) => {
                const t = tones[EVENT_TONE[e.action] || 'neutral'];
                const last = i === events.length - 1;
                return (
                  <View key={e.id} style={{ flexDirection: 'row', gap: space.md }}>
                    <View style={{ alignItems: 'center', width: 14 }}>
                      <View style={{ width: 12, height: 12, borderRadius: radius.pill, marginTop: 4, backgroundColor: t.fg }} />
                      {!last ? <View style={{ flex: 1, width: 2, backgroundColor: hairline, marginTop: 2 }} /> : null}
                    </View>
                    <View style={{ flex: 1, paddingBottom: last ? 0 : space.lg, gap: 2 }}>
                      <Text style={[type.body, { color: c.text, fontWeight: '600' }]}>{EVENT_LABEL[e.action] || e.action}</Text>
                      <Text style={[type.caption, { color: c.muted }]}>{nameOf(item, e.actor)} · {relativeTime(e.created_at)}</Text>
                      {e.note ? <Text selectable style={[type.body, { color: c.text, marginTop: 4, lineHeight: 22 }]}>{e.note}</Text> : null}
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        </View>

        {can?.comment ? (
          <Card style={{ padding: space.lg, gap: space.md }}>
            <TextField label="Add a comment" value={commentText} onChangeText={setCommentText} multiline maxLength={2000} />
            <Button label="Post comment" variant="secondary" loading={busy} disabled={!commentText.trim()} onPress={() => { void doComment(); }} />
          </Card>
        ) : null}
      </ScrollView>

      {hasAction ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: surface, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md, gap: space.sm, boxShadow: shadowBar }}>
          {can?.decide ? (
            <>
              <Button label="Approve" variant="primary" loading={busy} onPress={() => { void doApprove(); }} />
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}><Button label="Ask for changes" variant="secondary" disabled={busy} onPress={() => setSheet('changes')} /></View>
                <View style={{ flex: 1 }}><Button label="Reject" variant="danger" disabled={busy} onPress={() => setSheet('reject')} /></View>
              </View>
            </>
          ) : null}
          {can?.submit ? <Button label="Send for decision" variant="primary" loading={busy} onPress={() => { void doSubmit(); }} /> : null}
          {can?.close ? <Button label="Close this letter" variant="secondary" loading={busy} onPress={() => { void doClose(); }} /> : null}
        </View>
      ) : null}

      <BottomSheet visible={sheet !== null} onClose={closeSheet} title={sheet === 'reject' ? 'Reject this letter' : 'Ask for changes'}>
        <View style={{ gap: space.md, paddingTop: space.md }}>
          <Text style={[type.body, { color: c.muted }]}>
            {sheet === 'reject' ? 'Your office will see this note. It cannot be sent again once rejected.' : 'Your office will see this note and can send it again.'}
          </Text>
          <TextField label="Note (required)" value={decisionNote} onChangeText={(t: string) => { setDecisionNote(t); if (noteError) setNoteError(''); }} multiline error={noteError} maxLength={1000} />
          <Button label={sheet === 'reject' ? 'Reject' : 'Send back'} variant={sheet === 'reject' ? 'danger' : 'primary'} loading={busy} onPress={() => { void doNeedsNote(); }} />
        </View>
      </BottomSheet>

      {toast && <Toast message={toast.message} visible={toast.visible} onDismiss={() => setToast(null)} />}
    </View>
  );
}
