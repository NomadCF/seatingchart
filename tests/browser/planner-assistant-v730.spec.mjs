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
  await expect.poll(() => page.evaluate(() => Boolean(window.PlannerAssistantWorkspaceV730?.installed))).toBe(true);
}

async function seed(page) {
  await page.evaluate(() => {
    state.activeClassId = 'v730-regression-class';
    state.layoutMode = 'freeform';
    state.students = [
      normalizeStudent({ id:'ada', firstName:'Ada', lastName:'Lovelace', requirements:{} }),
      normalizeStudent({ id:'grace', firstName:'Grace', lastName:'Hopper', requirements:{} }),
      normalizeStudent({ id:'maya', firstName:'Maya', lastName:'Patel', requirements:{ front:'prefer' } }),
      normalizeStudent({ id:'noah', firstName:'Noah', lastName:'Reed', requirements:{} }),
      normalizeStudent({ id:'eli', firstName:'Eli', lastName:'Stone', requirements:{} })
    ];
    state.groups = [normalizeGroupRecord({ id:'talkative', name:'Talkative Students', type:'spread', priority:7, studentIds:['noah','eli'], anchorSeats:[], zoneId:'' }, 0)];
    state.todaySession = { active:false, absentStudentIds:[], guestStudentIds:[], masterAssignments:null };
    state.freeformLayout = normalizeFreeformLayout({
      initialized:true,
      canvas:{ width:2200, height:1500, gridSize:40, snap:true, zoom:1, frontSide:'top' },
      physicalRoom:{ enabled:true, unit:'ft', width:30, height:20, gridStep:1, showGrid:true, showRulers:true },
      objects:[
        { id:'board', type:'board', label:'Front Board', x:700, y:20, width:800, height:70, zIndex:1 },
        { id:'door', type:'door', label:'Door', x:20, y:600, width:90, height:220, zIndex:1 },
        { id:'teacher', type:'teacher', label:'Teacher Desk', x:900, y:160, width:240, height:140, zIndex:1 },
        { id:'seat-a', type:'seat', label:'A', x:360, y:520, width:176, height:112, assignedStudentId:'ada', zIndex:3 },
        { id:'seat-b', type:'seat', label:'B', x:650, y:520, width:176, height:112, assignedStudentId:'grace', zIndex:3 },
        { id:'seat-c', type:'seat', label:'C', x:940, y:520, width:176, height:112, assignedStudentId:'maya', zIndex:3 },
        { id:'seat-d', type:'seat', label:'D', x:1230, y:520, width:176, height:112, assignedStudentId:'noah', zIndex:3 },
        { id:'seat-e', type:'seat', label:'E', x:1520, y:520, width:176, height:112, assignedStudentId:'eli', zIndex:3 },
        { id:'seat-f', type:'seat', label:'F', x:500, y:850, width:176, height:112, assignedStudentId:'', zIndex:3 },
        { id:'seat-g', type:'seat', label:'G', x:900, y:850, width:176, height:112, assignedStudentId:'', zIndex:3 },
        { id:'seat-h', type:'seat', label:'H', x:1300, y:850, width:176, height:112, assignedStudentId:'', zIndex:3 }
      ], groups:[]
    });
    state.rows = 1; state.cols = 8; state.cells = {};
    state.seatingPlans = [];
    window.PlannerAssistantWorkspaceV730.clearWorkspace();
    resetFreeformGeometryCache?.();
    renderAll();
    window.PlannerAssistantV710?.afterReady?.();
    window.InterfaceAssistantAuditV721?.afterReady?.();
    window.PlannerAssistantWorkspaceV730?.afterReady?.();
  });
  await page.waitForTimeout(100);
}

test('V7.3 Assistant workspace is a first-class planning surface', async ({ page }) => {
  await ready(page); await seed(page);
  await page.evaluate(() => window.PlannerAssistantV710.open());
  await expect(page.locator('#plannerAssistantV730Workspace')).toBeVisible();
  await expect(page.locator('#plannerAssistantV730Input')).toBeVisible();
  await expect(page.locator('#plannerAssistantV730Plan')).toBeVisible();
  await expect(page.locator('#plannerAssistantV730Transcript')).toBeVisible();
  await expect(page.locator('#plannerAssistantV730Workspace')).toContainText('Seat Guidance & candidate seats');
  await expect(page.locator('#plannerAssistantV730Workspace')).toContainText('Named Seating Plans & comparisons');
});

