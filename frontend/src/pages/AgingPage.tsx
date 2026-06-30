import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import { SkeletonCard, SkeletonChart } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import { useChartColors } from '../hooks/useChartColors';

const BUCKET_LABELS = ['0–30 days', '31–60 days', '61–90 days', '91–180 days', '181–365 days', '365+ days'];
const BUCKET_KEYS = ['0_30', '31_60', '61_90', '91_180', '181_365', '365_plus'] as const;
const BUCKET_COLORS = ['#06b6d4', '#22c55e', '#eab308', '#f97316', '#ef4444', '#991b1b'];
// [minDays, maxDays] — age range for each bucket (used to compute submission date range for navigation)
const BUCKET_DAYS = [[0,30],[31,60],[61,90],[91,180],[181,365],[366,3650]] as const;

function AgingKPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card p-4">
      <div className={`text-2xl font-bold mb-0.5 ${color || 'text-text-primary'}`}>{value}</div>
      <div className="text-text-secondary text-xs font-medium">{label}</div>
      {sub && <div className="text-text-muted text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

function AgingBucketBar({ data }: { data: Record<string, number> }) {
  const total = BUCKET_KEYS.reduce((s, k) => s + (data[k] || 0), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {BUCKET_KEYS.map((k, i) => {
        const count = data[k] || 0;
        const pct = total ? Math.round((count / total) * 100) : 0;
        return (
          <div key={k} className="card p-4 text-center" style={{ borderTopColor: BUCKET_COLORS[i], borderTopWidth: 3 }}>
            <div className="text-xs text-text-muted mb-1">{BUCKET_LABELS[i]}</div>
            <div className="text-2xl font-bold" style={{ color: BUCKET_COLORS[i] }}>
              {count.toLocaleString()}
            </div>
            <div className="text-xs text-text-muted mt-1">{pct}%</div>
          </div>
        );
      })}
    </div>
  );
}

function AgingStackedBar({ rows, dimension }: { rows: any[]; dimension: 'dealer' | 'model' }) {
  const c = useChartColors();
  const navigate = useNavigate();
  const [hoverRow, setHoverRow] = React.useState<number | null>(null);
  const [hoverBucket, setHoverBucket] = React.useState<number | null>(null);
  const leaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!rows?.length) {
    return <div className="flex items-center justify-center h-48 text-text-muted text-sm">No data</div>;
  }

  const top = rows.slice(0, 12);
  const rowTotals = top.map(r => BUCKET_KEYS.reduce((s, k) => s + (r[k] || 0), 0));

  const getOpacity = (rowIdx: number, bucketIdx: number): number => {
    if (hoverRow === null) return 1;
    if (hoverRow === rowIdx) {
      // same dealer: hovered bucket = full, other buckets = slightly dimmed
      return (hoverBucket === null || hoverBucket === bucketIdx) ? 1 : 0.55;
    }
    return 0.30; // different dealer — visible but clearly background
  };

  const dataSeries = BUCKET_KEYS.map((k, i) => ({
    name: BUCKET_LABELS[i],
    type: 'bar',
    stack: 'total',
    data: top.map((r, rowIdx) => {
      const val = r[k] || 0;
      const opacity = getOpacity(rowIdx, i);
      const isRightmost = val > 0 && BUCKET_KEYS.slice(i + 1).every(kk => !(r[kk] || 0));
      const item: any = {
        value: val,
        itemStyle: { color: BUCKET_COLORS[i], opacity },
      };
      if (isRightmost) {
        item.label = {
          show: hoverRow === null || hoverRow === rowIdx,
          position: 'right',
          color: c.barLabelRight,
          fontSize: 11,
          fontWeight: '600',
          formatter: () => String(rowTotals[rowIdx]),
        };
      }
      return item;
    }),
    label: { show: false },
    emphasis: {
      itemStyle: {
        shadowBlur: 16,
        shadowColor: 'rgba(0,0,0,0.55)',
        opacity: 1,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.7)',
      },
    },
  }));

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: c.tooltipText, fontSize: 12 },
      formatter: (params: any) => {
        if (!params.value) return '';
        const rowIdx = params.dataIndex;
        const bucketIdx = params.seriesIndex;
        const name = top[rowIdx]?.[dimension] || 'Unknown';
        const total = rowTotals[rowIdx];
        const [minDays, maxDays] = BUCKET_DAYS[bucketIdx];
        const rangeLabel = maxDays >= 3650 ? `${minDays}+ days` : `${minDays}–${maxDays} days`;
        return `
          <div style="font-weight:700;margin-bottom:6px;font-size:13px">${name}</div>
          <div style="display:flex;justify-content:space-between;gap:20px;line-height:1.8">
            <span>${params.marker}${params.seriesName}</span><b>${params.value}</b>
          </div>
          <div style="margin-top:4px;padding-top:4px;border-top:1px solid ${c.tooltipBorder};
               display:flex;justify-content:space-between;color:${c.axisMuted};font-size:11px">
            <span>Total open</span><span>${total}</span>
          </div>
          <div style="margin-top:6px;color:${c.axisMuted};font-size:10px">
            Click to view ${rangeLabel} claims for this dealer
          </div>
        `;
      },
    },
    legend: {
      data: BUCKET_LABELS,
      textStyle: { color: c.legendText, fontSize: 10 },
      itemWidth: 10,
      itemHeight: 6,
      bottom: 0,
    },
    grid: { left: '2%', right: '52px', top: '4%', bottom: '60px', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: c.gridLine, type: 'dashed' } },
      axisLabel: { color: c.axisMuted, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: top.map(r => {
        const name = r[dimension] || 'Unknown';
        return name.length > 22 ? name.slice(0, 22) + '…' : name;
      }),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: c.axisLabel, fontSize: 11 },
      inverse: true,
    },
    series: dataSeries,
  };

  const handleOver = (params: any) => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    if (params.componentType === 'series') {
      setHoverRow(params.dataIndex);
      setHoverBucket(params.seriesIndex);
    }
  };

  const handleOut = () => {
    leaveTimer.current = setTimeout(() => {
      setHoverRow(null);
      setHoverBucket(null);
    }, 80);
  };

  const handleClick = (params: any) => {
    if (params.componentType !== 'series' || !params.value) return;
    const dealer = top[params.dataIndex]?.[dimension];
    if (!dealer || dealer === 'Unknown') return;

    const bucketIdx = params.seriesIndex as number;
    const [minDays, maxDays] = BUCKET_DAYS[bucketIdx];
    const today = new Date();

    const dateTo = new Date(today);
    dateTo.setDate(today.getDate() - minDays);

    const dateFrom = new Date(today);
    dateFrom.setDate(today.getDate() - maxDays);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    navigate(`/claims?dealer=${encodeURIComponent(dealer)}&dateFrom=${fmt(dateFrom)}&dateTo=${fmt(dateTo)}`);
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: Math.max(260, top.length * 30 + 80) }}
      opts={{ renderer: 'canvas' }}
      onEvents={{ mouseover: handleOver, mouseout: handleOut, click: handleClick }}
    />
  );
}

