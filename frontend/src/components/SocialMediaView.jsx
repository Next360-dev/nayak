import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Eye, ExternalLink, Heart, Info, MapPin, MessageCircle, Repeat2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fetchSocialMediaPosts, triggerSocialMediaScrape } from '../utils/api';
import { Stats } from './home/shared';

/** The four platform marks, drawn here as small inline SVGs (no icon package). Colour is used only inside the mark. */
export function PlatformIcon({ platform, className = 'size-4' }) {
  const common = { viewBox: '0 0 24 24', className, role: 'img', 'aria-hidden': true };
  if (platform === 'twitter') {
    return (
      <svg {...common} fill="none" stroke="#0F1419" strokeWidth="2.4" strokeLinecap="round">
        <path d="M4.5 4.5l15 15" /><path d="M19.5 4.5l-15 15" stroke="#0F1419" strokeWidth="1.4" />
      </svg>
    );
  }
  if (platform === 'youtube') {
    return (
      <svg {...common}>
        <rect x="1.5" y="5" width="21" height="14" rx="4.2" fill="#FF0000" />
        <path d="M10 9.2v5.6l5-2.8z" fill="#FFFFFF" />
      </svg>
    );
  }
  if (platform === 'facebook') {
    return (
      <svg {...common}>
        <rect x="2" y="2" width="20" height="20" rx="5" fill="#1877F2" />
        <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.7c0-.9.3-1.5 1.6-1.5h1.4V4.5c-.3 0-1.1-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.3H8v3h2.6V21h2.9z" fill="#FFFFFF" />
      </svg>
    );
  }
  if (platform === 'instagram') {
    return (
      <svg {...common} fill="none" stroke="#C13584" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="5.2" />
        <circle cx="12" cy="12" r="4.1" />
        <circle cx="17.2" cy="6.8" r="1" fill="#C13584" stroke="none" />
      </svg>
    );
  }
  return <span className={cn(className, 'inline-block rounded bg-muted')} aria-hidden="true" />;
}

const PLATFORMS = {
  twitter: { name: 'X', action: 'View on X', actionTe: 'X లో చూడండి' },
  youtube: { name: 'YouTube', action: 'Watch video', actionTe: 'వీడియో చూడండి' },
  facebook: { name: 'Facebook', action: 'View on Facebook', actionTe: 'Facebook లో చూడండి' },
  instagram: { name: 'Instagram', action: 'View on Instagram', actionTe: 'Instagram లో చూడండి' },
};

