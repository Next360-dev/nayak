export function getApiBase() {
  if (typeof window !== 'undefined') {
    if (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '8000' && window.location.port !== '8080' && window.location.port !== '5173')) {
      return 'http://localhost:8000';
    }
  }
  return '';
}

export async function fetchHierarchy() {
  const apiTarget = getApiBase();
  const res = await fetch(`${apiTarget}/api/hierarchy`);
  return await res.json();
}

export async function fetchPoliticians() {
  const apiTarget = getApiBase();
  const res = await fetch(`${apiTarget}/api/politicians`);
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
    throw new Error(`Login failed with status ${res.status}`);
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

  const headers = {};
  if (currentUser) {
    headers['X-User-Role'] = currentUser.role;
    headers['X-User-Constituency'] = currentUser.constituency_name;
    headers['X-User-Politician'] = currentUser.politician_name;
    headers['X-User-District'] = currentUser.district_name;
  }

  const apiTarget = getApiBase();
  const res = await fetch(`${apiTarget}/api/news?${params.toString()}`, { headers });
  return await res.json();
}

export async function fetchUrgentAlerts({ period, activeConst }) {
  const apiTarget = getApiBase();
  let selectedAlerts = [];

  if (activeConst) {
    try {
      const cRes = await fetch(`${apiTarget}/api/news?period=${period || 'today'}&constituency=${encodeURIComponent(activeConst)}&limit=30`);
      const cData = await cRes.json();
      if (cRes.ok && cData.status === 'success' && Array.isArray(cData.articles)) {
        const sorted = [...cData.articles].sort((a, b) => {
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

  if (selectedAlerts.length === 0) {
    try {
      const res = await fetch(`${apiTarget}/api/news?period=${period || 'today'}&priority=1&limit=50`);
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
  const res = await fetch(`${apiTarget}/api/representatives?${params.toString()}`);
  return await res.json();
}

export async function translateArticle(headline, summary) {
  const apiTarget = getApiBase();
  const res = await fetch(`${apiTarget}/api/translate`, {
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

  const res = await fetch(`${apiTarget}/api/social_media?${params.toString()}`);
  return await res.json();
}

export async function triggerSocialMediaScrape(constituency, mlaName) {
  const apiTarget = getApiBase();
  const params = new URLSearchParams();
  params.append('constituency', constituency);
  if (mlaName) params.append('mla_name', mlaName);

  const res = await fetch(`${apiTarget}/api/social_media/scrape?${params.toString()}`, {
    method: 'POST'
  });
  return await res.json();
}
