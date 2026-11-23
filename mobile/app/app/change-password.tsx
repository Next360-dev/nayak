import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { changePassword, ApiError } from '../src/api/client';
import { useAuth } from '../src/hooks/useAuth';
import { AuthShell, Button, TextField } from '../src/ui';
import { type, useTheme } from '../src/theme';

const MIN_LENGTH = 12;

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { c } = useTheme();
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
    <AuthShell
      title="Change password"
      subtitle={isForced ? undefined : 'Pick a password only you know. Other devices signed in to this account will be signed out.'}
      notice={isForced ? 'Your password was reset by an administrator, so it must be changed before you can continue.' : undefined}
    >
      <TextField label="Current password" value={current} onChangeText={setCurrent} secure autoCapitalize="none" />
      <TextField label="New password" value={next} onChangeText={setNext} secure autoCapitalize="none" />
      <Text style={[type.caption, { color: c.muted }]}>At least {MIN_LENGTH} characters, and not your username or a common password.</Text>
      <TextField label="Confirm new password" value={confirm} onChangeText={setConfirm} secure autoCapitalize="none" />
      {error ? <Text style={[type.caption, { color: c.danger }]} accessibilityLiveRegion="polite">{error}</Text> : null}
      {done ? <Text style={[type.caption, { color: c.ok }]}>Password changed.</Text> : null}
      <Button label="Save new password" onPress={onSubmit} loading={loading} />
      <Pressable
        onPress={isForced ? () => void signOut() : () => router.back()}
        accessibilityRole="button"
        accessibilityLabel={isForced ? 'Sign out instead' : 'Cancel'}
        style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={[type.body, { color: c.accentText, fontWeight: '600' }]}>{isForced ? 'Sign out instead' : 'Cancel'}</Text>
      </Pressable>
    </AuthShell>
  );
}
