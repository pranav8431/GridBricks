/** ECharts option builders for the accuracy page: pure functions of API data and tokens. */
import type { AccuracyResponse, HorizonResponse } from '../../api/client';
import type { ChartOption } from '../../components/EChart';
import {
  barRadius,
  baseOption,
  gwValueAxis,
  tooltipHtml,
  ukTimeAxis,
  type ChartTokens,
  type TooltipRow,
} from '../../lib/chartTheme';
import {
  calendarDate,
  gw,
  gwh,
  hoursLabel,
  signedGw,
  signedGwh,
  ukDateTime,
  ukTime,
  UK_TZ,
} from '../../lib/format';

const ms = (iso: string) => Date.parse(iso);
const first = (params: unknown) => (params as { axisValue?: number }[])[0];

export function timeSeriesOption(acc: AccuracyResponse, t: ChartTokens): ChartOption {
  const base = baseOption(t);
  const byTime = new Map(acc.series.map((row) => [ms(row.start_time), row]));
  const formatter = (params: unknown): string => {
    const x = first(params)?.axisValue;
    const row = x === undefined ? undefined : byTime.get(x);
    if (x === undefined || !row) return '';
    const error =
      row.forecast_mw != null && row.actual_mw != null ? row.forecast_mw - row.actual_mw : null;
    const rows: TooltipRow[] = [
      { label: 'Actual outturn', value: gw(row.actual_mw), color: t.actual },
      { label: 'Published forecast', value: gw(row.forecast_mw), color: t.forecast },
      { label: 'Error-adjusted (P50)', value: gw(row.p50_mw), color: t.adjusted, dashed: true },
      {
        label: 'Likely range',
        value: `${gw(row.p10_mw)} – ${gw(row.p90_mw)}`,
        color: t.adjusted,
        swatch: true,
      },
      { label: 'Forecast error', value: signedGw(error) },
    ];
    return tooltipHtml(ukDateTime(x), rows, t);
  };
  const series = acc.series;
  return {
    ...base,
    grid: { ...base.grid, bottom: 56 },
    tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'line' }, formatter },
    xAxis: ukTimeAxis(t),
    yAxis: gwValueAxis(t, { min: 0 }),
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
      {
        type: 'slider',
        xAxisIndex: 0,
        height: 22,
        bottom: 8,
        filterMode: 'none',
        borderColor: t.border,
        backgroundColor: 'transparent',
        fillerColor: t.windowFill,
        dataBackground: { lineStyle: { color: t.axis }, areaStyle: { color: t.windowFill } },
        handleStyle: { color: t.surface, borderColor: t.axis },
        moveHandleStyle: { color: t.axis },
        textStyle: { color: t.muted },
        labelFormatter: (value: number) => ukDateTime(value),
      },
    ],
    series: [
      {
        name: 'P10',
        type: 'line',
        stack: 'band',
        data: series.map((r) => [ms(r.start_time), r.p10_mw]),
        symbol: 'none',
        lineStyle: { opacity: 0 },
        silent: true,
      },
      {
        name: 'Likely range',
        type: 'line',
        stack: 'band',
        data: series.map((r) => [
          ms(r.start_time),
          r.p10_mw != null && r.p90_mw != null ? r.p90_mw - r.p10_mw : null,
        ]),
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: t.bandFill, opacity: 1 },
        silent: true,
      },
      {
        name: 'Published forecast',
        type: 'line',
        data: series.map((r) => [ms(r.start_time), r.forecast_mw]),
        showSymbol: false,
        symbolSize: 8,
        lineStyle: { color: t.forecast, width: 1.5 },
        itemStyle: { color: t.forecast, borderColor: t.surface, borderWidth: 2 },
      },
      {
        name: 'Actual outturn',
        type: 'line',
        data: series.map((r) => [ms(r.start_time), r.actual_mw]),
        showSymbol: false,
        symbolSize: 8,
        lineStyle: { color: t.actual, width: 1.5 },
        itemStyle: { color: t.actual, borderColor: t.surface, borderWidth: 2 },
      },
    ],
  };
}

