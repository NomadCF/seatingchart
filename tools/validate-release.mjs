import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const normalize = s => s.replace(/\r\n/g, '\n');
const deployed = normalize(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));

for (const file of [
  'src/index.template.html',
  'src/manifest.json',
  'manifest.webmanifest',
  'service-worker.js',
  'schemas/roster-import-v1.schema.json',
  'schemas/planner-command-v1.schema.json',
  'schemas/planner-pack-v1.schema.json'
]) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required source/release asset: ${file}`);
}

JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'planner-pack-v1.schema.json'), 'utf8'));

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src', 'manifest.json'), 'utf8'));
for (let i = 1; i <= Number(manifest.styleFiles || 0); i += 1) {
  const file = `src/styles/style-${String(i).padStart(3, '0')}.css`;
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing modular style source: ${file}`);
}

const scriptFiles = Array.isArray(manifest.scriptFiles)
  ? manifest.scriptFiles
  : Array.from({ length: Number(manifest.scriptFiles || 0) }, (_, index) => `script-${String(index + 1).padStart(3, '0')}.js`);
if (!scriptFiles.length) throw new Error('No modular JavaScript source files are declared.');
for (const file of scriptFiles) {
  const fullPath = path.join(root, 'src', 'scripts', file);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing modular script source: src/scripts/${file}`);
  execFileSync(process.execPath, ['--check', fullPath], { cwd: root, stdio: 'inherit' });
}

execFileSync(process.execPath, ['tools/build-single-file.mjs'], { cwd: root, stdio: 'inherit' });
const built = normalize(fs.readFileSync(path.join(root, 'dist', 'Classroom-Seating-Planner.html'), 'utf8'));

const required = [
  ['doctype', /^\s*<!doctype html>/i.test(built)],
  ['V7.2.1 app version metadata', /name=["']app-version["']\s+content=["']7\.2\.1["']/i.test(built)],
  ['manifest link', /rel=["']manifest["']/i.test(built)],
  ['service worker registration', /serviceWorker\.register\(/.test(built)],
  ['analytics consent default remains granted', /analytics_storage\s*:\s*['"]granted['"]/.test(built)],
  ['Google Drive OAuth client configured', /googleDriveClientId\s*:\s*['"][^'"]+['"]/.test(built)],
  ['Google Picker project number configured', /googlePickerAppId\s*:\s*['"][^'"]+['"]/.test(built)],
  ['collaboration presence retained', /presence, changeLedger/.test(built)],
  ['collaboration activity UI present', /driveCollaborationLedger/.test(built)],
  ['V6.8 Classroom Intelligence module present', /ClassroomIntelligenceV68/.test(built)],
  ['V6.8 smallest-change repair UI present', /previewIntelligenceRepairBtn/.test(built)],
  ['V6.8.1 grouped seating visual system present', /GroupedSeatingVisualsV681/.test(built)],
  ['V6.8.1 grouped pod renderer present', /v681-pod-halo/.test(built)],
  ['V6.8.1 print-safe grouped seating styles present', /@media print[\s\S]*v681-pod-halo/.test(built)],
  ['V6.8.2 physical table renderer present', /PhysicalTablePodsV682/.test(built)],
  ['V6.9 interoperability engine present', /InteroperabilityV69/.test(built)],
  ['V6.9 OneRoster adapter present', /parseOneRosterPackage/.test(built)],
  ['V6.9 Microsoft Education adapter present', /parseMicrosoftPackage/.test(built)],
  ['V6.9 Classroom group sync present', /loadGoogleClassroomGroups/.test(built)],
  ['V6.9 public roster package present', /classroom-seating-planner-roster-import-v1/.test(built)],
  ['V6.8.2 chair cues present', /v682-chair-cue/.test(built)],
  ['V6.8.2 print-safe physical furniture present', /@media print[\s\S]*v682-chair-cue/.test(built)],
  ['V7.0 Digital Twin engine present', /ClassroomDigitalTwinV700/.test(built)],
  ['V7.0 physical room normalization present', /normalizePhysicalRoomRecord/.test(built)],
  ['V7.0 floor plan renderer present', /v700-floor-plan/.test(built)],
  ['V7.0 scaled rulers present', /v700-rulers/.test(built)],
  ['V7.0 distance measurement tool present', /physicalDistance/.test(built)],
  ['V7.0 fixed furniture object types present', /Shelf \/ Bookcase/.test(built) && /Lab Station/.test(built) && /Activity Station/.test(built)],
  ['V7.0.1 Activity Layouts engine present', /ActivityLayoutsV701/.test(built)],
  ['V7.0.1 Activity Layouts persistence present', /activityLayouts: source\.activityLayouts/.test(built)],
  ['V7.0.1 classroom arrangement starters present', /Direct Instruction/.test(built) && /Group Work/.test(built) && /Discussion Circle/.test(built) && /Testing/.test(built)],
  ['V7.0.1 arrangement comparison present', /openComparison/.test(built) && /v701-compare-grid/.test(built)],
  ['V7.0.2 Station Rotations engine present', /StationRotationsV702/.test(built)],
  ['V7.0.2 station rotation persistence present', /stationRotations: source\.stationRotations/.test(built)],
  ['V7.0.2 rotation round engine present', /roundAssignments/.test(built) && /startTransition/.test(built)],
  ['V7.0.2 station overlay present', /v702-station-overlay/.test(built)],
  ['V7.0.2 Today Mode roster integration present', /typeof seatingStudents === 'function'/.test(built)],
  ['V7.0.3 Testing Mode engine present', /TestingModeV703/.test(built)],
  ['V7.0.3 Testing Mode persistence present', /testingMode: source\.testingMode/.test(built)],
  ['V7.0.3 spacing feasibility engine present', /minimumSpacing/.test(built) && /spacingConflicts/.test(built)],
  ['V7.0.3 transition-plan engine present', /transitionSteps/.test(built) && /Return to source layout/.test(built)],
  ['V7.0.3 non-interactive preview overlay present', /v703-testing-preview/.test(built)],
  ['V7.1 Planner Assistant engine present', /PlannerAssistantV710/.test(built)],
  ['V7.1 public planner command contract present', /classroom-seating-planner-command-v1/.test(built)],
  ['V7.1 explicit preview and apply UI present', /plannerAssistantV710PreviewBtn/.test(built) && /plannerAssistantV710ApplyBtn/.test(built)],
  ['V7.1 ambiguity guard present', /Student name needs clarification/.test(built)],
  ['V7.1 no external AI provider dependency', !/openai\.com\/v1|anthropic\.com\/v1|generativelanguage\.googleapis\.com/.test(built)],
  ['V7.2 Planner Packs engine present', /PlannerPacksV720/.test(built)],
  ['V7.2 public Planner Pack contract present', /classroom-seating-planner-pack-v1/.test(built)],
  ['V7.2 personal-data import guard present', /FORBIDDEN_PERSONAL_KEYS/.test(built) && /studentDataIncluded/.test(built)],
  ['V7.2 floor-plan image opt-in present', /plannerPacksV720IncludeImages/.test(built)],
  ['V7.2 Activity Layout seat-count guard present', /Seat counts must match so student assignments are not silently changed/.test(built)],
  ['V7.2 rotation station identity matching present', /matchRotationStations/.test(built)]
];

for (const [name, ok] of required) {
  if (!ok) throw new Error(`Validation failed: ${name}`);
}

if (deployed !== built) {
  const a = crypto.createHash('sha256').update(deployed).digest('hex');
  const b = crypto.createHash('sha256').update(built).digest('hex');
  throw new Error(`Committed modular source does not rebuild index.html: index=${a} built=${b}`);
}

console.log(`Release validation passed. ${scriptFiles.length} JavaScript source module(s) rebuild index.html exactly after newline normalization.`);
