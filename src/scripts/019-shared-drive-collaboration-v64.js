const SharedDriveCollaborationV64 = (() => {
  const VIEWER_KIND = 'shared-viewer';
  const VIEWER_FORMAT = 'classroom-seating-planner-encrypted-viewer-v1';
  let installed = false;
  let permissionRows = [];

  const node = id => document.getElementById(id);
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  async function copyTextSafe(value) {
    const text = String(value || '');
    if (!text) return false;
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
    const area = document.createElement('textarea'); area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select(); const ok = document.execCommand('copy'); area.remove(); return ok;
  }

  function defaultPolicyForRole(driveRole = 'writer', identity = {}) {
    const role = driveRole === 'reader' ? 'reader' : 'writer';
    const preset = role === 'reader' ? 'reviewer' : 'full';
    return normalizeCollaborationPolicy({
      permissionId: identity.permissionId || '',
      email: identity.emailAddress || identity.email || '',
      displayName: identity.displayName || '',
      driveRole: role,
      preset,
      capabilities: collaborationPresetCapabilities(preset, role)
    });
  }

  function collaborationPolicy(permissionId, driveRole = 'writer', identity = {}) {
    state.collaborationAccess = normalizeCollaborationAccess(state.collaborationAccess);
    const stored = state.collaborationAccess.policies[String(permissionId || '')];
    return stored
      ? normalizeCollaborationPolicy(stored, { permissionId, driveRole, email: identity.emailAddress || '', displayName: identity.displayName || '' })
      : defaultPolicyForRole(driveRole, { ...identity, permissionId });
  }

  function presetOptionsMarkup(selected = 'full') {
    const options = [
      ['full', 'Full editor'],
      ['seating', 'Seating assistant'],
      ['room', 'Room designer'],
      ['roster', 'Roster and rules editor'],
      ['reviewer', 'Reviewer and printer'],
      ['custom', 'Custom permissions']
    ];
    return options.map(([value, label]) => `<option value="${value}"${selected === value ? ' selected' : ''}>${label}</option>`).join('');
  }

  function collaborationModeOptions(selected = 'none', driveRole = 'writer', area = '') {
    const modes = [['none', 'Hidden'], ['view', 'View only'], ['edit', 'Can edit']];
    return modes.map(([value, label]) => {
      const disabled = value === 'edit' && driveRole === 'reader';
      const suffix = area === 'save' && value === 'view' ? 'See status only' : label;
      return `<option value="${value}"${selected === value ? ' selected' : ''}${disabled ? ' disabled' : ''}>${suffix}</option>`;
    }).join('');
  }

  function capabilityGridMarkup(policy, scope) {
    const normalized = normalizeCollaborationPolicy(policy);
    return COLLABORATION_AREAS.map(area => `<label class="shared-drive-capability-row"><span>${escapeHtml(COLLABORATION_AREA_LABELS[area])}</span><select data-collaboration-capability="${area}" data-collaboration-scope="${escapeHtml(scope)}" aria-label="${escapeHtml(COLLABORATION_AREA_LABELS[area])}">${collaborationModeOptions(normalized.capabilities[area], normalized.driveRole, area)}</select></label>`).join('');
  }

  function policyFromCapabilityContainer(container, fallback = {}) {
    const driveRole = fallback.driveRole === 'reader' ? 'reader' : 'writer';
    const capabilities = {};
    COLLABORATION_AREAS.forEach(area => {
      let mode = normalizeCollaborationMode(container?.querySelector(`[data-collaboration-capability="${area}"]`)?.value, fallback.capabilities?.[area] || 'none');
      if (driveRole === 'reader' && mode === 'edit') mode = 'view';
      capabilities[area] = mode;
    });
    return normalizeCollaborationPolicy({ ...fallback, driveRole, capabilities, preset: collaborationPresetForCapabilities(capabilities, driveRole) });
  }

  function applyPresetToCapabilityContainer(container, preset, driveRole = 'writer') {
    const capabilities = collaborationPresetCapabilities(preset === 'custom' ? 'full' : preset, driveRole);
    COLLABORATION_AREAS.forEach(area => {
      const select = container?.querySelector(`[data-collaboration-capability="${area}"]`);
      if (!select) return;
      select.innerHTML = collaborationModeOptions(capabilities[area], driveRole, area);
      select.value = capabilities[area];
    });
  }

  function currentInterfaceMode(area) {
    const policy = uiState.sharedDriveInterfacePolicy;
    if (!policy) return uiState.googleDriveAccessRole === 'reader' ? 'view' : 'edit';
    return normalizeCollaborationMode(policy.capabilities?.[area], 'none');
  }

  function currentUserCanEdit(area) {
    return uiState.googleDriveAccessRole !== 'reader' && currentInterfaceMode(area) === 'edit';
  }

  function cacheCurrentDriveUser(user) {
    const cfg = googleDriveConfig();
    if (!user?.permissionId || !cfg.clientId) return false;
    uiState.googleDriveUser = { permissionId: String(user.permissionId), emailAddress: String(user.emailAddress || ''), displayName: String(user.displayName || '') };
    return safeStorageSet('sessionStorage', GOOGLE_DRIVE_USER_SESSION_KEY, JSON.stringify({ ...uiState.googleDriveUser, clientId: cfg.clientId }));
  }

  function restoreCurrentDriveUser() {
    let cached = null;
    try { cached = JSON.parse(safeStorageGet('sessionStorage', GOOGLE_DRIVE_USER_SESSION_KEY) || 'null'); } catch { return null; }
    if (!cached?.permissionId || cached.clientId !== googleDriveConfig().clientId) return null;
    uiState.googleDriveUser = { permissionId: String(cached.permissionId), emailAddress: String(cached.emailAddress || ''), displayName: String(cached.displayName || '') };
    return uiState.googleDriveUser;
  }

  async function fetchCurrentDriveUser(interactive = true) {
    const response = await googleDriveFetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,permissionId)', { method: 'GET' }, interactive);
    const about = await response.json();
    const user = about?.user || null;
    if (!user?.permissionId) throw new Error('Google Drive did not return the current account permission ID.');
    cacheCurrentDriveUser(user);
    return uiState.googleDriveUser;
  }

  function accessSummary(policy) {
    if (!policy) return 'Full editor';
    const presetLabels = { full: 'Full editor', seating: 'Seating assistant', room: 'Room designer', roster: 'Roster and rules editor', reviewer: 'Reviewer and printer', custom: 'Custom permissions' };
    return presetLabels[policy.preset] || 'Custom permissions';
  }

  function applyInterfacePolicy(policy = null, permissionId = '') {
    const normalized = policy ? normalizeCollaborationPolicy(policy) : null;
    uiState.sharedDriveInterfacePolicy = normalized;
    uiState.sharedDriveInterfacePermissionId = String(permissionId || normalized?.permissionId || '');
    COLLABORATION_AREAS.forEach(area => {
      document.body.dataset[`collab${area[0].toUpperCase()}${area.slice(1)}`] = normalized ? normalized.capabilities[area] : (uiState.googleDriveAccessRole === 'reader' ? (area === 'save' ? 'none' : 'view') : 'edit');
    });
    syncInterfaceAccessUi();
  }

  function syncInterfaceAccessUi() {
    const policy = uiState.sharedDriveInterfacePolicy;
    document.querySelectorAll('.v4-workflow-step[data-workflow]').forEach(button => {
      const mode = currentInterfaceMode(button.dataset.workflow);
      button.hidden = mode === 'none';
      button.disabled = mode === 'none';
      button.setAttribute('aria-disabled', mode === 'none' ? 'true' : 'false');
      button.title = mode === 'view' ? `${COLLABORATION_AREA_LABELS[button.dataset.workflow] || 'This workflow'} — view only` : '';
    });
    const settingsMode = currentInterfaceMode('settings');
    ['settingsBtn', 'googleHubSettingsBtn'].forEach(id => { const control = node(id); if (control) control.hidden = settingsMode === 'none'; });
    const reviewMode = currentInterfaceMode('review');
    ['printBtn', 'v4ContextPrimary'].forEach(id => { const control = node(id); if (control && id === 'printBtn') control.hidden = reviewMode === 'none'; });
    const shareMode = currentInterfaceMode('share');
    ['openSharedDriveManagerBtn', 'googleHubDriveShareBtn'].forEach(id => { const control = node(id); if (control) control.hidden = shareMode === 'none'; });
    document.querySelectorAll('[data-save-menu-action="safe-share"],[data-save-menu-action="export-all"],[data-save-menu-action="export-current"],[data-save-menu-action="download-students"],[data-save-menu-action="download-groups"],[data-save-menu-action="download-rooms"],[data-save-menu-action="download-package"],[data-save-menu-action="drive-share-manager"]').forEach(control => {
      control.hidden = shareMode === 'none';
    });
    const classMode = currentInterfaceMode('classes');
    const classManager = document.querySelector('.class-manager');
    if (classManager) classManager.hidden = classMode === 'none';
    ['newClassBtn', 'renameClassBtn', 'duplicateClassBtn', 'classToolsBtn', 'deleteClassBtn'].forEach(id => {
      const control = node(id);
      if (control) control.disabled = classMode !== 'edit';
    });
    const saveMode = currentInterfaceMode('save');
    document.querySelectorAll('[data-save-menu-action="save-primary"],[data-save-menu-action="google-drive-save"],[data-save-menu-action="choose-linked-file"]').forEach(control => {
      control.hidden = saveMode === 'none';
      control.disabled = saveMode !== 'edit';
    });
    document.querySelectorAll('[data-drive-write-action]').forEach(control => {
      const needsShare = control.closest('#sharedDriveModal');
      control.disabled = uiState.googleDriveAccessRole === 'reader' || (needsShare ? shareMode !== 'edit' : saveMode !== 'edit');
      if (control.disabled) control.title = uiState.googleDriveAccessRole === 'reader' ? 'Google Drive granted view-only access to this file.' : 'This collaborator interface profile does not allow this action.';
    });
    let banner = node('collaborationAccessBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'collaborationAccessBanner';
      banner.className = 'collaboration-access-banner';
      banner.setAttribute('role', 'status');
      document.body.appendChild(banner);
    }
    const restricted = policy && policy.preset !== 'full';
    banner.hidden = !restricted;
    if (restricted) banner.textContent = `${accessSummary(policy)} access: some planner areas are hidden or view only.`;
    const activeWorkflow = String(document.body.dataset.workflow || 'setup');
    if (currentInterfaceMode(activeWorkflow) === 'none' && typeof ProductExperience !== 'undefined') {
      const fallback = ['review', 'seating', 'room', 'setup', 'share'].find(area => currentInterfaceMode(area) !== 'none');
      if (fallback) ProductExperience.setWorkflow(fallback);
    }
  }

  async function refreshCurrentUserAccess(interactive = true) {
    let user = uiState.googleDriveUser || restoreCurrentDriveUser();
    if (!user && (interactive || hasUsableGoogleDriveToken())) {
      try { user = await fetchCurrentDriveUser(interactive); } catch (error) {
        if (interactive) throw error;
      }
    }
    if (!user?.permissionId) {
      state.collaborationAccess = normalizeCollaborationAccess(state.collaborationAccess);
      const hasRestrictedProfiles = Object.keys(state.collaborationAccess.policies).length > 0;
      const fallbackPolicy = hasRestrictedProfiles
        ? normalizeCollaborationPolicy({ driveRole: uiState.googleDriveAccessRole === 'reader' ? 'reader' : 'writer', preset: 'reviewer', capabilities: collaborationPresetCapabilities('reviewer', uiState.googleDriveAccessRole === 'reader' ? 'reader' : 'writer') })
        : null;
      applyInterfacePolicy(fallbackPolicy, '');
      if (hasRestrictedProfiles) setLiveStatusMessage('The signed-in Drive account could not be matched to its interface profile. Conservative review-only access is active until permissions are refreshed.');
      return fallbackPolicy;
    }
    const policy = collaborationPolicy(user.permissionId, uiState.googleDriveAccessRole, user);
    applyInterfacePolicy(policy, user.permissionId);
    return policy;
  }

  async function persistCollaborationAccess(reason = 'collaboration-access') {
    state.collaborationAccess = normalizeCollaborationAccess(state.collaborationAccess);
    state.collaborationAccess.updatedAt = new Date().toISOString();
    const saved = await writeGoogleDriveSaveFile({ reason, announce: false });
    if (!saved) throw new Error('The interface permission profile could not be saved to Google Drive.');
    return saved;
  }

  function setStoredPolicy(policy) {
    const normalized = normalizeCollaborationPolicy(policy);
    if (!normalized.permissionId) throw new Error('A Google Drive permission ID is required for interface access.');
    state.collaborationAccess = normalizeCollaborationAccess(state.collaborationAccess);
    normalized.updatedAt = new Date().toISOString();
    state.collaborationAccess.policies[normalized.permissionId] = normalized;
    state.collaborationAccess.updatedAt = normalized.updatedAt;
    return normalized;
  }

  function deleteStoredPolicy(permissionId) {
    state.collaborationAccess = normalizeCollaborationAccess(state.collaborationAccess);
    delete state.collaborationAccess.policies[String(permissionId || '')];
    state.collaborationAccess.updatedAt = new Date().toISOString();
  }

  function applyDriveCapabilities(capabilities = null) {
    uiState.googleDriveCapabilities = capabilities && typeof capabilities === 'object' ? { ...capabilities } : null;
    uiState.googleDriveAccessRole = capabilities?.canEdit === false ? 'reader' : capabilities?.canEdit === true ? 'writer' : 'unknown';
    document.body.dataset.driveAccessRole = uiState.googleDriveAccessRole;
    const badge = node('sharedDriveRoleBadge');
    if (badge) badge.textContent = uiState.googleDriveAccessRole === 'reader' ? 'View only' : uiState.googleDriveAccessRole === 'writer' ? 'Can edit' : 'Role unknown';
    document.querySelectorAll('[data-drive-write-action]').forEach(button => {
      button.disabled = uiState.googleDriveAccessRole === 'reader';
      button.title = button.disabled ? 'Google Drive granted view-only access to this file.' : '';
    });
    let banner = node('driveReadOnlyBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'driveReadOnlyBanner';
      banner.className = 'drive-read-only-banner';
      banner.setAttribute('role', 'status');
      banner.textContent = 'View-only Google Drive access: editing and saving are disabled for this shared file.';
      document.body.appendChild(banner);
    }
    banner.hidden = uiState.googleDriveAccessRole !== 'reader';
    syncInterfaceAccessUi();
  }

  function assertCanWriteCurrentDriveFile() {
    if (googleDriveConfig().fileId && uiState.googleDriveAccessRole === 'reader') {
      throw new Error('This Google Drive file is shared with view-only permission. Ask the owner for Editor access or save a separate copy.');
    }
    if (googleDriveConfig().fileId && !currentUserCanEdit('save')) {
      throw new Error('Your collaborator interface profile does not allow saving changes to the master Drive file. Ask the owner to update your interface access.');
    }
  }

  function captureBaseDocument(documentValue, fileId = '') {
    try {
      const parsed = typeof documentValue === 'string' ? JSON.parse(documentValue) : cloneJsonValue(documentValue);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Drive base document must be an object.');
      uiState.sharedDriveBaseDocument = parsed;
      uiState.sharedDriveBaseFileId = String(fileId || googleDriveConfig().fileId || '');
      return true;
    } catch (_) {
      uiState.sharedDriveBaseDocument = null;
      uiState.sharedDriveBaseFileId = '';
      return false;
    }
  }

  function captureBaseFromCurrent(fileId = '') {
    try {
      return captureBaseDocument(exportState('all'), fileId);
    } catch (_) {
      uiState.sharedDriveBaseDocument = null;
      uiState.sharedDriveBaseFileId = '';
      return false;
    }
  }

  async function driveMetadata(fileId) {
    const response = await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime,webViewLink,version,md5Checksum,headRevisionId,capabilities(canEdit,canShare,canCopy),permissions(id,type,role,emailAddress,displayName,domain,deleted,pendingOwner)`, { method: 'GET' });
    return response.json();
  }

  async function listPermissions() {
    const fileId = googleDriveConfig().fileId;
    if (!fileId) throw new Error('Save or load a Google Drive file before managing sharing.');
    const meta = await driveMetadata(fileId);
    applyDriveCapabilities(meta.capabilities || null);
    permissionRows = Array.isArray(meta.permissions) ? meta.permissions : [];
    await refreshCurrentUserAccess(true);
    renderPermissions(meta);
    renderAddPermissionControls();
    return meta;
  }

  function renderAddPermissionControls() {
    const role = node('sharedDriveRole')?.value === 'reader' ? 'reader' : 'writer';
    const presetSelect = node('sharedDriveInterfacePreset');
    let preset = presetSelect?.value || (role === 'reader' ? 'reviewer' : 'full');
    if (role === 'reader' && preset === 'full') { preset = 'reviewer'; if (presetSelect) presetSelect.value = preset; }
    const policy = normalizeCollaborationPolicy({ driveRole: role, preset, capabilities: collaborationPresetCapabilities(preset === 'custom' ? 'full' : preset, role) });
    const grid = node('sharedDriveCapabilityGrid');
    if (grid) grid.innerHTML = capabilityGridMarkup(policy, 'new');
    if (presetSelect && preset === 'custom') presetSelect.value = 'custom';
  }

  function renderPermissions(meta = {}) {
    const status = node('sharedDriveStatus');
    const list = node('sharedDrivePermissionList');
    if (status) status.textContent = `${meta.name || googleDriveConfig().fileName || 'Current Drive file'} · ${meta.capabilities?.canShare === false ? 'Sharing changes are not permitted for this account.' : 'Sharing and interface access can be managed here.'}`;
    if (!list) return;
    list.innerHTML = permissionRows.length ? permissionRows.map(permission => {
      const identity = permission.emailAddress || permission.displayName || permission.domain || permission.type || 'Unknown collaborator';
      const own = permission.role === 'owner';
      const driveRole = permission.role === 'reader' ? 'reader' : 'writer';
      const policy = own ? defaultPolicyForRole('writer', { ...permission, permissionId: permission.id }) : collaborationPolicy(permission.id, driveRole, permission);
      const current = String(uiState.googleDriveUser?.permissionId || '') === String(permission.id || '');
      const scope = `permission-${permission.id}`;
      return `<div class="shared-drive-permission-row" data-permission-row="${escapeHtml(permission.id)}"><div class="shared-drive-permission-identity"><strong>${escapeHtml(identity)}${current ? ' <span class="pill">Current account</span>' : ''}</strong><span>${escapeHtml(permission.type || 'user')} · ${escapeHtml(permission.role || 'unknown')} · ${escapeHtml(accessSummary(policy))}</span></div>${own ? '<div class="button-row"><span class="pill">Owner · Full editor</span></div>' : `<div class="shared-drive-permission-controls"><div class="button-row"><select data-share-role="${escapeHtml(permission.id)}" aria-label="Drive access role for ${escapeHtml(identity)}"><option value="reader"${driveRole === 'reader' ? ' selected' : ''}>Drive Viewer</option><option value="writer"${driveRole === 'writer' ? ' selected' : ''}>Drive Editor</option></select><select data-collaboration-preset="${escapeHtml(permission.id)}" aria-label="Interface access preset for ${escapeHtml(identity)}">${presetOptionsMarkup(policy.preset)}</select><button type="button" class="tiny danger" data-remove-permission="${escapeHtml(permission.id)}">Remove</button></div><details class="shared-drive-capability-details"><summary>Customize hidden, view-only, and editable areas</summary><div class="shared-drive-capability-grid" data-collaboration-grid="${escapeHtml(scope)}">${capabilityGridMarkup(policy, scope)}</div><div class="button-row"><button type="button" class="tiny secondary" data-save-interface-policy="${escapeHtml(permission.id)}">Save interface access</button></div></details></div>`}</div>`;
    }).join('') : '<div class="hint">No collaborator permissions were returned. The owner permission may be hidden by account policy.</div>';
  }

  async function addPermission() {
    const fileId = googleDriveConfig().fileId;
    const email = String(node('sharedDriveEmail')?.value || '').trim();
    const role = node('sharedDriveRole')?.value === 'writer' ? 'writer' : 'reader';
    if (!fileId) throw new Error('Save or load a Google Drive file first.');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
    const params = new URLSearchParams({ fields: 'id,type,role,emailAddress,displayName', sendNotificationEmail: node('sharedDriveNotify')?.checked ? 'true' : 'false' });
    const message = String(node('sharedDriveMessage')?.value || '').trim();
    if (message && node('sharedDriveNotify')?.checked) params.set('emailMessage', message.slice(0, 1000));
    const response = await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?${params.toString()}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'user', role, emailAddress: email })
    });
    const created = await response.json();
    const preset = String(node('sharedDriveInterfacePreset')?.value || (role === 'reader' ? 'reviewer' : 'full'));
    const policy = policyFromCapabilityContainer(node('sharedDriveCapabilityGrid'), { permissionId: created.id, email, displayName: created.displayName || '', driveRole: role, preset });
    setStoredPolicy(policy);
    try {
      await persistCollaborationAccess('add-collaborator-interface-access');
    } catch (error) {
      deleteStoredPolicy(created.id);
      try { await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(created.id)}`, { method: 'DELETE' }); } catch {   }
      throw new Error(`The collaborator was not added because the interface permission profile could not be saved: ${error.message}`);
    }
    if (node('sharedDriveEmail')) node('sharedDriveEmail').value = '';
    await listPermissions();
    setLiveStatusMessage(`${email} was added as ${role === 'writer' ? 'a Drive editor' : 'a Drive viewer'} with ${accessSummary(policy)} interface access.`);
  }

  async function updatePermission(permissionId, role, row = null) {
    const fileId = googleDriveConfig().fileId;
    const previousPermission = permissionRows.find(item => String(item.id) === String(permissionId));
    const previousRole = previousPermission?.role === 'reader' ? 'reader' : 'writer';
    const previousPolicy = collaborationPolicy(permissionId, previousRole, previousPermission || {});
    const nextRole = role === 'writer' ? 'writer' : 'reader';
    await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissionId)}?fields=id,role`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: nextRole })
    });
    const nextPolicy = policyFromCapabilityContainer(row?.querySelector('[data-collaboration-grid]'), { ...previousPolicy, driveRole: nextRole });
    setStoredPolicy(nextPolicy);
    try {
      await persistCollaborationAccess('update-collaborator-drive-role');
    } catch (error) {
      setStoredPolicy(previousPolicy);
      try {
        await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissionId)}?fields=id,role`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: previousRole })
        });
      } catch {   }
      throw error;
    }
    await listPermissions();
  }

  async function saveInterfacePolicy(permissionId, row) {
    const permission = permissionRows.find(item => String(item.id) === String(permissionId));
    if (!permission) throw new Error('The selected Google Drive permission is no longer available.');
    const driveRole = permission.role === 'reader' ? 'reader' : 'writer';
    const previous = collaborationPolicy(permissionId, driveRole, permission);
    const next = policyFromCapabilityContainer(row?.querySelector('[data-collaboration-grid]'), previous);
    setStoredPolicy(next);
    try { await persistCollaborationAccess('update-collaborator-interface-access'); }
    catch (error) { setStoredPolicy(previous); throw error; }
    await listPermissions();
    setLiveStatusMessage(`${permission.emailAddress || permission.displayName || 'Collaborator'} now has ${accessSummary(next)} interface access.`);
  }

  async function removePermission(permissionId) {
    const fileId = googleDriveConfig().fileId;
    await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissionId)}`, { method: 'DELETE' });
    deleteStoredPolicy(permissionId);
    try { await persistCollaborationAccess('remove-collaborator-interface-access'); }
    catch (error) { setLiveStatusMessage(`Drive access was removed, but the unused interface profile could not be cleaned up yet: ${error.message}`); }
    await listPermissions();
  }

  function viewerClassData(preset = 'substitute') {
    persistActiveClass();
    const source = cloneJsonValue(activeClassRecord() || {});
    const includeNames = preset !== 'anonymous' && preset !== 'room';
    const includeSubNotes = preset === 'substitute';
    const students = preset === 'room' ? [] : (source.students || []).map((student, index) => ({
      id: String(student.id || `student-${index + 1}`),
      firstName: includeNames ? String(student.firstName || '') : `Student ${index + 1}`,
      lastName: includeNames ? String(student.lastName || '') : '',
      nickname: includeNames ? String(student.nickname || '') : '',
      grade: '', studentId: '', notesPublic: '', notesPrivate: '',
      notesSubstitute: includeSubNotes ? String(student.notesSubstitute || '') : ''
    }));
    return {
      format: VIEWER_FORMAT, app: APP_NAME, version: APP_REVISION, createdAt: new Date().toISOString(), preset,
      class: {
        id: source.id, name: source.name, rows: source.rows, cols: source.cols, layoutMode: source.layoutMode,
        cells: cloneJsonValue(source.cells || {}), freeformLayout: cloneJsonValue(source.freeformLayout || {}), students
      }
    };
  }

  async function encryptedViewerPayload(password, preset) {
    const plain = JSON.stringify(viewerClassData(preset));
    return encryptTextWithSecret(plain, password, 'shared-viewer', { payloadKind: VIEWER_KIND, viewerFormat: VIEWER_FORMAT, readOnly: true, preset });
  }

  async function uploadViewerFile() {
    const password = String(node('sharedViewerPassword')?.value || '');
    const confirm = String(node('sharedViewerPasswordConfirm')?.value || '');
    const preset = String(node('sharedViewerPreset')?.value || 'substitute');
    const secret = DistrictIntegrationsV57.confirmedViewerPassword(password, confirm);
    const folderId = await ensureGoogleDriveAppFolder();
    const payload = await encryptedViewerPayload(secret, preset);
    const classPart = String(activeClassName() || 'class').replace(/[^a-z0-9._ -]+/gi, '-').replace(/\s+/g, '-').slice(0, 50);
    const metadata = { name: `${classPart}-encrypted-viewer.json`, mimeType: 'application/json', parents: folderId ? [folderId] : undefined, appProperties: { app: GOOGLE_DRIVE_APP_PROPERTY, kind: VIEWER_KIND, encrypted: 'true', viewerFormat: VIEWER_FORMAT, appVersion: APP_REVISION } };
    if (!metadata.parents) delete metadata.parents;
    const { boundary, body } = googleDriveMultipartBody(metadata, payload, 'application/json');
    const response = await googleDriveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,capabilities(canEdit,canShare)', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
    const created = await response.json();
    node('sharedViewerResult').textContent = `Created ${created.name || 'encrypted viewer file'}. Share it with Drive Viewer permission and send the password separately.`;
    setLiveStatusMessage('Separate encrypted viewer file created in Google Drive.');
    return created;
  }

  async function downloadEncryptedViewerHtml() {
    const password = String(node('sharedViewerPassword')?.value || '');
    const confirm = String(node('sharedViewerPasswordConfirm')?.value || '');
    const preset = String(node('sharedViewerPreset')?.value || 'substitute');
    const secret = DistrictIntegrationsV57.confirmedViewerPassword(password, confirm);
    const html = await DistrictIntegrationsV57.buildEncryptedReadOnlyHtml(secret, preset);
    downloadText(`${String(activeClassName() || 'class').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-encrypted-viewer.html`, html, 'text/html');
    setLiveStatusMessage('Encrypted view-only HTML downloaded. Send its password separately.');
  }

  async function tryOpenEncryptedViewerPayload(text, file = {}) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (_) { return false; }
    if (parsed?.payloadKind !== VIEWER_KIND && parsed?.viewerFormat !== VIEWER_FORMAT) return false;
    const password = await requestEncryptionKey('This is an encrypted view-only classroom file. Enter its viewer password.');
    if (!password) throw new Error('Encrypted viewer load canceled.');
    const plain = await decryptTextEnvelope(parsed, password);
    const viewer = JSON.parse(plain);
    if (viewer?.format !== VIEWER_FORMAT || !viewer.class) throw new Error('The encrypted viewer file is not valid.');
    uiState.sharedViewerDocument = viewer;
    showViewerModal(viewer, file.name || 'Shared classroom view');
    return true;
  }

  function showViewerModal(viewer, sourceName) {
    const cls = viewer.class || {};
    const students = new Map((cls.students || []).map(student => [String(student.id), student]));
    const name = student => [student.nickname || student.firstName, student.lastName].filter(Boolean).join(' ');
    const assigned = id => students.get(String(id || ''));
    let room = '';
    if (cls.layoutMode === 'freeform') {
      const canvas = cls.freeformLayout?.canvas || { width: 1200, height: 760 };
      room = `<div class="shared-viewer-canvas" style="width:${Number(canvas.width) || 1200}px;height:${Number(canvas.height) || 760}px">${(cls.freeformLayout?.objects || []).map(object => `<div class="shared-viewer-object" style="left:${Number(object.x)||0}px;top:${Number(object.y)||0}px;width:${Number(object.width)||120}px;height:${Number(object.height)||80}px;transform:rotate(${Number(object.rotation)||0}deg)">${escapeHtml(assigned(object.assignedStudentId) ? name(assigned(object.assignedStudentId)) : object.label || object.type || 'Object')}</div>`).join('')}</div>`;
    } else {
      const cells = [];
      for (let row = 1; row <= Number(cls.rows || 1); row += 1) for (let col = 1; col <= Number(cls.cols || 1); col += 1) {
        const cell = cls.cells?.[`${row}-${col}`] || {};
        cells.push(`<div class="shared-viewer-cell ${escapeHtml(cell.type || 'empty')}">${escapeHtml(assigned(cell.assignedStudentId) ? name(assigned(cell.assignedStudentId)) : cell.label || cell.type || '')}</div>`);
      }
      room = `<div class="shared-viewer-grid" style="grid-template-columns:repeat(${Number(cls.cols)||1},minmax(90px,1fr))">${cells.join('')}</div>`;
    }
    const notes = (cls.students || []).filter(student => student.notesSubstitute).map(student => `<li><strong>${escapeHtml(name(student))}</strong><span>${escapeHtml(student.notesSubstitute)}</span></li>`).join('');
    node('sharedViewerModalTitle').textContent = `${cls.name || sourceName} · View only`;
    node('sharedViewerModalBody').innerHTML = `<div class="hint">This encrypted file is open in view-only mode. It cannot modify the planner or overwrite the Drive file.</div>${room}${notes ? `<section class="section"><h3>Substitute notes</h3><ul>${notes}</ul></section>` : ''}`;
    node('sharedViewerModal').classList.add('show');
    DialogManager.synchronize();
  }

  function driveMergeTimestamp(values, mode = 'latest') {
    const candidates = values
      .filter(value => value !== undefined && value !== null && String(value).trim())
      .map(value => ({ value: String(value), time: Date.parse(String(value)) }))
      .filter(item => Number.isFinite(item.time));
    if (!candidates.length) return values.find(value => value !== undefined && value !== null) ?? '';
    candidates.sort((a, b) => a.time - b.time);
    return (mode === 'earliest' ? candidates[0] : candidates[candidates.length - 1]).value;
  }

  function mergedDriveSaveIdentity(base = {}, local = {}, remote = {}, mergedDocument = null) {
    const identities = [base, local, remote].filter(value => value && typeof value === 'object' && !Array.isArray(value));
    const revisionNumber = Math.max(0, ...identities.map(value => Number(value.revisionNumber || 0)).filter(Number.isFinite));
    const mergedIdentity = {
      saveId: String(local?.saveId || remote?.saveId || base?.saveId || uid('save')),
      revisionNumber,
      parentRevision: Math.max(0, ...identities.map(value => Number(value.parentRevision || 0)).filter(Number.isFinite)),
      deviceId: String(local?.deviceId || remote?.deviceId || base?.deviceId || appDeviceId()),
      createdAt: driveMergeTimestamp(identities.map(value => value.createdAt), 'earliest') || new Date().toISOString(),
      modifiedAt: driveMergeTimestamp(identities.map(value => value.modifiedAt), 'latest') || new Date().toISOString(),
      contentHash: String(local?.contentHash || remote?.contentHash || base?.contentHash || '')
    };
    if (mergedDocument) {
      mergedIdentity.contentHash = hashString(stableJsonStringify({
        classes: mergedDocument.classes || [],
        activeClassId: mergedDocument.activeClassId || '',
        roomTemplates: mergedDocument.roomTemplates || [],
        collaborationAccess: mergedDocument.collaborationAccess || normalizeCollaborationAccess(null)
      }));
    }
    return mergedIdentity;
  }

  function resolveDriveMergeMetadata(path, base, local, remote) {
    if (path === '$.backupManifest') return { handled: true, value: undefined };
    if (path === '$.saveIdentity') return { handled: true, value: mergedDriveSaveIdentity(base, local, remote) };
    if (path === '$.exportedAt') return { handled: true, value: driveMergeTimestamp([base, local, remote], 'latest') };
    if (path === '$.pageSettings' || path === '$.preferences') {
      return { handled: true, value: cloneJsonValue(local ?? remote ?? base) };
    }
    if (/\.updatedAt$/.test(path) || /\.modifiedAt$/.test(path)) {
      return { handled: true, value: driveMergeTimestamp([base, local, remote], 'latest') };
    }
    if (/\.createdAt$/.test(path) && !path.startsWith('$.appSnapshots')) {
      return { handled: true, value: driveMergeTimestamp([base, local, remote], 'earliest') };
    }
    return { handled: false, value: undefined };
  }

  function collaborationComparableDocument(documentValue) {
    const copy = cloneJsonValue(documentValue || {});
    if (!copy || typeof copy !== 'object' || Array.isArray(copy)) return copy;
    delete copy.exportedAt;
    delete copy.saveIdentity;
    delete copy.backupManifest;
    delete copy.pageSettings;
    delete copy.preferences;
    const stripGeneratedFields = value => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(stripGeneratedFields);
        return;
      }
      delete value.updatedAt;
      Object.values(value).forEach(stripGeneratedFields);
    };
    stripGeneratedFields(copy);
    return copy;
  }

  function collaborationDocumentsEqual(left, right) {
    return stableJsonStringify(collaborationComparableDocument(left)) === stableJsonStringify(collaborationComparableDocument(right));
  }

  function finalizeMergedDriveDocument(documentValue, context = {}) {
    const merged = cloneJsonValue(documentValue || {});
    delete merged.backupManifest;
    merged.exportedAt = driveMergeTimestamp([
      context.base?.exportedAt,
      context.local?.exportedAt,
      context.remote?.exportedAt,
      merged.exportedAt
    ], 'latest') || new Date().toISOString();
    merged.saveIdentity = mergedDriveSaveIdentity(
      context.base?.saveIdentity,
      context.local?.saveIdentity,
      context.remote?.saveIdentity,
      merged
    );
    return merged;
  }

  function mergeThreeWay(base, local, remote, path = '$', conflicts = []) {
    if (equal(local, remote)) return cloneJsonValue(local);
    const metadataResolution = resolveDriveMergeMetadata(path, base, local, remote);
    if (metadataResolution.handled) return cloneJsonValue(metadataResolution.value);
    if (equal(local, base)) return cloneJsonValue(remote);
    if (equal(remote, base)) return cloneJsonValue(local);
    if (Array.isArray(base) || Array.isArray(local) || Array.isArray(remote)) {
      const arrays = [base, local, remote].every(Array.isArray);
      const keyed = arrays && [base, local, remote].every(list => list.every(item => item && typeof item === 'object' && !Array.isArray(item) && item.id !== undefined));
      if (keyed) {
        const b = new Map(base.map(item => [String(item.id), item]));
        const l = new Map(local.map(item => [String(item.id), item]));
        const r = new Map(remote.map(item => [String(item.id), item]));
        const result = [];
        for (const id of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
          const merged = mergeThreeWay(b.get(id), l.get(id), r.get(id), `${path}[id=${id}]`, conflicts);
          if (merged !== undefined) result.push(merged);
        }
        return result;
      }
      conflicts.push({ path, base: cloneJsonValue(base), local: cloneJsonValue(local), remote: cloneJsonValue(remote), choice: 'local' });
      return cloneJsonValue(local);
    }
    const objects = [base, local, remote].every(value => value && typeof value === 'object' && !Array.isArray(value));
    if (objects) {
      const result = {};
      for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
        const merged = mergeThreeWay(base[key], local[key], remote[key], `${path}.${key}`, conflicts);
        if (merged !== undefined) result[key] = merged;
      }
      return result;
    }
    conflicts.push({ path, base: cloneJsonValue(base), local: cloneJsonValue(local), remote: cloneJsonValue(remote), choice: 'local' });
    return cloneJsonValue(local);
  }

  function setPath(root, path, value) {
    const tokens = path.replace(/^\$\.?/, '').split('.').filter(Boolean);
    let current = root;
    for (let index = 0; index < tokens.length - 1; index += 1) {
      const token = tokens[index];
      const match = token.match(/^(.+)\[id=(.+)\]$/);
      if (match) current = (current[match[1]] || []).find(item => String(item.id) === match[2]);
      else current = current[token];
      if (!current) return;
    }
    const last = tokens[tokens.length - 1];
    if (last) current[last] = cloneJsonValue(value);
  }

  async function remotePlainDocument(fileId) {
    const response = await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { method: 'GET' });
    const text = await readResponseTextWithinLimits(response, 'remote Google Drive save', IMPORT_LIMITS.saveBytes);
    let parsed = JSON.parse(text);
    if (parsed?.encrypted) parsed = JSON.parse(await decryptTextEnvelope(parsed, currentSessionEncryptionKey()));
    assertSupportedSaveDocument(parsed, 'remote Google Drive save');
    return parsed;
  }

  async function inspectRemoteDriveChange(fileId = '') {
    const targetFileId = String(fileId || googleDriveConfig().fileId || '');
    if (!targetFileId) return { metadataOnly: false, remote: null, reference: null };
    const remote = await remotePlainDocument(targetFileId);
    const base = uiState.sharedDriveBaseFileId === targetFileId && uiState.sharedDriveBaseDocument
      ? cloneJsonValue(uiState.sharedDriveBaseDocument)
      : null;
    const reference = base || JSON.parse(exportState('all'));
    return { metadataOnly: collaborationDocumentsEqual(reference, remote), remote, reference };
  }

  async function mergeRemoteDriveChanges(saveOptions = {}) {
    const fileId = googleDriveConfig().fileId;
    if (!fileId) throw new Error('No linked Google Drive file is available to merge.');
    assertCanWriteCurrentDriveFile();
    const base = uiState.sharedDriveBaseFileId === fileId && uiState.sharedDriveBaseDocument ? cloneJsonValue(uiState.sharedDriveBaseDocument) : null;
    if (!base) throw new Error('This tab does not have a base revision for three-way merge. Reload the Drive file, then retry.');
    const local = JSON.parse(exportState('all'));
    const remote = await remotePlainDocument(fileId);
    const conflicts = [];
    const merged = mergeThreeWay(base, local, remote, '$', conflicts);
    const mergeContext = { base, local, remote };
    if (!conflicts.length) return applyMergedDocument(merged, saveOptions, mergeContext);
    uiState.sharedDriveMergePending = { merged, conflicts, saveOptions, mergeContext };
    node('driveMergeConflictList').innerHTML = conflicts.map((conflict, index) => `<div class="drive-merge-conflict"><strong>${escapeHtml(conflict.path)}</strong><select data-merge-choice="${index}"><option value="local">Use my change</option><option value="remote">Use remote change</option></select><details><summary>Compare values</summary><pre>Mine: ${escapeHtml(JSON.stringify(conflict.local, null, 2))}\n\nRemote: ${escapeHtml(JSON.stringify(conflict.remote, null, 2))}</pre></details></div>`).join('');
    node('driveMergeModal').classList.add('show');
    DialogManager.synchronize();
    return false;
  }

  async function applyMergedDocument(documentToApply, saveOptions = {}, mergeContext = {}) {
    const rollback = createHistorySnapshot();
    try {
      const finalized = finalizeMergedDriveDocument(documentToApply, mergeContext);
      const manifested = await addBackupManifest(JSON.stringify(finalized, null, 2), 'all');
      await importStateDirectFromText(manifested, 'three-way merged Google Drive save');
      const saved = await writeGoogleDriveSaveFile({ ...saveOptions, forceOverwrite: true, announce: true });
      if (!saved) throw new Error('The merged document could not be saved to Google Drive.');
      setLiveStatusMessage('Remote and local Google Drive changes were merged and saved.');
      return true;
    } catch (error) {
      restoreHistorySnapshot(rollback);
      throw error;
    }
  }

  async function commitMergeChoices() {
    const pending = uiState.sharedDriveMergePending;
    if (!pending) return false;
    node('driveMergeConflictList').querySelectorAll('[data-merge-choice]').forEach(select => {
      const conflict = pending.conflicts[Number(select.dataset.mergeChoice)];
      if (conflict && select.value === 'remote') setPath(pending.merged, conflict.path, conflict.remote);
    });
    node('driveMergeModal').classList.remove('show');
    uiState.sharedDriveMergePending = null;
    return applyMergedDocument(pending.merged, pending.saveOptions, pending.mergeContext);
  }

  function collaborationAreaForTarget(target) {
    if (!target) return '';
    if (target.closest('#printOptionsModal,#printPreviewBanner,#printBtn,[data-v4-action="print"]')) return 'review';
    if (target.closest('#settingsModal,#settingsBtn,#googleHubSettingsBtn')) return 'settings';
    if (target.closest('.class-manager,#v4ClassMenu')) return 'classes';
    if (target.closest('#sharedDriveModal,#openSharedDriveManagerBtn,#googleHubDriveShareBtn,.v4-share-dashboard')) return 'share';
    const saveAction = target.closest('[data-save-menu-action]')?.dataset.saveMenuAction || '';
    if (saveAction) {
      if (['safe-share','export-all','export-current','download-students','download-groups','download-rooms','download-package','drive-share-manager'].includes(saveAction)) return 'share';
      if (['save-primary','open-save-options','choose-linked-file','google-drive-save'].includes(saveAction)) return 'save';
      return 'classes';
    }
    if (target.closest('#saveLoadMenuBtn,#inlineSaveStatus')) return 'save';
    if (target.closest('.app,#v4WorkflowContext')) return String(document.body.dataset.workflow || 'setup');
    return '';
  }

  function blockCollaborationInteraction(event, area, mode) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const label = COLLABORATION_AREA_LABELS[area] || 'This area';
    setLiveStatusMessage(mode === 'none'
      ? `${label} is hidden by your collaborator interface profile.`
      : `${label} is view only for your collaborator account.`);
  }

  function readOnlySafeTarget(target, area) {
    if (target.closest('[data-help-nav],[data-guided-start],summary,.hint-close,[data-dialog-close],.v41-section-toggle,.v41-panel-toggle,[role="tab"],.side-tab')) return true;
    if (target.matches('input[type="search"]') || target.closest('label')?.querySelector?.('input[type="search"]') === target) return true;
    if (area === 'review' && target.closest('#printOptionsModal,#printPreviewBanner,#printBtn,[data-v4-action="print"],#analyzeBtn')) return true;
    if (area === 'share' && !target.closest('[data-drive-write-action],[data-share-role],[data-collaboration-preset],[data-collaboration-capability],[data-remove-permission],[data-save-interface-policy]')) return true;
    if (area === 'classes' && target.closest('#classSelect')) return true;
    if (area === 'settings' && target.closest('#closeSettingsBtn,[data-settings-page],.settings-page-tab')) return true;
    return false;
  }

  function readOnlyMutationTarget(target) {
    return target.closest('button,input:not([type="search"]),select,textarea,[contenteditable="true"],[draggable="true"],.cell,.freeform-object,.student-card,.group-card,.zone-list-card,[data-seat-id],[data-cell-key]');
  }

  function readOnlyInteractionGuard(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const isReader = uiState.googleDriveAccessRole === 'reader';
    const policy = uiState.sharedDriveInterfacePolicy;
    if (!isReader && (!policy || policy.preset === 'full')) return;
    const workflowButton = target.closest('.v4-workflow-step[data-workflow]');
    if (workflowButton) {
      const mode = currentInterfaceMode(workflowButton.dataset.workflow);
      if (mode === 'none') blockCollaborationInteraction(event, workflowButton.dataset.workflow, mode);
      return;
    }
    const area = collaborationAreaForTarget(target);
    if (event.type === 'keydown') {
      const key = String(event.key || '').toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 's' && !currentUserCanEdit('save')) return blockCollaborationInteraction(event, 'save', currentInterfaceMode('save'));
      if ((event.ctrlKey || event.metaKey) && key === 'p' && currentInterfaceMode('review') === 'none') return blockCollaborationInteraction(event, 'review', 'none');
      if (!area) return;
      const mode = currentInterfaceMode(area);
      if (mode === 'none') return blockCollaborationInteraction(event, area, mode);
      if (!isReader && mode === 'edit') return;
      if (readOnlySafeTarget(target, area) || ['tab', 'escape'].includes(key)) return;
      if (readOnlyMutationTarget(target) || (event.ctrlKey || event.metaKey || event.altKey)) blockCollaborationInteraction(event, area, 'view');
      return;
    }
    if (!area) return;
    const mode = currentInterfaceMode(area);
    if (mode === 'none') return blockCollaborationInteraction(event, area, mode);
    if (!isReader && mode === 'edit') return;
    if (readOnlySafeTarget(target, area)) return;
    if (readOnlyMutationTarget(target)) blockCollaborationInteraction(event, area, 'view');
  }

  function appendMarkup() {
    const style = document.createElement('style');
    style.textContent = `.shared-drive-modal{max-width:min(980px,96vw)}.shared-drive-howto{margin-bottom:10px;padding:10px 12px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;color:#1e3a8a;font-size:12px;line-height:1.4}.shared-drive-howto strong{color:#172554}.shared-drive-howto ol{margin:6px 0;padding-left:20px}.shared-drive-howto p{margin:6px 0 0}.shared-drive-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.shared-drive-permission-list{display:grid;gap:7px;max-height:300px;overflow:auto}.shared-drive-permission-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px;border:1px solid var(--border);border-radius:10px;background:#fff}.shared-drive-permission-row>div:first-child{display:grid;gap:2px;min-width:0}.shared-drive-permission-row span{color:var(--muted);font-size:11px}.shared-drive-permission-row select{min-width:110px}.shared-viewer-grid{display:grid;gap:8px}.shared-viewer-cell,.shared-viewer-object{box-sizing:border-box;border:1px solid var(--border);border-radius:10px;background:#fff;padding:8px;display:grid;place-items:center;text-align:center;min-height:72px}.shared-viewer-cell.seat{background:#dbeafe}.shared-viewer-canvas{position:relative;background:#fff;border:1px solid var(--border);overflow:auto}.shared-viewer-object{position:absolute}.drive-merge-conflict{display:grid;gap:7px;padding:9px;border:1px solid #fed7aa;border-radius:10px;background:#fffbeb}.drive-merge-conflict pre{max-height:180px;overflow:auto;white-space:pre-wrap;font-size:11px}.shared-drive-permission-identity{display:grid;gap:3px;min-width:0}.shared-drive-permission-controls{display:grid;gap:7px;min-width:min(520px,100%)}.shared-drive-capability-details{border:1px solid var(--border);border-radius:10px;background:#f8fafc;padding:7px}.shared-drive-capability-details summary{cursor:pointer;font-size:11px;font-weight:850;color:var(--text)}.shared-drive-capability-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px;margin-top:8px}.shared-drive-capability-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(108px,140px);gap:7px;align-items:center;margin:0;padding:5px 0;border-bottom:1px solid rgba(148,163,184,.22);text-transform:none;letter-spacing:0}.shared-drive-capability-row span{font-size:11px;color:var(--text);font-weight:750}.shared-drive-capability-row select{min-width:0}.collaboration-access-banner{position:fixed;left:50%;bottom:14px;z-index:38800;transform:translateX(-50%);max-width:min(720px,calc(100vw - 28px));padding:9px 12px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;color:#1e3a8a;box-shadow:0 12px 34px rgba(15,23,42,.22);font-size:12px;font-weight:800}.collaboration-access-banner[hidden]{display:none}@media(max-width:760px){.shared-drive-grid,.shared-drive-permission-row,.shared-drive-capability-grid{grid-template-columns:1fr}.shared-drive-permission-controls{min-width:0}.shared-drive-capability-row{grid-template-columns:1fr}}body[data-drive-access-role="reader"] [data-drive-write-action]{display:none!important}.drive-read-only-banner{position:fixed;left:50%;bottom:14px;z-index:39000;transform:translateX(-50%);max-width:min(680px,calc(100vw - 28px));padding:9px 12px;border:1px solid #f2ca83;border-radius:12px;background:#fffbeb;color:#7c2d12;box-shadow:0 12px 34px rgba(15,23,42,.22);font-size:12px;font-weight:800}.drive-read-only-banner[hidden]{display:none}body[data-drive-access-role="reader"] .app button,body[data-drive-access-role="reader"] .app input,body[data-drive-access-role="reader"] .app select,body[data-drive-access-role="reader"] .app textarea,body[data-drive-access-role="reader"] .app [draggable="true"]{cursor:not-allowed}`;
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend', `<div id="sharedDriveModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sharedDriveTitle"><div class="modal shared-drive-modal"><div class="panel-header"><div><span class="v44-modal-eyebrow">Google Drive</span><h2 id="sharedDriveTitle">Share and collaborate</h2></div><div class="button-row"><button id="sharedDriveGuideBtn" type="button" class="tiny ghost" data-guided-start="drive-collaboration" data-guided-mode="explain">Guide me</button><button id="closeSharedDriveBtn" type="button" class="tiny secondary">Close</button></div></div><div class="modal-body"><div id="sharedDriveHowTo" class="shared-drive-howto"><strong>Editable multi-user setup</strong><ol><li>Save or load the master planner in Google Drive.</li><li>Enter a Google-account email, choose Drive Viewer or Editor, then choose which planner areas are hidden, view only, or editable.</li><li>Have the recipient open the same hosted planner, connect Drive, and load the shared file.</li><li>Save changes back to Drive; overlapping edits use the merge resolver.</li></ol><p>This is revision-aware shared-file editing, not live Google Docs-style cursor streaming.</p></div><div class="button-row"><span id="sharedDriveRoleBadge" class="pill">Role unknown</span><button id="refreshSharedDriveBtn" type="button" class="secondary">Refresh access</button><button id="copySharedDriveLinkBtn" type="button" class="secondary">Copy Drive link</button></div><p id="sharedDriveStatus" class="hint">Connect Google Drive and save or load a file first.</p><div class="shared-drive-grid"><section class="section"><h3>Choose who can open the editable save</h3><div class="field"><label for="sharedDriveEmail">Google account email</label><input id="sharedDriveEmail" type="email" autocomplete="off" placeholder="teacher@example.org"></div><div class="field"><label for="sharedDriveRole">Google Drive role</label><select id="sharedDriveRole"><option value="reader">Viewer — cannot save changes</option><option value="writer">Editor — may save the master when interface access allows it</option></select></div><div class="field"><label for="sharedDriveInterfacePreset">Planner interface access</label><select id="sharedDriveInterfacePreset">${presetOptionsMarkup("reviewer")}</select></div><details class="shared-drive-capability-details" open><summary>Choose which areas are hidden, view only, or editable</summary><div id="sharedDriveCapabilityGrid" class="shared-drive-capability-grid"></div></details><label class="checkline"><input id="sharedDriveNotify" type="checkbox" checked> Send Google notification</label><div class="field"><label for="sharedDriveMessage">Optional message</label><textarea id="sharedDriveMessage" rows="3" placeholder="Open the district-hosted planner, connect this Google account, then load the shared Drive save."></textarea></div><button id="addSharedDrivePermissionBtn" type="button" data-drive-write-action>Add person to Drive file</button><div class="hint mini">Google Drive still owns file access. The planner profile controls which interface areas this person can see or edit after opening the shared save. These are workflow controls, not cryptographic data redaction; use an encrypted read-only package when information itself must be excluded.</div></section><section class="section"><h3>Create a separate encrypted viewer</h3><div class="field"><label for="sharedViewerPreset">Viewer profile</label><select id="sharedViewerPreset"><option value="substitute">Substitute chart and substitute notes</option><option value="student">Student-facing names only</option><option value="anonymous">Anonymous numbered chart</option><option value="room">Room layout only</option></select></div><div class="row"><div class="field"><label for="sharedViewerPassword">Viewer password</label><input id="sharedViewerPassword" type="password" autocomplete="new-password" minlength="10" maxlength="256"></div><div class="field"><label for="sharedViewerPasswordConfirm">Confirm</label><input id="sharedViewerPasswordConfirm" type="password" autocomplete="new-password" minlength="10" maxlength="256"></div></div><div class="button-row"><button id="createDriveViewerFileBtn" type="button" data-drive-write-action>Create in Drive</button><button id="downloadEncryptedViewerHtmlBtn" type="button" class="secondary">Download encrypted HTML</button></div><p id="sharedViewerResult" class="muted">Use this for a stable read-only copy, not collaborative editing. Send the password through another channel.</p></section></div><section class="section"><h3>Current Drive permissions</h3><div class="hint mini">Change a person's role here or remove access. Removing access does not recall a file the person already downloaded or printed.</div><div id="sharedDrivePermissionList" class="shared-drive-permission-list"></div></section></div></div></div><div id="sharedViewerModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sharedViewerModalTitle"><div class="modal shared-drive-modal"><div class="panel-header"><h2 id="sharedViewerModalTitle">Shared classroom view</h2><button id="closeSharedViewerBtn" type="button" class="tiny secondary">Close</button></div><div id="sharedViewerModalBody" class="modal-body"></div></div></div><div id="driveMergeModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="driveMergeTitle"><div class="modal shared-drive-modal"><div class="panel-header"><h2 id="driveMergeTitle">Resolve Drive merge conflicts</h2><button id="cancelDriveMergeBtn" type="button" class="tiny secondary">Cancel</button></div><div class="modal-body"><div class="hint">Non-conflicting local and remote classroom changes were merged automatically. Save timestamps, revision hashes, backup manifests, and record update times are resolved automatically and are never presented as classroom conflicts. Choose which value wins only for genuine overlapping edits.</div><div id="driveMergeConflictList" class="list" style="margin-top:10px"></div><div class="button-row" style="margin-top:10px"><button id="commitDriveMergeBtn" type="button">Merge and save</button></div></div></div></div>`);
  }

  function openManager() {
    node('sharedDriveModal')?.classList.add('show');
    DialogManager.synchronize();
    void listPermissions().catch(error => { if (node('sharedDriveStatus')) node('sharedDriveStatus').textContent = error.message; });
  }

  function installEntryPoint() {
    const shareGrid = document.querySelector('.v4-share-grid');
    if (shareGrid && !node('openSharedDriveManagerBtn')) shareGrid.insertAdjacentHTML('afterbegin', `<article class="v4-share-card v4-share-card-primary"><div class="v4-share-icon">☁</div><span class="v4-eyebrow">Google Drive collaboration</span><h3>Share Drive save with people</h3><p>Choose a Google-account email, assign a Drive role, then hide, show, or make individual planner areas editable for that person.</p><button id="openSharedDriveManagerBtn" type="button" class="secondary">Choose people and access</button></article>`);
    const saveMenu = node('saveLoadMenu');
    if (saveMenu && !saveMenu.querySelector('[data-save-menu-action="drive-share-manager"]')) saveMenu.insertAdjacentHTML('beforeend', '<button type="button" data-save-menu-action="drive-share-manager">Share Drive Save with People...</button>');
  }

  function installEvents() {
    node('openSharedDriveManagerBtn')?.addEventListener('click', openManager);
    node('googleHubDriveShareBtn')?.addEventListener('click', openManager);
    node('closeSharedDriveBtn')?.addEventListener('click', () => { node('sharedDriveModal')?.classList.remove('show'); DialogManager.synchronize(); });
    node('refreshSharedDriveBtn')?.addEventListener('click', () => void listPermissions().catch(error => { node('sharedDriveStatus').textContent = error.message; }));
    node('addSharedDrivePermissionBtn')?.addEventListener('click', () => void addPermission().catch(error => { node('sharedDriveStatus').textContent = error.message; }));
    node('createDriveViewerFileBtn')?.addEventListener('click', () => void uploadViewerFile().catch(error => { node('sharedViewerResult').textContent = error.message; }));
    node('downloadEncryptedViewerHtmlBtn')?.addEventListener('click', () => void downloadEncryptedViewerHtml().catch(error => { node('sharedViewerResult').textContent = error.message; }));
    node('copySharedDriveLinkBtn')?.addEventListener('click', async () => { try { const meta = await driveMetadata(googleDriveConfig().fileId); const webLink = trustedGoogleDriveWebLink(meta.webViewLink); if (!webLink) throw new Error('Google Drive did not return a safe file link.'); await copyTextSafe(webLink); setLiveStatusMessage('Google Drive link copied.'); } catch (error) { node('sharedDriveStatus').textContent = error.message; } });
    node('sharedDriveRole')?.addEventListener('change', () => { const preset = node('sharedDriveRole').value === 'reader' ? 'reviewer' : 'full'; if (node('sharedDriveInterfacePreset')) node('sharedDriveInterfacePreset').value = preset; renderAddPermissionControls(); });
    node('sharedDriveInterfacePreset')?.addEventListener('change', event => applyPresetToCapabilityContainer(node('sharedDriveCapabilityGrid'), event.target.value, node('sharedDriveRole')?.value === 'reader' ? 'reader' : 'writer'));
    node('sharedDrivePermissionList')?.addEventListener('change', event => {
      const roleSelect = event.target.closest('[data-share-role]');
      const presetSelect = event.target.closest('[data-collaboration-preset]');
      const row = event.target.closest('[data-permission-row]');
      if (roleSelect) void updatePermission(roleSelect.dataset.shareRole, roleSelect.value, row).catch(error => { node('sharedDriveStatus').textContent = error.message; void listPermissions().catch(() => {}); });
      if (presetSelect && row) applyPresetToCapabilityContainer(row.querySelector('[data-collaboration-grid]'), presetSelect.value, row.querySelector('[data-share-role]')?.value === 'reader' ? 'reader' : 'writer');
      if (event.target.closest('[data-collaboration-capability]') && row) {
        const preset = row.querySelector('[data-collaboration-preset]');
        if (preset) preset.value = 'custom';
      }
    });
    node('sharedDrivePermissionList')?.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-permission]');
      const savePolicyButton = event.target.closest('[data-save-interface-policy]');
      const row = event.target.closest('[data-permission-row]');
      if (button) showInAppConfirm('Remove this collaborator from the Google Drive file?', () => void removePermission(button.dataset.removePermission).catch(error => { node('sharedDriveStatus').textContent = error.message; }), { title: 'Remove Drive Access', confirmText: 'Remove Access', cancelText: 'Cancel', danger: true });
      if (savePolicyButton) void saveInterfacePolicy(savePolicyButton.dataset.saveInterfacePolicy, row).catch(error => { node('sharedDriveStatus').textContent = error.message; });
    });
    node('closeSharedViewerBtn')?.addEventListener('click', () => { node('sharedViewerModal')?.classList.remove('show'); uiState.sharedViewerDocument = null; DialogManager.synchronize(); });
    node('commitDriveMergeBtn')?.addEventListener('click', () => void commitMergeChoices().catch(error => setLiveStatusMessage(`Drive merge failed: ${error.message}`)));
    node('cancelDriveMergeBtn')?.addEventListener('click', () => { node('driveMergeModal')?.classList.remove('show'); uiState.sharedDriveMergePending = null; DialogManager.synchronize(); });
    ['click','change','input','pointerdown','dragstart','drop','contextmenu','keydown'].forEach(type => document.addEventListener(type, readOnlyInteractionGuard, true));
  }

  function install() {
    if (installed) return;
    installed = true;
    appendMarkup();
    installEntryPoint();
    installEvents();
    applyDriveCapabilities(uiState.googleDriveCapabilities);
    restoreCurrentDriveUser();
    void refreshCurrentUserAccess(false);
  }

  return Object.freeze({
    install,
    openManager,
    applyDriveCapabilities,
    assertCanWriteCurrentDriveFile,
    captureBaseDocument,
    captureBaseFromCurrent,
    tryOpenEncryptedViewerPayload,
    inspectRemoteDriveChange,
    mergeRemoteDriveChanges,
    mergeThreeWay,
    finalizeMergedDriveDocument,
    collaborationDocumentsEqual,
    viewerClassData,
    encryptedViewerPayload,
    refreshCurrentUserAccess,
    currentInterfaceMode,
    currentUserCanEdit,
    applyInterfacePolicy,
    collaborationPolicy
  });
})();

