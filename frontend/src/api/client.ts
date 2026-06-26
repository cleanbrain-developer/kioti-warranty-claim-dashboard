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
  getFilterOptions: () => request<{ statuses: string[]; dealers: string[]; assignees: string[] }>('/claims/filter-options'),

  // Analytics
  getOverview: () => request<any>('/analytics/overview'),
  getByStatus: () => request<any[]>('/analytics/by-status'),
  getByDealer: (limit = 15) => request<any[]>(`/analytics/by-dealer?limit=${limit}`),
  getByModel: (limit = 15) => request<any[]>(`/analytics/by-model?limit=${limit}`),
  getMonthlyTrend: (months = 12) => request<any[]>(`/analytics/monthly-trend?months=${months}`),
  getOpenByDealer: (limit = 20) => request<any[]>(`/analytics/open-by-dealer?limit=${limit}`),
  getFinancialSummary: () => request<{ hqReceived: number; hqOutstanding: number; dealerPaid: number; dealerOutstanding: number }>('/analytics/financial-summary'),
  getByAssignee: (limit = 20) => request<any[]>(`/analytics/by-assignee?limit=${limit}`),
  getAging: () => request<any>('/analytics/aging'),

  // Sync
  triggerSync: (password: string, force = false) =>
    request<{ success: boolean; message: string }>('/sync/manual', {
      method: 'POST',
      body: JSON.stringify({ password, force }),
    }),
  getSyncStatus: () => request<any>('/sync/status'),
  getSyncProgress: () => request<any>('/sync/progress'),
  getFieldMappings: () => request<Record<string, string>>('/sync/field-mappings'),
  describeFields: (objectName?: string) =>
    request<{ name: string; label: string; type: string; referenceTo?: string[] }[]>(
      `/sync/describe-fields${objectName ? `?object=${encodeURIComponent(objectName)}` : ''}`,
    ),
  resetFieldMappings: () =>
    request<{ discovered: Record<string, string>; count: number }>('/sync/reset-field-mappings', {
      method: 'POST',
    }),

  // Settings
  getSettings: () => request<any>('/sync/settings'),
  updateSettings: (data: Record<string, string>) =>
    request<any>('/sync/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Visitors
  trackVisit: (sessionId: string, tz?: string) =>
    request<{ success: boolean }>('/visitors/track', {
      method: 'POST',
      body: JSON.stringify({ sessionId, tz }),
    }),
  getTodayVisitors: (tz?: string) =>
    request<{ count: number }>(`/visitors/today${tz ? `?tz=${encodeURIComponent(tz)}` : ''}`),
};
