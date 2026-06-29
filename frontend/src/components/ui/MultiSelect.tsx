import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

interface Props {
  values: string[];
  onChange: (vals: string[]) => void;
  options: string[];
  placeholder: string;
  className?: string;
}

export default function MultiSelect({ values, onChange, options, placeholder, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggleValue = (v: string) => {
    if (values.includes(v)) {
      onChange(values.filter(x => x !== v));
    } else {
      onChange([...values, v]);
    }
  };

  const displayLabel =
    values.length === 0
      ? placeholder
      : values.length === 1
      ? values[0]
      : `${values.length} statuses`;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (!open) setSearch(''); }}
        className={`select text-left flex items-center justify-between gap-1 w-full ${values.length === 0 ? 'text-text-muted' : 'text-text-primary'}`}
      >
        <span className="truncate flex-1 min-w-0">{displayLabel}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          {values.length > 0 && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); onChange([]); }}
              className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary"
            >
              <X size={10} />
            </span>
          )}
          <ChevronDown size={11} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 min-w-[220px] bg-bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setSearch(''); } }}
              placeholder="Search statuses…"
              className="w-full bg-bg-elevated border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/60"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {values.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full text-left px-3 py-1.5 text-xs text-text-muted hover:text-accent-red-light hover:bg-bg-hover transition-colors border-b border-border"
              >
                Clear all ({values.length} selected)
              </button>
            )}
            {filtered.map(opt => {
              const selected = values.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  title={opt}
                  onClick={() => toggleValue(opt)}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-bg-hover flex items-center gap-2 ${selected ? 'text-accent-blue-light bg-accent-blue/5' : 'text-text-secondary'}`}
                >
                  <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${selected ? 'bg-accent-blue border-accent-blue' : 'border-border-emphasis'}`}>
                    {selected && <Check size={9} strokeWidth={3} className="text-white" />}
                  </span>
                  <span className="truncate">{opt}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-text-muted">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
