import React, { useEffect, useState } from 'react';
import { MapPin, ShieldCheck } from 'lucide-react';
import { fetchPortfolio } from '../../utils/api';

// Portrait hosted by the Venkatampalli Grama Panchayath official portal.
const AADI_SRINIVAS_PORTRAIT = 'https://venkatampalligrampanchayat.com/assets/officials/Aadi-Srinivas.jpg';

export default function LeaderIdentityBar({ currentUser }) {
  const [profile, setProfile] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);
  const isAadiOffice = /aadi\s+srinivas/i.test(currentUser?.politician_name || '')
    || /vemulawada/i.test(currentUser?.constituency_name || '');

  useEffect(() => {
    if (!isAadiOffice || currentUser?.role === 'admin') return undefined;
    let active = true;
    fetchPortfolio().then((data) => {
      if (active) setProfile(data);
    }).catch(() => {});
    return () => { active = false; };
  }, [currentUser?.role, currentUser?.politician_name, currentUser?.constituency_name, isAadiOffice]);

  if (!isAadiOffice || currentUser?.role === 'admin') return null;

  const name = profile?.content?.full_name || profile?.leader_name || currentUser?.politician_name || 'Aadi Srinivas';
  const title = profile?.content?.title_en || currentUser?.leader_title || 'Member of Legislative Assembly';
  const constituency = currentUser?.constituency_name || 'Vemulawada';
  const district = currentUser?.district_name || 'Rajanna Sircilla';
  const image = profile?.content?.avatar_url || AADI_SRINIVAS_PORTRAIT;

  return (
    <section aria-label="Constituency representative" className="shadcn-scope border-b border-slate-200 bg-white">
      <div aria-hidden="true" className="h-1 bg-[linear-gradient(90deg,#ff9933_0%,#ff9933_33.333%,#ffffff_33.333%,#ffffff_66.666%,#138808_66.666%,#138808_100%)]" />
      <div className="mx-auto flex max-w-[1800px] items-center gap-3 px-4 py-3 md:gap-4 md:px-8 lg:px-10">
        <div className="relative shrink-0">
          {!imageFailed ? (
            <img
              src={image}
              alt={`${name} portrait`}
              onError={() => setImageFailed(true)}
              className="size-[4.5rem] rounded-full border-2 border-white object-cover shadow-[0_0_0_2px_rgba(255,153,51,.5)] md:size-[5.25rem]"
            />
          ) : (
            <div aria-label={`${name} initials`} className="flex size-[4.5rem] items-center justify-center rounded-full bg-orange-50 text-2xl font-bold text-orange-800 shadow-[0_0_0_2px_rgba(255,153,51,.5)] md:size-[5.25rem]">AS</div>
          )}
          <span className="absolute bottom-0.5 right-0.5 size-3.5 rounded-full border-2 border-white bg-emerald-500" aria-label="Official profile" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="truncate text-sm font-bold tracking-tight text-slate-900 md:text-base">{name}</h2>
            <span className="rounded-md bg-[#ff9933] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">INC</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><ShieldCheck className="size-3" aria-hidden="true" />Official profile</span>
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-slate-600">
            <span className="truncate">{title}</span>
            <span className="hidden text-slate-300 sm:inline" aria-hidden="true">•</span>
            <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="size-3 shrink-0 text-[#138808]" aria-hidden="true" /><span className="truncate">{constituency}{district ? ` · ${district}` : ''}</span></span>
          </div>
        </div>
        <span className="hidden shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:inline-flex sm:items-center sm:gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />Office active</span>
      </div>
    </section>
  );
}
