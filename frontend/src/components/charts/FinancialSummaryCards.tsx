import React from 'react';
import { TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { SkeletonCard } from '../ui/Skeleton';

function formatAmount(n: number, currency = 'USD'): string {
  const sym = currency === 'CAD' ? 'CA$' : '$';
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${sym}${(n / 1_000).toFixed(1)}K`;
  return `${sym}${n.toFixed(0)}`;
}

interface CurrencyRow { currency: string; total: number }

interface FinancialData {
  hqClaimed: CurrencyRow[];
  dealerPaid: CurrencyRow[];
  dealerOutstanding: CurrencyRow[];
}

interface Props {
  data: FinancialData | undefined;
  loading: boolean;
}

function CurrencyList({ rows, valueColor }: { rows: CurrencyRow[]; valueColor: string }) {
  if (!rows || rows.length === 0) {
    return <div className="text-text-muted text-xs mt-1">No data</div>;
  }
  return (
    <div className="mt-2 space-y-1">
      {rows.map(r => (
        <div key={r.currency} className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-text-muted font-mono bg-bg-elevated px-1.5 py-0.5 rounded shrink-0">
            {r.currency}
          </span>
          <span className={`text-sm font-semibold tabular-nums ${valueColor}`}>
            {formatAmount(r.total, r.currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function FinancialSummaryCards({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      label: 'Claimed to HQ',
      sublabel: 'Total amount claimed from HQ Korea',
      rows: data.hqClaimed,
      icon: <TrendingUp size={18} />,
      color: 'text-accent-green-light',
      bg: 'bg-accent-green/10',
      border: 'border-accent-green/20',
    },
    {
      label: 'Paid to Dealers',
      sublabel: 'Billing documents settled (credit memos)',
      rows: data.dealerPaid,
      icon: <CheckCircle size={18} />,
      color: 'text-chart-2',
      bg: 'bg-chart-2/10',
      border: 'border-chart-2/20',
    },
    {
      label: 'Outstanding to Dealers',
      sublabel: 'Financial orders pending settlement',
      rows: data.dealerOutstanding,
      icon: <Clock size={18} />,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
      border: 'border-amber-400/20',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(card => (
          <div
            key={card.label}
            className={`card p-4 border ${card.border} hover:border-opacity-60 transition-colors`}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.bg} ${card.color} shrink-0`}>
                {card.icon}
              </div>
              <div className="min-w-0">
                <div className="text-text-primary text-sm font-semibold truncate">{card.label}</div>
                <div className="text-text-muted text-[10px] truncate">{card.sublabel}</div>
              </div>
            </div>
            <CurrencyList rows={card.rows} valueColor={card.color} />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-text-muted text-right">
        Amounts shown in original currency (USD / CA$) — not converted
      </p>
    </div>
  );
}
