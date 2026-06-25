import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import KPICards from '../components/charts/KPICards';
import ByStatusChart from '../components/charts/ByStatusChart';
import ByDealerChart from '../components/charts/ByDealerChart';
import ByModelChart from '../components/charts/ByModelChart';
import MonthlyTrendChart from '../components/charts/MonthlyTrendChart';
import ByAssigneeChart from '../components/charts/ByAssigneeChart';

export default function InsightsPage() {
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: api.getOverview,
  });
  const { data: byStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ['analytics', 'byStatus'],
    queryFn: api.getByStatus,
  });
  const { data: byDealer, isLoading: loadingDealer } = useQuery({
    queryKey: ['analytics', 'byDealer'],
    queryFn: () => api.getByDealer(15),
  });
  const { data: byModel, isLoading: loadingModel } = useQuery({
    queryKey: ['analytics', 'byModel'],
    queryFn: () => api.getByModel(12),
  });
  const { data: trend, isLoading: loadingTrend } = useQuery({
    queryKey: ['analytics', 'trend'],
    queryFn: () => api.getMonthlyTrend(12),
  });
  const { data: byAssignee, isLoading: loadingAssignee } = useQuery({
    queryKey: ['analytics', 'byAssignee'],
    queryFn: () => api.getByAssignee(20),
  });

  return (
    <div className="space-y-6 animate-slide-up">
      {/* KPI row */}
      <KPICards data={overview} loading={loadingOverview} />

      {/* Status + Dealer row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
            Claims by Status
          </h2>
          <ByStatusChart data={byStatus || []} loading={loadingStatus} />
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
            Open Claims by Dealer
          </h2>
          <div className="overflow-y-auto max-h-[340px] pr-1">
            <ByDealerChart data={byDealer || []} loading={loadingDealer} />
          </div>
        </div>
      </div>

      {/* Trend + Model row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
            Monthly Claim Trend (Last 12 Months)
          </h2>
          <MonthlyTrendChart data={trend || []} loading={loadingTrend} />
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
            Claims by Model
          </h2>
          <ByModelChart data={byModel || []} loading={loadingModel} />
        </div>
      </div>

      {/* Assignee row */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Open Claims by Assignee
          </h2>
          <span className="text-xs text-text-muted">
            Top 20 · Click bar to view in Claims tab
          </span>
        </div>
        <ByAssigneeChart data={byAssignee || []} loading={loadingAssignee} />
      </div>
    </div>
  );
}
