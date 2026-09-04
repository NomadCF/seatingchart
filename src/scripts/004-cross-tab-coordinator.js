const CrossTabCoordinator = (() => {
  const instanceId = uid('tab');
  let installed = false;
  let takeover = false;
  let heartbeatTimer = null;
  let channel = null;

  function readLease() {
    try {
      const parsed = JSON.parse(safeStorageGet('localStorage', APP_TAB_LEASE_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object' || !parsed.instanceId) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function leaseIsActive(lease) {
    return Boolean(lease?.instanceId && Number(lease.updatedAt || 0) > Date.now() - APP_TAB_LEASE_TIMEOUT_MS);
  }

  function activeForeignLease() {
    const lease = readLease();
    return leaseIsActive(lease) && lease.instanceId !== instanceId ? lease : null;
  }

  function updateBanner() {
    const banner = el('concurrentTabBanner');
    if (!banner) return;
    const show = uiState.concurrentTabDetected && !takeover;
    banner.hidden = !show;
    document.body.classList.toggle('concurrent-tab-warning-visible', show);
    const text = el('concurrentTabBannerText');
    if (text) text.textContent = show
      ? 'This planner is open in another tab. Automatic and manual working-file saves are paused here to prevent one tab from overwriting the other.'
      : '';
  }

  function markConflict(lease) {
    if (!lease || lease.instanceId === instanceId || takeover) return false;
    uiState.concurrentTabDetected = true;
    uiState.concurrentTabOwner = String(lease.instanceId || '');
    uiState.concurrentTabLastSeenAt = Number(lease.updatedAt || Date.now());
    updateBanner();
    return true;
  }

  function clearConflict() {
    uiState.concurrentTabDetected = false;
    uiState.concurrentTabOwner = '';
    uiState.concurrentTabLastSeenAt = 0;
    updateBanner();
  }

  function publish(message) {
    try { channel?.postMessage?.({ ...message, instanceId, at: Date.now() }); } catch (_) {   }
  }

  function writeLease() {
    const foreign = activeForeignLease();
    if (foreign && !takeover) {
      markConflict(foreign);
      return false;
    }
    const lease = { instanceId, updatedAt: Date.now(), activeClassId: String(state.activeClassId || ''), version: APP_REVISION };
    if (!safeStorageSet('localStorage', APP_TAB_LEASE_KEY, JSON.stringify(lease))) return false;
    clearConflict();
    publish({ type: takeover ? 'takeover' : 'heartbeat' });
    return true;
  }

  function canWrite(options = {}) {
    const foreign = activeForeignLease();
    if (foreign && !takeover) {
      markConflict(foreign);
      if (options.announce !== false) setLiveStatusMessage('Save paused because another tab is actively using this planner. Close the other tab or choose Take Over Here.');
      return false;
    }
    return writeLease();
  }

  function hasUnsavedWork() {
    if (!uiState.appReady || uiState.pageLocked || uiState.startupRecoveryPending) return false;
    if (uiState.autosaveDirtySince) return true;
    return currentSaveSignature() !== uiState.linkedSaveLastSignature;
  }

  async function createTakeoverSafetyBackup() {
    if (!hasUnsavedWork()) return null;
    const name = `Safety copy before tab takeover - ${new Date().toLocaleString()}`;
    const record = await createAppSnapshotWithName(name, { silent: true, automatic: false, reason: 'tab-takeover' });
    if (record) {
      safeStorageSet('sessionStorage', TAB_TAKEOVER_BACKUP_SESSION_KEY, JSON.stringify({
        id: record.id,
        name: record.name,
        createdAt: record.createdAt,
        reason: record.reason,
        data: record.data,
        signature: record.signature
      }));
    }
    return record;
  }

  async function takeOver() {
    let backup = null;
    try {
      backup = await createTakeoverSafetyBackup();
    } catch (error) {
      setLiveStatusMessage(`Takeover was cancelled because the safety backup could not be created: ${error?.message || error}`);
      return false;
    }
    takeover = true;
    clearConflict();
    safeStorageRemove('localStorage', APP_TAB_LEASE_KEY);
    writeLease();
    setLiveStatusMessage(backup
      ? `Safety snapshot saved as “${backup.name}”. This tab is now the active editing tab.`
      : 'This tab is now the active editing tab. The other tab will pause its saves.');
    scheduleLinkedAutoSave('tab-takeover');
    return true;
  }

  function release() {
    const lease = readLease();
    if (lease?.instanceId === instanceId) safeStorageRemove('localStorage', APP_TAB_LEASE_KEY);
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    try { channel?.close?.(); } catch (_) {   }
    channel = null;
  }

  function resetForFactoryReset() {
    takeover = true;
    safeStorageRemove('localStorage', APP_TAB_LEASE_KEY);
    clearConflict();
    writeLease();
  }

  function install() {
    if (installed) return;
    installed = true;
    uiState.tabInstanceId = instanceId;
    el('concurrentTabTakeOverBtn')?.addEventListener('click', () => { void takeOver(); });
    el('concurrentTabReloadBtn')?.addEventListener('click', () => location.reload());
    window.addEventListener('storage', event => {
      if (event.key !== APP_TAB_LEASE_KEY) return;
      const foreign = activeForeignLease();
      if (foreign) markConflict(foreign);
      else if (!takeover) writeLease();
    });
    if ('BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel(APP_TAB_CHANNEL_NAME);
        channel.addEventListener('message', event => {
          const message = event.data || {};
          if (!message.instanceId || message.instanceId === instanceId) return;
          const foreign = activeForeignLease();
          if (foreign) markConflict(foreign);
        });
      } catch (_) { channel = null; }
    }
    const foreign = activeForeignLease();
    if (foreign) markConflict(foreign);
    else writeLease();
    heartbeatTimer = setInterval(writeLease, APP_TAB_HEARTBEAT_MS);
    window.addEventListener('pagehide', release, { once: true });
  }

  return Object.freeze({ install, canWrite, takeOver, hasUnsavedWork, createTakeoverSafetyBackup, release, resetForFactoryReset, instanceId: () => instanceId });
})();

