import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hairline, radius, space, surface, useTheme, white } from '../theme';

type Action = { icon: React.ComponentProps<typeof MaterialIcons>['name']; label: string; onPress: () => void; badge?: number };

export function ScreenHeader({ title, subtitle, onBack, actions, scrolled }: { title: string; subtitle?: string; onBack?: () => void; actions?: Action[]; scrolled?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const bandStyle = [
    styles.band,
    { paddingTop: insets.top + space.sm, paddingBottom: space.sm, borderBottomWidth: scrolled ? 1 : 0, borderBottomColor: hairline },
  ];
  return (
    <View style={bandStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg }}>
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}
            style={{ width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: surface, alignItems: 'center', justifyContent: 'center', marginRight: space.sm }}>
            <MaterialIcons name="chevron-left" size={22} color={c.text} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: c.text }]} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={[type.caption, { color: c.muted, marginTop: 2 }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {actions?.map((a) => (
            <Pressable key={a.label} onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.label} hitSlop={10}
              style={{ width: 40, height: 40, marginLeft: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: surface, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <MaterialIcons name={a.icon} size={22} color={c.text} />
              {a.badge ? <View style={{ position: 'absolute', top: -4, right: -6, width: 16, height: 16, borderRadius: radius.pill, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: white, fontSize: 10, fontWeight: '700' }}>{String(a.badge)}</Text>
              </View> : null}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const type = { title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 }, caption: { fontSize: 12, fontWeight: '500' as const } };
const styles = StyleSheet.create({ band: { backgroundColor: surface } });
