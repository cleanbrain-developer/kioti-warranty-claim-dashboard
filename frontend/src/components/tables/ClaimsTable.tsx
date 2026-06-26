import React, { useRef, useCallback } from 'react';
import { ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown, ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { format } from 'date-fns';
import Badge from '../ui/Badge';
import { SkeletonTable } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import { useStore } from '../../store/useStore';

interface Props {
  data: any;
  loading: boolean;
  isFetchingMore?: boolean;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
  page: number;
  onPageChange: (p: number) => void;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
}

function formatDate(dateStr: string | null, tz: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      timeZone: tz === 'local' ? undefined : tz,
    }).format(d);
  } catch {
    return '—';
  }
}

function SortIcon({ field, sortBy, sortDir }: { field: string; sortBy: string; sortDir: string }) {
  if (sortBy !== field) return <ChevronsUpDown size={12} className="text-text-muted" />;
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="text-accent-blue-light" />
    : <ChevronDown size={12} className="text-accent-blue-light" />;
}

const COLS = [
  { key: 'claimNumber', label: 'Claim #', sortable: true, width: 'w-28' },
  { key: 'dealerName', label: 'Dealer', sortable: true, width: 'w-44' },
  { key: 'modelName', label: 'Model', sortable: true, width: 'w-28' },
  { key: 'serialNumber', label: 'Serial #', sortable: false, width: 'w-32' },
  { key: 'submittedDate', label: 'Submitted', sortable: true, width: 'w-28' },
  { key: 'repairDate', label: 'Repair Date', sortable: true, width: 'w-28' },
  { key: 'status', label: 'Status', sortable: true, width: 'w-32' },
  { key: 'assignedTo', label: 'Assigned To', sortable: true, width: 'w-32' },
  { key: 'totalAmount', label: 'Amount', sortable: true, width: 'w-24' },
  { key: 'hqClaim', label: 'HQ Claim', sortable: false, width: 'w-28' },
  { key: 'financialOrder', label: 'Fin. Order', sortable: false, width: 'w-36' },
  { key: 'billingDoc', label: 'Billing Doc', sortable: false, width: 'w-28' },
];

export default function ClaimsTable({
  data, loading, isFetchingMore, sortBy, sortDir, onSort, page, onPageChange, onLoadMore, hasNextPage,
}: Props) {
  const { scrollMode, timezone } = useStore();
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

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
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
                <td colSpan={COLS.length}>
                  <EmptyState />
                </td>
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
                        <a
                          href={row.sfLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-link hover:text-accent-blue-light font-mono text-xs flex items-center gap-1 hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          <span className="truncate max-w-[90px]">{row.claimNumber || row.sfId?.slice(-8)}</span>
                          <ExternalLink size={11} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-text-secondary truncate">
                          {row.claimNumber || '—'}
                        </span>
                      )}
                    </td>

                    {/* Dealer */}
                    <td className="px-4 py-3">
                      <span className="text-text-primary truncate block max-w-[168px]" title={row.dealerName}>
                        {row.dealerName || '—'}
                      </span>
                    </td>

                    {/* Model */}
                    <td className="px-4 py-3">
                      <span className="text-text-secondary truncate block max-w-[100px]" title={row.modelName}>
                        {row.modelName || '—'}
                      </span>
                    </td>

                    {/* Serial # */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-text-muted truncate block max-w-[120px]" title={row.serialNumber}>
                        {row.serialNumber || '—'}
                      </span>
                    </td>

                    {/* Submitted Date */}
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      {formatDate(row.submittedDate || row.sfCreatedDate, timezone)}
                    </td>

                    {/* Repair Date */}
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      {formatDate(row.repairDate, timezone)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {row.status ? <Badge label={row.status} /> : <span className="text-text-muted">—</span>}
                    </td>

                    {/* Assigned To */}
                    <td className="px-4 py-3">
                      <span className="text-text-secondary truncate block max-w-[120px]" title={row.assignedTo}>
                        {row.assignedTo || '—'}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.totalAmount != null ? (
                        <span className="text-text-primary font-medium">
                          ${Number(row.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>

                    {/* HQ Claim */}
                    <td className="px-4 py-3">
                      {hq ? (
                        <a
                          href={hq.sfLink || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-link hover:underline flex items-center gap-1 text-xs"
                          onClick={e => e.stopPropagation()}
                        >
                          <span className="truncate max-w-[100px]">{hq.hqClaimNumber || 'View'}</span>
                          <ExternalLink size={10} className="shrink-0" />
                        </a>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>

                    {/* Financial Order */}
                    <td className="px-4 py-3">
                      {order ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <a
                            href={order.sfLink || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text-link hover:underline flex items-center gap-1 text-xs"
                            onClick={e => e.stopPropagation()}
                          >
                            <span className="truncate max-w-[80px]">{order.orderNumber || 'View'}</span>
                            <ExternalLink size={10} className="shrink-0" />
                          </a>
                          {order.erpStatus === 'S' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-green/15 text-accent-green-light shrink-0">
                              ERP
                            </span>
                          )}
                          {order.erpStatus === 'E' && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-red/15 text-accent-red-light shrink-0 cursor-help"
                              title={order.erpErrorMessage ? String(order.erpErrorMessage).slice(0, 200) : 'ERP transmission error'}
                            >
                              ERR
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>

                    {/* Billing Doc */}
                    <td className="px-4 py-3">
                      {doc ? (
                        <a
                          href={doc.sfLink || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-link hover:underline flex items-center gap-1 text-xs"
                          onClick={e => e.stopPropagation()}
                        >
                          <span className="truncate max-w-[100px]">{doc.documentNumber || 'View'}</span>
                          <ExternalLink size={10} className="shrink-0" />
                        </a>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
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

      {/* Pagination controls */}
      {scrollMode === 'pagination' && totalPages > 1 && (
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <span className="text-text-muted text-xs">
            Showing {Math.min((page - 1) * (data?.limit ?? 20) + 1, total)}–{Math.min(page * (data?.limit ?? 20), total)} of{' '}
            <span className="text-text-secondary">{total.toLocaleString()}</span> claims
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(1)}
              className="p-1.5 rounded hover:bg-bg-hover text-text-secondary disabled:opacity-30 transition-colors"
              title="First page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="p-1.5 rounded hover:bg-bg-hover text-text-secondary disabled:opacity-30 transition-colors"
              title="Previous page"
            >
              <ArrowLeft size={14} />
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) p = i + 1;
              else if (page <= 4) p = i + 1;
              else if (page >= totalPages - 3) p = totalPages - 6 + i;
              else p = page - 3 + i;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                    p === page
                      ? 'bg-accent-blue text-white'
                      : 'hover:bg-bg-hover text-text-secondary'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="p-1.5 rounded hover:bg-bg-hover text-text-secondary disabled:opacity-30 transition-colors"
              title="Next page"
            >
              <ArrowRight size={14} />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(totalPages)}
              className="p-1.5 rounded hover:bg-bg-hover text-text-secondary disabled:opacity-30 transition-colors"
              title="Last page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Infinite scroll loader */}
      {scrollMode === 'infinite' && isFetchingMore && (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
