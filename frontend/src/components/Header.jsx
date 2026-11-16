import React from 'react';
import { Languages, ListChecks, LogOut, MessageSquare, Share2, UserRound, Users, UsersRound } from 'lucide-react';
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
    <header className="shadcn-scope sticky top-0 z-[100] bg-card">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 md:px-8 lg:px-10">
      <div className="brand-container flex min-w-0 items-center gap-3">
        <Logo className="size-9 shrink-0 rounded-[9px]" />
        <div className="min-w-0 leading-tight">
          <div className="text-[17px] font-bold tracking-tight text-primary" id="header-portal-title">{t.portalTitle || 'Nayak'}</div>
          <div className="truncate text-xs text-muted-foreground" id="header-portal-subtitle">{subtitle}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span id="user-profile-badge" className="mr-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground max-sm:hidden">
          <span id="user-display-name">{displayName}</span>
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
          <Button id="btn-inbox" variant="ghost" size="sm" onClick={onOpenInbox} className="relative" aria-label={role === 'admin' ? tr('btn.allShares') : tr('btn.shared')}>
            <Share2 /> <span className="max-sm:hidden">{role === 'admin' ? tr('btn.allShares') : tr('btn.shared')}</span>
            {unreadCount > 0 && (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground" aria-label={`${unreadCount}`}>
                {unreadCount}
              </span>
            )}
          </Button>
        )}
        {onOpenPassword && (
          <Button id="btn-password" variant="ghost" size="icon-sm" onClick={onOpenPassword} aria-label={tr('acct.title')} title={tr('acct.title')}><UserRound /></Button>
        )}
        {onOpenFeedback && (
          <Button id="btn-feedback" variant="ghost" size="icon-sm" onClick={onOpenFeedback} aria-label={tr('fb.btn')} title={tr('fb.btn')}><MessageSquare /></Button>
        )}
        {onToggleLang && (
          <Button id="btn-lang" variant="ghost" size="sm" onClick={onToggleLang} aria-label={`${tr('btn.lang')} (Language / భాష)`}><Languages /> <span className="max-sm:hidden">{tr('btn.lang')}</span></Button>
        )}
        <Button id="btn-logout" variant="ghost" size="sm" onClick={onLogout} aria-label={t.logout ? t.logout.replace('🚪', '').trim() : 'Logout'}><LogOut /> <span className="max-sm:hidden">{t.logout ? t.logout.replace('🚪', '').trim() : 'Logout'}</span></Button>
      </div>
      </div>
    </header>
  );
}
