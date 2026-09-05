import fs from 'node:fs';

const moduleFile = 'src/scripts/034-station-rotations-v702.js';
let moduleSource = fs.readFileSync(moduleFile, 'utf8');
const fromModule = `      const badge = document.createElement('div');\n      badge.className = OVERLAY_CLASS;\n      badge.setAttribute('aria-hidden', 'true');`;
const toModule = `      const badge = document.createElement('div');\n      badge.className = OVERLAY_CLASS;\n      badge.style.pointerEvents = 'none';\n      badge.setAttribute('aria-hidden', 'true');`;
if (!moduleSource.includes(toModule)) {
  if (!moduleSource.includes(fromModule)) throw new Error('Station overlay creation marker missing');
  moduleSource = moduleSource.replace(fromModule, toModule);
  fs.writeFileSync(moduleFile, moduleSource);
}

const testFile = 'tests/browser/station-rotations-v702.spec.mjs';
let tests = fs.readFileSync(testFile, 'utf8');
const fromTest = `  const overlayPointerEvents = await page.locator('.v702-station-overlay').first().evaluate(node => getComputedStyle(node).pointerEvents);\n  expect(overlayPointerEvents).toBe('none');`;
const toTest = `  const overlayPointerEvents = await page.locator('.v702-station-overlay').first().evaluate(node => ({\n    inline:node.style.pointerEvents,\n    computed:getComputedStyle(node).pointerEvents\n  }));\n  expect(overlayPointerEvents.inline).toBe('none');\n  if (overlayPointerEvents.computed) expect(overlayPointerEvents.computed).toBe('none');`;
if (!tests.includes(toTest)) {
  if (!tests.includes(fromTest)) throw new Error('Station overlay pointer-events assertion marker missing');
  tests = tests.replace(fromTest, toTest);
  fs.writeFileSync(testFile, tests);
}

console.log('Hardened V7.0.2 station overlays against pointer-event interception and aligned regression coverage.');
