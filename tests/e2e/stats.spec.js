import { test, expect } from '@playwright/test';
import { waitForResults, doAndWaitForNewCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForResults(page);
});

test('stat-count is > 0 on load', async ({ page }) => {
  const text = await page.locator('#stat-count').textContent();
  expect(parseInt(text.replace(/[^0-9]/g, ''), 10)).toBeGreaterThan(0);
});

test('stat-time shows a response time in ms', async ({ page }) => {
  const text = await page.locator('#stat-time').textContent();
  expect(text).toMatch(/\d+ms/);
});

test('stat-count changes after searching "sushi"', async ({ page }) => {
  const newCount = await doAndWaitForNewCount(page, () =>
    page.locator('#search-input').fill('sushi')
  );
  expect(newCount).toBeGreaterThan(0);
});

test('typo badge disappears after clearing search', async ({ page }) => {
  await page.locator('#search-input').fill('sush');
  await waitForResults(page);
  await page.locator('#search-input').clear();
  await waitForResults(page);
  await expect(page.locator('#stat-typo')).not.toHaveClass(/visible/);
});

test('typo badge may appear when Algolia corrects a query', async ({ page }) => {
  await page.locator('#search-input').fill('sush');
  await waitForResults(page);
  // This feature depends on Algolia's correction — only verify structure
  const badge = page.locator('#stat-typo');
  await expect(badge).toBeAttached();
});
