import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { SkeletonChart } from '../ui/Skeleton';
import { useChartColors } from '../../hooks/useChartColors';

interface Props {
  data: { model: string; count: number; amount: number }[];
  loading: boolean;
}

const COLORS = ['#58a6ff','#3fb950','#e3b341','#f85149','#a371f7','#ffa657','#39d353','#79c0ff','#d2a8ff','#ffa198','#ffb547','#56d364'];

export default function ByModelChart({ data, loading }: Props) {
  const c = useChartColors();

  if (loading) return <SkeletonChart height={300} />;
  if (!data?.length) {
    return <div className="flex items-center justify-center h-64 text-text-muted text-sm">No model data available</div>;
  }

  const { sorted, option } = useMemo(() => {
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 12);

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
    grid: { left: '2%', right: '4%', top: '4%', bottom: '12%', containLabel: true },
    xAxis: {
      type: 'category',
      data: sorted.map(d => d.model.length > 12 ? d.model.slice(0, 12) + '…' : d.model),
      axisLine: { lineStyle: { color: c.gridLine } },
      axisTick: { show: false },
      axisLabel: { color: c.axisLabel, fontSize: 11, rotate: 30, interval: 0 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: c.gridLine } },
      axisLabel: { color: c.axisMuted, fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: sorted.map((d, i) => ({
          value: d.count,
          itemStyle: { color: COLORS[i % COLORS.length], borderRadius: [4, 4, 0, 0] },
        })),
        label: {
          show: true,
          position: 'top',
          color: c.barLabelTop,
          fontSize: 10,
        },
        barMaxWidth: 40,
      },
    ],
  };

  return { sorted, option };
  }, [data, c]);

  return (
    <ReactECharts
      option={option}
      style={{ height: 300 }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
