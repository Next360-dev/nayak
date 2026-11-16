import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchRefreshStatus, startRefresh } from '../utils/api';
import { useLang, useTimeAgo } from '../i18n/LangContext';

/**
 * "Refresh news" for the team: asks the server to check the web now for this team's constituency (a few seconds),
 * shows what it found, and tells the page to reload. The server limits how often it can run, so we show a countdown.
 */
export default function RefreshNews({ onDone, size = 'sm', variant = 'outline', showLatest = true }) {
  const { tr } = useLang();
  const ago = useTimeAgo();
  const [st, setSt] = useState(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const apply = useCallback((s) => {
    setSt(s);
    setWaitUntil(s.wait > 0 ? Date.now() + s.wait * 1000 : 0);
  }, []);

  useEffect(() => { fetchRefreshStatus().then((s) => alive.current && apply(s)).catch(() => {}); }, [apply]);

  useEffect(() => {
    if (!waitUntil || waitUntil <= Date.now()) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waitUntil]);

  const finish = useCallback((s) => {
    setRunning(false);
    const last = s.last || {};
    if (last.ok === false) setMsg(tr('refresh.err', { e: last.error || '' }));
    else if (last.new > 0) setMsg(last.new === 1 ? tr('refresh.found1') : tr('refresh.found', { n: last.new }));
    else setMsg(tr('refresh.none'));
    if (onDone) onDone(last);
  }, [onDone, tr]);

  const click = async () => {
    setMsg('');
    try {
      const s = await startRefresh();
      if (!alive.current) return;
      apply(s);
      if (s.state === 'cooldown') { setMsg(tr('refresh.wait', { s: s.wait })); return; }
      if (s.state === 'running' && !s.mine) setMsg(tr('refresh.busy'));
      setRunning(true);
      for (let i = 0; i < 120 && alive.current; i += 1) {          // check every 1.5 s, give up after 3 minutes
        await new Promise((r) => setTimeout(r, 1500));
        const cur = await fetchRefreshStatus();
        if (!alive.current) return;
        apply(cur);
        if (cur.state !== 'running') { finish(cur); return; }
      }
      setRunning(false);
    } catch (e) {
      if (alive.current) { setRunning(false); setMsg(tr('refresh.err', { e: e.message })); }
    }
  };

  const left = waitUntil > now ? Math.ceil((waitUntil - now) / 1000) : 0;
  const label = running ? tr('refresh.running') : left > 0 ? tr('refresh.wait', { s: left }) : tr('refresh.btn');
  const note = msg || (showLatest && st ? (st.latest_story_at ? tr('refresh.latest', { t: ago(st.latest_story_at) }) : tr('refresh.noStories')) : '');

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button type="button" id="btn-refresh-news" size={size} variant={variant} onClick={click} disabled={running || left > 0} title={tr('refresh.help')}>
        {running ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} {label}
      </Button>
      {note && <span role={msg ? "status" : undefined} className="text-xs text-muted-foreground" id="refresh-note">{note}</span>}
    </span>
  );
}
