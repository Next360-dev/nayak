import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { radius, space, surface, useTheme } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger';

export function Button({ label, onPress, variant = 'primary', loading, disabled, icon }: { label: string; onPress?: () => void; variant?: Variant; loading?: boolean; disabled?: boolean; icon?: React.ReactNode }) {
  const { c } = useTheme();
  const isDisabled = disabled || loading;
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={isDisabled}
      hitSlop={12}
      style={({ pressed }) => ([
        styles.container,
        !primary && danger ? { borderColor: c.danger } : { borderColor: c.border },
        { backgroundColor: isDisabled ? (primary || danger ? 'rgba(0,0,0,0.12)' : surface) : (primary ? c.accent : danger ? 'transparent' : surface), opacity: isDisabled ? 0.45 : (pressed ? 0.7 : 1) },
      ] as any)}
    >
      {loading ? <ActivityIndicator size="small" color={primary || danger ? c.onAccent : c.text} style={{ marginRight: space.sm }} /> : icon}
      <Text style={[styles.label, { color: isDisabled ? 'rgba(0,0,0,0.30)' : (primary ? c.onAccent : danger ? c.danger : c.text) }, { fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 24, minWidth: 120 },
  label: { fontSize: 16, textAlign: 'center' },
});
