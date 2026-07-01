import React, { useState } from 'react';
import { Search, SlidersHorizontal, X, List, AlignJustify, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../../store/useStore';
import DatePicker from '../ui/DatePicker';
import SearchableSelect from '../ui/SearchableSelect';
import MultiSelect from '../ui/MultiSelect';

interface FilterValues {
  search: string;
  status: string;
  dealer: string;
  assignee: string;
  owner: string;
  dateField: string;
  dateFrom: string;
  dateTo: string;
  hasHQProduct: string;
  hasFinancialOrder: string;
  hasBillingDocument: string;
  scaOnly: string;
  agingOnly: string;
  limit: number;
}

const DATE_FIELDS: { value: string; label: string }[] = [
  { value: 'createdDate', label: 'Created' },
  { value: 'submittedDate', label: 'Submitted' },
  { value: 'repairDate', label: 'Repaired' },
  { value: 'approvedDate', label: 'Approved' },
];

interface Props {
  filters: FilterValues;
  options: { statuses: string[]; dealers: string[]; assignees: string[]; owners: string[] };
  onChange: (f: Partial<FilterValues>) => void;
  onClear: () => void;
  totalCount: number;
  totalUnfiltered: number;
}

export default function ClaimFilters({ filters, options, onChange, onClear, totalCount, totalUnfiltered }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { scrollMode, setScrollMode } = useStore();

  const hasActiveFilters = !!(
    filters.search || filters.status || filters.dealer ||
    filters.assignee || filters.owner || filters.dateFrom || filters.dateTo ||
    filters.hasHQProduct || filters.hasFinancialOrder || filters.hasBillingDocument ||
    filters.scaOnly || filters.agingOnly
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
          {filters.scaOnly === 'true' && (
            <button
              onClick={e => { e.stopPropagation(); onChange({ scaOnly: '' }); }}
              className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium bg-[#a371f7]/15 text-[#a371f7] border border-[#a371f7]/30 hover:bg-[#a371f7]/25 transition-colors"
              title="Remove SCA Claims filter"
            >
              SCA Claims Only
              <X size={11} />
            </button>
          )}
          {filters.agingOnly === 'true' && (
            <button
              onClick={e => { e.stopPropagation(); onChange({ agingOnly: '', dateFrom: '', dateTo: '' }); }}
              className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium bg-accent-orange/15 text-accent-orange-light border border-accent-orange/30 hover:bg-accent-orange/25 transition-colors"
              title="Remove Aging filter (In Review / Waiting on Dealer)"
            >
              Aging Filter
              <X size={11} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {totalUnfiltered > 0 && (
            <span className="text-xs text-text-muted">
              {hasActiveFilters && totalCount !== totalUnfiltered ? (
                <>
                  <span className="text-accent-blue font-semibold">{totalCount.toLocaleString()}</span>
                  <span className="mx-1">of</span>
                  <span className="text-text-secondary font-medium">{totalUnfiltered.toLocaleString()}</span>
                </>
              ) : hasActiveFilters ? (
                <>
                  <span className="text-accent-blue font-semibold">{totalCount.toLocaleString()}</span>
                  <span className="ml-1 text-text-muted">(all match)</span>
                </>
              ) : (
                <span className="text-text-secondary font-medium">{totalCount.toLocaleString()}</span>
              )}
              <span className="ml-1">records</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {/* Search — searches Claim#, Dealer, Serial#, HQ Claim#, Financial Order#, Billing Doc# */}
            <div className="relative xl:col-span-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={filters.search}
                onChange={e => onChange({ search: e.target.value })}
                placeholder="Claim#, HQ#, Order#, Billing#, Serial…"
                className="input pl-8"
              />
            </div>

            {/* Status (multi-select) */}
            <MultiSelect
              values={filters.status ? filters.status.split(',').map(s => s.trim()).filter(Boolean) : []}
              onChange={vals => onChange({ status: vals.join(',') })}
              options={options.statuses}
              placeholder="All Statuses"
            />

            {/* Dealer Account */}
            <SearchableSelect
              value={filters.dealer}
              onChange={v => onChange({ dealer: v })}
              options={options.dealers}
              placeholder="All Dealers"
            />

            {/* Dealer Contact (assignedTo) */}
            <SearchableSelect
              value={filters.assignee}
              onChange={v => onChange({ assignee: v })}
              options={options.assignees}
              placeholder="All Dealer Contacts"
            />

            {/* Owner (internal SF user) */}
            <SearchableSelect
              value={filters.owner}
              onChange={v => onChange({ owner: v })}
              options={options.owners || []}
              placeholder="All Owners"
            />

          </div>

          {/* Date range filter — field selector + From/To, applies to whichever date field is chosen */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-text-muted pl-0.5 font-medium uppercase tracking-wide">Date Field</span>
              <select
                value={filters.dateField || 'submittedDate'}
                onChange={e => onChange({ dateField: e.target.value })}
                className="select text-xs py-1.5"
              >
                {DATE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-text-muted pl-0.5 font-medium uppercase tracking-wide">From</span>
              <DatePicker value={filters.dateFrom} onChange={v => onChange({ dateFrom: v })} />
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-text-muted pl-0.5 font-medium uppercase tracking-wide">To</span>
              <DatePicker value={filters.dateTo} onChange={v => onChange({ dateTo: v })} />
            </div>

            {(filters.dateFrom || filters.dateTo) && (
              <button
                onClick={() => onChange({ dateFrom: '', dateTo: '' })}
                className="btn-ghost text-xs gap-1 mb-0.5"
              >
                <X size={11} /> Clear Dates
              </button>
            )}
          </div>

          {/* Checkboxes + rows + clear */}
          <div className="flex items-center justify-between flex-wrap gap-y-2">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.hasHQProduct === 'true'}
                  onChange={e => onChange({ hasHQProduct: e.target.checked ? 'true' : '' })}
                  className="w-3.5 h-3.5 rounded accent-accent-blue cursor-pointer"
                />
                <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                  Has HQ Claim
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.hasFinancialOrder === 'true'}
                  onChange={e => onChange({ hasFinancialOrder: e.target.checked ? 'true' : '' })}
                  className="w-3.5 h-3.5 rounded accent-accent-blue cursor-pointer"
                />
                <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                  Has Financial Order
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.hasBillingDocument === 'true'}
                  onChange={e => onChange({ hasBillingDocument: e.target.checked ? 'true' : '' })}
                  className="w-3.5 h-3.5 rounded accent-accent-blue cursor-pointer"
                />
                <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                  Has Billing Document
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.scaOnly === 'true'}
                  onChange={e => onChange({ scaOnly: e.target.checked ? 'true' : '' })}
                  className="w-3.5 h-3.5 rounded cursor-pointer"
                  style={{ accentColor: '#a371f7' }}
                />
                <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                  SCA Claims Only
                </span>
              </label>

              <div className="flex items-center gap-1.5">
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

            {hasActiveFilters && (
              <button onClick={onClear} className="btn-ghost text-xs gap-1">
                <X size={12} /> Clear All
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
