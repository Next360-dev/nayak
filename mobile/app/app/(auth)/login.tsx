import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { login, ApiError } from '../../src/api/client';
import { useAuth } from '../../src/hooks/useAuth';

export default function LoginScreen() {
  const router = useRouter();
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
    <View style={styles.container}>
      <Text style={styles.title}>Nayak</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
        accessibilityLabel="Username"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        accessibilityLabel="Password"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={loading} accessibilityLabel="Sign in">
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: 'transparent' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, minHeight: 44 },
  button: { backgroundColor: '#1976d2', padding: 14, borderRadius: 8, alignItems: 'center', minHeight: 44 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#d32f2f', marginBottom: 12, textAlign: 'center' },
});