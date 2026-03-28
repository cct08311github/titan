"use client";

/**
 * Task Distribution Pie Chart — Issue #1073 (UX-05)
 *
 * ECharts pie chart showing task status distribution in cockpit Q1.
 */

import { useRef, useEffect } from "react";
import * as echarts from "echarts/core";
import { PieChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import { TooltipComponent, LegendComponent } from "echarts/components";

echarts.use([PieChart, CanvasRenderer, TooltipComponent, LegendComponent]);

interface TaskDistribution {
  backlog: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  overdue: number;
}

const STATUS_MAP: { key: keyof TaskDistribution; label: string; color: string }[] = [
  { key: "backlog", label: "待排", color: "#94a3b8" },
  { key: "todo", label: "待辦", color: "#60a5fa" },
  { key: "inProgress", label: "進行中", color: "#fbbf24" },
  { key: "review", label: "審核中", color: "#a78bfa" },
  { key: "done", label: "已完成", color: "#34d399" },
  { key: "overdue", label: "逾期", color: "#f87171" },
];

export function TaskDistributionPie({ data }: { data: TaskDistribution }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const seriesData = STATUS_MAP
      .filter((s) => data[s.key] > 0)
      .map((s) => ({ name: s.label, value: data[s.key], itemStyle: { color: s.color } }));

    chartInstance.current.setOption({
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: { bottom: 0, textStyle: { fontSize: 11, color: "#888" } },
      series: [{
        type: "pie",
        radius: ["40%", "70%"],
        center: ["50%", "42%"],
        avoidLabelOverlap: true,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 12, fontWeight: "bold" } },
        data: seriesData,
      }],
    });

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [data]);

  useEffect(() => () => chartInstance.current?.dispose(), []);

  return <div ref={chartRef} className="w-full h-48" />;
}
