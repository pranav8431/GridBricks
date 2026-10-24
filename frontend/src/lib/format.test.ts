import {
  addDays,
  axisGw,
  calendarDate,
  duration,
  gw,
  gwh,
  hoursLabel,
  mw,
  pct,
  signed,
  signedGw,
  signedMw,
  ukDateTime,
  ukMinutesOfDay,
  ukTime,
} from './format';

describe('UK time formatting', () => {
  it('shows GMT instants unchanged in winter', () => {
    expect(ukTime('2026-01-14T07:30:00Z')).toBe('07:30');
    expect(ukDateTime('2026-01-14T23:00:00Z')).toBe('14 Jan 23:00');
  });

  it('shifts to BST in summer', () => {
    expect(ukTime('2026-06-14T08:20:00Z')).toBe('09:20');
    expect(ukMinutesOfDay('2026-06-14T08:20:00Z')).toBe(9 * 60 + 20);
  });

  it('formats calendar dates without timezone drift or locale punctuation', () => {
    expect(calendarDate('2026-01-14')).toBe('Wed 14 Jan 2026');
    expect(calendarDate('2026-01-14', false)).toBe('Wed 14 Jan');
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('number formatting', () => {
  it('uses a true minus sign and no sign for zero', () => {
    expect(signed(-1.25, 1)).toBe('−1.3');
    expect(signed(0.04, 1)).toBe('0.0');
    expect(signedGw(1747)).toBe('+1.7 GW');
    expect(signedMw(-1234.4)).toBe('−1,234');
  });

  it('formats power and energy', () => {
    expect(gw(20_190, 2)).toBe('20.19 GW');
    expect(mw(12_345.6)).toBe('12,346');
    expect(gwh(285.6)).toBe('286 GWh');
    expect(pct(0.825, 1)).toBe('82.5%');
    expect(axisGw(2500)).toBe('2.5 GW');
    expect(hoursLabel(15.5)).toBe('15.5 h');
    expect(hoursLabel(38)).toBe('38 h');
  });

  it('shows a dash for missing values', () => {
    expect(gw(null)).toBe('—');
    expect(gwh(undefined)).toBe('—');
    expect(pct(Number.NaN)).toBe('—');
  });

  it('formats durations in hours and minutes', () => {
    expect(duration(110)).toBe('1 h 50 min');
    expect(duration(10)).toBe('10 min');
    expect(duration(-120)).toBe('2 h');
  });
});
