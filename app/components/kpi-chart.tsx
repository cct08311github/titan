"use client";

import { useRef, useEffect } from "react";
import * as echarts from "echarts/core";
import { GaugeChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import { TooltipComponent } from "echarts/components";

echarts.use([GaugeChart, CanvasRenderer, TooltipComponent]);

interface KPIChartProps {
  target: number;
  actual: number;
  unit?: string | null;
  /** 0-100 */
  achievementRate: number;
}

function getColor(rate: number): string {
  if (rate >= 90) return "#22c55e"; // green
  if (rate >= 60) return "#eab308"; // yellow
  return "#ef4444"; // red
}

/**
 * KPI 環形圖 — 顯示達成率
 * 使用 ECharts gauge chart
 */
export function KPIChart({ target, actual, unit, achievementRate }: KPIChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const color = getColor(achievementRate);

    chartInstance.current.setOption({
      series: [
        {
          type: "gauge",
          startAngle: 90,
          endAngle: -270,
          radius: "90%",
          pointer: { show: false },
          progress: {
            show: true,
            overlap: false,
            roundCap: true,
            clip: false,
            itemStyle: { color },
          },
          axisLine: {
            lineStyle: {
              width: 12,
              color: [[1, "rgba(128,128,128,0.15)"]],
            },
          },
          splitLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: false },
          data: [
            {
              value: Math.min(achievementRate, 100),
              detail: {
                valueAnimation: true,
                offsetCenter: ["0%", "0%"],
                fontSize: 18,
                fontWeight: "bold",
                formatter: `{value}%`,
                color,
              },
            },
          ],
          title: { show: false },
          detail: {
            width: 50,
            height: 14,
            fontSize: 14,
            color: "auto",
          },
        },
      ],
    });

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [achievementRate, target, actual, unit]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  return <div ref={chartRef} className="w-full h-32" />;
}
