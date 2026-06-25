import React from 'react';
import { clsx } from 'clsx';

interface Props {
  className?: string;
  lines?: number;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

export function SkeletonCard({ lines = 3 }: Props) {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      {lines > 2 && <Skeleton className="h-3 w-40" />}
    </div>
  );
}

export function SkeletonTable({ rows = 10, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" style={{ maxWidth: `${80 + (j % 3) * 40}px` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 300 }: { height?: number }) {
  return <div className="skeleton rounded-xl" style={{ height }} />;
}
