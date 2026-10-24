import type { AccuracyResponse, GateComparison } from '../../api/client';
import { pct } from '../../lib/format';

/** Relative improvement from ``before`` to ``after`` (0.3 = 30% smaller). */
export function improvement(before: number, after: number): number {
  return before === 0 ? 0 : (before - after) / before;
}

/** "Waiting until 15:30 cuts MAE by 7%; correcting the bias cuts it by 30%." */
export function comparisonInsight(
  rows: GateComparison[],
  accuracy: AccuracyResponse,
): string | null {
  const presets = rows.filter((r) => !r.gate.is_custom);
  const earliest = presets[0];
  const latest = presets.at(-1);
  if (!earliest || !latest || !accuracy.adjusted) return null;
  const wait = improvement(earliest.mae_mw, latest.mae_mw);
  const correct = improvement(accuracy.published.mae_mw, accuracy.adjusted.mae_mw);
  return (
    `Waiting from ${earliest.gate.gate_closure_uk} to ${latest.gate.gate_closure_uk} ` +
    `(the ${latest.typical_run_uk ?? 'later'} run) cuts the average error by ${pct(wait)}. ` +
    `Correcting the forecast with its recent errors cuts it by ${pct(correct)}.`
  );
}
