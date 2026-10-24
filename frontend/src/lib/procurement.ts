import type { BriefResponse } from '../api/client';

/** Which wind estimate the desk plans its purchase on. */
export type PlanBasis = 'published' | 'corrected' | 'cautious';

export const PLAN_LABELS: Record<PlanBasis, string> = {
  published: 'Published forecast',
  corrected: 'Corrected estimate (P50)',
  cautious: 'Low-wind case (P10)',
};

export interface ProcurementHour {
  start_time: string;
  wind_mw: number;
  buy_mw: number;
  cautious_buy_mw: number;
}

export interface ProcurementPlan {
  basis: PlanBasis;
  hours: ProcurementHour[];
  /** Energy to buy over the delivery day on the chosen basis (GWh). */
  buyGwh: number;
  /** Energy to buy if wind lands at its low-wind (P10) case. */
  cautiousBuyGwh: number;
  /** Extra volume the low-wind case needs beyond the chosen plan: the hedge to consider. */
  bufferGwh: number;
  /** What planning on the raw published forecast would buy, for comparison. */
  publishedBuyGwh: number;
  peakBuyMw: number;
  peakAt: string | null;
}

const windFor = (hour: BriefResponse['hours'][number], basis: PlanBasis): number | null => {
  if (basis === 'published') return hour.forecast_mw;
  if (basis === 'corrected') return hour.p50_mw ?? hour.forecast_mw;
  return hour.p10_mw ?? hour.forecast_mw;
};

/**
 * Residual volume to procure: demand minus the wind the desk plans on, hour by hour.
 * Demand is the user's own assumption; the pilot uses no demand data.
 */
export function procurementPlan(
  brief: BriefResponse,
  demandMw: number,
  basis: PlanBasis,
): ProcurementPlan | null {
  if (!Number.isFinite(demandMw) || demandMw < 0) return null;
  const hours: ProcurementHour[] = [];
  let published = 0;
  for (const hour of brief.hours) {
    const wind = windFor(hour, basis);
    const cautiousWind = windFor(hour, 'cautious');
    if (wind == null || cautiousWind == null || hour.forecast_mw == null) continue;
    hours.push({
      start_time: hour.start_time,
      wind_mw: wind,
      buy_mw: Math.max(demandMw - wind, 0),
      cautious_buy_mw: Math.max(demandMw - cautiousWind, 0),
    });
    published += Math.max(demandMw - hour.forecast_mw, 0);
  }
  if (hours.length === 0) return null;
  const buy = hours.reduce((sum, h) => sum + h.buy_mw, 0) / 1000;
  const cautious = hours.reduce((sum, h) => sum + h.cautious_buy_mw, 0) / 1000;
  const peak = hours.reduce(
    (best, h) => (h.buy_mw > best.buy_mw ? h : best),
    hours[0] as ProcurementHour,
  );
  return {
    basis,
    hours,
    buyGwh: buy,
    cautiousBuyGwh: cautious,
    bufferGwh: Math.max(cautious - buy, 0),
    publishedBuyGwh: published / 1000,
    peakBuyMw: peak.buy_mw,
    peakAt: peak.start_time,
  };
}
