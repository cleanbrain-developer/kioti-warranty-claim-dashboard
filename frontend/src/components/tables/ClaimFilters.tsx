import React, { useState } from 'react';
import { Search, SlidersHorizontal, X, List, AlignJustify, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface FilterValues {
  search: string;
  status: string;
  dealer: string;
  model: string;
  assignee: string;
  dateFrom: string;
  dateTo: string;
  hasHQProduct: string;
  limit: number;
}

interface Props {
  filters: FilterValues;
  options: { statuses: string[]; dealers: string[]; models: string[]; assignees: string[] };
  onChange: (f: Partial<FilterValues>) => void;
  onApply: () => void;
  onClear: () => void;
  totalCount: number;
}

export default function ClaimFilters({ filters, options, onChange, onApply, onClear, totalCount }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { scrollMode, setScrollMode } = useStore();

  const hasActiveFilters = !!(
    filters.search || filters.status || filters.dealer ||
    filters.model || filters.assignee || filters.dateFrom || filters.dateTo || filters.hasHQProduct
  );

  return (
    <div className="card">
      {/* Filter header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">Filters</span>
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <span className="text-xs text-text-muted">
              <span className="text-text-secondary font-medium">{totalCount.toLocaleString()}</span> records
            </span>
          )}
          {/* Scroll mode toggle */}
          <div className="flex items-center bg-bg-elevated rounded-lg border border-border p-0.5 gap-0.5" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setScrollMode('pagination')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                scrollMode === 'pagination'
                  ? 'bg-bg-card text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              title="Pagination mode"
            >
              <List size={11} />
              <span className="hidden sm:inline">Pages</span>
            </button>
            <button
              onClick={() => setScrollMode('infinite')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                scrollMode === 'infinite'
                  ? 'bg-bg-card text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              title="Infinite scroll mode"
            >
              <AlignJustify size={11} />
              <span className="hidden sm:inline">Scroll</span>
            </button>
          </div>
          {expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
        </div>
      </div>

      {/* Filter fields */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            {/* Search */}
            <div className="relative xl:col-span-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={filters.search}
                onChange={e => onChange({ search: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && onApply()}
                placeholder="Claim #, Dealer, Model, Serial…"
                className="input pl-8"
              />
            </div>

            {/* Status */}
            <select
              value={filters.status}
              onChange={e => onChange({ status: e.target.value })}
              className="select"
            >
              <option value="">All Statuses</option>
              {options.statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Dealer */}
            <select
              value={filters.dealer}
              onChange={e => onChange({ dealer: e.target.value })}
              className="select"
            >
              <option value="">All Dealers</option>
              {options.dealers.map(d => (
                <option key={d} value={d} title={d}>
                  {d.length > 30 ? d.slice(0, 30) + '…' : d}
                </option>
              ))}
            </select>

            {/* Model */}
            <select
              value={filters.model}
              onChange={e => onChange({ model: e.target.value })}
              className="select"
            >
              <option value="">All Models</option>
              {options.models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            {/* Assignee */}
            <select
              value={filters.assignee}
              onChange={e => onChange({ assignee: e.target.value })}
              className="select"
            >
              <option value="">All Assignees</option>
              {(options.assignees || []).map(a => (
                <option key={a} value={a} title={a}>
                  {a.length > 25 ? a.slice(0, 25) + '…' : a}
                </option>
              ))}
            </select>

            {/* Date From */}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-text-muted pl-0.5">From</span>
              <input
                type="text"
                value={filters.dateFrom}
                onChange={e => onChange({ dateFrom: e.target.value })}
                placeholder="YYYY-MM-DD"
                maxLength={10}
                className="input text-sm"
              />
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-text-muted pl-0.5">To</span>
              <input
                type="text"
                value={filters.dateTo}
                onChange={e => onChange({ dateTo: e.target.value })}
                placeholder="YYYY-MM-DD"
                maxLength={10}
                className="input text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.hasHQProduct === 'true'}
                  onChange={e => onChange({ hasHQProduct: e.target.checked ? 'true' : '' })}
                  className="w-3.5 h-3.5 rounded accent-accent-blue cursor-pointer"
                />
                <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                  HQ Claims Only
                </span>
              </label>

              <div className="flex items-center gap-1.5 ml-4">
                <span className="text-xs text-text-muted">Rows:</span>
                <select
                  value={filters.limit}
                  onChange={e => onChange({ limit: parseInt(e.target.value) })}
                  className="bg-bg-elevated border border-border rounded px-2 py-0.5 text-xs text-text-secondary focus:outline-none"
                >
                  {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button onClick={onClear} className="btn-ghost text-xs gap-1">
                  <X size={12} /> Clear
                </button>
              )}
              <button onClick={onApply} className="btn-primary text-xs px-4 py-1.5">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
