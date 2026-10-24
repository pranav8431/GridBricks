import { devices, expect, test } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test('on a phone the sidebar collapses behind a menu button', async ({ page }) => {
  await page.goto('/brief?date=2026-01-14');
  await expect(page.getByTestId('brief-headline')).toBeVisible();
  const accuracyLink = page.getByRole('link', { name: 'Forecast accuracy' });
  await expect(accuracyLink).not.toBeInViewport();
  await page.getByRole('button', { name: 'Menu' }).click();
  await accuracyLink.click();
  await expect(page).toHaveURL(/\/accuracy/);
  await expect(page.getByText(/overstated wind by 15%/)).toBeVisible();
});

test('pages never scroll sideways on a phone', async ({ page }) => {
  for (const url of ['/brief?date=2026-01-14', '/accuracy', '/methodology']) {
    await page.goto(url);
    await expect(page.locator('main h1').first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, url).toBeLessThanOrEqual(1);
  }
});
