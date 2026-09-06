import { test, expect } from '@playwright/test';

const APP_PATH = '/critical-smoke.html';
const ANALYTICS_DISABLED_KEY = 'classroom-seating-planner-google-analytics-disabled-v6';

async function completeFreshSecuritySetup(page) {
  const welcome = page.locator('#welcomeSecurityModal');
  await expect(welcome).toHaveClass(/\bshow\b/, { timeout: 30_000 });
  await expect(welcome).toHaveAttribute('data-startup-mode', 'fresh');
  const passphrase = 'v7.3 critical smoke classroom passphrase 2026';
  await page.locator('#welcomeEncryptionKeyInput').fill(passphrase);
  await page.locator('#welcomeEncryptionKeyConfirmInput').fill(passphrase);
  await page.locator('#welcomeSecurityStartBtn').click();
  await expect(welcome).not.toHaveClass(/\bshow\b/, { timeout: 15_000 });
}

async function closeAutomaticGettingStartedIfNeeded(page) {
  const modal = page.locator('#gettingStartedModal');
  if (!(await modal.count())) return;
  try {
    await expect(modal).toHaveClass(/\bshow\b/, { timeout: 2_000 });
  } catch (_) {
    return;
  }
  const close = page.locator('#gettingStartedCloseBtn');
  if (await close.count()) await close.click();
  else await page.evaluate(() => window.ProductRepairV43?.closeGettingStarted?.());
  await expect(modal).not.toHaveClass(/\bshow\b/, { timeout: 8_000 });
}

test('V7.3 critical planner path loads and remains navigable', async ({ page, request }) => {
  test.setTimeout(90_000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  // Verify the exact production artifact is present. Release validation separately
  // proves it is a deterministic rebuild of the same modular source.
  const production = await request.get('/index.html');
  expect(production.ok()).toBeTruthy();
  expect(await production.text()).toContain('name="app-version" content="7.3.0"');

  // Analytics is intentionally disabled in CI. The smoke gate verifies the planner,
  // not the availability of an external analytics tag.
  await page.addInitScript(key => localStorage.setItem(key, 'true'), ANALYTICS_DISABLED_KEY);

  // The production build is one portable file. The smoke harness uses the same DOM,
  // CSS and ordered modules as separate same-origin resources so CI can interact with
  // the app without waiting for one giant inline script lifecycle event.
  const response = await page.goto(APP_PATH, { waitUntil: 'commit', timeout: 30_000 });
  expect(response?.ok()).toBeTruthy();
  await page.waitForSelector('#welcomeSecurityModal', { state: 'attached', timeout: 15_000 });
  await expect(page).toHaveTitle(/Classroom Seating Planner/i);
  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', '7.3.0');

  for (const path of ['/manifest.webmanifest', '/service-worker.js', '/app-icon.svg']) {
    const asset = await request.get(path);
    expect(asset.ok(), `${path} should load`).toBeTruthy();
  }

  await completeFreshSecuritySetup(page);
  await closeAutomaticGettingStartedIfNeeded(page);
  await page.waitForSelector('#v4WorkflowNav', { state: 'attached', timeout: 30_000 });

  await expect(page.locator('#classSelect')).toHaveCount(1);
  await expect(page.locator('#settingsBtn')).toBeVisible();
  await expect(page.locator('#helpGuideBtn')).toBeVisible();
  await expect(page.locator('#inlineSaveStatus')).toHaveCount(1);

  for (const workflow of ['setup', 'room', 'seating', 'review', 'share']) {
    const button = page.locator(`#v4WorkflowNav [data-workflow="${workflow}"]`);
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.locator('body')).toHaveAttribute('data-workflow', workflow);
  }

  await page.locator('#v4MoreMenuBtn').click();
  await expect(page.locator('#visibilityModeBtn')).toBeVisible();
  await page.locator('#visibilityModeBtn').click();
  await expect(page.locator('body')).toHaveClass(/\bvisibility-mode\b/);
  await expect(page.locator('body')).toHaveAttribute('data-workflow', 'review');

  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    html: document.documentElement.scrollWidth
  }));
  expect(geometry.body).toBeLessThanOrEqual(geometry.viewport + 2);
  expect(geometry.html).toBeLessThanOrEqual(geometry.viewport + 2);

  await page.waitForTimeout(150);
  expect(pageErrors).toEqual([]);
});
