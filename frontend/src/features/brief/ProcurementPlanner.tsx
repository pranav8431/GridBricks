import {
  Group,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { useMemo } from 'react';

import type { BriefResponse } from '../../api/client';
import { ChartCard } from '../../components/ChartCard';
import { EChart } from '../../components/EChart';
import { useChartTokens } from '../../lib/chartTheme';
import { gw, gwh, mw, ukTime } from '../../lib/format';
import { useUrlState } from '../../lib/params';
import { PLAN_LABELS, procurementPlan, type PlanBasis } from '../../lib/procurement';
import { DEFAULT_DEMAND_MW, procurementOption } from './procurementOptions';

const BASES: PlanBasis[] = ['corrected', 'published', 'cautious'];

/** Turns the wind outlook into the decision itself: how much power to buy, hour by hour. */
export function ProcurementPlanner({ brief }: { brief: BriefResponse }) {
  const t = useChartTokens();
  const [params, update] = useUrlState();
  const demandParam = Number(params.get('demand'));
  const demand = Number.isFinite(demandParam) && demandParam > 0 ? demandParam : DEFAULT_DEMAND_MW;
  const basisParam = params.get('plan');
  const basis: PlanBasis = BASES.find((b) => b === basisParam) ?? 'corrected';
  const plan = procurementPlan(brief, demand, basis);
  const option = useMemo(() => (plan ? procurementOption(plan, brief, t) : null), [plan, brief, t]);
  if (!plan || !option) return null;
  const underBuy = plan.buyGwh - plan.publishedBuyGwh;

  return (
    <ChartCard
      title="Procurement planner"
      subtitle="Volume to buy in the day-ahead auction: your demand assumption minus the wind you plan on. Demand is your input; the pilot uses no demand data."
      legend={[
        { label: `To buy: ${PLAN_LABELS[basis]}`, color: t.procurement, kind: 'bar' },
        { label: 'To buy if wind is low (P10)', color: t.ink2, kind: 'dashed' },
      ]}
      table={() => (
        <Table.ScrollContainer minWidth={480}>
          <Table striped className="gb-tabular" fz="sm" verticalSpacing={4}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Product (UK)</Table.Th>
                <Table.Th ta="right">Wind planned on MW</Table.Th>
                <Table.Th ta="right">To buy MW</Table.Th>
                <Table.Th ta="right">If wind is low MW</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {plan.hours.map((h) => (
                <Table.Tr key={h.start_time}>
                  <Table.Td>{ukTime(h.start_time)}</Table.Td>
                  <Table.Td ta="right">{mw(h.wind_mw)}</Table.Td>
                  <Table.Td ta="right">{mw(h.buy_mw)}</Table.Td>
                  <Table.Td ta="right">{mw(h.cautious_buy_mw)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    >
      <Stack gap="md">
        <Group gap="lg" align="flex-end" wrap="wrap">
          <NumberInput
            label="Your demand assumption (MW, flat)"
            value={demand}
            onChange={(value) => {
              const next = typeof value === 'number' ? value : Number(value);
              if (Number.isFinite(next) && next > 0) update({ demand: String(Math.round(next)) });
            }}
            min={0}
            step={500}
            thousandSeparator=","
            w={240}
          />
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Plan on
            </Text>
            <SegmentedControl
              value={basis}
              onChange={(value) => update({ plan: value === 'corrected' ? null : value })}
              data={BASES.map((b) => ({ value: b, label: PLAN_LABELS[b] }))}
              aria-label="Wind estimate to plan on"
            />
          </Stack>
        </Group>
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="lg" data-testid="procurement-facts">
          <Stack gap={2}>
            <Text size="xs" c="var(--gb-ink-2)">
              Volume to buy
            </Text>
            <Text className="gb-stat-value" fz={22}>
              {gwh(plan.buyGwh)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="var(--gb-ink-2)">
              Peak hourly purchase
            </Text>
            <Text className="gb-stat-value" fz={22}>
              {gw(plan.peakBuyMw)}
            </Text>
            {plan.peakAt ? (
              <Text size="xs" c="var(--gb-muted)">
                at {ukTime(plan.peakAt)}
              </Text>
            ) : null}
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="var(--gb-ink-2)">
              Extra if wind is low (P10)
            </Text>
            <Text className="gb-stat-value" fz={22}>
              {gwh(plan.bufferGwh)}
            </Text>
            <Text size="xs" c="var(--gb-muted)">
              the hedge to consider
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="var(--gb-ink-2)">
              Versus the published forecast
            </Text>
            <Text className="gb-stat-value" fz={22}>
              {underBuy >= 0 ? '+' : '−'}
              {gwh(Math.abs(underBuy))}
            </Text>
            <Text size="xs" c="var(--gb-muted)">
              {basis === 'published' ? 'same plan' : 'more than trusting it blindly'}
            </Text>
          </Stack>
        </SimpleGrid>
        <EChart
          option={option}
          height={260}
          label="Hourly volume to buy on the chosen plan, with the low-wind case."
        />
      </Stack>
    </ChartCard>
  );
}
