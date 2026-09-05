import fs from 'node:fs';

function replaceChecked(path, search, replacement, minimum = 1) {
  const text = fs.readFileSync(path, 'utf8');
  const count = text.split(search).length - 1;
  if (count < minimum) throw new Error(`${path}: expected ${minimum}+ occurrences of ${search}, found ${count}`);
  fs.writeFileSync(path, text.split(search).join(replacement), 'utf8');
}

replaceChecked('src/scripts/017-district-integrations-v57.js', 'google.accounts.oauth2.initTokenClient', 'window.google.accounts.oauth2.initTokenClient');
replaceChecked('src/scripts/000-core.js', "version: '7.2.0'", "version: '7.2.1'");
replaceChecked('src/index.template.html', 'meta name="app-version" content="7.2.0"', 'meta name="app-version" content="7.2.1"');
replaceChecked('package.json', '"version": "7.2.0"', '"version": "7.2.1"');
replaceChecked('service-worker.js', "classroom-seating-planner-v7.2.0-pwa1", "classroom-seating-planner-v7.2.1-pwa1");
replaceChecked('tools/validate-release.mjs', 'V7.2.0 app version metadata', 'V7.2.1 app version metadata');
replaceChecked('tools/validate-release.mjs', '7\\.2\\.0', '7\\.2\\.1');

for (const file of fs.readdirSync('tests/browser').filter(name => name.endsWith('.mjs'))) {
  const path = `tests/browser/${file}`;
  let text = fs.readFileSync(path, 'utf8');
  const before = text;
  text = text
    .replaceAll("toHaveAttribute('content', '7.2.0')", "toHaveAttribute('content', '7.2.1')")
    .replaceAll('toHaveAttribute("content", "7.2.0")', 'toHaveAttribute("content", "7.2.1")');
  if (text !== before) fs.writeFileSync(path, text, 'utf8');
}

const changelogPath = 'CHANGELOG.md';
let changelog = fs.readFileSync(changelogPath, 'utf8');
if (!changelog.includes('## V7.2.1')) {
  const entry = `## V7.2.1 - Code audit and maintenance\n\n- Removed proven-unused functions, parameters, locals, and an obsolete completed implementation-plan document.\n- Repaired stale autosave calls in Interoperability, Digital Twin, Activity Layouts, Station Rotations, Testing Mode, and Planner Packs so they use the canonical autosave scheduler.\n- Repaired the Digital Twin Freeform-mode transition to use the current layout-mode function.\n- Removed dead modal compatibility branches for APIs that no longer exist; current dialogs continue through the installed Dialog Manager.\n- Standardized Google Picker and Google Classroom access through the explicit \`window.google\` browser global.\n- Refreshed architecture/accessibility documentation and regenerated the portable single-file build.\n\n`;
  const firstHeading = changelog.indexOf('\n## ');
  if (firstHeading >= 0) changelog = changelog.slice(0, firstHeading + 1) + entry + changelog.slice(firstHeading + 1);
  else changelog += `\n${entry}`;
  fs.writeFileSync(changelogPath, changelog, 'utf8');
}

console.log('V7.2.1 cleanup finalization applied.');
