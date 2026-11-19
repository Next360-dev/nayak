import { apiFetch } from './client';

export async function registerDevice(token: string, platform: string): Promise<void> {
  await apiFetch('/api/devices', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
}

export async function unregisterDevice(token: string): Promise<void> {
  await apiFetch('/api/devices', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
}