import React, { useState } from 'react';
import {
  Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { changePassword, ApiError } from '../src/api/client';
import { useAuth } from '../src/hooks/useAuth';

const MIN_LENGTH = 12;

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { forced } = useLocalSearchParams<{ forced?: string }>();
  const { user, refreshUser, signOut } = useAuth();
  const isForced = forced === '1' || user?.must_change_password === true;

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!current || !next || !confirm) {
      setError('Fill in all three fields.');
      return;
    }
    if (next !== confirm) {
      setError('The new password and the confirmation do not match.');
      return;
    }
    if (next.length < MIN_LENGTH) {
      setError(`New password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (next === current) {
      setError('New password must be different from the current one.');
      return;
    }
    setLoading(true);
    try {
      await changePassword(current, next);
      setDone(true);
      await refreshUser();
      router.replace('/(tabs)');
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 429) {
        setError('Too many attempts. Try again in 15 minutes.');
      } else if (err.status === 403) {
        setError('Current password is wrong.');
      } else {
        setError(err.message || 'Could not change the password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Change password</Text>
        {isForced ? (
          <Text style={styles.notice}>
            Your password was reset by an administrator, so it must be changed before you can
            continue.
          </Text>
        ) : (
          <Text style={styles.subtitle}>
            Pick a password only you know. Other devices signed in to this account will be signed
            out.
          </Text>
        )}

        <Text style={styles.label}>Current password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          autoCapitalize="none"
          value={current}
          onChangeText={setCurrent}
          accessibilityLabel="Current password"
        />

        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          autoCapitalize="none"
          value={next}
          onChangeText={setNext}
          accessibilityLabel="New password"
        />
        <Text style={styles.hint}>
          At least {MIN_LENGTH} characters, and not your username or a common password.
        </Text>

        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          autoCapitalize="none"
          value={confirm}
          onChangeText={setConfirm}
          accessibilityLabel="Confirm new password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {done ? <Text style={styles.success}>Password changed.</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Save new password"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Save new password</Text>
          )}
        </TouchableOpacity>

        {isForced ? (
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => void signOut()}
            accessibilityRole="button"
            accessibilityLabel="Sign out instead"
          >
            <Text style={styles.secondaryText}>Sign out instead</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.secondaryText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' },
  notice: {
    fontSize: 14,
    color: '#7a4b00',
    backgroundColor: '#fff4e0',
    borderWidth: 1,
    borderColor: '#ffd9a0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
    minHeight: 44,
  },
  hint: { fontSize: 13, color: '#666', marginBottom: 16 },
  error: { color: '#d32f2f', marginBottom: 12, textAlign: 'center' },
  success: { color: '#2e7d32', marginBottom: 12, textAlign: 'center' },
  button: {
    backgroundColor: '#1976d2',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  secondary: { marginTop: 16, padding: 12, alignItems: 'center', minHeight: 44 },
  secondaryText: { color: '#1976d2', fontWeight: '600' },
});
