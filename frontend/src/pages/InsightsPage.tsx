import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
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

      {/* ── Period-scoped zone ───────────────────────────────────────────────
          KPICards / Financial Summary / Claims by Status all respond to the
          Period selector above — they are grouped here to make that clear.    */}
      <section className="rounded-xl border-2 border-accent-blue/50 bg-accent-blue/[0.04] p-5 space-y-5 shadow-[0_0_0_4px_rgba(59,130,246,0.06)]">
        {/* Zone header */}
        <div className="flex items-center gap-2">
          <CalendarDays size={13} className="text-accent-blue shrink-0" />
          <span className="text-[11px] font-bold text-accent-blue uppercase tracking-widest">Period</span>
          <div className="h-[2px] flex-1 bg-accent-blue/30 rounded-full" />
        </div>

        {/* Period selector */}
        <PeriodFilter period={period} onChange={setPeriod} years={YEARS} />

        {/* KPI cards */}
        <KPICards data={overview} loading={loadingOverview} />

        {/* Financial summary */}
        <div>
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">
            Financial Summary
          </h2>
          <FinancialSummaryCards data={financialSummary} loading={loadingFinancial} />
        </div>

        {/* Claims by Status */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
            Claims by Status
          </h2>
          <ByStatusChart data={byStatus || []} loading={loadingStatus} />
        </div>
      </section>

      {/* Monthly Trend — always last 12 months, not period-filtered */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Monthly Claim Trend
          </h2>
          <span className="text-xs text-text-muted">Last 12 months · All claims</span>
        </div>
        <MonthlyTrendChart data={trend || []} loading={loadingTrend} />
      </div>

      {/* Open by Dealer — live open claims, not period-filtered */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Open Claims by Dealer
          </h2>
          <span className="text-xs text-text-muted">Top 20 · Click bar to view in Claims tab</span>
        </div>
        <ByAssigneeChart data={openByDealer || []} loading={loadingOpenByDealer} />
      </div>

      {/* HQ Claims Analysis — all-time, not period-filtered */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            HQ Claims Analysis
          </h2>
          <span className="text-[10px] text-text-muted">All-time · Based on HQ review records</span>
        </div>
        <HQClaimStatsChart data={hqClaimStats} loading={loadingHQ} />
      </div>

      {/* SCA Claims by Month — all-time, grouped by approval date */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            SCA Claims by Month
          </h2>
          <span className="text-[10px] text-text-muted">Grouped by approval date · Authorization starts with "SCA-"</span>
        </div>
        <SCAClaimsChart data={scaByMonth} loading={loadingSCA} />
      </div>
    </div>
  );
}
