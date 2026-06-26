import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  className?: string;
}

export default function SearchableSelect({ value, onChange, options, placeholder, className = '' }: Props) {
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

  const toggle = () => {
    setOpen(o => !o);
    if (!open) setSearch('');
  };

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className={`select text-left flex items-center justify-between gap-1 w-full ${!value ? 'text-text-muted' : 'text-text-primary'}`}
      >
        <span className="truncate flex-1 min-w-0">{value || placeholder}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          {value && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); onChange(''); }}
              className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary"
            >
              <X size={10} />
            </span>
          )}
          <ChevronDown size={11} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 min-w-[180px] bg-bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setOpen(false); setSearch(''); }
                if (e.key === 'Enter' && filtered.length === 1) select(filtered[0]);
              }}
              placeholder="Search…"
              className="w-full bg-bg-elevated border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/60"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => select('')}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-bg-hover ${!value ? 'text-accent-blue-light font-medium' : 'text-text-muted'}`}
            >
              {placeholder}
            </button>
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                title={opt}
                onClick={() => select(opt)}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-bg-hover truncate ${opt === value ? 'text-accent-blue-light bg-accent-blue/5 font-medium' : 'text-text-secondary'}`}
              >
                {opt}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-text-muted">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
