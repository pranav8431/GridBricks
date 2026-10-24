import { Anchor, Badge, Table, Text } from '@mantine/core';
import { Link } from 'react-router';

import type {
  AccuracyResponse,
  DailyAccuracy,
  GateComparison,
  HorizonResponse,
} from '../../api/client';
import type { GateSelection } from '../../api/queries';
import { calendarDate, gw, gwh, hoursLabel, pct, signedGw, signedGwh } from '../../lib/format';
import { gateQueryString } from '../../lib/params';

export function GateComparisonTable({
  rows,
  selectedId,
}: {
  rows: GateComparison[];
  selectedId: string;
}) {
  return (
    <Table.ScrollContainer minWidth={760}>
      <Table className="gb-tabular" fz="sm" verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Decision time</Table.Th>
            <Table.Th>Run used</Table.Th>
            <Table.Th ta="right">Lead time</Table.Th>
            <Table.Th ta="right">MAE published</Table.Th>
            <Table.Th ta="right">Bias</Table.Th>
            <Table.Th ta="right">MAE adjusted</Table.Th>
            <Table.Th ta="right">Range coverage</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr
              key={`${row.gate.id}-${row.gate.gate_closure_uk}`}
              bg={row.gate.id === selectedId ? 'var(--mantine-color-default-hover)' : undefined}
            >
              <Table.Td>
                {row.gate.label}
                {row.gate.id === selectedId ? (
                  <Badge ml="xs" size="xs" variant="light" tt="none">
                    selected
                  </Badge>
                ) : null}
              </Table.Td>
              <Table.Td>{row.typical_run_uk ?? '—'}</Table.Td>
              <Table.Td ta="right">
                {hoursLabel(row.horizon_min_h)}–{hoursLabel(row.horizon_max_h)}
              </Table.Td>
              <Table.Td ta="right">{gw(row.mae_mw, 2)}</Table.Td>
              <Table.Td ta="right">{signedGw(row.bias_mw, 2)}</Table.Td>
              <Table.Td ta="right">{gw(row.adjusted_mae_mw, 2)}</Table.Td>
              <Table.Td ta="right">{pct(row.band_coverage, 1)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export function DailyTable({
  days,
  selection,
}: {
  days: DailyAccuracy[];
  selection: GateSelection;
}) {
  return (
    <Table.ScrollContainer minWidth={720}>
      <Table striped highlightOnHover className="gb-tabular" fz="sm" verticalSpacing={4}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Delivery day</Table.Th>
            <Table.Th ta="right">Forecast</Table.Th>
            <Table.Th ta="right">Actual</Table.Th>
            <Table.Th ta="right">Error</Table.Th>
            <Table.Th ta="right">After adjustment</Table.Th>
            <Table.Th ta="right">Hourly MAE</Table.Th>
            <Table.Th ta="right">In range</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {days.map((day) => (
            <Table.Tr key={day.delivery_date}>
              <Table.Td>
                <Anchor
                  component={Link}
                  to={`/brief${gateQueryString(selection, { date: day.decision_date, reveal: '1' })}`}
                  size="sm"
                >
                  {calendarDate(day.delivery_date)}
                </Anchor>
              </Table.Td>
              <Table.Td ta="right">{gwh(day.forecast_gwh)}</Table.Td>
              <Table.Td ta="right">{gwh(day.actual_gwh)}</Table.Td>
              <Table.Td ta="right">{signedGwh(day.energy_error_gwh)}</Table.Td>
              <Table.Td ta="right">{signedGwh(day.adjusted_energy_error_gwh)}</Table.Td>
              <Table.Td ta="right">{gw(day.mae_mw, 2)}</Table.Td>
              <Table.Td ta="right">{pct(day.band_coverage)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export function HistogramTable({ accuracy }: { accuracy: AccuracyResponse }) {
  return (
    <Table className="gb-tabular" fz="sm" verticalSpacing={2} striped>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Hourly error</Table.Th>
          <Table.Th ta="right">Hours</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {accuracy.histogram
          .filter((bin) => bin.count > 0)
          .map((bin) => (
            <Table.Tr key={bin.lower_mw}>
              <Table.Td>
                {signedGw(bin.lower_mw)} to {signedGw(bin.upper_mw)}
              </Table.Td>
              <Table.Td ta="right">{bin.count}</Table.Td>
            </Table.Tr>
          ))}
      </Table.Tbody>
    </Table>
  );
}

export function LevelTable({ accuracy }: { accuracy: AccuracyResponse }) {
  return (
    <Table className="gb-tabular" fz="sm" verticalSpacing={4} striped>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Forecast level</Table.Th>
          <Table.Th ta="right">Hours</Table.Th>
          <Table.Th ta="right">Bias</Table.Th>
          <Table.Th ta="right">MAE</Table.Th>
          <Table.Th ta="right">Adjusted bias</Table.Th>
          <Table.Th ta="right">Adjusted MAE</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {accuracy.by_level.map((bucket) => (
          <Table.Tr key={bucket.label}>
            <Table.Td>{bucket.label}</Table.Td>
            <Table.Td ta="right">{bucket.n}</Table.Td>
            <Table.Td ta="right">{signedGw(bucket.bias_mw, 2)}</Table.Td>
            <Table.Td ta="right">{gw(bucket.mae_mw, 2)}</Table.Td>
            <Table.Td ta="right">{signedGw(bucket.adjusted_bias_mw, 2)}</Table.Td>
            <Table.Td ta="right">{gw(bucket.adjusted_mae_mw, 2)}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

export function HorizonTable({ horizon }: { horizon: HorizonResponse }) {
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table className="gb-tabular" fz="sm" verticalSpacing={2} striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Lead time</Table.Th>
            <Table.Th ta="right">Forecasts</Table.Th>
            <Table.Th ta="right">MAE</Table.Th>
            <Table.Th ta="right">Bias</Table.Th>
            <Table.Th ta="right">P10 error</Table.Th>
            <Table.Th ta="right">P90 error</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {horizon.buckets.map((bucket) => (
            <Table.Tr key={bucket.lower_h}>
              <Table.Td>
                {hoursLabel(bucket.lower_h, 0)}–{hoursLabel(bucket.upper_h, 0)}
              </Table.Td>
              <Table.Td ta="right">{bucket.n.toLocaleString('en-GB')}</Table.Td>
              <Table.Td ta="right">{gw(bucket.mae_mw, 2)}</Table.Td>
              <Table.Td ta="right">{signedGw(bucket.bias_mw, 2)}</Table.Td>
              <Table.Td ta="right">{signedGw(bucket.error_p10_mw, 2)}</Table.Td>
              <Table.Td ta="right">{signedGw(bucket.error_p90_mw, 2)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export function SeriesNote({ accuracy }: { accuracy: AccuracyResponse }) {
  return (
    <Text size="xs" c="var(--gb-ink-2)">
      {accuracy.series.length.toLocaleString('en-GB')} hourly products. Drag the slider or scroll to
      zoom.
    </Text>
  );
}
