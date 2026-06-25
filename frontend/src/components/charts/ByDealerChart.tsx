import React from 'react';
import ReactECharts from 'echarts-for-react';
import { SkeletonChart } from '../ui/Skeleton';
import { useChartColors } from '../../hooks/useChartColors';

interface Props {
  data: { dealer: string; count: number; amount: number }[];
  loading: boolean;
  title?: string;
}

export default function ByDealerChart({ data, loading }: Props) {
  const c = useChartColors();

  if (loading) return <SkeletonChart height={340} />;
  if (!data?.length) {
    return <div className="flex items-center justify-center h-64 text-text-muted text-sm">No dealer data available</div>;
  }

  const sorted = [...data].sort((a, b) => a.count - b.count).slice(-15);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: c.tooltipText, fontSize: 13 },
      formatter: (params: any[]) => {
        const p = params[0];
        return `<div style="color:${c.tooltipText}"><div style="font-weight:600;margin-bottom:2px">${p.name}</div><div>${p.value} claims</div></div>`;
      },
    },
    grid: { left: '2%', right: '8%', top: '2%', bottom: '2%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: c.gridLine } },
      axisLabel: { color: c.axisMuted, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: sorted.map(d => d.dealer.length > 22 ? d.dealer.slice(0, 22) + '…' : d.dealer),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: c.axisLabel, fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: sorted.map(d => ({
          value: d.count,
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#1f6feb' },
                { offset: 1, color: '#388bfd' },
              ],
            },
            borderRadius: [0, 4, 4, 0],
          },
        })),
        label: {
          show: true,
          position: 'right',
          color: c.barLabelRight,
          fontSize: 11,
        },
        barMaxWidth: 20,
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: Math.max(240, sorted.length * 28 + 40) }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
