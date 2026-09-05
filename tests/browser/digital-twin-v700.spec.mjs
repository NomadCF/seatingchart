import { test, expect } from '@playwright/test';

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
  try { await expect(modal).toHaveClass(/\bshow\b/, { timeout: 4000 }); }
  catch (_) { return; }
  await page.locator('#gettingStartedCloseBtn').click();
  await expect(modal).not.toHaveClass(/\bshow\b/, { timeout: 10000 });
}

async function ready(page) {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await completeFreshSecuritySetupIfNeeded(page);
  await closeAutomaticGettingStartedIfNeeded(page);
}

async function seedFreeform(page) {
  await page.evaluate(() => {
    state.layoutMode = 'freeform';
    state.freeformLayout = normalizeFreeformLayout({
      initialized: true,
      canvas: { width: 2400, height: 1600, gridSize: 40, snap: true, zoom: 1 },
      objects: [
        { id:'desk-a', type:'table', label:'Table A', x:420, y:420, width:420, height:220, rotation:0, zIndex:1 },
        { id:'desk-b', type:'table', label:'Table B', x:1400, y:900, width:360, height:220, rotation:0, zIndex:1 },
        { id:'seat-a', type:'seat', x:470, y:300, width:176, height:112, assignedStudentId:null, zIndex:3 },
        { id:'seat-b', type:'seat', x:660, y:300, width:176, height:112, assignedStudentId:null, zIndex:3 }
      ],
      groups: []
    });
    renderAll();
  });
  await page.waitForTimeout(250);
}

test('V7.0.0 digital twin preserves physical room settings through normalization', async ({ page }) => {
  await ready(page);
  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', '7.0.0');
  const result = await page.evaluate(() => {
    const layout = normalizeFreeformLayout({
      initialized:true,
      canvas:{ width:2800, height:1800 },
      objects:[],
      physicalRoom:{
        enabled:true,
        unit:'ft',
        width:31.5,
        height:24,
        gridStep:1,
        showGrid:true,
        showRulers:true,
        showObjectMeasurements:true,
        background:{ dataUrl:'data:image/png;base64,AA==', name:'room.png', visible:true, opacity:.4, scalePct:110, offsetXPct:5, offsetYPct:-3, rotation:4, print:true, locked:true }
      }
    });
    return layout.physicalRoom;
  });
  expect(result).toEqual(expect.objectContaining({ enabled:true, unit:'ft', width:31.5, height:24, gridStep:1 }));
  expect(result.background).toEqual(expect.objectContaining({ name:'room.png', visible:true, opacity:.4, scalePct:110, print:true }));
});

test('V7.0.0 renders scaled grid, rulers, object dimensions and physical distance', async ({ page }) => {
  await ready(page);
  await seedFreeform(page);
  const metrics = await page.evaluate(() => {
    const twin = window.ClassroomDigitalTwinV700;
    twin.configureRoom({ enabled:true, unit:'ft', width:30, height:20, gridStep:1, showGrid:true, showRulers:true, showObjectMeasurements:true, fitCanvas:true });
    twin.enhance();
    const objects = state.freeformLayout.objects;
    return {
      room: twin.physicalRoom(),
      canvas: { width:state.freeformLayout.canvas.width, height:state.freeformLayout.canvas.height },
      distance: twin.physicalDistance(objects.find(o => o.id === 'desk-a'), objects.find(o => o.id === 'desk-b')),
      desk: twin.objectDimensions(objects.find(o => o.id === 'desk-a'))
    };
  });
  expect(metrics.room.enabled).toBeTruthy();
  expect(metrics.canvas.height).toBe(1600);
  expect(metrics.distance).toBeGreaterThan(10);
  expect(metrics.desk.width).toBeGreaterThan(4);
  await expect(page.locator('#seatGrid')).toHaveAttribute('data-v700-digital-twin', '7.0.0');
  await expect(page.locator('#seatGrid > .v700-room-grid')).toHaveCount(1);
  await expect(page.locator('#seatGrid > .v700-rulers')).toHaveCount(1);
  await expect(page.locator('.freeform-object[data-object-id="desk-a"] .v700-object-measure')).toHaveCount(1);
});

test('V7.0.0 floor-plan reference layer stays non-interactive and print-aware', async ({ page }) => {
  await ready(page);
  await seedFreeform(page);
  await page.evaluate(() => {
    const twin = window.ClassroomDigitalTwinV700;
    twin.configureRoom({ enabled:true, unit:'m', width:9, height:7, gridStep:.5, showGrid:true, showRulers:true, fitCanvas:false });
    twin.setBackground({ dataUrl:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=', name:'floor-plan.svg', visible:true, opacity:.35, scalePct:120, offsetXPct:4, offsetYPct:-2, rotation:3, print:true });
    twin.enhance();
  });
  const layer = page.locator('#seatGrid > .v700-floor-plan');
  await expect(layer).toHaveCount(1);
  await expect(layer).toHaveAttribute('data-print-floor-plan', 'true');
  expect(await layer.evaluate(node => getComputedStyle(node).pointerEvents)).toBe('none');
  await page.emulateMedia({ media:'print' });
  expect(await layer.evaluate(node => getComputedStyle(node).display)).not.toBe('none');
});

test('V7.0.0 physical object library uses the existing Freeform object model', async ({ page }) => {
  await ready(page);
  await seedFreeform(page);
  const result = await page.evaluate(() => {
    const twin = window.ClassroomDigitalTwinV700;
    twin.configureRoom({ enabled:true, unit:'ft', width:30, height:20, fitCanvas:false });
    twin.quickAdd('shelf');
    twin.quickAdd('lab');
    twin.quickAdd('sink');
    twin.quickAdd('station');
    return state.freeformLayout.objects.slice(-4).map(object => ({ type:object.type, id:object.id, x:object.x, y:object.y, width:object.width, height:object.height }));
  });
  expect(result.map(item => item.type)).toEqual(['shelf','lab','sink','station']);
  for (const item of result) {
    expect(item.id).toBeTruthy();
    expect(Number.isFinite(item.x)).toBeTruthy();
    expect(Number.isFinite(item.y)).toBeTruthy();
  }
});

test('V7.0.0 Digital Twin controls remain usable on desktop and mobile', async ({ page }) => {
  await ready(page);
  await seedFreeform(page);
  await page.evaluate(() => window.ClassroomDigitalTwinV700.open());
  const modal = page.locator('#digitalTwinV700Modal');
  await expect(modal).toHaveClass(/\bshow\b/);
  await expect(page.getByRole('heading', { name:'Physical room setup' })).toBeVisible();
  await expect(page.locator('#digitalTwinV700ApplyRoomBtn')).toBeVisible();
  await expect(page.locator('[data-v700-add-object="shelf"]')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
