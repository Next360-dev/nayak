import React, { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { login, ApiError } from '../../src/api/client';
import { useAuth } from '../../src/hooks/useAuth';
import { AuthShell, Button, TextField } from '../../src/ui';
import { type, useTheme } from '../../src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!username.trim() || !password) {
      setError('Enter username and password');
      return;
    }
    setLoading(true);
    try {
      const res = await login(username.trim().toLowerCase(), password);
      if (res.user) {
        signIn(res.user);
        // A reset password has to be replaced before anything else is reachable.
        router.replace(res.user.must_change_password ? '/change-password?forced=1' : '/(tabs)');
        return;
      }
      setError('That username or password is not right. Please try again.');
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 429) {
        setError('Too many wrong attempts. Please wait 15 minutes and try again.');
      } else if (err.status === 401) {
        setError('That username or password is not right. Please try again.');
      } else {
        setError(err.message || 'Could not reach the server. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Sign in" subtitle="Use the username your administrator gave you.">
      <TextField
        label="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      {error ? <Text style={[type.caption, { color: c.danger }]} accessibilityLiveRegion="polite">{error}</Text> : null}
      <Button label="Sign in" onPress={onSubmit} loading={loading} />
      <Text style={[type.caption, { color: c.muted, textAlign: 'center' }]}>Forgot your password? Ask your administrator to reset it.</Text>
    </AuthShell>
  );
}
