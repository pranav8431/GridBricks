import { gateQueryString, parseCutoff, parseDate, parseGate } from './params';

describe('URL parameters', () => {
  it('falls back to the default gate for unknown values', () => {
    expect(parseGate('n2ex')).toBe('n2ex');
    expect(parseGate('apx')).toBe('epex_hourly');
    expect(parseGate(null)).toBe('epex_hourly');
  });

  it('accepts only valid cutoffs before delivery starts', () => {
    expect(parseCutoff('10:45')).toBe('10:45');
    expect(parseCutoff('9:45')).toBeUndefined();
    expect(parseCutoff('23:30')).toBeUndefined();
  });

  it('keeps dates inside the allowed range', () => {
    expect(parseDate('2026-01-14', '2026-01-01', '2026-01-31')).toBe('2026-01-14');
    expect(parseDate('2026-02-14', '2026-01-01', '2026-01-31')).toBeUndefined();
    expect(parseDate('14/01/2026')).toBeUndefined();
  });

  it('omits defaults from shareable links', () => {
    expect(gateQueryString({ gate: 'epex_hourly', cutoff: undefined })).toBe('');
    expect(gateQueryString({ gate: 'n2ex', cutoff: undefined }, { date: '2026-01-14' })).toBe(
      '?gate=n2ex&date=2026-01-14',
    );
  });
});
