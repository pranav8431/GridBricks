import { useComputedColorScheme } from '@mantine/core';

import { axisGw, ukDayMonth, ukMinutesOfDay, ukTime } from './format';

/**
 * Chart tokens from the validated dataviz palette (light and dark are separately chosen steps).
 * Entity colours are fixed app-wide: forecast = slot 1, actual = slot 2, adjusted = slot 3.
 */
export interface ChartTokens {
  surface: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  axis: string;
  border: string;
  forecast: string;
  actual: string;
  adjusted: string;
  bandFill: string;
  context: string;
  divergingLow: string;
  divergingMid: string;
  divergingHigh: string;
  windowFill: string;
  revisionFill: string;
  procurement: string;
}

export const LIGHT: ChartTokens = {
  surface: '#ffffff',
  ink: '#0c1621',
  ink2: '#4a5868',
  muted: '#5f6d7d',
  grid: '#e3e8ee',
  axis: '#c4ccd6',
  border: 'rgba(12,22,33,0.12)',
  forecast: '#2a78d6',
  actual: '#eb6834',
  adjusted: '#1baf7a',
  bandFill: 'rgba(27,175,122,0.14)',
  context: '#c4ccd6',
  divergingLow: '#2a78d6',
  divergingMid: '#eef1f5',
  divergingHigh: '#e34948',
  windowFill: 'rgba(12,22,33,0.05)',
  revisionFill: 'rgba(42,120,214,0.18)',
  procurement: '#6250d6',
};

export const DARK: ChartTokens = {
  surface: '#0f1720',
  ink: '#e8eef5',
  ink2: '#a9b7c6',
  muted: '#8696a8',
  grid: '#1d2a38',
  axis: '#2c3c4e',
  border: 'rgba(255,255,255,0.10)',
  forecast: '#3987e5',
  actual: '#d95926',
  adjusted: '#199e70',
  bandFill: 'rgba(25,158,112,0.22)',
  context: '#3a4b5e',
  divergingLow: '#3987e5',
  divergingMid: '#1d2a38',
  divergingHigh: '#e66767',
  windowFill: 'rgba(255,255,255,0.05)',
  revisionFill: 'rgba(57,135,229,0.26)',
  procurement: '#9085e9',
};

export function useChartTokens(): ChartTokens {
  return useComputedColorScheme('light') === 'dark' ? DARK : LIGHT;
}

export const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", "Inter Variable", "Segoe UI", Roboto, sans-serif';

export function baseOption(t: ChartTokens) {
  return {
    useUTC: true,
    animationDuration: 250,
    textStyle: { fontFamily: FONT, color: t.ink2, fontSize: 12 },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      backgroundColor: t.surface,
      borderColor: t.border,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: t.ink, fontFamily: FONT, fontSize: 12 },
      extraCssText: 'box-shadow: 0 6px 24px rgba(0,0,0,0.12); border-radius: 8px;',
    },
  };
}

/** Time axis labelled in UK time: dates at midnight, clock times otherwise. */
export function ukTimeAxis(t: ChartTokens, extra: Record<string, unknown> = {}) {
  return {
    type: 'time' as const,
    axisLine: { lineStyle: { color: t.axis } },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: {
      color: t.muted,
      hideOverlap: true,
      formatter: (value: number) =>
        ukMinutesOfDay(value) === 0 ? ukDayMonth(value) : ukTime(value),
    },
    axisPointer: { lineStyle: { color: t.axis, width: 1 } },
    ...extra,
  };
}

export function gwValueAxis(t: ChartTokens, extra: Record<string, unknown> = {}) {
  return {
    type: 'value' as const,
    axisLabel: { color: t.muted, formatter: axisGw },
    splitLine: { lineStyle: { color: t.grid, width: 1 } },
    axisLine: { show: false },
    axisTick: { show: false },
    ...extra,
  };
}

/** Rounded data end, square at the baseline, for positive and negative bars alike. */
export function barRadius(value: number): [number, number, number, number] {
  return value >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4];
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
  dashed?: boolean;
  swatch?: boolean;
}

/** Tooltip body: values lead, series names follow, keyed by a short line in the series colour. */
export function tooltipHtml(title: string, rows: TooltipRow[], t: ChartTokens): string {
  const lines = rows
    .map((row) => {
      const key = row.color
        ? row.swatch
          ? `<span style="display:inline-block;width:12px;height:8px;border-radius:2px;background:${row.color};margin-right:8px"></span>`
          : `<span style="display:inline-block;width:14px;border-top:2px ${row.dashed ? 'dashed' : 'solid'} ${row.color};margin-right:8px;vertical-align:middle"></span>`
        : '<span style="display:inline-block;width:22px"></span>';
      return (
        `<div style="display:flex;align-items:center;gap:2px;margin-top:3px">${key}` +
        `<strong style="color:${t.ink};font-variant-numeric:tabular-nums;min-width:64px">${escapeHtml(row.value)}</strong>` +
        `<span style="color:${t.ink2};margin-left:6px">${escapeHtml(row.label)}</span></div>`
      );
    })
    .join('');
  return `<div style="font-weight:600;color:${t.ink};margin-bottom:2px">${escapeHtml(title)}</div>${lines}`;
}
