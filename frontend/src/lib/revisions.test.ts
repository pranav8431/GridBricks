import { accuracy, brief, evolution } from '../test/fixtures';
import { dailyCsv, revisionSummary, runAgreement } from './revisions';

describe('revisionSummary', () => {
  it('reports an unchanged run as stable', () => {
    const summary = revisionSummary(brief);
    expect(summary).not.toBeNull();
    expect(Math.abs(summary?.totalGwh ?? 1)).toBeLessThan(0.5);
    expect(summary?.alert).toBe(false);
  });

  it('flags a large revision and finds the biggest hourly move', () => {
    const hours = brief.hours.map((h, i) => ({
      ...h,
      previous_forecast_mw: (h.forecast_mw ?? 0) + (i === 5 ? 1500 : 400),
    }));
    const summary = revisionSummary({ ...brief, hours });
    expect(summary?.alert).toBe(true);
    expect(summary?.largestMw).toBe(-1500);
    expect(summary?.largestAt).toBe(brief.hours[5]?.start_time);
    expect(summary?.hoursDown).toBe(24);
    expect(summary?.totalGwh).toBeCloseTo(-(23 * 0.4 + 1.5));
  });

  it('returns null without a previous run', () => {
    expect(revisionSummary({ ...brief, previous_run: null })).toBeNull();
  });
});

describe('runAgreement', () => {
  it('compares the last runs available at the decision on their common hours', () => {
    const agreement = runAgreement(evolution);
    expect(agreement).not.toBeNull();
    expect(agreement?.runs).toBe(4);
    expect(agreement?.spreadGwh).toBeGreaterThanOrEqual(0);
    expect(['high', 'moderate', 'low']).toContain(agreement?.level);
  });

  it('needs at least two runs', () => {
    expect(runAgreement({ ...evolution, runs: evolution.runs.slice(0, 1) })).toBeNull();
  });
});

describe('dailyCsv', () => {
  it('writes one row per day under a stable header', () => {
    const lines = dailyCsv(accuracy.daily).trim().split('\n');
    expect(lines[0]).toBe(
      'delivery_date,decision_date,forecast_gwh,corrected_gwh,actual_gwh,error_gwh,corrected_error_gwh,hourly_mae_mw,hourly_bias_mw,share_in_range',
    );
    expect(lines).toHaveLength(accuracy.daily.length + 1);
    expect(lines[1]?.startsWith('2026-01-02,2026-01-01,')).toBe(true);
  });
});
