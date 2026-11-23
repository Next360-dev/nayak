export type Role = 'admin' | 'mla' | 'minister' | 'staff';

export interface User {
  username: string;
  role: Role;
  scoped: boolean;
  constituency_name?: string | null;
  politician_name?: string | null;
  district_name?: string | null;
  leader_title?: string | null;
  leader_party?: string | null;
  can_share?: boolean;
  must_change_password?: boolean;
}

export interface LoginResponse {
  status: string;
  token?: string;
  refresh_token?: string;
  user?: User;
  message?: string;
}

export interface MeResponse {
  user: User;
}

export interface Article {
  id: number;
  headline: string;
  summary?: string | null;
  source?: string | null;
  url?: string | null;
  published_at?: string | null;
  priority?: string | null;
  priority_score?: number | null;
  news_scope?: string | null;
  constituency_name?: string | null;
  district_name?: string | null;
  image_url?: string | null;
  source_type?: string | null;
  newspaper_name?: string | null;
  source_name?: string | null;
  source_count?: number | null;
  sources?: any[];
  date_time?: string | null;
  full_description?: string | null;
  sentiment?: string | null;
  is_statewide?: boolean | null;
  is_district_update?: boolean | null;
  is_civic?: boolean | null;
  is_mla_news?: boolean | null;
  news_type?: string | null;
  detected_leaders?: string[];
  civic_constituencies?: string[];
  politician_name?: string | null;
  solver_official?: string | null;
  department?: string | null;
  category?: string | null;
}

export interface NewsResponse {
  status?: string;
  articles: Article[];
  social_posts?: any[];
  social_stats?: { total_posts?: number; positive_posts?: number; negative_posts?: number } | null;
  scope_counts?: Record<string, number> | null;
  pagination?: { page: number; limit: number; total: number; pages?: number; total_records?: number; total_pages?: number; has_next?: boolean; has_prev?: boolean; offset?: number };
  counts?: Record<string, number>;
  period?: string;
}

export interface Share {
  id: number;
  sender: string;
  title: string;
  url: string;
  summary?: string | null;
  note?: string | null;
  priority?: string | null;
  status: string;
  created_at: string;
  reply_count?: number;
}

export interface ShareDetail extends Share {
  article_id?: number | null;
  district_name?: string | null;
  constituency_name?: string | null;
}

export interface ShareReply {
  id: number;
  share_id: number;
  sender: string;
  recipient?: string | null;
  body: string;
  created_at: string;
}

export interface SharesInboxResponse {
  shares: Share[];
}

export interface SentShare {
  id: number;
  sender: string;
  title: string;
  url: string;
  summary?: string | null;
  note?: string | null;
  priority?: string | null;
  created_at: string;
  recipients: { recipient: string; status: string }[];
}

export interface SentSharesResponse {
  shares: SentShare[];
}

export interface ShareTargetsResponse {
  targets: { username: string; role: Role; name?: string | null }[];
}

export interface UnreadCountResponse {
  count: number;
}

export interface TranslateResponse {
  data: { translated_headline: string; translated_summary: string };
}

// ── dashboard (GET /api/dashboard, shape depends on the role) ────────────────
export interface DashboardStory {
  id: number;
  headline: string;
  summary?: string | null;
  url?: string | null;
  district_name?: string | null;
  constituency_name?: string | null;
  priority_score?: number | null;
  sentiment?: string | null;
  date_time?: string | null;
  source?: string | null;
}

export interface DashboardNews {
  today?: number;
  urgent?: number;
  negative?: number;
  attention?: DashboardStory[];
  districts?: { district: string; total: number; urgent: number; negative: number }[];
  error?: string;
}

export interface ShareStatusCounts {
  new: number;
  seen: number;
  acting: number;
  done: number;
}

export interface DashboardShareRow {
  id: number;
  title: string;
  sender?: string;
  priority?: string | null;
  status?: string;
  created_at: string;
  note?: string | null;
  url?: string | null;
  recipients?: { recipient: string; status: string }[];
}

