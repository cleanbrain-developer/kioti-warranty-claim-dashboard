import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { SkeletonCard } from '../ui/Skeleton';

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

interface CurrencyRow { currency: string; total: number }

interface FinancialData {
  hqReceived: number; hqReceivedByCurrency: CurrencyRow[];
  hqOutstanding: number; hqOutstandingByCurrency: CurrencyRow[];
  dealerPaid: number; dealerPaidByCurrency: CurrencyRow[];
  dealerOutstanding: number; dealerOutstandingByCurrency: CurrencyRow[];
}

interface Props {
  data: FinancialData | undefined;
  loading: boolean;
}

function CurrencyBreakdown({ rows }: { rows: CurrencyRow[] }) {
  if (!rows || rows.length <= 1) return null;
  return (
    <div className="mt-2 space-y-0.5">
      {rows.map(r => (
        <div key={r.currency} className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted font-mono">{r.currency}</span>
          <span className="text-[10px] text-text-secondary tabular-nums">{formatAmount(r.total)}</span>
        </div>
      ))}
    </div>
  );
}

export default function FinancialSummaryCards({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      label: 'Received from HQ',
      sublabel: 'Billing documents settled',
      value: formatAmount(data.hqReceived),
      breakdown: data.hqReceivedByCurrency,
      icon: <TrendingUp size={18} />,
      color: 'text-accent-green-light',
      bg: 'bg-accent-green/10',
      border: 'border-accent-green/20',
    },
    {
      label: 'Outstanding from HQ',
      sublabel: 'HQ I/F errors · Rejections',
      value: formatAmount(data.hqOutstanding),
      breakdown: data.hqOutstandingByCurrency,
      icon: <AlertCircle size={18} />,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      border: 'border-yellow-400/20',
    },
    {
      label: 'Paid to Dealers',
      sublabel: 'ERP credit memos sent (S)',
      value: formatAmount(data.dealerPaid),
      breakdown: data.dealerPaidByCurrency,
      icon: <CheckCircle size={18} />,
      color: 'text-chart-2',
      bg: 'bg-chart-2/10',
      border: 'border-chart-2/20',
    },
    {
      label: 'Outstanding to Dealers',
      sublabel: 'ERP transmission errors (E)',
      value: formatAmount(data.dealerOutstanding),
      breakdown: data.dealerOutstandingByCurrency,
      icon: <XCircle size={18} />,
      color: 'text-accent-red-light',
      bg: 'bg-accent-red/10',
      border: 'border-accent-red/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <div
          key={card.label}
          className={`card p-4 border ${card.border} hover:border-opacity-60 transition-colors`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.bg} ${card.color} shrink-0`}>
              {card.icon}
            </div>
            {card.breakdown && card.breakdown.length > 1 && (
              <div className="flex gap-1">
                {card.breakdown.map(r => (
                  <span key={r.currency} className="text-[9px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted font-mono">
                    {r.currency}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className={`text-2xl font-bold mb-0.5 ${card.color}`}>{card.value}</div>
          <div className="text-text-secondary text-xs font-medium truncate">{card.label}</div>
          <div className="text-text-muted text-xs mt-0.5 truncate">{card.sublabel}</div>
          <CurrencyBreakdown rows={card.breakdown} />
        </div>
      ))}
    </div>
  );
}