async function registerHostedServiceWorker() {
  const status = window.__plannerPwaStatus = {
    supported: 'serviceWorker' in navigator,
    eligibleOrigin: /^https?:$/.test(location.protocol) && location.hostname !== 'example.test',
    registered: false,
    controlling: Boolean(navigator.serviceWorker?.controller),
    error: ''
  };
  const announceStatus = () => window.dispatchEvent(new CustomEvent('planner-pwa-status-changed', { detail: { ...status } }));
  if (!status.supported || !status.eligibleOrigin) {
    announceStatus();
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' });
    window.__plannerServiceWorkerRegistration = registration;
    status.registered = true;
    status.controlling = Boolean(navigator.serviceWorker.controller);
    announceStatus();
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      status.controlling = Boolean(navigator.serviceWorker.controller);
      announceStatus();
    });
    const announceWaitingUpdate = () => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        window.dispatchEvent(new CustomEvent('planner-update-available', { detail: { registration } }));
      }
    };
    announceWaitingUpdate();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) announceWaitingUpdate();
      });
    });
    return true;
  } catch (error) {
    status.error = String(error?.message || error || 'Unknown service-worker registration error');
    announceStatus();
    recordStorageFailure('service-worker-register', 'service-worker.js', error);
    return false;
  }
}

