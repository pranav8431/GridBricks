import { Alert, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconBulb } from '@tabler/icons-react';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';

import type { AccuracyResponse, HorizonResponse } from '../../api/client';
import { useAccuracy, useHorizon, useMeta, type GateSelection } from '../../api/queries';
import { ChartCard } from '../../components/ChartCard';
import { EChart } from '../../components/EChart';
import { ErrorCard, LoadingCard, QueryState } from '../../components/QueryState';
import { useChartTokens } from '../../lib/chartTheme';
import { addDays, calendarDate, gwh, signedGw } from '../../lib/format';
import { gateQueryString, parseDate, useGateSelection, useUrlState } from '../../lib/params';
import { AccuracyKpis } from './AccuracyKpis';
import {
  calendarOption,
  histogramOption,
  horizonOption,
  levelOption,
  timeSeriesOption,
} from './charts';
import { comparisonInsight } from './insights';
import {
  DailyTable,
  GateComparisonTable,
  HistogramTable,
  HorizonTable,
  LevelTable,
  SeriesNote,
} from './Tables';

function Findings({ accuracy }: { accuracy: AccuracyResponse }) {
  const insight = comparisonInsight(accuracy.gate_comparison, accuracy);
  const worst = accuracy.worst_days[0];
  const levels = accuracy.by_level.filter((b) => b.n >= 50 && b.bias_mw != null);
  const low = levels[0];
  const high = levels.at(-1);
  return (
    <Alert
      variant="light"
      color="gbBlue"
      icon={<IconBulb size={18} />}
      title="What the backtest says"
      styles={{ message: { color: 'var(--gb-ink)' } }}
    >
      <Stack gap={4}>
        {insight ? <Text size="sm">{insight}</Text> : null}
        {low && high && low !== high ? (
          <Text size="sm">
            The over-forecast grows with wind level: bias is {signedGw(low.bias_mw)} when{' '}
            {low.label} is forecast and {signedGw(high.bias_mw)} at {high.label}. This pattern is
            consistent with curtailment of wind farms during high output, which this data alone
            cannot confirm.
          </Text>
        ) : null}
        {worst ? (
          <Text size="sm">
            Largest miss: delivery {calendarDate(worst.delivery_date, false)}, when the forecast was{' '}
            {gwh(Math.abs(worst.energy_error_gwh ?? 0))}{' '}
            {(worst.energy_error_gwh ?? 0) >= 0 ? 'above' : 'below'} the outturn.
          </Text>
        ) : null}
      </Stack>
    </Alert>
  );
}

interface AccuracyContentProps {
  data: AccuracyResponse;
  refetching: boolean;
  horizon: HorizonResponse | undefined;
  horizonError: unknown;
  selection: GateSelection;
  onCalendarClick: Record<string, (event: unknown) => void>;
}

