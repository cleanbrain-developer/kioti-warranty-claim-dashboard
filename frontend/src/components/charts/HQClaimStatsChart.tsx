import React from 'react';
import ReactECharts from 'echarts-for-react';
import { SkeletonChart } from '../ui/Skeleton';
import { useChartColors } from '../../hooks/useChartColors';

const STATUS_COLORS: Record<string, string> = {
  Accepted: '#22c55e',
  Approved: '#22c55e',
  Returned: '#eab308',
  Declined: '#ef4444',
  Rejected: '#ef4444',
  Draft: '#94a3b8',
  Holding: '#f97316',
  Unknown: '#6b7280',
};

function statusColor(s: string) {
  for (const [k, v] of Object.entries(STATUS_COLORS)) {
    if (s.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return '#58a6ff';
}

interface HQStats {
  statusBreakdown: { status: string; count: number }[];
  [key: string]: any;
}

interface Props { data: HQStats | undefined; loading: boolean; }

function StatusDonut({ data, c }: { data: HQStats['statusBreakdown']; c: any }) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: c.tooltipText, fontSize: 13 },
      formatter: (p: any) =>
        `<div><div style="font-weight:600;margin-bottom:2px">${p.name}</div><div>${p.value.toLocaleString()} claims (${p.percent}%)</div></div>`,
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'center',
      textStyle: { color: c.legendText, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [{
      type: 'pie',
      radius: ['40%', '68%'],
      center: ['38%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderColor: 'transparent', borderWidth: 2 },
      label: {
        show: true,
        position: 'inside',
        formatter: (p: any) => p.percent >= 6 ? p.value.toLocaleString() : '',
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowBlur: 3,
      },
      emphasis: {
        label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#fff', formatter: (p: any) => `${p.value}\n(${p.percent}%)` },
        itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.4)' },
      },
      data: data.map(d => ({ name: d.status, value: d.count, itemStyle: { color: statusColor(d.status) } })),
    }],
  };

  return <ReactECharts option={option} style={{ height: 240 }} opts={{ renderer: 'canvas' }} />;
}

export default function HQClaimStatsChart({ data, loading }: Props) {
  const c = useChartColors();

  if (loading) return <div className="card p-5"><SkeletonChart height={240} /></div>;
  if (!data) return null;

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
        HQ Review Status
      </h2>
      {data.statusBreakdown?.length ? (
        <StatusDonut data={data.statusBreakdown} c={c} />
      ) : (
        <div className="flex items-center justify-center h-48 text-text-muted text-sm">No HQ claim data</div>
      )}
    </div>
  );
}
