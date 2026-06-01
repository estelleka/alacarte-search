import { test, expect } from '@playwright/test';
import { waitForResults } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForResults(page);
});

test('clicking Map button opens the map overlay', async ({ page }) => {
  await page.locator('#map-open-btn').click();
  await expect(page.locator('#map-overlay')).toHaveClass(/open/);
});

test('map overlay contains a rendered Leaflet map', async ({ page }) => {
  await page.locator('#map-open-btn').click();
  await page.waitForSelector('.leaflet-container', { timeout: 5000 });
  await expect(page.locator('.leaflet-container')).toBeVisible();
});

test('clicking Map button again closes the overlay', async ({ page }) => {
  await page.locator('#map-open-btn').click();
  await expect(page.locator('#map-overlay')).toHaveClass(/open/);
  await page.locator('#map-open-btn').click();
  await expect(page.locator('#map-overlay')).not.toHaveClass(/open/);
});

test('map shows markers after applying fake geo filter', async ({ page }) => {
  await page.locator('#algolia-story-btn').click();
  await page.locator('#fake-geo-input').fill('40.7128,-74.0060');
  await page.locator('#fake-geo-btn').click();
  await waitForResults(page);

  await page.locator('#map-open-btn').click();
  await page.waitForSelector('.leaflet-marker-icon', { timeout: 8000 });
  const markers = page.locator('.leaflet-marker-icon');
  expect(await markers.count()).toBeGreaterThan(0);
});
