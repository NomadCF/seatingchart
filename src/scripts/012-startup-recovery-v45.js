const StartupRecoveryV45 = (() => {
  let installed = false;
  let pendingPayload = '';
  let pendingSource = 'browser autosave';
  let pendingParseError = '';
  let mode = 'fresh';

  function hasPendingSave() {
    return Boolean(pendingPayload || pendingParseError);
  }

  function isRecoveryMode() {
    return mode === 'recovery';
  }

  function setPending(payload, source = 'browser autosave', parseError = '') {
    pendingPayload = String(payload || '');
    pendingSource = String(source || 'browser autosave');
    pendingParseError = String(parseError || '');
    mode = 'recovery';
    uiState.startupRecoveryPending = true;
    uiState.startupRecoverySource = pendingSource;
  }

  function clearPending() {
    pendingPayload = '';
    pendingParseError = '';
    uiState.startupRecoveryPending = false;
    uiState.startupRecoverySource = '';
  }

  function welcomeNodes() {
    const modal = el('welcomeSecurityModal');
    const card = modal?.querySelector('.welcome-password-card');
    const heading = card?.querySelector('.welcome-card-heading > div');
    const existingText = modal?.querySelector('.welcome-existing-row > div:first-child');
    return {
      modal,
      step: modal?.querySelector('.welcome-step-label'),
      title: el('welcomeSecurityTitle'),
      badge: modal?.querySelector('.welcome-time-badge'),
      introTitle: modal?.querySelector('.welcome-intro h3'),
      description: el('welcomeSecurityDescription'),
      headingStrong: heading?.querySelector('strong'),
      headingSpan: heading?.querySelector('span'),
      required: modal?.querySelector('.welcome-required-badge'),
      input: el('welcomeEncryptionKeyInput'),
      confirmField: el('welcomeEncryptionKeyConfirmInput')?.closest('.field'),
      strength: el('welcomePasswordStrength'),
      primary: el('welcomeSecurityStartBtn'),
      existingStrong: existingText?.querySelector('strong'),
      existingSpan: existingText?.querySelector('span'),
      startFresh: el('welcomeStartFreshBtn'),
      footnote: modal?.querySelector('.welcome-footnote')
    };
  }

  function syncWelcomeUi() {
    const n = welcomeNodes();
    if (!n.modal) return;
    const recovery = isRecoveryMode();
    n.modal.dataset.startupMode = recovery ? 'recovery' : 'fresh';
    if (n.step) n.step.textContent = recovery ? 'Existing browser save found' : 'First-time setup';
    if (n.title) n.title.textContent = recovery ? 'Unlock your saved seating charts' : 'Welcome to Classroom Seating Planner';
    if (n.badge) n.badge.textContent = recovery ? 'Password required' : 'About 1 minute';
    if (n.introTitle) n.introTitle.textContent = recovery ? 'Encrypted local data is waiting' : 'Protect your seating charts';
    if (n.description) n.description.textContent = recovery
      ? 'This browser already contains an encrypted seating-chart save. Enter the password previously used for that save. Nothing is changed until it unlocks successfully.'
      : 'Create one password for encrypted browser autosaves, backups, and save files. The app keeps student data on this device unless you choose another save location.';
    if (n.headingStrong) n.headingStrong.textContent = recovery ? 'Enter the existing encryption password' : 'Create your encryption password';
    if (n.headingSpan) n.headingSpan.textContent = recovery
      ? 'A wrong password does not erase or replace the saved data. You can retry as many times as needed.'
      : 'Use a memorable passphrase. The app cannot recover it unless you later create and separately store an optional recovery package.';
    if (n.required) n.required.textContent = recovery ? 'Existing password' : 'Required';
    if (n.input) {
      n.input.autocomplete = recovery ? 'current-password' : 'new-password';
      n.input.placeholder = recovery ? 'Password used for this browser save' : 'Use 4+ words or 16+ characters';
    }
    if (n.confirmField) n.confirmField.hidden = recovery;
    if (n.strength) n.strength.hidden = recovery;
    if (n.primary) n.primary.textContent = recovery ? 'Unlock saved data' : 'Create password and continue';
    if (n.existingStrong) n.existingStrong.textContent = recovery ? 'Cannot open this browser save?' : 'Already have a seating chart?';
    if (n.existingSpan) n.existingSpan.textContent = recovery
      ? 'Retry with another password, open a different backup, use Google Drive, or erase this browser’s local planner data and begin again.'
      : 'Open an existing encrypted save instead of creating a new workspace.';
    if (n.startFresh) n.startFresh.hidden = !recovery;
    if (n.footnote) n.footnote.innerHTML = recovery
      ? '<strong>Start Fresh permanently removes this browser’s local charts, snapshots, Settings, and saved PIN hashes.</strong> Downloaded files and Google Drive files are not deleted.'
      : 'Additional lock, privacy, and auto-lock options are available later under <strong>Settings → Security &amp; Data</strong>.';
    clearWelcomeSecurityError();
    if (recovery && pendingParseError) {
      showWelcomeSecurityError(pendingParseError || 'The browser save could not be read. Open another backup or erase the local planner data and start fresh.');
      el('welcomeEncryptionError')?.classList.add('storage-recovery-warning');
      if (n.primary) n.primary.disabled = true;
    } else if (n.primary) {
      n.primary.disabled = false;
      el('welcomeEncryptionError')?.classList.remove('storage-recovery-warning');
    }
  }

  function inspectStorageFailure(details = {}) {
    const status = String(details.status || 'storage-unavailable');
    const message = status === 'missing-record'
      ? 'The browser found a current local-save marker, but the IndexedDB save record is missing. Automatic saving is paused so the missing save cannot be overwritten. Open a current backup, choose a current Google Drive save, retry after reloading the browser, or explicitly erase local planner data.'
      : status === 'unsupported-format'
            ? `This browser contains planner data that is not the required ${supportedFormatRequirement()} format${details.error ? `: ${details.error}` : '.'} It will not be loaded or converted. Automatic saving is paused until you open a current backup or explicitly erase the unsupported local data.`
            : `The browser could not access the IndexedDB save record${details.error ? `: ${details.error}` : '.'} Automatic saving is paused so existing data is not overwritten. Open a current backup, choose a current Google Drive save, retry after reloading the browser, or explicitly erase local planner data.`;
    setPending('', details.source || 'browser autosave', message);
    uiState.browserStorageStatus = status;
    return { loaded: false, waiting: true, error: new Error(message) };
  }

  async function inspectInitialSave(payload, source = 'browser autosave') {
    const text = String(payload || '');
    if (!text) return { loaded: false, waiting: false };
    let parsed = null;
    try { parsed = JSON.parse(text); }
    catch (error) {
      setPending(text, source, error.message || 'Unreadable JSON');
      return { loaded: false, waiting: true, error };
    }
    if (!parsed?.encrypted) {
      try {
        await importStateDirectFromText(text, source);
        return { loaded: true, waiting: false };
      } catch (error) {
        setPending(text, source, error.message || 'Unsupported save');
        return { loaded: false, waiting: true, error };
      }
    }
    const activeKey = currentSessionEncryptionKey();
    if (activeKey) {
      try {
        await importStateDirectFromText(text, source);
        clearPending();
        return { loaded: true, waiting: false };
      } catch (error) {
        setPending(text, source);
        clearSessionEncryptionKeyFromMemory();
        return { loaded: false, waiting: true, error };
      }
    }
    setPending(text, source);
    return { loaded: false, waiting: true };
  }

  async function unlockPendingSave() {
    const input = el('welcomeEncryptionKeyInput');
    const password = String(input?.value || '');
    if (!password) {
      showWelcomeSecurityError('Enter the password previously used for this browser save.');
      input?.focus();
      return false;
    }
    if (!pendingPayload || pendingParseError) {
      showWelcomeSecurityError('The local save cannot be unlocked. Open another backup or choose Start Fresh.');
      return false;
    }

    let envelope = null;
    try {
      envelope = JSON.parse(pendingPayload);
    } catch (error) {
      showWelcomeSecurityError('The browser save is not valid JSON. Open another backup or choose Start Fresh.');
      return false;
    }

    let plainText = '';
    try {
      plainText = await decryptTextEnvelopeAndTrustKey(envelope, password);
    } catch (error) {
      const message = error?.code === 'INVALID_ENCRYPTION_ENVELOPE'
        ? `${error.message} Open another backup before choosing Start Fresh.`
        : 'That password did not unlock the browser save. Check capitalization and spacing, then try again. The saved encryption record may also be damaged.';
      showWelcomeSecurityError(message);
      input?.select();
      input?.focus();
      return false;
    }

    try {
      assertSupportedEncryptedEnvelope(envelope, pendingSource);
      const parsed = assertSupportedSaveDocument(JSON.parse(plainText), pendingSource);
      assertEnvelopePayloadCompatibility(envelope, parsed, pendingSource);
      await verifyBackupManifest(parsed, pendingSource);
      importStateCore(JSON.stringify(parsed));
    } catch (error) {
      showWelcomeSecurityError(`The password was accepted, but the saved planner data could not be restored: ${error.message || 'unsupported or damaged save data'}. Open a schema-12-or-newer compatible backup before choosing Start Fresh.`);
      input?.select();
      input?.focus();
      return false;
    }

    safeStorageSet('localStorage', WELCOME_SETUP_STORAGE_KEY, 'true');
    uiState.welcomeSecurityJustCompleted = false;
    uiState.suppressEncryptionPromptUntil = Date.now() + 120000;
    clearPending();
    uiState.appReady = true;
    uiState.linkedSaveLastSignature = currentSaveSignature();
    closeWelcomeSecurityModalCore();
    await ensureAppSnapshotsLoaded({ force: true });
    updateSaveHealthPanel();
    updateSecurityStatusPanel();
    schedulePageSettingsPersistence('settings');

    setLiveStatusMessage('Schema-compatible encrypted browser save unlocked and restored.');
    return true;
  }

  async function clearPersistedPlannerData() {
    uiState.startupRecoveryPending = true;
    uiState.browserSaveEpoch += 1;
    clearAutosaveSchedule();
    clearTimeout(uiState.pageSettingsPersistTimer);
    uiState.pageSettingsPersistTimer = null;
    try { await BrowserDataStore.removePrimarySave(); } catch (_) {}
    try { await BrowserDataStore.removeSnapshotIndex(); } catch (_) {}
    try { await BrowserDataStore.clearDatabase(); } catch (_) {}
    try { await deleteLinkedSaveDatabase(); } catch (_) {}
    clearPlannerWebStorage('localStorage');
    clearPlannerWebStorage('sessionStorage');
    window.AppAudit?.clearForFactoryReset?.();
    DistrictIntegrationsV57?.resetForFactoryReset?.();
    clearWrappedSessionEncryptionKeys();
    clearSameTabReloadSessionKey();
    clearFreeformGeometrySession();
    clearCachedPageLockSecretForSession();
  }

  async function beginFreshStart() {
    showInAppConfirm(
      'Erase this browser’s local planner data and start with a new encryption password? This permanently removes local charts, snapshots, Settings, Lock/Presentation PIN hashes, and cached save permissions. Downloaded files and Google Drive files are not deleted.',
      async () => {
        try {
          await clearPersistedPlannerData();
          resetInMemoryAppToFactory();
          clearPending();
          mode = 'fresh';
          uiState.welcomeSecurityJustCompleted = false;
          uiState.suppressEncryptionPromptUntil = 0;
          safeStorageRemove('localStorage', WELCOME_SETUP_STORAGE_KEY);
          openWelcomeSecurityModalCore();
          syncWelcomeUi();
          setLiveStatusMessage('Local planner data was erased. Create a new encryption password to begin.');
        } catch (error) {
          mode = 'recovery';
          uiState.startupRecoveryPending = true;
          openWelcomeSecurityModalCore();
          syncWelcomeUi();
          showWelcomeSecurityError(error.message || 'The browser could not clear all local planner data. Clear this site’s storage in browser settings before starting again.');
        }
      },
      { title: 'Erase Local Planner Data?', confirmText: 'Erase and Start Fresh', cancelText: 'Keep Trying' }
    );
  }

  async function prepareFreshKeySetup() {
     
    [PAGE_LOCK_CREDENTIAL_KEY, VISIBILITY_CREDENTIAL_KEY, SAVE_META_STORAGE_KEY, SAVE_SETUP_STORAGE_KEY, WELCOME_SETUP_STORAGE_KEY].forEach(key => safeStorageRemove('localStorage', key));
    clearPlannerWebStorage('sessionStorage');
    clearWrappedSessionEncryptionKeys();
    clearSameTabReloadSessionKey();
    clearCachedPageLockSecretForSession();
    uiState.pageSettings = mergePageSettings({ ...pageSettings(), settingsAccessMethod: 'auto' });
    applyPageSettings(uiState.pageSettings, { skipRender: true });
  }

  async function handlePrimaryAction() {
    if (isRecoveryMode()) return unlockPendingSave();
    await prepareFreshKeySetup();
    const result = await WorkflowExpansion.completeWelcomeSecuritySetup();
    return result;
  }

  function completeExternalLoad() {
    clearPending();
    mode = 'fresh';
  }

  function install() {
    if (installed) return;
    installed = true;
    document.body.classList.add('product-v45');
    document.body.dataset.productExperience = '4.6';
    el('welcomeStartFreshBtn')?.addEventListener('click', () => void beginFreshStart());
    new MutationObserver(() => {
      if (el('welcomeSecurityModal')?.classList.contains('show')) syncWelcomeUi();
    }).observe(el('welcomeSecurityModal'), { attributes: true, attributeFilter: ['class'] });
  }

  function afterReady() {
    syncWelcomeUi();
  }

  return Object.freeze({
    install,
    afterReady,
    inspectInitialSave,
    inspectStorageFailure,
    hasPendingSave,
    isRecoveryMode,
    syncWelcomeUi,
    handlePrimaryAction,
    beginFreshStart,
    completeExternalLoad
  });
})();

'use strict';

