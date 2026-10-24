import { Anchor, Card, createTheme, Paper, type MantineColorsTuple } from '@mantine/core';

/** The dataviz sequential blue ramp, so UI accents and the forecast series share one hue. */
const gbBlue: MantineColorsTuple = [
  '#e8f1fd',
  '#cde2fb',
  '#b7d3f6',
  '#9ec5f4',
  '#6da7ec',
  '#3987e5',
  '#2a78d6',
  '#256abf',
  '#1c5cab',
  '#184f95',
];

export const theme = createTheme({
  primaryColor: 'gbBlue',
  primaryShade: { light: 8, dark: 4 },
  colors: { gbBlue },
  fontFamily: '"Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontFamilyMonospace: '"JetBrains Mono Variable", ui-monospace, monospace',
  headings: {
    fontFamily: '"Space Grotesk Variable", "Inter Variable", system-ui, sans-serif',
    fontWeight: '600',
  },
  defaultRadius: 'sm',
  cursorType: 'pointer',
  components: {
    Card: Card.extend({
      defaultProps: { withBorder: true, radius: 'md', padding: 'lg' },
      classNames: { root: 'gb-card' },
    }),
    Paper: Paper.extend({ classNames: { root: 'gb-card' } }),
    // Links are underlined so they never rely on colour alone (WCAG 1.4.1).
    Anchor: Anchor.extend({ defaultProps: { underline: 'always' } }),
  },
});
