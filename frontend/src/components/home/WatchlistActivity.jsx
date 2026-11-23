import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Radar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Empty, Section } from './shared';
import { fetchWatchlist } from '../../utils/api';

/** Read-only watchlist activity for leader and admin dashboards. */
export default function WatchlistActivity() {
  const [activity, setActivity] = useState({ names: [], posts: [] });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchWatchlist();
      setActivity({ names: data.names || [], posts: data.posts || [] });
      setError('');
    } catch (e) {
      setError(e.message || 'Could not load watchlist activity.');
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const nameCount = activity.names.length;
  return (
    <Section
      title="People watchlist"
      description="Public posts found for names monitored by your office teams."
      action={<Badge variant="secondary">{activity.posts.length} recent matches</Badge>}
    >
      {error ? <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>
        : activity.posts.length === 0 ? (
          <Empty>{nameCount ? 'No public posts have matched the monitored names yet.' : 'No office teams have added people to a watchlist yet.'}</Empty>
        ) : (
          <ul className="list-none divide-y">
            {activity.posts.slice(0, 6).map((post, index) => (
              <li key={`${post.leader_username || 'office'}-${post.id || index}`} className="flex flex-wrap items-start gap-3 py-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-800"><Radar className="size-4" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-slate-900">{post.headline || 'Public post detected'}</p>
                  <p className="mt-1 text-xs text-slate-500">Watching {post.name}{post.leader_name ? ` · ${post.leader_name}` : ''}{post.constituency_name ? ` · ${post.constituency_name}` : ''}{post.platform ? ` · ${post.platform}` : ''}</p>
                </div>
                {post.url && <a className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-800 hover:underline" href={post.url} target="_blank" rel="noreferrer">Open post <ExternalLink className="size-3" aria-hidden="true" /></a>}
              </li>
            ))}
          </ul>
        )}
    </Section>
  );
}
