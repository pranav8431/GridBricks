import {
  Anchor,
  Badge,
  Card,
  Group,
  List,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconCircleCheck, IconInfoCircle } from '@tabler/icons-react';
import { useEffect, type ReactNode } from 'react';

import type { MetaResponse, QualityResponse } from '../../api/client';
import { useMeta, useQuality } from '../../api/queries';
import { QueryState } from '../../components/QueryState';
import { calendarDate, ukDateTime } from '../../lib/format';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card component="section" aria-label={title}>
      <Stack gap="sm">
        <Title order={2} fz="lg">
          {title}
        </Title>
        {children}
      </Stack>
    </Card>
  );
}

function DecisionModel({ meta }: { meta: MetaResponse }) {
  return (
    <Section title="The decision this tool models">
      <List spacing={6} size="sm">
        <List.Item>
          <b>Delivery day.</b> {meta.delivery_window_rule}. That is 24 hourly products, or 23 and 25
          on clock-change days. Every time is shown in UK time ({meta.timezone}).
        </List.Item>
        <List.Item>
          <b>Decision time.</b> The gate closure on the day before delivery (D-1). Presets:{' '}
          {meta.gates.map((g) => `${g.description} at ${g.gate_closure_uk}`).join('; ')}. A custom
          time can be set in the header.
        </List.Item>
        <List.Item>
          <b>What counts as available.</b> A forecast run counts only if it was published strictly
          before the decision time. A run stamped at the gate-closure minute cannot be acted on. For
          each hour, the newest qualifying run that covers it is used.
        </List.Item>
        <List.Item>
          <b>Stale values are dropped.</b> Each WINDFOR run repeats values for hours that have
          already started. Those are copies of older runs, not forecasts, so they are ignored.
        </List.Item>
        <List.Item>
          <b>Scope.</b> Decisions taken {calendarDate(meta.first_decision_date)} to{' '}
          {calendarDate(meta.last_decision_date)}, for delivery{' '}
          {calendarDate(meta.first_delivery_date, false)} to {calendarDate(meta.last_delivery_date)}
          .
        </List.Item>
      </List>
    </Section>
  );
}

function Measurement() {
  return (
    <Section title="How accuracy is measured">
      <List spacing={6} size="sm">
        <List.Item>
          <b>Error = forecast − actual</b>, in MW. Positive means less wind arrived than forecast,
          so a desk buying against the forecast would be short and need to buy more later.
        </List.Item>
        <List.Item>
          <b>Resolution.</b> WINDFOR is hourly and FUELHH is half-hourly. Each hourly forecast is
          compared with the outturn of the half-hour that starts at the same time, as the
          datasets&apos; shared start time suggests. Daily energy uses every half-hour.
        </List.Item>
        <List.Item>
          <b>Metrics.</b> Mean absolute error (MAE), root mean square error, bias (mean error),
          error percentiles, MAE as a share of mean output, and the share of hours inside the likely
          range. Percentage error per hour is avoided because it explodes at low output.
        </List.Item>
        <List.Item>
          <b>Lead time.</b> Hours between a run&apos;s publication and the hour it forecasts. At the
          09:20 gate it runs from about 15.5 to 38.5 hours.
        </List.Item>
      </List>
    </Section>
  );
}

function Calibration({ meta }: { meta: MetaResponse }) {
  const c = meta.calibration;
  return (
    <Section title="The error-adjusted estimate and likely range">
      <Text size="sm">
        For each delivery day D, the app looks at the {c.window_days} most recent delivery days that
        were fully settled before the decision: D−{c.gap_days + c.window_days - 1} to D−
        {c.gap_days}. For every hour in those days it takes the ratio of actual to forecast wind.
        The {c.quantiles.map((q) => `P${String(Math.round(q * 100))}`).join(', ')} of that ratio
        scale today&apos;s forecast into a central estimate and a likely range.
      </Text>
      <List spacing={6} size="sm">
        <List.Item>
          <b>No look-ahead.</b> Nothing published after the decision can influence its estimate. An
          automated test scrambles every later value and checks the estimate does not move.
        </List.Item>
        <List.Item>
          <b>Why a ratio.</b> Errors in GB wind grow with output, so a multiplicative range fits
          better than a fixed number of MW. A fixed offset was also tested and gave a weaker central
          estimate.
        </List.Item>
        <List.Item>
          <b>Warm-up.</b> Early-January decisions are calibrated with delivery days from{' '}
          {calendarDate(meta.calibration_from)}. A trader would already have known those errors.
          They are used for calibration only and never shown as results.
        </List.Item>
        <List.Item>
          <b>Checking it.</b> If the range is honest, about 80% of actual hours land inside it. The
          accuracy page reports this coverage, plus pinball loss for sharpness.
        </List.Item>
      </List>
    </Section>
  );
}

