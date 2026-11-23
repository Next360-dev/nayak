import { apiFetch } from './client';

export interface SavedStory {
  id: number;
  article_id?: number | null;
  title: string;
  url?: string | null;
  summary?: string | null;
  place?: string | null;
  source?: string | null;
  tone?: string | null;
  published_at?: string | null;
  saved_at: string;
}

export async function fetchSaved(): Promise<SavedStory[]> {
  const data = await apiFetch<{ stories: SavedStory[] }>('/api/saved');
  return data.stories || [];
}
export async function saveStory(s: { article_id?: number | null; title: string; url?: string | null; summary?: string | null; place?: string | null; source?: string | null; tone?: string | null; published_at?: string | null }): Promise<SavedStory> {
  const data = await apiFetch<{ story: SavedStory }>('/api/saved', { method: 'POST', body: JSON.stringify(s) });
  return data.story;
}
export async function removeSaved(id: number): Promise<void> {
  await apiFetch(`/api/saved/${id}`, { method: 'DELETE' });
}
