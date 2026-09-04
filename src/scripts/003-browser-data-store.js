const BrowserDataStore = (() => {
  let databasePromise = null;
  let databaseHandle = null;
  let databaseOpenError = '';

  function closeDatabaseConnection() {
    const db = databaseHandle;
    databaseHandle = null;
    databasePromise = null;
    if (!db) return;
    try { db.close(); } catch (_) {   }
  }

  function openDatabase() {
    if (databaseHandle) return Promise.resolve(databaseHandle);
    if (databasePromise) return databasePromise;
    databaseOpenError = '';
    databasePromise = new Promise(resolve => {
      if (!window.indexedDB) {
        databaseOpenError = 'IndexedDB is not available in this browser context.';
        resolve(null);
        return;
      }
      try {
        const request = indexedDB.open(APP_DATABASE_NAME, APP_DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(APP_DATABASE_STORE)) db.createObjectStore(APP_DATABASE_STORE, { keyPath: 'key' });
        };
        request.onsuccess = () => {
          databaseHandle = request.result;
          databaseHandle.onversionchange = () => closeDatabaseConnection();
          if ('onclose' in databaseHandle) databaseHandle.onclose = () => {
            if (databaseHandle === request.result) {
              databaseHandle = null;
              databasePromise = null;
            }
          };
          resolve(databaseHandle);
        };
        request.onerror = () => {
          databaseOpenError = request.error?.message || 'IndexedDB could not be opened.';
          databasePromise = null;
          resolve(null);
        };
        request.onblocked = () => {
          databaseOpenError = 'IndexedDB access is blocked by another open tab or connection.';
          databasePromise = null;
          resolve(null);
        };
      } catch (err) {
        databaseOpenError = err?.message || 'IndexedDB could not be opened.';
        databasePromise = null;
        resolve(null);
      }
    });
    return databasePromise;
  }

  async function putRecord(key, value, extra = {}) {
    const db = await openDatabase();
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(APP_DATABASE_STORE, 'readwrite');
        tx.objectStore(APP_DATABASE_STORE).put({ key, value, updatedAt: new Date().toISOString(), ...extra });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (err) {
        databaseOpenError = err?.message || databaseOpenError;
        resolve(false);
      }
    });
  }

  async function putPrimarySaveAtomically(payload) {
    const db = await openDatabase();
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(APP_DATABASE_STORE, 'readwrite');
        const store = tx.objectStore(APP_DATABASE_STORE);
        const currentRequest = store.get(APP_PRIMARY_SAVE_KEY);
        currentRequest.onerror = () => tx.abort();
        currentRequest.onsuccess = () => {
          const updatedAt = new Date().toISOString();
          const current = currentRequest.result;
          if (current?.value && String(current.value) !== String(payload)) {
            store.put({
              ...current,
              key: APP_PRIMARY_SAVE_BACKUP_KEY,
              kind: 'primary-save-backup',
              backedUpAt: updatedAt,
              updatedAt
            });
          }
          store.put({ key: APP_PRIMARY_SAVE_KEY, value: String(payload || ''), kind: 'primary-save', updatedAt });
        };
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (err) {
        databaseOpenError = err?.message || databaseOpenError;
        resolve(false);
      }
    });
  }

  async function getRecord(key) {
    const db = await openDatabase();
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(APP_DATABASE_STORE, 'readonly');
        const request = tx.objectStore(APP_DATABASE_STORE).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch (err) {
        databaseOpenError = err?.message || databaseOpenError;
        resolve(null);
      }
    });
  }

  async function deleteRecord(key) {
    const db = await openDatabase();
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(APP_DATABASE_STORE, 'readwrite');
        tx.objectStore(APP_DATABASE_STORE).delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (err) {
        resolve(false);
      }
    });
  }

  function payloadMarker(payload, key) {
    let parsed = null;
    try { parsed = JSON.parse(payload); } catch (err) { parsed = null; }
    return JSON.stringify({
      format: BROWSER_STORAGE_MARKER_FORMAT,
      app: APP_NAME,
      version: APP_REVISION,
      dataSchemaVersion: DATA_SCHEMA_VERSION,
      minimumReaderSchemaVersion: MIN_SUPPORTED_DATA_SCHEMA_VERSION,
      indexedDb: true,
      database: APP_DATABASE_NAME,
      key,
      encrypted: Boolean(parsed?.encrypted),
      snapshotIndexEncrypted: Boolean(parsed?.snapshotIndexEncrypted),
      exportScope: parsed?.exportScope || parsed?.scope || 'all-classes',
      updatedAt: new Date().toISOString()
    });
  }

  function parseStorageMarker(value, expectedKey) {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      if (isSupportedBrowserStorageMarker(parsed, expectedKey)) return parsed;
    } catch (_) {   }
    return null;
  }

  async function setPrimarySave(payload) {
    const text = String(payload || '');
    const stored = await putPrimarySaveAtomically(text);
    if (stored) {
      safeStorageSet('localStorage', STORAGE_KEY, payloadMarker(text, APP_PRIMARY_SAVE_KEY));
      safeStorageRemove('localStorage', STORAGE_PENDING_KEY);
      return true;
    }
    const previous = safeStorageGet('localStorage', STORAGE_KEY) || '';
    if (previous && !parseStorageMarker(previous, APP_PRIMARY_SAVE_KEY)) safeStorageSet('localStorage', STORAGE_BACKUP_KEY, previous);
    if (!safeStorageSet('localStorage', STORAGE_PENDING_KEY, text)) return false;
    if (!safeStorageSet('localStorage', STORAGE_KEY, text)) return false;
    safeStorageRemove('localStorage', STORAGE_PENDING_KEY);
    return true;
  }

  function currentStoredPayloadCandidate(payload, sourceLabel = 'browser save') {
    const text = String(payload || '');
    if (!text) return { valid: false, error: 'The stored payload is empty.' };
    try {
      const parsed = JSON.parse(text);
      if (parsed?.encrypted) assertSupportedEncryptedEnvelope(parsed, sourceLabel);
      else assertSupportedSaveDocument(parsed, sourceLabel);
      return { valid: true, error: '' };
    } catch (error) {
      return { valid: false, error: error.message || String(error) };
    }
  }

  async function getPrimarySaveDetailed() {
    const fallback = safeStorageGet('localStorage', STORAGE_KEY) || '';
    const pendingFallback = safeStorageGet('localStorage', STORAGE_PENDING_KEY) || '';
    const backupFallback = safeStorageGet('localStorage', STORAGE_BACKUP_KEY) || '';
    const marker = parseStorageMarker(fallback, APP_PRIMARY_SAVE_KEY);
    let unsupportedError = '';
    let unsupportedSource = '';
    const consider = (payload, source, recovered, recoveryMessage) => {
      const candidate = currentStoredPayloadCandidate(payload, source);
      if (candidate.valid) return { status: 'ok', payload: String(payload), source, marker, recovered, error: recoveryMessage || '' };
      if (!unsupportedError) {
        unsupportedError = candidate.error;
        unsupportedSource = source;
      }
      return null;
    };
    const record = await getRecord(APP_PRIMARY_SAVE_KEY);
    if (record?.value) {
      const result = consider(record.value, 'indexeddb', false, '');
      if (result) return result;
    }
    if (fallback && !marker) {
      const result = consider(fallback, 'localstorage', false, '');
      if (result) return result;
    }
    if (pendingFallback && !parseStorageMarker(pendingFallback)) {
      const result = consider(pendingFallback, 'localstorage-pending', true, 'Recovered an interrupted browser save from its pending write record.');
      if (result) return result;
    }
    const backupRecord = await getRecord(APP_PRIMARY_SAVE_BACKUP_KEY);
    if (backupRecord?.value) {
      const result = consider(backupRecord.value, 'indexeddb-backup', true, 'Recovered the previous verified browser save because the current IndexedDB record was unavailable.');
      if (result) return result;
    }
    if (backupFallback && !parseStorageMarker(backupFallback)) {
      const result = consider(backupFallback, 'localstorage-backup', true, 'Recovered the previous browser save from local backup storage.');
      if (result) return result;
    }
    if (unsupportedError) {
      return {
        status: 'unsupported-format',
        payload: '',
        source: unsupportedSource,
        marker,
        recovered: false,
        error: unsupportedError
      };
    }
    if (marker) {
      const status = databaseOpenError ? 'storage-unavailable' : 'missing-record';
      return {
        status,
        payload: '',
        source: 'indexeddb-marker',
        marker,
        recovered: false,
        error: databaseOpenError || 'The browser save marker exists, but its IndexedDB record and recovery backup are missing.'
      };
    }
    return { status: 'none', payload: '', source: '', marker: null, recovered: false, error: databaseOpenError || '' };
  }

  async function getPrimarySave() {
    const result = await getPrimarySaveDetailed();
    return result.status === 'ok' ? result.payload : '';
  }

  async function setSnapshotIndex(payload) {
    const stored = await putRecord(APP_SNAPSHOT_INDEX_KEY, String(payload || ''), { kind: 'snapshot-index' });
    if (stored) {
      safeStorageSet('localStorage', LOCAL_AUTOSAVE_SNAPSHOT_KEY, payloadMarker(payload, APP_SNAPSHOT_INDEX_KEY));
      return true;
    }
    return safeStorageSet('localStorage', LOCAL_AUTOSAVE_SNAPSHOT_KEY, String(payload || ''));
  }

  async function getSnapshotIndex() {
    const record = await getRecord(APP_SNAPSHOT_INDEX_KEY);
    if (record?.value) return String(record.value);
    const fallback = safeStorageGet('localStorage', LOCAL_AUTOSAVE_SNAPSHOT_KEY);
    if (!fallback) return '';
    if (parseStorageMarker(fallback, APP_SNAPSHOT_INDEX_KEY)) return '';
    return fallback;
  }

  async function removePrimarySave() {
    await deleteRecord(APP_PRIMARY_SAVE_KEY);
    await deleteRecord(APP_PRIMARY_SAVE_BACKUP_KEY);
    safeStorageRemove('localStorage', STORAGE_KEY);
    safeStorageRemove('localStorage', STORAGE_BACKUP_KEY);
    safeStorageRemove('localStorage', STORAGE_PENDING_KEY);
  }

  async function removeSnapshotIndex() {
    await deleteRecord(APP_SNAPSHOT_INDEX_KEY);
    safeStorageRemove('localStorage', LOCAL_AUTOSAVE_SNAPSHOT_KEY);
  }

  function deleteDatabaseAttempt() {
    return new Promise(resolve => {
      if (!window.indexedDB) { resolve('unavailable'); return; }
      try {
        const request = indexedDB.deleteDatabase(APP_DATABASE_NAME);
        request.onsuccess = () => resolve('deleted');
        request.onerror = () => resolve('error');
        request.onblocked = () => resolve('blocked');
      } catch (err) {
        resolve('error');
      }
    });
  }

  async function verifyDatabaseDeleted() {
    if (!window.indexedDB) return true;
    if (typeof indexedDB.databases !== 'function') return true;
    try {
      const databases = await indexedDB.databases();
      return !databases.some(item => item?.name === APP_DATABASE_NAME);
    } catch (_) {
      return true;
    }
  }

  async function clearDatabase() {
    closeDatabaseConnection();
    let result = await deleteDatabaseAttempt();
    if (result === 'blocked') {
      await new Promise(resolve => setTimeout(resolve, 80));
      closeDatabaseConnection();
      result = await deleteDatabaseAttempt();
    }
    const verified = result === 'deleted' && await verifyDatabaseDeleted();
    if (verified) databaseOpenError = '';
    return verified;
  }

  async function diagnostics() {
    const db = await openDatabase();
    let estimate = null;
    let persisted = null;
    let primaryRecordPresent = false;
    let backupRecordPresent = false;
    try { estimate = await navigator.storage?.estimate?.(); } catch (err) {   }
    try { persisted = await navigator.storage?.persisted?.(); } catch (err) {   }
    try { primaryRecordPresent = Boolean((await getRecord(APP_PRIMARY_SAVE_KEY))?.value); } catch (_) {   }
    try { backupRecordPresent = Boolean((await getRecord(APP_PRIMARY_SAVE_BACKUP_KEY))?.value); } catch (_) {   }
    const localMarkerPresent = Boolean(parseStorageMarker(safeStorageGet('localStorage', STORAGE_KEY), APP_PRIMARY_SAVE_KEY));
    return {
      indexedDb: Boolean(db),
      databaseName: APP_DATABASE_NAME,
      quota: Number(estimate?.quota || 0),
      usage: Number(estimate?.usage || 0),
      persisted,
      primaryRecordPresent,
      backupRecordPresent,
      pendingFallbackPresent: Boolean(safeStorageGet('localStorage', STORAGE_PENDING_KEY)),
      localBackupPresent: Boolean(safeStorageGet('localStorage', STORAGE_BACKUP_KEY)),
      localMarkerPresent,
      databaseError: databaseOpenError,
      storageError: uiState.lastStorageError || ''
    };
  }

  return Object.freeze({
    initialize: openDatabase,
    close: closeDatabaseConnection,
    putRecord,
    getRecord,
    setPrimarySave,
    getPrimarySave,
    getPrimarySaveDetailed,
    setSnapshotIndex,
    getSnapshotIndex,
    removePrimarySave,
    removeSnapshotIndex,
    clearDatabase,
    diagnostics
  });
})();

