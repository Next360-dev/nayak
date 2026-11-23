import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Send, FileText, Printer, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLang } from '../i18n/LangContext';
import { fetchComposedPosts, createComposedPost, decideComposedPost } from '../utils/api';
import { FeaturePage } from './home/shared';

const PLATFORMS = [
  { id: 'x', label: 'X / Twitter' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ComposeScreen({ user, onBack }) {
  const { tr } = useLang();
  const [posts, setPosts] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState(null);
  const [imageError, setImageError] = useState('');
  const fileInput = useRef(null);
  const [selected, setSelected] = useState([]);
  const [scheduled, setScheduled] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);

  const canCreate = user.role === 'staff';

  const load = useCallback(async () => {
    setLoading(true);
    setListError('');
    try { setPosts((await fetchComposedPosts()).posts || []); }
    catch (e) { setListError(e.message || 'Could not load posts'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const create = async () => {
    setError('');
    setSaving(true);
    try {
      await createComposedPost({ title, body, platforms: selected, scheduled_at: scheduled || null, image_data: image?.dataUrl || null });
      setTitle(''); setBody(''); setSelected([]); setScheduled(''); setImage(null); setImageError('');
      if (fileInput.current) fileInput.current.value = '';
      await load();
    } catch (e) { setError(e.message || 'Failed to create post'); }
    finally { setSaving(false); }
  };

  const selectImage = (event) => {
    const file = event.target.files?.[0];
    setImageError('');
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setImage(null);
      setImageError(tr('compose.imageTypeError'));
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImage(null);
      setImageError(tr('compose.imageSizeError'));
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage({ name: file.name, dataUrl: String(reader.result) });
    reader.onerror = () => { setImage(null); setImageError(tr('compose.imageReadError')); };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImage(null);
    setImageError('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const dec = async (id, status) => {
    try {
      await decideComposedPost(id, status);
      await load();
    } catch (e) { setError(e.message || 'Failed to update'); }
  };

  const statusLabel = (s) => ({ draft: tr('status.draft'), approved: tr('status.approved'), rejected: tr('status.rejected') })[s] || s;

  return (
    <FeaturePage title={canCreate ? tr('compose.title') : tr('compose.reviewTitle')} subtitle={canCreate ? undefined : tr('compose.reviewHint')} onBack={onBack}>
    <div className="space-y-6">
      <style>{`@media print { body * { visibility: hidden !important; } #post-export, #post-export * { visibility: visible !important; } #post-export { position: absolute; inset: 0 auto auto 0; width: 100%; } #post-export-actions { display: none !important; } }`}</style>
      {canCreate && <Card className="gap-3 py-5">
        <CardHeader className="pb-0 flex items-center gap-2">
          <FileText className="size-4 shrink-0" aria-hidden="true" />
          <CardTitle className="text-[15px] font-semibold">{tr('compose.editor')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input label={tr('compose.labelTitle')} value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea label={tr('compose.labelBody')} value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm"><ImageIcon className="size-4" /></span>
                  <span><span className="block text-sm font-medium text-slate-800">{tr('compose.imageLabel')}</span><span className="block text-xs text-slate-500">{tr('compose.imageHelp')}</span></span>
                </div>
                <label htmlFor="compose-image" className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-100 focus-within:ring-2 focus-within:ring-orange-500"><Upload className="size-4" />{image ? tr('compose.imageChange') : tr('compose.imageChoose')}<input ref={fileInput} id="compose-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} className="sr-only" aria-describedby="compose-image-help" /></label>
                <span id="compose-image-help" className="sr-only">{tr('compose.imageHelp')}</span>
              </div>
              {imageError && <p role="alert" className="text-sm text-destructive">{imageError}</p>}
              {image && <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
                <img src={image.dataUrl} alt={image.name} className="size-14 rounded-md border border-slate-200 object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{image.name}</span>
                <Button type="button" variant="ghost" size="icon" onClick={removeImage} aria-label={tr('compose.imageRemove')}><Trash2 className="size-4" /></Button>
              </div>}
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">{tr('compose.platforms')}</div>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <label key={p.id} className="cursor-pointer flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary">
                    <input type="checkbox" className="h-4 w-4 shrink-0" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Input label={tr('compose.schedule')} type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
              <Button type="button" size="sm" onClick={create} disabled={saving || !title || selected.length === 0}><Send className="size-3 mr-1" /> {tr('compose.save')}</Button>
            </div>
          </div>
        </CardContent>
      </Card>}

      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

      <Card id="post-export" className="gap-3 py-5">
        <CardHeader className="pb-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 shrink-0" aria-hidden="true" />
            <CardTitle className="text-[15px] font-semibold">{canCreate ? tr('compose.posts') : tr('compose.reviewQueue')}</CardTitle>
          </div>
          <div id="post-export-actions" className="flex items-center gap-2">
            <Badge variant="secondary">{posts.length}</Badge>
            <Button type="button" size="sm" variant="outline" disabled={loading || posts.length === 0} onClick={() => window.print()}><Printer /> {tr('compose.exportPdf')}</Button>
          </div>
        </CardHeader>
        <CardContent>
          {listError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
              <span>{listError}</span><Button type="button" size="sm" variant="outline" onClick={load}>{tr('btn.retry')}</Button>
            </div>
          ) : loading ? (
            <p role="status" className="text-sm text-muted-foreground">{tr('common.loading')}</p>
          ) : posts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{tr('compose.empty')}</p>
          ) : (
            <ul className="list-none divide-y">
              {posts.map((p) => {
                const mine = p.owner_username === user.username;
                const leaderCanDecide = ['mla', 'minister'].includes(user.role) && p.status === 'draft';
                return (
                  <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{p.title}</p>
                      {p.image_data && <img src={p.image_data} alt={tr('compose.imageForPost', { title: p.title })} className="mt-3 max-h-64 w-full rounded-lg border border-slate-200 object-cover object-left-top sm:max-w-sm" />}
                      {p.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{p.body}</p>}
                      <p className="text-xs text-muted-foreground">{p.platforms.join(', ') || '—'} · {p.scheduled_at || tr('compose.now')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{tr('by', { user: p.owner_username })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.status === 'approved' ? 'default' : p.status === 'rejected' ? 'destructive' : 'outline'}>{statusLabel(p.status)}</Badge>
                      {!mine && leaderCanDecide && (
                        <>
                          <Button type="button" size="sm" variant="outline" onClick={() => dec(p.id, 'approved')}>{tr('compose.approve')}</Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => dec(p.id, 'rejected')}>{tr('compose.reject')}</Button>
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
    </FeaturePage>
  );
}