function Data({ meta }: { meta: MetaResponse }) {
  return (
    <Section title="Data">
      <Text size="sm">
        National-level data from Elexon&apos;s BMRS Insights API:{' '}
        <Anchor
          href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
          target="_blank"
          rel="noreferrer"
        >
          WINDFOR
        </Anchor>{' '}
        wind generation forecasts (publish time, target start time, MW) and{' '}
        <Anchor
          href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream"
          target="_blank"
          rel="noreferrer"
        >
          FUELHH
        </Anchor>{' '}
        half-hourly outturn for fuel type WIND. The app reads a checksummed snapshot, so it never
        depends on the live API being up.
      </Text>
      <Table.ScrollContainer minWidth={640}>
        <Table fz="sm" className="gb-tabular" verticalSpacing={4}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Dataset</Table.Th>
              <Table.Th>Request</Table.Th>
              <Table.Th ta="right">Rows</Table.Th>
              <Table.Th>SHA-256</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {meta.snapshot.datasets.map((d) => (
              <Table.Tr key={d.dataset}>
                <Table.Td>{d.dataset}</Table.Td>
                <Table.Td>
                  <Text size="xs" ff="monospace">
                    {d.endpoint}?
                    {Object.entries(d.params)
                      .map(([key, value]) => `${key}=${value}`)
                      .join('&')}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">{d.rows.toLocaleString('en-GB')}</Table.Td>
                <Table.Td>
                  <Text size="xs" ff="monospace">
                    {d.sha256.slice(0, 16)}…
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Text size="xs" c="var(--gb-ink-2)">
        Snapshot {meta.snapshot.version}, fetched {ukDateTime(meta.snapshot.generated_at)} UK.
        Observed run schedule (UTC): {meta.run_schedule_utc.join(', ')}.
      </Text>
    </Section>
  );
}

const severityIcon = {
  info: <IconInfoCircle size={16} color="var(--gb-ink-2)" aria-label="Info" />,
  warning: <IconAlertTriangle size={16} color="#c98500" aria-label="Warning" />,
  error: <IconAlertTriangle size={16} color="var(--gb-bad-text)" aria-label="Error" />,
};

function Quality({ quality }: { quality: QualityResponse }) {
  const complete = quality.actual_periods_present === quality.actual_periods_expected;
  return (
    <Section title="Data quality">
      <Group gap="xs">
        <Badge
          variant="light"
          tt="none"
          color={complete ? 'green' : 'yellow'}
          leftSection={complete ? <IconCircleCheck size={14} /> : <IconAlertTriangle size={14} />}
        >
          {quality.actual_periods_present.toLocaleString('en-GB')} of{' '}
          {quality.actual_periods_expected.toLocaleString('en-GB')} half-hours present
        </Badge>
        <Badge variant="light" color="gray" tt="none">
          {quality.forecast_runs} forecast runs
        </Badge>
      </Group>
      <Stack gap={6}>
        {quality.issues.map((issue) => (
          <Group key={issue.message} gap="xs" wrap="nowrap" align="flex-start">
            {severityIcon[issue.severity]}
            <Text size="sm">{issue.message}</Text>
          </Group>
        ))}
      </Stack>
    </Section>
  );
}

function Limitations() {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      <Section title="Assumptions and limitations">
        <List spacing={6} size="sm">
          <List.Item>National wind only, not the client&apos;s own portfolio or demand.</List.Item>
          <List.Item>
            Both datasets cover wind farms with operational metering visible to the system operator.
            Embedded wind shows up as lower demand instead.
          </List.Item>
          <List.Item>
            The systematic over-forecast may reflect curtailment, since outturn is measured after
            constraint actions. Confirming it needs balancing-mechanism data, which is outside this
            pilot.
          </List.Item>
          <List.Item>
            The range assumes the last two weeks&apos; error pattern carries into tomorrow. Sudden
            regime changes, such as storms, can break that.
          </List.Item>
          <List.Item>Volumes only: no prices, so no cost of imbalance yet.</List.Item>
        </List>
      </Section>
      <Section title="Roadmap">
        <List spacing={6} size="sm">
          <List.Item>
            Live mode: scheduled ingest after every run, with alerts on big revisions.
          </List.Item>
          <List.Item>Client portfolio and demand, to show the residual volume to buy.</List.Item>
          <List.Item>
            Price layer: cost of being short or long, using imbalance and intraday prices.
          </List.Item>
          <List.Item>
            Regime-aware calibration by wind level and season, and more forecast providers.
          </List.Item>
          <List.Item>Single sign-on, audit trail and a managed database.</List.Item>
        </List>
      </Section>
    </SimpleGrid>
  );
}

export function MethodologyPage() {
  const meta = useMeta();
  const quality = useQuality();
  useEffect(() => {
    document.title = 'Methodology & data · GridBricks';
  }, []);
  return (
    <Stack gap="lg">
      <div>
        <Title order={1} fz="h2">
          Methodology &amp; data
        </Title>
        <Text c="var(--gb-ink-2)" size="sm" maw={760}>
          How the app decides what the desk knew at the decision time, how forecast accuracy is
          measured, and where the data comes from.
        </Text>
      </div>
      <QueryState query={meta}>
        {(data) => (
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <DecisionModel meta={data} />
              <Measurement />
            </SimpleGrid>
            <Calibration meta={data} />
            <Data meta={data} />
          </Stack>
        )}
      </QueryState>
      <QueryState query={quality} loadingHeight={160}>
        {(data) => <Quality quality={data} />}
      </QueryState>
      <Limitations />
    </Stack>
  );
}
