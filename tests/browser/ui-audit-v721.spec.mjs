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

async function seedAuditClass(page) {
  await page.evaluate(() => {
    state.layoutMode = 'freeform';
    state.students = [
      normalizeStudent({ id:'student-ada', firstName:'Ada', lastName:'Lovelace', requirements:{} }),
      normalizeStudent({ id:'student-grace', firstName:'Grace', lastName:'Hopper', requirements:{} }),
      normalizeStudent({ id:'student-maya', firstName:'Maya', lastName:'Patel', requirements:{} }),
      normalizeStudent({ id:'student-noah', firstName:'Noah', lastName:'Reed', requirements:{} }),
      normalizeStudent({ id:'student-eli', firstName:'Eli', lastName:'Stone', requirements:{} })
    ];
    state.groups = [normalizeGroupRecord({ id:'group-reading', name:'Reading Partners', type:'together', priority:7, studentIds:['student-ada','student-grace'], anchorSeats:[], zoneId:'' }, 0)];
    state.todaySession = { active:false, absentStudentIds:[], guestStudentIds:[], masterAssignments:null };
    state.freeformLayout = normalizeFreeformLayout({
      initialized:true,
      canvas:{ width:2200, height:1500, gridSize:40, snap:true, zoom:1, frontSide:'top' },
      physicalRoom:{ enabled:true, unit:'ft', width:30, height:20, gridStep:1, showGrid:true, showRulers:true },
      objects:[
        { id:'board-fixed', type:'board', label:'Front Board', x:700, y:20, width:800, height:70, zIndex:1 },
        { id:'door-fixed', type:'door', label:'Door', x:20, y:600, width:90, height:220, zIndex:1 },
        { id:'station-reading', type:'station', label:'Reading Station', x:180, y:190, width:240, height:160, zIndex:1 },
        { id:'station-lab', type:'lab', label:'Lab Station', x:1500, y:190, width:280, height:180, zIndex:1 },
        { id:'station-teacher', type:'station', label:'Teacher Station', x:820, y:1120, width:260, height:160, zIndex:1 },
        { id:'seat-ada', cellKey:'r1c1', type:'seat', x:420, y:820, width:176, height:112, assignedStudentId:'student-ada', zIndex:3 },
        { id:'seat-grace', cellKey:'r1c2', type:'seat', x:680, y:820, width:176, height:112, assignedStudentId:'student-grace', zIndex:3 },
        { id:'seat-maya', cellKey:'r1c3', type:'seat', x:940, y:820, width:176, height:112, assignedStudentId:'student-maya', zIndex:3 },
        { id:'seat-noah', cellKey:'r1c4', type:'seat', x:1200, y:820, width:176, height:112, assignedStudentId:'student-noah', zIndex:3 },
        { id:'seat-eli', cellKey:'r1c5', type:'seat', x:1460, y:820, width:176, height:112, assignedStudentId:'student-eli', zIndex:3 }
      ],
      groups:[]
    });
    state.rows = 1;
    state.cols = 5;
    state.cells = {};
    resetFreeformGeometryCache?.();
    renderAll();
    document.body.classList.toggle('freeform-layout-mode', true);
    window.ActivityLayoutsV701?.afterReady?.();
    window.StationRotationsV702?.afterReady?.();
    window.TestingModeV703?.afterReady?.();
    window.PlannerAssistantV710?.afterReady?.();
    window.GuidedLearningInstaller?.install?.();
  });
  await page.waitForTimeout(250);
}

const teacherRequests = [
  'Where can Ada sit?',
  'Show me seats for Ada',
  'Move Ada to the front',
  'Keep Maya near the front and away from the door',
  'Keep Noah and Eli apart',
  'Seat Ada next to Grace',
  'Put Reading Partners together',
  'Create a collaborative layout',
  'Make a group work layout',
  'Create a discussion layout',
  'Use the Direct Instruction layout',
  'Spread everyone out for a test',
  'Create a testing layout with at least 5 feet between students',
  'Set up station rotations',
  'Rotate the groups through the stations',
  'Make a station rotation with 3 groups',
  'Fix my seating chart',
  'Fix this plan but move no more than 4 students',
  'Keep accessibility requirements and change as little as possible',
  'What is wrong with this seating chart?',
  'Explain the conflicts',
  'Why is Ada sitting here?',
  'Make a seating chart',
  'Generate the best seating plan',
  'Randomize the seats',
  'What can the Planner Assistant do?',
  'Help me use the Planner Assistant'
];

