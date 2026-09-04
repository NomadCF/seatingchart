import { test, expect } from '@playwright/test';

async function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}

test('application boots without uncaught runtime errors', async ({ page }) => {
  const errors = await collectPageErrors(page);
  const response = await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/Classroom Seating Planner/i);
  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', /\d+\.\d+\.\d+/);
  await page.waitForTimeout(1200);
  expect(errors).toEqual([]);
});

test('hosted PWA companion files are reachable', async ({ request }) => {
  for (const path of ['/manifest.webmanifest', '/service-worker.js', '/app-icon.svg']) {
    const response = await request.get(path);
    expect(response.ok(), `${path} should load`).toBeTruthy();
  }
});

test('main interface does not create page-level horizontal overflow', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    html: document.documentElement.scrollWidth
  }));
  expect(geometry.body).toBeLessThanOrEqual(geometry.viewport + 2);
  expect(geometry.html).toBeLessThanOrEqual(geometry.viewport + 2);
});

test('core controls remain addressable for keyboard and automation', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  for (const selector of ['#classSelect', '#duplicateClassBtn', '#visibilityModeBtn']) {
    await expect(page.locator(selector), selector).toHaveCount(1);
  }
  await expect(page.locator('[aria-live]').first()).toHaveCount(1);
});

test('Classroom Intelligence is available through Advanced tools', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#v4MoreMenuBtn')).toBeVisible();
  await page.locator('#v4MoreMenuBtn').click();
  await expect(page.locator('#openPlanningToolsBtn')).toBeVisible();
  await page.locator('#openPlanningToolsBtn').click();
  await expect(page.locator('[data-intelligence-tab]')).toHaveCount(1);
  await page.locator('[data-intelligence-tab]').click();
  await expect(page.getByText('Plan for what you are doing today')).toBeVisible();
  await expect(page.locator('[data-intelligence-scenario]')).toHaveCount(6);
  await expect(page.locator('#previewIntelligenceRepairBtn')).toBeVisible();
});
