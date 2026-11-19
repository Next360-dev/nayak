import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { space, surface, useTheme } from '../theme';

type Chip = { key: string; label: string; count?: number };

export function FilterChips({ options, value, onChange }: { options: Chip[]; value: string; onChange: (key: string) => void }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, gap: 8 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="button" accessibilityLabel={o.count ? `${o.label}, ${o.count}` : o.label} hitSlop={12}
            style={({ pressed }) => ([
              styles.chip,
              { backgroundColor: on ? c.accentBg : surface, borderColor: on ? c.accent : c.border, opacity: pressed ? 0.7 : 1 },
            ] as any)}
          >
            <Text style={[styles.label, { color: on ? '#8A5A12' : c.text, fontWeight: on ? '700' : '600' }]}>{o.label}</Text>
            {o.count ? <Text style={[styles.count, { color: on ? '#8A5A12' : c.muted }]}>{String(o.count)}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 36, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', minWidth: 76 },
  label: { fontSize: 13 },
  count: { fontSize: 12, marginLeft: 4 },
});
