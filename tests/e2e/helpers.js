// Shared helpers for E2E tests

/** Wait for Algolia results to settle (stat-count stops being "—") */
export async function waitForResults(page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('stat-count');
    return el && el.textContent !== '—';
  }, { timeout: 10000 });
}

/** Get the numeric value of stat-count */
export async function getResultCount(page) {
  const text = await page.locator('#stat-count').textContent();
  return parseInt(text.replace(/[^0-9]/g, ''), 10);
}

/**
 * Perform an action and wait for the stat-count to change.
 * Returns the new count.
 */
export async function doAndWaitForNewCount(page, action) {
  const before = await getResultCount(page);
  await action();
  await page.waitForFunction((prev) => {
    const el = document.getElementById('stat-count');
    if (!el || el.textContent === '—') return false;
    const cur = parseInt(el.textContent.replace(/[^0-9]/g, ''), 10);
    return !isNaN(cur) && cur !== prev;
  }, before, { timeout: 10000 });
  return getResultCount(page);
}

/** Open the search panel by focusing the search input */
export async function openSearchPanel(page) {
  await page.locator('#search-input').focus();
  await page.waitForSelector('#search-panel.open', { timeout: 5000 });
}
