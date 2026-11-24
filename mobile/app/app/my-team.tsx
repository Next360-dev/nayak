import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../src/hooks/useAuth';
import {
  fetchTeam,
  createTeamMember,
  resetTeamPassword,
  setTeamActive,
  StaffMember,
} from '../src/api/board';
import { palette, surface } from '../src/theme';

const MIN_PW = 12;

export default function MyTeamScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();

  const isLeader = user?.role === 'mla' || user?.role === 'minister';

  const { data: staff, isLoading, isError, refetch } = useQuery<StaffMember[]>({
    queryKey: ['my-team'],
    queryFn: fetchTeam,
    enabled: !!user && isLeader,
  });

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Reset form
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');

  const reload = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['my-team'] });
    void refetch();
  }, [qc, refetch]);

  const run = async (fn: () => Promise<any>, okText: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
      reload();
      return true;
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Request failed' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    const u = newUsername.trim().toLowerCase();
    if (!u || !newPassword) {
      setMsg({ ok: false, text: 'Enter username and password.' });
      return;
    }
    if (newPassword.length < MIN_PW) {
      setMsg({ ok: false, text: `Password must be at least ${MIN_PW} characters.` });
      return;
    }
    const ok = await run(
      () => createTeamMember(u, newPassword),
      `Added ${u}.`,
    );
    if (ok) {
      setNewUsername('');
      setNewPassword('');
      setShowAdd(false);
    }
  };

  const handleReset = async (username: string) => {
    if (!resetPw) {
      setMsg({ ok: false, text: 'Enter a new password.' });
      return;
    }
    if (resetPw.length < MIN_PW) {
      setMsg({ ok: false, text: `Password must be at least ${MIN_PW} characters.` });
      return;
    }
    const ok = await run(
      () => resetTeamPassword(username, resetPw),
      `Password reset for ${username}. They must change it on next login.`,
    );
    if (ok) {
      setResetFor(null);
      setResetPw('');
    }
  };

  const handleToggle = async (s: StaffMember) => {
    const next = s.is_active === false;
    await run(
      () => setTeamActive(s.username, next),
      next ? `Enabled ${s.username}.` : `Disabled ${s.username}.`,
    );
  };

  if (!user) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }
  if (!isLeader) {
    return (
      <View style={styles.center}>
        <Text>My team is only for leaders.</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.link}>Back</Text></TouchableOpacity>
      </View>
    );
  }

  if (isLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (isError) {
    return (
      <View style={styles.center}>
        <Text>Failed to load team.</Text>
        <TouchableOpacity onPress={() => refetch()}><Text style={styles.link}>Retry</Text></TouchableOpacity>
      </View>
    );
  }

  const list = staff || [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>My team</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>Add, reset passwords, or disable your own staff. Reset sets &quot;must change password&quot;.</Text>

      {msg ? (
        <Text style={[styles.msg, msg.ok ? styles.msgOk : styles.msgErr]}>{msg.text}</Text>
      ) : null}

      {list.length === 0 ? (
        <Text style={styles.empty}>No staff yet.</Text>
      ) : null}

      {list.map((s) => {
        const disabled = s.is_active === false;
        return (
          <View key={s.username} style={[styles.row, disabled && styles.rowDisabled]}>
            <View style={styles.rowMain}>
              <Text style={styles.name}>
                {s.username}
                {disabled ? <Text style={styles.badge}>  disabled</Text> : null}
              </Text>
              <Text style={styles.meta}>
                last login {s.last_login ? new Date(s.last_login).toLocaleString() : 'never'}
              </Text>
            </View>

            {resetFor === s.username ? (
              <View style={styles.resetBox}>
                <TextInput
                  style={styles.input}
                  value={resetPw}
                  onChangeText={setResetPw}
                  placeholder={`New password (${MIN_PW}+ chars)`}
                  secureTextEntry
                  autoCapitalize="none"
                  accessibilityLabel={`New password for ${s.username}`}
                />
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
                    onPress={() => handleReset(s.username)}
                    disabled={busy}
                  >
                    <Text style={styles.btnPrimaryText}>{busy ? 'Saving…' : 'Save'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnOutline]}
                    onPress={() => { setResetFor(null); setResetPw(''); setMsg(null); }}
                  >
                    <Text style={styles.btnOutlineText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnOutline]}
                  onPress={() => { setResetFor(s.username); setResetPw(''); setMsg(null); }}
                >
                  <Text style={styles.btnOutlineText}>Reset password</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, disabled ? styles.btnEnable : styles.btnDisable, busy && styles.btnDisabled]}
                  onPress={() => handleToggle(s)}
                  disabled={busy}
                >
                  <Text style={disabled ? styles.btnEnableText : styles.btnDisableText}>
                    {disabled ? 'Enable' : 'Disable'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.section}>
        <TouchableOpacity style={styles.addToggle} onPress={() => setShowAdd((v) => !v)} accessibilityRole="button">
          <Text style={styles.addToggleText}>{showAdd ? '− Hide add form' : '+ Add staff'}</Text>
        </TouchableOpacity>

        {showAdd ? (
          <View style={styles.addBox}>
            <TextInput
              style={styles.input}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="Username"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="New staff username"
            />
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={`Password (${MIN_PW}+ chars)`}
              secureTextEntry
              autoCapitalize="none"
              accessibilityLabel="New staff password"
            />
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
              onPress={handleAdd}
              disabled={busy}
            >
              <Text style={styles.btnPrimaryText}>{busy ? 'Adding…' : 'Add staff'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  link: { color: palette.light.accent, marginTop: 8, fontSize: 15 },
  screen: { flex: 1, padding: 12, backgroundColor: 'transparent' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700' },
  backBtn: { paddingHorizontal: 8, paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  backBtnText: { color: palette.light.accent, fontSize: 15 },
  sub: { fontSize: 12, color: '#666', marginBottom: 10 },
  msg: { fontSize: 13, padding: 8, borderRadius: 6, marginBottom: 10 },
  msgOk: { color: palette.light.ok, backgroundColor: palette.light.okBg },
  msgErr: { color: palette.light.danger, backgroundColor: palette.light.dangerBg },
  empty: { fontSize: 13, color: '#999', fontStyle: 'italic', marginVertical: 8 },
  row: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10, marginBottom: 8 },
  rowDisabled: { opacity: 0.6 },
  rowMain: { marginBottom: 8 },
  name: { fontSize: 15, fontWeight: '600' },
  badge: { fontSize: 12, color: palette.light.danger, fontWeight: '600' },
  meta: { fontSize: 11, color: '#888', marginTop: 2 },
  resetBox: { gap: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, fontSize: 14, marginBottom: 6, backgroundColor: surface },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: palette.light.accent },
  btnPrimaryText: { color: palette.light.card, fontSize: 13, fontWeight: '600' },
  btnOutline: { backgroundColor: '#e0e0e0' },
  btnOutlineText: { color: '#333', fontSize: 13 },
  btnDisable: { backgroundColor: palette.light.dangerBg },
  btnDisableText: { color: palette.light.danger, fontSize: 13, fontWeight: '600' },
  btnEnable: { backgroundColor: palette.light.okBg },
  btnEnableText: { color: palette.light.ok, fontSize: 13, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  section: { marginTop: 16 },
  addToggle: { backgroundColor: palette.light.accent, padding: 12, borderRadius: 8, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  addToggleText: { color: palette.light.card, fontWeight: '600' },
  addBox: { marginTop: 10, padding: 10, backgroundColor: '#f0f4fa', borderRadius: 8 },
});
