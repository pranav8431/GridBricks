import {
  ActionIcon,
  Anchor,
  Box,
  Container,
  Group,
  Stack,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { NavLink, Outlet } from 'react-router';

import { useMeta } from '../api/queries';
import { gateQueryString, useGateSelection } from '../lib/params';
import { GateSelector } from './GateSelector';

const NAV = [
  { to: '/brief', label: 'Day-ahead brief' },
  { to: '/accuracy', label: 'Forecast accuracy' },
  { to: '/methodology', label: 'Methodology & data' },
];

function BrandMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#2a78d6" />
      <g fill="#ffffff">
        <rect x="6" y="18" width="5" height="8" rx="1.5" />
        <rect x="13.5" y="12" width="5" height="14" rx="1.5" />
        <rect x="21" y="6" width="5" height="20" rx="1.5" />
      </g>
    </svg>
  );
}

function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');
  const next = scheme === 'dark' ? 'light' : 'dark';
  return (
    <Tooltip label={`Switch to ${next} mode`}>
      <ActionIcon
        variant="subtle"
        color="gray.0"
        size="lg"
        aria-label={`Switch to ${next} mode`}
        onClick={() => setColorScheme(next)}
      >
        {scheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

export function AppLayout() {
  const [selection] = useGateSelection();
  const meta = useMeta();
  const query = gateQueryString(selection);

  return (
    <Box mih="100vh" style={{ display: 'flex', flexDirection: 'column' }}>
      <a href="#main" className="gb-visually-hidden">
        Skip to content
      </a>
      <header className="gb-header">
        <Container size="xl" py={12}>
          <Group justify="space-between" wrap="wrap" gap="md">
            <Group gap="xl" wrap="wrap">
              <Group gap="sm" wrap="nowrap">
                <BrandMark />
                <Box>
                  <Text fw={700} lh={1.1} c="#ffffff">
                    GridBricks
                  </Text>
                  <Text size="xs" lh={1.2} className="gb-header-sub">
                    Day-Ahead Wind Desk
                  </Text>
                </Box>
              </Group>
              <nav aria-label="Main">
                <Group gap={4} wrap="nowrap" style={{ overflowX: 'auto' }}>
                  {NAV.map((item) => (
                    <NavLink key={item.to} to={`${item.to}${query}`} className="gb-nav-link">
                      {item.label}
                    </NavLink>
                  ))}
                </Group>
              </nav>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <GateSelector />
              <ColorSchemeToggle />
            </Group>
          </Group>
        </Container>
      </header>

      <Container size="xl" py="xl" component="main" id="main" style={{ flex: 1, width: '100%' }}>
        <Outlet />
      </Container>

      <Box component="footer" py="md" style={{ borderTop: '1px solid var(--gb-border)' }}>
        <Container size="xl">
          <Stack gap={2}>
            <Text size="xs" c="var(--gb-ink-2)">
              Pilot scope: purchase decisions taken 1–31 January 2026. Data:{' '}
              <Anchor
                href="https://bmrs.elexon.co.uk/api-documentation"
                target="_blank"
                rel="noreferrer"
                size="xs"
              >
                Elexon BMRS
              </Anchor>{' '}
              WINDFOR forecasts and FUELHH wind outturn, national level.
            </Text>
            {meta.data ? (
              <Text size="xs" c="var(--gb-muted)">
                Snapshot {meta.data.snapshot.version} · app v{meta.data.app_version} · all times UK
                (Europe/London)
              </Text>
            ) : null}
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
