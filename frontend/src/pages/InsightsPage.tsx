import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import KPICards from '../components/charts/KPICards';
import ByStatusChart from '../components/charts/ByStatusChart';
import MonthlyTrendChart from '../components/charts/MonthlyTrendChart';
import ByAssigneeChart from '../components/charts/ByAssigneeChart';
import FinancialSummaryCards from '../components/charts/FinancialSummaryCards';
import HQClaimStatsChart from '../components/charts/HQClaimStatsChart';
import SCAClaimsChart from '../components/charts/SCAClaimsChart';

// ── Period filter ──────────────────────────────────────────
type PeriodType = 'all' | 'monthly' | 'quarterly' | 'yearly';
interface Period { type: PeriodType; year: number; month: number; quarter: number; }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function toDateRange(p: Period): { dateFrom?: string; dateTo?: string } {
  if (p.type === 'all') return {};
  const y = p.year;
  if (p.type === 'yearly') return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
  if (p.type === 'quarterly') {
    const sm = (p.quarter - 1) * 3 + 1;
    const em = sm + 2;
    const lastDay = new Date(y, em, 0).getDate();
    return {
      dateFrom: `${y}-${String(sm).padStart(2, '0')}-01`,
      dateTo: `${y}-${String(em).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  const lastDay = new Date(y, p.month, 0).getDate();
  return {
    dateFrom: `${y}-${String(p.month).padStart(2, '0')}-01`,
    dateTo: `${y}-${String(p.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

const PERIOD_TYPES: { value: PeriodType; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

function PeriodFilter({ period, onChange, years }: { period: Period; onChange: (p: Period) => void; years: number[] }) {
  return (
    <div className="card px-4 py-3 flex items-center gap-3 flex-wrap">
      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide shrink-0">Period</span>
      <div className="flex items-center gap-0.5 bg-bg-elevated rounded-lg p-0.5 border border-border">
        {PERIOD_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onChange({ ...period, type: value })}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              period.type === value
                ? 'bg-bg-card text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {period.type !== 'all' && (
        <div className="flex items-center gap-2">
          <select
            value={period.year}
            onChange={e => onChange({ ...period, year: +e.target.value })}
            className="select text-xs py-1.5"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {period.type === 'quarterly' && (
            <select
              value={period.quarter}
              onChange={e => onChange({ ...period, quarter: +e.target.value })}
              className="select text-xs py-1.5"
            >
              {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
            </select>
          )}

          {period.type === 'monthly' && (
            <select
              value={period.month}
              onChange={e => onChange({ ...period, month: +e.target.value })}
              className="select text-xs py-1.5"
            >
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          )}
        </div>
      )}

      {period.type !== 'all' && (
        <span className="text-xs text-text-muted ml-1">
          {period.type === 'monthly' && `${MONTHS[period.month - 1]} ${period.year}`}
          {period.type === 'quarterly' && `Q${period.quarter} ${period.year}`}
          {period.type === 'yearly' && `${period.year}`}
        </span>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────
export default function InsightsPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const YEARS = React.useMemo(() => {
    const y = new Date().getFullYear();
    // Start from 2015 to ensure all historical records are queryable
    return Array.from({ length: y - 2015 + 1 }, (_, i) => y - i);
  }, []);

  const [period, setPeriod] = useState<Period>({
    type: 'all',
    year: currentYear,
    month: now.getMonth() + 1,
    quarter: Math.ceil((now.getMonth() + 1) / 3),
  });

  const dateRange = toDateRange(period);

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['analytics', 'overview', dateRange],
    queryFn: () => api.getOverview(dateRange),
  });
  const { data: byStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ['analytics', 'byStatus', dateRange],
    queryFn: () => api.getByStatus(dateRange),
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
    queryKey: ['analytics', 'financialSummary', dateRange],
    queryFn: () => api.getFinancialSummary(dateRange),
  });
  const { data: hqClaimStats, isLoading: loadingHQ } = useQuery({
    queryKey: ['analytics', 'hqClaimStats'],
    queryFn: api.getHQClaimStats,
  });
  const { data: scaByMonth, isLoading: loadingSCA } = useQuery({
    queryKey: ['analytics', 'scaByMonth'],
    queryFn: api.getSCAClaimsByMonth,
  });

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Period filter */}
      <PeriodFilter period={period} onChange={setPeriod} years={YEARS} />

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

      {/* HQ Claims Analysis */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            HQ Claims Analysis
          </h2>
          <span className="text-[10px] text-text-muted">All-time · Based on HQ review records</span>
        </div>
        <HQClaimStatsChart data={hqClaimStats} loading={loadingHQ} />
      </div>

      {/* SCA Claims by Month */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            SCA Claims by Month
          </h2>
          <span className="text-[10px] text-text-muted">Outside warranty parameters · Authorization field starts with "SCA-"</span>
        </div>
        <SCAClaimsChart data={scaByMonth} loading={loadingSCA} />
      </div>
    </div>
  );
}
