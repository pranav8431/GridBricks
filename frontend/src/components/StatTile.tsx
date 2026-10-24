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
  /** Small icon shown in a tinted badge; colour defaults to the forecast accent. */
  icon?: ReactNode;
  accent?: string;
}

const toneColor: Record<Tone, string> = {
  neutral: 'var(--gb-ink-2)',
  good: 'var(--gb-good-text)',
  bad: 'var(--gb-bad-text)',
};

/** Stat tile: label, value (proportional figures), and an optional detail line. */
export function StatTile({
  label,
  value,
  detail,
  tone = 'neutral',
  hint,
  icon,
  accent = 'var(--gb-forecast)',
}: StatTileProps) {
  return (
    <Card padding="md" component="article" aria-label={label}>
      <Group gap="sm" wrap="nowrap" align="center">
        {icon ? (
          <span
            className="gb-icon-badge"
            style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
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
      </Group>
      <Text
        fz={28}
        fw={700}
        lh={1.15}
        mt={10}
        c="var(--gb-ink)"
        style={{ letterSpacing: '-0.01em' }}
      >
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
