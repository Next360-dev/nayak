import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck, BookOpenText, Building2, Eye, FolderKanban, IdCard, LoaderCircle, Newspaper, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fetchPortfolio, savePortfolio } from '../utils/api';
import RepresentativesDirectory from './RepresentativesDirectory';

const EMPTY = {
  full_name: '', avatar_url: '', title_en: '', title_te: '', biography_en: '', biography_te: '',
  constituency_office: '', ministerial_office: '', official_email: '', helpline: '',
  ministry_milestones: [], constituency_projects: [],
};
const normalizeContent = (value = {}) => ({
  ...EMPTY,
  ...value,
  ministry_milestones: Array.isArray(value.ministry_milestones) ? value.ministry_milestones : [],
  constituency_projects: Array.isArray(value.constituency_projects) ? value.constituency_projects : [],
});
const TABS = [
  ['profile', 'Profile & biography'], ['ministry', 'Ministry milestones'],
  ['projects', 'Constituency projects'], ['preview', 'Public preview'], ['directory', 'Representative directory'],
];
const TAB_ICONS = { profile: IdCard, ministry: BookOpenText, projects: FolderKanban, preview: Eye, directory: Newspaper };

function portfolioErrorMessage(error) {
  if (error?.message === 'Not Found') return 'The portfolio API is not available on the connected backend yet. Restart or redeploy the latest backend, then retry.';
  return error?.message || 'Could not load the office portfolio. Please retry.';
}

function Field({ label, value, onChange, multiline = false, disabled = false, placeholder = '' }) {
  const props = { value: value || '', onChange: (e) => onChange(e.target.value), disabled, placeholder };
  return <label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700">{label}</span>
    {multiline ? <Textarea {...props} rows={4} /> : <Input {...props} />}
  </label>;
}

