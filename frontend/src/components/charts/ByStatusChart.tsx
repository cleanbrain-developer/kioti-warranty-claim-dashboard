import React from 'react';
import ReactECharts from 'echarts-for-react';
import { SkeletonChart } from '../ui/Skeleton';

const COLORS = ['#58a6ff', '#3fb950', '#e3b341', '#f85149', '#a371f7', '#ffa657', '#39d353', '#79c0ff'];

interface Props {
  data: { status: string; count: number; amount: number }[];
  loading: boolean;
}

export default function ByStatusChart({ data, loading }: Props) {
  if (loading) return <SkeletonChart height={280} />;

  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        No status data available
      </div>
    );
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      className: 'echarts-tooltip-dark',
      formatter: (p: any) =>
        `<div class="font-semibold">${p.name}</div><div>${p.value} claims (${p.percent}%)</div>`,
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'center',
      textStyle: { color: '#8b949e', fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
      formatter: (name: string) => name.length > 16 ? name.slice(0, 16) + '…' : name,
    },
    series: [
      {
        name: 'Claims by Status',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: '#161b22', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#e6edf3' },
          itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.4)' },
        },
        data: data.map((d, i) => ({
          name: d.status,
          value: d.count,
          itemStyle: { color: COLORS[i % COLORS.length] },
        })),
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 280 }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
