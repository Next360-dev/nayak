import React from 'react';
import { KeyboardAvoidingView, Platform, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { hairline, radius, space, surface, useTheme } from '../theme';

export function BottomSheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} accessibilityLabel="Close sheet" style={styles.backdrop} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav} pointerEvents="box-none">
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}>
          {children}
        </ScrollView>
        <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={20} style={styles.close}>
          <Text style={[styles.closeText, { color: c.accentText }]}>Close</Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(23,23,23,0.35)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: 12, paddingHorizontal: space.lg },
  handle: { width: 36, height: 4, borderRadius: radius.line, backgroundColor: hairline, alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  close: { paddingVertical: space.sm, alignItems: 'center' },
  closeText: { fontSize: 15, fontWeight: '600' },
});
