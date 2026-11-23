export function getApiBase() {
  // Opened straight from disk: talk to the local backend directly.
  // Everywhere else (Vite dev server on any port, or the backend serving the build)
  // use same-origin URLs; Vite proxies /api to the backend.
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return 'http://localhost:8000';
  }
  return '';
}

const TOKEN_KEY = 'ai_office_token';
export const AUTH_EXPIRED_EVENT = 'aso-auth-expired';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
}

// fetch() that adds the Bearer token. A 401 on a call that carried a token
// means the session expired, so tell the app to go back to the login screen.
export async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  return res;
}

export async function fetchMe() {
  const res = await apiFetch(`${getApiBase()}/api/me`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.status === 'success' ? data.user : null;
}

export async function fetchHierarchy() {
  const apiTarget = getApiBase();
  const res = await apiFetch(`${apiTarget}/api/hierarchy`);
  return await res.json();
}

export async function fetchPoliticians() {
  const apiTarget = getApiBase();
  const res = await apiFetch(`${apiTarget}/api/politicians`);
  return await res.json();
}

export async function loginUser(username, password) {
  const apiTarget = getApiBase();
  const res = await fetch(`${apiTarget}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const err = new Error(`Login failed with status ${res.status}`);
    err.status = res.status;   // 429 = too many wrong attempts
    throw err;
  }
  return await res.json();
}

export async function fetchNews({
  district,
  politician,
  constituency,
  search,
  sourceType,
  priority,
  period,
  newsScope,
  dateRange,
  specificDate,
  page = 1,
  limit = 20,
  currentUser
}) {
  const params = new URLSearchParams();

  const allConsts = ['All', 'All Assembly Constituencies', 'All Constituencies', 'Statewide'];
  if (constituency && !allConsts.includes(constituency)) {
    params.append('constituency', constituency);
  } else if (currentUser && currentUser.role === 'mla' && currentUser.constituency_name && !allConsts.includes(currentUser.constituency_name)) {
    params.append('constituency', currentUser.constituency_name);
  }

  const allDists = ['All', 'All 33 Districts', 'All Districts', 'Statewide'];
  if (district && !allDists.includes(district)) {
    params.append('district', district);
  }
  // Only filter by politician if it's a real MLA name (not admin placeholders)
  const adminNames = ['All', 'All 119 MLAs & CM', 'All Leaders', 'Master Admin', 'State Master Administrator', 'State Administration', 'Constituency Representative'];
  if (politician && !adminNames.includes(politician)) {
    params.append('politician', politician);
  }

  if (search && search.trim()) params.append('search', search.trim());
  if (sourceType) params.append('source_type', sourceType);
  if (priority && priority !== '0') params.append('priority', priority);

  params.append('period', period || 'today');
  params.append('news_scope', newsScope || 'all');

  if (page && page > 1) params.append('page', page);
  if (limit && limit !== 20) params.append('limit', limit);

  if (period === 'history') {
    if (specificDate) {
      params.append('specific_date', specificDate);
    } else if (dateRange && dateRange !== 'all') {
      params.append('date_range', dateRange);
    }
  } else {
    if (specificDate) params.append('specific_date', specificDate);
  }

  const apiTarget = getApiBase();
  const res = await apiFetch(`${apiTarget}/api/news?${params.toString()}`);
  return await res.json();
}

export async function fetchUrgentAlerts({ period, activeConst }) {
  const apiTarget = getApiBase();
  let selectedAlerts = [];

  if (activeConst) {
    try {
      const cRes = await apiFetch(`${apiTarget}/api/news?period=${period || 'today'}&constituency=${encodeURIComponent(activeConst)}&limit=30`);
      const cData = await cRes.json();
      if (cRes.ok && cData.status === 'success' && Array.isArray(cData.articles)) {
        const sorted = cData.articles.filter((article) => Number(article.priority_score) === 1).sort((a, b) => {
          const pA = Number(a.priority_score) || 3;
          const pB = Number(b.priority_score) || 3;
          if (pA !== pB) return pA - pB;
          const tA = a.date_time ? new Date(a.date_time).getTime() : 0;
          const tB = b.date_time ? new Date(b.date_time).getTime() : 0;
          return tB - tA;
        });
        selectedAlerts = sorted.slice(0, 6);
      }
    } catch (e) {
      console.warn('Constituency alerts fetch error:', e);
    }
  }

  if (selectedAlerts.length === 0 && !activeConst) {
    try {
      const res = await apiFetch(`${apiTarget}/api/news?period=${period || 'today'}&priority=1&limit=50`);
      const data = await res.json();
      if (res.ok && data.status === 'success' && Array.isArray(data.articles)) {
        selectedAlerts = data.articles.slice(0, 6);
      }
    } catch (e) {
      console.warn('Statewide P1 fetch error:', e);
    }
  }

  return selectedAlerts;
}

export async function fetchRepresentatives(district) {
  const params = new URLSearchParams();
  if (district && district !== 'All') {
    params.append('district', district);
  }

  const apiTarget = getApiBase();
  const res = await apiFetch(`${apiTarget}/api/representatives?${params.toString()}`);
  return await res.json();
}

export async function fetchPortfolio() {
  const res = await apiFetch(`${getApiBase()}/api/portfolio`);
  return jsonOrThrow(res);
}

export async function savePortfolio(content) {
  return jsonOrThrow(await apiFetch(`${getApiBase()}/api/portfolio`, jsonPost('PUT', content)));
}

export async function fetchPublicPortfolio(leaderUsername) {
  return jsonOrThrow(await fetch(`${getApiBase()}/api/public/portfolio/${encodeURIComponent(leaderUsername)}`));
}

export async function translateArticle(headline, summary) {
  const apiTarget = getApiBase();
  const res = await apiFetch(`${apiTarget}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      headline,
      summary: summary || ''
    })
  });
  return await res.json();
}

