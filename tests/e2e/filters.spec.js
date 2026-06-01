import { test, expect } from '@playwright/test';
import { waitForResults, getResultCount, doAndWaitForNewCount, openSearchPanel } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForResults(page);
});

test('clicking cuisine chip applies filter, closes panel, and changes count', async ({ page }) => {
  await openSearchPanel(page);
  const chip = page.locator('#sp-cuisine-chips .sp-chip').first();

  const newCount = await doAndWaitForNewCount(page, () => chip.click({ force: true }));
  await expect(page.locator('#search-panel')).not.toHaveClass(/open/);
  // count may go up or down depending on cuisine — just verify it changed
  expect(newCount).toBeGreaterThan(0);
});

test('selecting a cuisine chip applies the cuisine filter to the filter bar', async ({ page }) => {
  await openSearchPanel(page);
  await page.locator('#sp-cuisine-chips .sp-chip').first().click({ force: true });
  // applyAllChipFilters + syncChipDOM + updateChipLabels run synchronously in the handler
  // cuisine-filter-label changes from "Cuisine" to the selected cuisine name
  await page.waitForFunction(
    () => document.getElementById('cuisine-filter-label').textContent.trim() !== 'Cuisine',
    { timeout: 5000 }
  );
  const label = await page.locator('#cuisine-filter-label').textContent();
  expect(label.trim()).not.toBe('Cuisine');
  expect(label.trim().length).toBeGreaterThan(0);
});

test('popular search fills input and triggers search', async ({ page }) => {
  await openSearchPanel(page);
  const queryItem = page.locator('#sp-queries .sp-query-item').first();
  const queryText = (await queryItem.textContent()).trim();

  await doAndWaitForNewCount(page, () => queryItem.click({ force: true }));
  const inputValue = await page.locator('#search-input').inputValue();
  expect(inputValue.trim().length).toBeGreaterThan(0);
  expect(queryText.toLowerCase()).toContain(inputValue.trim().toLowerCase());
});

test('price filter $$ changes result count', async ({ page }) => {
  await page.locator('#price-filter-btn').click();
  await page.waitForSelector('#price-dropdown.open');
  const newCount = await doAndWaitForNewCount(page, () =>
    page.locator('.fbar-chip[data-value="$31 to $50"]').click()
  );
  expect(newCount).toBeGreaterThan(0);
});

test('cuisine + price combination gives fewer or equal results than cuisine alone', async ({ page }) => {
  await openSearchPanel(page);
  const cuisineCount = await doAndWaitForNewCount(page, () =>
    page.locator('#sp-cuisine-chips .sp-chip').first().click({ force: true })
  );

  await page.locator('#price-filter-btn').click();
  await page.waitForSelector('#price-dropdown.open');
  const comboCount = await doAndWaitForNewCount(page, () =>
    page.locator('.fbar-chip[data-value="$31 to $50"]').click()
  );
  expect(comboCount).toBeLessThanOrEqual(cuisineCount);
});

test('cuisine + rating ≥4 gives fewer or equal results than cuisine alone', async ({ page }) => {
  await openSearchPanel(page);
  const cuisineCount = await doAndWaitForNewCount(page, () =>
    page.locator('#sp-cuisine-chips .sp-chip').first().click({ force: true })
  );

  await page.locator('#rating-filter-btn').click();
  await page.waitForSelector('#rating-dropdown.open');
  const comboCount = await doAndWaitForNewCount(page, () =>
    page.locator('.fbar-chip[data-rating="4"]').click()
  );
  expect(comboCount).toBeLessThanOrEqual(cuisineCount);
});

test('cuisine + dining style gives fewer or equal results than cuisine alone', async ({ page }) => {
  await openSearchPanel(page);
  const cuisineCount = await doAndWaitForNewCount(page, () =>
    page.locator('#sp-cuisine-chips .sp-chip').first().click({ force: true })
  );

  await page.locator('#dining-filter-btn').click();
  await page.waitForSelector('#dining-dropdown.open');
  const comboCount = await doAndWaitForNewCount(page, () =>
    page.locator('.fbar-chip[data-value="Casual Dining"]').click()
  );
  expect(comboCount).toBeLessThanOrEqual(cuisineCount);
});

test('reset all restores original count and clears active chips', async ({ page }) => {
  const totalCount = await getResultCount(page);
  await page.locator('#price-filter-btn').click();
  await page.waitForSelector('#price-dropdown.open');
  await doAndWaitForNewCount(page, () =>
    page.locator('.fbar-chip[data-value="$31 to $50"]').click()
  );

  const resetCount = await doAndWaitForNewCount(page, () =>
    page.locator('#fbar-reset').click()
  );
  expect(resetCount).toBe(totalCount);
  await expect(page.locator('.fbar-chip.active')).toHaveCount(0);
});
