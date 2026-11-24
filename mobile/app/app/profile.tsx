import React, { useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchProfile, Profile, updateProfile } from '../src/api/profile';
import { fetchPortfolio } from '../src/api/office';
import { useAuth } from '../src/hooks/useAuth';
import { getPushToken } from '../src/lib/storage';
import { useLang } from '../src/i18n';
import { Badge, Button, Card, ConfirmButton, Portrait, Row, SectionHeader, TextField, Toast, ToolPage } from '../src/ui';
import { radius, space, type, useTheme } from '../src/theme';

// Contact editor is mounted only after the profile has loaded, so the boxes start from the saved values.
function ContactEditor({ initial, onToast }: { initial: Profile; onToast: (m: string) => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState(initial.email ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [alerts, setAlerts] = useState(!!initial.alerts_enabled);
  const [busy, setBusy] = useState(false);
  const bad = email.trim() !== '' && !/^\S+@\S+\.\S+$/.test(email.trim());
  const save = async (next?: boolean) => {
    setBusy(true);
    try {
      await updateProfile({ email: email.trim() || null, phone: phone.trim() || null, alerts_enabled: next ?? alerts });
      await qc.invalidateQueries({ queryKey: ['profile'] });
      onToast('Saved');
    } catch { onToast('Could not save. Try again.'); } finally { setBusy(false); }
  };
  return (
    <Card style={{ padding: space.lg, gap: space.md }}>
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} error={bad ? 'Enter a valid email' : undefined} />
      <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
      {initial.email_configured ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          <Text style={[type.body, { flex: 1 }]}>Email alerts</Text>
          <Switch value={alerts} onValueChange={(v) => { setAlerts(v); void save(v); }} accessibilityLabel="Email alerts" />
        </View>
      ) : null}
      <Button label="Save" loading={busy} disabled={bad} onPress={() => { void save(); }} />
    </Card>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { t, lang, setLang } = useLang();
  const { user, signOut } = useAuth();
  const profile = useQuery({ queryKey: ['profile'], queryFn: fetchProfile });
  const pf = useQuery({ queryKey: ['portfolio'], queryFn: fetchPortfolio, enabled: user?.role !== 'admin' });
  const [toast, setToast] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  // Whose profile this is: the leader's. A staff member sees their LEADER here (their own login details are under "Account").
  const isStaff = user?.role === 'staff';
  const d = pf.data;
  const about = d?.content ?? {};
  const name = about.full_name || d?.leader_name || (isStaff ? '' : user?.politician_name) || user?.username || '';
  const title = (lang === 'te' ? about.title_te : about.title_en) || about.title_en || d?.leader_title || '';
  const party = d?.leader_party || (isStaff ? '' : user?.leader_party) || '';
  const bio = (lang === 'te' ? about.biography_te : about.biography_en) || about.biography_en || about.biography_te || '';
  const showPlace = (v?: string | null) => (v && v !== 'All' ? v : '');
  const place = [showPlace(d?.constituency_name ?? user?.constituency_name), showPlace(d?.district_name ?? user?.district_name)].filter(Boolean).join(' · ');
  const hasOffice = !!(about.constituency_office || about.ministerial_office || about.official_email || about.helpline);

  // Sign out: drop this phone's push registration first, then end the session, then the gate sends you to the login screen.
  const logout = async () => {
    setLeaving(true);
    let token: string | null = null;
    try { token = await getPushToken(); } catch { token = null; }
    try { await signOut(token); } finally { setLeaving(false); }
  };

  return (
    <ToolPage title={t('m.profile')} refreshing={profile.isRefetching} onRefresh={() => { void profile.refetch(); }}>
      <Card style={{ padding: space.lg, alignItems: 'center', gap: space.sm }}>
        <Portrait photoUrl={about.avatar_url} name={name} size={96} />
        <Text style={[type.title, { color: c.text, textAlign: 'center' }]}>{name}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
          {title ? <Badge label={title} tone="neutral" /> : null}
          {party ? <Badge label={party} tone="neutral" /> : null}
          {isStaff ? <Badge label="Your leader" tone="neutral" /> : null}
        </View>
        {place ? <Text style={[type.caption, { color: c.muted }]}>{place}</Text> : null}
      </Card>

      {bio ? (<><SectionHeader title="About" /><Card style={{ padding: space.lg }}><Text selectable style={[type.reading, { color: c.text }]}>{bio}</Text></Card></>) : null}

      {hasOffice ? (
        <>
          <SectionHeader title="Office" />
          <Card>
            {about.constituency_office ? <Row title="Constituency office" meta={about.constituency_office} /> : null}
            {about.ministerial_office ? <Row title="Ministerial office" meta={about.ministerial_office} /> : null}
            {about.official_email ? <Row title="Email" meta={about.official_email} onPress={() => { void Linking.openURL(`mailto:${about.official_email}`).catch(() => {}); }} /> : null}
            {about.helpline ? <Row title="Helpline" meta={about.helpline} last onPress={() => { void Linking.openURL(`tel:${about.helpline}`).catch(() => {}); }} /> : null}
          </Card>
        </>
      ) : !bio ? (
        <Card style={{ padding: space.lg, gap: space.sm }}>
          <Text style={[type.body, { color: c.muted }]}>No biography or office details have been added yet.</Text>
          {isStaff ? <Button label="Add details in Portfolio" variant="secondary" onPress={() => router.push('/(tabs)/portfolio' as never)} /> : null}
        </Card>
      ) : null}

      <SectionHeader title="Account" />
      <Card>
        <Row title={user?.username ?? ''} meta={isStaff ? 'Office staff' : 'Signed in as'} />
      </Card>

      <SectionHeader title={t('m.contact')} />
      {profile.data ? <ContactEditor initial={profile.data} onToast={setToast} /> : <Card style={{ padding: space.lg }}><Text style={[type.caption, { color: c.muted }]}>{profile.isError ? 'Could not load your details.' : '…'}</Text></Card>}

      <SectionHeader title={t('m.language')} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {([['en', 'English'], ['te', 'తెలుగు']] as const).map(([k, label]) => (
          <Pressable key={k} onPress={() => setLang(k)} accessibilityRole="button" accessibilityState={{ selected: lang === k }}
            style={{ flex: 1, minHeight: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: lang === k ? c.accent : c.border, backgroundColor: lang === k ? c.accentBg : c.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[type.body, { color: lang === k ? c.accentText : c.text, fontWeight: '700' }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <Row title={t('m.password')} meta="Other devices are signed out when you change it" onPress={() => router.push('/change-password')} />
        <Row title={t('m.more')} meta="Notifications, feedback, version" onPress={() => router.push('/(tabs)/settings' as never)} last />
      </Card>

      <ConfirmButton label={t('m.signout')} onConfirm={() => { void logout(); }} loading={leaving} />
      {toast ? <Toast message={toast} visible onDismiss={() => setToast(null)} /> : null}
    </ToolPage>
  );
}
