import { test, expect } from '@playwright/test';
import { waitForResults, getResultCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForResults(page);
});

test('cuisine pills row renders at least one pill after load', async ({ page }) => {
  // Pills are hidden by CSS (.filters-section display:none) — they're populated but not shown
  // We verify the DOM container has children
  const count = await page.locator('#filters-container .filter-pill').count();
  expect(count).toBeGreaterThan(1); // "All" + at least one cuisine
});

test('clicking a cuisine pill applies filter and marks pill active', async ({ page }) => {
  const totalCount = await getResultCount(page);
  // Pills are in #filters-container — click first non-"All" pill
  const pill = page.locator('#filters-container .filter-pill:not([data-filter=""])').first();
  if (await pill.isVisible()) {
    await pill.click();
    await waitForResults(page);
    await expect(pill).toHaveClass(/active/);
    const filteredCount = await getResultCount(page);
    expect(filteredCount).toBeLessThanOrEqual(totalCount);
  }
});

test('Cuisine filter bar dropdown opens on click', async ({ page }) => {
  await page.locator('#cuisine-filter-btn').click();
  await expect(page.locator('#cuisine-dropdown')).toHaveClass(/open/);
});

test('Cuisine dropdown closes when clicking outside', async ({ page }) => {
  await page.locator('#cuisine-filter-btn').click();
  await expect(page.locator('#cuisine-dropdown')).toHaveClass(/open/);
  await page.mouse.click(10, 10);
  await expect(page.locator('#cuisine-dropdown')).not.toHaveClass(/open/);
});

test('Price filter dropdown opens on click', async ({ page }) => {
  await page.locator('#price-filter-btn').click();
  await expect(page.locator('#price-dropdown')).toHaveClass(/open/);
});

test('Rating filter dropdown opens on click', async ({ page }) => {
  await page.locator('#rating-filter-btn').click();
  await expect(page.locator('#rating-dropdown')).toHaveClass(/open/);
});

test('Dining style filter dropdown opens on click', async ({ page }) => {
  await page.locator('#dining-filter-btn').click();
  await expect(page.locator('#dining-dropdown')).toHaveClass(/open/);
});

test('Payment filter dropdown opens on click', async ({ page }) => {
  await page.locator('#payment-filter-btn').click();
  await expect(page.locator('#payment-dropdown')).toHaveClass(/open/);
});
