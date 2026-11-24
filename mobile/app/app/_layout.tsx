import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
import { LangProvider } from '../src/i18n';
import { StatusBar } from 'expo-status-bar';
import { AndroidImportance } from 'expo-notifications';
import { palette, sceneBackground } from '../src/theme';
import { Platform, StyleSheet, View } from 'react-native';

// Configure notification handling (not on web: push cannot work in a browser and the library only logs warnings there)
if (Platform.OS !== 'web') Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    const onChangePassword = segments[0] === 'change-password';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && user.must_change_password && !onChangePassword) {
      // A reset password cannot be skipped: no tabs, no deep links, no back.
      router.replace('/change-password?forced=1');
    } else if (user && !user.must_change_password && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, router]);

  // Notification tap handling (cold start + background), guarded against Expo Go native-module failures
  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = (response.notification.request.content.data || {}) as { share_id?: number; work_item_id?: number };
      if (data.work_item_id) {
        router.push(`/work/${data.work_item_id}`);
      } else if (data.share_id) {
        router.push(`/share/${data.share_id}`);
      }
    };
    if (Platform.OS === 'web') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const r = await Notifications.getLastNotificationResponseAsync();
        if (cancelled) return;
        handleResponse(r);
      } catch {
        // ignore: Expo Go / missing native module
      }
    })();
    let sub: { remove: () => void } | null = null;
    try {
      sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    } catch {
      // ignore
    }
    return () => {
      cancelled = true;
      if (sub) sub.remove();
    };
  }, [router]);

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Expo Go cannot create channels; a missing native module must never surface as an error toast.
      Notifications.setNotificationChannelAsync('urgent', { name: 'Urgent', importance: AndroidImportance.HIGH }).catch(() => {});
      Notifications.setNotificationChannelAsync('default', { name: 'Default', importance: AndroidImportance.DEFAULT }).catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LangProvider>
        <AuthGate>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.light.bg }]} />
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: sceneBackground } }} />
        </AuthGate>
        </LangProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}