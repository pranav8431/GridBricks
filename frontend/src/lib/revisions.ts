import type { BriefResponse, DailyAccuracy, EvolutionResponse } from '../api/client';

/** Thresholds for flagging a meaningful run-to-run revision, as trading tools do. */
export const REVISION_ALERT_GWH = 10;
export const REVISION_ALERT_MW = 1000;

export interface RevisionSummary {
  /** Decision run minus the run before it, over the delivery day (GWh). */
  totalGwh: number;
  /** The single largest hourly change (MW), signed, and when. */
  largestMw: number;
  largestAt: string | null;
  hoursUp: number;
  hoursDown: number;
  alert: boolean;
}

export function revisionSummary(brief: BriefResponse): RevisionSummary | null {
  const pairs = brief.hours.filter(
    (h): h is typeof h & { forecast_mw: number; previous_forecast_mw: number } =>
      h.forecast_mw != null && h.previous_forecast_mw != null,
  );
  if (pairs.length === 0 || !brief.previous_run) return null;
  let total = 0;
  let largest = 0;
  let largestAt: string | null = null;
  let up = 0;
  let down = 0;
  for (const hour of pairs) {
    const delta = hour.forecast_mw - hour.previous_forecast_mw;
    total += delta;
    if (delta > 0.5) up += 1;
    if (delta < -0.5) down += 1;
    if (Math.abs(delta) > Math.abs(largest)) {
      largest = delta;
      largestAt = hour.start_time;
    }
  }
  const totalGwh = total / 1000;
  return {
    totalGwh,
    largestMw: largest,
    largestAt,
    hoursUp: up,
    hoursDown: down,
    alert: Math.abs(totalGwh) >= REVISION_ALERT_GWH || Math.abs(largest) >= REVISION_ALERT_MW,
  };
}

export type AgreementLevel = 'high' | 'moderate' | 'low';

export interface RunAgreement {
  level: AgreementLevel;
  /** Highest minus lowest energy among the compared runs, on hours all of them cover (GWh). */
  spreadGwh: number;
  /** Spread as a share of the decision run's energy on those hours. */
  spreadShare: number;
  runs: number;
}

/**
 * How closely the last few runs available at the decision agree. Small run-to-run differences
 * signal a confident forecast; large ones signal weather uncertainty.
 */
export function runAgreement(evolution: EvolutionResponse, lastRuns = 4): RunAgreement | null {
  const available = evolution.runs.filter((r) => r.available_at_decision).slice(-lastRuns);
  if (available.length < 2) return null;
  const covered = available
    .map((run) => new Set(run.points.map((p) => p.start_time)))
    .reduce((common, hours) => new Set([...common].filter((h) => hours.has(h))));
  if (covered.size === 0) return null;
  const energies = available.map(
    (run) =>
      run.points
        .filter((p) => covered.has(p.start_time))
        .reduce((sum, p) => sum + p.generation_mw, 0) / 1000,
  );
  const spread = Math.max(...energies) - Math.min(...energies);
  const reference = energies.at(-1) ?? 0;
  const share = reference > 0 ? spread / reference : 0;
  const level: AgreementLevel = share < 0.05 ? 'high' : share < 0.12 ? 'moderate' : 'low';
  return { level, spreadGwh: spread, spreadShare: share, runs: available.length };
}

const csvCell = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'number' ? value.toFixed(1) : value;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** The daily accuracy table as CSV, for spreadsheet users. */
export function dailyCsv(days: DailyAccuracy[]): string {
  const header = [
    'delivery_date',
    'decision_date',
    'forecast_gwh',
    'corrected_gwh',
    'actual_gwh',
    'error_gwh',
    'corrected_error_gwh',
    'hourly_mae_mw',
    'hourly_bias_mw',
    'share_in_range',
  ];
  const rows = days.map((d) =>
    [
      d.delivery_date,
      d.decision_date,
      d.forecast_gwh,
      d.adjusted_gwh,
      d.actual_gwh,
      d.energy_error_gwh,
      d.adjusted_energy_error_gwh,
      d.mae_mw,
      d.bias_mw,
      d.band_coverage == null ? null : d.band_coverage.toFixed(3),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n') + '\n';
}

export function downloadText(filename: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
