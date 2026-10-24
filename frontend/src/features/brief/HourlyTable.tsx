import { Table } from '@mantine/core';

import type { BriefResponse } from '../../api/client';
import { hoursLabel, mw, signedMw, ukTime } from '../../lib/format';

/** Table twin of the delivery chart: one row per hourly product. */
export function HourlyTable({ brief, reveal }: { brief: BriefResponse; reveal: boolean }) {
  return (
    <Table.ScrollContainer minWidth={720}>
      <Table striped highlightOnHover className="gb-tabular" fz="sm" verticalSpacing={4}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Product (UK)</Table.Th>
            <Table.Th ta="right">Forecast MW</Table.Th>
            <Table.Th ta="right">P10 MW</Table.Th>
            <Table.Th ta="right">P50 MW</Table.Th>
            <Table.Th ta="right">P90 MW</Table.Th>
            <Table.Th ta="right">Previous run MW</Table.Th>
            <Table.Th ta="right">Lead time</Table.Th>
            {reveal ? <Table.Th ta="right">Actual MW</Table.Th> : null}
            {reveal ? <Table.Th ta="right">Error MW</Table.Th> : null}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {brief.hours.map((hour) => {
            const start = Date.parse(hour.start_time);
            return (
              <Table.Tr key={hour.start_time}>
                <Table.Td>
                  {ukTime(start)}–{ukTime(start + 3_600_000)}
                </Table.Td>
                <Table.Td ta="right">{mw(hour.forecast_mw)}</Table.Td>
                <Table.Td ta="right">{mw(hour.p10_mw)}</Table.Td>
                <Table.Td ta="right">{mw(hour.p50_mw)}</Table.Td>
                <Table.Td ta="right">{mw(hour.p90_mw)}</Table.Td>
                <Table.Td ta="right">{mw(hour.previous_forecast_mw)}</Table.Td>
                <Table.Td ta="right">{hoursLabel(hour.horizon_h)}</Table.Td>
                {reveal ? <Table.Td ta="right">{mw(hour.actual_mw)}</Table.Td> : null}
                {reveal ? <Table.Td ta="right">{signedMw(hour.error_mw)}</Table.Td> : null}
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
