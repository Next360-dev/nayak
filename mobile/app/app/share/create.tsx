import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator, Alert, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchTargets, createShare } from '../../src/api/shares';
import { useAuth } from '../../src/hooks/useAuth';

// Sharing rules (the server enforces them too):
//   staff -> only their own MLA/minister (preselected)
//   MLA/minister -> only their own staff
//   master admin -> never shares
export default function CreateShareScreen() {
  const params = useLocalSearchParams<{ title?: string; url?: string }>();
  const router = useRouter();
  const { user } = useAuth();
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
      Alert.alert('Sent', 'Share created');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={[styles.hint, { padding: 16 }]}>The master admin monitors the system and does not share. Staff share to their MLA or minister.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>{isStaff ? 'Send to my MLA / minister' : 'Send to my team'}</Text>
      <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
      <TextInput style={styles.input} placeholder="URL" value={url} onChangeText={setUrl} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Summary (optional)" value={summary} onChangeText={setSummary} multiline />
      <TextInput style={styles.input} placeholder="Note (optional)" value={note} onChangeText={setNote} multiline />
      <View style={styles.row}>
        <Text>Urgent</Text>
        <Switch value={priority === 'urgent'} onValueChange={(v) => setPriority(v ? 'urgent' : 'normal')} />
      </View>

      <Text style={styles.section}>Send to</Text>
      {isLoading ? <ActivityIndicator /> : null}
      {!isLoading && (targets || []).length === 0 ? (
        <Text style={styles.hint}>{isStaff ? 'Your MLA or minister is not set up yet. Ask your admin.' : 'You have no active staff yet. Add them in the web app under "My team".'}</Text>
      ) : null}
      <FlatList
        data={targets || []}
        scrollEnabled={false}
        keyExtractor={(t: any) => t.username}
        renderItem={({ item }: { item: any }) => (
          <TouchableOpacity style={styles.recip} onPress={() => toggleRecipient(item.username)} accessibilityLabel={`Send to ${item.username}`}>
            <Text style={chosen.includes(item.username) ? styles.recipSelected : undefined}>
              {chosen.includes(item.username) ? '✓ ' : ''}{item.name || item.politician_name || item.username} ({item.role})
            </Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.send} onPress={onSend} disabled={sending || chosen.length === 0} accessibilityLabel="Send share">
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Send</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10, minHeight: 44 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  recip: { padding: 10, minHeight: 44, justifyContent: 'center' },
  recipSelected: { fontWeight: '700', color: '#1976d2' },
  hint: { color: '#666', marginBottom: 10 },
  send: { backgroundColor: '#1976d2', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12, minHeight: 44 },
  sendText: { color: '#fff', fontWeight: '600' },
});
