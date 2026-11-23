import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Search, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { checkWatchlistNow, fetchWatchlist, setWatchlist, deleteWatchlist } from '../../utils/api';
import { useLang } from '../../i18n/LangContext';

export default function Watchlist({ user }) {
  const { tr } = useLang();
  const [names, setNames] = useState([]);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [posts, setPosts] = useState([]);
  const [checking, setChecking] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchWatchlist();
      setNames((data.names || []).map((item) => typeof item === 'string' ? item : item.name));
      setPosts(data.posts || []);
    } catch { setNames([]); setPosts([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = (n) => {
    const trimmed = n.trim();
    if (!trimmed || names.length >= 5 || names.some((name) => name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) return;
    setNames([...names, trimmed]);
    setInput('');
    setSaved(false);
  };

  const remove = (n) => { setNames(names.filter((x) => x !== n)); setSaved(false); };

  const checkNow = async () => {
    setScanMessage('Checking public sources…');
    setChecking(true);
    try {
      const result = await checkWatchlistNow();
      const found = result.new_posts?.length || 0;
      const failed = result.errors || [];
      setScanMessage(failed.length
        ? `Checked ${result.checked_names || 0} name(s), but could not scan ${failed.map((item) => item.name).join(', ')}.`
        : found
          ? `Checked ${result.checked_names || 0} name(s) and found ${found} new public post${found === 1 ? '' : 's'}.`
          : `Checked ${result.checked_names || 0} name(s). No new public posts were found.`);
      const data = await fetchWatchlist();
      setPosts(data.posts || []);
    } catch (e) {
      setScanMessage(e.message || 'Could not check public sources.');
    } finally { setChecking(false); }
  };

  const save = async () => {
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      await setWatchlist(names);
      setError('');
      setSaved(true);
      if (names.length) await checkNow();
      else { setPosts([]); setScanMessage(''); }
    } catch (e) { setError(e.message || 'Failed to save watchlist'); }
    finally { setSaving(false); }
  };

  return (
    <Card className="gap-3 py-5">
      <CardHeader className="pb-0 flex items-center gap-2">
        <UserPlus className="size-4 shrink-0" aria-hidden="true" />
        <CardTitle className="text-[15px] font-semibold">{tr('watch.title')}</CardTitle>
        <span className="ml-auto text-xs text-muted-foreground">{tr('watch.sub')}</span>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add(input)} placeholder={tr('watch.placeholder')} />
          <Button type="button" size="sm" onClick={() => add(input)} disabled={names.length >= 5 || !input.trim()}>{tr('watch.add')}</Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex flex-wrap items-start gap-2 mt-3">
          {names.map((n, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
              <span className="shrink-0">{i + 1}.</span>
              <span className="truncate max-w-[220px]">{n}</span>
              <Button type="button" size="icon-sm" variant="outline" onClick={() => remove(n)}><Trash2 className="size-3" /></Button>
            </div>
          ))}
          {names.length === 0 && <p className="text-xs text-muted-foreground italic">{tr('watch.empty')}</p>}
          {names.length >= 5 && <p className="text-xs text-muted-foreground">{tr('watch.limit')}</p>}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <Button type="button" size="sm" onClick={save} disabled={saving || checking}>{saving ? tr('watch.saving') : tr('watch.save')}</Button>
          <Button type="button" size="sm" variant="outline" onClick={checkNow} disabled={checking || names.length === 0}><Search className="size-4" />{checking ? 'Checking…' : 'Check now'}</Button>
        </div>
        {saved && <p role="status" className="mt-2 text-sm text-emerald-700">{tr('watch.saved')}</p>}
        {scanMessage && <p role="status" aria-live="polite" className="mt-2 text-xs text-slate-600">{scanMessage}</p>}
        {posts.length > 0 && <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent public matches</h4>
          {posts.slice(0, 4).map((post) => <article key={post.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold text-slate-800">{post.name} <span className="font-normal text-slate-500">· {post.platform || 'Public web'}</span></p>
              {post.url && <a className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-800 hover:underline" href={post.url} target="_blank" rel="noreferrer">Open <ExternalLink className="size-3" /></a>}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{post.headline}</p>
          </article>)}
        </div>}
      </CardContent>
    </Card>
  );
}
