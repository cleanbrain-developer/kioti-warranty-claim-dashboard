import React from 'react';
import ReactECharts from 'echarts-for-react';
import { SkeletonChart } from '../ui/Skeleton';
import { useChartColors } from '../../hooks/useChartColors';

const COLORS = ['#58a6ff', '#3fb950', '#e3b341', '#f85149', '#a371f7', '#ffa657', '#39d353', '#79c0ff'];

interface Props {
  data: { status: string; count: number; amount: number }[];
  loading: boolean;
}

export default function ByStatusChart({ data, loading }: Props) {
  const c = useChartColors();

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
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: c.tooltipText, fontSize: 13 },
      formatter: (p: any) =>
        `<div style="color:${c.tooltipText}"><div style="font-weight:600;margin-bottom:2px">${p.name}</div><div>${p.value.toLocaleString()} claims (${p.percent}%)</div></div>`,
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'center',
      textStyle: { color: c.legendText, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
      formatter: (name: string) => name.length > 16 ? name.slice(0, 16) + '…' : name,
    },
    series: [
      {
        name: 'Claims by Status',
        type: 'pie',
        radius: ['38%', '68%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: 'transparent', borderWidth: 2 },
        label: {
          show: true,
          position: 'inside',
          formatter: (p: any) => p.percent >= 5 ? p.value.toLocaleString() : '',
          color: '#ffffff',
          fontSize: 11,
          fontWeight: '600',
          textShadowColor: 'rgba(0,0,0,0.6)',
          textShadowBlur: 3,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            color: '#ffffff',
            formatter: (p: any) => `${p.value.toLocaleString()}\n(${p.percent}%)`,
          },
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
