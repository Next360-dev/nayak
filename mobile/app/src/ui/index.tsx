import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { radius, shadowCard, space, type, useTheme } from '../theme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ backgroundColor: c.card, borderRadius: radius.card, borderWidth: 1, borderColor: c.border, overflow: 'hidden', boxShadow: shadowCard }, style]}>
      {children}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm, paddingHorizontal: space.xs }}>
      <Text style={[type.headline, { color: c.text }]} accessibilityRole="header">{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button" accessibilityLabel={action} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={[type.body, { color: c.accentText, fontWeight: '600' }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export type StatItem = { label: string; value: number | string; tone?: 'danger' | 'attention' };

export function StatStrip({ items }: { items: StatItem[] }) {
  const { c } = useTheme();
  return (
    <Card style={{ flexDirection: 'row' }}>
      {items.map((s, i) => {
        const color = s.tone === 'danger' ? c.danger : s.tone === 'attention' ? c.attention : c.text;
        return (
          <View
            key={s.label}
            accessible
            accessibilityLabel={`${s.value} ${s.label}`}
            style={{ flex: 1, paddingVertical: space.lg, paddingHorizontal: space.md, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: c.border }}
          >
            <Text style={[type.stat, { color }]}>{s.value}</Text>
            <Text style={[type.caption, { color: c.muted, marginTop: 2 }]} numberOfLines={1}>{s.label}</Text>
          </View>
        );
      })}
    </Card>
  );
}

export function Badge({ label, tone }: { label: string; tone: 'danger' | 'attention' | 'success' | 'neutral' }) {
  const { c } = useTheme();
  const fg = tone === 'danger' ? c.danger : tone === 'attention' ? c.attention : tone === 'success' ? c.ok : c.muted;
  const bg = tone === 'danger' ? c.dangerBg : tone === 'attention' ? c.attentionBg : tone === 'success' ? c.okBg : c.surface;
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={[type.caption, { color: fg, fontWeight: '700' }]}>{label}</Text>
    </View>
  );
}

// A row that dims slightly on press and shows a chevron when it opens something.
export function Row({
  title, meta, badges, onPress, last, titleLines = 2, trailing,
}: {
  title: string; meta?: string; badges?: React.ReactNode; onPress?: () => void; last?: boolean; titleLines?: number; trailing?: React.ReactNode;
}) {
  const { c } = useTheme();
  const content = (pressed: boolean) => (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md + 2, paddingHorizontal: space.lg,
        backgroundColor: pressed ? c.surface : 'transparent',
        borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border,
      }}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={[type.body, { color: c.text, fontWeight: '600', lineHeight: 22 }]} numberOfLines={titleLines}>{title}</Text>
        {badges || meta ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
            {badges}
            {meta ? <Text style={[type.caption, { color: c.muted }]}>{meta}</Text> : null}
          </View>
        ) : null}
      </View>
      {trailing}
      {onPress && !trailing ? <MaterialIcons name="chevron-right" size={22} color={c.muted} /> : null}
    </View>
  );
  if (!onPress) return content(false);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={{ minHeight: 44 }}>
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

export function Pill({ icon, label, onPress, tone }: { icon: IconName; label: string; onPress?: () => void; tone?: 'danger' | 'attention' }) {
  const { c } = useTheme();
  const fg = tone === 'danger' ? c.danger : tone === 'attention' ? c.attention : c.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, paddingHorizontal: space.md,
        backgroundColor: c.card, borderRadius: radius.row, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.7 : 1,
      })}
    >
      <MaterialIcons name={icon} size={20} color={fg} />
      <Text style={[type.body, { color: fg, fontWeight: '600', flexShrink: 1 }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function Monogram({ name, size = 36 }: { name: string; size?: number }) {
  const { c } = useTheme();
  const letters = name.replace(/^dr\.?\s+/i, '').split(/[\s_]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.accentText, fontWeight: '700', fontSize: size * 0.38 }}>{letters || '?'}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
      <MaterialIcons name={icon} size={28} color={c.muted} />
      <Text style={[type.body, { color: c.text, fontWeight: '600', textAlign: 'center' }]}>{title}</Text>
      {hint ? <Text style={[type.caption, { color: c.muted, textAlign: 'center' }]}>{hint}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md }}>
      <MaterialIcons name="cloud-off" size={32} color={c.muted} />
      <Text style={[type.body, { color: c.text, textAlign: 'center' }]}>{message}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry"
        style={({ pressed }) => ({ backgroundColor: c.accent, borderRadius: radius.pill, paddingHorizontal: space.xl, minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
      >
        <Text style={[type.body, { color: c.onAccent, fontWeight: '600' }]}>Try again</Text>
      </Pressable>
    </View>
  );
}

// Skeleton blocks shaped like the final Home layout (strip + list card).
export function HomeSkeleton() {
  const { c } = useTheme();
  const bar = (w: string | number, h = 12, extra?: TextStyle) => <View style={[{ width: w as number, height: h, borderRadius: 6, backgroundColor: c.surface }, extra as ViewStyle]} />;
  return (
    <View style={{ padding: space.lg, gap: space.lg }} accessibilityLabel="Loading">
      {bar('55%', 26)}
      <Card style={{ flexDirection: 'row', padding: space.lg, gap: space.xl }}>{bar(48, 32)}{bar(48, 32)}{bar(48, 32)}</Card>
      <Card style={{ padding: space.lg, gap: space.md }}>{bar('90%')}{bar('70%')}{bar('85%')}{bar('60%')}</Card>
      <ActivityIndicator color={c.muted} />
    </View>
  );
}

export { BottomSheet } from './BottomSheet';
export { Button } from './Button';
export { FilterChips } from './FilterChips';
export { GroupedList } from './GroupedList';
export { ScreenHeader } from './ScreenHeader';
export { StickyBar } from './StickyBar';
export { TextField } from './TextField';
export { Toast } from './Toast';

export { ShareRow } from './ShareRow';
export { AuthShell } from './AuthShell';