export async function fetchSocialMediaPosts({ constituency, mlaName, district, platform, sentiment, period, search }) {
  const apiTarget = getApiBase();
  const params = new URLSearchParams();
  if (constituency && constituency !== 'All') params.append('constituency', constituency);
  if (mlaName && mlaName !== 'All') params.append('mla_name', mlaName);
  if (district && district !== 'All') params.append('district', district);
  if (platform && platform !== 'all') params.append('platform', platform);
  if (sentiment && sentiment !== 'all') params.append('sentiment', sentiment);
  if (period) params.append('period', period);
  if (search) params.append('search', search);

  const res = await apiFetch(`${apiTarget}/api/social_media?${params.toString()}`);
  return await res.json();
}

export async function triggerSocialMediaScrape(constituency, mlaName) {
  const apiTarget = getApiBase();
  const params = new URLSearchParams();
  params.append('constituency', constituency);
  if (mlaName) params.append('mla_name', mlaName);

  const res = await apiFetch(`${apiTarget}/api/social_media/scrape?${params.toString()}`, {
    method: 'POST'
  });
  return await res.json();
}

// ── Sharing ──────────────────────────────────────────────────────────────────
async function jsonOrThrow(res) {
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const d = data && data.detail;
    throw new Error(typeof d === 'string' ? d : 'Request failed (' + res.status + ')');
  }
  return data;
}

const jsonPost = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

export const fetchShareTargets = async () =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/shares/targets`));
export const createShare = async (payload) =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/shares`, jsonPost('POST', payload)));
export const fetchInbox = async () =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/shares/inbox`));
export const fetchSent = async () =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/shares/sent`));
export const fetchUnreadCount = async () =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/shares/unread-count`));
export const updateShareStatus = async (id, status) =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/shares/${id}/status`, jsonPost('PATCH', { status })));
export const fetchReplies = async (id, recipient) =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/shares/${id}/replies${recipient ? `?recipient=${encodeURIComponent(recipient)}` : ''}`));
export const postReply = async (id, body, recipient) =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/shares/${id}/replies`, jsonPost('POST', { body, recipient })));

// ── Admin ────────────────────────────────────────────────────────────────────
export const createUser = async (payload) =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/users/create`, jsonPost('POST', payload)));
export const resetPassword = async (username, newPassword) =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/users/reset-password`, jsonPost('POST', { username, new_password: newPassword })));

// ── Master admin overview / leader's own team ────────────────────────────────
export const fetchOverview = async () =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/admin/overview`));
export const fetchTeam = async () =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/team`));
export const createTeamMember = async (username, password) =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/team/create`, jsonPost('POST', { username, password })));
export const resetTeamPassword = async (username, newPassword) =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/team/reset-password`, jsonPost('POST', { username, new_password: newPassword })));
export const setTeamActive = async (username, active) =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/team/set-active`, jsonPost('POST', { username, active })));

// ── Admin support: all users, enable/disable, scraper ───────────────────────
export const fetchAllUsers = async () =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/users`));
export const setUserActive = async (username, active) =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/users/set-active`, jsonPost('POST', { username, active })));
export const triggerScraper = async () =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/automation/trigger`, { method: 'POST' }));

// ── Refresh news now (the team's own fast update) ────────────────────────────
export const fetchRefreshStatus = async () =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/news/refresh/status`));
export const startRefresh = async () =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/news/refresh`, { method: 'POST' }));

