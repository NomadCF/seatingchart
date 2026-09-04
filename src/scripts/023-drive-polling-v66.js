window.DrivePollingV66 = (() => {
  const STORAGE_KEY = 'classroom-seating-planner-drive-polling-v1';
  let installed = false;
  let timer = null;
  let checking = false;
  let settings = { enabled: false, minutes: 5 };

  function loadSettings() {
    try {
      const parsed = JSON.parse(safeStorageGet('localStorage', STORAGE_KEY) || '{}');
      settings = {
        enabled: Boolean(parsed.enabled),
        minutes: [2, 5, 10, 15, 30].includes(Number(parsed.minutes)) ? Number(parsed.minutes) : 5
      };
    } catch {
      settings = { enabled: false, minutes: 5 };
    }
    return settings;
  }

  function saveSettings() {
    safeStorageSet('localStorage', STORAGE_KEY, JSON.stringify(settings));
  }

  function ensureBanner() {
    let banner = el('remoteDriveChangeBanner');
    if (banner) return banner;
    banner = document.createElement('section');
    banner.id = 'remoteDriveChangeBanner';
    banner.className = 'remote-drive-change-banner no-print';
    banner.hidden = true;
    banner.innerHTML = `
      <div><strong>Remote Google Drive changes are available</strong><span id="remoteDriveChangeText">Another editor saved a newer copy.</span></div>
      <div class="button-row"><button id="reviewRemoteDriveChangeBtn" type="button">Review and merge</button><button id="dismissRemoteDriveChangeBtn" class="secondary" type="button">Dismiss</button></div>`;
    document.body.appendChild(banner);
    el('reviewRemoteDriveChangeBtn')?.addEventListener('click', async () => {
      try {
        banner.hidden = true;
        await SharedDriveCollaborationV64.mergeRemoteDriveChanges({ reason: 'polling-merge' });
        appendLedger('merge', 'Reviewed and merged remote Google Drive changes.');
        scheduleLinkedAutoSave('collaboration-merge-ledger');
      } catch (error) {
        setLiveStatusMessage(`Remote changes could not be merged: ${error.message}`);
        SharedDriveCollaborationV64.openManager();
      }
    });
    el('dismissRemoteDriveChangeBtn')?.addEventListener('click', () => { banner.hidden = true; });
    return banner;
  }

  function appendLedger(type, summary) {
    state.collaborationAccess = normalizeCollaborationAccess(state.collaborationAccess);
    const user = uiState.googleDriveCurrentUser || {};
    const entry = {
      id: uid('collab-log'),
      type: String(type || 'activity').slice(0, 60),
      summary: String(summary || '').slice(0, 500),
      deviceId: appDeviceId(),
      email: String(user.email || '').slice(0, 200),
      displayName: String(user.name || user.displayName || '').slice(0, 120),
      workflow: document.body.dataset.workflow || 'setup',
      activeClassId: state.activeClassId,
      createdAt: new Date().toISOString()
    };
    state.collaborationAccess.changeLedger = [...(state.collaborationAccess.changeLedger || []), entry].slice(-80);
    state.collaborationAccess.updatedAt = entry.createdAt;
    renderLedger();
    return entry;
  }

  function updatePresence({ recordActivity = true } = {}) {
    state.collaborationAccess = normalizeCollaborationAccess(state.collaborationAccess);
    const user = uiState.googleDriveCurrentUser || {};
    state.collaborationAccess.presence = {
      deviceId: appDeviceId(),
      email: String(user.email || '').slice(0, 200),
      displayName: String(user.name || user.displayName || '').slice(0, 120),
      workflow: document.body.dataset.workflow || 'setup',
      activeClassId: state.activeClassId,
      updatedAt: new Date().toISOString()
    };
    state.collaborationAccess.updatedAt = new Date().toISOString();
    if (recordActivity) appendLedger('editing-notice', 'Recorded an editing notice for the shared planner.');
  }

  function renderLedger() {
    const target = el('driveCollaborationLedger');
    if (!target) return;
    const access = normalizeCollaborationAccess(state.collaborationAccess);
    const entries = [...(access.changeLedger || [])].slice(-20).reverse();
    if (!entries.length) {
      target.innerHTML = '<p class="muted">No collaboration activity has been recorded yet.</p>';
      return;
    }
    target.innerHTML = entries.map(entry => {
      const who = entry.displayName || entry.email || (entry.deviceId ? 'Another device' : 'This planner');
      const when = entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Unknown time';
      return `<div class="planning-history-item"><strong>${escapeHtml(entry.summary || entry.type)}</strong><span>${escapeHtml(who)} · ${escapeHtml(when)}</span></div>`;
    }).join('');
  }

  async function checkNow(options = {}) {
    if (checking) return false;
    const config = googleDriveConfig();
    if (!config.fileId || !hasUsableGoogleDriveToken()) {
      if (options.announce !== false) setLiveStatusMessage('Connect and load a Google Drive save before checking for collaborator changes.');
      return false;
    }
    checking = true;
    const status = el('drivePollingStatus');
    if (status) status.textContent = 'Checking the linked Drive file…';
    try {
      const inspection = await SharedDriveCollaborationV64.inspectRemoteDriveChange(config.fileId);
      const changed = Boolean(inspection.remote && !inspection.metadataOnly);
      if (changed) {
        const banner = ensureBanner();
        banner.hidden = false;
        el('remoteDriveChangeText').textContent = `A remote save differs from this tab. Review and merge before continuing to save.`;
        if (status) status.textContent = 'Remote changes found. Review and merge them before saving.';
        appendLedger('remote-change', 'Detected a newer remote Google Drive revision.');
        setLiveStatusMessage('Remote Google Drive changes are available for review and merge.');
      } else {
        if (status) status.textContent = `No remote changes found at ${new Date().toLocaleTimeString()}.`;
        if (options.announce !== false) setLiveStatusMessage('The linked Google Drive save matches this tab.');
      }
      safeStorageSet('sessionStorage', 'classroom-seating-planner-drive-last-check-v1', new Date().toISOString());
      return changed;
    } catch (error) {
      if (status) status.textContent = `Drive check failed: ${error.message}`;
      if (options.announce !== false) setLiveStatusMessage(`Google Drive change check failed: ${error.message}`);
      return false;
    } finally {
      checking = false;
    }
  }

  function schedule() {
    clearInterval(timer);
    timer = null;
    if (!settings.enabled) return;
    timer = setInterval(() => void checkNow({ announce: false }), settings.minutes * 60 * 1000);
  }

  function ensureModal() {
    let modal = el('drivePollingModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'drivePollingModal';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'drivePollingTitle');
    modal.innerHTML = `
      <div class="modal drive-polling-modal"><div class="panel-header"><div><span class="v44-modal-eyebrow">Collaboration without a server</span><h2 id="drivePollingTitle">Near-live Google Drive checks</h2></div><button id="closeDrivePollingBtn" class="secondary mobile-compact-close" type="button" aria-label="Close">Close</button></div><div class="modal-body"><div class="warningbox">This periodically checks the shared Drive file while the planner is open. It provides remote-change notices and three-way merge, not live cursors or instant seat movement.</div><section class="section"><label class="checkline"><input id="drivePollingEnabled" type="checkbox"> Check for remote changes while this page is open</label><div class="field"><label for="drivePollingMinutes">Check interval</label><select id="drivePollingMinutes"><option value="2">Every 2 minutes</option><option value="5">Every 5 minutes</option><option value="10">Every 10 minutes</option><option value="15">Every 15 minutes</option><option value="30">Every 30 minutes</option></select></div><div class="button-row"><button id="saveDrivePollingBtn" type="button">Save collaboration checks</button><button id="checkDriveNowBtn" class="secondary" type="button">Check now</button><button id="openSharedDriveFromPollingBtn" class="secondary" type="button">Open sharing manager</button></div><p id="drivePollingStatus" class="hint">Checks are disabled.</p></section><section class="section"><h3>Shared-file editing notice</h3><p class="muted">The next save records this device’s current workflow and timestamp in the shared planner metadata. Other editors see the information after loading or checking the file.</p><button id="recordDrivePresenceBtn" class="secondary" type="button">Record my editing notice</button></section><section class="section"><h3>Recent collaboration activity</h3><div id="driveCollaborationLedger" class="planning-history-list" aria-live="polite"><p class="muted">No collaboration activity has been recorded yet.</p></div></section></div></div>`;
    document.body.appendChild(modal);
    el('closeDrivePollingBtn')?.addEventListener('click', close);
    el('saveDrivePollingBtn')?.addEventListener('click', () => {
      settings.enabled = Boolean(el('drivePollingEnabled')?.checked);
      settings.minutes = Number(el('drivePollingMinutes')?.value) || 5;
      saveSettings();
      schedule();
      el('drivePollingStatus').textContent = settings.enabled ? `Remote changes will be checked every ${settings.minutes} minutes while this page is open.` : 'Checks are disabled.';
    });
    el('checkDriveNowBtn')?.addEventListener('click', () => void checkNow());
    el('openSharedDriveFromPollingBtn')?.addEventListener('click', () => {
      close();
      SharedDriveCollaborationV64.openManager();
    });
    el('recordDrivePresenceBtn')?.addEventListener('click', () => {
      updatePresence();
      persistActiveClass();
      scheduleLinkedAutoSave('collaboration-presence');
      setLiveStatusMessage('Editing notice recorded. Save the shared Drive file to publish it to collaborators.');
    });
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    return modal;
  }

  function open() {
    loadSettings();
    ensureModal().classList.add('show');
    if (el('drivePollingEnabled')) el('drivePollingEnabled').checked = settings.enabled;
    if (el('drivePollingMinutes')) el('drivePollingMinutes').value = String(settings.minutes);
    const last = safeStorageGet('sessionStorage', 'classroom-seating-planner-drive-last-check-v1');
    if (el('drivePollingStatus')) el('drivePollingStatus').textContent = settings.enabled
      ? `Checks run every ${settings.minutes} minutes.${last ? ` Last checked ${new Date(last).toLocaleString()}.` : ''}`
      : 'Checks are disabled.';
    renderLedger();
    DialogManager.synchronize();
  }

  function close() {
    el('drivePollingModal')?.classList.remove('show');
    DialogManager.synchronize();
  }

  function installEntryPoint() {
    let button = el('openDrivePollingBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'openDrivePollingBtn';
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = 'Drive change checks';
      button.title = 'Periodically check a shared Drive save for remote changes while this page is open.';
      (el('v4MoreMenu') || document.querySelector('.center-panel > .panel-header .button-row'))?.appendChild(button);
      button.addEventListener('click', open);
    }
    const shareGrid = document.querySelector('.v4-share-grid');
    if (shareGrid && !el('drivePollingShareCard')) {
      const card = document.createElement('article');
      card.id = 'drivePollingShareCard';
      card.className = 'v4-share-card';
      card.innerHTML = '<div class="v4-share-icon" aria-hidden="true">↻</div><h3>Shared-file change checks</h3><p>Check a linked Google Drive save for newer collaborator revisions and open the existing merge workflow. No server or live cursor service is required.</p><button type="button" data-open-drive-polling>Configure Drive checks</button>';
      card.querySelector('[data-open-drive-polling]')?.addEventListener('click', open);
      shareGrid.appendChild(card);
    }
  }

  function install() {
    if (installed) return;
    installed = true;
    loadSettings();
    ensureBanner();
    ensureModal();
    window.addEventListener('online', () => { if (settings.enabled) void checkNow({ announce: false }); });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && settings.enabled) void checkNow({ announce: false });
    });
  }

  function afterReady() {
    installEntryPoint();
    schedule();
    if (settings.enabled) setTimeout(() => void checkNow({ announce: false }), 3000);
  }

  return Object.freeze({ install, afterReady, open, checkNow, updatePresence, appendLedger });
})();

'use strict';

