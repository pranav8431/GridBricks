import type { BriefResponse } from '../../api/client';
import type { ChartOption } from '../../components/EChart';
import {
  baseOption,
  gwValueAxis,
  tooltipHtml,
  ukTimeAxis,
  type ChartTokens,
} from '../../lib/chartTheme';
import { gw, ukDayMonth, ukTime } from '../../lib/format';
import type { ProcurementPlan } from '../../lib/procurement';

export const DEFAULT_DEMAND_MW = 30_000;

export function procurementOption(
  plan: ProcurementPlan,
  brief: BriefResponse,
  t: ChartTokens,
): ChartOption {
  const base = baseOption(t);
  const ms = (iso: string) => Date.parse(iso);
  const byHour = new Map(plan.hours.map((h) => [ms(h.start_time), h]));
  return {
    ...base,
    tooltip: {
      ...base.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: t.windowFill } },
      formatter: (params: unknown) => {
        const x = (params as { axisValue?: number }[])[0]?.axisValue;
        const hour = x === undefined ? undefined : byHour.get(x);
        if (x === undefined || !hour) return '';
        return tooltipHtml(
          `${ukDayMonth(x)} ${ukTime(x)}`,
          [
            {
              label: 'To buy on this plan',
              value: gw(hour.buy_mw, 2),
              color: t.procurement,
              swatch: true,
            },
            {
              label: 'To buy if wind is low (P10)',
              value: gw(hour.cautious_buy_mw, 2),
              color: t.ink2,
              dashed: true,
            },
            { label: 'Wind planned on', value: gw(hour.wind_mw, 2) },
          ],
          t,
        );
      },
    },
    xAxis: ukTimeAxis(t, {
      min: ms(brief.delivery_start) - 1_800_000,
      max: ms(brief.delivery_end) - 1_800_000,
    }),
    yAxis: gwValueAxis(t, { min: 0 }),
    series: [
      {
        name: 'To buy',
        type: 'bar',
        barMaxWidth: 24,
        data: plan.hours.map((h) => [ms(h.start_time), h.buy_mw]),
        itemStyle: { color: t.procurement, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'Low-wind case',
        type: 'line',
        step: 'middle',
        data: plan.hours.map((h) => [ms(h.start_time), h.cautious_buy_mw]),
        symbol: 'none',
        lineStyle: { color: t.ink2, width: 1.5, type: 'dashed' },
      },
    ],
  };
}
