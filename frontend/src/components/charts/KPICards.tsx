import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, DollarSign, Building, CreditCard, Receipt } from 'lucide-react';
import { SkeletonCard } from '../ui/Skeleton';
import Badge from '../ui/Badge';

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

interface Props {
  data: any;
  loading: boolean;
}

export default function KPICards({ data, loading }: Props) {
  const navigate = useNavigate();
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="card p-4">
          <div className="h-4 w-32 bg-bg-elevated rounded animate-pulse mb-3" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-7 w-24 bg-bg-elevated rounded-full animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const mainKpis = [
    {
      label: 'Total Claims',
      value: data.total?.toLocaleString() ?? '—',
      sub: 'Warranty Repair',
      icon: <FileText size={18} />,
      color: 'text-chart-1',
      bg: 'bg-chart-1/10',
    },
    {
      label: 'Total Claim Amount',
      value: data.totalAmount != null ? formatAmount(data.totalAmount) : '—',
      sub: 'Across all claims',
      icon: <DollarSign size={18} />,
      color: 'text-chart-5',
      bg: 'bg-chart-5/10',
    },
    {
      label: 'HQ Claims',
      value: data.hqClaimsCount?.toLocaleString() ?? '—',
      sub: 'Requiring HQ review',
      icon: <Building size={18} />,
      color: 'text-chart-7',
      bg: 'bg-chart-7/10',
    },
    {
      label: 'Financial Orders',
      value: data.financialOrdersCount?.toLocaleString() ?? '—',
      sub: 'Credit memos issued',
      icon: <CreditCard size={18} />,
      color: 'text-chart-2',
      bg: 'bg-chart-2/10',
    },
    {
      label: 'Billing Documents',
      value: data.billingDocsCount?.toLocaleString() ?? '—',
      sub: 'Invoices received',
      icon: <Receipt size={18} />,
      color: 'text-chart-3',
      bg: 'bg-chart-3/10',
    },
  ];

  const statusBreakdown: { status: string; count: number }[] = data.statusBreakdown ?? [];

  return (
    <div className="space-y-4">
      {/* Main KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {mainKpis.map((kpi) => (
          <div
            key={kpi.label}
            className="card p-4 hover:border-border-emphasis transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.bg} ${kpi.color} shrink-0`}>
                {kpi.icon}
              </div>
            </div>
            <div className={`text-2xl font-bold mb-0.5 ${kpi.color}`}>{kpi.value}</div>
            <div className="text-text-secondary text-xs font-medium truncate">{kpi.label}</div>
            {kpi.sub && (
              <div className="text-text-muted text-xs mt-0.5 truncate">{kpi.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      {statusBreakdown.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Claims by Status
            </span>
            <span className="text-xs text-text-muted">({statusBreakdown.length} statuses)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusBreakdown.map(({ status, count }) => (
              <button
                key={status}
                type="button"
                onClick={() => navigate(`/claims?status=${encodeURIComponent(status)}`)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-elevated border border-border hover:border-accent-blue/50 hover:bg-accent-blue/5 transition-colors cursor-pointer"
              >
                <Badge label={status} />
                <span className="text-xs font-semibold text-text-primary tabular-nums">
                  {count.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
