import { apiFetch } from './client';

// Office tools (backend/app/api/routes/features.py). The web app uses the same endpoints.
export interface AlertStory { id: number; title?: string; headline?: string; district?: string | null; district_name?: string | null; sentiment?: string | null; url?: string | null; priority_score?: number | null }
export interface WatchPost { headline: string; name: string; platform?: string | null; url?: string | null; leader_name?: string; constituency_name?: string }
export interface ComposedPost { id: number; title: string; body: string; platforms: string[]; scheduled_at?: string | null; status: string; owner_username?: string }
export interface Project { id: number; title: string; status: string; milestones: { title?: string; done?: boolean }[] | string[]; photos?: string[]; owner_username?: string }
export interface Suggestion { id: number; source: string; title: string; suggestion: string; status: string; assigned_to?: string | null }
export interface WhatsAppUpload { id?: number; raw_text: string; tags?: string[]; status?: string; owner_username?: string }
export interface SurveyResponse { id: number; role: string; category: string; message: string; name: string; email: string; created_at?: string | null }

export const fetchTop5 = async () => (await apiFetch<{ stories: AlertStory[] }>('/api/alerts/top5')).stories ?? [];
export const fetchWatchlist = () => apiFetch<{ names?: string[]; posts?: WatchPost[] }>('/api/watchlist');
export const saveWatchlist = (names: string[]) => apiFetch('/api/watchlist', { method: 'POST', body: JSON.stringify({ names }) });
export const checkWatchlistNow = () => apiFetch('/api/watchlist/check-now', { method: 'POST' });

export const fetchPosts = async () => (await apiFetch<{ posts: ComposedPost[] }>('/api/composed-posts')).posts ?? [];
export const createPost = (p: { title: string; body: string; platforms: string[]; scheduled_at?: string | null }) =>
  apiFetch('/api/composed-posts', { method: 'POST', body: JSON.stringify(p) });
export const decidePost = (id: number, status: 'approved' | 'rejected') =>
  apiFetch(`/api/composed-posts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });

export const fetchProjects = async () => (await apiFetch<{ projects: Project[] }>('/api/projects')).projects ?? [];
export const createProject = (p: { title: string; status: string; milestones: string[] }) =>
  apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(p) });
export const updateProject = (id: number, p: { status?: string; title?: string }) =>
  apiFetch(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(p) });

export const fetchSuggestions = async () => (await apiFetch<{ suggestions: Suggestion[] }>('/api/leader/suggestions')).suggestions ?? [];
export const approveSuggestion = (id: number, assigned_to?: string | null) =>
  apiFetch(`/api/leader/suggestions/${id}/approve`, { method: 'PATCH', body: JSON.stringify({ assigned_to: assigned_to ?? '' }) });

export const uploadWhatsApp = (raw_text: string) => apiFetch('/api/whatsapp/upload', { method: 'POST', body: JSON.stringify({ raw_text }) });
export const fetchWhatsApp = async () => (await apiFetch<{ uploads: WhatsAppUpload[] }>('/api/whatsapp/uploads')).uploads ?? [];

export const fetchSurveyResults = async () => (await apiFetch<{ responses: SurveyResponse[] }>('/api/public-survey/results')).responses ?? [];

export interface PortfolioContent {
  full_name: string; avatar_url: string; title_en: string; title_te: string; biography_en: string; biography_te: string;
  constituency_office: string; ministerial_office: string; official_email: string; helpline: string;
  ministry_milestones: { title: string; date?: string | null; description: string }[];
  constituency_projects: { title: string; status: string; location: string; description: string }[];
}
export interface PortfolioResponse { leader_username: string; leader_name?: string | null; content: Partial<PortfolioContent>; published: boolean; updated_by?: string | null; updated_at?: string | null }
export const fetchPortfolio = () => apiFetch<PortfolioResponse>('/api/portfolio');
export const savePortfolio = (c: PortfolioContent) => apiFetch('/api/portfolio', { method: 'PUT', body: JSON.stringify(c) });

export interface Representative { name: string; party?: string | null; role_type?: string | null; constituency_name?: string | null; district_name?: string | null; contact_phone?: string | null; email?: string | null }
export interface AuditEntry { id: number; at: string; actor: string; action: string; target?: string | null; detail?: string | null }
export const fetchRepresentatives = async () => (await apiFetch<{ representatives: Representative[] }>('/api/representatives')).representatives ?? [];
export const fetchAudit = async (q: string) => (await apiFetch<{ entries: AuditEntry[] }>(`/api/audit?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`)).entries ?? [];
