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

async function seedPackClass(page) {
  await page.evaluate(() => {
    state.layoutMode = 'freeform';
    state.students = [
      normalizeStudent({ id:'student-a', firstName:'Ada', lastName:'Lovelace', requirements:{} }),
      normalizeStudent({ id:'student-b', firstName:'Grace', lastName:'Hopper', requirements:{} }),
      normalizeStudent({ id:'student-c', firstName:'Katherine', lastName:'Johnson', requirements:{} })
    ];
    state.rows = 1;
    state.cols = 3;
    state.cells = {
      r1c1:{ row:1, col:1, type:'seat', assignedStudentId:'student-a', manual:true, anchorGroupIds:[], zoneIds:['zone-a'] },
      r1c2:{ row:1, col:2, type:'seat', assignedStudentId:'student-b', manual:false, anchorGroupIds:[], zoneIds:[] },
      r1c3:{ row:1, col:3, type:'seat', assignedStudentId:'student-c', manual:false, anchorGroupIds:[], zoneIds:[] }
    };
    state.groups = [{ id:'group-a', name:'Temporary Group', type:'together', priority:6, studentIds:['student-a','student-b'], anchorSeats:[], color:'#2f6fed', zoneId:'' }];
    state.zones = [{ id:'zone-a', name:'Front Zone', color:'#dbeafe', studentIds:['student-a'], groupIds:['group-a'], comment:'Ada accommodation note should never enter a pack.' }];
    state.customObjects = [normalizeCustomObject({ type:'custom-standing-desk', label:'Standing Desk', width:240, height:120, color:'#f5e8d3' })];
    state.requirementPresets = [normalizeRequirementPreset({
      id:'preset-private-link',
      name:'Front pair source',
      requirements:{ front:'prefer', preferredZoneIds:['zone-a'], minDistanceStudentIds:['student-b'] }
    })];
    state.freeformLayout = normalizeFreeformLayout({
      initialized:true,
      canvas:{ width:2400, height:1500, gridSize:40, snap:true, zoom:1, frontSide:'top' },
      physicalRoom:{
        enabled:true, unit:'ft', width:30, height:20, gridStep:1, showGrid:true, showRulers:true,
        background:{ dataUrl:'data:image/png;base64,aGVsbG8=', name:'room-photo.png', visible:true, opacity:.4, scalePct:100, offsetXPct:0, offsetYPct:0, rotation:0, print:false, locked:true }
      },
      objects:[
        { id:'station-a', type:'station', label:'Reading', x:120, y:160, width:300, height:180, zIndex:1 },
        { id:'station-b', type:'station', label:'Writing', x:1840, y:160, width:300, height:180, zIndex:1 },
        { id:'table-a', type:'table', label:'Collaboration Table', x:930, y:620, width:480, height:260, zIndex:2 },
        { id:'seat-a', cellKey:'r1c1', type:'seat', x:540, y:980, width:176, height:112, assignedStudentId:'student-a', manual:true, locked:true, zIndex:3 },
        { id:'seat-b', cellKey:'r1c2', type:'seat', x:870, y:980, width:176, height:112, assignedStudentId:'student-b', manual:false, locked:false, zIndex:3 },
        { id:'seat-c', cellKey:'r1c3', type:'seat', x:1200, y:980, width:176, height:112, assignedStudentId:'student-c', manual:false, locked:false, zIndex:3 }
      ],
      groups:[]
    });
    state.roomTemplates = [normalizeRoomTemplateRecord({
      id:'template-source', name:'Source Room', rows:1, cols:3, cells:state.cells, layoutMode:'freeform', freeformLayout:state.freeformLayout,
      zones:state.zones, customObjects:state.customObjects, description:'Reusable source room.'
    })];
    state.freeformLayout.activityLayouts = {
      version:1,
      activeId:'layout-a',
      layouts:[
        {
          id:'layout-a', name:'Direct Layout', preset:'direct', description:'Source layout', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
          objects:state.freeformLayout.objects.filter(object => !['station'].includes(object.type)).map(object => ({ ...object })), groups:[]
        },
        {
          id:'layout-b', name:'Alternate Layout', preset:'group', description:'Shifted source layout', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
          objects:state.freeformLayout.objects.filter(object => !['station'].includes(object.type)).map(object => ({ ...object, x:Number(object.x || 0) + (object.type === 'seat' ? 90 : 0) })), groups:[]
        }
      ]
    };
    state.freeformLayout.stationRotations = {
      version:1,
      activePlanId:'rotation-a',
      plans:[{
        id:'rotation-a', name:'Literacy Rotation', activityLayoutId:'layout-a', durationMinutes:12, transitionMinutes:2, teamSource:'balanced',
        stations:[
          { objectId:'station-a', name:'Reading', instructions:'Read the prompt and annotate.' },
          { objectId:'station-b', name:'Writing', instructions:'Draft a short response.' }
        ],
        teams:[
          { id:'team-a', name:'Team 1', studentIds:['student-a','student-c'] },
          { id:'team-b', name:'Team 2', studentIds:['student-b'] }
        ],
        currentRound:0, phase:'stopped', phaseStartedAt:'', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
      }]
    };
    state.freeformLayout.testingMode = {
      version:1,
      lastConfig:{ name:'Assessment Day', spacing:6, preserveLocked:true, respectNeeds:true, keepExtraSeatsNearEdges:true },
      lastReport:{}, sourceActivityLayoutId:'', activeTestingLayoutId:'', generatedAt:''
    };
    resetFreeformGeometryCache?.();
    renderAll();
    document.body.classList.toggle('freeform-layout-mode', true);
    window.ActivityLayoutsV701?.afterReady?.();
    window.StationRotationsV702?.afterReady?.();
    window.TestingModeV703?.afterReady?.();
    window.PlannerPacksV720?.afterReady?.();
  });
  await page.waitForTimeout(180);
}

