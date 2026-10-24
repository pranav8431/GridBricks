import {
  ActionIcon,
  Anchor,
  AppShell,
  Box,
  Burger,
  Group,
  Stack,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBook2,
  IconChartHistogram,
  IconMoon,
  IconSun,
  IconWindmill,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';

import { useMeta } from '../api/queries';
import { gateQueryString, useGateSelection } from '../lib/params';
import { GateSelector } from './GateSelector';

const NAV: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/brief', label: 'Day-ahead brief', icon: <IconWindmill size={18} stroke={1.6} /> },
  {
    to: '/accuracy',
    label: 'Forecast accuracy',
    icon: <IconChartHistogram size={18} stroke={1.6} />,
  },
  { to: '/methodology', label: 'Methodology & data', icon: <IconBook2 size={18} stroke={1.6} /> },
];

/** GridBricks mark: three rising bars on blue. */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#2a78d6" />
      <g fill="#ffffff">
        <rect x="6" y="18" width="5" height="8" rx="1.5" />
        <rect x="13.5" y="12" width="5" height="14" rx="1.5" />
        <rect x="21" y="6" width="5" height="20" rx="1.5" />
      </g>
    </svg>
  );
}

function Brand() {
  return (
    <Group gap="sm" wrap="nowrap">
      <BrandMark />
      <Box>
        <Text fw={600} lh={1.1} c="#ffffff" className="gb-display" fz={17}>
          GridBricks
        </Text>
        <Text fz={11} lh={1.3} c="#8193a8" className="gb-mono">
          DAY-AHEAD WIND DESK
        </Text>
      </Box>
    </Group>
  );
}

function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('dark');
  const next = scheme === 'dark' ? 'light' : 'dark';
  return (
    <Tooltip label={`Switch to ${next} mode`}>
      <ActionIcon
        variant="subtle"
        color="gray.4"
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
  const [opened, { toggle, close }] = useDisclosure(false);

  return (
    <AppShell
      header={{ height: { base: 60, sm: 0 } }}
      navbar={{ width: 264, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding={0}
    >
      <a href="#main" className="gb-visually-hidden">
        Skip to content
      </a>
      <AppShell.Header hiddenFrom="sm" className="gb-rail" withBorder={false}>
        <Group h="100%" px="md" justify="space-between">
          <Brand />
          <Burger opened={opened} onClick={toggle} color="#e8eef5" size="sm" aria-label="Menu" />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className="gb-rail" p="md">
        <Stack justify="space-between" h="100%" gap="lg">
          <Stack gap="xl">
            <Box visibleFrom="sm" pt={4}>
              <Brand />
            </Box>
            <Stack gap={6}>
              <Text className="gb-rail-label">Desk</Text>
              <nav aria-label="Main">
                <Stack gap={2}>
                  {NAV.map((item) => (
                    <NavLink
                      key={item.to}
                      to={`${item.to}${query}`}
                      className="gb-nav-link"
                      onClick={close}
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  ))}
                </Stack>
              </nav>
            </Stack>
            <Stack gap={8}>
              <Text className="gb-rail-label">Decision time</Text>
              <Box px={4}>
                <GateSelector />
              </Box>
              <Text fz={12} c="#8193a8" px={12} lh={1.45}>
                Gate closure on the day before delivery, UK time. Every view uses only forecasts
                published before it.
              </Text>
            </Stack>
          </Stack>

          <Stack gap="sm">
            {meta.data ? (
              <Box className="gb-gate-clock">
                <Text className="gb-rail-label" p={0}>
                  Pilot scope
                </Text>
                <Text fz={13} c="#e8eef5" mt={6}>
                  Decisions 1–31 Jan 2026
                </Text>
                <Text fz={11} c="#8193a8" className="gb-mono" mt={4}>
                  snapshot {meta.data.snapshot.version} · v{meta.data.app_version}
                </Text>
              </Box>
            ) : null}
            <Group justify="space-between" px={4}>
              <Anchor
                href="https://bmrs.elexon.co.uk/api-documentation"
                target="_blank"
                rel="noreferrer"
                fz={12}
                c="#a9b7c6"
              >
                Data: Elexon BMRS
              </Anchor>
              <ColorSchemeToggle />
            </Group>
          </Stack>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main className="gb-main">
        <Box
          component="main"
          id="main"
          px={{ base: 'md', md: 40 }}
          py={{ base: 'md', md: 36 }}
          maw={1440}
        >
          <Outlet />
          <Text fz={12} c="var(--gb-muted)" mt={48} className="gb-mono">
            WINDFOR forecasts and FUELHH wind outturn, national level · all times UK (Europe/London)
          </Text>
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
