import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approveSuggestion, fetchSuggestions } from '../../src/api/office';
import { fetchTargets } from '../../src/api/shares';
import { useAuth } from '../../src/hooks/useAuth';
import { Badge, Button, Card, EmptyState, Toast, ToolPage } from '../../src/ui';
import { radius, space, type, useTheme } from '../../src/theme';

export default function SuggestionsScreen() {
  const { c } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isLeader = user?.role === 'mla' || user?.role === 'minister';
  const q = useQuery({ queryKey: ['suggestions'], queryFn: fetchSuggestions });
  const staff = useQuery({ queryKey: ['targets'], queryFn: fetchTargets, enabled: isLeader });
  const [assign, setAssign] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const approve = useMutation({
    mutationFn: ({ id }: { id: number }) => approveSuggestion(id, assign[id] ?? null),
    onSuccess: () => { setToast('Approved'); void qc.invalidateQueries({ queryKey: ['suggestions'] }); },
    onError: () => setToast('Could not approve.'),
  });
  const items = q.data ?? [];
  return (
    <ToolPage title="AI inbox" subtitle="Suggested next steps. Nothing happens until you approve." refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} error={q.isError} onRetry={() => { void q.refetch(); }}>
      {items.length === 0 ? <Card><EmptyState icon="lightbulb-outline" title="No suggestions right now" /></Card> : items.map((s) => (
        <Card key={s.id} style={{ padding: space.lg, gap: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge label={s.status} tone={s.status === 'approved' ? 'success' : 'attention'} />
            <Text style={[type.caption, { color: c.muted }]}>{s.source}</Text>
          </View>
          <Text style={[type.body, { color: c.text, fontWeight: '700' }]}>{s.title}</Text>
          <Text style={[type.body, { color: c.text }]}>{s.suggestion}</Text>
          {s.assigned_to ? <Text style={[type.caption, { color: c.muted }]}>Assigned to {s.assigned_to}</Text> : null}
          {isLeader && s.status === 'pending' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {(staff.data ?? []).map((m: { username: string }) => {
                  const on = assign[s.id] === m.username;
                  return (
                    <Pressable key={m.username} onPress={() => setAssign({ ...assign, [s.id]: on ? '' : m.username })} accessibilityRole="button" accessibilityState={{ selected: on }}
                      style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentBg : c.card, justifyContent: 'center' }}>
                      <Text style={[type.caption, { color: on ? c.accentText : c.text, fontWeight: '700' }]}>{m.username}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Button label={assign[s.id] ? `Approve and assign` : 'Approve'} onPress={() => approve.mutate({ id: s.id })} disabled={approve.isPending} />
            </>
          ) : null}
        </Card>
      ))}
      {toast ? <Toast message={toast} visible onDismiss={() => setToast(null)} /> : null}
    </ToolPage>
  );
}
