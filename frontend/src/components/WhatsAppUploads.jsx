import React, { useCallback, useEffect, useState } from 'react';
import { Mail, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { uploadWhatsApp, fetchWhatsApp } from '../utils/api';
import { useLang } from '../i18n/LangContext';

export default function WhatsAppUploads({ user }) {
  const { tr } = useLang();
  const [uploads, setUploads] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setUploads((await fetchWhatsApp()).uploads || []); }
    catch { setUploads([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    setError(''); setSending(true);
    try {
      await uploadWhatsApp({ raw_text: text });
      setText('');
      await load();
    } catch (e) { setError(e.message || 'Failed to upload'); }
    finally { setSending(false); }
  };

  const canUpload = user.role === 'staff';

  return (
    <div className="space-y-6">
      {canUpload && <Card className="gap-3 py-5">
        <CardHeader className="pb-0 flex items-center gap-2">
          <Mail className="size-4 shrink-0" aria-hidden="true" />
          <CardTitle className="text-[15px] font-semibold">{tr('wa.title')}</CardTitle>
          <span className="ml-auto text-xs text-muted-foreground">{tr('wa.sub')}</span>
        </CardHeader>
        <CardContent>
          <Textarea label={tr('wa.label')} value={text} onChange={(e) => setText(e.target.value)} rows={4} />
          <Button type="button" size="sm" onClick={send} disabled={sending || !text.trim()} className="w-full">{sending ? tr('wa.sending') : tr('wa.send')}</Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>}

      <Card className="gap-3 py-5">
        <CardHeader className="pb-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
            <CardTitle className="text-[15px] font-semibold">{tr('wa.list')}</CardTitle>
          </div>
          <Badge variant="secondary">{uploads.length}</Badge>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{tr('wa.empty')}</p>
          ) : (
            <ul className="list-none divide-y">
              {uploads.map((u) => (
                <li key={u.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{u.tags?.join(', ') || tr('wa.general')}</p>
                    <p className="text-xs text-muted-foreground">{u.raw_text?.slice(0, 120)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{tr('by', { user: u.owner_username })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{u.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
