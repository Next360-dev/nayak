import React from 'react';
import { View, StyleSheet } from 'react-native';
import { hairline, space, surface } from '../theme';

export function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <View style={[styles.bar, { paddingHorizontal: space.lg }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: surface, borderBottomWidth: 1, borderBottomColor: hairline },
});
