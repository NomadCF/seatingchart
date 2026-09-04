import { test, expect } from '@playwright/test';

async function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}

async function completeFreshSecuritySetupIfNeeded(page) {
  const modal = page.locator('#welcomeSecurityModal.show');
  if (await modal.count() === 0) return;
  const passphrase = 'browser regression secure classroom passphrase 2026';
  await page.locator('#welcomeEncryptionKeyInput').fill(passphrase);
  await page.locator('#welcomeEncryptionKeyConfirmInput').fill(passphrase);
  await page.locator('#welcomeSecurityStartBtn').click();
  await expect(page.locator('#welcomeSecurityModal')).not.toHaveClass(/\bshow\b/, { timeout: 15000 });
}

async function closeAutomaticGettingStartedIfNeeded(page) {
  const modal = page.locator('#gettingStartedModal');
  try {
    await expect(modal).toHaveClass(/\bshow\b/, { timeout: 4000 });
  } catch (_) {
    return;
  }
  await page.locator('#gettingStartedCloseBtn').click();
  await expect(modal).not.toHaveClass(/\bshow\b/, { timeout: 10000 });
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
  await completeFreshSecuritySetupIfNeeded(page);
  await closeAutomaticGettingStartedIfNeeded(page);
  await expect(page.locator('#v4MoreMenuBtn')).toBeVisible();
  await page.locator('#v4MoreMenuBtn').click();
  await expect(page.locator('#openPlanningToolsBtn')).toBeVisible();
  await page.locator('#openPlanningToolsBtn').click();
  await expect(page.locator('#planningToolsModal')).toHaveClass(/\bshow\b/);
  const intelligenceTab = page.locator('[data-intelligence-tab]');
  await expect(intelligenceTab).toBeVisible();
  await intelligenceTab.click();
  await expect(page.getByText('Plan for what you are doing today')).toBeVisible();
  await expect(page.locator('[data-intelligence-scenario]')).toHaveCount(6);
  await expect(page.locator('#previewIntelligenceRepairBtn')).toBeVisible();
});


test('V6.8.1 grouped Freeform seating remains coherent across states and zoom', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await completeFreshSecuritySetupIfNeeded(page);
  await closeAutomaticGettingStartedIfNeeded(page);
  await page.evaluate(() => {
    state.layoutMode = 'freeform';
    state.students = [
      { id: 'v681-a', firstName: 'Avery', lastName: 'Stone', archived: false },
      { id: 'v681-b', firstName: 'Morgan', lastName: 'Reed', archived: false }
    ];
    state.groups = [];
    state.zones = [];
    state.todaySession = { ...(state.todaySession || {}), active: true, absentStudentIds: ['v681-b'] };
    state.freeformLayout = {
      canvas: { width: 1000, height: 700, zoom: 1, frontSide: 'top', snap: true },
      nextZ: 10,
      groups: [{ id: 'pod-a', name: 'Blue Pod', color: '#6f8f82', locked: false }],
      roomHistory: [],
      objects: [
        { id: 'table-a', type: 'table', label: 'Table A', x: 320, y: 260, width: 250, height: 145, rotation: 0, zIndex: 1, groupId: 'pod-a', locked: false },
        { id: 'seat-a', type: 'seat', label: 'A1', x: 330, y: 135, width: 176, height: 112, rotation: 0, zIndex: 2, groupId: 'pod-a', assignedStudentId: 'v681-a', locked: true, manual: false, anchorGroupIds: [], zoneIds: [] },
        { id: 'seat-b', type: 'seat', label: 'A2', x: 540, y: 275, width: 176, height: 112, rotation: 90, zIndex: 3, groupId: 'pod-a', assignedStudentId: 'v681-b', locked: false, manual: false, anchorGroupIds: [], zoneIds: [] },
        { id: 'seat-c', type: 'seat', label: 'A3', x: 330, y: 430, width: 176, height: 112, rotation: 0, zIndex: 4, groupId: 'pod-a', assignedStudentId: null, locked: false, manual: false, anchorGroupIds: [], zoneIds: [] }
      ]
    };
    renderFreeformLayout();
  });
  await expect(page.locator('#seatGrid')).toHaveAttribute('data-v681-grouped-visuals', '6.8.1');
  await expect(page.locator('.v681-pod-halo')).toHaveCount(1);
  await expect(page.locator('.v681-pod-label')).toHaveText('Blue Pod');
  await expect(page.locator('.freeform-object.table.v681-table-surface')).toHaveCount(1);
  await expect(page.locator('.freeform-object.seat.v681-seat-tile')).toHaveCount(3);
  await expect(page.locator('.freeform-object[data-object-id="seat-a"]')).toHaveAttribute('data-v681-status-kind', 'locked');
  await expect(page.locator('.freeform-object[data-object-id="seat-b"]')).toHaveAttribute('data-v681-status-kind', 'absent');
  await expect(page.locator('.freeform-object[data-object-id="seat-c"]')).toHaveAttribute('data-v681-status-kind', 'open');

  const baseFont = await page.locator('.freeform-object[data-object-id="seat-a"] .freeform-object-title').evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  await page.evaluate(() => document.body.style.setProperty('--seat-text-scale', '1.45'));
  const largerFont = await page.locator('.freeform-object[data-object-id="seat-a"] .freeform-object-title').evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  expect(largerFont).toBeGreaterThan(baseFont);

  await page.evaluate(() => { state.freeformLayout.canvas.zoom = 0.55; renderFreeformLayout(); });
  await expect(page.locator('#seatGrid')).toHaveAttribute('data-v681-zoom-band', 'low');
  await expect(page.locator('.freeform-object[data-object-id="seat-a"] .freeform-object-meta')).toHaveCSS('display', 'none');

  await page.locator('#visibilityModeBtn').click();
  await expect(page.locator('body')).toHaveClass(/\bvisibility-mode\b/);
  await expect(page.locator('.freeform-object[data-object-id="seat-a"] .freeform-object-meta')).toHaveCSS('display', 'none');
  await expect(page.locator('.v681-pod-halo')).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.v681-pod-halo')).toHaveCSS('border-top-style', 'solid');
  await expect(page.locator('.freeform-object[data-object-id="seat-c"]')).toHaveCSS('border-top-style', 'dashed');
  await page.emulateMedia({ media: 'screen' });

  await page.evaluate(() => { state.freeformLayout.canvas.zoom = 1.7; renderFreeformLayout(); });
  await expect(page.locator('#seatGrid')).toHaveAttribute('data-v681-zoom-band', 'high');

  const exportResult = await page.evaluate(() => {
    const canvas = window.GroupedSeatingVisualsV681.chartCanvas();
    const preview = window.GroupedSeatingVisualsV681.planPreviewMarkup({ name: 'Preview', layoutMode: 'freeform', freeformLayout: state.freeformLayout }, [], 'Plan A');
    return { width: canvas.width, height: canvas.height, hasPod: preview.includes('v681-mini-pod'), hasTable: preview.includes('v681-mini-object table') };
  });
  expect(exportResult.width).toBeGreaterThan(0);
  expect(exportResult.height).toBeGreaterThan(0);
  expect(exportResult.hasPod).toBeTruthy();
  expect(exportResult.hasTable).toBeTruthy();
});
