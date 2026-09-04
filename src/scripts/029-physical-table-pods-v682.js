window.PhysicalTablePodsV682 = (() => {
  'use strict';

  const VERSION = '6.8.2';
  const STYLE_ID = 'physicalTablePodsV682Styles';
  let observer = null;
  let frame = 0;

  const list = value => Array.isArray(value) ? value : [];
  const bounds = object => ({
    left: Number(object?.x) || 0,
    top: Number(object?.y) || 0,
    width: Math.max(1, Number(object?.width) || (object?.type === 'seat' ? 176 : 120)),
    height: Math.max(1, Number(object?.height) || (object?.type === 'seat' ? 112 : 80))
  });
  const center = object => {
    const b = bounds(object);
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  };

  function nearestTable(association, seat) {
    const seatCenter = center(seat);
    let best = null;
    list(association?.tables).forEach(table => {
      const tableCenter = center(table);
      const distance = Math.hypot(seatCenter.x - tableCenter.x, seatCenter.y - tableCenter.y);
      if (!best || distance < best.distance) best = { table, distance };
    });
    return best?.table || null;
  }

  function seatSide(table, seat) {
    if (!table) return 'none';
    const t = center(table);
    const s = center(seat);
    const dx = s.x - t.x;
    const dy = s.y - t.y;
    const tb = bounds(table);
    if (window.GroupedSeatingVisualsV681?.associationsForLayout && Math.max(tb.width, tb.height) / Math.min(tb.width, tb.height) <= 1.22) {
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angle >= -45 && angle < 45) return 'right';
      if (angle >= 45 && angle < 135) return 'bottom';
      if (angle >= -135 && angle < -45) return 'top';
      return 'left';
    }
    if (Math.abs(dx / Math.max(1, tb.width)) > Math.abs(dy / Math.max(1, tb.height))) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'bottom' : 'top';
  }

  function physicalAssociations() {
    if (state?.layoutMode !== 'freeform') return [];
    return list(window.GroupedSeatingVisualsV681?.associationsForLayout?.(state.freeformLayout))
      .filter(association => list(association.tables).length && list(association.seats).length);
  }

  function clearPhysicalDecorations(canvas) {
    canvas.querySelectorAll(':scope > .v682-chair-cue').forEach(node => node.remove());
    canvas.querySelectorAll('.freeform-object.v682-physical-seat,.freeform-object.v682-physical-table').forEach(node => {
      node.classList.remove('v682-physical-seat', 'v682-physical-table');
      node.removeAttribute('data-v682-seat-side');
      node.removeAttribute('data-v682-table-id');
    });
    canvas.querySelectorAll(':scope > .v681-pod-halo.v682-table-association').forEach(node => node.classList.remove('v682-table-association'));
  }

  function addChairCue(canvas, seatNode, side, accent) {
    const chair = document.createElement('span');
    chair.className = `v682-chair-cue side-${side}`;
    chair.setAttribute('aria-hidden', 'true');
    chair.style.setProperty('--v682-chair-accent', accent || '#64748b');
    const left = Number.parseFloat(seatNode.style.left) || 0;
    const top = Number.parseFloat(seatNode.style.top) || 0;
    const width = Number.parseFloat(seatNode.style.width) || seatNode.offsetWidth || 80;
    const height = Number.parseFloat(seatNode.style.height) || seatNode.offsetHeight || 48;
    if (side === 'top') { chair.style.left = `${left + width * .24}px`; chair.style.top = `${top - 12}px`; chair.style.width = `${width * .52}px`; chair.style.height = '18px'; }
    if (side === 'bottom') { chair.style.left = `${left + width * .24}px`; chair.style.top = `${top + height - 6}px`; chair.style.width = `${width * .52}px`; chair.style.height = '18px'; }
    if (side === 'left') { chair.style.left = `${left - 12}px`; chair.style.top = `${top + height * .24}px`; chair.style.width = '18px'; chair.style.height = `${height * .52}px`; }
    if (side === 'right') { chair.style.left = `${left + width - 6}px`; chair.style.top = `${top + height * .24}px`; chair.style.width = '18px'; chair.style.height = `${height * .52}px`; }
    chair.style.zIndex = String(Math.max(1, (Number(seatNode.style.zIndex) || 2) - 1));
    canvas.insertBefore(chair, seatNode);
  }

  function enhance() {
    const canvas = document.querySelector('#seatGrid.freeform-canvas');
    if (!canvas || state?.layoutMode !== 'freeform') return false;
    clearPhysicalDecorations(canvas);
    const associations = physicalAssociations();
    const objectNodes = new Map([...canvas.querySelectorAll('.freeform-object[data-object-id]')].map(node => [String(node.dataset.objectId), node]));

    associations.forEach(association => {
      list(association.tables).forEach(table => {
        const node = objectNodes.get(String(table.id));
        if (!node) return;
        node.classList.add('v682-physical-table');
        node.style.setProperty('--v682-table-accent', association.color || '#6f8f82');
      });
      list(association.seats).forEach(seat => {
        const node = objectNodes.get(String(seat.id));
        if (!node) return;
        const table = nearestTable(association, seat);
        const side = seatSide(table, seat);
        node.classList.add('v682-physical-seat');
        node.dataset.v682SeatSide = side;
        node.dataset.v682TableId = String(table?.id || '');
        node.style.setProperty('--v682-seat-accent', association.color || '#6f8f82');
        addChairCue(canvas, node, side, association.color);
      });
      const halo = canvas.querySelector(`:scope > .v681-pod-halo[data-v681-pod-id="${CSS.escape(association.id)}"]`);
      halo?.classList.add('v682-table-association');
    });
    canvas.dataset.v682PhysicalTables = VERSION;
    return true;
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; enhance(); });
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .seat-grid.freeform-canvas .v681-pod-halo.v682-table-association { background:transparent; border-color:transparent; box-shadow:none; }
      .seat-grid.freeform-canvas .v681-pod-halo.v682-table-association > .v681-pod-label { opacity:.72; top:4px; }
      .freeform-object.table.v682-physical-table { z-index:1!important; border:2px solid color-mix(in srgb,var(--v682-table-accent,#6f8f82) 48%,#64748b); background:linear-gradient(145deg,color-mix(in srgb,#fff 82%,var(--v682-table-accent,#6f8f82)),color-mix(in srgb,#e8ddd0 82%,var(--v682-table-accent,#6f8f82))); box-shadow:inset 0 2px 0 rgba(255,255,255,.58),0 7px 12px rgba(15,23,42,.14); }
      .freeform-object.table.v682-physical-table.v681-table-round { border-radius:50%; }
      .freeform-object.seat.v682-physical-seat { z-index:4!important; border-width:1.5px; border-color:color-mix(in srgb,var(--v682-seat-accent,#6f8f82) 46%,#94a3b8); background:linear-gradient(180deg,color-mix(in srgb,#fff 94%,var(--v682-seat-accent,#6f8f82)),color-mix(in srgb,#f1f5f9 88%,var(--v682-seat-accent,#6f8f82))); box-shadow:0 3px 7px rgba(15,23,42,.13),inset 0 1px 0 rgba(255,255,255,.75); }
      .freeform-object.seat.v682-physical-seat.unassigned { background:#f5f7f9; border-color:#c7d1dc; border-style:dashed; color:#64748b; box-shadow:0 2px 5px rgba(15,23,42,.07); }
      .v682-chair-cue { position:absolute; display:block; pointer-events:none; border:1px solid color-mix(in srgb,var(--v682-chair-accent,#64748b) 35%,#475569); border-radius:7px; background:linear-gradient(180deg,#8290a0,#5f6d7c); box-shadow:0 2px 4px rgba(15,23,42,.20),inset 0 1px 0 rgba(255,255,255,.25); opacity:.86; transform-origin:center; }
      .v682-chair-cue.side-left,.v682-chair-cue.side-right { border-radius:6px 9px 9px 6px; }
      .seat-grid.freeform-canvas[data-v681-zoom-band="low"] .v682-chair-cue { opacity:.55; box-shadow:none; }
      body.visibility-mode .v682-chair-cue { opacity:.72; box-shadow:0 1px 3px rgba(15,23,42,.15); }
      body.visibility-mode .freeform-object.table.v682-physical-table { box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 4px 8px rgba(15,23,42,.10); }
      body.visibility-mode .seat-grid.freeform-canvas .v681-pod-halo.v682-table-association > .v681-pod-label { opacity:.45; }
      @media (max-width:720px) { .v682-chair-cue { opacity:.72; } .freeform-object.seat.v682-physical-seat { min-width:44px; min-height:38px; } }
      @media print {
        .seat-grid.freeform-canvas .v681-pod-halo.v682-table-association { border-color:transparent!important; }
        .freeform-object.table.v682-physical-table { border:1.5pt solid #555!important; background:#e7e7e7!important; box-shadow:none!important; }
        .freeform-object.seat.v682-physical-seat { border:1pt solid #777!important; background:#fff!important; box-shadow:none!important; }
        .freeform-object.seat.v682-physical-seat.unassigned { border-style:dashed!important; background:#f7f7f7!important; }
        .v682-chair-cue { border:1pt solid #666!important; background:#ddd!important; box-shadow:none!important; opacity:1!important; }
      }
    `;
    document.head.appendChild(style);
  }

  function observe() {
    const canvas = document.getElementById('seatGrid');
    if (!canvas) { setTimeout(observe, 250); return; }
    observer?.disconnect();
    observer = new MutationObserver(schedule);
    observer.observe(canvas, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style'] });
    schedule();
  }

  function install() {
    installStyles();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once:true });
    else observe();
  }

  install();
  return Object.freeze({ version:VERSION, install, afterReady:observe, enhance, physicalAssociations, seatSide });
})();

'use strict';
