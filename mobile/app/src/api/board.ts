import { apiFetch } from './client';

export interface TeamMember { username: string; }

export interface StaffMember {
  username: string;
  last_login?: string | null;
  is_active: boolean;
}

export interface AdminUser {
  username: string;
  role: string;
  politician_name?: string | null;
  constituency_name?: string | null;
  district_name?: string | null;
  works_for?: string | null;
  last_login?: string | null;
  is_active: boolean;
}

export interface TeamTask {
  id: number;
  title: string;
  note?: string | null;
  url?: string | null;
  created_by: string;
  assigned_to?: string | null;
  due_date?: string | null;
  status: 'todo' | 'doing' | 'done';
  created_at?: string | null;
  updated_at?: string | null;
  notes?: number;
}

export interface TeamNote {
  id: number;
  author: string;
  body: string;
  created_at?: string | null;
}

export interface BoardResponse {
  status: string;
  leader: string;
  can_manage: boolean;
  me: string;
  members: string[];
  tasks: TeamTask[];
}

export async function fetchBoard(): Promise<BoardResponse> {
  return apiFetch('/api/board');
}

export async function createTask(payload: { title: string; note?: string | null; url?: string | null; assigned_to?: string | null; due_date?: string | null }): Promise<{ status: string; task: TeamTask }> {
  return apiFetch('/api/board/tasks', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateTask(taskId: number, payload: { status?: string; assigned_to?: string | null; due_date?: string | null }): Promise<{ status: string; task: TeamTask }> {
  return apiFetch(`/api/board/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function fetchTaskNotes(taskId: number): Promise<{ status: string; notes: TeamNote[] }> {
  return apiFetch(`/api/board/tasks/${taskId}/notes`);
}

export async function addTaskNote(taskId: number, body: string): Promise<{ status: string; note: TeamNote }> {
  return apiFetch(`/api/board/tasks/${taskId}/notes`, { method: 'POST', body: JSON.stringify({ body }) });
}

export async function fetchTeamBriefing(lang: 'en' | 'te' = 'en'): Promise<{ status: string; leader: string; auto: string; text: string; edited: boolean; edited_by?: string | null; updated_at?: string | null }> {
  return apiFetch(`/api/team/briefing?lang=${lang}`);
}

export async function saveTeamBriefing(lang: 'en' | 'te', body: string): Promise<{ status: string }> {
  return apiFetch('/api/team/briefing', { method: 'PUT', body: JSON.stringify({ lang, body }) });
}

export async function resetTeamBriefing(lang: 'en' | 'te' = 'en'): Promise<{ status: string }> {
  return apiFetch(`/api/team/briefing?lang=${lang}`, { method: 'DELETE' });
}

export async function fetchTeam(): Promise<StaffMember[]> {
  const res = await apiFetch<any>('/api/team');
  return Array.isArray(res?.staff) ? res.staff : [];
}

export async function createTeamMember(username: string, password: string): Promise<{ status: string; username: string }> {
  return apiFetch('/api/team/create', { method: 'POST', body: JSON.stringify({ username, password }) });
}

export async function resetTeamPassword(username: string, newPassword: string): Promise<{ status: string; username: string }> {
  return apiFetch('/api/team/reset-password', { method: 'POST', body: JSON.stringify({ username, new_password: newPassword }) });
}

export async function setTeamActive(username: string, active: boolean): Promise<{ status: string; username: string; active: boolean }> {
  return apiFetch('/api/team/set-active', { method: 'POST', body: JSON.stringify({ username, active }) });
}

export async function fetchAllUsers(): Promise<AdminUser[]> {
  const res = await apiFetch<any>('/api/users');
  return Array.isArray(res?.users) ? res.users : [];
}

export async function resetUserPassword(username: string, newPassword: string): Promise<{ status: string; username: string }> {
  return apiFetch('/api/users/reset-password', { method: 'POST', body: JSON.stringify({ username, new_password: newPassword }) });
}

export async function setUserActive(username: string, active: boolean): Promise<{ status: string; username: string; active: boolean }> {
  return apiFetch('/api/users/set-active', { method: 'POST', body: JSON.stringify({ username, active }) });
}