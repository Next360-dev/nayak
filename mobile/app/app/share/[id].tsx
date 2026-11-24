import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Linking, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchReplies, postReply, updateStatus } from '../../src/api/shares';
import { Share, ShareReply } from '../../src/types';
import { MAX_REPLY_CHARS } from '../../src/constants/config';
import { Button, EmptyState, ScreenHeader, TextField, Toast } from '../../src/ui';
import { Segmented } from '../../src/ui/NewsParts';
import { TextLink } from '../../src/ui/HomeParts';
import { relativeTime } from '../../src/lib/time';
import { palette, hairline, radius, shadowCard, space, surface, useTheme } from '../../src/theme';

const STATUS_LABELS: Record<string, string> = { new: 'New', seen: 'Seen', acting: 'Acting', done: 'Done' };

export default function ShareDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shareId = Number(id);
  const qc = useQueryClient();
  const { c } = useTheme();
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);

  const router = useRouter();
  const { data: shares, isLoading: loadingShares } = useQuery({ queryKey: ['inbox'], queryFn: () => import('../../src/api/shares').then((m) => m.fetchInbox()) });
  const share: Share | undefined = (shares || []).find((s) => s.id === shareId);

  const { data: replies, refetch: refetchReplies } = useQuery({
    queryKey: ['replies', shareId],
    queryFn: () => fetchReplies(shareId),
    enabled: !!shareId,
  });

  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string>(share?.status || 'new');

  const showToast = useCallback((m: string) => setToast({ message: m, visible: true }), []);

  const changeStatus = async (next: 'seen' | 'acting' | 'done') => {
    const prev = status;
    setStatus(next);
    try {
      await updateStatus(shareId, next);
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      void qc.invalidateQueries({ queryKey: ['unread-count'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      showToast(`Marked ${STATUS_LABELS[next]}`);
    } catch {
      setStatus(prev);
      showToast('Failed to update status');
    }
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    if (replyText.length > MAX_REPLY_CHARS) { showToast(`Max ${MAX_REPLY_CHARS} chars`); return; }
    setSending(true);
    try {
      await postReply(shareId, replyText.trim());
      setReplyText('');
      void refetchReplies();
      showToast('Reply sent');
    } catch { showToast('Failed to send reply'); }
    finally { setSending(false); }
  };

  if (!share) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Share" onBack={() => router.back()} />
        {loadingShares ? null : <View style={{ padding: space.lg }}><EmptyState icon="mail-outline" title="This share is not in your inbox" hint="It may belong to someone else or was removed." /></View>}
      </View>
    );
  }

  const mine = (r: ShareReply) => r.sender === (share.sender || '');
  const statusSegments = [
    { id: 'seen', label: 'Seen' },
    { id: 'acting', label: 'Acting' },
    { id: 'done', label: 'Done' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: surface }}>
      <ScreenHeader title="Share" onBack={() => { }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl + 70 }}>
        <View style={[styles.card, { boxShadow: shadowCard }]}>
          <Text style={styles.title} numberOfLines={2}>{share.title}</Text>
          <Text style={styles.meta}>from {share.sender} · {relativeTime(share.created_at)}</Text>
          {share.summary ? (
            <View style={styles.block}>
              <Text style={styles.label}>Summary</Text>
              <Text style={styles.body}>{share.summary}</Text>
            </View>
          ) : null}
          {share.note ? (
            <View style={[styles.block, { backgroundColor: palette.light.surface, borderRadius: radius.row, padding: space.sm }]}>
              <Text style={styles.label}>Note</Text>
              <Text style={styles.body}>{share.note}</Text>
            </View>
          ) : null}
          {share.url ? (
            <TextLink label="Open source" onPress={() => Linking.openURL(share.url)} />
          ) : null}
          <Segmented options={statusSegments} value={status} onChange={(v) => changeStatus(v as 'seen' | 'acting' | 'done')} />
        </View>

        <Text style={styles.section}>Replies</Text>
        {(replies || []).map((r) => (
          <View key={r.id} style={[styles.bubble, { backgroundColor: mine(r) ? '#F6E8CF' : surface, alignSelf: mine(r) ? 'flex-end' : 'flex-start' }]}>
            <Text style={[styles.bubbleText, { color: mine(r) ? palette.light.text : c.text }]}>{r.body}</Text>
            <Text style={[styles.caption, { color: c.muted }]}>{mine(r) ? 'You' : r.sender} · {relativeTime(r.created_at)}</Text>
          </View>
        ))}

        <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={70}>
          <View style={styles.composer}>
            <TextField
              label="Reply"
              value={replyText}
              onChangeText={setReplyText}
              multiline
              minHeight={104}
              maxLength={MAX_REPLY_CHARS}
              error={replyText.length > 1800 ? 'Approaching 2000 char limit' : undefined}
            />
            <Button label="Send" variant="primary" onPress={sendReply} disabled={sending || !replyText.trim()} />
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
      {toast && <Toast message={toast.message} visible={toast.visible} onDismiss={() => setToast(null)} />}
    </View>
  );
}

const styles = {
  card: { marginHorizontal: space.lg, marginTop: space.sm, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: hairline, backgroundColor: surface },
  title: { fontSize: 17, fontWeight: '700' as const, color: palette.light.text, marginBottom: 6 },
  meta: { fontSize: 13, color: palette.light.muted, marginBottom: 12 },
  block: { marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '700' as const, color: palette.light.muted, marginBottom: 4 },
  body: { fontSize: 15, color: palette.light.text, lineHeight: 22 },
  section: { fontSize: 15, fontWeight: '700' as const, color: palette.light.text, marginTop: space.xl, marginBottom: space.sm, marginHorizontal: space.lg },
  bubble: { maxWidth: '85%', paddingHorizontal: space.sm, paddingVertical: 8, borderRadius: radius.summary, marginVertical: 4 },
  bubbleText: { fontSize: 14 },
  caption: { fontSize: 11 },
  composer: { flexDirection: 'row' as const, gap: space.sm, paddingHorizontal: space.lg, marginTop: space.sm },
};
