import { Card, createTheme, Paper, type MantineColorsTuple } from '@mantine/core';

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
  primaryShade: { light: 6, dark: 5 },
  colors: { gbBlue },
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  headings: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    fontWeight: '650',
  },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Card: Card.extend({
      defaultProps: { withBorder: true, radius: 'lg', padding: 'lg' },
      classNames: { root: 'gb-card' },
    }),
    Paper: Paper.extend({ classNames: { root: 'gb-card' } }),
  },
});
