import React, { useState } from 'react';
import { TextInput, View, StyleSheet, Pressable, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { radius, surface, useTheme } from '../theme';

export function TextField({ label, value, onChangeText, error, secure, multiline, ...rest }: { label: string; value: string; onChangeText: (t: string) => void; error?: string; secure?: boolean; multiline?: boolean; [key: string]: any }) {
  const { c } = useTheme();
  const [showSecure, setShowSecure] = useState(false);
  const [focused, setFocused] = useState(false);
  const { onFocus, onBlur, ...inputRest } = rest as { onFocus?: (e: unknown) => void; onBlur?: (e: unknown) => void };
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: error ? c.danger : c.muted }]}>{label}</Text>
      <View style={[styles.row, { borderColor: error ? c.danger : (focused ? c.accent : c.border) }]}>
        <TextInput
          style={[styles.input, { minHeight: multiline ? 104 : 52, color: c.text }]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && !showSecure}
          multiline={multiline}
          placeholderTextColor={c.muted}
          accessibilityLabel={label}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...inputRest}
        />
        {secure ? (
          <Pressable onPress={() => setShowSecure((s) => !s)} accessibilityRole="button" accessibilityLabel={showSecure ? 'Hide password' : 'Show password'} hitSlop={20} style={styles.eye}>
            <MaterialIcons name={showSecure ? 'visibility-off' : 'visibility'} size={20} color={c.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  label: { fontSize: 12, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderWidth: 1, borderRadius: radius.row, paddingHorizontal: 16, backgroundColor: surface },
  input: { flex: 1, fontSize: 16 },
  eye: { paddingHorizontal: 8 },
  error: { fontSize: 12, marginTop: 2 },
});
