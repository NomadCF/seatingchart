import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const templatePath = path.join(srcDir, 'index.template.html');
const outPath = path.join(root, 'dist', 'Classroom-Seating-Planner.html');

if (!fs.existsSync(templatePath)) throw new Error('Missing src/index.template.html. Run npm run split first.');
let html = fs.readFileSync(templatePath, 'utf8');

html = html.replace(/<style([^>]*)>\/\* @source:(style-\d{3}\.css) \*\/<\/style>/g, (_m, attrs, file) => {
  const body = fs.readFileSync(path.join(srcDir, 'styles', file), 'utf8');
  return `<style${attrs}>${body}</style>`;
});

html = html.replace(/<script([^>]*)>\/\* @source:(script-\d{3}\.js) \*\/<\/script>/g, (_m, attrs, file) => {
  const body = fs.readFileSync(path.join(srcDir, 'scripts', file), 'utf8');
  return `<script${attrs}>${body}</script>`;
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html.replace(/\r\n/g, '\n'), 'utf8');
console.log(`Built ${path.relative(root, outPath)} (${Buffer.byteLength(html)} bytes).`);
