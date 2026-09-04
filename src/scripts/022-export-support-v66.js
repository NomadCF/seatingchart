window.ExportSupportV66 = (() => {
  let installed = false;

  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function csvText(headers, rows) {
    return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  }

  function currentAssignmentRows() {
    const lookups = {
      zones: new Map((state.zones || []).map(zone => [String(zone.id), zone])),
      groups: new Map((state.groups || []).map(group => [String(group.id), group]))
    };
    const rows = [];
    if (state.layoutMode === 'freeform') {
      (state.freeformLayout?.objects || []).filter(object => object.type === 'seat').forEach((object, index) => {
        const student = getStudent(object.assignedStudentId);
        rows.push([
          activeClassName(),
          'Freeform',
          object.label || `Seat ${index + 1}`,
          student?.id || '',
          student ? studentDisplay(student) : '',
          object.locked ? 'Yes' : 'No',
          (object.zoneIds || []).map(id => lookups.zones.get(String(id))?.name || id).join('; '),
          (object.anchorGroupIds || []).map(id => lookups.groups.get(String(id))?.name || id).join('; '),
          object.comment || ''
        ]);
      });
    } else {
      Object.entries(state.cells || {}).filter(([, cell]) => cell.type === 'seat').sort(compareGridCellEntries).forEach(([key, cell]) => {
        const student = getStudent(cell.assignedStudentId);
        rows.push([
          activeClassName(),
          'Grid',
          `Seat ${cell.row},${cell.col} (${key})`,
          student?.id || '',
          student ? studentDisplay(student) : '',
          cell.manual ? 'Yes' : 'No',
          (cell.zoneIds || []).map(id => lookups.zones.get(String(id))?.name || id).join('; '),
          (cell.anchorGroupIds || []).map(id => lookups.groups.get(String(id))?.name || id).join('; '),
          cell.comment || ''
        ]);
      });
    }
    return rows;
  }

  function exportAssignmentsCsv() {
    const headers = ['Class', 'Layout', 'Seat', 'Student ID', 'Student', 'Locked', 'Zones', 'Reserved groups', 'Seat comment'];
    downloadText(`seat-assignments-${new Date().toISOString().slice(0, 10)}.csv`, csvText(headers, currentAssignmentRows()), 'text/csv');
    setLiveStatusMessage('Current seat assignments exported as CSV.');
  }

  function exportViolationsCsv() {
    const headers = ['Class', 'Severity', 'Category', 'Finding ID', 'Students', 'Message'];
    const rows = evaluateCurrentRuleViolations().map(item => [
      activeClassName(),
      item.severity,
      item.category,
      item.id,
      (item.studentIds || []).map(id => studentDisplay(getStudent(id) || { id })).join('; '),
      item.message
    ]);
    downloadText(`seating-rule-findings-${new Date().toISOString().slice(0, 10)}.csv`, csvText(headers, rows), 'text/csv');
    setLiveStatusMessage('Current seating-rule findings exported as CSV.');
  }

  function sanitizedSupportBundle() {
    const settings = pageSettings();
    const audit = typeof window.AppAudit?.read === 'function' ? window.AppAudit.read() : [];
    return {
      format: 'classroom-seating-planner-support-bundle-v1',
      generatedAt: new Date().toISOString(),
      application: {
        name: APP_NAME,
        version: APP_REVISION,
        dataSchemaVersion: DATA_SCHEMA_VERSION,
        encryptionEnvelopeVersion: ENCRYPTION_ENVELOPE_VERSION,
        environment: APP_CONFIG.environment
      },
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        online: navigator.onLine,
        viewport: { width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio }
      },
      workspace: {
        classCount: state.classes?.length || 0,
        activeStudentCount: state.students?.length || 0,
        archivedStudentCount: state.rosterArchive?.length || 0,
        groupCount: state.groups?.length || 0,
        zoneCount: state.zones?.length || 0,
        layoutMode: state.layoutMode,
        grid: { rows: state.rows, cols: state.cols, cellCount: Object.keys(state.cells || {}).length },
        freeformObjectCount: state.freeformLayout?.objects?.length || 0,
        namedPlanCount: state.seatingPlans?.length || 0,
        templateCount: state.roomTemplates?.length || 0,
        ruleFindingCounts: evaluateCurrentRuleViolations().reduce((counts, item) => {
          counts[item.severity] = (counts[item.severity] || 0) + 1;
          return counts;
        }, {})
      },
      capabilities: {
        indexedDb: Boolean(window.indexedDB),
        fileSystemAccess: Boolean(window.showSaveFilePicker),
        clipboardImage: Boolean(navigator.clipboard && window.ClipboardItem),
        serviceWorker: Boolean(navigator.serviceWorker),
        googleDriveConnected: Boolean(googleDriveConfig().accessToken),
        linkedSaveConfigured: Boolean(uiState.linkedSaveHandle)
      },
      safeSettings: {
        theme: settings.theme,
        defaultNamesOnly: settings.defaultNamesOnly,
        autoSaveMinutes: settings.autoSaveMinutes,
        freeformSnapToGrid: settings.freeformSnapToGrid,
        freeformMagneticGuides: settings.freeformMagneticGuides,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      },
      recentActivity: (Array.isArray(audit) ? audit : []).slice(-40).map(item => ({
        time: item.time || item.createdAt || '',
        type: item.type || item.action || '',
        status: item.status || '',
        message: String(item.message || item.summary || '').slice(0, 500)
      })),
      privacyNotice: 'Student names, notes, IDs, assignments, credentials, encryption material, OAuth tokens, and file contents are intentionally omitted.'
    };
  }

  function downloadSupportBundle() {
    downloadText(`classroom-seating-planner-support-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(sanitizedSupportBundle(), null, 2), 'application/json');
    setLiveStatusMessage('Sanitized support bundle downloaded. Student records, notes, credentials, and tokens were excluded.');
  }

  function chartCanvas() {
    const scale = 2;
    const padding = 32;
    let width = 1200;
    let height = 800;
    const seats = [];
    if (state.layoutMode === 'freeform') {
      const canvas = state.freeformLayout?.canvas || {};
      const ratio = Math.min(1, 1200 / Math.max(1, Number(canvas.width) || 1200), 800 / Math.max(1, Number(canvas.height) || 800));
      width = Math.max(500, Math.round((Number(canvas.width) || 1200) * ratio) + padding * 2);
      height = Math.max(350, Math.round((Number(canvas.height) || 800) * ratio) + padding * 2);
      (state.freeformLayout?.objects || []).filter(object => object.type === 'seat').forEach(object => seats.push({
        x: padding + Number(object.x || 0) * ratio,
        y: padding + Number(object.y || 0) * ratio,
        width: Math.max(40, Number(object.width || 160) * ratio),
        height: Math.max(30, Number(object.height || 100) * ratio),
        student: getStudent(object.assignedStudentId),
        label: object.label || '',
        locked: object.locked
      }));
    } else {
      const cellWidth = Math.max(90, Math.min(160, Math.floor((1200 - padding * 2) / Math.max(1, state.cols))));
      const cellHeight = Math.max(70, Math.min(120, Math.floor((800 - padding * 2) / Math.max(1, state.rows))));
      width = padding * 2 + state.cols * cellWidth;
      height = padding * 2 + state.rows * cellHeight;
      Object.values(state.cells || {}).filter(cell => cell.type === 'seat').forEach(cell => seats.push({
        x: padding + (Number(cell.col) - 1) * cellWidth,
        y: padding + (Number(cell.row) - 1) * cellHeight,
        width: cellWidth - 8,
        height: cellHeight - 8,
        student: getStudent(cell.assignedStudentId),
        label: `Seat ${cell.row},${cell.col}`,
        locked: cell.manual
      }));
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    context.scale(scale, scale);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#172033';
    context.font = '700 20px system-ui, sans-serif';
    context.fillText(`${activeClassName()} seating chart`, padding, 23);
    seats.forEach(seat => {
      context.fillStyle = seat.student ? '#e7efff' : '#f8fafc';
      context.strokeStyle = seat.locked ? '#6d28d9' : '#94a3b8';
      context.lineWidth = seat.locked ? 3 : 1;
      context.beginPath();
      if (typeof context.roundRect === 'function') context.roundRect(seat.x, seat.y, seat.width, seat.height, 8);
      else context.rect(seat.x, seat.y, seat.width, seat.height);
      context.fill();
      context.stroke();
      context.fillStyle = '#172033';
      context.font = '700 13px system-ui, sans-serif';
      const title = seat.student ? studentDisplay(seat.student) : seat.label || 'Empty seat';
      const line = title.length > 24 ? `${title.slice(0, 23)}…` : title;
      context.fillText(line, seat.x + 8, seat.y + 23, Math.max(20, seat.width - 16));
    });
    return canvas;
  }

  async function copyChartAsImage() {
    const canvas = chartCanvas();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The browser could not create the chart image.');
    if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setLiveStatusMessage('Seating chart image copied to the clipboard.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seating-chart-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setLiveStatusMessage('Clipboard image copying is unavailable in this browser, so the chart image was downloaded instead.');
  }

  function blankRoomMarkup() {
    if (state.layoutMode === 'freeform') {
      const canvas = state.freeformLayout?.canvas || {};
      const objects = (state.freeformLayout?.objects || []).map(object => `<div class="object ${escapeHtml(object.type)}" style="left:${Number(object.x) || 0}px;top:${Number(object.y) || 0}px;width:${Number(object.width) || 100}px;height:${Number(object.height) || 70}px;transform:rotate(${Number(object.rotation) || 0}deg)">${escapeHtml(object.type === 'seat' ? (object.label || 'Seat') : (object.label || objectLabel(object.type)))}</div>`).join('');
      return `<div class="freeform" style="width:${Number(canvas.width) || 1200}px;height:${Number(canvas.height) || 800}px">${objects}</div>`;
    }
    const cells = [];
    for (let row = 1; row <= state.rows; row += 1) {
      for (let col = 1; col <= state.cols; col += 1) {
        const cell = state.cells[keyOf(row, col)] || { type: 'empty' };
        cells.push(`<div class="cell ${escapeHtml(cell.type)}">${escapeHtml(cell.type === 'seat' ? 'Seat' : objectLabel(cell.type))}</div>`);
      }
    }
    return `<div class="grid" style="grid-template-columns:repeat(${state.cols},110px)">${cells.join('')}</div>`;
  }

  function printBlankRoom() {
    const popup = window.open('', '_blank');
    if (!popup) return setLiveStatusMessage('The browser blocked the printable blank-room window. Allow pop-ups and try again.');
    try { popup.opener = null; } catch {   }
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Blank room layout</title><style>body{font-family:system-ui,sans-serif;margin:24px;color:#172033}h1{font-size:20px}.grid{display:grid;gap:8px}.cell,.object{box-sizing:border-box;border:1px solid #94a3b8;border-radius:8px;display:grid;place-items:center;min-height:70px;background:#fff}.freeform{position:relative;transform-origin:top left;transform:scale(.55);border:1px solid #cbd5e1}.object{position:absolute}.seat{background:#eff6ff}.door{background:#fce8ee}.window{background:#e0f2fe}.teacher{background:#fff3d6}@media print{button{display:none}}</style></head><body><h1>${escapeHtml(activeClassName())} — blank room layout</h1>${blankRoomMarkup()}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),100));<\/script></body></html>`);
    popup.document.close();
  }

  function ensureModal() {
    let modal = el('exportSupportModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'exportSupportModal';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'exportSupportTitle');
    modal.innerHTML = `
      <div class="modal export-support-modal"><div class="panel-header"><div><span class="v44-modal-eyebrow">Export and support</span><h2 id="exportSupportTitle">Data, image, and support tools</h2></div><button id="closeExportSupportBtn" class="secondary mobile-compact-close" type="button" aria-label="Close">Close</button></div><div class="modal-body export-support-grid">
        <article class="workflow-card"><h3>Current assignments CSV</h3><p>Export the current seat, student, lock, zone, group, and seat-comment data.</p><button id="exportAssignmentsCsvBtn" type="button">Export assignments CSV</button></article>
        <article class="workflow-card"><h3>Rule findings CSV</h3><p>Export the current review findings for documentation or follow-up.</p><button id="exportViolationsCsvBtn" type="button">Export rule findings CSV</button></article>
        <article class="workflow-card"><h3>Copy chart as image</h3><p>Copy a clean PNG chart for email or presentations. Unsupported browsers download it instead.</p><button id="copyChartImageBtn" type="button">Copy chart image</button></article>
        <article class="workflow-card"><h3>Printable blank room</h3><p>Print the current room and object layout without student assignments.</p><button id="printBlankRoomBtn" type="button">Print blank layout</button></article>
        <article class="workflow-card"><h3>Sanitized support bundle</h3><p>Download diagnostics without student names, notes, IDs, assignments, credentials, or tokens.</p><button id="downloadSupportBundleBtn" type="button">Download support bundle</button></article>
      </div></div>`;
    document.body.appendChild(modal);
    el('closeExportSupportBtn')?.addEventListener('click', close);
    el('exportAssignmentsCsvBtn')?.addEventListener('click', exportAssignmentsCsv);
    el('exportViolationsCsvBtn')?.addEventListener('click', exportViolationsCsv);
    el('copyChartImageBtn')?.addEventListener('click', () => void copyChartAsImage().catch(error => setLiveStatusMessage(`Chart image could not be copied: ${error.message}`)));
    el('printBlankRoomBtn')?.addEventListener('click', printBlankRoom);
    el('downloadSupportBundleBtn')?.addEventListener('click', downloadSupportBundle);
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    return modal;
  }

  function open() {
    ensureModal().classList.add('show');
    DialogManager.synchronize();
  }

  function close() {
    el('exportSupportModal')?.classList.remove('show');
    DialogManager.synchronize();
  }

  function installEntryPoint() {
    let button = el('openExportSupportBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'openExportSupportBtn';
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = 'Export & support';
      button.title = 'Open CSV, image, blank-layout, and sanitized support exports.';
      (el('v4MoreMenu') || document.querySelector('.center-panel > .panel-header .button-row'))?.appendChild(button);
      button.addEventListener('click', open);
    }
    const shareGrid = document.querySelector('.v4-share-grid');
    if (shareGrid && !el('exportSupportShareCard')) {
      const card = document.createElement('article');
      card.id = 'exportSupportShareCard';
      card.className = 'v4-share-card';
      card.innerHTML = '<div class="v4-share-icon" aria-hidden="true">⇩</div><h3>Data, image, and support exports</h3><p>Export current assignments, rule findings, a chart image, a blank room, or a privacy-sanitized support bundle.</p><button type="button" data-open-export-support>Open export tools</button>';
      card.querySelector('[data-open-export-support]')?.addEventListener('click', open);
      shareGrid.appendChild(card);
    }
  }

  function install() {
    if (installed) return;
    installed = true;
    ensureModal();
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && el('exportSupportModal')?.classList.contains('show')) close();
    });
  }

  function afterReady() {
    installEntryPoint();
  }

  return Object.freeze({
    install,
    afterReady,
    open,
    exportAssignmentsCsv,
    exportViolationsCsv,
    sanitizedSupportBundle,
    currentAssignmentRows,
    csvText,
    chartCanvas,
    copyChartAsImage,
    printBlankRoom
  });
})();

'use strict';

