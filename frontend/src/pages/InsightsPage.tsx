import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import KPICards from '../components/charts/KPICards';
import ByStatusChart from '../components/charts/ByStatusChart';
import MonthlyTrendChart from '../components/charts/MonthlyTrendChart';
import ByAssigneeChart from '../components/charts/ByAssigneeChart';
import FinancialSummaryCards from '../components/charts/FinancialSummaryCards';

export default function InsightsPage() {
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: api.getOverview,
  });
  const { data: byStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ['analytics', 'byStatus'],
    queryFn: api.getByStatus,
  });
  const { data: trend, isLoading: loadingTrend } = useQuery({
    queryKey: ['analytics', 'trend'],
    queryFn: () => api.getMonthlyTrend(12),
  });
  const { data: openByDealer, isLoading: loadingOpenByDealer } = useQuery({
    queryKey: ['analytics', 'openByDealer'],
    queryFn: () => api.getOpenByDealer(20),
  });
  const { data: financialSummary, isLoading: loadingFinancial } = useQuery({
    queryKey: ['analytics', 'financialSummary'],
    queryFn: api.getFinancialSummary,
  });

  return (
    <div className="space-y-6 animate-slide-up">
      {/* KPI row */}
      <KPICards data={overview} loading={loadingOverview} />

      {/* Financial summary row */}
      <div>
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Financial Summary
        </h2>
        <FinancialSummaryCards data={financialSummary} loading={loadingFinancial} />
      </div>

      {/* Status + Trend row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
            Claims by Status
          </h2>
          <ByStatusChart data={byStatus || []} loading={loadingStatus} />
        </div>

        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
            Monthly Claim Trend (Last 12 Months)
          </h2>
          <MonthlyTrendChart data={trend || []} loading={loadingTrend} />
        </div>
      </div>

      {/* Open by Dealer row */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Open Claims by Dealer
          </h2>
          <span className="text-xs text-text-muted">
            Top 20 · Click bar to view in Claims tab
          </span>
        </div>
        <ByAssigneeChart data={openByDealer || []} loading={loadingOpenByDealer} />
      </div>
    </div>
  );
}
