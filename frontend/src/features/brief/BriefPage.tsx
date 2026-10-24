import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useHotkeys } from '@mantine/hooks';
import { IconChevronLeft, IconChevronRight, IconDownload } from '@tabler/icons-react';
import { useEffect } from 'react';

import { briefCsvUrl, type BriefResponse, type MetaResponse } from '../../api/client';
import { useBrief, useEvolution, useMeta } from '../../api/queries';
import { ChartCard } from '../../components/ChartCard';
import { QueryState } from '../../components/QueryState';
import { RangeBar } from '../../components/RangeBar';
import { RunTimeline } from '../../components/RunTimeline';
import { Streamlines } from '../../components/Streamlines';
import { useChartTokens } from '../../lib/chartTheme';
import { addDays, calendarDate, ukTime } from '../../lib/format';
import { briefHeadline, nextRunNote } from '../../lib/headline';
import { parseDate, useGateSelection, useUrlState } from '../../lib/params';
import { BriefKpis } from './BriefKpis';
import { deliveryLegend, evolutionLegend } from './chartOptions';
import { DeliveryChart } from './DeliveryChart';
import { EvolutionChart } from './EvolutionChart';
import { HourlyTable } from './HourlyTable';
import { RevisionPanel } from './RevisionPanel';

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
    <Card padding="md">
      <Group gap="md" wrap="wrap" align="flex-end" justify="space-between">
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
      <Text size="xs" c="var(--gb-muted)" mt="xs" visibleFrom="sm">
        Shortcuts: ← → change day · R reveal or hide the outturn
      </Text>
    </Card>
  );
}

function DecisionHero({ brief, reveal }: { brief: BriefResponse; reveal: boolean }) {
  const note = nextRunNote(brief);
  const { energy } = brief;
  const lead = energy.p50_gwh ?? energy.forecast_gwh;
  return (
    <Card padding="xl" className="gb-hero">
      <Streamlines />
      <Stack gap="lg">
        <Box>
          <Text className="gb-eyebrow">Day-ahead brief</Text>
          <Group gap="sm" wrap="wrap" mt={4}>
            <Title order={1} fz={30}>
              Delivery {calendarDate(brief.delivery_date)}
            </Title>
            <Badge variant="light" radius="sm" tt="none" size="lg">
              {brief.gate.label}
            </Badge>
          </Group>
          <Text size="sm" c="var(--gb-ink-2)" mt={4}>
            Hourly products {ukTime(brief.delivery_start)} on{' '}
            {calendarDate(brief.decision_date, false)} to {ukTime(brief.delivery_end)} on{' '}
            {calendarDate(brief.delivery_date, false)}, UK time. Decision at{' '}
            {brief.gate.gate_closure_uk} on {calendarDate(brief.decision_date, false)}.
          </Text>
        </Box>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={40}>
          <Box>
            <Text size="sm" fw={500} c="var(--gb-ink-2)">
              {energy.p50_gwh != null
                ? 'Expected wind energy, corrected for recent forecast error'
                : 'Forecast wind energy for the delivery day'}
            </Text>
            <div className="gb-hero-value" style={{ marginTop: 6 }}>
              {Math.round(lead).toLocaleString('en-GB')}
              <span className="gb-hero-unit">GWh</span>
            </div>
            <Box mt="lg">
              <RangeBar
                forecast={energy.forecast_gwh}
                p10={energy.p10_gwh}
                p50={energy.p50_gwh}
                p90={energy.p90_gwh}
                actual={reveal ? energy.actual_gwh : null}
              />
            </Box>
          </Box>
          <Stack gap="sm">
            <Text size="md" lh={1.6} c="var(--gb-ink)" data-testid="brief-headline">
              {briefHeadline(brief)}
            </Text>
            <RunTimeline
              runs={brief.runs_on_decision_day}
              cutoff={brief.cutoff}
              decisionRun={brief.decision_run}
              gateLabel={`Gate ${brief.gate.gate_closure_uk}`}
            />
            <Text size="xs" c="var(--gb-ink-2)">
              Runs published on the decision day: filled = available before gate closure, large =
              used, hollow = too late.{note ? ` ${note}` : ''}
            </Text>
          </Stack>
        </SimpleGrid>
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

  // Trader shortcuts: arrows step through decision days, R toggles the outturn.
  const step = (days: number) => {
    if (!decisionDate || !meta.data) return;
    const next = addDays(decisionDate, days);
    if (next >= meta.data.first_decision_date && next <= meta.data.last_decision_date) {
      update({ date: next });
    }
  };
  useHotkeys([
    ['ArrowLeft', () => step(-1)],
    ['ArrowRight', () => step(1)],
    ['r', () => update({ reveal: reveal ? null : '1' })],
  ]);

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
            <DecisionHero brief={data} reveal={reveal} />
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

      {brief.data && evolution.data ? (
        <RevisionPanel brief={brief.data} evolution={evolution.data} />
      ) : null}

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
