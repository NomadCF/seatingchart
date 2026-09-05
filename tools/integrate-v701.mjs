import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const write = (file, value) => fs.writeFileSync(file, value);

function replaceOnce(file, from, to) {
  let source = read(file);
  if (source.includes(to)) return false;
  if (!source.includes(from)) throw new Error(`${file}: expected fragment not found`);
  source = source.replace(from, to);
  write(file, source);
  return true;
}

function prependOnce(file, marker, block) {
  let source = read(file);
  if (source.includes(marker)) return false;
  source = `${block}${source}`;
  write(file, source);
  return true;
}

const core = 'src/scripts/000-core.js';
replaceOnce(core, "version: '7.0.0',", "version: '7.0.1',");
replaceOnce(core, "buildDate: '2026-09-05T00:35:00Z',", "buildDate: '2026-09-05T01:15:00Z',");
replaceOnce(
  core,
  `    physicalRoom: normalizePhysicalRoomRecord(source.physicalRoom, canvas),\n    canvas: {`,
  `    physicalRoom: normalizePhysicalRoomRecord(source.physicalRoom, canvas),\n    activityLayouts: source.activityLayouts && typeof source.activityLayouts === 'object' ? deepClone(source.activityLayouts) : null,\n    canvas: {`
);
replaceOnce(
  core,
  `const PROJECT_FEATURES = [\n  { title: 'Classroom Digital Twin',`,
  `const PROJECT_FEATURES = [\n  { title: 'Activity Layouts', text: 'Keep multiple named Freeform room arrangements for different lesson formats, switch without changing the shared physical room, duplicate or reflow arrangements from six classroom starters, and compare movement visually before resetting the room.' },\n  { title: 'Classroom Digital Twin',`
);

replaceOnce(
  'src/manifest.json',
  `    "032-digital-twin-v700.js",\n    "025-classroom-feature-pack-v66.js",`,
  `    "032-digital-twin-v700.js",\n    "033-activity-layouts-v701.js",\n    "025-classroom-feature-pack-v66.js",`
);

replaceOnce('src/index.template.html', '<meta name="app-version" content="7.0.0" />', '<meta name="app-version" content="7.0.1" />');
replaceOnce('src/index.template.html', '<meta name="build-date" content="2026-09-05T00:35:00Z" />', '<meta name="build-date" content="2026-09-05T01:15:00Z" />');
replaceOnce('package.json', '"version": "7.0.0"', '"version": "7.0.1"');
replaceOnce('service-worker.js', "const CACHE_VERSION = 'classroom-seating-planner-v7.0.0-pwa1';", "const CACHE_VERSION = 'classroom-seating-planner-v7.0.1-pwa1';");

replaceOnce(
  'src/scripts/025-classroom-feature-pack-v66.js',
  `    window.InteroperabilityV69,\n    window.ClassroomDigitalTwinV700\n  ].filter(Boolean);`,
  `    window.InteroperabilityV69,\n    window.ClassroomDigitalTwinV700,\n    window.ActivityLayoutsV701\n  ].filter(Boolean);`
);
replaceOnce(
  'src/scripts/025-classroom-feature-pack-v66.js',
  `    document.body.dataset.featurePack = '7.0.0';`,
  `    document.body.dataset.featurePack = '7.0.1';`
);

replaceOnce(
  'README.md',
  '![Version](https://img.shields.io/badge/version-7.0.0-2563eb?style=flat-square)',
  '![Version](https://img.shields.io/badge/version-7.0.1-2563eb?style=flat-square)'
);
let readme = read('README.md');
const activitySection = `### V7.0.1 Activity Layouts\n\nA single Freeform classroom can now keep multiple named teaching arrangements while sharing the same physical room dimensions, floor-plan background, and fixed room features. Create Direct Instruction, Group Work, Discussion Circle, Lab / Stations, Independent Work, or Testing starters; fine-tune each arrangement with the normal Freeform tools; switch layouts without intentionally changing matching student assignments; duplicate and rename arrangements; and compare two layouts side by side before moving furniture.\n\n`;
if (!readme.includes('### V7.0.1 Activity Layouts')) {
  const anchor = '### V7.0 Classroom Digital Twin foundation\n\n';
  if (!readme.includes(anchor)) throw new Error('README.md: V7.0 section anchor missing');
  readme = readme.replace(anchor, activitySection + anchor);
  write('README.md', readme);
}

prependOnce('CHANGELOG.md', '## 7.0.1 - 2026-09-04', `## 7.0.1 - 2026-09-04\n\n### Activity Layouts\n- Added multiple named Freeform arrangements inside one classroom while keeping physical room dimensions, floor-plan backgrounds, and fixed room features shared.\n- Added six starter arrangements: Direct Instruction, Group Work, Discussion Circle, Lab / Stations, Independent Work, and Testing.\n- Added quick switching, duplication, rename, delete, and explicit save-current-geometry actions.\n- Matching Freeform seat assignments and lock state carry across arrangement switches so room changes do not silently reseat students.\n- Added visual side-by-side arrangement comparison with moved/added/removed object counts and physical movement totals when room scale is enabled.\n- Added responsive desktop/mobile controls and kept Presentation mode and print output free of arrangement-management UI.\n- Activity-layout metadata is additive inside Freeform layout data; planner data schema remains 13 and encryption envelope remains 3.\n\n`);

replaceOnce(
  'tools/validate-release.mjs',
  `  ['V7.0.0 app version metadata', /name=["']app-version["']\\s+content=["']7\\.0\\.0["']/i.test(built)],`,
  `  ['V7.0.1 app version metadata', /name=["']app-version["']\\s+content=["']7\\.0\\.1["']/i.test(built)],`
);
replaceOnce(
  'tools/validate-release.mjs',
  `  ['V7.0 fixed furniture object types present', /Shelf \\/ Bookcase/.test(built) && /Lab Station/.test(built) && /Activity Station/.test(built)]\n];`,
  `  ['V7.0 fixed furniture object types present', /Shelf \\/ Bookcase/.test(built) && /Lab Station/.test(built) && /Activity Station/.test(built)],\n  ['V7.0.1 Activity Layouts engine present', /ActivityLayoutsV701/.test(built)],\n  ['V7.0.1 Activity Layouts persistence present', /activityLayouts: source\\.activityLayouts/.test(built)],\n  ['V7.0.1 classroom arrangement starters present', /Direct Instruction/.test(built) && /Group Work/.test(built) && /Discussion Circle/.test(built) && /Testing/.test(built)],\n  ['V7.0.1 arrangement comparison present', /openComparison/.test(built) && /v701-compare-grid/.test(built)]\n];`
);

replaceOnce(
  'tests/browser/digital-twin-v700.spec.mjs',
  `  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', '7.0.0');`,
  `  await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', '7.0.1');`
);

console.log('Integrated V7.0.1 Activity Layouts release source changes.');
