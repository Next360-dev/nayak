import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Empty, StatusBadge } from './shared';
import { useLang, useTimeAgo } from '../../i18n/LangContext';

/** Short list of what is waiting in my inbox. Tap a row to open the inbox. */
export default function InboxList({ items, emptyText, onOpen }) {
  const { tr } = useLang();
  const ago = useTimeAgo();
  if (!items.length) return <Empty>{emptyText}</Empty>;
  return (
    <ul className="list-none divide-y">
      {items.map((i) => (
        <li key={i.id}>
          <button type="button" onClick={onOpen}
                  className="flex w-full items-start justify-between gap-3 rounded-md py-3 text-left transition-colors hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring">
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-snug">
                {i.priority === 'urgent' && <Badge variant="destructive" className="mr-2">{tr('pri.urgent')}</Badge>}{i.title}
              </span>
              <span className="block text-xs text-muted-foreground">{tr('inbox.from', { sender: i.sender })} · {ago(i.created_at)}</span>
            </span>
            <StatusBadge status={i.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}
