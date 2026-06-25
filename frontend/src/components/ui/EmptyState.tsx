import React from 'react';
import { FileSearch } from 'lucide-react';

interface Props {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export default function EmptyState({
  title = 'No data found',
  description = 'Try adjusting your filters or run a sync to load data from Salesforce.',
  icon,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-bg-elevated flex items-center justify-center mb-4">
        {icon || <FileSearch size={28} className="text-text-muted" />}
      </div>
      <h3 className="text-text-primary font-semibold text-base mb-1">{title}</h3>
      <p className="text-text-muted text-sm max-w-sm">{description}</p>
    </div>
  );
}
