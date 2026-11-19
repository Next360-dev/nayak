import { apiFetch } from './client';
import { Share, SharesInboxResponse, SentSharesResponse, ShareTargetsResponse, ShareReply } from '../types';

export async function fetchInbox(): Promise<Share[]> {
  const data = await apiFetch<SharesInboxResponse>('/api/shares/inbox');
  return data.shares || [];
}
export async function fetchUnreadCount(): Promise<number> {
  const data = await apiFetch<{ count: number }>('/api/shares/unread-count');
  return data.count ?? 0;
}
export async function updateStatus(id: number, status: string): Promise<any> {
  return apiFetch(`/api/shares/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}
export async function fetchReplies(id: number, recipient?: string): Promise<ShareReply[]> {
  const q = recipient ? `?recipient=${encodeURIComponent(recipient)}` : '';
  const data = await apiFetch<{ replies: any[] }>(`/api/shares/${id}/replies${q}`);
  // the server names the reply author `author`; the screens read `sender`
  return (data.replies || []).map((r) => ({ ...r, sender: r.sender ?? r.author }));
}
export async function postReply(id: number, body: string, recipient?: string): Promise<ShareReply> {
  const data = await apiFetch<{ reply: any }>(`/api/shares/${id}/replies`, {
    method: 'POST',
    body: JSON.stringify({ body, ...(recipient ? { recipient } : {}) }),
  });
  return { ...data.reply, sender: data.reply?.sender ?? data.reply?.author };
}
export async function fetchTargets(): Promise<ShareTargetsResponse['targets']> {
  const data = await apiFetch<ShareTargetsResponse>('/api/shares/targets');
  return data.targets || [];
}
export async function createShare(payload: any): Promise<any> {
  return apiFetch('/api/shares', { method: 'POST', body: JSON.stringify(payload) });
}
export async function fetchSent(): Promise<any[]> {
  const data = await apiFetch<SentSharesResponse>('/api/shares/sent');
  return data.shares || [];
}