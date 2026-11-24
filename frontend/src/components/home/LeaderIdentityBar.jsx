import React, { useEffect, useState } from 'react';
import { MapPin, ShieldCheck } from 'lucide-react';
import { fetchPortfolio } from '../../utils/api';

// Until an office saves a photo in its Portfolio, this one office keeps the portrait it always had.
// Portrait hosted by the Venkatampalli Grama Panchayath official portal. New leaders do NOT need an entry here:
// their staff add a photo link in Portfolio and it shows for the leader and for every staff member of that office.
const LEGACY_PORTRAIT = {
  match: (name, place) => /aadi\s+srinivas/i.test(name || '') || /vemulawada/i.test(place || ''),
  url: 'https://venkatampalligrampanchayat.com/assets/officials/Aadi-Srinivas.jpg',
};

function initialsOf(name) {
  return (name || '').replace(/^dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

// Who the office works for: the leader on a leader's screen, and the SAME leader (same photo, party, place) on every staff screen.
export default function LeaderIdentityBar({ currentUser }) {
  const [profile, setProfile] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);
  const role = currentUser?.role;
  const isOffice = role === 'mla' || role === 'minister' || role === 'staff';

  useEffect(() => {
    if (!isOffice) return undefined;
    let active = true;
    fetchPortfolio().then((data) => { if (active) { setProfile(data); setImageFailed(false); } }).catch(() => {});
    return () => { active = false; };
  }, [isOffice, currentUser?.username]);

  if (!isOffice) return null;

  const content = profile?.content || {};
  const name = content.full_name || profile?.leader_name || (role === 'staff' ? '' : currentUser?.politician_name) || '';
  if (!name) return null;                       // nothing honest to show yet (for example a staff account not linked to a leader)
  const title = content.title_en || profile?.leader_title || currentUser?.leader_title || '';
  const constituency = profile?.constituency_name || currentUser?.constituency_name || '';
  const district = profile?.district_name || currentUser?.district_name || '';
  const place = [constituency, district].filter((v) => v && v !== 'All').join(' · ');
  const party = profile?.leader_party || (role === 'staff' ? '' : currentUser?.leader_party) || '';
  const image = content.avatar_url || (LEGACY_PORTRAIT.match(name, constituency) ? LEGACY_PORTRAIT.url : '');

  return (
    <section aria-label="Constituency representative" className="shadcn-scope border-b border-slate-200 bg-white">
      <div aria-hidden="true" className="h-1 bg-[linear-gradient(90deg,#ff9933_0%,#ff9933_33.333%,#ffffff_33.333%,#ffffff_66.666%,#138808_66.666%,#138808_100%)]" />
      <div className="mx-auto flex max-w-[1800px] items-center gap-3 px-4 py-2 md:gap-4 md:px-8 lg:px-10">
        <div className="relative shrink-0">
          {image && !imageFailed ? (
            <img
              src={image}
              alt={`${name} portrait`}
              onError={() => setImageFailed(true)}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-12 rounded-full border-2 border-white object-cover object-[50%_18%] shadow-[0_0_0_2px_rgba(255,153,51,.5)] md:size-14"
            />
          ) : (
            <div aria-label={`${name} initials`} className="flex size-12 items-center justify-center rounded-full bg-orange-50 text-lg font-bold text-orange-800 shadow-[0_0_0_2px_rgba(255,153,51,.5)] md:size-14 md:text-xl">{initialsOf(name)}</div>
          )}
          <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white bg-emerald-500" aria-label="Official profile" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="truncate text-sm font-bold tracking-tight text-slate-900 md:text-base">{name}</h2>
            {party && <span className="rounded-md bg-[#ff9933] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{party}</span>}
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><ShieldCheck className="size-3" aria-hidden="true" />{role === 'staff' ? 'Your leader' : 'Official profile'}</span>
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-slate-600">
            {title && <span className="truncate">{title}</span>}
            {title && place && <span className="hidden text-slate-300 sm:inline" aria-hidden="true">•</span>}
            {place && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="size-3 shrink-0 text-[#138808]" aria-hidden="true" /><span className="truncate">{place}</span></span>}
          </div>
        </div>
      </div>
    </section>
  );
}
