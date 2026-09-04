import fs from 'node:fs';

// Release integration is intentionally deterministic so modular source remains authoritative.
const replace = (file, from, to) => {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes(from)) throw new Error(`${file}: expected text not found: ${from}`);
  text = text.replaceAll(from, to);
  fs.writeFileSync(file, text);
};

replace('package.json', '"version": "6.8.1"', '"version": "6.8.2"');
replace('src/index.template.html', 'content="6.8.1"', 'content="6.8.2"');
replace('src/scripts/000-core.js', "version: '6.8.1'", "version: '6.8.2'");
replace('service-worker.js', 'classroom-seating-planner-v6.8.1-pwa1', 'classroom-seating-planner-v6.8.2-pwa1');
replace('tools/validate-release.mjs', "['V6.8.1 app version metadata', /name=[\"']app-version[\"']\\s+content=[\"']6\\.8\\.1[\"']/i.test(built)]", "['V6.8.2 app version metadata', /name=[\"']app-version[\"']\\s+content=[\"']6\\.8\\.2[\"']/i.test(built)]");
replace('tools/validate-release.mjs', "['V6.8.1 print-safe grouped seating styles present', /@media print[\\s\\S]*v681-pod-halo/.test(built)]", "['V6.8.1 print-safe grouped seating styles present', /@media print[\\s\\S]*v681-pod-halo/.test(built)],\n  ['V6.8.2 physical table renderer present', /PhysicalTablePodsV682/.test(built)],\n  ['V6.8.2 chair cues present', /v682-chair-cue/.test(built)],\n  ['V6.8.2 print-safe physical furniture present', /@media print[\\s\\S]*v682-chair-cue/.test(built)]");

const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
if (!changelog.includes('## 6.8.2')) {
  fs.writeFileSync('CHANGELOG.md', `## 6.8.2 - 2026-09-04\n\n### Physical table and pod seating\n- Refines Freeform table groups so the tabletop is the primary physical object and student seats read as attached positions rather than unrelated floating cards.\n- Adds non-interactive chair cues derived from existing seat/table geometry and rotation without changing the saved seating model.\n- Keeps the clean V6.8.1 student-card language for occupied, Open, locked, selected, valid, caution, conflict, and absence states.\n- Rectangular and round tables receive distinct physical furniture treatment; logical groups without tables retain the softer grouped boundary.\n- Presentation mode, print, mobile, zoom, and seat text scaling preserve the same table/seat relationships.\n- Chair cues never intercept pointer input, preserving drag/drop, swapping, selection, table movement, rotation, locking, rules, undo/redo, and valid-seat previews.\n\n${changelog}`);
}

const smoke = fs.readFileSync('tests/browser/smoke.spec.mjs', 'utf8');
if (!smoke.includes('V6.8.2 physical table pods')) {
  fs.appendFileSync('tests/browser/smoke.spec.mjs', `\n\ntest('V6.8.2 physical table pods keep furniture and seats interactive', async ({ page }) => {\n  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });\n  await completeFreshSecuritySetupIfNeeded(page);\n  await closeAutomaticGettingStartedIfNeeded(page);\n  await page.evaluate(() => {\n    state.layoutMode = 'freeform';\n    state.freeformLayout = { canvas:{ width:900, height:650, zoom:1 }, groups:[{ id:'pod-a', name:'Table A', color:'#7aa68f' }], objects:[\n      { id:'table-a', type:'table', x:300, y:220, width:240, height:150, rotation:0, groupId:'pod-a', label:'Table A' },\n      { id:'seat-a', type:'seat', x:325, y:155, width:88, height:58, rotation:0, groupId:'pod-a', assignedStudentId:null },\n      { id:'seat-b', type:'seat', x:430, y:155, width:88, height:58, rotation:0, groupId:'pod-a', assignedStudentId:null },\n      { id:'seat-c', type:'seat', x:325, y:380, width:88, height:58, rotation:0, groupId:'pod-a', assignedStudentId:null },\n      { id:'seat-d', type:'seat', x:430, y:380, width:88, height:58, rotation:0, groupId:'pod-a', assignedStudentId:null }\n    ]};\n    renderAll();\n  });\n  await expect(page.locator('#seatGrid')).toHaveAttribute('data-v682-physical-tables', '6.8.2');\n  await expect(page.locator('.freeform-object.table.v682-physical-table')).toHaveCount(1);\n  await expect(page.locator('.freeform-object.seat.v682-physical-seat')).toHaveCount(4);\n  await expect(page.locator('.v682-chair-cue')).toHaveCount(4);\n  await expect(page.locator('.v682-chair-cue').first()).toHaveCSS('pointer-events', 'none');\n  await expect(page.locator('.v681-pod-halo.v682-table-association')).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');\n  await page.emulateMedia({ media:'print' });\n  await expect(page.locator('.v682-chair-cue').first()).toHaveCSS('opacity', '1');\n});\n`);
}

console.log('Integrated V6.8.2 release metadata, validation, changelog, and browser coverage.');
