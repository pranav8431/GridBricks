import {
  ActionIcon,
  Anchor,
  Badge,
  Card,
  Group,
  Stack,
  Switch,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconChevronLeft, IconChevronRight, IconDownload } from '@tabler/icons-react';
import { useEffect } from 'react';

import { briefCsvUrl, type BriefResponse, type MetaResponse } from '../../api/client';
import { useBrief, useEvolution, useMeta } from '../../api/queries';
import { ChartCard } from '../../components/ChartCard';
import { QueryState } from '../../components/QueryState';
import { RunTimeline } from '../../components/RunTimeline';
import { useChartTokens } from '../../lib/chartTheme';
import { addDays, calendarDate, ukTime } from '../../lib/format';
import { briefHeadline, nextRunNote } from '../../lib/headline';
import { parseDate, useGateSelection, useUrlState } from '../../lib/params';
import { BriefKpis } from './BriefKpis';
import { deliveryLegend, evolutionLegend } from './chartOptions';
import { DeliveryChart } from './DeliveryChart';
import { EvolutionChart } from './EvolutionChart';
import { HourlyTable } from './HourlyTable';

function DecisionControls({
  meta,
  decisionDate,
  reveal,
  onDate,
  onReveal,
}: {
  meta: MetaResponse;
  decisionDate: string;
  reveal: boolean;
  onDate: (date: string) => void;
  onReveal: (reveal: boolean) => void;
}) {
  const min = meta.first_decision_date;
  const max = meta.last_decision_date;
  return (
    <Group gap="md" wrap="wrap" align="flex-end">
      <Group gap={6} align="flex-end" wrap="nowrap">
        <Tooltip label="Previous day">
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Previous decision day"
            disabled={decisionDate <= min}
            onClick={() => onDate(addDays(decisionDate, -1))}
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
        </Tooltip>
        <DatePickerInput
          label="Decision day (D-1)"
          value={decisionDate}
          onChange={(value) => {
            if (value) onDate(value);
          }}
          minDate={min}
          maxDate={max}
          defaultDate={decisionDate}
          valueFormat="ddd D MMM YYYY"
          w={200}
          allowDeselect={false}
        />
        <Tooltip label="Next day">
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Next decision day"
            disabled={decisionDate >= max}
            onClick={() => onDate(addDays(decisionDate, 1))}
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Switch
        checked={reveal}
        onChange={(event) => onReveal(event.currentTarget.checked)}
        label="Reveal what actually happened"
        description={
          reveal
            ? 'Showing the outturn, which was not known at the decision time'
            : 'Showing only what the desk could see at the decision time'
        }
        size="md"
      />
    </Group>
  );
}

function DecisionSummary({ brief }: { brief: BriefResponse }) {
  const note = nextRunNote(brief);
  return (
    <Card>
      <Stack gap="xs">
        <Group gap="xs" wrap="wrap">
          <Title order={2} fz="h3">
            Delivery {calendarDate(brief.delivery_date)}
          </Title>
          <Badge variant="light" color="gray" radius="sm" tt="none">
            {brief.gate.label}
          </Badge>
        </Group>
        <Text size="sm" c="var(--gb-ink-2)">
          Hourly products {ukTime(brief.delivery_start)} on{' '}
          {calendarDate(brief.decision_date, false)} to {ukTime(brief.delivery_end)} on{' '}
          {calendarDate(brief.delivery_date, false)} (UK). Decision at {brief.gate.gate_closure_uk}{' '}
          on {calendarDate(brief.decision_date, false)}.
        </Text>
        <Text size="lg" lh={1.5} c="var(--gb-ink)" maw={980} data-testid="brief-headline">
          {briefHeadline(brief)}
        </Text>
        <RunTimeline
          runs={brief.runs_on_decision_day}
          cutoff={brief.cutoff}
          decisionRun={brief.decision_run}
          gateLabel={`Gate ${brief.gate.gate_closure_uk}`}
        />
        <Text size="xs" c="var(--gb-ink-2)">
          Forecast runs published on the decision day: filled = available before gate closure, large
          = used, hollow = too late.{note ? ` ${note}` : ''}
        </Text>
      </Stack>
    </Card>
  );
}

export function BriefPage() {
  const meta = useMeta();
  const [selection] = useGateSelection();
  const [params, update] = useUrlState();
  const reveal = params.get('reveal') === '1';

  const decisionDate = meta.data
    ? (parseDate(params.get('date'), meta.data.first_decision_date, meta.data.last_decision_date) ??
      meta.data.last_decision_date)
    : undefined;
  const brief = useBrief(decisionDate, selection);
  const evolution = useEvolution(decisionDate, selection);
  const t = useChartTokens();

  useEffect(() => {
    document.title = decisionDate
      ? `Brief ${decisionDate} · GridBricks`
      : 'Day-ahead brief · GridBricks';
  }, [decisionDate]);

  return (
    <Stack gap="lg">
      <QueryState query={meta} loadingHeight={40}>
        {(metaData) =>
          decisionDate ? (
            <DecisionControls
              meta={metaData}
              decisionDate={decisionDate}
              reveal={reveal}
              onDate={(date) => update({ date })}
              onReveal={(value) => update({ reveal: value ? '1' : null })}
            />
          ) : null
        }
      </QueryState>

      <QueryState query={brief}>
        {(data, refetching) => (
          <Stack gap="lg" className={refetching ? 'gb-refetching' : undefined}>
            <DecisionSummary brief={data} />
            <BriefKpis brief={data} reveal={reveal} />
            <ChartCard
              title="Delivery day: hourly wind forecast"
              subtitle="National wind (MW, average per hour). The shaded range shows where wind is likely to land, given recent forecast errors."
              legend={deliveryLegend(t, reveal)}
              table={() => <HourlyTable brief={data} reveal={reveal} />}
              actions={
                <Tooltip label="Download the hourly products as CSV">
                  <Anchor
                    href={briefCsvUrl(data.decision_date, selection.gate, selection.cutoff)}
                    download
                    size="sm"
                    aria-label="Download CSV"
                  >
                    <Group gap={4} wrap="nowrap">
                      <IconDownload size={16} />
                      CSV
                    </Group>
                  </Anchor>
                </Tooltip>
              }
            >
              <DeliveryChart brief={data} reveal={reveal} />
            </ChartCard>
          </Stack>
        )}
      </QueryState>

      <QueryState query={evolution} loadingHeight={300}>
        {(data, refetching) => (
          <ChartCard
            title="How the forecast evolved"
            subtitle="Every run that covered this delivery day, from three days ahead to delivery. Runs after gate closure were not available for the decision."
            legend={evolutionLegend(t, data, reveal)}
            refetching={refetching}
          >
            <EvolutionChart evolution={data} reveal={reveal} />
          </ChartCard>
        )}
      </QueryState>
    </Stack>
  );
}
