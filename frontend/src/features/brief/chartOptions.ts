/** ECharts option builders for the brief page: pure functions of API data and chart tokens. */
import type { BriefResponse, EvolutionResponse } from '../../api/client';
import type { LegendItem } from '../../components/ChartCard';
import type { ChartOption } from '../../components/EChart';
import {
  baseOption,
  gwValueAxis,
  tooltipHtml,
  ukTimeAxis,
  type ChartTokens,
  type TooltipRow,
} from '../../lib/chartTheme';
import { gw, ukDateTime, ukDayMonth, ukTime } from '../../lib/format';

const HOUR = 3_600_000;
const ms = (iso: string) => Date.parse(iso);

export function deliveryLegend(t: ChartTokens, reveal: boolean): LegendItem[] {
  return [
    { label: 'Published forecast (at decision)', color: t.forecast, kind: 'line' },
    { label: 'Error-adjusted estimate (P50)', color: t.adjusted, kind: 'dashed' },
    { label: 'Likely range (P10–P90)', color: t.bandFill, kind: 'area' },
    ...(reveal ? [{ label: 'Actual outturn', color: t.actual, kind: 'line' as const }] : []),
  ];
}

const marker = (t: ChartTokens, color: string) => ({
  symbol: 'circle',
  symbolSize: 8,
  showSymbol: false,
  itemStyle: { color, borderColor: t.surface, borderWidth: 2 },
});

export function deliveryOption(brief: BriefResponse, reveal: boolean, t: ChartTokens): ChartOption {
  const hours = brief.hours;
  const byHour = new Map(hours.map((h) => [ms(h.start_time), h]));
  const actualAt = new Map(brief.actuals.map((p) => [ms(p.start_time), p.generation_mw]));
  const base = baseOption(t);

  const formatter = (params: unknown): string => {
    const first = (params as { axisValue?: number }[])[0];
    if (first?.axisValue === undefined) return '';
    const x = first.axisValue;
    const hourStart = Math.floor(x / HOUR) * HOUR;
    const hour = byHour.get(hourStart);
    const rows: TooltipRow[] = [];
    if (reveal) {
      rows.push({
        label: 'Actual outturn',
        value: gw(actualAt.get(x) ?? actualAt.get(hourStart)),
        color: t.actual,
      });
    }
    rows.push(
      { label: 'Published forecast', value: gw(hour?.forecast_mw), color: t.forecast },
      { label: 'Error-adjusted (P50)', value: gw(hour?.p50_mw), color: t.adjusted, dashed: true },
      {
        label: 'Likely range (P10–P90)',
        value: `${gw(hour?.p10_mw)} – ${gw(hour?.p90_mw)}`,
        color: t.adjusted,
        swatch: true,
      },
    );
    const title = `${ukDayMonth(hourStart)} ${ukTime(hourStart)}–${ukTime(hourStart + HOUR)}`;
    return tooltipHtml(title, rows, t);
  };

  return {
    ...base,
    tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'line' }, formatter },
    xAxis: ukTimeAxis(t, { min: ms(brief.delivery_start), max: ms(brief.delivery_end) }),
    yAxis: gwValueAxis(t, { min: 0 }),
    series: [
      {
        name: 'P10',
        type: 'line',
        stack: 'band',
        data: hours.map((h) => [ms(h.start_time), h.p10_mw]),
        symbol: 'none',
        lineStyle: { opacity: 0 },
        silent: true,
      },
      {
        name: 'Likely range (P10–P90)',
        type: 'line',
        stack: 'band',
        data: hours.map((h) => [
          ms(h.start_time),
          h.p10_mw != null && h.p90_mw != null ? h.p90_mw - h.p10_mw : null,
        ]),
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: t.bandFill, opacity: 1 },
        silent: true,
      },
      {
        name: 'Error-adjusted (P50)',
        type: 'line',
        data: hours.map((h) => [ms(h.start_time), h.p50_mw]),
        lineStyle: { color: t.adjusted, width: 2, type: 'dashed' },
        ...marker(t, t.adjusted),
        z: 3,
      },
      {
        name: 'Published forecast',
        type: 'line',
        data: hours.map((h) => [ms(h.start_time), h.forecast_mw]),
        lineStyle: { color: t.forecast, width: 2 },
        ...marker(t, t.forecast),
        z: 4,
      },
      ...(reveal
        ? [
            {
              name: 'Actual outturn',
              type: 'line',
              data: brief.actuals.map((p) => [ms(p.start_time), p.generation_mw]),
              lineStyle: { color: t.actual, width: 2 },
              ...marker(t, t.actual),
              z: 5,
            },
          ]
        : []),
    ],
  };
}

