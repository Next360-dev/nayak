import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWhatsApp, uploadWhatsApp } from '../../src/api/office';
import { Badge, Button, Card, EmptyState, Row, SectionHeader, TextField, Toast, ToolPage } from '../../src/ui';
import { space } from '../../src/theme';
import { useLang } from '../../src/i18n';

export default function WhatsAppScreen() {
  const { t } = useLang();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['whatsapp'], queryFn: fetchWhatsApp });
  const [text, setText] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () => uploadWhatsApp(text.trim()),
    onSuccess: () => { setText(''); setToast(t('wa.send')); void qc.invalidateQueries({ queryKey: ['whatsapp'] }); },
    onError: () => setToast('Could not add the messages.'),
  });
  const items = q.data ?? [];
  return (
    <ToolPage title={t('wa.title')} subtitle={t('wa.sub')} refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} error={q.isError} onRetry={() => { void q.refetch(); }}>
      <Card style={{ padding: space.lg, gap: space.md }}>
        <TextField label={t('wa.label')} value={text} onChangeText={setText} multiline textAlignVertical="top" maxLength={20000} />
        <Button label={t('wa.send')} loading={send.isPending} disabled={!text.trim()} onPress={() => send.mutate()} />
      </Card>
      <SectionHeader title={t('wa.list')} />
      <Card>
        {items.length === 0 ? <EmptyState icon="chat" title={t('wa.empty')} /> : items.map((u, i) => (
          <Row key={u.id ?? i} title={u.raw_text} titleLines={3} last={i === items.length - 1}
            badges={(u.tags ?? []).length > 0 ? <>{(u.tags ?? []).slice(0, 3).map((g) => <Badge key={g} label={g} tone="neutral" />)}</> : <Badge label={t('wa.general')} tone="neutral" />} />
        ))}
      </Card>
      {toast ? <Toast message={toast} visible onDismiss={() => setToast(null)} /> : null}
    </ToolPage>
  );
}