test('V7.2 Planner Packs module and public format are present', async ({ page }) => {
  await ready(page);
  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', '7.2.1');
  const result = await page.evaluate(() => ({
    version:window.PlannerPacksV720?.version,
    format:window.PlannerPacksV720?.format,
    schemaVersion:window.PlannerPacksV720?.schemaVersion,
    builtins:window.PlannerPacksV720?.builtinPacks?.().length
  }));
  expect(result).toEqual({ version:'7.2.0', format:'classroom-seating-planner-pack-v1', schemaVersion:1, builtins:1 });
});

test('V7.2 pack builder strips roster links, assignments, notes, and images by default', async ({ page }) => {
  await ready(page);
  await seedPackClass(page);
  const result = await page.evaluate(() => {
    const pack = window.PlannerPacksV720.buildPack({
      name:'Privacy Test Pack', publisher:'QA', includeCurrentRoom:true, includeRoomTemplates:true,
      includeRequirementPresets:true, includeCustomObjects:true, includeActivityLayouts:true,
      includeRotationBlueprints:true, includeTestingProfiles:true, includeFloorPlanImages:false
    });
    const text = JSON.stringify(pack);
    return {
      counts:window.PlannerPacksV720.packCounts(pack),
      hasStudentA:text.includes('student-a'),
      hasStudentB:text.includes('student-b'),
      hasPrivateNote:text.includes('Ada accommodation note'),
      hasImage:text.includes('data:image/'),
      privacy:pack.privacy,
      zone:pack.contents.roomTemplates[0]?.zones?.[0],
      requirement:pack.contents.requirementPresets[0]?.requirements,
      rotation:pack.contents.rotationBlueprints[0],
      personalFindings:window.PlannerPacksV720.personalDataFindings(pack)
    };
  });
  expect(result.counts.roomTemplates).toBeGreaterThanOrEqual(2);
  expect(result.counts.activityLayouts).toBe(2);
  expect(result.counts.rotationBlueprints).toBe(1);
  expect(result.hasStudentA).toBeFalsy();
  expect(result.hasStudentB).toBeFalsy();
  expect(result.hasPrivateNote).toBeFalsy();
  expect(result.hasImage).toBeFalsy();
  expect(result.privacy.studentDataIncluded).toBeFalsy();
  expect(result.privacy.floorPlanImagesIncluded).toBeFalsy();
  expect(result.zone.studentIds).toEqual([]);
  expect(result.zone.groupIds).toEqual([]);
  expect(result.zone.comment).toBe('');
  expect(result.requirement.minDistanceStudentIds).toEqual([]);
  expect(result.requirement.preferredZoneIds).toEqual([]);
  expect(result.rotation.teamCount).toBe(2);
  expect(result.rotation.teams).toBeUndefined();
  expect(result.personalFindings).toEqual([]);
});

