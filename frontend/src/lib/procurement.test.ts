import { brief } from '../test/fixtures';
import { procurementPlan } from './procurement';

describe('procurementPlan', () => {
  it('buys demand minus the wind planned on, hour by hour', () => {
    const plan = procurementPlan(brief, 30_000, 'published');
    expect(plan?.hours).toHaveLength(24);
    const first = brief.hours[0];
    expect(plan?.hours[0]?.buy_mw).toBeCloseTo(30_000 - (first?.forecast_mw ?? 0));
    expect(plan?.buyGwh).toBeCloseTo(plan?.publishedBuyGwh ?? -1);
  });

  it('the corrected plan buys more than trusting the over-forecast published one', () => {
    const corrected = procurementPlan(brief, 30_000, 'corrected');
    const published = procurementPlan(brief, 30_000, 'published');
    expect(corrected?.buyGwh).toBeGreaterThan(published?.buyGwh ?? Infinity);
  });

  it('the low-wind case defines the hedge on top of the plan', () => {
    const plan = procurementPlan(brief, 30_000, 'corrected');
    expect(plan?.cautiousBuyGwh).toBeGreaterThanOrEqual(plan?.buyGwh ?? Infinity);
    expect(plan?.bufferGwh).toBeCloseTo((plan?.cautiousBuyGwh ?? 0) - (plan?.buyGwh ?? 0));
    expect(procurementPlan(brief, 30_000, 'cautious')?.bufferGwh).toBeCloseTo(0);
  });

  it('never buys negative volume when wind exceeds demand', () => {
    const plan = procurementPlan(brief, 1_000, 'published');
    expect(plan?.hours.every((h) => h.buy_mw >= 0)).toBe(true);
    expect(plan?.buyGwh).toBe(0);
  });

  it('rejects invalid demand', () => {
    expect(procurementPlan(brief, Number.NaN, 'corrected')).toBeNull();
    expect(procurementPlan(brief, -5, 'corrected')).toBeNull();
  });
});
