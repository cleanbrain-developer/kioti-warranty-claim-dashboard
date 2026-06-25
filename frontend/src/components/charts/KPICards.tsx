import React from 'react';
import { FileText, Clock, CheckCircle, XCircle, DollarSign, Building, CreditCard, Receipt } from 'lucide-react';
import { SkeletonCard } from '../ui/Skeleton';

interface KPI {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

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
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!data) return null;

  const kpis: KPI[] = [
    {
      label: 'Total Claims',
      value: data.total?.toLocaleString() ?? '—',
      sub: 'Warranty Repair',
      icon: <FileText size={18} />,
      color: 'text-chart-1',
      bg: 'bg-chart-1/10',
    },
    {
      label: 'Pending',
      value: data.pending?.toLocaleString() ?? '—',
      sub: `${data.total ? Math.round((data.pending / data.total) * 100) : 0}% of total`,
      icon: <Clock size={18} />,
      color: 'text-accent-orange-light',
      bg: 'bg-accent-orange/10',
    },
    {
      label: 'Approved',
      value: data.approved?.toLocaleString() ?? '—',
      sub: `${data.total ? Math.round((data.approved / data.total) * 100) : 0}% of total`,
      icon: <CheckCircle size={18} />,
      color: 'text-accent-green-light',
      bg: 'bg-accent-green/10',
    },
    {
      label: 'Rejected',
      value: data.rejected?.toLocaleString() ?? '—',
      sub: `${data.total ? Math.round((data.rejected / data.total) * 100) : 0}% of total`,
      icon: <XCircle size={18} />,
      color: 'text-accent-red-light',
      bg: 'bg-accent-red/10',
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="card p-4 xl:col-span-1 hover:border-border-emphasis transition-colors xl:min-w-0"
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
  );
}