export interface DashboardShares {
  /** Last 7 days, counted from real share rows. */
  week?: { received: number; handled: number; sent: number; sent_done: number };
  /** Admin dashboard: flat status counts across every share. */
  new?: number;
  seen?: number;
  acting?: number;
  done?: number;
  /** Leader and staff dashboards: separate inbox and sent blocks. */
  inbox?: ShareStatusCounts & { recent?: DashboardShareRow[] };
  sent?: ShareStatusCounts & { waiting?: number; recent?: DashboardShareRow[] };
  total?: number;
  resolved_pct?: number | null;
}

export interface DashboardAttention {
  level: 'bad' | 'warn' | 'info' | string;
  code: string;
  text: string;
  params?: Record<string, unknown>;
  action?: string;
}

export interface DashboardSystem {
  database?: string;
  articles_last_24h?: number | null;
  latest_article_at?: string | null;
  news_is_stale?: boolean;
  scraper?: {
    is_running?: boolean | null;
    stage?: string | null;
    last_run_end?: string | null;
    last_status?: string | null;
    last_inserted?: number | null;
    next_run?: string | null;
    runs_completed?: number | null;
  } | null;
}

export interface LeaderOverview {
  username: string;
  role: Role;
  politician_name?: string | null;
  constituency_name?: string | null;
  district_name?: string | null;
  last_login?: string | null;
  staff_count?: number;
  shares?: ShareStatusCounts;
  oldest_unseen_share?: string | null;
  leader_title?: string | null;
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  target?: string | null;
  detail?: string | null;
}

export interface BoardSummary {
  todo: number;
  doing: number;
  done: number;
  mine: number;
  overdue: number;
}

export interface DashboardResponse {
  status: string;
  kind: Role;
  scope: { statewide: boolean; label: string };
  title?: string | null;
  system?: DashboardSystem;
  attention?: DashboardAttention[];
  users?: { by_role: Record<string, number>; never_logged_in: number; disabled: number };
  shares?: DashboardShares;
  leaders?: LeaderOverview[];
  audit?: AuditEntry[];
  activity?: DashboardShareRow[];
  news?: DashboardNews;
  team?: { username: string; last_login?: string | null; is_active?: boolean }[];
  board?: BoardSummary | null;
  leader?: { username: string; role: Role; title?: string | null; name: string } | null;
  approvals?: { pending: number };
}

export interface ApiError extends Error {
  status: number;
  body?: unknown;
}

// ── work items (letters & petitions) ────────────────────────────────────────
export type WorkItemKind = 'letter' | 'petition';
export type WorkItemDirection = 'incoming' | 'outgoing';
export type WorkItemPriority = 'normal' | 'urgent';
export type WorkItemStatus =
  | 'draft'
  | 'submitted'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'closed';

export interface WorkItem {
  id: number;
  team_leader: string;
  kind: WorkItemKind;
  direction: WorkItemDirection;
  title: string;
  body?: string | null;
  reference_no?: string | null;
  counterpart?: string | null;
  priority: WorkItemPriority;
  due_date?: string | null;
  status: WorkItemStatus;
  created_by: string;
  assignee?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  decision_note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  creator_name?: string | null;
  assignee_name?: string | null;
  leader_name?: string | null;
}

export interface WorkItemEvent {
  id: number;
  item_id: number;
  actor: string;
  action: string;
  note?: string | null;
  created_at: string;
}

export interface WorkItemCan {
  edit: boolean;
  submit: boolean;
  decide: boolean;
  close: boolean;
  comment: boolean;
}

export interface WorkItemListResponse {
  items: WorkItem[];
  total: number;
}

export interface WorkItemDetailResponse {
  item: WorkItem;
  events: WorkItemEvent[];
  can: WorkItemCan;
}

export interface WorkItemCommentResponse {
  event: WorkItemEvent;
}

export interface WorkItemPendingCountResponse {
  count: number;
}