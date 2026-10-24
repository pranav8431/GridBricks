import type { AccuracyResponse, GateComparison } from '../../api/client';
import { comparisonInsight, improvement } from './insights';

const gate = (id: string, time: string, mae: number, run: string): GateComparison => ({
  gate: { id, label: id, venue: 'x', gate_closure_uk: time, is_custom: false, description: null },
  typical_run_uk: run,
  horizon_min_h: 10,
  horizon_max_h: 30,
  mae_mw: mae,
  rmse_mw: mae,
  bias_mw: 0,
  adjusted_mae_mw: null,
  band_coverage: null,
});

describe('insights', () => {
  it('computes relative improvement', () => {
    expect(improvement(2000, 1400)).toBeCloseTo(0.3);
    expect(improvement(0, 10)).toBe(0);
  });

  it('contrasts waiting with correcting', () => {
    const rows = [
      gate('epex_hourly', '09:20', 2019, '07:30'),
      gate('epex_halfhourly', '15:30', 1880, '11:30'),
    ];
    const accuracy = {
      published: { mae_mw: 2019 },
      adjusted: { mae_mw: 1411 },
    } as unknown as AccuracyResponse;
    expect(comparisonInsight(rows, accuracy)).toBe(
      'Waiting from 09:20 to 15:30 (the 11:30 run) cuts the average error by 7%. ' +
        'Correcting the forecast with its recent errors cuts it by 30%.',
    );
  });
});
