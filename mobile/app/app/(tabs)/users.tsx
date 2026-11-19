import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../src/hooks/useAuth';
import {
  fetchAllUsers,
  resetUserPassword,
  setUserActive,
  AdminUser,
} from '../../src/api/board';
import { surface } from '../../src/theme';

const MIN_PW = 12;

export default function UsersScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const isAdmin = user?.role === 'admin';

  const { data: users, isLoading, isError, refetch } = useQuery<AdminUser[]>({
    queryKey: ['all-users'],
    queryFn: fetchAllUsers,
    enabled: !!user && isAdmin,
  });

  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');

  const reload = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['all-users'] });
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
      () => resetUserPassword(username, resetPw),
      `Password reset for ${username}.`,
    );
    if (ok) {
      setResetFor(null);
      setResetPw('');
    }
  };

  const handleToggle = async (u: AdminUser) => {
    const next = u.is_active === false;
    await run(
      () => setUserActive(u.username, next),
      next ? `Enabled ${u.username}.` : `Disabled ${u.username}.`,
    );
  };

  const shown = useMemo(() => {
    const list = users || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((u) =>
      `${u.username} ${u.role} ${u.politician_name || ''} ${u.constituency_name || ''} ${u.works_for || ''}`.toLowerCase().includes(needle),
    );
  }, [users, q]);

  if (!user) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }
  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text>Users is only for admins.</Text>
      </View>
    );
  }

  if (isLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (isError) {
    return (
      <View style={styles.center}>
        <Text>Failed to load users.</Text>
        <TouchableOpacity onPress={() => refetch()}><Text style={styles.link}>Retry</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Users</Text>
      <Text style={styles.sub}>All accounts. Reset passwords or disable logins. No user creation on phone.</Text>

      <TextInput
        style={styles.search}
        value={q}
        onChangeText={setQ}
        placeholder="Search by name, role, constituency…"
        autoCapitalize="none"
        accessibilityLabel="Search users"
      />

      {msg ? (
        <Text style={[styles.msg, msg.ok ? styles.msgOk : styles.msgErr]}>{msg.text}</Text>
      ) : null}

      {shown.length === 0 ? (
        <Text style={styles.empty}>No users match.</Text>
      ) : null}

      {shown.map((u) => {
        const disabled = u.is_active === false;
        const place = [u.constituency_name, u.district_name].filter((x) => x && x !== 'All').join(' · ');
        return (
          <View key={u.username} style={[styles.row, disabled && styles.rowDisabled]}>
            <View style={styles.rowMain}>
              <Text style={styles.name}>
                {u.username} <Text style={styles.roleBadge}>{u.role}</Text>
                {disabled ? <Text style={styles.badge}>  disabled</Text> : null}
              </Text>
              <Text style={styles.meta}>
                {u.role === 'staff' ? `works for ${u.works_for || '?'}` : (u.politician_name && u.politician_name !== u.username ? u.politician_name : '')}
                {place ? ` · ${place}` : ''}
              </Text>
              <Text style={styles.meta}>
                last login {u.last_login ? new Date(u.last_login).toLocaleString() : 'never'}
              </Text>
            </View>

            {resetFor === u.username ? (
              <View style={styles.resetBox}>
                <TextInput
                  style={styles.input}
                  value={resetPw}
                  onChangeText={setResetPw}
                  placeholder={`New password (${MIN_PW}+ chars)`}
                  secureTextEntry
                  autoCapitalize="none"
                  accessibilityLabel={`New password for ${u.username}`}
                />
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
                    onPress={() => handleReset(u.username)}
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
                  onPress={() => { setResetFor(u.username); setResetPw(''); setMsg(null); }}
                >
                  <Text style={styles.btnOutlineText}>Reset password</Text>
                </TouchableOpacity>
                {u.role !== 'admin' ? (
                  <TouchableOpacity
                    style={[styles.btn, disabled ? styles.btnEnable : styles.btnDisable, busy && styles.btnDisabled]}
                    onPress={() => handleToggle(u)}
                    disabled={busy}
                  >
                    <Text style={disabled ? styles.btnEnableText : styles.btnDisableText}>
                      {disabled ? 'Enable' : 'Disable'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  link: { color: '#1976d2', marginTop: 8, fontSize: 15 },
  screen: { flex: 1, padding: 12, backgroundColor: 'transparent' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 12, color: '#666', marginBottom: 10 },
  search: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, fontSize: 14, marginBottom: 10, backgroundColor: surface },
  msg: { fontSize: 13, padding: 8, borderRadius: 6, marginBottom: 10 },
  msgOk: { color: '#2e7d32', backgroundColor: '#e8f5e9' },
  msgErr: { color: '#c62828', backgroundColor: '#ffebee' },
  empty: { fontSize: 13, color: '#999', fontStyle: 'italic', marginVertical: 8 },
  row: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10, marginBottom: 8 },
  rowDisabled: { opacity: 0.6 },
  rowMain: { marginBottom: 8 },
  name: { fontSize: 15, fontWeight: '600' },
  roleBadge: { fontSize: 12, color: '#1976d2', fontWeight: '600' },
  badge: { fontSize: 12, color: '#c62828', fontWeight: '600' },
  meta: { fontSize: 11, color: '#888', marginTop: 2 },
  resetBox: { gap: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, fontSize: 14, marginBottom: 6, backgroundColor: surface },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: '#1976d2' },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  btnOutline: { backgroundColor: '#e0e0e0' },
  btnOutlineText: { color: '#333', fontSize: 13 },
  btnDisable: { backgroundColor: '#ffebee' },
  btnDisableText: { color: '#c62828', fontSize: 13, fontWeight: '600' },
  btnEnable: { backgroundColor: '#e8f5e9' },
  btnEnableText: { color: '#2e7d32', fontSize: 13, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
});
