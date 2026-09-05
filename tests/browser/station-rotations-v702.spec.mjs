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

async function seedRotationRoom(page, { todayMode = false } = {}) {
  await page.evaluate(({ todayMode }) => {
    state.layoutMode = 'freeform';
    state.students = [
      ['student-a','Ada','Lovelace'],
      ['student-b','Grace','Hopper'],
      ['student-c','Katherine','Johnson'],
      ['student-d','Alan','Turing'],
      ['student-e','Dorothy','Vaughan'],
      ['student-f','George','Boole']
    ].map(([id, firstName, lastName]) => normalizeStudent({ id, firstName, lastName, requirements:{} }));
    state.groups = [
      { id:'group-blue', name:'Blue Team', type:'together', priority:6, studentIds:['student-a','student-b'], anchorSeats:[], zoneId:'' },
      { id:'group-gold', name:'Gold Team', type:'together', priority:6, studentIds:['student-c','student-d'], anchorSeats:[], zoneId:'' }
    ];
    state.todaySession = todayMode
      ? { active:true, absentStudentIds:['student-f'], guestStudentIds:[], masterAssignments:null, startedAt:new Date().toISOString() }
      : { active:false, absentStudentIds:[], guestStudentIds:[], masterAssignments:null };
    state.freeformLayout = normalizeFreeformLayout({
      initialized:true,
      canvas:{ width:2400, height:1600, gridSize:40, snap:true, zoom:1, frontSide:'top' },
      physicalRoom:{ enabled:true, unit:'ft', width:30, height:20, gridStep:1, showGrid:true, showRulers:true },
      objects:[
        { id:'board-fixed', type:'board', label:'Front Board', x:700, y:30, width:800, height:80, zIndex:1 },
        { id:'station-a', type:'station', label:'Reading Station', x:260, y:420, width:260, height:180, zIndex:2 },
        { id:'station-b', type:'lab', label:'Science Station', x:1060, y:420, width:300, height:190, zIndex:2 },
        { id:'table-c', type:'table', label:'Writing Table', x:1750, y:420, width:360, height:220, zIndex:2 },
        { id:'seat-a', cellKey:'r1c1', type:'seat', x:420, y:980, width:176, height:112, assignedStudentId:'student-a', manual:true, locked:true, zIndex:3 },
        { id:'seat-b', cellKey:'r1c2', type:'seat', x:650, y:980, width:176, height:112, assignedStudentId:'student-b', manual:false, locked:false, zIndex:3 },
        { id:'seat-c', cellKey:'r1c3', type:'seat', x:880, y:980, width:176, height:112, assignedStudentId:'student-c', manual:false, locked:false, zIndex:3 },
        { id:'seat-d', cellKey:'r1c4', type:'seat', x:1110, y:980, width:176, height:112, assignedStudentId:'student-d', manual:false, locked:false, zIndex:3 },
        { id:'seat-e', cellKey:'r1c5', type:'seat', x:1340, y:980, width:176, height:112, assignedStudentId:'student-e', manual:false, locked:false, zIndex:3 },
        { id:'seat-f', cellKey:'r1c6', type:'seat', x:1570, y:980, width:176, height:112, assignedStudentId:'student-f', manual:false, locked:false, zIndex:3 }
      ],
      groups:[]
    });
    state.rows = 1;
    state.cols = 6;
    state.cells = Object.fromEntries(['a','b','c','d','e','f'].map((suffix, index) => [`r1c${index + 1}`, {
      row:1, col:index + 1, type:'seat', assignedStudentId:`student-${suffix}`, manual:index === 0, anchorGroupIds:[], zoneIds:[]
    }]));
    resetFreeformGeometryCache?.();
    renderAll();
    document.body.classList.toggle('freeform-layout-mode', state.layoutMode === 'freeform');
    window.ActivityLayoutsV701?.afterReady?.();
    window.StationRotationsV702?.afterReady?.();
  }, { todayMode });
  await page.waitForTimeout(250);
}

test('V7.0.2 station-rotation data survives Freeform normalization', async ({ page }) => {
  await ready(page);
  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', '7.0.2');
  const result = await page.evaluate(() => {
    const source = {
      initialized:true,
      canvas:{ width:2400, height:1600 },
      objects:[{ id:'station-a', type:'station', x:10, y:20, width:200, height:120 }],
      stationRotations:{ version:1, activePlanId:'rotation-a', plans:[{ id:'rotation-a', name:'Literacy Centers', stations:[{ objectId:'station-a', name:'Reading' }], teams:[{ id:'team-a', name:'Team 1', studentIds:['student-a'] }] }] }
    };
    return normalizeFreeformLayout(source).stationRotations;
  });
  expect(result.activePlanId).toBe('rotation-a');
  expect(result.plans).toHaveLength(1);
  expect(result.plans[0].name).toBe('Literacy Centers');
});

