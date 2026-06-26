import React from 'react';
import { clsx } from 'clsx';

type Variant = 'default' | 'green' | 'yellow' | 'orange' | 'red' | 'blue' | 'purple' | 'gray';

function getVariant(status: string): Variant {
  const s = status.toLowerCase();
  if (s.includes('approved') || s.includes('paid') || s.includes('completed')) return 'green';
  if (s.includes('pending') || s.includes('under review') || s.includes('in review')) return 'yellow';
  if (s.includes('submitted') || s.includes('open') || s.includes('new')) return 'blue';
  if (s.includes('rejected') || s.includes('denied') || s.includes('void')) return 'red';
  if (s.includes('closed') || s.includes('cancelled')) return 'gray';
  if (s.includes('partial') || s.includes('on hold')) return 'orange';
  if (s.includes('hq') || s.includes('escalat')) return 'purple';
  return 'default';
}

const variants: Record<Variant, string> = {
  default: 'bg-slate-700/50 text-slate-300 border-slate-500/40',
  green: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/60',
  yellow: 'bg-amber-500/10 text-amber-300 border-amber-400/60',
  orange: 'bg-orange-500/10 text-orange-300 border-orange-400/60',
  red: 'bg-red-500/10 text-red-300 border-red-400/60',
  blue: 'bg-blue-500/10 text-blue-300 border-blue-400/60',
  purple: 'bg-purple-500/10 text-purple-300 border-purple-400/60',
  gray: 'bg-slate-700/40 text-slate-400 border-slate-500/30',
};

interface Props {
  label: string;
  variant?: Variant;
  size?: 'sm' | 'md';
  className?: string;
}

export default function Badge({ label, variant, size = 'sm', className }: Props) {
  const v = variant || getVariant(label);
  return (
    <span
      className={clsx(
        'inline-flex items-center border rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        variants[v],
        className,
      )}
    >
      {label}
    </span>
  );
}

export { getVariant };
