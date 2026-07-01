import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { SkeletonChart } from '../ui/Skeleton';
import { format, parseISO } from 'date-fns';
import { useChartColors } from '../../hooks/useChartColors';

interface Props {
  data: { month: string; total: number; approved: number; total_amount: number }[];
  loading: boolean;
}

export default function MonthlyTrendChart({ data, loading }: Props) {
  const c = useChartColors();

  if (loading) return <SkeletonChart height={280} />;
  if (!data?.length) {
    return <div className="flex items-center justify-center h-64 text-text-muted text-sm">No trend data available</div>;
  }

  const option = useMemo(() => {
  const months = data.map(d => {
    try { return format(parseISO(`${d.month}-01`), 'MMM yy'); } catch { return d.month; }
  });

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: c.tooltipText, fontSize: 13 },
      formatter: (params: any[]) => {
        let html = `<div style="color:${c.tooltipText};font-weight:600;margin-bottom:6px">${params[0]?.axisValueLabel}</div>`;
        params.forEach(p => {
          html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;color:${c.tooltipText}">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span>${p.seriesName}: <b>${p.value}</b></span>
          </div>`;
        });
        return html;
      },
    },
    legend: {
      data: ['Total', 'Approved'],
      textStyle: { color: c.legendText, fontSize: 11 },
      itemWidth: 12,
      itemHeight: 4,
    },
    grid: { left: '2%', right: '2%', top: '12%', bottom: '4%', containLabel: true },
    xAxis: {
      type: 'category',
      data: months,
      axisLine: { lineStyle: { color: c.gridLine } },
      axisTick: { show: false },
      axisLabel: { color: c.axisLabel, fontSize: 11 },
      boundaryGap: false,
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
    ],
  };
  }, [data, c]);

  return (
    <ReactECharts
      option={option}
      style={{ height: 280 }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
