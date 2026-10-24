import { BarChart, CustomChart, HeatmapChart, LineChart } from 'echarts/charts';
import {
  AriaComponent,
  CalendarComponent,
  DataZoomComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

// Register only what the app uses, so the chart bundle stays small.
echarts.use([
  LineChart,
  BarChart,
  CustomChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  CalendarComponent,
  VisualMapComponent,
  AriaComponent,
  SVGRenderer,
]);

export type ChartOption = echarts.EChartsCoreOption;
type Handler = (params: unknown) => void;

interface EChartProps {
  option: ChartOption;
  height: number;
  /** Plain-language summary for screen readers; the card's table view has the full values. */
  label: string;
  onEvents?: Record<string, Handler>;
}

export function EChart({ option, height, label, onEvents }: EChartProps) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return undefined;
    const instance = echarts.init(element, undefined, { renderer: 'svg' });
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(
      { aria: { enabled: true, label: { enabled: false } }, ...option },
      {
        notMerge: true,
      },
    );
  }, [option]);

  useEffect(() => {
    const instance = chart.current;
    if (!instance || !onEvents) return undefined;
    for (const [name, handler] of Object.entries(onEvents)) instance.on(name, handler);
    return () => {
      for (const [name, handler] of Object.entries(onEvents)) instance.off(name, handler);
    };
  }, [onEvents]);

  return <div ref={container} style={{ width: '100%', height }} role="img" aria-label={label} />;
}
