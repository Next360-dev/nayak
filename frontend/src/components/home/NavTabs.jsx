import React from 'react';
import { Archive, LayoutDashboard, Newspaper, Radio, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '../../i18n/LangContext';

/** Home | News feed switch under the header. */
export default function NavTabs({ view, onChange }) {
  const { tr } = useLang();
  const tabs = [
    { id: 'home', label: tr('nav.home'), icon: LayoutDashboard },
    { id: 'live', label: tr('nav.live'), icon: Radio },
    { id: 'social', label: tr('nav.social'), icon: UsersRound },
    { id: 'history', label: tr('nav.history'), icon: Archive },
    { id: 'portfolio', label: tr('nav.portfolio'), icon: Newspaper },
  ];
  return (
    <nav className="shadcn-scope border-b border-slate-200 bg-white" aria-label={tr('nav.label')}>
      <div className="mx-auto flex max-w-[1800px] gap-1 overflow-x-auto px-2 py-1.5 md:px-5 lg:px-7">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => onChange(id)} aria-current={view === id ? 'page' : undefined}
                  className={cn('flex min-w-max flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-ring md:px-5',
                    view === id ? 'border-slate-200 border-b-2 border-b-[#ff9933] bg-orange-50/50 text-slate-900 shadow-sm' : 'border-transparent text-slate-500 hover:bg-emerald-50/60 hover:text-emerald-900')}>
            <Icon className="size-4" aria-hidden="true" /> <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