export function evolutionLegend(
  t: ChartTokens,
  evo: EvolutionResponse,
  reveal: boolean,
): LegendItem[] {
  const used = evo.runs.find((r) => r.is_decision_run);
  return [
    {
      label: used ? `Run used at decision (${ukTime(used.publish_time)})` : 'Run used at decision',
      color: t.forecast,
      kind: 'line',
    },
    { label: 'Earlier runs', color: t.context, kind: 'line' },
    { label: 'Later runs, not available at decision', color: t.context, kind: 'dashed' },
    ...(reveal ? [{ label: 'Actual outturn', color: t.actual, kind: 'line' as const }] : []),
  ];
}

export function evolutionOption(
  evo: EvolutionResponse,
  reveal: boolean,
  t: ChartTokens,
): ChartOption {
  const base = baseOption(t);
  const runValues = evo.runs.map((run) => ({
    run,
    values: new Map(run.points.map((p) => [ms(p.start_time), p.generation_mw])),
  }));
  const actualAt = new Map(evo.actuals.map((p) => [ms(p.start_time), p.generation_mw]));

  const formatter = (params: unknown): string => {
    const first = (params as { axisValue?: number }[])[0];
    if (first?.axisValue === undefined) return '';
    const x = first.axisValue;
    const hour = Math.floor(x / 3_600_000) * 3_600_000;
    const present = runValues
      .map(({ run, values }) => ({ run, value: values.get(hour) }))
      .filter(
        (entry): entry is { run: (typeof entry)['run']; value: number } =>
          entry.value !== undefined,
      );
    const decision = present.find((entry) => entry.run.is_decision_run);
    const latest = present.at(-1);
    const values = present.map((entry) => entry.value);
    const rows: TooltipRow[] = [];
    if (reveal)
      rows.push({
        label: 'Actual outturn',
        value: gw(actualAt.get(x) ?? actualAt.get(hour)),
        color: t.actual,
      });
    rows.push({ label: 'Run used at decision', value: gw(decision?.value), color: t.forecast });
    if (latest && latest !== decision) {
      rows.push({
        label: `Latest run (${ukTime(latest.run.publish_time)})`,
        value: gw(latest.value),
        color: t.context,
        dashed: true,
      });
    }
    if (values.length > 1) {
      rows.push({
        label: `Spread across ${values.length} runs`,
        value: `${gw(Math.min(...values))} – ${gw(Math.max(...values))}`,
      });
    }
    return tooltipHtml(ukDateTime(hour), rows, t);
  };

  const runSeries = evo.runs.map((run) => ({
    name: `Run ${run.publish_time}`,
    type: 'line',
    data: run.points.map((p) => [ms(p.start_time), p.generation_mw]),
    symbol: 'none',
    silent: true,
    z: run.is_decision_run ? 3 : 1,
    lineStyle: run.is_decision_run
      ? { color: t.forecast, width: 2.5 }
      : { color: t.context, width: 1, type: run.available_at_decision ? 'solid' : 'dashed' },
    endLabel: run.is_decision_run
      ? { show: true, formatter: `${ukTime(run.publish_time)} run`, color: t.ink2, fontSize: 11 }
      : { show: false },
  }));

  return {
    ...base,
    grid: { ...base.grid, right: 72 },
    tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'line' }, formatter },
    xAxis: ukTimeAxis(t, { min: ms(evo.delivery_start), max: ms(evo.delivery_end) }),
    yAxis: gwValueAxis(t, { scale: true }),
    series: [
      ...runSeries,
      ...(reveal
        ? [
            {
              name: 'Actual outturn',
              type: 'line',
              data: evo.actuals.map((p) => [ms(p.start_time), p.generation_mw]),
              symbol: 'none',
              lineStyle: { color: t.actual, width: 2 },
              z: 4,
            },
          ]
        : []),
    ],
  };
}
