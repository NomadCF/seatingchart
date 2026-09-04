import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text, 'utf8'); }
function replace(path, oldText, newText, count = 1) {
  let text = read(path);
  if (!text.includes(oldText)) throw new Error(`Missing expected text in ${path}: ${oldText.slice(0, 100)}`);
  if (count === 1) text = text.replace(oldText, newText);
  else text = text.split(oldText).join(newText);
  write(path, text);
}

replace('src/scripts/000-core.js', "version: '6.8.0',", "version: '6.8.1',");
replace('src/index.template.html', 'name="app-version" content="6.8.0"', 'name="app-version" content="6.8.1"');
replace('package.json', '"version": "6.8.0"', '"version": "6.8.1"');
replace('service-worker.js', 'classroom-seating-planner-v6.8.0-pwa1', 'classroom-seating-planner-v6.8.1-pwa1');
replace('tools/validate-release.mjs', "['V6.8 app version metadata', /name=[\"']app-version[\"']\\s+content=[\"']6\\.8\\.0[\"']/i.test(built)],", "['V6.8.1 app version metadata', /name=[\"']app-version[\"']\\s+content=[\"']6\\.8\\.1[\"']/i.test(built)],");
replace('tools/validate-release.mjs', "['V6.8 smallest-change repair UI present', /previewIntelligenceRepairBtn/.test(built)]", "['V6.8 smallest-change repair UI present', /previewIntelligenceRepairBtn/.test(built)],\n  ['V6.8.1 grouped seating visual system present', /GroupedSeatingVisualsV681/.test(built)],\n  ['V6.8.1 grouped pod renderer present', /v681-pod-halo/.test(built)],\n  ['V6.8.1 print-safe grouped seating styles present', /@media print[\\s\\S]*v681-pod-halo/.test(built)]");

replace('src/manifest.json', '    "027-classroom-intelligence-v68.js",\n    "025-classroom-feature-pack-v66.js"', '    "027-classroom-intelligence-v68.js",\n    "028-grouped-seating-visuals-v681.js",\n    "025-classroom-feature-pack-v66.js"');
replace('src/scripts/025-classroom-feature-pack-v66.js', '    window.ClassroomIntelligenceV68\n', '    window.ClassroomIntelligenceV68,\n    window.GroupedSeatingVisualsV681\n');
replace('src/scripts/025-classroom-feature-pack-v66.js', "document.body.dataset.featurePack = '6.8';", "document.body.dataset.featurePack = '6.8.1';");
replace('src/scripts/000-core.js', 'const PROJECT_FEATURES = [\n', "const PROJECT_FEATURES = [\n  { title: 'Grouped seating visual language', text: 'Freeform tables, pods, seats, presentation views, printed charts, copied chart images, and plan comparisons share a clearer grouped-seating treatment with subtle pod boundaries, deliberate open-seat states, compact status cues, and zoom-aware readability.' },\n");

let changelog = read('CHANGELOG.md');
if (!changelog.includes('## 6.8.1 — 2026-09-04')) {
  const entry = `## 6.8.1 — 2026-09-04\n\n### Grouped seating visual refinement\n\n- Refined Freeform tables and pods so grouped seating reads as a coherent classroom unit rather than unrelated rectangles.\n- Added subtle pod boundaries and labels using existing Freeform group geometry and group colors, with nearby ungrouped seats visually associated to tables without modifying saved seating data.\n- Refined occupied, open, locked, selected, valid, caution, conflict, and temporary-absence seat states while keeping the student name visually dominant.\n- Added cleaner Presentation/Eye-mode treatment that removes secondary seat detail while retaining table and pod context.\n- Preserved grouped seating in print with grayscale-safe boundaries and deliberate open-seat styling.\n- Updated Copy chart as image to render tables, pod boundaries, seats, labels, rotations, open seats, locks, and rule-state cues from the same Freeform geometry.\n- Updated Freeform plan-comparison previews to preserve table/pod relationships and changed-seat highlighting.\n- Added zoom-aware detail reduction and seat-text-scale compatibility without altering drag/drop, swapping, movement, rotation, locking, rule evaluation, undo/redo, or the saved data schema.\n\n`;
  changelog = changelog.replace('# Changelog\n\n', `# Changelog\n\n${entry}`);
  write('CHANGELOG.md', changelog);
}

let readme = read('README.md');
readme = readme.replace('version-6.8.0-', 'version-6.8.1-');
const readmeNote = `### V6.8.1 grouped seating refinement\n\nFreeform tables and pods now read as intentional groups across Room Design, Seat Students, Presentation mode, print, copied chart images, and Freeform plan comparisons. The refinement uses subtle pod boundaries, clearer table surfaces, deliberate open-seat styling, compact state cues, and the existing group colors without changing the saved seating model.\n\n`;
if (!readme.includes('### V6.8.1 grouped seating refinement')) readme = readme.replace('### What makes it different\n', `${readmeNote}### What makes it different\n`);
write('README.md', readme);

let tests = read('tests/browser/smoke.spec.mjs');
if (!tests.includes('V6.8.1 grouped Freeform seating remains coherent')) {
  tests += String.raw`

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

  await page.evaluate(() => document.body.classList.add('visibility-mode'));
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
`;
  write('tests/browser/smoke.spec.mjs', tests);
}

console.log('V6.8.1 release integration source changes prepared.');
