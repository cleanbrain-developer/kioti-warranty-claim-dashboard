import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { SkeletonCard } from '../ui/Skeleton';

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

interface Props {
  data: { hqReceived: number; hqOutstanding: number; dealerPaid: number; dealerOutstanding: number } | undefined;
  loading: boolean;
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
      icon: <TrendingUp size={18} />,
      color: 'text-accent-green-light',
      bg: 'bg-accent-green/10',
      border: 'border-accent-green/20',
      type: 'positive' as const,
    },
    {
      label: 'Outstanding from HQ',
      sublabel: 'HQ I/F errors · Rejections',
      value: formatAmount(data.hqOutstanding),
      icon: <AlertCircle size={18} />,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      border: 'border-yellow-400/20',
      type: 'warning' as const,
    },
    {
      label: 'Paid to Dealers',
      sublabel: 'ERP credit memos sent (S)',
      value: formatAmount(data.dealerPaid),
      icon: <CheckCircle size={18} />,
      color: 'text-chart-2',
      bg: 'bg-chart-2/10',
      border: 'border-chart-2/20',
      type: 'positive' as const,
    },
    {
      label: 'Outstanding to Dealers',
      sublabel: 'ERP transmission errors (E)',
      value: formatAmount(data.dealerOutstanding),
      icon: <XCircle size={18} />,
      color: 'text-accent-red-light',
      bg: 'bg-accent-red/10',
      border: 'border-accent-red/20',
      type: 'negative' as const,
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
          </div>
          <div className={`text-2xl font-bold mb-0.5 ${card.color}`}>{card.value}</div>
          <div className="text-text-secondary text-xs font-medium truncate">{card.label}</div>
          <div className="text-text-muted text-xs mt-0.5 truncate">{card.sublabel}</div>
        </div>
      ))}
    </div>
  );
}
