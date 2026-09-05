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

async function seedPlannerRoom(page) {
  await page.evaluate(() => {
    state.layoutMode = 'freeform';
    state.students = [
      normalizeStudent({ id:'student-ada', firstName:'Ada', lastName:'Lovelace', requirements:{} }),
      normalizeStudent({ id:'student-grace', firstName:'Grace', lastName:'Hopper', requirements:{} }),
      normalizeStudent({ id:'student-katherine', firstName:'Katherine', lastName:'Johnson', requirements:{} }),
      normalizeStudent({ id:'student-alan', firstName:'Alan', lastName:'Turing', requirements:{} }),
      normalizeStudent({ id:'student-dorothy', firstName:'Dorothy', lastName:'Vaughan', requirements:{ aisle:true } }),
      normalizeStudent({ id:'student-alex-kim', firstName:'Alex', lastName:'Kim', requirements:{} }),
      normalizeStudent({ id:'student-alex-lee', firstName:'Alex', lastName:'Lee', requirements:{} })
    ];
    state.groups = [];
    state.todaySession = { active:false, absentStudentIds:[], guestStudentIds:[], masterAssignments:null };
    state.freeformLayout = normalizeFreeformLayout({
      initialized:true,
      canvas:{ width:2400, height:1600, gridSize:40, snap:true, zoom:1, frontSide:'top' },
      physicalRoom:{ enabled:true, unit:'ft', width:30, height:20, gridStep:1, showGrid:true, showRulers:true },
      objects:[
        { id:'board-fixed', type:'board', label:'Front Board', x:760, y:20, width:880, height:70, zIndex:1 },
        { id:'door-fixed', type:'door', label:'Door', x:20, y:680, width:90, height:220, zIndex:1 },
        { id:'ada-zone', type:'ada', label:'Accessible Area', x:120, y:1120, width:420, height:300, zIndex:1 },
        { id:'seat-ada', cellKey:'r1c1', type:'seat', x:460, y:920, width:176, height:112, assignedStudentId:'student-ada', manual:false, locked:false, zIndex:3 },
        { id:'seat-grace', cellKey:'r1c2', type:'seat', x:700, y:920, width:176, height:112, assignedStudentId:'student-grace', manual:false, locked:false, zIndex:3 },
        { id:'seat-katherine', cellKey:'r1c3', type:'seat', x:940, y:1050, width:176, height:112, assignedStudentId:'student-katherine', manual:false, locked:false, zIndex:3 },
        { id:'seat-alan', cellKey:'r1c4', type:'seat', x:1180, y:1050, width:176, height:112, assignedStudentId:'student-alan', manual:false, locked:false, zIndex:3 },
        { id:'seat-dorothy', cellKey:'r1c5', type:'seat', x:1420, y:920, width:176, height:112, assignedStudentId:'student-dorothy', manual:false, locked:false, zIndex:3 },
        { id:'seat-alex-kim', cellKey:'r1c6', type:'seat', x:1660, y:920, width:176, height:112, assignedStudentId:'student-alex-kim', manual:false, locked:false, zIndex:3 },
        { id:'seat-alex-lee', cellKey:'r1c7', type:'seat', x:1900, y:920, width:176, height:112, assignedStudentId:'student-alex-lee', manual:false, locked:false, zIndex:3 }
      ],
      groups:[]
    });
    state.rows = 1;
    state.cols = 7;
    state.cells = Object.fromEntries([
      ['student-ada','r1c1'],['student-grace','r1c2'],['student-katherine','r1c3'],['student-alan','r1c4'],['student-dorothy','r1c5'],['student-alex-kim','r1c6'],['student-alex-lee','r1c7']
    ].map(([studentId,key],index) => [key, { row:1, col:index + 1, type:'seat', assignedStudentId:studentId, manual:false, anchorGroupIds:[], zoneIds:[] }]));
    resetFreeformGeometryCache?.();
    renderAll();
    document.body.classList.toggle('freeform-layout-mode', true);
    window.ActivityLayoutsV701?.afterReady?.();
    window.TestingModeV703?.afterReady?.();
    window.PlannerAssistantV710?.afterReady?.();
  });
  await page.waitForTimeout(200);
}

