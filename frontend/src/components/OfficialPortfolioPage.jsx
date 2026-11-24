import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck, BookOpenText, Building2, Eye, FolderKanban, IdCard, LoaderCircle, Newspaper, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
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
  if (error?.message === 'Not Found') return 'The portfolio service on this app is out of date. Update the connected backend, then retry. No profile content was loaded.';
  return error?.message || 'Could not load the office portfolio. Please retry.';
}

function Field({ label, value, onChange, multiline = false, disabled = false, placeholder = '', type = 'text', help }) {
  const props = { value: value || '', onChange: (e) => onChange(e.target.value), disabled, placeholder };
  return <label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700">{label}</span>
    {multiline ? <Textarea {...props} rows={4} /> : <Input {...props} type={type} />}
    {help && <span className="block text-xs leading-5 text-slate-500">{help}</span>}
  </label>;
}

function StatusField({ value, onChange, disabled }) {
  const options = ['Proposed', 'Planning', 'In progress', 'Completed', 'On hold'];
  if (value && !options.includes(value)) options.unshift(value);
  return <label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700">Status</span>
    <select value={value || 'In progress'} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">{options.map((option) => <option key={option}>{option}</option>)}</select>
  </label>;
}

function PortfolioPreview({ content, currentLang, published }) {
  const title = currentLang === 'te' ? content.title_te || content.title_en : content.title_en || content.title_te;
  const biography = currentLang === 'te' ? content.biography_te || content.biography_en : content.biography_en || content.biography_te;
  const contacts = [
    ['Constituency office', content.constituency_office], ['Ministerial office', content.ministerial_office],
    ['Official email', content.official_email], ['Constituency helpline', content.helpline],
  ].filter(([, value]) => value);
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div aria-hidden="true" className="h-1.5 bg-[linear-gradient(90deg,#ff9933_0%,#ff9933_33.333%,#fff_33.333%,#fff_66.666%,#138808_66.666%,#138808_100%)]"/>
    <header className="flex flex-wrap items-center gap-5 bg-gradient-to-br from-slate-50 via-white to-orange-50/50 p-6 md:p-8">
      {content.avatar_url ? <img src={content.avatar_url} alt={content.full_name ? `${content.full_name} profile` : 'Profile'} className="size-24 rounded-2xl bg-white object-cover shadow-md ring-4 ring-white" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}/> : <div className="grid size-24 place-items-center rounded-2xl bg-white text-3xl font-semibold text-slate-400 shadow-md ring-4 ring-white">{content.full_name?.slice(0, 1) || '—'}</div>}
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[.14em] text-orange-700">Official portfolio</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{content.full_name || 'Leader name'}</h2><p className="mt-1 text-sm text-slate-600">{title || 'Official title'}</p></div>
      <Badge variant="outline" className={published ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}>{published ? 'Published preview' : 'Draft preview'}</Badge>
    </header>
    <div className="space-y-8 p-6 md:p-8">
      <section><h3 className="text-sm font-semibold text-slate-900">Biography & statement</h3><p lang={currentLang} className="mt-2 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-slate-600">{biography || 'Add a biography to preview how the public profile will read.'}</p></section>
      {contacts.length > 0 && <section><h3 className="text-sm font-semibold text-slate-900">Office contact</h3><dl className="mt-3 grid gap-3 sm:grid-cols-2">{contacts.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-800">{value}</dd></div>)}</dl></section>}
      <div className="grid gap-8 lg:grid-cols-2">
        <section><h3 className="text-sm font-semibold text-slate-900">Ministry milestones</h3>{content.ministry_milestones.length ? <ol className="mt-3 space-y-3 border-l border-orange-200 pl-4">{content.ministry_milestones.map((item, index) => <li key={index} className="relative rounded-xl border border-slate-200 p-4 before:absolute before:-left-[1.35rem] before:top-5 before:size-2 before:rounded-full before:bg-orange-500"><p className="font-medium text-slate-900">{item.title || 'Untitled milestone'}</p>{item.date && <p className="mt-1 text-xs text-slate-500">{item.date}</p>}{item.description && <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>}</li>)}</ol> : <p className="mt-2 text-sm text-slate-500">No milestones added.</p>}</section>
        <section><h3 className="text-sm font-semibold text-slate-900">Constituency projects</h3>{content.constituency_projects.length ? <ul className="mt-3 space-y-3">{content.constituency_projects.map((item, index) => <li key={index} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-slate-900">{item.title || 'Untitled project'}</p>{item.status && <Badge variant="outline">{item.status}</Badge>}</div>{item.location && <p className="mt-1 text-xs text-slate-500">{item.location}</p>}{item.description && <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No projects added.</p>}</section>
      </div>
    </div>
  </article>;
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
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (isAdmin) return;
    setLoading(true); setLoadError('');
    try {
      const data = await fetchPortfolio();
      setLeaderName(data.leader_name || '');
      setLeaderUsername(data.leader_username || '');
      setContent({ ...normalizeContent(data.content), full_name: data.content?.full_name || data.leader_name || '' });
      setPublished(Boolean(data.published)); setUpdatedAt(data.updated_at || null);
      setDirty(false);
    } catch (e) { setLoadError(portfolioErrorMessage(e)); }
    finally { setLoading(false); }
  }, [currentUser?.politician_name, isAdmin]);

  useEffect(() => { load(); }, [load]);
  const change = (key, value) => { setContent((c) => ({ ...c, [key]: value })); setDirty(true); setSavedMessage(''); };
  const save = async (e) => {
    e.preventDefault(); setSaving(true); setSaveError(''); setSavedMessage('');
    try {
      const data = await savePortfolio(content);
      setContent(normalizeContent(data.content || content)); setPublished(Boolean(data.published));
      setUpdatedAt(data.updated_at || null); setSavedMessage('Portfolio changes published.'); setDirty(false);
    } catch (err) { setSaveError(err.message || 'Could not publish these portfolio changes.'); }
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
            {tab !== 'directory' && (loading ? <Badge variant="outline">Loading portfolio…</Badge> : loadError ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">Connection issue</Badge> : published ? <Badge className="gap-1 bg-emerald-100 text-emerald-800"><BadgeCheck className="size-3.5" />Published</Badge> : <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Draft</Badge>)}
            {!canEdit && <Badge variant="outline">Leader view</Badge>}
            {canEdit && tab !== 'directory' && !loading && !loadError && <Button type="button" onClick={save} disabled={saving || !dirty} className="bg-[#e87916] text-white hover:bg-[#cf6410]">
              {saving ? <><LoaderCircle className="animate-spin" />Publishing…</> : <><Save />{dirty ? 'Publish changes' : 'All changes saved'}</>}
            </Button>}
            {published && leaderUsername && tab !== 'directory' && <a href={`/public/portfolio/${encodeURIComponent(leaderUsername)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"><Eye className="size-4" />Public page<ArrowUpRight className="size-3.5" /></a>}
          </div>}
        </div>
        {updatedAt && tab !== 'directory' && <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-2 text-xs text-slate-500 md:px-7">Last published {new Date(updatedAt).toLocaleString()}</div>}
      </header>

      {(!loadError || isAdmin) && <nav aria-label="Portfolio pages" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.filter(([id]) => !isAdmin || id === 'directory').map(([id, label]) => { const Icon = TAB_ICONS[id]; return <Button key={id} type="button" size="sm" variant={tab === id ? 'default' : 'ghost'} aria-current={tab === id ? 'page' : undefined} className={`shrink-0 gap-2 ${tab === id ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-600'}`} onClick={() => setTab(id)}><Icon className="size-4" />{label}</Button>; })}
      </nav>}
      {savedMessage && <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><BadgeCheck className="size-4" />{savedMessage}</p>}

      {tab === 'directory' ? <RepresentativesDirectory reps={reps} isLoading={isLoadingReps} error={repsError} onRetry={onRetryReps} currentLang={currentLang} t={t} /> : loading ? <Card><CardContent className="space-y-3 py-10"><div className="h-5 w-48 animate-pulse rounded bg-slate-100"/><div className="h-4 w-72 max-w-full animate-pulse rounded bg-slate-100"/><div className="h-28 animate-pulse rounded-xl bg-slate-50"/></CardContent></Card> : loadError ? <Card className="overflow-hidden border-red-100 shadow-sm"><div className="h-1 bg-red-500"/><CardContent className="flex flex-col items-start gap-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:py-10"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700"><Building2 className="size-5"/></span><div><h2 className="font-semibold text-slate-900">Portfolio could not load</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{loadError}</p></div></div><Button type="button" variant="outline" onClick={load} className="shrink-0"><RefreshCw className="size-4"/>Retry connection</Button></CardContent></Card> : <>
          {saveError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><span>{saveError}</span><Button type="button" variant="outline" size="sm" onClick={save}>Retry publish</Button></div>}
          {!canEdit && !isAdmin && <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900"><Eye className="size-4 shrink-0"/>Your office staff maintains this public portfolio. You can review every section here.</div>}
          {tab === 'profile' && <div className="space-y-5">
            <Card><CardHeader><CardTitle>Public profile</CardTitle><CardDescription>Core identity and biography shown on the official portfolio.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Full Name" value={content.full_name} onChange={(v) => change('full_name', v)} disabled={!canEdit} />
              <Field label="Profile photo URL" value={content.avatar_url} onChange={(v) => change('avatar_url', v)} disabled={!canEdit} placeholder="https://…" type="url" help="Use a public image URL. The preview updates as you edit." />
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3">
                {content.avatar_url ? <img src={content.avatar_url} alt="Profile photo preview" className="size-14 rounded-full bg-white object-cover ring-2 ring-white shadow-sm" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} /> : <div className="grid size-14 place-items-center rounded-full bg-white text-sm font-semibold text-slate-400 shadow-sm">Photo</div>}
                <div><p className="text-sm font-medium text-slate-700">Public profile photo</p><p className="mt-0.5 text-xs text-slate-500">Shown on the public portfolio.</p></div>
              </div>
              <Field label="Official Title (English)" value={content.title_en} onChange={(v) => change('title_en', v)} disabled={!canEdit} />
              <Field label="Official Title (Telugu)" value={content.title_te} onChange={(v) => change('title_te', v)} disabled={!canEdit} />
              <Field label="Biography & statement · English" value={content.biography_en} onChange={(v) => change('biography_en', v)} multiline disabled={!canEdit} help="This appears on the public profile." />
              <Field label="Biography & statement · Telugu" value={content.biography_te} onChange={(v) => change('biography_te', v)} multiline disabled={!canEdit} />
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Office contact</CardTitle><CardDescription>Use verified public contact details for each office.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Constituency office" value={content.constituency_office} onChange={(v) => change('constituency_office', v)} disabled={!canEdit} placeholder="Office address" />
              <Field label="Ministerial office" value={content.ministerial_office} onChange={(v) => change('ministerial_office', v)} disabled={!canEdit} placeholder="Office address" />
              <Field label="Official email" value={content.official_email} onChange={(v) => change('official_email', v)} disabled={!canEdit} type="email" placeholder="office@example.gov.in" />
              <Field label="Constituency helpline" value={content.helpline} onChange={(v) => change('helpline', v)} disabled={!canEdit} type="tel" placeholder="Public contact number" />
            </CardContent></Card>
          </div>}

          {tab === 'ministry' && <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Official record</p><h2 className="mt-1 text-lg font-semibold">Ministry milestones</h2><p className="mt-1 text-sm text-slate-600">Publish dated, verifiable milestones on the public profile.</p></div>
              {canEdit && <Button type="button" variant="outline" onClick={() => change('ministry_milestones', [...content.ministry_milestones, { title: '', date: '', description: '' }])}><Plus className="size-4"/>Add milestone</Button>}
            </div>
            {content.ministry_milestones.length === 0 ? <Card><CardContent className="flex flex-col items-center py-10 text-center"><BookOpenText className="size-8 text-slate-300"/><p className="mt-3 font-medium text-slate-700">No milestones yet</p><p className="mt-1 text-sm text-slate-500">Add a verified update to build the public record.</p></CardContent></Card> : content.ministry_milestones.map((m, i) => <Card key={i} className="gap-4 rounded-xl border-slate-200 bg-white py-4 shadow-sm"><CardHeader className="flex-row items-center gap-3 pb-0"><span className="grid size-8 place-items-center rounded-lg bg-orange-50 text-sm font-semibold text-orange-800">{String(i + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><CardTitle className="text-sm">{m.title || `Milestone ${i + 1}`}</CardTitle><CardDescription>{m.date || 'Date not set'}</CardDescription></div>{canEdit && <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove milestone" className="text-slate-500 hover:text-red-700" onClick={() => removeEntry('ministry_milestones', i)}><Trash2 className="size-4"/></Button>}</CardHeader><CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_190px]"><Field label="Milestone title" value={m.title} onChange={(v) => updateEntry('ministry_milestones', i, 'title', v)} disabled={!canEdit} placeholder="Enter a clear, factual title"/><Field label="Date" type="date" value={m.date} onChange={(v) => updateEntry('ministry_milestones', i, 'date', v)} disabled={!canEdit}/><div className="md:col-span-2"><Field label="Details" value={m.description} onChange={(v) => updateEntry('ministry_milestones', i, 'description', v)} multiline disabled={!canEdit} placeholder="Describe the milestone and its public impact"/></div></CardContent></Card>)}
          </section>}

          {tab === 'projects' && <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Constituency work</p><h2 className="mt-1 text-lg font-semibold">Projects & public updates</h2><p className="mt-1 text-sm text-slate-600">Track the verified status and location of each project.</p></div>
              {canEdit && <Button type="button" variant="outline" onClick={() => change('constituency_projects', [...content.constituency_projects, { title: '', status: 'In progress', location: '', description: '' }])}><Plus className="size-4"/>Add project</Button>}
            </div>
            {content.constituency_projects.length === 0 ? <Card><CardContent className="flex flex-col items-center py-10 text-center"><FolderKanban className="size-8 text-slate-300"/><p className="mt-3 font-medium text-slate-700">No projects yet</p><p className="mt-1 text-sm text-slate-500">Add a project when you have a confirmed public update.</p></CardContent></Card> : content.constituency_projects.map((p, i) => <Card key={i} className="gap-4 rounded-xl border-slate-200 bg-white py-4 shadow-sm"><CardHeader className="flex-row items-center gap-3 pb-0"><span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-sm font-semibold text-emerald-800">{String(i + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><CardTitle className="text-sm">{p.title || `Project ${i + 1}`}</CardTitle><CardDescription>{[p.status, p.location].filter(Boolean).join(' · ') || 'Project details not set'}</CardDescription></div>{canEdit && <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove project" className="text-slate-500 hover:text-red-700" onClick={() => removeEntry('constituency_projects', i)}><Trash2 className="size-4"/></Button>}</CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Field label="Project name" value={p.title} onChange={(v) => updateEntry('constituency_projects', i, 'title', v)} disabled={!canEdit} placeholder="Enter the public project name"/><StatusField value={p.status} onChange={(v) => updateEntry('constituency_projects', i, 'status', v)} disabled={!canEdit}/><Field label="Location" value={p.location} onChange={(v) => updateEntry('constituency_projects', i, 'location', v)} disabled={!canEdit} placeholder="Village, mandal, or ward"/><div className="md:col-span-2"><Field label="Public update" value={p.description} onChange={(v) => updateEntry('constituency_projects', i, 'description', v)} multiline disabled={!canEdit} placeholder="Share a concise, verified progress update"/></div></CardContent></Card>)}
          </section>}

          {tab === 'preview' && <PortfolioPreview content={content} currentLang={currentLang} published={published}/>}
        </>}
    </div>
  </main>;
}
