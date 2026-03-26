"use client";

import { useRef, useEffect } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from "echarts/components";

echarts.use([LineChart, CanvasRenderer, TooltipComponent, GridComponent, LegendComponent]);

export interface CompletionDataPoint {
  label: string;
  completionRate: number;
  completedCount: number;
  totalCount: number;
}

interface CompletionRateChartProps {
  data: CompletionDataPoint[];
  granularity: "week" | "month";
  /** Optional: member filter display label */
  memberLabel?: string;
}

/**
 * R-1: Task completion rate line chart (ECharts).
 * Shows completion rate trend over weeks or months.
 * Empty periods show 0% (no broken lines).
 */
export function CompletionRateChart({ data, granularity, memberLabel }: CompletionRateChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const labels = data.map((d) => d.label);
    const rates = data.map((d) => d.completionRate);

    chartInstance.current.setOption({
      tooltip: {
        trigger: "axis",
        formatter: (params: { dataIndex: number; name: string; value: number }[]) => {
          const p = params[0];
          if (!p) return "";
          const d = data[p.dataIndex];
          return `<strong>${p.name}</strong><br/>` +
            `完成率：${d.completionRate}%<br/>` +
            `完成：${d.completedCount} / ${d.totalCount} 件`;
        },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: {
          fontSize: 11,
          color: "#888",
          rotate: granularity === "week" && labels.length > 12 ? 45 : 0,
        },
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: {
          formatter: "{value}%",
          fontSize: 11,
          color: "#888",
        },
      },
      series: [
        {
          name: memberLabel ?? "任務完成率",
          type: "line",
          data: rates,
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { width: 2.5 },
          areaStyle: {
            opacity: 0.15,
          },
          connectNulls: false,
          itemStyle: {
            color: "#6366f1",
          },
        },
      ],
    });

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [data, granularity, memberLabel]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  return <div ref={chartRef} className="w-full h-80" />;
}
