import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  workers: 1,          // run files sequentially to avoid Algolia rate limiting
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    actionTimeout: 10000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx serve . -p 3000',
    port: 3000,
    reuseExistingServer: true,
  },
});
