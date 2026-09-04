const ProductionReadinessV50 = (() => {
  const ACTIVITY_KEY = 'classroom-seating-planner-activity-v6';
  const MAX_ACTIVITY = 200;
  const SENSITIVE_ACTIONS = Object.freeze({
    settingsApplyEncryptionKeyBtn: ['security.encryption-change', 'Encryption password change requested'],
    settingsSaveLockPinBtn: ['security.lock-pin-save', 'Lock PIN save requested'],
    settingsRemoveLockPinBtn: ['security.lock-pin-remove', 'Lock PIN removal requested'],
    settingsSaveVisibilityPinBtn: ['security.eye-pin-save', 'Presentation PIN save requested'],
    settingsRemoveVisibilityPinBtn: ['security.eye-pin-remove', 'Presentation PIN removal requested'],
    clearLocalDataBtn: ['maintenance.clear-local-data', 'Clear local data requested'],
    factoryResetEverythingBtn: ['maintenance.factory-reset', 'Factory reset requested'],
    repairDataIntegrityBtn: ['maintenance.repair', 'Safe data-integrity repair requested'],
    settingsSampleBtn: ['maintenance.sample-data', 'Sample workspace requested'],
    importMappedCsvBtn: ['data.csv-import', 'CSV import requested'],
    applySelectiveRestoreBtn: ['data.restore', 'Selective restore requested'],
    applySnapshotRestoreBtn: ['data.snapshot-restore', 'Snapshot restore requested'],
    requestPersistentStorageBtn: ['storage.persistence', 'Persistent browser storage requested'],
    deploymentDiagnosticsBtn: ['maintenance.diagnostics', 'Deployment diagnostics opened']
  });
  let installed = false;
  let renderedOnce = false;
  let memoryActivity = [];
  let activityStorageAvailable = true;

  function safeJsonParse(value, fallback) {
    try {
      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function sanitizeText(value, max = 500) {
    return String(value ?? '')
      .replace(/(?:file:\/\/|https?:\/\/)[^\s)]+/gi, '[location]')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, max);
  }

  function readActivity() {
    const raw = safeStorageGet('localStorage', ACTIVITY_KEY);
    if (raw !== null) {
      const rows = safeJsonParse(raw, []);
      if (Array.isArray(rows)) {
        memoryActivity = rows.filter(row => row && typeof row === 'object').slice(-MAX_ACTIVITY);
        activityStorageAvailable = true;
        return [...memoryActivity];
      }
    }
    return [...memoryActivity];
  }

  function writeActivity(rows) {
    memoryActivity = rows.slice(-MAX_ACTIVITY);
    activityStorageAvailable = safeStorageSet('localStorage', ACTIVITY_KEY, JSON.stringify(memoryActivity));
  }

  function clearActivityHistorySilently() {
    safeStorageRemove('localStorage', ACTIVITY_KEY);
    memoryActivity = [];
    activityStorageAvailable = true;
    if (renderedOnce) renderActivityLog();
  }

  function record(type, message, status = 'info', details = {}) {
    const rows = readActivity();
    const cleanDetails = {};
    Object.entries(details || {}).forEach(([key, value]) => {
      if (/name|student|note|password|pin|secret|token|key/i.test(key)) return;
      cleanDetails[sanitizeText(key, 60)] = typeof value === 'number' || typeof value === 'boolean'
        ? value
        : sanitizeText(value, 180);
    });
    rows.push({
      id: uid('activity'),
      at: new Date().toISOString(),
      type: sanitizeText(type, 90),
      message: sanitizeText(message, 320),
      status: ['info', 'success', 'warning', 'error'].includes(status) ? status : 'info',
      details: cleanDetails
    });
    writeActivity(rows);
    if (renderedOnce) renderActivityLog();
  }

  function recordError(source, error) {
    const sourceLabel = sanitizeText(source, 60) || 'runtime';
    const errorName = sanitizeText(error?.name || error?.reason?.name || 'Error', 60) || 'Error';
    const errorCode = sanitizeText(error?.code || error?.reason?.code || '', 60);
    record(`error.${sourceLabel}`, `${errorName}${errorCode ? ` (${errorCode})` : ''} occurred. Review the active workflow and retry.`, 'error');
  }

  function activityStatusLabel(status) {
    return ({ success: 'Completed', warning: 'Attention', error: 'Failed', info: 'Recorded' })[status] || 'Recorded';
  }

  function activityRowsHtml(rows) {
    if (!rows.length) return '<div class="restore-empty">No maintenance or security activity has been recorded in this browser yet.</div>';
    return [...rows].reverse().map(row => `
      <article class="v50-activity-row status-${escapeHtml(row.status)}">
        <div class="v50-activity-main">
          <strong>${escapeHtml(row.message)}</strong>
          <span>${escapeHtml(new Date(row.at).toLocaleString())} · ${escapeHtml(row.type)}</span>
        </div>
        <span class="v50-activity-status">${escapeHtml(activityStatusLabel(row.status))}</span>
      </article>`).join('');
  }

  async function systemSummary() {
    let estimate = null;
    let persisted = null;
    try { estimate = await navigator.storage?.estimate?.(); } catch (_) {}
    try { persisted = await navigator.storage?.persisted?.(); } catch (_) {}
    return {
      application: APP_NAME,
      version: APP_REVISION,
      releaseDate: APP_CONFIG.releaseDate,
      buildDate: APP_CONFIG.buildDate,
      commit: APP_CONFIG.commit,
      environment: APP_CONFIG.environment,
      dataSchemaVersion: DATA_SCHEMA_VERSION,
      minimumReaderSchemaVersion: MIN_SUPPORTED_DATA_SCHEMA_VERSION,
      encryptionEnvelopeVersion: ENCRYPTION_ENVELOPE_VERSION,
      browser: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      secureContext: window.isSecureContext,
      serviceWorker: 'serviceWorker' in navigator,
      indexedDB: 'indexedDB' in window,
      storageUsage: Number(estimate?.usage || 0),
      storageQuota: Number(estimate?.quota || 0),
      persistentStorage: persisted,
      localActivityEntries: readActivity().length,
      activityStorageAvailable
    };
  }

  function downloadJson(filename, data) {
    downloadText(filename, JSON.stringify(data, null, 2), 'application/json');
  }

  async function exportDiagnostics() {
    const payload = {
      generatedAt: new Date().toISOString(),
      system: await systemSummary(),
      activity: readActivity()
    };
    downloadJson(`classroom-seating-planner-diagnostics-${new Date().toISOString().slice(0, 10)}.json`, payload);
    record('maintenance.diagnostics-export', 'Privacy-safe diagnostics exported', 'success', { entries: payload.activity.length });
  }

  function clearActivity() {
    showInAppConfirm(
      'Clear the local maintenance and error activity history? This does not change classroom data, saves, or snapshots.',
      () => {
        clearActivityHistorySilently();
        setLiveStatusMessage('Activity history cleared.');
      },
      { title: 'Clear Activity History?', confirmText: 'Clear History', cancelText: 'Cancel' }
    );
  }

  async function renderSystemInfo() {
    const target = el('v50SystemInfo');
    if (!target) return;
    const info = await systemSummary();
    const used = info.storageUsage ? `${Math.round(info.storageUsage / 1048576)} MB` : 'Unavailable';
    const quota = info.storageQuota ? `${Math.round(info.storageQuota / 1048576)} MB` : 'Unavailable';
    const rows = [
      ['Application', `${info.application} ${info.version}`],
      ['Build', `${info.buildDate} · ${info.commit}`],
      ['Data format', `Schema ${info.dataSchemaVersion} · Encryption envelope ${info.encryptionEnvelopeVersion}`],
      ['Secure context', info.secureContext ? 'Yes' : 'No'],
      ['Browser storage', `${used} used of ${quota}`],
      ['Persistent storage', info.persistentStorage === true ? 'Granted' : info.persistentStorage === false ? 'Not granted' : 'Unsupported'],
      ['Service worker', info.serviceWorker ? 'Supported' : 'Unsupported'],
      ['IndexedDB', info.indexedDB ? 'Supported' : 'Unsupported'],
      ['Activity history', info.activityStorageAvailable ? 'Stored in this browser' : 'Available for this session only']
    ];
    target.innerHTML = rows.map(([label, value]) => `<div class="v50-system-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join('');
  }

  function renderActivityLog() {
    renderedOnce = true;
    const target = el('v50ActivityList');
    const count = el('v50ActivityCount');
    const rows = readActivity();
    if (target) target.innerHTML = activityRowsHtml(rows);
    if (count) count.textContent = `${rows.length} local event${rows.length === 1 ? '' : 's'}`;
    void renderSystemInfo();
  }

  function installMaintenanceDom() {
    const panel = document.querySelector('[data-settings-panel="maintenance"]');
    if (!panel || el('v50ProductionReadinessSection')) return;
    const danger = el('settingsDangerZone')?.closest('.settings-section') || el('settingsDangerZone');
    const section = document.createElement('section');
    section.id = 'v50ProductionReadinessSection';
    section.className = 'section settings-section';
    section.innerHTML = `
      <div class="section-header-row">
        <div><h3>System Information &amp; Activity</h3><div id="v50ActivityCount" class="muted">0 local events</div></div>
        <button id="v50RefreshSystemBtn" class="secondary tiny" type="button">Refresh</button>
      </div>
      <div id="v50SystemInfo" class="v50-system-grid" aria-live="polite"></div>
      <div class="hint mini">This browser-only log records maintenance, security, recovery, and application errors without student names, notes, passwords, PINs, encryption keys, or OAuth tokens.</div>
      <div id="v50ActivityList" class="v50-activity-list"></div>
      <div class="button-row">
        <button id="v50ExportDiagnosticsBtn" class="secondary" type="button">Export Diagnostics</button>
        <button id="v50ClearActivityBtn" class="ghost" type="button">Clear Activity History</button>
      </div>`;
    if (danger?.parentElement === panel) panel.insertBefore(section, danger);
    else panel.appendChild(section);
  }

  function updateAboutBuildInfo() {
    const build = `${APP_CONFIG.buildDate} · ${APP_CONFIG.commit} · ${APP_CONFIG.environment}`;
    const schema = `Schema ${DATA_SCHEMA_VERSION} · Encryption envelope ${ENCRYPTION_ENVELOPE_VERSION}`;
    ['aboutBuildInfo', 'settingsBuildInfo'].forEach(id => { if (el(id)) el(id).textContent = build; });
    ['aboutSchemaInfo', 'settingsSchemaInfo'].forEach(id => { if (el(id)) el(id).textContent = schema; });
  }

  function installErrorBoundary() {
    window.addEventListener('error', event => {
      if (!event.error && !event.message) return;
      recordError('runtime', event.error || event.message);
    });
    window.addEventListener('unhandledrejection', event => recordError('promise', event.reason));
  }

  function installSensitiveActionAudit() {
    document.addEventListener('click', event => {
      const button = event.target?.closest?.('button[id]');
      if (!button) return;
      const definition = SENSITIVE_ACTIONS[button.id];
      if (!definition) return;
      record(definition[0], definition[1], 'info');
    }, true);
  }

  function installUpdateNotice() {
    window.addEventListener('planner-update-available', () => {
      record('application.update-available', 'A newer application build is ready', 'info');
      const banner = el('v50UpdateBanner');
      if (banner) banner.hidden = false;
    });
  }

  function buildUpdateBanner() {
    if (el('v50UpdateBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'v50UpdateBanner';
    banner.className = 'v50-update-banner no-print';
    banner.hidden = true;
    banner.setAttribute('role', 'status');
    banner.innerHTML = '<span><strong>Update ready.</strong> Reload when convenient to use the latest planner build.</span><div class="button-row"><button id="v50ReloadUpdateBtn" type="button">Reload</button><button id="v50DismissUpdateBtn" class="ghost" type="button">Later</button></div>';
    document.body.appendChild(banner);
  }

  function openHelpFromModal(modalCloseButtonId, destinationButtonId) {
    el(modalCloseButtonId)?.click();
    setTimeout(() => el(destinationButtonId)?.click(), 0);
  }

  function installEvents() {
    el('v50RefreshSystemBtn')?.addEventListener('click', renderActivityLog);
    el('v50ExportDiagnosticsBtn')?.addEventListener('click', () => void exportDiagnostics());
    el('v50ClearActivityBtn')?.addEventListener('click', clearActivity);
    el('v50ReloadUpdateBtn')?.addEventListener('click', () => {
      const registration = window.__plannerServiceWorkerRegistration;
      if (registration?.waiting) {
        navigator.serviceWorker?.addEventListener?.('controllerchange', () => location.reload(), { once: true });
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        location.reload();
      }
    });
    el('v50DismissUpdateBtn')?.addEventListener('click', () => { if (el('v50UpdateBanner')) el('v50UpdateBanner').hidden = true; });
    el('aboutGettingStartedBtn')?.addEventListener('click', () => {
      el('closeAboutBtn')?.click();
      setTimeout(() => window.GuidedLearning?.startLesson?.('quick-start', 'explain'), 0);
    });
    el('aboutHelpBtn')?.addEventListener('click', () => openHelpFromModal('closeAboutBtn', 'helpGuideBtn'));
    el('settingsAboutGettingStartedBtn')?.addEventListener('click', () => {
      el('closeSettingsBtn')?.click();
      setTimeout(() => window.GuidedLearning?.startLesson?.('quick-start', 'explain'), 0);
    });
    el('settingsAboutHelpBtn')?.addEventListener('click', () => openHelpFromModal('closeSettingsBtn', 'helpGuideBtn'));
    el('settingsHelpGuideBtn')?.addEventListener('click', () => openHelpFromModal('closeSettingsBtn', 'helpGuideBtn'));
  }

  function install() {
    if (installed) return;
    installed = true;
    document.body.classList.add('product-v50');
    document.body.dataset.productExperience = '5.0';
    installMaintenanceDom();
    buildUpdateBanner();
    updateAboutBuildInfo();
    installErrorBoundary();
    installSensitiveActionAudit();
    installUpdateNotice();
    installEvents();
    window.AppAudit = Object.freeze({
      record,
      recordError,
      read: readActivity,
      render: renderActivityLog,
      clearForFactoryReset: clearActivityHistorySilently
    });
  }

  function afterReady() {
    updateAboutBuildInfo();
    renderActivityLog();
    record('application.start', `${APP_NAME} ${APP_REVISION} started`, 'success', {
      schema: DATA_SCHEMA_VERSION,
      environment: APP_CONFIG.environment
    });
  }

  return Object.freeze({ install, afterReady, record, recordError, renderActivityLog, systemSummary, clearForFactoryReset: clearActivityHistorySilently });
})();

