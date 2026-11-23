import React from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSaved, removeSaved, SavedStory } from '../src/api/saved';
import { rememberStory } from '../src/lib/storyCache';
import { relativeTime } from '../src/lib/time';
import { space, surface, type, useTheme } from '../src/theme';
import { Card, EmptyState, ErrorState, ScreenHeader } from '../src/ui';

export default function SavedScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['saved'], queryFn: fetchSaved });
  const remove = useMutation({ mutationFn: (id: number) => removeSaved(id), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['saved'] }); } });

  const open = (s: SavedStory) => {
    const id = rememberStory({
      id: String(s.article_id ?? `saved-${s.id}`), headline: s.title, summary: s.summary, url: s.url, place: s.place, source: s.source,
      time: s.published_at, tone: s.tone === 'negative' ? 'negative' : s.tone === 'positive' ? 'positive' : s.tone === 'statewide' ? 'statewide' : 'neutral',
    });
    router.push(`/story/${id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: surface }}>
      <ScreenHeader title="Saved stories" onBack={() => router.back()} subtitle={q.data && q.data.length > 0 ? `${q.data.length} saved` : undefined} />
      {q.isError ? <ErrorState message="Could not load your saved stories." onRetry={() => { void q.refetch(); }} /> : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} tintColor={c.accent} />}
          ListEmptyComponent={q.isLoading ? <Text style={[type.body, { color: c.muted }]}>Loading</Text> : (
            <Card><EmptyState icon="bookmark-border" title="No saved stories yet" hint="Tap the bookmark on a story to keep it here." /></Card>
          )}
          renderItem={({ item }) => (
            <Card style={{ marginBottom: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable onPress={() => open(item)} accessibilityRole="button" accessibilityLabel={`Open story: ${item.title}`} style={({ pressed }) => ({ flex: 1, padding: space.lg, gap: 4, backgroundColor: pressed ? c.surface : 'transparent' })}>
                  <Text style={[type.body, { color: c.text, fontWeight: '700' }]} numberOfLines={3}>{item.title}</Text>
                  <Text style={[type.caption, { color: c.muted }]}>{[item.place, item.source, `saved ${relativeTime(item.saved_at)}`].filter(Boolean).join(' · ')}</Text>
                </Pressable>
                <Pressable onPress={() => remove.mutate(item.id)} accessibilityRole="button" accessibilityLabel={`Remove ${item.title} from saved`} hitSlop={8} style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name="bookmark-remove" size={22} color={c.muted} />
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}
