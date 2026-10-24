import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** WCAG 2.1 AA audit of every page, in both themes. Serious or critical findings fail the build. */
const pages = [
  { name: 'brief', url: '/brief?date=2026-01-14&reveal=1', ready: 'brief-headline' },
  { name: 'accuracy', url: '/accuracy', ready: '' },
  { name: 'methodology', url: '/methodology', ready: '' },
];

for (const scheme of ['dark', 'light'] as const) {
  for (const target of pages) {
    test(`${target.name} has no serious accessibility violations (${scheme})`, async ({ page }) => {
      await page.addInitScript((value) => {
        localStorage.setItem('mantine-color-scheme-value', value);
      }, scheme);
      await page.goto(target.url);
      if (target.ready) await expect(page.getByTestId(target.ready)).toBeVisible();
      else await expect(page.locator('main h1').first()).toBeVisible();
      await page.waitForTimeout(500);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      const summary = blocking.map((v) => `${v.id}: ${v.nodes.length} × ${v.help}`);
      expect(summary).toEqual([]);
    });
  }
}
