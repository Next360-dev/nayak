import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createProject, fetchProjects, updateProject } from '../../src/api/office';
import { useAuth } from '../../src/hooks/useAuth';
import { Badge, Button, Card, EmptyState, Row, SectionHeader, TextField, Toast, ToolPage } from '../../src/ui';
import { space, type, useTheme } from '../../src/theme';
import { useLang } from '../../src/i18n';

export default function ProjectsScreen() {
  const { t } = useLang();
  const { c } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['projects'], queryFn: fetchProjects });
  const [title, setTitle] = useState('');
  const [miles, setMiles] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const isStaff = user?.role === 'staff';
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['projects'] }); };
  const create = useMutation({
    mutationFn: () => createProject({ title: title.trim(), status: 'active', milestones: miles.split('\n').map((m) => m.trim()).filter(Boolean) }),
    onSuccess: () => { setTitle(''); setMiles(''); refresh(); },
    onError: () => setToast('Could not create the project.'),
  });
  const toggle = useMutation({ mutationFn: ({ id, s }: { id: number; s: string }) => updateProject(id, { status: s }), onSuccess: refresh, onError: () => setToast('Could not update.') });
  const items = q.data ?? [];
  const mileText = (m: unknown) => (typeof m === 'string' ? m : (m as { title?: string })?.title ?? '');
  return (
    <ToolPage title={t('proj.title')} subtitle={t('proj.sub')} refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} error={q.isError} onRetry={() => { void q.refetch(); }}>
      {isStaff ? (
        <Card style={{ padding: space.lg, gap: space.md }}>
          <TextField label={t('proj.labelTitle')} value={title} onChangeText={setTitle} maxLength={200} />
          <TextField label={t('proj.labelMilestones')} value={miles} onChangeText={setMiles} multiline textAlignVertical="top" />
          <Button label={t('proj.create')} loading={create.isPending} disabled={!title.trim()} onPress={() => create.mutate()} />
        </Card>
      ) : null}
      <SectionHeader title={t('proj.list')} />
      <Card>
        {items.length === 0 ? <EmptyState icon="construction" title={t('proj.empty')} /> : items.map((p, i) => (
          <View key={p.id} style={{ borderBottomWidth: i === items.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
            <Row title={p.title} badges={<Badge label={p.status} tone={p.status === 'done' ? 'success' : 'attention'} />} last />
            {(p.milestones ?? []).map((m, k) => <Text key={k} style={[type.caption, { color: c.muted, paddingHorizontal: space.lg, paddingBottom: 4 }]}>• {mileText(m)}</Text>)}
            {isStaff ? <View style={{ padding: space.lg, paddingTop: space.sm }}><Button label={p.status === 'done' ? 'Reopen' : 'Mark done'} variant="secondary" onPress={() => toggle.mutate({ id: p.id, s: p.status === 'done' ? 'active' : 'done' })} disabled={toggle.isPending} /></View> : null}
          </View>
        ))}
      </Card>
      {toast ? <Toast message={toast} visible onDismiss={() => setToast(null)} /> : null}
    </ToolPage>
  );
}