test('V7.2 only includes floor-plan images with explicit opt-in', async ({ page }) => {
  await ready(page);
  await seedPackClass(page);
  const result = await page.evaluate(() => {
    const pack = window.PlannerPacksV720.buildPack({
      name:'Image Pack', includeCurrentRoom:true, includeRoomTemplates:false, includeRequirementPresets:false,
      includeCustomObjects:false, includeActivityLayouts:false, includeRotationBlueprints:false,
      includeTestingProfiles:false, includeFloorPlanImages:true
    });
    return {
      privacy:pack.privacy,
      dataUrl:pack.contents.roomTemplates[0]?.freeformLayout?.physicalRoom?.background?.dataUrl || '',
      findings:window.PlannerPacksV720.personalDataFindings(pack)
    };
  });
  expect(result.privacy.floorPlanImagesIncluded).toBeTruthy();
  expect(result.dataUrl).toMatch(/^data:image\//);
  expect(result.findings).toEqual([]);
});

test('V7.2 refuses pack files that carry meaningful student or roster data', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const api = window.PlannerPacksV720;
    const base = {
      format:api.format, schemaVersion:1, id:'bad-pack', name:'Bad Pack', revision:'1.0.0',
      privacy:{ studentDataIncluded:false, floorPlanImagesIncluded:false }, contents:{}
    };
    const messages = [];
    for (const payload of [
      { ...base, contents:{ requirementPresets:[{ name:'Pair', requirements:{ minDistanceStudentIds:['student-secret'] } }] } },
      { ...base, id:'bad-pack-2', privacy:{ studentDataIncluded:true, floorPlanImagesIncluded:false }, contents:{} },
      { ...base, id:'bad-pack-3', contents:{ students:[{ id:'student-secret', firstName:'Name' }] } }
    ]) {
      try { api.assertPack(payload, 'Unsafe pack'); messages.push('accepted'); }
      catch (error) { messages.push(String(error.message || error)); }
    }
    return messages;
  });
  expect(result[0]).toMatch(/student|roster/i);
  expect(result[1]).toMatch(/student data/i);
  expect(result[2]).toMatch(/student|roster/i);
  expect(result).not.toContain('accepted');
});

test('V7.2 installed pack library persists in browser storage and updates by stable pack id', async ({ page }) => {
  await ready(page);
  await seedPackClass(page);
  const result = await page.evaluate(async () => {
    const api = window.PlannerPacksV720;
    const pack = api.buildPack({ name:'Persisted Pack', id:'qa-persisted-pack', revision:'1.0.0', includeCurrentRoom:true, includeRoomTemplates:false, includeRequirementPresets:false, includeCustomObjects:false, includeActivityLayouts:false, includeRotationBlueprints:false, includeTestingProfiles:false });
    await api.installPack(pack);
    const firstCount = api.installedPacks().filter(item => item.id === 'qa-persisted-pack').length;
    await api.installPack({ ...pack, revision:'1.1.0', description:'Updated revision' });
    const afterUpdate = api.installedPacks().filter(item => item.id === 'qa-persisted-pack');
    await api.loadLibrary();
    const afterReload = api.installedPacks().filter(item => item.id === 'qa-persisted-pack');
    return { firstCount, afterUpdate, afterReload };
  });
  expect(result.firstCount).toBe(1);
  expect(result.afterUpdate).toHaveLength(1);
  expect(result.afterUpdate[0].revision).toBe('1.1.0');
  expect(result.afterReload).toHaveLength(1);
  expect(result.afterReload[0].description).toBe('Updated revision');
});

