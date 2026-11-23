import { apiFetch } from './client';
import { NewsResponse } from '../types';

export async function fetchNews(params: { period?: string; news_scope?: string; page?: number; limit?: number; constituency?: string; date_range?: string; specific_date?: string; search?: string }): Promise<NewsResponse> {
  const q = new URLSearchParams();
  if (params.period) q.set('period', params.period);
  if (params.news_scope) q.set('news_scope', params.news_scope);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.constituency) q.set('constituency', params.constituency);
  if (params.date_range) q.set('date_range', params.date_range);
  if (params.specific_date) q.set('specific_date', params.specific_date);
  if (params.search) q.set('search', params.search);
  return apiFetch<NewsResponse>(`/api/news?${q.toString()}`);
}

export async function fetchSocialMedia(params: { constituency?: string | null; mla_name?: string | null; platform?: string; sentiment?: string; period?: string; search?: string; limit?: number; offset?: number }): Promise<any> {
  const q = new URLSearchParams();
  if (params.constituency) q.set('constituency', params.constituency);
  if (params.mla_name) q.set('mla_name', params.mla_name);
  if (params.platform) q.set('platform', params.platform);
  if (params.sentiment) q.set('sentiment', params.sentiment);
  if (params.period) q.set('period', params.period);
  if (params.search) q.set('search', params.search);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset !== undefined) q.set('offset', String(params.offset));
  return apiFetch<any>(`/api/social_media?${q.toString()}`);
}

// Searches the public web for posts about the MLA. Takes several seconds (the server pauses between requests).
export async function scrapeSocial(constituency: string, mla_name?: string | null): Promise<{ status: string; scraped_count: number; saved_count: number }> {
  const q = new URLSearchParams({ constituency });
  if (mla_name) q.set('mla_name', mla_name);
  return apiFetch(`/api/social_media/scrape?${q.toString()}`, { method: 'POST' });
}

export async function fetchRefreshStatus(): Promise<any> {
  return apiFetch<any>('/api/news/refresh/status');
}

export async function startRefresh(): Promise<any> {
  return apiFetch<any>('/api/news/refresh', { method: 'POST' });
}

export async function translate(headline: string, summary: string): Promise<{ translated_headline: string; translated_summary: string }> {
  const data = await apiFetch<any>('/api/translate', { method: 'POST', body: JSON.stringify({ headline, summary }) });
  return data?.data || data;
}

export async function reportStory(params: { kind: 'not_relevant' | 'wrong_priority' | 'wrong_sentiment'; title: string; article_id?: number | null; note?: string | null }): Promise<any> {
  return apiFetch<any>('/api/feedback/story', { method: 'POST', body: JSON.stringify(params) });
}