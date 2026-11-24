import React from 'react';
import { Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchTop5 } from '../../src/api/office';
import { Badge, Card, EmptyState, Row, ToolPage } from '../../src/ui';
import { useLang } from '../../src/i18n';

export default function AlertsScreen() {
  const { t } = useLang();
  const q = useQuery({ queryKey: ['top5'], queryFn: fetchTop5, refetchInterval: 60000 });
  const stories = q.data ?? [];
  return (
    <ToolPage title={t('top.alerts.title')} subtitle={t('top.alerts.sub')} refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} error={q.isError} onRetry={() => { void q.refetch(); }}>
      <Card>
        {stories.length === 0 ? <EmptyState icon="check-circle-outline" title={q.isLoading ? '…' : t('m.caughtup')} /> : stories.map((s, i) => (
          <Row
            key={s.id ?? i}
            title={s.title || s.headline || ''}
            meta={s.district || s.district_name || undefined}
            badges={s.sentiment === 'negative' ? <Badge label="Negative" tone="danger" /> : undefined}
            last={i === stories.length - 1}
            onPress={s.url ? () => { void Linking.openURL(s.url as string).catch(() => {}); } : undefined}
          />
        ))}
      </Card>
    </ToolPage>
  );
}
