const WorkflowExpansion = (() => {
  function addonDefaults() {
    return {
      noteRevealTimeoutSeconds: 30,
      noteRevealHideOnBlur: true,
      snapshotRetention: 50,
      privacyDisplayMode: 'teacher',
      csvDuplicateMode: 'update',
      csvSnapshotBeforeImport: true,
      printSecurityWarnings: true,
      exportSecurityWarnings: true,
      reencryptSnapshotsOnPasswordChange: true
    };
  }

  function normalizeAddonSettings(source = {}) {
    const defaults = addonDefaults();
    const mode = ['teacher','substitute','student','admin','privacy'].includes(source.privacyDisplayMode) ? source.privacyDisplayMode : defaults.privacyDisplayMode;
    return {
      noteRevealTimeoutSeconds: clampNumber(source.noteRevealTimeoutSeconds ?? defaults.noteRevealTimeoutSeconds, 0, 600),
      noteRevealHideOnBlur: source.noteRevealHideOnBlur ?? defaults.noteRevealHideOnBlur,
      snapshotRetention: clampNumber(source.snapshotRetention ?? defaults.snapshotRetention, 5, 200),
      privacyDisplayMode: mode,
      csvDuplicateMode: ['update','skip','create'].includes(source.csvDuplicateMode) ? source.csvDuplicateMode : defaults.csvDuplicateMode,
      csvSnapshotBeforeImport: source.csvSnapshotBeforeImport ?? defaults.csvSnapshotBeforeImport,
      printSecurityWarnings: source.printSecurityWarnings ?? defaults.printSecurityWarnings,
      exportSecurityWarnings: source.exportSecurityWarnings ?? defaults.exportSecurityWarnings,
      reencryptSnapshotsOnPasswordChange: source.reencryptSnapshotsOnPasswordChange ?? defaults.reencryptSnapshotsOnPasswordChange
    };
  }

  function mergePageSettings(value) {
    const base = mergePageSettingsCore(value);
    return { ...base, ...normalizeAddonSettings(value || {}) };
  }

  function checked(id) { return !!el(id)?.checked; }
  function valueOf(id) { return el(id)?.value; }

  function updateAddonSettingsForm() {
    const cfg = pageSettings();
    setControlValue('settingPrivacyDisplayMode', cfg.privacyDisplayMode || 'teacher');
    setControlValue('settingNoteRevealTimeoutSeconds', cfg.noteRevealTimeoutSeconds ?? 30);
    setControlChecked('settingNoteRevealHideOnBlur', cfg.noteRevealHideOnBlur);
    setControlValue('settingSnapshotRetention', cfg.snapshotRetention ?? 50);
    setControlValue('settingCsvDuplicateMode', cfg.csvDuplicateMode || 'update');
    setControlChecked('settingCsvSnapshotBeforeImport', cfg.csvSnapshotBeforeImport);
    setControlChecked('settingPrintSecurityWarnings', cfg.printSecurityWarnings);
    setControlChecked('settingExportSecurityWarnings', cfg.exportSecurityWarnings);
    setControlChecked('settingsReencryptAllSnapshots', cfg.reencryptSnapshotsOnPasswordChange);
    updateLockWorkflowReadiness();
    renderSaveHealthReport(false);
  }

  function readAddonSettingsForm() {
    const current = mergePageSettings(uiState.pageSettings);
    uiState.pageSettings = mergePageSettings({
      ...current,
      noteRevealTimeoutSeconds: valueOf('settingNoteRevealTimeoutSeconds') ?? current.noteRevealTimeoutSeconds,
      noteRevealHideOnBlur: el('settingNoteRevealHideOnBlur') ? checked('settingNoteRevealHideOnBlur') : current.noteRevealHideOnBlur,
      snapshotRetention: valueOf('settingSnapshotRetention') ?? current.snapshotRetention,
      privacyDisplayMode: valueOf('settingPrivacyDisplayMode') || current.privacyDisplayMode,
      csvDuplicateMode: valueOf('settingCsvDuplicateMode') || current.csvDuplicateMode,
      csvSnapshotBeforeImport: el('settingCsvSnapshotBeforeImport') ? checked('settingCsvSnapshotBeforeImport') : current.csvSnapshotBeforeImport,
      printSecurityWarnings: el('settingPrintSecurityWarnings') ? checked('settingPrintSecurityWarnings') : current.printSecurityWarnings,
      exportSecurityWarnings: el('settingExportSecurityWarnings') ? checked('settingExportSecurityWarnings') : current.exportSecurityWarnings,
      reencryptSnapshotsOnPasswordChange: el('settingsReencryptAllSnapshots') ? checked('settingsReencryptAllSnapshots') : current.reencryptSnapshotsOnPasswordChange
    });
  }

  function updatePageSettingsForm() {
    updatePageSettingsFormCore();
    updateAddonSettingsForm();
  }

  function readPageSettingsForm() {
    readPageSettingsFormCore();
    readAddonSettingsForm();
    trimSnapshotsToRetention();
    updateLockWorkflowReadiness();
  }

  function settingsTabHtml(id, title, desc) {
    return `<button id="settingsPage${id[0].toUpperCase()+id.slice(1)}Btn" class="settings-page-tab" type="button" role="tab" aria-selected="false" aria-controls="settingsPage${id[0].toUpperCase()+id.slice(1)}" data-settings-nav="${id}"><span class="settings-page-title">${escapeHtml(title)}</span><span class="settings-page-desc">${escapeHtml(desc)}</span></button>`;
  }

  function panelHeader(title, text) {
    return `<div class="settings-page-header"><strong>${escapeHtml(title)}</strong>${escapeHtml(text)}</div>`;
  }

  function installSettingsExpansionDom() {
    const nav = el('settingsPageNav');
    const content = document.querySelector('.settings-page-content');
    if (!nav || !content || el('settingsSearchInput')) return;
    nav.insertAdjacentHTML('beforebegin', `<div class="settings-search-shell"><div class="settings-search-field"><label for="settingsSearchInput">Search Settings</label><input id="settingsSearchInput" type="search" autocomplete="off" placeholder="Search encryption, lock, notes, snapshots, import, print, repair..." /></div><div class="settings-mobile-page-picker"><label for="settingsMobilePageSelect">Settings page</label><select id="settingsMobilePageSelect" aria-label="Choose a Settings page"></select></div><div id="settingsSearchSummary" class="muted">Type to filter Settings sections.</div></div>`);
    const aboutTab = el('settingsPageAboutBtn');
    const tabs = [
      ['privacy','Privacy Views','Teacher, substitute, student, admin, and initials-only display modes.'],
      ['snapshots','Snapshots','Timeline, preview, retention, and restore workflow.'],
      ['import','Import','CSV mapping, duplicate behavior, and import safety options.'],
      ['maintenance','Maintenance','Sample data, diagnostics, save health, cleanup, and reset.']
    ];
    tabs.forEach(([id,title,desc]) => { if (!document.querySelector(`[data-settings-nav="${id}"]`)) aboutTab?.insertAdjacentHTML('beforebegin', settingsTabHtml(id,title,desc)); });
    refreshSettingsMobilePageSelect();
    el('settingsMobilePageSelect')?.addEventListener('change', event => setSettingsPage(event.target.value));
    const aboutPanel = el('settingsPageAbout');
    const panels = `
          <div id="settingsPagePrivacy" class="settings-page" role="tabpanel" data-settings-panel="privacy" aria-label="Privacy Views settings">
            ${panelHeader('Privacy display modes','Choose the basic names and detail level used by Presentation Mode and print-facing behavior. Presentation Mode itself is always a locked Review workspace; these profiles do not weaken its editing restrictions.')}
            <section class="section settings-section"><h3>Display Profile</h3>
              <div class="field"><label for="settingPrivacyDisplayMode">Privacy display mode</label><select id="settingPrivacyDisplayMode"><option value="teacher">Teacher Full View</option><option value="substitute">Substitute View</option><option value="student">Student Display View</option><option value="admin">Admin Review View</option><option value="privacy">Privacy Mode / Initials Only</option></select></div>
              <div class="privacy-mode-buttons"><button type="button" class="secondary" data-apply-privacy-mode="teacher">Teacher Full View<br><span class="muted">Everything visible while unlocked.</span></button><button type="button" class="secondary" data-apply-privacy-mode="substitute">Substitute View<br><span class="muted">Sub/public notes only, editing blocked.</span></button><button type="button" class="secondary" data-apply-privacy-mode="student">Student Display<br><span class="muted">Names/nicknames only, no notes.</span></button><button type="button" class="secondary" data-apply-privacy-mode="admin">Admin Review<br><span class="muted">Details visible, private notes still reveal-only.</span></button><button type="button" class="secondary" data-apply-privacy-mode="privacy">Initials Only<br><span class="muted">Hide details and force names-only display.</span></button></div>
              <div class="hint">Applying a privacy view changes the allowed names, group details, print availability, and room-header details inside Presentation Mode. The mode remains locked and still requires its PIN/encryption workflow to enter or exit.</div>
            </section>
            <section class="section settings-section"><h3>Private/Substitute Note Reveal Timeout</h3><div class="field"><label for="settingNoteRevealTimeoutSeconds">Hide revealed non-public notes after seconds</label><input id="settingNoteRevealTimeoutSeconds" type="number" min="0" max="600" step="5" /></div><label class="checkline"><input id="settingNoteRevealHideOnBlur" type="checkbox" /> <span>Hide revealed notes when the browser loses focus or the tab becomes hidden</span></label><div class="hint">Use 0 to keep revealed notes visible until the note editor closes. Public notes are not affected.</div></section>
            <section class="section settings-section"><h3>Print / Export Warnings</h3><label class="checkline"><input id="settingPrintSecurityWarnings" type="checkbox" /> <span>Warn before print/PDF/SVG when private notes, substitute notes, IDs, grade, or group/zone details are included</span></label><label class="checkline"><input id="settingExportSecurityWarnings" type="checkbox" /> <span>Warn before encrypted exports that include student records, notes, snapshots, or room metadata</span></label></section>
          </div>
          <div id="settingsPageSnapshots" class="settings-page" role="tabpanel" data-settings-panel="snapshots" aria-label="Snapshot settings">
            ${panelHeader('Snapshot timeline','Snapshots are encrypted with the active session password. Restores save a return point first so users can roll forward again.')}
            <section class="section settings-section"><h3>Snapshot Timeline</h3><div class="field"><label for="settingSnapshotRetention">Keep most recent snapshots</label><input id="settingSnapshotRetention" type="number" min="5" max="200" step="5" /></div><div class="button-row"><button id="openSnapshotTimelineBtn" type="button">Open Snapshot Timeline</button><button id="trimSnapshotsNowBtn" class="secondary" type="button">Apply Retention Now</button></div><div class="hint">Retention trims the encrypted local snapshot index and payload list. Downloaded backups are not changed.</div></section>
          </div>
          <div id="settingsPageImport" class="settings-page" role="tabpanel" data-settings-panel="import" aria-label="Import settings">
            ${panelHeader('Import workflow','CSV imports now include duplicate behavior, preview, optional before-import snapshot, and mapping guidance.')}
            <section class="section settings-section"><h3>CSV Import Defaults</h3><div class="field"><label for="settingCsvDuplicateMode">When imported students match existing ID or name</label><select id="settingCsvDuplicateMode"><option value="update">Update existing matching student</option><option value="skip">Skip matching students</option><option value="create">Create a new student anyway</option></select></div><label class="checkline"><input id="settingCsvSnapshotBeforeImport" type="checkbox" /> <span>Create a snapshot before CSV import</span></label><div class="hint">The import wizard still shows a preview before applying changes. This setting controls what happens to duplicates after the user confirms import.</div></section>
          </div>
          <div id="settingsPageMaintenance" class="settings-page" role="tabpanel" data-settings-panel="maintenance" aria-label="Maintenance settings">
            ${panelHeader('Maintenance and data integrity','Load a safe sample workspace, check browser storage, repair data, and keep destructive actions fenced off.')}
            <section class="section settings-section"><h3>Save Health Check</h3><div class="button-row"><button id="runSaveHealthCheckBtn" type="button">Check Save Health</button><button id="repairDataIntegrityBtn" class="secondary" type="button">Repair Safe Issues</button></div><div id="saveHealthReport" class="save-health-report"><div class="health-finding warn">Run a check to review encryption, snapshots, IDs, seat assignments, groups, zones, and settings.</div></div></section>
            <section id="settingsMaintenanceTools" class="section settings-section"><h3>Sample Workspace &amp; Diagnostics</h3><div class="hint">Sample data is for learning and demonstrations. Loading it replaces the current class after confirmation. Diagnostics review browser storage, deployment support, and save capabilities without changing classroom data.</div><div id="maintenanceToolSlot" class="button-row"></div></section>
            <section id="settingsDangerZone" class="section settings-section danger-zone"><h3>Danger Zone</h3><div class="hint">These actions erase or reset local browser data. They do not decrypt or recover old backups, and they do not change files already downloaded elsewhere.</div><div id="dangerZoneButtonSlot" class="button-row"></div></section>
          </div>`;
    aboutPanel?.insertAdjacentHTML('beforebegin', panels);
    ['privacy','snapshots','import','maintenance'].forEach(id => { if (!SETTINGS_PAGE_IDS.includes(id)) SETTINGS_PAGE_IDS.splice(Math.max(0, SETTINGS_PAGE_IDS.indexOf('about')), 0, id); });
    const clearBtn = el('clearLocalDataBtn');
    const factoryBtn = el('factoryResetEverythingBtn');
    const diagnosticsBtn = el('deploymentDiagnosticsBtn');
    const sampleBtn = el('settingsSampleBtn');
    const sampleSection = sampleBtn?.closest('.settings-section');
    const maintenanceTools = el('maintenanceToolSlot');
    if (maintenanceTools) {
      if (sampleBtn) maintenanceTools.appendChild(sampleBtn);
      if (diagnosticsBtn) maintenanceTools.appendChild(diagnosticsBtn);
    }
    if (sampleSection && !sampleSection.querySelector('button')) sampleSection.remove();
    const slot = el('dangerZoneButtonSlot');
    if (slot) { if (clearBtn) slot.appendChild(clearBtn); if (factoryBtn) slot.appendChild(factoryBtn); }
    const statusPanel = el('securityStatusPanel');
    if (statusPanel && !el('securitySetupWizardOpenBtn')) {
      statusPanel.closest('section')?.insertAdjacentHTML('beforebegin', `<section class="section settings-section"><h3>Security Guided Help</h3><div class="hint">Walk through encryption, Settings access, Lock PIN, Presentation PIN, auto-lock, and security status in one guided sequence.</div><div class="button-row"><button id="securitySetupWizardOpenBtn" type="button">Open Security Guided Help</button></div></section>`);
      statusPanel.closest('section')?.insertAdjacentHTML('afterend', `<section class="section settings-section"><h3>Lock Workflow Readiness</h3><div id="lockWorkflowReadiness" class="save-health-report"></div></section>`);
    }
    const saveEncryptionCard = el('settingsApplyEncryptionKeyBtn')?.closest('.security-card') || el('settingsEncryptionKey')?.closest('.security-card');
    if (saveEncryptionCard && !el('settingsReencryptAllSnapshots')) {
      saveEncryptionCard.insertAdjacentHTML('beforeend', `<label class="checkline"><input id="settingsReencryptAllSnapshots" type="checkbox" checked /> <span>Re-encrypt local snapshots with the new password when possible</span></label><div class="setting-inline-warning">Changing the encryption password updates the current browser save and future saves. Older downloaded files still need their original password. Local snapshots can be re-encrypted only when they decrypt with the current active password.</div>`);
    }
  }

  function installStandaloneModals() {
    if (!el('securitySetupWizardModal')) {
      document.body.insertAdjacentHTML('beforeend', `<div id="securitySetupWizardModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="securitySetupWizardTitle"><div class="modal workflow-modal security-setup-modal"><div class="panel-header"><h2 id="securitySetupWizardTitle">Security Guided Help</h2><button id="closeSecuritySetupWizardBtn" class="tiny secondary" type="button">Close</button></div><div class="modal-body security-wizard-layout"><div id="securityWizardSteps" class="workflow-stepper"></div><div class="security-wizard-actions"><div id="securityWizardMessage" class="muted" aria-live="polite">Valid security options auto-save. The Save button is still available for a manual save.</div><div class="button-row"><button id="securityWizardRefreshBtn" class="secondary" type="button">Refresh Status</button><button id="securityWizardSaveBtn" type="button">Save Security Setup</button><button id="securityWizardDoneBtn" class="secondary" type="button">Done</button></div></div></div></div></div>`);
    }
    if (!el('snapshotPreviewModal')) {
      document.body.insertAdjacentHTML('beforeend', `<div id="snapshotPreviewModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="snapshotPreviewTitle"><div class="modal workflow-modal"><div class="panel-header"><h2 id="snapshotPreviewTitle">Snapshot Preview</h2><button id="closeSnapshotPreviewBtn" class="tiny secondary" type="button">Close</button></div><div id="snapshotPreviewBody" class="modal-body"></div></div></div>`);
    }
    if (!el('undoHistoryModal')) {
      document.body.insertAdjacentHTML('beforeend', `<div id="undoHistoryModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="undoHistoryTitle"><div class="modal workflow-modal"><div class="panel-header"><h2 id="undoHistoryTitle">Undo / Redo History</h2><button id="closeUndoHistoryBtn" class="tiny secondary" type="button">Close</button></div><div class="modal-body"><div class="hint">This panel shows recent edit checkpoints captured during this browser session. It is not a replacement for encrypted snapshots.</div><div id="undoHistoryList" class="history-list"></div><div class="button-row" style="margin-top:10px;"><button id="undoHistoryUndoBtn" class="secondary" type="button">Undo Last</button><button id="undoHistoryRedoBtn" class="secondary" type="button">Redo Last</button></div></div></div></div>`);
    }
  }

  function installWelcomeAndHeaderExtras() {
    const redo = el('redoBtn');
    if (redo && !el('undoHistoryBtn')) redo.insertAdjacentHTML('afterend', `<button id="undoHistoryBtn" class="secondary icon-button" type="button" aria-label="Undo history" title="Open Undo / Redo history">↕</button>`);
  }

  function installCsvWizardExtras() {
    const body = el('csvMappingFields')?.closest('.modal-body');
    if (!body || el('csvWizardStage')) return;
    const hint = body.querySelector('.hint');
    hint?.insertAdjacentHTML('afterend', `<div id="csvWizardStage" class="csv-wizard-stage">Step 1 of 4: Map columns, preview rows, choose duplicate handling, then import.</div><div class="settings-grid two-col"><div class="field"><label for="csvImportDuplicateMode">Duplicate handling for this import</label><select id="csvImportDuplicateMode"><option value="update">Update matching existing students</option><option value="skip">Skip matching students</option><option value="create">Create a new student anyway</option></select></div><label class="checkline" style="align-self:end;"><input id="csvImportSnapshotBefore" type="checkbox" /> <span>Snapshot before import</span></label></div>`);
  }

  function installWorkflowDom() {
    installSettingsExpansionDom();
    installStandaloneModals();
    installWelcomeAndHeaderExtras();
    installCsvWizardExtras();
  }

  function securityWizardMessage(message = '') {
    const node = el('securityWizardMessage');
    if (node) node.textContent = message || 'Valid security options auto-save. The Save button is still available for a manual save.';
  }

  function settingsAccessOptionsHtml(current) {
    const options = [
      ['auto', 'Auto: Lock PIN → Presentation PIN → Encryption key'],
      ['lock', 'Lock/Unlock PIN only'],
      ['eye', 'Presentation Mode PIN only'],
      ['encryption', 'Encryption key only'],
      ['none', 'No prompt / unlocked Settings']
    ];
    return options.map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
  }

  function wizardPinEntryStatus(prefix, existing) {
    const pin = String(el(prefix)?.value || '');
    const confirm = String(el(`${prefix}Confirm`)?.value || '');
    const hasEntry = !!(pin || confirm);
    const valid = hasEntry && !newLocalCredentialValidationMessage(pin) && pin === confirm;
    return { hasEntry, valid, done: !!existing || valid };
  }

  function securityWizardCurrentState() {
    const cfg = pageSettings();
    const requestedAccess = String(el('securityWizardSettingsAccessMethod')?.value || cfg.settingsAccessMethod || 'auto');
    const lockState = wizardPinEntryStatus('securityWizardLockPin', getLockCredential());
    const eyeState = wizardPinEntryStatus('securityWizardEyePin', getVisibilityCredential());
    const autoMinutes = clampNumber(el('securityWizardAutoLockMinutes')?.value ?? cfg.autoLockMinutes ?? 0, 0, 240);
    const onBlur = el('securityWizardAutoLockOnBlur') ? !!el('securityWizardAutoLockOnBlur').checked : !!cfg.autoLockOnBlur;
    const onHidden = el('securityWizardAutoLockOnTabHidden') ? !!el('securityWizardAutoLockOnTabHidden').checked : !!cfg.autoLockOnTabHidden;
    const returnMinutes = clampNumber(el('securityWizardAutoLockOnReturnMinutes')?.value ?? cfg.autoLockOnReturnMinutes ?? 0, 0, 240);
    const accessLabels = {
      auto: 'Auto: Lock PIN → Presentation PIN → Encryption key',
      lock: 'Lock/Unlock PIN only',
      eye: 'Presentation Mode PIN only',
      encryption: 'Encryption key only',
      none: 'No prompt / unlocked Settings'
    };
    const activeKey = !!currentSessionEncryptionKey();
    const localStorageEncrypted = supportedStoredPayloadIsEncrypted(safeStorageGet('localStorage', STORAGE_KEY), APP_PRIMARY_SAVE_KEY);
    const snapshotRaw = safeStorageGet('localStorage', LOCAL_AUTOSAVE_SNAPSHOT_KEY);
    const snapshotStorageEncrypted = !snapshotRaw || supportedStoredPayloadIsEncrypted(snapshotRaw, APP_SNAPSHOT_INDEX_KEY, 'snapshot-index');
    const storageEncrypted = localStorageEncrypted && snapshotStorageEncrypted;
    const autoLock = autoMinutes > 0 || onBlur || onHidden || returnMinutes > 0;
    return [
      { key:'encryption', title:'Encryption password', done:activeKey, warn:!activeKey, text: activeKey ? 'Active session encryption key is present.' : 'Create or enter the encryption password before continuing.', staticOnly:true },
      { key:'settings', title:'Settings access requirement', done:requestedAccess !== 'none', warn:requestedAccess === 'none', text: requestedAccess === 'none' ? 'Settings will open without a prompt. Save only if this is intentional.' : `Settings will require: ${accessLabels[requestedAccess] || accessLabels.auto}.`, body:'settings' },
      { key:'lock', title:'Lock PIN/password', done:lockState.done, warn:!lockState.done, text: lockState.valid ? 'Ready to save a valid Lock PIN/password.' : (getLockCredential() ? 'Lock PIN/password is already set.' : `Enter matching Lock PIN/password values with at least ${MIN_LOCAL_CREDENTIAL_LENGTH} characters.`), body:'lock' },
      { key:'eye', title:'Presentation Mode PIN/password', done:eyeState.done, warn:!eyeState.done, text: eyeState.valid ? 'Ready to save a valid Presentation Mode PIN/password.' : (getVisibilityCredential() ? 'Presentation Mode PIN/password is already set.' : `Enter matching Presentation Mode PIN/password values with at least ${MIN_LOCAL_CREDENTIAL_LENGTH} characters.`), body:'eye' },
      { key:'autolock', title:'Auto-lock rules', done:autoLock, warn:!autoLock, text: autoLock ? 'At least one auto-lock trigger is configured.' : 'No auto-lock triggers are enabled yet.', body:'autolock' },
      { key:'storage', title:'Storage encryption', done:storageEncrypted, warn:!storageEncrypted, text: storageEncrypted ? 'Local browser save and snapshot index are encrypted or empty.' : 'Save once after setup to encrypt current browser storage.', staticOnly:true }
    ];
  }

  function securityWizardSummaryHtml(step, index) {
    const num = step.done ? '✓' : index;
    return `<summary class="security-wizard-check-summary"><div class="security-wizard-check-number">${escapeHtml(num)}</div><div><div class="security-wizard-check-title">${escapeHtml(step.title)}</div><div class="security-wizard-check-text">${escapeHtml(step.text)}</div></div>${step.staticOnly ? '<span class="security-wizard-expand">Status</span>' : '<span class="security-wizard-expand">Click to configure</span>'}</summary>`;
  }

  function securityWizardBodyHtml(kind, cfg) {
    if (kind === 'settings') {
      return `<div class="security-wizard-check-body"><div class="field"><label for="securityWizardSettingsAccessMethod">Require before Settings opens</label><select id="securityWizardSettingsAccessMethod">${settingsAccessOptionsHtml(cfg.settingsAccessMethod || 'auto')}</select></div><div class="setting-inline-warning">Choosing <strong>No prompt</strong> means anyone with the unlocked page can change security, save/export, Presentation Mode, and reset settings. The app will ask for confirmation before applying that.</div></div>`;
    }
    if (kind === 'lock') {
      return `<div class="security-wizard-check-body"><div class="security-card"><h4>Lock / Unlock PIN</h4><div class="field"><label for="securityWizardLockPin">New lock PIN/password</label><input id="securityWizardLockPin" type="password" autocomplete="new-password" placeholder="Leave blank to keep current PIN" /></div><div class="field"><label for="securityWizardLockPinConfirm">Confirm lock PIN/password</label><input id="securityWizardLockPinConfirm" type="password" autocomplete="new-password" /></div><div class="muted">Used for normal lock/unlock and auto-lock restore during this page session.</div></div></div>`;
    }
    if (kind === 'eye') {
      return `<div class="security-wizard-check-body"><div class="security-card"><h4>Presentation Mode Exit PIN</h4><div class="field"><label for="securityWizardEyePin">New Presentation Mode PIN/password</label><input id="securityWizardEyePin" type="password" autocomplete="new-password" placeholder="Leave blank to keep current PIN" /></div><div class="field"><label for="securityWizardEyePinConfirm">Confirm Presentation Mode PIN/password</label><input id="securityWizardEyePinConfirm" type="password" autocomplete="new-password" /></div><div class="muted">Used to exit Presentation Mode without needing the full encryption password.</div></div></div>`;
    }
    if (kind === 'autolock') {
      return `<div class="security-wizard-check-body"><div class="auto-lock-grid"><div class="auto-lock-card"><label for="securityWizardAutoLockMinutes">Auto-lock after inactive minutes</label><input id="securityWizardAutoLockMinutes" type="number" min="0" max="240" step="1" value="${escapeHtml(cfg.autoLockMinutes || 0)}" /><div class="muted">Use 0 to disable inactivity auto-lock.</div></div><label class="checkline auto-lock-card" for="securityWizardAutoLockOnBlur"><input id="securityWizardAutoLockOnBlur" type="checkbox" ${cfg.autoLockOnBlur ? 'checked' : ''} /> <span>Lock immediately when this window loses focus</span></label><label class="checkline auto-lock-card" for="securityWizardAutoLockOnTabHidden"><input id="securityWizardAutoLockOnTabHidden" type="checkbox" ${cfg.autoLockOnTabHidden ? 'checked' : ''} /> <span>Lock immediately when this tab becomes hidden/inactive</span></label><div class="auto-lock-card"><label for="securityWizardAutoLockOnReturnMinutes">Lock when returning after inactive minutes</label><input id="securityWizardAutoLockOnReturnMinutes" type="number" min="0" max="240" step="1" value="${escapeHtml(cfg.autoLockOnReturnMinutes || 0)}" /><div class="muted">Example: set 10 so returning after 10+ hidden minutes locks immediately.</div></div></div></div>`;
    }
    return '<div class="security-wizard-check-body"><div class="muted">Status only.</div></div>';
  }

  function updateSecurityWizardLiveStatus() {
    const box = el('securityWizardSteps');
    if (!box) return;
    const steps = securityWizardCurrentState();
    steps.forEach((step, idx) => {
      const row = box.querySelector(`[data-security-check="${step.key}"]`);
      if (!row) return;
      row.classList.toggle('done', !!step.done);
      row.classList.toggle('warn', !!step.warn);
      const number = row.querySelector('.security-wizard-check-number');
      const text = row.querySelector('.security-wizard-check-text');
      if (number) number.textContent = step.done ? '✓' : String(idx + 1);
      if (text) text.textContent = step.text;
    });
  }

  function renderSecuritySetupWizard(openKey = '') {
    const box = el('securityWizardSteps');
    if (!box) return;
    const cfg = pageSettings();
    const steps = securityWizardCurrentState();
    box.innerHTML = `
          <div class="security-wizard-intro"><strong>Step 2: Finish security setup.</strong> The encryption password is already active. Open one row at a time; valid changes auto-save to encrypted browser storage. The status circles update as soon as typed values are valid.</div>
          <div class="security-wizard-checklist">
            ${steps.map((step, idx) => `<details class="security-wizard-check ${step.done ? 'done' : step.warn ? 'warn' : ''} ${step.staticOnly ? 'security-wizard-static-status' : ''}" data-security-check="${escapeHtml(step.key)}" ${openKey && openKey === step.key ? 'open' : ''}>${securityWizardSummaryHtml(step, idx + 1)}${securityWizardBodyHtml(step.body, cfg)}</details>`).join('')}
          </div>`;
    securityWizardMessage();
  }

  function securityWizardOpenKey() {
    return document.querySelector('#securityWizardSteps details[open]')?.getAttribute('data-security-check') || '';
  }

  function securityWizardCanAutoApply() {
    const lockState = wizardPinEntryStatus('securityWizardLockPin', getLockCredential());
    const eyeState = wizardPinEntryStatus('securityWizardEyePin', getVisibilityCredential());
    if (lockState.hasEntry && !lockState.valid) return false;
    if (eyeState.hasEntry && !eyeState.valid) return false;
    return true;
  }

  let securityWizardAutoSaveTimer = 0;
  let securityWizardSuppressAutosave = false;
  let securityWizardConfirmingSettingsNone = false;

  function scheduleSecurityWizardAutosave() {
    if (!el('securitySetupWizardModal')?.classList.contains('show')) return;
    updateSecurityWizardLiveStatus();
    if (!securityWizardCanAutoApply()) {
      securityWizardMessage('Complete matching PIN/password fields before auto-save runs.');
      return;
    }
    window.clearTimeout(securityWizardAutoSaveTimer);
    securityWizardAutoSaveTimer = window.setTimeout(() => {
      if (securityWizardSuppressAutosave) return;
      void applySecuritySetupWizard({ silent: true, preserveOpen: true }).catch(err => securityWizardMessage(err.message || 'Could not auto-save security setup.'));
    }, 650);
  }

  async function applySecuritySetupWizard(options = {}) {
    const cfg = pageSettings();
    const opts = options || {};
    const requestedAccess = String(el('securityWizardSettingsAccessMethod')?.value || cfg.settingsAccessMethod || 'auto');
    const applyCoreSettings = async () => {
      const lockPin = String(el('securityWizardLockPin')?.value || '');
      const lockConfirm = String(el('securityWizardLockPinConfirm')?.value || '');
      const eyePin = String(el('securityWizardEyePin')?.value || '');
      const eyeConfirm = String(el('securityWizardEyePinConfirm')?.value || '');
      if (lockPin || lockConfirm) {
        const lockValidationMessage = newLocalCredentialValidationMessage(lockPin, 'Lock PIN/password');
        if (lockValidationMessage) throw new Error(lockValidationMessage);
        if (lockPin !== lockConfirm) throw new Error('Lock PIN/password entries do not match.');
        await savePageLockCredential(lockPin);
        cachePageLockSecretForSession(lockPin);
      }
      if (eyePin || eyeConfirm) {
        const eyeValidationMessage = newLocalCredentialValidationMessage(eyePin, 'Presentation Mode PIN/password');
        if (eyeValidationMessage) throw new Error(eyeValidationMessage);
        if (eyePin !== eyeConfirm) throw new Error('Presentation Mode PIN/password entries do not match.');
        await saveVisibilityCredential(eyePin);
      }
      uiState.pageSettings = mergePageSettings({
        ...pageSettings(),
        settingsAccessMethod: requestedAccess,
        autoLockMinutes: clampNumber(el('securityWizardAutoLockMinutes')?.value || 0, 0, 240),
        autoLockOnBlur: !!el('securityWizardAutoLockOnBlur')?.checked,
        autoLockOnTabHidden: !!el('securityWizardAutoLockOnTabHidden')?.checked,
        autoLockOnReturnMinutes: clampNumber(el('securityWizardAutoLockOnReturnMinutes')?.value || 0, 0, 240),
        pbkdf2Iterations: cfg.pbkdf2Iterations || DEFAULT_PAGE_SETTINGS.pbkdf2Iterations
      });
      applyPageSettings(uiState.pageSettings, { skipRender: false });
      resetAutoLockTimer();
      updateSecurityStatusPanel();
      updatePinStatus('Security Guided Help updated.');
      ['securityWizardLockPin','securityWizardLockPinConfirm','securityWizardEyePin','securityWizardEyePinConfirm'].forEach(id => { const node = el(id); if (node) node.value = ''; });
      await writeLocalBrowserSave({ reason: 'security-setup-wizard', announce: false });
      securityWizardSuppressAutosave = true;
      renderSecuritySetupWizard(opts.preserveOpen ? securityWizardOpenKey() : '');
      securityWizardSuppressAutosave = false;
      securityWizardMessage(opts.silent ? 'Security setup auto-saved to encrypted browser storage.' : 'Security setup saved to encrypted browser storage.');
      setLiveStatusMessage(opts.silent ? 'Security setup auto-saved.' : 'Security setup saved.');
    };
    if (requestedAccess === 'none' && (cfg.settingsAccessMethod || 'auto') !== 'none') {
      if (securityWizardConfirmingSettingsNone) return;
      securityWizardConfirmingSettingsNone = true;
      showInAppConfirm('Disable the Settings access prompt? Anyone with this unlocked page could open Settings and change security, Presentation Mode, save, local data, and reset options. The chart data can still be encrypted at rest, but the Settings door itself will be open while the page is unlocked.', () => {
        securityWizardConfirmingSettingsNone = false;
        void applyCoreSettings().catch(err => securityWizardMessage(err.message || 'Could not save security setup.'));
      }, { title: 'Disable Settings Protection?', confirmText: 'Disable Prompt', cancelText: 'Keep Protected', onCancel: () => { securityWizardConfirmingSettingsNone = false; const select = el('securityWizardSettingsAccessMethod'); if (select) select.value = cfg.settingsAccessMethod || 'auto'; updateSecurityWizardLiveStatus(); } });
      return;
    }
    await applyCoreSettings();
  }

  function openSecuritySetupWizard() { installWorkflowDom(); renderSecuritySetupWizard(); el('securitySetupWizardModal')?.classList.add('show'); }
  function closeSecuritySetupWizard() { window.clearTimeout(securityWizardAutoSaveTimer); el('securitySetupWizardModal')?.classList.remove('show'); ['securityWizardLockPin','securityWizardLockPinConfirm','securityWizardEyePin','securityWizardEyePinConfirm'].forEach(id => { const node = el(id); if (node) node.value = ''; }); }

  function updateLockWorkflowReadiness() {
    const node = el('lockWorkflowReadiness');
    if (!node) return;
    const cfg = pageSettings();
    const rows = [];
    rows.push({ kind: currentSessionEncryptionKey() ? 'good' : 'warn', text: currentSessionEncryptionKey() ? 'Active encryption key is present for save/snapshot work.' : 'No active encryption key is present. Saves and snapshot index writes will need the password.' });
    rows.push({ kind: getLockCredential() ? 'good' : 'warn', text: getLockCredential() ? 'Lock PIN/password is set.' : 'Lock PIN/password is not set.' });
    rows.push({ kind: uiState.pageLockSecretForSession ? 'good' : 'warn', text: uiState.pageLockSecretForSession ? 'Lock PIN/password has been entered this session, so auto-lock can wrap the session key with the PIN.' : 'Lock PIN/password has not been entered this session. Auto-lock may ask you to lock/unlock once before PIN-only restore works.' });
    rows.push({ kind: (Number(cfg.autoLockMinutes || 0) || cfg.autoLockOnBlur || cfg.autoLockOnTabHidden || Number(cfg.autoLockOnReturnMinutes || 0)) ? 'good' : 'warn', text: 'Auto-lock triggers: ' + [Number(cfg.autoLockMinutes || 0) ? `${cfg.autoLockMinutes} minute inactivity` : '', cfg.autoLockOnBlur ? 'loss of focus' : '', cfg.autoLockOnTabHidden ? 'tab hidden' : '', Number(cfg.autoLockOnReturnMinutes || 0) ? `return after ${cfg.autoLockOnReturnMinutes} minutes` : ''].filter(Boolean).join(', ') || 'none enabled' });
    node.innerHTML = rows.map(row => `<div class="health-finding ${row.kind}">${escapeHtml(row.text)}</div>`).join('');
  }

  function updateSecurityStatusPanel() {
    updateSecurityStatusPanelCore();
    updateLockWorkflowReadiness();
  }

  function privacyProfiles(mode) {
    return {
      teacher: { hideClassActions:false, hideWizard:false, hideSaveLoad:false, hideSettings:false, hidePrint:false, hideLayoutTools:false, hideStudentsPanel:true, hideStatusPanel:false, hideChartActions:false, forceNamesOnly:false, hideGroupDetails:false, disableSeatEditing:false, disableRoomEditing:false, disableStudentEditing:false, disableGroupEditing:false },
      substitute: { hideClassActions:true, hideWizard:true, hideSaveLoad:true, hideSettings:true, hidePrint:false, hideLayoutTools:true, hideStudentsPanel:true, hideStatusPanel:false, hideChartActions:true, forceNamesOnly:true, hideGroupDetails:false, disableSeatEditing:true, disableRoomEditing:true, disableStudentEditing:true, disableGroupEditing:true },
      student: { hideClassActions:true, hideWizard:true, hideSaveLoad:true, hideSettings:true, hidePrint:true, hideLayoutTools:true, hideStudentsPanel:true, hideStatusPanel:true, hideChartActions:true, forceNamesOnly:true, hideGroupDetails:true, disableSeatEditing:true, disableRoomEditing:true, disableStudentEditing:true, disableGroupEditing:true },
      admin: { hideClassActions:false, hideWizard:true, hideSaveLoad:false, hideSettings:false, hidePrint:false, hideLayoutTools:false, hideStudentsPanel:true, hideStatusPanel:false, hideChartActions:false, forceNamesOnly:false, hideGroupDetails:false, disableSeatEditing:true, disableRoomEditing:true, disableStudentEditing:false, disableGroupEditing:false },
      privacy: { hideClassActions:true, hideWizard:true, hideSaveLoad:true, hideSettings:true, hidePrint:true, hideLayoutTools:true, hideStudentsPanel:true, hideStatusPanel:true, hideChartActions:true, forceNamesOnly:true, hideGroupDetails:true, disableSeatEditing:true, disableRoomEditing:true, disableStudentEditing:true, disableGroupEditing:true }
    }[mode] || null;
  }

  function applyPrivacyDisplayMode(mode) {
    const profile = privacyProfiles(mode);
    if (!profile) return;
    uiState.pageSettings = mergePageSettings({ ...pageSettings(), privacyDisplayMode: mode, visibility: { ...pageSettings().visibility, ...profile } });
    updatePageSettingsForm();
    applyPageSettings(uiState.pageSettings, { skipRender: false });
    setLiveStatusMessage(`Applied ${mode.replace(/^[a-z]/, c => c.toUpperCase())} privacy display profile for Presentation Mode.`);
  }

  function noteRevealTimeoutMs() {
    const seconds = Number(pageSettings().noteRevealTimeoutSeconds || 0);
    return seconds > 0 ? seconds * 1000 : 0;
  }

  function clearNoteRevealTimers() {
    Object.values(uiState.noteRevealTimers || {}).forEach(timer => clearTimeout(timer));
    uiState.noteRevealTimers = {};
  }

  function revealNoteLineInEditor(noteKey) {
    revealNoteLineInEditorCore(noteKey);
    const key = String(noteKey || '');
    if (!key) return;
    uiState.noteRevealTimers = uiState.noteRevealTimers || {};
    if (uiState.noteRevealTimers[key]) clearTimeout(uiState.noteRevealTimers[key]);
    const ms = noteRevealTimeoutMs();
    if (ms > 0) {
      uiState.noteRevealTimers[key] = setTimeout(() => {
        if (uiState.noteEditorRevealed) delete uiState.noteEditorRevealed[key];
        delete uiState.noteRevealTimers[key];
        renderNotesEditor();
      }, ms);
    }
  }

  function closeStudentNotesModal() { clearNoteRevealTimers(); closeStudentNotesModalCore(); }

  function hideRevealedSensitiveNotes(reason = '') {
    if (!uiState.noteEditorRevealed || !Object.keys(uiState.noteEditorRevealed).length) return;
    uiState.noteEditorRevealed = {};
    clearNoteRevealTimers();
    renderNotesEditor();
    if (reason) setLiveStatusMessage(reason);
  }

  function trimSnapshotsToRetention() {
    if (!Array.isArray(uiState.appSnapshotsCache)) return;
    const limit = snapshotRetentionStorageLimit();
    if (uiState.appSnapshotsCache.length > limit) {
      uiState.appSnapshotsCache = uiState.appSnapshotsCache.slice(0, limit);
      uiState.appSnapshotsLoaded = true;
      void persistAppSnapshotsIndexEncrypted();
    }
  }

  function saveAppSnapshots(items) {
    const limit = snapshotRetentionStorageLimit();
    uiState.appSnapshotsCache = (items || []).map(normalizeAppSnapshotRecord).filter(Boolean).slice(0, limit);
    uiState.appSnapshotsLoaded = true;
    void persistAppSnapshotsIndexEncrypted();
  }

  function renderSnapshotList() {
    const list = el('snapshotList');
    if (!list) return;
    const items = appSnapshots();
    if (!items.length) {
      list.innerHTML = '<div class="hint">No full-app snapshots saved yet.</div>';
      return;
    }
    list.classList.add('timeline-list');
    list.innerHTML = items.map(item => {
      const kind = item.reason === 'before-restore' ? 'return-point' : item.automatic ? 'auto' : '';
      const reason = item.reason ? ` · ${item.reason.replace(/-/g, ' ')}` : '';
      return `<div class="snapshot-timeline-row ${kind}"><div class="snapshot-timeline-dot" aria-hidden="true"></div><div class="settings-list-main"><strong>${escapeHtml(item.name)}</strong><div class="muted">${escapeHtml(new Date(item.createdAt).toLocaleString())}${item.automatic ? ' · automatic' : ''}${escapeHtml(reason)}</div><div class="muted">${escapeHtml(item.signature || '').slice(0, 10)}</div></div><div class="button-row"><button class="tiny secondary" data-preview-snapshot="${escapeHtml(item.id)}" type="button">Preview</button><button class="tiny secondary" data-restore-snapshot="${escapeHtml(item.id)}" type="button">Restore</button><button class="tiny danger icon-button" data-delete-snapshot="${escapeHtml(item.id)}" type="button" aria-label="Delete snapshot" title="Delete this snapshot">🗑</button></div></div>`;
    }).join('');
  }

  async function previewSnapshot(snapshotId) {
    await ensureAppSnapshotsLoaded();
    const snap = appSnapshots().find(item => item.id === snapshotId);
    if (!snap) return;
    const body = el('snapshotPreviewBody');
    if (!body) return;
    body.innerHTML = '<div class="hint">Decrypting snapshot preview...</div>';
    el('snapshotPreviewModal')?.classList.add('show');
    try {
      const text = await snapshotDataForRestore(snap.data);
      const parsed = JSON.parse(text);
      const classes = Array.isArray(parsed.classes) ? parsed.classes : [];
      const active = classes.find(cls => cls.id === parsed.activeClassId) || classes[0] || {};
      const studentCount = classes.reduce((sum, cls) => sum + (cls.students || []).length, 0);
      const groupCount = classes.reduce((sum, cls) => sum + (cls.groups || []).length, 0);
      const zoneCount = classes.reduce((sum, cls) => sum + (cls.zones || []).length, 0);
      const assignedCount = classes.reduce((sum, cls) => sum + Object.values(cls.cells || {}).filter(cell => cell.assignedStudentId).length, 0);
      body.innerHTML = `<h3>${escapeHtml(snap.name)}</h3><div class="muted">Created ${escapeHtml(new Date(snap.createdAt).toLocaleString())}</div><div class="snapshot-summary-grid"><div><strong>Classes</strong><br>${classes.length}</div><div><strong>Students</strong><br>${studentCount}</div><div><strong>Groups</strong><br>${groupCount}</div><div><strong>Zones</strong><br>${zoneCount}</div><div><strong>Assigned seats</strong><br>${assignedCount}</div><div><strong>Active class</strong><br>${escapeHtml(active.name || 'Unknown')}</div></div><div class="warningbox">Preview only. Restoring will first save a return-point snapshot of the current state.</div><div class="button-row"><button type="button" data-restore-snapshot="${escapeHtml(snap.id)}">Restore This Snapshot</button></div>`;
    } catch (err) {
      body.innerHTML = `<div class="warningbox">Could not preview this snapshot: ${escapeHtml(err.message || err)}</div>`;
    }
  }

  function collectPrintSecurityConcerns(options) {
    const concerns = [];
    if (!pageSettings().printSecurityWarnings) return concerns;
    if (options.notes?.private) concerns.push('private notes');
    if (options.notes?.substitute) concerns.push('substitute notes');
    if (options.details?.id) concerns.push('student IDs');
    if (options.details?.grade) concerns.push('grades');
    if (options.sections?.groups) concerns.push('group configuration');
    if (options.sections?.zones) concerns.push('zone configuration');
    return concerns;
  }

  function confirmSensitiveOutput(kind, concerns, proceed) {
    if (!concerns.length) { proceed(); return; }
    showInAppConfirm(`${kind} includes ${concerns.join(', ')}. Continue only if this output is appropriate for the audience and district workflow.`, proceed, { title: `${kind} Security Check`, confirmText: 'Continue', cancelText: 'Cancel' });
  }

  function startPrintPreviewFromOptions() {
    const options = readPrintOptionsFromModal();
    confirmSensitiveOutput('Print preview', collectPrintSecurityConcerns(options), () => startPrintPreviewFromOptionsCore(options));
  }
  function exportChartPdf() {
    const options = readPrintOptionsFromModal();
    confirmSensitiveOutput('PDF export', collectPrintSecurityConcerns(options), () => exportChartPdfCore(options));
  }
  function exportChartSvg() {
    const options = readPrintOptionsFromModal();
    confirmSensitiveOutput('SVG export', collectPrintSecurityConcerns(options), () => exportChartSvgCore(options));
  }

  function exportConcernsForScope(scope) {
    if (!pageSettings().exportSecurityWarnings) return [];
    const concerns = ['encrypted student data'];
    if (hasSensitiveStudentNotes()) concerns.push('private/substitute notes');
    if (scope === 'all') concerns.push('all classes and snapshots');
    return concerns;
  }


  function exportAndDownload(scope = 'all') { confirmSensitiveOutput('JSON export', exportConcernsForScope(scope), () => exportAndDownloadCore(scope)); }
  function downloadSavePackage() { confirmSensitiveOutput('Backup package download', exportConcernsForScope('all'), () => downloadSavePackageCore()); }
  function downloadStudentDataJson() { confirmSensitiveOutput('Student data export', exportConcernsForScope('current'), () => downloadStudentDataJsonCore()); }
  function downloadGroupConfigJson() { confirmSensitiveOutput('Group/zone export', exportConcernsForScope('current'), () => downloadGroupConfigJsonCore()); }
  function downloadRoomLayoutJson() { confirmSensitiveOutput('Room layout export', ['room metadata'], () => downloadRoomLayoutJsonCore()); }

  function renderUndoHistory() {
    const list = el('undoHistoryList');
    if (!list) return;
    const labels = uiState.undoHistoryLabels || [];
    const redo = uiState.redoHistoryLabels || [];
    const rows = [];
    labels.slice(-25).reverse().forEach((item, idx) => rows.push({ type:'Undo', item, idx }));
    redo.slice(-25).reverse().forEach((item, idx) => rows.push({ type:'Redo', item, idx }));
    list.innerHTML = rows.length ? rows.map(row => `<div class="history-row"><div><strong>${escapeHtml(row.type)} checkpoint</strong><div class="muted">${escapeHtml(row.item.reason || 'Change')} · ${escapeHtml(new Date(row.item.at || Date.now()).toLocaleString())}</div></div><span class="pill">${escapeHtml(row.type)}</span></div>`).join('') : '<div class="hint">No undo or redo checkpoints captured yet.</div>';
  }

  function pushUndoSnapshot(reason = 'change') {
    const before = uiState.undoStack.length;
    pushUndoSnapshotCore(reason);
    if (uiState.undoStack.length > before) {
      uiState.undoHistoryLabels = uiState.undoHistoryLabels || [];
      uiState.undoHistoryLabels.push({ reason, at: new Date().toISOString() });
      if (uiState.undoHistoryLabels.length > 60) uiState.undoHistoryLabels.shift();
      uiState.redoHistoryLabels = [];
    }
  }
  function undoLastChange() {
    const label = (uiState.undoHistoryLabels || []).pop();
    undoLastChangeCore();
    if (label) { uiState.redoHistoryLabels = uiState.redoHistoryLabels || []; uiState.redoHistoryLabels.push({ ...label, reason: `Redo: ${label.reason || 'Change'}`, at: new Date().toISOString() }); }
    renderUndoHistory();
  }
  function redoLastChange() {
    const label = (uiState.redoHistoryLabels || []).pop();
    redoLastChangeCore();
    if (label) { uiState.undoHistoryLabels = uiState.undoHistoryLabels || []; uiState.undoHistoryLabels.push({ ...label, reason: label.reason || 'Redone change', at: new Date().toISOString() }); }
    renderUndoHistory();
  }

  function importState(json) {
    importStateCore(json);
  }

  async function importStateDirectFromText(text, sourceLabel = 'local save') {
    const { parsed } = await parseSupportedPayloadText(text, sourceLabel, { allowComponents: false });
    importStateCore(JSON.stringify(parsed));
    return parsed;
  }

  function collectSaveHealthFindings() {
    const findings = [];
    persistActiveClass();
    const localRaw = safeStorageGet('localStorage', STORAGE_KEY);
    if (uiState.browserStorageStatus === 'unsupported-format') {
      findings.push({ kind: 'bad', text: 'Unsupported browser-save data was found and is blocked. Schemas below 12 are unsupported and are not converted.' });
    } else if (!localRaw) {
      findings.push({ kind: 'bad', text: 'No current browser-save marker or fallback payload was found.' });
    } else {
      try {
        const local = JSON.parse(localRaw);
        const currentMarker = isSupportedBrowserStorageMarker(local, APP_PRIMARY_SAVE_KEY);
        if (currentMarker) {
          const missingRecord = uiState.browserStorageStatus === 'missing-record';
          const unavailable = uiState.browserStorageStatus === 'storage-unavailable';
          findings.push({
            kind: missingRecord || unavailable ? 'bad' : 'good',
            text: missingRecord
              ? 'The current browser-save marker exists, but its IndexedDB record and recovery backup are missing.'
              : unavailable
                    ? 'The current browser-save marker exists, but IndexedDB is unavailable.'
                    : 'The browser save uses a schema-compatible generation-6 IndexedDB marker.'
          });
        } else if (local?.encrypted) {
          assertSupportedEncryptedEnvelope(local, 'browser save');
          findings.push({ kind: 'good', text: 'The local browser fallback is an encrypted, schema-compatible generation-6 payload.' });
        } else {
          assertSupportedSaveDocument(local, 'browser save');
          findings.push({ kind: 'bad', text: 'The local browser fallback is current but is not encrypted.' });
        }
      } catch (err) {
        findings.push({ kind: 'bad', text: `The local browser save is not a schema-compatible payload: ${err.message || err}` });
      }
    }
    try {
      const raw = safeStorageGet('localStorage', LOCAL_AUTOSAVE_SNAPSHOT_KEY);
      if (!raw) {
        findings.push({ kind: 'good', text: 'Snapshot index is empty.' });
      } else {
        const snapshots = JSON.parse(raw);
        const currentMarker = isSupportedBrowserStorageMarker(snapshots, APP_SNAPSHOT_INDEX_KEY);
        if (currentMarker) {
          findings.push({ kind: snapshots?.snapshotIndexEncrypted ? 'good' : 'bad', text: snapshots?.snapshotIndexEncrypted ? 'Snapshot index uses the current encrypted IndexedDB marker.' : 'The current snapshot marker does not confirm encrypted snapshot storage.' });
        } else if (snapshots?.encrypted) {
          assertSupportedEncryptedEnvelope(snapshots, 'snapshot index', 'snapshot-index');
          findings.push({ kind: 'good', text: 'Snapshot index is an encrypted, schema-compatible generation-6 payload.' });
        } else {
          assertSupportedSnapshotIndex(snapshots, 'snapshot index');
          findings.push({ kind: 'bad', text: 'Snapshot index is current but is not encrypted.' });
        }
      }
    } catch (err) {
      findings.push({ kind: 'bad', text: `Snapshot index is not a schema-compatible payload: ${err.message || err}` });
    }
    const classes = state.classes || [];
    findings.push({ kind: classes.length ? 'good' : 'bad', text: `${classes.length} class record(s) found.` });
    classes.forEach(cls => {
      const students = cls.students || [];
      const ids = new Set(students.map(s => String(s.id || '')));
      const names = new Set();
      const duplicateIds = students.map(s => String(s.id || '')).filter((id, idx, arr) => id && arr.indexOf(id) !== idx);
      if (duplicateIds.length) findings.push({ kind:'warn', text:`${cls.name || 'Class'} has duplicate student IDs: ${Array.from(new Set(duplicateIds)).join(', ')}.` });
      students.forEach(s => { const name = studentFullName(s).trim().toLowerCase(); if (name && names.has(name)) findings.push({ kind:'warn', text:`${cls.name || 'Class'} may have duplicate student name: ${studentFullName(s)}.` }); names.add(name); });
      Object.entries(cls.cells || {}).forEach(([key, cell]) => { if (cell.assignedStudentId && !ids.has(String(cell.assignedStudentId))) findings.push({ kind:'bad', text:`${cls.name || 'Class'} seat ${key} references a missing student (${cell.assignedStudentId}).` }); });
      const groupIds = new Set((cls.groups || []).map(b => String(b.id)));
      const zoneIds = new Set((cls.zones || []).map(z => String(z.id)));
      (cls.groups || []).forEach(b => { (b.studentIds || []).forEach(id => { if (!ids.has(String(id))) findings.push({ kind:'bad', text:`Group ${b.name || b.id} references missing student ${id}.` }); }); (b.anchorSeats || []).forEach(key => { if (!cls.cells?.[key]) findings.push({ kind:'bad', text:`Group ${b.name || b.id} references missing seat ${key}.` }); }); if (b.zoneId && !zoneIds.has(String(b.zoneId))) findings.push({ kind:'bad', text:`Group ${b.name || b.id} references missing zone ${b.zoneId}.` }); });
      (cls.zones || []).forEach(z => { (z.studentIds || []).forEach(id => { if (!ids.has(String(id))) findings.push({ kind:'bad', text:`Zone ${z.name || z.id} references missing student ${id}.` }); }); (z.groupIds || []).forEach(id => { if (!groupIds.has(String(id))) findings.push({ kind:'bad', text:`Zone ${z.name || z.id} references missing group ${id}.` }); }); });
    });
    if (!findings.some(f => f.kind === 'bad' || f.kind === 'warn')) findings.push({ kind:'good', text:'No data integrity issues found in the current loaded state.' });
    return findings;
  }

  function renderSaveHealthReport(run = true) {
    const node = el('saveHealthReport');
    if (!node) return;
    if (!run) return;
    const findings = collectSaveHealthFindings();
    node.innerHTML = findings.map(f => `<div class="health-finding ${escapeHtml(f.kind)}">${escapeHtml(f.text)}</div>`).join('');
  }

  function repairClassRecordSafe(cls) {
    const c = normalizeClassRecord(cls);
    const studentIds = new Set((c.students || []).map(student => String(student.id || '')));
    const groupIds = new Set((c.groups || []).map(group => String(group.id || '')));
    const zoneIds = new Set((c.zones || []).map(zone => String(zone.id || '')));
    const validSeatKeys = new Set(Object.entries(c.cells || {}).filter(([, cell]) => cell && cell.type === 'seat').map(([key]) => String(key)));
    Object.values(c.cells || {}).forEach(cell => {
      if (!cell) return;
      cell.zoneIds = Array.from(new Set((cell.zoneIds || []).map(String).filter(id => zoneIds.has(id))));
      if (cell.type !== 'seat') {
        cell.assignedStudentId = null;
        cell.manual = false;
        cell.anchorGroupIds = [];
        return;
      }
      if (cell.assignedStudentId && !studentIds.has(String(cell.assignedStudentId))) {
        cell.assignedStudentId = null;
        cell.manual = false;
      }
      cell.anchorGroupIds = Array.from(new Set((cell.anchorGroupIds || []).map(String).filter(id => groupIds.has(id))));
    });
    c.groups = (c.groups || []).map((group, index) => {
      const b = normalizeGroupRecord(group, index);
      b.studentIds = Array.from(new Set((b.studentIds || []).map(String).filter(id => studentIds.has(id))));
      b.anchorSeats = Array.from(new Set((b.anchorSeats || []).map(String).filter(key => validSeatKeys.has(key))));
      if (b.zoneId && !zoneIds.has(String(b.zoneId))) b.zoneId = '';
      b.anchorSeats.forEach(key => {
        const cell = c.cells[key];
        if (cell && cell.type === 'seat') {
          cell.anchorGroupIds = Array.from(new Set([...(cell.anchorGroupIds || []).map(String), String(b.id)]));
        }
      });
      return b;
    });
    const repairedGroupIds = new Set((c.groups || []).map(group => String(group.id || '')));
    c.zones = (c.zones || []).map((zone, index) => {
      const z = normalizeZoneRecord(zone, index);
      z.studentIds = Array.from(new Set((z.studentIds || []).map(String).filter(id => studentIds.has(id))));
      z.groupIds = Array.from(new Set((z.groupIds || []).map(String).filter(id => repairedGroupIds.has(id))));
      c.groups.filter(group => String(group.zoneId || '') === String(z.id)).forEach(group => {
        if (!z.groupIds.includes(String(group.id))) z.groupIds.push(String(group.id));
      });
      return z;
    });
    return normalizeClassRecord(c);
  }

  function repairDataIntegrity() {
    showInAppConfirm('Repair safe data integrity issues? This removes orphaned seat assignments, stale group/zone/student references, invalid anchors, and normalizes class records. A snapshot/undo point is created first.', () => {
      pushUndoSnapshot('Before data integrity repair');
      persistActiveClass();
      state.classes = (state.classes || []).map(repairClassRecordSafe).filter(Boolean);
      if (!state.classes.length) state.classes = [createClassRecord('Class 1')];
      if (!state.activeClassId || !state.classes.some(cls => cls.id === state.activeClassId)) state.activeClassId = state.classes[0].id;
      applyClassToState(state.activeClassId);
      renderAll();
      renderSaveHealthReport(true);
      setLiveStatusMessage('Safe data repair complete. Review the save health report.');
    }, { title:'Repair Data Integrity?', confirmText:'Repair Safe Issues', cancelText:'Cancel' });
  }

  async function applySettingsEncryptionKeyChange() {
    const input = el('settingsEncryptionKey');
    const newKey = String(input?.value || '');
    if (!newKey) { setLiveStatusMessage('Enter a new encryption password before updating the session key.'); input?.focus(); return; }
    const strength = passwordStrengthDetails(newKey);
    updatePasswordStrengthDisplay('settingsEncryptionKey', 'settingsPasswordStrength');
    if (!strength.acceptable) { setLiveStatusMessage('Use a stronger encryption password before updating. A 4-word passphrase or 16+ mixed characters is recommended.'); input?.focus(); return; }
    const oldKey = currentSessionEncryptionKey();
    const reencryptSnapshots = !!el('settingsReencryptAllSnapshots')?.checked;
    showInAppConfirm('Update the active encryption password? The current browser save and snapshot index will be re-encrypted with the new password. Older downloaded saves/backups still require the old password used when they were created.', async () => {
      let converted = 0;
      let skipped = 0;
      const preparedSnapshots = [];
      try {
        await ensureAppSnapshotsLoaded({ force: true });
        if (reencryptSnapshots && oldKey) {
          for (const snap of appSnapshots()) {
            try {
              const plain = await snapshotDataForRestore(snap.data);
              preparedSnapshots.push({ snap, plain });
            } catch (err) { skipped++; preparedSnapshots.push({ snap, plain: null }); }
          }
        }
        setSessionEncryptionKey(newKey);
        if (reencryptSnapshots && preparedSnapshots.length) {
          const next = [];
          for (const item of preparedSnapshots) {
            if (item.plain) { next.push({ ...item.snap, data: await snapshotDataForStorage(item.plain), signature: hashString(item.plain) }); converted++; }
            else next.push(item.snap);
          }
          uiState.appSnapshotsCache = next.map(normalizeAppSnapshotRecord).filter(Boolean).slice(0, snapshotRetentionStorageLimit());
          uiState.appSnapshotsLoaded = true;
        }
        if (input) input.value = '';
        updatePasswordStrengthDisplay('settingsEncryptionKey', 'settingsPasswordStrength');
        await persistAppSnapshotsIndexEncrypted();
        await writeLocalBrowserSave({ reason: 'encryption-key-updated', announce: false });
        setLiveStatusMessage(`Session encryption password updated. Current browser save and snapshot index use the new password${reencryptSnapshots ? `; ${converted} snapshot(s) re-encrypted${skipped ? `, ${skipped} skipped` : ''}` : ''}. Older downloaded files still need their original password.`);
        updateSaveHealthPanel();
        updateSecurityStatusPanel();
      } catch (err) {
        setLiveStatusMessage(err.message || 'Could not update encryption password.');
      }
    }, { title:'Update Encryption Password?', confirmText:'Update Password', cancelText:'Cancel' });
  }

  function csvDuplicateModeForCurrentImport() {
    return el('csvImportDuplicateMode')?.value || pageSettings().csvDuplicateMode || 'update';
  }

  function renderCsvMappingWizard() {
    renderCsvMappingWizardCore();
    installCsvWizardExtras();
    setControlValue('csvImportDuplicateMode', pageSettings().csvDuplicateMode || 'update');
    setControlChecked('csvImportSnapshotBefore', pageSettings().csvSnapshotBeforeImport);
    const stage = el('csvWizardStage');
    if (stage) stage.textContent = 'Step 2 of 4: Confirm mapped fields and duplicate behavior. Preview updates as mappings change.';
  }

  async function importMappedCsvStudents() {
    const draft = uiState.csvImportDraft;
    if (!draft) return;
    const mode = csvDuplicateModeForCurrentImport();
    const makeSnapshot = !!el('csvImportSnapshotBefore')?.checked;
    const previousStudents = deepClone(state.students);
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const rejectedRows = [];
    try {
      if (makeSnapshot) await createAppSnapshotWithName(`Before CSV import - ${new Date().toLocaleString()}`, { silent: true, reason: 'before-import' });
      pushUndoSnapshot('Before CSV import');
      draft.rows.forEach((row, index) => {
        const values = mappedCsvValues(row);
        if (!(values.firstName || values.lastName || values.id)) {
          const source = csvRejectedRowSource(draft.headers, row);
          rejectedRows.push({ rowNumber: index + 2, reason: 'No mapped first name, last name, or student ID.', ...source });
          return;
        }
        const student = normalizeStudent(values);
        const incomingName = studentFullName(student).trim().toLowerCase();
        const match = state.students.find(existing => (values.id && String(existing.id || '') === String(values.id)) || (incomingName && studentFullName(existing).trim().toLowerCase() === incomingName));
        if (match && mode === 'skip') { skipped++; return; }
        if (match && mode === 'update') { updateStudentRecord(match.id, { ...match, ...student, id: match.id }); updated++; return; }
        if (match && mode === 'create') student.id = uid('student');
        addStudent(student);
        added++;
      });
      uiState.csvImportDraft = null;
      el('csvMapModal')?.classList.remove('show');
      renderAll();
      const summary = `CSV import complete: ${added} added, ${updated} updated, ${skipped} skipped${rejectedRows.length ? `, ${rejectedRows.length} rejected` : ''}.`;
      setLiveStatusMessage(summary);
      if (rejectedRows.length) {
        WorkflowRecoveryV62.reportFailure({
          operation: 'CSV Roster Import Completed With Rejected Rows',
          source: 'mapped CSV roster',
          error: new Error(`${rejectedRows.length} row${rejectedRows.length === 1 ? '' : 's'} did not contain a mapped name or student ID and were not imported.`),
          dataChanged: added + updated > 0,
          snapshotCreated: makeSnapshot,
          rejectedRows,
          remedy: 'Download the rejected-row report, correct the source data or column mapping, and import only the corrected rows.'
        });
      }
    } catch (err) {
      state.students = previousStudents.map(normalizeStudent);
      renderAll();
      WorkflowRecoveryV62.reportFailure({
        operation: 'Apply CSV Roster Import',
        source: 'mapped CSV roster',
        error: err,
        dataChanged: false,
        snapshotCreated: makeSnapshot,
        rejectedRows,
        remedy: 'The roster was restored to its pre-import state. Review the mapping, source rows, and encryption snapshot settings before retrying.'
      });
    }
  }

  function renderChangeLog() {
    const target = el('changeLogList');
    if (!target) return;
    target.innerHTML = RELEASE_HISTORY.map(entry => `
          <article class="change-log-entry${entry.current ? ' current-release' : ''}">
            <div class="change-log-heading">
              <div>
                <strong>${escapeHtml(entry.title)}</strong>
                <span class="change-log-version">${entry.current ? 'Current release' : 'Milestone'} · ${escapeHtml(entry.version)} · ${escapeHtml(entry.date)}</span>
              </div>
              ${entry.current ? '<span class="pill">Current</span>' : ''}
            </div>
            <ul>${entry.changes.map(change => `<li>${escapeHtml(change)}</li>`).join('')}</ul>
          </article>
        `).join('');
  }

  function refreshSettingsMobilePageSelect() {
    const select = el('settingsMobilePageSelect');
    if (!select) return;
    const current = uiState.activeSettingsPage || select.value || 'chart';
    const options = Array.from(document.querySelectorAll('[data-settings-nav]')).map(button => {
      const title = button.querySelector('.settings-page-title')?.textContent?.trim() || button.textContent.trim();
      return { value: button.dataset.settingsNav, title };
    });
    select.innerHTML = options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.title)}</option>`).join('');
    select.value = options.some(option => option.value === current) ? current : (options[0]?.value || 'chart');
  }

  function settingsSearchFilter() {
    const input = el('settingsSearchInput');
    const q = String(input?.value || '').trim().toLowerCase();
    const buttons = Array.from(document.querySelectorAll('[data-settings-nav]'));
    let visible = 0;
    buttons.forEach(button => {
      const text = button.textContent.toLowerCase();
      const match = !q || text.includes(q);
      button.classList.toggle('settings-search-hidden', !match);
      if (match) visible++;
    });
    const summary = el('settingsSearchSummary');
    if (summary) summary.textContent = q ? `${visible} Settings section(s) match "${q}".` : 'Type to filter Settings sections.';
    refreshSettingsMobilePageSelect();
  }

  function openSnapshotTimeline() { openSnapshotModal(); }

  function openSettingsModal() {
    installWorkflowDom();
    openSettingsModalCore();
    updateAddonSettingsForm();
  }
  function closeSettingsModal() {
    closeSettingsModalCore();
  }

  function openWelcomeSecurityModal() { installWorkflowDom(); openWelcomeSecurityModalCore(); }
  function closeWelcomeSecurityModal() { closeWelcomeSecurityModalCore(); }
  async function completeWelcomeSecuritySetup() { await completeWelcomeSecuritySetupCore(); }


  function scrollSecurityWizardRow(row) {
    window.setTimeout(() => {
      try {
        row.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      } catch {
        row.scrollIntoView(false);
      }
    }, 80);
  }

  function installWorkflowEvents() {
    if (document.body.dataset.workflowExpansionV2 === 'true') return;
    document.body.dataset.workflowExpansionV2 = 'true';
    document.addEventListener('click', event => {
      const target = event.target;
      if (target.closest?.('#securitySetupWizardOpenBtn')) { event.preventDefault(); openSecuritySetupWizard(); return; }
      if (target.closest?.('#closeSecuritySetupWizardBtn')) { event.preventDefault(); closeSecuritySetupWizard(); return; }
      if (target.closest?.('#securityWizardDoneBtn')) {
        event.preventDefault();
        window.clearTimeout(securityWizardAutoSaveTimer);
        if (securityWizardCanAutoApply()) {
          applySecuritySetupWizard({ silent: true }).then(() => closeSecuritySetupWizard()).catch(err => securityWizardMessage(err.message || 'Could not auto-save before closing.'));
        } else {
          securityWizardMessage('Fix unmatched PIN/password fields before finishing.');
        }
        return;
      }
      if (target.closest?.('#securityWizardRefreshBtn')) { event.preventDefault(); renderSecuritySetupWizard(securityWizardOpenKey()); return; }
      if (target.closest?.('#securityWizardSaveBtn')) { event.preventDefault(); applySecuritySetupWizard().catch(err => securityWizardMessage(err.message || 'Could not save security setup.')); return; }
      const privacyBtn = target.closest?.('[data-apply-privacy-mode]');
      if (privacyBtn) { event.preventDefault(); applyPrivacyDisplayMode(privacyBtn.getAttribute('data-apply-privacy-mode')); return; }
      if (target.closest?.('#openSnapshotTimelineBtn')) { event.preventDefault(); openSnapshotTimeline(); return; }
      if (target.closest?.('#trimSnapshotsNowBtn')) { event.preventDefault(); trimSnapshotsToRetention(); renderSnapshotList(); setLiveStatusMessage('Snapshot retention applied.'); return; }
      const preview = target.closest?.('[data-preview-snapshot]');
      if (preview) { event.preventDefault(); previewSnapshot(preview.getAttribute('data-preview-snapshot')); return; }
      if (target.closest?.('#closeSnapshotPreviewBtn') || target.id === 'snapshotPreviewModal') { event.preventDefault(); el('snapshotPreviewModal')?.classList.remove('show'); return; }
      if (target.closest?.('#undoHistoryBtn')) { event.preventDefault(); renderUndoHistory(); el('undoHistoryModal')?.classList.add('show'); return; }
      if (target.closest?.('#closeUndoHistoryBtn') || target.id === 'undoHistoryModal') { event.preventDefault(); el('undoHistoryModal')?.classList.remove('show'); return; }
      if (target.closest?.('#undoHistoryUndoBtn')) { event.preventDefault(); undoLastChange(); return; }
      if (target.closest?.('#undoHistoryRedoBtn')) { event.preventDefault(); redoLastChange(); return; }
      if (target.closest?.('#runSaveHealthCheckBtn')) { event.preventDefault(); renderSaveHealthReport(true); return; }
      if (target.closest?.('#repairDataIntegrityBtn')) { event.preventDefault(); repairDataIntegrity(); return; }
    });
    document.addEventListener('input', event => {
      if (event.target?.id === 'settingsSearchInput') settingsSearchFilter();
      if (String(event.target?.id || '').startsWith('securityWizard')) scheduleSecurityWizardAutosave();
    });
    document.addEventListener('change', event => {
      if (String(event.target?.id || '').startsWith('securityWizard')) scheduleSecurityWizardAutosave();
      if (event.target?.id === 'settingPrivacyDisplayMode') applyPrivacyDisplayMode(event.target.value);
      if (event.target?.id === 'csvImportDuplicateMode' || event.target?.id === 'csvImportSnapshotBefore') {
        uiState.pageSettings = mergePageSettings({ ...pageSettings(), csvDuplicateMode: csvDuplicateModeForCurrentImport(), csvSnapshotBeforeImport: !!el('csvImportSnapshotBefore')?.checked });
      }
    });
    document.addEventListener('click', event => {
      const summary = event.target?.closest?.('#securityWizardSteps summary.security-wizard-check-summary');
      if (!summary) return;
      const row = summary.closest('details.security-wizard-check');
      if (!row) return;
      event.preventDefault();
      const shouldOpen = !row.open;
      row.parentElement?.querySelectorAll('details.security-wizard-check[open]').forEach(other => { if (other !== row) other.open = false; });
      row.open = shouldOpen;
      if (row.open) scrollSecurityWizardRow(row);
    });
    document.addEventListener('toggle', event => {
      const row = event.target;
      if (!(row instanceof HTMLDetailsElement) || !row.matches('#securityWizardSteps details.security-wizard-check') || !row.open) return;
      row.parentElement?.querySelectorAll('details.security-wizard-check[open]').forEach(other => { if (other !== row) other.open = false; });
      scrollSecurityWizardRow(row);
    }, true);
    window.addEventListener('blur', () => { if (pageSettings().noteRevealHideOnBlur) hideRevealedSensitiveNotes('Revealed private/substitute notes hidden because the window lost focus.'); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && pageSettings().noteRevealHideOnBlur) hideRevealedSensitiveNotes('Revealed private/substitute notes hidden because the tab became inactive.'); });
  }

  function install() {
    installWorkflowDom();
    installWorkflowEvents();
  }

  return Object.freeze({
    install,
    mergePageSettings,
    updatePageSettingsForm,
    readPageSettingsForm,
    updateSecurityStatusPanel,
    revealNoteLineInEditor,
    closeStudentNotesModal,
    saveAppSnapshots,
    renderSnapshotList,
    startPrintPreviewFromOptions,
    exportChartPdf,
    exportChartSvg,
    exportAndDownload,
    downloadSavePackage,
    downloadStudentDataJson,
    downloadGroupConfigJson,
    downloadRoomLayoutJson,
    pushUndoSnapshot,
    undoLastChange,
    redoLastChange,
    importState,
    importStateDirectFromText,
    applySettingsEncryptionKeyChange,
    renderCsvMappingWizard,
    importMappedCsvStudents,
    renderChangeLog,
    openSettingsModal,
    closeSettingsModal,
    openWelcomeSecurityModal,
    closeWelcomeSecurityModal,
    completeWelcomeSecuritySetup
  });
})();


let {
  mergePageSettings,
  updatePageSettingsForm,
  readPageSettingsForm,
  updateSecurityStatusPanel,
  revealNoteLineInEditor,
  closeStudentNotesModal,
  saveAppSnapshots,
  renderSnapshotList,
  startPrintPreviewFromOptions,
  exportChartPdf,
  exportChartSvg,
  exportAndDownload,
  downloadSavePackage,
  downloadStudentDataJson,
  downloadGroupConfigJson,
  downloadRoomLayoutJson,
  pushUndoSnapshot,
  undoLastChange,
  redoLastChange,
  importState,
  importStateDirectFromText,
  applySettingsEncryptionKeyChange,
  renderCsvMappingWizard,
  importMappedCsvStudents,
  renderChangeLog,
  openSettingsModal,
  closeSettingsModal,
  closeWelcomeSecurityModal
} = WorkflowExpansion;

function openWelcomeSecurityModal() {
  const result = WorkflowExpansion.openWelcomeSecurityModal();
  if (typeof StartupRecoveryV45 !== 'undefined') StartupRecoveryV45.syncWelcomeUi();
  return result;
}

async function completeWelcomeSecuritySetup() {
  if (typeof StartupRecoveryV45 !== 'undefined') return StartupRecoveryV45.handlePrimaryAction();
  return WorkflowExpansion.completeWelcomeSecuritySetup();
}







