import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const write = (file, text) => fs.writeFileSync(file, text, 'utf8');
const replaceAll = (text, from, to) => text.split(from).join(to);

// Remove the Assistant module from the ordered application bundle.
const manifestPath = 'src/manifest.json';
const manifest = JSON.parse(read(manifestPath));
manifest.scriptFiles = manifest.scriptFiles.filter(file => file !== '036-planner-assistant-v710.js');
write(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// Version the behavioral removal as a patch release.
const pkg = JSON.parse(read('package.json'));
pkg.version = '7.2.2';
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

let template = read('src/index.template.html');
template = template.replace('name="app-version" content="7.2.1"', 'name="app-version" content="7.2.2"');
write('src/index.template.html', template);

let core = read('src/scripts/000-core.js');
core = core.replace("version: '7.2.1'", "version: '7.2.2'");
core = core.replace("releaseDate: '2026-09-05'", "releaseDate: '2026-09-06'");
core = core.replace("releaseDateDisplay: 'September 5, 2026'", "releaseDateDisplay: 'September 6, 2026'");
const featureLine = "  { title: 'Planner Assistant', text: 'Translate teacher requests into explicit existing planner actions with a local deterministic interpreter, show student-name ambiguity instead of guessing, preview rule and seating impact before applying, explain current placements and conflicts from real planner findings, and keep a small browser-local command history.' },\n";
core = core.replace(featureLine, '');
write('src/scripts/000-core.js', core);

let featurePack = read('src/scripts/025-classroom-feature-pack-v66.js');
featurePack = featurePack.replace('    window.PlannerAssistantV710,\n', '');
featurePack = featurePack.replace("document.body.dataset.featurePack = '7.2.1';", "document.body.dataset.featurePack = '7.2.2';");
write('src/scripts/025-classroom-feature-pack-v66.js', featurePack);

let sw = read('service-worker.js');
sw = sw.replace('classroom-seating-planner-v7.2.1-pwa1', 'classroom-seating-planner-v7.2.2-pwa1');
write('service-worker.js', sw);

let readme = read('README.md');
readme = readme.replace('version-7.2.1-2563eb', 'version-7.2.2-2563eb');
readme = readme.replace('### V7.2.1 current production release', '### V7.2.2 current production release');
readme = readme.replace('V7.2.1 is the active hosted and portable production baseline. It keeps the V7.2 Planner Packs feature set and adds the completed code-audit/UI-repair pass, including autosave path repairs, Digital Twin Freeform-mode repair, current Google Picker/Classroom globals, cleaned modal compatibility code, refreshed documentation, and a regenerated portable build. This is the last 7.x baseline with a recorded full desktop/mobile regression pass before later experimental work was archived.', 'V7.2.2 is the active hosted and portable production baseline. It keeps the stable V7.2.1 seating, room, planning, security, Drive/Classroom, Planner Packs, Testing Mode, Activity Layouts, Station Rotations, and Classroom Intelligence features while removing the floating Planner Assistant interface and its unused command layer.');
readme = readme.replace(/\n### V7\.1\.0 Planner Assistant\n[\s\S]*?(?=\n### V7\.0\.3 Testing Mode)/, '\n');
readme = replaceAll(readme, '38 modules in V7.2.1', '37 modules in V7.2.2');
readme = replaceAll(readme, 'deterministic V7.2.1 build', 'deterministic V7.2.2 build');
write('README.md', readme);

let changelog = read('CHANGELOG.md');
if (!changelog.startsWith('## 7.2.2 - 2026-09-06')) {
  changelog = `## 7.2.2 - 2026-09-06\n\n### Planner Assistant removal\n\n- Removed the floating Planner Assistant dock and command interpreter from the active application.\n- Removed the Assistant command schema, documentation, and Assistant-specific browser regression coverage.\n- Preserved Seat Guidance, Classroom Intelligence, Activity Layouts, Station Rotations, Testing Mode, Guided Help, seating rules, and all normal manual/automatic seating workflows.\n- Removed Assistant command-history behavior from the active product; existing stale local Assistant history is ignored.\n- Planner data schema remains 13 and encryption envelope remains 3.\n\n${changelog}`;
}
write('CHANGELOG.md', changelog);

let handling = read('DATA-HANDLING.md');
handling = handling.replace(/\n\n## Planner Assistant command history\n[\s\S]*?(?=\n\n## Planner Packs)/, '');
write('DATA-HANDLING.md', handling);

let security = read('SECURITY.md');
security = security.replace('Security fixes target V7.2.1, the current hosted and portable production release.', 'Security fixes target V7.2.2, the current hosted and portable production release.');
write('SECURITY.md', security);

let validator = read('tools/validate-release.mjs');
validator = validator.replace("  'schemas/planner-command-v1.schema.json',\n", '');
validator = validator.replace("  ['V7.2.1 app version metadata', /name=[\"']app-version[\"']\\s+content=[\"']7\\.2\\.1[\"']/i.test(built)],", "  ['V7.2.2 app version metadata', /name=[\"']app-version[\"']\\s+content=[\"']7\\.2\\.2[\"']/i.test(built)],");
validator = validator.replace(/\n  \['V7\.1 Planner Assistant engine present'[\s\S]*?\['V7\.1 no external AI provider dependency'[^\n]*\],/, '');
validator = validator.replace("  ['V7.2 Planner Packs engine present'", "  ['Planner Assistant removed', !/PlannerAssistantV710|plannerAssistantV710Dock|classroom-seating-planner-command-v1/.test(built)],\n  ['V7.2 Planner Packs engine present'");
write('tools/validate-release.mjs', validator);

// Remove files that only existed for Planner Assistant.
for (const file of [
  'src/scripts/036-planner-assistant-v710.js',
  'schemas/planner-command-v1.schema.json',
  'docs/PLANNER-ASSISTANT.md',
  'tests/browser/planner-assistant-v710.spec.mjs',
  'tests/browser/ui-audit-v721.spec.mjs'
]) fs.rmSync(file, { force:true });

// Refuse to complete if any active JavaScript module still references the removed API.
const leftovers = fs.readdirSync('src/scripts')
  .filter(file => file.endsWith('.js'))
  .filter(file => /PlannerAssistantV710|plannerAssistantV710/.test(read(`src/scripts/${file}`)));
if (leftovers.length) throw new Error(`Planner Assistant references remain in: ${leftovers.join(', ')}`);

console.log('Planner Assistant removed for V7.2.2.');
