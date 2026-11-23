import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, type, useTheme } from '../theme';
import { BrandMark } from './HomeParts';

// Brand header + keyboard-aware card for the screens shown before the tabs (login, forced password change).
export function AuthShell({ title, subtitle, notice, children }: { title: string; subtitle?: string; notice?: string; children: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: space.lg, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl, gap: space.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <BrandMark />
          <Text style={{ color: c.text, fontSize: 34, fontWeight: '700', letterSpacing: -0.5 }}>Nayak</Text>
          <Text style={[type.caption, { color: c.muted }]}>Leadership for People</Text>
        </View>
        <View style={{ backgroundColor: c.card, borderRadius: 22, borderWidth: 1, borderColor: c.border, padding: space.lg, gap: space.lg, boxShadow: '0 8px 24px rgba(23,23,23,0.08)' }}>
          <View style={{ gap: 4 }}>
            <Text style={[type.headline, { color: c.text }]} accessibilityRole="header">{title}</Text>
            {subtitle ? <Text style={[type.body, { color: c.muted }]}>{subtitle}</Text> : null}
          </View>
          {notice ? (
            <View style={{ backgroundColor: c.attentionBg, borderRadius: 12, padding: space.md }}>
              <Text style={[type.caption, { color: c.attention, fontWeight: '600' }]}>{notice}</Text>
            </View>
          ) : null}
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
