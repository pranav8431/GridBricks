import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

/** Captures screenshots for docs and the demo deck. Run with SCREENSHOTS=1. */
const outDir = resolve(process.env.SCREENSHOT_DIR ?? '../docs/images');

test.skip(!process.env.SCREENSHOTS, 'screenshots only on demand');
test.use({ timezoneId: 'Europe/London' });

test.beforeAll(() => mkdirSync(outDir, { recursive: true }));

const shots: { name: string; url: string; fullPage?: boolean; light?: boolean; ready: string }[] = [
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
    name: 'brief-light',
    url: '/brief?date=2026-01-27&reveal=1',
    ready: 'brief-headline',
    light: true,
  },
];

for (const shot of shots) {
  test(`screenshot ${shot.name}`, async ({ page }) => {
    // Dark is the default theme; one shot shows the light theme.
    if (shot.light) {
      await page.addInitScript(() => localStorage.setItem('mantine-color-scheme-value', 'light'));
    }
    await page.goto(shot.url);
    if (shot.ready) await expect(page.getByTestId(shot.ready)).toBeVisible();
    else await expect(page.locator('main h1').first()).toBeVisible();
    await page.waitForTimeout(800); // let chart animations settle
    if (shot.fullPage) {
      // Grow the viewport to the page so the fixed sidebar spans the whole capture.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: 1440, height });
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: `${outDir}/${shot.name}.png` });
  });
}
