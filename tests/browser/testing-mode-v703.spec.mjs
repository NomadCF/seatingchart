import { test, expect } from '@playwright/test';

async function completeFreshSecuritySetupIfNeeded(page) {
  const modal = page.locator('#welcomeSecurityModal.show');
  if (await modal.count() === 0) return;
  const passphrase = 'browser regression secure classroom passphrase 2026';
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
}

async function seedTestingRoom(page, { todayMode = false } = {}) {
  await page.evaluate(({ todayMode }) => {
    state.layoutMode = 'freeform';
    state.students = [
      normalizeStudent({ id:'student-a', firstName:'Ada', lastName:'Lovelace', requirements:{ ada:true } }),
      normalizeStudent({ id:'student-b', firstName:'Grace', lastName:'Hopper', requirements:{} }),
      normalizeStudent({ id:'student-c', firstName:'Katherine', lastName:'Johnson', requirements:{ front:'require' } }),
      normalizeStudent({ id:'student-d', firstName:'Alan', lastName:'Turing', requirements:{} }),
      normalizeStudent({ id:'student-e', firstName:'Dorothy', lastName:'Vaughan', requirements:{ aisle:true } }),
      normalizeStudent({ id:'student-f', firstName:'George', lastName:'Boole', requirements:{} })
    ];
    state.groups = [];
    state.todaySession = todayMode
      ? { active:true, absentStudentIds:['student-f'], guestStudentIds:[], masterAssignments:null, startedAt:new Date().toISOString() }
      : { active:false, absentStudentIds:[], guestStudentIds:[], masterAssignments:null };
    state.freeformLayout = normalizeFreeformLayout({
      initialized:true,
      canvas:{ width:2400, height:1600, gridSize:40, snap:true, zoom:1, frontSide:'top' },
      physicalRoom:{ enabled:true, unit:'ft', width:30, height:20, gridStep:1, showGrid:true, showRulers:true },
      objects:[
        { id:'board-fixed', type:'board', label:'Front Board', x:760, y:20, width:880, height:70, zIndex:1 },
        { id:'ada-zone', type:'ada', label:'Accessible Area', x:120, y:1120, width:420, height:300, zIndex:1 },
        { id:'teacher-fixed', type:'teacher', label:'Teacher Desk', x:1720, y:160, width:360, height:180, zIndex:1 },
        { id:'table-fixed', type:'table', label:'Storage Table', x:980, y:650, width:430, height:240, zIndex:1 },
        { id:'seat-a', cellKey:'r1c1', type:'seat', x:500, y:900, width:176, height:112, assignedStudentId:'student-a', manual:false, locked:false, zIndex:3 },
        { id:'seat-b', cellKey:'r1c2', type:'seat', x:730, y:900, width:176, height:112, assignedStudentId:'student-b', manual:true, locked:true, zIndex:3 },
        { id:'seat-c', cellKey:'r1c3', type:'seat', x:960, y:900, width:176, height:112, assignedStudentId:'student-c', manual:false, locked:false, zIndex:3 },
        { id:'seat-d', cellKey:'r1c4', type:'seat', x:1190, y:900, width:176, height:112, assignedStudentId:'student-d', manual:false, locked:false, zIndex:3 },
        { id:'seat-e', cellKey:'r1c5', type:'seat', x:1420, y:900, width:176, height:112, assignedStudentId:'student-e', manual:false, locked:false, zIndex:3 },
        { id:'seat-f', cellKey:'r1c6', type:'seat', x:1650, y:900, width:176, height:112, assignedStudentId:'student-f', manual:false, locked:false, zIndex:3 }
      ],
      groups:[]
    });
    state.rows = 1;
    state.cols = 6;
    state.cells = Object.fromEntries(['a','b','c','d','e','f'].map((suffix,index) => [`r1c${index + 1}`, {
      row:1, col:index + 1, type:'seat', assignedStudentId:`student-${suffix}`, manual:index === 1, anchorGroupIds:[], zoneIds:[]
    }]));
    resetFreeformGeometryCache?.();
    renderAll();
    document.body.classList.toggle('freeform-layout-mode', state.layoutMode === 'freeform');
    window.ActivityLayoutsV701?.afterReady?.();
    window.StationRotationsV702?.afterReady?.();
    window.TestingModeV703?.afterReady?.();
  }, { todayMode });
  await page.waitForTimeout(250);
}

test('V7.0.3 Testing Mode metadata survives Freeform normalization', async ({ page }) => {
  await ready(page);
  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', '7.1.0');
  const result = await page.evaluate(() => normalizeFreeformLayout({
    initialized:true,
    canvas:{ width:2000, height:1200 },
    testingMode:{ version:1, sourceActivityLayoutId:'normal', activeTestingLayoutId:'test', lastConfig:{ spacing:6 }, lastReport:{ requestedSpacing:6, achievedSpacing:5.5 } },
    objects:[]
  }).testingMode);
  expect(result.sourceActivityLayoutId).toBe('normal');
  expect(result.activeTestingLayoutId).toBe('test');
  expect(result.lastConfig.spacing).toBe(6);
});

