import React from 'react';
import { Pressable, Switch, Text, View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Card } from './index';
import { hairline, radius, shadowCard, space, surface, useTheme } from '../theme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type RowItem = {
  icon?: string;
  iconColor?: string;
  title: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  switch?: { value: boolean; onValueChange: (v: boolean) => void };
};
type Section = { title?: string; rows: RowItem[] };

export function GroupedList({ sections }: { sections: Section[] }) {
  const { c } = useTheme();
  return (
    <View style={{ marginHorizontal: space.lg, gap: space.xl }}>
      {sections.map((section, si) => (
        <React.Fragment key={si}>
          {section.title ? (
            <Text style={[type.sub, { color: c.muted, marginBottom: space.sm }]}>{section.title}</Text>
          ) : null}
          <Card style={[styles.card, { boxShadow: shadowCard }]}>
            {section.rows.map((row, ri) => {
              const last = ri === section.rows.length - 1;
              return (
                <Pressable
                  key={ri}
                  onPress={row.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={row.title}
                  hitSlop={12}
                  style={({ pressed }) => ([styles.row, { backgroundColor: pressed ? c.surface : 'white', borderBottomWidth: last ? 0 : 1, borderBottomColor: hairline }])}
                >
                  {row.icon ? (
                    <View style={[styles.iconBox, { backgroundColor: row.iconColor ? `${row.iconColor}1F` : c.accentBg }]}>
                      <MaterialIcons name={row.icon as IconName} size={20} color={row.iconColor ?? c.accent} />
                    </View>
                  ) : null}
                  <View style={styles.titleWrap}>
                    <Text style={[type.rowTitle, { color: row.danger ? c.danger : c.text }]}>{row.title}</Text>
                    {row.value ? <Text style={[type.caption, { color: c.muted }]}>{row.value}</Text> : null}
                  </View>
                  {row.switch ? (
                    <Switch value={row.switch.value} onValueChange={row.switch.onValueChange} trackColor={{ false: c.border, true: c.accent }} />
                  ) : row.onPress ? (
                    <MaterialIcons name="chevron-right" size={20} color={c.muted} />
                  ) : null}
                </Pressable>
              );
            })}
          </Card>
        </React.Fragment>
      ))}
    </View>
  );
}

const type = { sub: { fontSize: 13, fontWeight: '600' as const }, rowTitle: { fontSize: 15, fontWeight: '600' as const }, caption: { fontSize: 15, fontWeight: '400' as const } };
const styles = StyleSheet.create({
  card: { backgroundColor: surface, borderRadius: radius.card, borderWidth: 1, borderColor: hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 26, minHeight: 52 },
  iconBox: { width: 32, height: 32, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleWrap: { flex: 1, gap: 2 },
});
