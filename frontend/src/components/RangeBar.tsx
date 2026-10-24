import { Group, Text } from '@mantine/core';

import { gwh } from '../lib/format';

interface RangeBarProps {
  forecast: number;
  p10: number | null | undefined;
  p50: number | null | undefined;
  p90: number | null | undefined;
  actual?: number | null | undefined;
}

const pct = (value: number, total: number) => `${((value / total) * 100).toFixed(2)}%`;

/** Daily energy on one scale: published forecast, error-adjusted estimate, likely range, actual. */
export function RangeBar({ forecast, p10, p50, p90, actual }: RangeBarProps) {
  const values = [forecast, p10, p50, p90, actual].filter((v): v is number => v != null);
  // Zoom to the values so differences are visible; the scale labels show where it starts.
  const step = 50;
  const min = Math.max(0, Math.floor((Math.min(...values) * 0.9) / step) * step);
  const max = Math.ceil((Math.max(...values) * 1.06) / step) * step;
  const span = max - min || step;
  const pos = (value: number) => pct(value - min, span);
  const keys = [
    { label: 'Published forecast', value: forecast, color: 'var(--gb-forecast)' },
    ...(p50 != null ? [{ label: 'Error-adjusted', value: p50, color: 'var(--gb-adjusted)' }] : []),
    ...(actual != null ? [{ label: 'Actual', value: actual, color: 'var(--gb-actual)' }] : []),
  ];
  const summary =
    `Published forecast ${gwh(forecast)}` +
    (p50 != null ? `, error-adjusted ${gwh(p50)}` : '') +
    (p10 != null && p90 != null ? `, likely range ${gwh(p10)} to ${gwh(p90)}` : '') +
    (actual != null ? `, actual ${gwh(actual)}` : '');

  return (
    <div>
      <div className="gb-range" role="img" aria-label={summary}>
        <div className="gb-range-track" />
        {p10 != null && p90 != null ? (
          <div className="gb-range-band" style={{ left: pos(p10), width: pct(p90 - p10, span) }} />
        ) : null}
        {keys.map((key) => (
          <div
            key={key.label}
            className="gb-range-marker"
            style={{ left: pos(key.value), background: key.color }}
          />
        ))}
      </div>
      <div className="gb-range-scale" aria-hidden>
        <span>{gwh(min)}</span>
        <span>{gwh((min + max) / 2)}</span>
        <span>{gwh(max)}</span>
      </div>
      <Group gap="lg" mt="sm" wrap="wrap">
        {keys.map((key) => (
          <Text key={key.label} size="sm" c="var(--gb-ink-2)">
            <span className="gb-key" style={{ background: key.color }} />
            {key.label}{' '}
            <Text span fw={600} c="var(--gb-ink)">
              {gwh(key.value)}
            </Text>
          </Text>
        ))}
        {p10 != null && p90 != null ? (
          <Text size="sm" c="var(--gb-ink-2)">
            <span
              className="gb-key"
              style={{ background: 'color-mix(in srgb, var(--gb-adjusted) 35%, transparent)' }}
            />
            Likely range{' '}
            <Text span fw={600} c="var(--gb-ink)">
              {gwh(p10)} – {gwh(p90)}
            </Text>
          </Text>
        ) : null}
      </Group>
    </div>
  );
}
