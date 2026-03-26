"use client";

import { useRef, useEffect } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from "echarts/components";

echarts.use([BarChart, CanvasRenderer, TooltipComponent, GridComponent, LegendComponent]);

/** Consistent category colors across charts */
const CATEGORY_COLORS: Record<string, string> = {
  PLANNED_TASK: "#6366f1", // indigo
  ADDED_TASK: "#f59e0b",   // amber
  INCIDENT: "#ef4444",     // red
  SUPPORT: "#06b6d4",      // cyan
  ADMIN: "#8b5cf6",        // violet
  LEARNING: "#22c55e",     // green
};

const CATEGORY_LABELS: Record<string, string> = {
  PLANNED_TASK: "計畫任務",
  ADDED_TASK: "新增任務",
  INCIDENT: "事件處理",
  SUPPORT: "支援",
  ADMIN: "行政",
  LEARNING: "學習",
};

export interface TimesheetDistributionData {
  users: string[];
  categories: string[];
  /** Matrix: categories[i] → hours per user. series[categoryIndex][userIndex] = hours */
  series: Record<string, number[]>;
}

interface TimesheetDistributionChartProps {
  data: TimesheetDistributionData;
}

/**
 * R-2: Stacked bar chart — X axis = users, Y axis = hours,
 * each color = a time category. ECharts.
 */
export function TimesheetDistributionChart({ data }: TimesheetDistributionChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const seriesData = data.categories.map((cat) => ({
      name: CATEGORY_LABELS[cat] ?? cat,
      type: "bar" as const,
      stack: "total",
      emphasis: { focus: "series" as const },
      data: data.series[cat] ?? [],
      itemStyle: {
        color: CATEGORY_COLORS[cat] ?? "#94a3b8",
      },
    }));

    chartInstance.current.setOption({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: Array<{ seriesName: string; value: number; name: string; color: string }>) => {
          if (!params.length) return "";
          let total = 0;
          let html = `<strong>${params[0].name}</strong><br/>`;
          for (const p of params) {
            if (p.value > 0) {
              html += `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px;"></span>`;
              html += `${p.seriesName}：${p.value.toFixed(1)} h<br/>`;
              total += p.value;
            }
          }
          html += `<br/><strong>合計：${total.toFixed(1)} h</strong>`;
          return html;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { fontSize: 11, color: "#888" },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "15%",
        top: "5%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: data.users,
        axisLabel: {
          fontSize: 11,
          color: "#888",
          rotate: data.users.length > 8 ? 30 : 0,
        },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          formatter: "{value} h",
          fontSize: 11,
          color: "#888",
        },
      },
      series: seriesData,
    }, true);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [data]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  return <div ref={chartRef} className="w-full h-96" />;
}
