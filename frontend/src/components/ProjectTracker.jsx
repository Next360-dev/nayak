import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Play, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchProjects, createProject, updateProject } from '../utils/api';
import { useLang } from '../i18n/LangContext';
import { FeaturePage } from './home/shared';

export default function ProjectTracker({ user: suppliedUser, currentUser, onBack }) {
  const user = suppliedUser || currentUser;
  const { tr } = useLang();
  const [projects, setProjects] = useState([]);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('active');
  const [milestones, setMilestones] = useState('');
  const [photos, setPhotos] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setListError('');
    try { setProjects((await fetchProjects()).projects || []); }
    catch (e) { setListError(e.message || 'Could not load projects'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setError(''); setSaving(true);
    try {
      await createProject({ title, status, milestones: milestones.split('\n').filter(Boolean), photos: photos.split('\n').filter(Boolean) });
      setTitle(''); setMilestones(''); setPhotos('');
      await load();
    } catch (e) { setError(e.message || 'Failed to create project'); }
    finally { setSaving(false); }
  };

  const update = async (id, p) => {
    try {
      await updateProject(id, p);
      await load();
    } catch (e) { setError(e.message || 'Failed to update'); }
  };

  const isStaff = user.role === 'staff';
  const canCreate = isStaff;

  const content = (
    <div className="space-y-6">
      {canCreate && (
        <Card className="gap-3 py-5">
          <CardHeader className="pb-0 flex items-center gap-2">
            <Play className="size-4 shrink-0" aria-hidden="true" />
            <CardTitle className="text-[15px] font-semibold">{tr('proj.new')}</CardTitle>
            <span className="ml-auto text-xs text-muted-foreground">{tr('proj.sub')}</span>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input label={tr('proj.labelTitle')} value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2">
                  <input type="radio" checked={status === 'active'} onChange={() => setStatus('active')} className="h-4 w-4 shrink-0" />
                  <label className="text-sm cursor-pointer">{tr('proj.status.active')}</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="radio" checked={status === 'on_hold'} onChange={() => setStatus('on_hold')} className="h-4 w-4 shrink-0" />
                  <label className="text-sm cursor-pointer">{tr('proj.status.onHold')}</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="radio" checked={status === 'done'} onChange={() => setStatus('done')} className="h-4 w-4 shrink-0" />
                  <label className="text-sm cursor-pointer">{tr('proj.status.done')}</label>
                </div>
              </div>
              <Textarea label={tr('proj.labelMilestones')} value={milestones} onChange={(e) => setMilestones(e.target.value)} rows={2} />
              <Textarea label={tr('proj.labelPhotos')} value={photos} onChange={(e) => setPhotos(e.target.value)} rows={2} />
              <Button type="button" size="sm" onClick={create} disabled={saving || !title} className="w-full">{saving ? tr('proj.saving') : tr('proj.create')}</Button>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="gap-3 py-5">
        <CardHeader className="pb-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            <CardTitle className="text-[15px] font-semibold">{tr('proj.list')}</CardTitle>
          </div>
          <Badge variant="secondary">{projects.length}</Badge>
        </CardHeader>
        <CardContent>
          {listError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
              <span>{listError}</span><Button type="button" size="sm" variant="outline" onClick={load}>{tr('btn.retry')}</Button>
            </div>
          ) : loading ? (
            <p role="status" className="text-sm text-muted-foreground">{tr('common.loading')}</p>
          ) : projects.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{tr('proj.empty')}</p>
          ) : (
            <ul className="list-none divide-y">
              {projects.map((p) => {
                const editable = isStaff && p.owner_username === user.username;
                return (
                  <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{tr('by', { user: p.owner_username })} · {tr(`proj.status.${p.status === 'on_hold' ? 'onHold' : p.status}`)}</p>
                      {p.milestones?.length && (
                        <p className="text-xs text-muted-foreground mt-0.5">{p.milestones.join(', ')}</p>
                      )}
                      {p.photos?.length && <p className="text-xs text-muted-foreground mt-0.5">{tr('proj.photos', { n: p.photos.length })}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{tr(`proj.status.${p.status === 'on_hold' ? 'onHold' : p.status}`)}</Badge>
                      {editable && (
                        <>
                          <Input size="sm" defaultValue={p.title} className="w-32" onBlur={(e) => update(p.id, { title: e.target.value })} />
                          <Button type="button" size="sm" onClick={() => update(p.id, { status: p.status === 'done' ? 'active' : 'done' })}>{tr('proj.toggle')}</Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
  return onBack
    ? <FeaturePage title={tr('proj.title')} subtitle={tr('proj.sub')} onBack={onBack}>{content}</FeaturePage>
    : <div className="shadcn-scope">{content}</div>;
}
