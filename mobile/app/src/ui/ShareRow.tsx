import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { radius, space, type, useTheme } from '../theme';
import { relativeTime } from '../lib/time';
import { Badge } from './primitives';

export type ShareStatus = 'new' | 'seen' | 'acting' | 'done';
export type ShareRowData = {
  id: number; title: string; sender?: string; status?: string; priority?: string | null; created_at?: string | null; note?: string | null; reply_count?: number;
};

const BADGE: Record<string, { tone: 'attention' | 'neutral' | 'success'; label: string }> = {
  new: { tone: 'attention', label: 'New' }, seen: { tone: 'neutral', label: 'Seen' },
  acting: { tone: 'attention', label: 'Acting' }, done: { tone: 'success', label: 'Done' },
};

// One-tap answers. Only the steps that still make sense for the current status are offered.
function nextSteps(status: string): { to: 'seen' | 'acting' | 'done'; label: string }[] {
  if (status === 'new') return [{ to: 'seen', label: 'Seen' }, { to: 'acting', label: "I'll act" }, { to: 'done', label: 'Done' }];
  if (status === 'seen') return [{ to: 'acting', label: "I'll act" }, { to: 'done', label: 'Done' }];
  if (status === 'acting') return [{ to: 'done', label: 'Mark done' }];
  return [];
}

export function ShareRow({
  share, onOpen, onStatus, busy, last, showNote,
}: { share: ShareRowData; onOpen: () => void; onStatus?: (to: 'seen' | 'acting' | 'done') => void; busy?: boolean; last?: boolean; showNote?: boolean }) {
  const { c } = useTheme();
  const status = share.status ?? 'seen';
  const badge = BADGE[status] ?? BADGE.seen;
  const unread = status === 'new';
  const steps = onStatus ? nextSteps(status) : [];
  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border }}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${share.title}, ${badge.label}${share.sender ? `, from ${share.sender}` : ''}`}
        style={({ pressed }) => ({ paddingHorizontal: space.lg, paddingTop: space.md + 2, paddingBottom: steps.length ? space.sm : space.md + 2, gap: 6, backgroundColor: pressed ? c.surface : 'transparent' })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
          {unread ? <View accessibilityElementsHidden style={{ width: 8, height: 8, borderRadius: radius.dot, backgroundColor: c.accent, marginTop: 8 }} /> : null}
          <Text style={[type.body, { flex: 1, color: c.text, fontWeight: unread ? '700' : '600' }]} numberOfLines={2}>{share.title}</Text>
        </View>
        {showNote && share.note ? <Text style={[type.caption, { color: c.text }]} numberOfLines={2}>“{share.note}”</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
          {share.priority === 'urgent' ? <Badge label="Urgent" tone="danger" /> : null}
          <Badge label={badge.label} tone={badge.tone} />
          <Text style={[type.caption, { color: c.muted }]}>
            {[share.sender ? `from ${share.sender}` : '', relativeTime(share.created_at), (share.reply_count ?? 0) > 0 ? `${share.reply_count} replies` : ''].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Pressable>
      {steps.length ? (
        <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md }}>
          {steps.map((s, i) => {
            const primary = i === 0 && steps.length > 1 ? false : s.to === 'done' || steps.length === 1;
            return (
              <Pressable
                key={s.to}
                disabled={busy}
                onPress={() => { void Haptics.selectionAsync().catch(() => {}); onStatus?.(s.to); }}
                accessibilityRole="button"
                accessibilityLabel={`${s.label}: ${share.title}`}
                style={({ pressed }) => ({
                  flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: primary ? c.accentBg : c.surface, borderWidth: 1, borderColor: primary ? c.accent : c.border, opacity: busy ? 0.4 : pressed ? 0.7 : 1,
                })}
              >
                <Text style={[type.caption, { color: primary ? c.accentText : c.text, fontWeight: '700' }]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