test('V7.1.0 exposes a deterministic command schema and refuses ambiguous student names', async ({ page }) => {
  await ready(page);
  await seedPlannerRoom(page);
  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', '7.2.1');
  const result = await page.evaluate(() => {
    const assistant = window.PlannerAssistantV710;
    return {
      schema:assistant.commandSchema,
      valid:assistant.preview('Show valid seats for Ada'),
      ambiguous:assistant.preview('Show valid seats for Alex')
    };
  });
  expect(result.schema).toBe('classroom-seating-planner-command-v1');
  expect(result.valid.intent).toBe('show_valid_seats');
  expect(result.valid.canApply).toBeTruthy();
  expect(result.valid.impact.metrics.find(item => item.label === 'Valid seats')).toBeTruthy();
  expect(result.ambiguous.intent).toBe('ambiguous');
  expect(result.ambiguous.canApply).toBeFalsy();
  expect(result.ambiguous.ambiguities[0].candidates.map(item => item.name)).toEqual(expect.arrayContaining(['Alex Kim','Alex Lee']));
});

test('V7.1.0 previews rule impact without mutation, then applies visible student rules', async ({ page }) => {
  await ready(page);
  await seedPlannerRoom(page);
  const result = await page.evaluate(() => {
    const assistant = window.PlannerAssistantV710;
    const katherine = state.students.find(student => student.id === 'student-katherine');
    const alan = state.students.find(student => student.id === 'student-alan');
    const before = { katherine:deepClone(katherine.requirements), alan:deepClone(alan.requirements), groups:deepClone(state.groups) };
    const preview = assistant.preview('Keep Katherine near the front and away from Alan');
    const afterPreview = { katherine:deepClone(katherine.requirements), alan:deepClone(alan.requirements), groups:deepClone(state.groups) };
    const applied = assistant.apply(preview);
    return {
      intent:preview.intent,
      canApply:preview.canApply,
      before,
      afterPreview,
      applied,
      afterApply:{ katherine:deepClone(katherine.requirements), alan:deepClone(alan.requirements), groups:deepClone(state.groups) },
      history:assistant.history()
    };
  });
  expect(result.intent).toBe('rule_changes');
  expect(result.canApply).toBeTruthy();
  expect(result.afterPreview).toEqual(result.before);
  expect(result.applied.ok).toBeTruthy();
  expect(result.afterApply.katherine.front).toBe('prefer');
  expect(result.afterApply.katherine.minDistanceStudentIds).toContain('student-alan');
  expect(result.afterApply.alan.minDistanceStudentIds).toContain('student-katherine');
  expect(result.history[0].command).toBe('Keep Katherine near the front and away from Alan');
});

test('V7.1.0 together requests use the existing group model and remain idempotent', async ({ page }) => {
  await ready(page);
  await seedPlannerRoom(page);
  const result = await page.evaluate(() => {
    const assistant = window.PlannerAssistantV710;
    const first = assistant.preview('Seat Ada and Grace together');
    const firstApply = assistant.apply(first);
    const countAfterFirst = state.groups.length;
    const second = assistant.preview('Seat Ada and Grace together');
    const secondApply = assistant.apply(second);
    const pairGroup = state.groups.find(group => group.type === 'together' && ['student-ada','student-grace'].every(id => group.studentIds.includes(id)));
    return { firstApply, secondApply, countAfterFirst, countAfterSecond:state.groups.length, pairGroup };
  });
  expect(result.firstApply.ok).toBeTruthy();
  expect(result.secondApply.ok).toBeTruthy();
  expect(result.countAfterFirst).toBe(1);
  expect(result.countAfterSecond).toBe(1);
  expect(result.pairGroup).toBeTruthy();
});

