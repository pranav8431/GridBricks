import { expect, test } from '@playwright/test';

test('API is healthy', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { status: string };
  expect(body.status).toBe('ok');
});

test('brief shows the forecast available at gate closure, in UK time', async ({ page }) => {
  await page.goto('/brief?date=2026-01-14');
  const headline = page.getByTestId('brief-headline');
  await expect(headline).toContainText('the 07:30 run');
  await expect(headline).toContainText('At 09:20 on Wed 14 Jan');
  await expect(
    page.getByText('The next run (09:30) landed 10 min after gate closure'),
  ).toBeVisible();
});

test('revealing the outturn adds the actual series and KPI', async ({ page }) => {
  await page.goto('/brief?date=2026-01-11');
  await expect(page.getByRole('article', { name: 'Actual outturn' })).toHaveCount(0);
  const reveal = page.getByRole('switch', { name: /Reveal what actually happened/ });
  await reveal.click(); // state round-trips through the URL, so assert it rather than check()
  await expect(page).toHaveURL(/reveal=1/);
  await expect(reveal).toBeChecked();
  await expect(page.getByRole('article', { name: 'Actual outturn' })).toBeVisible();
});

test('changing the gate switches to the later run and persists across pages', async ({ page }) => {
  await page.goto('/brief?date=2026-01-14');
  await page.getByRole('textbox', { name: /Decision time/ }).click();
  await page.getByRole('option', { name: 'N2EX · 09:50' }).click();
  await expect(page.getByTestId('brief-headline')).toContainText('the 09:30 run');
  await page.getByRole('link', { name: 'Forecast accuracy' }).click();
  await expect(page).toHaveURL(/gate=n2ex/);
});

test('accuracy page reports the January backtest', async ({ page }) => {
  await page.goto('/accuracy');
  await expect(page.getByRole('article', { name: 'Mean absolute error' })).toContainText('2.02 GW');
  await expect(page.getByRole('article', { name: 'Bias' })).toContainText('+1.75 GW');
  await expect(page.getByText('What the backtest says')).toBeVisible();
});

test('methodology lists data-quality findings', async ({ page }) => {
  await page.goto('/methodology');
  await expect(
    page.getByText(/Off-schedule forecast run published 12:25 on 15 Jan 2026/),
  ).toBeVisible();
  await expect(page.getByText(/2,208 of 2,208 half-hours present/)).toBeVisible();
});
