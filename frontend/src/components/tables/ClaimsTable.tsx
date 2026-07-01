import React, { useRef, useCallback } from 'react';
import { ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown, ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import Badge from '../ui/Badge';
import { SkeletonTable } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import { useStore } from '../../store/useStore';
import { formatDateOnly, formatDateTimeLocal } from '../../utils/date';

interface Props {
  data: any;
  loading: boolean;
  isFetching?: boolean;
  isFetchingMore?: boolean;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
  page: number;
  onPageChange: (p: number) => void;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
}

function SortIcon({ field, sortBy, sortDir }: { field: string; sortBy: string; sortDir: string }) {
  if (sortBy !== field) return <ChevronsUpDown size={12} className="text-text-muted" />;
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="text-accent-blue-light" />
    : <ChevronDown size={12} className="text-accent-blue-light" />;
}

// Date columns ordered chronologically: Failure → Repair → Created → Submitted → Approved
const COLS = [
  { key: 'claimNumber',    label: 'Claim #',      sortable: true,  width: 'w-28' },
  { key: 'dealerName',     label: 'Dealer',        sortable: true,  width: 'w-44' },
  { key: 'failureDate',    label: 'Failure Date',  sortable: true,  width: 'w-28' },
  { key: 'repairDate',     label: 'Repair Date',   sortable: true,  width: 'w-28' },
  { key: 'sfCreatedDate',  label: 'Created',       sortable: true,  width: 'w-28' },
  { key: 'submittedDate',  label: 'Submitted',     sortable: true,  width: 'w-28' },
  { key: 'approvedDate',   label: 'Approved',      sortable: true,  width: 'w-28' },
  { key: 'status',         label: 'Status',        sortable: true,  width: 'w-32' },
  { key: 'assignedTo',     label: 'Assigned To',   sortable: true,  width: 'w-36' },
  { key: 'totalAmount',    label: 'Amount',        sortable: true,  width: 'w-24' },
  { key: 'hqClaim',        label: 'HQ Claim',      sortable: false, width: 'w-28' },
  { key: 'financialOrder', label: 'Fin. Order',    sortable: false, width: 'w-36' },
  { key: 'billingDoc',     label: 'Billing Doc',   sortable: false, width: 'w-28' },
];

export default function ClaimsTable({
  data, loading, isFetching, isFetchingMore, sortBy, sortDir, onSort, page, onPageChange, onLoadMore, hasNextPage,
}: Props) {
  const { scrollMode } = useStore();
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || scrollMode !== 'infinite' || !onLoadMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingMore) onLoadMore();
    }, { rootMargin: '200px' });
    observerRef.current.observe(node);
  }, [scrollMode, onLoadMore, hasNextPage, isFetchingMore]);

  if (loading && !data?.data?.length) {
    return (
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <SkeletonTable rows={10} cols={10} />
        </div>
      </div>
    );
  }

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const limit = data?.limit ?? 20;
  const loadedCount = rows.length;
  const loadedPct = total > 0 ? Math.min(100, Math.round(loadedCount / total * 100)) : 0;
  const isRefetching = isFetching && !loading;

  return (
    <div className="card overflow-hidden relative">
      {/* Indeterminate progress bar — visible while a background query is in-flight */}
      {isRefetching && (
        <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden z-10 bg-accent-blue/15">
          <div
            className="absolute h-full bg-accent-blue"
            style={{ width: '45%', animation: 'fetch-progress 1.2s ease-in-out infinite' }}
          />
        </div>
      )}

      <div className={`overflow-x-auto transition-opacity duration-150 ${isRefetching ? 'opacity-55' : 'opacity-100'}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-elevated/50">
              {COLS.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide ${col.width} ${col.sortable ? 'cursor-pointer hover:text-text-primary select-none' : ''}`}
                  onClick={() => col.sortable && onSort(col.key)}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{col.label}</span>
                    {col.sortable && <SortIcon field={col.key} sortBy={sortBy} sortDir={sortDir} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLS.length}><EmptyState /></td>
              </tr>
            ) : (
              rows.map((row: any) => {
                const hq = row.hqClaims?.[0];
                const order = row.financialOrders?.[0];
                const doc = order?.billingDocuments?.[0];

                return (
                  <tr key={row.id} className="table-row-hover group">
                    {/* Claim # */}
                    <td className="px-4 py-3">
                      {row.sfLink ? (
                        <a href={row.sfLink} target="_blank" rel="noopener noreferrer"
                          className="text-text-link hover:text-accent-blue-light font-mono text-xs flex items-center gap-1 hover:underline"
                          onClick={e => e.stopPropagation()}>
                          <span className="truncate max-w-[90px]">{row.claimNumber || row.sfId?.slice(-8)}</span>
                          <ExternalLink size={11} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-text-secondary truncate">{row.claimNumber || '—'}</span>
                      )}
                    </td>

                    {/* Dealer */}
                    <td className="px-4 py-3">
                      <span className="text-text-primary truncate block max-w-[168px]" title={row.dealerName}>
                        {row.dealerName || '—'}
                      </span>
                    </td>

                    {/* Failure Date */}
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      {formatDateOnly(row.failureDate)}
                    </td>

                    {/* Repair Date */}
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      {formatDateOnly(row.repairDate)}
                    </td>

                    {/* Created Date — SF standard datetime, shown in viewer's local timezone */}
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      {formatDateTimeLocal(row.sfCreatedDate)}
                    </td>

                    {/* Submitted Date */}
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      {formatDateOnly(row.submittedDate || row.sfCreatedDate)}
                    </td>

                    {/* Approved Date */}
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      {formatDateOnly(row.approvedDate)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {row.status ? <Badge label={row.status} /> : <span className="text-text-muted">—</span>}
                    </td>

                    {/* Assigned To */}
                    <td className="px-4 py-3">
                      <span className="text-text-secondary truncate block max-w-[132px]" title={row.assignedTo}>
                        {row.assignedTo || '—'}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.totalAmount != null ? (
                        <span className="text-text-primary font-medium">
                          {row.currencyIsoCode === 'CAD' ? 'CA$' : '$'}
                          {Number(row.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>

                    {/* HQ Claim */}
                    <td className="px-4 py-3">
                      {hq ? (
                        <a href={hq.sfLink || '#'} target="_blank" rel="noopener noreferrer"
                          className="text-text-link hover:underline flex items-center gap-1 text-xs"
                          onClick={e => e.stopPropagation()}>
                          <span className="truncate max-w-[100px]">{hq.hqClaimNumber || 'View'}</span>
                          <ExternalLink size={10} className="shrink-0" />
                        </a>
                      ) : <span className="text-text-muted text-xs">—</span>}
                    </td>

                    {/* Financial Order */}
                    <td className="px-4 py-3">
                      {order ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <a href={order.sfLink || '#'} target="_blank" rel="noopener noreferrer"
                            className="text-text-link hover:underline flex items-center gap-1 text-xs"
                            onClick={e => e.stopPropagation()}>
                            <span className="truncate max-w-[80px]">{order.orderNumber || 'View'}</span>
                            <ExternalLink size={10} className="shrink-0" />
                          </a>
                          {order.erpStatus === 'S' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-green/15 text-accent-green-light shrink-0">ERP</span>
                          )}
                          {order.erpStatus === 'E' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-red/15 text-accent-red-light shrink-0 cursor-help"
                              title={order.erpErrorMessage ? String(order.erpErrorMessage).slice(0, 200) : 'ERP transmission error'}>
                              ERR
                            </span>
                          )}
                        </div>
                      ) : <span className="text-text-muted text-xs">—</span>}
                    </td>

                    {/* Billing Doc */}
                    <td className="px-4 py-3">
                      {doc ? (
                        <a href={doc.sfLink || '#'} target="_blank" rel="noopener noreferrer"
                          className="text-text-link hover:underline flex items-center gap-1 text-xs"
                          onClick={e => e.stopPropagation()}>
                          <span className="truncate max-w-[100px]">{doc.documentNumber || 'View'}</span>
                          <ExternalLink size={10} className="shrink-0" />
                        </a>
                      ) : <span className="text-text-muted text-xs">—</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Infinite scroll sentinel */}
      {scrollMode === 'infinite' && <div ref={sentinelRef} className="h-4" />}

      {/* Infinite scroll: progress bar + loaded% */}
      {scrollMode === 'infinite' && total > 0 && (
        <div className="px-4 py-2 border-t border-border flex items-center gap-3">
          <div className="flex-1 h-1 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue rounded-full transition-all duration-500"
              style={{ width: `${loadedPct}%` }}
            />
          </div>
          <span className="text-xs text-text-muted tabular-nums whitespace-nowrap">
            {loadedCount.toLocaleString()} / {total.toLocaleString()}{' '}
            <span className="text-accent-blue font-medium">({loadedPct}%)</span>
          </span>
        </div>
      )}

      {/* Pagination footer */}
      {scrollMode === 'pagination' && (
        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
          {/* Left: count + % + refetch indicator */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-text-muted text-xs whitespace-nowrap">
              {Math.min((page - 1) * limit + 1, total).toLocaleString()}–{Math.min(page * limit, total).toLocaleString()}
              {' / '}
              <span className="text-text-secondary">{total.toLocaleString()}</span>
              {total > 0 && (
                <span className="ml-1 text-accent-blue font-medium">
                  ({Math.round(Math.min(page * limit, total) / total * 100)}%)
                </span>
              )}
            </span>
            {isRefetching && (
              <span className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className="w-3 h-3 border border-accent-blue border-t-transparent rounded-full animate-spin shrink-0" />
                Loading…
              </span>
            )}
          </div>

          {/* Right: page navigation */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => onPageChange(1)}
                className="p-1.5 rounded hover:bg-bg-hover text-text-secondary disabled:opacity-30 transition-colors" title="First page">
                <ChevronsLeft size={14} />
              </button>
              <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
                className="p-1.5 rounded hover:bg-bg-hover text-text-secondary disabled:opacity-30 transition-colors" title="Previous page">
                <ArrowLeft size={14} />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) p = i + 1;
                else if (page <= 4) p = i + 1;
                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                else p = page - 3 + i;
                return (
                  <button key={p} onClick={() => onPageChange(p)}
                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                      p === page ? 'bg-accent-blue text-white' : 'hover:bg-bg-hover text-text-secondary'
                    }`}>
                    {p}
                  </button>
                );
              })}
              <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
                className="p-1.5 rounded hover:bg-bg-hover text-text-secondary disabled:opacity-30 transition-colors" title="Next page">
                <ArrowRight size={14} />
              </button>
              <button disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}
                className="p-1.5 rounded hover:bg-bg-hover text-text-secondary disabled:opacity-30 transition-colors" title="Last page">
                <ChevronsRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Infinite scroll loader spinner */}
      {scrollMode === 'infinite' && isFetchingMore && (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
