import { test, expect } from '@playwright/test';

async function completeFreshSecuritySetupIfNeeded(page) {
  const welcome = page.locator('#welcomeSecurityModal');
  if (!(await welcome.count())) return;
  const shown = await welcome.evaluate(node => node.classList.contains('show'));
  if (!shown) return;
  const passphrase = 'v7.3 critical smoke classroom passphrase 2026';
  await page.locator('#welcomeEncryptionKeyInput').fill(passphrase);
  await page.locator('#welcomeEncryptionKeyConfirmInput').fill(passphrase);
  await page.locator('#welcomeSecurityStartBtn').click();
  await expect(welcome).not.toHaveClass(/\bshow\b/, { timeout: 20_000 });
}

async function closeAutomaticGettingStartedIfNeeded(page) {
  const modal = page.locator('#gettingStartedModal');
  if (!(await modal.count())) return;
  try {
    await expect(modal).toHaveClass(/\bshow\b/, { timeout: 3_000 });
  } catch (_) {
    return;
  }
  await page.locator('#gettingStartedCloseBtn').click();
  await expect(modal).not.toHaveClass(/\bshow\b/, { timeout: 10_000 });
}

test('V7.3 critical planner path loads and remains navigable', async ({ page, request }) => {
  test.setTimeout(150_000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  const response = await page.goto('/index.html', { waitUntil: 'commit', timeout: 30_000 });
  expect(response?.ok()).toBeTruthy();
  await page.waitForSelector('#v4WorkflowNav', { state: 'attached', timeout: 90_000 });
  await expect(page).toHaveTitle(/Classroom Seating Planner/i);
  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', '7.3.0');

  for (const path of ['/manifest.webmanifest', '/service-worker.js', '/app-icon.svg']) {
    const asset = await request.get(path);
    expect(asset.ok(), `${path} should load`).toBeTruthy();
  }

  await completeFreshSecuritySetupIfNeeded(page);
  await closeAutomaticGettingStartedIfNeeded(page);

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

  await page.waitForTimeout(250);
  expect(pageErrors).toEqual([]);
});
