import { apiFetch } from './client';
import { DashboardResponse } from '../types';

export async function fetchDashboard(): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>('/api/dashboard');
}
