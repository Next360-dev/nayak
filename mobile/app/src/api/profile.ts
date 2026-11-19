import { apiFetch } from './client';

export interface Profile {
  email?: string | null;
  phone?: string | null;
  alerts_enabled?: boolean | null;
  lang?: string | null;
  email_configured?: boolean | null;
}

export async function fetchProfile(): Promise<Profile> {
  return apiFetch<Profile>('/api/me/profile');
}

export async function updateProfile(params: { email?: string | null; phone?: string | null; alerts_enabled?: boolean | null; lang?: string | null }): Promise<Profile> {
  return apiFetch<Profile>('/api/me/profile', { method: 'PUT', body: JSON.stringify(params) });
}

export async function testAlert(): Promise<any> {
  return apiFetch<any>('/api/me/test-alert', { method: 'POST' });
}

export async function fetchHealth(): Promise<{ status?: string | null }> {
  return apiFetch<any>('/api/health');
}

export async function sendAppFeedback(message: string): Promise<any> {
  return apiFetch<any>('/api/feedback/app', { method: 'POST', body: JSON.stringify({ message }) });
}
