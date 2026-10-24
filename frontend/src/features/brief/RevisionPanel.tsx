import { Badge, Group, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react';
import { useMemo } from 'react';

import type { BriefResponse, EvolutionResponse } from '../../api/client';
import { ChartCard } from '../../components/ChartCard';
import { EChart } from '../../components/EChart';
import { useChartTokens } from '../../lib/chartTheme';
import { gw, mw, pct, signedGwh, signedMw, ukTime } from '../../lib/format';
import { revisionSummary, runAgreement, type AgreementLevel } from '../../lib/revisions';
import { revisionLegend, revisionOption } from './chartOptions';

const agreementCopy: Record<AgreementLevel, { label: string; color: string }> = {
  high: { label: 'High agreement', color: 'green' },
  moderate: { label: 'Moderate agreement', color: 'yellow' },
  low: { label: 'Low agreement', color: 'red' },
};

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="var(--gb-ink-2)">
        {label}
      </Text>
      <Text className="gb-stat-value" fz={22}>
        {value}
      </Text>
      {note ? (
        <Text size="xs" c="var(--gb-muted)">
          {note}
        </Text>
      ) : null}
    </Stack>
  );
}

/** Run-to-run revisions and run agreement: how much the forecast moved, and how settled it is. */
export function RevisionPanel({
  brief,
  evolution,
}: {
  brief: BriefResponse;
  evolution: EvolutionResponse;
}) {
  const t = useChartTokens();
  const summary = revisionSummary(brief);
  const agreement = runAgreement(evolution);
  const option = useMemo(() => revisionOption(brief, t), [brief, t]);
  if (!summary) return null;
  const copy = agreement ? agreementCopy[agreement.level] : null;

  return (
    <ChartCard
      title="What changed since the previous run"
      subtitle="The run used for the decision against the run before it. Large or one-sided revisions are a warning that the weather picture is moving."
      legend={revisionLegend(t, brief)}
      actions={
        <Group gap={6}>
          {summary.alert ? (
            <Badge
              color="orange"
              variant="light"
              tt="none"
              leftSection={<IconAlertTriangle size={14} />}
            >
              Revision alert
            </Badge>
          ) : (
            <Badge
              color="gray"
              variant="light"
              tt="none"
              c="var(--gb-ink-2)"
              leftSection={<IconCircleCheck size={14} />}
            >
              Stable since last run
            </Badge>
          )}
          {copy ? (
            <Badge color={copy.color} variant="light" tt="none" c="var(--gb-ink)">
              {copy.label}
            </Badge>
          ) : null}
        </Group>
      }
      table={() => (
        <Table.ScrollContainer minWidth={480}>
          <Table striped className="gb-tabular" fz="sm" verticalSpacing={4}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Product (UK)</Table.Th>
                <Table.Th ta="right">Run used MW</Table.Th>
                <Table.Th ta="right">Run before MW</Table.Th>
                <Table.Th ta="right">Revision MW</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {brief.hours.map((h) => (
                <Table.Tr key={h.start_time}>
                  <Table.Td>{ukTime(h.start_time)}</Table.Td>
                  <Table.Td ta="right">{mw(h.forecast_mw)}</Table.Td>
                  <Table.Td ta="right">{mw(h.previous_forecast_mw)}</Table.Td>
                  <Table.Td ta="right">
                    {h.forecast_mw != null && h.previous_forecast_mw != null
                      ? signedMw(h.forecast_mw - h.previous_forecast_mw)
                      : '—'}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    >
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="lg" mb="md" data-testid="revision-facts">
        <Fact label="Revision over the day" value={signedGwh(summary.totalGwh, 1)} />
        <Fact
          label="Largest hourly change"
          value={`${summary.largestMw >= 0 ? '+' : '−'}${gw(Math.abs(summary.largestMw))}`}
          note={summary.largestAt ? `at ${ukTime(summary.largestAt)}` : undefined}
        />
        <Fact label="Hours revised up / down" value={`${summary.hoursUp} / ${summary.hoursDown}`} />
        {agreement ? (
          <Fact
            label={`Spread across last ${agreement.runs} runs`}
            value={signedGwh(agreement.spreadGwh, 0).replace('+', '')}
            note={`${pct(agreement.spreadShare, 1)} of the forecast energy`}
          />
        ) : null}
      </SimpleGrid>
      <EChart
        option={option}
        height={240}
        label="Decision run against the run before it, with the revision shaded."
      />
    </ChartCard>
  );
}
