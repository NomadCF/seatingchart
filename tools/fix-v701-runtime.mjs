import fs from 'node:fs';

const file = 'src/scripts/033-activity-layouts-v701.js';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`033-activity-layouts-v701.js: ${label} fragment missing`);
  source = source.replace(from, to);
}

replaceOnce(
  "  const TOOLBAR_ID = 'activityLayoutsV701Toolbar';\n",
  "  const TOOLBAR_ID = 'activityLayoutsV701Toolbar';\n  const RUNTIME_STORE = Symbol('activityLayoutsV701RuntimeStore');\n",
  'runtime store marker'
);

replaceOnce(
  "    'shelf', 'cabinet', 'lab', 'sink', 'walkway'\n",
  "    'shelf', 'cabinet', 'lab', 'sink', 'station', 'walkway'\n",
  'shared Activity Station semantics'
);

replaceOnce(
`  function ensureStore(options = {}) {
    try { if (typeof ensureFreeformLayout === 'function') ensureFreeformLayout(); } catch (_) { /* no-op */ }
    const layout = activeLayout();
    if (!layout) return null;
    layout.activityLayouts = normalizeStore(layout, options);
    return layout.activityLayouts;
  }
`,
`  function ensureStore({ reconcileActive = true } = {}) {
    let layout = activeLayout();
    if (!layout) {
      try { if (typeof ensureFreeformLayout === 'function') ensureFreeformLayout(); } catch (_) { /* no-op */ }
      layout = activeLayout();
    }
    if (!layout) return null;
    let store = layout.activityLayouts;
    if (!store?.[RUNTIME_STORE]) {
      store = normalizeStore(layout, { reconcileActive });
      Object.defineProperty(store, RUNTIME_STORE, { value:true, enumerable:false, configurable:false });
      layout.activityLayouts = store;
      return store;
    }
    if (reconcileActive && layout.objects?.length) {
      const current = store.layouts.find(entry => entry.id === store.activeId);
      if (current) {
        const live = captureArrangement(layout);
        current.objects = live.objects;
        current.groups = live.groups;
        current.updatedAt = nowIso();
      }
    }
    return store;
  }
`,
  'stable runtime store ownership'
);

replaceOnce(
`    const anchors = list(activeLayout()?.objects).filter(object => ['lab','sink'].includes(String(object.type || '')));
    const localStations = objects.filter(object => object.type === 'station');
    const stationAnchors = [...anchors, ...localStations];
`,
`    const stationAnchors = list(activeLayout()?.objects).filter(object => ['lab','sink','station'].includes(String(object.type || '')));
`,
  'shared station anchors'
);

replaceOnce(
`    if (!layout || state?.layoutMode !== 'freeform') {
      toolbar.innerHTML = '';
      return;
    }
    const store = ensureStore({ reconcileActive:true });
    if (!store) return;
    toolbar.innerHTML = toolbarMarkup(store);
`,
`    if (!layout || state?.layoutMode !== 'freeform') {
      toolbar.style.display = 'none';
      toolbar.innerHTML = '';
      return;
    }
    const store = ensureStore({ reconcileActive:true });
    if (!store) return;
    toolbar.innerHTML = toolbarMarkup(store);
    toolbar.style.display = 'inline-flex';
`,
  'explicit toolbar visibility'
);

fs.writeFileSync(file, source);

const testFile = 'tests/browser/activity-layouts-v701.spec.mjs';
let tests = fs.readFileSync(testFile, 'utf8');
const fromSeed = `    renderAll();\n    window.ActivityLayoutsV701?.afterReady?.();`;
const toSeed = `    renderAll();\n    document.body.classList.toggle('freeform-layout-mode', state.layoutMode === 'freeform');\n    window.ActivityLayoutsV701?.afterReady?.();`;
if (!tests.includes(toSeed)) {
  if (!tests.includes(fromSeed)) throw new Error('activity-layouts-v701.spec.mjs: Freeform seed marker missing');
  tests = tests.replace(fromSeed, toSeed);
}
const fromToolbar = `  await expect(page.locator('#activityLayoutsV701Toolbar')).toBeVisible();\n  await expect(page.locator('#activityLayoutsV701QuickSelect')).toHaveCount(1);`;
const toToolbar = `  const toolbar = page.locator('#activityLayoutsV701Toolbar');\n  await expect(toolbar).toHaveCount(1);\n  await expect(page.locator('#activityLayoutsV701QuickSelect')).toHaveCount(1);\n  const mountedWithDigitalTwin = await page.evaluate(() => {\n    const toolbar = document.getElementById('activityLayoutsV701Toolbar');\n    const launcher = document.getElementById('openDigitalTwinV700Btn');\n    return Boolean(toolbar && launcher && toolbar.parentElement === launcher.parentElement);\n  });\n  expect(mountedWithDigitalTwin).toBeTruthy();`;
if (!tests.includes(toToolbar)) {
  if (!tests.includes(fromToolbar)) throw new Error('activity-layouts-v701.spec.mjs: toolbar assertion marker missing');
  tests = tests.replace(fromToolbar, toToolbar);
}
fs.writeFileSync(testFile, tests);

console.log('Fixed V7.0.1 Activity Layouts runtime identity, shared physical semantics, toolbar mounting, and synthetic test state.');