const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function AgingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'aging'],
    queryFn: api.getAging,
  });

  const buckets = data?.buckets || {};
  const total = BUCKET_KEYS.reduce((s, k) => s + (buckets[k] || 0), 0);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        timeZone: browserTz,
      }).format(new Date(d));
    } catch { return '—'; }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-text-primary font-semibold text-lg">Warranty Claim Aging Analysis</h1>
        <p className="text-text-muted text-sm mt-0.5">
          Age measured from submission date · Open / pending claims only · Click any number to view cases
        </p>
      </div>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <AgingKPICard
            label="Total Open Claims"
            value={total.toLocaleString()}
            color="text-text-primary"
          />
          <AgingKPICard
            label="Average Age"
            value={buckets.avg_age ? `${Math.round(buckets.avg_age)} days` : '—'}
            sub="Mean days open"
            color="text-accent-orange-light"
          />
          <AgingKPICard
            label="Oldest Open Claim"
            value={buckets.max_age ? `${Math.round(buckets.max_age)} days` : '—'}
            sub={data?.oldestClaims?.[0]?.claimNumber || ''}
            color="text-accent-red-light"
          />
          <AgingKPICard
            label="Over 181 Days"
            value={((buckets['181_365'] || 0) + (buckets['365_plus'] || 0)).toLocaleString()}
            sub={total ? `${Math.round(((buckets['181_365'] || 0) + (buckets['365_plus'] || 0)) / total * 100)}% of open` : ''}
            color="text-accent-red-light"
          />
        </div>
      )}

      {/* Bucket distribution */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
          Aging Bucket Distribution
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} lines={2} />)}
          </div>
        ) : (
          <AgingBucketBar data={buckets} />
        )}
      </div>

      {/* Aging charts */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
          Aging by Dealer
        </h2>
        {isLoading ? <SkeletonChart height={300} /> : (
          <AgingStackedBar rows={data?.byDealer || []} dimension="dealer" />
        )}
      </div>

      {/* Oldest open claims table */}
      <div className="card">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <AlertTriangle size={15} className="text-accent-orange-light" />
          <h2 className="text-sm font-semibold text-text-primary">Oldest Open Claims</h2>
        </div>
        {isLoading ? (
          <div className="p-4"><SkeletonCard lines={3} /></div>
        ) : !data?.oldestClaims?.length ? (
          <EmptyState title="No open claims" description="All claims have been resolved." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elevated/50">
                  {['Claim #', 'Dealer', 'Submitted', 'Status', 'Amount', 'Age'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.oldestClaims.map((claim: any) => (
                  <tr key={claim.id} className="table-row-hover">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-text-link">{claim.claimNumber || claim.sfId?.slice(-8)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-text-primary truncate block max-w-[180px]">{claim.dealerName || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      {formatDate(claim.submittedDate)}
                    </td>
                    <td className="px-4 py-3">
                      {claim.status ? <Badge label={claim.status} /> : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-right">
                      {claim.totalAmount != null ? (
                        <span className="text-text-primary">${Number(claim.totalAmount).toLocaleString()}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold tabular-nums ${
                          claim.ageDays > 365 ? 'text-accent-red-light' :
                          claim.ageDays > 180 ? 'text-accent-orange-light' :
                          claim.ageDays > 90 ? 'text-accent-orange-light' :
                          'text-accent-green-light'
                        }`}
                      >
                        {claim.ageDays != null ? `${claim.ageDays}d` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
