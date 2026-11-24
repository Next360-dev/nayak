import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, Linking, RefreshControl, Pressable, Text, TextInput, View } from 'react-native';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchNews, fetchSocialMedia, scrapeSocial, translate, fetchRefreshStatus, startRefresh, reportStory } from '../../src/api/news';
import { Article } from '../../src/types';
import { PAGE_SIZE } from '../../src/constants/config';
import { useAuth } from '../../src/hooks/useAuth';
import { hairline, space, surface, tints, useTheme } from '../../src/theme';
import { Card, EmptyState, ScreenHeader, StickyBar } from '../../src/ui';
import { NewsCard, NewsSkeleton, PresetChips, ScopeItem, ScopeTabs, Tone } from '../../src/ui/NewsParts';
import { BottomSheet } from '../../src/ui/BottomSheet';
import { rememberStory } from '../../src/lib/storyCache';
import { useLastVisit } from '../../src/lib/lastVisit';
import { useLang } from '../../src/i18n';

const MIX_SOCIAL_SCOPES = ['all', 'positive', 'negative'];
const DEBOUNCE_MS = 400;

export type NewsMode = 'live' | 'social' | 'history';

// One news engine, three tabs (as on the web): Live = last 24 h, Social = public posts about the leader, History = older.
export function NewsView({ mode }: { mode: NewsMode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const canShare = !!user && user.role !== 'admin';
  const { c } = useTheme();
  const since = useLastVisit();
  const { t } = useLang();

  const [scope, setScope] = useState(mode === 'social' ? 'social' : 'all');
  const { scope: scopeParam, ts: scopeTs } = useLocalSearchParams<{ scope?: string; ts?: string }>();
  const [appliedScope, setAppliedScope] = useState<string | undefined>();
  const scopeKey = scopeParam ? `${scopeParam}|${scopeTs ?? ''}` : undefined;
  if (scopeKey && scopeKey !== appliedScope) {
    setAppliedScope(scopeKey);
    if (['all', 'positive', 'negative', 'statewide', 'civic', 'social'].includes(scopeParam as string)) setScope(scopeParam as string);
  }
  const [period] = useState(mode === 'history' ? 'history' : 'today');
  const [dateRange, setDateRange] = useState('all');
  const [translations, setTranslations] = useState<Record<number, { h: string; s: string }>>({});
  const [refreshStatus, setRefreshStatus] = useState<any>(null);
  const [refreshingNews, setRefreshingNews] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [refreshWaitUntil, setRefreshWaitUntil] = useState(0);
  const [now, setNow] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ title: string; article_id?: number | null } | null>(null);
  const aliveRef = useRef(true);
  const refreshInFlightRef = useRef(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyRefreshStatus = useCallback((s: any) => {
    setRefreshStatus(s);
    setNow(Date.now());
    setRefreshWaitUntil(s && s.wait > 0 ? Date.now() + s.wait * 1000 : 0);
  }, []);

  useEffect(() => () => { aliveRef.current = false; if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); }, []);

  useEffect(() => {
    let cancelled = false;
    fetchRefreshStatus().then((s) => { if (!cancelled && aliveRef.current) applyRefreshStatus(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [applyRefreshStatus]);

  useEffect(() => {
    if (!refreshWaitUntil || refreshWaitUntil <= Date.now()) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [refreshWaitUntil]);

  const activeConstituency = (user && user.scoped && user.constituency_name) ? user.constituency_name : null;
  const activeMlaName = (user && user.scoped && user.politician_name) ? user.politician_name : null;
  const socialDataReady = !!activeConstituency && scope !== 'social';

  const [mixedSocialPosts, setMixedSocialPosts] = useState<any[]>([]);
  const [mixedSocialStats, setMixedSocialStats] = useState<{ total_posts?: number; positive_posts?: number; negative_posts?: number } | null>(null);

  useEffect(() => {
    if (!socialDataReady) return;
    let cancelled = false;
    fetchSocialMedia({ constituency: activeConstituency!, mla_name: activeMlaName || 'All', period }).then((res) => {
      if (cancelled || !res || res.status !== 'success') return;
      setMixedSocialPosts(res.posts || []);
      setMixedSocialStats(res.stats || null);
    }).catch(() => { if (!cancelled) { setMixedSocialPosts([]); setMixedSocialStats(null); } });
    return () => { cancelled = true; };
  }, [socialDataReady, activeConstituency, activeMlaName, period]);

  const { data, isLoading, isError, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['news', scope, period, dateRange, searchQuery],
      queryFn: ({ pageParam }) => fetchNews({ period, news_scope: scope, page: pageParam as number, limit: PAGE_SIZE, date_range: period === 'history' ? dateRange : undefined, search: searching ? searchQuery : undefined }),
      initialPageParam: 1,
      getNextPageParam: (last) => {
        const p = last.pagination;
        if (!p) return undefined;
        const pages = p.total_pages ?? p.pages;
        const page = p.page;
        if (pages && page < pages) return page + 1;
        if (p.has_next) return page + 1;
        return undefined;
      },
    });

  const articles: Article[] = (data?.pages || []).flatMap((p) => p.articles || []);
  const scopeCounts = (data?.pages?.[0]?.scope_counts) || null;

  const shouldMixSocial = MIX_SOCIAL_SCOPES.includes(scope) && socialDataReady && !searching;

  const categorizedArticles = useMemo(() => {
    return (articles || []).map((art) => ({ ...art, sentiment: art.sentiment || 'positive', is_statewide: art.is_statewide !== undefined ? art.is_statewide : false }));
  }, [articles]);

  const sortedArticles = useMemo(() => {
    return [...categorizedArticles].sort((a, b) => {
      const aDirect = !a.is_district_update ? 1 : 0;
      const bDirect = !b.is_district_update ? 1 : 0;
      if (aDirect !== bDirect) return bDirect - aDirect;
      const timeA = a.date_time ? new Date(a.date_time).getTime() : (a.published_at ? new Date(a.published_at).getTime() : 0);
      const timeB = b.date_time ? new Date(b.date_time).getTime() : (b.published_at ? new Date(b.published_at).getTime() : 0);
      return timeB - timeA;
    });
  }, [categorizedArticles]);

  const filteredArticles = useMemo(() => {
    if (scope === 'positive') {
      const pos = sortedArticles.filter((a) => a.sentiment === 'positive');
      return pos.length > 0 ? pos : sortedArticles;
    }
    if (scope === 'negative') {
      const neg = sortedArticles.filter((a) => a.sentiment === 'negative');
      return neg.length > 0 ? neg : sortedArticles;
    }
    if (scope === 'statewide') {
      const sw = sortedArticles.filter((a) => a.is_statewide || a.district_name === 'Statewide' || a.constituency_name === 'Statewide');
      return sw.length > 0 ? sw : sortedArticles;
    }
    if (scope === 'civic') {
      return sortedArticles.filter((a) => a.news_type === 'civic' || a.is_civic);
    }
    return sortedArticles;
  }, [sortedArticles, scope]);

  const mixedItems = useMemo(() => {
    if (!shouldMixSocial) return null;
    const strictArticles = scope === 'positive'
      ? sortedArticles.filter((a) => a.sentiment === 'positive')
      : scope === 'negative'
        ? sortedArticles.filter((a) => a.sentiment === 'negative')
        : sortedArticles;
    const matchingSocial = scope === 'positive'
      ? mixedSocialPosts.filter((p) => p.sentiment === 'positive')
      : scope === 'negative'
        ? mixedSocialPosts.filter((p) => p.sentiment === 'negative')
        : mixedSocialPosts;
    const articleItems = strictArticles.map((a) => ({ kind: 'article' as const, key: `a-${a.id}`, ts: a.date_time ? new Date(a.date_time).getTime() : (a.published_at ? new Date(a.published_at).getTime() : 0), data: a }));
    const socialItems = matchingSocial.map((p) => ({ kind: 'social' as const, key: `s-${p.id}`, ts: p.published_at ? new Date(p.published_at).getTime() : 0, data: p }));
    return [...articleItems, ...socialItems].sort((x, y) => y.ts - x.ts);
  }, [shouldMixSocial, scope, sortedArticles, mixedSocialPosts]);

  const { data: socialFeed, isLoading: socialLoading, refetch: refetchSocial } = useQuery({
    queryKey: ['social', activeConstituency, activeMlaName, period],
    queryFn: () => fetchSocialMedia({ constituency: activeConstituency, mla_name: activeMlaName || 'All', period }),
    enabled: scope === 'social' && !!activeConstituency,
    // The server refreshes old social data in the background by itself; look again until it says it is done.
    refetchInterval: (q) => (q.state.data?.refreshing ? 4000 : false),
  });
  const socialUpdating = scope === 'social' && !!socialFeed?.refreshing;

  const socialPosts = (scope === 'social') ? (socialFeed?.posts || []) : [];

  const computedCounts = useMemo(() => {
    let positive = 0, negative = 0, statewide = 0, civic = 0;
    for (const art of sortedArticles) {
      if (art.sentiment === 'positive') positive++;
      if (art.sentiment === 'negative') negative++;
      if (art.is_statewide || art.district_name === 'Statewide') statewide++;
      if (art.news_type === 'civic' || art.is_civic) civic++;
    }
    return {
      all: scopeCounts?.all !== undefined ? scopeCounts.all : sortedArticles.length,
      positive: scopeCounts?.positive !== undefined ? scopeCounts.positive : positive,
      negative: scopeCounts?.negative !== undefined ? scopeCounts.negative : negative,
      statewide: scopeCounts?.statewide !== undefined ? scopeCounts.statewide : (statewide || 0),
      civic: scopeCounts?.civic !== undefined ? scopeCounts.civic : civic,
      social: scopeCounts?.social !== undefined ? scopeCounts.social : (mixedSocialStats?.total_posts || 0),
    };
  }, [sortedArticles, scopeCounts, mixedSocialStats]);

  const displayCounts = (socialDataReady && mixedSocialStats)
    ? {
        ...computedCounts,
        all: (computedCounts.all || 0) + (mixedSocialStats.total_posts || 0),
        positive: (computedCounts.positive || 0) + (mixedSocialStats.positive_posts || 0),
        negative: (computedCounts.negative || 0) + (mixedSocialStats.negative_posts || 0),
      }
    : computedCounts;

  const ALL_SCOPES: ScopeItem[] = [
    { id: 'all', label: 'All', count: Math.min(displayCounts.all, 999), icon: 'layers', color: c.text },
    { id: 'positive', label: 'Positive', count: Math.min(displayCounts.positive, 999), icon: 'trending-up', color: c.ok },
    { id: 'negative', label: 'Negative', count: Math.min(displayCounts.negative, 999), icon: 'trending-down', color: c.danger },
    { id: 'statewide', label: 'Statewide', count: Math.min(displayCounts.statewide, 999), icon: 'groups', color: tints.violet },
    { id: 'civic', label: 'Civic', count: Math.min(displayCounts.civic, 999), icon: 'account-balance', color: c.accent },
    { id: 'social', label: 'Social', count: Math.min(displayCounts.social, 999), icon: 'forum', color: tints.blue },
  ];

  const SCOPES = ALL_SCOPES.filter((x) => x.id !== 'social');

  const toggleTranslate = async (a: Article) => {
    if (translations[a.id]) {
      setTranslations((prev) => { const n = { ...prev }; delete n[a.id]; return n; });
      return;
    }
    try {
      const t = await translate(a.headline, a.summary || '');
      setTranslations((prev) => ({ ...prev, [a.id]: { h: t.translated_headline, s: t.translated_summary } }));
    } catch {}
  };

  const refreshWaitLeft = refreshWaitUntil > now ? Math.ceil((refreshWaitUntil - now) / 1000) : 0;

  // On the Social tab, Refresh searches the web for new posts about the MLA (the news refresh does not cover social).
  const refreshSocial = async () => {
    if (refreshInFlightRef.current || refreshingNews) return;
    if (!activeConstituency) { setRefreshMsg('Social posts need a constituency'); return; }
    refreshInFlightRef.current = true;
    setRefreshingNews(true);
    setRefreshMsg('Searching social media');
    try {
      const r = await scrapeSocial(activeConstituency, activeMlaName);
      if (!aliveRef.current) return;
      setRefreshMsg(r.scraped_count > 0 ? `${r.scraped_count} posts found` : 'No new posts found');
      await refetchSocial();
    } catch {
      if (aliveRef.current) setRefreshMsg('Could not search social media. Try again later.');
    } finally {
      refreshInFlightRef.current = false;
      if (aliveRef.current) setRefreshingNews(false);
    }
  };

  const clickRefresh = async () => {
    if (scope === 'social') { await refreshSocial(); return; }
    if (refreshInFlightRef.current || refreshingNews || refreshWaitLeft > 0) return;
    refreshInFlightRef.current = true;
    setRefreshMsg('');
    try {
      const s = await startRefresh();
      if (!aliveRef.current) return;
      applyRefreshStatus(s);
      if (s && s.state === 'cooldown') {
        setRefreshMsg(`Please wait ${s.wait} seconds`);
        return;
      }
      if (s && s.state === 'running' && !s.mine) setRefreshMsg('Another refresh is running');
      setRefreshingNews(true);
      for (let i = 0; i < 120 && aliveRef.current; i += 1) {
        await new Promise((r) => setTimeout(r, 1500));
        const cur = await fetchRefreshStatus();
        if (!aliveRef.current) return;
        applyRefreshStatus(cur);
        if (cur.state !== 'running') {
          setRefreshingNews(false);
          const last = cur.last || {};
          if (last.ok === false) setRefreshMsg(last.error || 'Refresh failed');
          else if (last.new > 0) setRefreshMsg(`${last.new} new ${last.new === 1 ? 'story' : 'stories'}`);
          else setRefreshMsg('No new stories');
          qc.invalidateQueries({ queryKey: ['news'] });
          void refetch();
          if (scope === 'social') void refetchSocial();
          if (socialDataReady && activeConstituency) {
            try {
              const res = await fetchSocialMedia({ constituency: activeConstituency, mla_name: activeMlaName || 'All', period });
              if (aliveRef.current && res && res.status === 'success') {
                setMixedSocialPosts(res.posts || []);
                setMixedSocialStats(res.stats || null);
              }
            } catch {}
          }
          return;
        }
      }
      setRefreshingNews(false);
    } catch (e: any) {
      if (aliveRef.current) { setRefreshingNews(false); setRefreshMsg(e?.message || 'Refresh failed'); }
    } finally {
      refreshInFlightRef.current = false;
    }
  };

  const toneOf = (a: Article): Tone => {
    if (a.sentiment === 'negative') return 'negative';
    if (a.is_statewide || a.district_name === 'Statewide') return 'statewide';
    if (a.sentiment === 'positive') return 'positive';
    return 'neutral';
  };

  const handleLongPress = (item: { title: string; article_id?: number | null }) => {
    setReportTarget(item);
    setReportOpen(true);
  };

  const submitReport = async (kind: 'not_relevant' | 'wrong_priority' | 'wrong_sentiment') => {
    if (!reportTarget) return;
    try {
      await reportStory({ kind, title: reportTarget.title, article_id: reportTarget.article_id ?? undefined });
      setReportOpen(false);
      setReportTarget(null);
    } catch {}
  };

  const storyTime = (a: Article) => {
    const v = a.date_time || a.published_at;
    const n = v ? new Date(v).getTime() : NaN;
    return Number.isFinite(n) ? n : 0;
  };
  const isNewStory = (a: Article) => since !== null && period === 'today' && storyTime(a) > since;

  const openStory = (a: Article) => {
    const links = (a.sources || []).map((x: any) => ({ publisher: x?.publisher || x?.newspaper_name || x?.name, url: x?.url })).filter((x) => x.url);
    const id = rememberStory({
      id: String(a.id), headline: a.headline, summary: a.summary, url: a.url, place: a.constituency_name || a.district_name,
      source: a.newspaper_name || a.source, time: a.date_time || a.published_at, tone: toneOf(a), urgent: a.priority_score === 1,
      imageUrl: a.image_url, sources: links.length ? links : undefined,
    });
    router.push(`/story/${id}`);
  };

  const renderArticle = (item: Article) => {
    const t = translations[item.id];
    return (
      <NewsCard
        key={String(item.id)}
        headline={t ? t.h : item.headline}
        summary={t ? t.s : item.summary}
        tone={toneOf(item)}
        urgent={item.priority_score === 1}
        place={item.constituency_name || item.district_name}
        source={item.newspaper_name || item.source}
        time={item.date_time || item.published_at}
        imageUrl={item.image_url}
        isNew={isNewStory(item)}
        onPress={() => openStory(item)}
        translated={!!t}
        onTranslate={() => { void toggleTranslate(item); }}
        onShare={item.url && canShare ? () => router.push({ pathname: '/share/create', params: { title: item.headline, url: item.url || '' } }) : undefined}
        onLongPress={() => handleLongPress({ title: item.headline, article_id: item.id })}
      />
    );
  };

  const renderSocialPost = (post: any) => (
    <NewsCard
      key={`s-${post.id}`}
      headline={post.content || post.text || post.title || ''}
      tone={post.sentiment === 'negative' ? 'negative' : post.sentiment === 'positive' ? 'positive' : 'neutral'}
      labelNeutral
      place={post.platform_name || post.platform}
      source={post.author_name}
      time={post.published_at}
      onPress={post.url ? () => { void Linking.openURL(post.url).catch(() => {}); } : undefined}
      onLongPress={() => handleLongPress({ title: post.content || post.text || post.title || '', article_id: undefined })}
    />
  );

  const loadingFirst = (scope === 'social' ? socialLoading : isLoading) && articles.length === 0;
  const failed = isError && articles.length === 0 && scope !== 'social';

  let listData: any[] = [];
  if (scope === 'social') {
    listData = socialPosts;
  } else if (shouldMixSocial && mixedItems) {
    listData = mixedItems;
  } else {
    listData = filteredArticles;
  }

  const place = activeConstituency || user?.constituency_name || 'Telangana';
  const updated = refreshStatus?.latest_story_at ? relativeTime(refreshStatus.latest_story_at) : '';
  const refreshLabel = refreshingNews ? 'Refreshing' : refreshWaitLeft > 0 ? `${refreshWaitLeft}s` : 'Refresh';
  const newCount = since !== null && period === 'today' ? filteredArticles.filter(isNewStory).length : 0;
  const note = refreshMsg || (socialUpdating ? 'Updating social posts' : scope === 'social' && socialFeed?.showing_older ? 'No posts in 24h · showing older' : newCount > 0 ? `${newCount} new since you were last here` : updated ? `Updated ${updated}` : '');

  const headerActions: { icon: React.ComponentProps<typeof MaterialIcons>['name']; label: string; onPress: () => void }[] = [
    { icon: searching ? 'close' : 'search', label: searching ? 'Cancel search' : 'Search', onPress: () => { setSearching(!searching); if (!searching) setSearchQuery(''); } },
    { icon: 'refresh', label: refreshLabel, onPress: clickRefresh },
  ];

  const header = searching ? (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: surface, borderBottomWidth: 1, borderBottomColor: hairline }}>
      <TextInput
        value={searchQuery}
        onChangeText={(t) => { setSearchQuery(t); if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); searchDebounceRef.current = setTimeout(() => setSearching(true), DEBOUNCE_MS); }}
        placeholder="Search stories"
        style={{ flex: 1, fontSize: 15, color: c.text, paddingVertical: 6 }}
        placeholderTextColor={c.muted}
      />
      <Pressable onPress={() => { setSearching(false); setSearchQuery(''); }} accessibilityLabel="Cancel search" hitSlop={20} style={{ minWidth: 44, alignItems: 'center' }}>
        <Text style={{ color: c.accentText, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
      </Pressable>
    </View>
  ) : (
    <ScreenHeader title={t(mode === 'social' ? 'nav.social' : mode === 'history' ? 'nav.history' : 'nav.live')} subtitle={`${place} · ${note}`.trim()} actions={headerActions} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: surface }}>
      {header}
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}
        showsVerticalScrollIndicator={false}
        data={failed || loadingFirst ? [] : listData}
        keyExtractor={(i, idx) => (i.kind ? `${i.kind}-${i.key}` : `${i.id ?? idx}-${idx}`)}
        renderItem={({ item }) => {
          if (item.kind === 'social') return renderSocialPost(item.data);
          if (item.kind === 'article') return renderArticle(item.data);
          // On the Social tab the rows are raw posts (they carry `content`, not `headline`).
          if (scope === 'social') return renderSocialPost(item);
          return renderArticle(item);
        }}
        ListHeaderComponent={
          <StickyBar>
            {mode !== 'social' ? <ScopeTabs items={SCOPES} value={scope} onChange={setScope} /> : null}
            {period === 'history' ? (
              <PresetChips
                items={[{ id: 'all', label: 'All older' }, { id: '48h', label: '24-48h' }, { id: '3d', label: '3 days' }, { id: '7d', label: '7 days' }, { id: '14d', label: '14 days' }]}
                value={dateRange}
                onChange={setDateRange}
              />
            ) : null}
          </StickyBar>
        }
        stickyHeaderIndices={[0]}
        refreshControl={<RefreshControl refreshing={isRefetching || (scope === 'social' && socialLoading)} tintColor={c.accent} onRefresh={() => { qc.invalidateQueries({ queryKey: ['news'] }); void refetch(); if (scope === 'social') void refetchSocial(); }} />}
        onEndReached={() => { if (scope !== 'social' && hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={c.muted} style={{ margin: space.lg }} /> : (!hasNextPage && scope !== 'social' && listData.length > 0 ? <Text style={{ color: c.muted, fontSize: 13, textAlign: 'center', padding: space.xl }}>You are all caught up.</Text> : undefined)}
        ListEmptyComponent={
          loadingFirst ? <NewsSkeleton /> : failed ? (
            <Card style={{ marginHorizontal: space.lg }}>
              <EmptyState icon="cloud-off" title="Could not load news" hint="Check your connection." />
              <Pressable onPress={() => { void refetch(); }} accessibilityRole="button" accessibilityLabel="Try again" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginBottom: space.md }}>
                <Text style={{ color: c.accentText, fontWeight: '700', fontSize: 15 }}>Try again</Text>
              </Pressable>
            </Card>
          ) : (
            <Card style={{ marginHorizontal: space.lg }}>
              <EmptyState
                icon={scope === 'social' ? 'forum' : 'search'}
                title={searching ? 'No stories match' : scope === 'social' ? (socialUpdating ? 'Searching social media' : 'No social posts yet') : 'No stories in this view'}
                hint={searching ? 'Try another keyword.' : scope === 'social' ? (socialUpdating ? 'Looking on YouTube, Facebook, Instagram and X. New posts appear here by themselves.' : 'Nothing found for your MLA yet. Tap Refresh to search again.') : 'Pull down to refresh, or try Archive.'}
              />
            </Card>
          )
        }
      />
      <BottomSheet visible={reportOpen} onClose={() => { setReportOpen(false); setReportTarget(null); }} title="Report story">
        <Pressable onPress={() => { submitReport('not_relevant'); }} accessibilityLabel="Not relevant" hitSlop={20} style={styles.sheetRow}>
          <Text style={{ color: c.text, fontSize: 15 }}>Not relevant</Text>
        </Pressable>
        <Pressable onPress={() => { submitReport('wrong_priority'); }} accessibilityLabel="Wrong priority" hitSlop={20} style={styles.sheetRow}>
          <Text style={{ color: c.text, fontSize: 15 }}>Wrong priority</Text>
        </Pressable>
        <Pressable onPress={() => { submitReport('wrong_sentiment'); }} accessibilityLabel="Wrong sentiment" hitSlop={20} style={styles.sheetRow}>
          <Text style={{ color: c.text, fontSize: 15 }}>Wrong sentiment</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

const styles = { sheetRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: hairline } };

function relativeTime(s?: string | null) {
  if (!s) return '';
  const diff = (Date.now() - new Date(s).getTime()) / 1000;
  if (Number.isNaN(diff)) return '';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function LiveScreen() {
  return <NewsView mode="live" />;
}
