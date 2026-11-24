import React from 'react';
import { Share, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchSurveyResults } from '../../src/api/office';
import { useAuth } from '../../src/hooks/useAuth';
import { PUBLIC_WEB_URL } from '../../src/constants/config';
import { Button, Card, EmptyState, Row, ToolPage } from '../../src/ui';
import { space, type, useTheme } from '../../src/theme';
import { useLang } from '../../src/i18n';
import { relativeTime } from '../../src/lib/time';

export default function SurveyScreen() {
  const { t } = useLang();
  const { c } = useTheme();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['survey-results'], queryFn: fetchSurveyResults, enabled: user?.role !== 'admin' });
  const rows = q.data ?? [];
  // The public form lives on the web. Each leader has their own link, so responses reach the right office.
  const leader = user?.role === 'staff' ? (user as { mla_username?: string }).mla_username : user?.username;
  const link = leader ? `${PUBLIC_WEB_URL}/survey/${encodeURIComponent(leader)}` : null;
  return (
    <ToolPage title={t('survey.results.title')} subtitle={t('survey.results.desc')} refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} error={q.isError} onRetry={() => { void q.refetch(); }}>
      {link ? (
        <Card style={{ padding: space.lg, gap: space.sm }}>
          <Text style={[type.caption, { color: c.muted }]} selectable>{link}</Text>
          <Button label="Share survey link" variant="secondary" onPress={() => { void Share.share({ message: link }); }} />
        </Card>
      ) : null}
      <Card>
        {rows.length === 0 ? <EmptyState icon="forum" title={q.isLoading ? '…' : t('survey.results.empty')} /> : rows.map((r, i) => (
          <Row key={r.id} title={r.message} titleLines={4} meta={[r.category, r.name || undefined, r.created_at ? relativeTime(r.created_at) : undefined].filter(Boolean).join(' · ')} last={i === rows.length - 1} />
        ))}
      </Card>
    </ToolPage>
  );
}
