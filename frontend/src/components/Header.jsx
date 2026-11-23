import React from 'react';
import { Inbox, Languages, ListChecks, LogOut, MessageSquare, UserRound, Users, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLang } from '../i18n/LangContext';
import Logo from './Logo';

export default function Header({ currentUser, onLogout, t, unreadCount = 0, onOpenInbox, onOpenUsers, onOpenTeam, onOpenBoard, onToggleLang, onOpenPassword, onOpenFeedback }) {
  const { tr } = useLang();
  const role = currentUser?.role;
  const place = currentUser?.constituency_name && currentUser.constituency_name !== 'All' ? currentUser.constituency_name : '';
  const subtitle = role === 'admin' ? tr('sub.admin')
    : role === 'minister' ? tr('sub.minister')
    : role === 'mla' && currentUser?.leader_title === 'MP' ? (place ? tr('sub.mp', { place }) : tr('sub.mpNoPlace'))
    : role === 'mla' ? (place ? tr('sub.mla', { place }) : tr('sub.mlaNoPlace'))
    : role === 'staff' ? (place ? tr('sub.staff', { place }) : tr('sub.staffNoPlace'))
    : t.portalSubtitle;

  const displayName = (role === 'staff' ? currentUser?.username : currentUser?.politician_name) || currentUser?.username || t.loggedIn;

  return (
    <header className="shadcn-scope sticky top-0 z-[100] border-b border-slate-200 bg-white text-slate-900 shadow-sm">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 md:px-8 lg:px-10">
      <div className="brand-container flex min-w-0 items-center gap-3">
        <Logo className="size-10 shrink-0 rounded-full border-2 border-[#ff9933] bg-white object-cover shadow-[0_0_0_2px_rgba(19,136,8,.16)]" />
        <div className="min-w-0 leading-tight">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="text-[16px] font-bold tracking-tight text-slate-900" id="header-portal-title">{displayName}</div>
            {currentUser?.leader_title && <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">{currentUser.leader_title}</span>}
            {currentUser?.leader_party && <span className="rounded bg-[#ff9933] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{currentUser.leader_party}</span>}
            {role === 'minister' && <span className="rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-800">MHA</span>}
          </div>
          <div className="truncate text-xs text-slate-600" id="header-portal-subtitle">{subtitle}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-slate-700 [&_button]:text-slate-700 [&_button:hover]:bg-emerald-50 [&_button:hover]:text-emerald-800">
        <span id="user-profile-badge" className="mr-1 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-slate-700 max-sm:hidden">
          <span className="size-2 rounded-full bg-[#138808]" aria-hidden="true" />
          <span id="user-display-name">{currentUser?.username || displayName}</span>
        </span>
        {(role === 'mla' || role === 'minister') && onOpenTeam && (
          <Button id="btn-team" variant="ghost" size="sm" onClick={onOpenTeam} aria-label={tr('btn.myTeam')}><UsersRound /> <span className="max-sm:hidden">{tr('btn.myTeam')}</span></Button>
        )}
        {role !== 'admin' && onOpenBoard && (
          <Button id="btn-board" variant="ghost" size="sm" onClick={onOpenBoard} aria-label={tr('board.btn')}><ListChecks /> <span className="max-sm:hidden">{tr('board.btn')}</span></Button>
        )}
        {role === 'admin' && onOpenUsers && (
          <Button id="btn-users" variant="ghost" size="sm" onClick={onOpenUsers} aria-label={tr('btn.users')}><Users /> <span className="max-sm:hidden">{tr('btn.users')}</span></Button>
        )}
        {onOpenInbox && (
          <Button id="btn-inbox" variant="ghost" size="sm" onClick={onOpenInbox} className="relative rounded-full border border-emerald-200 bg-emerald-50 px-3 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900" aria-label={role === 'admin' ? tr('btn.allShares') : 'Inbox'}>
            <Inbox aria-hidden="true" /> <span>Inbox</span>
            {unreadCount > 0 && (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#138808] px-1.5 text-[11px] font-semibold text-white" aria-label={`${unreadCount} unread`}>
                {unreadCount}
              </span>
            )}
          </Button>
        )}
        {onOpenPassword && (
          <Button id="btn-password" variant="ghost" size="icon-sm" onClick={onOpenPassword} aria-label={tr('acct.title')} title={tr('acct.title')}><UserRound /></Button>
        )}
        {onOpenFeedback && (
          <Button id="btn-feedback" variant="ghost" size="sm" onClick={onOpenFeedback} className="rounded-full border border-orange-200 bg-orange-50 px-3 text-orange-800 hover:bg-orange-100 hover:text-orange-900" aria-label={tr('fb.btn')} title={tr('fb.btn')}><MessageSquare /><span>Feedback</span></Button>
        )}
        {onToggleLang && (
          <Button id="btn-lang" variant="ghost" size="sm" onClick={onToggleLang} aria-label={`${tr('btn.lang')} (Language / భాష)`}><Languages /> <span className="max-sm:hidden">{tr('btn.lang')}</span></Button>
        )}
          <Button id="btn-logout" variant="ghost" size="sm" onClick={onLogout} className="text-orange-800 hover:bg-orange-50 hover:text-orange-900" aria-label={t.logout ? t.logout.replace('🚪', '').trim() : 'Logout'}><LogOut /> <span className="max-sm:hidden">{t.logout ? t.logout.replace('🚪', '').trim() : 'Logout'}</span></Button>
      </div>
      </div>
      <div aria-hidden="true" className="h-1 bg-[linear-gradient(90deg,#ff9933_0%,#ff9933_33.333%,#ffffff_33.333%,#ffffff_66.666%,#138808_66.666%,#138808_100%)]" />
    </header>
  );
}