export function calendarOption(acc: AccuracyResponse, t: ChartTokens): ChartOption {
  const base = baseOption(t);
  const days = acc.daily.filter((d) => d.energy_error_gwh != null);
  const peak = Math.max(25, ...days.map((d) => Math.abs(d.energy_error_gwh ?? 0)));
  const limit = Math.ceil(peak / 25) * 25;
  const byDate = new Map(acc.daily.map((d) => [d.delivery_date, d]));
  return {
    ...base,
    tooltip: {
      ...base.tooltip,
      trigger: 'item',
      formatter: (params: unknown) => {
        const value = (params as { value?: [string, number] }).value;
        const day = value ? byDate.get(value[0]) : undefined;
        if (!day) return '';
        return tooltipHtml(
          `Delivery ${calendarDate(day.delivery_date, false)}`,
          [
            { label: 'Energy error (forecast − actual)', value: signedGwh(day.energy_error_gwh) },
            { label: 'After error adjustment', value: signedGwh(day.adjusted_energy_error_gwh) },
            { label: 'Forecast', value: gwh(day.forecast_gwh) },
            { label: 'Actual', value: gwh(day.actual_gwh) },
            { label: 'Click to open the brief', value: '' },
          ],
          t,
        );
      },
    },
    visualMap: {
      type: 'continuous',
      min: -limit,
      max: limit,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 10,
      itemHeight: 180,
      text: ['Over-forecast: desk short', 'Under-forecast: desk long'],
      textGap: 10,
      textStyle: { color: t.ink2, fontSize: 11 },
      inRange: { color: [t.divergingLow, t.divergingMid, t.divergingHigh] },
      formatter: (value: number) => `${Math.round(value)} GWh`,
    },
    calendar: {
      range: [acc.delivery_from, acc.delivery_to],
      orient: 'horizontal',
      top: 28,
      left: 36,
      right: 12,
      bottom: 64,
      cellSize: ['auto', 30],
      splitLine: { show: false },
      itemStyle: { color: t.surface, borderColor: t.surface, borderWidth: 2 },
      dayLabel: { firstDay: 1, nameMap: 'en', color: t.muted, fontSize: 11 },
      monthLabel: { color: t.ink2, nameMap: 'en', fontSize: 11 },
      yearLabel: { show: false },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        cursor: 'pointer',
        data: days.map((d) => {
          const value = d.energy_error_gwh ?? 0;
          return {
            value: [d.delivery_date, Number(value.toFixed(1))],
            itemStyle: { borderRadius: 4 },
            label: { color: Math.abs(value) / limit > 0.55 ? '#ffffff' : t.ink },
          };
        }),
        label: {
          show: true,
          fontSize: 11,
          formatter: (params: { value?: [string, number] }) =>
            params.value ? String(Number(params.value[0].slice(8))) : '',
        },
        emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 1 } },
      },
    ],
  };
}

export function histogramOption(acc: AccuracyResponse, t: ChartTokens): ChartOption {
  const base = baseOption(t);
  const bins = acc.histogram;
  const p = acc.published;
  const marks = [
    { value: p.error_p10_mw, label: 'P10' },
    { value: p.error_p50_mw, label: 'Median' },
    { value: p.error_p90_mw, label: 'P90' },
  ];
  return {
    ...base,
    grid: { ...base.grid, top: 28, right: 28 },
    tooltip: {
      ...base.tooltip,
      trigger: 'item',
      formatter: (params: unknown) => {
        const value = (params as { value?: [number, number, number] }).value;
        if (!value) return '';
        return tooltipHtml(
          `Error ${signedGw(value[0])} to ${signedGw(value[1])}`,
          [{ label: 'hours', value: String(value[2]), color: t.forecast, swatch: true }],
          t,
        );
      },
    },
    xAxis: {
      type: 'value',
      min: bins[0]?.lower_mw,
      max: bins.at(-1)?.upper_mw,
      axisLabel: { color: t.muted, formatter: (v: number) => (v === 0 ? '0' : signedGw(v, 0)) },
      axisLine: { lineStyle: { color: t.axis } },
      splitLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: t.muted },
      splitLine: { lineStyle: { color: t.grid } },
    },
    series: [
      {
        type: 'custom',
        name: 'Hours',
        data: bins.map((b) => [b.lower_mw, b.upper_mw, b.count]),
        encode: { x: [0, 1], y: 2 },
        renderItem: (
          _params: unknown,
          api: { value: (i: number) => number; coord: (p: [number, number]) => [number, number] },
        ) => {
          const [x0, y0] = api.coord([api.value(0), api.value(2)]);
          const [x1, y1] = api.coord([api.value(1), 0]);
          const width = Math.max(1, x1 - x0 - 2);
          return {
            type: 'rect',
            shape: { x: x0 + 1, y: y0, width, height: y1 - y0, r: [4, 4, 0, 0] },
            style: { fill: t.forecast },
          };
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: t.ink2, width: 1, type: 'solid' },
          label: { color: t.ink2, fontSize: 11, formatter: '{b}' },
          data: [
            { xAxis: 0, name: '', lineStyle: { color: t.axis }, label: { show: false } },
            ...marks.map((m) => ({ xAxis: m.value, name: `${m.label} ${signedGw(m.value)}` })),
          ],
        },
      },
    ],
  };
}

