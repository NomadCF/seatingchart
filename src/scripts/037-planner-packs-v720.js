window.PlannerPacksV720 = (() => {
  'use strict';

  const VERSION = '7.2.0';
  const FORMAT = 'classroom-seating-planner-pack-v1';
  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = 'planner-packs-v1';
  const STYLE_ID = 'plannerPacksV720Styles';
  const MODAL_ID = 'plannerPacksV720Modal';
  const FILE_INPUT_ID = 'plannerPacksV720FileInput';
  const MAX_PACK_BYTES = 8 * 1024 * 1024;
  const MAX_INSTALLED_PACKS = 60;
  const MAX_ROOM_TEMPLATES = 40;
  const MAX_REQUIREMENT_PRESETS = 80;
  const MAX_CUSTOM_OBJECTS = 80;
  const MAX_ACTIVITY_LAYOUTS = 40;
  const MAX_ROTATION_BLUEPRINTS = 30;
  const MAX_TESTING_PROFILES = 20;

  const FORBIDDEN_PERSONAL_KEYS = new Set([
    'students', 'student', 'studentid', 'studentids', 'assignedstudentid', 'assignedstudentids',
    'mindistancestudentids', 'notesprivate', 'notessubstitute', 'notespublic', 'notecategories',
    'sourceuserid', 'gueststudentids', 'absentstudentids', 'rosterarchive', 'rosterimporthistory',
    'email', 'emails', 'studentemail', 'studentnumber'
  ]);

  const SHARED_PHYSICAL_TYPES = new Set([
    'door', 'wall', 'window', 'projector', 'board', 'carpet', 'ada', 'blocked',
    'shelf', 'cabinet', 'lab', 'sink', 'station', 'walkway'
  ]);

  let installed = false;
  let libraryLoaded = false;
  let installedPacks = [];
  let importDraft = null;
  let selectedPackId = 'builtin-classroom-essentials';
  let observer = null;
  let refreshFrame = 0;

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
  const nowIso = () => new Date().toISOString();
  const makeId = prefix => {
    try { if (typeof uid === 'function') return uid(prefix); } catch (_) { /* fallback */ }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  };
  const safeName = value => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 100);
  const keyText = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const stable = value => {
    try {
      if (typeof stableJsonStringify === 'function') return stableJsonStringify(value);
    } catch (_) { /* fallback */ }
    const seen = new WeakSet();
    const walk = item => {
      if (!item || typeof item !== 'object') return item;
      if (seen.has(item)) return null;
      seen.add(item);
      if (Array.isArray(item)) return item.map(walk);
      return Object.fromEntries(Object.keys(item).sort().map(key => [key, walk(item[key])]));
    };
    return JSON.stringify(walk(value));
  };
  const fingerprint = value => {
    const text = stable(value);
    try { if (typeof hashString === 'function') return String(hashString(text)); } catch (_) { /* fallback */ }
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  };

  function isPresentationMode() {
    return document.body?.classList?.contains('visibility-mode') || document.body?.classList?.contains('presentation-mode');
  }

  function meaningfulPersonalValue(value) {
    if (value === null || value === undefined || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    if (typeof value === 'boolean') return value;
    return true;
  }

  function personalDataFindings(value, path = 'pack', findings = []) {
    if (findings.length >= 40) return findings;
    if (Array.isArray(value)) {
      value.forEach((item, index) => personalDataFindings(item, `${path}[${index}]`, findings));
      return findings;
    }
    if (!value || typeof value !== 'object') return findings;
    Object.entries(value).forEach(([key, child]) => {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (FORBIDDEN_PERSONAL_KEYS.has(normalized) && meaningfulPersonalValue(child)) {
        findings.push(`${path}.${key}`);
        return;
      }
      personalDataFindings(child, `${path}.${key}`, findings);
    });
    return findings;
  }

  function sanitizeRequirementPreset(value, index = 0) {
    const source = value && typeof value === 'object' ? value : {};
    let normalized = null;
    try {
      if (typeof normalizeRequirementPreset === 'function') normalized = normalizeRequirementPreset(source, index);
    } catch (_) { /* fallback below */ }
    const requirements = clone(normalized?.requirements || source.requirements || {});
    return {
      id: String(source.id || normalized?.id || makeId('pack-requirement')),
      name: safeName(source.name || normalized?.name || `Requirement Preset ${index + 1}`) || `Requirement Preset ${index + 1}`,
      requirements: {
        front: ['none', 'prefer', 'require'].includes(requirements.front) ? requirements.front : 'none',
        side: ['none', 'left', 'right'].includes(requirements.side) ? requirements.side : 'none',
        nearTeacher: Boolean(requirements.nearTeacher),
        aisle: Boolean(requirements.aisle),
        ada: Boolean(requirements.ada),
        awayDoor: Boolean(requirements.awayDoor),
        awayWindow: Boolean(requirements.awayWindow),
        preferredZoneIds: [],
        excludedZoneIds: [],
        minDistanceStudentIds: []
      },
      description: String(source.description || '').trim().slice(0, 500)
    };
  }

  function sanitizeCustomObject(value) {
    let normalized = null;
    try { if (typeof normalizeCustomObject === 'function') normalized = normalizeCustomObject(value); } catch (_) { /* fallback */ }
    const source = normalized || (value && typeof value === 'object' ? value : null);
    if (!source) return null;
    const label = String(source.label || source.name || '').trim().slice(0, 40);
    if (!label) return null;
    return {
      ...clone(source),
      type: String(source.type || `custom-${keyText(label).replace(/ /g, '-') || 'object'}`).slice(0, 60),
      label
    };
  }

  function scrubCell(cell) {
    const next = clone(cell && typeof cell === 'object' ? cell : {});
    next.assignedStudentId = null;
    next.manual = false;
    if (Array.isArray(next.anchorGroupIds)) next.anchorGroupIds = [];
    return next;
  }

  function scrubFreeformObject(object, index = 0) {
    const next = clone(object && typeof object === 'object' ? object : {});
    next.assignedStudentId = null;
    next.manual = false;
    if (Array.isArray(next.anchorGroupIds)) next.anchorGroupIds = [];
    delete next.studentId;
    delete next.studentIds;
    delete next.notesPrivate;
    delete next.notesSubstitute;
    delete next.notesPublic;
    delete next.noteCategories;
    delete next.comment;
    try {
      if (typeof normalizeFreeformObject === 'function') return normalizeFreeformObject(next, index);
    } catch (_) { /* fallback below */ }
    return next;
  }

  function sanitizeRoomTemplate(value, index = 0, options = {}) {
    const source = clone(value && typeof value === 'object' ? value : {});
    let normalized = source;
    try {
      if (typeof normalizeRoomTemplateRecord === 'function') normalized = normalizeRoomTemplateRecord(source, index);
    } catch (_) { /* use cloned source */ }
    normalized = clone(normalized);
    normalized.id = String(source.id || normalized.id || makeId('pack-room-template'));
    normalized.name = safeName(source.name || normalized.name || `Room Template ${index + 1}`).slice(0, 60) || `Room Template ${index + 1}`;
    normalized.description = String(source.description || normalized.description || '').trim().slice(0, 500);
    normalized.librarySource = '';
    normalized.shared = true;
    normalized.cells = Object.fromEntries(Object.entries(normalized.cells || {}).map(([key, cell]) => [String(key), scrubCell(cell)]));
    normalized.zones = list(normalized.zones).map(zone => ({
      ...clone(zone),
      studentIds: [],
      groupIds: [],
      comment: ''
    }));
    normalized.customObjects = list(normalized.customObjects).map(sanitizeCustomObject).filter(Boolean);
    if (normalized.freeformLayout && typeof normalized.freeformLayout === 'object') {
      normalized.freeformLayout = clone(normalized.freeformLayout);
      normalized.freeformLayout.objects = list(normalized.freeformLayout.objects).map(scrubFreeformObject);
      normalized.freeformLayout.activityLayouts = null;
      normalized.freeformLayout.stationRotations = null;
      normalized.freeformLayout.testingMode = null;
      const background = normalized.freeformLayout.physicalRoom?.background;
      if (background && !options.includeFloorPlanImages) {
        background.dataUrl = '';
        background.name = background.name ? `${String(background.name).slice(0, 100)} (image excluded)` : '';
      }
    }
    return normalized;
  }

  function sanitizeActivityLayout(value, index = 0, sourceCanvas = null) {
    const source = value && typeof value === 'object' ? value : {};
    const groups = list(source.groups).slice(0, 60).map((group, groupIndex) => ({
      id: String(group?.id || `pack-layout-group-${index + 1}-${groupIndex + 1}`),
      name: safeName(group?.name || `Group ${groupIndex + 1}`).slice(0, 60) || `Group ${groupIndex + 1}`,
      color: String(group?.color || '#2f6fed').slice(0, 32),
      locked: Boolean(group?.locked)
    }));
    const allowedObjects = list(source.objects)
      .filter(object => object && !SHARED_PHYSICAL_TYPES.has(String(object.type || '')))
      .slice(0, 1000)
      .map((object, objectIndex) => {
        const clean = scrubFreeformObject(object, objectIndex);
        if (clean?.type === 'seat' && Array.isArray(clean.zoneIds)) clean.zoneIds = [];
        return clean;
      });
    return {
      id: String(source.id || makeId('pack-activity-layout')),
      name: safeName(source.name || `Activity Layout ${index + 1}`).slice(0, 80) || `Activity Layout ${index + 1}`,
      preset: String(source.preset || 'custom').slice(0, 40),
      description: String(source.description || '').trim().slice(0, 500),
      sourceCanvas: {
        width: clamp(source.sourceCanvas?.width ?? sourceCanvas?.width, 400, 12000, 2800),
        height: clamp(source.sourceCanvas?.height ?? sourceCanvas?.height, 300, 12000, 1800)
      },
      objects: allowedObjects,
      groups
    };
  }

  function activityLayoutName(id) {
    try {
      const store = window.ActivityLayoutsV701?.ensureStore?.({ reconcileActive:false });
      return String(store?.layouts?.find(entry => String(entry.id) === String(id || ''))?.name || '');
    } catch (_) {
      return '';
    }
  }

  function sanitizeRotationBlueprint(value, index = 0, candidates = []) {
    const source = value && typeof value === 'object' ? value : {};
    const candidateMap = new Map(list(candidates).map(item => [String(item.objectId || ''), item]));
    const sourceStations = list(source.stations).slice(0, 24);
    const stations = sourceStations.map((station, stationIndex) => {
      const candidate = candidateMap.get(String(station?.objectId || ''));
      return {
        name: safeName(station?.name || candidate?.name || `Station ${stationIndex + 1}`).slice(0, 80) || `Station ${stationIndex + 1}`,
        instructions: String(station?.instructions || '').trim().slice(0, 500),
        sourceObjectType: String(station?.sourceObjectType || candidate?.type || '').slice(0, 40),
        sourceObjectLabel: safeName(station?.sourceObjectLabel || candidate?.name || station?.name || '').slice(0, 80),
        order: stationIndex
      };
    });
    return {
      id: String(source.id || makeId('pack-rotation-blueprint')),
      name: safeName(source.name || `Station Rotation ${index + 1}`).slice(0, 80) || `Station Rotation ${index + 1}`,
      activityLayoutName: safeName(source.activityLayoutName || activityLayoutName(source.activityLayoutId)).slice(0, 80),
      durationMinutes: clamp(source.durationMinutes, 1, 180, 12),
      transitionMinutes: clamp(source.transitionMinutes, 0, 30, 2),
      teamSource: source.teamSource === 'classroom-groups' ? 'classroom-groups' : 'balanced',
      teamCount: clamp(source.teamCount ?? (list(source.teams).length || stations.length), 1, 24, Math.max(1, stations.length)),
      stations
    };
  }

  function testingUnit() {
    try {
      const room = window.ClassroomDigitalTwinV700?.physicalRoom?.(state?.freeformLayout);
      if (room?.enabled) return room.unit === 'm' ? 'm' : 'ft';
    } catch (_) { /* fallback */ }
    return 'seat-widths';
  }

  function sanitizeTestingProfile(value, index = 0, unit = testingUnit()) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      id: String(source.id || makeId('pack-testing-profile')),
      name: safeName(source.name || `Testing Profile ${index + 1}`).slice(0, 80) || `Testing Profile ${index + 1}`,
      spacing: Math.max(0.1, number(source.spacing, unit === 'm' ? 1.5 : unit === 'ft' ? 5 : 1.8)),
      unit: ['ft', 'm', 'seat-widths'].includes(source.unit) ? source.unit : unit,
      preserveLocked: source.preserveLocked !== false,
      respectNeeds: source.respectNeeds !== false,
      keepExtraSeatsNearEdges: source.keepExtraSeatsNearEdges !== false
    };
  }

  function normalizeContents(contents = {}, options = {}) {
    const source = contents && typeof contents === 'object' ? contents : {};
    return {
      roomTemplates: list(source.roomTemplates).slice(0, MAX_ROOM_TEMPLATES).map((item, index) => sanitizeRoomTemplate(item, index, options)),
      requirementPresets: list(source.requirementPresets).slice(0, MAX_REQUIREMENT_PRESETS).map(sanitizeRequirementPreset),
      customObjects: list(source.customObjects).slice(0, MAX_CUSTOM_OBJECTS).map(sanitizeCustomObject).filter(Boolean),
      activityLayouts: list(source.activityLayouts).slice(0, MAX_ACTIVITY_LAYOUTS).map((item, index) => sanitizeActivityLayout(item, index, item?.sourceCanvas)),
      rotationBlueprints: list(source.rotationBlueprints).slice(0, MAX_ROTATION_BLUEPRINTS).map((item, index) => sanitizeRotationBlueprint(item, index)),
      testingProfiles: list(source.testingProfiles).slice(0, MAX_TESTING_PROFILES).map(sanitizeTestingProfile)
    };
  }

  function packCoreForFingerprint(pack) {
    return {
      format: FORMAT,
      schemaVersion: SCHEMA_VERSION,
      name: pack.name,
      revision: pack.revision,
      publisher: pack.publisher,
      license: pack.license,
      tags: pack.tags,
      contents: pack.contents
    };
  }

  function normalizePack(value, options = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const contents = normalizeContents(source.contents || {}, { includeFloorPlanImages:options.includeFloorPlanImages !== false });
    const pack = {
      format: FORMAT,
      schemaVersion: SCHEMA_VERSION,
      id: String(source.id || makeId('planner-pack')).slice(0, 160),
      name: safeName(source.name || 'Planner Pack') || 'Planner Pack',
      revision: String(source.revision || '1.0.0').trim().slice(0, 40) || '1.0.0',
      description: String(source.description || '').trim().slice(0, 1200),
      publisher: safeName(source.publisher || '').slice(0, 100),
      license: String(source.license || 'CC BY 4.0').trim().slice(0, 100) || 'CC BY 4.0',
      homepage: String(source.homepage || '').trim().slice(0, 500),
      tags: [...new Set(list(source.tags).map(item => safeName(item).slice(0, 40)).filter(Boolean))].slice(0, 20),
      createdAt: String(source.createdAt || nowIso()).slice(0, 40),
      updatedAt: String(source.updatedAt || source.createdAt || nowIso()).slice(0, 40),
      appVersion: String(source.appVersion || source.version || VERSION).slice(0, 40),
      dataSchemaVersion: Math.max(1, Math.floor(number(source.dataSchemaVersion, typeof DATA_SCHEMA_VERSION === 'number' ? DATA_SCHEMA_VERSION : 13))),
      privacy: {
        studentDataIncluded: false,
        floorPlanImagesIncluded: Boolean(list(contents.roomTemplates).some(template => /^data:image\//i.test(String(template?.freeformLayout?.physicalRoom?.background?.dataUrl || '')))),
        freeTextReviewed: Boolean(source.privacy?.freeTextReviewed)
      },
      contents
    };
    pack.fingerprint = fingerprint(packCoreForFingerprint(pack));
    if (options.builtin) pack.builtin = true;
    if (source.installedAt) pack.installedAt = String(source.installedAt).slice(0, 40);
    return pack;
  }

  const BUILTIN_PACKS = Object.freeze([
    normalizePack({
      id: 'builtin-classroom-essentials',
      name: 'Classroom Essentials',
      revision: '1.0.0',
      description: 'A small starter pack of reusable seating-need presets and a quiet-testing profile. It contains no roster or student data.',
      publisher: 'Classroom Seating Planner',
      license: 'MIT',
      tags: ['starter', 'accessibility', 'testing'],
      createdAt: '2026-09-05T00:00:00Z',
      privacy: { freeTextReviewed:true },
      contents: {
        requirementPresets: [
          { name:'Prefer front', requirements:{ front:'prefer' }, description:'Prefer a seat nearer the configured front of the room.' },
          { name:'Require front', requirements:{ front:'require' }, description:'Require a seat in the front portion of the room.' },
          { name:'Aisle access', requirements:{ aisle:true }, description:'Prefer seating with practical aisle access.' },
          { name:'Accessibility priority', requirements:{ ada:true, aisle:true }, description:'Prioritize an accessible seating area and aisle access.' }
        ],
        testingProfiles: [
          { name:'Quiet testing', spacing:5, unit:'ft', preserveLocked:true, respectNeeds:true, keepExtraSeatsNearEdges:true }
        ]
      }
    }, { builtin:true, includeFloorPlanImages:true })
  ]);

  function packCounts(pack) {
    const contents = pack?.contents || {};
    return {
      roomTemplates: list(contents.roomTemplates).length,
      requirementPresets: list(contents.requirementPresets).length,
      customObjects: list(contents.customObjects).length,
      activityLayouts: list(contents.activityLayouts).length,
      rotationBlueprints: list(contents.rotationBlueprints).length,
      testingProfiles: list(contents.testingProfiles).length
    };
  }

  function packItemCount(pack) {
    return Object.values(packCounts(pack)).reduce((sum, value) => sum + Number(value || 0), 0);
  }

  function assertPack(value, sourceLabel = 'Planner Pack') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${sourceLabel} is not a JSON object.`);
    if (String(value.format || '') !== FORMAT) throw new Error(`${sourceLabel} is not a supported Planner Pack file.`);
    if (Number(value.schemaVersion || 0) !== SCHEMA_VERSION) throw new Error(`${sourceLabel} uses an unsupported Planner Pack schema version.`);
    if (!value.contents || typeof value.contents !== 'object' || Array.isArray(value.contents)) throw new Error(`${sourceLabel} has no valid contents object.`);
    if (value.privacy?.studentDataIncluded === true) throw new Error(`${sourceLabel} declares that it contains student data. Planner Packs are reusable configuration only, so this file is refused.`);
    const findings = personalDataFindings(value);
    if (findings.length) throw new Error(`${sourceLabel} contains student/roster fields that Planner Packs do not accept (${findings.slice(0, 3).join(', ')}${findings.length > 3 ? ', …' : ''}). Remove personal classroom data and export again.`);
    const counts = {
      roomTemplates:list(value.contents.roomTemplates).length,
      requirementPresets:list(value.contents.requirementPresets).length,
      customObjects:list(value.contents.customObjects).length,
      activityLayouts:list(value.contents.activityLayouts).length,
      rotationBlueprints:list(value.contents.rotationBlueprints).length,
      testingProfiles:list(value.contents.testingProfiles).length
    };
    if (counts.roomTemplates > MAX_ROOM_TEMPLATES || counts.requirementPresets > MAX_REQUIREMENT_PRESETS || counts.customObjects > MAX_CUSTOM_OBJECTS || counts.activityLayouts > MAX_ACTIVITY_LAYOUTS || counts.rotationBlueprints > MAX_ROTATION_BLUEPRINTS || counts.testingProfiles > MAX_TESTING_PROFILES) {
      throw new Error(`${sourceLabel} contains more components than V7.2 allows in one pack.`);
    }
    return true;
  }

  function currentRoomTemplate(options = {}) {
    const raw = {
      id: makeId('pack-current-room'),
      name: String(options.name || 'Current Room Layout').trim().slice(0, 60) || 'Current Room Layout',
      rows: state?.rows,
      cols: state?.cols,
      cells: state?.cells,
      layoutMode: state?.layoutMode,
      freeformLayout: state?.freeformLayout,
      zones: state?.zones,
      customObjects: state?.customObjects,
      description: 'Reusable room layout captured from the active classroom.',
      shared: true,
      createdAt: nowIso()
    };
    return sanitizeRoomTemplate(raw, 0, options);
  }

  function currentActivityLayouts() {
    if (state?.layoutMode !== 'freeform') return [];
    try {
      const api = window.ActivityLayoutsV701;
      const store = api?.ensureStore?.({ reconcileActive:true });
      const canvas = state?.freeformLayout?.canvas || {};
      return list(store?.layouts).map((entry, index) => sanitizeActivityLayout(entry, index, canvas));
    } catch (_) {
      return [];
    }
  }

  function currentRotationBlueprints() {
    if (state?.layoutMode !== 'freeform') return [];
    try {
      const api = window.StationRotationsV702;
      const store = api?.ensureStore?.();
      const candidates = api?.stationCandidates?.() || [];
      return list(store?.plans).map((plan, index) => sanitizeRotationBlueprint(plan, index, candidates));
    } catch (_) {
      return [];
    }
  }

  function currentTestingProfiles() {
    if (state?.layoutMode !== 'freeform') return [];
    try {
      const store = window.TestingModeV703?.ensureStore?.();
      if (!store?.lastConfig) return [];
      return [sanitizeTestingProfile({ ...store.lastConfig, name:store.lastConfig.name || 'Testing Profile', unit:testingUnit() }, 0, testingUnit())];
    } catch (_) {
      return [];
    }
  }

  function buildPack(options = {}) {
    const includeFloorPlanImages = Boolean(options.includeFloorPlanImages);
    const contents = {
      roomTemplates: [],
      requirementPresets: [],
      customObjects: [],
      activityLayouts: [],
      rotationBlueprints: [],
      testingProfiles: []
    };
    if (options.includeCurrentRoom !== false) contents.roomTemplates.push(currentRoomTemplate({ includeFloorPlanImages }));
    if (options.includeRoomTemplates) {
      list(state?.roomTemplates).forEach((template, index) => contents.roomTemplates.push(sanitizeRoomTemplate(template, index + contents.roomTemplates.length, { includeFloorPlanImages })));
    }
    if (options.includeRequirementPresets !== false) contents.requirementPresets = list(state?.requirementPresets).map(sanitizeRequirementPreset);
    if (options.includeCustomObjects !== false) contents.customObjects = list(state?.customObjects).map(sanitizeCustomObject).filter(Boolean);
    if (options.includeActivityLayouts !== false) contents.activityLayouts = currentActivityLayouts();
    if (options.includeRotationBlueprints !== false) contents.rotationBlueprints = currentRotationBlueprints();
    if (options.includeTestingProfiles !== false) contents.testingProfiles = currentTestingProfiles();
    const pack = normalizePack({
      format:FORMAT,
      schemaVersion:SCHEMA_VERSION,
      id:String(options.id || makeId('planner-pack')),
      name:options.name || 'My Planner Pack',
      revision:options.revision || '1.0.0',
      description:options.description || '',
      publisher:options.publisher || '',
      license:options.license || 'CC BY 4.0',
      homepage:options.homepage || '',
      tags:String(options.tags || '').split(',').map(item => item.trim()).filter(Boolean),
      createdAt:nowIso(),
      updatedAt:nowIso(),
      appVersion:VERSION,
      dataSchemaVersion:typeof DATA_SCHEMA_VERSION === 'number' ? DATA_SCHEMA_VERSION : 13,
      privacy:{ freeTextReviewed:Boolean(options.freeTextReviewed) },
      contents
    }, { includeFloorPlanImages:true });
    assertPack(pack, 'Generated Planner Pack');
    if (JSON.stringify(pack).length > MAX_PACK_BYTES) throw new Error('This Planner Pack is larger than the V7.2 8 MB pack limit. Remove embedded floor-plan images or export fewer components.');
    return pack;
  }

  async function loadLibrary() {
    let stored = null;
    try { stored = await BrowserDataStore?.getRecord?.(STORAGE_KEY); } catch (_) { stored = null; }
    const raw = Array.isArray(stored?.value?.packs) ? stored.value.packs : Array.isArray(stored?.value) ? stored.value : [];
    installedPacks = raw.slice(0, MAX_INSTALLED_PACKS).map(item => {
      try {
        assertPack(item, 'Installed Planner Pack');
        return normalizePack(item, { includeFloorPlanImages:true });
      } catch (_) {
        return null;
      }
    }).filter(Boolean);
    libraryLoaded = true;
    return installedPacks.map(clone);
  }

  async function saveLibrary() {
    const payload = { version:1, packs:installedPacks.slice(0, MAX_INSTALLED_PACKS).map(pack => ({ ...clone(pack), builtin:undefined })), updatedAt:nowIso() };
    try {
      const ok = await BrowserDataStore?.putRecord?.(STORAGE_KEY, payload, { kind:'planner-pack-library' });
      if (!ok) throw new Error('Browser storage did not accept the Planner Pack library.');
      return true;
    } catch (error) {
      announce(`Planner Pack library could not be saved: ${error?.message || error}`);
      return false;
    }
  }

  function allPacks() {
    return [...BUILTIN_PACKS.map(clone), ...installedPacks.map(clone)];
  }

  function packById(id) {
    const value = String(id || '');
    return allPacks().find(pack => String(pack.id) === value) || null;
  }

  async function installPack(value) {
    assertPack(value, 'Imported Planner Pack');
    const pack = normalizePack(value, { includeFloorPlanImages:true });
    const existingIndex = installedPacks.findIndex(item => String(item.id) === String(pack.id));
    pack.installedAt = nowIso();
    if (existingIndex >= 0) installedPacks.splice(existingIndex, 1, pack);
    else {
      const sameFingerprint = installedPacks.find(item => item.fingerprint === pack.fingerprint);
      if (sameFingerprint) return clone(sameFingerprint);
      if (installedPacks.length >= MAX_INSTALLED_PACKS) throw new Error(`This browser already has ${MAX_INSTALLED_PACKS} installed Planner Packs. Remove one before installing another.`);
      installedPacks.unshift(pack);
    }
    await saveLibrary();
    selectedPackId = pack.id;
    refreshUi();
    announce(`${pack.name} installed in this browser. No classroom data changed.`);
    return clone(pack);
  }

  async function deletePack(id) {
    const value = String(id || '');
    const before = installedPacks.length;
    installedPacks = installedPacks.filter(pack => String(pack.id) !== value);
    if (installedPacks.length === before) return false;
    await saveLibrary();
    if (selectedPackId === value) selectedPackId = BUILTIN_PACKS[0].id;
    refreshUi();
    announce('Planner Pack removed from this browser library. Previously applied classroom content was not deleted.');
    return true;
  }

  function canonicalRoomTemplate(template) {
    const copy = clone(template);
    delete copy.id;
    delete copy.createdAt;
    delete copy.librarySource;
    return copy;
  }

  function roomTemplateKey(template) {
    return `${keyText(template?.name)}|${fingerprint(canonicalRoomTemplate(template))}`;
  }

  function requirementPresetKey(preset) {
    return `${keyText(preset?.name)}|${fingerprint(preset?.requirements || {})}`;
  }

  function customObjectKey(object) {
    return `${String(object?.type || '')}|${keyText(object?.label || object?.name)}`;
  }

  function arrangementKey(entry) {
    return `${keyText(entry?.name)}|${fingerprint({ objects:entry?.objects || [], groups:entry?.groups || [] })}`;
  }

  function currentStationCandidates() {
    try { return list(window.StationRotationsV702?.stationCandidates?.()); } catch (_) { return []; }
  }

  function matchRotationStations(blueprint, candidates = currentStationCandidates()) {
    const available = list(candidates).map(item => ({ ...item }));
    const used = new Set();
    const mappings = [];
    const unresolved = [];
    list(blueprint?.stations).forEach((station, stationIndex) => {
      const expectedNames = [...new Set([station?.name, station?.sourceObjectLabel].map(keyText).filter(Boolean))];
      const exact = available.filter(candidate => !used.has(String(candidate.objectId)) && expectedNames.includes(keyText(candidate.name)));
      let match = exact.length === 1 ? exact[0] : null;
      let confidence = match ? 'name' : '';
      if (!match && station?.sourceObjectType) {
        const typed = available.filter(candidate => !used.has(String(candidate.objectId)) && String(candidate.type) === String(station.sourceObjectType));
        if (typed.length === 1) {
          match = typed[0];
          confidence = 'unique-type';
        }
      }
      if (!match) {
        unresolved.push({ index:stationIndex, station:clone(station), reason:exact.length > 1 ? 'More than one current station has this name.' : 'No unique current station matches this pack station.' });
        return;
      }
      used.add(String(match.objectId));
      mappings.push({ index:stationIndex, station:clone(station), candidate:clone(match), confidence });
    });
    return { mappings, unresolved, complete:unresolved.length === 0 && mappings.length === list(blueprint?.stations).length };
  }

  function prepareActivityLayout(entry) {
    if (state?.layoutMode !== 'freeform' || !state?.freeformLayout) return { ok:false, reason:'Activity Layout packs require a Freeform room.' };
    const liveObjects = list(state.freeformLayout.objects);
    const liveSeats = liveObjects.filter(object => object?.type === 'seat').slice().sort((a, b) => number(a.y) - number(b.y) || number(a.x) - number(b.x) || String(a.id || '').localeCompare(String(b.id || '')));
    const sourceSeats = list(entry?.objects).filter(object => object?.type === 'seat').slice().sort((a, b) => number(a.y) - number(b.y) || number(a.x) - number(b.x) || String(a.id || '').localeCompare(String(b.id || '')));
    if (sourceSeats.length !== liveSeats.length) return { ok:false, reason:`${entry?.name || 'This Activity Layout'} has ${sourceSeats.length} seats but the current Freeform room has ${liveSeats.length}. Seat counts must match so student assignments are not silently changed.` };
    const sourceCanvas = entry?.sourceCanvas || { width:2800, height:1800 };
    const targetCanvas = state.freeformLayout.canvas || { width:2800, height:1800 };
    const sx = Math.max(0.01, number(targetCanvas.width, 2800) / Math.max(1, number(sourceCanvas.width, 2800)));
    const sy = Math.max(0.01, number(targetCanvas.height, 1800) / Math.max(1, number(sourceCanvas.height, 1800)));
    const groups = list(entry?.groups).map((group, index) => ({ ...clone(group), id:makeId(`pack-layout-group-${index + 1}`) }));
    const groupMap = new Map(list(entry?.groups).map((group, index) => [String(group?.id || ''), groups[index]?.id]));
    const sourceSeatOrder = new Map(sourceSeats.map((seat, index) => [String(seat.id || `seat-${index}`), index]));
    const objects = list(entry?.objects).map((object, index) => {
      const next = scrubFreeformObject(object, index);
      next.x = number(next.x) * sx;
      next.y = number(next.y) * sy;
      next.width = Math.max(1, number(next.width, next.type === 'seat' ? 176 : 160) * sx);
      next.height = Math.max(1, number(next.height, next.type === 'seat' ? 112 : 96) * sy);
      if (next.groupId && groupMap.has(String(next.groupId))) next.groupId = groupMap.get(String(next.groupId));
      if (next.type === 'seat') {
        const position = sourceSeatOrder.get(String(object?.id || ''));
        const live = Number.isInteger(position) ? liveSeats[position] : null;
        if (live) {
          next.id = String(live.id || next.id || makeId('seat'));
          if (live.cellKey) next.cellKey = String(live.cellKey);
          else delete next.cellKey;
        }
      } else {
        next.id = makeId(`pack-layout-${String(next.type || 'object')}`);
      }
      return next;
    });
    return {
      ok:true,
      remappedSeatCount:liveSeats.length,
      entry:{
        id:makeId('activity-layout'),
        name:String(entry?.name || 'Imported Activity Layout').slice(0, 80),
        preset:String(entry?.preset || 'custom'),
        description:String(entry?.description || '').slice(0, 500),
        createdAt:nowIso(),
        updatedAt:nowIso(),
        objects,
        groups
      }
    };
  }

  function previewApply(pack, selection = {}) {
    const selected = {
      roomTemplates: selection.roomTemplates !== false,
      requirementPresets: selection.requirementPresets !== false,
      customObjects: selection.customObjects !== false,
      activityLayouts: selection.activityLayouts !== false,
      rotationBlueprints: selection.rotationBlueprints !== false,
      testingProfiles: selection.testingProfiles !== false
    };
    const currentRoomKeys = new Set(list(state?.roomTemplates).map(roomTemplateKey));
    const currentRequirementKeys = new Set(list(state?.requirementPresets).map(item => requirementPresetKey(sanitizeRequirementPreset(item))));
    const currentObjectKeys = new Set(list(state?.customObjects).map(item => customObjectKey(sanitizeCustomObject(item))));
    let activityStore = null;
    try { activityStore = window.ActivityLayoutsV701?.ensureStore?.({ reconcileActive:true }); } catch (_) { activityStore = null; }
    const currentArrangementKeys = new Set(list(activityStore?.layouts).map(item => arrangementKey(sanitizeActivityLayout(item, 0, state?.freeformLayout?.canvas))));
    const result = {
      selected,
      roomTemplates:{ add:0, skip:0 },
      requirementPresets:{ add:0, skip:0 },
      customObjects:{ add:0, skip:0 },
      activityLayouts:{ add:0, skip:0, blocked:[] },
      rotationBlueprints:{ add:0, blocked:[] },
      testingProfiles:{ add:0, blocked:[] },
      warnings:[]
    };
    if (selected.roomTemplates) list(pack?.contents?.roomTemplates).forEach(item => currentRoomKeys.has(roomTemplateKey(item)) ? result.roomTemplates.skip++ : result.roomTemplates.add++);
    if (selected.requirementPresets) list(pack?.contents?.requirementPresets).forEach(item => currentRequirementKeys.has(requirementPresetKey(item)) ? result.requirementPresets.skip++ : result.requirementPresets.add++);
    if (selected.customObjects) list(pack?.contents?.customObjects).forEach(item => currentObjectKeys.has(customObjectKey(item)) ? result.customObjects.skip++ : result.customObjects.add++);
    if (selected.activityLayouts) {
      if (state?.layoutMode !== 'freeform' || !activityStore) result.activityLayouts.blocked.push('Activity Layout content needs a Freeform room.');
      else list(pack?.contents?.activityLayouts).forEach(item => {
        const prepared = prepareActivityLayout(item);
        if (!prepared.ok) result.activityLayouts.blocked.push(prepared.reason);
        else if (currentArrangementKeys.has(arrangementKey(item))) result.activityLayouts.skip++;
        else result.activityLayouts.add++;
      });
    }
    if (selected.rotationBlueprints) {
      if (state?.layoutMode !== 'freeform' || !window.StationRotationsV702) result.rotationBlueprints.blocked.push('Station Rotation blueprints need a Freeform room and Station Rotations.');
      else list(pack?.contents?.rotationBlueprints).forEach(blueprint => {
        const match = matchRotationStations(blueprint);
        if (match.complete && match.mappings.length >= 2) result.rotationBlueprints.add++;
        else result.rotationBlueprints.blocked.push(`${blueprint.name}: ${match.unresolved.length ? match.unresolved.map(item => item.station.name).join(', ') + ' could not be matched uniquely.' : 'At least two stations are required.'}`);
      });
    }
    if (selected.testingProfiles) {
      if (state?.layoutMode !== 'freeform' || !window.TestingModeV703) result.testingProfiles.blocked.push('Testing profiles need a Freeform room and Testing Mode.');
      else result.testingProfiles.add = Math.min(1, list(pack?.contents?.testingProfiles).length);
    }
    if (pack?.privacy?.floorPlanImagesIncluded) result.warnings.push('This pack contains embedded floor-plan images. Review them for student or classroom-identifying information before sharing or applying the related room template.');
    result.warnings.push('Pack names, descriptions, object labels, and station instructions are shared as written. V7.2 blocks structured roster/student fields but cannot decide whether free text identifies someone.');
    return result;
  }

  function uniqueName(base, values) {
    const root = safeName(base || 'Imported') || 'Imported';
    const names = new Set(list(values).map(item => keyText(item?.name)));
    if (!names.has(keyText(root))) return root;
    for (let index = 2; index < 100; index += 1) {
      const candidate = `${root} ${index}`.slice(0, 100);
      if (!names.has(keyText(candidate))) return candidate;
    }
    return `${root} ${Date.now().toString(36)}`.slice(0, 100);
  }

  function convertTestingSpacing(profile) {
    const sourceUnit = profile?.unit || 'seat-widths';
    const targetUnit = testingUnit();
    let spacing = number(profile?.spacing, targetUnit === 'm' ? 1.5 : targetUnit === 'ft' ? 5 : 1.8);
    if (sourceUnit === 'ft' && targetUnit === 'm') spacing *= 0.3048;
    else if (sourceUnit === 'm' && targetUnit === 'ft') spacing /= 0.3048;
    return spacing;
  }

  async function applyPack(packInput, selection = {}) {
    const pack = normalizePack(packInput, { includeFloorPlanImages:true });
    const preview = previewApply(pack, selection);
    const selected = preview.selected;
    const summary = { roomTemplates:0, requirementPresets:0, customObjects:0, activityLayouts:0, rotationBlueprints:0, testingProfiles:0, skipped:0, warnings:[...preview.warnings] };
    try { if (typeof pushUndoSnapshot === 'function') pushUndoSnapshot(`Before Planner Pack: ${pack.name}`); } catch (_) { /* optional */ }

    if (selected.roomTemplates) {
      state.roomTemplates = list(state.roomTemplates);
      const existing = new Set(state.roomTemplates.map(roomTemplateKey));
      list(pack.contents.roomTemplates).forEach((template, index) => {
        const key = roomTemplateKey(template);
        if (existing.has(key)) { summary.skipped++; return; }
        const next = sanitizeRoomTemplate(template, index, { includeFloorPlanImages:true });
        next.id = makeId('room-template');
        next.name = uniqueName(next.name, state.roomTemplates);
        next.librarySource = pack.name;
        next.shared = true;
        next.createdAt = nowIso();
        try { if (typeof normalizeRoomTemplateRecord === 'function') state.roomTemplates.push(normalizeRoomTemplateRecord(next, state.roomTemplates.length)); else state.roomTemplates.push(next); }
        catch (_) { state.roomTemplates.push(next); }
        existing.add(roomTemplateKey(next));
        summary.roomTemplates++;
      });
    }

    if (selected.requirementPresets) {
      state.requirementPresets = list(state.requirementPresets);
      const existing = new Set(state.requirementPresets.map(item => requirementPresetKey(sanitizeRequirementPreset(item))));
      list(pack.contents.requirementPresets).forEach((preset, index) => {
        const clean = sanitizeRequirementPreset(preset, index);
        const key = requirementPresetKey(clean);
        if (existing.has(key)) { summary.skipped++; return; }
        clean.id = makeId('requirement-preset');
        clean.name = uniqueName(clean.name, state.requirementPresets);
        clean.createdAt = nowIso();
        clean.updatedAt = clean.createdAt;
        try { if (typeof normalizeRequirementPreset === 'function') state.requirementPresets.push(normalizeRequirementPreset(clean, state.requirementPresets.length)); else state.requirementPresets.push(clean); }
        catch (_) { state.requirementPresets.push(clean); }
        existing.add(requirementPresetKey(clean));
        summary.requirementPresets++;
      });
    }

    if (selected.customObjects) {
      state.customObjects = list(state.customObjects);
      const existing = new Set(state.customObjects.map(item => customObjectKey(sanitizeCustomObject(item))));
      list(pack.contents.customObjects).forEach(object => {
        const clean = sanitizeCustomObject(object);
        if (!clean) return;
        const key = customObjectKey(clean);
        if (existing.has(key)) { summary.skipped++; return; }
        let normalized = clean;
        try { if (typeof normalizeCustomObject === 'function') normalized = normalizeCustomObject(clean) || clean; } catch (_) { /* keep clean */ }
        state.customObjects.push(normalized);
        existing.add(customObjectKey(normalized));
        summary.customObjects++;
      });
    }

    if (selected.activityLayouts && state?.layoutMode === 'freeform' && window.ActivityLayoutsV701) {
      const store = window.ActivityLayoutsV701.ensureStore?.({ reconcileActive:true });
      if (store) {
        const existing = new Set(list(store.layouts).map(item => arrangementKey(sanitizeActivityLayout(item, 0, state.freeformLayout?.canvas))));
        list(pack.contents.activityLayouts).forEach(item => {
          const prepared = prepareActivityLayout(item);
          if (!prepared.ok) { summary.warnings.push(prepared.reason); return; }
          const originalKey = arrangementKey(item);
          if (existing.has(originalKey)) { summary.skipped++; return; }
          prepared.entry.name = uniqueName(prepared.entry.name, store.layouts);
          store.layouts.push(prepared.entry);
          existing.add(originalKey);
          summary.activityLayouts++;
        });
        state.freeformLayout.activityLayouts = store;
      }
    }

    if (selected.rotationBlueprints && state?.layoutMode === 'freeform' && window.StationRotationsV702) {
      list(pack.contents.rotationBlueprints).forEach(blueprint => {
        const match = matchRotationStations(blueprint);
        if (!match.complete || match.mappings.length < 2) {
          summary.warnings.push(`${blueprint.name} was not created because every station could not be matched uniquely in the current room.`);
          return;
        }
        const plan = window.StationRotationsV702.createPlan?.({
          name:blueprint.name,
          durationMinutes:blueprint.durationMinutes,
          transitionMinutes:blueprint.transitionMinutes,
          teamSource:blueprint.teamSource,
          teamCount:Math.min(blueprint.teamCount, match.mappings.length),
          stationIds:match.mappings.map(item => item.candidate.objectId)
        });
        if (!plan) {
          summary.warnings.push(`${blueprint.name} could not be created in Station Rotations.`);
          return;
        }
        match.mappings.forEach(mapping => {
          const station = list(plan.stations).find(item => String(item.objectId) === String(mapping.candidate.objectId));
          if (station) station.instructions = String(mapping.station.instructions || '').slice(0, 500);
        });
        plan.updatedAt = nowIso();
        summary.rotationBlueprints++;
      });
    }

    if (selected.testingProfiles && state?.layoutMode === 'freeform' && window.TestingModeV703) {
      const profile = list(pack.contents.testingProfiles)[0];
      const store = profile ? window.TestingModeV703.ensureStore?.() : null;
      if (profile && store) {
        store.lastConfig = {
          name:profile.name,
          spacing:convertTestingSpacing(profile),
          preserveLocked:profile.preserveLocked,
          respectNeeds:profile.respectNeeds,
          keepExtraSeatsNearEdges:profile.keepExtraSeatsNearEdges
        };
        state.freeformLayout.testingMode = store;
        summary.testingProfiles = 1;
      }
    }

    try { if (typeof persistActiveClass === 'function') persistActiveClass(); } catch (_) { /* best effort */ }
    try { if (typeof scheduleLinkedFileAutosave === 'function') scheduleLinkedFileAutosave('planner-pack-apply'); } catch (_) { /* optional */ }
    try { if (typeof scheduleLinkedAutoSave === 'function') scheduleLinkedAutoSave('planner-pack-apply'); } catch (_) { /* optional */ }
    try { if (typeof renderAll === 'function') renderAll(); } catch (_) { /* UI refresh below */ }
    try { window.ActivityLayoutsV701?.refresh?.(); } catch (_) { /* optional */ }
    try { window.StationRotationsV702?.refresh?.(); } catch (_) { /* optional */ }
    try { window.TestingModeV703?.refresh?.(); } catch (_) { /* optional */ }
    refreshUi();
    const applied = summary.roomTemplates + summary.requirementPresets + summary.customObjects + summary.activityLayouts + summary.rotationBlueprints + summary.testingProfiles;
    announce(`${pack.name}: ${applied} reusable item${applied === 1 ? '' : 's'} applied. ${summary.skipped ? `${summary.skipped} duplicate${summary.skipped === 1 ? '' : 's'} skipped. ` : ''}Student assignments were not imported from the pack.`);
    return summary;
  }

  function exportPack(packInput) {
    const pack = normalizePack(packInput, { includeFloorPlanImages:true });
    const safeFile = keyText(pack.name).replace(/ /g, '-').slice(0, 50) || 'planner-pack';
    const payload = { ...clone(pack) };
    delete payload.builtin;
    delete payload.installedAt;
    downloadText(`${safeFile}-${pack.revision}.plannerpack.json`, JSON.stringify(payload, null, 2), 'application/json');
    return payload;
  }

  async function readPackFile(file) {
    if (!file) return null;
    const text = await readTextFileWithinLimits(file, 'Planner Pack', MAX_PACK_BYTES);
    const parsed = JSON.parse(text);
    assertPack(parsed, file.name || 'Planner Pack');
    return normalizePack(parsed, { includeFloorPlanImages:true });
  }

  function componentSummaryMarkup(pack) {
    const counts = packCounts(pack);
    const labels = [
      ['roomTemplates', 'room templates'], ['requirementPresets', 'need presets'], ['customObjects', 'custom objects'],
      ['activityLayouts', 'activity layouts'], ['rotationBlueprints', 'rotation blueprints'], ['testingProfiles', 'testing profiles']
    ];
    return labels.filter(([key]) => counts[key]).map(([key, label]) => `<span class="v720-count-chip"><b>${counts[key]}</b> ${esc(label)}</span>`).join('') || '<span class="muted">No reusable components</span>';
  }

  function libraryCardMarkup(pack) {
    const selected = String(pack.id) === String(selectedPackId);
    return `<button type="button" class="v720-pack-card${selected ? ' active' : ''}" data-v720-select-pack="${esc(pack.id)}" aria-pressed="${selected ? 'true' : 'false'}"><span class="v720-pack-card-head"><strong>${esc(pack.name)}</strong>${pack.builtin ? '<span class="pill">Built in</span>' : ''}</span><span>${esc(pack.publisher || 'Local pack')} · r${esc(pack.revision)}</span><small>${packItemCount(pack)} reusable item${packItemCount(pack) === 1 ? '' : 's'}</small></button>`;
  }

  function selectedPackMarkup(pack) {
    if (!pack) return '<div class="hint">Choose a Planner Pack from the library.</div>';
    const preview = previewApply(pack);
    const counts = packCounts(pack);
    const rows = [
      ['roomTemplates', 'Room templates', counts.roomTemplates, preview.roomTemplates.add, preview.roomTemplates.skip, preview.activityLayouts.blocked?.length ? '' : ''],
      ['requirementPresets', 'Student-need presets', counts.requirementPresets, preview.requirementPresets.add, preview.requirementPresets.skip, ''],
      ['customObjects', 'Custom room objects', counts.customObjects, preview.customObjects.add, preview.customObjects.skip, ''],
      ['activityLayouts', 'Activity Layouts', counts.activityLayouts, preview.activityLayouts.add, preview.activityLayouts.skip, preview.activityLayouts.blocked.join(' ')],
      ['rotationBlueprints', 'Station Rotation blueprints', counts.rotationBlueprints, preview.rotationBlueprints.add, 0, preview.rotationBlueprints.blocked.join(' ')],
      ['testingProfiles', 'Testing profile', counts.testingProfiles, preview.testingProfiles.add, 0, preview.testingProfiles.blocked.join(' ')]
    ].filter(row => row[2] > 0);
    const componentRows = rows.length ? rows.map(([key, label, count, add, skip, blocked]) => `<label class="v720-apply-row${blocked ? ' blocked' : ''}"><input type="checkbox" data-v720-apply-kind="${key}"${blocked ? ' disabled' : ' checked'} /><span><strong>${esc(label)}</strong><small>${count} in pack · ${add} new${skip ? ` · ${skip} duplicate${skip === 1 ? '' : 's'}` : ''}${blocked ? ` · ${esc(blocked)}` : ''}</small></span></label>`).join('') : '<div class="hint">This pack has no components to apply.</div>';
    const warnings = preview.warnings.length ? `<div class="v720-warning"><strong>Share/apply review</strong><ul>${preview.warnings.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : '';
    return `<div class="v720-pack-detail"><header><div><span class="v720-kicker">${pack.builtin ? 'Bundled pack' : 'Installed pack'}</span><h3>${esc(pack.name)}</h3><p>${esc(pack.description || 'No description provided.')}</p></div><div class="v720-meta"><span>Revision <b>${esc(pack.revision)}</b></span><span>License <b>${esc(pack.license)}</b></span><span>Publisher <b>${esc(pack.publisher || 'Not specified')}</b></span></div></header><div class="v720-tags">${pack.tags.map(tag => `<span class="pill">${esc(tag)}</span>`).join('')}</div><div class="v720-component-chips">${componentSummaryMarkup(pack)}</div>${warnings}<section class="v720-apply-section"><div><h4>Apply to the current planner</h4><p>Choose what to add. Applying is additive: it installs templates/presets or creates reusable plans. It never imports a roster or student assignment from the pack.</p></div><div class="v720-apply-list">${componentRows}</div><div class="button-row"><button id="plannerPacksV720ApplyBtn" type="button"${rows.length ? '' : ' disabled'}>Apply selected content</button><button id="plannerPacksV720ExportSelectedBtn" class="secondary" type="button">Export pack file</button>${pack.builtin ? '' : '<button id="plannerPacksV720DeleteBtn" class="danger" type="button">Remove from library</button>'}</div></section></div>`;
  }

  function builderAvailability() {
    let layouts = 0;
    let rotations = 0;
    let testing = 0;
    if (state?.layoutMode === 'freeform') {
      try { layouts = list(window.ActivityLayoutsV701?.ensureStore?.({ reconcileActive:true })?.layouts).length; } catch (_) { layouts = 0; }
      try { rotations = list(window.StationRotationsV702?.ensureStore?.()?.plans).length; } catch (_) { rotations = 0; }
      try { testing = window.TestingModeV703?.ensureStore?.()?.lastConfig ? 1 : 0; } catch (_) { testing = 0; }
    }
    return {
      currentRoom:1,
      roomTemplates:list(state?.roomTemplates).length,
      requirementPresets:list(state?.requirementPresets).length,
      customObjects:list(state?.customObjects).length,
      activityLayouts:layouts,
      rotationBlueprints:rotations,
      testingProfiles:testing
    };
  }

  function builderMarkup() {
    const counts = builderAvailability();
    const hasImage = Boolean(state?.freeformLayout?.physicalRoom?.background?.dataUrl) || list(state?.roomTemplates).some(template => template?.freeformLayout?.physicalRoom?.background?.dataUrl);
    return `<div class="v720-builder"><div class="v720-builder-grid"><label>Pack name<input id="plannerPacksV720BuildName" maxlength="100" value="My Planner Pack" /></label><label>Revision<input id="plannerPacksV720BuildRevision" maxlength="40" value="1.0.0" /></label><label>Publisher / credit<input id="plannerPacksV720BuildPublisher" maxlength="100" placeholder="Your name, school team, or district" /></label><label>License<select id="plannerPacksV720BuildLicense"><option value="CC BY 4.0">CC BY 4.0 (attribution)</option><option value="CC0 1.0">CC0 1.0</option><option value="MIT">MIT</option><option value="Custom / unspecified">Custom / unspecified</option></select></label><label class="wide">Description<textarea id="plannerPacksV720BuildDescription" rows="3" maxlength="1200" placeholder="What this pack is for and when another teacher should use it."></textarea></label><label class="wide">Tags<input id="plannerPacksV720BuildTags" maxlength="300" placeholder="elementary, science-lab, testing, flexible-seating" /></label></div><section class="v720-build-contents"><h4>Reusable content</h4><div class="v720-build-checks"><label><input type="checkbox" data-v720-build-kind="includeCurrentRoom" checked /> Current room as a reusable template <span>${counts.currentRoom}</span></label><label><input type="checkbox" data-v720-build-kind="includeRoomTemplates"${counts.roomTemplates ? ' checked' : ''}${counts.roomTemplates ? '' : ' disabled'} /> Saved room-template library <span>${counts.roomTemplates}</span></label><label><input type="checkbox" data-v720-build-kind="includeRequirementPresets"${counts.requirementPresets ? ' checked' : ''}${counts.requirementPresets ? '' : ' disabled'} /> Student-need presets <span>${counts.requirementPresets}</span></label><label><input type="checkbox" data-v720-build-kind="includeCustomObjects"${counts.customObjects ? ' checked' : ''}${counts.customObjects ? '' : ' disabled'} /> Custom room-object definitions <span>${counts.customObjects}</span></label><label><input type="checkbox" data-v720-build-kind="includeActivityLayouts"${counts.activityLayouts ? ' checked' : ''}${counts.activityLayouts ? '' : ' disabled'} /> Activity Layouts <span>${counts.activityLayouts}</span></label><label><input type="checkbox" data-v720-build-kind="includeRotationBlueprints"${counts.rotationBlueprints ? ' checked' : ''}${counts.rotationBlueprints ? '' : ' disabled'} /> Station Rotation blueprints <span>${counts.rotationBlueprints}</span></label><label><input type="checkbox" data-v720-build-kind="includeTestingProfiles"${counts.testingProfiles ? ' checked' : ''}${counts.testingProfiles ? '' : ' disabled'} /> Last Testing Mode profile <span>${counts.testingProfiles}</span></label></div><label class="v720-image-option"><input id="plannerPacksV720IncludeImages" type="checkbox"${hasImage ? '' : ' disabled'} /> Include embedded floor-plan images${hasImage ? ' (off by default)' : ' (none available)'}</label><label class="v720-review-option"><input id="plannerPacksV720FreeTextReviewed" type="checkbox" /> I reviewed names, descriptions, labels, and station instructions for information I do not want to share.</label></section><div class="v720-privacy-note"><strong>Student data is structurally excluded.</strong><span>Seat assignments, student IDs, roster records, private/substitute/public notes, student-to-zone links, and student-specific distance rules are removed from generated packs. Floor-plan images are excluded unless you explicitly include them.</span></div><div class="button-row"><button id="plannerPacksV720BuildInstallBtn" type="button">Build & install</button><button id="plannerPacksV720BuildExportBtn" class="secondary" type="button">Build & export file</button></div></div>`;
  }

  function importMarkup() {
    if (!importDraft) return `<div class="v720-import-empty"><strong>Import a Planner Pack file</strong><p>Choose a <code>.plannerpack.json</code> file. V7.2 validates the format and refuses structured student/roster data before it can enter the pack library.</p><button id="plannerPacksV720ChooseFileBtn" type="button">Choose pack file</button></div>`;
    const counts = packCounts(importDraft);
    const existing = installedPacks.find(pack => String(pack.id) === String(importDraft.id));
    return `<div class="v720-import-preview"><header><div><span class="v720-kicker">Validated import</span><h3>${esc(importDraft.name)}</h3><p>${esc(importDraft.description || 'No description provided.')}</p></div><span class="pill">${packItemCount(importDraft)} items</span></header><div class="v720-component-chips">${componentSummaryMarkup(importDraft)}</div><div class="v720-meta-grid"><span>Publisher <b>${esc(importDraft.publisher || 'Not specified')}</b></span><span>Revision <b>${esc(importDraft.revision)}</b></span><span>License <b>${esc(importDraft.license)}</b></span><span>Floor-plan images <b>${importDraft.privacy.floorPlanImagesIncluded ? 'Included' : 'None'}</b></span></div>${importDraft.privacy.floorPlanImagesIncluded ? '<div class="v720-warning"><strong>Embedded image review required</strong><p>This pack contains one or more floor-plan images. Images can contain classroom or student-identifying information even though structured roster fields are blocked.</p></div>' : '<div class="successbox">No structured student/roster data was detected, and this pack contains no embedded floor-plan image.</div>'}<div class="button-row"><button id="plannerPacksV720InstallImportBtn" type="button">${existing ? 'Update installed pack' : 'Install in this browser'}</button><button id="plannerPacksV720DiscardImportBtn" class="secondary" type="button">Discard import</button></div><div class="hint">Installing a pack does not change the current classroom. Apply content separately from the Library tab.</div></div>`;
  }

  function modalMarkup() {
    return `<div id="${MODAL_ID}" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="plannerPacksV720Title"><div class="modal v720-modal"><div class="panel-header"><div><span class="v720-kicker">V7.2 Ecosystem</span><h2 id="plannerPacksV720Title">Planner Packs</h2></div><button id="plannerPacksV720CloseBtn" class="tiny secondary" type="button">Close</button></div><div class="modal-body v720-modal-body"><div class="v720-intro"><strong>Reuse planning knowledge without sharing a class.</strong><span>Planner Packs bundle room templates, reusable student-need presets, room-object definitions, Activity Layouts, Station Rotation blueprints, and Testing Mode defaults. Packs are ordinary JSON files, work offline, and never require an account or server.</span></div><nav class="v720-tabs" role="tablist" aria-label="Planner Pack views"><button type="button" class="active" data-v720-tab="library" role="tab" aria-selected="true">Library</button><button type="button" data-v720-tab="build" role="tab" aria-selected="false">Build a pack</button><button type="button" data-v720-tab="import" role="tab" aria-selected="false">Import</button></nav><section id="plannerPacksV720LibraryView" class="v720-view active"><div class="v720-library-grid"><aside><div class="v720-library-head"><strong>Pack library</strong><button id="plannerPacksV720LibraryImportBtn" class="tiny secondary" type="button">Import</button></div><div id="plannerPacksV720PackList" class="v720-pack-list"></div></aside><main id="plannerPacksV720PackDetail"></main></div></section><section id="plannerPacksV720BuildView" class="v720-view" hidden></section><section id="plannerPacksV720ImportView" class="v720-view" hidden></section><input id="${FILE_INPUT_ID}" type="file" accept="application/json,.json,.plannerpack.json" hidden aria-label="Choose Planner Pack file" /><div id="plannerPacksV720Status" class="hint" role="status" aria-live="polite"></div></div></div></div>`;
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    const host = document.createElement('div');
    host.innerHTML = modalMarkup();
    modal = host.firstElementChild;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target?.id === 'plannerPacksV720CloseBtn') { close(); return; }
      const tab = event.target.closest?.('[data-v720-tab]');
      if (tab) { setTab(tab.dataset.v720Tab); return; }
      const packButton = event.target.closest?.('[data-v720-select-pack]');
      if (packButton) { selectedPackId = packButton.dataset.v720SelectPack || selectedPackId; renderLibrary(); return; }
      if (event.target?.id === 'plannerPacksV720LibraryImportBtn' || event.target?.id === 'plannerPacksV720ChooseFileBtn') { modal.querySelector(`#${FILE_INPUT_ID}`)?.click(); return; }
      if (event.target?.id === 'plannerPacksV720InstallImportBtn') { void installImportDraft(); return; }
      if (event.target?.id === 'plannerPacksV720DiscardImportBtn') { importDraft = null; renderImport(); return; }
      if (event.target?.id === 'plannerPacksV720ApplyBtn') { void applySelectedFromUi(); return; }
      if (event.target?.id === 'plannerPacksV720ExportSelectedBtn') { const pack = packById(selectedPackId); if (pack) exportPack(pack); return; }
      if (event.target?.id === 'plannerPacksV720DeleteBtn') { void deletePack(selectedPackId); return; }
      if (event.target?.id === 'plannerPacksV720BuildInstallBtn') { void buildFromUi(true); return; }
      if (event.target?.id === 'plannerPacksV720BuildExportBtn') { void buildFromUi(false); }
    });
    modal.querySelector(`#${FILE_INPUT_ID}`)?.addEventListener('change', event => void handleFile(event.target.files?.[0]));
    return modal;
  }

  function setTab(tab) {
    const value = ['library', 'build', 'import'].includes(tab) ? tab : 'library';
    const modal = ensureModal();
    modal.querySelectorAll('[data-v720-tab]').forEach(button => {
      const active = button.dataset.v720Tab === value;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    ['library', 'build', 'import'].forEach(name => {
      const node = modal.querySelector(`#plannerPacksV720${name[0].toUpperCase()}${name.slice(1)}View`);
      if (node) { node.hidden = name !== value; node.classList.toggle('active', name === value); }
    });
    if (value === 'library') renderLibrary();
    if (value === 'build') renderBuilder();
    if (value === 'import') renderImport();
  }

  function renderLibrary() {
    const modal = ensureModal();
    const packs = allPacks();
    if (!packs.some(pack => String(pack.id) === String(selectedPackId))) selectedPackId = packs[0]?.id || '';
    const listNode = modal.querySelector('#plannerPacksV720PackList');
    const detail = modal.querySelector('#plannerPacksV720PackDetail');
    if (listNode) listNode.innerHTML = packs.map(libraryCardMarkup).join('') || '<div class="hint">No Planner Packs are installed.</div>';
    if (detail) detail.innerHTML = selectedPackMarkup(packById(selectedPackId));
  }

  function renderBuilder() {
    const node = ensureModal().querySelector('#plannerPacksV720BuildView');
    if (node) node.innerHTML = builderMarkup();
  }

  function renderImport() {
    const node = ensureModal().querySelector('#plannerPacksV720ImportView');
    if (node) node.innerHTML = importMarkup();
  }

  function builderOptionsFromUi() {
    const modal = ensureModal();
    const options = {
      name:modal.querySelector('#plannerPacksV720BuildName')?.value,
      revision:modal.querySelector('#plannerPacksV720BuildRevision')?.value,
      publisher:modal.querySelector('#plannerPacksV720BuildPublisher')?.value,
      license:modal.querySelector('#plannerPacksV720BuildLicense')?.value,
      description:modal.querySelector('#plannerPacksV720BuildDescription')?.value,
      tags:modal.querySelector('#plannerPacksV720BuildTags')?.value,
      includeFloorPlanImages:Boolean(modal.querySelector('#plannerPacksV720IncludeImages')?.checked),
      freeTextReviewed:Boolean(modal.querySelector('#plannerPacksV720FreeTextReviewed')?.checked)
    };
    modal.querySelectorAll('[data-v720-build-kind]').forEach(input => { options[input.dataset.v720BuildKind] = Boolean(input.checked); });
    return options;
  }

  async function buildFromUi(installAfter) {
    try {
      const options = builderOptionsFromUi();
      if (!safeName(options.name)) throw new Error('Give the Planner Pack a name.');
      const pack = buildPack(options);
      if (!packItemCount(pack)) throw new Error('Choose at least one reusable component for the pack.');
      if (installAfter) {
        await installPack(pack);
        setTab('library');
      } else {
        exportPack(pack);
        announce(`${pack.name} exported. The current classroom was not changed.`);
      }
    } catch (error) {
      announce(error?.message || String(error));
    }
  }

  async function handleFile(file) {
    const input = ensureModal().querySelector(`#${FILE_INPUT_ID}`);
    try {
      importDraft = await readPackFile(file);
      setTab('import');
      renderImport();
      announce(`${importDraft.name} validated. Review the pack before installing it.`);
    } catch (error) {
      importDraft = null;
      setTab('import');
      renderImport();
      announce(`Planner Pack import refused: ${error?.message || error}`);
    } finally {
      if (input) input.value = '';
    }
  }

  async function installImportDraft() {
    if (!importDraft) return;
    try {
      const pack = await installPack(importDraft);
      importDraft = null;
      selectedPackId = pack.id;
      setTab('library');
    } catch (error) {
      announce(error?.message || String(error));
    }
  }

  function applySelectionFromUi() {
    const modal = ensureModal();
    const selection = { roomTemplates:false, requirementPresets:false, customObjects:false, activityLayouts:false, rotationBlueprints:false, testingProfiles:false };
    modal.querySelectorAll('[data-v720-apply-kind]').forEach(input => { selection[input.dataset.v720ApplyKind] = Boolean(input.checked && !input.disabled); });
    return selection;
  }

  async function applySelectedFromUi() {
    const pack = packById(selectedPackId);
    if (!pack) return;
    const selection = applySelectionFromUi();
    if (!Object.values(selection).some(Boolean)) { announce('Choose at least one pack component to apply.'); return; }
    await applyPack(pack, selection);
    renderLibrary();
  }

  function announce(message) {
    const text = String(message || '');
    const node = document.getElementById('plannerPacksV720Status');
    if (node) node.textContent = text;
    try { if (typeof setLiveStatusMessage === 'function') setLiveStatusMessage(text); } catch (_) { /* optional */ }
  }

  function open() {
    if (isPresentationMode()) return;
    const modal = ensureModal();
    if (!libraryLoaded) void loadLibrary().then(() => renderLibrary());
    renderLibrary();
    renderBuilder();
    renderImport();
    if (typeof openModalById === 'function') openModalById(MODAL_ID);
    else modal.classList.add('show');
  }

  function close() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    if (typeof closeModalById === 'function') closeModalById(MODAL_ID);
    else modal.classList.remove('show');
  }

  function ensureLaunchPoints() {
    const nav = document.querySelector('.planning-tools-tabs');
    if (nav && !nav.querySelector('[data-planner-packs-launch]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.plannerPacksLaunch = 'true';
      button.textContent = 'Planner Packs';
      button.title = 'Open the V7.2 reusable Planner Pack library.';
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); open(); });
      nav.appendChild(button);
    }
    const moreButton = document.querySelector('[data-action="advanced-tools"], #planningToolsOpenBtn, #advancedToolsBtn');
    const host = moreButton?.parentElement;
    if (host && !host.querySelector('[data-planner-packs-inline]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      button.dataset.plannerPacksInline = 'true';
      button.textContent = 'Planner Packs';
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); open(); });
      host.appendChild(button);
    }
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .v720-modal{width:min(1180px,calc(100vw - 24px));height:min(920px,calc(100vh - 24px))}.v720-modal-body{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:12px;overflow:hidden;padding-bottom:18px}.v720-kicker{display:block;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#64748b)}.v720-intro{display:grid;grid-template-columns:minmax(220px,.7fr) minmax(0,1.6fr);gap:14px;padding:12px 14px;border:1px solid var(--border,#d8deea);border-radius:12px;background:color-mix(in srgb,var(--panel,#fff) 94%,#7c3aed 6%)}.v720-intro span{color:var(--muted,#64748b);line-height:1.4}.v720-tabs{display:flex;gap:6px;flex-wrap:wrap}.v720-tabs button{background:var(--panel,#fff);color:inherit;border-color:var(--border,#d8deea)}.v720-tabs button.active{outline:2px solid #7c3aed;outline-offset:1px}.v720-view{min-height:0;overflow:auto}.v720-library-grid{display:grid;grid-template-columns:minmax(230px,.65fr) minmax(0,1.6fr);gap:12px;min-height:100%}.v720-library-grid>aside,.v720-library-grid>main{min-width:0;border:1px solid var(--border,#d8deea);border-radius:12px;background:var(--panel,#fff);padding:10px}.v720-library-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}.v720-pack-list{display:grid;gap:7px}.v720-pack-card{display:grid;gap:4px;width:100%;text-align:left;padding:9px 10px;border:1px solid var(--border,#d8deea);border-radius:10px;background:var(--panel,#fff);color:inherit}.v720-pack-card.active{border-color:#7c3aed;box-shadow:0 0 0 2px color-mix(in srgb,#7c3aed 18%,transparent)}.v720-pack-card-head{display:flex;justify-content:space-between;gap:7px;align-items:start}.v720-pack-card>span:not(.v720-pack-card-head),.v720-pack-card small{font-size:9.5px;color:var(--muted,#64748b)}.v720-pack-detail{display:grid;gap:11px}.v720-pack-detail>header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:start}.v720-pack-detail h3{margin:2px 0 4px}.v720-pack-detail p{margin:0;color:var(--muted,#64748b);line-height:1.4}.v720-meta{display:grid;gap:3px;font-size:9.5px;color:var(--muted,#64748b);text-align:right}.v720-tags,.v720-component-chips{display:flex;gap:5px;flex-wrap:wrap}.v720-count-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border:1px solid var(--border,#d8deea);border-radius:999px;font-size:9.5px;background:color-mix(in srgb,var(--panel,#fff) 94%,#ede9fe 6%)}.v720-warning{padding:9px 10px;border:1px solid #f0c36b;border-radius:10px;background:color-mix(in srgb,var(--panel,#fff) 92%,#fff7d6 8%);font-size:11px}.v720-warning ul{margin:5px 0 0 18px;padding:0}.v720-warning p{margin:5px 0 0}.v720-apply-section{display:grid;gap:9px;border-top:1px solid var(--border,#d8deea);padding-top:10px}.v720-apply-section h4,.v720-build-contents h4{margin:0 0 3px}.v720-apply-list{display:grid;grid-template-columns:1fr 1fr;gap:7px}.v720-apply-row{display:flex;gap:8px;align-items:flex-start;padding:8px;border:1px solid var(--border,#d8deea);border-radius:10px}.v720-apply-row>span{display:grid;gap:2px}.v720-apply-row small{font-size:9.5px;color:var(--muted,#64748b);line-height:1.3}.v720-apply-row.blocked{opacity:.68;border-style:dashed}.v720-builder{display:grid;gap:12px}.v720-builder-grid{display:grid;grid-template-columns:1.6fr .6fr 1fr 1fr;gap:8px}.v720-builder-grid label{display:grid;gap:4px;font-size:10px;font-weight:800}.v720-builder-grid .wide{grid-column:span 2}.v720-build-contents{display:grid;gap:8px;border:1px solid var(--border,#d8deea);border-radius:12px;padding:10px}.v720-build-checks{display:grid;grid-template-columns:1fr 1fr;gap:7px}.v720-build-checks label{display:flex;align-items:center;gap:7px;padding:7px 8px;border:1px solid var(--border,#d8deea);border-radius:9px;font-size:10.5px}.v720-build-checks label span{margin-left:auto;font-weight:900}.v720-image-option,.v720-review-option{display:flex;gap:7px;align-items:flex-start;font-size:10.5px}.v720-privacy-note{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;padding:10px 12px;border:1px solid #86efac;border-radius:11px;background:color-mix(in srgb,var(--panel,#fff) 94%,#dcfce7 6%);font-size:10.5px}.v720-privacy-note span{color:var(--muted,#64748b);line-height:1.4}.v720-import-empty,.v720-import-preview{display:grid;gap:11px;max-width:880px}.v720-import-empty{place-items:start;padding:18px;border:1px dashed var(--border,#d8deea);border-radius:12px}.v720-import-preview>header{display:flex;justify-content:space-between;gap:12px}.v720-import-preview h3{margin:2px 0}.v720-import-preview p{margin:0;color:var(--muted,#64748b)}.v720-meta-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.v720-meta-grid span{display:grid;gap:2px;padding:8px;border:1px solid var(--border,#d8deea);border-radius:9px;font-size:9px;color:var(--muted,#64748b)}.v720-meta-grid b{color:inherit;font-size:10px}body.visibility-mode [data-planner-packs-launch],body.visibility-mode [data-planner-packs-inline]{display:none!important}@media print{.v720-modal,[data-planner-packs-launch],[data-planner-packs-inline]{display:none!important}}
      @media(max-width:900px){.v720-modal{width:calc(100vw - 10px);height:calc(100vh - 10px)}.v720-modal-body{overflow:auto;display:block}.v720-intro{grid-template-columns:1fr;margin-bottom:10px}.v720-tabs{margin-bottom:10px}.v720-library-grid{grid-template-columns:1fr}.v720-library-grid>aside{max-height:220px;overflow:auto}.v720-pack-detail>header{grid-template-columns:1fr}.v720-meta{text-align:left}.v720-apply-list,.v720-build-checks{grid-template-columns:1fr}.v720-builder-grid{grid-template-columns:1fr 1fr}.v720-meta-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:560px){.v720-builder-grid,.v720-meta-grid{grid-template-columns:1fr}.v720-builder-grid .wide{grid-column:auto}.v720-privacy-note{grid-template-columns:1fr}.v720-pack-detail .button-row{display:grid;grid-template-columns:1fr}.v720-pack-detail .button-row button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function refreshUi() {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      ensureLaunchPoints();
      const modal = document.getElementById(MODAL_ID);
      if (modal?.classList.contains('show')) {
        renderLibrary();
        renderBuilder();
      }
    });
  }

  function observe() {
    if (observer || !document.body) return;
    observer = new MutationObserver(() => ensureLaunchPoints());
    observer.observe(document.body, { childList:true, subtree:true });
  }

  function installEvents() {
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.getElementById(MODAL_ID)?.classList.contains('show')) close();
      if (event.ctrlKey && event.altKey && String(event.key).toLowerCase() === 'k') {
        event.preventDefault();
        open();
      }
    });
    document.addEventListener('change', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.matches?.('#classSelect,#layoutModeSelect,[data-class-id]')) setTimeout(refreshUi, 0);
    }, true);
  }

  function install() {
    if (installed) return;
    installed = true;
    installStyles();
    ensureModal();
    ensureLaunchPoints();
    observe();
    installEvents();
    void loadLibrary().then(refreshUi);
  }

  function afterReady() {
    ensureLaunchPoints();
    if (!libraryLoaded) void loadLibrary().then(refreshUi);
    else refreshUi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();

  return Object.freeze({
    version:VERSION,
    format:FORMAT,
    schemaVersion:SCHEMA_VERSION,
    install,
    afterReady,
    open,
    close,
    normalizePack,
    assertPack,
    buildPack,
    currentRoomTemplate,
    sanitizeRoomTemplate,
    sanitizeRequirementPreset,
    sanitizeActivityLayout,
    sanitizeRotationBlueprint,
    personalDataFindings,
    packCounts,
    previewApply,
    applyPack,
    matchRotationStations,
    prepareActivityLayout,
    readPackFile,
    installPack,
    deletePack,
    loadLibrary,
    saveLibrary,
    allPacks,
    installedPacks:() => installedPacks.map(clone),
    builtinPacks:() => BUILTIN_PACKS.map(clone),
    exportPack,
    refresh:refreshUi
  });
})();

'use strict';
