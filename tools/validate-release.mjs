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
  'service-worker.js'
]) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required source/release asset: ${file}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src', 'manifest.json'), 'utf8'));
for (let i = 1; i <= Number(manifest.styleFiles || 0); i += 1) {
  const file = `src/styles/style-${String(i).padStart(3, '0')}.css`;
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing modular style source: ${file}`);
}
for (let i = 1; i <= Number(manifest.scriptFiles || 0); i += 1) {
  const file = `src/scripts/script-${String(i).padStart(3, '0')}.js`;
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing modular script source: ${file}`);
}

execFileSync(process.execPath, ['tools/build-single-file.mjs'], { cwd: root, stdio: 'inherit' });
const built = normalize(fs.readFileSync(path.join(root, 'dist', 'Classroom-Seating-Planner.html'), 'utf8'));

const required = [
  ['doctype', /^\s*<!doctype html>/i.test(built)],
  ['V6.7 app version metadata', /name=["']app-version["']\s+content=["']6\.7\.0["']/i.test(built)],
  ['manifest link', /rel=["']manifest["']/i.test(built)],
  ['service worker registration', /serviceWorker\.register\(/.test(built)],
  ['analytics consent default remains granted', /analytics_storage\s*:\s*['"]granted['"]/.test(built)],
  ['Google Drive OAuth client configured', /googleDriveClientId\s*:\s*['"][^'"]+['"]/.test(built)],
  ['Google Picker project number configured', /googlePickerAppId\s*:\s*['"][^'"]+['"]/.test(built)],
  ['collaboration presence retained', /presence, changeLedger/.test(built)],
  ['collaboration activity UI present', /driveCollaborationLedger/.test(built)]
];

for (const [name, ok] of required) {
  if (!ok) throw new Error(`Validation failed: ${name}`);
}

if (deployed !== built) {
  const a = crypto.createHash('sha256').update(deployed).digest('hex');
  const b = crypto.createHash('sha256').update(built).digest('hex');
  throw new Error(`Committed modular source does not rebuild index.html: index=${a} built=${b}`);
}

console.log('Release validation passed. Committed modular source rebuilds index.html exactly after newline normalization.');