test('V7.2 applies reusable content additively without reseating the live classroom', async ({ page }) => {
  await ready(page);
  await seedPackClass(page);
  const result = await page.evaluate(async () => {
    const api = window.PlannerPacksV720;
    const layoutApi = window.ActivityLayoutsV701;
    const beforeAssignments = state.freeformLayout.objects.filter(object => object.type === 'seat').map(object => [object.id, object.assignedStudentId]);
    const beforeActiveLayout = layoutApi.ensureStore({ reconcileActive:true }).activeId;
    const shifted = api.sanitizeActivityLayout({
      id:'pack-layout', name:'Pack Collaboration', preset:'group', description:'Imported arrangement',
      sourceCanvas:{ width:2400, height:1500 }, groups:[],
      objects:state.freeformLayout.objects.filter(object => ['seat','table'].includes(object.type)).map(object => ({ ...object, x:Number(object.x || 0) + (object.type === 'seat' ? 120 : 30) }))
    }, 0, { width:2400, height:1500 });
    const pack = api.normalizePack({
      format:api.format, schemaVersion:1, id:'apply-pack', name:'Apply Pack', revision:'1.0.0', privacy:{ studentDataIncluded:false, floorPlanImagesIncluded:false },
      contents:{
        roomTemplates:[api.sanitizeRoomTemplate({ name:'Pack Room Template', rows:1, cols:3, cells:state.cells, layoutMode:'freeform', freeformLayout:state.freeformLayout, zones:[], customObjects:[] }, 0, { includeFloorPlanImages:false })],
        requirementPresets:[{ name:'Pack Aisle', requirements:{ aisle:true } }],
        customObjects:[{ type:'custom-pack-podium', label:'Pack Podium', width:220, height:110 }],
        activityLayouts:[shifted],
        testingProfiles:[{ name:'Pack Testing', spacing:7, unit:'ft', preserveLocked:true, respectNeeds:true, keepExtraSeatsNearEdges:true }]
      }
    }, { includeFloorPlanImages:true });
    const summary = await api.applyPack(pack, { roomTemplates:true, requirementPresets:true, customObjects:true, activityLayouts:true, rotationBlueprints:false, testingProfiles:true });
    const afterAssignments = state.freeformLayout.objects.filter(object => object.type === 'seat').map(object => [object.id, object.assignedStudentId]);
    const store = layoutApi.ensureStore({ reconcileActive:false });
    return {
      summary,
      beforeAssignments,
      afterAssignments,
      beforeActiveLayout,
      afterActiveLayout:store.activeId,
      roomTemplateNames:state.roomTemplates.map(item => item.name),
      presetNames:state.requirementPresets.map(item => item.name),
      customLabels:state.customObjects.map(item => item.label),
      activityNames:store.layouts.map(item => item.name),
      testing:window.TestingModeV703.ensureStore().lastConfig
    };
  });
  expect(result.afterAssignments).toEqual(result.beforeAssignments);
  expect(result.afterActiveLayout).toBe(result.beforeActiveLayout);
  expect(result.roomTemplateNames).toContain('Pack Room Template');
  expect(result.presetNames).toContain('Pack Aisle');
  expect(result.customLabels).toContain('Pack Podium');
  expect(result.activityNames).toContain('Pack Collaboration');
  expect(result.testing.name).toBe('Pack Testing');
  expect(result.summary.activityLayouts).toBe(1);
});

