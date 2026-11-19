import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { banner, forest, radius, space, surface, tints, white, useTheme } from '../theme';
import { relativeTime } from '../lib/time';
import { Card } from './index';

type Icon = React.ComponentProps<typeof MaterialIcons>['name'];
export type Tone = 'negative' | 'positive' | 'statewide' | 'neutral';

const tick = () => { void Haptics.selectionAsync().catch(() => {}); };

function toneColors(tone: Tone, c: ReturnType<typeof useTheme>['c']) {
  if (tone === 'negative') return { fg: c.danger, bg: c.dangerBg, icon: 'trending-down' as Icon, label: 'Negative' };
  if (tone === 'positive') return { fg: c.ok, bg: c.okBg, icon: 'trending-up' as Icon, label: 'Positive' };
  if (tone === 'statewide') return { fg: tints.violet, bg: `${tints.violet}1F`, icon: 'groups' as Icon, label: 'Statewide' };
  return { fg: c.muted, bg: c.surface, icon: 'article' as Icon, label: '' };
}

// Page title row: icon square, "News", one-line subtitle.
export function PageTitle({ icon, title, subtitle }: { icon: Icon; title: string; subtitle: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md }}>
      <View style={{ width: 44, height: 44, borderRadius: radius.tile, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialIcons name={icon} size={24} color={white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.4 }} accessibilityRole="header">{title}</Text>
        <Text style={{ color: c.muted, fontSize: 13 }} numberOfLines={1}>{subtitle}</Text>
      </View>
    </View>
  );
}

// Dark warm card with the place name. No stock photo of a flag or crowd on purpose.
export function PlaceBanner({
  place, subtitle, refreshLabel, refreshing, onRefresh,
}: { place: string; subtitle: string; refreshLabel: string; refreshing: boolean; onRefresh: () => void }) {
  return (
    <LinearGradient
      colors={['#1B140D', '#3B2A14', '#7A5220']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ marginTop: space.md, borderRadius: radius.card, padding: space.lg, overflow: 'hidden' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <MaterialIcons name="place" size={16} color="#E3B466" />
        <Text style={{ color: banner.text, fontSize: 13 }}>My Constituency</Text>
      </View>
      <Text style={{ color: white, fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{place}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginTop: space.sm }}>
        <Text style={{ color: banner.textSoft, fontSize: 12, flex: 1 }} numberOfLines={2}>{subtitle}</Text>
        <Pressable
          onPress={onRefresh}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel="Refresh news"
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill,
            backgroundColor: banner.buttonBg, borderWidth: 1, borderColor: banner.buttonBorder, opacity: pressed || refreshing ? 0.7 : 1,
          })}
        >
          <MaterialIcons name="refresh" size={16} color={white} />
          <Text style={{ color: white, fontSize: 12, fontWeight: '700' }}>{refreshLabel}</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

export type ScopeItem = { id: string; label: string; count?: number; icon: Icon; color: string };