export function levelOption(acc: AccuracyResponse, t: ChartTokens): ChartOption {
  const base = baseOption(t);
  const levels = acc.by_level.filter((b) => b.n > 0);
  const bar = (
    key: 'bias_mw' | 'adjusted_bias_mw',
    color: string,
    name: string,
    label: boolean,
  ) => ({
    name,
    type: 'bar',
    barMaxWidth: 24,
    barGap: '15%',
    data: levels.map((b) => {
      const value = b[key] ?? 0;
      return { value, itemStyle: { color, borderRadius: barRadius(value) } };
    }),
    label: label
      ? {
          show: true,
          position: 'top',
          color: t.ink2,
          fontSize: 11,
          formatter: (p: { value: number }) => signedGw(p.value),
        }
      : { show: false },
  });
  return {
    ...base,
    grid: { ...base.grid, top: 28 },
    tooltip: {
      ...base.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: t.windowFill } },
      formatter: (params: unknown) => {
        const index = (params as { dataIndex?: number }[])[0]?.dataIndex ?? 0;
        const bucket = levels[index];
        if (!bucket) return '';
        return tooltipHtml(
          `Forecast ${bucket.label} · ${bucket.n} hours`,
          [
            {
              label: 'Published bias',
              value: signedGw(bucket.bias_mw),
              color: t.forecast,
              swatch: true,
            },
            {
              label: 'Error-adjusted bias',
              value: signedGw(bucket.adjusted_bias_mw),
              color: t.adjusted,
              swatch: true,
            },
            { label: 'Published MAE', value: gw(bucket.mae_mw) },
            { label: 'Error-adjusted MAE', value: gw(bucket.adjusted_mae_mw) },
          ],
          t,
        );
      },
    },
    xAxis: {
      type: 'category',
      data: levels.map((b) => `${b.label}\n${b.n.toLocaleString('en-GB')} h`),
      axisLabel: { color: t.muted, lineHeight: 16 },
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
    },
    yAxis: gwValueAxis(t),
    series: [
      bar('bias_mw', t.forecast, 'Published forecast', true),
      bar('adjusted_bias_mw', t.adjusted, 'Error-adjusted', false),
    ],
  };
}

export function horizonOption(h: HorizonResponse, t: ChartTokens): ChartOption {
  const base = baseOption(t);
  const mid = (b: { lower_h: number; upper_h: number }) => (b.lower_h + b.upper_h) / 2;
  const byMid = new Map(h.buckets.map((b) => [mid(b), b]));
  const window =
    h.decision_horizon_min_h != null && h.decision_horizon_max_h != null
      ? [
          [
            { xAxis: h.decision_horizon_min_h, name: 'Your decision horizon' },
            { xAxis: h.decision_horizon_max_h },
          ],
        ]
      : [];
  return {
    ...base,
    grid: { ...base.grid, top: 32 },
    tooltip: {
      ...base.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params: unknown) => {
        const x = first(params)?.axisValue;
        const bucket = x === undefined ? undefined : byMid.get(x);
        if (!bucket) return '';
        return tooltipHtml(
          `${hoursLabel(bucket.lower_h, 0)}–${hoursLabel(bucket.upper_h, 0)} ahead · ${bucket.n.toLocaleString('en-GB')} forecasts`,
          [
            { label: 'Mean absolute error', value: gw(bucket.mae_mw, 2), color: t.forecast },
            {
              label: 'Bias (mean error)',
              value: signedGw(bucket.bias_mw, 2),
              color: t.forecast,
              dashed: true,
            },
            {
              label: '80% of errors between',
              value: `${signedGw(bucket.error_p10_mw)} and ${signedGw(bucket.error_p90_mw)}`,
            },
          ],
          t,
        );
      },
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: 72,
      interval: 12,
      axisLabel: { color: t.muted, formatter: (v: number) => `${v} h` },
      axisLine: { lineStyle: { color: t.axis } },
      splitLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: gwValueAxis(t, { min: 0 }),
    series: [
      {
        name: 'Mean absolute error',
        type: 'line',
        data: h.buckets.map((b) => [mid(b), b.mae_mw]),
        lineStyle: { color: t.forecast, width: 2 },
        itemStyle: { color: t.forecast, borderColor: t.surface, borderWidth: 2 },
        symbolSize: 8,
        showSymbol: false,
        markArea: {
          silent: true,
          itemStyle: { color: t.windowFill },
          label: { color: t.ink2, fontSize: 11, position: 'insideTop' },
          data: window,
        },
      },
      {
        name: 'Bias',
        type: 'line',
        data: h.buckets.map((b) => [mid(b), b.bias_mw]),
        lineStyle: { color: t.forecast, width: 2, type: 'dashed' },
        itemStyle: { color: t.forecast, borderColor: t.surface, borderWidth: 2 },
        symbolSize: 8,
        showSymbol: false,
      },
    ],
  };
}

