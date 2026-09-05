import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: process.env.CI ? 90_000 : 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  // The portable app is a multi-megabyte single HTML document. Loading several
  // fresh copies in parallel on a small CI runner can starve Chromium long
  // enough that DOMContentLoaded never arrives before the test timeout.
  // Desktop and mobile already run in separate GitHub Actions jobs, so one
  // worker per job keeps the browser isolated without sacrificing matrix-level
  // parallelism.
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: process.env.CI ? 60_000 : 30_000
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true,
    timeout: 30_000
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }
  ]
});
