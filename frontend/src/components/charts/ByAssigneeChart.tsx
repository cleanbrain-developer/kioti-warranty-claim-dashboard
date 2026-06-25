import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';
import { SkeletonChart } from '../ui/Skeleton';
import { useChartColors } from '../../hooks/useChartColors';

interface AssigneeRow {
  assignee: string;
  total: number;
  open: number;
  approved: number;
  rejected: number;
  pending: number;
}

interface Props {
  data: AssigneeRow[];
  loading: boolean;
}

const BAR_COLORS = [
  '#58a6ff', '#a371f7', '#ff7875', '#4fc3f7', '#81c995',
  '#ffb74d', '#f06292', '#4db6ac', '#ba68c8', '#90a4ae',
];

export default function ByAssigneeChart({ data, loading }: Props) {
  const navigate = useNavigate();
  const c = useChartColors();

  if (loading) return <SkeletonChart height={Math.max(280, 30 + 36 * 10)} />;

  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        No assignee data available
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => a.open - b.open).slice(0, 20);
  const names = sorted.map(d => d.assignee);
  const openValues = sorted.map(d => d.open);

  const chartHeight = Math.max(320, 60 + sorted.length * 36);

  const option = {
    backgroundColor: 'transparent',
    grid: { left: 130, right: 60, top: 16, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: c.tooltipText, fontSize: 13 },
      formatter: (params: any[]) => {
        const idx = params[0].dataIndex;
        const row = sorted[idx];
        return `<div style="color:${c.tooltipText}">
          <div style="font-weight:600;margin-bottom:6px">${row.assignee}</div>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <span style="color:#58a6ff">Open: <b>${row.open}</b></span>
            <span style="color:#3fb950">Approved: <b>${row.approved}</b></span>
            <span style="color:#f85149">Rejected: <b>${row.rejected}</b></span>
            <span style="color:#e3b341">Pending: <b>${row.pending}</b></span>
          </div>
          <div style="margin-top:4px;color:${c.axisMuted}">Total: <b>${row.total}</b></div>
        </div>`;
      },
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: c.axisMuted, fontSize: 11 },
      splitLine: { lineStyle: { color: c.gridLine, opacity: 0.6 } },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: {
        color: c.axisLabel,
        fontSize: 11,
        width: 120,
        overflow: 'truncate',
      },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        name: 'Open',
        type: 'bar',
        data: openValues.map((v, i) => ({
          value: v,
          itemStyle: { color: BAR_COLORS[i % BAR_COLORS.length], borderRadius: [0, 4, 4, 0] },
        })),
        label: {
          show: true,
          position: 'right',
          color: c.barLabelRight,
          fontSize: 11,
          formatter: (p: any) => p.value > 0 ? p.value : '',
        },
        barMaxWidth: 28,
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
        },
      },
    ],
  };

  const handleClick = (params: any) => {
    const assignee = names[params.dataIndex];
    if (assignee && assignee !== 'Unassigned') {
      navigate(`/claims?assignee=${encodeURIComponent(assignee)}&openOnly=true`);
    }
  };

  return (
    <div>
      <ReactECharts
        option={option}
        style={{ height: chartHeight }}
        opts={{ renderer: 'canvas' }}
        onEvents={{ click: handleClick }}
      />
      <p className="text-center text-xs text-text-muted mt-1">
        Click a bar to view open claims by assignee
      </p>
    </div>
  );
}
