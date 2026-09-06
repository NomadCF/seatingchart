import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const templatePath = path.join(srcDir, 'index.template.html');
const manifestPath = path.join(srcDir, 'manifest.json');
const outPath = path.join(root, 'critical-smoke.html');

if (!fs.existsSync(templatePath)) throw new Error('Missing src/index.template.html.');
if (!fs.existsSync(manifestPath)) throw new Error('Missing src/manifest.json.');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(manifest.scriptFiles) || !manifest.scriptFiles.length) {
  throw new Error('src/manifest.json does not define an ordered scriptFiles array.');
}

let html = fs.readFileSync(templatePath, 'utf8');

// The production build inlines these same files. The smoke harness loads them as
// same-origin resources instead so headless Chromium can parse/compile the large
// application incrementally instead of blocking on one multi-megabyte script.
html = html.replace(/<style([^>]*)>\/\* @source:(style-\d{3}\.css) \*\/<\/style>/g, (_m, attrs, file) => {
  return `<link rel="stylesheet" href="./src/styles/${file}"${attrs || ''}>`;
});

html = html.replace(/<script([^>]*)>\/\* @source:(script-\d{3}\.js) \*\/<\/script>/g, (_m, attrs, file) => {
  return `<script${attrs || ''} src="./src/scripts/${file}"></script>`;
});

html = html.replace(/<script([^>]*)>\/\* @bundle:application \*\/<\/script>/g, (_m, attrs) => {
  return manifest.scriptFiles
    .map(file => `<script${attrs || ''} src="./src/scripts/${file}"></script>`)
    .join('\n  ');
});

fs.writeFileSync(outPath, html.replace(/\r\n/g, '\n'), 'utf8');
console.log(`Built ${path.relative(root, outPath)} using ${manifest.scriptFiles.length} ordered JavaScript modules.`);
