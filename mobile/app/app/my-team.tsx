import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTeamMember, fetchTeam, resetTeamPassword, setTeamActive, StaffMember } from '../src/api/board';
import { ApiError } from '../src/api/client';
import { Badge, Button, Card, EmptyState, SectionHeader, TextField, Toast, ToolPage } from '../src/ui';
import { relativeTime } from '../src/lib/time';
import { space, type, useTheme } from '../src/theme';
import { useLang } from '../src/i18n';

const MIN = 12; // the server enforces the same rule

function Member({ m, onToast }: { m: StaffMember; onToast: (s: string) => void }) {
  const { c } = useTheme();
  const qc = useQueryClient();
  const [pw, setPw] = useState('');
  const [open, setOpen] = useState(false);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['team'] }); };
  const reset = useMutation({
    mutationFn: () => resetTeamPassword(m.username, pw),
    onSuccess: () => { setPw(''); setOpen(false); onToast(`Password reset for ${m.username}. They must change it at next sign-in.`); },
    onError: (e) => onToast((e as ApiError).message || 'Could not reset the password.'),
  });
  const toggle = useMutation({ mutationFn: () => setTeamActive(m.username, !m.is_active), onSuccess: refresh, onError: () => onToast('Could not update.') });
  const confirmToggle = () => Alert.alert(m.is_active ? 'Disable this login?' : 'Enable this login?', m.is_active ? `${m.username} is signed out at once and cannot sign in.` : `${m.username} can sign in again.`, [{ text: 'Cancel', style: 'cancel' }, { text: m.is_active ? 'Disable' : 'Enable', onPress: () => toggle.mutate() }]);
  return (
    <View style={{ padding: space.lg, gap: space.sm, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={[type.body, { color: c.text, fontWeight: '700', flex: 1 }]}>{m.username}</Text>
        <Badge label={m.is_active ? 'Active' : 'Disabled'} tone={m.is_active ? 'success' : 'danger'} />
      </View>
      <Text style={[type.caption, { color: c.muted }]}>{m.last_login ? `Last sign-in ${relativeTime(m.last_login)}` : 'Never signed in'}</Text>
      {open ? (
        <>
          <TextField label={`New password (at least ${MIN} characters)`} value={pw} onChangeText={setPw} secure autoCapitalize="none" />
          <Button label="Reset password" loading={reset.isPending} disabled={pw.length < MIN} onPress={() => reset.mutate()} />
        </>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><Button label={open ? 'Cancel' : 'Reset password'} variant="secondary" onPress={() => { setOpen(!open); setPw(''); }} /></View>
        <View style={{ flex: 1 }}><Button label={m.is_active ? 'Disable' : 'Enable'} variant={m.is_active ? 'danger' : 'secondary'} loading={toggle.isPending} onPress={confirmToggle} /></View>
      </View>
    </View>
  );
}

export default function MyTeamScreen() {
  const { t } = useLang();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['team'], queryFn: fetchTeam });
  const [u, setU] = useState('');
  const [pw, setPw] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => createTeamMember(u.trim().toLowerCase(), pw),
    onSuccess: () => { setToast(`Added ${u.trim()}. They must change the password at first sign-in.`); setU(''); setPw(''); void qc.invalidateQueries({ queryKey: ['team'] }); },
    onError: (e) => setToast((e as ApiError).message || 'Could not add the staff member.'),
  });
  const rows = q.data ?? [];
  return (
    <ToolPage title={t('btn.myTeam')} subtitle="Your office staff" refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} error={q.isError} onRetry={() => { void q.refetch(); }}>
      <Card style={{ padding: space.lg, gap: space.md }}>
        <TextField label="New staff username" value={u} onChangeText={setU} autoCapitalize="none" autoCorrect={false} />
        <TextField label={`Temporary password (at least ${MIN} characters)`} value={pw} onChangeText={setPw} secure autoCapitalize="none" />
        <Button label="Add staff member" loading={add.isPending} disabled={!u.trim() || pw.length < MIN} onPress={() => add.mutate()} />
      </Card>
      <SectionHeader title={`${rows.length} ${rows.length === 1 ? 'member' : 'members'}`} />
      <Card>
        {rows.length === 0 ? <EmptyState icon="groups" title={q.isLoading ? '…' : 'No staff yet'} hint="Add your first staff member above." /> : rows.map((m) => <Member key={m.username} m={m} onToast={setToast} />)}
      </Card>
      {toast ? <Toast message={toast} visible onDismiss={() => setToast(null)} /> : null}
    </ToolPage>
  );
}
