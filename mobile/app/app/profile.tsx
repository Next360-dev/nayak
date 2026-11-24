import React, { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchProfile, Profile, updateProfile } from '../src/api/profile';
import { fetchDashboard } from '../src/api/dashboard';
import { useAuth } from '../src/hooks/useAuth';
import { getPushToken } from '../src/lib/storage';
import { useLang } from '../src/i18n';
import { Badge, Button, Card, ConfirmButton, Row, SectionHeader, TextField, Toast, ToolPage } from '../src/ui';
import { radius, space, type, useTheme } from '../src/theme';

const ROLE_LABEL: Record<string, string> = { admin: 'Master admin', mla: 'MLA', minister: 'Minister', staff: 'Office staff' };

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
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard, enabled: user?.role === 'staff' });
  const [toast, setToast] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const name = user?.politician_name || user?.username || '';
  const initials = name.replace(/^dr\.?\s+/i, '').split(/[\s_]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  const role = user?.role === 'mla' || user?.role === 'minister' ? (user.leader_title || ROLE_LABEL[user.role]) : ROLE_LABEL[user?.role ?? ''] ?? '';
  const place = [user?.constituency_name && user.constituency_name !== 'All' ? user.constituency_name : '', user?.district_name && user.district_name !== 'All' ? user.district_name : ''].filter(Boolean).join(' · ');

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
        <View style={{ width: 88, height: 88, borderRadius: radius.pill, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.onAccent, fontSize: 32, fontWeight: '700' }}>{initials}</Text>
        </View>
        <Text style={[type.title, { color: c.text, textAlign: 'center' }]}>{name}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
          {role ? <Badge label={role} tone="neutral" /> : null}
          {user?.leader_party ? <Badge label={user.leader_party} tone="neutral" /> : null}
        </View>
        {place ? <Text style={[type.caption, { color: c.muted }]}>{place}</Text> : null}
        {user?.role === 'staff' && dash.data?.leader ? <Text style={[type.caption, { color: c.muted }]}>Working for {dash.data.leader.name}</Text> : null}
        <Text style={[type.caption, { color: c.muted }]}>@{user?.username}</Text>
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

      <SectionHeader title="Account" />
      <Card>
        <Row title={t('m.password')} meta="Other devices are signed out when you change it" onPress={() => router.push('/change-password')} />
        <Row title={t('m.more')} meta="Notifications, feedback, version" onPress={() => router.push('/(tabs)/settings' as never)} last />
      </Card>

      <ConfirmButton label={t('m.signout')} onConfirm={() => { void logout(); }} loading={leaving} />
      {toast ? <Toast message={toast} visible onDismiss={() => setToast(null)} /> : null}
    </ToolPage>
  );
}
