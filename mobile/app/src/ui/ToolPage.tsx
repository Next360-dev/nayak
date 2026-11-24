import React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { space, surface, useTheme } from '../theme';
import { ScreenHeader } from './ScreenHeader';
import { ErrorState } from './primitives';

// Shared shell for the office-tool screens: header with back, scrolling body, pull to refresh, load error with retry.
export function ToolPage({ title, subtitle, refreshing, onRefresh, error, onRetry, children }: {
  title: string; subtitle?: string; refreshing?: boolean; onRefresh?: () => void; error?: boolean; onRetry?: () => void; children: React.ReactNode;
}) {
  const router = useRouter();
  const { c } = useTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={title} subtitle={subtitle} onBack={() => router.back()} />
      {error ? <ErrorState message="Could not load this screen." onRetry={() => onRetry?.()} /> : (
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.accent} /> : undefined}
        >
          {children}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

export const Gap = ({ h = space.sm }: { h?: number }) => <View style={{ height: h }} />;