export default function OfficialPortfolioPage({ currentUser, reps, isLoadingReps, repsError, onRetryReps, currentLang, t }) {
  const canEdit = currentUser?.role === 'staff';
  const isAdmin = currentUser?.role === 'admin';
  const [tab, setTab] = useState(isAdmin ? 'directory' : 'profile');
  const [content, setContent] = useState({ ...EMPTY });
  const [leaderName, setLeaderName] = useState(currentUser?.role === 'staff' ? '' : (currentUser?.politician_name || ''));
  const [leaderUsername, setLeaderUsername] = useState('');
  const [published, setPublished] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(!isAdmin);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const load = useCallback(async () => {
    if (isAdmin) return;
    setLoading(true); setError('');
    try {
      const data = await fetchPortfolio();
      setLeaderName(data.leader_name || '');
      setLeaderUsername(data.leader_username || '');
      setContent({ ...normalizeContent(data.content), full_name: data.content?.full_name || data.leader_name || '' });
      setPublished(Boolean(data.published)); setUpdatedAt(data.updated_at || null);
    } catch (e) { setError(portfolioErrorMessage(e)); }
    finally { setLoading(false); }
  }, [currentUser?.politician_name, isAdmin]);

  useEffect(() => { load(); }, [load]);
  const change = (key, value) => setContent((c) => ({ ...c, [key]: value }));
  const save = async (e) => {
    e.preventDefault(); setSaving(true); setError(''); setSavedMessage('');
    try {
      const data = await savePortfolio(content);
      setContent(normalizeContent(data.content || content)); setPublished(Boolean(data.published));
      setUpdatedAt(data.updated_at || null); setSavedMessage('Portfolio changes published.');
    } catch (err) { setError(err.message || 'Could not publish these portfolio changes.'); }
    finally { setSaving(false); }
  };
  const updateEntry = (key, index, field, value) => change(key, content[key].map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
  const removeEntry = (key, index) => change(key, content[key].filter((_, i) => i !== index));

  return <main className="shadcn-scope min-h-[calc(100vh-120px)] bg-[#f5f6f8]">
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 md:px-8 md:py-8 lg:px-10">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,.045)]">
        <div aria-hidden="true" className="h-1 bg-[linear-gradient(90deg,#ff9933_0%,#ff9933_33.333%,#fff_33.333%,#fff_66.666%,#138808_66.666%,#138808_100%)]" />
        <div className="flex flex-wrap items-center justify-between gap-5 p-5 md:p-7">
          <div className="flex min-w-0 items-center gap-4">
            {!isAdmin && <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-50 to-emerald-50 text-lg font-bold text-slate-700 ring-1 ring-slate-200">{(content.full_name || leaderName || currentUser?.politician_name || 'O').slice(0, 1)}</div>}
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-orange-700"><Building2 className="size-3.5" aria-hidden="true" />Official portfolio</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.75rem]">{isAdmin ? 'Representative directory' : 'Portfolio management'}</h1>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600">{isAdmin ? 'Browse verified public representative details.' : `Manage the public profile and office record for ${leaderName || currentUser?.politician_name || 'your office'}.`}</p>
            </div>
          </div>
          {!isAdmin && <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {tab !== 'directory' && (published ? <Badge className="gap-1 bg-emerald-100 text-emerald-800"><BadgeCheck className="size-3.5" />Published</Badge> : <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Not published</Badge>)}
            {!canEdit && <Badge variant="outline">Leader view</Badge>}
            {canEdit && tab !== 'directory' && !loading && <Button type="button" onClick={save} disabled={saving || Boolean(error)} className="bg-[#e87916] text-white hover:bg-[#cf6410]">
              {saving ? <><LoaderCircle className="animate-spin" />Publishing…</> : <><Save />Save & publish</>}
            </Button>}
            {published && leaderUsername && tab !== 'directory' && <a href={`/public/portfolio/${encodeURIComponent(leaderUsername)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"><Eye className="size-4" />Public page<ArrowUpRight className="size-3.5" /></a>}
          </div>}
        </div>
        {updatedAt && tab !== 'directory' && <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-2 text-xs text-slate-500 md:px-7">Last published {new Date(updatedAt).toLocaleString()}</div>}
      </header>

      <nav aria-label="Portfolio pages" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.filter(([id]) => !isAdmin || id === 'directory').map(([id, label]) => { const Icon = TAB_ICONS[id]; return <Button key={id} type="button" size="sm" variant={tab === id ? 'default' : 'ghost'} aria-current={tab === id ? 'page' : undefined} className={`shrink-0 gap-2 ${tab === id ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600'}`} onClick={() => setTab(id)}><Icon className="size-4" />{label}</Button>; })}
      </nav>
      {savedMessage && <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><BadgeCheck className="size-4" />{savedMessage}</p>}

      {tab === 'directory' ? <RepresentativesDirectory reps={reps} isLoading={isLoadingReps} error={repsError} onRetry={onRetryReps} currentLang={currentLang} t={t} /> : <>
        {loading ? <Card><CardContent className="py-8 text-sm text-slate-500">Loading portfolio…</CardContent></Card> : <>
          {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><span>{error}</span><Button type="button" variant="outline" size="sm" onClick={load}>Retry</Button></div>}
          {!error && !canEdit && !isAdmin && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Your office staff maintains portfolio content. This view is read-only.</div>}
          {tab === 'profile' && <div className="space-y-5">
            <Card><CardHeader><CardTitle>Public profile</CardTitle><CardDescription>Core identity and biography shown on the official portfolio.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Full Name" value={content.full_name} onChange={(v) => change('full_name', v)} disabled={!canEdit} />
              <Field label="Avatar Photo URL" value={content.avatar_url} onChange={(v) => change('avatar_url', v)} disabled={!canEdit} placeholder="https://…" />
              <Field label="Official Title (English)" value={content.title_en} onChange={(v) => change('title_en', v)} disabled={!canEdit} />
              <Field label="Official Title (Telugu)" value={content.title_te} onChange={(v) => change('title_te', v)} disabled={!canEdit} />
              <Field label="Public Biography & Statement (English)" value={content.biography_en} onChange={(v) => change('biography_en', v)} multiline disabled={!canEdit} />
              <Field label="Public Biography & Statement (Telugu)" value={content.biography_te} onChange={(v) => change('biography_te', v)} multiline disabled={!canEdit} />
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Office contact</CardTitle><CardDescription>Use verified public contact details for each office.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Karimnagar Constituency Office" value={content.constituency_office} onChange={(v) => change('constituency_office', v)} disabled={!canEdit} />
              <Field label="New Delhi Ministerial Office" value={content.ministerial_office} onChange={(v) => change('ministerial_office', v)} disabled={!canEdit} />
              <Field label="Official Email" value={content.official_email} onChange={(v) => change('official_email', v)} disabled={!canEdit} />
              <Field label="Constituency Helpline" value={content.helpline} onChange={(v) => change('helpline', v)} disabled={!canEdit} />
            </CardContent></Card>
          </div>}

          {tab === 'ministry' && <div className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Union ministry milestones</h2><p className="text-sm text-slate-600">Add verified milestones to the official record.</p></div>{canEdit && <Button type="button" variant="outline" onClick={() => change('ministry_milestones', [...content.ministry_milestones, { title: '', date: '', description: '' }])}>Add milestone</Button>}</div>
            {content.ministry_milestones.length === 0 ? <Card><CardContent className="py-8 text-sm text-slate-500">No ministry milestones have been added yet.</CardContent></Card> : content.ministry_milestones.map((m, i) => <Card key={i}><CardContent className="grid gap-3 pt-5 md:grid-cols-[1fr_180px]"><Field label="Milestone" value={m.title} onChange={(v) => updateEntry('ministry_milestones', i, 'title', v)} disabled={!canEdit} /><Field label="Date" value={m.date} onChange={(v) => updateEntry('ministry_milestones', i, 'date', v)} disabled={!canEdit} placeholder="Optional" /><div className="md:col-span-2"><Field label="Details" value={m.description} onChange={(v) => updateEntry('ministry_milestones', i, 'description', v)} multiline disabled={!canEdit} /></div>{canEdit && <Button type="button" size="sm" variant="ghost" className="text-red-700 md:col-span-2 md:justify-self-end" onClick={() => removeEntry('ministry_milestones', i)}>Remove milestone</Button>}</CardContent></Card>)}
          </div>}

          {tab === 'projects' && <div className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Constituency projects</h2><p className="text-sm text-slate-600">Keep public project updates accurate and current.</p></div>{canEdit && <Button type="button" variant="outline" onClick={() => change('constituency_projects', [...content.constituency_projects, { title: '', status: 'In progress', location: '', description: '' }])}>Add project</Button>}</div>
            {content.constituency_projects.length === 0 ? <Card><CardContent className="py-8 text-sm text-slate-500">No constituency projects have been added yet.</CardContent></Card> : content.constituency_projects.map((p, i) => <Card key={i}><CardContent className="grid gap-3 pt-5 md:grid-cols-2"><Field label="Project" value={p.title} onChange={(v) => updateEntry('constituency_projects', i, 'title', v)} disabled={!canEdit} /><Field label="Status" value={p.status} onChange={(v) => updateEntry('constituency_projects', i, 'status', v)} disabled={!canEdit} /><Field label="Location" value={p.location} onChange={(v) => updateEntry('constituency_projects', i, 'location', v)} disabled={!canEdit} /><div className="md:col-span-2"><Field label="Description" value={p.description} onChange={(v) => updateEntry('constituency_projects', i, 'description', v)} multiline disabled={!canEdit} /></div>{canEdit && <Button type="button" size="sm" variant="ghost" className="text-red-700 md:col-span-2 md:justify-self-end" onClick={() => removeEntry('constituency_projects', i)}>Remove project</Button>}</CardContent></Card>)}
          </div>}

          {tab === 'preview' && <Card className="overflow-hidden"><div className="h-2 bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-500"/><CardHeader className="flex-row items-center gap-4">{content.avatar_url ? <img src={content.avatar_url} alt="" className="size-20 rounded-full border-2 border-orange-200 object-cover" /> : <div className="flex size-20 items-center justify-center rounded-full bg-orange-50 text-2xl font-semibold text-orange-800">{content.full_name?.slice(0, 1) || '?'}</div>}<div><CardTitle>{content.full_name || 'Official profile'}</CardTitle><CardDescription>{currentLang === 'te' ? content.title_te || content.title_en : content.title_en || content.title_te}</CardDescription></div>{published && <Badge className="ml-auto bg-emerald-100 text-emerald-800">Published</Badge>}</CardHeader><CardContent className="space-y-6"><section><h3 className="font-semibold">Biography</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{currentLang === 'te' ? content.biography_te || content.biography_en || 'No biography published.' : content.biography_en || content.biography_te || 'No biography published.'}</p></section><section className="grid gap-4 sm:grid-cols-2">{[['Constituency office', content.constituency_office], ['Ministerial office', content.ministerial_office], ['Official email', content.official_email], ['Constituency helpline', content.helpline]].filter(([, v]) => v).map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm text-slate-800">{value}</p></div>)}</section><section className="grid gap-6 md:grid-cols-2"><div><h3 className="font-semibold">Ministry milestones</h3>{content.ministry_milestones.length ? <ul className="mt-2 space-y-2">{content.ministry_milestones.map((m, i) => <li key={i} className="rounded-lg border p-3"><p className="font-medium">{m.title || 'Untitled milestone'}</p>{m.date && <p className="text-xs text-slate-500">{m.date}</p>}<p className="mt-1 text-sm text-slate-600">{m.description}</p></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No milestones published.</p>}</div><div><h3 className="font-semibold">Constituency projects</h3>{content.constituency_projects.length ? <ul className="mt-2 space-y-2">{content.constituency_projects.map((p, i) => <li key={i} className="rounded-lg border p-3"><p className="font-medium">{p.title || 'Untitled project'}</p><p className="text-xs text-slate-500">{[p.status, p.location].filter(Boolean).join(' · ')}</p><p className="mt-1 text-sm text-slate-600">{p.description}</p></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No projects published.</p>}</div></section></CardContent></Card>}
        </>}
      </>}
    </div>
  </main>;
}
