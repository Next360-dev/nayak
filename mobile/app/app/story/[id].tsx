import React, { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { translate } from '../../src/api/news';
import { useAuth } from '../../src/hooks/useAuth';
import { getStory } from '../../src/lib/storyCache';
import { relativeTime } from '../../src/lib/time';
import { radius, space, type, useTheme } from '../../src/theme';
import { Badge, Card, EmptyState } from '../../src/ui';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { SentimentPill } from '../../src/ui/NewsParts';

function formatWhen(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function hostOf(url: string) {
  const m = /^https?:\/\/(?:www\.)?([^/]+)/i.exec(url);
  return m ? m[1] : url;
}

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const { user } = useAuth();
  const story = getStory(id);
  const canShare = !!user && user.role !== 'admin';

  const [imgFailed, setImgFailed] = useState(false);
  const [tr, setTr] = useState<{ h: string; s: string } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [note, setNote] = useState('');

  if (!story) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Story" onBack={() => router.back()} />
        <View style={{ padding: space.lg }}>
          <Card>
            <EmptyState icon="article" title="This story is no longer available" hint="Open it again from the News list." />
          </Card>
        </View>
      </View>
    );
  }

  const links = (story.sources || []).filter((s) => s.url);
  const firstUrl = story.url || links[0]?.url || null;
  const headline = tr ? tr.h : story.headline;
  const summary = tr ? tr.s : story.summary;
  const showSummary = !!summary && summary.trim() !== story.headline.trim();
  const meta = [story.place, story.source].filter(Boolean).join(' · ');
  const when = [formatWhen(story.time), relativeTime(story.time)].filter(Boolean).join(' · ');

  const open = async (url?: string | null) => {
    if (!url) return;
    setNote('');
    try {
      await Linking.openURL(url);
    } catch {
      setNote('Could not open that link.');
    }
  };

  const toggleTranslate = async () => {
    if (tr) { setTr(null); return; }
    setTranslating(true);
    setNote('');
    try {
      const t = await translate(story.headline, story.summary || '');
      setTr({ h: t.translated_headline, s: t.translated_summary });
    } catch {
      setNote('Translation is not available right now.');
    } finally {
      setTranslating(false);
    }
  };

  const share = () => router.push({ pathname: '/share/create', params: { title: story.headline, url: firstUrl || '' } });

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Story"
        onBack={() => router.back()}
        actions={canShare && firstUrl ? [{ icon: 'share', label: 'Share this story', onPress: share }] : undefined}
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl * 2, gap: space.md }} showsVerticalScrollIndicator={false}>
        <Card>
          {story.imageUrl && !imgFailed ? (
            <Image
              source={{ uri: story.imageUrl }}
              onError={() => setImgFailed(true)}
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: c.surface }}
            />
          ) : null}
          <View style={{ padding: space.lg, gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
              <SentimentPill tone={story.tone} />
              {story.urgent ? <Badge label="Urgent" tone="danger" /> : null}
            </View>
            <Text selectable style={[type.display, { color: c.text }]}>{headline}</Text>
            {meta || when ? (
              <View style={{ gap: 2 }}>
                {meta ? <Text style={[type.caption, { color: c.muted }]}>{meta}</Text> : null}
                {when ? <Text style={[type.caption, { color: c.muted }]}>{when}</Text> : null}
              </View>
            ) : null}
            {showSummary ? <Text selectable style={[type.reading, { color: c.text }]}>{summary}</Text> : null}
          </View>
        </Card>

        {firstUrl ? (
          <Pressable
            onPress={() => { void open(firstUrl); }}
            accessibilityRole="button"
            accessibilityLabel="Read the full story"
            style={({ pressed }) => ({ minHeight: 52, borderRadius: radius.pill, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, opacity: pressed ? 0.85 : 1 })}
          >
            <MaterialIcons name="open-in-new" size={20} color={c.onAccent} />
            <Text style={[type.headline, { color: c.onAccent, fontWeight: '700' }]}>Read the full story</Text>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Pressable
            onPress={() => { void toggleTranslate(); }}
            disabled={translating}
            accessibilityRole="button"
            accessibilityLabel={tr ? 'Show the original text' : 'Translate to Telugu'}
            style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, opacity: pressed || translating ? 0.7 : 1 })}
          >
            <MaterialIcons name="translate" size={20} color={c.text} />
            <Text style={[type.body, { color: c.text, fontWeight: '600' }]}>{translating ? 'Translating' : tr ? 'Original' : 'తెలుగు'}</Text>
          </Pressable>
          {canShare && firstUrl ? (
            <Pressable
              onPress={share}
              accessibilityRole="button"
              accessibilityLabel="Share with my team"
              style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, opacity: pressed ? 0.7 : 1 })}
            >
              <MaterialIcons name="share" size={20} color={c.text} />
              <Text style={[type.body, { color: c.text, fontWeight: '600' }]}>Share</Text>
            </Pressable>
          ) : null}
        </View>

        {note ? <Text style={[type.caption, { color: c.danger, paddingHorizontal: space.xs }]} accessibilityLiveRegion="polite">{note}</Text> : null}

        {links.length > 0 ? (
          <View>
            <Text style={[type.headline, { color: c.text, marginBottom: space.sm, paddingHorizontal: space.xs }]} accessibilityRole="header">
              {links.length === 1 ? 'Source' : `Sources (${links.length})`}
            </Text>
            <Card>
              {links.map((s, i) => (
                <Pressable
                  key={`${s.url}-${i}`}
                  onPress={() => { void open(s.url); }}
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${s.publisher || hostOf(s.url || '')}`}
                  style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, backgroundColor: pressed ? c.surface : 'transparent', borderBottomWidth: i === links.length - 1 ? 0 : 1, borderBottomColor: c.border })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { color: c.text, fontWeight: '600' }]} numberOfLines={1}>{s.publisher || hostOf(s.url || '')}</Text>
                    <Text style={[type.caption, { color: c.muted }]} numberOfLines={1}>{hostOf(s.url || '')}</Text>
                  </View>
                  <MaterialIcons name="open-in-new" size={20} color={c.muted} />
                </Pressable>
              ))}
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