// One white card, every scope visible at once (no sliding). Selected = dark green fill, as in the reference.
export function ScopeTabs({ items, value, onChange }: { items: ScopeItem[]; value: string; onChange: (id: string) => void }) {
  const { c } = useTheme();
  return (
    <Card style={{ marginTop: space.md, padding: 4, flexDirection: 'row' }}>
      {items.map((s) => {
        const on = s.id === value;
        return (
          <Pressable
            key={s.id}
            onPress={() => { if (!on) { tick(); onChange(s.id); } }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={s.count ? `${s.label}, ${s.count}` : s.label}
            style={({ pressed }) => ({
              flex: 1, minHeight: 56, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', gap: 2,
              borderRadius: radius.card - 8, backgroundColor: on ? forest : 'transparent', opacity: pressed ? 0.75 : 1,
            })}
          >
            <MaterialIcons name={s.icon} size={20} color={on ? white : s.color} />
            <Text style={{ color: on ? white : c.text, fontSize: 11, fontWeight: on ? '700' : '600' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{s.label}</Text>
            <Text style={{ color: on ? banner.text : c.muted, fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] }} numberOfLines={1}>{s.count ? s.count : ' '}</Text>
          </Pressable>
        );
      })}
    </Card>
  );
}

export function Segmented({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: surface, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, padding: 3 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => { if (!on) { tick(); onChange(o.id); } }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({ minHeight: 40, minWidth: 76, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: on ? forest : 'transparent', opacity: pressed ? 0.75 : 1 })}
          >
            <Text style={{ color: on ? white : c.text, fontSize: 14, fontWeight: on ? '700' : '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DateChip({ label }: { label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: surface, borderWidth: 1, borderColor: c.border }}>
      <MaterialIcons name="calendar-today" size={16} color={c.text} />
      <Text style={{ color: c.text, fontSize: 13, fontWeight: '500' }}>{label}</Text>
    </View>
  );
}

export function PresetChips({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.md }}>
      {items.map((p) => {
        const on = p.id === value;
        return (
          <Pressable
            key={p.id}
            onPress={() => { if (!on) { tick(); onChange(p.id); } }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: on ? c.accentBg : c.card, borderWidth: 1, borderColor: on ? c.accent : c.border, opacity: pressed ? 0.75 : 1 })}
          >
            <Text style={{ color: on ? c.accentText : c.text, fontSize: 13, fontWeight: on ? '700' : '600' }}>{p.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SentimentPill({ tone }: { tone: Tone }) {
  const { c } = useTheme();
  const t = toneColors(tone, c);
  if (!t.label) return null;
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: t.bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
      <MaterialIcons name={t.icon} size={12} color={t.fg} />
      <Text style={{ color: t.fg, fontSize: 11, fontWeight: '700' }}>{t.label}</Text>
    </View>
  );
}

// Only a real picture is drawn. No picture (or one that fails to load) = no image area at all, the text takes the full width.
function Thumb({ uri }: { uri?: string | null }) {
  const { c } = useTheme();
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return null;
  return (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
      resizeMode="cover"
      style={{ width: 84, height: 92, borderRadius: radius.tile, backgroundColor: c.surface }}
    />
  );
}

export function NewsCard({
  headline, summary, tone, urgent, place, source, time, imageUrl, onShare, onTranslate, translated, onPress, onLongPress,
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  headline: string; summary?: string | null; tone: Tone; urgent?: boolean; place?: string | null; source?: string | null; time?: string | null;
  imageUrl?: string | null; onShare?: () => void; onTranslate?: () => void; translated?: boolean;
}) {
  const { c } = useTheme();
  const t = toneColors(tone, c);
  const showSummary = !!summary && summary.trim() !== headline.trim();
  const meta = [place, source, relativeTime(time)].filter(Boolean);
  const card = (
    <Card style={{ marginBottom: space.sm + 2 }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: tone === 'neutral' ? c.border : t.fg }} />
      <View style={{ flexDirection: 'row', gap: space.md, padding: space.md, paddingLeft: space.md + 4 }}>
        <Thumb uri={imageUrl} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, minHeight: 22 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
              <SentimentPill tone={tone} />
              {urgent ? (
                <View style={{ backgroundColor: c.dangerBg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: c.danger, fontSize: 11, fontWeight: '700' }}>Urgent</Text>
                </View>
              ) : null}
            </View>
            {onShare ? (
              <Pressable onPress={onShare} hitSlop={10} accessibilityRole="button" accessibilityLabel="Share this story" style={({ pressed }) => ({ width: 32, height: 32, marginRight: -6, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
                <MaterialIcons name="share" size={18} color={c.muted} />
              </Pressable>
            ) : null}
          </View>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: '700', lineHeight: 20 }} numberOfLines={3}>{headline}</Text>
          {showSummary ? <Text style={{ color: c.muted, fontSize: 12, lineHeight: 16 }} numberOfLines={2}>{summary}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            {place ? <MaterialIcons name="place" size={12} color={c.accent} /> : null}
            <Text style={{ color: c.muted, fontSize: 11, flexShrink: 1 }} numberOfLines={1}>{meta.join('  |  ')}</Text>
            {onTranslate ? (
              <Pressable onPress={onTranslate} hitSlop={10} accessibilityRole="button" accessibilityLabel={translated ? 'Show original' : 'Translate to Telugu'}>
                <Text style={{ color: c.accentText, fontSize: 11, fontWeight: '700', marginLeft: 4 }}>{translated ? 'Original' : 'తెలుగు'}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );
  if (!onPress && !onLongPress) return card;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="button" accessibilityLabel={`Open story: ${headline}`} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {card}
    </Pressable>
  );
}

export function NewsSkeleton() {
  const { c } = useTheme();
  const bar = (w: number | string, h: number) => <View style={{ width: w as number, height: h, borderRadius: 6, backgroundColor: c.surface }} />;
  return (
    <View style={{ gap: space.md }} accessibilityLabel="Loading news">
      {[0, 1, 2].map((i) => (
        <Card key={i} style={{ flexDirection: 'row', gap: space.md, padding: space.lg }}>
          <View style={{ flex: 1, gap: space.sm }}>{bar(70, 18)}{bar('95%', 16)}{bar('80%', 16)}{bar('60%', 12)}</View>
        </Card>
      ))}
    </View>
  );
}
