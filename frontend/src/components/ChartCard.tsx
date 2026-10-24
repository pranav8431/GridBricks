import { Box, Card, Group, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { useState, type ReactNode } from 'react';

export interface LegendItem {
  label: string;
  color: string;
  kind: 'line' | 'dashed' | 'area' | 'bar';
}

interface ChartCardProps {
  title: string;
  subtitle?: ReactNode;
  legend?: LegendItem[];
  actions?: ReactNode;
  /** The accessible twin of the chart: every value the chart shows, as a table. */
  table?: () => ReactNode;
  refetching?: boolean;
  children: ReactNode;
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <Group gap="md" wrap="wrap" component="ul" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {items.map((item) => (
        <Group key={item.label} gap={6} component="li" wrap="nowrap">
          {item.kind === 'line' || item.kind === 'dashed' ? (
            <span
              className="gb-legend-key"
              data-dashed={item.kind === 'dashed'}
              style={{ color: item.color }}
              aria-hidden
            />
          ) : (
            <span className="gb-legend-swatch" style={{ background: item.color }} aria-hidden />
          )}
          <Text size="xs" c="var(--gb-ink-2)">
            {item.label}
          </Text>
        </Group>
      ))}
    </Group>
  );
}

export function ChartCard({
  title,
  subtitle,
  legend,
  actions,
  table,
  refetching,
  children,
}: ChartCardProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <Card component="section" aria-label={title}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Title order={3} fz="md">
              {title}
            </Title>
            {subtitle ? (
              <Text size="sm" c="var(--gb-ink-2)" mt={2}>
                {subtitle}
              </Text>
            ) : null}
          </Box>
          <Group gap="xs">
            {actions}
            {table ? (
              <SegmentedControl
                size="xs"
                value={view}
                onChange={(value) => setView(value === 'table' ? 'table' : 'chart')}
                data={[
                  { label: 'Chart', value: 'chart' },
                  { label: 'Table', value: 'table' },
                ]}
                aria-label={`${title}: chart or table view`}
              />
            ) : null}
          </Group>
        </Group>
        {legend && view === 'chart' ? <Legend items={legend} /> : null}
        <Box className={refetching ? 'gb-refetching' : undefined}>
          {view === 'table' && table ? table() : children}
        </Box>
      </Stack>
    </Card>
  );
}
