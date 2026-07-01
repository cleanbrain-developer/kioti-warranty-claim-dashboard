import React, { useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';
import { SkeletonChart } from '../ui/Skeleton';
import { useChartColors } from '../../hooks/useChartColors';

interface Row { month: string; count: number; total_amount: number; dealer_count: number; }

interface Props { data: Row[] | undefined; loading: boolean; }

function formatAmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function SCAClaimsChart({ data, loading }: Props) {
  const c = useChartColors();
  const navigate = useNavigate();

  const { option, totalCount, totalAmt } = useMemo(() => {
    if (!data?.length) return { option: {}, totalCount: 0, totalAmt: 0 };

    const totalCount = data.reduce((s, r) => s + r.count, 0);
    const totalAmt = data.reduce((s, r) => s + (r.total_amount || 0), 0);

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
          const row = data.find(r => r.month === bar?.axisValue);
          return `<div style="font-weight:600;margin-bottom:4px">${bar?.axisValue}</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <span>${bar?.marker}${bar?.value} SCA claims</span>
              <span>${line?.marker}${formatAmt(line?.value || 0)} claimed</span>
              ${row ? `<span style="color:${c.axisMuted};font-size:11px">${row.dealer_count} dealer${row.dealer_count !== 1 ? 's' : ''}</span>` : ''}
            </div>`;
        },
      },
      legend: {
        data: ['Claims', 'Amount'],
        textStyle: { color: c.legendText, fontSize: 10 },
        bottom: 0,
      },
      grid: { left: '2%', right: '2%', top: '8%', bottom: '40px', containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map(r => r.month),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: c.axisMuted, fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Claims',
          minInterval: 1,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: c.gridLine, type: 'dashed' } },
          axisLabel: { color: c.axisMuted, fontSize: 10 },
        },
        {
          type: 'value',
          name: 'Amount',
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { color: c.axisMuted, fontSize: 10, formatter: (v: number) => formatAmt(v) },
        },
      ],
      series: [
        {
          name: 'Claims',
          type: 'bar',
          yAxisIndex: 0,
          data: data.map(r => r.count),
          itemStyle: { color: '#a371f7', borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 40,
          label: { show: true, position: 'top', color: c.barLabelRight, fontSize: 10 },
        },
        {
          name: 'Amount',
          type: 'line',
          yAxisIndex: 1,
          data: data.map(r => r.total_amount || 0),
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: '#ffa657', width: 2 },
          itemStyle: { color: '#ffa657' },
        },
      ],
    };

    return { option, totalCount, totalAmt };
  }, [data, c]);

  const handleClick = useCallback((params: any) => {
    if (!data) return;
    const row = data[params.dataIndex];
    if (!row) return;
    const [y, m] = row.month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const dateFrom = `${row.month}-01`;
    const dateTo = `${row.month}-${String(lastDay).padStart(2, '0')}`;
    navigate(`/claims?scaOnly=true&dateField=approvedDate&dateFrom=${dateFrom}&dateTo=${dateTo}`);
  }, [data, navigate]);

  if (loading) return <SkeletonChart height={240} />;

  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        No SCA authorization claims found
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-6 mb-4">
        <div>
          <div className="text-xl font-bold text-text-primary">{totalCount.toLocaleString()}</div>
          <div className="text-xs text-text-muted">Total SCA Claims</div>
        </div>
        <div>
          <div className="text-xl font-bold text-text-primary">{formatAmt(totalAmt)}</div>
          <div className="text-xs text-text-muted">Total Amount</div>
        </div>
      </div>
      <ReactECharts
        option={option}
        style={{ height: 240 }}
        opts={{ renderer: 'canvas' }}
        onEvents={{ click: handleClick }}
      />
      <p className="text-center text-xs text-text-muted mt-1">
        Click a bar to view that month's SCA claims in the Claims tab
      </p>
    </div>
  );
}