test('V7.3 supports seat options, comparison, and explicit candidate application', async ({ page }) => {
  await ready(page); await seed(page);
  const result = await page.evaluate(() => {
    const assistant = window.PlannerAssistantWorkspaceV730;
    const options = assistant.run('What seats would work for Maya?');
    const comparison = assistant.compareCandidate(0);
    return { kind:options.kind, count:options.candidates.length, comparison };
  });
  expect(result.kind).toBe('seat-options');
  expect(result.count).toBeGreaterThan(0);
  expect(result.comparison.studentName).toContain('Maya');
  expect(result.comparison.targetKey).toBeTruthy();
  await page.evaluate(() => window.PlannerAssistantV710.open());
  await expect(page.locator('.v730-candidate').first()).toBeVisible();
});

test('V7.3 understands use-the-second-one follow-up against the working seat candidates', async ({ page }) => {
  await ready(page); await seed(page);
  const result = await page.evaluate(() => {
    const assistant = window.PlannerAssistantWorkspaceV730;
    assistant.run('What seats would work for Maya?');
    const response = assistant.run('Use the second one');
    return { kind:response.kind, title:response.title, comparison:response.comparison };
  });
  expect(result.kind).toBe('candidate-choice');
  expect(result.title).toContain('option 2');
  expect(result.comparison.studentName).toContain('Maya');
});

test('V7.3 builds a compound testing plan while preserving explicit constraints', async ({ page }) => {
  await ready(page); await seed(page);
  const result = await page.evaluate(() => {
    const assistant = window.PlannerAssistantWorkspaceV730;
    const response = assistant.run('I have a test tomorrow. Keep accessibility placements, preserve locked seats, spread everyone out as much as possible, and tell me what will not fit.');
    const workspace = assistant.loadWorkspace();
    return { kind:response.kind, metrics:response.metrics || [], details:response.details || [], constraints:workspace.workingPlan.constraints, actions:workspace.workingPlan.proposedActions };
  });
  expect(result.kind).toBe('testing-plan');
  expect(result.constraints.preserveLocked).toBe(true);
  expect(result.constraints.preserveAccessibility).toBe(true);
  expect(result.metrics.length).toBeGreaterThan(0);
  expect(result.actions.join(' ')).toContain('Testing Mode preview');
});

test('V7.3 expands chart analysis and fairness comparison', async ({ page }) => {
  await ready(page); await seed(page);
  const result = await page.evaluate(() => {
    const assistant = window.PlannerAssistantWorkspaceV730;
    const health = assistant.run('Review this seating chart');
    const priorities = assistant.run('What should I fix first?');
    const hardest = assistant.run('Who is hardest to seat?');
    const fairness = assistant.run('Compare fairness with the previous saved plan');
    return { health, priorities, hardest, fairness };
  });
  expect(result.health.kind).toBe('analysis');
  expect(result.priorities.kind).toBe('analysis');
  expect(result.hardest.kind).toBe('analysis');
  expect(result.fairness.title).toContain('Fairness comparison');
  expect(result.health.metrics.length).toBeGreaterThan(0);
});

test('V7.3 refuses to infer behavior labels when no matching group is defined', async ({ page }) => {
  await ready(page); await seed(page);
  const result = await page.evaluate(() => {
    state.groups = [];
    return window.PlannerAssistantWorkspaceV730.run('Put my talkative kids farther apart');
  });
  expect(result.kind).toBe('clarify');
  expect(result.title).toContain('Which students');
  expect(result.summary).toContain('will not infer behavioral labels');
});

test('V7.3 maps a matching teacher-defined behavior group without guessing individual students', async ({ page }) => {
  await ready(page); await seed(page);
  const result = await page.evaluate(() => window.PlannerAssistantWorkspaceV730.run('Put my talkative students farther apart'));
  expect(['planner-preview','success']).toContain(result.kind);
  expect(result.title).toMatch(/Talkative|rule/i);
});

test('V7.3 exposes planner launchers, undo, and mobile-safe workspace width', async ({ page }) => {
  await ready(page); await seed(page);
  const features = await page.evaluate(() => {
    const assistant = window.PlannerAssistantWorkspaceV730;
    return ['Open Today Mode','Open Planner Packs','Open print options','Create a snapshot'].map(command => {
      const result = assistant.run(command); return { command, kind:result.kind, action:result.actions?.[0]?.action || '' };
    });
  });
  expect(features.every(item => item.kind === 'feature')).toBe(true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