test('V7.2.1 UI audit captures Planner Assistant language coverage and contextual-help duplication', async ({ page }) => {
  await ready(page);
  await seedAuditClass(page);
  const audit = await page.evaluate(requests => {
    const assistant = window.PlannerAssistantV710;
    const commands = requests.map(command => {
      const result = assistant.interpret(command);
      return { command, intent:result.intent, title:result.title, blockers:result.blockers || [] };
    });
    const guides = [...document.querySelectorAll('.guided-context-button')].map(button => {
      const container = button.closest('.panel-header,.toolbar-header,.button-row,.settings-page-header,.section,.modal') || button.parentElement;
      const heading = container?.querySelector?.('h1,h2,h3,h4,strong')?.textContent?.trim() || '';
      return { id:button.id, text:button.textContent.trim(), heading, parent:button.parentElement?.className || '' };
    });
    const duplicateIds = [...document.querySelectorAll('[id]')]
      .map(node => node.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index)
      .filter((id, index, ids) => ids.indexOf(id) === index);
    const contextualGroups = new Map();
    [...document.querySelectorAll('.guided-context-button')].forEach(button => {
      const container = button.closest('.panel-header,.toolbar-header,.button-row,.settings-page-header,.section,.modal') || button.parentElement;
      const key = container?.id || container?.className || container?.tagName || 'unknown';
      contextualGroups.set(key, (contextualGroups.get(key) || 0) + 1);
    });
    return {
      commands,
      unknown:commands.filter(item => item.intent === 'unknown'),
      guides,
      contextualGroups:[...contextualGroups.entries()].filter(([, count]) => count > 1),
      duplicateIds,
      pageOverflow:document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  }, teacherRequests);
  console.log('V721_UI_AUDIT ' + JSON.stringify(audit));
  expect(audit.duplicateIds).toEqual([]);
  expect(audit.pageOverflow).toBeLessThanOrEqual(2);
});

test('V7.2.1 UI audit checks major modal bounds on desktop and mobile', async ({ page }) => {
  await ready(page);
  await seedAuditClass(page);
  const selectors = [];
  const openAndRecord = async (openFn, selector) => {
    await page.evaluate(openFn);
    await page.waitForTimeout(80);
    if (await page.locator(selector).count()) selectors.push(selector);
  };
  await openAndRecord(() => window.PlannerAssistantV710?.open?.(), '#plannerAssistantV710Modal');
  await page.evaluate(() => window.PlannerAssistantV710?.close?.());
  await openAndRecord(() => window.PlanningToolsV66?.open?.(), '#planningToolsModal');
  await page.evaluate(() => window.PlanningToolsV66?.close?.());
  await openAndRecord(() => window.ActivityLayoutsV701?.open?.(), '#activityLayoutsV701Modal');
  await page.evaluate(() => window.ActivityLayoutsV701?.close?.());
  await openAndRecord(() => window.StationRotationsV702?.open?.(), '#stationRotationsV702Modal');
  await page.evaluate(() => window.StationRotationsV702?.close?.());
  await openAndRecord(() => window.TestingModeV703?.open?.(), '#testingModeV703Modal');
  await page.evaluate(() => window.TestingModeV703?.close?.());
  await openAndRecord(() => window.GuidedLearning?.openHelp?.('lessons'), '#helpGuideModal');
  await page.evaluate(() => document.querySelector('#helpGuideModal')?.classList.remove('show'));

  const results = await page.evaluate(modals => modals.map(selector => {
    const node = document.querySelector(selector);
    const dialog = node?.querySelector('.modal') || node;
    const rect = dialog?.getBoundingClientRect();
    return {
      selector,
      exists:Boolean(dialog),
      width:rect?.width || 0,
      height:rect?.height || 0,
      left:rect?.left || 0,
      top:rect?.top || 0,
      right:rect?.right || 0,
      bottom:rect?.bottom || 0,
      viewport:{ width:innerWidth, height:innerHeight }
    };
  }), selectors);
  console.log('V721_MODAL_AUDIT ' + JSON.stringify(results));
  results.forEach(result => {
    expect(result.exists).toBeTruthy();
    expect(result.width).toBeLessThanOrEqual(result.viewport.width + 1);
    expect(result.height).toBeLessThanOrEqual(result.viewport.height + 1);
  });
});
