import { test, expect } from '@playwright/test';
import { waitForResults, getResultCount, doAndWaitForNewCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForResults(page);
});

test('initial load shows results with count > 0', async ({ page }) => {
  const count = await getResultCount(page);
  expect(count).toBeGreaterThan(0);
  await expect(page.locator('.restaurant-card').first()).toBeVisible();
});

test('searching "sushi" changes result count', async ({ page }) => {
  const newCount = await doAndWaitForNewCount(page, () =>
    page.locator('#search-input').fill('sushi')
  );
  expect(newCount).toBeGreaterThan(0);
});

test('searching a nonsense term shows empty state', async ({ page }) => {
  // Use a query that is guaranteed to return 0 results
  await page.locator('#search-input').fill('zzznomatchzzz999');
  await page.waitForSelector('.empty-state', { timeout: 10000 });
  await expect(page.locator('.empty-state')).toBeVisible();
});

test('clicking a card opens the modal', async ({ page }) => {
  await page.locator('.restaurant-card').first().click();
  await expect(page.locator('#modal-backdrop')).toHaveClass(/open/);
});

test('modal shows restaurant name and reserve button', async ({ page }) => {
  await page.locator('.restaurant-card').first().click();
  await expect(page.locator('#modal-name')).not.toBeEmpty();
  await expect(page.locator('#modal-reserve')).toBeVisible();
});

test('closing modal hides the backdrop', async ({ page }) => {
  await page.locator('.restaurant-card').first().click();
  await expect(page.locator('#modal-backdrop')).toHaveClass(/open/);
  await page.locator('#modal-close').click();
  await expect(page.locator('#modal-backdrop')).not.toHaveClass(/open/);
});

test('"show more" button loads additional cards when visible', async ({ page }) => {
  const loadMore = page.locator('#load-more-btn');
  const isVisible = await loadMore.isVisible();
  if (!isVisible) {
    test.skip();
    return;
  }
  const initialCards = await page.locator('#results .restaurant-card').count();
  await loadMore.click();
  // Wait for new cards to appear in DOM
  await page.waitForFunction((prev) => {
    return document.querySelectorAll('#results .restaurant-card').length > prev;
  }, initialCards, { timeout: 10000 });
  const moreCards = await page.locator('#results .restaurant-card').count();
  expect(moreCards).toBeGreaterThan(initialCards);
});
