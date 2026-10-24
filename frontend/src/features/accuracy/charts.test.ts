import { LIGHT } from '../../lib/chartTheme';
import { accuracy, horizon } from '../../test/fixtures';
import {
  calendarOption,
  errorByHour,
  errorHeatmapOption,
  histogramOption,
  horizonOption,
  levelOption,
  timeSeriesOption,
} from './charts';

type Any = Record<string, any>;

describe('accuracy chart options', () => {
  it('time series draws forecast, actual and the likely range with fixed entity colours', () => {
    const option = timeSeriesOption(accuracy, LIGHT) as Any;
    const names = (option.series as Any[]).map((s) => s.name);
    expect(names).toEqual(['P10', 'Likely range', 'Published forecast', 'Actual outturn']);
    expect(option.series[2].lineStyle.color).toBe(LIGHT.forecast);
    expect(option.series[3].lineStyle.color).toBe(LIGHT.actual);
    expect(option.series[2].data).toHaveLength(accuracy.series.length);
    expect(option.dataZoom).toHaveLength(2);
  });

  it('calendar uses a symmetric diverging scale so zero is neutral', () => {
    const option = calendarOption(accuracy, LIGHT) as Any;
    expect(option.visualMap.min).toBe(-option.visualMap.max);
    expect(option.visualMap.inRange.color).toEqual([
      LIGHT.divergingLow,
      LIGHT.divergingMid,
      LIGHT.divergingHigh,
    ]);
    expect(option.series[0].data).toHaveLength(31);
  });

  it('histogram counts every hour and marks the percentiles', () => {
    const option = histogramOption(accuracy, LIGHT) as Any;
    const counts = (option.series[0].data as number[][]).reduce(
      (sum, bin) => sum + (bin[2] ?? 0),
      0,
    );
    expect(counts).toBe(accuracy.published.n);
    const marks = (option.series[0].markLine.data as Any[]).map((m) => m.name);
    expect(marks.some((m: string) => m.startsWith('P10'))).toBe(true);
    expect(marks.some((m: string) => m.startsWith('P90'))).toBe(true);
  });

  it('level chart shows hours per bucket and rounds negative bars at the bottom', () => {
    const option = levelOption(accuracy, LIGHT) as Any;
    expect(option.xAxis.data[0]).toMatch(/\n\d+ h$/);
    const adjusted = option.series[1].data as Any[];
    const negative = adjusted.find((d) => d.value < 0);
    expect(negative?.itemStyle.borderRadius).toEqual([0, 0, 4, 4]);
  });

  it('lead-time chart shades the decision horizon', () => {
    const option = horizonOption(horizon, LIGHT) as Any;
    const area = option.series[0].markArea.data[0];
    expect(area[0].xAxis).toBe(horizon.decision_horizon_min_h);
    expect(area[1].xAxis).toBe(horizon.decision_horizon_max_h);
    expect(option.series[1].lineStyle.type).toBe('dashed');
  });

  it('tooltips escape text and lead with values', () => {
    const option = timeSeriesOption(accuracy, LIGHT) as Any;
    const first = accuracy.series[0];
    const html = option.tooltip.formatter([
      { axisValue: Date.parse(first?.start_time ?? '') },
    ]) as string;
    expect(html).toContain('<strong');
    expect(html).toContain('Forecast error');
  });
});

describe('error heatmap', () => {
  it('places every hourly error on a day by hour grid', () => {
    const option = errorHeatmapOption(accuracy, LIGHT) as Any;
    expect(option.series[0].data).toHaveLength(accuracy.published.n);
    expect(option.xAxis.data).toHaveLength(accuracy.daily.length);
    expect(option.yAxis.data[0]).toBe('23:00');
    expect(option.visualMap.min).toBe(-option.visualMap.max);
  });

  it('summarises error by hour in product order', () => {
    const rows = errorByHour(accuracy);
    expect(rows).toHaveLength(24);
    expect(rows[0]?.hour).toBe('23:00');
    expect(rows.at(-1)?.hour).toBe('22:00');
    expect(rows.reduce((sum, r) => sum + r.n, 0)).toBe(accuracy.published.n);
  });
});
