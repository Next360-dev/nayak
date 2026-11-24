import React from 'react';
import { Tabs } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../src/api/client';
import { UnreadCountResponse } from '../../src/types';
import { useAuth } from '../../src/hooks/useAuth';
import { sceneBackground, useTheme } from '../../src/theme';
import FloatingTabBar from '../../src/ui/FloatingTabBar';

function useUnread() {
  const { data } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => apiFetch<UnreadCountResponse>('/api/shares/unread-count'),
    refetchInterval: 60000,
  });
  return data?.count ?? 0;
}

export default function TabsLayout() {
  const unread = useUnread();
  const { c } = useTheme();
  const { user } = useAuth();
  const role = user?.role;
  const isLeader = role === 'mla' || role === 'minister';
  const isAdmin = role === 'admin';
  const isStaff = role === 'staff';

  // A tab is hidden by setting href to null. "Sent" stays reachable from Home and More.
  const show = (cond: boolean) => (cond ? undefined : null);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...(props as unknown as React.ComponentProps<typeof FloatingTabBar>)} />}
      screenOptions={{
        // Every tab draws its own ScreenHeader (Users is the one exception, below), so the navigator header would double it.
        headerShown: false,
        headerStyle: { backgroundColor: 'transparent' },
        headerShadowVisible: false,
        headerTitleStyle: { color: c.text, fontWeight: '700' },
        sceneStyle: { backgroundColor: sceneBackground },
      }}
    >
      {/* The bar shows the five tabs of the web app. Inbox, Team, Users, Sent and More stay routable (identity bar, Home sections) but are not in the bar. */}
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false }} />
      <Tabs.Screen name="news" options={{ title: 'Live', headerShown: false, href: show(isLeader || isStaff) }} />
      <Tabs.Screen name="social" options={{ title: 'Social', headerShown: false, href: show(isLeader || isStaff) }} />
      <Tabs.Screen name="history" options={{ title: 'History', headerShown: false, href: show(isLeader || isStaff) }} />
      <Tabs.Screen name="portfolio" options={{ title: 'Portfolio', headerShown: false, href: show(isLeader || isStaff) }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox', href: null, tabBarBadge: unread > 0 ? unread : undefined }} />
      <Tabs.Screen name="sent" options={{ title: 'Sent', href: null }} />
      <Tabs.Screen name="team" options={{ title: 'Team', href: null }} />
      <Tabs.Screen name="users" options={{ title: 'Users', headerShown: true, href: show(isAdmin) }} />
      <Tabs.Screen name="settings" options={{ title: 'More', href: null }} />
    </Tabs>
  );
}
