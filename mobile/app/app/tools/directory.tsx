import React, { useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchRepresentatives } from '../../src/api/office';
import { Badge, Card, EmptyState, Row, TextField, ToolPage } from '../../src/ui';

export default function DirectoryScreen() {
  const q = useQuery({ queryKey: ['representatives'], queryFn: fetchRepresentatives });
  const [s, setS] = useState('');
  const rows = useMemo(() => {
    const k = s.trim().toLowerCase();
    const all = q.data ?? [];
    return k ? all.filter((r) => [r.name, r.constituency_name, r.district_name, r.party].some((v) => (v ?? '').toLowerCase().includes(k))) : all;
  }, [q.data, s]);
  return (
    <ToolPage title="Directory" subtitle="Representatives" refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} error={q.isError} onRetry={() => { void q.refetch(); }}>
      <TextField label="Search name, constituency, district or party" value={s} onChangeText={setS} />
      <Card>
        {rows.length === 0 ? <EmptyState icon="groups" title={q.isLoading ? '…' : 'No representatives found'} /> : rows.slice(0, 150).map((r, i, a) => (
          <Row key={`${r.name}-${i}`} title={r.name} meta={[r.constituency_name, r.district_name].filter(Boolean).join(' · ') || undefined}
            badges={r.party ? <Badge label={r.party} tone="neutral" /> : undefined} last={i === a.length - 1}
            // Phone and email stay "not available" until real data is loaded: nothing is invented.
            onPress={r.contact_phone ? () => { void Linking.openURL(`tel:${r.contact_phone}`).catch(() => {}); } : undefined} />
        ))}
      </Card>
    </ToolPage>
  );
}