test('V7.1.0 testing requests generate the existing non-destructive Testing Mode preview', async ({ page }) => {
  await ready(page);
  await seedPlannerRoom(page);
  const result = await page.evaluate(() => {
    const assistant = window.PlannerAssistantV710;
    const before = state.freeformLayout.objects.filter(object => object.type === 'seat').map(object => [object.id, object.assignedStudentId, object.x, object.y]);
    const preview = assistant.preview('Create a testing layout with at least 6 feet between students');
    const afterAssistantPreview = state.freeformLayout.objects.filter(object => object.type === 'seat').map(object => [object.id, object.assignedStudentId, object.x, object.y]);
    const applied = assistant.apply(preview);
    const afterRun = state.freeformLayout.objects.filter(object => object.type === 'seat').map(object => [object.id, object.assignedStudentId, object.x, object.y]);
    const testingPreview = window.TestingModeV703.activePreview();
    return { preview, applied, before, afterAssistantPreview, afterRun, testingReport:testingPreview?.report || null };
  });
  expect(result.preview.intent).toBe('testing_preview');
  expect(result.preview.canApply).toBeTruthy();
  expect(result.before).toEqual(result.afterAssistantPreview);
  expect(result.applied.ok).toBeTruthy();
  expect(result.before).toEqual(result.afterRun);
  expect(result.testingReport).toBeTruthy();
  expect(result.testingReport.requestedSpacing).toBeCloseTo(6, 5);
  await expect(page.locator('#testingModeV703Modal')).toHaveClass(/\bshow\b/);
});

test('V7.1.0 conflict explanations are read-only and grounded in current planner findings', async ({ page }) => {
  await ready(page);
  await seedPlannerRoom(page);
  await page.evaluate(() => {
    const student = state.students.find(item => item.id === 'student-katherine');
    student.requirements.front = 'require';
  });
  const result = await page.evaluate(() => {
    const assistant = window.PlannerAssistantV710;
    const before = JSON.stringify({ students:state.students, groups:state.groups, freeform:state.freeformLayout.objects });
    const preview = assistant.preview('Which requirement is causing the most conflicts?');
    const applied = assistant.apply(preview);
    const after = JSON.stringify({ students:state.students, groups:state.groups, freeform:state.freeformLayout.objects });
    return { preview, applied, unchanged:before === after };
  });
  expect(result.preview.intent).toBe('explain_conflicts');
  expect(result.preview.impact.metrics.find(item => item.label === 'Required conflicts')).toBeTruthy();
  expect(result.applied.ok).toBeTruthy();
  expect(result.unchanged).toBeTruthy();
});

test('V7.1.0 command dock and modal stay usable on desktop and mobile', async ({ page }) => {
  await ready(page);
  await seedPlannerRoom(page);
  await expect(page.locator('#plannerAssistantV710Dock')).toHaveCount(1);
  await page.keyboard.press('Control+Alt+P');
  const modal = page.locator('#plannerAssistantV710Modal');
  await expect(modal).toHaveClass(/\bshow\b/);
  await expect(page.getByRole('heading', { name:'Planner Assistant' })).toBeVisible();
  await page.locator('#plannerAssistantV710Input').fill('Show valid seats for Ada');
  await page.locator('#plannerAssistantV710PreviewBtn').click();
  await expect(page.locator('.v710-preview-card')).toBeVisible();
  await expect(page.locator('#plannerAssistantV710ApplyBtn')).toBeEnabled();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});


test('V7.2.1 recognizes common teacher phrasing',async({page})=>{await ready(page);await seedPlannerRoom(page);const unknown=await page.evaluate(()=>['Where can Ada sit?','Create a collaborative layout','Make a discussion layout','Spread everyone out for a test','Fix my seating chart','Fix this plan but move no more than 4 students','Explain the conflicts','Make a seating chart','Randomize the seats','What can the Planner Assistant do?'].map(command=>({command,intent:window.PlannerAssistantV710.interpret(command).intent})).filter(x=>x.intent==='unknown'));expect(unknown).toEqual([])});
