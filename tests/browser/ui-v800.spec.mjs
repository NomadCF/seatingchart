import { test, expect } from '@playwright/test';

async function completeFreshSecuritySetupIfNeeded(page) {
  const modal = page.locator('#welcomeSecurityModal.show');
  if (await modal.count() === 0) return;
  const passphrase = 'v8 interface regression secure classroom passphrase 2026';
  await page.locator('#welcomeEncryptionKeyInput').fill(passphrase);
  await page.locator('#welcomeEncryptionKeyConfirmInput').fill(passphrase);
  await page.locator('#welcomeSecurityStartBtn').click();
  await expect(page.locator('#welcomeSecurityModal')).not.toHaveClass(/\bshow\b/, { timeout:15000 });
}

async function closeAutomaticGettingStartedIfNeeded(page) {
  const modal = page.locator('#gettingStartedModal');
  try { await expect(modal).toHaveClass(/\bshow\b/, { timeout:4000 }); }
  catch (_) { return; }
  await page.locator('#gettingStartedCloseBtn').click();
  await expect(modal).not.toHaveClass(/\bshow\b/, { timeout:10000 });
}

async function ready(page) {
  await page.goto('/index.html', { waitUntil:'domcontentloaded' });
  await completeFreshSecuritySetupIfNeeded(page);
  await closeAutomaticGettingStartedIfNeeded(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.InterfaceV800 && document.body.classList.contains('v8-interface'))), { timeout:15000 }).toBe(true);
}

test('V8 exposes one five-workspace navigation system and removes the legacy workflow strip', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#v8WorkspaceNav [data-v8-workspace]')).toHaveCount(5);
  await expect(page.locator('#v4WorkflowNav')).toBeHidden();
  await expect(page.locator('#mobilePanelNav')).toBeHidden();
  const audit = await page.evaluate(() => window.InterfaceV800.audit());
  expect(audit.version).toBe('8.0.0');
  expect(audit.navButtons).toBe(5);
  expect(audit.activeButtons).toBe(1);
  expect(audit.oldWorkflowVisible).toBe(false);
  expect(audit.duplicateIds).toEqual([]);
});

test('V8 isolates Class, Room, Seat, Plans, and Review surfaces', async ({ page }) => {
  await ready(page);

  await page.locator('[data-v8-workspace="class"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-v8-workspace', 'class');
  await expect(page.locator('.left-panel')).toBeVisible();
  await expect(page.locator('.center-panel')).toBeHidden();
  await expect(page.locator('#v8ContextTitle')).toHaveText('Class workspace');

  await page.locator('[data-v8-workspace="room"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-v8-workspace', 'room');
  await expect(page.locator('.center-panel')).toBeVisible();
  await expect(page.locator('.left-panel')).toBeHidden();
  await expect(page.locator('#layoutToolsPanel')).toBeVisible();

  await page.locator('[data-v8-workspace="seat"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-v8-workspace', 'seat');
  await expect(page.locator('.center-panel')).toBeVisible();
  await expect(page.locator('#v8ContextTitle')).toHaveText('Seat students');

  await page.locator('[data-v8-workspace="plans"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-v8-workspace', 'plans');
  await expect(page.locator('#v8PlansHub')).toBeVisible();
  await expect(page.locator('#v8PlansHub .v8-plan-card')).toHaveCount(6);
  await expect(page.locator('.center-panel')).toBeHidden();

  await page.locator('[data-v8-workspace="review"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-v8-workspace', 'review');
  await expect(page.locator('.center-panel')).toBeVisible();
  await expect(page.locator('#layoutToolsPanel')).toBeHidden();
  await expect(page.locator('#v8ReviewActions')).toBeVisible();
});

test('V8 keeps chart zoom and text-size controls available on seating surfaces', async ({ page }) => {
  await ready(page);
  for (const workspace of ['room', 'seat', 'review']) {
    await page.locator(`[data-v8-workspace="${workspace}"]`).click();
    await expect(page.locator('#seatViewZoomSlider')).toBeVisible();
    await expect(page.locator('#seatTextSizeSlider')).toBeVisible();
  }
});

test('V8 leaving Room disables Design Mode', async ({ page }) => {
  await ready(page);
  await page.locator('[data-v8-workspace="room"]').click();
  await page.evaluate(() => {
    uiState.designMode = true;
    applyDesignModeUi?.();
  });
  await page.locator('[data-v8-workspace="seat"]').click();
  await expect.poll(() => page.evaluate(() => Boolean(uiState.designMode))).toBe(false);
});

test('V8 keeps Planner Assistant and Settings globally recoverable', async ({ page }) => {
  await ready(page);
  await page.locator('[data-v8-workspace="seat"]').click();
  await page.locator('[data-v8-action="assistant"]').click();
  await expect.poll(() => page.evaluate(() => {
    const dock = document.getElementById('plannerAssistantV721Dock');
    const compact = document.getElementById('plannerAssistantV721Compact');
    return Boolean((dock && getComputedStyle(dock).display !== 'none') || (compact && getComputedStyle(compact).display !== 'none'));
  })).toBe(true);
  await expect(page.locator('#settingsBtn')).toBeAttached();
});

test('V8 mobile uses bottom navigation, sheets, and avoids page-level horizontal overflow', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile-only interface test');
  await ready(page);
  const navBox = await page.locator('#v8WorkspaceNav').boundingBox();
  const viewport = page.viewportSize();
  expect(navBox).not.toBeNull();
  expect(Math.abs((navBox.y + navBox.height) - viewport.height)).toBeLessThanOrEqual(4);

  await page.locator('[data-v8-workspace="seat"]').click();
  await expect(page.locator('.left-panel')).toBeHidden();
  await page.locator('[data-v8-action="seat-roster"]').click();
  await expect(page.locator('body')).toHaveClass(/v8-mobile-roster-open/);
  await expect(page.locator('.left-panel')).toBeVisible();
  await page.locator('#v8SheetBackdrop').click({ position:{ x:5, y:5 } });
  await expect(page.locator('body')).not.toHaveClass(/v8-mobile-roster-open/);

  await page.locator('[data-v8-workspace="review"]').click();
  await page.locator('[data-v8-action="review-details"]').click();
  await expect(page.locator('body')).toHaveClass(/v8-mobile-review-open/);
  await expect(page.locator('.right-panel')).toBeVisible();

  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  expect(overflow).toBeLessThanOrEqual(2);
});

test('V8 Presentation Mode stays in Review and hides editing navigation', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => window.InterfaceV800.switchWorkspace('review', { silent:true }));
  await page.locator('#visibilityModeBtn').click();
  await expect.poll(() => page.evaluate(() => Boolean(uiState.visibilityMode))).toBe(true);
  await expect(page.locator('body')).toHaveAttribute('data-v8-workspace', 'review');
  await expect(page.locator('#v8WorkspaceNav')).toBeHidden();
  await expect(page.locator('#v8ContextBar')).toBeHidden();
});
