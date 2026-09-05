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
console.log('Fixed V7.0.1 Activity Layouts runtime layout identity, toolbar visibility, and shared station semantics.');
