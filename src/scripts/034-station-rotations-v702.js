window.StationRotationsV702 = (() => {
  'use strict';

  const VERSION = '7.0.2';
  const STORE_VERSION = 1;
  const STYLE_ID = 'stationRotationsV702Styles';
  const MODAL_ID = 'stationRotationsV702Modal';
  const TOOLBAR_ID = 'stationRotationsV702Toolbar';
  const OVERLAY_CLASS = 'v702-station-overlay';
  const RUNTIME_STORE = Symbol('stationRotationsV702RuntimeStore');
  const STATION_TYPES = new Set(['station', 'lab', 'table']);
  const DEFAULT_DURATION = 12;
  const DEFAULT_TRANSITION = 2;

  let observer = null;
  let observedCanvas = null;
  let refreshFrame = 0;
  let timerHandle = 0;
  let lastTickKey = '';

  const list = value => Array.isArray(value) ? value : [];
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max, fallback = min) => Math.max(min, Math.min(max, number(value, fallback)));
  const nowIso = () => new Date().toISOString();
  const clone = value => {
    if (typeof deepClone === 'function') return deepClone(value);
    return JSON.parse(JSON.stringify(value ?? null));
  };
  const esc = value => typeof escapeHtml === 'function'
    ? escapeHtml(String(value ?? ''))
    : String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const makeId = prefix => {
    try { if (typeof uid === 'function') return uid(prefix); } catch (_) { /* fallback below */ }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  };

  function activeLayout() {
    return state?.freeformLayout && typeof state.freeformLayout === 'object' ? state.freeformLayout : null;
  }

  function activeStudents() {
    try {
      if (typeof seatingStudents === 'function') return list(seatingStudents()).map(student => student);
    } catch (_) { /* fallback below */ }
    return list(state?.students).filter(student => !student?.archived);
  }

  function studentLabel(student) {
    try { if (typeof studentDisplay === 'function') return studentDisplay(student); } catch (_) { /* fallback below */ }
    const first = String(student?.nickName || student?.firstName || '').trim();
    const last = String(student?.lastName || '').trim();
    return [first, last].filter(Boolean).join(' ') || String(student?.id || 'Student');
  }

  function activityLayoutId() {
    try {
      const store = window.ActivityLayoutsV701?.ensureStore?.({ reconcileActive:true });
      return String(store?.activeId || '');
    } catch (_) {
      return '';
    }
  }

  function activityLayoutName(id) {
    try {
      const store = window.ActivityLayoutsV701?.ensureStore?.({ reconcileActive:false });
      return String(store?.layouts?.find(entry => String(entry.id) === String(id || ''))?.name || '');
    } catch (_) {
      return '';
    }
  }

  function stationCandidates(layout = activeLayout()) {
    return list(layout?.objects)
      .filter(object => STATION_TYPES.has(String(object?.type || '')))
      .map((object, index) => ({
        objectId:String(object.id || ''),
        type:String(object.type || 'station'),
        name:String(object.label || (object.type === 'lab' ? 'Lab Station' : object.type === 'table' ? 'Table' : 'Activity Station')).trim().slice(0, 80) || `Station ${index + 1}`,
        x:number(object.x),
        y:number(object.y),
        width:Math.max(1, number(object.width, 160)),
        height:Math.max(1, number(object.height, 96))
      }))
      .filter(item => item.objectId);
  }

  function normalizeTeam(team, index = 0) {
    const source = team && typeof team === 'object' ? team : {};
    return {
      id:source.id ? String(source.id) : makeId('rotation-team'),
      name:String(source.name || `Team ${index + 1}`).trim().slice(0, 60) || `Team ${index + 1}`,
      studentIds:[...new Set(list(source.studentIds).map(String).filter(Boolean))]
    };
  }

  function normalizeStation(station, index = 0) {
    const source = station && typeof station === 'object' ? station : {};
    return {
      objectId:String(source.objectId || source.id || ''),
      name:String(source.name || `Station ${index + 1}`).trim().slice(0, 80) || `Station ${index + 1}`,
      instructions:String(source.instructions || '').trim().slice(0, 500)
    };
  }

  function normalizePlan(plan, index = 0) {
    const source = plan && typeof plan === 'object' ? plan : {};
    const createdAt = String(source.createdAt || nowIso());
    const phase = ['stopped', 'round', 'transition'].includes(source.phase) ? source.phase : 'stopped';
    return {
      id:source.id ? String(source.id) : makeId('station-rotation'),
      name:String(source.name || `Station Rotation ${index + 1}`).trim().slice(0, 80) || `Station Rotation ${index + 1}`,
      activityLayoutId:String(source.activityLayoutId || ''),
      durationMinutes:clamp(source.durationMinutes, 1, 180, DEFAULT_DURATION),
      transitionMinutes:clamp(source.transitionMinutes, 0, 30, DEFAULT_TRANSITION),
      teamSource:source.teamSource === 'classroom-groups' ? 'classroom-groups' : 'balanced',
      stations:list(source.stations).slice(0, 24).map(normalizeStation).filter(station => station.objectId),
      teams:list(source.teams).slice(0, 24).map(normalizeTeam),
      currentRound:Math.max(0, Math.floor(number(source.currentRound, 0))),
      phase,
      phaseStartedAt:phase === 'stopped' ? '' : String(source.phaseStartedAt || ''),
      createdAt,
      updatedAt:String(source.updatedAt || createdAt)
    };
  }

  function normalizeStore(layout = activeLayout()) {
    const source = layout?.stationRotations && typeof layout.stationRotations === 'object' ? layout.stationRotations : {};
    const plans = list(source.plans).slice(0, 40).map(normalizePlan);
    const activePlanId = plans.some(plan => plan.id === source.activePlanId) ? String(source.activePlanId) : (plans[0]?.id || '');
    return { version:STORE_VERSION, activePlanId, plans };
  }

  function ensureStore() {
    let layout = activeLayout();
    if (!layout) {
      try { if (typeof ensureFreeformLayout === 'function') ensureFreeformLayout(); } catch (_) { /* no-op */ }
      layout = activeLayout();
    }
    if (!layout) return null;
    let store = layout.stationRotations;
    if (!store?.[RUNTIME_STORE]) {
      store = normalizeStore(layout);
      Object.defineProperty(store, RUNTIME_STORE, { value:true, enumerable:false, configurable:false });
      layout.stationRotations = store;
    }
    return store;
  }

  function activePlan(store = ensureStore()) {
    if (!store) return null;
    return store.plans.find(plan => plan.id === store.activePlanId) || store.plans[0] || null;
  }

  function schedulePersist(reason = 'station-rotations') {
    try { persistActiveClass?.(); } catch (_) { /* best effort */ }
    try { scheduleLinkedAutoSave?.(reason); } catch (_) {}
  }

  function announce(message) {
    const text = String(message || '');
    const node = document.getElementById('stationRotationsV702Status');
    if (node) node.textContent = text;
    try { setLiveStatusMessage?.(text); } catch (_) { /* optional */ }
  }

  function uniquePlanName(base, store = ensureStore()) {
    const root = String(base || 'Station Rotation').trim().slice(0, 80) || 'Station Rotation';
    const used = new Set(list(store?.plans).map(plan => plan.name.toLowerCase()));
    if (!used.has(root.toLowerCase())) return root;
    for (let index = 2; index < 100; index += 1) {
      const candidate = `${root} ${index}`.slice(0, 80);
      if (!used.has(candidate.toLowerCase())) return candidate;
    }
    return `${root} ${Date.now().toString(36)}`.slice(0, 80);
  }

  function balancedTeams(students, requestedCount) {
    const roster = list(students).slice().sort((a, b) => studentLabel(a).localeCompare(studentLabel(b)));
    const count = Math.max(1, Math.min(Math.floor(number(requestedCount, 1)), roster.length || 1));
    const teams = Array.from({ length:count }, (_, index) => ({ id:makeId('rotation-team'), name:`Team ${index + 1}`, studentIds:[] }));
    roster.forEach((student, index) => {
      const cycle = Math.floor(index / count);
      const offset = index % count;
      const teamIndex = cycle % 2 === 0 ? offset : count - 1 - offset;
      teams[teamIndex].studentIds.push(String(student.id));
    });
    return teams;
  }

  function classroomGroupTeams(students, requestedCount) {
    const rosterIds = new Set(list(students).map(student => String(student.id)));
    const count = Math.max(1, Math.min(Math.floor(number(requestedCount, 1)), rosterIds.size || 1));
    const unassigned = new Set(rosterIds);
    const teams = [];
    list(state?.groups).forEach(group => {
      if (teams.length >= count) return;
      const members = list(group?.studentIds).map(String).filter(id => unassigned.has(id));
      if (!members.length) return;
      members.forEach(id => unassigned.delete(id));
      teams.push({ id:makeId('rotation-team'), name:String(group.name || `Team ${teams.length + 1}`).slice(0, 60), studentIds:members });
    });
    while (teams.length < count) teams.push({ id:makeId('rotation-team'), name:`Team ${teams.length + 1}`, studentIds:[] });
    [...unassigned].forEach(studentId => {
      teams.sort((a, b) => a.studentIds.length - b.studentIds.length || a.name.localeCompare(b.name));
      teams[0].studentIds.push(studentId);
    });
    return teams.map((team, index) => ({ ...team, name:team.name || `Team ${index + 1}` }));
  }

  function buildTeams(source, count) {
    const students = activeStudents();
    return source === 'classroom-groups'
      ? classroomGroupTeams(students, count)
      : balancedTeams(students, count);
  }

  function createPlan(options = {}) {
    const layout = activeLayout();
    const store = ensureStore();
    if (!layout || !store || state?.layoutMode !== 'freeform') return null;
    const candidates = stationCandidates(layout);
    const requestedIds = [...new Set(list(options.stationIds).map(String).filter(Boolean))];
    const selected = candidates.filter(item => !requestedIds.length || requestedIds.includes(item.objectId));
    if (selected.length < 2) {
      announce('Add or select at least two Activity Stations, Lab Stations, or tables before creating a rotation.');
      return null;
    }
    const students = activeStudents();
    if (!students.length) {
      announce('There are no active students available for this rotation.');
      return null;
    }
    const teamCount = Math.max(1, Math.min(Math.floor(number(options.teamCount, selected.length)), selected.length, students.length));
    const teamSource = options.teamSource === 'classroom-groups' ? 'classroom-groups' : 'balanced';
    const plan = normalizePlan({
      id:makeId('station-rotation'),
      name:uniquePlanName(options.name || 'Station Rotation', store),
      activityLayoutId:activityLayoutId(),
      durationMinutes:options.durationMinutes ?? DEFAULT_DURATION,
      transitionMinutes:options.transitionMinutes ?? DEFAULT_TRANSITION,
      teamSource,
      stations:selected.map(item => ({ objectId:item.objectId, name:item.name, instructions:'' })),
      teams:buildTeams(teamSource, teamCount),
      currentRound:0,
      phase:'stopped',
      phaseStartedAt:'',
      createdAt:nowIso(),
      updatedAt:nowIso()
    }, store.plans.length);
    store.plans.push(plan);
    store.activePlanId = plan.id;
    layout.stationRotations = store;
    schedulePersist('station-rotation-create');
    refreshUi();
    announce(`${plan.name} created with ${plan.teams.length} teams and ${plan.stations.length} stations.`);
    return plan;
  }

  function activatePlan(id) {
    const store = ensureStore();
    if (!store) return false;
    const plan = store.plans.find(item => item.id === String(id || ''));
    if (!plan) return false;
    store.activePlanId = plan.id;
    activeLayout().stationRotations = store;
    schedulePersist('station-rotation-activate');
    refreshUi();
    announce(`${plan.name} selected.`);
    return true;
  }

  function duplicatePlan(id = '') {
    const store = ensureStore();
    if (!store) return null;
    const source = store.plans.find(item => item.id === String(id || store.activePlanId)) || activePlan(store);
    if (!source) return null;
    const copy = normalizePlan({
      ...clone(source),
      id:makeId('station-rotation'),
      name:uniquePlanName(`${source.name} Copy`, store),
      phase:'stopped',
      phaseStartedAt:'',
      createdAt:nowIso(),
      updatedAt:nowIso()
    }, store.plans.length);
    store.plans.push(copy);
    store.activePlanId = copy.id;
    activeLayout().stationRotations = store;
    schedulePersist('station-rotation-duplicate');
    refreshUi();
    announce(`${source.name} duplicated as ${copy.name}.`);
    return copy;
  }

  function renamePlan(id, name) {
    const store = ensureStore();
    const plan = store?.plans.find(item => item.id === String(id || ''));
    const next = String(name || '').trim().slice(0, 80);
    if (!plan || !next) return false;
    plan.name = next;
    plan.updatedAt = nowIso();
    schedulePersist('station-rotation-rename');
    refreshUi();
    announce(`Rotation renamed to ${plan.name}.`);
    return true;
  }

  function deletePlan(id) {
    const store = ensureStore();
    if (!store) return false;
    const index = store.plans.findIndex(item => item.id === String(id || ''));
    if (index < 0) return false;
    const [removed] = store.plans.splice(index, 1);
    if (store.activePlanId === removed.id) store.activePlanId = store.plans[Math.min(index, store.plans.length - 1)]?.id || '';
    activeLayout().stationRotations = store;
    schedulePersist('station-rotation-delete');
    refreshUi();
    announce(`${removed.name} removed.`);
    return true;
  }

  function rebuildTeams(id = '', source = '') {
    const store = ensureStore();
    const plan = store?.plans.find(item => item.id === String(id || store.activePlanId)) || activePlan(store);
    if (!plan) return null;
    const teamSource = source === 'classroom-groups' ? 'classroom-groups' : source === 'balanced' ? 'balanced' : plan.teamSource;
    const teamCount = Math.max(1, Math.min(plan.teams.length || plan.stations.length, plan.stations.length, activeStudents().length || 1));
    plan.teamSource = teamSource;
    plan.teams = buildTeams(teamSource, teamCount);
    plan.currentRound = 0;
    plan.phase = 'stopped';
    plan.phaseStartedAt = '';
    plan.updatedAt = nowIso();
    schedulePersist('station-rotation-rebuild-teams');
    refreshUi();
    announce(`${plan.name} rebuilt from the currently active roster${typeof todaySessionActive === 'function' && todaySessionActive() ? ' with Today Mode absences excluded' : ''}.`);
    return plan;
  }

  function moveStudent(planId, studentId, teamId) {
    const store = ensureStore();
    const plan = store?.plans.find(item => item.id === String(planId || store.activePlanId)) || activePlan(store);
    if (!plan) return false;
    const target = plan.teams.find(team => team.id === String(teamId || ''));
    if (!target) return false;
    plan.teams.forEach(team => { team.studentIds = team.studentIds.filter(id => String(id) !== String(studentId)); });
    target.studentIds.push(String(studentId));
    plan.updatedAt = nowIso();
    schedulePersist('station-rotation-move-student');
    refreshUi();
    return true;
  }

  function roundCount(plan) {
    return Math.max(1, list(plan?.stations).length);
  }

  function roundAssignments(plan, roundIndex = plan?.currentRound || 0) {
    const stations = list(plan?.stations);
    if (!stations.length) return [];
    const round = ((Math.floor(number(roundIndex, 0)) % stations.length) + stations.length) % stations.length;
    return list(plan?.teams).map((team, teamIndex) => {
      const stationIndex = (teamIndex + round) % stations.length;
      return { team, station:stations[stationIndex], stationIndex, round };
    });
  }

  function setRound(plan, index, { restart = true } = {}) {
    if (!plan) return false;
    const count = roundCount(plan);
    plan.currentRound = ((Math.floor(number(index, 0)) % count) + count) % count;
    if (restart && plan.phase === 'round') plan.phaseStartedAt = nowIso();
    plan.updatedAt = nowIso();
    schedulePersist('station-rotation-round');
    refreshUi();
    return true;
  }

  function nextRound() {
    const plan = activePlan();
    if (!plan) return false;
    const result = setRound(plan, plan.currentRound + 1, { restart:true });
    if (result) announce(`Round ${plan.currentRound + 1} of ${roundCount(plan)}.`);
    return result;
  }

  function previousRound() {
    const plan = activePlan();
    if (!plan) return false;
    const result = setRound(plan, plan.currentRound - 1, { restart:true });
    if (result) announce(`Round ${plan.currentRound + 1} of ${roundCount(plan)}.`);
    return result;
  }

  function startRound() {
    const plan = activePlan();
    if (!plan) return false;
    plan.phase = 'round';
    plan.phaseStartedAt = nowIso();
    plan.updatedAt = nowIso();
    schedulePersist('station-rotation-start');
    refreshUi();
    announce(`Round ${plan.currentRound + 1} started for ${plan.durationMinutes} minutes.`);
    return true;
  }

  function startTransition() {
    const plan = activePlan();
    if (!plan || plan.transitionMinutes <= 0) return false;
    plan.phase = 'transition';
    plan.phaseStartedAt = nowIso();
    plan.updatedAt = nowIso();
    schedulePersist('station-rotation-transition');
    refreshUi();
    announce(`${plan.transitionMinutes}-minute transition started.`);
    return true;
  }

  function stopTimer() {
    const plan = activePlan();
    if (!plan) return false;
    plan.phase = 'stopped';
    plan.phaseStartedAt = '';
    plan.updatedAt = nowIso();
    schedulePersist('station-rotation-stop');
    refreshUi();
    announce('Station timer stopped.');
    return true;
  }

  function phaseSeconds(plan) {
    if (!plan || plan.phase === 'stopped' || !plan.phaseStartedAt) return null;
    const totalMinutes = plan.phase === 'transition' ? plan.transitionMinutes : plan.durationMinutes;
    const elapsed = Math.max(0, (Date.now() - Date.parse(plan.phaseStartedAt)) / 1000);
    return Math.max(0, Math.ceil(totalMinutes * 60 - elapsed));
  }

  function formatTime(seconds) {
    if (seconds === null) return 'Ready';
    const total = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  }

  function linkedLayoutState(plan) {
    const currentId = activityLayoutId();
    const linkedId = String(plan?.activityLayoutId || '');
    return {
      currentId,
      linkedId,
      currentName:activityLayoutName(currentId),
      linkedName:activityLayoutName(linkedId),
      matches:!linkedId || linkedId === currentId
    };
  }

  function switchToLinkedLayout(plan = activePlan()) {
    const link = linkedLayoutState(plan);
    if (!plan || !link.linkedId || link.matches) return false;
    const success = Boolean(window.ActivityLayoutsV701?.activate?.(link.linkedId));
    if (success) {
      announce(`Switched to the linked Activity Layout: ${link.linkedName || 'saved arrangement'}.`);
      refreshUi();
    }
    return success;
  }

  function clearCanvasOverlays() {
    document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach(node => node.remove());
    document.querySelectorAll('.freeform-object.v702-station-active').forEach(node => node.classList.remove('v702-station-active'));
  }

  function renderCanvasOverlays() {
    clearCanvasOverlays();
    if (state?.layoutMode !== 'freeform') return;
    const plan = activePlan();
    if (!plan) return;
    const assignments = roundAssignments(plan);
    const teamByStation = new Map(assignments.map(item => [String(item.station.objectId), item.team]));
    const stationById = new Map(list(plan.stations).map((station, index) => [String(station.objectId), { station, index }]));
    document.querySelectorAll('.freeform-object[data-object-id]').forEach(node => {
      const match = stationById.get(String(node.dataset.objectId || ''));
      if (!match) return;
      const team = teamByStation.get(String(match.station.objectId));
      const badge = document.createElement('div');
      badge.className = OVERLAY_CLASS;
      badge.style.pointerEvents = 'none';
      badge.setAttribute('aria-hidden', 'true');
      badge.innerHTML = `<span>${match.index + 1}</span><strong>${esc(match.station.name)}</strong><small>${team ? esc(team.name) : 'Open'}</small>`;
      node.classList.add('v702-station-active');
      node.appendChild(badge);
    });
  }

  function toolbarMarkup(plan, store) {
    const seconds = phaseSeconds(plan);
    const phaseLabel = plan?.phase === 'transition' ? 'Transition' : plan?.phase === 'round' ? `Round ${plan.currentRound + 1}/${roundCount(plan)}` : plan ? `Round ${plan.currentRound + 1}/${roundCount(plan)}` : 'No plan';
    const options = list(store?.plans).map(item => `<option value="${esc(item.id)}"${item.id === store.activePlanId ? ' selected' : ''}>${esc(item.name)}</option>`).join('');
    return `<label class="v702-toolbar-label" for="stationRotationsV702QuickSelect">Rotation</label>
      <select id="stationRotationsV702QuickSelect" aria-label="Active station rotation">${options || '<option value="">No rotations yet</option>'}</select>
      <button id="stationRotationsV702ManageBtn" class="secondary" type="button">Rotations</button>
      ${plan ? `<button id="stationRotationsV702PrevBtn" class="tiny secondary" type="button" title="Previous round">◀</button><span class="v702-round-chip">${esc(phaseLabel)} · <b id="stationRotationsV702TimerText">${esc(formatTime(seconds))}</b></span><button id="stationRotationsV702NextBtn" class="tiny secondary" type="button" title="Next round">▶</button>${plan.phase === 'round' || plan.phase === 'transition' ? '<button id="stationRotationsV702StopBtn" class="tiny ghost" type="button">Stop</button>' : '<button id="stationRotationsV702StartBtn" class="tiny" type="button">Start</button>'}` : ''}`;
  }

  function installToolbar() {
    let toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = TOOLBAR_ID;
      toolbar.className = 'v702-toolbar no-print';
      const activityToolbar = document.getElementById('activityLayoutsV701Toolbar');
      const digitalTwin = document.getElementById('openDigitalTwinV700Btn');
      if (activityToolbar?.parentElement) activityToolbar.insertAdjacentElement('afterend', toolbar);
      else if (digitalTwin?.parentElement) digitalTwin.insertAdjacentElement('afterend', toolbar);
      else document.body.appendChild(toolbar);
      toolbar.addEventListener('change', event => {
        if (event.target?.id === 'stationRotationsV702QuickSelect') {
          const id = String(event.target.value || '');
          if (id) activatePlan(id);
        }
      });
      toolbar.addEventListener('click', event => {
        if (event.target?.closest?.('#stationRotationsV702ManageBtn')) openModal();
        if (event.target?.closest?.('#stationRotationsV702PrevBtn')) previousRound();
        if (event.target?.closest?.('#stationRotationsV702NextBtn')) nextRound();
        if (event.target?.closest?.('#stationRotationsV702StartBtn')) startRound();
        if (event.target?.closest?.('#stationRotationsV702StopBtn')) stopTimer();
      });
    }
    renderToolbar();
    return toolbar;
  }

  function renderToolbar() {
    const toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) return;
    if (state?.layoutMode !== 'freeform') {
      toolbar.style.display = 'none';
      toolbar.innerHTML = '';
      return;
    }
    const store = ensureStore();
    const plan = activePlan(store);
    toolbar.style.display = 'inline-flex';
    toolbar.innerHTML = toolbarMarkup(plan, store);
  }

  function scheduleTable(plan) {
    if (!plan) return '<div class="hint">Create or select a rotation plan to see its rounds.</div>';
    const students = new Map(list(state?.students).map(student => [String(student.id), student]));
    const headers = plan.teams.map(team => `<th>${esc(team.name)}</th>`).join('');
    const rows = Array.from({ length:roundCount(plan) }, (_, roundIndex) => {
      const assignments = new Map(roundAssignments(plan, roundIndex).map(item => [item.team.id, item.station]));
      return `<tr${roundIndex === plan.currentRound ? ' class="current"' : ''}><th>Round ${roundIndex + 1}</th>${plan.teams.map(team => {
        const station = assignments.get(team.id);
        return `<td><strong>${esc(station?.name || 'Open')}</strong><span>${team.studentIds.map(id => studentLabel(students.get(String(id)) || { id })).map(esc).join(', ') || 'No students'}</span></td>`;
      }).join('')}</tr>`;
    }).join('');
    return `<div class="v702-schedule-wrap"><table class="v702-schedule"><thead><tr><th>Round</th>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function teamCards(plan) {
    if (!plan) return '<div class="hint">No rotation plan selected.</div>';
    const students = new Map(list(state?.students).map(student => [String(student.id), student]));
    return `<div class="v702-team-grid">${plan.teams.map(team => `<article class="v702-team-card"><header><strong>${esc(team.name)}</strong><span class="pill">${team.studentIds.length}</span></header><div>${team.studentIds.map(id => `<span class="v702-student-chip">${esc(studentLabel(students.get(String(id)) || { id }))}</span>`).join('') || '<span class="hint">No students</span>'}</div></article>`).join('')}</div>`;
  }

  function stationCards(plan) {
    if (!plan) return '<div class="hint">No rotation plan selected.</div>';
    const objectMap = new Map(stationCandidates().map(item => [item.objectId, item]));
    return `<div class="v702-station-grid">${plan.stations.map((station, index) => {
      const object = objectMap.get(String(station.objectId));
      const missing = !object;
      return `<article class="v702-station-card${missing ? ' missing' : ''}"><span class="v702-station-number">${index + 1}</span><div><strong>${esc(station.name)}</strong><small>${missing ? 'Anchor missing from current room' : object.type === 'table' ? 'Table' : object.type === 'lab' ? 'Lab Station' : 'Activity Station'}</small></div></article>`;
    }).join('')}</div>`;
  }

  function savedPlanCards(store) {
    if (!store?.plans?.length) return '<div class="hint">No saved station rotations yet.</div>';
    return `<div class="v702-plan-list">${store.plans.map(plan => `<article class="v702-plan-card${plan.id === store.activePlanId ? ' active' : ''}" data-v702-plan-id="${esc(plan.id)}"><div><strong>${esc(plan.name)}</strong><span>${plan.teams.length} teams · ${plan.stations.length} stations · ${plan.durationMinutes} min</span></div><div class="v702-plan-actions"><button class="tiny secondary" type="button" data-v702-activate="${esc(plan.id)}"${plan.id === store.activePlanId ? ' disabled' : ''}>${plan.id === store.activePlanId ? 'Current' : 'Select'}</button><button class="tiny secondary" type="button" data-v702-duplicate="${esc(plan.id)}">Duplicate</button><button class="tiny danger" type="button" data-v702-delete="${esc(plan.id)}">Delete</button></div></article>`).join('')}</div>`;
  }

  function modalMarkup() {
    return `<div id="${MODAL_ID}" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="stationRotationsV702Title"><div class="modal v702-modal"><div class="panel-header"><div><span class="v702-kicker">V7.0.2 Classroom Digital Twin</span><h2 id="stationRotationsV702Title">Station rotations</h2></div><button id="stationRotationsV702CloseBtn" class="tiny secondary" type="button">Close</button></div><div class="modal-body v702-modal-body">
      <div class="v702-intro"><strong>Build the lesson flow on top of the room you already designed.</strong><span>Rotation plans use existing Activity Stations, Lab Stations, and tables as destinations. They never rewrite seat assignments. Balanced teams use roster order and team size only, with no hidden student scoring.</span></div>
      <section class="section v702-section" id="stationRotationsV702Current"></section>
      <section class="section v702-section"><div class="v702-section-head"><div><h3>Create rotation</h3><p>Select at least two station anchors. Today Mode absences are excluded when teams are built.</p></div></div><div class="v702-create-grid"><label>Name<input id="stationRotationsV702Name" maxlength="80" value="Station Rotation" /></label><label>Team source<select id="stationRotationsV702TeamSource"><option value="balanced">Balanced by team size</option><option value="classroom-groups">Use classroom groups first</option></select></label><label>Teams<input id="stationRotationsV702TeamCount" type="number" min="1" max="24" value="4" /></label><label>Minutes / station<input id="stationRotationsV702Duration" type="number" min="1" max="180" value="12" /></label><label>Transition minutes<input id="stationRotationsV702Transition" type="number" min="0" max="30" value="2" /></label></div><div id="stationRotationsV702CandidateList" class="v702-candidate-list"></div><button id="stationRotationsV702CreateBtn" type="button">Create rotation</button></section>
      <section class="section v702-section"><div class="v702-section-head"><div><h3>Teams</h3><p>Rotation teams are plan-specific. Rebuild them when Today Mode attendance changes.</p></div><div class="v702-inline-actions"><button id="stationRotationsV702RebuildBalancedBtn" class="secondary tiny" type="button">Rebuild balanced</button><button id="stationRotationsV702RebuildGroupsBtn" class="secondary tiny" type="button">Use classroom groups</button></div></div><div id="stationRotationsV702Teams"></div></section>
      <section class="section v702-section"><div class="v702-section-head"><div><h3>Stations</h3><p>Anchors follow the real Freeform room geometry, including Activity Layout changes.</p></div></div><div id="stationRotationsV702Stations"></div></section>
      <section class="section v702-section"><div class="v702-section-head"><div><h3>Round schedule</h3><p>Each team advances one station per round. Empty stations remain available when there are fewer teams than destinations.</p></div></div><div id="stationRotationsV702Schedule"></div></section>
      <section class="section v702-section"><div class="v702-section-head"><div><h3>Saved rotations</h3><p>Keep separate flows for different lessons without duplicating the classroom.</p></div></div><div id="stationRotationsV702Saved"></div></section>
      <div id="stationRotationsV702Status" class="hint" role="status" aria-live="polite"></div>
    </div></div></div>`;
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    const host = document.createElement('div');
    host.innerHTML = modalMarkup();
    modal = host.firstElementChild;
    document.body.appendChild(modal);
    modal.querySelector('#stationRotationsV702CloseBtn')?.addEventListener('click', closeModal);
    modal.addEventListener('click', event => {
      if (event.target === modal) { closeModal(); return; }
      if (event.target?.id === 'stationRotationsV702CreateBtn') {
        const checked = [...modal.querySelectorAll('[data-v702-station-candidate]:checked')].map(node => node.value);
        createPlan({
          name:modal.querySelector('#stationRotationsV702Name')?.value,
          teamSource:modal.querySelector('#stationRotationsV702TeamSource')?.value,
          teamCount:modal.querySelector('#stationRotationsV702TeamCount')?.value,
          durationMinutes:modal.querySelector('#stationRotationsV702Duration')?.value,
          transitionMinutes:modal.querySelector('#stationRotationsV702Transition')?.value,
          stationIds:checked
        });
        renderModal();
        return;
      }
      if (event.target?.id === 'stationRotationsV702RenameBtn') {
        const plan = activePlan();
        renamePlan(plan?.id, modal.querySelector('#stationRotationsV702RenameInput')?.value);
        renderModal();
        return;
      }
      if (event.target?.id === 'stationRotationsV702StartBtnModal') { startRound(); renderModal(); return; }
      if (event.target?.id === 'stationRotationsV702TransitionBtn') { startTransition(); renderModal(); return; }
      if (event.target?.id === 'stationRotationsV702StopBtnModal') { stopTimer(); renderModal(); return; }
      if (event.target?.id === 'stationRotationsV702PrevBtnModal') { previousRound(); renderModal(); return; }
      if (event.target?.id === 'stationRotationsV702NextBtnModal') { nextRound(); renderModal(); return; }
      if (event.target?.id === 'stationRotationsV702SwitchLayoutBtn') { switchToLinkedLayout(); renderModal(); return; }
      if (event.target?.id === 'stationRotationsV702RebuildBalancedBtn') { rebuildTeams('', 'balanced'); renderModal(); return; }
      if (event.target?.id === 'stationRotationsV702RebuildGroupsBtn') { rebuildTeams('', 'classroom-groups'); renderModal(); return; }
      const activate = event.target?.closest?.('[data-v702-activate]');
      if (activate) { activatePlan(activate.dataset.v702Activate); renderModal(); return; }
      const duplicate = event.target?.closest?.('[data-v702-duplicate]');
      if (duplicate) { duplicatePlan(duplicate.dataset.v702Duplicate); renderModal(); return; }
      const remove = event.target?.closest?.('[data-v702-delete]');
      if (remove) { deletePlan(remove.dataset.v702Delete); renderModal(); }
    });
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
      announce('Station rotations are available for Freeform rooms.');
      return;
    }
    ensureModal();
    renderModal();
    openById(MODAL_ID);
  }

  function closeModal() { closeById(MODAL_ID); }

  function renderModal() {
    const modal = ensureModal();
    const store = ensureStore();
    const plan = activePlan(store);
    const current = modal.querySelector('#stationRotationsV702Current');
    if (current) {
      const link = linkedLayoutState(plan);
      const seconds = phaseSeconds(plan);
      current.innerHTML = plan ? `<div class="v702-section-head"><div><h3>Current rotation</h3><p>${esc(plan.activityLayoutId ? `Linked to ${link.linkedName || 'an Activity Layout'}.` : 'Not linked to a saved Activity Layout.')}</p></div><span class="pill special">Round ${plan.currentRound + 1} of ${roundCount(plan)}</span></div><div class="v702-current-grid"><label>Rename<input id="stationRotationsV702RenameInput" maxlength="80" value="${esc(plan.name)}" /></label><button id="stationRotationsV702RenameBtn" class="secondary" type="button">Rename</button><div class="v702-timer-card"><span>${plan.phase === 'transition' ? 'Transition' : plan.phase === 'round' ? 'Station time' : 'Ready'}</span><strong id="stationRotationsV702ModalTimer">${esc(formatTime(seconds))}</strong></div><button id="stationRotationsV702PrevBtnModal" class="secondary" type="button">Previous</button><button id="stationRotationsV702NextBtnModal" class="secondary" type="button">Next</button><button id="stationRotationsV702StartBtnModal" type="button">Start round</button>${plan.transitionMinutes > 0 ? '<button id="stationRotationsV702TransitionBtn" class="secondary" type="button">Transition</button>' : ''}<button id="stationRotationsV702StopBtnModal" class="ghost" type="button">Stop timer</button>${!link.matches && link.linkedId ? `<button id="stationRotationsV702SwitchLayoutBtn" class="secondary" type="button">Switch to ${esc(link.linkedName || 'linked layout')}</button>` : ''}</div>` : '<div class="v702-section-head"><div><h3>No active rotation</h3><p>Create a plan below, or select a saved one.</p></div></div>';
    }
    const candidates = stationCandidates();
    const candidateList = modal.querySelector('#stationRotationsV702CandidateList');
    if (candidateList) candidateList.innerHTML = candidates.length ? candidates.map((station, index) => `<label class="v702-candidate"><input type="checkbox" data-v702-station-candidate value="${esc(station.objectId)}"${index < Math.min(6, candidates.length) ? ' checked' : ''}><span><strong>${esc(station.name)}</strong><small>${station.type === 'table' ? 'Table' : station.type === 'lab' ? 'Lab Station' : 'Activity Station'}</small></span></label>`).join('') : '<div class="hint">No station anchors found. Add Activity Stations, Lab Stations, or tables in Room Design first.</div>';
    const teamCount = modal.querySelector('#stationRotationsV702TeamCount');
    if (teamCount) teamCount.max = String(Math.max(1, candidates.length));
    const teams = modal.querySelector('#stationRotationsV702Teams');
    if (teams) teams.innerHTML = teamCards(plan);
    const stations = modal.querySelector('#stationRotationsV702Stations');
    if (stations) stations.innerHTML = stationCards(plan);
    const schedule = modal.querySelector('#stationRotationsV702Schedule');
    if (schedule) schedule.innerHTML = scheduleTable(plan);
    const saved = modal.querySelector('#stationRotationsV702Saved');
    if (saved) saved.innerHTML = savedPlanCards(store);
    renderToolbar();
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .v702-toolbar{display:none;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}.v702-toolbar-label{font-size:10px;font-weight:900;color:var(--muted,#607089);white-space:nowrap}.v702-toolbar select{min-width:145px;max-width:220px}.v702-round-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border:1px solid var(--border,#d8deea);border-radius:999px;background:var(--panel,#fff);font-size:10px;font-weight:800;white-space:nowrap}.v702-round-chip b{font-variant-numeric:tabular-nums}.freeform-object.v702-station-active{overflow:visible!important}.v702-station-overlay{position:absolute;left:50%;top:-13px;transform:translate(-50%,-100%);display:grid;grid-template-columns:auto 1fr;grid-template-areas:'n name' 'n team';column-gap:6px;align-items:center;min-width:120px;max-width:210px;padding:6px 8px;border-radius:10px;border:1px solid color-mix(in srgb,#6d28d9 34%,var(--border,#d8deea));background:color-mix(in srgb,var(--panel,#fff) 92%,#ede9fe 8%);box-shadow:0 5px 14px rgba(15,23,42,.12);pointer-events:none;z-index:40}.v702-station-overlay>span{grid-area:n;display:grid;place-items:center;width:24px;height:24px;border-radius:999px;background:#6d28d9;color:#fff;font-size:10px;font-weight:900}.v702-station-overlay strong{grid-area:name;font-size:10px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v702-station-overlay small{grid-area:team;font-size:9px;color:var(--muted,#607089);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v702-modal{width:min(1120px,calc(100vw - 24px));height:min(920px,calc(100vh - 24px))}.v702-modal-body{display:grid;gap:14px;overflow:auto;padding-bottom:28px}.v702-kicker{display:block;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#607089);margin-bottom:3px}.v702-intro{display:flex;gap:10px;align-items:baseline;padding:12px 14px;border:1px solid var(--border,#d8deea);border-radius:12px;background:color-mix(in srgb,var(--panel,#fff) 94%,#6d28d9 6%)}.v702-intro span{color:var(--muted,#607089)}.v702-section{display:grid;gap:10px}.v702-section-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v702-section-head h3{margin:0 0 3px}.v702-section-head p{margin:0;color:var(--muted,#607089);font-size:12px}.v702-create-grid{display:grid;grid-template-columns:2fr 1.4fr repeat(3,minmax(100px,.8fr));gap:8px}.v702-create-grid label,.v702-current-grid label{display:grid;gap:4px;font-size:11px;font-weight:800}.v702-candidate-list{display:grid;grid-template-columns:repeat(3,minmax(170px,1fr));gap:7px}.v702-candidate{display:flex;gap:8px;align-items:center;border:1px solid var(--border,#d8deea);border-radius:10px;padding:8px;background:var(--panel,#fff)}.v702-candidate>span{display:grid;gap:1px}.v702-candidate small,.v702-station-card small,.v702-plan-card span{font-size:9px;color:var(--muted,#607089)}.v702-inline-actions{display:flex;gap:6px;flex-wrap:wrap}.v702-current-grid{display:grid;grid-template-columns:minmax(180px,1fr) auto 120px repeat(5,auto);gap:8px;align-items:end}.v702-timer-card{display:grid;gap:1px;border:1px solid var(--border,#d8deea);border-radius:10px;padding:6px 10px;background:var(--panel,#fff)}.v702-timer-card span{font-size:9px;color:var(--muted,#607089)}.v702-timer-card strong{font-size:18px;font-variant-numeric:tabular-nums}.v702-team-grid{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:8px}.v702-team-card,.v702-station-card,.v702-plan-card{border:1px solid var(--border,#d8deea);border-radius:11px;padding:9px;background:var(--panel,#fff)}.v702-team-card header{display:flex;justify-content:space-between;gap:8px;margin-bottom:6px}.v702-team-card>div{display:flex;flex-wrap:wrap;gap:4px}.v702-student-chip{display:inline-flex;padding:3px 6px;border-radius:999px;background:color-mix(in srgb,var(--panel,#fff) 80%,#dbeafe 20%);border:1px solid color-mix(in srgb,var(--border,#d8deea) 80%,#2563eb 20%);font-size:9px}.v702-station-grid{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:7px}.v702-station-card{display:flex;gap:8px;align-items:center}.v702-station-card.missing{border-style:dashed;opacity:.72}.v702-station-number{display:grid;place-items:center;width:25px;height:25px;border-radius:999px;background:#6d28d9;color:#fff;font-size:10px;font-weight:900}.v702-station-card>div{display:grid;gap:1px}.v702-schedule-wrap{overflow:auto;border:1px solid var(--border,#d8deea);border-radius:11px}.v702-schedule{width:100%;border-collapse:collapse;min-width:680px}.v702-schedule th,.v702-schedule td{padding:8px;border-bottom:1px solid var(--border,#e2e8f0);border-right:1px solid var(--border,#e2e8f0);vertical-align:top;text-align:left}.v702-schedule tr.current{background:color-mix(in srgb,var(--panel,#fff) 90%,#ede9fe 10%)}.v702-schedule td{display:table-cell}.v702-schedule td strong{display:block;font-size:10px}.v702-schedule td span{display:block;font-size:9px;color:var(--muted,#607089);margin-top:2px}.v702-plan-list{display:grid;gap:7px}.v702-plan-card{display:flex;justify-content:space-between;gap:10px;align-items:center}.v702-plan-card.active{border-color:#6d28d9;box-shadow:0 0 0 2px color-mix(in srgb,#6d28d9 16%,transparent)}.v702-plan-card>div:first-child{display:grid;gap:2px}.v702-plan-actions{display:flex;gap:6px;flex-wrap:wrap}
      body.visibility-mode .v702-toolbar{display:none!important}body.visibility-mode .v702-station-overlay{box-shadow:none}.print-preview-active .v702-toolbar{display:none!important}@media print{.v702-toolbar,.v702-modal{display:none!important}.v702-station-overlay{display:none!important}}
      @media(max-width:980px){.v702-toolbar{flex:1 1 100%;width:100%}.v702-toolbar-label{display:none}.v702-toolbar select{flex:1;max-width:none;min-width:0}.v702-modal{width:calc(100vw - 10px);height:calc(100vh - 10px)}.v702-intro,.v702-section-head{flex-direction:column;align-items:stretch}.v702-create-grid{grid-template-columns:1fr 1fr}.v702-candidate-list,.v702-team-grid{grid-template-columns:1fr 1fr}.v702-station-grid{grid-template-columns:1fr 1fr}.v702-current-grid{grid-template-columns:1fr 1fr}.v702-current-grid label{grid-column:1/-1}.v702-plan-card{align-items:flex-start;flex-direction:column}.v702-plan-actions{width:100%}.v702-plan-actions button{flex:1}}
      @media(max-width:560px){.v702-create-grid,.v702-candidate-list,.v702-team-grid,.v702-station-grid,.v702-current-grid{grid-template-columns:1fr}.v702-current-grid label{grid-column:auto}.v702-toolbar .v702-round-chip{order:3;flex:1 1 100%;justify-content:center}.v702-station-overlay{min-width:105px;max-width:160px;padding:5px 6px}.v702-schedule-wrap{max-width:100%}}
    `;
    document.head.appendChild(style);
  }

  function tick() {
    const plan = activePlan();
    const seconds = phaseSeconds(plan);
    const key = `${plan?.id || ''}:${plan?.phase || ''}:${seconds}`;
    if (key === lastTickKey) return;
    lastTickKey = key;
    const toolbarTimer = document.getElementById('stationRotationsV702TimerText');
    const modalTimer = document.getElementById('stationRotationsV702ModalTimer');
    const text = formatTime(seconds);
    if (toolbarTimer) toolbarTimer.textContent = text;
    if (modalTimer) modalTimer.textContent = text;
    if (seconds === 0 && plan?.phase && plan.phase !== 'stopped') {
      if (toolbarTimer) toolbarTimer.textContent = 'Time';
      if (modalTimer) modalTimer.textContent = 'Time';
    }
  }

  function refreshUi() {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      installToolbar();
      renderCanvasOverlays();
      if (document.getElementById(MODAL_ID)?.classList.contains('show')) renderModal();
      tick();
    });
  }

  function observeCanvas() {
    const canvas = document.getElementById('seatGrid');
    if (!canvas) { setTimeout(observeCanvas, 250); return; }
    if (observer && observedCanvas === canvas) return;
    observer?.disconnect();
    observedCanvas = canvas;
    observer = new MutationObserver(() => refreshUi());
    observer.observe(canvas, { childList:true, subtree:false });
  }

  function installEvents() {
    document.addEventListener('change', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.matches?.('#classSelect,#layoutModeSelect,[data-class-id]')) setTimeout(refreshUi, 0);
    }, true);
    window.addEventListener('resize', refreshUi, { passive:true });
    window.addEventListener('beforeunload', () => {
      const store = ensureStore();
      if (store && activeLayout()) activeLayout().stationRotations = store;
    });
    if (!timerHandle) timerHandle = window.setInterval(tick, 1000);
  }

  function install() {
    installStyles();
    ensureModal();
    installToolbar();
    observeCanvas();
    installEvents();
  }

  function afterReady() {
    ensureStore();
    installToolbar();
    observeCanvas();
    refreshUi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();

  return Object.freeze({
    version:VERSION,
    install,
    afterReady,
    ensureStore,
    normalizeStore,
    stationCandidates,
    activePlan,
    createPlan,
    activatePlan,
    duplicatePlan,
    renamePlan,
    deletePlan,
    rebuildTeams,
    moveStudent,
    roundCount,
    roundAssignments,
    setRound,
    nextRound,
    previousRound,
    startRound,
    startTransition,
    stopTimer,
    phaseSeconds,
    linkedLayoutState,
    switchToLinkedLayout,
    open:openModal,
    close:closeModal,
    refresh:refreshUi
  });
})();

'use strict';
