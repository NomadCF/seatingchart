window.ActivityLayoutsV701 = (() => {
  'use strict';

  const VERSION = '7.0.1';
  const STORE_VERSION = 1;
  const STYLE_ID = 'activityLayoutsV701Styles';
  const MODAL_ID = 'activityLayoutsV701Modal';
  const COMPARE_MODAL_ID = 'activityLayoutsV701CompareModal';
  const TOOLBAR_ID = 'activityLayoutsV701Toolbar';
  const RUNTIME_STORE = Symbol('activityLayoutsV701RuntimeStore');
  const SHARED_PHYSICAL_TYPES = new Set([
    'door', 'wall', 'window', 'projector', 'board', 'carpet', 'ada', 'blocked',
    'shelf', 'cabinet', 'lab', 'sink', 'station', 'walkway'
  ]);
  const PRESETS = Object.freeze([
    Object.freeze({ id:'direct', name:'Direct Instruction', short:'Rows', description:'Front-facing rows for whole-group instruction and demonstrations.' }),
    Object.freeze({ id:'group', name:'Group Work', short:'Pods', description:'Cluster seats around tables or small-group centers for collaboration.' }),
    Object.freeze({ id:'discussion', name:'Discussion Circle', short:'Circle', description:'Arrange seats around a shared discussion area with clear sight lines.' }),
    Object.freeze({ id:'lab', name:'Lab / Stations', short:'Stations', description:'Place seats near lab or activity stations while fixed room features stay put.' }),
    Object.freeze({ id:'independent', name:'Independent Work', short:'Spaced', description:'Spread seats into a calmer, evenly spaced independent-work arrangement.' }),
    Object.freeze({ id:'testing', name:'Testing', short:'Testing', description:'Increase separation and stagger rows for a testing-oriented arrangement.' })
  ]);

  let canvasObserver = null;
  let refreshFrame = 0;
  let lastLayoutRef = null;

  const list = value => Array.isArray(value) ? value : [];
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max, fallback = min) => Math.max(min, Math.min(max, number(value, fallback)));
  const clone = value => {
    if (typeof deepClone === 'function') return deepClone(value);
    return JSON.parse(JSON.stringify(value ?? null));
  };
  const esc = value => typeof escapeHtml === 'function'
    ? escapeHtml(String(value ?? ''))
    : String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const makeId = prefix => {
    try { if (typeof uid === 'function') return uid(prefix); } catch (_) { /* use fallback */ }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  };
  const nowIso = () => new Date().toISOString();

  function activeLayout() {
    return state?.freeformLayout && typeof state.freeformLayout === 'object' ? state.freeformLayout : null;
  }

  function presetById(id) {
    return PRESETS.find(item => item.id === String(id || '')) || PRESETS[0];
  }

  function isSharedPhysicalObject(object) {
    return Boolean(object && SHARED_PHYSICAL_TYPES.has(String(object.type || '')));
  }

  function normalizeObject(object, index = 0) {
    try {
      if (typeof normalizeFreeformObject === 'function') return normalizeFreeformObject(object, index);
    } catch (_) { /* defensive fallback */ }
    const source = object && typeof object === 'object' ? object : {};
    return {
      ...clone(source),
      id: source.id ? String(source.id) : makeId('freeform-object'),
      type: String(source.type || 'seat'),
      x: number(source.x, 40 + index * 18),
      y: number(source.y, 40 + index * 18),
      width: Math.max(1, number(source.width, source.type === 'seat' ? 176 : 160)),
      height: Math.max(1, number(source.height, source.type === 'seat' ? 112 : 96)),
      rotation: number(source.rotation, 0),
      zIndex: Math.max(1, number(source.zIndex, index + 1))
    };
  }

  function normalizeGroup(group, index = 0) {
    const source = group && typeof group === 'object' ? group : {};
    return {
      id: source.id ? String(source.id) : makeId('freeform-group'),
      name: String(source.name || `Group ${index + 1}`).trim().slice(0, 60) || `Group ${index + 1}`,
      color: String(source.color || '#2f6fed').slice(0, 32),
      locked: Boolean(source.locked)
    };
  }

  function captureArrangement(layout = activeLayout()) {
    return {
      objects: list(layout?.objects)
        .filter(object => !isSharedPhysicalObject(object))
        .map((object, index) => normalizeObject(clone(object), index)),
      groups: list(layout?.groups).map((group, index) => normalizeGroup(clone(group), index))
    };
  }

  function normalizeEntry(value, index = 0, fallback = null) {
    const source = value && typeof value === 'object' ? value : {};
    const preset = PRESETS.some(item => item.id === source.preset) ? source.preset : 'custom';
    const fallbackArrangement = fallback || { objects:[], groups:[] };
    const objects = Array.isArray(source.objects) ? source.objects : fallbackArrangement.objects;
    const groups = Array.isArray(source.groups) ? source.groups : fallbackArrangement.groups;
    const createdAt = String(source.createdAt || nowIso());
    return {
      id: source.id ? String(source.id) : makeId('activity-layout'),
      name: String(source.name || (index === 0 ? 'Current Classroom' : `Activity Layout ${index + 1}`)).trim().slice(0, 80) || `Activity Layout ${index + 1}`,
      preset,
      description: String(source.description || '').trim().slice(0, 500),
      createdAt,
      updatedAt: String(source.updatedAt || createdAt),
      objects: list(objects).filter(object => !isSharedPhysicalObject(object)).map((object, objectIndex) => normalizeObject(clone(object), objectIndex)),
      groups: list(groups).map((group, groupIndex) => normalizeGroup(clone(group), groupIndex))
    };
  }

  function normalizeStore(layout = activeLayout(), { reconcileActive = true } = {}) {
    if (!layout) return { version:STORE_VERSION, activeId:'', layouts:[] };
    const fallback = captureArrangement(layout);
    const source = layout.activityLayouts && typeof layout.activityLayouts === 'object' ? layout.activityLayouts : {};
    const rawLayouts = Array.isArray(source.layouts) ? source.layouts.slice(0, 60) : [];
    const layouts = rawLayouts.map((item, index) => normalizeEntry(item, index, index === 0 ? fallback : null));
    if (!layouts.length) {
      layouts.push(normalizeEntry({ name:'Current Classroom', preset:'custom', description:'Original Freeform room arrangement.' }, 0, fallback));
    }
    const seen = new Set();
    layouts.forEach((entry, index) => {
      if (!entry.id || seen.has(entry.id)) entry.id = makeId(`activity-layout-${index + 1}`);
      seen.add(entry.id);
    });
    const activeId = layouts.some(entry => entry.id === source.activeId) ? String(source.activeId) : layouts[0].id;
    if (reconcileActive && layout.objects?.length) {
      const current = layouts.find(entry => entry.id === activeId);
      if (current) {
        const live = captureArrangement(layout);
        current.objects = live.objects;
        current.groups = live.groups;
      }
    }
    return { version:STORE_VERSION, activeId, layouts };
  }

  function ensureStore({ reconcileActive = true } = {}) {
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

  function activeEntry(store = ensureStore({ reconcileActive:true })) {
    if (!store) return null;
    return store.layouts.find(entry => entry.id === store.activeId) || store.layouts[0] || null;
  }

  function schedulePersist(reason = 'activity-layouts') {
    try { persistActiveClass?.(); } catch (_) { /* autosave is best-effort */ }
    try { scheduleLinkedAutoSave?.(reason); } catch (_) { /* linked save may not exist */ }
    try { persistFreeformGeometrySession?.(reason); } catch (_) { /* geometry cache is best-effort */ }
  }

  function announce(message) {
    const text = String(message || '');
    const local = document.getElementById('activityLayoutsV701Status');
    if (local) local.textContent = text;
    try { setLiveStatusMessage?.(text); } catch (_) { /* live region is optional */ }
  }

  function saveActive({ persist = false } = {}) {
    const layout = activeLayout();
    const store = ensureStore({ reconcileActive:false });
    if (!layout || !store) return null;
    const entry = store.layouts.find(item => item.id === store.activeId);
    if (!entry) return null;
    const snapshot = captureArrangement(layout);
    entry.objects = snapshot.objects;
    entry.groups = snapshot.groups;
    entry.updatedAt = nowIso();
    layout.activityLayouts = store;
    if (persist) schedulePersist('activity-layout-save-current');
    return entry;
  }

  function seatStateMaps(objects = list(activeLayout()?.objects)) {
    const byId = new Map();
    const byCell = new Map();
    list(objects).filter(object => object?.type === 'seat').forEach(object => {
      const stateRecord = {
        assignedStudentId: object.assignedStudentId ? String(object.assignedStudentId) : null,
        manual: Boolean(object.manual),
        locked: Boolean(object.locked)
      };
      if (object.id) byId.set(String(object.id), stateRecord);
      if (object.cellKey) byCell.set(String(object.cellKey), stateRecord);
    });
    Object.entries(state?.cells || {}).forEach(([cellKey, cell]) => {
      if (cell?.type !== 'seat' || byCell.has(String(cellKey))) return;
      byCell.set(String(cellKey), {
        assignedStudentId: cell.assignedStudentId ? String(cell.assignedStudentId) : null,
        manual: Boolean(cell.manual),
        locked: Boolean(cell.manual)
      });
    });
    return { byId, byCell };
  }

  function carrySeatState(objects, seatState) {
    return list(objects).map((object, index) => {
      const next = normalizeObject(clone(object), index);
      if (next.type !== 'seat') return next;
      const current = seatState.byId.get(String(next.id || '')) || seatState.byCell.get(String(next.cellKey || ''));
      if (current) {
        next.assignedStudentId = current.assignedStudentId;
        next.manual = current.manual;
        next.locked = current.locked;
      }
      return next;
    });
  }

  function applyEntry(entry, { announceChange = true, persist = true } = {}) {
    const layout = activeLayout();
    const store = ensureStore({ reconcileActive:false });
    if (!layout || !store || !entry) return false;
    const liveObjects = list(layout.objects);
    const sharedObjects = liveObjects.filter(isSharedPhysicalObject).map((object, index) => normalizeObject(clone(object), index));
    const seatState = seatStateMaps(liveObjects);
    const arrangementObjects = carrySeatState(entry.objects, seatState);
    layout.objects = [...sharedObjects, ...arrangementObjects].map((object, index) => normalizeObject(object, index));
    layout.groups = list(entry.groups).map((group, index) => normalizeGroup(clone(group), index));
    layout.nextZ = Math.max(1, ...layout.objects.map(object => number(object.zIndex, 1))) + 1;
    store.activeId = entry.id;
    entry.updatedAt = nowIso();
    layout.activityLayouts = store;
    try { resetFreeformGeometryCache?.(); } catch (_) { /* old cache helper may not exist */ }
    try {
      if (uiState?.freeformSelectedObjectIds?.clear) uiState.freeformSelectedObjectIds.clear();
      if (uiState?.freeformAuditObjectIds?.clear) uiState.freeformAuditObjectIds.clear();
    } catch (_) { /* selection cleanup is optional */ }
    try { persistFreeformGeometrySession?.('activity-layout-switch'); } catch (_) { /* cache seed */ }
    if (persist) schedulePersist('activity-layout-switch');
    try { renderAll?.(); } catch (_) { /* caller can render */ }
    try { window.ClassroomDigitalTwinV700?.enhance?.(); } catch (_) { /* physical overlays are optional */ }
    refreshUi();
    if (announceChange) announce(`Switched to ${entry.name}. Student assignments were carried across matching seats; the physical room remains shared.`);
    return true;
  }

  function activate(id, options = {}) {
    const store = ensureStore({ reconcileActive:false });
    if (!store) return false;
    const target = store.layouts.find(entry => entry.id === String(id || ''));
    if (!target) return false;
    if (store.activeId === target.id) {
      saveActive({ persist:options.persist !== false });
      refreshUi();
      return true;
    }
    saveActive({ persist:false });
    return applyEntry(target, options);
  }

  function uniqueName(base, store = ensureStore({ reconcileActive:false })) {
    const root = String(base || 'Activity Layout').trim().slice(0, 80) || 'Activity Layout';
    const names = new Set(list(store?.layouts).map(item => item.name.toLowerCase()));
    if (!names.has(root.toLowerCase())) return root;
    for (let i = 2; i < 100; i += 1) {
      const candidate = `${root} ${i}`.slice(0, 80);
      if (!names.has(candidate.toLowerCase())) return candidate;
    }
    return `${root} ${Date.now().toString(36)}`.slice(0, 80);
  }

  function canvasBounds() {
    const layout = activeLayout();
    return {
      width: Math.max(600, number(layout?.canvas?.width, 2800)),
      height: Math.max(500, number(layout?.canvas?.height, 1800))
    };
  }

  function centerObject(object, centerX, centerY, bounds = canvasBounds()) {
    const width = Math.max(1, number(object.width, object.type === 'seat' ? 176 : 160));
    const height = Math.max(1, number(object.height, object.type === 'seat' ? 112 : 96));
    object.x = clamp(centerX - width / 2, 20, Math.max(20, bounds.width - width - 20), 20);
    object.y = clamp(centerY - height / 2, 20, Math.max(20, bounds.height - height - 20), 20);
    object.rotation = 0;
    return object;
  }

  function gridPoints(count, bounds, { paddingX = 0.1, paddingY = 0.13, stagger = false, density = 1 } = {}) {
    if (!count) return [];
    const usableW = bounds.width * (1 - paddingX * 2);
    const usableH = bounds.height * (1 - paddingY * 2);
    const aspect = Math.max(0.4, usableW / Math.max(1, usableH));
    const cols = Math.max(1, Math.ceil(Math.sqrt(count * aspect) * density));
    const rows = Math.max(1, Math.ceil(count / cols));
    const stepX = usableW / Math.max(1, cols);
    const stepY = usableH / Math.max(1, rows);
    return Array.from({ length:count }, (_, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const offset = stagger && row % 2 ? stepX * 0.32 : 0;
      return {
        x: bounds.width * paddingX + stepX * (col + 0.5) + offset,
        y: bounds.height * paddingY + stepY * (row + 0.5)
      };
    });
  }

  function arrangeRows(objects, bounds, options = {}) {
    const seats = objects.filter(object => object.type === 'seat');
    gridPoints(seats.length, bounds, options).forEach((point, index) => centerObject(seats[index], point.x, point.y, bounds));
  }

  function arrangeDiscussion(objects, bounds) {
    const seats = objects.filter(object => object.type === 'seat');
    if (!seats.length) return;
    const centerX = bounds.width * 0.5;
    const centerY = bounds.height * 0.52;
    const radiusX = bounds.width * 0.37;
    const radiusY = bounds.height * 0.34;
    seats.forEach((seat, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index / seats.length);
      centerObject(seat, centerX + Math.cos(angle) * radiusX, centerY + Math.sin(angle) * radiusY, bounds);
    });
    const tables = objects.filter(object => object.type === 'table');
    tables.forEach((table, index) => {
      const offsetX = (index - (tables.length - 1) / 2) * Math.min(340, bounds.width * 0.13);
      centerObject(table, centerX + offsetX, centerY, bounds);
    });
  }

  function arrangeGroupWork(objects, bounds) {
    const seats = objects.filter(object => object.type === 'seat');
    const tables = objects.filter(object => object.type === 'table');
    const groupCount = Math.max(1, Math.min(Math.max(tables.length, Math.ceil(seats.length / 5)), 8));
    const centers = gridPoints(groupCount, bounds, { paddingX:0.16, paddingY:0.18, density:0.9 });
    tables.slice(0, groupCount).forEach((table, index) => centerObject(table, centers[index].x, centers[index].y, bounds));
    const slots = [
      [0, -150], [150, -40], [120, 125], [-120, 125], [-150, -40], [0, 160]
    ];
    seats.forEach((seat, index) => {
      const groupIndex = index % groupCount;
      const cycle = Math.floor(index / groupCount);
      const slot = slots[cycle % slots.length];
      const scale = 1 + Math.floor(cycle / slots.length) * 0.45;
      centerObject(seat, centers[groupIndex].x + slot[0] * scale, centers[groupIndex].y + slot[1] * scale, bounds);
    });
  }

  function arrangeLab(objects, bounds) {
    const seats = objects.filter(object => object.type === 'seat');
    const stationAnchors = list(activeLayout()?.objects).filter(object => ['lab','sink','station'].includes(String(object.type || '')));
    if (!stationAnchors.length) {
      arrangeRows(objects, bounds, { paddingX:0.14, paddingY:0.16, stagger:true, density:0.88 });
      return;
    }
    const offsets = [[0,130],[130,20],[-130,20],[95,-115],[-95,-115],[0,-155]];
    seats.forEach((seat, index) => {
      const anchor = stationAnchors[index % stationAnchors.length];
      const centerX = number(anchor.x) + number(anchor.width, 160) / 2;
      const centerY = number(anchor.y) + number(anchor.height, 96) / 2;
      const ring = Math.floor(index / stationAnchors.length);
      const offset = offsets[ring % offsets.length];
      centerObject(seat, centerX + offset[0], centerY + offset[1], bounds);
    });
  }

  function applyPresetToObjects(objects, presetId) {
    const next = list(objects).map((object, index) => normalizeObject(clone(object), index));
    const bounds = canvasBounds();
    if (presetId === 'group') arrangeGroupWork(next, bounds);
    else if (presetId === 'discussion') arrangeDiscussion(next, bounds);
    else if (presetId === 'lab') arrangeLab(next, bounds);
    else if (presetId === 'independent') arrangeRows(next, bounds, { paddingX:0.13, paddingY:0.15, stagger:false, density:0.88 });
    else if (presetId === 'testing') arrangeRows(next, bounds, { paddingX:0.16, paddingY:0.18, stagger:true, density:0.82 });
    else arrangeRows(next, bounds, { paddingX:0.09, paddingY:0.13, stagger:false, density:1.05 });
    next.forEach((object, index) => { object.zIndex = Math.max(1, number(object.zIndex, index + 1)); });
    return next;
  }

  function create(presetId = 'direct', options = {}) {
    const layout = activeLayout();
    const store = ensureStore({ reconcileActive:false });
    if (!layout || !store) return null;
    saveActive({ persist:false });
    const preset = presetById(presetId);
    const base = captureArrangement(layout);
    const requested = String(options.name || '').trim();
    const entry = normalizeEntry({
      id:makeId('activity-layout'),
      name:uniqueName(requested || preset.name, store),
      preset:preset.id,
      description:preset.description,
      createdAt:nowIso(),
      updatedAt:nowIso(),
      objects:applyPresetToObjects(base.objects, preset.id),
      groups:base.groups
    }, store.layouts.length);
    store.layouts.push(entry);
    layout.activityLayouts = store;
    applyEntry(entry, { announceChange:false, persist:true });
    announce(`${entry.name} created from the ${preset.name} starter. Fine-tune the room normally; changes stay with this arrangement.`);
    return entry;
  }

  function duplicate(id = '', options = {}) {
    const layout = activeLayout();
    const store = ensureStore({ reconcileActive:false });
    if (!layout || !store) return null;
    saveActive({ persist:false });
    const source = store.layouts.find(entry => entry.id === String(id || store.activeId)) || activeEntry(store);
    if (!source) return null;
    const entry = normalizeEntry({
      ...clone(source),
      id:makeId('activity-layout'),
      name:uniqueName(String(options.name || '').trim() || `${source.name} Copy`, store),
      createdAt:nowIso(),
      updatedAt:nowIso()
    }, store.layouts.length);
    store.layouts.push(entry);
    layout.activityLayouts = store;
    applyEntry(entry, { announceChange:false, persist:true });
    announce(`${source.name} duplicated as ${entry.name}.`);
    return entry;
  }

  function rename(id, name) {
    const store = ensureStore({ reconcileActive:false });
    if (!store) return false;
    const entry = store.layouts.find(item => item.id === String(id || ''));
    const next = String(name || '').trim().slice(0, 80);
    if (!entry || !next) return false;
    entry.name = next;
    entry.updatedAt = nowIso();
    activeLayout().activityLayouts = store;
    schedulePersist('activity-layout-rename');
    refreshUi();
    announce(`Activity layout renamed to ${entry.name}.`);
    return true;
  }

  function remove(id) {
    const layout = activeLayout();
    const store = ensureStore({ reconcileActive:false });
    if (!layout || !store || store.layouts.length <= 1) {
      announce('Keep at least one activity layout. Even software needs somewhere to put the chairs.');
      return false;
    }
    const index = store.layouts.findIndex(entry => entry.id === String(id || ''));
    if (index < 0) return false;
    saveActive({ persist:false });
    const [removed] = store.layouts.splice(index, 1);
    const wasActive = store.activeId === removed.id;
    if (wasActive) {
      const fallback = store.layouts[Math.min(index, store.layouts.length - 1)] || store.layouts[0];
      store.activeId = fallback.id;
      layout.activityLayouts = store;
      applyEntry(fallback, { announceChange:false, persist:true });
    } else {
      layout.activityLayouts = store;
      schedulePersist('activity-layout-delete');
      refreshUi();
    }
    announce(`${removed.name} removed.${wasActive ? ' Switched to the nearest remaining arrangement.' : ''}`);
    return true;
  }

  function applyPreset(id, presetId) {
    const layout = activeLayout();
    const store = ensureStore({ reconcileActive:false });
    if (!layout || !store) return false;
    saveActive({ persist:false });
    const entry = store.layouts.find(item => item.id === String(id || store.activeId));
    if (!entry) return false;
    const preset = presetById(presetId);
    entry.preset = preset.id;
    entry.description = preset.description;
    entry.objects = applyPresetToObjects(entry.objects, preset.id);
    entry.updatedAt = nowIso();
    layout.activityLayouts = store;
    if (entry.id === store.activeId) applyEntry(entry, { announceChange:false, persist:true });
    else schedulePersist('activity-layout-preset');
    refreshUi();
    announce(`${entry.name} rearranged using the ${preset.name} starter.`);
    return true;
  }

  function objectCenter(object) {
    return { x:number(object?.x) + number(object?.width, 1) / 2, y:number(object?.y) + number(object?.height, 1) / 2 };
  }

  function geometryChanged(a, b) {
    if (!a || !b) return true;
    return Math.abs(number(a.x) - number(b.x)) > 2 ||
      Math.abs(number(a.y) - number(b.y)) > 2 ||
      Math.abs(number(a.width) - number(b.width)) > 2 ||
      Math.abs(number(a.height) - number(b.height)) > 2 ||
      Math.abs(number(a.rotation) - number(b.rotation)) > 1 ||
      String(a.groupId || '') !== String(b.groupId || '');
  }

  function comparison(leftId, rightId, { syncCurrent = true } = {}) {
    const store = ensureStore({ reconcileActive:false });
    if (!store) return null;
    if (syncCurrent) saveActive({ persist:false });
    const left = store.layouts.find(entry => entry.id === String(leftId || '')) || store.layouts[0];
    const right = store.layouts.find(entry => entry.id === String(rightId || '')) || store.layouts[1] || store.layouts[0];
    if (!left || !right) return null;
    const leftMap = new Map(list(left.objects).map(object => [String(object.id), object]));
    const rightMap = new Map(list(right.objects).map(object => [String(object.id), object]));
    const ids = new Set([...leftMap.keys(), ...rightMap.keys()]);
    const movedIds = [];
    const addedIds = [];
    const removedIds = [];
    let totalPixelMovement = 0;
    ids.forEach(id => {
      const a = leftMap.get(id);
      const b = rightMap.get(id);
      if (!a) { addedIds.push(id); return; }
      if (!b) { removedIds.push(id); return; }
      if (geometryChanged(a, b)) {
        movedIds.push(id);
        const ac = objectCenter(a);
        const bc = objectCenter(b);
        totalPixelMovement += Math.hypot(ac.x - bc.x, ac.y - bc.y);
      }
    });
    let physicalMovement = null;
    const twin = window.ClassroomDigitalTwinV700;
    const room = twin?.physicalRoom?.();
    const canvas = activeLayout()?.canvas || {};
    if (room?.enabled) {
      const pxPerUnitX = Math.max(0.001, number(canvas.width, 2800) / room.width);
      const pxPerUnitY = Math.max(0.001, number(canvas.height, 1800) / room.height);
      let sum = 0;
      movedIds.forEach(id => {
        const ac = objectCenter(leftMap.get(id));
        const bc = objectCenter(rightMap.get(id));
        sum += Math.hypot((ac.x - bc.x) / pxPerUnitX, (ac.y - bc.y) / pxPerUnitY);
      });
      physicalMovement = { value:sum, unit:room.unit };
    }
    return {
      left,
      right,
      movedIds,
      addedIds,
      removedIds,
      changedCount:movedIds.length + addedIds.length + removedIds.length,
      totalPixelMovement,
      physicalMovement
    };
  }

  function previewObjects(entry, changedIds = new Set()) {
    const bounds = canvasBounds();
    const objects = list(entry?.objects).filter(object => ['seat','table','station','teacher'].includes(String(object.type || '')));
    return objects.map(object => {
      const left = clamp(number(object.x) / bounds.width * 100, 0, 100);
      const top = clamp(number(object.y) / bounds.height * 100, 0, 100);
      const width = clamp(number(object.width, 40) / bounds.width * 100, 0.8, 36);
      const height = clamp(number(object.height, 30) / bounds.height * 100, 0.8, 30);
      const changed = changedIds.has(String(object.id));
      return `<span class="v701-preview-object ${esc(object.type)}${changed ? ' changed' : ''}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;transform:rotate(${number(object.rotation)}deg)" title="${esc(object.label || object.type)}"></span>`;
    }).join('');
  }

  function comparisonMarkup(result) {
    if (!result) return '<div class="hint">Choose two activity layouts to compare.</div>';
    const changed = new Set([...result.movedIds, ...result.addedIds, ...result.removedIds]);
    const movement = result.physicalMovement
      ? `${result.physicalMovement.value.toFixed(result.physicalMovement.value < 10 ? 2 : 1)} ${result.physicalMovement.unit} total center movement`
      : `${Math.round(result.totalPixelMovement)} px total center movement`;
    return `<div class="v701-compare-summary">
      <span class="pill">${result.movedIds.length} moved</span><span class="pill">${result.addedIds.length} added</span><span class="pill">${result.removedIds.length} removed</span><span class="pill">${esc(movement)}</span>
    </div>
    <div class="v701-compare-grid">
      <article><header><strong>${esc(result.left.name)}</strong><span>${esc(result.left.preset === 'custom' ? 'Custom' : presetById(result.left.preset).name)}</span></header><div class="v701-preview">${previewObjects(result.left, changed)}</div></article>
      <article><header><strong>${esc(result.right.name)}</strong><span>${esc(result.right.preset === 'custom' ? 'Custom' : presetById(result.right.preset).name)}</span></header><div class="v701-preview">${previewObjects(result.right, changed)}</div></article>
    </div>`;
  }

  function toolbarMarkup(store) {
    const active = activeEntry(store);
    return `<label class="v701-toolbar-label" for="activityLayoutsV701QuickSelect">Activity layout</label>
      <select id="activityLayoutsV701QuickSelect" aria-label="Active activity layout">${store.layouts.map(entry => `<option value="${esc(entry.id)}"${entry.id === store.activeId ? ' selected' : ''}>${esc(entry.name)}</option>`).join('')}</select>
      <button id="activityLayoutsV701ManageBtn" class="secondary" type="button">Layouts</button>
      <span class="v701-active-badge" title="Current physical-room arrangement">${esc(active?.preset === 'custom' ? 'Custom' : presetById(active?.preset).short)}</span>`;
  }

  function installToolbar() {
    let toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = TOOLBAR_ID;
      toolbar.className = 'v701-toolbar';
      const digitalTwin = document.getElementById('openDigitalTwinV700Btn');
      const controls = digitalTwin?.parentElement || document.getElementById('freeformCanvasWidthInput')?.closest('.field')?.parentElement || document.querySelector('.freeform-controls, #roomLayoutControls');
      if (digitalTwin?.parentElement) digitalTwin.insertAdjacentElement('afterend', toolbar);
      else if (controls) controls.appendChild(toolbar);
      else document.body.appendChild(toolbar);
      toolbar.addEventListener('change', event => {
        if (event.target?.id === 'activityLayoutsV701QuickSelect') activate(event.target.value);
      });
      toolbar.addEventListener('click', event => {
        if (event.target?.closest?.('#activityLayoutsV701ManageBtn')) openModal();
      });
    }
    renderToolbar();
    return toolbar;
  }

  function renderToolbar() {
    const toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) return;
    const layout = activeLayout();
    if (!layout || state?.layoutMode !== 'freeform') {
      toolbar.style.display = 'none';
      toolbar.innerHTML = '';
      return;
    }
    const store = ensureStore({ reconcileActive:true });
    if (!store) return;
    toolbar.innerHTML = toolbarMarkup(store);
    toolbar.style.display = 'inline-flex';
  }

  function modalMarkup() {
    return `<div id="${MODAL_ID}" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="activityLayoutsV701Title">
      <div class="modal v701-modal">
        <div class="panel-header"><div><span class="v701-kicker">V7.0.1 Classroom Digital Twin</span><h2 id="activityLayoutsV701Title">Activity layouts</h2></div><button id="activityLayoutsV701CloseBtn" class="tiny secondary" type="button">Close</button></div>
        <div class="modal-body v701-modal-body">
          <div class="v701-intro"><strong>One physical room. Multiple teaching arrangements.</strong><span>Room dimensions, floor-plan background, and fixed physical features stay shared. Each activity layout remembers movable Freeform furniture and seat geometry. Matching seat assignments carry across layout switches.</span></div>
          <section class="section v701-section" id="activityLayoutsV701CurrentSection"></section>
          <section class="section v701-section"><div class="v701-section-head"><div><h3>Create from a starter</h3><p>Start from the current room, then rearrange its movable objects. These are starters, not irreversible templates.</p></div></div><label class="v701-new-name">Optional name<input id="activityLayoutsV701NewName" maxlength="80" placeholder="e.g. Period 3 discussion" /></label><div class="v701-preset-grid">${PRESETS.map(preset => `<button class="secondary v701-preset" type="button" data-v701-create-preset="${esc(preset.id)}"><strong>${esc(preset.name)}</strong><span>${esc(preset.description)}</span></button>`).join('')}</div></section>
          <section class="section v701-section"><div class="v701-section-head"><div><h3>Saved arrangements</h3><p>Switch, duplicate, rename, or re-apply a starter without changing the shared physical room.</p></div></div><div id="activityLayoutsV701List" class="v701-layout-list"></div></section>
          <section class="section v701-section"><div class="v701-section-head"><div><h3>Compare arrangements</h3><p>See what moves before asking anyone to relocate half the furniture during a three-minute passing period.</p></div></div><div class="v701-compare-controls"><select id="activityLayoutsV701CompareLeft" aria-label="First activity layout"></select><span>vs.</span><select id="activityLayoutsV701CompareRight" aria-label="Second activity layout"></select><button id="activityLayoutsV701CompareBtn" class="secondary" type="button">Compare</button></div></section>
          <div id="activityLayoutsV701Status" class="hint" role="status" aria-live="polite"></div>
        </div>
      </div>
    </div>`;
  }

  function compareModalMarkup() {
    return `<div id="${COMPARE_MODAL_ID}" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="activityLayoutsV701CompareTitle"><div class="modal v701-compare-modal"><div class="panel-header"><div><span class="v701-kicker">Activity layout comparison</span><h2 id="activityLayoutsV701CompareTitle">Arrangement changes</h2></div><button id="activityLayoutsV701CompareCloseBtn" class="tiny secondary" type="button">Close</button></div><div id="activityLayoutsV701CompareBody" class="modal-body"></div></div></div>`;
  }

  function ensureModals() {
    let modal = document.getElementById(MODAL_ID);
    if (!modal) {
      const host = document.createElement('div');
      host.innerHTML = modalMarkup();
      modal = host.firstElementChild;
      document.body.appendChild(modal);
      bindModalEvents(modal);
    }
    let compareModal = document.getElementById(COMPARE_MODAL_ID);
    if (!compareModal) {
      const host = document.createElement('div');
      host.innerHTML = compareModalMarkup();
      compareModal = host.firstElementChild;
      document.body.appendChild(compareModal);
      compareModal.querySelector('#activityLayoutsV701CompareCloseBtn')?.addEventListener('click', closeCompareModal);
      compareModal.addEventListener('click', event => { if (event.target === compareModal) closeCompareModal(); });
    }
    return modal;
  }

  function openById(id) {
    const node = document.getElementById(id);
    if (!node) return;
    node.classList.add('show');
  }

  function closeById(id) {
    const node = document.getElementById(id);
    if (!node) return;
    node.classList.remove('show');
  }

  function openModal() {
    if (state?.layoutMode !== 'freeform') {
      announce('Activity layouts are available for Freeform rooms.');
      return;
    }
    saveActive({ persist:false });
    ensureModals();
    renderModal();
    openById(MODAL_ID);
  }

  function closeModal() { closeById(MODAL_ID); }
  function closeCompareModal() { closeById(COMPARE_MODAL_ID); }

  function openComparison(leftId, rightId) {
    ensureModals();
    const result = comparison(leftId, rightId, { syncCurrent:true });
    const body = document.getElementById('activityLayoutsV701CompareBody');
    if (body) body.innerHTML = comparisonMarkup(result);
    openById(COMPARE_MODAL_ID);
    return result;
  }

  function entryCard(entry, store) {
    const active = entry.id === store.activeId;
    const preset = entry.preset === 'custom' ? null : presetById(entry.preset);
    return `<article class="v701-layout-card${active ? ' active' : ''}" data-v701-layout-id="${esc(entry.id)}"><div class="v701-card-main"><div><strong>${esc(entry.name)}</strong><span>${esc(preset?.name || 'Custom arrangement')}</span></div>${active ? '<span class="pill special">Active</span>' : ''}</div><p>${esc(entry.description || preset?.description || 'Custom room arrangement.')}</p><div class="v701-card-stats"><span class="pill">${entry.objects.filter(object => object.type === 'seat').length} seats</span><span class="pill">${entry.objects.filter(object => object.type === 'table').length} tables</span><span class="pill">${entry.groups.length} groups</span></div><div class="v701-card-actions"><button class="tiny secondary" type="button" data-v701-activate="${esc(entry.id)}"${active ? ' disabled' : ''}>${active ? 'Current' : 'Switch'}</button><button class="tiny secondary" type="button" data-v701-duplicate="${esc(entry.id)}">Duplicate</button><select data-v701-preset-select="${esc(entry.id)}" aria-label="Starter for ${esc(entry.name)}"><option value="custom">Starter…</option>${PRESETS.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}</select><button class="tiny ghost" type="button" data-v701-apply-preset="${esc(entry.id)}">Apply starter</button></div></article>`;
  }

  function renderModal() {
    const modal = ensureModals();
    const store = ensureStore({ reconcileActive:true });
    if (!store) return;
    const current = activeEntry(store);
    const currentSection = modal.querySelector('#activityLayoutsV701CurrentSection');
    if (currentSection) currentSection.innerHTML = `<div class="v701-section-head"><div><h3>Current arrangement</h3><p>Changes you make in Room Design are kept with the active activity layout when you switch.</p></div><span class="pill special">${esc(current?.name || '')}</span></div><div class="v701-current-actions"><label>Rename current<input id="activityLayoutsV701RenameInput" maxlength="80" value="${esc(current?.name || '')}" /></label><button id="activityLayoutsV701RenameBtn" class="secondary" type="button">Rename</button><button id="activityLayoutsV701DuplicateCurrentBtn" class="secondary" type="button">Duplicate</button><button id="activityLayoutsV701SaveCurrentBtn" class="ghost" type="button">Save current geometry</button><button id="activityLayoutsV701DeleteCurrentBtn" class="danger" type="button"${store.layouts.length <= 1 ? ' disabled' : ''}>Delete</button></div>`;
    const listNode = modal.querySelector('#activityLayoutsV701List');
    if (listNode) listNode.innerHTML = store.layouts.map(entry => entryCard(entry, store)).join('');
    const options = store.layouts.map(entry => `<option value="${esc(entry.id)}">${esc(entry.name)}</option>`).join('');
    const left = modal.querySelector('#activityLayoutsV701CompareLeft');
    const right = modal.querySelector('#activityLayoutsV701CompareRight');
    const previousLeft = left?.value;
    const previousRight = right?.value;
    if (left) { left.innerHTML = options; left.value = store.layouts.some(entry => entry.id === previousLeft) ? previousLeft : store.activeId; }
    if (right) {
      right.innerHTML = options;
      const fallback = store.layouts.find(entry => entry.id !== (left?.value || store.activeId))?.id || store.activeId;
      right.value = store.layouts.some(entry => entry.id === previousRight) ? previousRight : fallback;
    }
    renderToolbar();
  }

  function bindModalEvents(modal) {
    modal.querySelector('#activityLayoutsV701CloseBtn')?.addEventListener('click', closeModal);
    modal.addEventListener('click', event => {
      if (event.target === modal) { closeModal(); return; }
      const createButton = event.target.closest?.('[data-v701-create-preset]');
      if (createButton) {
        const name = String(modal.querySelector('#activityLayoutsV701NewName')?.value || '').trim();
        create(createButton.dataset.v701CreatePreset, { name });
        const input = modal.querySelector('#activityLayoutsV701NewName');
        if (input) input.value = '';
        renderModal();
        return;
      }
      const activateButton = event.target.closest?.('[data-v701-activate]');
      if (activateButton) { activate(activateButton.dataset.v701Activate); renderModal(); return; }
      const duplicateButton = event.target.closest?.('[data-v701-duplicate]');
      if (duplicateButton) { duplicate(duplicateButton.dataset.v701Duplicate); renderModal(); return; }
      const presetButton = event.target.closest?.('[data-v701-apply-preset]');
      if (presetButton) {
        const select = modal.querySelector(`[data-v701-preset-select="${CSS.escape(presetButton.dataset.v701ApplyPreset)}"]`);
        if (select?.value && select.value !== 'custom') applyPreset(presetButton.dataset.v701ApplyPreset, select.value);
        renderModal();
      }
    });
    modal.addEventListener('click', event => {
      if (event.target?.id === 'activityLayoutsV701RenameBtn') {
        const store = ensureStore({ reconcileActive:false });
        rename(store?.activeId, modal.querySelector('#activityLayoutsV701RenameInput')?.value);
        renderModal();
      }
      if (event.target?.id === 'activityLayoutsV701DuplicateCurrentBtn') {
        duplicate();
        renderModal();
      }
      if (event.target?.id === 'activityLayoutsV701SaveCurrentBtn') {
        saveActive({ persist:true });
        announce('Current activity layout geometry saved.');
        renderModal();
      }
      if (event.target?.id === 'activityLayoutsV701DeleteCurrentBtn') {
        const store = ensureStore({ reconcileActive:false });
        remove(store?.activeId);
        renderModal();
      }
      if (event.target?.id === 'activityLayoutsV701CompareBtn') {
        openComparison(modal.querySelector('#activityLayoutsV701CompareLeft')?.value, modal.querySelector('#activityLayoutsV701CompareRight')?.value);
      }
    });
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .v701-toolbar{display:none;align-items:center;gap:6px;min-width:0}.freeform-layout-mode .v701-toolbar{display:inline-flex}.v701-toolbar-label{font-size:10px;font-weight:900;color:var(--muted,#607089);white-space:nowrap}.v701-toolbar select{min-width:150px;max-width:230px}.v701-toolbar button{white-space:nowrap}.v701-active-badge{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;background:color-mix(in srgb,var(--panel,#fff) 86%,#2563eb 14%);border:1px solid color-mix(in srgb,var(--border,#cbd5e1) 72%,#2563eb 28%);font-size:9px;font-weight:900;color:var(--muted,#475569)}
      .v701-modal{width:min(1080px,calc(100vw - 24px));max-width:1080px;height:min(900px,calc(100vh - 24px))}.v701-modal-body{display:grid;gap:14px;overflow:auto;padding-bottom:28px}.v701-kicker{display:block;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#607089);margin-bottom:3px}.v701-intro{display:flex;gap:10px;align-items:baseline;padding:12px 14px;border:1px solid var(--border,#d8deea);border-radius:12px;background:color-mix(in srgb,var(--panel,#fff) 94%,#2563eb 6%)}.v701-intro span{color:var(--muted,#607089)}.v701-section{display:grid;gap:11px}.v701-section-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v701-section-head h3{margin:0 0 3px}.v701-section-head p{margin:0;color:var(--muted,#607089);font-size:12px}.v701-current-actions{display:grid;grid-template-columns:minmax(180px,1fr) repeat(4,auto);gap:8px;align-items:end}.v701-current-actions label,.v701-new-name{display:grid;gap:4px;font-size:11px;font-weight:800}.v701-preset-grid{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:8px}.v701-preset{display:grid;gap:3px;text-align:left;min-height:76px;align-content:center}.v701-preset span{font-size:10px;font-weight:600;color:var(--muted,#607089);line-height:1.25}.v701-layout-list{display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:9px}.v701-layout-card{display:grid;gap:8px;border:1px solid var(--border,#d8deea);border-radius:12px;padding:11px;background:var(--panel,#fff)}.v701-layout-card.active{border-color:#2563eb;box-shadow:0 0 0 2px color-mix(in srgb,#2563eb 18%,transparent)}.v701-card-main{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.v701-card-main>div{display:grid;gap:2px}.v701-card-main span,.v701-layout-card p{font-size:10px;color:var(--muted,#607089);margin:0}.v701-card-stats,.v701-card-actions,.v701-compare-controls,.v701-compare-summary{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.v701-card-actions select{max-width:150px}.v701-compare-controls select{min-width:180px;flex:1}.v701-compare-modal{width:min(1050px,calc(100vw - 24px));height:min(760px,calc(100vh - 24px))}.v701-compare-modal .modal-body{overflow:auto}.v701-compare-summary{margin-bottom:10px}.v701-compare-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.v701-compare-grid article{display:grid;gap:7px}.v701-compare-grid header{display:flex;justify-content:space-between;gap:8px}.v701-compare-grid header span{font-size:10px;color:var(--muted,#607089)}.v701-preview{position:relative;aspect-ratio:14/9;min-height:240px;border:1px solid var(--border,#d8deea);border-radius:12px;overflow:hidden;background-image:linear-gradient(to right,color-mix(in srgb,var(--border,#cbd5e1) 32%,transparent) 1px,transparent 1px),linear-gradient(to bottom,color-mix(in srgb,var(--border,#cbd5e1) 32%,transparent) 1px,transparent 1px);background-size:6% 8%;background-color:var(--panel,#fff)}.v701-preview-object{position:absolute;border:1px solid color-mix(in srgb,#475569 65%,transparent);border-radius:3px;background:#dbeafe;transform-origin:center;min-width:3px;min-height:3px}.v701-preview-object.table{background:#e8f7ec;border-radius:7px}.v701-preview-object.station{background:#eee7f7}.v701-preview-object.teacher{background:#fff3d6}.v701-preview-object.changed{outline:2px solid #2563eb;outline-offset:1px;z-index:3}
      body.visibility-mode .v701-toolbar{display:none!important}@media print{.v701-toolbar,.v701-modal,.v701-compare-modal{display:none!important}}
      @media(max-width:900px){.v701-toolbar{flex:1 1 100%;width:100%}.v701-toolbar-label{display:none}.v701-toolbar select{flex:1;max-width:none;min-width:0}.v701-modal,.v701-compare-modal{width:calc(100vw - 10px);height:calc(100vh - 10px)}.v701-intro,.v701-section-head{flex-direction:column;align-items:stretch}.v701-preset-grid{grid-template-columns:1fr 1fr}.v701-layout-list{grid-template-columns:1fr}.v701-current-actions{grid-template-columns:1fr 1fr}.v701-current-actions label{grid-column:1/-1}.v701-compare-grid{grid-template-columns:1fr}.v701-preview{min-height:190px}}
      @media(max-width:500px){.v701-preset-grid,.v701-current-actions{grid-template-columns:1fr}.v701-current-actions label{grid-column:auto}.v701-card-actions>*{flex:1 1 120px}.v701-compare-controls{display:grid;grid-template-columns:1fr}.v701-compare-controls>span{text-align:center}.v701-compare-controls select{min-width:0;width:100%}.v701-active-badge{display:none}}
    `;
    document.head.appendChild(style);
  }

  function refreshUi() {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      installToolbar();
      if (document.getElementById(MODAL_ID)?.classList.contains('show')) renderModal();
    });
  }

  function observeCanvas() {
    const canvas = document.getElementById('seatGrid');
    if (!canvas) { setTimeout(observeCanvas, 250); return; }
    if (canvasObserver && lastLayoutRef === canvas) return;
    canvasObserver?.disconnect();
    lastLayoutRef = canvas;
    canvasObserver = new MutationObserver(() => refreshUi());
    canvasObserver.observe(canvas, { childList:true, subtree:false });
  }

  function installEvents() {
    document.addEventListener('change', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.matches?.('#classSelect,#layoutModeSelect,[data-class-id]')) setTimeout(refreshUi, 0);
    }, true);
    window.addEventListener('beforeunload', () => saveActive({ persist:false }));
    window.addEventListener('resize', refreshUi, { passive:true });
  }

  function install() {
    installStyles();
    ensureModals();
    installToolbar();
    observeCanvas();
    installEvents();
  }

  function afterReady() {
    ensureStore({ reconcileActive:true });
    installToolbar();
    observeCanvas();
    refreshUi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();

  return Object.freeze({
    version:VERSION,
    presets:PRESETS,
    sharedPhysicalTypes:Object.freeze([...SHARED_PHYSICAL_TYPES]),
    install,
    afterReady,
    ensureStore,
    normalizeStore,
    captureArrangement,
    activeEntry,
    saveActive,
    activate,
    create,
    duplicate,
    rename,
    remove,
    applyPreset,
    comparison,
    open:openModal,
    close:closeModal,
    openComparison,
    refresh:refreshUi
  });
})();

'use strict';