// ── Role-aware home dashboard ────────────────────────────────────────────────
export const fetchDashboard = async () =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/dashboard`));

// ── Own password + audit log ─────────────────────────────────────────────────
export const changeMyPassword = async (currentPassword, newPassword) =>
  jsonOrThrow(await apiFetch(`${getApiBase()}/api/me/password`, jsonPost('POST', { current_password: currentPassword, new_password: newPassword })));
export const fetchAudit = async ({ limit = 50, q = '', action = '' } = {}) => {
  const p = new URLSearchParams({ limit: String(limit) });
  if (q) p.set('q', q);
  if (action) p.set('action', action);
  return jsonOrThrow(await apiFetch(`${getApiBase()}/api/audit?${p.toString()}`));
};

// ── Account, briefing, feedback, contacts ────────────────────────────────────
export const fetchProfile = async () => jsonOrThrow(await apiFetch(`${getApiBase()}/api/me/profile`));
export const saveProfile = async (p) => jsonOrThrow(await apiFetch(`${getApiBase()}/api/me/profile`, jsonPost('PUT', p)));
export const sendTestEmail = async () => jsonOrThrow(await apiFetch(`${getApiBase()}/api/me/test-alert`, { method: 'POST' }));
export const fetchBriefing = async (lang) => jsonOrThrow(await apiFetch(`${getApiBase()}/api/briefing?lang=${lang}`));
export const emailBriefing = async (lang) => jsonOrThrow(await apiFetch(`${getApiBase()}/api/briefing/email-me?lang=${lang}`, { method: 'POST' }));
export const reportStory = async (payload) => jsonOrThrow(await apiFetch(`${getApiBase()}/api/feedback/story`, jsonPost('POST', payload)));
export const sendAppFeedback = async (message) => jsonOrThrow(await apiFetch(`${getApiBase()}/api/feedback/app`, jsonPost('POST', { message })));
export const importContacts = async (csv, dryRun) => jsonOrThrow(await apiFetch(`${getApiBase()}/api/representatives/import?dry_run=${dryRun ? 'true' : 'false'}`, jsonPost('POST', { csv })));

// ── team board + staff-edited briefing ──
export const fetchBoard = async () => jsonOrThrow(await apiFetch(`${getApiBase()}/api/board`));
export const createTask = async (p) => jsonOrThrow(await apiFetch(`${getApiBase()}/api/board/tasks`, jsonPost('POST', p)));
export const updateTask = async (id, p) => jsonOrThrow(await apiFetch(`${getApiBase()}/api/board/tasks/${id}`, jsonPost('PATCH', p)));
export const fetchTaskNotes = async (id) => jsonOrThrow(await apiFetch(`${getApiBase()}/api/board/tasks/${id}/notes`));
export const addTaskNote = async (id, body) => jsonOrThrow(await apiFetch(`${getApiBase()}/api/board/tasks/${id}/notes`, jsonPost('POST', { body })));
export const fetchTeamBriefing = async (lang) => jsonOrThrow(await apiFetch(`${getApiBase()}/api/team/briefing?lang=${lang}`));
export const saveTeamBriefing = async (lang, body) => jsonOrThrow(await apiFetch(`${getApiBase()}/api/team/briefing`, jsonPost('PUT', { lang, body })));
export const resetTeamBriefing = async (lang) => jsonOrThrow(await apiFetch(`${getApiBase()}/api/team/briefing?lang=${lang}`, { method: 'DELETE' }));

// ── milestone-1 tasks ────────────────────────────────────────────────────────
export const fetchWatchlist = async () => jsonOrThrow(await apiFetch('/api/watchlist'));
export const setWatchlist = async (names) => jsonOrThrow(await apiFetch('/api/watchlist', jsonPost('POST', { names })));
export const checkWatchlistNow = async () => jsonOrThrow(await apiFetch('/api/watchlist/check-now', jsonPost('POST', {})));
export const deleteWatchlist = async (id) => jsonOrThrow(await apiFetch(`/api/watchlist/${id}`, { method: 'DELETE' }));

export const fetchTopAlerts = async () => jsonOrThrow(await apiFetch('/api/alerts/top5'));

export const fetchComposedPosts = async () => jsonOrThrow(await apiFetch('/api/composed-posts'));
export const createComposedPost = async (p) => jsonOrThrow(await apiFetch('/api/composed-posts', jsonPost('POST', p)));
export const decideComposedPost = async (id, status) => jsonOrThrow(await apiFetch(`/api/composed-posts/${id}/status`, jsonPost('PATCH', { status })));

export const fetchProjects = async () => jsonOrThrow(await apiFetch('/api/projects'));
export const createProject = async (p) => jsonOrThrow(await apiFetch('/api/projects', jsonPost('POST', p)));
export const updateProject = async (id, p) => jsonOrThrow(await apiFetch(`/api/projects/${id}`, jsonPost('PATCH', p)));

export const submitSurvey = async (p) => jsonOrThrow(await apiFetch('/api/public-survey', jsonPost('POST', p)));
export const fetchSurveyResults = async () => jsonOrThrow(await apiFetch('/api/public-survey/results'));

export const fetchSuggestions = async () => jsonOrThrow(await apiFetch('/api/leader/suggestions'));
export const approveSuggestion = async (id, assignedTo) => jsonOrThrow(await apiFetch(`/api/leader/suggestions/${id}/approve`, jsonPost('PATCH', { assigned_to: assignedTo })));

export const uploadWhatsApp = async (p) => jsonOrThrow(await apiFetch('/api/whatsapp/upload', jsonPost('POST', p)));
export const fetchWhatsApp = async () => jsonOrThrow(await apiFetch('/api/whatsapp/uploads'));
