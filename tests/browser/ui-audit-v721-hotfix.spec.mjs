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
  await expect.poll(() => page.evaluate(() => Boolean(window.InterfaceAssistantAuditV721 && window.PlannerAssistantConversationV722?.installed && window.PlannerAssistantFollowupFixV722?.installed))).toBe(true);
}

async function seedClass(page) {
  await page.evaluate(() => {
    state.layoutMode = 'freeform';
    state.activeClassId = 'assistant-regression-class';
    state.students = [
      normalizeStudent({ id:'student-ada', firstName:'Ada', lastName:'Lovelace', requirements:{} }),
      normalizeStudent({ id:'student-grace', firstName:'Grace', lastName:'Hopper', requirements:{} }),
      normalizeStudent({ id:'student-maya', firstName:'Maya', lastName:'Patel', requirements:{} }),
      normalizeStudent({ id:'student-noah', firstName:'Noah', lastName:'Reed', requirements:{} }),
      normalizeStudent({ id:'student-eli', firstName:'Eli', lastName:'Stone', requirements:{} })
    ];
    state.groups = [normalizeGroupRecord({ id:'group-reading', name:'Reading Partners', type:'together', priority:7, studentIds:['student-ada','student-grace'], anchorSeats:[], zoneId:'' }, 0)];
    state.todaySession = { active:false, absentStudentIds:[], guestStudentIds:[], masterAssignments:null };
    state.freeformLayout = normalizeFreeformLayout({ initialized:true, canvas:{ width:2200, height:1500, gridSize:40, snap:true, zoom:1, frontSide:'top' }, physicalRoom:{ enabled:true, unit:'ft', width:30, height:20, gridStep:1, showGrid:true, showRulers:true }, objects:[
      { id:'board-fixed', type:'board', label:'Front Board', x:700, y:20, width:800, height:70, zIndex:1 },
      { id:'door-fixed', type:'door', label:'Door', x:20, y:600, width:90, height:220, zIndex:1 },
      { id:'seat-ada', cellKey:'r1c1', type:'seat', x:420, y:820, width:176, height:112, assignedStudentId:'student-ada', zIndex:3 },
      { id:'seat-grace', cellKey:'r1c2', type:'seat', x:680, y:820, width:176, height:112, assignedStudentId:'student-grace', zIndex:3 },
      { id:'seat-maya', cellKey:'r1c3', type:'seat', x:940, y:820, width:176, height:112, assignedStudentId:'student-maya', zIndex:3 },
      { id:'seat-noah', cellKey:'r1c4', type:'seat', x:1200, y:820, width:176, height:112, assignedStudentId:'student-noah', zIndex:3 },
      { id:'seat-eli', cellKey:'r1c5', type:'seat', x:1460, y:820, width:176, height:112, assignedStudentId:'student-eli', zIndex:3 }
    ], groups:[] });
    state.rows = 1; state.cols = 5; state.cells = {};
    window.PlannerAssistantV710.clearConversationContext?.();
    resetFreeformGeometryCache?.(); renderAll(); document.body.classList.toggle('freeform-layout-mode', true);
    window.PlannerAssistantV710?.afterReady?.(); window.InterfaceAssistantAuditV721?.afterReady?.();
  });
  await page.waitForTimeout(100);
}

const naturalRequests = ['Put Ada beside Grace','Seat Ada next to Grace',"Don't put Noah by Eli",'Move Maya closer to the front','Find a place for Noah to sit','Why did you put Grace there?','Arrange the desks in rows','Put the desks into pods','Set up an exam layout with 6 ft spacing','Set up a station rotation with 3 teams','Can you fix this seating chart?','What is wrong with this chart?','Shuffle everybody','What can you do?'];

test('Planner Assistant normalizes common teacher language into supported planner actions', async ({ page }) => {
  await ready(page); await seedClass(page);
  const results = await page.evaluate(requests => requests.map(request => { const normalized = window.InterfaceAssistantAuditV721.normalizeAssistantCommand(request); const result = window.PlannerAssistantV710.interpret(normalized); return { request, normalized, intent:result.intent }; }), naturalRequests);
  expect(results.filter(item => ['unknown','ambiguous'].includes(item.intent))).toEqual([]);
  expect(results.find(item => item.request === 'Seat Ada next to Grace')?.normalized).toContain('Lovelace');
  expect(results.find(item => item.request === 'Arrange the desks in rows')?.intent).toBe('create_activity_layout');
  expect(results.find(item => item.request === 'What can you do?')?.intent).toBe('assistant_help');
});