function appDeviceId() {
  let value = safeStorageGet('localStorage', APP_DEVICE_ID_KEY) || '';
  if (!value) {
    value = uid('device');
    safeStorageSet('localStorage', APP_DEVICE_ID_KEY, value);
  }
  return value;
}

function nextSaveIdentity(exportedState, options = {}) {
  const suppliedBase = Object.prototype.hasOwnProperty.call(options, 'baseIdentity');
  const fallbackIdentity = uiState.saveIdentity || uiState.previewSaveIdentity;
  const previousSource = suppliedBase ? (options.baseIdentity || fallbackIdentity) : fallbackIdentity;
  const previous = previousSource && typeof previousSource === 'object' ? previousSource : {};
  const advanceRevision = options.advanceRevision === true;
  const previousRevision = Math.max(0, Number(previous.revisionNumber || 0));
  const revisionNumber = advanceRevision ? previousRevision + 1 : previousRevision;
  const now = new Date().toISOString();
  const identity = {
    saveId: previous.saveId || uid('save'),
    revisionNumber,
    parentRevision: advanceRevision ? previousRevision : Math.max(0, Number(previous.parentRevision ?? previousRevision - 1)),
    deviceId: previous.deviceId || appDeviceId(),
    createdAt: previous.createdAt || now,
    modifiedAt: advanceRevision ? now : (previous.modifiedAt || now),
    contentHash: hashString(stableJsonStringify({
      classes: exportedState?.classes || [],
      activeClassId: exportedState?.activeClassId || '',
      roomTemplates: exportedState?.roomTemplates || state.roomTemplates || [],
      collaborationAccess: exportedState?.collaborationAccess || state.collaborationAccess || normalizeCollaborationAccess(null)
    }))
  };
  if (advanceRevision && options.commitIdentity !== false) {
    uiState.saveIdentity = identity;
    uiState.previewSaveIdentity = null;
  } else if (!uiState.saveIdentity && !suppliedBase) {
    uiState.previewSaveIdentity = identity;
  }
  return identity;
}

