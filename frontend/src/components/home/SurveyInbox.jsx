import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import { fetchSurveyResults } from '../../utils/api';
import { useLang } from '../../i18n/LangContext';
import { Empty, Section } from './shared';

export default function SurveyInbox() {
  const { tr, lang } = useLang();
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const labelFor = (key, fallback) => {
    const label = tr(key);
    return label === key ? fallback : label;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSurveyResults();
      setResponses(data.responses || []);
    } catch (err) {
      setError(err.message || tr('survey.results.error'));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => { load(); }, [load]);

  return (
    <Section title={tr('survey.results.title')} description={tr('survey.results.desc')}
      action={!loading && !error && <div className="flex items-center gap-2"><Badge variant="secondary">{tr('survey.results.count', { n: responses.length })}</Badge>{responses.length > 5 && <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((value) => !value)}>{showAll ? tr('survey.results.less') : tr('survey.results.more')}</Button>}</div>}>
      {loading ? <p className="text-sm text-muted-foreground" role="status">{tr('common.loading')}</p>
        : error ? <div className="flex flex-wrap items-center justify-between gap-3" role="alert"><CardDescription>{error}</CardDescription><Button type="button" size="sm" variant="outline" onClick={load}>{tr('btn.retry')}</Button></div>
        : responses.length === 0 ? <Empty>{tr('survey.results.empty')}</Empty>
        : <ul className="list-none divide-y">
            {(showAll ? responses : responses.slice(0, 5)).map((item) => (
              <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{labelFor(`survey.category.${item.category}`, item.category)}</Badge>
                  <span className="text-xs text-muted-foreground">{labelFor(`survey.role.${item.role}`, item.role)}</span>
                  <time className="ml-auto text-xs text-muted-foreground" dateTime={item.created_at}>
                    {item.created_at ? new Intl.DateTimeFormat(lang === 'te' ? 'te-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at)) : ''}
                  </time>
                </div>
                <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed">{item.message}</p>
                {(item.name || item.email) && <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground"><MessageSquareText className="size-3" aria-hidden="true" />{item.name || item.email}</p>}
              </li>
            ))}
          </ul>}
    </Section>
  );
}
