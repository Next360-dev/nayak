import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { checkWatchlistNow, fetchWatchlist, saveWatchlist } from '../../src/api/office';
import { useAuth } from '../../src/hooks/useAuth';
import { Button, Card, EmptyState, Row, SectionHeader, TextField, Toast, ToolPage } from '../../src/ui';
import { radius, space, type, useTheme } from '../../src/theme';
import { useLang } from '../../src/i18n';

const MAX = 5;

function Editor({ initial, onSaved }: { initial: string[]; onSaved: (m: string) => void }) {
  const { c } = useTheme();
  const { t } = useLang();
  const qc = useQueryClient();
  const [names, setNames] = useState(initial);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const add = () => {
    const n = draft.trim();
    if (!n || names.length >= MAX || names.some((x) => x.toLowerCase() === n.toLowerCase())) return;
    setNames([...names, n]); setDraft('');
  };
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); await qc.invalidateQueries({ queryKey: ['watchlist'] }); onSaved(ok); } catch { onSaved('Could not save. Try again.'); } finally { setBusy(false); }
  };
  return (
    <Card style={{ padding: space.lg, gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {names.length === 0 ? <Text style={[type.body, { color: c.muted }]}>{t('watch.empty')}</Text> : names.map((n) => (
          <Pressable key={n} onPress={() => setNames(names.filter((x) => x !== n))} accessibilityRole="button" accessibilityLabel={`Remove ${n}`}
            style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: c.accentBg, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[type.caption, { color: c.accentText, fontWeight: '700' }]}>{n}  ✕</Text>
          </Pressable>
        ))}
      </View>
      <TextField label={t('watch.placeholder')} value={draft} onChangeText={setDraft} maxLength={80} onSubmitEditing={add} returnKeyType="done" />
      <Text style={[type.caption, { color: c.muted }]}>{t('watch.limit')}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><Button label={t('watch.add')} variant="secondary" onPress={add} disabled={!draft.trim() || names.length >= MAX} /></View>
        <View style={{ flex: 1 }}><Button label={t('watch.save')} loading={busy} onPress={() => { void run(() => saveWatchlist(names), t('watch.saved')); }} /></View>
      </View>
      <Button label="Check now" variant="secondary" disabled={busy || names.length === 0} onPress={() => { void run(() => checkWatchlistNow(), 'Checked'); }} />
    </Card>
  );
}

export default function WatchlistScreen() {
  const { t } = useLang();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['watchlist'], queryFn: fetchWatchlist });
  const [toast, setToast] = useState<string | null>(null);
  const posts = q.data?.posts ?? [];
  return (
    <ToolPage title={t('watch.title')} subtitle={t('watch.sub')} refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} error={q.isError} onRetry={() => { void q.refetch(); }}>
      {user?.role === 'staff' && q.data ? <Editor key={(q.data.names ?? []).join('|')} initial={q.data.names ?? []} onSaved={setToast} /> : (
        <Text style={[type.caption]}>{(q.data?.names ?? []).join(', ') || t('watch.empty')}</Text>
      )}
      <SectionHeader title="Recent posts" />
      <Card>
        {posts.length === 0 ? <EmptyState icon="visibility" title="No posts found yet" /> : posts.map((p, i) => (
          <Row key={`${p.url}-${i}`} title={p.headline} meta={[p.name, p.platform].filter(Boolean).join(' · ')} last={i === posts.length - 1}
            onPress={p.url ? () => { void Linking.openURL(p.url as string).catch(() => {}); } : undefined} />
        ))}
      </Card>
      {toast ? <Toast message={toast} visible onDismiss={() => setToast(null)} /> : null}
    </ToolPage>
  );
}
