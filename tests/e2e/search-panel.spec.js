import { test, expect } from '@playwright/test';
import { waitForResults } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForResults(page);
});

test('search panel is hidden on page load', async ({ page }) => {
  const panel = page.locator('#search-panel');
  await expect(panel).not.toHaveClass(/open/);
});

test('search panel opens on focus when query is empty', async ({ page }) => {
  await page.locator('#search-input').focus();
  await expect(page.locator('#search-panel')).toHaveClass(/open/);
});

test('search panel closes when user types', async ({ page }) => {
  await page.locator('#search-input').focus();
  await expect(page.locator('#search-panel')).toHaveClass(/open/);
  await page.locator('#search-input').fill('s');
  await expect(page.locator('#search-panel')).not.toHaveClass(/open/);
});

test('search panel reopens after clearing input and refocusing', async ({ page }) => {
  await page.locator('#search-input').fill('sushi');
  await page.locator('#search-input').clear();
  await page.locator('#search-input').focus();
  await expect(page.locator('#search-panel')).toHaveClass(/open/);
});

test('Escape key closes search panel', async ({ page }) => {
  await page.locator('#search-input').focus();
  await expect(page.locator('#search-panel')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#search-panel')).not.toHaveClass(/open/);
});

test('search panel contains cuisine chips and popular searches', async ({ page }) => {
  await page.locator('#search-input').focus();
  await expect(page.locator('#sp-cuisine-chips .sp-chip').first()).toBeVisible();
  await expect(page.locator('#sp-queries .sp-query-item').first()).toBeVisible();
});
