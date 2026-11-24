import React from 'react';
import { Linking, Pressable, ScrollView, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { fetchTop5 } from '../api/office';
import { radius, space, useTheme } from '../theme';

// Urgent-alert banner (web: UrgentAlertBanner): the top stories of the moment as a strip. Hidden when there are none.
export function AlertStrip() {
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['top5'], queryFn: fetchTop5, refetchInterval: 60000 });
  const items = (q.data ?? []).filter((s) => s.title || s.headline).slice(0, 5);
  if (items.length === 0) return null;
  // flexGrow: 0 keeps the strip one chip tall; a horizontal ScrollView otherwise grows to fill the column.
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm, alignItems: 'center' }} accessibilityLabel="Urgent alerts">
      {items.map((s, i) => (
        <Pressable
          key={s.id ?? i}
          onPress={s.url ? () => { void Linking.openURL(s.url as string).catch(() => {}); } : undefined}
          accessibilityRole="button"
          style={{ maxWidth: 280, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: c.dangerBg }}
        >
          <MaterialIcons name="notifications-active" size={16} color={c.danger} />
          <Text numberOfLines={1} style={{ color: c.danger, fontSize: 13, fontWeight: '600', flexShrink: 1 }}>{s.title || s.headline}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
