const UserWorkflowV44 = (() => {
  let installed = false;

  function credentialExists(type) {
    if (type === 'lock') return !!getLockCredential();
    if (type === 'eye') return !!getVisibilityCredential();
    if (type === 'encryption') return !!currentSessionEncryptionKey();
    return false;
  }

  function setAccessMethod(method, announce = true) {
    const allowed = ['auto', 'lock', 'eye', 'encryption', 'none'];
    const next = allowed.includes(method) ? method : 'auto';
    uiState.pageSettings = mergePageSettings({ ...pageSettings(), settingsAccessMethod: next });
    applyPageSettings(uiState.pageSettings, { skipRender: true });
    schedulePageSettingsPersistence('settings');
    const select = el('settingSettingsAccessMethod');
    if (select) select.value = next;
    updatePageSettingsForm();
    updateSecurityStatusPanel();
    updatePinControlState();
    if (announce) setLiveStatusMessage(next === 'none' ? 'Settings access is unlocked.' : 'Settings access protection updated.');
    return next;
  }

  function onboardingMarkup() {
    return `
          <div class="modal v44-onboarding-modal">
            <div class="panel-header">
              <div><span class="v44-modal-eyebrow">Step 2 of 2</span><h2 id="gettingStartedTitle">Finish the important setup</h2></div>
              <button id="gettingStartedCloseBtn" class="tiny secondary" type="button">Close</button>
            </div>
            <div class="modal-body v44-getting-started-body">
              <p class="v44-getting-started-intro">Your encryption password is ready. Choose whether Settings should stay protected, then start the class setup. Everything else can wait until you need it.</p>
              <section class="v44-onboarding-card v44-security-choice-card">
                <div class="v44-card-heading"><span class="v44-step-badge">1</span><div><strong>Protect Settings</strong><p>Settings contains passwords, visibility controls, save locations, cleanup, and reset tools.</p></div></div>
                <label class="v44-protection-switch" for="v44ProtectSettingsToggle">
                  <input id="v44ProtectSettingsToggle" type="checkbox" />
                  <span><strong>Require a credential to open Settings</strong><small>Recommended on shared computers.</small></span>
                </label>
                <div id="v44ProtectionOptions" class="v44-protection-options">
                  <div class="field">
                    <label for="v44SettingsAccessMethod">Credential to use</label>
                    <select id="v44SettingsAccessMethod">
                      <option value="auto">Lock PIN when available, otherwise encryption password</option>
                      <option value="encryption">Encryption password only</option>
                      <option value="lock">Separate Lock / Unlock PIN</option>
                    </select>
                  </div>
                  <details id="v44OnboardingPinDetails" class="v44-pin-details">
                    <summary>Set or replace a separate Lock / Unlock PIN</summary>
                    <div class="v44-pin-grid">
                      <div class="field"><label for="v44OnboardingLockPin">PIN or password</label><input id="v44OnboardingLockPin" type="password" autocomplete="new-password" minlength="${MIN_LOCAL_CREDENTIAL_LENGTH}" maxlength="${MAX_LOCAL_CREDENTIAL_LENGTH}" /></div>
                      <div class="field"><label for="v44OnboardingLockPinConfirm">Confirm PIN or password</label><input id="v44OnboardingLockPinConfirm" type="password" autocomplete="new-password" minlength="${MIN_LOCAL_CREDENTIAL_LENGTH}" maxlength="${MAX_LOCAL_CREDENTIAL_LENGTH}" /></div>
                    </div>
                    <div class="muted">Use at least ${MIN_LOCAL_CREDENTIAL_LENGTH} characters. This PIN can unlock the page and can be selected as the Settings credential.</div>
                  </details>
                </div>
                <div class="v44-security-choice-actions"><span class="muted">Protection choices save automatically.</span></div>
                <div id="v44OnboardingSecurityStatus" class="v44-inline-status" aria-live="polite"></div>
              </section>
              <div class="v44-next-step-grid">
                <section class="v44-onboarding-card"><div class="v44-card-heading"><span class="v44-step-badge">2</span><div><strong>Create the class</strong><p>Add students, rules, and the room. This is the normal next step.</p></div></div><button id="gettingStartedDoneBtn" type="button">Start class setup</button></section>
                <section class="v44-onboarding-card"><div class="v44-card-heading"><span class="v44-step-badge">3</span><div><strong>Choose durable saving</strong><p>Browser autosave works now. A linked file, Drive copy, or backup protects against browser cleanup.</p></div></div><button type="button" class="secondary" data-v44-start="save">Review save options</button></section>
              </div>
              <div class="v44-start-footer"><span>Later: <button type="button" class="v44-text-button" data-v44-start="appearance">Appearance</button> and advanced security remain in Settings.</span></div>
            </div>
          </div>`;
  }

  function queueOnboardingSecuritySave(task) {
    uiState.onboardingSecuritySavePromise = Promise.resolve().then(task).catch(error => {
      onboardingStatus(error?.message || 'The Settings access choice could not be saved.', 'bad');
      return false;
    });
  }

  function upgradeGettingStartedModal() {
    const modal = el('gettingStartedModal');
    if (!modal) return;
    if (modal.dataset.v44Upgraded === 'true') return;
    modal.dataset.v44Upgraded = 'true';
    modal.innerHTML = onboardingMarkup();
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('#gettingStartedCloseBtn')) {
        ProductRepairV43.closeGettingStarted();
        return;
      }
      if (event.target.closest('#v44SaveSecurityChoiceBtn')) {
        void saveOnboardingSecurityChoice();
        return;
      }
      if (event.target.closest('#gettingStartedDoneBtn')) {
        void completeOnboardingToSetup();
        return;
      }
      const action = event.target.closest('[data-v44-start]')?.dataset.v44Start;
      if (action) void handleOnboardingAction(action);
    });
    new MutationObserver(() => {
      if (modal.classList.contains('show')) {
        syncOnboardingControls();
        setTimeout(() => el('v44ProtectSettingsToggle')?.focus({ preventScroll: true }), 40);
      }
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    el('v44ProtectSettingsToggle')?.addEventListener('change', event => {
      syncOnboardingProtectionVisibility();
      const saveTask = async () => {
        if (!event.target.checked) {
          setAccessMethod('none', false);
          onboardingStatus('Settings access is unlocked and the choice was saved automatically. You can turn protection back on from Settings → Security.', 'warn');
          await writeLocalBrowserSave({ reason: 'onboarding-settings-access', announce: false });
          return true;
        }
        return saveOnboardingSecurityChoice();
      };
      queueOnboardingSecuritySave(saveTask);
    });
    el('v44SettingsAccessMethod')?.addEventListener('change', () => {
      syncOnboardingProtectionVisibility();
      queueOnboardingSecuritySave(saveOnboardingSecurityChoice);
    });
    syncOnboardingControls();
  }

  function syncOnboardingControls() {
    const method = pageSettings().settingsAccessMethod || 'auto';
    const protect = method !== 'none';
    const toggle = el('v44ProtectSettingsToggle');
    const select = el('v44SettingsAccessMethod');
    if (toggle) toggle.checked = protect;
    if (select) select.value = ['auto', 'lock', 'encryption'].includes(method) ? method : 'auto';
    const details = el('v44OnboardingPinDetails');
    if (details && getLockCredential()) details.querySelector('summary').textContent = 'Replace the existing Lock / Unlock PIN';
    syncOnboardingProtectionVisibility();
    const status = el('v44OnboardingSecurityStatus');
    if (status) {
      if (!protect) status.textContent = 'Settings is currently unlocked. Anyone using the open page can change security and reset options.';
      else if (method === 'lock' && getLockCredential()) status.textContent = 'Settings is protected with the Lock / Unlock PIN.';
      else if (method === 'encryption') status.textContent = 'Settings is protected with the encryption password.';
      else status.textContent = getLockCredential() ? 'Settings uses the Lock PIN first, then the encryption password.' : 'Settings uses the encryption password until a separate Lock PIN is created.';
    }
  }

  function syncOnboardingProtectionVisibility() {
    const protect = !!el('v44ProtectSettingsToggle')?.checked;
    const method = el('v44SettingsAccessMethod')?.value || 'auto';
    const options = el('v44ProtectionOptions');
    if (options) options.hidden = !protect;
    const details = el('v44OnboardingPinDetails');
    if (details && protect && method === 'lock' && !getLockCredential()) details.open = true;
  }

  function onboardingStatus(message, kind = '') {
    const node = el('v44OnboardingSecurityStatus');
    if (!node) return;
    node.textContent = String(message || '');
    node.dataset.kind = kind;
  }

  async function saveOnboardingSecurityChoice() {
    const protect = !!el('v44ProtectSettingsToggle')?.checked;
    if (!protect) {
      setAccessMethod('none', false);
      onboardingStatus('Settings will open without a PIN or password. You can turn protection back on from Settings → Security.', 'warn');
      return true;
    }
    const method = el('v44SettingsAccessMethod')?.value || 'auto';
    const pin = String(el('v44OnboardingLockPin')?.value || '');
    const confirmPin = String(el('v44OnboardingLockPinConfirm')?.value || '');
    if (pin || confirmPin) {
      const pinValidation = newLocalCredentialValidationMessage(pin, 'Lock / Unlock PIN');
      if (pinValidation) { onboardingStatus(pinValidation, 'bad'); return false; }
      if (pin !== confirmPin) { onboardingStatus('The Lock / Unlock PIN entries do not match.', 'bad'); return false; }
      try {
        await savePageLockCredential(pin);
        const verified = await verifyPageLockSecret(pin);
        if (!verified) throw new Error('The saved PIN could not be verified.');
        cachePageLockSecretForSession(pin);
        el('v44OnboardingLockPin').value = '';
        el('v44OnboardingLockPinConfirm').value = '';
      } catch (error) {
        onboardingStatus(error.message || 'The Lock / Unlock PIN could not be saved.', 'bad');
        return false;
      }
    }
    if (method === 'lock' && !getLockCredential()) {
      onboardingStatus('Set a Lock / Unlock PIN before selecting PIN-only Settings access.', 'bad');
      el('v44OnboardingPinDetails')?.setAttribute('open', '');
      return false;
    }
    if (method === 'encryption' && !currentSessionEncryptionKey()) {
      onboardingStatus('The encryption password is not active in this session. Choose the automatic option or create a Lock PIN.', 'bad');
      return false;
    }
    setAccessMethod(method, false);
    updatePinControlState();
    onboardingStatus(method === 'lock' ? 'Settings protection saved. Use the Lock / Unlock PIN to open Settings.' : method === 'encryption' ? 'Settings protection saved. Use the encryption password to open Settings.' : getLockCredential() ? 'Settings protection saved. The Lock PIN will be tried first.' : 'Settings protection saved. The encryption password will be used.', 'good');
    return true;
  }

  async function completeOnboardingToSetup() {
    if (!await saveOnboardingSecurityChoice()) return;
    ProductRepairV43.closeGettingStarted();
    ProductExperience.setWorkflow('setup');
    WorkspaceLayoutV41.toggleFocusMode(false);
    WorkspaceLayoutV41.toggleWorkflow(false);
    WorkspaceLayoutV41.togglePanel('left', false);
    setSideTab('students');
    setTimeout(() => (el('firstName') || el('studentList'))?.focus?.(), 90);
  }

  async function handleOnboardingAction(action) {
    if (!await saveOnboardingSecurityChoice()) return;
    ProductRepairV43.closeGettingStarted();
    if (action === 'save') {
      ProductExperience.setWorkflow('share');
      setTimeout(() => el('inlineSaveStatus')?.focus({ preventScroll: true }), 80);
      return;
    }
    if (action === 'appearance') {
      uiState.activeSettingsPage = 'appearance';
      requestOpenSettingsModal();
      setTimeout(() => { if (el('settingsModal')?.classList.contains('show')) setSettingsPage('appearance'); }, 80);
    }
  }

  function findSettingsSection(title) {
    return Array.from(document.querySelectorAll('#settingsPageSecurity .settings-section')).find(section => section.querySelector('h3')?.textContent.trim() === title) || null;
  }

  function reorganizeSecurityPage() {
    const page = el('settingsPageSecurity');
    if (!page) return;
    const header = page.querySelector('.settings-page-header');
    const orderedTitles = ['Settings Access', 'Lock / Presentation PINs', 'Unlock PINs', 'Lock Immediately After Inactivity', 'Security Status', 'Security Guided Help', 'Lock Workflow Readiness'];
    let anchor = header;
    orderedTitles.forEach(title => {
      const section = findSettingsSection(title);
      if (!section || !anchor) return;
      anchor.insertAdjacentElement('afterend', section);
      anchor = section;
    });
    const pinSection = findSettingsSection('Lock / Presentation PINs');
    if (pinSection) { const heading = pinSection.querySelector('h3'); if (heading) heading.textContent = 'Unlock PINs'; }
    const securityTab = el('settingsPageSecurityBtn');
    securityTab?.querySelector('.settings-page-title')?.replaceChildren(document.createTextNode('Security'));
    const securityDesc = securityTab?.querySelector('.settings-page-desc');
    if (securityDesc) securityDesc.textContent = 'Settings protection, unlock PINs, Presentation Mode credentials, and auto-lock.';
    if (header) header.innerHTML = '<strong>Security and access</strong>Choose who can open Settings, manage unlock credentials, and configure automatic locking.';
    const roomTab = el('settingsPageRoomBtn');
    const roomDesc = roomTab?.querySelector('.settings-page-desc');
    if (roomDesc) roomDesc.textContent = 'Custom right-click room objects.';
    const roomHeader = el('settingsPageRoom')?.querySelector('.settings-page-header');
    if (roomHeader) roomHeader.innerHTML = '<strong>Room objects</strong>Create custom right-click objects used while designing the classroom.';
    const maintenanceTab = document.querySelector('[data-settings-nav="maintenance"]');
    const maintenanceDesc = maintenanceTab?.querySelector('.settings-page-desc');
    if (maintenanceDesc) maintenanceDesc.textContent = 'Sample data, diagnostics, repair, cleanup, and factory reset.';
  }

  function installSettingsProtectionToggle() {
    const select = el('settingSettingsAccessMethod');
    const section = select?.closest('.settings-section');
    if (!select || !section) return;
    if (!el('settingsProtectionToggle')) {
      const label = document.createElement('label');
      label.className = 'v44-protection-switch v44-settings-protection-switch';
      label.htmlFor = 'settingsProtectionToggle';
      label.innerHTML = '<input id="settingsProtectionToggle" type="checkbox" /><span><strong>Protect Settings</strong><small>Require a PIN or password before security, saving, cleanup, and reset controls can be changed.</small></span>';
      const hint = section.querySelector('.hint');
      hint?.insertAdjacentElement('afterend', label);
      label.querySelector('input')?.addEventListener('change', event => {
        if (event.target.checked) {
          setAccessMethod('auto');
          return;
        }
        event.target.checked = true;
        showInAppConfirm('Leave Settings unlocked? Anyone using this open page could change security, save, cleanup, and reset options.', () => setAccessMethod('none'), {
          title: 'Disable Settings Protection?', confirmText: 'Leave Settings Unlocked', cancelText: 'Keep Protected'
        });
      });
    }
    if (!select.dataset.v44Validated) {
      select.dataset.v44Validated = 'true';
      select.addEventListener('input', event => {
        const method = select.value;
        let problem = '';
        if (method === 'lock' && !getLockCredential()) problem = 'Set a Lock / Unlock PIN before selecting PIN-only Settings access.';
        if (method === 'eye' && !getVisibilityCredential()) problem = 'Set an Presentation Mode PIN before selecting Presentation-PIN-only Settings access.';
        if (method === 'encryption' && !currentSessionEncryptionKey()) problem = 'Enter the encryption password for this session before selecting encryption-only Settings access.';
        if (!problem) return;
        event.stopImmediatePropagation();
        select.value = pageSettings().settingsAccessMethod || 'auto';
        const status = el('settingsAccessStatus');
        if (status) status.textContent = problem;
        setLiveStatusMessage(problem);
      }, true);
    }
  }

  function enhancePinCard(type) {
    const lock = type === 'lock';
    const saveId = lock ? 'settingsSaveLockPinBtn' : 'settingsSaveVisibilityPinBtn';
    const card = el(saveId)?.closest('.security-card');
    if (!card || card.dataset.v44Enhanced === 'true') return;
    card.dataset.v44Enhanced = 'true';
    const saveButton = el(saveId);
    const row = document.createElement('div');
    row.className = 'button-row v44-pin-button-row';
    saveButton?.insertAdjacentElement('beforebegin', row);
    if (saveButton) row.appendChild(saveButton);
    row.insertAdjacentHTML('beforeend', `<button id="${lock ? 'settingsTestLockPinBtn' : 'settingsTestVisibilityPinBtn'}" class="secondary" type="button">Test entered PIN</button><button id="${lock ? 'settingsRemoveLockPinBtn' : 'settingsRemoveVisibilityPinBtn'}" class="ghost" type="button">Remove PIN</button>`);
    card.insertAdjacentHTML('beforeend', `<div id="${lock ? 'settingsLockPinCardStatus' : 'settingsVisibilityPinCardStatus'}" class="muted v44-pin-card-status"></div>`);
  }

  function updatePinControlState() {
    const lockSet = !!getLockCredential();
    const eyeSet = !!getVisibilityCredential();
    const lockRemove = el('settingsRemoveLockPinBtn');
    const eyeRemove = el('settingsRemoveVisibilityPinBtn');
    if (lockRemove) lockRemove.disabled = !lockSet;
    if (eyeRemove) eyeRemove.disabled = !eyeSet;
    const lockStatus = el('settingsLockPinCardStatus');
    const eyeStatus = el('settingsVisibilityPinCardStatus');
    if (lockStatus) lockStatus.textContent = lockSet ? 'A Lock / Unlock PIN is set. Enter it above to test it, or enter matching new values to replace it.' : 'No Lock / Unlock PIN is set. The encryption password can still protect Settings when automatic access is selected.';
    if (eyeStatus) eyeStatus.textContent = eyeSet ? 'An Presentation Mode exit PIN is set. Enter it above to test it, or enter matching new values to replace it.' : lockSet ? 'No separate Presentation PIN is set. Presentation Mode can fall back to the Lock PIN.' : 'No Presentation Mode PIN is set.';
    const protectionToggle = el('settingsProtectionToggle');
    if (protectionToggle) protectionToggle.checked = (pageSettings().settingsAccessMethod || 'auto') !== 'none';
    const status = el('settingsAccessStatus');
    if (status) status.textContent = settingsAccessRequirementText();
  }

  async function testEnteredPin(type) {
    const lock = type === 'lock';
    const input = el(lock ? 'settingsLockPin' : 'settingsVisibilityPin');
    const value = String(input?.value || '');
    if (!credentialExists(type)) { updatePinStatus(`No ${lock ? 'Lock / Unlock' : 'Presentation Mode'} PIN is currently set.`); return; }
    if (!value) { updatePinStatus(`Enter the current ${lock ? 'Lock / Unlock' : 'Presentation Mode'} PIN in the first field, then choose Test entered PIN.`); input?.focus(); return; }
    try {
      const ok = lock ? await verifyPageLockSecret(value) : await verifyHashedCredential(VISIBILITY_CREDENTIAL_KEY, value);
      updatePinStatus(ok ? `${lock ? 'Lock / Unlock' : 'Presentation Mode'} PIN verified successfully.` : `Incorrect ${lock ? 'Lock / Unlock' : 'Presentation Mode'} PIN.`);
      if (ok && lock) cachePageLockSecretForSession(value);
      if (!ok) input?.select();
    } catch (error) {
      updatePinStatus(error.message || 'The PIN could not be verified.');
    }
  }

  function removePin(type) {
    const lock = type === 'lock';
    if (!credentialExists(type)) return;
    showInAppConfirm(`Remove the saved ${lock ? 'Lock / Unlock' : 'Presentation Mode'} PIN?`, () => {
      safeStorageRemove('localStorage', lock ? PAGE_LOCK_CREDENTIAL_KEY : VISIBILITY_CREDENTIAL_KEY);
      if (lock) clearCachedPageLockSecretForSession();
      const current = pageSettings().settingsAccessMethod || 'auto';
      if ((lock && current === 'lock') || (!lock && current === 'eye')) {
        const fallback = currentSessionEncryptionKey() ? 'encryption' : 'auto';
        setAccessMethod(fallback, false);
      }
      updatePinStatus(`${lock ? 'Lock / Unlock' : 'Presentation Mode'} PIN removed.`);
      updateVisibilityCredentialNote();
      updateSecurityStatusPanel();
      updatePinControlState();
      setLiveStatusMessage(`${lock ? 'Lock / Unlock' : 'Presentation Mode'} PIN removed.`);
    }, { title: `Remove ${lock ? 'Lock' : 'Eye'} PIN?`, confirmText: 'Remove PIN', cancelText: 'Keep PIN' });
  }

  function installPinEvents() {
    enhancePinCard('lock');
    enhancePinCard('eye');
    el('settingsTestLockPinBtn')?.addEventListener('click', () => void testEnteredPin('lock'));
    el('settingsTestVisibilityPinBtn')?.addEventListener('click', () => void testEnteredPin('eye'));
    el('settingsRemoveLockPinBtn')?.addEventListener('click', () => removePin('lock'));
    el('settingsRemoveVisibilityPinBtn')?.addEventListener('click', () => removePin('eye'));
    el('settingsSaveLockPinBtn')?.addEventListener('click', () => setTimeout(updatePinControlState, 650));
    el('settingsSaveVisibilityPinBtn')?.addEventListener('click', () => setTimeout(updatePinControlState, 650));
  }

  function moveMaintenanceTools() {
    const slot = el('maintenanceToolSlot');
    const sample = el('settingsSampleBtn');
    const diagnostics = el('deploymentDiagnosticsBtn');
    if (slot) {
      if (sample && sample.parentElement !== slot) slot.appendChild(sample);
      if (diagnostics && diagnostics.parentElement !== slot) slot.appendChild(diagnostics);
    }
    const sampleSection = Array.from(document.querySelectorAll('#settingsPageRoom .settings-section')).find(section => section.querySelector('#settingsSampleBtn'));
    if (sampleSection && !sampleSection.querySelector('button')) sampleSection.remove();
  }

  function observeSettingsModal() {
    const modal = el('settingsModal');
    if (!modal || modal.dataset.v44Observed === 'true') return;
    modal.dataset.v44Observed = 'true';
    new MutationObserver(() => {
      if (modal.classList.contains('show')) {
        reorganizeSecurityPage();
        moveMaintenanceTools();
        updatePinControlState();
      }
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  function install() {
    if (installed) return;
    installed = true;
    document.body.classList.add('product-v44');
    document.body.dataset.productExperience = '4.4';
    document.body.dataset.workspaceExperience = '4.4';
    upgradeGettingStartedModal();
    reorganizeSecurityPage();
    moveMaintenanceTools();
    installSettingsProtectionToggle();
    installPinEvents();
    observeSettingsModal();
    updatePinControlState();
  }

  function afterReady() {
    upgradeGettingStartedModal();
    reorganizeSecurityPage();
    moveMaintenanceTools();
    installSettingsProtectionToggle();
    installPinEvents();
    updatePinControlState();
    syncOnboardingControls();
  }

  return Object.freeze({ install, afterReady, updatePinControlState, saveOnboardingSecurityChoice });
})();