test('V7.2 blocks incompatible Activity Layout seat counts instead of guessing', async ({ page }) => {
  await ready(page);
  await seedPackClass(page);
  const result = await page.evaluate(() => {
    const api = window.PlannerPacksV720;
    const pack = api.normalizePack({
      format:api.format, schemaVersion:1, id:'mismatch-pack', name:'Mismatch Pack', revision:'1.0.0', privacy:{ studentDataIncluded:false, floorPlanImagesIncluded:false },
      contents:{ activityLayouts:[{ name:'Two Seat Layout', sourceCanvas:{ width:2400, height:1500 }, groups:[], objects:[
        { id:'a', type:'seat', x:100, y:100, width:176, height:112 }, { id:'b', type:'seat', x:400, y:100, width:176, height:112 }
      ] }] }
    }, { includeFloorPlanImages:true });
    return api.previewApply(pack, { roomTemplates:false, requirementPresets:false, customObjects:false, activityLayouts:true, rotationBlueprints:false, testingProfiles:false });
  });
  expect(result.activityLayouts.add).toBe(0);
  expect(result.activityLayouts.blocked.join(' ')).toMatch(/2 seats.*3/i);
});

test('V7.2 rotation blueprints remap by station identity and build teams from the current roster', async ({ page }) => {
  await ready(page);
  await seedPackClass(page);
  const result = await page.evaluate(async () => {
    const api = window.PlannerPacksV720;
    const beforeAssignments = state.freeformLayout.objects.filter(object => object.type === 'seat').map(object => [object.id, object.assignedStudentId]);
    const pack = api.normalizePack({
      format:api.format, schemaVersion:1, id:'rotation-pack', name:'Rotation Pack', revision:'1.0.0', privacy:{ studentDataIncluded:false, floorPlanImagesIncluded:false },
      contents:{ rotationBlueprints:[{
        name:'Imported Literacy', durationMinutes:9, transitionMinutes:1, teamSource:'balanced', teamCount:2,
        stations:[
          { name:'Reading', sourceObjectType:'station', sourceObjectLabel:'Reading', instructions:'Use the reading cards.', order:0 },
          { name:'Writing', sourceObjectType:'station', sourceObjectLabel:'Writing', instructions:'Write one paragraph.', order:1 }
        ]
      }] }
    }, { includeFloorPlanImages:true });
    const match = api.matchRotationStations(pack.contents.rotationBlueprints[0]);
    const summary = await api.applyPack(pack, { roomTemplates:false, requirementPresets:false, customObjects:false, activityLayouts:false, rotationBlueprints:true, testingProfiles:false });
    const plan = window.StationRotationsV702.activePlan();
    const afterAssignments = state.freeformLayout.objects.filter(object => object.type === 'seat').map(object => [object.id, object.assignedStudentId]);
    return { match, summary, plan, beforeAssignments, afterAssignments };
  });
  expect(result.match.complete).toBeTruthy();
  expect(result.match.mappings.map(item => item.confidence)).toEqual(['name','name']);
  expect(result.summary.rotationBlueprints).toBe(1);
  expect(result.plan.name).toMatch(/Imported Literacy/);
  expect(result.plan.stations.map(item => item.instructions)).toEqual(['Use the reading cards.','Write one paragraph.']);
  expect(result.plan.teams.flatMap(team => team.studentIds).sort()).toEqual(['student-a','student-b','student-c']);
  expect(result.afterAssignments).toEqual(result.beforeAssignments);
});

test('V7.2 Planner Packs management UI is responsive and hidden from Presentation mode', async ({ page }) => {
  await ready(page);
  await page.setViewportSize({ width:390, height:844 });
  await page.evaluate(() => window.PlannerPacksV720.open());
  const modal = page.locator('#plannerPacksV720Modal');
  await expect(modal).toHaveClass(/\bshow\b/);
  await expect(page.getByRole('heading', { name:'Planner Packs' })).toBeVisible();
  await expect(page.getByRole('button', { name:/Classroom Essentials/ })).toBeVisible();
  await page.getByRole('tab', { name:'Build a pack' }).click();
  await expect(page.getByText('Student data is structurally excluded.')).toBeVisible();
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await page.evaluate(() => { document.body.classList.add('visibility-mode'); window.PlannerPacksV720.close(); window.PlannerPacksV720.open(); });
  await expect(modal).not.toHaveClass(/\bshow\b/);
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
