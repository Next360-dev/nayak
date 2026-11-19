import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { hairline, radius, space, surface, useTheme } from '../theme';

export function Toast({ message, visible, onDismiss }: { message: string; visible: boolean; onDismiss?: () => void }) {
  const { c } = useTheme();
  const [opacity] = useState(() => new Animated.Value(visible ? 1 : 0));
  useEffect(() => {
    if (visible) {
      opacity.setValue(1);
      const t = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => { onDismiss?.(); });
      }, 2500);
      return () => clearTimeout(t);
    }
    opacity.setValue(0);
  }, [visible, onDismiss, opacity]);
  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={[styles.pill, { shadowColor: c.text }]}>
        <Text style={[styles.text, { color: c.text }]}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: Math.max(space.xl, 40), alignSelf: 'center', zIndex: 50 },
  pill: { backgroundColor: surface, borderRadius: radius.pill, borderWidth: 1, borderColor: hairline, paddingHorizontal: space.lg, paddingVertical: space.sm, shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  text: { fontSize: 13, fontWeight: '600' },
});
