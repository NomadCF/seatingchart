window.GroupedSeatingVisualsV681 = (() => {
  'use strict';

  const STYLE_ID = 'groupedSeatingVisualsV681Styles';
  const MODULE_VERSION = '6.8.1';
  const DEFAULT_POD_COLOR = '#6f8f82';
  let installed = false;
  let observer = null;
  let scheduledFrame = 0;

  const array = value => Array.isArray(value) ? value : [];
  const esc = value => typeof escapeHtml === 'function'
    ? escapeHtml(String(value ?? ''))
    : String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  function color(value, fallback = DEFAULT_POD_COLOR) {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    if (typeof safeColor === 'function') {
      try { return safeColor(raw, fallback); } catch (_) { /* use conservative fallback below */ }
    }
    return /^#[0-9a-f]{3,8}$/i.test(raw) ? raw : fallback;
  }

  function setAttributeIfChanged(node, name, value) {
    const next = String(value ?? '');
    if (node.getAttribute(name) !== next) node.setAttribute(name, next);
  }

  function setStyleIfChanged(node, name, value) {
    const next = String(value ?? '');
    if (node.style.getPropertyValue(name) !== next) node.style.setProperty(name, next);
  }

  function rotatedBounds(object) {
    const x = Number(object?.x) || 0;
    const y = Number(object?.y) || 0;
    const width = Math.max(1, Number(object?.width) || (object?.type === 'seat' ? 176 : 120));
    const height = Math.max(1, Number(object?.height) || (object?.type === 'seat' ? 112 : 80));
    const radians = ((Number(object?.rotation) || 0) * Math.PI) / 180;
    const cosine = Math.abs(Math.cos(radians));
    const sine = Math.abs(Math.sin(radians));
    const rotatedWidth = width * cosine + height * sine;
    const rotatedHeight = width * sine + height * cosine;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    return {
      left: centerX - rotatedWidth / 2,
      top: centerY - rotatedHeight / 2,
      right: centerX + rotatedWidth / 2,
      bottom: centerY + rotatedHeight / 2,
      width: rotatedWidth,
      height: rotatedHeight,
      centerX,
      centerY
    };
  }

  function paddedUnionBounds(objects, padding = 28) {
    const bounds = array(objects).map(rotatedBounds);
    if (!bounds.length) return null;
    const left = Math.min(...bounds.map(item => item.left)) - padding;
    const top = Math.min(...bounds.map(item => item.top)) - padding;
    const right = Math.max(...bounds.map(item => item.right)) + padding;
    const bottom = Math.max(...bounds.map(item => item.bottom)) + padding;
    return { left, top, right, bottom, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
  }

  function distancePointToBounds(x, y, bounds) {
    const dx = Math.max(bounds.left - x, 0, x - bounds.right);
    const dy = Math.max(bounds.top - y, 0, y - bounds.bottom);
    return Math.hypot(dx, dy);
  }

  function tableLooksRound(table) {
    const width = Math.max(1, Number(table?.width) || 1);
    const height = Math.max(1, Number(table?.height) || 1);
    const ratio = Math.max(width, height) / Math.min(width, height);
    return ratio <= 1.22 || /\b(round|circle|circular)\b/i.test(String(table?.label || ''));
  }

  function associationsForLayout(layout) {
    const objects = array(layout?.objects);
    const groups = array(layout?.groups);
    const objectsByGroup = new Map();
    const coveredObjectIds = new Set();
    const associations = [];

    objects.forEach(object => {
      const id = String(object?.groupId || '');
      if (!id) return;
      if (!objectsByGroup.has(id)) objectsByGroup.set(id, []);
      objectsByGroup.get(id).push(object);
    });

    const groupMeta = new Map(groups.map((group, index) => [String(group?.id || ''), {
      name: String(group?.name || `Pod ${index + 1}`).trim() || `Pod ${index + 1}`,
      color: color(group?.color, DEFAULT_POD_COLOR)
    }]));

    objectsByGroup.forEach((members, groupId) => {
      const seats = members.filter(item => item?.type === 'seat');
      if (!seats.length || members.length < 2) return;
      const meta = groupMeta.get(groupId) || { name: 'Grouped seating', color: DEFAULT_POD_COLOR };
      const tables = members.filter(item => item?.type === 'table');
      associations.push({
        id: `group:${groupId}`,
        source: 'explicit',
        groupId,
        name: meta.name,
        color: meta.color,
        members,
        seats,
        tables,
        round: tables.some(tableLooksRound),
        bounds: paddedUnionBounds(members, 28)
      });
      members.forEach(item => coveredObjectIds.add(String(item.id)));
    });

    const availableTables = objects.filter(object => object?.type === 'table' && !coveredObjectIds.has(String(object.id)));
    const availableSeats = objects.filter(object => object?.type === 'seat' && !coveredObjectIds.has(String(object.id)));
    const inferredByTable = new Map(availableTables.map(table => [String(table.id), []]));

    availableSeats.forEach(seat => {
      const seatBounds = rotatedBounds(seat);
      let winner = null;
      availableTables.forEach(table => {
        const tableBounds = rotatedBounds(table);
        const distance = distancePointToBounds(seatBounds.centerX, seatBounds.centerY, tableBounds);
        const reach = Math.max(64, Math.min(150, Math.max(tableBounds.width, tableBounds.height) * 0.34 + 44));
        if (distance > reach) return;
        if (!winner || distance < winner.distance) winner = { table, distance };
      });
      if (winner) inferredByTable.get(String(winner.table.id))?.push(seat);
    });

    availableTables.forEach((table, index) => {
      const seats = inferredByTable.get(String(table.id)) || [];
      if (!seats.length) return;
      const members = [table, ...seats];
      associations.push({
        id: `table:${table.id}`,
        source: 'inferred-table',
        groupId: '',
        name: String(table.label || '').trim() || `Table ${index + 1}`,
        color: color(table.color || table.fillColor, DEFAULT_POD_COLOR),
        members,
        seats,
        tables: [table],
        round: tableLooksRound(table),
        bounds: paddedUnionBounds(members, 24)
      });
    });

    return associations.filter(item => item.bounds);
  }

  function findingSets() {
    const bad = new Set();
    const warn = new Set();
    if (typeof evaluateCurrentRuleViolations !== 'function') return { bad, warn };
    try {
      array(evaluateCurrentRuleViolations({ includeUnseated: false })).forEach(item => {
        const target = item?.severity === 'bad' ? bad : warn;
        array(item?.studentIds).forEach(id => target.add(String(id)));
      });
    } catch (_) { /* visual decoration must never block the seating workspace */ }
    return { bad, warn };
  }

  function seatStatus(object, node, findings = findingSets()) {
    const studentId = String(object?.assignedStudentId || '');
    const absent = Boolean(state?.todaySession?.active) && array(state?.todaySession?.absentStudentIds).map(String).includes(studentId);
    if (node?.classList?.contains('seat-validity-invalid') || node?.classList?.contains('seat-validity-blocked')) return { kind: 'invalid', label: 'Conflict' };
    if (node?.classList?.contains('seat-validity-caution')) return { kind: 'caution', label: 'Check' };
    if (node?.classList?.contains('seat-validity-valid')) return { kind: 'valid', label: 'Valid' };
    if (studentId && findings.bad.has(studentId)) return { kind: 'invalid', label: 'Conflict' };
    if (absent) return { kind: 'absent', label: 'Absent' };
    if (object?.locked || object?.manual) return { kind: 'locked', label: 'Locked' };
    if (!studentId) return { kind: 'open', label: 'Open' };
    if (studentId && findings.warn.has(studentId)) return { kind: 'caution', label: 'Check' };
    return { kind: 'occupied', label: '' };
  }

  function associationForObject(associations, objectId) {
    const id = String(objectId || '');
    return associations.find(item => item.members.some(member => String(member?.id) === id)) || null;
  }

  function haloSignature(associations) {
    return associations.map(item => [
      item.id,
      item.name,
      item.color,
      item.round ? 1 : 0,
      Math.round(item.bounds.left),
      Math.round(item.bounds.top),
      Math.round(item.bounds.width),
      Math.round(item.bounds.height),
      item.members.map(member => `${member.id}:${Math.round(Number(member.x) || 0)}:${Math.round(Number(member.y) || 0)}:${Math.round(Number(member.width) || 0)}:${Math.round(Number(member.height) || 0)}:${Math.round(Number(member.rotation) || 0)}`).join('|')
    ].join('~')).join('||');
  }

  function rebuildHalos(canvas, associations) {
    const signature = haloSignature(associations);
    const current = canvas.querySelectorAll(':scope > .v681-pod-halo');
    if (canvas.dataset.v681HaloSignature === signature && current.length === associations.length) return;
    current.forEach(node => node.remove());
    const firstObject = canvas.querySelector(':scope > .freeform-object');
    associations.forEach((association, index) => {
      const halo = document.createElement('div');
      halo.className = `v681-pod-halo ${association.source === 'explicit' ? 'explicit' : 'inferred'}${association.round ? ' round' : ''}`;
      halo.dataset.v681PodId = association.id;
      halo.dataset.v681MemberCount = String(association.members.length);
      halo.style.left = `${association.bounds.left}px`;
      halo.style.top = `${association.bounds.top}px`;
      halo.style.width = `${association.bounds.width}px`;
      halo.style.height = `${association.bounds.height}px`;
      halo.style.setProperty('--v681-pod-color', association.color);
      halo.style.zIndex = '0';
      halo.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'v681-pod-label';
      label.textContent = association.name || `Pod ${index + 1}`;
      halo.appendChild(label);
      canvas.insertBefore(halo, firstObject || null);
    });
    canvas.dataset.v681HaloSignature = signature;
  }

  function enhanceCanvas() {
    const canvas = document.querySelector('#seatGrid.freeform-canvas');
    if (!canvas || state?.layoutMode !== 'freeform') return false;
    const layout = state?.freeformLayout || {};
    const objects = array(layout.objects);
    const objectMap = new Map(objects.map(object => [String(object?.id || ''), object]));
    const associations = associationsForLayout(layout);
    const findings = findingSets();
    const zoom = Number(layout?.canvas?.zoom) || 1;
    setAttributeIfChanged(canvas, 'data-v681-zoom-band', zoom < 0.68 ? 'low' : zoom > 1.35 ? 'high' : 'normal');
    setAttributeIfChanged(canvas, 'data-v681-grouped-visuals', MODULE_VERSION);

    canvas.querySelectorAll('.freeform-object[data-object-id]').forEach(node => {
      const object = objectMap.get(String(node.dataset.objectId || ''));
      if (!object) return;
      if (object.type === 'seat') {
        node.classList.add('v681-seat-tile');
        const status = seatStatus(object, node, findings);
        setAttributeIfChanged(node, 'data-v681-status-kind', status.kind);
        setAttributeIfChanged(node, 'data-v681-status-label', status.label);
        setAttributeIfChanged(node, 'data-v681-occupied', object.assignedStudentId ? 'true' : 'false');
        const association = associationForObject(associations, object.id);
        if (association) {
          setAttributeIfChanged(node, 'data-v681-pod-id', association.id);
          setStyleIfChanged(node, '--v681-seat-accent', association.color);
        } else {
          node.removeAttribute('data-v681-pod-id');
          const dot = node.querySelector('.freeform-group-dot');
          const dotColor = dot ? getComputedStyle(dot).backgroundColor : '';
          setStyleIfChanged(node, '--v681-seat-accent', dotColor || 'var(--seat-border, #9db7ef)');
        }
      } else if (object.type === 'table') {
        node.classList.add('v681-table-surface');
        node.classList.toggle('v681-table-round', tableLooksRound(object));
        const association = associationForObject(associations, object.id);
        if (association) {
          setAttributeIfChanged(node, 'data-v681-pod-id', association.id);
          setStyleIfChanged(node, '--v681-table-accent', association.color);
        }
      }
    });

    rebuildHalos(canvas, associations);
    return true;
  }

  function scheduleEnhance() {
    if (scheduledFrame) return;
    scheduledFrame = requestAnimationFrame(() => {
      scheduledFrame = 0;
      enhanceCanvas();
    });
  }

  function observeCanvas() {
    const canvas = document.getElementById('seatGrid');
    if (!canvas) {
      window.setTimeout(observeCanvas, 250);
      return;
    }
    observer?.disconnect();
    observer = new MutationObserver(() => scheduleEnhance());
    observer.observe(canvas, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    scheduleEnhance();
  }

  function studentName(id) {
    if (!id) return '';
    try {
      const student = typeof getStudent === 'function' ? getStudent(id) : null;
      return student && typeof studentDisplay === 'function' ? studentDisplay(student) : String(id);
    } catch (_) {
      return String(id);
    }
  }

  function assignmentMap(plan) {
    const map = new Map();
    Object.entries(plan?.cells || {}).forEach(([key, cell]) => {
      if (cell?.assignedStudentId) map.set(String(cell.assignedStudentId), `Grid ${key}`);
    });
    array(plan?.freeformLayout?.objects).forEach(object => {
      if (object?.type === 'seat' && object.assignedStudentId) map.set(String(object.assignedStudentId), `Freeform ${object.id}`);
    });
    return map;
  }

  function currentPlanRecord() {
    return {
      id: 'current-live-chart',
      name: 'Current live chart',
      layoutMode: state?.layoutMode,
      rows: state?.rows,
      cols: state?.cols,
      cells: state?.cells,
      freeformLayout: state?.freeformLayout
    };
  }

  function planById(id) {
    const key = String(id || '');
    if (key === 'current-live-chart') return currentPlanRecord();
    return array(state?.seatingPlans).find(plan => String(plan?.id || '') === key) || null;
  }

  function changedStudents(a, b) {
    const mapA = assignmentMap(a);
    const mapB = assignmentMap(b);
    const ids = new Set([...mapA.keys(), ...mapB.keys()]);
    return [...ids].filter(id => (mapA.get(id) || '') !== (mapB.get(id) || ''));
  }

  function percent(value, total) {
    return `${Math.max(-5, Math.min(105, (Number(value || 0) / Math.max(1, Number(total) || 1)) * 100)).toFixed(3)}%`;
  }

  function planPreviewMarkup(plan, changedIds, label) {
    if (plan?.layoutMode !== 'freeform') return '';
    const layout = plan.freeformLayout || {};
    const canvas = layout.canvas || {};
    const width = Math.max(1, Number(canvas.width) || 1200);
    const height = Math.max(1, Number(canvas.height) || 800);
    const changed = new Set(array(changedIds).map(String));
    const associations = associationsForLayout(layout);
    const haloMarkup = associations.map(item => `<div class="v681-mini-pod${item.round ? ' round' : ''}" style="left:${percent(item.bounds.left, width)};top:${percent(item.bounds.top, height)};width:${percent(item.bounds.width, width)};height:${percent(item.bounds.height, height)};--v681-pod-color:${esc(item.color)}"><span>${esc(item.name)}</span></div>`).join('');
    const objectsMarkup = array(layout.objects).filter(object => ['table', 'seat', 'teacher', 'board', 'projector', 'door', 'window', 'wall'].includes(object?.type)).map(object => {
      const isSeat = object.type === 'seat';
      const name = isSeat ? (studentName(object.assignedStudentId) || 'Open') : (String(object.label || '').trim() || String(object.type));
      const association = associationForObject(associations, object.id);
      const classes = [
        'v681-mini-object',
        object.type,
        isSeat && object.assignedStudentId ? 'occupied' : '',
        isSeat && !object.assignedStudentId ? 'open' : '',
        isSeat && changed.has(String(object.assignedStudentId || '')) ? 'changed' : '',
        object.type === 'table' && tableLooksRound(object) ? 'round' : ''
      ].filter(Boolean).join(' ');
      return `<div class="${classes}" title="${esc(name)}" style="left:${percent(object.x, width)};top:${percent(object.y, height)};width:${percent(object.width || (isSeat ? 176 : 120), width)};height:${percent(object.height || (isSeat ? 112 : 80), height)};transform:rotate(${Number(object.rotation) || 0}deg);--v681-seat-accent:${esc(association?.color || '#9db7ef')}"><span>${esc(name)}</span>${isSeat && (object.locked || object.manual) ? '<small>Locked</small>' : ''}</div>`;
    }).join('');
    return `<figure class="v681-plan-preview"><figcaption>${esc(label)} · ${esc(plan.name || 'Plan')}</figcaption><div class="v681-plan-preview-canvas" style="aspect-ratio:${width}/${height}">${haloMarkup}${objectsMarkup}</div></figure>`;
  }

  function renderPlanComparison(a, b, out) {
    if (!a || !b || a.layoutMode !== 'freeform' || b.layoutMode !== 'freeform' || !out) return false;
    const changed = changedStudents(a, b);
    const mapA = assignmentMap(a);
    const mapB = assignmentMap(b);
    out.innerHTML = `<div class="planning-comparison-summary"><strong>${changed.length} student placement${changed.length === 1 ? '' : 's'} changed</strong><span>${esc(a.name || 'Plan A')} compared with ${esc(b.name || 'Plan B')}. Tables, pods, and changed seats retain the same visual relationships as the live Freeform room.</span></div><div class="planning-preview-pair v681-planning-preview-pair">${planPreviewMarkup(a, changed, 'Plan A')}${planPreviewMarkup(b, changed, 'Plan B')}</div>${changed.map(id => `<div class="planning-comparison-row"><strong>${esc(studentName(id) || id)}</strong><span>${esc(mapA.get(id) || 'Unassigned')} → ${esc(mapB.get(id) || 'Unassigned')}</span></div>`).join('') || '<div class="successbox">The assignments are identical.</div>'}`;
    return true;
  }

  function roundRect(context, x, y, width, height, radius) {
    context.beginPath();
    if (typeof context.roundRect === 'function') context.roundRect(x, y, width, height, radius);
    else context.rect(x, y, width, height);
  }

  function drawObject(context, object, ratio, padding, associations, findings) {
    const x = padding + (Number(object.x) || 0) * ratio;
    const y = padding + (Number(object.y) || 0) * ratio;
    const width = Math.max(10, (Number(object.width) || (object.type === 'seat' ? 176 : 120)) * ratio);
    const height = Math.max(10, (Number(object.height) || (object.type === 'seat' ? 112 : 80)) * ratio);
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const rotation = ((Number(object.rotation) || 0) * Math.PI) / 180;
    context.save();
    context.translate(centerX, centerY);
    context.rotate(rotation);
    const localX = -width / 2;
    const localY = -height / 2;
    const association = associationForObject(associations, object.id);

    if (object.type === 'table') {
      context.fillStyle = '#edf1f2';
      context.strokeStyle = association?.color || '#7b8a8f';
      context.lineWidth = 2;
      roundRect(context, localX, localY, width, height, tableLooksRound(object) ? Math.min(width, height) / 2 : Math.min(18, height / 3));
      context.fill();
      context.stroke();
      const title = String(object.label || '').trim();
      if (title) {
        context.fillStyle = '#334155';
        context.font = `${Math.max(8, 11 * ratio)}px system-ui, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(title, 0, 0, Math.max(12, width - 12));
      }
    } else if (object.type === 'seat') {
      const status = seatStatus(object, null, findings);
      context.fillStyle = object.assignedStudentId ? '#f7faff' : '#fbfcfd';
      context.strokeStyle = status.kind === 'invalid' ? '#b91c1c' : status.kind === 'caution' ? '#b45309' : association?.color || '#94a3b8';
      context.lineWidth = object.locked || object.manual ? 2.4 : 1.4;
      context.setLineDash(object.assignedStudentId ? [] : [5, 4]);
      roundRect(context, localX, localY, width, height, Math.min(13, height / 3));
      context.fill();
      context.stroke();
      context.setLineDash([]);
      const name = studentName(object.assignedStudentId) || (String(object.label || '').trim() || 'Open');
      context.fillStyle = '#172033';
      context.font = `700 ${Math.max(8.5, 13 * ratio)}px system-ui, sans-serif`;
      context.textAlign = 'left';
      context.textBaseline = 'top';
      context.fillText(name.length > 30 ? `${name.slice(0, 29)}…` : name, localX + 8, localY + 9, Math.max(16, width - 16));
      if (status.label) {
        context.fillStyle = '#64748b';
        context.font = `700 ${Math.max(7.5, 9 * ratio)}px system-ui, sans-serif`;
        context.textBaseline = 'bottom';
        context.fillText(status.label, localX + 8, localY + height - 7, Math.max(16, width - 16));
      }
    } else {
      context.fillStyle = object.type === 'teacher' ? '#fff7df' : '#f5f7fa';
      context.strokeStyle = '#a7b0bd';
      context.lineWidth = 1;
      roundRect(context, localX, localY, width, height, object.type === 'wall' ? 3 : 8);
      context.fill();
      context.stroke();
    }
    context.restore();
  }

  function chartCanvas() {
    if (state?.layoutMode !== 'freeform') return window.ExportSupportV66?.chartCanvas?.() || null;
    const layout = state.freeformLayout || {};
    const room = layout.canvas || {};
    const scale = 2;
    const padding = 34;
    const logicalWidth = Math.max(500, Number(room.width) || 1200);
    const logicalHeight = Math.max(350, Number(room.height) || 800);
    const ratio = Math.min(1, 1240 / logicalWidth, 860 / logicalHeight);
    const width = Math.round(logicalWidth * ratio) + padding * 2;
    const height = Math.round(logicalHeight * ratio) + padding * 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d');
    context.scale(scale, scale);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#172033';
    context.font = '700 20px system-ui, sans-serif';
    context.textBaseline = 'alphabetic';
    context.fillText(`${typeof activeClassName === 'function' ? activeClassName() : 'Class'} seating chart`, padding, 24);

    const associations = associationsForLayout(layout);
    associations.forEach(item => {
      const x = padding + item.bounds.left * ratio;
      const y = padding + item.bounds.top * ratio;
      const w = item.bounds.width * ratio;
      const h = item.bounds.height * ratio;
      context.save();
      context.globalAlpha = 0.10;
      context.fillStyle = item.color;
      roundRect(context, x, y, w, h, item.round ? Math.min(w, h) / 2 : 20);
      context.fill();
      context.globalAlpha = 0.48;
      context.strokeStyle = item.color;
      context.lineWidth = 2;
      context.stroke();
      context.globalAlpha = 1;
      context.fillStyle = '#475569';
      context.font = '700 10px system-ui, sans-serif';
      context.fillText(item.name, x + 9, Math.max(38, y + 13), Math.max(30, w - 18));
      context.restore();
    });

    const findings = findingSets();
    const zSorted = [...array(layout.objects)].sort((a, b) => (Number(a?.zIndex) || 0) - (Number(b?.zIndex) || 0));
    zSorted.filter(object => ['table', 'teacher', 'board', 'projector', 'door', 'window', 'wall'].includes(object?.type)).forEach(object => drawObject(context, object, ratio, padding, associations, findings));
    zSorted.filter(object => object?.type === 'seat').forEach(object => drawObject(context, object, ratio, padding, associations, findings));
    return canvas;
  }

  async function copyChartAsImage() {
    const canvas = chartCanvas();
    if (!canvas) throw new Error('The chart image could not be rendered.');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The browser could not create the chart image.');
    if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      if (typeof setLiveStatusMessage === 'function') setLiveStatusMessage('Grouped seating chart image copied to the clipboard.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seating-chart-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (typeof setLiveStatusMessage === 'function') setLiveStatusMessage('Grouped seating chart image downloaded because clipboard image copying is unavailable.');
  }

  function installInteractionBridges() {
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('#copyChartImageBtn') && state?.layoutMode === 'freeform') {
        event.preventDefault();
        event.stopImmediatePropagation();
        void copyChartAsImage().catch(error => {
          if (typeof setLiveStatusMessage === 'function') setLiveStatusMessage(`Chart image could not be copied: ${error.message}`);
        });
        return;
      }
      if (target?.closest('#planningComparePlansBtn')) {
        const a = planById(document.getElementById('planningCompareA')?.value);
        const b = planById(document.getElementById('planningCompareB')?.value);
        const out = document.getElementById('planningVisualComparison');
        if (a?.layoutMode === 'freeform' && b?.layoutMode === 'freeform' && out) {
          event.preventDefault();
          event.stopImmediatePropagation();
          renderPlanComparison(a, b, out);
        }
      }
    }, true);
    window.addEventListener('beforeprint', enhanceCanvas);
    window.addEventListener('resize', scheduleEnhance, { passive: true });
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .seat-grid.freeform-canvas[data-v681-grouped-visuals] { isolation:isolate; }
      .v681-pod-halo { position:absolute; pointer-events:none; border:2px solid color-mix(in srgb, var(--v681-pod-color, #6f8f82) 52%, transparent); background:color-mix(in srgb, var(--v681-pod-color, #6f8f82) 9%, transparent); border-radius:28px; box-shadow:inset 0 0 0 1px color-mix(in srgb, #ffffff 66%, transparent), 0 6px 16px rgba(15,23,42,.035); }
      .v681-pod-halo.round { border-radius:999px; }
      .v681-pod-halo.inferred { border-style:solid; }
      .v681-pod-label { position:absolute; top:8px; left:12px; max-width:calc(100% - 24px); padding:2px 7px; border:1px solid color-mix(in srgb, var(--v681-pod-color, #6f8f82) 38%, var(--border, #d8deea)); border-radius:999px; background:color-mix(in srgb, var(--panel, #ffffff) 88%, var(--v681-pod-color, #6f8f82)); color:var(--text, #172033); font-size:9px; font-weight:800; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; box-shadow:0 1px 3px rgba(15,23,42,.05); }
      .freeform-object.table.v681-table-surface { border:2px solid color-mix(in srgb, var(--v681-table-accent, #6f8f82) 56%, #64748b); border-radius:22px; background:linear-gradient(180deg, color-mix(in srgb, var(--panel, #ffffff) 90%, var(--v681-table-accent, #6f8f82)), color-mix(in srgb, var(--panel-2, #f0f3f8) 86%, var(--v681-table-accent, #6f8f82))); box-shadow:inset 0 1px 0 color-mix(in srgb, #ffffff 70%, transparent), 0 7px 16px rgba(15,23,42,.07); }
      .freeform-object.table.v681-table-surface.v681-table-round { border-radius:999px; }
      .freeform-object.seat.v681-seat-tile { --v681-seat-accent:var(--seat-border, #9db7ef); align-content:start; border-width:1px; border-style:solid; border-color:color-mix(in srgb, var(--v681-seat-accent) 48%, var(--border, #d8deea)); border-radius:13px; padding:12px 10px 9px; background:linear-gradient(180deg, color-mix(in srgb, var(--panel, #ffffff) 96%, var(--v681-seat-accent) 4%), color-mix(in srgb, var(--panel-2, #f8fafc) 93%, var(--v681-seat-accent) 7%)); box-shadow:0 4px 10px rgba(15,23,42,.07), inset 0 1px 0 rgba(255,255,255,.72); }
      .freeform-object.seat.v681-seat-tile.assigned { border-color:color-mix(in srgb, var(--v681-seat-accent) 58%, #9aa8bd); background:linear-gradient(180deg, color-mix(in srgb, var(--panel, #ffffff) 92%, var(--v681-seat-accent) 8%), color-mix(in srgb, var(--panel-2, #f8fafc) 86%, var(--v681-seat-accent) 14%)); }
      .freeform-object.seat.v681-seat-tile.unassigned { border-style:dashed; border-color:color-mix(in srgb, var(--v681-seat-accent) 30%, #9aa8bd); background:color-mix(in srgb, var(--panel, #ffffff) 96%, #94a3b8 4%); box-shadow:0 2px 7px rgba(15,23,42,.045); }
      .freeform-object.seat.v681-seat-tile.has-groups { border-width:1px; }
      .freeform-object.seat.v681-seat-tile .freeform-object-title { position:relative; z-index:1; padding-inline:3px; font-size:calc(12px * var(--seat-text-scale, 1)); font-weight:900; line-height:1.16; color:var(--text, #172033); }
      .freeform-object.seat.v681-seat-tile .freeform-object-title.placeholder { color:var(--muted, #607089); font-weight:750; }
      .freeform-object.seat.v681-seat-tile .freeform-object-meta { gap:3px; opacity:.82; }
      .freeform-object.seat.v681-seat-tile .freeform-object-meta .pill { padding:2px 5px; border-radius:999px; font-size:calc(8.5px * var(--seat-text-scale, 1)); }
      .freeform-object.seat.v681-seat-tile .freeform-group-summary { gap:3px; max-height:18px; overflow:hidden; }
      .freeform-object.seat.v681-seat-tile .freeform-group-chip { padding:1px 5px; background:color-mix(in srgb, var(--panel, #ffffff) 86%, transparent); font-size:calc(8px * var(--seat-text-scale, 1)); }
      .freeform-object.seat.v681-seat-tile::after { content:attr(data-v681-status-label); position:absolute; top:6px; right:6px; z-index:3; max-width:64px; padding:2px 5px; border:1px solid var(--border, #d8deea); border-radius:999px; background:color-mix(in srgb, var(--panel, #ffffff) 92%, #94a3b8 8%); color:var(--muted, #607089); font-size:8px; font-weight:850; line-height:1.15; letter-spacing:.01em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; pointer-events:none; }
      .freeform-object.seat.v681-seat-tile[data-v681-status-label=""]::after { display:none; }
      .freeform-object.seat.v681-seat-tile[data-v681-status-kind="valid"]::after { color:#166534; border-color:#86efac; background:#f0fdf4; }
      .freeform-object.seat.v681-seat-tile[data-v681-status-kind="caution"]::after { color:#92400e; border-color:#fcd34d; background:#fffbeb; }
      .freeform-object.seat.v681-seat-tile[data-v681-status-kind="invalid"]::after { color:#991b1b; border-color:#fca5a5; background:#fff1f2; }
      .freeform-object.seat.v681-seat-tile[data-v681-status-kind="absent"]::after { color:#475569; border-color:#cbd5e1; background:#f1f5f9; }
      .freeform-object.seat.v681-seat-tile[data-v681-status-kind="locked"]::after { color:#5b21b6; border-color:#c4b5fd; background:#f5f3ff; }
      .freeform-object.seat.v681-seat-tile.seat-validity-valid { outline:2px solid #16a34a; outline-offset:2px; box-shadow:0 0 0 4px rgba(22,163,74,.11), 0 5px 12px rgba(15,23,42,.08); }
      .freeform-object.seat.v681-seat-tile.seat-validity-caution { outline:2px solid #d97706; outline-offset:2px; box-shadow:0 0 0 4px rgba(217,119,6,.11), 0 5px 12px rgba(15,23,42,.08); }
      .freeform-object.seat.v681-seat-tile.seat-validity-invalid,
      .freeform-object.seat.v681-seat-tile.seat-validity-blocked { outline:2px solid #dc2626; outline-offset:2px; box-shadow:0 0 0 4px rgba(220,38,38,.10), 0 5px 12px rgba(15,23,42,.08); }
      .freeform-object.seat.v681-seat-tile.selected { outline:3px solid var(--accent, #2f6fed); outline-offset:2px; box-shadow:0 0 0 5px color-mix(in srgb, var(--accent, #2f6fed) 16%, transparent), 0 7px 16px rgba(15,23,42,.10); }
      .freeform-object.seat.v681-seat-tile.locked { border-style:solid; box-shadow:inset 0 0 0 1px color-mix(in srgb, #7c3aed 28%, transparent), 0 4px 10px rgba(15,23,42,.06); }
      .seat-grid.freeform-canvas[data-v681-zoom-band="low"] .freeform-object.seat.v681-seat-tile .freeform-object-meta,
      .seat-grid.freeform-canvas[data-v681-zoom-band="low"] .freeform-object.seat.v681-seat-tile .freeform-group-summary,
      .seat-grid.freeform-canvas[data-v681-zoom-band="low"] .freeform-object.seat.v681-seat-tile .cell-zone-tags { display:none; }
      .seat-grid.freeform-canvas[data-v681-zoom-band="low"] .v681-pod-label { font-size:8px; padding:1px 5px; }
      body.visibility-mode .v681-pod-halo { background:color-mix(in srgb, var(--v681-pod-color, #6f8f82) 7%, transparent); border-width:2px; box-shadow:none; }
      body.visibility-mode .v681-pod-label { background:color-mix(in srgb, var(--panel, #ffffff) 94%, var(--v681-pod-color, #6f8f82)); font-size:10px; }
      body.visibility-mode .freeform-object.table.v681-table-surface { box-shadow:none; }
      body.visibility-mode .freeform-object.seat.v681-seat-tile { box-shadow:0 2px 5px rgba(15,23,42,.05); padding:11px 9px; }
      body.visibility-mode .freeform-object.seat.v681-seat-tile .freeform-object-title { font-size:calc(13px * var(--seat-text-scale, 1)); }
      body.visibility-mode .freeform-object.seat.v681-seat-tile .freeform-object-meta,
      body.visibility-mode .freeform-object.seat.v681-seat-tile .freeform-group-summary,
      body.visibility-mode .freeform-object.seat.v681-seat-tile .cell-zone-tags { display:none; }
      body.visibility-mode .freeform-object.seat.v681-seat-tile[data-v681-status-kind="locked"]::after,
      body.visibility-mode .freeform-object.seat.v681-seat-tile[data-v681-status-kind="valid"]::after,
      body.visibility-mode .freeform-object.seat.v681-seat-tile[data-v681-status-kind="caution"]::after { display:none; }
      .v681-planning-preview-pair { align-items:stretch; }
      .v681-plan-preview { min-width:0; margin:0; display:grid; gap:6px; }
      .v681-plan-preview figcaption { font-size:11px; font-weight:850; color:var(--muted, #607089); }
      .v681-plan-preview-canvas { position:relative; width:100%; min-height:180px; overflow:hidden; border:1px solid var(--border, #d8deea); border-radius:13px; background:color-mix(in srgb, var(--panel, #ffffff) 96%, #94a3b8 4%); }
      .v681-mini-pod { position:absolute; border:1.5px solid color-mix(in srgb, var(--v681-pod-color, #6f8f82) 55%, transparent); border-radius:16px; background:color-mix(in srgb, var(--v681-pod-color, #6f8f82) 8%, transparent); pointer-events:none; }
      .v681-mini-pod.round { border-radius:999px; }
      .v681-mini-pod > span { position:absolute; left:5px; top:4px; max-width:calc(100% - 10px); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:7px; font-weight:800; color:var(--muted, #607089); }
      .v681-mini-object { position:absolute; display:grid; place-items:center; min-width:8px; min-height:7px; overflow:hidden; border:1px solid #a7b0bd; border-radius:5px; background:var(--panel-2, #f8fafc); color:var(--text, #172033); transform-origin:center; }
      .v681-mini-object > span { max-width:94%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:clamp(5px, .7vw, 9px); font-weight:800; }
      .v681-mini-object > small { position:absolute; right:2px; bottom:1px; font-size:5px; color:var(--muted, #607089); }
      .v681-mini-object.table { border-width:1.5px; border-color:color-mix(in srgb, var(--v681-seat-accent, #6f8f82) 55%, #64748b); background:#edf1f2; border-radius:9px; }
      .v681-mini-object.table.round { border-radius:999px; }
      .v681-mini-object.seat { border-color:color-mix(in srgb, var(--v681-seat-accent, #9db7ef) 58%, #94a3b8); background:color-mix(in srgb, #ffffff 91%, var(--v681-seat-accent, #9db7ef) 9%); }
      .v681-mini-object.seat.open { border-style:dashed; color:var(--muted, #607089); background:#fbfcfd; }
      .v681-mini-object.seat.changed { outline:2px solid #2563eb; outline-offset:1px; z-index:6; }
      @media (max-width:980px) {
        .v681-pod-label { max-width:min(150px, calc(100% - 20px)); }
        .v681-planning-preview-pair { grid-template-columns:1fr; }
        .v681-plan-preview-canvas { min-height:220px; }
      }
      @media print {
        .v681-pod-halo { border:1.5pt solid #777 !important; background:transparent !important; box-shadow:none !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .v681-pod-label { border-color:#999 !important; background:#fff !important; color:#222 !important; box-shadow:none !important; }
        .freeform-object.table.v681-table-surface { border:1.5pt solid #666 !important; background:#ededed !important; box-shadow:none !important; color:#111 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .freeform-object.seat.v681-seat-tile { border:1pt solid #777 !important; background:#fff !important; box-shadow:none !important; color:#111 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .freeform-object.seat.v681-seat-tile.unassigned { border-style:dashed !important; color:#555 !important; }
        .freeform-object.seat.v681-seat-tile::after { border-color:#999 !important; background:#fff !important; color:#333 !important; }
        body.print-clean .v681-pod-label,
        body.print-clean .freeform-object.seat.v681-seat-tile::after,
        body.print-clean .freeform-object.seat.v681-seat-tile .freeform-object-meta,
        body.print-clean .freeform-object.seat.v681-seat-tile .freeform-group-summary,
        body.print-clean .freeform-object.seat.v681-seat-tile .cell-zone-tags { display:none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function install() {
    if (installed) return;
    installed = true;
    ensureStyles();
    installInteractionBridges();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeCanvas, { once: true });
    else observeCanvas();
  }

  function afterReady() {
    observeCanvas();
    scheduleEnhance();
  }

  install();

  return Object.freeze({
    version: MODULE_VERSION,
    install,
    afterReady,
    enhance: enhanceCanvas,
    associationsForLayout,
    planPreviewMarkup,
    renderPlanComparison,
    chartCanvas,
    copyChartAsImage
  });
})();

'use strict';