test('V7.0.2 builds size-balanced teams from the active Today Mode roster', async ({ page }) => {
  await ready(page);
  await seedRotationRoom(page, { todayMode:true });
  const result = await page.evaluate(() => {
    const rotations = window.StationRotationsV702;
    const plan = rotations.createPlan({ name:'Centers', stationIds:['station-a','station-b','table-c'], teamCount:3, teamSource:'balanced', durationMinutes:10, transitionMinutes:1 });
    const ids = plan.teams.flatMap(team => team.studentIds);
    const sizes = plan.teams.map(team => team.studentIds.length);
    return {
      candidateIds:rotations.stationCandidates().map(item => item.objectId),
      planName:plan.name,
      stationCount:plan.stations.length,
      teamCount:plan.teams.length,
      ids,
      sizes,
      linkedLayoutId:plan.activityLayoutId,
      activeLayoutId:window.ActivityLayoutsV701.ensureStore({ reconcileActive:false }).activeId
    };
  });
  expect(result.candidateIds).toEqual(expect.arrayContaining(['station-a','station-b','table-c']));
  expect(result.planName).toBe('Centers');
  expect(result.stationCount).toBe(3);
  expect(result.teamCount).toBe(3);
  expect(result.ids).toHaveLength(5);
  expect(new Set(result.ids).size).toBe(5);
  expect(result.ids).not.toContain('student-f');
  expect(Math.max(...result.sizes) - Math.min(...result.sizes)).toBeLessThanOrEqual(1);
  expect(result.linkedLayoutId).toBe(result.activeLayoutId);
});

test('V7.0.2 advances explicit rounds without rewriting seat assignments', async ({ page }) => {
  await ready(page);
  await seedRotationRoom(page);
  const result = await page.evaluate(() => {
    const rotations = window.StationRotationsV702;
    const beforeSeats = state.freeformLayout.objects.filter(object => object.type === 'seat').map(object => [object.id, object.assignedStudentId, object.locked]);
    const plan = rotations.createPlan({ stationIds:['station-a','station-b','table-c'], teamCount:3 });
    const first = rotations.roundAssignments(plan).map(item => [item.team.id, item.station.objectId]);
    rotations.nextRound();
    const second = rotations.roundAssignments(plan).map(item => [item.team.id, item.station.objectId]);
    rotations.startRound();
    const seconds = rotations.phaseSeconds(plan);
    rotations.stopTimer();
    const afterSeats = state.freeformLayout.objects.filter(object => object.type === 'seat').map(object => [object.id, object.assignedStudentId, object.locked]);
    return { first, second, beforeSeats, afterSeats, round:plan.currentRound, seconds, phase:plan.phase };
  });
  expect(result.first).not.toEqual(result.second);
  expect(result.round).toBe(1);
  expect(result.seconds).toBeGreaterThan(0);
  expect(result.beforeSeats).toEqual(result.afterSeats);
  expect(result.phase).toBe('stopped');
});

test('V7.0.2 rotation plans can return to their linked Activity Layout', async ({ page }) => {
  await ready(page);
  await seedRotationRoom(page);
  const result = await page.evaluate(() => {
    const rotations = window.StationRotationsV702;
    const layouts = window.ActivityLayoutsV701;
    const originalId = layouts.ensureStore().activeId;
    const plan = rotations.createPlan({ name:'Linked Rotation', stationIds:['station-a','station-b','table-c'], teamCount:3 });
    const other = layouts.create('group', { name:'Group Arrangement' });
    const mismatch = rotations.linkedLayoutState(plan);
    const switched = rotations.switchToLinkedLayout(plan);
    const finalId = layouts.ensureStore({ reconcileActive:false }).activeId;
    return { originalId, otherId:other.id, linkedId:plan.activityLayoutId, mismatch, switched, finalId };
  });
  expect(result.otherId).not.toBe(result.originalId);
  expect(result.linkedId).toBe(result.originalId);
  expect(result.mismatch.matches).toBeFalsy();
  expect(result.switched).toBeTruthy();
  expect(result.finalId).toBe(result.originalId);
});

test('V7.0.2 station overlays and management UI stay coherent on desktop and mobile', async ({ page }) => {
  await ready(page);
  await seedRotationRoom(page);
  await page.evaluate(() => {
    window.StationRotationsV702.createPlan({ name:'Visible Rotation', stationIds:['station-a','station-b','table-c'], teamCount:3 });
    window.StationRotationsV702.refresh();
  });
  await page.waitForTimeout(120);
  await expect(page.locator('#stationRotationsV702Toolbar')).toHaveCount(1);
  await expect(page.locator('#stationRotationsV702QuickSelect')).toHaveCount(1);
  await expect(page.locator('.v702-station-overlay')).toHaveCount(3);
  const overlayPointerEvents = await page.locator('.v702-station-overlay').first().evaluate(node => ({
    inline:node.style.pointerEvents,
    computed:getComputedStyle(node).pointerEvents
  }));
  expect(overlayPointerEvents.inline).toBe('none');
  if (overlayPointerEvents.computed) expect(overlayPointerEvents.computed).toBe('none');
  const mountedNearActivityLayouts = await page.evaluate(() => {
    const rotation = document.getElementById('stationRotationsV702Toolbar');
    const activity = document.getElementById('activityLayoutsV701Toolbar');
    return Boolean(rotation && activity && rotation.parentElement === activity.parentElement);
  });
  expect(mountedNearActivityLayouts).toBeTruthy();
  await page.evaluate(() => window.StationRotationsV702.open());
  const modal = page.locator('#stationRotationsV702Modal');
  await expect(modal).toHaveClass(/\bshow\b/);
  await expect(page.getByRole('heading', { name:'Station rotations' })).toBeVisible();
  await expect(page.locator('#stationRotationsV702Schedule .v702-schedule')).toBeVisible();
  await expect(page.locator('.v702-team-card')).toHaveCount(3);
  await expect(page.locator('.v702-station-card')).toHaveCount(3);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