test('V7.0.3 improves active-student spacing while preserving locked seats and assignments', async ({ page }) => {
  await ready(page);
  await seedTestingRoom(page, { todayMode:true });
  const result = await page.evaluate(() => {
    const testing = window.TestingModeV703;
    const before = state.freeformLayout.objects.filter(object => object.type === 'seat').map(object => ({ id:object.id, x:object.x, y:object.y, student:object.assignedStudentId, locked:object.locked }));
    const preview = testing.generatePreview({ spacing:5, preserveLocked:true, respectNeeds:true, name:'Quiet Testing' });
    const after = preview.proposedSeats.map(object => ({ id:object.id, x:object.x, y:object.y, student:object.assignedStudentId, locked:object.locked }));
    return { before, after, report:preview.report };
  });
  const beforeLocked = result.before.find(item => item.id === 'seat-b');
  const afterLocked = result.after.find(item => item.id === 'seat-b');
  expect(afterLocked.x).toBe(beforeLocked.x);
  expect(afterLocked.y).toBe(beforeLocked.y);
  expect(result.after.map(item => [item.id,item.student])).toEqual(result.before.map(item => [item.id,item.student]));
  expect(result.report.activeSeatCount).toBe(5);
  expect(result.report.achievedSpacing).toBeGreaterThan(result.report.beforeSpacing);
  expect(result.report.movedCount).toBeGreaterThan(0);
});

test('V7.0.3 respects an accessibility target and explains impossible spacing', async ({ page }) => {
  await ready(page);
  await seedTestingRoom(page);
  const result = await page.evaluate(() => {
    const preview = window.TestingModeV703.generatePreview({ spacing:20, preserveLocked:true, respectNeeds:true });
    const seat = preview.proposedSeats.find(item => item.id === 'seat-a');
    const ada = state.freeformLayout.objects.find(item => item.id === 'ada-zone');
    const center = { x:seat.x + seat.width / 2, y:seat.y + seat.height / 2 };
    const margin = Math.max(seat.width, seat.height) * 0.45;
    const nearAda = center.x >= ada.x - margin && center.x <= ada.x + ada.width + margin && center.y >= ada.y - margin && center.y <= ada.y + ada.height + margin;
    return { nearAda, report:preview.report };
  });
  expect(result.nearAda).toBeTruthy();
  expect(result.report.spacingConflicts).toBeGreaterThan(0);
  expect(result.report.impossibleReasons.join(' ')).toMatch(/cannot be reached|locked testing seats/i);
});

test('V7.0.3 applies testing geometry as a separate Activity Layout and can return', async ({ page }) => {
  await ready(page);
  await seedTestingRoom(page);
  const result = await page.evaluate(() => {
    const layouts = window.ActivityLayoutsV701;
    const testing = window.TestingModeV703;
    const sourceId = layouts.ensureStore({ reconcileActive:true }).activeId;
    const beforeAssignments = state.freeformLayout.objects.filter(object => object.type === 'seat').map(object => [object.id, object.assignedStudentId]);
    testing.generatePreview({ spacing:5.5, name:'Assessment Layout' });
    const entry = testing.applyPreview();
    const testingId = layouts.ensureStore({ reconcileActive:false }).activeId;
    const afterAssignments = state.freeformLayout.objects.filter(object => object.type === 'seat').map(object => [object.id, object.assignedStudentId]);
    const testingStore = testing.ensureStore();
    const returned = testing.returnToSource();
    const finalId = layouts.ensureStore({ reconcileActive:false }).activeId;
    return { sourceId, testingId, entryId:entry?.id, entryPreset:entry?.preset, beforeAssignments, afterAssignments, recordedSource:testingStore.sourceActivityLayoutId, returned, finalId };
  });
  expect(result.testingId).not.toBe(result.sourceId);
  expect(result.entryId).toBe(result.testingId);
  expect(result.entryPreset).toBe('testing');
  expect(result.beforeAssignments).toEqual(result.afterAssignments);
  expect(result.recordedSource).toBe(result.sourceId);
  expect(result.returned).toBeTruthy();
  expect(result.finalId).toBe(result.sourceId);
});

test('V7.0.3 preview overlays and management UI remain non-interactive and mobile-safe', async ({ page }) => {
  await ready(page);
  await seedTestingRoom(page, { todayMode:true });
  await page.evaluate(() => {
    window.TestingModeV703.generatePreview({ spacing:5 });
    window.TestingModeV703.refresh();
  });
  await page.waitForTimeout(120);
  await expect(page.locator('#testingModeV703Toolbar')).toHaveCount(1);
  await expect(page.locator('#testingModeV703OpenBtn')).toHaveCount(1);
  await expect(page.locator('.v703-testing-preview')).toHaveCount(5);
  const pointerEvents = await page.locator('.v703-testing-preview').first().evaluate(node => ({ inline:node.style.pointerEvents, computed:getComputedStyle(node).pointerEvents }));
  expect(pointerEvents.inline).toBe('none');
  if (pointerEvents.computed) expect(pointerEvents.computed).toBe('none');
  await page.evaluate(() => window.TestingModeV703.open());
  const modal = page.locator('#testingModeV703Modal');
  await expect(modal).toHaveClass(/\bshow\b/);
  await expect(page.getByRole('heading', { name:'Testing Mode' })).toBeVisible();
  await expect(page.locator('.v703-metrics article')).toHaveCount(4);
  await expect(page.locator('#testingModeV703ApplyBtn')).toBeEnabled();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
