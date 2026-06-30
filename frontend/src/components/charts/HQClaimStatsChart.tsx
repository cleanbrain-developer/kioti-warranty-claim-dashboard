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
  monthlyEval: { month: string; count: number }[];
  adjudicationTrend: { month: string; avg_days: number; count: number }[];
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

function AdjudicationChart({ data, c }: { data: HQStats['adjudicationTrend']; c: any }) {
  if (!data?.length) return <div className="flex items-center justify-center h-48 text-text-muted text-sm">No adjudication data</div>;

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: c.tooltipText, fontSize: 12 },
      formatter: (params: any[]) => {
        const [bar, line] = params;
        return `<div style="font-weight:600;margin-bottom:4px">${bar?.axisValue}</div>
          <div style="display:flex;gap:16px">
            <span>${bar?.marker}${bar?.value} adjudicated</span>
            <span>${line?.marker}avg ${line?.value}d</span>
          </div>`;
      },
    },
    legend: {
      data: ['Count', 'Avg Days'],
      textStyle: { color: c.legendText, fontSize: 10 },
      bottom: 0,
    },
    grid: { left: '2%', right: '2%', top: '8%', bottom: '40px', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map(d => d.month),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: c.axisMuted, fontSize: 10 },
    },
    yAxis: [
      { type: 'value', name: 'Count', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: c.gridLine, type: 'dashed' } }, axisLabel: { color: c.axisMuted, fontSize: 10 } },
      { type: 'value', name: 'Days', axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { color: c.axisMuted, fontSize: 10 } },
    ],
    series: [
      {
        name: 'Count',
        type: 'bar',
        yAxisIndex: 0,
        data: data.map(d => d.count),
        itemStyle: { color: '#22c55e', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 36,
      },
      {
        name: 'Avg Days',
        type: 'line',
        yAxisIndex: 1,
        data: data.map(d => d.avg_days),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#f97316', width: 2 },
        itemStyle: { color: '#f97316' },
        label: { show: true, position: 'top', color: c.barLabelRight, fontSize: 10, formatter: (p: any) => `${p.value}d` },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 240 }} opts={{ renderer: 'canvas' }} />;
}

export default function HQClaimStatsChart({ data, loading }: Props) {
  const c = useChartColors();

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5"><SkeletonChart height={240} /></div>
        <div className="card p-5 lg:col-span-2"><SkeletonChart height={240} /></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
          HQ Review Status
        </h2>
        {data.statusBreakdown.length ? (
          <StatusDonut data={data.statusBreakdown} c={c} />
        ) : (
          <div className="flex items-center justify-center h-48 text-text-muted text-sm">No HQ claim data</div>
        )}
      </div>

      <div className="card p-5 lg:col-span-2">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
            Avg Adjudication Time (Days)
          </h2>
          <span className="text-[10px] text-text-muted">From HQ submission to evaluation date</span>
        </div>
        <AdjudicationChart data={data.adjudicationTrend} c={c} />
      </div>
    </div>
  );
}
