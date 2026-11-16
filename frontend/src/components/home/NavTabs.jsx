import React from 'react';
import { LayoutDashboard, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '../../i18n/LangContext';

/** Home | News feed switch under the header. */
export default function NavTabs({ view, onChange }) {
  const { tr } = useLang();
  const tabs = [
    { id: 'home', label: tr('nav.home'), icon: LayoutDashboard },
    { id: 'news', label: tr('nav.news'), icon: Newspaper },
  ];
  return (
    <nav className="shadcn-scope border-b bg-card" aria-label={tr('nav.label')}>
      <div className="mx-auto flex max-w-[1800px] gap-1 px-1 md:px-5 lg:px-7">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => onChange(id)} aria-current={view === id ? 'page' : undefined}
                  className={cn('-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    view === id ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <Icon className="size-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
