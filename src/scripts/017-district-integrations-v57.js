const DistrictIntegrationsV57 = (() => {
  let installed = false;
  let classroomToken = '';
  let classroomTokenExpiresAt = 0;
  let rosterDraft = null;
  let revisionContext = null;
  let googleHubObserver = null;
  let classroomCourses = [];
  let classroomStatusMessage = 'Not connected.';

  const node = id => document.getElementById(id);
  function insertSettingsNavigationEntry(id, title, description, beforeId = 'settingsPageAboutBtn') {
    if (node(`settingsPage${id[0].toUpperCase()}${id.slice(1)}Btn`)) return null;
    const button = document.createElement('button');
    button.id = `settingsPage${id[0].toUpperCase()}${id.slice(1)}Btn`;
    button.className = 'settings-page-tab';
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', 'false');
    button.setAttribute('aria-controls', `settingsPage${id[0].toUpperCase()}${id.slice(1)}`);
    button.dataset.settingsNav = id;
    button.innerHTML = `<span class="settings-page-title">${escapeHtml(title)}</span><span class="settings-page-desc">${escapeHtml(description)}</span>`;
    node(beforeId)?.before(button);
    return button;
  }

  function addMobileSettingsOption(id, title) {
    const mobileSelect = node('settingsMobilePageSelect');
    if (!mobileSelect || Array.from(mobileSelect.options).some(option => option.value === id)) return;
    const option = document.createElement('option');
    option.value = id;
    option.textContent = title;
    const aboutOption = Array.from(mobileSelect.options).find(item => item.value === 'about');
    mobileSelect.insertBefore(option, aboutOption || null);
  }

  function injectGoogleSettingsHub() {
    if (node('settingsPageGoogle')) return;
    insertSettingsNavigationEntry('google', 'Google', 'Drive saves, Classroom rosters, analytics, Picker availability, revisions, and cloud connection status.', 'settingsPageAboutBtn');
    const panel = document.createElement('div');
    panel.id = 'settingsPageGoogle';
    panel.className = 'settings-page google-settings-page';
    panel.setAttribute('role', 'tabpanel');
    panel.dataset.settingsPanel = 'google';
    panel.setAttribute('aria-label', 'Google integrations');
    const pickerAction = googlePickerConfigured()
      ? '<button id="googleHubPickerBtn" class="secondary" type="button">Choose Another Drive File</button>'
      : '';
    panel.innerHTML = `
          <div class="settings-page-header"><strong>Google integrations</strong>Manage Google Drive and Google Classroom from one place. Save controls remain under Saving, while roster imports also appear where they belong in Class Setup.</div>
          <div class="google-hub-status-grid" aria-live="polite">
            <div class="save-health-card"><strong>Google Drive</strong><span id="googleHubDriveStatus">Not connected.</span></div>
            <div class="save-health-card"><strong>Google Classroom</strong><span id="googleHubClassroomStatus">Not connected.</span></div>
            <div class="save-health-card"><strong>Google Picker</strong><span id="googleHubPickerStatus">Checking deployment configuration…</span></div>
          </div>
          <section class="section settings-section">
            <h3>Google Drive saves</h3>
            <div class="hint">Save, load, manage, and review revisions for encrypted planner files. Picker is optional and appears only when this deployment includes the project-owned API key and app ID.</div>
            <div class="field"><label for="googleHubPreferredStorage">Preferred Save Now location</label><select id="googleHubPreferredStorage"><option value="browser">Browser local autosave / downloads</option><option value="linked">Linked save file when available</option><option value="googleDrive">Google Drive</option></select></div>
            <div class="google-hub-action-grid">
              <button id="googleHubDriveConnectBtn" class="secondary" type="button">Connect Google Drive</button>
              <button id="googleHubDriveSaveBtn" class="secondary" type="button">Save Encrypted Copy</button>
              <button id="googleHubDriveLoadBtn" class="secondary" type="button">Load from Drive</button>
              <button id="googleHubDriveManageBtn" class="secondary" type="button">Manage Saves &amp; Revisions</button>
              <button id="googleHubDriveShareBtn" class="secondary" type="button">Share Current Drive Save</button>
              ${pickerAction}
              <button id="googleHubDriveDisconnectBtn" class="ghost" type="button">Disconnect Drive</button>
            </div>
            <button id="googleHubOpenSavingBtn" class="ghost tiny google-hub-context-link" type="button">Open Saving Settings</button>
          </section>
          <section class="section settings-section">
            <h3>Google Classroom roster import</h3>
            <div class="hint">Uses read-only course and roster access. Reconciliation preserves existing notes, requirements, memberships, and seating references for matched students.</div>
            <div class="google-hub-action-grid">
              <button id="googleHubClassroomConnectBtn" class="secondary" type="button">Connect Google Classroom</button>
              <button id="googleHubClassroomRefreshBtn" class="secondary" type="button">Refresh Courses</button>
            </div>
            <div class="field"><label for="googleHubClassroomCourseSelect">Course</label><select id="googleHubClassroomCourseSelect"><option value="">Connect to load courses</option></select></div>
            <div class="google-hub-action-grid"><button id="googleHubClassroomReviewBtn" type="button">Review Classroom Roster</button></div>
            <button id="googleHubOpenClassSetupBtn" class="ghost tiny google-hub-context-link" type="button">Open Class Setup Import Roster</button>
          </section>
          <section class="section settings-section google-analytics-settings">
            <h3>Google Analytics</h3>
            <label class="checkline" for="settingGoogleAnalyticsEnabled"><input id="settingGoogleAnalyticsEnabled" type="checkbox" /> <span>Allow anonymous usage analytics on this browser</span></label>
            <div id="googleAnalyticsSettingsStatus" class="hint" aria-live="polite">Checking analytics preference...</div>
            <div class="encryption-note">This browser-only preference is not stored in classroom save files. Analytics is loaded only from hosted HTTP/HTTPS pages, sends the standard page view to measurement ID G-NMRMNM7ZCD, and does not add student names, notes, class names, seat assignments, or save contents as custom events.</div>
          </section>
          <section class="section settings-section">
            <h3>Deployment status</h3>
            <div id="googleHubDeploymentStatus" class="hint">Google OAuth uses the project configuration bundled with this build. Teachers are not asked to enter API keys or project credentials.</div>
          </section>`;
    const beforePanel = node('settingsPageAbout');
    beforePanel?.before(panel);
    if (!SETTINGS_PAGE_IDS.includes('google')) SETTINGS_PAGE_IDS.splice(Math.max(0, SETTINGS_PAGE_IDS.indexOf('about')), 0, 'google');
    addMobileSettingsOption('google', 'Google');
  }

  function readableStatusText(source, fallback) {
    if (!source) return fallback;
    const copy = source.cloneNode(true);
    copy.querySelectorAll('button, .hint-close').forEach(control => control.remove());
    return String(copy.textContent || '').replace(/\s+/g, ' ').trim() || fallback;
  }

  function classroomCourseSelects() {
    return ['classSetupGoogleClassroomCourseSelect', 'googleHubClassroomCourseSelect']
      .map(node)
      .filter(Boolean);
  }

  function selectedClassroomCourseId(preferred = '') {
    const explicit = String(preferred || '').trim();
    if (explicit) return explicit;
    return String(classroomCourseSelects().map(select => select.value).find(Boolean) || '').trim();
  }

  function synchronizeClassroomCourseSelection(value, source = null) {
    const courseId = String(value || '');
    classroomCourseSelects().forEach(select => {
      if (select !== source && Array.from(select.options).some(option => option.value === courseId)) select.value = courseId;
    });
  }

  function populateClassroomCourseSelects(courses = classroomCourses) {
    classroomCourses = Array.isArray(courses) ? courses : [];
    const current = selectedClassroomCourseId();
    const options = '<option value="">Choose a course</option>' + classroomCourses
      .map(course => `<option value="${escapeHtml(course.id)}">${escapeHtml(course.name || course.section || course.id)}</option>`)
      .join('');
    classroomCourseSelects().forEach(select => {
      const previous = select.value || current;
      select.innerHTML = options;
      select.value = Array.from(select.options).some(option => option.value === previous) ? previous : '';
    });
  }

  function updateClassroomStatus(message) {
    classroomStatusMessage = String(message || 'Not connected.');
    ['classSetupGoogleClassroomStatus', 'googleHubClassroomStatus'].forEach(id => {
      const target = node(id);
      if (target) target.textContent = classroomStatusMessage;
    });
  }

  function syncGoogleSettingsHub() {
    const driveStatus = node('googleDriveSettingsStatus');
    if (node('googleHubDriveStatus')) node('googleHubDriveStatus').textContent = readableStatusText(driveStatus, uiState.googleDriveStatus || 'Not connected.');
    if (node('googleHubClassroomStatus')) node('googleHubClassroomStatus').textContent = classroomStatusMessage;
    if (node('googleHubPickerStatus')) node('googleHubPickerStatus').textContent = googlePickerConfigured()
      ? 'Enabled by this deployment. Users can browse and authorize another Drive file.'
      : 'Not configured. Normal Drive saving, loading, management, revisions, and Classroom import still work.';
    if (node('googleHubDeploymentStatus')) node('googleHubDeploymentStatus').textContent = googlePickerConfigured()
      ? 'OAuth and Picker credentials are supplied by this deployment. No teacher-entered cloud credentials are stored in planner data.'
      : 'OAuth is supplied by this deployment. Picker is hidden because no project Picker key was included; all non-Picker Google functions remain available.';
    const preferred = node('googleHubPreferredStorage');
    if (preferred && document.activeElement !== preferred) preferred.value = pageSettings().preferredStorage || 'browser';
    if (classroomCourses.length && node('googleHubClassroomCourseSelect')?.options.length <= 1) populateClassroomCourseSelects();
  }

  function installGoogleHubSynchronization() {
    googleHubObserver?.disconnect?.();
    googleHubObserver = new MutationObserver(syncGoogleSettingsHub);
    const driveStatus = node('googleDriveSettingsStatus');
    if (driveStatus) googleHubObserver.observe(driveStatus, { childList: true, subtree: true, characterData: true });
    updateClassroomStatus(classroomStatusMessage);
    syncGoogleSettingsHub();
  }

  function openSettingsPage(pageId) {
    setSettingsPage(pageId);
    setTimeout(syncGoogleSettingsHub, 0);
  }

  function injectCloudModals() {
    if (!node('driveManagerModal')) {
      const shell = document.createElement('div');
      const pickerManagerButton = googlePickerConfigured() ? '<button id="driveManagerPickerBtn" class="secondary" type="button">Choose another Drive file</button>' : '';
      shell.innerHTML = `
            <div id="driveManagerModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="driveManagerTitle"><div class="modal modern-modal drive-manager-modal"><div class="panel-header"><h2 id="driveManagerTitle">Google Drive Save Manager</h2><button id="closeDriveManagerBtn" class="tiny secondary" type="button">Close</button></div><div class="modal-body"><div id="driveManagerStatus" class="hint">Connect to list planner saves.</div><div class="button-row"><button id="driveManagerRefreshBtn" class="secondary" type="button">Refresh</button>${pickerManagerButton}</div><div id="driveManagerList" class="drive-manager-list"></div></div></div></div>
            <div id="driveRevisionModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="driveRevisionTitle"><div class="modal modern-modal drive-revision-modal"><div class="panel-header"><h2 id="driveRevisionTitle">Drive Revision Browser</h2><button id="closeDriveRevisionBtn" class="tiny secondary" type="button">Close</button></div><div class="modal-body"><div id="driveRevisionStatus" class="hint"></div><div id="driveRevisionList" class="drive-revision-list"></div></div></div></div>
            <div id="districtRosterModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="districtRosterTitle"><div class="modal modern-modal district-roster-modal"><div class="panel-header"><h2 id="districtRosterTitle">Review District Roster</h2><button id="closeDistrictRosterBtn" class="tiny secondary" type="button">Close</button></div><div class="modal-body"><div id="districtRosterSummary" class="reconcile-summary-grid"></div><div id="districtRosterPreview" class="csv-preview-table"></div><section class="section"><h3>Apply changes</h3><label class="checkline"><input id="districtRosterUpdateMatched" type="checkbox" checked /> Update names, grade, nickname, and source identifiers for matched students</label><label class="checkline"><input id="districtRosterAddNew" type="checkbox" checked /> Add new students</label><label class="checkline"><input id="districtRosterArchiveMissing" type="checkbox" /> Archive students missing from this roster</label><label class="checkline"><input id="districtRosterPreserveDetails" type="checkbox" checked /> Preserve notes, seating requirements, groups, zones, and assignments for matched students</label></section><div class="button-row"><button id="applyDistrictRosterBtn" type="button">Apply Reconciliation</button><button id="cancelDistrictRosterBtn" class="secondary" type="button">Cancel</button></div></div></div></div>`;
      while (shell.firstElementChild) document.body.appendChild(shell.firstElementChild);
    }
  }

  function injectDriveControls() {
    const pickerReady = googlePickerConfigured();
    const driveButtons = node('settingsGoogleDriveForgetBtn')?.closest('.button-row');
    if (driveButtons && !node('settingsGoogleDriveManageBtn')) {
      driveButtons.insertAdjacentHTML('beforeend','<button id="settingsGoogleDriveManageBtn" class="secondary" type="button">Manage Drive Saves</button>');
      if (pickerReady) driveButtons.insertAdjacentHTML('beforeend','<button id="settingsGoogleDrivePickerBtn" class="secondary" type="button">Choose another Drive file</button>');
      driveButtons.insertAdjacentHTML('beforeend','<button id="openGoogleSettingsFromSavingBtn" class="ghost" type="button">Open Google Settings</button>');
    }
    const chooserButtons = node('openGoogleDriveFileBtn')?.closest('.button-row');
    if (pickerReady && chooserButtons && !node('googleDrivePickerBtn')) chooserButtons.insertAdjacentHTML('afterbegin','<button id="googleDrivePickerBtn" class="secondary" type="button">Choose another Drive file</button>');
    const safeBody = node('safeSharePreview')?.parentElement;
    if (safeBody && !node('downloadReadOnlyClassroomBtn')) {
      const section = document.createElement('section');
      section.className='section';
      section.innerHTML = `
        <h3>Read-only classroom package</h3>
        <div class="hint">Creates a standalone HTML file with only the selected privacy profile. Add a separate viewer password to encrypt the included classroom data inside the HTML file.</div>
        <div class="field"><label for="readOnlyPackagePreset">Package profile</label><select id="readOnlyPackagePreset"><option value="student">Student-facing names only</option><option value="substitute">Substitute chart, grades, and approved notes</option><option value="anonymous">Anonymous numbered chart</option><option value="room">Room layout only</option></select></div>
        <div id="readOnlyPackageProfileSummary" class="hint mini"></div>
        <label class="checkline"><input id="readOnlyPackagePasswordToggle" type="checkbox" /> Password-protect and encrypt this HTML package</label>
        <div id="readOnlyPackagePasswordFields" class="row" hidden>
          <div class="field"><label for="readOnlyPackagePassword">Viewer password</label><input id="readOnlyPackagePassword" type="password" autocomplete="new-password" minlength="10" maxlength="256" /></div>
          <div class="field"><label for="readOnlyPackagePasswordConfirm">Confirm password</label><input id="readOnlyPackagePasswordConfirm" type="password" autocomplete="new-password" minlength="10" maxlength="256" /></div>
        </div>
        <div id="readOnlyPackageStatus" class="muted">Unprotected packages open immediately. Protected packages require the viewer password and keep the classroom data encrypted at rest.</div>
        <button id="downloadReadOnlyClassroomBtn" type="button">Download Read-only Classroom HTML</button>`;
      safeBody.insertBefore(section,node('safeSharePreview'));
    }
  }

  function loadGooglePickerScript() {
    return loadExternalScriptOnce({
      src: 'https://apis.google.com/js/api.js',
      markerAttribute: 'data-google-picker-api',
      ready: () => Boolean(window.gapi?.load),
      errorMessage: 'Could not load Google Picker. Check the network and content security policy.'
    });
  }

  async function openGooglePicker(options = {}) {
    const cfg = googleDriveConfig();
    if (!googlePickerConfigured()) {
      const pickerStatus = googlePickerConfigurationStatus();
      if (!options.silent) setLiveStatusMessage(`Google Picker is not ready for this deployment. Missing: ${pickerStatus.missing.join(', ')}. Use the planner Drive save list until deployment configuration is complete.`);
      return false;
    }
    try {
      const token = await ensureGoogleDriveToken(true);
      await loadGooglePickerScript();
      await new Promise((resolve, reject) => window.gapi.load('picker', {
        callback: resolve,
        onerror: () => reject(new Error('Google Picker library did not initialize.'))
      }));
      return await new Promise(resolve => {
        const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
          .setMimeTypes('application/json')
          .setIncludeFolders(false)
          .setSelectFolderEnabled(false);
        const builder = new window.google.picker.PickerBuilder()
          .setOAuthToken(token)
          .setDeveloperKey(cfg.pickerApiKey)
          .setAppId(cfg.pickerAppId)
          .setTitle('Choose a Classroom Seating Planner save')
          .addView(view)
          .setCallback(async data => {
            if (data.action === window.google.picker.Action.PICKED) {
              const doc = data.docs?.[0];
              if (!doc?.id) { resolve(false); return; }
              try {
                await loadGoogleDriveFileById({ id: doc.id, name: doc.name || 'Selected Drive file' }, options);
                resolve(true);
              } catch (err) {
                WorkflowRecoveryV62.reportFailure({
                  operation: 'Load Google Drive File From Picker',
                  source: doc.name || 'Selected Drive file',
                  error: err,
                  dataChanged: false,
                  snapshotCreated: false,
                  remedy: 'Reconnect Google Drive, verify access to the selected planner save, and retry.',
                  retry: () => loadGoogleDriveFileById({ id: doc.id, name: doc.name || 'Selected Drive file' }, options)
                });
                resolve(false);
              }
            } else if (data.action === window.google.picker.Action.CANCEL) {
              resolve(false);
            }
          });
        if (location.protocol === 'https:' && typeof builder.setOrigin === 'function') builder.setOrigin(location.origin);
        if (window.google.picker.Feature?.SUPPORT_DRIVES && typeof builder.enableFeature === 'function') builder.enableFeature(window.google.picker.Feature.SUPPORT_DRIVES);
        builder.build().setVisible(true);
      });
    } catch (err) {
      if (!options.silent) {
        WorkflowRecoveryV62.reportFailure({
          operation: 'Open Google Drive Picker',
          source: 'Google Picker',
          error: err,
          dataChanged: false,
          snapshotCreated: false,
          remedy: 'Confirm the deployment has a valid Picker API key and App ID, allow the Google API script in the content security policy, reconnect, and retry.',
          retry: () => openGooglePicker(options)
        });
      }
      return false;
    }
  }



  async function fetchDriveFileMetadata(fileId) {
    const response=await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime,createdTime,size,mimeType,appProperties,webViewLink,version,md5Checksum,headRevisionId,ownedByMe,capabilities(canEdit,canTrash,canRename,canCopy)`,{method:'GET'});
    return response.json();
  }

  async function openDriveManager() { injectCloudModals(); node('driveManagerModal')?.classList.add('show'); await refreshDriveManager(); }
  function closeDriveManager(){node('driveManagerModal')?.classList.remove('show');}
  async function refreshDriveManager() {
    const status = node('driveManagerStatus');
    const list = node('driveManagerList');
    if (status) status.textContent = 'Loading Drive saves…';
    if (list) list.innerHTML = '';
    try {
      const files = await listGoogleDriveSaveFiles();
      uiState.googleDriveFiles = files;
      if (status) status.textContent = `${files.length} planner save${files.length === 1 ? '' : 's'} available.`;
      if (list) list.innerHTML = files.length ? files.map(file => `<article class="drive-manager-row" data-drive-file-id="${escapeHtml(file.id)}"><div><strong>${escapeHtml(file.name||'Unnamed save')}</strong><span>Modified ${escapeHtml(file.modifiedTime?new Date(file.modifiedTime).toLocaleString():'unknown')} · version ${escapeHtml(file.version||'unknown')}</span></div><div class="drive-manager-actions"><button class="tiny secondary" data-drive-action="active" type="button">Use</button><button class="tiny secondary" data-drive-action="revisions" type="button">Revisions</button><button class="tiny secondary" data-drive-action="rename" type="button">Rename</button><button class="tiny secondary" data-drive-action="copy" type="button">Duplicate</button><button class="tiny secondary" data-drive-action="open" type="button">Drive</button><button class="tiny danger" data-drive-action="trash" type="button">Trash</button></div></article>`).join('') : '<div class="restore-empty">No planner saves are currently visible to this app.</div>';
      return files;
    } catch (err) {
      if (status) status.textContent = `Drive manager failed: ${err.message}`;
      WorkflowRecoveryV62.reportFailure({
        operation: 'Refresh Google Drive Save Manager',
        source: 'Google Drive',
        error: err,
        dataChanged: false,
        snapshotCreated: false,
        remedy: 'Reconnect Google Drive, confirm network access and OAuth deployment settings, then refresh the save list.',
        retry: refreshDriveManager
      });
      return [];
    }
  }


  async function handleDriveManagerAction(button) {
    const row = button.closest('[data-drive-file-id]');
    const id = row?.dataset.driveFileId;
    const action = button.dataset.driveAction;
    if (!id) return;
    let file = null;
    try {
      file = (uiState.googleDriveFiles || []).find(item => item.id === id) || await fetchDriveFileMetadata(id);
      if (action === 'active') {
        const meta = await fetchDriveFileMetadata(id);
        updateGoogleDriveSettings({ preferredStorage:'googleDrive', googleDriveFileId:id, googleDriveFileName:meta.name||'', googleDriveLastSavedAt:meta.modifiedTime||'', googleDriveFileVersion:String(meta.version||''), googleDriveHeadRevisionId:String(meta.headRevisionId||''), googleDriveRemoteMd5:String(meta.md5Checksum||'') });
        setLiveStatusMessage(`${meta.name || 'Drive save'} is now the active Drive save.`);
        return;
      }
      if (action === 'open') {
        const webLink = trustedGoogleDriveWebLink(file.webViewLink);
        if (webLink) window.open(webLink, '_blank', 'noopener');
        return;
      }
      if (action === 'revisions') {
        await openRevisionBrowser(file);
        return;
      }
      if (action === 'rename') {
        const name = window.prompt('New Google Drive filename', file.name || 'seating-chart-save.json');
        if (!name) return;
        await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,modifiedTime,version,headRevisionId,md5Checksum`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:String(name).trim().slice(0,180)}) });
        await refreshDriveManager();
        return;
      }
      if (action === 'copy') {
        await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/copy?fields=id,name,modifiedTime,version,headRevisionId,md5Checksum`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:`Copy of ${file.name || 'planner save'}`}) });
        await refreshDriveManager();
        return;
      }
      if (action === 'trash') {
        showInAppConfirm(`Move ${file.name || 'this Drive save'} to Google Drive Trash?`, () => void (async () => {
          try {
            await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,trashed`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({trashed:true}) });
            if (pageSettings().googleDriveFileId === id) updateGoogleDriveSettings({googleDriveFileId:'',googleDriveFileName:'',googleDriveLastSavedAt:'',googleDriveFileVersion:'',googleDriveHeadRevisionId:'',googleDriveRemoteMd5:''});
            await refreshDriveManager();
          } catch (err) {
            WorkflowRecoveryV62.reportFailure({ operation:'Move Google Drive Save to Trash', source:file.name || id, error:err, dataChanged:false, snapshotCreated:false, remedy:'Confirm that the connected Google account can edit this file, then retry.', retry:() => handleDriveManagerAction(button) });
          }
        })(), {title:'Trash Drive Save?',confirmText:'Move to Trash',cancelText:'Cancel'});
      }
    } catch (err) {
      WorkflowRecoveryV62.reportFailure({
        operation: `Google Drive ${action || 'file'} action`,
        source: file?.name || id,
        error: err,
        dataChanged: false,
        snapshotCreated: false,
        remedy: 'Reconnect Google Drive, confirm permission to the selected file, and retry the action.',
        retry: () => handleDriveManagerAction(button)
      });
    }
  }


  async function openRevisionBrowser(file) {
    revisionContext = file;
    node('driveRevisionModal')?.classList.add('show');
    const status = node('driveRevisionStatus');
    const list = node('driveRevisionList');
    if (status) status.textContent = `Loading revisions for ${file.name || 'Drive save'}…`;
    if (list) list.innerHTML = '';
    try {
      const response = await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/revisions?pageSize=100&fields=nextPageToken,revisions(id,modifiedTime,size,originalFilename,md5Checksum,keepForever,published)`, {method:'GET'});
      const data = await response.json();
      const revisions = data.revisions || [];
      if (status) status.textContent = `${revisions.length} revision${revisions.length === 1 ? '' : 's'} available. Google may return only the accessible portion of very large histories.`;
      if (list) list.innerHTML = revisions.length ? revisions.slice().reverse().map(rev => `<article class="drive-revision-row" data-revision-id="${escapeHtml(rev.id)}"><div><strong>${escapeHtml(rev.originalFilename||file.name||'Revision')}</strong><span>${escapeHtml(rev.modifiedTime?new Date(rev.modifiedTime).toLocaleString():'Unknown date')} · ${escapeHtml(googleDriveFileSizeLabel(rev.size))}${rev.keepForever?' · kept forever':''}</span></div><div class="button-row"><button class="tiny secondary" data-revision-action="restore" type="button">Open Restore</button><button class="tiny secondary" data-revision-action="download" type="button">Download</button></div></article>`).join('') : '<div class="restore-empty">No downloadable revisions were returned.</div>';
      return revisions;
    } catch (err) {
      if (status) status.textContent = `Could not load revisions: ${err.message}`;
      WorkflowRecoveryV62.reportFailure({
        operation: 'Load Google Drive Revision History',
        source: file.name || file.id,
        error: err,
        dataChanged: false,
        snapshotCreated: false,
        remedy: 'Confirm access to the selected Drive file and reconnect before retrying the revision list.',
        retry: () => openRevisionBrowser(file)
      });
      return [];
    }
  }

  async function fetchRevisionText(revisionId) {
    if (!revisionContext?.id) throw new Error('No Drive file is selected.');
    const response = await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(revisionContext.id)}/revisions/${encodeURIComponent(revisionId)}?alt=media`, {method:'GET'});
    return readResponseTextWithinLimits(response, 'Google Drive revision', IMPORT_LIMITS.saveBytes);
  }

  async function handleRevisionAction(button) {
    const revisionId = button.closest('[data-revision-id]')?.dataset.revisionId;
    if (!revisionId) return;
    try {
      const text = await fetchRevisionText(revisionId);
      if (button.dataset.revisionAction === 'download') {
        downloadText(backupFilename('drive-revision','json'), text, 'application/json');
        return;
      }
      await importStateFromText(text, `Google Drive revision ${revisionId}`);
    } catch (err) {
      WorkflowRecoveryV62.reportFailure({
        operation: button.dataset.revisionAction === 'download' ? 'Download Google Drive Revision' : 'Open Google Drive Revision Restore',
        source: revisionContext?.name || revisionId,
        error: err,
        dataChanged: false,
        snapshotCreated: false,
        remedy: 'Reconnect Google Drive, confirm the revision is still available, and retry.',
        retry: () => handleRevisionAction(button)
      });
    }
  }


  async function ensureClassroomToken(interactive=true){
    if(classroomToken&&Date.now()<classroomTokenExpiresAt-60000)return classroomToken;
    if(!interactive)throw new Error('Google Classroom needs a fresh sign-in.');
    await loadGoogleIdentityServicesScript(); const clientId=googleDriveConfig().clientId; if(!clientId)throw new Error('Configure a Google OAuth Client ID under Saving first.');
    return new Promise((resolve,reject)=>{const client=window.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:GOOGLE_CLASSROOM_SCOPES,prompt:'',callback:response=>{if(response?.error){reject(new Error(response.error_description||response.error));return;}classroomToken=response.access_token||'';classroomTokenExpiresAt=Date.now()+Number(response.expires_in||3600)*1000;resolve(classroomToken);}});client.requestAccessToken({prompt:'consent'});});
  }
  async function classroomFetch(url) {
    const token = await ensureClassroomToken(true);
    const response = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json())?.error?.message || ''; } catch {   }
      throw new Error(detail || `Google Classroom request failed (${response.status}).`);
    }
    return response;
  }
  async function refreshClassroomCourses(){
    updateClassroomStatus('Loading active Google Classroom courses…');
    try {
      let token = '';
      const seenPageTokens = new Set();
      let completedPages = 0;
      const courses = [];
      do {
        const params = new URLSearchParams({ teacherId:'me', courseStates:'ACTIVE', pageSize:'100' });
        if (token) params.set('pageToken', token);
        const response = await classroomFetch(`https://classroom.googleapis.com/v1/courses?${params}`);
        const data = await response.json();
        if (Array.isArray(data.courses)) courses.push(...data.courses);
        completedPages += 1;
        token = nextBoundedPageToken(seenPageTokens, data.nextPageToken, completedPages, 'Google Classroom course listing');
      } while (token);
      populateClassroomCourseSelects(courses);
      updateClassroomStatus(`${courses.length} active course${courses.length === 1 ? '' : 's'} available.`);
      return courses;
    } catch (err) {
      classroomCourses = [];
      populateClassroomCourseSelects([]);
      updateClassroomStatus(`Classroom connection failed: ${err.message}`);
      WorkflowRecoveryV62.reportFailure({
        operation: 'Connect to Google Classroom',
        source: 'Google Classroom course list',
        error: err,
        dataChanged: false,
        snapshotCreated: false,
        remedy: 'Reconnect with an account that can read the classroom roster, confirm the OAuth scopes and network access, then retry.',
        retry: refreshClassroomCourses
      });
      return [];
    }
  }

  async function loadClassroomRoster(requestedCourseId = ''){
    const courseId = selectedClassroomCourseId(requestedCourseId);
    if (!courseId) {
      setLiveStatusMessage('Choose a Google Classroom course first.');
      updateClassroomStatus('Choose a Google Classroom course before reviewing its roster.');
      return;
    }
    synchronizeClassroomCourseSelection(courseId);
    updateClassroomStatus('Loading course roster…');
    try {
      let token = '';
      const seenPageTokens = new Set();
      let completedPages = 0;
      const records = [];
      do {
        const params = new URLSearchParams({ pageSize:'100' });
        if (token) params.set('pageToken', token);
        const response = await classroomFetch(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/students?${params}`);
        const data = await response.json();
        records.push(...(data.students || []).map(item => ({
          externalId: item.userId || item.profile?.id || '',
          firstName: item.profile?.name?.givenName || '',
          lastName: item.profile?.name?.familyName || '',
          nickName: item.profile?.name?.fullName && !item.profile?.name?.familyName ? item.profile.name.fullName : '',
          grade: '',
          email: item.profile?.emailAddress || '',
          sourceSystem: 'google-classroom',
          sourceCourseId: courseId,
          sourceUserId: item.userId || item.profile?.id || '',
          sourceIdentifiers: { externalId: item.userId || item.profile?.id || '', email: item.profile?.emailAddress || '' }
        })));
        if (records.length > IMPORT_LIMITS.maxStudentsPerClass) throw new Error(`Google Classroom returned more than ${IMPORT_LIMITS.maxStudentsPerClass.toLocaleString()} students.`);
        completedPages += 1;
        token = nextBoundedPageToken(seenPageTokens, data.nextPageToken, completedPages, 'Google Classroom roster');
      } while (token);
      let sourceGroups = [];
      let groupNotice = '';
      if (window.InteroperabilityV69?.loadGoogleClassroomGroups) {
        try {
          sourceGroups = await window.InteroperabilityV69.loadGoogleClassroomGroups(courseId, classroomFetch);
        } catch (groupError) {
          groupNotice = ` Student groups could not be loaded: ${groupError.message}`;
        }
      }
      if (window.InteroperabilityV69?.reviewRecords) {
        window.InteroperabilityV69.reviewRecords(records, { sourceSystem: 'google-classroom', label: 'Google Classroom', sourceCourseId: courseId, groups: sourceGroups });
      } else {
        openRosterDraft(records.map(normalizeStudent), 'Google Classroom');
      }
      updateClassroomStatus(`Loaded ${records.length} students and ${sourceGroups.length} Classroom group${sourceGroups.length === 1 ? '' : 's'} for reconciliation.${groupNotice}`);
    } catch (err) {
      updateClassroomStatus(`Classroom roster load failed: ${err.message}`);
      WorkflowRecoveryV62.reportFailure({
        operation: 'Load Google Classroom Roster',
        source: courseId,
        error: err,
        dataChanged: false,
        snapshotCreated: false,
        remedy: 'Confirm the course still exists, the signed-in account can view its students, and the Classroom roster scope is approved.',
        retry: () => loadClassroomRoster(courseId)
      });
    }
  }

  function studentMatchKey(student){return `${String(student.firstName||'').trim().toLowerCase()}|${String(student.lastName||'').trim().toLowerCase()}`;}
  function buildRosterDraft(records,source){const existingById=new Map(state.students.map(student=>[String(student.id),student]));const existingByName=new Map(state.students.map(student=>[studentMatchKey(student),student]));const matched=[],added=[],duplicates=[],seen=new Set();records.forEach(incoming=>{const key=incoming.id&&existingById.has(String(incoming.id))?`id:${incoming.id}`:`name:${studentMatchKey(incoming)}`;if(seen.has(key)){duplicates.push(incoming);return;}seen.add(key);const existing=existingById.get(String(incoming.id))||existingByName.get(studentMatchKey(incoming));if(existing)matched.push({existing,incoming,changed:['firstName','lastName','nickName','grade'].some(field=>String(existing[field]||'')!==String(incoming[field]||''))});else added.push(incoming);});const matchedIds=new Set(matched.map(item=>String(item.existing.id)));const missing=state.students.filter(student=>!matchedIds.has(String(student.id)));return{source,matched,added,missing,duplicates};}
  function openRosterDraft(records,source){rosterDraft=buildRosterDraft(records,source);injectCloudModals();renderRosterDraft();node('districtRosterModal')?.classList.add('show');}
  function renderRosterDraft(){if(!rosterDraft)return;const cards=[['Matched',rosterDraft.matched.length],['New',rosterDraft.added.length],['Missing',rosterDraft.missing.length],['Duplicates',rosterDraft.duplicates.length]];if(node('districtRosterSummary'))node('districtRosterSummary').innerHTML=cards.map(([label,count])=>`<div class="workflow-card"><strong>${count}</strong><span>${escapeHtml(label)}</span></div>`).join('');const rows=[...rosterDraft.matched.map(item=>['Matched',studentDisplay(item.existing),studentDisplay(item.incoming)]),...rosterDraft.added.map(item=>['New','',studentDisplay(item)]),...rosterDraft.missing.map(item=>['Missing',studentDisplay(item),'']),...rosterDraft.duplicates.map(item=>['Duplicate','',studentDisplay(item)])].slice(0,250);if(node('districtRosterPreview'))node('districtRosterPreview').innerHTML=`<table><thead><tr><th>Status</th><th>Current</th><th>${escapeHtml(rosterDraft.source)}</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}</td></tr>`).join('')}</tbody></table>`;}
  function applyRosterDraft(){if(!rosterDraft)return;pushUndoSnapshot('district roster reconciliation');const update=node('districtRosterUpdateMatched')?.checked,add=node('districtRosterAddNew')?.checked,archive=node('districtRosterArchiveMissing')?.checked,preserve=node('districtRosterPreserveDetails')?.checked;if(update)rosterDraft.matched.forEach(({existing,incoming})=>{const kept=preserve?{notesPrivate:existing.notesPrivate,notesSubstitute:existing.notesSubstitute,notesPublic:existing.notesPublic,noteCategories:existing.noteCategories,requirements:existing.requirements}:{};Object.assign(existing,incoming,kept,{id:existing.id});});if(add)state.students.push(...rosterDraft.added.map(normalizeStudent));if(archive){state.rosterArchive=state.rosterArchive||[];const ids=new Set(rosterDraft.missing.map(item=>String(item.id)));state.rosterArchive.push(...state.students.filter(item=>ids.has(String(item.id))).map(normalizeStudent));state.students=state.students.filter(item=>!ids.has(String(item.id)));}renderTargeted(['class-manager','roster','rules','room','status'],{reason:'district-roster'});node('districtRosterModal')?.classList.remove('show');setLiveStatusMessage(`${rosterDraft.source} roster reconciliation applied.`);rosterDraft=null;}

  function parseSisCsvText(text) {
    assertImportTextWithinLimits(text, 'SIS CSV', IMPORT_LIMITS.csvBytes);
    const matrix = parseCsvMatrix(text);
    if (matrix.length < 2) throw new Error('The SIS CSV needs a header row and at least one student.');
    const headers = matrix[0].map(value => String(value || '').trim());
    const index = {
      firstName: optionalColumnIndex(guessCsvColumn(headers, ['first name', 'firstname', 'given name', 'givenname'])),
      lastName: optionalColumnIndex(guessCsvColumn(headers, ['last name', 'lastname', 'family name', 'familyname', 'surname'])),
      nickName: optionalColumnIndex(guessCsvColumn(headers, ['preferred name', 'nickname', 'display name'])),
      grade: optionalColumnIndex(guessCsvColumn(headers, ['grade', 'grade level', 'level'])),
      id: optionalColumnIndex(guessCsvColumn(headers, ['sourcedid', 'sis id', 'student id', 'local id', 'student number', 'identifier']))
    };
    if (index.firstName < 0 && index.lastName < 0 && index.id < 0) throw new Error('No recognized first-name or last-name column, or student-ID column, was found.');
    const value = (row, key) => Number.isInteger(index[key]) && index[key] >= 0 ? String(row[index[key]] || '').trim() : '';
    const records = [];
    const rejectedRows = [];
    matrix.slice(1).forEach((row, rowIndex) => {
      if (!row.some(cell => String(cell || '').trim())) return;
      const values = {
        firstName: value(row, 'firstName'),
        lastName: value(row, 'lastName'),
        nickName: value(row, 'nickName'),
        grade: value(row, 'grade'),
        id: value(row, 'id')
      };
      if (!(values.firstName || values.lastName || values.id)) {
        const source = csvRejectedRowSource(headers, row);
        rejectedRows.push({ rowNumber: rowIndex + 2, reason: 'No recognized name or student ID.', ...source });
        return;
      }
      records.push(normalizeStudent({ ...values, id: values.id || undefined, sourceSystem: 'sis-csv' }));
    });
    if (!records.length) throw new Error('No usable student rows with recognized names or IDs were found.');
    Object.defineProperty(records, 'rejectedRows', { value: rejectedRows, enumerable: false });
    return records;
  }


  async function importSisCsv(file) {
    if (!file) return;
    const status = node('classSetupSisStatus');
    try {
      const records = parseSisCsvText(await readTextFileWithinLimits(file, 'SIS CSV', IMPORT_LIMITS.csvBytes));
      openRosterDraft(records, 'SIS CSV');
      const rejectedRows = records.rejectedRows || [];
      if (status) status.textContent = `Loaded ${records.length} SIS records for reconciliation${rejectedRows.length ? `; ${rejectedRows.length} row${rejectedRows.length === 1 ? '' : 's'} rejected` : ''}.`;
      if (rejectedRows.length) {
        WorkflowRecoveryV62.reportFailure({
          operation: 'SIS CSV Loaded With Rejected Rows',
          source: file.name,
          error: new Error(`${rejectedRows.length} row${rejectedRows.length === 1 ? '' : 's'} did not contain a recognized name or student ID.`),
          dataChanged: false,
          snapshotCreated: false,
          rejectedRows,
          remedy: 'Download the rejected-row report. Continue with the valid reconciliation draft, then correct and re-import the rejected records.'
        });
      }
    } catch (err) {
      if (status) status.textContent = `SIS import failed: ${err.message}`;
      WorkflowRecoveryV62.reportFailure({
        operation: 'Open SIS CSV Import',
        source: file.name,
        error: err,
        dataChanged: false,
        snapshotCreated: false,
        remedy: 'Confirm the file is valid CSV and includes a recognizable first name, last name, or student-ID column.',
        retry: () => importSisCsv(file)
      });
    } finally {
      if (node('classSetupSisCsvInput')) node('classSetupSisCsvInput').value = '';
    }
  }


  const READ_ONLY_PACKAGE_PROFILES = Object.freeze({
    student: Object.freeze({
      label: 'Student-facing names only',
      summary: 'Includes student display names, assigned seats, and the room layout. Grades, IDs, notes, requirements, groups, and zones are excluded.',
      included: Object.freeze(['Student display names', 'Assigned seats', 'Room layout']),
      anonymous: false,
      roomOnly: false,
      grade: false,
      publicNotes: false,
      substituteNotes: false
    }),
    substitute: Object.freeze({
      label: 'Substitute chart, grades, and approved notes',
      summary: 'Includes student display names, grades, public notes, substitute notes, assigned seats, and the room layout. Private notes, student IDs, and seating requirements are excluded.',
      included: Object.freeze(['Student display names', 'Grades', 'Public notes', 'Substitute notes', 'Assigned seats', 'Room layout']),
      anonymous: false,
      roomOnly: false,
      grade: true,
      publicNotes: true,
      substituteNotes: true
    }),
    anonymous: Object.freeze({
      label: 'Anonymous numbered chart',
      summary: 'Replaces student names with numbered placeholders while preserving assignments and the room layout. Grades, IDs, and notes are excluded.',
      included: Object.freeze(['Numbered student placeholders', 'Assigned seats', 'Room layout']),
      anonymous: true,
      roomOnly: false,
      grade: false,
      publicNotes: false,
      substituteNotes: false
    }),
    room: Object.freeze({
      label: 'Room layout only',
      summary: 'Includes only the Grid or Freeform room geometry and room objects. Student records, assignments, grades, IDs, and notes are excluded.',
      included: Object.freeze(['Room layout', 'Room objects']),
      anonymous: false,
      roomOnly: true,
      grade: false,
      publicNotes: false,
      substituteNotes: false
    })
  });

  function readOnlyPackageProfile(preset) {
    return READ_ONLY_PACKAGE_PROFILES[preset] || READ_ONLY_PACKAGE_PROFILES.student;
  }

  function safeStudentPackage(preset) {
    persistActiveClass();
    const profile = readOnlyPackageProfile(preset);
    const source = deepClone(activeClassRecord() || {});
    const idMap = new Map();
    source.students = (source.students || []).map((student, index) => {
      const nextId = profile.anonymous ? `student-${index + 1}` : `shared-${index + 1}`;
      idMap.set(String(student.id), nextId);
      const publicNote = profile.publicNotes ? studentNoteValue(student, 'public') : '';
      const substituteNote = profile.substituteNotes ? studentNoteValue(student, 'substitute') : '';
      return {
        id: nextId,
        firstName: profile.anonymous ? 'Student' : student.firstName,
        lastName: profile.anonymous ? String(index + 1) : student.lastName,
        nickName: profile.anonymous ? '' : student.nickName,
        grade: profile.grade ? student.grade : '',
        notesPublic: publicNote,
        notesSubstitute: substituteNote,
        notesPrivate: '',
        noteCategories: { public: publicNote, substitute: substituteNote, private: '' }
      };
    });
    Object.values(source.cells || {}).forEach(cell => {
      if (cell.assignedStudentId) cell.assignedStudentId = idMap.get(String(cell.assignedStudentId)) || null;
      cell.anchorGroupIds = [];
      cell.zoneIds = [];
    });
    (source.freeformLayout?.objects || []).forEach(object => {
      if (object.assignedStudentId) object.assignedStudentId = idMap.get(String(object.assignedStudentId)) || null;
      object.anchorGroupIds = [];
      object.zoneIds = [];
      object.groupId = '';
    });
    source.groups = [];
    source.zones = [];
    source.rosterArchive = [];
    source.seatingPlans = [];
    source.importProfiles = [];
    source.snapshots = [];
    if (profile.roomOnly) {
      source.students = [];
      Object.values(source.cells || {}).forEach(cell => { cell.assignedStudentId = null; });
      (source.freeformLayout?.objects || []).forEach(object => { object.assignedStudentId = null; });
    }
    return source;
  }

  function readOnlyClassToken(value, fallback = 'empty') {
    const token = String(value || fallback).trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
    return token || fallback;
  }

  function readOnlyNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function readOnlyStudentDetailsMarkup(student, preset) {
    if (!student) return '';
    const profile = readOnlyPackageProfile(preset);
    const details = [];
    if (profile.grade && String(student.grade || '').trim()) details.push(`<span>Grade ${escapeHtml(student.grade)}</span>`);
    return details.length ? `<div class="readonly-student-details">${details.join('')}</div>` : '';
  }

  function readOnlyStudentSeatMarkup(student, preset) {
    if (!student) return '';
    return `<div class="readonly-student-name">${escapeHtml(studentDisplay(student))}</div>${readOnlyStudentDetailsMarkup(student, preset)}`;
  }

  function readOnlyGridMarkup(cls, studentMap, preset) {
    const rows = Math.max(1, Math.trunc(readOnlyNumber(cls.rows, 1)));
    const cols = Math.max(1, Math.trunc(readOnlyNumber(cls.cols, 1)));
    const cells = [];
    for (let row = 1; row <= rows; row += 1) {
      for (let col = 1; col <= cols; col += 1) {
        const cellKey = `${row}-${col}`;
        const cell = cls.cells?.[cellKey] || {};
        const type = String(cell.type || 'empty');
        const student = studentMap.get(String(cell.assignedStudentId || ''));
        const cellLabel = type === 'seat'
          ? (student ? readOnlyStudentSeatMarkup(student, preset) : 'Unassigned')
          : (cell.label || objectLabel(type));
        cells.push(`<div class="readonly-cell cell ${readOnlyClassToken(type)}" data-cell-key="${escapeHtml(cellKey)}">
          <div class="readonly-cell-heading"><span>${row},${col}</span><span>${escapeHtml(objectLabel(type))}</span></div>
          <div class="readonly-cell-content${student ? ' assigned' : ''}">${student ? cellLabel : escapeHtml(cellLabel)}</div>
        </div>`);
      }
    }
    return `<div class="readonly-room-viewport"><div class="readonly-grid" style="--readonly-cols:${cols}">${cells.join('')}</div></div>`;
  }

  function readOnlyFreeformObjectMarkup(object, studentMap, preset) {
    const type = String(object.type || 'custom');
    const student = studentMap.get(String(object.assignedStudentId || ''));
    const title = student ? studentDisplay(student) : (type === 'seat' ? 'Unassigned' : (object.label || objectLabel(type)));
    const studentDetails = student ? readOnlyStudentDetailsMarkup(student, preset) : '';
    const label = String(object.label || '').trim();
    const color = safeColor(object.color, objectTypeColor(type));
    const classes = [
      'readonly-object',
      'freeform-object',
      readOnlyClassToken(type, 'custom'),
      type === 'seat' ? (student ? 'assigned' : 'unassigned') : '',
      object.locked ? 'locked' : '',
      object.groupId ? 'grouped' : ''
    ].filter(Boolean).join(' ');
    const style = [
      `left:${readOnlyNumber(object.x, 0)}px`,
      `top:${readOnlyNumber(object.y, 0)}px`,
      `width:${Math.max(1, readOnlyNumber(object.width, type === 'seat' ? DEFAULT_FREEFORM_SEAT_WIDTH : 160))}px`,
      `height:${Math.max(1, readOnlyNumber(object.height, type === 'seat' ? DEFAULT_FREEFORM_SEAT_HEIGHT : 96))}px`,
      `z-index:${Math.max(1, Math.trunc(readOnlyNumber(object.zIndex, 1)))}`,
      `background:${color}`,
      `transform:rotate(${readOnlyNumber(object.rotation, 0)}deg)`
    ].join(';');
    const meta = type === 'seat'
      ? `<span class="readonly-pill">Seat</span>${label && !/^seat$/i.test(label) ? `<span class="readonly-pill subtle">${escapeHtml(label)}</span>` : ''}`
      : `<span class="readonly-pill subtle">${escapeHtml(objectLabel(type))}</span>`;
    return `<div class="${classes}" style="${style}">
      <div class="readonly-object-title${student ? '' : ' placeholder'}">${escapeHtml(title)}</div>
      ${studentDetails}
      <div class="readonly-object-meta">${meta}</div>
    </div>`;
  }

  function readOnlyFreeformMarkup(cls, studentMap, preset) {
    const canvas = cls.freeformLayout?.canvas || {};
    const width = Math.max(1, readOnlyNumber(canvas.width, 1200));
    const height = Math.max(1, readOnlyNumber(canvas.height, 760));
    const gridSize = Math.max(4, readOnlyNumber(canvas.gridSize, 20));
    const frontSide = ['top', 'right', 'bottom', 'left'].includes(String(canvas.frontSide || '').toLowerCase())
      ? String(canvas.frontSide).toLowerCase()
      : 'top';
    const objects = [...(cls.freeformLayout?.objects || [])]
      .sort((a, b) => readOnlyNumber(a.zIndex, 1) - readOnlyNumber(b.zIndex, 1))
      .map(object => readOnlyFreeformObjectMarkup(object, studentMap, preset))
      .join('');
    return `<div class="readonly-room-viewport readonly-freeform-viewport"><div class="readonly-freeform-stage" style="width:${width}px;height:${height}px"><div class="readonly-freeform" style="width:${width}px;height:${height}px;background-size:${gridSize}px ${gridSize}px"><div class="readonly-room-marker side-${frontSide}">Front of Room</div>${objects}</div></div></div>`;
  }

  function readOnlyRoomMarkup(cls, preset) {
    const studentMap = new Map((cls.students || []).map(student => [String(student.id), student]));
    return cls.layoutMode === 'freeform'
      ? readOnlyFreeformMarkup(cls, studentMap, preset)
      : readOnlyGridMarkup(cls, studentMap, preset);
  }

  function readOnlyNotesMarkup(cls, preset) {
    const profile = readOnlyPackageProfile(preset);
    if (!profile.publicNotes && !profile.substituteNotes) return '';
    const notes = (cls.students || [])
      .map(student => {
        const lines = [];
        const publicNote = profile.publicNotes ? studentNoteValue(student, 'public') : '';
        const substituteNote = profile.substituteNotes ? studentNoteValue(student, 'substitute') : '';
        if (publicNote) lines.push(`<div class="readonly-note-line"><strong>Public</strong><span>${escapeHtml(publicNote)}</span></div>`);
        if (substituteNote) lines.push(`<div class="readonly-note-line"><strong>Substitute</strong><span>${escapeHtml(substituteNote)}</span></div>`);
        if (!lines.length) return '';
        const grade = profile.grade && String(student.grade || '').trim() ? `<span class="readonly-note-grade">Grade ${escapeHtml(student.grade)}</span>` : '';
        return `<li><div class="readonly-note-student"><strong>${escapeHtml(studentDisplay(student))}</strong>${grade}</div><div class="readonly-note-lines">${lines.join('')}</div></li>`;
      })
      .filter(Boolean)
      .join('');
    return notes ? `<section class="readonly-notes"><h2>Approved student notes</h2><p class="readonly-notes-summary">Only the note categories allowed by the selected package profile are included.</p><ul>${notes}</ul></section>` : '';
  }

  function readOnlyProfileMarkup(preset) {
    const profile = readOnlyPackageProfile(preset);
    return `<section class="readonly-profile-summary"><strong>${escapeHtml(profile.label)}</strong><span>${escapeHtml(profile.summary)}</span><div>${profile.included.map(item => `<span class="readonly-profile-chip">${escapeHtml(item)}</span>`).join('')}</div></section>`;
  }

  function readOnlyViewerStyles() {
    return `:root{color-scheme:light;--readonly-cell-width:112px;--readonly-cell-height:133px;--readonly-border:#c9d3e3;--readonly-text:#172033;--readonly-muted:#607089}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#eef2f7;color:var(--readonly-text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{padding:20px}header,.readonly-content{width:min(100%,1800px);margin:0 auto}header{margin-bottom:14px}h1{margin:0;font-size:clamp(22px,3vw,34px);letter-spacing:-.035em}.readonly-summary{margin:5px 0 0;color:var(--readonly-muted);font-size:12px}.readonly-notice{padding:9px 11px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;margin:10px 0 0;color:#1e3a8a;font-size:12px;line-height:1.4}.readonly-room-viewport{width:100%;overflow:auto;padding:14px;background-color:#f8fafc;background-image:linear-gradient(rgba(120,137,163,.075) 1px,transparent 1px),linear-gradient(90deg,rgba(120,137,163,.075) 1px,transparent 1px);background-size:24px 24px;border:1px solid #d7deea;border-radius:14px;box-shadow:0 10px 24px rgba(15,23,42,.08)}.readonly-grid{display:grid;grid-template-columns:repeat(var(--readonly-cols),var(--readonly-cell-width));grid-auto-rows:minmax(var(--readonly-cell-height),auto);gap:7px;width:max-content;min-width:0;margin:0 auto}.readonly-cell{position:relative;width:var(--readonly-cell-width);min-height:var(--readonly-cell-height);display:flex;flex-direction:column;justify-content:flex-start;overflow:hidden;padding:7px;border:1px dashed #c9d3e3;border-radius:11px;background:#fbfcff;box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 1px 2px rgba(15,23,42,.04)}.readonly-cell-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:5px;color:#607089;font-size:9.5px;font-weight:850;line-height:1.15}.readonly-cell-heading span:last-child{text-align:right}.readonly-cell-content{display:grid;place-items:center;flex:1 1 auto;min-height:48px;padding:6px 3px;color:#475467;font-size:10.8px;font-weight:750;line-height:1.22;text-align:center;overflow-wrap:anywhere}.readonly-cell-content.assigned{color:#14213d;font-size:11.2px;font-weight:850}.readonly-student-name{font-weight:900;line-height:1.2;overflow-wrap:anywhere}.readonly-student-details{display:flex;justify-content:center;gap:4px;flex-wrap:wrap;margin-top:4px;color:#475569;font-size:9.5px;font-weight:800}.readonly-student-details span{padding:2px 5px;border:1px solid rgba(148,163,184,.55);border-radius:999px;background:rgba(255,255,255,.72)}.cell.seat{background:linear-gradient(180deg,#eff6ff 0%,#dbeafe 100%);border-color:#9db7ef}.cell.blocked{color:#fff;background:repeating-linear-gradient(135deg,#313846,#313846 8px,#3f4859 8px,#3f4859 16px);border-color:#222a36}.cell.blocked .readonly-cell-heading,.cell.blocked .readonly-cell-content{color:rgba(255,255,255,.88)}.cell.teacher{background:#fff3d6;border-color:#ffd074}.cell.table{background:#e8f7ec;border-color:#9ce0b2}.cell.door{background:#fce8ee;border-color:#f6a3bb}.cell.wall{color:#344054;background:repeating-linear-gradient(90deg,#d9dee8,#d9dee8 6px,#c7cfdb 6px,#c7cfdb 12px);border-color:#9aa7b8}.cell.walkway{color:#475467;background:repeating-linear-gradient(45deg,#fff,#fff 8px,#edf2f7 8px,#edf2f7 16px);border-style:dashed;border-color:#aab7c8}.cell.window{color:#075985;background:linear-gradient(135deg,#e0f2fe,#f0f9ff);border-color:#7dd3fc}.cell.projector{color:#3730a3;background:linear-gradient(135deg,#eef2ff,#f8fafc);border-color:#a5b4fc}.cell.board{color:#166534;background:linear-gradient(135deg,#dcfce7,#f0fdf4);border-color:#86efac}.cell.carpet{color:#7c4a03;background:repeating-linear-gradient(45deg,#f5e8d3,#f5e8d3 8px,#eed7b6 8px,#eed7b6 16px);border-color:#d6a45f}.cell.ada{color:#155e75;background:repeating-linear-gradient(135deg,#ecfeff,#ecfeff 8px,#cffafe 8px,#cffafe 16px);border-color:#67e8f9}.readonly-freeform-viewport{padding:14px}.readonly-freeform-stage{position:relative;min-width:max-content;min-height:max-content;margin:0 auto}.readonly-freeform{position:relative;background-color:#f8fafc;background-image:linear-gradient(to right,rgba(148,163,184,.22) 1px,transparent 1px),linear-gradient(to bottom,rgba(148,163,184,.22) 1px,transparent 1px),radial-gradient(circle at top left,rgba(255,255,255,.95),rgba(248,250,252,.86) 45%,rgba(241,245,249,.76) 100%);border:1px solid rgba(148,163,184,.55);border-radius:16px;box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 10px 30px rgba(15,23,42,.07);overflow:visible}.readonly-object{position:absolute;display:grid;place-items:center;align-content:center;justify-items:center;gap:5px;min-width:0;padding:9px;border:1px solid rgba(15,23,42,.14);border-radius:16px;color:#0f172a;box-shadow:0 8px 20px rgba(15,23,42,.08),inset 0 1px 0 rgba(255,255,255,.84);transform-origin:center center;overflow:hidden}.readonly-object.seat{min-width:160px;min-height:100px;align-content:start;padding:11px 10px 9px;background:linear-gradient(180deg,rgba(255,255,255,.92) 0%,rgba(248,250,252,.9) 100%)}.readonly-object.seat.assigned{border-color:rgba(96,165,250,.55)}.readonly-object.seat.unassigned{border-style:dashed;border-color:rgba(148,163,184,.52)}.readonly-object.blocked{color:#fff}.readonly-object.wall{border-radius:8px}.readonly-object.walkway{border-style:dashed;opacity:.88}.readonly-object.locked{border-style:dashed}.readonly-object.grouped{border-style:double}.readonly-object-title{width:100%;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;color:inherit;font-size:12px;font-weight:900;line-height:1.2;letter-spacing:-.01em;text-align:center;overflow-wrap:anywhere}.readonly-object-title.placeholder{color:#475569;font-weight:800}.readonly-object-meta{display:flex;justify-content:center;gap:5px;flex-wrap:wrap;width:100%;font-size:10px;color:#475569;line-height:1.1}.readonly-pill{display:inline-flex;align-items:center;padding:2px 6px;border:1px solid #cfe0ff;border-radius:999px;background:#edf3ff;color:#1e55bd;font-size:10px;font-weight:800}.readonly-pill.subtle{border-color:#d7deea;background:#f8fafc;color:#475569}.readonly-room-marker{position:absolute;z-index:0;display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border:1px solid rgba(59,130,246,.18);border-radius:999px;background:rgba(255,255,255,.88);color:#1d4ed8;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 3px 12px rgba(15,23,42,.07);pointer-events:none}.readonly-room-marker.side-top{top:8px;left:50%;transform:translateX(-50%)}.readonly-room-marker.side-bottom{right:auto;bottom:8px;left:50%;transform:translateX(-50%)}.readonly-room-marker.side-left{top:50%;left:8px;transform:translateY(-50%) rotate(-90deg)}.readonly-room-marker.side-right{top:50%;right:8px;transform:translateY(-50%) rotate(90deg)}.readonly-profile-summary{display:grid;gap:6px;margin:10px 0 0;padding:10px 11px;border:1px solid #d7deea;border-radius:10px;background:#fff}.readonly-profile-summary>strong{font-size:12px}.readonly-profile-summary>span{color:#607089;font-size:11px;line-height:1.4}.readonly-profile-summary>div{display:flex;gap:5px;flex-wrap:wrap}.readonly-profile-chip{display:inline-flex;padding:3px 7px;border:1px solid #bfdbfe;border-radius:999px;background:#eff6ff;color:#1e3a8a;font-size:9.5px;font-weight:850}.readonly-notes{width:min(100%,1800px);margin:16px auto 0;padding:12px;background:#fff;border:1px solid #cbd5e1;border-radius:12px}.readonly-notes h2{margin:0 0 4px;font-size:16px}.readonly-notes-summary{margin:0 0 10px;color:#607089;font-size:11px}.readonly-notes ul{display:grid;gap:8px;margin:0;padding:0;list-style:none}.readonly-notes li{display:grid;grid-template-columns:minmax(140px,.55fr) minmax(0,1.45fr);gap:10px;padding:8px;border:1px solid #e2e8f0;border-radius:8px}.readonly-note-student{display:grid;align-content:start;gap:3px}.readonly-note-grade{color:#607089;font-size:10px;font-weight:800}.readonly-note-lines{display:grid;gap:6px}.readonly-note-line{display:grid;grid-template-columns:76px minmax(0,1fr);gap:7px;align-items:start}.readonly-note-line strong{color:#475569;font-size:10px}.readonly-note-line span{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:700px){body{padding:10px}.readonly-room-viewport{padding:8px}.readonly-notes li{grid-template-columns:1fr}}@media print{body{padding:0;background:#fff}.readonly-notice{display:none}.readonly-room-viewport{overflow:visible;padding:0;border:0;box-shadow:none;background:#fff}.readonly-grid{margin:0 auto}.readonly-freeform-viewport{overflow:visible}.readonly-notes{border-color:#94a3b8;break-before:auto}}`;
  }

  function readOnlyDocumentParts(preset) {
    const cls = safeStudentPackage(preset);
    const title = `${cls.name || 'Classroom'} · Read-only`;
    const room = readOnlyRoomMarkup(cls, preset);
    const notes = readOnlyNotesMarkup(cls, preset);
    const mode = cls.layoutMode === 'freeform' ? 'Freeform room' : `${Math.max(1, Number(cls.rows) || 1)} × ${Math.max(1, Number(cls.cols) || 1)} Grid`;
    const body = `<header><h1>${escapeHtml(title)}</h1><p class="readonly-summary">${escapeHtml(mode)} · ${cls.students?.length || 0} included student${cls.students?.length === 1 ? '' : 's'}</p><div class="readonly-notice">Read-only classroom package generated ${escapeHtml(new Date().toLocaleString())}. It contains no editing controls, Settings, cloud credentials, or hidden source records.</div>${readOnlyProfileMarkup(preset)}</header><main class="readonly-content">${room}</main>${notes}`;
    return { title, body };
  }

  function readOnlyHtml(preset) {
    const { title, body } = readOnlyDocumentParts(preset);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><style>${readOnlyViewerStyles()}</style></head><body>${body}</body></html>`;
  }

  function encryptedReadOnlyHtmlShell(envelope) {
    const encoded = JSON.stringify(envelope).replace(/</g, '\u003c');
    const unlockStyles = `.readonly-unlock{width:min(520px,calc(100% - 24px));margin:10vh auto;padding:24px;background:#fff;border:1px solid #cbd5e1;border-radius:16px;box-shadow:0 20px 60px rgba(15,23,42,.16)}.readonly-unlock h1{font-size:24px}.readonly-unlock p{color:#607089;line-height:1.45}.readonly-unlock input{width:100%;min-height:42px;padding:10px;border:1px solid #94a3b8;border-radius:9px;font:inherit}.readonly-unlock button{min-height:40px;margin-top:10px;padding:9px 14px;border:0;border-radius:9px;background:#2563eb;color:#fff;font:inherit;font-weight:800;cursor:pointer}.readonly-unlock-error{min-height:20px;color:#b42318;font-size:12px;font-weight:750}.readonly-protected-view[hidden],.readonly-unlock[hidden]{display:none}`;
    const unlockScript = `
      const envelope = ${encoded};
      const MIN_ITERATIONS = ${PBKDF2_MIN_ITERATIONS};
      const MAX_ITERATIONS = ${PBKDF2_MAX_ITERATIONS};
      const MAX_CIPHERTEXT_BASE64 = ${Math.ceil(IMPORT_LIMITS.saveBytes * 4 / 3) + 16};
      const b64 = value => Uint8Array.from(atob(String(value || '')), character => character.charCodeAt(0));
      function sanitizedViewerFragment(html) {
        const template = document.createElement('template');
        template.innerHTML = String(html || '');
        template.content.querySelectorAll('script,iframe,object,embed,form,link,meta,base,template,svg,math').forEach(node => node.remove());
        template.content.querySelectorAll('*').forEach(node => {
          Array.from(node.attributes).forEach(attribute => {
            const name = attribute.name.toLowerCase();
            const value = attribute.value.trim();
            if (name.startsWith('on') || ['srcdoc','action','formaction','target'].includes(name)) node.removeAttribute(attribute.name);
            else if (name === 'href' && !value.startsWith('#')) node.removeAttribute(attribute.name);
            else if (name === 'src' && !/^data:image\\/(?:png|gif|jpeg|webp);base64,/i.test(value)) node.removeAttribute(attribute.name);
            else if (name === 'style' && /url\\s*\\(|expression\\s*\\(|@import|behavior\\s*:|-moz-binding/i.test(value)) node.removeAttribute(attribute.name);
          });
        });
        return template.content;
      }
      async function openReadOnlyPackage() {
        const error = document.getElementById('readonlyUnlockError');
        const passwordInput = document.getElementById('readonlyViewerPassword');
        error.textContent = '';
        try {
          if (!globalThis.crypto?.subtle) throw new Error('Web Crypto unavailable');
          if (envelope?.format !== 'classroom-seating-planner-encrypted-envelope-v6' || envelope?.encryptionEnvelopeVersion !== 3) throw new Error('Unsupported envelope');
          const encryption = envelope.encryption || {};
          if (encryption.algorithm !== 'AES-GCM' || encryption.kdf !== 'PBKDF2-SHA-256') throw new Error('Unsupported encryption');
          const iterations = Number(encryption.iterations);
          if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) throw new Error('Invalid work factor');
          if (typeof encryption.salt !== 'string' || encryption.salt.length > 64
            || typeof encryption.iv !== 'string' || encryption.iv.length > 64
            || typeof encryption.ciphertext !== 'string' || encryption.ciphertext.length > MAX_CIPHERTEXT_BASE64) throw new Error('Damaged envelope');
          const salt = b64(encryption.salt);
          const iv = b64(encryption.iv);
          const ciphertext = b64(encryption.ciphertext);
          if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17) throw new Error('Damaged envelope');
          const password = passwordInput.value;
          if (password.length < 10 || password.length > 256) throw new Error('Invalid password length');
          const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
          const key = await crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations, hash:'SHA-256' }, baseKey, { name:'AES-GCM', length:256 }, false, ['decrypt']);
          const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, ciphertext);
          const payload = JSON.parse(new TextDecoder().decode(plain));
          if (!payload || payload.format !== 'classroom-seating-planner-read-only-html-v1' || typeof payload.body !== 'string') throw new Error('Invalid payload');
          document.title = String(payload.title || 'Read-only classroom');
          const viewer = document.getElementById('readonlyProtectedView');
          viewer.replaceChildren(sanitizedViewerFragment(payload.body));
          viewer.hidden = false;
          passwordInput.value = '';
          document.getElementById('readonlyUnlock').hidden = true;
        } catch (_) {
          error.textContent = 'Could not decrypt this package. Check the viewer password and try again.';
        }
      }
      document.getElementById('readonlyOpenButton').addEventListener('click', openReadOnlyPackage);
      document.getElementById('readonlyViewerPassword').addEventListener('keydown', event => { if (event.key === 'Enter') openReadOnlyPackage(); });
    `;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; media-src 'none'; base-uri 'none'; form-action 'none'"><title>Encrypted read-only classroom package</title><style>${readOnlyViewerStyles()}${unlockStyles}</style></head><body><section id="readonlyUnlock" class="readonly-unlock"><h1>Encrypted read-only classroom package</h1><p>Enter the viewer password supplied separately. The classroom name, students, notes, and room layout remain encrypted until the password is accepted.</p><label for="readonlyViewerPassword">Viewer password</label><input id="readonlyViewerPassword" type="password" autocomplete="current-password" minlength="10" maxlength="256"><button id="readonlyOpenButton" type="button">Open classroom</button><p id="readonlyUnlockError" class="readonly-unlock-error" role="alert"></p></section><div id="readonlyProtectedView" class="readonly-protected-view" hidden></div><script>${unlockScript}<\/script></body></html>`;
  }

  function confirmedViewerPassword(password, confirmation = password) {
    const secret = String(password || '');
    if (secret.length < 10 || secret.length > 256) throw new Error('Use a viewer password with 10 to 256 characters.');
    if (secret !== String(confirmation || '')) throw new Error('The viewer passwords do not match.');
    return secret;
  }

  async function buildEncryptedReadOnlyHtml(password, preset = 'student') {
    const secret = confirmedViewerPassword(password);
    const parts = readOnlyDocumentParts(preset);
    const payload = JSON.stringify({
      format: 'classroom-seating-planner-read-only-html-v1',
      app: APP_NAME,
      version: APP_REVISION,
      createdAt: new Date().toISOString(),
      preset,
      title: parts.title,
      body: parts.body
    });
    const envelope = JSON.parse(await encryptTextWithSecret(payload, secret, 'shared-viewer', {
      payloadKind: 'read-only-classroom-html',
      viewerFormat: 'classroom-seating-planner-read-only-html-v1',
      readOnly: true,
      preset
    }));
    return encryptedReadOnlyHtmlShell(envelope);
  }

  function syncReadOnlyPackageProtectionUi() {
    const preset = node('readOnlyPackagePreset')?.value || 'student';
    const profile = readOnlyPackageProfile(preset);
    const enabled = Boolean(node('readOnlyPackagePasswordToggle')?.checked);
    const fields = node('readOnlyPackagePasswordFields');
    if (fields) fields.hidden = !enabled;
    const summary = node('readOnlyPackageProfileSummary');
    if (summary) summary.innerHTML = `<strong>${escapeHtml(profile.label)}</strong><br>${escapeHtml(profile.summary)}`;
    const status = node('readOnlyPackageStatus');
    if (status) status.textContent = enabled
      ? `Protected package: ${profile.label}. Classroom data will be encrypted inside the HTML file. Send the viewer password separately.`
      : `Unprotected package: ${profile.label}. The included fields will be readable in the downloaded HTML source.`;
  }

  async function downloadReadOnlyPackage() {
    const preset = node('readOnlyPackagePreset')?.value || 'student';
    const protectedPackage = Boolean(node('readOnlyPackagePasswordToggle')?.checked);
    let html = '';
    let suffix = `read-only-${preset}`;
    if (protectedPackage) {
      const password = String(node('readOnlyPackagePassword')?.value || '');
      const confirmation = String(node('readOnlyPackagePasswordConfirm')?.value || '');
      const secret = confirmedViewerPassword(password, confirmation);
      html = await buildEncryptedReadOnlyHtml(secret, preset);
      suffix = `read-only-${preset}-protected`;
    } else {
      html = readOnlyHtml(preset);
    }
    downloadText(`${String(activeClassName() || 'class').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${suffix}.html`, html, 'text/html');
    const status = node('readOnlyPackageStatus');
    if (status) status.textContent = protectedPackage
      ? 'Protected read-only classroom HTML downloaded. Send the viewer password through a separate channel.'
      : 'Read-only classroom HTML downloaded without password protection.';
    setLiveStatusMessage(protectedPackage ? 'Protected read-only classroom HTML downloaded.' : 'Read-only classroom HTML package downloaded.');
  }

  function openClassSetupImport() {
    node('closeSettingsBtn')?.click();
    ProductExperience.setWorkflow('setup');
    ClassSetupWorkspaceV54.setSection('import');
    setTimeout(() => node('classSetupGoogleClassroomConnectBtn')?.focus(), 0);
  }

  function bindClassroomSelect(select) {
    select?.addEventListener('change', event => synchronizeClassroomCourseSelection(event.target.value, event.target));
  }

  function installEvents(){
    document.addEventListener('click',event=>{const sisButton=event.target.closest('#classSetupSisCsvBtn');if(sisButton){event.preventDefault();const input=node('classSetupSisCsvInput');if(input){const status=node('classSetupSisStatus');if(status)status.textContent='Choose a SIS / OneRoster CSV file to continue.';input.click();}return;}const driveAction=event.target.closest('[data-drive-action]');if(driveAction){void handleDriveManagerAction(driveAction);return;}const revisionAction=event.target.closest('[data-revision-action]');if(revisionAction){void handleRevisionAction(revisionAction);return;}if(event.target.closest('[data-settings-nav="google"]'))setTimeout(syncGoogleSettingsHub,0);});
    document.addEventListener('change',event=>{if(event.target?.id==='classSetupSisCsvInput')void importSisCsv(event.target.files?.[0]);});
    node('openGoogleSettingsFromSavingBtn')?.addEventListener('click',()=>openSettingsPage('google'));
    node('googleHubOpenSavingBtn')?.addEventListener('click',()=>openSettingsPage('saving'));
    node('googleHubOpenClassSetupBtn')?.addEventListener('click',openClassSetupImport);
    node('googleHubPreferredStorage')?.addEventListener('change',event=>{const original=node('settingPreferredStorage');if(original){original.value=event.target.value;original.dispatchEvent(new Event('input',{bubbles:true}));}syncGoogleSettingsHub();});
    node('googleHubDriveConnectBtn')?.addEventListener('click',()=>node('settingsGoogleDriveConnectBtn')?.click());
    node('googleHubDriveSaveBtn')?.addEventListener('click',()=>node('settingsGoogleDriveSaveBtn')?.click());
    node('googleHubDriveLoadBtn')?.addEventListener('click',()=>node('settingsGoogleDriveLoadBtn')?.click());
    node('googleHubDriveManageBtn')?.addEventListener('click',()=>void openDriveManager());
    node('googleHubPickerBtn')?.addEventListener('click',()=>void openGooglePicker({direct:false}));
    node('googleHubDriveDisconnectBtn')?.addEventListener('click',()=>node('settingsGoogleDriveForgetBtn')?.click());
    node('googleHubClassroomConnectBtn')?.addEventListener('click',()=>void refreshClassroomCourses());
    node('googleHubClassroomRefreshBtn')?.addEventListener('click',()=>void refreshClassroomCourses());
    node('googleHubClassroomReviewBtn')?.addEventListener('click',()=>void loadClassroomRoster(node('googleHubClassroomCourseSelect')?.value));
    node('classSetupGoogleClassroomConnectBtn')?.addEventListener('click',()=>void refreshClassroomCourses());
    node('classSetupGoogleClassroomRefreshBtn')?.addEventListener('click',()=>void refreshClassroomCourses());
    node('classSetupGoogleClassroomImportBtn')?.addEventListener('click',()=>void loadClassroomRoster(node('classSetupGoogleClassroomCourseSelect')?.value));
    bindClassroomSelect(node('googleHubClassroomCourseSelect'));
    bindClassroomSelect(node('classSetupGoogleClassroomCourseSelect'));
    node('settingsGoogleDrivePickerBtn')?.addEventListener('click',()=>void openGooglePicker({direct:false}));node('googleDrivePickerBtn')?.addEventListener('click',()=>void openGooglePicker(uiState.googleDriveChooserContext||{}));
    node('settingsGoogleDriveManageBtn')?.addEventListener('click',()=>void openDriveManager());node('closeDriveManagerBtn')?.addEventListener('click',closeDriveManager);node('driveManagerRefreshBtn')?.addEventListener('click',()=>void refreshDriveManager());node('driveManagerPickerBtn')?.addEventListener('click',()=>void openGooglePicker({direct:false}));
    node('closeDriveRevisionBtn')?.addEventListener('click',()=>node('driveRevisionModal')?.classList.remove('show'));
    node('closeDistrictRosterBtn')?.addEventListener('click',()=>node('districtRosterModal')?.classList.remove('show'));node('cancelDistrictRosterBtn')?.addEventListener('click',()=>node('districtRosterModal')?.classList.remove('show'));node('applyDistrictRosterBtn')?.addEventListener('click',applyRosterDraft);
    node('readOnlyPackagePreset')?.addEventListener('change', syncReadOnlyPackageProtectionUi);
    node('readOnlyPackagePasswordToggle')?.addEventListener('change', syncReadOnlyPackageProtectionUi);
    node('downloadReadOnlyClassroomBtn')?.addEventListener('click', () => void downloadReadOnlyPackage().catch(error => {
      const status = node('readOnlyPackageStatus');
      if (status) status.textContent = error.message;
      setLiveStatusMessage(error.message);
    }));
    syncReadOnlyPackageProtectionUi();
  }

  function resetForFactoryReset(){
    classroomToken='';
    classroomTokenExpiresAt=0;
    classroomCourses=[];
    classroomStatusMessage='Not connected.';
    rosterDraft=null;
    revisionContext=null;
    googleHubObserver?.disconnect?.();
    googleHubObserver=null;
    populateClassroomCourseSelects([]);
    updateClassroomStatus('Not connected.');
    if(node('classSetupSisStatus'))node('classSetupSisStatus').textContent='No SIS file selected.';
    if(node('classSetupSisCsvInput'))node('classSetupSisCsvInput').value='';
    syncGoogleSettingsHub();
  }

  function install(){if(installed)return;installed=true;injectGoogleSettingsHub();injectCloudModals();injectDriveControls();installEvents();installGoogleHubSynchronization();document.body.dataset.districtIntegrations=APP_REVISION;}
  function afterReady(){syncGoogleSettingsHub();}
  return Object.freeze({
    install,
    afterReady,
    openGooglePicker,
    googlePickerConfigured,
    openDriveManager,
    refreshDriveManager,
    openRevisionBrowser,
    refreshClassroomCourses,
    loadClassroomRoster,
    downloadReadOnlyPackage,
    buildReadOnlyHtml: readOnlyHtml,
    buildEncryptedReadOnlyHtml,
    confirmedViewerPassword,
    encryptedReadOnlyHtmlShell,
    buildRosterDraft,
    parseSisCsvText,
    syncGoogleSettingsHub,
    resetForFactoryReset
  });
})();



