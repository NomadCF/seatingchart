import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value);

function replaceOnce(file, from, to) {
  let source = read(file);
  if (source.includes(to)) return false;
  if (!source.includes(from)) throw new Error(`${file}: expected fragment not found: ${from.slice(0, 100)}`);
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

replaceOnce('src/scripts/000-core.js', "version: '7.0.3',", "version: '7.1.0',");
replaceOnce('src/scripts/000-core.js', "releaseDate: '2026-09-04',", "releaseDate: '2026-09-05',");
replaceOnce('src/scripts/000-core.js', "releaseDateDisplay: 'September 4, 2026',", "releaseDateDisplay: 'September 5, 2026',");
replaceOnce('src/scripts/000-core.js', "buildDate: '2026-09-05T03:20:00Z',", "buildDate: '2026-09-05T10:40:00Z',");
replaceOnce(
  'src/scripts/000-core.js',
  "const PROJECT_FEATURES = [\n  { title: 'Testing Mode',",
  "const PROJECT_FEATURES = [\n  { title: 'Planner Assistant', text: 'Translate teacher requests into explicit existing planner actions with a local deterministic interpreter, show student-name ambiguity instead of guessing, preview rule and seating impact before applying, explain current placements and conflicts from real planner findings, and keep a small browser-local command history.' },\n  { title: 'Testing Mode',"
);

replaceOnce(
  'src/manifest.json',
  '    "035-testing-mode-v703.js",\n    "025-classroom-feature-pack-v66.js",',
  '    "035-testing-mode-v703.js",\n    "036-planner-assistant-v710.js",\n    "025-classroom-feature-pack-v66.js",'
);

replaceOnce(
  'src/scripts/025-classroom-feature-pack-v66.js',
  '    window.StationRotationsV702,\n    window.TestingModeV703\n  ].filter(Boolean);',
  '    window.StationRotationsV702,\n    window.TestingModeV703,\n    window.PlannerAssistantV710\n  ].filter(Boolean);'
);
replaceOnce('src/scripts/025-classroom-feature-pack-v66.js', "document.body.dataset.featurePack = '7.0.3';", "document.body.dataset.featurePack = '7.1.0';");

replaceOnce('src/index.template.html', '<meta name="app-version" content="7.0.3" />', '<meta name="app-version" content="7.1.0" />');
replaceOnce('src/index.template.html', '<meta name="build-date" content="2026-09-05T03:20:00Z" />', '<meta name="build-date" content="2026-09-05T10:40:00Z" />');
replaceOnce('package.json', '"version": "7.0.3"', '"version": "7.1.0"');
replaceOnce('service-worker.js', "const CACHE_VERSION = 'classroom-seating-planner-v7.0.3-pwa1';", "const CACHE_VERSION = 'classroom-seating-planner-v7.1.0-pwa1';");

let readme = read('README.md');
readme = readme.replace('![Version](https://img.shields.io/badge/version-7.0.3-2563eb?style=flat-square)', '![Version](https://img.shields.io/badge/version-7.1.0-2563eb?style=flat-square)');
if (!readme.includes('### V7.1.0 Planner Assistant')) {
  const anchor = '### V7.0.3 Testing Mode\n\n';
  if (!readme.includes(anchor)) throw new Error('README.md: Testing Mode section anchor missing');
  const section = `### V7.1.0 Planner Assistant\n\nUse a browser-local command bar to describe classroom planning intent in ordinary language and translate it into explicit existing planner actions. V7.1.0 can show valid seats, explain a student's current placement, rank concrete conflict causes, add visible student requirements, create together/apart rules, open Station Rotations, switch Activity Layouts, request Testing Mode spacing, and launch Classroom Intelligence repair previews. Every mutating request shows its interpreted operations and impact before Apply, ambiguous student names are presented instead of guessed, and the interpreter makes no external AI/network call. Recent commands are stored only in this browser for the current class and can be cleared from the assistant.\n\n`;
  readme = readme.replace(anchor, section + anchor);
}
write('README.md', readme);

prependOnce('CHANGELOG.md', '## 7.1.0 - 2026-09-05', `## 7.1.0 - 2026-09-05\n\n### Planner Assistant\n- Added a browser-local deterministic Planner Assistant command bar available throughout the normal planning workflow.\n- Natural-language classroom requests translate into explicit existing planner actions instead of hidden AI-owned rules.\n- Added non-destructive interpretation and impact previews before mutating requirements, pair rules, group rules, or Activity Layout selection.\n- Added student-name ambiguity detection; multiple matches are shown and the assistant refuses to guess.\n- Added commands for valid-seat guidance, student-placement explanations, conflict-cause summaries, individual seating requirements, together/apart rules, Testing Mode previews, Station Rotations, Activity Layout switching, and Classroom Intelligence repair previews.\n- Mutating assistant actions enter the existing undo path and use normal class persistence/autosave.\n- Added a small per-class browser-local command history with explicit clear control; history is not part of planner save/export data.\n- Added public planner command preview schema at schemas/planner-command-v1.schema.json for future optional interpreters/providers to target the same explicit action contract.\n- Added responsive desktop/mobile regression coverage and kept the assistant out of Presentation mode and print output.\n- Planner data schema remains 13 and encryption envelope remains 3.\n\n`);

let handling = read('DATA-HANDLING.md');
if (!handling.includes('## Planner Assistant command history')) {
  handling += `\n\n## Planner Assistant command history\n\nV7.1.0 stores up to 20 recent Planner Assistant commands per class in browser local storage so a teacher can rerun a request. Command text may contain student names or classroom details. This history stays on the current browser, is not added to planner save files or exports, is not sent to an external AI service by the built-in interpreter, and can be cleared from the Planner Assistant. Clearing browser data also removes it.\n`;
  write('DATA-HANDLING.md', handling);
}

replaceOnce(
  'tools/validate-release.mjs',
  "  'schemas/roster-import-v1.schema.json'\n]) {",
  "  'schemas/roster-import-v1.schema.json',\n  'schemas/planner-command-v1.schema.json'\n]) {"
);
replaceOnce(
  'tools/validate-release.mjs',
  "  ['V7.0.3 app version metadata', /name=[\"']app-version[\"']\\s+content=[\"']7\\.0\\.3[\"']/i.test(built)],",
  "  ['V7.1.0 app version metadata', /name=[\"']app-version[\"']\\s+content=[\"']7\\.1\\.0[\"']/i.test(built)],"
);
replaceOnce(
  'tools/validate-release.mjs',
  "  ['V7.0.3 non-interactive preview overlay present', /v703-testing-preview/.test(built)]\n];",
  "  ['V7.0.3 non-interactive preview overlay present', /v703-testing-preview/.test(built)],\n  ['V7.1 Planner Assistant engine present', /PlannerAssistantV710/.test(built)],\n  ['V7.1 public planner command contract present', /classroom-seating-planner-command-v1/.test(built)],\n  ['V7.1 explicit preview and apply UI present', /plannerAssistantV710PreviewBtn/.test(built) && /plannerAssistantV710ApplyBtn/.test(built)],\n  ['V7.1 ambiguity guard present', /Student name needs clarification/.test(built)],\n  ['V7.1 no external AI provider dependency', !/openai\\.com\\/v1|anthropic\\.com\\/v1|generativelanguage\\.googleapis\\.com/.test(built)]\n];"
);

for (const file of fs.readdirSync(path.join(root, 'tests', 'browser')).filter(name => name.endsWith('.mjs'))) {
  const full = path.join(root, 'tests', 'browser', file);
  let source = fs.readFileSync(full, 'utf8');
  source = source.replaceAll("toHaveAttribute('content', '7.0.3')", "toHaveAttribute('content', '7.1.0')");
  source = source.replaceAll('toHaveAttribute("content", "7.0.3")', 'toHaveAttribute("content", "7.1.0")');
  fs.writeFileSync(full, source);
}

console.log('Integrated V7.1.0 Planner Assistant release source changes.');
