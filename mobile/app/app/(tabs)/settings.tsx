import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../src/hooks/useAuth';
import { useLang } from '../../src/i18n';
import { registerDevice, unregisterDevice } from '../../src/api/devices';
import { fetchProfile, updateProfile, testAlert, fetchHealth, sendAppFeedback } from '../../src/api/profile';
import { getPushToken, setPushToken as storePushToken } from '../../src/lib/storage';
import { BUILD_PROFILE } from '../../src/constants/config';
import { hairline, radius, space, surface, useTheme } from '../../src/theme';
import { BottomSheet, GroupedList, ScreenHeader, Toast } from '../../src/ui';

const IN_EXPO_GO = Constants.appOwnership === 'expo';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { c } = useTheme();
  const { lang, setLang, t } = useLang();
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
  const [profile, setProfile] = useState<{ email?: string | null; phone?: string | null; alerts_enabled?: boolean | null; lang?: string | null; email_configured?: boolean | null } | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [health, setHealth] = useState<'connected' | 'not-reachable' | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const pushTokenRef = useRef<string | null>(null);

  const showToast = useCallback((message: string) => { setToast({ message, visible: true }); }, []);

  useEffect(() => {
    void getPushToken().then((t) => { if (t) { setPushToken(t); setPushEnabled(true); pushTokenRef.current = t; } }).catch(() => {});
    void (async () => { try { const p = await fetchProfile(); setProfile(p); setEmailAlerts(!!p.alerts_enabled); } catch { setProfile(null); } })();
    void (async () => { try { const h = await fetchHealth(); setHealth(h.status === 'up' ? 'connected' : 'not-reachable'); } catch { setHealth('not-reachable'); } })();
  }, []);

  const toggleNotif = async (val: boolean) => {
    setPushEnabled(val);
    if (val) {
      if (IN_EXPO_GO) { setPushEnabled(false); Alert.alert('Notifications need a development build', 'Push notifications are not available in Expo Go. Build a dev client to enable them.'); return; }
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') { setPushEnabled(false); Alert.alert('Permission denied'); return; }
        const token = (await Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig?.extra?.eas?.projectId })).data;
        setPushToken(token);
        pushTokenRef.current = token;
        await storePushToken(token);
        await registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
        showToast('Push registered');
      } catch (e: any) { setPushEnabled(false); Alert.alert('Error', e?.message || 'Failed to register'); }
    } else {
      if (pushToken) { try { await unregisterDevice(pushToken); } catch {} }
      await storePushToken(null);
      setPushToken(null);
      pushTokenRef.current = null;
    }
  };

  const onLogout = async () => {
    const token = pushToken || (await getPushToken());
    try { await signOut(token); } catch {}
    await storePushToken(null);
    router.replace('/(auth)/login');
  };

  const handleToggleEmailAlerts = async (val: boolean) => {
    try {
      await updateProfile({ ...(profile || {}), alerts_enabled: val });
      setEmailAlerts(val);
      setProfile((p) => (p ? { ...p, alerts_enabled: val } : null));
      showToast(val ? 'Email alerts on' : 'Email alerts off');
    } catch { setEmailAlerts(!val); showToast('Failed to update'); }
  };

  const handleSendTestAlert = async () => {
    setFeedbackSending(true);
    try {
      await testAlert();
      showToast('Test alert sent');
    } catch { showToast('Test alert failed'); }
    finally { setFeedbackSending(false); }
  };

  const handleSendFeedback = async () => {
    const m = feedbackMsg.trim();
    if (m.length < 3 || m.length > 2000) { showToast('Message must be 3–2000 chars'); return; }
    setFeedbackSending(true);
    try {
      await sendAppFeedback(m);
      setFeedbackMsg('');
      setReportOpen(false);
      showToast('Feedback sent');
    } catch { showToast('Feedback failed'); }
    finally { setFeedbackSending(false); }
  };

  const name = user?.politician_name || user?.username || '';
  const leaderBits = [user?.leader_title, user?.leader_party].filter(Boolean).join(' · ');
  const constituency = user?.constituency_name ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: surface }}>
      <ScreenHeader title="More" />
      <ScrollView contentContainerStyle={{ paddingTop: space.md, paddingBottom: space.xl }} showsVerticalScrollIndicator={false}>
        <GroupedList sections={[
          {
            title: 'PROFILE',
            rows: [
              { icon: 'account-circle', iconColor: c.accent, title: name, value: leaderBits || undefined },
              { icon: 'place', iconColor: c.muted, title: 'Constituency', value: constituency ?? 'Not available' },
            ],
          },
          {
            title: 'ACCOUNT',
            rows: [
              { icon: 'contact-mail', iconColor: c.text, title: 'Contact details', value: `${profile?.email ?? 'Not set'} · ${profile?.phone ?? 'Not set'}` },
              { icon: 'translate', iconColor: c.text, title: t('m.language'), value: t('m.language.value'), onPress: () => setLang(lang === 'te' ? 'en' : 'te') },
            ],
          },
          {
            title: 'NOTIFICATIONS',
            rows: [
              { icon: 'notifications', iconColor: pushEnabled ? c.accent : c.muted, title: 'Push notifications', switch: { value: pushEnabled, onValueChange: toggleNotif } },
              { icon: 'email', iconColor: c.text, title: 'Email alerts', switch: { value: emailAlerts, onValueChange: handleToggleEmailAlerts } },
              ...(profile?.email_configured ? [{ icon: 'send', iconColor: c.accent, title: 'Send me a test alert', onPress: handleSendTestAlert }] : []),
            ],
          },
          {
            title: 'SECURITY',
            rows: [
              { icon: 'lock', iconColor: c.text, title: 'Change password', onPress: () => router.push('/change-password') },
              { icon: 'logout', iconColor: c.danger, title: 'Sign out of all devices', danger: true, onPress: () => { Alert.alert('Sign out', 'Sign out of all devices?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', onPress: onLogout }]); } },
            ],
          },
          {
            title: 'YOUR WORK',
            rows: [
              ...(user?.role === 'admin' ? [] : [{ icon: 'bookmark', iconColor: c.text, title: 'Saved stories', onPress: () => router.push('/saved') }]),
              ...(user?.role === 'admin' ? [] : [{ icon: 'send', iconColor: c.text, title: 'Sent shares', onPress: () => router.push('/(tabs)/sent') }]),
              ...(user?.role !== 'admin' ? [{ icon: 'description', iconColor: c.text, title: 'Letters & petitions', onPress: () => router.push('/work') }] : []),
              ...(user?.role === 'mla' || user?.role === 'minister' ? [{ icon: 'groups', iconColor: c.text, title: 'My team', onPress: () => router.push('/my-team') }] : []),
            ],
          },
          {
            title: 'HELP',
            rows: [{ icon: 'help-outline', iconColor: c.text, title: 'Send feedback', onPress: () => setReportOpen(true) }],
          },
          {
            title: 'ABOUT',
            rows: [
              { icon: 'info-outline', iconColor: c.text, title: 'Version', value: Constants.expoConfig?.version ?? '1.0.0' },
              { icon: 'build', iconColor: c.text, title: 'Build', value: BUILD_PROFILE },
              { icon: 'wifi', iconColor: health === 'connected' ? c.ok : c.danger, title: 'Server status', value: health === 'connected' ? 'Connected' : 'Not reachable' },
            ],
          },
        ]} />
        <Pressable style={{ minHeight: 48, justifyContent: 'center', marginTop: space.xl }} onPress={onLogout} accessibilityRole="button" accessibilityLabel="Sign out">
          <Text style={{ color: c.danger, fontWeight: '700', fontSize: 15, textAlign: 'center' }}>Sign out</Text>
        </Pressable>
      </ScrollView>
      <BottomSheet visible={reportOpen} onClose={() => setReportOpen(false)} title="Send feedback">
        <TextInput value={feedbackMsg} onChangeText={setFeedbackMsg} placeholder="Your feedback (3–2000 chars)" multiline numberOfLines={4} style={{ fontSize: 14, color: c.text, borderWidth: 1, borderColor: hairline, borderRadius: radius.row, padding: space.sm, minHeight: 110 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, paddingTop: space.sm }}>
          <Pressable onPress={() => setReportOpen(false)} accessibilityLabel="Cancel" hitSlop={20} style={{ minWidth: 56, alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: c.muted, fontSize: 14 }}>Cancel</Text>
          </Pressable>
          <Pressable onPress={handleSendFeedback} accessibilityLabel="Send feedback" disabled={feedbackSending} hitSlop={20} style={{ minWidth: 80, alignItems: 'center', paddingVertical: 8, backgroundColor: c.accentBg, borderRadius: radius.pill }}>
            <Text style={{ color: c.accentText, fontSize: 14, fontWeight: '700' }}>{feedbackSending ? 'Sending...' : 'Send'}</Text>
          </Pressable>
        </View>
      </BottomSheet>
      {toast && <Toast message={toast.message} visible={toast.visible} onDismiss={() => setToast(null)} />}
    </View>
  );
}
