import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAudit } from '../../src/api/office';
import { Badge, Card, EmptyState, Row, TextField, ToolPage } from '../../src/ui';
import { relativeTime } from '../../src/lib/time';

// Admin only (the server refuses everyone else): who did what, newest first.
export default function AuditScreen() {
  const [s, setS] = useState('');
  const q = useQuery({ queryKey: ['audit', s], queryFn: () => fetchAudit(s.trim()) });
  const rows = q.data ?? [];
  return (
    <ToolPage title="Activity log" subtitle="Who did what" refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} error={q.isError} onRetry={() => { void q.refetch(); }}>
      <TextField label="Search by person or action" value={s} onChangeText={setS} autoCapitalize="none" />
      <Card>
        {rows.length === 0 ? <EmptyState icon="history" title={q.isLoading ? '…' : 'Nothing recorded'} /> : rows.map((e, i) => (
          <Row key={e.id} title={e.detail || e.action} titleLines={3} meta={`${e.actor} · ${relativeTime(e.at)}${e.target ? ` · ${e.target}` : ''}`} badges={<Badge label={e.action} tone="neutral" />} last={i === rows.length - 1} />
        ))}
      </Card>
    </ToolPage>
  );
}