const deliveryDay = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: UK_TZ }).format(
    new Date(Date.parse(iso) + 3_600_000),
  );

export interface HourlyErrorRow {
  hour: string;
  n: number;
  meanErrorMw: number;
  meanAbsErrorMw: number;
}

/** Mean error by delivery hour (UK), in product order from 23:00: the table twin of the heatmap. */
export function errorByHour(acc: AccuracyResponse): HourlyErrorRow[] {
  const groups = new Map<string, number[]>();
  for (const row of acc.series) {
    if (row.forecast_mw == null || row.actual_mw == null) continue;
    const hour = ukTime(row.start_time);
    groups.set(hour, [...(groups.get(hour) ?? []), row.forecast_mw - row.actual_mw]);
  }
  const order = (h: string) => (Number(h.slice(0, 2)) + 1) % 24;
  return [...groups.entries()]
    .sort(([a], [b]) => order(a) - order(b))
    .map(([hour, errors]) => ({
      hour,
      n: errors.length,
      meanErrorMw: errors.reduce((a, b) => a + b, 0) / errors.length,
      meanAbsErrorMw: errors.reduce((a, b) => a + Math.abs(b), 0) / errors.length,
    }));
}

/** Error for every delivery hour of every day: shows when in the day and the month misses cluster. */
export function errorHeatmapOption(acc: AccuracyResponse, t: ChartTokens): ChartOption {
  const base = baseOption(t);
  const days = acc.daily.map((d) => d.delivery_date);
  const hours = errorByHour(acc).map((r) => r.hour);
  const cells: [number, number, number][] = [];
  for (const row of acc.series) {
    if (row.forecast_mw == null || row.actual_mw == null) continue;
    const x = days.indexOf(deliveryDay(row.start_time));
    const y = hours.indexOf(ukTime(row.start_time));
    if (x >= 0 && y >= 0) cells.push([x, y, Math.round(row.forecast_mw - row.actual_mw)]);
  }
  const peak = Math.max(1000, ...cells.map((c) => Math.abs(c[2])));
  const limit = Math.ceil(peak / 1000) * 1000;
  return {
    ...base,
    grid: { ...base.grid, top: 8, bottom: 56, left: 8 },
    tooltip: {
      ...base.tooltip,
      trigger: 'item',
      formatter: (params: unknown) => {
        const value = (params as { value?: [number, number, number] }).value;
        if (!value) return '';
        const day = days[value[0]] ?? '';
        return tooltipHtml(
          `Delivery ${calendarDate(day, false)} · ${hours[value[1]] ?? ''}`,
          [{ label: 'Forecast error (forecast − actual)', value: signedGw(value[2], 2) }],
          t,
        );
      },
    },
    xAxis: {
      type: 'category',
      data: days.map((d) => String(Number(d.slice(8)))),
      axisLabel: { color: t.muted, interval: 1 },
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
      splitArea: { show: false },
    },
    yAxis: {
      type: 'category',
      data: hours,
      inverse: true,
      axisLabel: { color: t.muted, interval: 2 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    visualMap: {
      type: 'continuous',
      min: -limit,
      max: limit,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 10,
      itemHeight: 180,
      text: ['Over-forecast', 'Under-forecast'],
      textStyle: { color: t.ink2, fontSize: 11 },
      inRange: { color: [t.divergingLow, t.divergingMid, t.divergingHigh] },
      formatter: (value: number) => signedGw(value, 1),
    },
    series: [
      {
        type: 'heatmap',
        data: cells,
        itemStyle: { borderColor: t.surface, borderWidth: 1 },
        emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 1 } },
      },
    ],
  };
}
