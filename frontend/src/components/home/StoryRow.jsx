import React from 'react';
import { ExternalLink, ListPlus, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLang, useTimeAgo } from '../../i18n/LangContext';
import ReportMenu from '../ReportMenu';

/** One story: the headline first, a quiet line for place and time, then the actions. */
export default function StoryRow({ story, sendLabel, onShare, onTask }) {
  const { tr } = useLang();
  const ago = useTimeAgo();
  const place = [story.constituency_name, story.district_name].filter((x) => x && x !== 'Statewide').join(' · ');
  return (
    <li className="flex flex-col gap-2.5 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[15px] font-medium leading-snug">{story.headline}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {story.priority_score === 1 && <Badge variant="destructive">{tr('pri.urgent')}</Badge>}
          {story.priority_score === 2 && <Badge variant="secondary">{tr('pri.civic')}</Badge>}
          {story.sentiment === 'negative' && <span className="font-medium text-destructive">{tr('story.negative')}</span>}
          {place && <span>{place}</span>}
          {story.date_time && <span>{place ? '· ' : ''}{ago(story.date_time)}</span>}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {onShare && sendLabel && (
          <Button size="sm" onClick={() => onShare({
            id: story.id, headline: story.headline, summary: story.summary, url: story.url,
            district_name: story.district_name, constituency_name: story.constituency_name,
          })}><Send /> {sendLabel}</Button>
        )}
        {onTask && (
          <Button type="button" size="sm" variant="outline" onClick={() => onTask({ title: story.headline, url: story.url })}><ListPlus /> {tr('board.makeTask')}</Button>
        )}
        <span className="flex items-center gap-1">
          <ReportMenu story={story} />
          {story.url && (
            <Button asChild variant="ghost" size="sm">
              <a href={story.url} target="_blank" rel="noopener noreferrer" aria-label={tr('story.open')}><ExternalLink /></a>
            </Button>
          )}
        </span>
      </div>
    </li>
  );
}
