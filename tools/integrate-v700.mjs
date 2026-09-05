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
replaceOnce(core, "version: '6.9.0',", "version: '7.0.0',");
replaceOnce(core, "buildDate: '2026-09-04T17:30:00Z',", "buildDate: '2026-09-05T00:35:00Z',");

replaceOnce(core,
`  carpet: '#f5e8d3',\n  ada: '#ecfeff',\n  blocked: '#313846',`,
`  carpet: '#f5e8d3',\n  ada: '#ecfeff',\n  shelf: '#f1e8dc',\n  cabinet: '#e8e5df',\n  lab: '#e5edf5',\n  sink: '#dff3f5',\n  station: '#eee7f7',\n  blocked: '#313846',`);

replaceOnce(core,
`  carpet: 'Carpet',\n  ada: 'ADA Space',\n  seat: 'Seat'`,
`  carpet: 'Carpet',\n  ada: 'ADA Space',\n  shelf: 'Shelf / Bookcase',\n  cabinet: 'Cabinet / Storage',\n  lab: 'Lab Station',\n  sink: 'Sink / Utility',\n  station: 'Activity Station',\n  seat: 'Seat'`);

const physicalHelper = `function normalizePhysicalRoomRecord(value, canvas = {}) {\n  const source = value && typeof value === 'object' ? value : {};\n  const background = source.background && typeof source.background === 'object' ? source.background : {};\n  const unit = source.unit === 'm' ? 'm' : 'ft';\n  const dataUrl = /^data:image\\//i.test(String(background.dataUrl || '')) && String(background.dataUrl || '').length <= 8000000\n    ? String(background.dataUrl)\n    : '';\n  return {\n    enabled: Boolean(source.enabled),\n    unit,\n    width: clampNumber(source.width ?? (unit === 'm' ? 9 : 30), unit === 'm' ? 2 : 6, unit === 'm' ? 100 : 330),\n    height: clampNumber(source.height ?? (unit === 'm' ? 7.3 : 24), unit === 'm' ? 2 : 6, unit === 'm' ? 100 : 330),\n    gridStep: clampNumber(source.gridStep ?? (unit === 'm' ? .5 : 1), unit === 'm' ? .1 : .25, unit === 'm' ? 10 : 20),\n    showGrid: source.showGrid !== false,\n    showRulers: source.showRulers !== false,\n    showObjectMeasurements: source.showObjectMeasurements !== false,\n    background: {\n      dataUrl,\n      name: String(background.name || '').slice(0, 120),\n      visible: background.visible !== false,\n      opacity: clampNumber(background.opacity ?? .42, .05, 1),\n      scalePct: clampNumber(background.scalePct ?? 100, 20, 300),\n      offsetXPct: clampNumber(background.offsetXPct ?? 0, -100, 100),\n      offsetYPct: clampNumber(background.offsetYPct ?? 0, -100, 100),\n      rotation: clampNumber(background.rotation ?? 0, -180, 180),\n      print: Boolean(background.print),\n      locked: background.locked !== false\n    }\n  };\n}\n\n`;

let coreSource = read(core);
if (!coreSource.includes('function normalizePhysicalRoomRecord(')) {
  const marker = 'function normalizeFreeformLayout(layout) {';
  if (!coreSource.includes(marker)) throw new Error('000-core.js: normalizeFreeformLayout marker missing');
  coreSource = coreSource.replace(marker, physicalHelper + marker);
  write(core, coreSource);
}

replaceOnce(core,
`  return {\n    initialized: source.initialized === true || objects.length > 0,\n    canvas: {`,
`  return {\n    initialized: source.initialized === true || objects.length > 0,\n    physicalRoom: normalizePhysicalRoomRecord(source.physicalRoom, canvas),\n    canvas: {`);

replaceOnce(core,
`const PROJECT_FEATURES = [\n`,
`const PROJECT_FEATURES = [\n  { title: 'Classroom Digital Twin', text: 'Give Freeform rooms real dimensions, use scaled grids and rulers, align a floor-plan reference image, measure physical distances, and add fixed classroom furniture while preserving existing seating assignments and Freeform interactions.' },\n`);

const manifest = 'src/manifest.json';
replaceOnce(manifest,
`    "031-interoperability-ui-bridge-v69.js",\n    "025-classroom-feature-pack-v66.js",`,
`    "031-interoperability-ui-bridge-v69.js",\n    "032-digital-twin-v700.js",\n    "025-classroom-feature-pack-v66.js",`);

const template = 'src/index.template.html';
replaceOnce(template, '<meta name="app-version" content="6.9.0" />', '<meta name="app-version" content="7.0.0" />');
replaceOnce(template, '<meta name="build-date" content="2026-09-04T17:30:00Z" />', '<meta name="build-date" content="2026-09-05T00:35:00Z" />');

const pkg = 'package.json';
replaceOnce(pkg, '"version": "6.9.0"', '"version": "7.0.0"');

const sw = 'service-worker.js';
replaceOnce(sw, "const CACHE_VERSION = 'classroom-seating-planner-v6.9.0-pwa1';", "const CACHE_VERSION = 'classroom-seating-planner-v7.0.0-pwa1';");

const readme = 'README.md';
replaceOnce(readme, '![Version](https://img.shields.io/badge/version-6.8.1-2563eb?style=flat-square)', '![Version](https://img.shields.io/badge/version-7.0.0-2563eb?style=flat-square)');
let readmeSource = read(readme);
const digitalTwinSection = `### V7.0 Classroom Digital Twin foundation\n\nFreeform rooms can now carry real physical dimensions without invalidating older layouts. Turn on a scaled grid and rulers, show physical measurements on room objects, measure distances between two objects, add fixed furniture such as shelves, cabinets, lab stations, sinks, and activity stations, and place a classroom photo or floor plan underneath the existing layout as a locked reference layer. The floor-plan image is optimized in the browser before it is stored with the class, and inclusion in printed charts is explicit.\n\n`;
if (!readmeSource.includes('### V7.0 Classroom Digital Twin foundation')) {
  const anchor = '### V6.8.1 grouped seating refinement\n\n';
  if (!readmeSource.includes(anchor)) throw new Error('README.md: grouped seating section anchor missing');
  readmeSource = readmeSource.replace(anchor, digitalTwinSection + anchor);
  write(readme, readmeSource);
}

prependOnce('CHANGELOG.md', '## 7.0.0 - 2026-09-04', `## 7.0.0 - 2026-09-04\n\n### Classroom Digital Twin foundation\n- Added optional real-world room dimensions to Freeform layouts while leaving legacy/unscaled rooms fully valid.\n- Added scaled room grid and rulers with feet/meters support and configurable physical grid spacing.\n- Added physical width/height labels for Freeform room objects plus a two-object distance measurement tool.\n- Added floor-plan/photo background import with in-browser optimization, opacity, scale, offset, rotation, visibility, and explicit print inclusion.\n- Added fixed classroom object types for shelves/bookcases, cabinets/storage, lab stations, sinks/utilities, and activity stations using the existing Freeform object model.\n- Kept drag/drop, rotation, resizing, groups, seating rules, Presentation mode, print, mobile panning, zoom, and the single-file deterministic build intact.\n- Physical-room metadata is additive inside Freeform layout data; planner data schema remains 13 and encryption envelope remains 3.\n\n`);

console.log('Integrated V7.0.0 Classroom Digital Twin foundation source changes.');
