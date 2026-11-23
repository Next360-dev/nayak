import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bell, Clock, List, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchTopAlerts } from '../../utils/api';
import { useLang } from '../../i18n/LangContext';

export default function TopAlerts({ user }) {
  const { tr } = useLang();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setStories((await fetchTopAlerts()).stories || []); }
    catch { setStories([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return null;
  if (stories.length === 0) return null;

  return (
    <Card className="gap-3 py-5">
      <CardHeader className="pb-0 flex items-center gap-2">
        <Bell className="size-4 shrink-0" aria-hidden="true" />
        <CardTitle className="text-[15px] font-semibold">{tr('top.alerts.title')}</CardTitle>
        <span className="ml-auto text-xs text-muted-foreground">{tr('top.alerts.sub')}</span>
      </CardHeader>
      <CardContent>
        <ul className="list-none divide-y space-y-3">
          {stories.map((s, i) => (
            <li key={i} className="flex items-start gap-3 rounded-lg border p-3">
              <ShieldAlert className="size-4 shrink-0 text-attention mt-0.5" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs text-muted-foreground">
                  {s.district ? `${s.district} · ` : ''}{s.sentiment || 'P1'}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">{i + 1}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
