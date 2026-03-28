"use client";

/**
 * KPI Radar Chart — Issue #1073 (UX-05)
 *
 * ECharts radar chart showing multi-KPI achievement rates in cockpit Q2.
 */

import { useRef, useEffect } from "react";
import * as echarts from "echarts/core";
import { RadarChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import { TooltipComponent } from "echarts/components";

echarts.use([RadarChart, CanvasRenderer, TooltipComponent]);

interface KPISummary {
  name: string;
  achievementRate: number;
}

export function KPIRadarChart({ kpis }: { kpis: KPISummary[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || kpis.length === 0) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const indicators = kpis.map((k) => ({
      name: k.name.length > 8 ? k.name.slice(0, 8) + "…" : k.name,
      max: 100,
    }));
    const values = kpis.map((k) => Math.min(k.achievementRate, 100));

    chartInstance.current.setOption({
      tooltip: { trigger: "item" },
      radar: {
        indicator: indicators,
        shape: "circle",
        splitNumber: 4,
        axisName: { color: "#888", fontSize: 10 },
        splitArea: { areaStyle: { color: ["rgba(99,102,241,0.02)", "rgba(99,102,241,0.05)"] } },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.2)" } },
      },
      series: [{
        type: "radar",
        data: [{
          value: values,
          name: "KPI 達成率",
          areaStyle: { color: "rgba(99,102,241,0.15)" },
          lineStyle: { color: "#6366f1", width: 2 },
          itemStyle: { color: "#6366f1" },
        }],
      }],
    });

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [kpis]);

  useEffect(() => () => chartInstance.current?.dispose(), []);

  if (kpis.length < 3) return null;

  return <div ref={chartRef} className="w-full h-48" />;
}
