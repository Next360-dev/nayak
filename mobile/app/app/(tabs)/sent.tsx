import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

export default function SentScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)/inbox?sent=1');
  }, [router]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="small" />
      <Text>Opening Sent…</Text>
    </View>
  );
}
