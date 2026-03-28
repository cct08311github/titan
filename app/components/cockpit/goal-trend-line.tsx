"use client";

/**
 * Goal Completion Trend Line Chart — Issue #1073 (UX-05)
 *
 * ECharts line chart showing monthly goal completion rate in cockpit Q4.
 */

import { useRef, useEffect } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import { TooltipComponent, GridComponent } from "echarts/components";

echarts.use([LineChart, CanvasRenderer, TooltipComponent, GridComponent]);

interface GoalSummary {
  month: number;
  taskCount: number;
  completedTaskCount: number;
}

export function GoalTrendLine({ goals }: { goals: GoalSummary[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || goals.length === 0) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const sorted = [...goals].sort((a, b) => a.month - b.month);
    const months = sorted.map((g) => `${g.month}月`);
    const rates = sorted.map((g) =>
      g.taskCount > 0 ? Math.round((g.completedTaskCount / g.taskCount) * 100) : 0
    );

    chartInstance.current.setOption({
      tooltip: { trigger: "axis", formatter: "{b}: {c}%" },
      grid: { top: 10, right: 10, bottom: 25, left: 35 },
      xAxis: { type: "category", data: months, axisLabel: { fontSize: 10, color: "#888" }, axisLine: { lineStyle: { color: "#e2e8f0" } } },
      yAxis: { type: "value", max: 100, axisLabel: { fontSize: 10, color: "#888", formatter: "{value}%" }, splitLine: { lineStyle: { color: "rgba(148,163,184,0.15)" } } },
      series: [{
        type: "line",
        data: rates,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: "#8b5cf6", width: 2 },
        itemStyle: { color: "#8b5cf6" },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "rgba(139,92,246,0.2)" },
          { offset: 1, color: "rgba(139,92,246,0.02)" },
        ]) },
      }],
    });

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [goals]);

  useEffect(() => () => chartInstance.current?.dispose(), []);

  if (goals.length === 0) return null;

  return <div ref={chartRef} className="w-full h-48" />;
}
