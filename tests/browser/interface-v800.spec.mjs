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
  await expect.poll(() => page.evaluate(() => Boolean(window.InterfaceV800))).toBe(true);
  await expect(page.locator('body')).toHaveClass(/\bv8-interface\b/);
}

test('V8 replaces the legacy workflow strip with five canonical workspaces', async ({ page }) => {
  await ready(page);
  const audit = await page.evaluate(() => window.InterfaceV800.audit());
  expect(audit.version).toBe('8.0.0');
  expect(audit.navButtons).toBe(5);
  expect(audit.activeButtons).toBe(1);
  expect(audit.oldWorkflowVisible).toBe(false);
  expect(audit.duplicateIds).toEqual([]);
  await expect(page.locator('#v8WorkspaceNav')).toContainText('Class');
  await expect(page.locator('#v8WorkspaceNav')).toContainText('Room');
  await expect(page.locator('#v8WorkspaceNav')).toContainText('Seat');
  await expect(page.locator('#v8WorkspaceNav')).toContainText('Plans');
  await expect(page.locator('#v8WorkspaceNav')).toContainText('Review');
});

test('V8 workspace switching exposes one focused surface at a time', async ({ page }) => {
  await ready(page);
  await page.locator('[data-v8-workspace="class"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-v8-workspace', 'class');
  await expect(page.locator('.left-panel')).toBeVisible();
  await expect(page.locator('.center-panel')).toBeHidden();

  await page.locator('[data-v8-workspace="room"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-v8-workspace', 'room');
  await expect(page.locator('.center-panel')).toBeVisible();
  await expect(page.locator('.left-panel')).toBeHidden();

  await page.locator('[data-v8-workspace="plans"]').click();
  await expect(page.locator('#v8PlansHub')).toBeVisible();
  await expect(page.locator('#v8PlansHub')).toContainText('Activity layouts');
  await expect(page.locator('#v8PlansHub')).toContainText('Testing mode');
  await expect(page.locator('#v8PlansHub')).toContainText('Station rotations');

  await page.locator('[data-v8-workspace="review"]').click();
  await expect(page.locator('.center-panel')).toBeVisible();
  if (test.info().project.name === 'desktop-chromium') await expect(page.locator('.right-panel')).toBeVisible();
});

test('V8 turns Room Design mode off when leaving the Room workspace', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => window.InterfaceV800.switchWorkspace('room', { silent:true }));
  await page.evaluate(() => {
    uiState.designMode = true;
    if (typeof applyDesignModeUi === 'function') applyDesignModeUi();
  });
  await page.evaluate(() => window.InterfaceV800.switchWorkspace('seat', { silent:true }));
  expect(await page.evaluate(() => Boolean(uiState.designMode))).toBe(false);
});

test('V8 keeps seat zoom and text size controls on chart workspaces', async ({ page }) => {
  await ready(page);
  for (const workspace of ['room','seat','review']) {
    await page.evaluate(key => window.InterfaceV800.switchWorkspace(key, { silent:true }), workspace);
    await expect(page.locator('#seatViewZoomSlider')).toBeVisible();
    await expect(page.locator('#seatTextSizeSlider')).toBeVisible();
  }
});

test('V8 preserves Settings and Planner Assistant entry points', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#settingsBtn')).toBeVisible();
  await page.evaluate(() => window.InterfaceV800.switchWorkspace('seat', { silent:true }));
  await page.locator('[data-v8-action="assistant"]').click();
  await expect.poll(() => page.evaluate(() => window.InterfaceAssistantAuditV721?.getMode?.() || window.InterfaceAssistantAuditV721?.mode?.() || '')).not.toBe('hidden');
  await expect(page.locator('#plannerAssistantV721Dock, #plannerAssistantV710Modal, #plannerAssistantV721Compact').filter({ visible:true }).first()).toBeVisible();
});

test('V8 has no duplicate Guide me controls or horizontal page overflow', async ({ page }) => {
  await ready(page);
  const audit = await page.evaluate(() => window.InterfaceV800.audit());
  expect(audit.guideMeCount).toBe(0);
  expect(audit.horizontalOverflow).toBeLessThanOrEqual(2);
});

test('V8 mobile uses bottom workspace navigation and sheet-based secondary panels', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-chromium', 'Mobile-only V8 behavior');
  await ready(page);
  const navBox = await page.locator('#v8WorkspaceNav').boundingBox();
  const viewport = page.viewportSize();
  expect(navBox).not.toBeNull();
  expect(Math.abs((navBox.y + navBox.height) - viewport.height)).toBeLessThanOrEqual(3);

  await page.evaluate(() => window.InterfaceV800.switchWorkspace('seat', { silent:true }));
  await expect(page.locator('.left-panel')).toBeHidden();
  await page.locator('[data-v8-action="seat-roster"]').click();
  await expect(page.locator('body')).toHaveClass(/\bv8-mobile-roster-open\b/);
  await expect(page.locator('.left-panel')).toBeVisible();
  await page.locator('#v8SheetBackdrop').click({ position:{ x:5, y:5 } });
  await expect(page.locator('.left-panel')).toBeHidden();

  await page.evaluate(() => window.InterfaceV800.switchWorkspace('review', { silent:true }));
  await expect(page.locator('.right-panel')).toBeHidden();
  await page.locator('[data-v8-action="review-details"]').click();
  await expect(page.locator('.right-panel')).toBeVisible();
});
