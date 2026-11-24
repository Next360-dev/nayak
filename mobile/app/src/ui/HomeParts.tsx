import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { flag, radius, space, surface, useTheme, white } from '../theme';
import { Badge, Monogram } from './index';

type Icon = React.ComponentProps<typeof MaterialIcons>['name'];


// Three tricolour bars, slightly tilted. A simple mark, not a flag.
export function BrandMark() {
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

// Identity bar (matches the web LeaderIdentityBar): tricolor strip, avatar with an online dot, who and where,
// and the Inbox / Account buttons. No stock photo of a leader on purpose.
export function Hero({
  eyebrow, place, name, unread, onBell, onAvatar,
}: { eyebrow: string; place: string; name: string; unread: number; onBell: () => void; onAvatar: () => void }) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const initials = name.replace(/^dr\.?\s+/i, '').split(/[\s_]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  return (
    <View>
      <View style={{ flexDirection: 'row', height: 4, marginTop: insets.top }} accessibilityElementsHidden>
        <View style={{ flex: 1, backgroundColor: flag.saffron }} />
        <View style={{ flex: 1, backgroundColor: white, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border }} />
        <View style={{ flex: 1, backgroundColor: flag.green }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm }}>
        <Pressable onPress={onAvatar} accessibilityRole="button" accessibilityLabel="Account and settings">
          <View accessibilityLabel={`${name} initials`} style={{ width: 56, height: 56, borderRadius: radius.pill, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: c.onAccent, fontSize: 20, fontWeight: '700' }}>{initials}</Text>
          </View>
          <View style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, borderRadius: radius.dot, backgroundColor: c.ok, borderWidth: 2, borderColor: c.bg }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.accentText, fontSize: 11, letterSpacing: 2, fontWeight: '700' }} numberOfLines={1}>{eyebrow}</Text>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 }} numberOfLines={1}>{name}</Text>
          <Text style={{ color: c.muted, fontSize: 13 }} numberOfLines={1}>{place}</Text>
        </View>
        <HeaderButton icon="notifications-none" label={unread > 0 ? `Inbox, ${unread} unread` : 'Inbox'} onPress={onBell} dot={unread > 0} />
      </View>
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

export function SummaryCard({ icon, value, label, tone }: { icon: Icon; value: number; label: string; tone: 'ok' | 'danger' | 'attention' | 'neutral' }) {
  const { c } = useTheme();
  const fg = tone === 'ok' ? c.ok : tone === 'danger' ? c.danger : tone === 'attention' ? c.attention : c.text;
  const bg = tone === 'ok' ? c.okBg : tone === 'danger' ? c.dangerBg : tone === 'attention' ? c.attentionBg : c.surface;
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

export type BriefTile = { icon: Icon; value: number; label: string; tone: 'danger' | 'attention' | 'neutral'; onPress: () => void };

// The top of Home: one sentence that says what needs the user, then three tiles that open the matching list.
// A tile is coloured only when its number is above zero, so colour always means "something to do".
export function StatusBrief({ headline, sub, allClear, date, tiles }: { headline: string; sub?: string; allClear: boolean; date: string; tiles: BriefTile[] }) {
  const { c } = useTheme();
  return (
    <View style={{ marginHorizontal: space.lg, marginTop: space.lg, gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        <View style={{ width: 36, height: 36, borderRadius: radius.pill, backgroundColor: allClear ? c.okBg : c.attentionBg, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
          <MaterialIcons name={allClear ? 'check' : 'notifications-active'} size={20} color={allClear ? c.ok : c.attention} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.3, lineHeight: 28 }} accessibilityRole="header">{headline}</Text>
          {sub ? <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{sub}</Text> : null}
        </View>
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 6 }}>{date}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        {tiles.map((t) => {
          const active = t.value > 0 && t.tone !== 'neutral';
          const fg = active ? (t.tone === 'danger' ? c.danger : c.attention) : c.text;
          const bg = active ? (t.tone === 'danger' ? c.dangerBg : c.attentionBg) : c.card;
          return (
            <Pressable
              key={t.label}
              onPress={t.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${t.value} ${t.label}. Open`}
              style={({ pressed }) => ({ flex: 1, minHeight: 104, backgroundColor: bg, borderRadius: radius.summary, borderWidth: 1, borderColor: active ? 'transparent' : c.border, padding: space.md + 2, justifyContent: 'space-between', opacity: pressed ? 0.75 : 1 })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <MaterialIcons name={t.icon} size={22} color={active ? fg : c.muted} />
                <MaterialIcons name="chevron-right" size={20} color={active ? fg : c.muted} />
              </View>
              <View>
                <Text style={{ color: fg, fontSize: 30, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{t.value}</Text>
                <Text style={{ color: active ? fg : c.muted, fontSize: 13, fontWeight: '500' }} numberOfLines={2}>{t.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export type ShortcutTile = { icon: Icon; label: string; sub: string; onPress: () => void; primary?: boolean; badge?: number; alert?: boolean };

// Shortcuts as a 2x2 grid of cards. Each says something live (a count or a status), not just a name.
// One tile can be primary (gold fill): that is the thing the user most likely came to do.
export function ShortcutGrid({ tiles }: { tiles: ShortcutTile[] }) {
  const { c } = useTheme();
  return (
    <View style={{ marginHorizontal: space.lg, marginTop: space.lg, flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {tiles.map((t) => {
        const fg = t.primary ? c.onAccent : c.text;
        const subColor = t.primary ? c.onAccent : t.alert ? c.danger : c.muted;
        return (
          <Pressable
            key={t.label}
            onPress={t.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${t.label}. ${t.sub}`}
            style={({ pressed }) => ({
              width: '48%', flexGrow: 1, minHeight: 92, borderRadius: radius.summary, padding: space.md + 2, gap: space.sm,
              backgroundColor: t.primary ? c.accent : c.card, borderWidth: 1, borderColor: t.primary ? c.accent : c.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.tile, backgroundColor: t.primary ? 'rgba(255,255,255,0.18)' : c.accentBg, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name={t.icon} size={22} color={t.primary ? c.onAccent : c.accentText} />
                {t.badge ? (
                  <View style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: radius.badge, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                    <Text style={{ color: white, fontSize: 11, fontWeight: '700' }}>{t.badge}</Text>
                  </View>
                ) : null}
              </View>
              <MaterialIcons name="arrow-forward" size={18} color={t.primary ? c.onAccent : c.muted} />
            </View>
            <View>
              <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{t.label}</Text>
              <Text style={{ color: subColor, fontSize: 13, fontWeight: t.alert ? '600' : '400' }} numberOfLines={1}>{t.sub}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
