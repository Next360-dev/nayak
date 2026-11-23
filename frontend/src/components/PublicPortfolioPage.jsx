import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchPublicPortfolio } from '../utils/api';

export default function PublicPortfolioPage({ username }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetchPublicPortfolio(username).then((data) => setContent(data.content)).catch((e) => setError(e.message || 'This portfolio is not available.'));
  }, [username]);

  return <main className="shadcn-scope min-h-screen bg-[#f5f6f8] px-4 py-8 md:px-8">
    <div className="mx-auto max-w-5xl space-y-5">
      <div><p className="text-xs font-bold uppercase tracking-[.12em] text-orange-700">OFFICIAL PORTFOLIO</p><p className="mt-1 text-sm text-slate-500">Public office profile</p></div>
      {error ? <Card><CardContent className="py-10 text-center text-sm text-slate-600">{error}</CardContent></Card> : !content ? <Card><CardContent className="py-10 text-center text-sm text-slate-500">Loading official profile…</CardContent></Card> : <>
        <Card className="overflow-hidden"><div className="h-2 bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-500"/><CardHeader className="flex-row items-center gap-4">
          {content.avatar_url ? <img src={content.avatar_url} alt="" className="size-20 rounded-full border-2 border-orange-200 object-cover" /> : <div className="flex size-20 items-center justify-center rounded-full bg-orange-50 text-2xl font-semibold text-orange-800">{content.full_name?.slice(0, 1) || '?'}</div>}
          <div><CardTitle>{content.full_name || 'Official profile'}</CardTitle><CardDescription>{[content.title_en, content.title_te].filter(Boolean).join(' · ')}</CardDescription></div><Badge className="ml-auto bg-emerald-100 text-emerald-800">Official</Badge>
        </CardHeader><CardContent className="space-y-6">
          {content.biography_en && <section><h2 className="font-semibold">Biography & statement</h2><p lang="en" className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{content.biography_en}</p></section>}
          {content.biography_te && <section><h2 className="font-semibold">జీవిత చరిత్ర & ప్రకటన</h2><p lang="te" className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{content.biography_te}</p></section>}
          <section className="grid gap-3 sm:grid-cols-2">{[['Karimnagar Constituency Office', content.constituency_office], ['New Delhi Ministerial Office', content.ministerial_office], ['Official Email', content.official_email], ['Constituency Helpline', content.helpline]].filter(([, value]) => value).map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm text-slate-800">{value}</p></div>)}</section>
          <section className="grid gap-6 md:grid-cols-2"><div><h2 className="font-semibold">Union ministry milestones</h2>{content.ministry_milestones?.length ? <ul className="mt-3 space-y-2">{content.ministry_milestones.map((item, i) => <li key={i} className="rounded-lg border p-3"><p className="font-medium">{item.title}</p>{item.date && <p className="text-xs text-slate-500">{item.date}</p>}<p className="mt-1 text-sm text-slate-600">{item.description}</p></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No published milestones.</p>}</div>
            <div><h2 className="font-semibold">Constituency projects</h2>{content.constituency_projects?.length ? <ul className="mt-3 space-y-2">{content.constituency_projects.map((item, i) => <li key={i} className="rounded-lg border p-3"><p className="font-medium">{item.title}</p><p className="text-xs text-slate-500">{[item.status, item.location].filter(Boolean).join(' · ')}</p><p className="mt-1 text-sm text-slate-600">{item.description}</p></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No published projects.</p>}</div>
          </section>
        </CardContent></Card>
      </>}
    </div>
  </main>;
}
