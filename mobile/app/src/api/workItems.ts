import { apiFetch } from './client';
import {
  WorkItem,
  WorkItemKind,
  WorkItemDirection,
  WorkItemPriority,
  WorkItemStatus,
  WorkItemDetailResponse,
  WorkItemListResponse,
  WorkItemCommentResponse,
  WorkItemPendingCountResponse,
} from '../types';

export interface CreateWorkItemPayload {
  kind: WorkItemKind;
  direction: WorkItemDirection;
  title: string;
  body?: string | null;
  reference_no?: string | null;
  counterpart?: string | null;
  priority?: WorkItemPriority;
  due_date?: string | null;
  assignee?: string | null;
}

export type WorkItemDecision = 'approve' | 'reject' | 'changes';

export interface ListWorkItemsParams {
  status?: WorkItemStatus;
  kind?: WorkItemKind;
  mine?: boolean;
  limit?: number;
  offset?: number;
}

export async function createWorkItem(payload: CreateWorkItemPayload): Promise<{ status?: string; item: WorkItem }> {
  return apiFetch<{ status?: string; item: WorkItem }>('/api/work-items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchWorkItems(params: ListWorkItemsParams = {}): Promise<WorkItemListResponse> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.kind) q.set('kind', params.kind);
  if (params.mine) q.set('mine', '1');
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const qs = q.toString();
  return apiFetch<WorkItemListResponse>(`/api/work-items${qs ? `?${qs}` : ''}`);
}

export async function fetchWorkItem(id: number): Promise<WorkItemDetailResponse> {
  return apiFetch<WorkItemDetailResponse>(`/api/work-items/${id}`);
}

export async function updateWorkItem(
  id: number,
  payload: Partial<CreateWorkItemPayload>,
): Promise<{ status?: string; item: WorkItem }> {
  return apiFetch<{ status?: string; item: WorkItem }>(`/api/work-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function submitWorkItem(id: number, note?: string): Promise<{ status?: string; item: WorkItem }> {
  return apiFetch<{ status?: string; item: WorkItem }>(`/api/work-items/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(note ? { note } : {}),
  });
}

export async function decideWorkItem(
  id: number,
  decision: WorkItemDecision,
  note?: string,
): Promise<{ status?: string; item: WorkItem }> {
  return apiFetch<{ status?: string; item: WorkItem }>(`/api/work-items/${id}/decide`, {
    method: 'POST',
    body: JSON.stringify({ decision, ...(note ? { note } : {}) }),
  });
}

export async function commentWorkItem(id: number, body: string): Promise<WorkItemCommentResponse> {
  return apiFetch<WorkItemCommentResponse>(`/api/work-items/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function closeWorkItem(id: number, note?: string): Promise<{ status?: string; item: WorkItem }> {
  return apiFetch<{ status?: string; item: WorkItem }>(`/api/work-items/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(note ? { note } : {}),
  });
}

export async function fetchPendingCount(): Promise<number> {
  const data = await apiFetch<WorkItemPendingCountResponse>('/api/work-items/pending-count');
  return data.count ?? 0;
}