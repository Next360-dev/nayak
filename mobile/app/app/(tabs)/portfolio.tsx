import React from 'react';
import { View } from 'react-native';
import { Card, EmptyState, ScreenHeader } from '../../src/ui';
import { space, surface } from '../../src/theme';
import { useLang } from '../../src/i18n';

export default function PortfolioScreen() {
  const { t } = useLang();
  return (
    <View style={{ flex: 1, backgroundColor: surface }}>
      <ScreenHeader title={t('m.tab.portfolio')} />
      <View style={{ padding: space.lg }}>
        <Card><EmptyState icon="account-balance" title={t('m.tab.portfolio')} hint="Coming next: profile, milestones, projects and the public preview." /></Card>
      </View>
    </View>
  );
}
