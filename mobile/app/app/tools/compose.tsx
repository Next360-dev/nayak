import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPost, decidePost, fetchPosts } from '../../src/api/office';
import { useAuth } from '../../src/hooks/useAuth';
import { Badge, Button, Card, EmptyState, Row, SectionHeader, TextField, Toast, ToolPage } from '../../src/ui';
import { radius, space, type, useTheme } from '../../src/theme';
import { useLang } from '../../src/i18n';

const PLATFORMS = [{ id: 'x', label: 'X / Twitter' }, { id: 'whatsapp', label: 'WhatsApp' }, { id: 'facebook', label: 'Facebook' }, { id: 'instagram', label: 'Instagram' }];
const WHEN_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/;
const TONE: Record<string, 'neutral' | 'success' | 'danger' | 'attention'> = { approved: 'success', rejected: 'danger', draft: 'attention' };

export default function ComposeScreen() {
  const { t } = useLang();
  const { c } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['posts'], queryFn: fetchPosts });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [when, setWhen] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const isStaff = user?.role === 'staff';
  const isLeader = user?.role === 'mla' || user?.role === 'minister';
  const whenBad = when.trim() !== '' && !WHEN_RE.test(when.trim());
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['posts'] }); };
  const save = useMutation({
    mutationFn: () => createPost({ title: title.trim(), body: body.trim(), platforms: picked, scheduled_at: when.trim() ? when.trim().replace(' ', 'T') : null }),
    onSuccess: () => { setTitle(''); setBody(''); setPicked([]); setWhen(''); setToast(t('compose.save')); refresh(); },
    onError: () => setToast('Could not save the post.'),
  });
  const decide = useMutation({ mutationFn: ({ id, s }: { id: number; s: 'approved' | 'rejected' }) => decidePost(id, s), onSuccess: refresh, onError: () => setToast('Could not update.') });
  const posts = q.data ?? [];
  return (
    <ToolPage title={t('compose.title')} refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} error={q.isError} onRetry={() => { void q.refetch(); }}>
      {isStaff ? (
        <Card style={{ padding: space.lg, gap: space.md }}>
          <TextField label={t('compose.labelTitle')} value={title} onChangeText={setTitle} maxLength={200} />
          <TextField label={t('compose.labelBody')} value={body} onChangeText={setBody} multiline textAlignVertical="top" maxLength={2000} />
          <Text style={[type.caption, { color: c.muted }]}>{t('compose.platforms')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {PLATFORMS.map((p) => {
              const on = picked.includes(p.id);
              return (
                <Pressable key={p.id} onPress={() => setPicked(on ? picked.filter((x) => x !== p.id) : [...picked, p.id])} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentBg : c.card, justifyContent: 'center' }}>
                  <Text style={[type.caption, { color: on ? c.accentText : c.text, fontWeight: '700' }]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextField label={`${t('compose.schedule')} (YYYY-MM-DD HH:MM)`} value={when} onChangeText={setWhen} error={whenBad ? 'Use the form 2026-12-31 18:30' : undefined} autoCapitalize="none" />
          <Text style={[type.caption, { color: c.muted }]}>Posting to the platforms is not connected yet: approved posts are stored and ready to publish.</Text>
          <Button label={t('compose.save')} loading={save.isPending} disabled={!title.trim() || !body.trim() || picked.length === 0 || whenBad} onPress={() => save.mutate()} />
        </Card>
      ) : null}
      <SectionHeader title={t('compose.posts')} />
      <Card>
        {posts.length === 0 ? <EmptyState icon="edit" title={t('compose.empty')} /> : posts.map((p, i) => (
          <View key={p.id}>
            <Row title={p.title} meta={`${(p.platforms ?? []).join(', ') || '—'} · ${p.scheduled_at || t('compose.now')}`} badges={<Badge label={p.status} tone={TONE[p.status] ?? 'neutral'} />} last={!(isLeader && p.status === 'draft') && i === posts.length - 1} />
            {isLeader && p.status === 'draft' ? (
              <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md }}>
                <View style={{ flex: 1 }}><Button label={t('compose.approve')} onPress={() => decide.mutate({ id: p.id, s: 'approved' })} disabled={decide.isPending} /></View>
                <View style={{ flex: 1 }}><Button label={t('compose.reject')} variant="secondary" onPress={() => decide.mutate({ id: p.id, s: 'rejected' })} disabled={decide.isPending} /></View>
              </View>
            ) : null}
          </View>
        ))}
      </Card>
      {toast ? <Toast message={toast} visible onDismiss={() => setToast(null)} /> : null}
    </ToolPage>
  );
}
