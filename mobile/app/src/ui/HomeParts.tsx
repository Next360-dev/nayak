import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { flag, radius, space, surface, useTheme, white } from '../theme';
import { Badge, Monogram } from './index';

type Icon = React.ComponentProps<typeof MaterialIcons>['name'];


// Three tricolour bars, slightly tilted. A simple mark, not a flag.
function BrandMark() {
  return (
    <View style={{ width: 34, height: 26, justifyContent: 'center', gap: 3, transform: [{ rotate: '-14deg' }] }} accessibilityElementsHidden>
      <View style={{ height: 6, borderRadius: radius.bar, backgroundColor: flag.saffron }} />
      <View style={{ height: 6, borderRadius: radius.bar, backgroundColor: white }} />
      <View style={{ height: 6, borderRadius: radius.bar, backgroundColor: flag.green }} />
    </View>
  );
}

function HeaderButton({ icon, label, onPress, dot }: { icon: Icon; label: string; onPress: () => void; dot?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
        backgroundColor: surface, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.7 : 1,
      })}
    >
      <MaterialIcons name={icon} size={22} color={c.text} />
      {dot ? <View style={{ position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: radius.dot, backgroundColor: c.danger, borderWidth: 1.5, borderColor: white }} /> : null}
    </Pressable>
  );
}

export function BrandBar({ name, unread, onBell, onAvatar }: { name: string; unread: number; onBell: () => void; onAvatar: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <BrandMark />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.4 }}>Nayak</Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>Leadership for People</Text>
      </View>
      <HeaderButton icon="notifications-none" label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'} onPress={onBell} dot={unread > 0} />
      <Pressable onPress={onAvatar} accessibilityRole="button" accessibilityLabel="Account and settings" hitSlop={6}
        style={{ borderRadius: radius.avatar, borderWidth: 2, borderColor: c.accent, padding: 1 }}>
        <Monogram name={name} size={36} />
      </Pressable>
    </View>
  );
}

// Brand row, then who and where, straight on the shared background. No stock photo of a leader on purpose.
export function Hero({
  eyebrow, place, name, unread, onBell, onAvatar,
}: { eyebrow: string; place: string; name: string; unread: number; onBell: () => void; onAvatar: () => void }) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  return (
    <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: space.sm }}>
      <BrandBar name={name} unread={unread} onBell={onBell} onAvatar={onAvatar} />

      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.xl }}>
        <View style={{ width: 3, borderRadius: radius.line, backgroundColor: c.accent }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.accentText, fontSize: 12, letterSpacing: 3, fontWeight: '700' }}>{eyebrow}</Text>
          <Text style={{ color: c.text, fontSize: 40, fontWeight: '700', letterSpacing: -0.6, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {place}
          </Text>
          <Text style={{ color: c.muted, fontSize: 14, marginTop: space.sm }}>Signed in as</Text>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }} numberOfLines={1}>{name}</Text>
        </View>
      </View>
    </View>
  );
}

export type QuickAction = { icon: Icon; label: string; color: string; onPress: () => void; count?: number };

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row', marginHorizontal: space.lg, marginTop: space.lg, backgroundColor: c.card, borderRadius: radius.card + 4,
        borderWidth: 1, borderColor: c.border, paddingVertical: space.lg, boxShadow: '0 8px 24px rgba(23,23,23,0.08)',
      }}
    >
      {actions.map((a, i) => (
        <Pressable
          key={a.label}
          onPress={a.onPress}
          accessibilityRole="button"
          accessibilityLabel={a.count ? `${a.label}, ${a.count} new` : a.label}
          style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: space.sm, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: c.border, opacity: pressed ? 0.6 : 1, minHeight: 44 })}
        >
          <View style={{ width: 52, height: 52, borderRadius: radius.tileLg, backgroundColor: `${a.color}22`, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name={a.icon} size={26} color={a.color} />
            {a.count ? (
              <View style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: radius.badge, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                <Text style={{ color: white, fontSize: 11, fontWeight: '700' }}>{a.count}</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 2 }} numberOfLines={2}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.md, marginHorizontal: space.lg }}>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.3 }} accessibilityRole="header">{title}</Text>
      {right}
    </View>
  );
}

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}>
      <Text style={{ color: c.accentText, fontSize: 15, fontWeight: '700' }}>{label}</Text>
      <MaterialIcons name="arrow-forward" size={18} color={c.accentText} />
    </Pressable>
  );
}

export function SummaryCard({ icon, value, label, tone }: { icon: Icon; value: number; label: string; tone: 'ok' | 'danger' | 'attention' }) {
  const { c } = useTheme();
  const fg = tone === 'ok' ? c.ok : tone === 'danger' ? c.danger : c.attention;
  const bg = tone === 'ok' ? c.okBg : tone === 'danger' ? c.dangerBg : c.attentionBg;
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={{ flex: 1, backgroundColor: bg, borderRadius: radius.summary, padding: space.md + 2, gap: space.sm, minHeight: 104 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <MaterialIcons name={icon} size={26} color={fg} />
        <Text style={{ color: fg, fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
      </View>
      <Text style={{ color: c.text, fontSize: 14, fontWeight: '500' }}>{label}</Text>
    </View>
  );
}

export function NewsItem({
  headline, sentiment, urgent, meta, onPress, last,
}: { headline: string; sentiment?: string | null; urgent?: boolean; meta: string; onPress: () => void; last?: boolean }) {
  const { c } = useTheme();
  const negative = sentiment === 'negative';
  const positive = sentiment === 'positive';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={headline}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md + 2, minHeight: 44,
        backgroundColor: pressed ? c.surface : 'transparent', borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border,
      })}
    >
      <View style={{ width: 72, height: 56, borderRadius: radius.tile, backgroundColor: negative ? c.dangerBg : positive ? c.okBg : c.surface, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialIcons name="article" size={26} color={negative ? c.danger : positive ? c.ok : c.muted} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '700', lineHeight: 21 }} numberOfLines={2}>{headline}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
          {urgent ? <Badge label="Urgent" tone="danger" /> : null}
          {negative ? <Badge label="Negative" tone="danger" /> : null}
          {positive ? <Badge label="Positive" tone="success" /> : null}
          <Text style={{ color: c.muted, fontSize: 12 }}>{meta}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export type ReachMetric = { icon: Icon; label: string; value: number; color: string };

export function ReachCard({ metrics }: { metrics: ReachMetric[] }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', marginHorizontal: space.lg, backgroundColor: c.card, borderRadius: radius.card, borderWidth: 1, borderColor: c.border, paddingVertical: space.lg }}>
      {metrics.map((m, i) => (
        <View key={m.label} accessible accessibilityLabel={`${m.value} ${m.label}`} style={{ flex: 1, alignItems: 'center', gap: 6, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: c.border }}>
          <View style={{ width: 40, height: 40, borderRadius: radius.summary, backgroundColor: `${m.color}22`, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name={m.icon} size={21} color={m.color} />
          </View>
          <Text style={{ color: c.text, fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{m.value}</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>{m.label}</Text>
        </View>
      ))}
    </View>
  );
}
