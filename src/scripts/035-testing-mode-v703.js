window.TestingModeV703 = (() => {
  'use strict';

  const VERSION = '7.0.3';
  const STORE_VERSION = 1;
  const STYLE_ID = 'testingModeV703Styles';
  const MODAL_ID = 'testingModeV703Modal';
  const TOOLBAR_ID = 'testingModeV703Toolbar';
  const OVERLAY_CLASS = 'v703-testing-preview';
  const RUNTIME_STORE = Symbol('testingModeV703RuntimeStore');
  const OBSTACLE_TYPES = new Set(['wall', 'door', 'teacher', 'table', 'shelf', 'cabinet', 'lab', 'sink', 'station', 'blocked', 'walkway', 'board', 'projector']);

  let preview = null;
  let observer = null;
  let observedCanvas = null;
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

  function activeLayout() {
    return state?.freeformLayout && typeof state.freeformLayout === 'object' ? state.freeformLayout : null;
  }

  function activeStudents() {
    try {
      if (typeof seatingStudents === 'function') return list(seatingStudents());
    } catch (_) { /* fallback below */ }
    const absent = state?.todaySession?.active ? new Set(list(state.todaySession.absentStudentIds).map(String)) : new Set();
    return list(state?.students).filter(student => !student?.archived && !absent.has(String(student?.id || '')));
  }

  function studentById(id) {
    try { if (typeof getStudent === 'function') return getStudent(id); } catch (_) { /* fallback below */ }
    return list(state?.students).find(student => String(student?.id || '') === String(id || '')) || null;
  }

  function studentLabel(student) {
    try { if (typeof studentDisplay === 'function') return studentDisplay(student); } catch (_) { /* fallback below */ }
    const first = String(student?.nickName || student?.firstName || '').trim();
    const last = String(student?.lastName || '').trim();
    return [first, last].filter(Boolean).join(' ') || String(student?.id || 'Student');
  }

  function normalizeConfig(value = {}, layout = activeLayout()) {
    const room = window.ClassroomDigitalTwinV700?.physicalRoom?.(layout) || { enabled:false, unit:'ft' };
    const defaultSpacing = room.enabled ? (room.unit === 'm' ? 1.5 : 5) : 1.8;
    return {
      spacing: clamp(value.spacing, room.enabled ? (room.unit === 'm' ? 0.5 : 2) : 0.8, room.enabled ? (room.unit === 'm' ? 6 : 20) : 5, defaultSpacing),
      preserveLocked: value.preserveLocked !== false,
      respectNeeds: value.respectNeeds !== false,
      keepExtraSeatsNearEdges: value.keepExtraSeatsNearEdges !== false,
      name: String(value.name || 'Testing').trim().slice(0, 80) || 'Testing'
    };
  }

  function normalizeReport(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      generatedAt:String(source.generatedAt || ''),
      requestedSpacing:Math.max(0, number(source.requestedSpacing)),
      achievedSpacing:Math.max(0, number(source.achievedSpacing)),
      unit:String(source.unit || ''),
      activeSeatCount:Math.max(0, Math.floor(number(source.activeSeatCount))),
      movedCount:Math.max(0, Math.floor(number(source.movedCount))),
      lockedCount:Math.max(0, Math.floor(number(source.lockedCount))),
      spacingConflicts:Math.max(0, Math.floor(number(source.spacingConflicts))),
      needIssues:list(source.needIssues).slice(0, 100).map(String),
      impossibleReasons:list(source.impossibleReasons).slice(0, 40).map(String)
    };
  }

  function normalizeStore(layout = activeLayout()) {
    const source = layout?.testingMode && typeof layout.testingMode === 'object' ? layout.testingMode : {};
    return {
      version:STORE_VERSION,
      lastConfig:normalizeConfig(source.lastConfig || {}, layout),
      lastReport:normalizeReport(source.lastReport || {}),
      sourceActivityLayoutId:String(source.sourceActivityLayoutId || ''),
      activeTestingLayoutId:String(source.activeTestingLayoutId || ''),
      generatedAt:String(source.generatedAt || '')
    };
  }

  function ensureStore() {
    let layout = activeLayout();
    if (!layout) {
      try { if (typeof ensureFreeformLayout === 'function') ensureFreeformLayout(); } catch (_) { /* no-op */ }
      layout = activeLayout();
    }
    if (!layout) return null;
    let store = layout.testingMode;
    if (!store?.[RUNTIME_STORE]) {
      store = normalizeStore(layout);
      Object.defineProperty(store, RUNTIME_STORE, { value:true, enumerable:false, configurable:false });
      layout.testingMode = store;
    }
    return store;
  }

  function schedulePersist(reason = 'testing-mode') {
    try { persistActiveClass?.(); } catch (_) { /* best effort */ }
    try { scheduleLinkedFileAutosave?.(reason); } catch (_) { /* optional */ }
    try { scheduleLinkedAutoSave?.(reason); } catch (_) { /* compatibility */ }
    try { persistFreeformGeometrySession?.(reason); } catch (_) { /* optional */ }
  }

  function announce(message) {
    const text = String(message || '');
    const node = document.getElementById('testingModeV703Status');
    if (node) node.textContent = text;
    try { setLiveStatusMessage?.(text); } catch (_) { /* optional */ }
  }

  function metrics(layout = activeLayout()) {
    const twin = window.ClassroomDigitalTwinV700;
    const room = twin?.physicalRoom?.(layout) || { enabled:false, unit:'ft', width:0, height:0 };
    if (room.enabled && twin?.canvasMetrics) {
      const physical = twin.canvasMetrics(layout);
      return { ...physical, scaled:true, unit:room.unit };
    }
    const widthPx = Math.max(1, number(layout?.canvas?.width, 2800));
    const heightPx = Math.max(1, number(layout?.canvas?.height, 1800));
    const seats = list(layout?.objects).filter(object => object?.type === 'seat');
    const medianWidth = seats.length
      ? seats.map(seat => Math.max(1, number(seat.width, 176))).sort((a,b) => a-b)[Math.floor(seats.length / 2)]
      : 176;
    return { room, widthPx, heightPx, pxPerUnitX:medianWidth, pxPerUnitY:medianWidth, scaled:false, unit:'seat widths', medianWidth };
  }

  function center(object) {
    return {
      x:number(object?.x) + Math.max(1, number(object?.width, 1)) / 2,
      y:number(object?.y) + Math.max(1, number(object?.height, 1)) / 2
    };
  }

  function distance(a, b, roomMetrics = metrics()) {
    if (!a || !b) return Infinity;
    const ac = center(a);
    const bc = center(b);
    return Math.hypot((ac.x - bc.x) / roomMetrics.pxPerUnitX, (ac.y - bc.y) / roomMetrics.pxPerUnitY);
  }

  function rectFor(object, x = object?.x, y = object?.y, margin = 0) {
    return {
      left:number(x) - margin,
      top:number(y) - margin,
      right:number(x) + Math.max(1, number(object?.width, 1)) + margin,
      bottom:number(y) + Math.max(1, number(object?.height, 1)) + margin
    };
  }

  function overlaps(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function roomFrontSide(layout = activeLayout()) {
    const side = String(layout?.canvas?.frontSide || 'top');
    return ['top','bottom','left','right'].includes(side) ? side : 'top';
  }

  function frontRatio(point, layout = activeLayout()) {
    const width = Math.max(1, number(layout?.canvas?.width, 2800));
    const height = Math.max(1, number(layout?.canvas?.height, 1800));
    const side = roomFrontSide(layout);
    if (side === 'bottom') return 1 - clamp(point.y / height, 0, 1, 0.5);
    if (side === 'left') return clamp(point.x / width, 0, 1, 0.5);
    if (side === 'right') return 1 - clamp(point.x / width, 0, 1, 0.5);
    return clamp(point.y / height, 0, 1, 0.5);
  }

  function sideRatio(point, layout = activeLayout()) {
    const width = Math.max(1, number(layout?.canvas?.width, 2800));
    return clamp(point.x / width, 0, 1, 0.5);
  }

  function pointNearEdge(point, layout = activeLayout()) {
    const width = Math.max(1, number(layout?.canvas?.width, 2800));
    const height = Math.max(1, number(layout?.canvas?.height, 1800));
    return point.x < width * 0.14 || point.x > width * 0.86 || point.y < height * 0.14 || point.y > height * 0.86;
  }

  function pointToObjectDistance(point, object, roomMetrics = metrics()) {
    if (!object) return Infinity;
    const oc = center(object);
    return Math.hypot((point.x - oc.x) / roomMetrics.pxPerUnitX, (point.y - oc.y) / roomMetrics.pxPerUnitY);
  }

  function isNearAda(point, layout = activeLayout()) {
    const seats = list(layout?.objects).filter(object => object?.type === 'seat');
    const typical = seats[0] || { width:176, height:112 };
    return list(layout?.objects).some(object => {
      if (object?.type !== 'ada') return false;
      const rect = rectFor(object, object.x, object.y, Math.max(number(typical.width, 176), number(typical.height, 112)) * 0.45);
      return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
    });
  }

  function requirements(studentId) {
    const student = studentById(studentId);
    if (!student) return {};
    try {
      if (typeof effectiveStudentRequirements === 'function') return effectiveStudentRequirements(student) || {};
    } catch (_) { /* fallback below */ }
    return student.requirements || {};
  }

  function candidateNeedScore(seat, point, config, layout, roomMetrics) {
    if (!config.respectNeeds || !seat?.assignedStudentId) return 0;
    const req = requirements(seat.assignedStudentId);
    let score = 0;
    const front = frontRatio(point, layout);
    const side = sideRatio(point, layout);
    const doors = list(layout?.objects).filter(object => object?.type === 'door');
    const windows = list(layout?.objects).filter(object => object?.type === 'window');
    const nearAda = isNearAda(point, layout);
    if (req.ada) score += nearAda ? 30000 : -50000;
    if (req.front === 'require') score += front <= 0.42 ? 9000 : -12000 * (front - 0.42 + 1);
    else if (req.front === 'prefer') score += Math.max(0, 1 - front) * 1800;
    if (req.side === 'left') score += (1 - side) * 900;
    if (req.side === 'right') score += side * 900;
    if (req.aisle) score += pointNearEdge(point, layout) ? 1500 : -700;
    if (req.awayDoor && doors.length) score += Math.min(...doors.map(object => pointToObjectDistance(point, object, roomMetrics))) * 180;
    if (req.awayWindow && windows.length) score += Math.min(...windows.map(object => pointToObjectDistance(point, object, roomMetrics))) * 120;
    return score;
  }

  function seatImportance(seat) {
    if (seat?.locked) return 100000;
    const req = requirements(seat?.assignedStudentId);
    return (req.ada ? 10000 : 0) + (req.front === 'require' ? 5000 : 0) + (req.aisle ? 1200 : 0) + (req.front === 'prefer' ? 700 : 0) + (req.awayDoor || req.awayWindow ? 300 : 0);
  }

  function activeStudentIds() {
    return new Set(activeStudents().map(student => String(student.id)));
  }

  function primarySeats(layout = activeLayout()) {
    const active = activeStudentIds();
    return list(layout?.objects).filter(object => object?.type === 'seat' && object.assignedStudentId && active.has(String(object.assignedStudentId)));
  }

  function obstacles(layout = activeLayout()) {
    return list(layout?.objects).filter(object => object && object.type !== 'seat' && OBSTACLE_TYPES.has(String(object.type || '')));
  }

  function candidatePositions(seat, layout = activeLayout()) {
    const width = Math.max(400, number(layout?.canvas?.width, 2800));
    const height = Math.max(300, number(layout?.canvas?.height, 1800));
    const seatW = Math.max(40, number(seat?.width, 176));
    const seatH = Math.max(35, number(seat?.height, 112));
    const marginX = seatW / 2 + 24;
    const marginY = seatH / 2 + 24;
    const step = clamp(Math.min(seatW, seatH) * 0.72, 58, 130, 78);
    const fixedObstacles = obstacles(layout);
    const positions = [];
    let rowIndex = 0;
    for (let cy = marginY; cy <= height - marginY + 0.1; cy += step) {
      const offset = rowIndex % 2 ? step * 0.5 : 0;
      for (let cx = marginX + offset; cx <= width - marginX + 0.1; cx += step) {
        const x = cx - seatW / 2;
        const y = cy - seatH / 2;
        const rect = rectFor(seat, x, y, 8);
        if (fixedObstacles.some(object => overlaps(rect, rectFor(object, object.x, object.y, 8)))) continue;
        positions.push({ x, y, cx, cy });
      }
      rowIndex += 1;
    }
    const current = center(seat);
    positions.push({ x:number(seat.x), y:number(seat.y), cx:current.x, cy:current.y, current:true });
    const seen = new Set();
    return positions.filter(item => {
      const key = `${Math.round(item.x)}:${Math.round(item.y)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function minimumSpacing(seats, roomMetrics = metrics()) {
    const collection = list(seats);
    if (collection.length < 2) return Infinity;
    let minimum = Infinity;
    for (let i = 0; i < collection.length; i += 1) {
      for (let j = i + 1; j < collection.length; j += 1) minimum = Math.min(minimum, distance(collection[i], collection[j], roomMetrics));
    }
    return minimum;
  }

  function placementObject(seat, position) {
    return { ...clone(seat), x:number(position.x), y:number(position.y) };
  }

  function collidesWithSeats(seat, position, placed) {
    const rect = rectFor(seat, position.x, position.y, 6);
    return list(placed).some(existing => overlaps(rect, rectFor(existing, existing.x, existing.y, 6)));
  }

  function distanceFromOriginal(seat, position, roomMetrics) {
    const proposal = placementObject(seat, position);
    return distance(seat, proposal, roomMetrics);
  }

  function bestPosition(seat, candidates, placedPrimary, placedAll, config, layout, roomMetrics, isFirst) {
    let best = null;
    let bestScore = -Infinity;
    const centerPoint = { x:roomMetrics.widthPx / 2, y:roomMetrics.heightPx / 2 };
    candidates.forEach(position => {
      if (collidesWithSeats(seat, position, placedAll)) return;
      const proposal = placementObject(seat, position);
      const separation = placedPrimary.length
        ? Math.min(...placedPrimary.map(existing => distance(proposal, existing, roomMetrics)))
        : Math.hypot((position.cx - centerPoint.x) / roomMetrics.pxPerUnitX, (position.cy - centerPoint.y) / roomMetrics.pxPerUnitY);
      const spacingScore = Math.min(separation, config.spacing * 2.5) * 1800;
      const needScore = candidateNeedScore(seat, { x:position.cx, y:position.cy }, config, layout, roomMetrics);
      const moveCost = distanceFromOriginal(seat, position, roomMetrics) * 18;
      const edgeSeed = isFirst ? separation * 500 : 0;
      const score = spacingScore + needScore + edgeSeed - moveCost;
      if (score > bestScore) {
        bestScore = score;
        best = position;
      }
    });
    return best;
  }

  function seatPairConflicts(seats, requested, roomMetrics) {
    const conflicts = [];
    for (let i = 0; i < seats.length; i += 1) {
      for (let j = i + 1; j < seats.length; j += 1) {
        const value = distance(seats[i], seats[j], roomMetrics);
        if (value + 1e-6 < requested) conflicts.push({ a:seats[i], b:seats[j], distance:value });
      }
    }
    return conflicts.sort((a,b) => a.distance - b.distance);
  }

  function needIssuesFor(seats, config, layout, roomMetrics) {
    if (!config.respectNeeds) return [];
    const issues = [];
    seats.forEach(seat => {
      if (!seat.assignedStudentId) return;
      const student = studentById(seat.assignedStudentId);
      const req = requirements(seat.assignedStudentId);
      const point = center(seat);
      const name = studentLabel(student || { id:seat.assignedStudentId });
      const front = frontRatio(point, layout);
      if (req.ada && !isNearAda(point, layout)) issues.push(`${name} still does not have a seat in or beside an accessibility area.`);
      if (req.front === 'require' && front > 0.42) issues.push(`${name} still falls outside the required front area.`);
      if (req.aisle && !pointNearEdge(point, layout)) issues.push(`${name} still does not have an aisle/edge position.`);
    });
    return issues;
  }

  function directionText(dx, dy, roomMetrics, layout = activeLayout()) {
    const horizontal = Math.abs(dx) < 0.03 ? '' : `${Math.abs(dx).toFixed(Math.abs(dx) < 10 ? 1 : 0)} ${roomMetrics.unit} ${dx > 0 ? 'right' : 'left'} on the room plan`;
    const verticalAmount = Math.abs(dy);
    let vertical = '';
    if (verticalAmount >= 0.03) {
      const side = roomFrontSide(layout);
      let word = dy > 0 ? 'down' : 'up';
      if (side === 'top') word = dy > 0 ? 'toward the back' : 'toward the front';
      if (side === 'bottom') word = dy > 0 ? 'toward the front' : 'toward the back';
      vertical = `${verticalAmount.toFixed(verticalAmount < 10 ? 1 : 0)} ${roomMetrics.unit} ${word}`;
    }
    return [horizontal, vertical].filter(Boolean).join(' and ') || 'only a very small amount';
  }

  function transitionSteps(originalSeats, proposedSeats, roomMetrics = metrics(), layout = activeLayout()) {
    const original = new Map(list(originalSeats).map(seat => [String(seat.id), seat]));
    return list(proposedSeats)
      .map(seat => {
        const before = original.get(String(seat.id));
        if (!before) return null;
        const start = center(before);
        const end = center(seat);
        const dx = (end.x - start.x) / roomMetrics.pxPerUnitX;
        const dy = (end.y - start.y) / roomMetrics.pxPerUnitY;
        const moveDistance = Math.hypot(dx, dy);
        if (moveDistance < 0.08) return null;
        const student = studentById(seat.assignedStudentId);
        const label = student ? `${studentLabel(student)}'s seat` : String(seat.label || seat.id || 'Seat');
        return {
          id:String(seat.id),
          label,
          distance:moveDistance,
          instruction:`Move ${label} ${directionText(dx, dy, roomMetrics, layout)}.`
        };
      })
      .filter(Boolean)
      .sort((a,b) => b.distance - a.distance);
  }

  function analyze(configInput = {}) {
    const layout = activeLayout();
    if (!layout || state?.layoutMode !== 'freeform') return null;
    const config = normalizeConfig(configInput, layout);
    const roomMetrics = metrics(layout);
    const allSeats = list(layout.objects).filter(object => object?.type === 'seat').map(clone);
    const primary = primarySeats(layout).map(clone);
    const primaryIds = new Set(primary.map(seat => String(seat.id)));
    const locked = config.preserveLocked ? primary.filter(seat => seat.locked) : [];
    const movable = primary.filter(seat => !config.preserveLocked || !seat.locked).sort((a,b) => seatImportance(b) - seatImportance(a));
    const placedPrimary = locked.map(clone);
    const placedAll = locked.map(clone);
    const proposals = new Map(locked.map(seat => [String(seat.id), clone(seat)]));
    const impossibleReasons = [];
    const adaNeeded = movable.some(seat => requirements(seat.assignedStudentId).ada) || locked.some(seat => requirements(seat.assignedStudentId).ada);
    const adaAreas = list(layout.objects).filter(object => object?.type === 'ada');
    if (adaNeeded && !adaAreas.length) impossibleReasons.push('At least one active student requires an accessibility area, but the room has no Accessibility Area object to target.');

    movable.forEach((seat, index) => {
      const candidates = candidatePositions(seat, layout);
      const selected = bestPosition(seat, candidates, placedPrimary, placedAll, config, layout, roomMetrics, placedPrimary.length === 0 && index === 0);
      const next = selected ? placementObject(seat, selected) : clone(seat);
      if (!selected) impossibleReasons.push(`${studentLabel(studentById(seat.assignedStudentId) || { id:seat.assignedStudentId })}: no collision-free testing position was available.`);
      proposals.set(String(seat.id), next);
      placedPrimary.push(next);
      placedAll.push(next);
    });

    const extras = allSeats.filter(seat => !primaryIds.has(String(seat.id)));
    extras.forEach(seat => {
      const candidates = candidatePositions(seat, layout)
        .filter(position => !collidesWithSeats(seat, position, placedAll))
        .sort((a,b) => {
          const ac = center(placementObject(seat, a));
          const bc = center(placementObject(seat, b));
          const edgeA = Math.min(ac.x, roomMetrics.widthPx - ac.x, ac.y, roomMetrics.heightPx - ac.y);
          const edgeB = Math.min(bc.x, roomMetrics.widthPx - bc.x, bc.y, roomMetrics.heightPx - bc.y);
          if (config.keepExtraSeatsNearEdges && Math.abs(edgeA - edgeB) > 2) return edgeA - edgeB;
          return distanceFromOriginal(seat, a, roomMetrics) - distanceFromOriginal(seat, b, roomMetrics);
        });
      const selected = candidates[0];
      const next = selected ? placementObject(seat, selected) : clone(seat);
      proposals.set(String(seat.id), next);
      placedAll.push(next);
    });

    const proposedSeats = allSeats.map(seat => proposals.get(String(seat.id)) || clone(seat));
    const proposedPrimary = proposedSeats.filter(seat => primaryIds.has(String(seat.id)));
    const achieved = minimumSpacing(proposedPrimary, roomMetrics);
    const conflicts = seatPairConflicts(proposedPrimary, config.spacing, roomMetrics);
    const needIssues = needIssuesFor(proposedPrimary, config, layout, roomMetrics);
    const beforeMinimum = minimumSpacing(primary, roomMetrics);
    if (conflicts.length) {
      const short = Number.isFinite(achieved) ? achieved.toFixed(achieved < 10 ? 1 : 0) : 'unknown';
      impossibleReasons.push(`The requested ${config.spacing} ${roomMetrics.unit} separation cannot be reached everywhere with the current room, fixed furniture, locked seats, and active roster. Best generated minimum: ${short} ${roomMetrics.unit}.`);
    }
    if (locked.length > 1 && seatPairConflicts(locked, config.spacing, roomMetrics).length) impossibleReasons.push('Two or more locked testing seats are already closer together than the requested spacing. Unlock or move them manually to improve separation.');
    if (needIssues.length) impossibleReasons.push('Some required accessibility/front/aisle needs still need teacher review after the spacing pass.');

    const steps = transitionSteps(allSeats, proposedSeats, roomMetrics, layout);
    return {
      id:`testing-preview-${Date.now().toString(36)}`,
      generatedAt:nowIso(),
      config,
      roomMetrics:{ scaled:roomMetrics.scaled, unit:roomMetrics.unit, widthPx:roomMetrics.widthPx, heightPx:roomMetrics.heightPx, pxPerUnitX:roomMetrics.pxPerUnitX, pxPerUnitY:roomMetrics.pxPerUnitY },
      originalSeats:allSeats,
      proposedSeats,
      primarySeatIds:[...primaryIds],
      report:{
        generatedAt:nowIso(),
        requestedSpacing:config.spacing,
        achievedSpacing:Number.isFinite(achieved) ? achieved : 0,
        beforeSpacing:Number.isFinite(beforeMinimum) ? beforeMinimum : 0,
        unit:roomMetrics.unit,
        activeSeatCount:primary.length,
        movedCount:steps.length,
        lockedCount:locked.length,
        spacingConflicts:conflicts.length,
        needIssues,
        impossibleReasons:[...new Set(impossibleReasons)]
      },
      conflicts:conflicts.map(item => ({ aId:String(item.a.id), bId:String(item.b.id), distance:item.distance })),
      transitionSteps:steps
    };
  }

  function clearPreviewOverlays() {
    document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach(node => node.remove());
  }

  function renderPreviewOverlays() {
    clearPreviewOverlays();
    if (!preview) return;
    const canvas = document.getElementById('seatGrid');
    if (!canvas || state?.layoutMode !== 'freeform') return;
    const original = new Map(preview.originalSeats.map(seat => [String(seat.id), seat]));
    const primary = new Set(preview.primarySeatIds);
    const conflictIds = new Set(preview.conflicts.flatMap(pair => [pair.aId, pair.bId]));
    preview.proposedSeats.forEach(seat => {
      if (!primary.has(String(seat.id))) return;
      const before = original.get(String(seat.id));
      const moved = before && (Math.abs(number(before.x) - number(seat.x)) > 2 || Math.abs(number(before.y) - number(seat.y)) > 2);
      const node = document.createElement('div');
      node.className = `${OVERLAY_CLASS}${moved ? ' moved' : ''}${conflictIds.has(String(seat.id)) ? ' conflict' : ''}`;
      node.style.left = `${number(seat.x)}px`;
      node.style.top = `${number(seat.y)}px`;
      node.style.width = `${Math.max(1, number(seat.width, 176))}px`;
      node.style.height = `${Math.max(1, number(seat.height, 112))}px`;
      node.style.transform = `rotate(${number(seat.rotation)}deg)`;
      node.style.pointerEvents = 'none';
      node.setAttribute('aria-hidden', 'true');
      canvas.appendChild(node);
    });
  }

  function generatePreview(configInput = {}) {
    preview = analyze(configInput);
    if (!preview) {
      announce('Testing Mode is available for Freeform rooms.');
      return null;
    }
    const store = ensureStore();
    if (store) {
      store.lastConfig = clone(preview.config);
      store.lastReport = normalizeReport(preview.report);
      store.generatedAt = preview.generatedAt;
      activeLayout().testingMode = store;
    }
    renderPreviewOverlays();
    renderModal();
    const report = preview.report;
    const improvement = report.achievedSpacing - report.beforeSpacing;
    announce(`Testing preview generated: ${report.activeSeatCount} active seats, ${report.movedCount} moves, minimum spacing ${report.achievedSpacing.toFixed(report.achievedSpacing < 10 ? 1 : 0)} ${report.unit}${improvement > 0.05 ? ` (${improvement.toFixed(1)} better)` : ''}.`);
    return preview;
  }

  function uniqueTestingName(base, store) {
    const names = new Set(list(store?.layouts).map(item => String(item.name || '').toLowerCase()));
    const root = String(base || 'Testing').trim().slice(0, 80) || 'Testing';
    if (!names.has(root.toLowerCase())) return root;
    for (let index = 2; index < 100; index += 1) {
      const name = `${root} ${index}`.slice(0, 80);
      if (!names.has(name.toLowerCase())) return name;
    }
    return `${root} ${Date.now().toString(36)}`.slice(0, 80);
  }

  function applyPreview() {
    if (!preview) {
      announce('Generate a Testing Mode preview before applying it.');
      return null;
    }
    const layouts = window.ActivityLayoutsV701;
    const layout = activeLayout();
    if (!layout || !layouts) return null;
    const activityStore = layouts.ensureStore?.({ reconcileActive:true });
    const sourceId = String(activityStore?.activeId || '');
    layouts.saveActive?.({ persist:false });
    const testingName = uniqueTestingName(preview.config.name || 'Testing', activityStore);
    const testingEntry = layouts.duplicate?.(sourceId, { name:testingName });
    if (!testingEntry) return null;
    const targetLayout = activeLayout();
    if (!targetLayout) return null;
    const proposalMap = new Map(preview.proposedSeats.map(seat => [String(seat.id), seat]));
    list(targetLayout.objects).forEach(object => {
      if (object?.type !== 'seat') return;
      const proposal = proposalMap.get(String(object.id));
      if (!proposal) return;
      object.x = number(proposal.x, object.x);
      object.y = number(proposal.y, object.y);
      object.rotation = number(proposal.rotation, object.rotation);
    });
    testingEntry.preset = 'testing';
    testingEntry.description = `Testing Mode generated layout. Requested minimum spacing: ${preview.config.spacing} ${preview.report.unit}.`;
    try { resetFreeformGeometryCache?.(); } catch (_) { /* optional */ }
    try { persistFreeformGeometrySession?.('testing-mode-apply'); } catch (_) { /* optional */ }
    try { renderAll?.(); } catch (_) { /* no-op */ }
    layouts.saveActive?.({ persist:true });
    const store = ensureStore();
    if (store) {
      store.lastConfig = clone(preview.config);
      store.lastReport = normalizeReport(preview.report);
      store.sourceActivityLayoutId = sourceId;
      store.activeTestingLayoutId = String(testingEntry.id || '');
      store.generatedAt = preview.generatedAt;
      targetLayout.testingMode = store;
    }
    schedulePersist('testing-mode-apply');
    clearPreviewOverlays();
    announce(`${testingEntry.name} applied as a separate Activity Layout. The source arrangement remains available for the return transition.`);
    refreshUi();
    return testingEntry;
  }

  function returnToSource() {
    const store = ensureStore();
    const id = String(store?.sourceActivityLayoutId || '');
    if (!id) {
      announce('No source Activity Layout is recorded for the last generated testing layout.');
      return false;
    }
    const switched = Boolean(window.ActivityLayoutsV701?.activate?.(id));
    if (switched) announce('Returned to the Activity Layout used before Testing Mode.');
    return switched;
  }

  function formatValue(value, unit) {
    const numeric = Math.max(0, number(value));
    return `${numeric.toFixed(numeric < 10 ? 1 : 0)} ${unit}`;
  }

  function reportMarkup(result = preview) {
    if (!result) return '<div class="hint">Generate a preview to see spacing, accessibility checks, and the transition plan before changing the room.</div>';
    const report = result.report;
    const status = report.impossibleReasons.length ? 'Review needed' : 'Ready to apply';
    return `<div class="v703-report-head"><span class="pill ${report.impossibleReasons.length ? 'special' : ''}">${esc(status)}</span><span>${esc(result.generatedAt ? new Date(result.generatedAt).toLocaleString() : '')}</span></div>
      <div class="v703-metrics"><article><span>Before</span><strong>${esc(formatValue(report.beforeSpacing, report.unit))}</strong><small>minimum active-student spacing</small></article><article><span>Preview</span><strong>${esc(formatValue(report.achievedSpacing, report.unit))}</strong><small>best generated minimum</small></article><article><span>Requested</span><strong>${esc(formatValue(report.requestedSpacing, report.unit))}</strong><small>${report.spacingConflicts ? `${report.spacingConflicts} pair${report.spacingConflicts === 1 ? '' : 's'} still under target` : 'target met for every active pair'}</small></article><article><span>Moves</span><strong>${report.movedCount}</strong><small>${report.lockedCount} locked seat${report.lockedCount === 1 ? '' : 's'} preserved</small></article></div>
      ${report.impossibleReasons.length ? `<div class="v703-findings warning"><strong>Why the requested layout is not fully possible yet</strong><ul>${report.impossibleReasons.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : '<div class="successbox">The generated layout meets the requested spacing and the required accessibility/front/aisle checks evaluated by Testing Mode.</div>'}
      ${report.needIssues.length ? `<div class="v703-findings"><strong>Needs to review</strong><ul>${report.needIssues.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}`;
  }

  function transitionMarkup(result = preview) {
    if (!result) return '<div class="hint">The move list appears after a preview is generated.</div>';
    if (!result.transitionSteps.length) return '<div class="successbox">No physical seat moves are required for this preview.</div>';
    return `<ol class="v703-transition-list">${result.transitionSteps.map(step => `<li><span>${esc(step.instruction)}</span><small>${esc(formatValue(step.distance, result.report.unit))} total movement</small></li>`).join('')}</ol>`;
  }

  function configMarkup(store) {
    const config = preview?.config || store?.lastConfig || normalizeConfig();
    const room = metrics();
    return `<div class="v703-config-grid"><label>Testing layout name<input id="testingModeV703Name" maxlength="80" value="${esc(config.name || 'Testing')}" /></label><label>Minimum student spacing<input id="testingModeV703Spacing" type="number" min="${room.scaled ? (room.unit === 'm' ? '0.5' : '2') : '0.8'}" max="${room.scaled ? (room.unit === 'm' ? '6' : '20') : '5'}" step="${room.scaled ? (room.unit === 'm' ? '0.1' : '0.5') : '0.1'}" value="${esc(config.spacing)}" /><span>${esc(room.unit)}</span></label><label class="checkline"><input id="testingModeV703PreserveLocked" type="checkbox"${config.preserveLocked ? ' checked' : ''} /> Preserve locked seat positions</label><label class="checkline"><input id="testingModeV703RespectNeeds" type="checkbox"${config.respectNeeds ? ' checked' : ''} /> Respect accessibility/front/aisle needs</label><label class="checkline"><input id="testingModeV703ExtraEdges" type="checkbox"${config.keepExtraSeatsNearEdges ? ' checked' : ''} /> Keep unused/absent seats near room edges</label></div>`;
  }

  function modalMarkup() {
    return `<div id="${MODAL_ID}" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="testingModeV703Title"><div class="modal v703-modal"><div class="panel-header"><div><span class="v703-kicker">V7.0.3 Classroom Digital Twin</span><h2 id="testingModeV703Title">Testing Mode</h2></div><button id="testingModeV703CloseBtn" class="tiny secondary" type="button">Close</button></div><div class="modal-body v703-modal-body">
      <div class="v703-intro"><strong>Build a testing arrangement without reseating the class.</strong><span>Testing Mode moves the existing seat objects, preserves matching student assignments, honors locked positions, checks accessibility/front/aisle needs, and explains when the requested spacing cannot physically fit.</span></div>
      <section class="section v703-section"><div class="v703-section-head"><div><h3>Generate testing layout</h3><p>The preview is non-destructive. Apply creates a separate Activity Layout so the normal room stays intact.</p></div></div><div id="testingModeV703Config"></div><div class="button-row"><button id="testingModeV703GenerateBtn" type="button">Generate preview</button><button id="testingModeV703ClearBtn" class="secondary" type="button">Clear preview</button></div></section>
      <section class="section v703-section"><div class="v703-section-head"><div><h3>Feasibility</h3><p>Spacing is center-to-center. Physical units are used when the Digital Twin has real room dimensions; otherwise the planner uses approximate seat widths.</p></div></div><div id="testingModeV703Report"></div></section>
      <section class="section v703-section"><div class="v703-section-head"><div><h3>Transition plan</h3><p>Move the room deliberately rather than scattering desks and hoping geometry develops a conscience.</p></div></div><div id="testingModeV703Transition"></div></section>
      <section class="section v703-section"><div class="v703-apply-row"><div><strong>Apply only after reviewing the preview.</strong><span>Student assignments are not changed. The testing arrangement becomes its own Activity Layout.</span></div><button id="testingModeV703ApplyBtn" type="button"${preview ? '' : ' disabled'}>Apply as Activity Layout</button><button id="testingModeV703ReturnBtn" class="secondary" type="button">Return to source layout</button></div></section>
      <div id="testingModeV703Status" class="hint" role="status" aria-live="polite"></div>
    </div></div></div>`;
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    const host = document.createElement('div');
    host.innerHTML = modalMarkup();
    modal = host.firstElementChild;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target?.id === 'testingModeV703CloseBtn') { closeModal(); return; }
      if (event.target?.id === 'testingModeV703GenerateBtn') {
        const config = {
          name:modal.querySelector('#testingModeV703Name')?.value,
          spacing:modal.querySelector('#testingModeV703Spacing')?.value,
          preserveLocked:modal.querySelector('#testingModeV703PreserveLocked')?.checked,
          respectNeeds:modal.querySelector('#testingModeV703RespectNeeds')?.checked,
          keepExtraSeatsNearEdges:modal.querySelector('#testingModeV703ExtraEdges')?.checked
        };
        generatePreview(config);
        return;
      }
      if (event.target?.id === 'testingModeV703ClearBtn') {
        preview = null;
        clearPreviewOverlays();
        renderModal();
        announce('Testing preview cleared without changing the room.');
        return;
      }
      if (event.target?.id === 'testingModeV703ApplyBtn') { applyPreview(); renderModal(); return; }
      if (event.target?.id === 'testingModeV703ReturnBtn') { returnToSource(); renderModal(); }
    });
    return modal;
  }

  function openById(id) {
    const node = document.getElementById(id);
    if (!node) return;
    if (typeof openModalById === 'function') openModalById(id);
    else node.classList.add('show');
  }

  function closeById(id) {
    const node = document.getElementById(id);
    if (!node) return;
    if (typeof closeModalById === 'function') closeModalById(id);
    else node.classList.remove('show');
  }

  function openModal() {
    if (state?.layoutMode !== 'freeform') {
      announce('Testing Mode is available for Freeform rooms.');
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
    const configNode = modal.querySelector('#testingModeV703Config');
    const reportNode = modal.querySelector('#testingModeV703Report');
    const transitionNode = modal.querySelector('#testingModeV703Transition');
    if (configNode) configNode.innerHTML = configMarkup(store);
    if (reportNode) reportNode.innerHTML = reportMarkup(preview);
    if (transitionNode) transitionNode.innerHTML = transitionMarkup(preview);
    const apply = modal.querySelector('#testingModeV703ApplyBtn');
    if (apply) apply.disabled = !preview;
    const returnButton = modal.querySelector('#testingModeV703ReturnBtn');
    if (returnButton) returnButton.disabled = !store?.sourceActivityLayoutId;
  }

  function toolbarMarkup() {
    const store = ensureStore();
    const report = preview?.report || store?.lastReport;
    const summary = report?.generatedAt
      ? `${formatValue(report.achievedSpacing, report.unit || metrics().unit)} min`
      : 'Testing';
    return `<button id="testingModeV703OpenBtn" class="secondary" type="button">Testing Mode</button><span class="v703-toolbar-chip">${esc(summary)}</span>`;
  }

  function installToolbar() {
    let toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = TOOLBAR_ID;
      toolbar.className = 'v703-toolbar no-print';
      const rotations = document.getElementById('stationRotationsV702Toolbar');
      const activities = document.getElementById('activityLayoutsV701Toolbar');
      const digitalTwin = document.getElementById('openDigitalTwinV700Btn');
      if (rotations?.parentElement) rotations.insertAdjacentElement('afterend', toolbar);
      else if (activities?.parentElement) activities.insertAdjacentElement('afterend', toolbar);
      else if (digitalTwin?.parentElement) digitalTwin.insertAdjacentElement('afterend', toolbar);
      else document.body.appendChild(toolbar);
      toolbar.addEventListener('click', event => {
        if (event.target?.closest?.('#testingModeV703OpenBtn')) openModal();
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
    toolbar.style.display = 'inline-flex';
    toolbar.innerHTML = toolbarMarkup();
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .v703-toolbar{display:none;align-items:center;gap:6px;min-width:0}.v703-toolbar-chip{display:inline-flex;align-items:center;min-height:26px;padding:3px 7px;border:1px solid var(--border,#d8deea);border-radius:999px;background:var(--panel,#fff);color:var(--muted,#607089);font-size:9px;font-weight:900;white-space:nowrap}.v703-modal{width:min(1060px,calc(100vw - 24px));max-width:1060px;height:min(900px,calc(100vh - 24px))}.v703-modal-body{display:grid;gap:12px;overflow:auto;padding-bottom:28px}.v703-kicker{display:block;color:var(--muted,#607089);font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.v703-intro{display:grid;grid-template-columns:minmax(220px,.7fr) minmax(0,1.5fr);gap:14px;padding:12px 14px;border:1px solid var(--border,#d8deea);border-radius:12px;background:color-mix(in srgb,var(--panel,#fff) 94%,#2563eb 6%)}.v703-intro span{color:var(--muted,#607089);line-height:1.4}.v703-section{display:grid;gap:10px}.v703-section-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v703-section-head h3{margin:0 0 3px}.v703-section-head p{margin:0;color:var(--muted,#607089);font-size:11.5px}.v703-config-grid{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:9px}.v703-config-grid label{margin:0}.v703-config-grid label:nth-child(2){display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:6px}.v703-config-grid label:nth-child(2)::first-line{grid-column:1/-1}.v703-config-grid .checkline{display:flex;align-items:center;gap:7px;padding:8px;border:1px solid var(--border,#d8deea);border-radius:10px;background:var(--panel,#fff);text-transform:none;letter-spacing:0;font-size:11.5px}.v703-config-grid .checkline input{width:auto;min-height:0}.v703-report-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}.v703-report-head>span:last-child{color:var(--muted,#607089);font-size:10px}.v703-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.v703-metrics article{display:grid;gap:3px;padding:10px;border:1px solid var(--border,#d8deea);border-radius:11px;background:var(--panel,#fff)}.v703-metrics span{color:var(--muted,#607089);font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.v703-metrics strong{font-size:18px}.v703-metrics small{color:var(--muted,#607089);font-size:9.5px;line-height:1.25}.v703-findings{margin-top:8px;padding:9px 10px;border:1px solid var(--border,#d8deea);border-radius:10px;background:var(--panel,#fff);font-size:11.5px;line-height:1.4}.v703-findings ul{margin:6px 0 0 18px;padding:0}.v703-transition-list{display:grid;gap:6px;margin:0;padding:0;list-style:none;counter-reset:v703move}.v703-transition-list li{counter-increment:v703move;display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:8px;align-items:start;padding:8px 9px;border:1px solid var(--border,#d8deea);border-radius:10px;background:var(--panel,#fff)}.v703-transition-list li::before{content:counter(v703move);width:23px;height:23px;display:grid;place-items:center;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:10px;font-weight:900}.v703-transition-list span{font-size:11.5px;line-height:1.35}.v703-transition-list small{color:var(--muted,#607089);font-size:9.5px;white-space:nowrap}.v703-apply-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center}.v703-apply-row>div{display:grid;gap:3px}.v703-apply-row span{color:var(--muted,#607089);font-size:11px}.v703-testing-preview{position:absolute;z-index:75;border:2px dashed rgba(37,99,235,.72);border-radius:14px;background:rgba(37,99,235,.06);box-shadow:0 0 0 3px rgba(255,255,255,.62);pointer-events:none!important;transform-origin:center}.v703-testing-preview.moved::after{content:'Test';position:absolute;right:4px;top:4px;padding:2px 5px;border-radius:999px;background:#1d4ed8;color:#fff;font-size:8px;font-weight:900}.v703-testing-preview.conflict{border-color:#b42318;background:rgba(180,35,24,.08)}body.visibility-mode .v703-toolbar{display:none!important}body.visibility-mode .v703-testing-preview{opacity:.28}@media print{.v703-toolbar,.v703-modal,.v703-testing-preview{display:none!important}}
      @media(max-width:900px){.v703-toolbar{flex:1 1 100%;width:100%}.v703-modal{width:calc(100vw - 10px);height:calc(100vh - 10px)}.v703-intro{grid-template-columns:1fr}.v703-config-grid{grid-template-columns:1fr}.v703-metrics{grid-template-columns:1fr 1fr}.v703-apply-row{grid-template-columns:1fr}.v703-apply-row button{width:100%}.v703-transition-list li{grid-template-columns:26px minmax(0,1fr)}.v703-transition-list small{grid-column:2;white-space:normal}}
      @media(max-width:520px){.v703-metrics{grid-template-columns:1fr}.v703-section-head{display:block}.v703-toolbar-chip{display:none}}
    `;
    document.head.appendChild(style);
  }

  function refreshUi() {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      installToolbar();
      if (preview) renderPreviewOverlays();
      if (document.getElementById(MODAL_ID)?.classList.contains('show')) renderModal();
    });
  }

  function observeCanvas() {
    const canvas = document.getElementById('seatGrid');
    if (!canvas) { setTimeout(observeCanvas, 250); return; }
    if (observer && observedCanvas === canvas) return;
    observer?.disconnect();
    observedCanvas = canvas;
    observer = new MutationObserver(mutations => {
      if (mutations.every(mutation => [...mutation.addedNodes, ...mutation.removedNodes].every(node => node instanceof Element && node.classList.contains(OVERLAY_CLASS)))) return;
      refreshUi();
    });
    observer.observe(canvas, { childList:true, subtree:false });
  }

  function installEvents() {
    document.addEventListener('change', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.matches?.('#classSelect,#layoutModeSelect,[data-class-id]')) {
        preview = null;
        clearPreviewOverlays();
        setTimeout(refreshUi, 0);
      }
    }, true);
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
    open:openModal,
    close:closeModal,
    ensureStore,
    normalizeStore,
    analyze,
    generatePreview,
    applyPreview,
    returnToSource,
    minimumSpacing,
    transitionSteps,
    activePreview:() => preview,
    clearPreview:() => { preview = null; clearPreviewOverlays(); refreshUi(); },
    refresh:refreshUi
  });
})();

'use strict';
