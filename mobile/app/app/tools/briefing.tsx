import React from 'react';
import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchTeamBriefing } from '../../src/api/board';
import { Card, EmptyState, ToolPage } from '../../src/ui';
import { space, type, useTheme } from '../../src/theme';
import { useLang } from '../../src/i18n';

// Read-only briefing for leaders (staff edit it on the Team board).
export default function BriefingScreen() {
  const { t, lang } = useLang();
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['briefing-read', lang], queryFn: () => fetchTeamBriefing(lang) });
  return (
    <ToolPage title={t('btn.briefing')} subtitle={q.data?.edited ? `Edited${q.data.edited_by ? ` by ${q.data.edited_by}` : ''}` : undefined} refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} error={q.isError} onRetry={() => { void q.refetch(); }}>
      <Card style={{ padding: space.lg }}>
        {q.data?.text ? <Text selectable style={[type.reading, { color: c.text }]}>{q.data.text}</Text> : <EmptyState icon="description" title={q.isLoading ? '…' : 'No briefing yet today'} />}
      </Card>
    </ToolPage>
  );
}
