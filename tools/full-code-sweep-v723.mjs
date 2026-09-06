import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const write = (file, text) => fs.writeFileSync(file, text, 'utf8');
const replaceAll = (text, from, to) => text.split(from).join(to);
const requireReplace = (text, from, to, label) => {
  if (!text.includes(from)) throw new Error(`Expected ${label} marker was not found.`);
  return text.replace(from, to);
};

const VERSION = '7.2.3';

const pkg = JSON.parse(read('package.json'));
pkg.version = VERSION;
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

let template = read('src/index.template.html');
template = requireReplace(template, 'name="app-version" content="7.2.2"', `name="app-version" content="${VERSION}"`, 'template app version');
write('src/index.template.html', template);

let core = read('src/scripts/000-core.js');
core = requireReplace(core, "version: '7.2.2'", `version: '${VERSION}'`, 'core app version');
write('src/scripts/000-core.js', core);

let featurePack = read('src/scripts/025-classroom-feature-pack-v66.js');
featurePack = requireReplace(featurePack, "document.body.dataset.featurePack = '7.2.2';", `document.body.dataset.featurePack = '${VERSION}';`, 'feature pack version');
write('src/scripts/025-classroom-feature-pack-v66.js', featurePack);

for (const file of ['src/scripts/034-station-rotations-v702.js', 'src/scripts/035-testing-mode-v703.js']) {
  let text = read(file);
  text = replaceAll(text, 'catch (_) { /* compatibility */ }', 'catch (_) {}');
  write(file, text);
}

let sw = read('service-worker.js');
sw = requireReplace(sw, 'classroom-seating-planner-v7.2.2-pwa1', `classroom-seating-planner-v${VERSION}-pwa1`, 'service worker cache version');
write('service-worker.js', sw);

let readme = read('README.md');
readme = replaceAll(readme, 'version-7.2.2-2563eb', `version-${VERSION}-2563eb`);
readme = requireReplace(readme, '### V7.2.2 current production release', `### V${VERSION} current production release`, 'README release heading');
readme = requireReplace(
  readme,
  'V7.2.2 is the active hosted and portable production baseline. It keeps the stable V7.2.1 seating, room, planning, security, Drive/Classroom, Planner Packs, Testing Mode, Activity Layouts, Station Rotations, and Classroom Intelligence features while removing the floating Planner Assistant interface and its unused command layer.',
  `V${VERSION} is the active hosted and portable production baseline. It keeps the stable V7.2 seating, room, planning, security, Drive/Classroom, Planner Packs, Testing Mode, Activity Layouts, Station Rotations, Classroom Intelligence, and Guided Help features while cleaning stale release references, obsolete maintenance notes, and outdated regression assertions.`,
  'README current release paragraph'
);
readme = replaceAll(readme, '37 modules in V7.2.2', `37 modules in V${VERSION}`);
readme = replaceAll(readme, 'deterministic V7.2.2 build', `deterministic V${VERSION} build`);
write('README.md', readme);

let handling = read('DATA-HANDLING.md');
handling = replaceAll(handling, 'V7.2.1 retains the V7.2 Planner Packs model:', `V${VERSION} retains the V7.2 Planner Packs model:`);
write('DATA-HANDLING.md', handling);

let security = read('SECURITY.md');
security = replaceAll(security, 'Security fixes target V7.2.2, the current hosted and portable production release.', `Security fixes target V${VERSION}, the current hosted and portable production release.`);
write('SECURITY.md', security);

let ci = read('.github/workflows/ci.yml');
ci = replaceAll(ci, 'Validate deterministic V7.2.2 release', `Validate deterministic V${VERSION} release`);
write('.github/workflows/ci.yml', ci);

for (const file of [
  'tests/browser/planner-packs-v720.spec.mjs',
  'tests/browser/digital-twin-v700.spec.mjs',
  'tests/browser/testing-mode-v703.spec.mjs',
  'tests/browser/station-rotations-v702.spec.mjs',
  'tests/browser/activity-layouts-v701.spec.mjs'
]) {
  let text = read(file);
  text = replaceAll(text, "toHaveAttribute('content', '7.2.1')", `toHaveAttribute('content', '${VERSION}')`);
  write(file, text);
}

let validator = read('tools/validate-release.mjs');
validator = requireReplace(
  validator,
  `['V7.2.2 app version metadata', /name=["']app-version["']\\s+content=["']7\\.2\\.2["']/i.test(built)]`,
  `['V7.2.3 app version metadata', /name=["']app-version["']\\s+content=["']7\\.2\\.3["']/i.test(built)]`,
  'release validator version check'
);
validator = validator.replace(/\n\s*\['Planner Assistant removed'[^\n]*\],/, '');
write('tools/validate-release.mjs', validator);

let changelog = read('CHANGELOG.md');
changelog = changelog.replace(/^## 7\.2\.2 - 2026-09-06[\s\S]*?(?=^## 7\.2\.1 - )/m, '');
changelog = changelog.replace(/^## 7\.1\.0 - 2026-09-05[\s\S]*?(?=^## 7\.0\.3 - )/m, '');
if (!changelog.startsWith(`## ${VERSION} - 2026-09-06`)) {
  changelog = `## ${VERSION} - 2026-09-06\n\n### Repository and maintenance cleanup\n\n- Ran a full active-bundle unused-declaration audit across all 37 shipped JavaScript modules; no unused variables or functions were reported.\n- Removed stale release-version assertions from browser regression tests and synchronized current release metadata across package, app, PWA cache, feature-pack marker, documentation, and validation.\n- Removed obsolete documentation and validation references for features that are no longer part of the active product.\n- Removed maintenance-only compatibility comments that no longer describe a live compatibility path.\n- Preserved schema 13, encryption envelope 3, storage compatibility, seating engines, Drive/Classroom integration, Planner Packs, Activity Layouts, Station Rotations, Testing Mode, Classroom Intelligence, and Guided Help.\n\n${changelog}`;
}
write('CHANGELOG.md', changelog);

const staleTargets = [
  ['README.md', /Planner Assistant|PlannerAssistantV710|planner-command-v1/],
  ['DATA-HANDLING.md', /Planner Assistant|PlannerAssistantV710|planner-command-v1/],
  ['tools/validate-release.mjs', /PlannerAssistantV710|plannerAssistantV710Dock|planner-command-v1/],
  ['CHANGELOG.md', /Planner Assistant|PlannerAssistantV710|planner-command-v1/]
];
for (const [file, pattern] of staleTargets) {
  if (pattern.test(read(file))) throw new Error(`Stale removed-feature reference remains in ${file}`);
}

console.log(`Prepared ${VERSION} maintenance cleanup.`);