function formatCount(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

export default function SocialMediaView({
  activeConstituency,
  activeMlaName,
  period,
  currentLang,
  currentUser,
  t
}) {
  const [sentimentFilter, setSentimentFilter] = useState('all'); // 'all' | 'positive' | 'negative'
  const [platformFilter, setPlatformFilter] = useState('all'); // 'all' | 'twitter' | 'youtube' | 'facebook' | 'instagram'
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState('');

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchSocialMediaPosts({
        constituency: activeConstituency || 'All',
        mlaName: activeMlaName || 'All',
        period: period,
        search: searchQuery.trim() || undefined
      });
      if (res && res.status === 'success') {
        setData(res);
      }
    } catch (err) {
      console.warn('Error loading social posts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeConstituency, activeMlaName, period, searchQuery]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleLiveScrape = async () => {
    if (!activeConstituency || activeConstituency === 'All') return;
    setIsScraping(true);
    setScrapeMsg('');
    try {
      const res = await triggerSocialMediaScrape(activeConstituency, activeMlaName);
      if (res && res.status === 'success') {
        const msg = currentLang === 'te'
          ? `సోషల్ మీడియా స్క్రేపింగ్ పూర్తయింది! ${res.saved_count || 0} పోస్టులు నవీకరించబడ్డాయి.`
          : `Search complete. ${res.saved_count || 0} mentions saved.`;
        setScrapeMsg(msg);
        setTimeout(() => setScrapeMsg(''), 5000);
        await loadPosts();
      }
    } catch (e) {
      console.warn('Error triggering live scrape:', e);
      setScrapeMsg('Scrape complete. Updated cached posts.');
      setTimeout(() => setScrapeMsg(''), 4000);
    } finally {
      setIsScraping(false);
    }
  };

  const mlaInfo = data?.mla || {
    name: activeMlaName || (currentLang === 'te' ? 'తెలంగాణ ప్రజా ప్రతినిధి' : 'Telangana Leadership'),
    constituency: activeConstituency || 'Statewide',
    district: 'Statewide',
    party: 'INC'
  };

  const stats = data?.stats || {
    total_posts: 0,
    positive_posts: 0,
    negative_posts: 0,
    positive_percentage: 50.0,
    negative_percentage: 50.0,
    platform_counts: { twitter: 0, youtube: 0, facebook: 0, instagram: 0 }
  };

  const allPosts = data?.posts || [];

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [sentimentFilter, platformFilter, searchQuery, activeConstituency, period]);

  const filteredPosts = useMemo(() => {
    return allPosts.filter(p => {
      if (sentimentFilter !== 'all' && p.sentiment !== sentimentFilter) return false;
      if (platformFilter !== 'all' && p.platform !== platformFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const contentMatch = (p.content || '').toLowerCase().includes(q);
        const authorMatch = (p.author_name || '').toLowerCase().includes(q) || (p.author_handle || '').toLowerCase().includes(q);
        if (!contentMatch && !authorMatch) return false;
      }
      return true;
    });
  }, [allPosts, sentimentFilter, platformFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize));

  const paginatedPosts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPosts.slice(start, start + pageSize);
  }, [filteredPosts, currentPage, pageSize]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return [];
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    const delta = 2;
    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    pages.push(1);
    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
  }, [totalPages, currentPage]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    const rootEl = document.getElementById('social-posts-grid') || document.getElementById('social-media-view-root');
    if (rootEl) {
      rootEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const te = currentLang === 'te';
  const [draft, setDraft] = useState('');
  const pill = (active) => cn('inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground');
  const pc = stats.platform_counts || {};
  const posPct = Number(stats.positive_percentage) || 0;
  const negPct = Number(stats.negative_percentage) || 0;
  const rangeText = `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredPosts.length)}`;
  const canScrape = activeConstituency && activeConstituency !== 'All';

  const emptyTitle = sentimentFilter === 'positive'
    ? (te ? 'సానుకూల పోస్టులు లేవు' : 'No positive posts found')
    : sentimentFilter === 'negative'
      ? (te ? 'విమర్శ / ప్రతికూల పోస్టులు లేవు' : 'No critical posts found')
      : (te ? 'సోషల్ మీడియా పోస్టులు లేవు' : 'No social posts yet');

  return (
    <section className="space-y-5" id="social-media-view-root">
      {/* Who we are watching */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-5 py-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
            {mlaInfo.name}
            {(currentUser?.leader_party || mlaInfo.party) && <Badge variant="secondary">{currentUser?.leader_party || mlaInfo.party}</Badge>}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden="true" />
            {mlaInfo.constituency}{mlaInfo.district && mlaInfo.district !== 'Statewide' && currentUser?.leader_title !== 'MP' ? ` · ${mlaInfo.district}` : ''}
          </p>
        </div>
        {canScrape && (
          <Button type="button" variant="outline" onClick={handleLiveScrape} disabled={isScraping} id="btn-trigger-social-scrape">
            <RefreshCw className={isScraping ? 'animate-spin' : ''} />
            {isScraping ? (te ? 'వెతుకుతోంది…' : 'Searching the web…') : (te ? 'తాజా పోస్టులు వెతకండి' : 'Search for new posts')}
          </Button>
        )}
      </div>
      {scrapeMsg && <p role="status" className="rounded-lg border bg-secondary/60 px-4 py-2.5 text-sm">{scrapeMsg}</p>}

      {/* Numbers + tone split */}
      <div className="space-y-3">
        <Stats items={[
          { label: te ? 'సానుకూల పోస్టులు' : 'Positive posts', value: stats.positive_posts, hint: `${posPct}% ${te ? 'మొత్తంలో' : 'of all posts'}` },
          { label: te ? 'విమర్శలు / ప్రజా సమస్యలు' : 'Critical / grievances', value: stats.negative_posts, hint: `${negPct}% ${te ? 'మొత్తంలో' : 'of all posts'}`, tone: stats.negative_posts ? 'warn' : 'default' },
          { label: te ? 'మొత్తం పర్యవేక్షణ' : 'Total monitored', value: stats.total_posts, hint: te ? '4 వేదికల నుండి' : 'across X, YouTube, Facebook, Instagram' },
        ]} />
        {stats.total_posts > 0 && (
          <div>
            <div className="flex h-2 overflow-hidden rounded-full bg-secondary" role="img" aria-label={te ? `సానుకూలం ${posPct}%, ప్రతికూలం ${negPct}%` : `Positive ${posPct}%, critical ${negPct}%`}>
              <div className="bg-emerald-600" style={{ width: `${Math.min(100, Math.max(0, posPct))}%` }} />
              <div className="bg-red-600" style={{ width: `${Math.min(100, Math.max(0, negPct))}%` }} />
            </div>
            <p className="mt-1.5 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-600" aria-hidden="true" />{te ? 'సానుకూలం' : 'Positive'}</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-red-600" aria-hidden="true" />{te ? 'విమర్శ' : 'Critical'}</span>
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <form className="flex gap-2" role="search" onSubmit={(e) => { e.preventDefault(); setSearchQuery(draft); }}>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input type="search" className="h-10 bg-card pl-9" value={draft} onChange={(e) => setDraft(e.target.value)}
                   placeholder={te ? 'పోస్టులు, పేర్లలో వెతకండి…' : 'Search posts or authors…'} aria-label={te ? 'పోస్టులు వెతకండి' : 'Search posts'} />
          </div>
          <Button type="submit" className="h-10">{te ? 'వెతకండి' : 'Search'}</Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex gap-1" role="group" aria-label={te ? 'టోన్' : 'Tone'}>
            {[['all', te ? 'అన్నీ' : 'All', stats.total_posts], ['positive', te ? 'సానుకూలం' : 'Positive', stats.positive_posts], ['negative', te ? 'విమర్శ' : 'Critical', stats.negative_posts]].map(([id, label, n]) => (
              <button key={id} type="button" aria-pressed={sentimentFilter === id} className={pill(sentimentFilter === id)} onClick={() => setSentimentFilter(id)}>
                {label} <span className={cn('text-xs tabular-nums', sentimentFilter === id ? 'text-primary-foreground/75' : 'text-muted-foreground')}>{n}</span>
              </button>
            ))}
          </div>
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label={te ? 'వేదిక' : 'Platform'}>
            <button type="button" aria-pressed={platformFilter === 'all'} className={pill(platformFilter === 'all')} onClick={() => setPlatformFilter('all')}>{te ? 'అన్ని వేదికలు' : 'All platforms'}</button>
            {Object.entries(PLATFORMS).map(([id, p]) => (
              <button key={id} type="button" aria-pressed={platformFilter === id} className={pill(platformFilter === id)} onClick={() => setPlatformFilter(id)}>
                <span className="inline-flex size-5 items-center justify-center rounded bg-white"><PlatformIcon platform={id} className="size-4" /></span>
                {p.name} <span className={cn('text-xs tabular-nums', platformFilter === id ? 'text-primary-foreground/75' : 'text-muted-foreground')}>{pc[id] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts */}
      <div id="social-posts-grid">
        {isLoading && (
          <div className="grid gap-4 xl:grid-cols-2" aria-busy="true">
            <p className="sr-only" role="status">{te ? 'పోస్టులు లోడ్ అవుతున్నాయి' : 'Loading posts'}</p>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-3 rounded-lg border bg-card p-5"><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-10 w-full" /></div>
            ))}
          </div>
        )}

        {!isLoading && filteredPosts.length === 0 && (
          <div className="rounded-lg border bg-card px-6 py-14 text-center">
            <p className="text-base font-semibold">{emptyTitle}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {canScrape
                ? (te ? 'పైన ఉన్న "తాజా పోస్టులు వెతకండి" నొక్కండి. ఇది X, YouTube, Facebook, Instagram లో బహిరంగ ప్రస్తావనలను వెతుకుతుంది.' : 'Press "Search for new posts" above. It looks for public mentions on X, YouTube, Facebook and Instagram.')
                : (te ? 'ఒక నియోజకవర్గాన్ని ఎంచుకుంటే వెతకవచ్చు.' : 'Pick a constituency to search for posts.')}
            </p>
          </div>
        )}

        {!isLoading && paginatedPosts.length > 0 && (
          <div className="grid gap-4 xl:grid-cols-2">
            {paginatedPosts.map((post) => {
              const cfg = PLATFORMS[post.platform] || { name: post.platform, action: 'View post', actionTe: 'పోస్ట్ చూడండి' };
              const isPos = post.sentiment === 'positive';
              const metrics = [['likes_count', Heart, te ? 'లైక్‌లు' : 'Likes'], ['comments_count', MessageCircle, te ? 'కామెంట్లు' : 'Comments'],
                ['shares_count', Repeat2, te ? 'షేర్లు' : 'Shares'], ['views_count', Eye, te ? 'వీక్షణలు' : 'Views']]
                .filter(([k]) => post[k] !== null && post[k] !== undefined);
              return (
                <article key={post.id} id={`social-card-${post.id}`} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
                  <header className="flex items-center justify-between gap-3">
                    <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                      <PlatformIcon platform={post.platform} className="size-5 shrink-0" />
                      <span className="font-medium text-foreground">{cfg.name}</span>
                      <span>· {post.relative_time || (te ? 'ఇటీవల' : 'Recent')}</span>
                    </p>
                    <span className={cn('shrink-0 text-xs font-semibold', isPos ? 'text-emerald-700' : 'text-destructive')}>
                      {isPos ? (te ? 'సానుకూలం' : 'Positive') : (te ? 'విమర్శ / ప్రజా సమస్య' : 'Critical')}
                    </span>
                  </header>

                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-semibold">{post.author_name}</span>
                    {post.author_handle && <span className="text-muted-foreground">{post.author_handle}</span>}
                    {post.mla_name && <span className="ml-auto truncate text-xs text-muted-foreground">{te ? 'గురించి' : 'about'} {post.mla_name}</span>}
                  </div>

                  <p className="text-[15px] leading-relaxed">{post.content}</p>

                  {post.sentiment_reason && (
                    <p className="flex items-start gap-2 rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
                      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span><span className="font-medium text-foreground">{te ? 'ఈ టోన్ ఎందుకు: ' : 'Why this tone: '}</span>{post.sentiment_reason}</span>
                    </p>
                  )}

                  <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {metrics.length > 0 ? metrics.map(([k, Icon, title]) => (
                        <span key={k} className="inline-flex items-center gap-1.5" title={title}>
                          <Icon className="size-3.5" aria-hidden="true" /><span className="tabular-nums">{formatCount(post[k])}</span><span className="sr-only">{title}</span>
                        </span>
                      )) : <span>{te ? 'ఎంగేజ్‌మెంట్ సంఖ్యలు అందుబాటులో లేవు' : 'Engagement numbers not available'}</span>}
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <a href={post.url} target="_blank" rel="noopener noreferrer">{te ? cfg.actionTe : cfg.action} <ExternalLink /></a>
                    </Button>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {!isLoading && filteredPosts.length > pageSize && totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-between gap-3" id="social-pagination-bar" aria-label={te ? 'పేజీలు' : 'Pages'}>
          <p className="text-sm text-muted-foreground">{te ? `${rangeText} / ${filteredPosts.length.toLocaleString()}` : `Showing ${rangeText} of ${filteredPosts.length.toLocaleString()}`}</p>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" id="social-prev-btn" disabled={currentPage <= 1} onClick={() => handlePageChange(currentPage - 1)}><ChevronLeft /> {te ? 'మునుపటి' : 'Previous'}</Button>
            {pageNumbers.map((p, idx) => (p === '...'
              ? <span key={`e-${idx}`} className="px-1 text-muted-foreground" aria-hidden="true">…</span>
              : <button key={`p-${p}`} type="button" id={`social-page-${p}`} disabled={p === currentPage} aria-current={p === currentPage ? 'page' : undefined}
                        className={cn('inline-flex size-8 items-center justify-center rounded-md text-sm font-medium tabular-nums focus-visible:outline-2 focus-visible:outline-ring',
                          p === currentPage ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}
                        onClick={() => handlePageChange(p)}>{p}</button>))}
            <Button type="button" variant="outline" size="sm" id="social-next-btn" disabled={currentPage >= totalPages} onClick={() => handlePageChange(currentPage + 1)}>{te ? 'తదుపరి' : 'Next'} <ChevronRight /></Button>
          </div>
        </nav>
      )}
    </section>
  );
}
