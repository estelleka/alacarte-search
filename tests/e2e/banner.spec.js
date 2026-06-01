import { test, expect } from '@playwright/test';
import { waitForResults, doAndWaitForNewCount, openSearchPanel } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForResults(page);
});

test('hero banner is visible on load with title containing "Top Rated"', async ({ page }) => {
  await expect(page.locator('#hero-banner')).toBeVisible();
  await expect(page.locator('.hero-strip-title')).toContainText('Top Rated');
});

test('banner title changes when a cuisine filter is selected', async ({ page }) => {
  const titleBefore = await page.locator('.hero-strip-title').textContent();
  await openSearchPanel(page);
  await doAndWaitForNewCount(page, () =>
    page.locator('#sp-cuisine-chips .sp-chip').first().click({ force: true })
  );
  // Wait for hero to re-render
  await page.waitForTimeout(1000);
  const titleAfter = await page.locator('.hero-strip-title').textContent();
  expect(titleAfter).not.toBe(titleBefore);
});

test('fake geo tool updates stat-geo with the coordinates', async ({ page }) => {
  // The fake geo tool in the Algolia Story panel sets stat-geo to the raw label
  await page.evaluate(() => {
    document.getElementById('fake-geo-input').value = '40.7128,-74.0060';
    document.getElementById('fake-geo-btn').click();
  });
  // stat-geo is updated synchronously by applyFakeGeo
  await page.waitForFunction(
    () => document.getElementById('stat-geo').textContent !== '—',
    { timeout: 5000 }
  );
  const statGeo = await page.locator('#stat-geo').textContent();
  expect(statGeo.trim().length).toBeGreaterThan(0);
  expect(statGeo).not.toBe('—');
});

test('banner is hidden when user types in search', async ({ page }) => {
  await expect(page.locator('#hero-banner')).toBeVisible();
  await page.locator('#search-input').fill('sushi');
  await expect(page.locator('#hero-banner')).toHaveClass(/hidden/);
});

test('banner reappears after clearing search input', async ({ page }) => {
  await page.locator('#search-input').fill('sushi');
  await expect(page.locator('#hero-banner')).toHaveClass(/hidden/);
  await page.locator('#search-input').clear();
  await waitForResults(page);
  await expect(page.locator('#hero-banner')).not.toHaveClass(/hidden/);
});
