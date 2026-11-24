import React, { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPortfolio, PortfolioContent, savePortfolio } from '../../src/api/office';
import { useAuth } from '../../src/hooks/useAuth';
import { PUBLIC_WEB_URL } from '../../src/constants/config';
import { Badge, Button, Card, EmptyState, ErrorState, Row, ScreenHeader, SectionHeader, TextField, Toast } from '../../src/ui';
import { space, surface, type, useTheme } from '../../src/theme';
import { useLang } from '../../src/i18n';

const EMPTY: PortfolioContent = { full_name: '', avatar_url: '', title_en: '', title_te: '', biography_en: '', biography_te: '', constituency_office: '', ministerial_office: '', official_email: '', helpline: '', ministry_milestones: [], constituency_projects: [] };

// Staff edit and publish; leaders only read. The server enforces this too (PUT /api/portfolio is staff-only).
function Editor({ initial, onDone }: { initial: Partial<PortfolioContent>; onDone: (m: string) => void }) {
  const qc = useQueryClient();
  const [c, setC] = useState<PortfolioContent>({ ...EMPTY, ...initial });
  const [ms, setMs] = useState('');
  const [pr, setPr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof PortfolioContent) => (v: string) => setC({ ...c, [k]: v });
  const publish = async () => {
    setBusy(true);
    try { await savePortfolio(c); await qc.invalidateQueries({ queryKey: ['portfolio'] }); onDone('Portfolio published'); } catch { onDone('Could not publish. Check the email and photo link.'); } finally { setBusy(false); }
  };
  return (
    <Card style={{ padding: space.lg, gap: space.md }}>
      <TextField label="Full name" value={c.full_name} onChangeText={set('full_name')} maxLength={180} />
      <TextField label="Photo link (https://)" value={c.avatar_url} onChangeText={set('avatar_url')} autoCapitalize="none" keyboardType="url" />
      <TextField label="Title (English)" value={c.title_en} onChangeText={set('title_en')} maxLength={240} />
      <TextField label="Title (తెలుగు)" value={c.title_te} onChangeText={set('title_te')} maxLength={240} />
      <TextField label="Biography (English)" value={c.biography_en} onChangeText={set('biography_en')} multiline textAlignVertical="top" maxLength={5000} />
      <TextField label="Biography (తెలుగు)" value={c.biography_te} onChangeText={set('biography_te')} multiline textAlignVertical="top" maxLength={5000} />
      <TextField label="Constituency office" value={c.constituency_office} onChangeText={set('constituency_office')} />
      <TextField label="Ministerial office" value={c.ministerial_office} onChangeText={set('ministerial_office')} />
      <TextField label="Official email" value={c.official_email} onChangeText={set('official_email')} autoCapitalize="none" keyboardType="email-address" />
      <TextField label="Helpline" value={c.helpline} onChangeText={set('helpline')} keyboardType="phone-pad" maxLength={40} />
      <TextField label="Add a milestone" value={ms} onChangeText={setMs} />
      <Button label="Add milestone" variant="secondary" disabled={!ms.trim()} onPress={() => { setC({ ...c, ministry_milestones: [...c.ministry_milestones, { title: ms.trim(), description: '' }] }); setMs(''); }} />
      <TextField label="Add a constituency project" value={pr} onChangeText={setPr} />
      <Button label="Add project" variant="secondary" disabled={!pr.trim()} onPress={() => { setC({ ...c, constituency_projects: [...c.constituency_projects, { title: pr.trim(), status: 'In progress', location: '', description: '' }] }); setPr(''); }} />
      <Text style={type.caption}>{c.ministry_milestones.length} milestones · {c.constituency_projects.length} projects</Text>
      <Button label="Save and publish" loading={busy} onPress={() => { void publish(); }} />
    </Card>
  );
}

export default function PortfolioScreen() {
  const { t, lang } = useLang();
  const { c } = useTheme();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['portfolio'], queryFn: fetchPortfolio });
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const isStaff = user?.role === 'staff';
  const d = q.data?.content ?? {};
  const bio = (lang === 'te' ? d.biography_te : d.biography_en) || d.biography_en || d.biography_te;
  const title = (lang === 'te' ? d.title_te : d.title_en) || d.title_en || d.title_te;
  const empty = !d.full_name && !bio && !(d.ministry_milestones ?? []).length && !(d.constituency_projects ?? []).length;
  const publicUrl = q.data?.leader_username ? `${PUBLIC_WEB_URL}/public/portfolio/${encodeURIComponent(q.data.leader_username)}` : null;
  return (
    <View style={{ flex: 1, backgroundColor: surface }}>
      <ScreenHeader title={t('m.tab.portfolio')} subtitle={q.data ? (q.data.published ? 'Published' : 'Not published yet') : undefined} />
      {q.isError ? <ErrorState message="Could not load the portfolio." onRetry={() => { void q.refetch(); }} /> : (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl * 3 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {isStaff && q.data ? (editing ? <Editor key={String(q.data.updated_at)} initial={d} onDone={(m) => { setToast(m); setEditing(false); }} /> : <Button label={empty ? 'Fill in the portfolio' : 'Edit portfolio'} onPress={() => setEditing(true)} />) : null}
          {!editing ? (
            empty ? <Card><EmptyState icon="account-balance" title="No portfolio content yet" hint={isStaff ? 'Fill it in and publish it.' : 'Your office has not published it yet.'} /></Card> : (
              <>
                <Card style={{ padding: space.lg, gap: 6 }}>
                  <Text style={[type.headline, { color: c.text }]}>{d.full_name || q.data?.leader_name}</Text>
                  {title ? <Text style={[type.caption, { color: c.accentText, fontWeight: '700' }]}>{title}</Text> : null}
                  {bio ? <Text style={[type.reading, { color: c.text }]}>{bio}</Text> : null}
                </Card>
                {(d.constituency_office || d.ministerial_office || d.official_email || d.helpline) ? (
                  <Card>
                    {d.constituency_office ? <Row title="Constituency office" meta={d.constituency_office} /> : null}
                    {d.ministerial_office ? <Row title="Ministerial office" meta={d.ministerial_office} /> : null}
                    {d.official_email ? <Row title="Email" meta={d.official_email} onPress={() => { void Linking.openURL(`mailto:${d.official_email}`).catch(() => {}); }} /> : null}
                    {d.helpline ? <Row title="Helpline" meta={d.helpline} last onPress={() => { void Linking.openURL(`tel:${d.helpline}`).catch(() => {}); }} /> : null}
                  </Card>
                ) : null}
                {(d.ministry_milestones ?? []).length > 0 ? (<><SectionHeader title="Ministry milestones" /><Card>{(d.ministry_milestones ?? []).map((m, i, a) => <Row key={i} title={m.title} meta={[m.date, m.description].filter(Boolean).join(' · ')} titleLines={3} last={i === a.length - 1} />)}</Card></>) : null}
                {(d.constituency_projects ?? []).length > 0 ? (<><SectionHeader title="Constituency projects" /><Card>{(d.constituency_projects ?? []).map((p, i, a) => <Row key={i} title={p.title} meta={[p.location, p.description].filter(Boolean).join(' · ')} badges={<Badge label={p.status} tone="neutral" />} titleLines={3} last={i === a.length - 1} />)}</Card></>) : null}
              </>
            )
          ) : null}
          {publicUrl && q.data?.published ? <Button label="Public preview" variant="secondary" onPress={() => { void Linking.openURL(publicUrl).catch(() => {}); }} /> : null}
        </ScrollView>
      )}
      {toast ? <Toast message={toast} visible onDismiss={() => setToast(null)} /> : null}
    </View>
  );
}