function AccuracyContent({
  data,
  refetching,
  horizon,
  horizonError,
  selection,
  onCalendarClick,
}: AccuracyContentProps) {
  const t = useChartTokens();
  const options = useMemo(
    () => ({
      series: timeSeriesOption(data, t),
      calendar: calendarOption(data, t),
      histogram: histogramOption(data, t),
      level: levelOption(data, t),
    }),
    [data, t],
  );
  const horizonChart = useMemo(() => (horizon ? horizonOption(horizon, t) : null), [horizon, t]);

  return (
    <Stack gap="lg" className={refetching ? 'gb-refetching' : undefined}>
      <AccuracyKpis accuracy={data} />
      <Findings accuracy={data} />

      <Card>
        <Stack gap="sm">
          <div>
            <Title order={3} fz="md">
              Value of waiting versus correcting
            </Title>
            <Text size="sm" c="var(--gb-ink-2)">
              The same decisions at each auction&apos;s gate closure. Later gates see newer runs;
              the adjustment applies each day&apos;s walk-forward correction.
            </Text>
          </div>
          <GateComparisonTable rows={data.gate_comparison} selectedId={data.gate.id} />
        </Stack>
      </Card>

      <ChartCard
        title="Forecast at decision time versus actual"
        subtitle={`Hourly products for delivery ${calendarDate(data.delivery_from, false)} to ${calendarDate(data.delivery_to, false)}.`}
        legend={[
          { label: 'Published forecast', color: t.forecast, kind: 'line' },
          { label: 'Actual outturn', color: t.actual, kind: 'line' },
          { label: 'Likely range (P10–P90)', color: t.bandFill, kind: 'area' },
        ]}
        table={() => <DailyTable days={data.daily} selection={selection} />}
      >
        <EChart
          option={options.series}
          height={360}
          label="Hourly forecast at decision time against actual wind outturn over the period."
        />
        <SeriesNote accuracy={data} />
      </ChartCard>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <ChartCard
          title="Daily energy error"
          subtitle="Forecast minus actual energy per delivery day. Click a day to open its brief."
          table={() => <DailyTable days={data.daily} selection={selection} />}
        >
          <EChart
            option={options.calendar}
            height={320}
            label="Calendar of daily energy error; red days were over-forecast."
            onEvents={onCalendarClick}
          />
        </ChartCard>
        <ChartCard
          title="Distribution of hourly errors"
          subtitle="How often each size of error occurred, with its percentiles."
          table={() => <HistogramTable accuracy={data} />}
        >
          <EChart
            option={options.histogram}
            height={320}
            label="Histogram of hourly forecast errors."
          />
        </ChartCard>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <ChartCard
          title="Bias by forecast wind level"
          subtitle="Mean error, grouped by how much wind was forecast."
          legend={[
            { label: 'Published forecast', color: t.forecast, kind: 'bar' },
            { label: 'Error-adjusted', color: t.adjusted, kind: 'bar' },
          ]}
          table={() => <LevelTable accuracy={data} />}
        >
          <EChart
            option={options.level}
            height={300}
            label="Bias of the published and error-adjusted forecasts by forecast wind level."
          />
        </ChartCard>
        {horizon && horizonChart ? (
          <ChartCard
            title="Accuracy by lead time"
            subtitle="Every published run, by hours between publication and delivery. The shaded band is your decision horizon."
            legend={[
              { label: 'Mean absolute error', color: t.forecast, kind: 'line' },
              { label: 'Bias', color: t.forecast, kind: 'dashed' },
            ]}
            table={() => <HorizonTable horizon={horizon} />}
          >
            <EChart
              option={horizonChart}
              height={300}
              label="Forecast error by lead time, for all runs."
            />
          </ChartCard>
        ) : horizonError ? (
          <ErrorCard error={horizonError} />
        ) : (
          <LoadingCard height={300} />
        )}
      </SimpleGrid>

      <Card>
        <Stack gap="sm">
          <Title order={3} fz="md">
            Largest misses
          </Title>
          <DailyTable days={data.worst_days} selection={selection} />
        </Stack>
      </Card>
    </Stack>
  );
}

export function AccuracyPage() {
  const meta = useMeta();
  const [selection] = useGateSelection();
  const [params, update] = useUrlState();
  const navigate = useNavigate();

  const min = meta.data?.first_decision_date;
  const max = meta.data?.last_decision_date;
  const from = parseDate(params.get('from'), min, max);
  const to = parseDate(params.get('to'), min, max);
  const accuracy = useAccuracy(selection, from, to);
  const horizon = useHorizon(selection);

  useEffect(() => {
    document.title = 'Forecast accuracy · GridBricks';
  }, []);

  const onCalendarClick = useMemo(
    () => ({
      click: (event: unknown) => {
        const value = (event as { value?: [string, number] }).value;
        if (!value) return;
        void navigate(
          `/brief${gateQueryString(selection, { date: addDays(value[0], -1), reveal: '1' })}`,
        );
      },
    }),
    [navigate, selection],
  );

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
        <div>
          <Title order={1} fz="h2">
            Forecast accuracy at decision time
          </Title>
          <Text c="var(--gb-ink-2)" size="sm" maw={760}>
            How far the national wind forecast available at gate closure landed from what actually
            happened, for every purchase decision in the period. Error = forecast − actual, so
            positive means less wind arrived than forecast.
          </Text>
        </div>
        {min && max ? (
          <DatePickerInput
            type="range"
            label="Decision days"
            value={[from ?? min, to ?? max]}
            onChange={([start, end]) => {
              if (start && end)
                update({ from: start === min ? null : start, to: end === max ? null : end });
            }}
            minDate={min}
            maxDate={max}
            defaultDate={min}
            valueFormat="D MMM YYYY"
            w={250}
            allowSingleDateInRange
          />
        ) : null}
      </Group>

      <QueryState query={accuracy} loadingHeight={420}>
        {(data, refetching) => (
          <AccuracyContent
            data={data}
            refetching={refetching}
            horizon={horizon.data}
            horizonError={horizon.error}
            selection={selection}
            onCalendarClick={onCalendarClick}
          />
        )}
      </QueryState>
    </Stack>
  );
}
