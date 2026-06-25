import React from 'react';
import ReactECharts from 'echarts-for-react';
import { SkeletonChart } from '../ui/Skeleton';
import { format, parseISO } from 'date-fns';

interface Props {
  data: { month: string; total: number; approved: number; rejected: number; total_amount: number }[];
  loading: boolean;
}

export default function MonthlyTrendChart({ data, loading }: Props) {
  if (loading) return <SkeletonChart height={280} />;
  if (!data?.length) {
    return <div className="flex items-center justify-center h-64 text-text-muted text-sm">No trend data available</div>;
  }

  const months = data.map(d => {
    try { return format(parseISO(`${d.month}-01`), 'MMM yy'); } catch { return d.month; }
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      className: 'echarts-tooltip-dark',
      formatter: (params: any[]) => {
        let html = `<div class="font-semibold mb-2">${params[0]?.axisValueLabel}</div>`;
        params.forEach(p => {
          html += `<div class="flex items-center gap-2 mb-0.5">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span>${p.seriesName}: <b>${p.value}</b></span>
          </div>`;
        });
        return html;
      },
    },
    legend: {
      data: ['Total', 'Approved', 'Rejected'],
      textStyle: { color: 'var(--text-secondary)', fontSize: 11 },
      itemWidth: 12,
      itemHeight: 4,
    },
    grid: { left: '2%', right: '2%', top: '12%', bottom: '4%', containLabel: true },
    xAxis: {
      type: 'category',
      data: months,
      axisLine: { lineStyle: { color: 'var(--border-default)' } },
      axisTick: { show: false },
      axisLabel: { color: 'var(--text-secondary)', fontSize: 11 },
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: 'var(--border-default)', type: 'dashed' } },
      axisLabel: { color: 'var(--text-muted)', fontSize: 11 },
    },
    series: [
      {
        name: 'Total',
        type: 'line',
        data: data.map(d => d.total),
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#58a6ff', width: 2 },
        itemStyle: { color: '#58a6ff' },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(88,166,255,0.2)' }, { offset: 1, color: 'rgba(88,166,255,0)' }] },
        },
      },
      {
        name: 'Approved',
        type: 'line',
        data: data.map(d => d.approved),
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#3fb950', width: 2 },
        itemStyle: { color: '#3fb950' },
      },
      {
        name: 'Rejected',
        type: 'line',
        data: data.map(d => d.rejected),
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#f85149', width: 2 },
        itemStyle: { color: '#f85149' },
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
