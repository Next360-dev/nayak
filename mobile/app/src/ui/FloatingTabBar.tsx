import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { radius, shadowBar, space, useTheme } from '../theme';

type BottomTabBarProps = {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  descriptors: Record<string, { options: { title?: string; href?: string | null; tabBarBadge?: string | number } }>;
  navigation?: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};
type Icon = React.ComponentProps<typeof MaterialIcons>['name'];
const ICONS: Record<string, Icon> = {
  index: 'home-filled', news: 'article', inbox: 'mail-outline', sent: 'send', team: 'groups', users: 'people-outline', settings: 'grid-view',
};
const LABELS: Record<string, string> = { settings: 'More' };

// Floating rounded bar. It stays in the layout flow (not absolutely positioned) so no screen's content is hidden behind it.
export default function FloatingTabBar({ state, descriptors }: BottomTabBarProps) {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: Math.max(insets.bottom, space.md), backgroundColor: c.bg }}>
      <View
        style={{
          flexDirection: 'row', backgroundColor: c.card, borderRadius: radius.tabBar, padding: 6, borderWidth: 1, borderColor: c.border,
          boxShadow: shadowBar,
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          if ((options as { href?: string | null }).href === null) return null;
          const focused = state.index === index;
          const label = LABELS[route.name] ?? (typeof options.title === 'string' ? options.title : route.name);
          const badge = options.tabBarBadge;
  const onPress = () => {
    if (focused) return;
    void Haptics.selectionAsync().catch(() => {});
    router.push(`/(tabs)/${route.name === 'index' ? '' : route.name}` as any);
  };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ pressed }) => ({
                flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 24,
                backgroundColor: focused ? c.accentBg : 'transparent', opacity: pressed ? 0.7 : 1,
              })}
            >
              <View>
                <MaterialIcons name={ICONS[route.name] ?? 'circle'} size={24} color={focused ? c.accentText : c.muted} />
                {badge ? (
                  <View style={{ position: 'absolute', top: -4, right: -10, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{String(badge)}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontSize: 11, fontWeight: focused ? '700' : '500', color: focused ? c.accentText : c.muted }} numberOfLines={1}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
