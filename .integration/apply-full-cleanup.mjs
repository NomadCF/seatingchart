import fs from 'node:fs';

function edit(path, transforms) {
  let text = fs.readFileSync(path, 'utf8');
  for (const transform of transforms) {
    const before = text;
    text = typeof transform === 'function' ? transform(text) : text.replace(transform[0], transform[1]);
    if (text === before) throw new Error(`Expected cleanup transform did not match in ${path}`);
  }
  fs.writeFileSync(path, text, 'utf8');
}

function replaceAllChecked(text, search, replacement, expectedMinimum = 1) {
  const count = text.split(search).length - 1;
  if (count < expectedMinimum) throw new Error(`Expected at least ${expectedMinimum} occurrences of ${search}, found ${count}`);
  return text.split(search).join(replacement);
}

function removeDeadModalCompatibility(text) {
  let changed = 0;
  text = text.replace(/if \(typeof openModalById === 'function'\) openModalById\(([^)]+)\);\n\s*else (node|modal)\.classList\.add\('show'\);/g, (_match, _id, target) => {
    changed += 1;
    return `${target}.classList.add('show');`;
  });
  text = text.replace(/if \(typeof closeModalById === 'function'\) closeModalById\(([^)]+)\);\n\s*else (node|modal)\.classList\.remove\('show'\);/g, (_match, _id, target) => {
    changed += 1;
    return `${target}.classList.remove('show');`;
  });
  if (!changed) throw new Error('Expected dead modal compatibility branch was not found.');
  return text;
}

// Core: remove an unused normalization parameter and its stale call argument.
edit('src/scripts/000-core.js', [
  ['function normalizePhysicalRoomRecord(value, canvas = {}) {', 'function normalizePhysicalRoomRecord(value) {'],
  ['physicalRoom: normalizePhysicalRoomRecord(source.physicalRoom, canvas),', 'physicalRoom: normalizePhysicalRoomRecord(source.physicalRoom),']
]);

// Interoperability: remove a dead helper and use the real autosave scheduler.
edit('src/scripts/030-interoperability-v69.js', [
  ["\n  function groupCounts(groups) {\n    return list(groups).reduce((sum, group) => sum + group.memberExternalIds.length, 0);\n  }\n", '\n'],
  ["if (typeof linkedSaveAutosave === 'function') void linkedSaveAutosave('roster-interoperability');", "if (typeof scheduleLinkedAutoSave === 'function') scheduleLinkedAutoSave('roster-interoperability');"]
]);

// Digital Twin: correct stale scheduler/layout-mode names and remove nonexistent modal API branches.
edit('src/scripts/032-digital-twin-v700.js', [
  ["try { scheduleLinkedFileAutosave?.(reason); } catch (_) { /* linked save may not exist */ }", "try { scheduleLinkedAutoSave?.(reason); } catch (_) { /* autosave integration is optional */ }"],
  ["setLayoutMode?.('freeform');", "switchLayoutMode?.('freeform');"],
  removeDeadModalCompatibility
]);

// Activity Layouts, Station Rotations, and Testing Mode already call the canonical scheduler; remove the dead duplicate compatibility call.
edit('src/scripts/033-activity-layouts-v701.js', [
  ["    try { scheduleLinkedFileAutosave?.(reason); } catch (_) { /* compatibility with newer save helper */ }\n", ''],
  removeDeadModalCompatibility
]);
edit('src/scripts/034-station-rotations-v702.js', [
  ["    try { scheduleLinkedFileAutosave?.(reason); } catch (_) { /* optional */ }\n", ''],
  removeDeadModalCompatibility
]);
edit('src/scripts/035-testing-mode-v703.js', [
  ["    try { scheduleLinkedFileAutosave?.(reason); } catch (_) { /* optional */ }\n", ''],
  removeDeadModalCompatibility,
  ['function needIssuesFor(seats, config, layout, roomMetrics) {', 'function needIssuesFor(seats, config, layout) {'],
  ['needIssuesFor(proposedPrimary, config, layout, roomMetrics)', 'needIssuesFor(proposedPrimary, config, layout)']
]);

// Planner Assistant: remove a dead boolean parameter and nonexistent modal compatibility API.
edit('src/scripts/036-planner-assistant-v710.js', [
  ['function applyRuleChangesInMemory(preview, normalize = true) {', 'function applyRuleChangesInMemory(preview) {'],
  ['applyRuleChangesInMemory(preview, true);', 'applyRuleChangesInMemory(preview);'],
  removeDeadModalCompatibility
]);

// Planner Packs: canonical autosave, current modal behavior, and remove an unused import count.
edit('src/scripts/037-planner-packs-v720.js', [
  ["try { if (typeof scheduleLinkedFileAutosave === 'function') scheduleLinkedFileAutosave('planner-pack-apply'); } catch (_) { /* optional */ }", "try { if (typeof scheduleLinkedAutoSave === 'function') scheduleLinkedAutoSave('planner-pack-apply'); } catch (_) { /* autosave integration is optional */ }"],
  removeDeadModalCompatibility,
  ['    const counts = packCounts(importDraft);\n', '']
]);

// Google Picker: use the explicit browser global instead of relying on an implicit global binding.
edit('src/scripts/017-district-integrations-v57.js', [
  text => replaceAllChecked(text, 'google.picker', 'window.google.picker', 8)
]);

// README architecture text had fossilized at V6.8.
edit('README.md', [
  ['- Ordered JavaScript modules: `src/scripts/` (28 modules in V6.8)', '- Ordered JavaScript modules: `src/scripts/` (38 modules in V7.2)']
]);

// Keep the accessibility audit useful without claiming the browser suite is frozen at V6.7.
edit('docs/WCAG-2.2-AA-AUDIT.md', [
  ['The V6.7 browser smoke suite verifies that the application boots without uncaught runtime errors, core controls remain addressable, hosted PWA files are reachable, and desktop/mobile layouts do not create page-level horizontal overflow.', 'The current browser regression suite verifies that the application boots without uncaught runtime errors, core controls remain addressable, hosted PWA files are reachable, and desktop/mobile layouts do not create page-level horizontal overflow.']
]);

// The V6.7 implementation plan described completed work and no longer represents the current codebase.
if (fs.existsSync('docs/IMPLEMENTATION_PLAN.md')) fs.rmSync('docs/IMPLEMENTATION_PLAN.md');

console.log('Targeted full-code cleanup transformations applied.');
