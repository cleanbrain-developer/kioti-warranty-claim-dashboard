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
  default: 'bg-bg-elevated text-text-secondary border-border',
  green: 'bg-accent-green/15 text-accent-green-light border-accent-green/30',
  yellow: 'bg-accent-orange/15 text-accent-orange-light border-accent-orange/30',
  orange: 'bg-orange-900/30 text-orange-400 border-orange-700/30',
  red: 'bg-accent-red/15 text-accent-red-light border-accent-red/30',
  blue: 'bg-accent-blue/15 text-accent-blue-light border-accent-blue/30',
  purple: 'bg-accent-purple/15 text-accent-purple-light border-accent-purple/30',
  gray: 'bg-bg-elevated text-text-muted border-border',
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
