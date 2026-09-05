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
  await page.goto('/index.html', { waitUntil:'domcontentloaded' });
  await completeFreshSecuritySetupIfNeeded(page);
  await closeAutomaticGettingStartedIfNeeded(page);
}

async function seedFreeform(page) {
  await page.evaluate(() => {
    state.layoutMode = 'freeform';
    state.students = [
      { id:'student-a', firstName:'Ada', lastName:'Lovelace', nickName:'', grade:'', requirements:{} },
      { id:'student-b', firstName:'Grace', lastName:'Hopper', nickName:'', grade:'', requirements:{} }
    ].map(normalizeStudent);
    state.freeformLayout = normalizeFreeformLayout({
      initialized:true,
      canvas:{ width:2400, height:1600, gridSize:40, snap:true, zoom:1, frontSide:'top' },
      physicalRoom:{ enabled:true, unit:'ft', width:30, height:20, gridStep:1, showGrid:true, showRulers:true },
      objects:[
        { id:'door-fixed', type:'door', label:'Door', x:40, y:700, width:90, height:220, zIndex:1 },
        { id:'board-fixed', type:'board', label:'Board', x:800, y:30, width:700, height:80, zIndex:1 },
        { id:'table-a', type:'table', label:'Table A', x:500, y:520, width:420, height:220, zIndex:2 },
        { id:'table-b', type:'table', label:'Table B', x:1400, y:900, width:360, height:220, zIndex:2 },
        { id:'seat-a', cellKey:'r1c1', type:'seat', x:480, y:330, width:176, height:112, assignedStudentId:'student-a', manual:true, locked:true, zIndex:3 },
        { id:'seat-b', cellKey:'r1c2', type:'seat', x:690, y:330, width:176, height:112, assignedStudentId:'student-b', manual:false, locked:false, zIndex:3 },
        { id:'seat-c', cellKey:'r1c3', type:'seat', x:1100, y:330, width:176, height:112, assignedStudentId:null, zIndex:3 },
        { id:'seat-d', cellKey:'r1c4', type:'seat', x:1320, y:330, width:176, height:112, assignedStudentId:null, zIndex:3 }
      ],
      groups:[{ id:'pod-a', name:'Pod A', color:'#2563eb', locked:false }]
    });
    state.rows = 1;
    state.cols = 4;
    state.cells = {
      r1c1:{ row:1,col:1,type:'seat',assignedStudentId:'student-a',manual:true,anchorGroupIds:[],zoneIds:[] },
      r1c2:{ row:1,col:2,type:'seat',assignedStudentId:'student-b',manual:false,anchorGroupIds:[],zoneIds:[] },
      r1c3:{ row:1,col:3,type:'seat',assignedStudentId:null,manual:false,anchorGroupIds:[],zoneIds:[] },
      r1c4:{ row:1,col:4,type:'seat',assignedStudentId:null,manual:false,anchorGroupIds:[],zoneIds:[] }
    };
    resetFreeformGeometryCache?.();
    renderAll();
    document.body.classList.toggle('freeform-layout-mode', state.layoutMode === 'freeform');
    window.ActivityLayoutsV701?.afterReady?.();
  });
  await page.waitForTimeout(250);
}

test('V7.0.1 activity layout data survives Freeform normalization without duplicating the physical room', async ({ page }) => {
  await ready(page);
  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', '7.0.3');
  const result = await page.evaluate(() => {
    const source = {
      initialized:true,
      canvas:{ width:2400, height:1600 },
      physicalRoom:{ enabled:true, unit:'ft', width:30, height:20 },
      objects:[{ id:'seat-a', type:'seat', x:10, y:20, width:176, height:112 }],
      activityLayouts:{ version:1, activeId:'layout-a', layouts:[{ id:'layout-a', name:'Rows', objects:[{ id:'seat-a', type:'seat', x:10, y:20, width:176, height:112 }], groups:[] }] }
    };
    const normalized = normalizeFreeformLayout(source);
    return { activityLayouts:normalized.activityLayouts, room:normalized.physicalRoom };
  });
  expect(result.activityLayouts.activeId).toBe('layout-a');
  expect(result.activityLayouts.layouts).toHaveLength(1);
  expect(result.activityLayouts.layouts[0].name).toBe('Rows');
  expect(result.room).toEqual(expect.objectContaining({ enabled:true, width:30, height:20 }));
});