test('Planner Assistant keeps short class-scoped context for follow-up requests', async ({ page }) => {
  await ready(page); await seedClass(page);
  const result = await page.evaluate(() => {
    window.PlannerAssistantV710.preview('Keep Maya near the front');
    const rewritten = window.PlannerAssistantV710.rewriteFollowup('but not next to Noah');
    const preview = window.PlannerAssistantV710.preview('but not next to Noah');
    return { rewritten, intent:preview.intent, relation:preview.parameters?.relation, context:window.PlannerAssistantV710.conversationContext() };
  });
  expect(result.rewritten).toMatch(/Maya.*Noah/i);
  expect(result.intent).toBe('rule_changes');
  expect(result.relation).toBe('apart');
  expect(result.context.students).toContain('student-maya');
});

test('Planner Assistant provides useful read-only classroom analysis', async ({ page }) => {
  await ready(page); await seedClass(page);
  const results = await page.evaluate(() => ['Who is hardest to seat?','What should I fix first?','Review this seating chart','Who is unseated?'].map(command => { const preview = window.PlannerAssistantV710.preview(command); return { command, intent:preview.intent, metrics:preview.impact?.metrics || [], details:preview.details || [] }; }));
  expect(results.every(item => item.intent.startsWith('analysis_'))).toBe(true);
  expect(results.every(item => item.metrics.length > 0)).toBe(true);
  expect(results.find(item => item.command === 'Review this seating chart')?.details.length).toBeGreaterThan(0);
});

test('student named Ada is not mistaken for an accessibility requirement', async ({ page }) => {
  await ready(page); await seedClass(page);
  const preview = await page.evaluate(async () => { window.InterfaceAssistantAuditV721.open('Seat Ada next to Grace'); await new Promise(resolve => setTimeout(resolve, 20)); const current = window.PlannerAssistantV710.currentPreview(); return { intent:current?.intent, relation:current?.parameters?.relation, requirementChanges:current?.parameters?.requirementChanges || {}, command:current?.command }; });
  expect(preview.intent).toBe('rule_changes'); expect(preview.relation).toBe('together'); expect(preview.requirementChanges.ada).toBeUndefined(); expect(preview.command).toContain('Lovelace');
});

test('unrecognized requests become clarification instead of a dead-end parser error', async ({ page }) => {
  await ready(page); await seedClass(page);
  await page.evaluate(() => window.InterfaceAssistantAuditV721.open('Do something clever with Ada'));
  await expect(page.locator('#plannerAssistantV721Suggestions')).toBeVisible();
  await expect(page.locator('#plannerAssistantV710Preview')).not.toContainText('I could not map that request to a planner action');
  await expect(page.locator('#plannerAssistantV710Preview')).toContainText(/need|detail|Try/i);
});

test('Assistant exposes context and expanded help inside the product', async ({ page }) => {
  await ready(page); await seedClass(page);
  await page.evaluate(() => window.PlannerAssistantV710.open());
  await expect(page.locator('#plannerAssistantV722Context')).toBeVisible();
  await page.evaluate(() => window.PlannerAssistantV710.showGuide());
  await expect(page.locator('#plannerAssistantV722Guide')).toBeVisible();
  await expect(page.locator('#plannerAssistantV722Guide')).toContainText('Ask follow-ups');
  await expect(page.locator('#plannerAssistantV722Guide')).toContainText('Analyze the chart');
});

test('Assistant has expanded, compact, and fully hidden workspace states with central recovery controls', async ({ page }) => {
  await ready(page); await seedClass(page);
  await page.evaluate(() => window.InterfaceAssistantAuditV721.setMode('expanded', { announce:false })); await expect(page.locator('#plannerAssistantV721Dock')).toBeVisible();
  await page.evaluate(() => window.InterfaceAssistantAuditV721.setMode('compact', { announce:false })); await expect(page.locator('#plannerAssistantV721Compact')).toBeVisible();
  await page.evaluate(() => window.InterfaceAssistantAuditV721.setMode('hidden', { announce:false })); await expect(page.locator('#plannerAssistantV721Dock')).toBeHidden(); await expect(page.locator('#plannerAssistantV721Compact')).toBeHidden();
  await expect(page.locator('#plannerAssistantV721DisplayMode')).toHaveValue('hidden');
});

test('UI audit removes repeated Guide me controls and keeps the workspace within the viewport', async ({ page }) => {
  await ready(page); await seedClass(page);
  await page.evaluate(() => { const host = document.querySelector('header') || document.body; for (let index=0; index<3; index+=1) { const button=document.createElement('button'); button.className='guided-context-button'; button.textContent='Guide me'; host.appendChild(button); } });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.guided-context-button').length)).toBe(0);
  const audit = await page.evaluate(() => window.InterfaceAssistantAuditV721.audit());
  expect(audit.duplicateIds).toEqual([]); expect(audit.guideMeCount).toBe(0); expect(audit.contextualGuideCount).toBe(0); expect(audit.pageOverflow).toBeLessThanOrEqual(2);
});
