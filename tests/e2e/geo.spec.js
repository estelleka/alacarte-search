import { test, expect } from '@playwright/test';
import { waitForResults, getResultCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForResults(page);
});

test('Location dropdown opens on click', async ({ page }) => {
  await page.locator('#geo-filter-btn').click();
  await expect(page.locator('#geo-dropdown')).toHaveClass(/open/);
});

test('city search shows Nominatim suggestions', async ({ page }) => {
  await page.locator('#geo-filter-btn').click();
  await page.locator('#geo-search-input').fill('New York');
  // Wait for Nominatim to respond (network call — give it time)
  await page.waitForFunction(
    () => document.getElementById('geo-suggestions').children.length > 0,
    { timeout: 8000 }
  );
  await expect(page.locator('#geo-suggestions').locator('.geo-suggestion-item').first()).toBeVisible();
});

test('selecting a geo suggestion updates Location label and results', async ({ page }) => {
  const totalCount = await getResultCount(page);
  await page.locator('#geo-filter-btn').click();
  await page.locator('#geo-search-input').fill('New York');
  await page.waitForFunction(
    () => document.getElementById('geo-suggestions').children.length > 0,
    { timeout: 8000 }
  );
  await page.locator('#geo-suggestions .geo-suggestion-item').first().click();
  await waitForResults(page);

  const label = await page.locator('#geo-filter-label').textContent();
  expect(label.trim()).not.toBe('Location');
  const filteredCount = await getResultCount(page);
  expect(filteredCount).toBeLessThanOrEqual(totalCount);
});

test('radius slider changes displayed value', async ({ page }) => {
  await page.locator('#geo-filter-btn').click();
  // Move slider to value 20
  await page.locator('#fbar-radius-slider').fill('20');
  await page.locator('#fbar-radius-slider').dispatchEvent('input');
  const val = await page.locator('#fbar-radius-val').textContent();
  expect(val).toContain('20');
});

test('"Use my location" button is visible in geo dropdown', async ({ page }) => {
  await page.locator('#geo-filter-btn').click();
  await expect(page.locator('#fbar-nearme-btn')).toBeVisible();
});