test('V7.0.1 creates starter arrangements and keeps fixed physical features shared', async ({ page }) => {
  await ready(page);
  await seedFreeform(page);
  const result = await page.evaluate(() => {
    const layouts = window.ActivityLayoutsV701;
    const storeBefore = layouts.ensureStore();
    const originalId = storeBefore.activeId;
    const testing = layouts.create('testing', { name:'Quiet Test' });
    const testingSeat = state.freeformLayout.objects.find(object => object.id === 'seat-a');
    const fixedDoor = state.freeformLayout.objects.find(object => object.id === 'door-fixed');
    fixedDoor.x = 88;
    layouts.activate(originalId);
    const doorAfter = state.freeformLayout.objects.find(object => object.id === 'door-fixed');
    const storeAfter = layouts.ensureStore({ reconcileActive:false });
    return {
      count:storeAfter.layouts.length,
      testingName:testing.name,
      testingPreset:testing.preset,
      testingSeatX:testingSeat.x,
      doorX:doorAfter.x,
      room:window.ClassroomDigitalTwinV700.physicalRoom()
    };
  });
  expect(result.count).toBe(2);
  expect(result.testingName).toBe('Quiet Test');
  expect(result.testingPreset).toBe('testing');
  expect(result.testingSeatX).not.toBe(480);
  expect(result.doorX).toBe(88);
  expect(result.room).toEqual(expect.objectContaining({ enabled:true, unit:'ft', width:30, height:20 }));
});

test('V7.0.1 switching arrangements carries matching seat assignments and locks', async ({ page }) => {
  await ready(page);
  await seedFreeform(page);
  const result = await page.evaluate(() => {
    const layouts = window.ActivityLayoutsV701;
    const original = layouts.ensureStore().activeId;
    const group = layouts.create('group', { name:'Group Work' });
    let seat = state.freeformLayout.objects.find(object => object.id === 'seat-a');
    const groupPosition = { x:seat.x, y:seat.y };
    seat.assignedStudentId = 'student-a';
    seat.manual = true;
    seat.locked = true;
    layouts.activate(original);
    seat = state.freeformLayout.objects.find(object => object.id === 'seat-a');
    const originalState = { x:seat.x, y:seat.y, student:seat.assignedStudentId, manual:seat.manual, locked:seat.locked };
    layouts.activate(group.id);
    seat = state.freeformLayout.objects.find(object => object.id === 'seat-a');
    return { groupPosition, originalState, groupState:{ x:seat.x, y:seat.y, student:seat.assignedStudentId, manual:seat.manual, locked:seat.locked } };
  });
  expect(result.originalState.x).toBe(480);
  expect(result.originalState.student).toBe('student-a');
  expect(result.originalState.locked).toBeTruthy();
  expect(result.groupState.student).toBe('student-a');
  expect(result.groupState.manual).toBeTruthy();
  expect(result.groupState.locked).toBeTruthy();
  expect(result.groupState.x).toBe(result.groupPosition.x);
  expect(result.groupState.y).toBe(result.groupPosition.y);
});

test('V7.0.1 duplication and visual comparison report meaningful geometry changes', async ({ page }) => {
  await ready(page);
  await seedFreeform(page);
  const result = await page.evaluate(() => {
    const layouts = window.ActivityLayoutsV701;
    const original = layouts.ensureStore().activeId;
    const copy = layouts.duplicate(original, { name:'Discussion Copy' });
    layouts.applyPreset(copy.id, 'discussion');
    const comparison = layouts.comparison(original, copy.id);
    layouts.openComparison(original, copy.id);
    return {
      count:layouts.ensureStore({ reconcileActive:false }).layouts.length,
      copyName:copy.name,
      changed:comparison.changedCount,
      moved:comparison.movedIds.length,
      physicalMovement:comparison.physicalMovement
    };
  });
  expect(result.count).toBe(2);
  expect(result.copyName).toBe('Discussion Copy');
  expect(result.changed).toBeGreaterThan(0);
  expect(result.moved).toBeGreaterThan(0);
  expect(result.physicalMovement.value).toBeGreaterThan(0);
  await expect(page.locator('#activityLayoutsV701CompareModal')).toHaveClass(/\bshow\b/);
  await expect(page.locator('.v701-compare-grid article')).toHaveCount(2);
  expect(await page.locator('.v701-preview-object.changed').count()).toBeGreaterThan(0);
});

test('V7.0.1 activity layout controls stay usable on desktop and mobile', async ({ page }) => {
  await ready(page);
  await seedFreeform(page);
  const toolbar = page.locator('#activityLayoutsV701Toolbar');
  await expect(toolbar).toHaveCount(1);
  await expect(page.locator('#activityLayoutsV701QuickSelect')).toHaveCount(1);
  const mountedWithDigitalTwin = await page.evaluate(() => {
    const toolbar = document.getElementById('activityLayoutsV701Toolbar');
    const launcher = document.getElementById('openDigitalTwinV700Btn');
    return Boolean(toolbar && launcher && toolbar.parentElement === launcher.parentElement);
  });
  expect(mountedWithDigitalTwin).toBeTruthy();
  await page.evaluate(() => window.ActivityLayoutsV701.open());
  const modal = page.locator('#activityLayoutsV701Modal');
  await expect(modal).toHaveClass(/\bshow\b/);
  await expect(page.getByRole('heading', { name:'Activity layouts' })).toBeVisible();
  await expect(page.locator('[data-v701-create-preset="direct"]')).toBeVisible();
  await expect(page.locator('[data-v701-create-preset="testing"]')).toBeVisible();
  await expect(page.locator('#activityLayoutsV701CompareBtn')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
