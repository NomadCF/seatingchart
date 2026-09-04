import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const scriptsDir = path.join(srcDir, 'scripts');
const originalPath = path.join(scriptsDir, 'script-001.js');
const templatePath = path.join(srcDir, 'index.template.html');
const manifestPath = path.join(srcDir, 'manifest.json');

if (!fs.existsSync(originalPath)) throw new Error('Expected bootstrap source src/scripts/script-001.js.');

const source = fs.readFileSync(originalPath, 'utf8');
const expectedModules = [
  'CRC_TABLE',
  'WorkflowExpansion',
  'BrowserDataStore',
  'CrossTabCoordinator',
  'DialogManager',
  'ModernizationSuite',
  'ProductExperience',
  'WorkspaceLayoutV41',
  'ProductPolishV42',
  'ProductRepairV43',
  'UserWorkflowV44',
  'StartupRecoveryV45',
  'ProductionReadinessV50',
  'InterfaceSystemV51',
  'ClassroomWorkflowV53',
  'ClassSetupWorkspaceV54',
  'DistrictIntegrationsV57',
  'WorkflowRecoveryV62',
  'SharedDriveCollaborationV64',
  'SeatGuidanceV66',
  'PlanningToolsV66',
  'ExportSupportV66',
  'DrivePollingV66',
  'LocalizationShortcutsV66',
  'ClassroomFeaturePackV66',
  'GuidedLearning'
];

const re = /^(?:const\s+|window\.)([A-Za-z_$][\w$]*)\s*=\s*\(\(\)\s*=>\s*\{/gm;
const discovered = [...source.matchAll(re)].map(match => ({ name: match[1], start: match.index }));
const selected = expectedModules.map(name => {
  const matches = discovered.filter(entry => entry.name === name);
  if (matches.length !== 1) throw new Error(`Expected one top-level module boundary for ${name}; found ${matches.length}.`);
  return matches[0];
});
for (let i = 1; i < selected.length; i += 1) {
  if (selected[i].start <= selected[i - 1].start) throw new Error(`Module boundary order changed near ${selected[i].name}.`);
}

const kebab = value => value
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .replace(/_/g, '-')
  .toLowerCase();

const parts = [{ name: 'core', start: 0, end: selected[0].start }];
selected.forEach((entry, index) => {
  parts.push({
    name: kebab(entry.name),
    start: entry.start,
    end: selected[index + 1]?.start ?? source.length
  });
});

for (const existing of fs.readdirSync(scriptsDir)) {
  fs.rmSync(path.join(scriptsDir, existing), { recursive: true, force: true });
}

const filenames = parts.map((part, index) => {
  const filename = `${String(index).padStart(3, '0')}-${part.name}.js`;
  const body = source.slice(part.start, part.end);
  if (!body) throw new Error(`Empty module generated for ${filename}.`);
  const output = path.join(scriptsDir, filename);
  fs.writeFileSync(output, body, 'utf8');
  execFileSync(process.execPath, ['--check', output], { stdio: 'inherit' });
  return filename;
});

let template = fs.readFileSync(templatePath, 'utf8');
const marker = '<script>/* @source:script-001.js */</script>';
const markerCount = template.split(marker).length - 1;
if (markerCount !== 1) throw new Error(`Expected one application script source marker; found ${markerCount}.`);
template = template.replace(marker, '<script>/* @bundle:application */</script>');
fs.writeFileSync(templatePath, template, 'utf8');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.scriptFiles = filenames;
manifest.applicationBundle = 'application';
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

const reconstructed = filenames.map(file => fs.readFileSync(path.join(scriptsDir, file), 'utf8')).join('');
if (reconstructed !== source) throw new Error('Semantic script split did not reconstruct the original application script exactly.');

console.log(`Split application script into ${filenames.length} ordered source modules.`);
