import { Card, Group, Text, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import type { ReactNode } from 'react';

export type Tone = 'neutral' | 'good' | 'bad';

interface StatTileProps {
  label: string;
  value: string;
  detail?: ReactNode;
  tone?: Tone;
  hint?: string;
}

const toneColor: Record<Tone, string> = {
  neutral: 'var(--gb-ink-2)',
  good: 'var(--gb-good-text)',
  bad: 'var(--gb-bad-text)',
};

/** Stat tile: label, value (proportional figures), and an optional detail line. */
export function StatTile({ label, value, detail, tone = 'neutral', hint }: StatTileProps) {
  return (
    <Card padding="md" component="article" aria-label={label}>
      <Group gap={4} wrap="nowrap">
        <Text size="sm" c="var(--gb-ink-2)" fw={500}>
          {label}
        </Text>
        {hint ? (
          <Tooltip label={hint} multiline w={260} withArrow>
            <IconInfoCircle size={14} color="var(--gb-muted)" aria-label={hint} tabIndex={0} />
          </Tooltip>
        ) : null}
      </Group>
      <Text fz={26} fw={650} lh={1.2} mt={6} c="var(--gb-ink)">
        {value}
      </Text>
      {detail ? (
        <Text size="sm" mt={4} c={toneColor[tone]}>
          {detail}
        </Text>
      ) : null}
    </Card>
  );
}
