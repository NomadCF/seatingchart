import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const templatePath = path.join(srcDir, 'index.template.html');
const manifestPath = path.join(srcDir, 'manifest.json');
const outPath = path.join(root, 'dist', 'Classroom-Seating-Planner.html');

if (!fs.existsSync(templatePath)) throw new Error('Missing src/index.template.html.');
if (!fs.existsSync(manifestPath)) throw new Error('Missing src/manifest.json.');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let html = fs.readFileSync(templatePath, 'utf8');

html = html.replace(/<style([^>]*)>\/\* @source:(style-\d{3}\.css) \*\/<\/style>/g, (_m, attrs, file) => {
  const body = fs.readFileSync(path.join(srcDir, 'styles', file), 'utf8');
  return `<style${attrs}>${body}</style>`;
});

html = html.replace(/<script([^>]*)>\/\* @source:(script-\d{3}\.js) \*\/<\/script>/g, (_m, attrs, file) => {
  const body = fs.readFileSync(path.join(srcDir, 'scripts', file), 'utf8');
  return `<script${attrs}>${body}</script>`;
});

html = html.replace(/<script([^>]*)>\/\* @bundle:application \*\/<\/script>/g, (_m, attrs) => {
  if (!Array.isArray(manifest.scriptFiles) || !manifest.scriptFiles.length) {
    throw new Error('src/manifest.json does not define an ordered scriptFiles array.');
  }
  const body = manifest.scriptFiles
    .map(file => fs.readFileSync(path.join(srcDir, 'scripts', file), 'utf8'))
    .join('');
  return `<script${attrs}>${body}</script>`;
});

const unresolvedStyleMarker = /<style[^>]*>\/\* @source:style-\d{3}\.css \*\/<\/style>/;
const unresolvedScriptMarker = /<script[^>]*>\/\* @(source:script-\d{3}\.js|bundle:application) \*\/<\/script>/;
if (unresolvedStyleMarker.test(html) || unresolvedScriptMarker.test(html)) {
  throw new Error('Unresolved source placeholder remains in assembled HTML.');
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html.replace(/\r\n/g, '\n'), 'utf8');
console.log(`Built ${path.relative(root, outPath)} (${Buffer.byteLength(html)} bytes).`);
