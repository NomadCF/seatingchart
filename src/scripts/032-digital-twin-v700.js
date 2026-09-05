window.ClassroomDigitalTwinV700 = (() => {
  'use strict';

  const VERSION = '7.0.0';
  const STYLE_ID = 'classroomDigitalTwinV700Styles';
  const MODAL_ID = 'digitalTwinV700Modal';
  const MAX_BACKGROUND_BYTES = 4 * 1024 * 1024;
  const DEFAULT_ROOM = Object.freeze({
    enabled: false,
    unit: 'ft',
    width: 30,
    height: 24,
    gridStep: 1,
    showGrid: true,
    showRulers: true,
    showObjectMeasurements: true,
    background: Object.freeze({
      dataUrl: '',
      name: '',
      visible: true,
      opacity: 0.42,
      scalePct: 100,
      offsetXPct: 0,
      offsetYPct: 0,
      rotation: 0,
      print: false,
      locked: true
    })
  });
  const PHYSICAL_TYPES = Object.freeze([
    ['shelf', 'Shelf / Bookcase'],
    ['cabinet', 'Cabinet / Storage'],
    ['lab', 'Lab Station'],
    ['sink', 'Sink / Utility'],
    ['station', 'Activity Station'],
    ['walkway', 'Walkway'],
    ['ada', 'Accessibility Area'],
    ['door', 'Door'],
    ['window', 'Window'],
    ['board', 'Board / Display'],
    ['teacher', 'Teacher Desk']
  ]);

  let observer = null;
  let frame = 0;
  let measureState = { active:false, firstId:'', secondId:'' };

  const list = value => Array.isArray(value) ? value : [];
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max, fallback = min) => Math.max(min, Math.min(max, number(value, fallback)));
  const esc = value => typeof escapeHtml === 'function'
    ? escapeHtml(String(value ?? ''))
    : String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);

  function activeLayout() {
    return state?.freeformLayout && typeof state.freeformLayout === 'object' ? state.freeformLayout : null;
  }

  function physicalRoom(layout = activeLayout()) {
    const source = layout?.physicalRoom && typeof layout.physicalRoom === 'object' ? layout.physicalRoom : {};
    const background = source.background && typeof source.background === 'object' ? source.background : {};
    const unit = source.unit === 'm' ? 'm' : 'ft';
    return {
      enabled: Boolean(source.enabled),
      unit,
      width: clamp(source.width, unit === 'm' ? 2 : 6, unit === 'm' ? 100 : 330, DEFAULT_ROOM.width),
      height: clamp(source.height, unit === 'm' ? 2 : 6, unit === 'm' ? 100 : 330, DEFAULT_ROOM.height),
      gridStep: clamp(source.gridStep, unit === 'm' ? 0.1 : 0.25, unit === 'm' ? 10 : 20, DEFAULT_ROOM.gridStep),
      showGrid: source.showGrid !== false,
      showRulers: source.showRulers !== false,
      showObjectMeasurements: source.showObjectMeasurements !== false,
      background: {
        dataUrl: /^data:image\//i.test(String(background.dataUrl || '')) ? String(background.dataUrl) : '',
        name: String(background.name || '').slice(0, 120),
        visible: background.visible !== false,
        opacity: clamp(background.opacity, 0.05, 1, DEFAULT_ROOM.background.opacity),
        scalePct: clamp(background.scalePct, 20, 300, 100),
        offsetXPct: clamp(background.offsetXPct, -100, 100, 0),
        offsetYPct: clamp(background.offsetYPct, -100, 100, 0),
        rotation: clamp(background.rotation, -180, 180, 0),
        print: Boolean(background.print),
        locked: background.locked !== false
      }
    };
  }

  function ensureRoom() {
    if (typeof ensureFreeformLayout === 'function') ensureFreeformLayout();
    const layout = activeLayout();
    if (!layout) return null;
    layout.physicalRoom = physicalRoom(layout);
    return layout.physicalRoom;
  }

  function unitLabel(unit, plural = false) {
    if (unit === 'm') return plural ? 'meters' : 'm';
    return plural ? 'feet' : 'ft';
  }

  function convert(value, from, to) {
    const numeric = number(value, 0);
    if (from === to) return numeric;
    return from === 'ft' ? numeric * 0.3048 : numeric / 0.3048;
  }

  function canvasMetrics(layout = activeLayout()) {
    const room = physicalRoom(layout);
    const canvas = layout?.canvas || {};
    const widthPx = Math.max(1, number(canvas.width, 2800));
    const heightPx = Math.max(1, number(canvas.height, 1800));
    return {
      room,
      widthPx,
      heightPx,
      pxPerUnitX: widthPx / Math.max(0.001, room.width),
      pxPerUnitY: heightPx / Math.max(0.001, room.height)
    };
  }

  function physicalDistance(a, b, layout = activeLayout()) {
    if (!a || !b) return Infinity;
    const metrics = canvasMetrics(layout);
    const ax = (number(a.x) + number(a.width, 1) / 2) / metrics.pxPerUnitX;
    const ay = (number(a.y) + number(a.height, 1) / 2) / metrics.pxPerUnitY;
    const bx = (number(b.x) + number(b.width, 1) / 2) / metrics.pxPerUnitX;
    const by = (number(b.y) + number(b.height, 1) / 2) / metrics.pxPerUnitY;
    return Math.hypot(ax - bx, ay - by);
  }

  function objectDimensions(object, layout = activeLayout()) {
    const metrics = canvasMetrics(layout);
    return {
      width: number(object?.width, 1) / metrics.pxPerUnitX,
      height: number(object?.height, 1) / metrics.pxPerUnitY,
      unit: metrics.room.unit
    };
  }

  function schedulePersist(reason = 'digital-twin') {
    try { persistActiveClass?.(); } catch (_) { /* autosave integration is optional */ }
    try { scheduleLinkedAutoSave?.(reason); } catch (_) { /* autosave integration is optional */ }
    try { persistFreeformGeometrySession?.(reason); } catch (_) { /* geometry cache is best-effort */ }
  }

  function configureRoom(options = {}) {
    const layout = activeLayout() || (typeof ensureFreeformLayout === 'function' ? ensureFreeformLayout() : null);
    if (!layout) return null;
    const before = physicalRoom(layout);
    const nextUnit = options.unit === 'm' ? 'm' : options.unit === 'ft' ? 'ft' : before.unit;
    const convertExisting = options.convertExisting === true && nextUnit !== before.unit;
    const next = {
      ...before,
      enabled: options.enabled === undefined ? true : Boolean(options.enabled),
      unit: nextUnit,
      width: clamp(options.width ?? (convertExisting ? convert(before.width, before.unit, nextUnit) : before.width), nextUnit === 'm' ? 2 : 6, nextUnit === 'm' ? 100 : 330, before.width),
      height: clamp(options.height ?? (convertExisting ? convert(before.height, before.unit, nextUnit) : before.height), nextUnit === 'm' ? 2 : 6, nextUnit === 'm' ? 100 : 330, before.height),
      gridStep: clamp(options.gridStep ?? (convertExisting ? convert(before.gridStep, before.unit, nextUnit) : before.gridStep), nextUnit === 'm' ? 0.1 : 0.25, nextUnit === 'm' ? 10 : 20, before.gridStep),
      showGrid: options.showGrid === undefined ? before.showGrid : Boolean(options.showGrid),
      showRulers: options.showRulers === undefined ? before.showRulers : Boolean(options.showRulers),
      showObjectMeasurements: options.showObjectMeasurements === undefined ? before.showObjectMeasurements : Boolean(options.showObjectMeasurements),
      background: { ...before.background }
    };
    layout.physicalRoom = next;
    if (options.fitCanvas) {
      const oldWidth = Math.max(400, number(layout.canvas?.width, 2800));
      const targetHeight = clamp(oldWidth * (next.height / Math.max(0.001, next.width)), 300, 12000, number(layout.canvas?.height, 1800));
      layout.canvas.height = Math.round(targetHeight);
    }
    schedulePersist('digital-twin-room-dimensions');
    try { renderAll?.(); } catch (_) { scheduleEnhance(); }
    scheduleEnhance();
    return next;
  }

  function setBackground(changes = {}) {
    const room = ensureRoom();
    if (!room) return null;
    room.background = { ...room.background, ...changes };
    room.background.opacity = clamp(room.background.opacity, 0.05, 1, 0.42);
    room.background.scalePct = clamp(room.background.scalePct, 20, 300, 100);
    room.background.offsetXPct = clamp(room.background.offsetXPct, -100, 100, 0);
    room.background.offsetYPct = clamp(room.background.offsetYPct, -100, 100, 0);
    room.background.rotation = clamp(room.background.rotation, -180, 180, 0);
    schedulePersist('digital-twin-floor-plan');
    scheduleEnhance();
    return room.background;
  }

  function removeBackground() {
    const room = ensureRoom();
    if (!room) return;
    room.background = { ...DEFAULT_ROOM.background };
    schedulePersist('digital-twin-floor-plan-remove');
    scheduleEnhance();
    renderModal();
  }

  function imageToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file || !String(file.type || '').startsWith('image/')) return reject(new Error('Choose an image file.'));
      if (file.size > 16 * 1024 * 1024) return reject(new Error('The source image is too large. Choose an image under 16 MB.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('The image could not be read.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('The image format could not be decoded.'));
        img.onload = () => {
          const maxSide = 2200;
          const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const context = canvas.getContext('2d');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          let dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          if (dataUrl.length > MAX_BACKGROUND_BYTES * 1.37) dataUrl = canvas.toDataURL('image/jpeg', 0.66);
          if (dataUrl.length > MAX_BACKGROUND_BYTES * 1.37) return reject(new Error('The optimized image is still too large. Use a smaller floor plan image.'));
          resolve(dataUrl);
        };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  async function importBackgroundFile(file) {
    const dataUrl = await imageToDataUrl(file);
    setBackground({ dataUrl, name: String(file?.name || 'Classroom floor plan').slice(0, 120), visible:true });
    renderModal();
    return dataUrl;
  }

  function clearOverlays(canvas) {
    canvas.querySelectorAll(':scope > .v700-room-grid,:scope > .v700-floor-plan,:scope > .v700-rulers,:scope > .v700-measurement-layer').forEach(node => node.remove());
    canvas.querySelectorAll('.freeform-object .v700-object-measure').forEach(node => node.remove());
  }

  function addGrid(canvas, metrics) {
    if (!metrics.room.enabled || !metrics.room.showGrid) return;
    const grid = document.createElement('div');
    grid.className = 'v700-room-grid';
    grid.setAttribute('aria-hidden', 'true');
    const stepX = Math.max(5, metrics.pxPerUnitX * metrics.room.gridStep);
    const stepY = Math.max(5, metrics.pxPerUnitY * metrics.room.gridStep);
    grid.style.setProperty('--v700-step-x', `${stepX}px`);
    grid.style.setProperty('--v700-step-y', `${stepY}px`);
    canvas.prepend(grid);
  }

  function addBackground(canvas, metrics) {
    const bg = metrics.room.background;
    if (!metrics.room.enabled || !bg.visible || !bg.dataUrl) return;
    const wrap = document.createElement('div');
    wrap.className = 'v700-floor-plan';
    wrap.dataset.printFloorPlan = bg.print ? 'true' : 'false';
    wrap.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.alt = '';
    img.src = bg.dataUrl;
    img.style.opacity = String(bg.opacity);
    img.style.width = `${bg.scalePct}%`;
    img.style.height = `${bg.scalePct}%`;
    img.style.left = `${50 + bg.offsetXPct}%`;
    img.style.top = `${50 + bg.offsetYPct}%`;
    img.style.transform = `translate(-50%,-50%) rotate(${bg.rotation}deg)`;
    wrap.appendChild(img);
    canvas.prepend(wrap);
  }

  function tickValues(total, step) {
    const maxTicks = 32;
    let spacing = Math.max(step, 0.001);
    while (total / spacing > maxTicks) spacing *= 2;
    const values = [];
    for (let value = 0; value <= total + spacing * 0.15; value += spacing) values.push(Math.min(total, value));
    return [...new Set(values.map(value => Number(value.toFixed(3))))];
  }

  function addRulers(canvas, metrics) {
    if (!metrics.room.enabled || !metrics.room.showRulers) return;
    const rulers = document.createElement('div');
    rulers.className = 'v700-rulers';
    rulers.setAttribute('aria-hidden', 'true');
    const horizontal = document.createElement('div');
    horizontal.className = 'v700-ruler horizontal';
    tickValues(metrics.room.width, metrics.room.gridStep).forEach(value => {
      const tick = document.createElement('span');
      tick.style.left = `${(value / metrics.room.width) * 100}%`;
      tick.textContent = `${Number(value.toFixed(2))}${unitLabel(metrics.room.unit)}`;
      horizontal.appendChild(tick);
    });
    const vertical = document.createElement('div');
    vertical.className = 'v700-ruler vertical';
    tickValues(metrics.room.height, metrics.room.gridStep).forEach(value => {
      const tick = document.createElement('span');
      tick.style.top = `${(value / metrics.room.height) * 100}%`;
      tick.textContent = `${Number(value.toFixed(2))}${unitLabel(metrics.room.unit)}`;
      vertical.appendChild(tick);
    });
    rulers.append(horizontal, vertical);
    canvas.appendChild(rulers);
  }

  function addObjectMeasurements(canvas, metrics) {
    if (!metrics.room.enabled || !metrics.room.showObjectMeasurements) return;
    const layout = activeLayout();
    const objectMap = new Map(list(layout?.objects).map(object => [String(object.id), object]));
    canvas.querySelectorAll('.freeform-object[data-object-id]').forEach(node => {
      const object = objectMap.get(String(node.dataset.objectId || ''));
      if (!object || object.type === 'seat') return;
      const dims = objectDimensions(object, layout);
      const label = document.createElement('span');
      label.className = 'v700-object-measure';
      label.textContent = `${dims.width.toFixed(dims.width < 10 ? 1 : 0)} × ${dims.height.toFixed(dims.height < 10 ? 1 : 0)} ${unitLabel(dims.unit)}`;
      label.setAttribute('aria-hidden', 'true');
      node.appendChild(label);
    });
  }

  function objectCenter(object) {
    return { x:number(object?.x) + number(object?.width, 1) / 2, y:number(object?.y) + number(object?.height, 1) / 2 };
  }

  function addMeasurementLine(canvas, metrics) {
    if (!measureState.firstId || !measureState.secondId) return;
    const objects = list(activeLayout()?.objects);
    const first = objects.find(object => String(object.id) === measureState.firstId);
    const second = objects.find(object => String(object.id) === measureState.secondId);
    if (!first || !second) return;
    const a = objectCenter(first);
    const b = objectCenter(second);
    const distance = physicalDistance(first, second);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const layer = document.createElement('div');
    layer.className = 'v700-measurement-layer';
    layer.setAttribute('aria-hidden', 'true');
    const line = document.createElement('div');
    line.className = 'v700-distance-line';
    line.style.left = `${a.x}px`;
    line.style.top = `${a.y}px`;
    line.style.width = `${length}px`;
    line.style.transform = `rotate(${angle}deg)`;
    const badge = document.createElement('span');
    badge.textContent = `${distance.toFixed(distance < 10 ? 2 : 1)} ${unitLabel(metrics.room.unit)}`;
    line.appendChild(badge);
    layer.appendChild(line);
    canvas.appendChild(layer);
  }

  function enhance() {
    const canvas = document.querySelector('#seatGrid.freeform-canvas');
    if (!canvas || state?.layoutMode !== 'freeform') return false;
    const room = ensureRoom();
    clearOverlays(canvas);
    if (!room?.enabled) {
      canvas.removeAttribute('data-v700-digital-twin');
      return false;
    }
    const metrics = canvasMetrics();
    canvas.dataset.v700DigitalTwin = VERSION;
    canvas.dataset.v700Unit = room.unit;
    addGrid(canvas, metrics);
    addBackground(canvas, metrics);
    addRulers(canvas, metrics);
    addObjectMeasurements(canvas, metrics);
    addMeasurementLine(canvas, metrics);
    return true;
  }

  function scheduleEnhance() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; enhance(); });
  }

  function startMeasureMode() {
    const room = ensureRoom();
    if (!room?.enabled) return setStatus('Set physical room dimensions before measuring distances.');
    measureState = { active:true, firstId:'', secondId:'' };
    document.body.classList.add('v700-measure-mode');
    setStatus('Measurement mode: choose the first room object.');
    renderModal();
  }

  function stopMeasureMode({ keepLine = true } = {}) {
    measureState.active = false;
    if (!keepLine) measureState = { active:false, firstId:'', secondId:'' };
    document.body.classList.remove('v700-measure-mode');
    scheduleEnhance();
    renderModal();
  }

  function handleMeasureClick(event) {
    if (!measureState.active) return;
    const target = event.target instanceof Element ? event.target.closest('.freeform-object[data-object-id]') : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = String(target.dataset.objectId || '');
    if (!measureState.firstId) {
      measureState.firstId = id;
      setStatus('First object selected. Choose the second room object.');
      scheduleEnhance();
      return;
    }
    if (id === measureState.firstId) return setStatus('Choose a different second object.');
    measureState.secondId = id;
    const objects = list(activeLayout()?.objects);
    const first = objects.find(object => String(object.id) === measureState.firstId);
    const second = objects.find(object => String(object.id) === measureState.secondId);
    const distance = physicalDistance(first, second);
    setStatus(`Measured ${distance.toFixed(distance < 10 ? 2 : 1)} ${unitLabel(physicalRoom().unit)} between object centers.`);
    stopMeasureMode({ keepLine:true });
  }

  function setStatus(message) {
    const local = document.getElementById('digitalTwinV700Status');
    if (local) local.textContent = String(message || '');
    try { setLiveStatusMessage?.(String(message || '')); } catch (_) { /* live region is optional */ }
  }

  function quickAdd(type) {
    if (state?.layoutMode !== 'freeform') {
      setStatus('Switch Room Design to Freeform before adding physical room objects.');
      return;
    }
    try {
      addFreeformObject(type);
      scheduleEnhance();
      setStatus(`${PHYSICAL_TYPES.find(item => item[0] === type)?.[1] || type} added to the room.`);
    } catch (error) {
      setStatus(`The room object could not be added: ${error.message}`);
    }
  }

  function modalMarkup() {
    return `<div id="${MODAL_ID}" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="digitalTwinV700Title">
      <div class="modal v700-modal">
        <div class="panel-header">
          <div><span class="v700-kicker">V7 Classroom Digital Twin</span><h2 id="digitalTwinV700Title">Physical room setup</h2></div>
          <button id="digitalTwinV700CloseBtn" class="tiny secondary" type="button">Close</button>
        </div>
        <div class="modal-body v700-modal-body">
          <div class="v700-intro"><strong>Make Freeform match the real classroom.</strong><span>Physical dimensions, floor-plan alignment, measurements, and fixed room objects sit underneath the existing seating model. Existing layouts remain valid.</span></div>
          <section class="section v700-section">
            <div class="v700-section-head"><div><h3>Room dimensions</h3><p>Set the real size of the usable room. This adds scale without changing student assignments.</p></div><label class="v700-switch"><input id="digitalTwinV700Enabled" type="checkbox" /> Physical scale on</label></div>
            <div class="v700-fields">
              <label>Units<select id="digitalTwinV700Unit"><option value="ft">Feet</option><option value="m">Meters</option></select></label>
              <label>Room width<input id="digitalTwinV700Width" type="number" min="2" step="0.1" /></label>
              <label>Room depth<input id="digitalTwinV700Height" type="number" min="2" step="0.1" /></label>
              <label>Grid spacing<input id="digitalTwinV700GridStep" type="number" min="0.1" step="0.1" /></label>
            </div>
            <div class="v700-checks">
              <label><input id="digitalTwinV700ShowGrid" type="checkbox" /> Scaled grid</label>
              <label><input id="digitalTwinV700ShowRulers" type="checkbox" /> Room rulers</label>
              <label><input id="digitalTwinV700ShowMeasurements" type="checkbox" /> Object dimensions</label>
              <label><input id="digitalTwinV700FitCanvas" type="checkbox" checked /> Fit canvas aspect ratio to room</label>
            </div>
            <div class="v700-actions"><button id="digitalTwinV700ApplyRoomBtn" type="button">Apply physical room</button><button id="digitalTwinV700MeasureBtn" class="secondary" type="button">Measure between objects</button><button id="digitalTwinV700ClearMeasureBtn" class="ghost" type="button">Clear measurement</button></div>
          </section>
          <section class="section v700-section">
            <div class="v700-section-head"><div><h3>Floor-plan background</h3><p>Use a classroom photo, sketch, or floor plan as a locked reference layer. Images are optimized before being stored with the class.</p></div><span id="digitalTwinV700BackgroundName" class="pill">No image</span></div>
            <input id="digitalTwinV700BackgroundFile" type="file" accept="image/png,image/jpeg,image/webp" hidden />
            <div class="v700-actions"><button id="digitalTwinV700ChooseBackgroundBtn" class="secondary" type="button">Choose floor plan</button><button id="digitalTwinV700RemoveBackgroundBtn" class="ghost" type="button">Remove image</button></div>
            <div class="v700-fields v700-background-controls">
              <label>Opacity <output id="digitalTwinV700OpacityValue"></output><input id="digitalTwinV700Opacity" type="range" min="5" max="100" step="1" /></label>
              <label>Scale <output id="digitalTwinV700ScaleValue"></output><input id="digitalTwinV700Scale" type="range" min="20" max="300" step="1" /></label>
              <label>Horizontal offset <output id="digitalTwinV700OffsetXValue"></output><input id="digitalTwinV700OffsetX" type="range" min="-100" max="100" step="1" /></label>
              <label>Vertical offset <output id="digitalTwinV700OffsetYValue"></output><input id="digitalTwinV700OffsetY" type="range" min="-100" max="100" step="1" /></label>
              <label>Rotation <output id="digitalTwinV700RotationValue"></output><input id="digitalTwinV700Rotation" type="range" min="-180" max="180" step="1" /></label>
            </div>
            <div class="v700-checks"><label><input id="digitalTwinV700BackgroundVisible" type="checkbox" /> Show background</label><label><input id="digitalTwinV700BackgroundPrint" type="checkbox" /> Include background when printing</label></div>
          </section>
          <section class="section v700-section">
            <div class="v700-section-head"><div><h3>Physical room objects</h3><p>Add fixed classroom features. They use the existing Freeform object system, so movement, rotation, undo, save, print, and room rules stay compatible.</p></div></div>
            <div class="v700-object-library">${PHYSICAL_TYPES.map(([type,label]) => `<button class="secondary" type="button" data-v700-add-object="${esc(type)}">${esc(label)}</button>`).join('')}</div>
          </section>
          <div id="digitalTwinV700Status" class="hint" role="status" aria-live="polite"></div>
        </div>
      </div>
    </div>`;
  }

  function ensureModal() {
    if (document.getElementById(MODAL_ID)) return document.getElementById(MODAL_ID);
    const host = document.createElement('div');
    host.innerHTML = modalMarkup();
    const modal = host.firstElementChild;
    document.body.appendChild(modal);
    bindModalEvents(modal);
    return modal;
  }

  function openModal() {
    if (state?.layoutMode !== 'freeform') {
      try {
        if (el('layoutModeSelect')) el('layoutModeSelect').value = 'freeform';
        switchLayoutMode?.('freeform');
      } catch (_) { /* user can still inspect settings */ }
    }
    const modal = ensureModal();
    renderModal();
    modal.classList.add('show');
  }

  function closeModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.classList.remove('show');
  }

  function renderModal() {
    const modal = ensureModal();
    const room = ensureRoom() || physicalRoom();
    const setChecked = (id, value) => { const node = modal.querySelector(`#${id}`); if (node) node.checked = Boolean(value); };
    const setValue = (id, value) => { const node = modal.querySelector(`#${id}`); if (node && document.activeElement !== node) node.value = String(value); };
    setChecked('digitalTwinV700Enabled', room.enabled);
    setValue('digitalTwinV700Unit', room.unit);
    setValue('digitalTwinV700Width', room.width);
    setValue('digitalTwinV700Height', room.height);
    setValue('digitalTwinV700GridStep', room.gridStep);
    setChecked('digitalTwinV700ShowGrid', room.showGrid);
    setChecked('digitalTwinV700ShowRulers', room.showRulers);
    setChecked('digitalTwinV700ShowMeasurements', room.showObjectMeasurements);
    setValue('digitalTwinV700Opacity', Math.round(room.background.opacity * 100));
    setValue('digitalTwinV700Scale', room.background.scalePct);
    setValue('digitalTwinV700OffsetX', room.background.offsetXPct);
    setValue('digitalTwinV700OffsetY', room.background.offsetYPct);
    setValue('digitalTwinV700Rotation', room.background.rotation);
    setChecked('digitalTwinV700BackgroundVisible', room.background.visible);
    setChecked('digitalTwinV700BackgroundPrint', room.background.print);
    const bgName = modal.querySelector('#digitalTwinV700BackgroundName');
    if (bgName) bgName.textContent = room.background.name || 'No image';
    const outputs = {
      digitalTwinV700OpacityValue:`${Math.round(room.background.opacity * 100)}%`,
      digitalTwinV700ScaleValue:`${Math.round(room.background.scalePct)}%`,
      digitalTwinV700OffsetXValue:`${Math.round(room.background.offsetXPct)}%`,
      digitalTwinV700OffsetYValue:`${Math.round(room.background.offsetYPct)}%`,
      digitalTwinV700RotationValue:`${Math.round(room.background.rotation)}°`
    };
    Object.entries(outputs).forEach(([id,value]) => { const node = modal.querySelector(`#${id}`); if (node) node.textContent = value; });
    const measureBtn = modal.querySelector('#digitalTwinV700MeasureBtn');
    if (measureBtn) measureBtn.textContent = measureState.active ? 'Choose objects on room' : 'Measure between objects';
  }

  function applyModalRoom() {
    const modal = ensureModal();
    const current = physicalRoom();
    const nextUnit = modal.querySelector('#digitalTwinV700Unit')?.value === 'm' ? 'm' : 'ft';
    configureRoom({
      enabled: modal.querySelector('#digitalTwinV700Enabled')?.checked,
      unit: nextUnit,
      width: modal.querySelector('#digitalTwinV700Width')?.value,
      height: modal.querySelector('#digitalTwinV700Height')?.value,
      gridStep: modal.querySelector('#digitalTwinV700GridStep')?.value,
      showGrid: modal.querySelector('#digitalTwinV700ShowGrid')?.checked,
      showRulers: modal.querySelector('#digitalTwinV700ShowRulers')?.checked,
      showObjectMeasurements: modal.querySelector('#digitalTwinV700ShowMeasurements')?.checked,
      fitCanvas: modal.querySelector('#digitalTwinV700FitCanvas')?.checked,
      convertExisting: nextUnit !== current.unit
    });
    setStatus(`Physical room set to ${modal.querySelector('#digitalTwinV700Width')?.value} × ${modal.querySelector('#digitalTwinV700Height')?.value} ${unitLabel(nextUnit, true)}.`);
    renderModal();
  }

  function bindModalEvents(modal) {
    modal.querySelector('#digitalTwinV700CloseBtn')?.addEventListener('click', closeModal);
    modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
    modal.querySelector('#digitalTwinV700ApplyRoomBtn')?.addEventListener('click', applyModalRoom);
    modal.querySelector('#digitalTwinV700MeasureBtn')?.addEventListener('click', () => measureState.active ? stopMeasureMode({ keepLine:true }) : startMeasureMode());
    modal.querySelector('#digitalTwinV700ClearMeasureBtn')?.addEventListener('click', () => stopMeasureMode({ keepLine:false }));
    modal.querySelector('#digitalTwinV700ChooseBackgroundBtn')?.addEventListener('click', () => modal.querySelector('#digitalTwinV700BackgroundFile')?.click());
    modal.querySelector('#digitalTwinV700BackgroundFile')?.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      setStatus('Optimizing floor-plan image…');
      try { await importBackgroundFile(file); setStatus('Floor-plan background added and stored with this class.'); }
      catch (error) { setStatus(error.message); }
      event.target.value = '';
    });
    modal.querySelector('#digitalTwinV700RemoveBackgroundBtn')?.addEventListener('click', removeBackground);
    modal.querySelectorAll('[data-v700-add-object]').forEach(button => button.addEventListener('click', () => quickAdd(button.dataset.v700AddObject)));

    const syncBackground = () => {
      setBackground({
        opacity: number(modal.querySelector('#digitalTwinV700Opacity')?.value, 42) / 100,
        scalePct: number(modal.querySelector('#digitalTwinV700Scale')?.value, 100),
        offsetXPct: number(modal.querySelector('#digitalTwinV700OffsetX')?.value, 0),
        offsetYPct: number(modal.querySelector('#digitalTwinV700OffsetY')?.value, 0),
        rotation: number(modal.querySelector('#digitalTwinV700Rotation')?.value, 0),
        visible: modal.querySelector('#digitalTwinV700BackgroundVisible')?.checked,
        print: modal.querySelector('#digitalTwinV700BackgroundPrint')?.checked
      });
      renderModal();
    };
    ['digitalTwinV700Opacity','digitalTwinV700Scale','digitalTwinV700OffsetX','digitalTwinV700OffsetY','digitalTwinV700Rotation'].forEach(id => modal.querySelector(`#${id}`)?.addEventListener('input', syncBackground));
    ['digitalTwinV700BackgroundVisible','digitalTwinV700BackgroundPrint'].forEach(id => modal.querySelector(`#${id}`)?.addEventListener('change', syncBackground));
  }

  function installLauncher() {
    if (document.getElementById('openDigitalTwinV700Btn')) return;
    const button = document.createElement('button');
    button.id = 'openDigitalTwinV700Btn';
    button.type = 'button';
    button.className = 'secondary v700-launcher';
    button.innerHTML = '<span aria-hidden="true">⌗</span><span>Digital Twin</span>';
    button.title = 'Set physical room dimensions, floor-plan background, measurements, and fixed room objects.';
    button.addEventListener('click', openModal);
    const widthInput = document.getElementById('freeformCanvasWidthInput');
    const controls = widthInput?.closest('.field')?.parentElement || document.querySelector('.freeform-controls, #roomLayoutControls');
    if (controls) controls.appendChild(button);
    else document.body.appendChild(button);
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .v700-launcher{display:none;align-items:center;gap:6px;font-weight:800}.freeform-layout-mode .v700-launcher{display:inline-flex}
      .v700-modal{width:min(1040px,calc(100vw - 28px));max-width:1040px;height:min(880px,calc(100vh - 28px))}.v700-modal-body{display:grid;gap:14px;overflow:auto;padding-bottom:28px}.v700-kicker{display:block;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#607089);margin-bottom:3px}.v700-intro{display:flex;gap:10px;align-items:baseline;padding:12px 14px;border:1px solid var(--border,#d8deea);border-radius:12px;background:color-mix(in srgb,var(--panel,#fff) 94%,#3b82f6 6%)}.v700-intro span{color:var(--muted,#607089)}
      .v700-section{display:grid;gap:12px}.v700-section-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.v700-section-head h3{margin:0 0 3px}.v700-section-head p{margin:0;color:var(--muted,#607089);font-size:12px;max-width:680px}.v700-switch{white-space:nowrap;font-weight:800}.v700-fields{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:10px}.v700-fields>label{display:grid;gap:5px;font-size:11px;font-weight:800}.v700-fields input,.v700-fields select{width:100%}.v700-background-controls{grid-template-columns:repeat(5,minmax(120px,1fr))}.v700-background-controls output{float:right;color:var(--muted,#607089);font-weight:700}.v700-checks,.v700-actions{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}.v700-checks label{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:750}.v700-object-library{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.v700-object-library button{text-align:left}
      .seat-grid.freeform-canvas[data-v700-digital-twin]{isolation:isolate}.v700-room-grid,.v700-floor-plan,.v700-rulers,.v700-measurement-layer{position:absolute;inset:0;pointer-events:none}.v700-room-grid{z-index:-4;background-image:linear-gradient(to right,color-mix(in srgb,var(--border,#cbd5e1) 42%,transparent) 1px,transparent 1px),linear-gradient(to bottom,color-mix(in srgb,var(--border,#cbd5e1) 42%,transparent) 1px,transparent 1px);background-size:var(--v700-step-x) var(--v700-step-y);opacity:.64}.v700-floor-plan{z-index:-5;overflow:hidden}.v700-floor-plan img{position:absolute;object-fit:contain;max-width:none;max-height:none;transform-origin:center;filter:saturate(.82) contrast(.96)}
      .v700-rulers{z-index:9}.v700-ruler{position:absolute;color:var(--muted,#607089);font-size:9px;font-weight:800}.v700-ruler.horizontal{left:0;right:0;top:0;height:22px;border-bottom:1px solid color-mix(in srgb,var(--border,#cbd5e1) 70%,transparent);background:color-mix(in srgb,var(--panel,#fff) 82%,transparent)}.v700-ruler.vertical{top:0;bottom:0;left:0;width:30px;border-right:1px solid color-mix(in srgb,var(--border,#cbd5e1) 70%,transparent);background:color-mix(in srgb,var(--panel,#fff) 82%,transparent)}.v700-ruler.horizontal span{position:absolute;top:3px;transform:translateX(-50%);white-space:nowrap}.v700-ruler.vertical span{position:absolute;left:3px;transform:translateY(-50%) rotate(-90deg);transform-origin:left center;white-space:nowrap}
      .v700-object-measure{position:absolute;left:50%;bottom:3px;transform:translateX(-50%);max-width:calc(100% - 8px);padding:1px 4px;border-radius:5px;background:color-mix(in srgb,var(--panel,#fff) 88%,transparent);color:var(--muted,#607089);font-size:8px;font-weight:850;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;z-index:8}.v700-measurement-layer{z-index:12}.v700-distance-line{position:absolute;height:2px;background:#2563eb;transform-origin:left center;box-shadow:0 0 0 1px rgba(255,255,255,.7)}.v700-distance-line:before,.v700-distance-line:after{content:"";position:absolute;top:-4px;width:2px;height:10px;background:#2563eb}.v700-distance-line:after{right:0}.v700-distance-line span{position:absolute;left:50%;top:-22px;transform:translateX(-50%);padding:2px 6px;border-radius:999px;background:#1d4ed8;color:#fff;font-size:9px;font-weight:900;white-space:nowrap}.v700-measure-mode .freeform-object{cursor:crosshair!important}.v700-measure-mode .freeform-object:hover{outline:3px solid #2563eb!important;outline-offset:3px}
      body.visibility-mode .v700-rulers,.seat-grid.freeform-canvas[data-v681-zoom-band="low"] .v700-object-measure{display:none}.seat-grid.freeform-canvas[data-v681-zoom-band="low"] .v700-room-grid{opacity:.38}
      @media(max-width:760px){.v700-modal{width:calc(100vw - 12px);height:calc(100vh - 12px)}.v700-fields,.v700-background-controls{grid-template-columns:1fr 1fr}.v700-section-head,.v700-intro{align-items:stretch;flex-direction:column}.v700-intro{display:grid}.v700-object-library{grid-template-columns:1fr 1fr}.v700-ruler.horizontal{height:18px}.v700-ruler.vertical{width:24px}.v700-ruler{font-size:8px}}
      @media(max-width:440px){.v700-fields,.v700-background-controls,.v700-object-library{grid-template-columns:1fr}.v700-actions button{flex:1 1 140px}}
      @media print{.v700-room-grid{opacity:.26!important}.v700-rulers,.v700-object-measure,.v700-measurement-layer{display:none!important}.v700-floor-plan[data-print-floor-plan="false"]{display:none!important}.v700-floor-plan[data-print-floor-plan="true"] img{opacity:.32!important;filter:grayscale(1) contrast(.9)!important}.v700-launcher{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function observeCanvas() {
    const canvas = document.getElementById('seatGrid');
    if (!canvas) { setTimeout(observeCanvas, 250); return; }
    observer?.disconnect();
    observer = new MutationObserver(mutations => {
      const isOwnOverlayNode = node => node instanceof Element && (
        node.matches?.('.v700-room-grid,.v700-floor-plan,.v700-rulers,.v700-measurement-layer,.v700-object-measure') ||
        node.closest?.('.v700-room-grid,.v700-floor-plan,.v700-rulers,.v700-measurement-layer,.v700-object-measure')
      );
      const relevant = mutations.some(mutation => {
        if (isOwnOverlayNode(mutation.target)) return false;
        if (mutation.type === 'childList') {
          const changed = [...mutation.addedNodes, ...mutation.removedNodes].filter(node => node.nodeType === Node.ELEMENT_NODE);
          if (changed.length && changed.every(isOwnOverlayNode)) return false;
        }
        return true;
      });
      if (relevant) scheduleEnhance();
    });
    observer.observe(canvas, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style'] });
    scheduleEnhance();
  }

  function installGlobalEvents() {
    document.addEventListener('click', handleMeasureClick, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && measureState.active) stopMeasureMode({ keepLine:false });
    }, true);
    window.addEventListener('beforeprint', scheduleEnhance);
    window.addEventListener('resize', scheduleEnhance, { passive:true });
  }

  function install() {
    installStyles();
    ensureModal();
    installLauncher();
    installGlobalEvents();
    observeCanvas();
  }

  function afterReady() {
    installLauncher();
    observeCanvas();
    scheduleEnhance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();

  return Object.freeze({
    version:VERSION,
    install,
    afterReady,
    open:openModal,
    close:closeModal,
    enhance,
    physicalRoom,
    ensureRoom,
    configureRoom,
    canvasMetrics,
    objectDimensions,
    physicalDistance,
    setBackground,
    removeBackground,
    importBackgroundFile,
    startMeasureMode,
    stopMeasureMode,
    quickAdd
  });
})();

'use strict';