async function initializeApp() {
  WorkflowExpansion.install();
  ModernizationSuite.install();
  ProductExperience.install();
  WorkspaceLayoutV41.install();
  ProductPolishV42.install();
  ProductRepairV43.install();
  UserWorkflowV44.install();
  StartupRecoveryV45.install();
  ProductionReadinessV50.install();
  InterfaceSystemV51.install();
  ClassroomWorkflowV53.install();
  ClassSetupWorkspaceV54.install();
  DistrictIntegrationsV57.install();
  WorkflowRecoveryV62.install();
  SharedDriveCollaborationV64.install();
  await BrowserDataStore.initialize();
  uiState.appDatabaseReady = true;
  uiState.pageSettings = mergePageSettings(null);
  uiState.namesOnlyLayout = uiState.pageSettings.defaultNamesOnly;
  ensureGrid();
  ensureClassSystem();
  ensureAddStudentCollapseUi();
  wireEvents();
  CrossTabCoordinator.install();
  installHintDismissalSupport();
  installMobileTouchSupport();
  installMobileCarrySupport();
  await loadLinkedSaveHandleFromStorage();
  await restoreSameTabReloadSessionEncryptionKey();

  if (safeStorageGet('sessionStorage', PAGE_LOCK_SESSION_KEY) === 'true' && !safeStorageGet('sessionStorage', PAGE_LOCK_DATA_SESSION_KEY)) {
    clearUnlockedPageLockSessionMarker('Cleared a stale lock marker from the previous browser session.');
  }

  if (safeStorageGet('sessionStorage', PAGE_LOCK_SESSION_KEY) === 'true') {
    if (getLockCredential()) {
      uiState.lockedSnapshotEncrypted = safeStorageGet('sessionStorage', PAGE_LOCK_DATA_SESSION_KEY) || '';
      uiState.pageLocked = true;
      renderAll();
      wipeInMemoryChartDataForLock();
      document.body.classList.add('page-locked');
      return;
    }
    safeStorageRemove('sessionStorage', PAGE_LOCK_SESSION_KEY);
    safeStorageRemove('sessionStorage', PAGE_LOCK_DATA_SESSION_KEY);
  }

  let loaded = false;
  let waitingForStartupUnlock = false;
  const primarySaveResult = await BrowserDataStore.getPrimarySaveDetailed();
  uiState.browserStorageStatus = primarySaveResult.status;
  if (primarySaveResult.status === 'ok' && primarySaveResult.payload) {
    const startupResult = await StartupRecoveryV45.inspectInitialSave(primarySaveResult.payload, 'browser autosave');
    loaded = !!startupResult.loaded;
    waitingForStartupUnlock = !!startupResult.waiting;
    if (loaded && primarySaveResult.recovered) {
      setLiveStatusMessage(primarySaveResult.error || 'Recovered the previous browser save after an interrupted write.');
      await BrowserDataStore.setPrimarySave(primarySaveResult.payload);
    } else if (loaded) setLiveStatusMessage('Loaded existing local save automatically.');
    else if (waitingForStartupUnlock) setLiveStatusMessage('Encrypted browser save found. Enter its password to continue, or choose Start Fresh.');
  } else if (['missing-record','storage-unavailable','unsupported-format'].includes(primarySaveResult.status)) {
    const startupResult = StartupRecoveryV45.inspectStorageFailure(primarySaveResult);
    waitingForStartupUnlock = !!startupResult.waiting;
    setLiveStatusMessage('Browser save recovery is required. Automatic saving is paused to protect the existing storage record.');
  }

  if (!loaded) {
    applyPageSettings(uiState.pageSettings, { skipRender: true, applyLoadDefaults: true });
    renderAll();
  }
  restoreGoogleDriveTokenFromSession();
  await SharedDriveCollaborationV64.refreshCurrentUserAccess(false);
  uiState.linkedSaveLastSignature = currentSaveSignature();
  uiState.appReady = !waitingForStartupUnlock;
  if (!waitingForStartupUnlock) await ensureAppSnapshotsLoaded();
  updateSaveHealthPanel();
  schedulePageSettingsPersistence('settings');
  updateSecurityStatusPanel();
  if (waitingForStartupUnlock || shouldShowWelcomeSecuritySetup()) {
    openWelcomeSecurityModal();
  } else if (!uiState.linkedSaveHandle && Number(pageSettings().autoSaveMinutes || 0) > 0) {
    setTimeout(() => writeLocalBrowserSave({ reason: 'auto', announce: false }), 250);
  }
  keepMobileWorkspaceUsable();
  ProductExperience.afterReady();
  WorkspaceLayoutV41.afterReady();
  ProductPolishV42.afterReady();
  ProductRepairV43.afterReady();
  UserWorkflowV44.afterReady();
  StartupRecoveryV45.afterReady();
  ProductionReadinessV50.afterReady();
  InterfaceSystemV51.afterReady();
  ClassroomWorkflowV53.afterReady();
  ClassSetupWorkspaceV54.afterReady();
  DistrictIntegrationsV57.afterReady();
  WorkflowRecoveryV62.afterReady();
  void initializeGoogleAnalytics();
  void registerHostedServiceWorker();
}

window.initializeClassroomSeatingPlanner = initializeApp;

'use strict';

