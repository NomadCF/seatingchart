import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const write = (file, value) => fs.writeFileSync(file, value);

function replaceOnce(file, from, to, label = from) {
  let source = read(file);
  if (source.includes(to)) return false;
  if (!source.includes(from)) throw new Error(`${file}: expected fragment missing for ${label}`);
  source = source.replace(from, to);
  write(file, source);
  return true;
}

function prependOnce(file, marker, block) {
  let source = read(file);
  if (source.includes(marker)) return false;
  write(file, `${block}${source}`);
  return true;
}

const core = 'src/scripts/000-core.js';
replaceOnce(core, "version: '7.0.1',", "version: '7.0.2',", 'app version');
replaceOnce(core, "buildDate: '2026-09-05T01:15:00Z',", "buildDate: '2026-09-05T02:35:00Z',", 'build date');
replaceOnce(
  core,
  `    activityLayouts: source.activityLayouts && typeof source.activityLayouts === 'object' ? deepClone(source.activityLayouts) : null,\n    canvas: {`,
  `    activityLayouts: source.activityLayouts && typeof source.activityLayouts === 'object' ? deepClone(source.activityLayouts) : null,\n    stationRotations: source.stationRotations && typeof source.stationRotations === 'object' ? deepClone(source.stationRotations) : null,\n    canvas: {`,
  'station rotation persistence'
);
replaceOnce(
  core,
  `const PROJECT_FEATURES = [\n  { title: 'Activity Layouts',`,
  `const PROJECT_FEATURES = [\n  { title: 'Station Rotations', text: 'Build timed classroom station rounds over the existing Digital Twin, use Activity Stations, Lab Stations, or tables as destinations, create explicit rotation teams from the active roster, and advance rounds without changing seat assignments.' },\n  { title: 'Activity Layouts',`,
  'project feature list'
);

replaceOnce(
  'src/manifest.json',
  `    "033-activity-layouts-v701.js",\n    "025-classroom-feature-pack-v66.js",`,
  `    "033-activity-layouts-v701.js",\n    "034-station-rotations-v702.js",\n    "025-classroom-feature-pack-v66.js",`,
  'manifest module order'
);

replaceOnce('src/index.template.html', '<meta name="app-version" content="7.0.1" />', '<meta name="app-version" content="7.0.2" />', 'template version');
replaceOnce('src/index.template.html', '<meta name="build-date" content="2026-09-05T01:15:00Z" />', '<meta name="build-date" content="2026-09-05T02:35:00Z" />', 'template build date');
replaceOnce('package.json', '"version": "7.0.1"', '"version": "7.0.2"', 'package version');
replaceOnce('service-worker.js', "const CACHE_VERSION = 'classroom-seating-planner-v7.0.1-pwa1';", "const CACHE_VERSION = 'classroom-seating-planner-v7.0.2-pwa1';", 'service worker cache');

replaceOnce(
  'src/scripts/025-classroom-feature-pack-v66.js',
  `    window.ClassroomDigitalTwinV700,\n    window.ActivityLayoutsV701\n  ].filter(Boolean);`,
  `    window.ClassroomDigitalTwinV700,\n    window.ActivityLayoutsV701,\n    window.StationRotationsV702\n  ].filter(Boolean);`,
  'feature pack module registration'
);
replaceOnce(
  'src/scripts/025-classroom-feature-pack-v66.js',
  `    document.body.dataset.featurePack = '7.0.1';`,
  `    document.body.dataset.featurePack = '7.0.2';`,
  'feature pack version'
);

replaceOnce(
  'README.md',
  '![Version](https://img.shields.io/badge/version-7.0.1-2563eb?style=flat-square)',
  '![Version](https://img.shields.io/badge/version-7.0.2-2563eb?style=flat-square)',
  'README badge'
);
let readme = read('README.md');
const section = `### V7.0.2 Station Rotations\n\nBuild lesson rotations directly on the Classroom Digital Twin without changing the seating chart. Rotation plans can use existing Activity Stations, Lab Stations, or tables as destinations; create size-balanced teams from the active roster or seed teams from classroom groups; exclude Today Mode absences when rebuilding; link a rotation to the Activity Layout it was designed for; run per-station and transition timers; move forward or backward through explicit rounds; and show each station's current team directly on the Freeform room. Rotation plans never silently reseat students and the balancing option uses roster order and team size only, not hidden behavior scoring.\n\n`;
if (!readme.includes('### V7.0.2 Station Rotations')) {
  const anchor = '### V7.0.1 Activity Layouts\n\n';
  if (!readme.includes(anchor)) throw new Error('README.md: V7.0.1 anchor missing');
  readme = readme.replace(anchor, section + anchor);
  write('README.md', readme);
}

prependOnce('CHANGELOG.md', '## 7.0.2 - 2026-09-04', `## 7.0.2 - 2026-09-04\n\n### Station Rotations\n- Added station-rotation plans that run on top of the existing Freeform Classroom Digital Twin without changing seat assignments.\n- Activity Stations, Lab Stations, and tables can be selected as explicit rotation destinations.\n- Added size-balanced rotation teams from the active roster plus an option to seed teams from existing classroom groups; each student is assigned to at most one rotation team.\n- Today Mode absences are excluded whenever rotation teams are created or rebuilt.\n- Added deterministic round schedules, previous/next round controls, per-station timers, optional transition timers, and visible team-at-station badges on the room.\n- Rotation plans remember the Activity Layout they were created for and can switch back to that arrangement explicitly when the current room arrangement differs.\n- Added create, select, duplicate, rename, delete, rebuild-team, and saved-plan management with responsive desktop/mobile UI.\n- Station rotation metadata is additive inside Freeform layout data; planner data schema remains 13 and encryption envelope remains 3.\n\n`);

replaceOnce(
  'tools/validate-release.mjs',
  `  ['V7.0.1 app version metadata', /name=["']app-version["']\\s+content=["']7\\.0\\.1["']/i.test(built)],`,
  `  ['V7.0.2 app version metadata', /name=["']app-version["']\\s+content=["']7\\.0\\.2["']/i.test(built)],`,
  'validator app version'
);
replaceOnce(
  'tools/validate-release.mjs',
  `  ['V7.0.1 arrangement comparison present', /openComparison/.test(built) && /v701-compare-grid/.test(built)]\n];`,
  `  ['V7.0.1 arrangement comparison present', /openComparison/.test(built) && /v701-compare-grid/.test(built)],\n  ['V7.0.2 Station Rotations engine present', /StationRotationsV702/.test(built)],\n  ['V7.0.2 station rotation persistence present', /stationRotations: source\\.stationRotations/.test(built)],\n  ['V7.0.2 rotation round engine present', /roundAssignments/.test(built) && /startTransition/.test(built)],\n  ['V7.0.2 station overlay present', /v702-station-overlay/.test(built)],\n  ['V7.0.2 Today Mode roster integration present', /typeof seatingStudents === 'function'/.test(built)]\n];`,
  'validator station rotation checks'
);

for (const file of ['tests/browser/digital-twin-v700.spec.mjs', 'tests/browser/activity-layouts-v701.spec.mjs']) {
  replaceOnce(file, "toHaveAttribute('content', '7.0.1')", "toHaveAttribute('content', '7.0.2')", `${file} expected version`);
}

console.log('Integrated V7.0.2 Station Rotations release source changes.');
