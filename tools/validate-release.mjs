import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const normalize = s => s.replace(/\r\n/g, '\n');
const source = normalize(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));

execFileSync(process.execPath, ['tools/split-monolith.mjs'], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, ['tools/build-single-file.mjs'], { cwd: root, stdio: 'inherit' });
const built = normalize(fs.readFileSync(path.join(root, 'dist', 'Classroom-Seating-Planner.html'), 'utf8'));

const required = [
  ['doctype', /^\s*<!doctype html>/i.test(built)],
  ['manifest link', /rel=["']manifest["']/i.test(built)],
  ['service worker registration', /serviceWorker\.register\(/.test(built)],
  ['app version metadata', /name=["']app-version["']/i.test(built)],
  ['analytics consent default remains granted', /analytics_storage\s*:\s*['"]granted['"]/.test(built)],
  ['Google Drive OAuth client configured', /googleDriveClientId\s*:\s*['"][^'"]+['"]/.test(built)],
  ['Google Picker project number configured', /googlePickerAppId\s*:\s*['"][^'"]+['"]/.test(built)]
];

for (const [name, ok] of required) {
  if (!ok) throw new Error(`Validation failed: ${name}`);
}

if (source !== built) {
  const a = crypto.createHash('sha256').update(source).digest('hex');
  const b = crypto.createHash('sha256').update(built).digest('hex');
  throw new Error(`Split/build round trip changed index.html: source=${a} built=${b}`);
}

for (const file of ['manifest.webmanifest', 'service-worker.js']) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing hosted PWA asset: ${file}`);
}

console.log('Release validation passed. Source split/build is byte-equivalent after newline normalization.');
