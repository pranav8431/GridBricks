import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

/** Captures screenshots for docs and the demo deck. Run with SCREENSHOTS=1. */
const outDir = resolve(process.env.SCREENSHOT_DIR ?? '../docs/images');

test.skip(!process.env.SCREENSHOTS, 'screenshots only on demand');
test.use({ timezoneId: 'Europe/London' });

test.beforeAll(() => mkdirSync(outDir, { recursive: true }));

const shots: { name: string; url: string; fullPage?: boolean; dark?: boolean; ready: string }[] = [
  { name: 'brief', url: '/brief?date=2026-01-14', ready: 'brief-headline' },
  {
    name: 'brief-revealed',
    url: '/brief?date=2026-01-11&reveal=1',
    ready: 'brief-headline',
    fullPage: true,
  },
  { name: 'accuracy', url: '/accuracy', ready: '', fullPage: true },
  { name: 'methodology', url: '/methodology', ready: '', fullPage: true },
  {
    name: 'brief-dark',
    url: '/brief?date=2026-01-27&reveal=1',
    ready: 'brief-headline',
    dark: true,
  },
];

for (const shot of shots) {
  test(`screenshot ${shot.name}`, async ({ page }) => {
    if (shot.dark) {
      await page.addInitScript(() => localStorage.setItem('mantine-color-scheme-value', 'dark'));
    }
    await page.goto(shot.url);
    if (shot.ready) await expect(page.getByTestId(shot.ready)).toBeVisible();
    else await expect(page.locator('svg').first()).toBeVisible();
    await page.waitForTimeout(800); // let chart animations settle
    await page.screenshot({ path: `${outDir}/${shot.name}.png`, fullPage: shot.fullPage ?? false });
  });
}
