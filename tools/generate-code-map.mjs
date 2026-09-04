import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const unique = values => [...new Set(values)].sort();
const matches = (re, group = 1) => unique([...html.matchAll(re)].map(m => m[group]).filter(Boolean));

const keywords = [
  'valid seat', 'rule violation', 'conflict', 'fairness', 'history', 'named plan',
  'seating plan', 'scheduled', 'CSV', 'export', 'copy', 'image', 'annotation',
  'comment', 'blank room', 'template', 'duplicate', 'unseated', 'Drive', 'support bundle'
];

const contexts = {};
for (const keyword of keywords) {
  const lower = html.toLowerCase();
  const needle = keyword.toLowerCase();
  const found = [];
  let pos = 0;
  while ((pos = lower.indexOf(needle, pos)) !== -1 && found.length < 12) {
    found.push(html.slice(Math.max(0, pos - 220), Math.min(html.length, pos + needle.length + 300)).replace(/\s+/g, ' '));
    pos += needle.length;
  }
  contexts[keyword] = found;
}

const map = {
  generatedFrom: 'index.html',
  functions: matches(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g),
  asyncFunctions: matches(/\basync\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g),
  windowGlobals: matches(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g),
  elementIds: matches(/\bid=["']([^"']+)["']/g),
  dataAttributes: matches(/\b(data-[a-z0-9-]+)=/gi),
  localStorageKeys: matches(/localStorage\.(?:getItem|setItem|removeItem)\(\s*["']([^"']+)["']/g),
  contexts
};

fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/generated-code-map.json', JSON.stringify(map, null, 2) + '\n');
console.log(`Mapped ${map.functions.length} functions, ${map.windowGlobals.length} window globals, and ${map.elementIds.length} element IDs.`);
