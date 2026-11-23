import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { WorkItem, WorkItemStatus } from '../types';
import { ink, radius, space, surface, type, useTheme, white } from '../theme';
import { relativeTime } from '../lib/time';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];
type Tone = 'neutral' | 'attention' | 'success' | 'danger';

export const STATUS: Record<WorkItemStatus, { label: string; tone: Tone; icon: IconName }> = {
  draft: { label: 'Draft', tone: 'neutral', icon: 'edit' },
  submitted: { label: 'Waiting for decision', tone: 'attention', icon: 'hourglass-top' },
  changes_requested: { label: 'Changes requested', tone: 'attention', icon: 'rate-review' },
  approved: { label: 'Approved', tone: 'success', icon: 'check-circle' },
  rejected: { label: 'Rejected', tone: 'danger', icon: 'cancel' },
  closed: { label: 'Closed', tone: 'neutral', icon: 'lock' },
};

export const EVENT_LABEL: Record<string, string> = {
  created: 'Created',
  edited: 'Edited',
  submitted: 'Sent for decision',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Asked for changes',
  commented: 'Commented',
  assigned: 'Assigned',
  closed: 'Closed',
};

export function useToneColors() {
  const { c } = useTheme();
  return {
    neutral: { fg: c.muted, bg: c.surface },
    attention: { fg: c.attention, bg: c.attentionBg },
    success: { fg: c.ok, bg: c.okBg },
    danger: { fg: c.danger, bg: c.dangerBg },
  } as const;
}

export function StatusPill({ status, small }: { status: WorkItemStatus; small?: boolean }) {
  const tones = useToneColors();
  const s = STATUS[status];
  const t = tones[s.tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: t.bg, borderRadius: radius.pill, paddingHorizontal: small ? 8 : 10, paddingVertical: small ? 3 : 5 }}>
      <MaterialIcons name={s.icon} size={small ? 12 : 14} color={t.fg} />
      <Text style={{ color: t.fg, fontSize: small ? 11 : 12, fontWeight: '700' }}>{s.label}</Text>
    </View>
  );
}

export function kindLabel(i: Pick<WorkItem, 'kind' | 'direction'>) {
  const k = i.kind === 'letter' ? 'Letter' : 'Petition';
  return `${i.direction === 'incoming' ? 'Incoming' : 'Outgoing'} ${k.toLowerCase()}`;
}

export function formatDue(d?: string | null): { text: string; overdue: boolean } | null {
  if (!d) return null;
  const date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  const label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (days < 0) return { text: `Overdue · ${label}`, overdue: true };
  if (days === 0) return { text: 'Due today', overdue: false };
  if (days === 1) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${label}`, overdue: false };
}

// One row in the list: title first, status and due date under it.
export function WorkCard({ item, onPress, last }: { item: WorkItem; onPress: () => void; last?: boolean }) {
  const { c } = useTheme();
  const due = item.status === 'approved' || item.status === 'closed' || item.status === 'rejected' ? null : formatDue(item.due_date);
  const who = item.counterpart ? `${item.direction === 'incoming' ? 'From' : 'To'} ${item.counterpart}` : kindLabel(item);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${STATUS[item.status].label}`}
      style={({ pressed }) => ({ paddingVertical: space.md + 2, paddingHorizontal: space.lg, gap: 8, backgroundColor: pressed ? c.surface : 'transparent', borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <Text style={[type.body, { flex: 1, color: c.text, fontWeight: '700', lineHeight: 22 }]} numberOfLines={2}>{item.title}</Text>
        <MaterialIcons name="chevron-right" size={22} color={c.muted} style={{ marginTop: 1 }} />
      </View>
      <Text style={[type.caption, { color: c.muted }]} numberOfLines={1}>
        {who} · {relativeTime(item.created_at)}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
        <StatusPill status={item.status} small />
        {item.priority === 'urgent' ? (
          <View style={{ backgroundColor: c.dangerBg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: c.danger, fontSize: 11, fontWeight: '700' }}>Urgent</Text>
          </View>
        ) : null}
        {due ? <Text style={{ color: due.overdue ? c.danger : c.muted, fontSize: 12, fontWeight: due.overdue ? '700' : '500' }}>{due.text}</Text> : null}
      </View>
    </Pressable>
  );
}

// Four steps: Draft, Sent, Decision, Closed. The decision step takes the outcome colour.
export function Stepper({ status }: { status: WorkItemStatus }) {
  const { c } = useTheme();
  const tones = useToneColors();
  const index = { draft: 0, changes_requested: 1, submitted: 1, approved: 2, rejected: 2, closed: 3 }[status];
  const decisionLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : status === 'changes_requested' ? 'Changes' : 'Decision';
  const steps = ['Draft', 'Sent', decisionLabel, 'Closed'];
  const outcome = status === 'approved' ? tones.success.fg : status === 'rejected' ? tones.danger.fg : status === 'changes_requested' ? tones.attention.fg : ink;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }} accessible accessibilityLabel={`Progress: ${STATUS[status].label}`}>
      {steps.map((s, i) => {
        const done = i < index || (i === index && status === 'closed');
        const current = i === index && status !== 'closed';
        const color = i === 2 && i <= index ? outcome : ink;
        const filled = done || current;
        return (
          <View key={s} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : i <= index ? color : c.border }} />
              <View style={{ width: 22, height: 22, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? color : surface, borderWidth: 2, borderColor: filled ? color : c.border }}>
                {done ? <MaterialIcons name="check" size={13} color={white} /> : current ? <View style={{ width: 8, height: 8, borderRadius: radius.pill, backgroundColor: white }} /> : null}
              </View>
              <View style={{ flex: 1, height: 2, backgroundColor: i === steps.length - 1 ? 'transparent' : i < index ? color : c.border }} />
            </View>
            <Text style={{ marginTop: 6, fontSize: 11, fontWeight: current ? '700' : '500', color: filled ? c.text : c.muted }} numberOfLines={1}>{s}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Wrapping chips (no sideways scrolling), each with a count.
export function StatusChips({ options, value, onChange }: { options: { key: string; label: string; count: number }[]; value: string; onChange: (k: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => { if (!on) { void Haptics.selectionAsync().catch(() => {}); onChange(o.key); } }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${o.label}, ${o.count}`}
            style={({ pressed }) => ({ minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: on ? ink : surface, borderWidth: 1, borderColor: on ? ink : c.border, opacity: pressed ? 0.75 : 1 })}
          >
            <Text style={{ color: on ? white : c.text, fontSize: 13, fontWeight: on ? '700' : '600' }}>{o.label}</Text>
            <Text style={{ color: on ? white : c.muted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{o.count}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FactRow({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone?: 'danger' }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40 }}>
      <MaterialIcons name={icon} size={18} color={c.muted} />
      <Text style={[type.caption, { color: c.muted, width: 82 }]}>{label}</Text>
      <Text style={[type.body, { flex: 1, color: tone === 'danger' ? c.danger : c.text, fontWeight: '600' }]} selectable>{value}</Text>
    </View>
  );
}

export function SegmentedRow<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: surface, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, padding: 3 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => { if (!on) { void Haptics.selectionAsync().catch(() => {}); onChange(o.id); } }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({ flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: on ? ink : 'transparent', opacity: pressed ? 0.75 : 1 })}
          >
            <Text style={{ color: on ? white : c.text, fontSize: 14, fontWeight: on ? '700' : '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
