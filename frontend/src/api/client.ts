const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Claims
  getClaims: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
    }
    return request<any>(`/claims?${qs}`);
  },
  getClaim: (id: string) => request<any>(`/claims/${id}`),
  getFilterOptions: () => request<{ statuses: string[]; dealers: string[]; models: string[] }>('/claims/filter-options'),

  // Analytics
  getOverview: () => request<any>('/analytics/overview'),
  getByStatus: () => request<any[]>('/analytics/by-status'),
  getByDealer: (limit = 15) => request<any[]>(`/analytics/by-dealer?limit=${limit}`),
  getByModel: (limit = 15) => request<any[]>(`/analytics/by-model?limit=${limit}`),
  getMonthlyTrend: (months = 12) => request<any[]>(`/analytics/monthly-trend?months=${months}`),
  getByAssignee: (limit = 20) => request<any[]>(`/analytics/by-assignee?limit=${limit}`),
  getAging: () => request<any>('/analytics/aging'),

  // Sync
  triggerSync: (password: string) =>
    request<{ success: boolean; message: string }>('/sync/manual', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  getSyncStatus: () => request<any>('/sync/status'),

  // Visitors
  trackVisit: (sessionId: string) =>
    request<{ success: boolean }>('/visitors/track', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }),
  getTodayVisitors: () => request<{ count: number }>('/visitors/today'),
};
