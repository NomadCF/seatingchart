import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const inputPath = path.join(root, 'index.html');
const outDir = path.join(root, 'src');
const stylesDir = path.join(outDir, 'styles');
const scriptsDir = path.join(outDir, 'scripts');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(stylesDir, { recursive: true });
fs.mkdirSync(scriptsDir, { recursive: true });

let html = fs.readFileSync(inputPath, 'utf8').replace(/\r\n/g, '\n');
let styleIndex = 0;
let scriptIndex = 0;

html = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (_m, attrs, body) => {
  styleIndex += 1;
  const name = `style-${String(styleIndex).padStart(3, '0')}.css`;
  fs.writeFileSync(path.join(stylesDir, name), body, 'utf8');
  return `<style${attrs}>/* @source:${name} */</style>`;
});

html = html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body) => {
  if (/\bsrc\s*=/.test(attrs)) return m;
  scriptIndex += 1;
  const name = `script-${String(scriptIndex).padStart(3, '0')}.js`;
  fs.writeFileSync(path.join(scriptsDir, name), body, 'utf8');
  return `<script${attrs}>/* @source:${name} */</script>`;
});

fs.writeFileSync(path.join(outDir, 'index.template.html'), html, 'utf8');
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ styleFiles: styleIndex, scriptFiles: scriptIndex }, null, 2) + '\n', 'utf8');
console.log(`Split index.html into ${styleIndex} style modules and ${scriptIndex} script modules.`);
