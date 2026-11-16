import React, { useEffect, useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportStory } from '../utils/api';
import { useLang } from '../i18n/LangContext';

/** "Report this story": not relevant / wrong priority / wrong tone. A small self-contained menu (no positioning library). */
export default function ReportMenu({ story, className = '' }) {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const send = async (kind) => {
    setOpen(false);
    try {
      const r = await reportStory({ article_id: Number(story.id) || null, title: story.headline || story.title || '', kind });
      setDone(r.recorded ? tr('report.thanks') : tr('report.already'));
    } catch (e) { setDone(e.message); }
    setTimeout(() => setDone(''), 3000);
  };

  const items = [['not_relevant', 'report.notRelevant'], ['wrong_priority', 'report.wrongPriority'], ['wrong_sentiment', 'report.wrongTone']];
  return (
    <span ref={ref} className={`shadcn-scope relative inline-flex items-center gap-1 ${className}`}>
      <Button variant="ghost" size="sm" aria-label={tr('report.btn')} title={tr('report.btn')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}><Flag /></Button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-[60] mt-1 min-w-56 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md">
          {items.map(([kind, key]) => (
            <button key={kind} type="button" role="menuitem" onClick={() => send(kind)}
                    className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">{tr(key)}</button>
          ))}
        </div>
      )}
      {done && <span role="status" className="text-xs text-muted-foreground">{done}</span>}
    </span>
  );
}
