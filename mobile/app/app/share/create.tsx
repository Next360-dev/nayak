import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTargets, createShare } from '../../src/api/shares';
import { useAuth } from '../../src/hooks/useAuth';
import { Button, Card, EmptyState, ScreenHeader, TextField } from '../../src/ui';
import { radius, space, type, useTheme } from '../../src/theme';

// Sharing rules (the server enforces them too):
//   staff -> only their own MLA/minister (preselected)
//   MLA/minister -> only their own staff
//   master admin -> never shares
export default function CreateShareScreen() {
  const params = useLocalSearchParams<{ title?: string; url?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { c } = useTheme();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';
  const { data: targets, isLoading } = useQuery({ queryKey: ['targets'], queryFn: fetchTargets, enabled: !isAdmin });

  const [title, setTitle] = useState(params.title || '');
  const [url, setUrl] = useState(params.url || '');
  const [summary, setSummary] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState('normal');
  const [picked, setPicked] = useState<string[] | null>(null);
  const [sending, setSending] = useState(false);

  // Only one possible recipient (a staff member's own leader): it is chosen for them, until they change it.
  const onlyTarget = targets && targets.length === 1 ? targets[0].username : null;
  const chosen = picked ?? (onlyTarget ? [onlyTarget] : []);

  const toggleRecipient = (u: string) => {
    setPicked(chosen.includes(u) ? chosen.filter((x) => x !== u) : [...chosen, u]);
  };

  const onSend = async () => {
    if (!title.trim() || !url.trim()) { Alert.alert('Missing', 'Title and URL required'); return; }
    if (chosen.length === 0) { Alert.alert('Missing', 'Pick who to send it to'); return; }
    setSending(true);
    try {
      await createShare({
        title: title.trim(),
        url: url.trim(),
        summary: summary.trim() || undefined,
        note: note.trim() || undefined,
        priority,
        recipients: chosen,
      });
      void qc.invalidateQueries({ queryKey: ['sent'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      Alert.alert('Sent', chosen.length === 1 ? 'Your share was sent.' : `Your share was sent to ${chosen.length} people.`);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (isAdmin) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Share" onBack={() => router.back()} />
        <View style={{ padding: space.lg }}>
          <Card><EmptyState icon="visibility" title="The master admin does not share" hint="Staff share to their MLA or minister." /></Card>
        </View>
      </View>
    );
  }

  const heading = isStaff ? 'Send to my leader' : 'Send to my team';
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={heading} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2 }} keyboardShouldPersistTaps="handled">
        <TextField label="Title" value={title} onChangeText={setTitle} />
        <TextField label="Link" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" autoCorrect={false} />
        <TextField label="Summary (optional)" value={summary} onChangeText={setSummary} multiline textAlignVertical="top" />
        <TextField label="Note for them (optional)" value={note} onChangeText={setNote} multiline textAlignVertical="top" />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { color: c.text, fontWeight: '600' }]}>Mark as urgent</Text>
            <Text style={[type.caption, { color: c.muted }]}>They are shown first.</Text>
          </View>
          <Switch
            value={priority === 'urgent'}
            onValueChange={(v) => setPriority(v ? 'urgent' : 'normal')}
            trackColor={{ false: c.border, true: c.accent }}
            accessibilityLabel="Mark as urgent"
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={[type.headline, { color: c.text }]} accessibilityRole="header">Send to</Text>
          {isLoading ? <Text style={[type.caption, { color: c.muted }]}>Loading</Text> : null}
          {!isLoading && (targets || []).length === 0 ? (
            <Text style={[type.body, { color: c.muted }]}>{isStaff ? 'Your MLA or minister is not set up yet. Ask your admin.' : 'You have no active staff yet. Add them in the web app under "My team".'}</Text>
          ) : null}
          {(targets || []).map((t: any) => {
            const on = chosen.includes(t.username);
            return (
              <Pressable
                key={t.username}
                onPress={() => toggleRecipient(t.username)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`Send to ${t.name || t.politician_name || t.username}`}
                style={({ pressed }) => ({ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, borderRadius: radius.row, borderWidth: 1, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentBg : c.card, opacity: pressed ? 0.7 : 1 })}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? c.accent : c.muted, backgroundColor: on ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Text style={{ color: c.onAccent, fontSize: 13, fontWeight: '700' }}>✓</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: c.text, fontWeight: '600' }]}>{t.name || t.politician_name || t.username}</Text>
                  <Text style={[type.caption, { color: c.muted }]}>{t.role}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Button label="Send" onPress={onSend} loading={sending} disabled={chosen.length === 0 || !title.trim() || !url.trim()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
