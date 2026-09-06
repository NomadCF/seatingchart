const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipDateParts(date = new Date()) {
  const time = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | Math.floor((date.getSeconds() & 63) / 2);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = Math.max(date.getFullYear() - 1980, 0);
  const dosDate = (year << 9) | (month << 5) | day;
  return { time, date: dosDate };
}

function createZipBlob(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = zipDateParts(new Date());
  files.forEach(file => {
    const nameBytes = utf8Bytes(file.name);
    const dataBytes = file.bytes || utf8Bytes(file.content || '');
    const crc = crc32(dataBytes);
    const local = concatBytes([
      le32(0x04034b50), le16(20), le16(0x0800), le16(0), le16(now.time), le16(now.date),
      le32(crc), le32(dataBytes.length), le32(dataBytes.length), le16(nameBytes.length), le16(0), nameBytes, dataBytes
    ]);
    const central = concatBytes([
      le32(0x02014b50), le16(20), le16(20), le16(0x0800), le16(0), le16(now.time), le16(now.date),
      le32(crc), le32(dataBytes.length), le32(dataBytes.length), le16(nameBytes.length), le16(0), le16(0), le16(0), le16(0), le32(0), le32(offset), nameBytes
    ]);
    localParts.push(local);
    centralParts.push(central);
    offset += local.length;
  });
  const centralDir = concatBytes(centralParts);
  const localData = concatBytes(localParts);
  const end = concatBytes([
    le32(0x06054b50), le16(0), le16(0), le16(files.length), le16(files.length), le32(centralDir.length), le32(localData.length), le16(0)
  ]);
  return new Blob([localData, centralDir, end], { type: 'application/zip' });
}

async function downloadSavePackageCore() {
  try {
    const payload = await exportPayload('all');
    const encrypted = payload.includes('"encrypted": true');
    const meta = {
      app: APP_NAME,
      revision: APP_REVISION,
      createdAt: new Date().toISOString(),
      activeClassId: state.activeClassId,
      classCount: state.classes.length,
      encrypted
    };
    const readme = [
      'Seating Chart Save Package',
      '',
      'classes.json contains the editable seating chart data.',
      'backup-info.json describes when and how this package was created.',
      'Open Classroom Seating Planner, then use Upload Classes File to restore classes.json.',
      '',
      'This package is encrypted. You need the same encryption password to upload it.'
    ].join('\n');
    const zip = createZipBlob([
      { name: 'classes.json', content: payload },
      { name: 'backup-info.json', content: JSON.stringify(meta, null, 2) },
      { name: 'README.txt', content: readme }
    ]);
    triggerBlobDownload(backupFilename('encrypted-package', 'zip'), zip);
    await ModernizationSuite.recordBackupVerification(payload, 'Complete encrypted backup package');
    updateSaveMeta({ lastPackageAt: new Date().toISOString(), lastBackupAt: new Date().toISOString() });
    updateSaveSetupDismissed(true);
    updateSaveHealthPanel();
    setLiveStatusMessage('Save package downloaded. Keep the ZIP somewhere safe.');
  } catch (err) {
    setLiveStatusMessage(`Could not download save package: ${err.message}`);
  }
}

function buildStudentDataPayload() {
  const seatByStudent = new Map();
  Object.entries(state.cells || {}).forEach(([key, cell]) => {
    if (cell.assignedStudentId) seatByStudent.set(String(cell.assignedStudentId), key);
  });
  const groupNamesByStudent = new Map();
  (state.groups || []).forEach(group => {
    (group.studentIds || []).forEach(id => {
      const key = String(id);
      if (!groupNamesByStudent.has(key)) groupNamesByStudent.set(key, []);
      groupNamesByStudent.get(key).push(group.name || group.id);
    });
  });
  return {
    format: COMPONENT_EXPORT_FORMAT,
    app: APP_NAME,
    kind: 'seating-chart-student-data',
    version: APP_REVISION,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    minimumReaderSchemaVersion: MIN_SUPPORTED_DATA_SCHEMA_VERSION,
    encryptionEnvelopeVersion: ENCRYPTION_ENVELOPE_VERSION,
    className: activeClassRecord()?.name || '',
    exportedAt: new Date().toISOString(),
    students: (state.students || []).map(student => ({
      ...deepClone(student),
      assignedSeat: seatByStudent.get(String(student.id)) || '',
      groupNames: groupNamesByStudent.get(String(student.id)) || []
    }))
  };
}

async function downloadStudentDataJsonCore() {
  try {
    if (!currentSessionEncryptionKey()) throw new Error('A session encryption password is required before exporting student data.');
    const payload = await addBackupManifest(JSON.stringify(buildStudentDataPayload(), null, 2), 'student-data');
    const encrypted = await encryptTextWithSecret(payload, currentSessionEncryptionKey(), 'student-data', { payloadKind: 'component-export' });
    downloadText(`student-data-encrypted-${new Date().toISOString().slice(0,10)}.json`, encrypted, 'application/json');
    setLiveStatusMessage('Encrypted student data downloaded.');
  } catch (err) {
    setLiveStatusMessage(`Could not export student data securely: ${err.message}`);
  }
}

async function downloadGroupConfigJsonCore() {
  const studentNameById = new Map((state.students || []).map(s => [s.id, studentDisplay(s)]));
  const payload = {
    format: COMPONENT_EXPORT_FORMAT,
    app: APP_NAME,
    version: APP_REVISION,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    minimumReaderSchemaVersion: MIN_SUPPORTED_DATA_SCHEMA_VERSION,
    encryptionEnvelopeVersion: ENCRYPTION_ENVELOPE_VERSION,
    kind: 'seating-chart-groups-config',
    className: activeClassRecord()?.name || '',
    exportedAt: new Date().toISOString(),
    groups: (state.groups || []).map(group => ({
      id: group.id,
      name: group.name,
      type: group.type,
      priority: group.priority,
      color: group.color,
      zoneId: group.zoneId || '',
      studentIds: [...(group.studentIds || [])],
      studentNames: (group.studentIds || []).map(id => studentNameById.get(id) || id),
      anchorSeats: [...(group.anchorSeats || [])]
    })),
    zones: deepClone(state.zones || [])
  };
  try {
    if (!currentSessionEncryptionKey()) throw new Error('A session encryption password is required before exporting group and zone data.');
    const manifested = await addBackupManifest(JSON.stringify(payload, null, 2), 'group-config');
    const encrypted = await encryptTextWithSecret(manifested, currentSessionEncryptionKey(), 'group-config', { payloadKind: 'component-export' });
    downloadText(`group-config-encrypted-${new Date().toISOString().slice(0,10)}.json`, encrypted, 'application/json');
    setLiveStatusMessage('Encrypted group and zone configuration downloaded.');
  } catch (err) {
    setLiveStatusMessage(`Could not export group and zone data securely: ${err.message}`);
  }
}

async function downloadRoomLayoutJsonCore() {
  const cleanedCells = {};
  Object.entries(state.cells || {}).forEach(([key, cell]) => {
    cleanedCells[key] = {
      row: cell.row,
      col: cell.col,
      type: cell.type,
      anchorGroupIds: [...(cell.anchorGroupIds || [])],
      zoneIds: [...(cell.zoneIds || [])]
    };
  });
  const payload = {
    format: COMPONENT_EXPORT_FORMAT,
    app: APP_NAME,
    version: APP_REVISION,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    minimumReaderSchemaVersion: MIN_SUPPORTED_DATA_SCHEMA_VERSION,
    encryptionEnvelopeVersion: ENCRYPTION_ENVELOPE_VERSION,
    kind: 'seating-chart-room-layouts',
    className: activeClassRecord()?.name || '',
    exportedAt: new Date().toISOString(),
    currentRoom: {
      rows: state.rows,
      cols: state.cols,
      cells: cleanedCells,
      layoutMode: state.layoutMode === 'freeform' ? 'freeform' : 'grid',
      freeformLayout: roomOnlyFreeformLayout(state.freeformLayout),
      zones: deepClone(state.zones || []),
      customObjects: deepClone(state.customObjects || [])
    },
    roomTemplates: deepClone(state.roomTemplates || [])
  };
  try {
    if (!currentSessionEncryptionKey()) throw new Error('A session encryption password is required before exporting room layout data.');
    const manifested = await addBackupManifest(JSON.stringify(payload, null, 2), 'room-layouts');
    const encrypted = await encryptTextWithSecret(manifested, currentSessionEncryptionKey(), 'room-layouts', { payloadKind: 'component-export' });
    downloadText(`room-layouts-encrypted-${new Date().toISOString().slice(0,10)}.json`, encrypted, 'application/json');
    setLiveStatusMessage('Encrypted room layout and room templates downloaded.');
  } catch (err) {
    setLiveStatusMessage(`Could not export room layout data securely: ${err.message}`);
  }
}

function exportFilename(scope = 'all', encrypted = false) {
  const scopeLabel = scope === 'current' ? 'class' : 'classes';
  const date = new Date().toISOString().slice(0, 10);
  return `seating-chart-${scopeLabel}${encrypted ? '-encrypted' : ''}-${date}.json`;
}

async function exportAndDownloadCore(scope = 'all') {
  try {
    const payload = await exportPayload(scope);
    const encrypted = payload.includes('"encrypted": true');
    downloadText(exportFilename(scope, encrypted), payload, 'application/json');
    await ModernizationSuite.recordBackupVerification(payload, scope === 'current' ? 'Current-class export' : 'All-classes export');
    updateSaveSetupDismissed(true);
    updateSaveHealthPanel();
    setLiveStatusMessage(scope === 'current'
      ? `${encrypted ? 'Encrypted current class' : 'Current class'} downloaded.`
      : `${encrypted ? 'Encrypted all current classes' : 'All current classes'} downloaded.`);
  } catch (err) {
    setLiveStatusMessage(`Could not export: ${err.message}`);
  }
}

function handleLoadSampleData() {
  const load = () => {
    loadSample();
    setLiveStatusMessage('Sample data loaded.');
  };
  if (state.students.length || state.groups.length) {
    showInAppConfirm('Load sample data? This replaces current students, groups, and layout.', load, {
      title: 'Load Sample Data?',
      confirmText: 'Load Sample',
      cancelText: 'Cancel'
    });
  } else {
    load();
  }
}

function updateStudentRecord(oldId, data) {
  if (eyeModeBlocksStudentEditing()) return blockEyeModeAction('student') && false;
  const oldKey = String(oldId || '');
  const student = getStudent(oldKey);
  if (!student) return false;
  const next = normalizeStudent(data);
  next.id = String(next.id || oldKey).trim() || oldKey;
  if (next.id !== oldKey && state.students.some(s => String(s.id) === next.id)) {
    setLiveStatusMessage('Another student already has that ID. Choose a unique ID.');
    return false;
  }
  delete student.notes;
  delete student.note;
  Object.assign(student, next);
  if (next.id !== oldKey) {
    state.groups.forEach(group => {
      group.studentIds = (group.studentIds || []).map(id => String(id) === oldKey ? next.id : String(id));
      group.studentIds = Array.from(new Set(group.studentIds));
    });
    state.zones.forEach(zone => {
      zone.studentIds = Array.from(new Set((zone.studentIds || []).map(id => String(id) === oldKey ? next.id : String(id))));
    });
    Object.values(state.cells).forEach(cell => {
      if (String(cell.assignedStudentId) === oldKey) cell.assignedStudentId = next.id;
    });
    (state.freeformLayout?.objects || []).forEach(obj => {
      if (String(obj.assignedStudentId || '') === oldKey) obj.assignedStudentId = next.id;
    });
  }
  renderAll();
  setLiveStatusMessage(`Updated ${studentDisplay(student)}.`);
  return true;
}

function openStudentEditModal(studentId) {
  if (eyeModeBlocksStudentEditing()) return blockEyeModeAction('student');
  const student = getStudent(studentId);
  if (!student) return;
  el('editStudentOriginalId').value = student.id;
  el('editFirstName').value = student.firstName || '';
  el('editLastName').value = student.lastName || '';
  el('editNickName').value = student.nickName || '';
  el('editGrade').value = student.grade || '';
  el('editStudentId').value = student.id || '';
  if (el('editStudentNotesPrivate')) el('editStudentNotesPrivate').value = studentNoteValue(student, 'private');
  if (el('editStudentNotesSubstitute')) el('editStudentNotesSubstitute').value = studentNoteValue(student, 'substitute');
  if (el('editStudentNotesPublic')) el('editStudentNotesPublic').value = studentNoteValue(student, 'public');
  refreshEditStudentNotesSummary();
  ModernizationSuite.populateStudentRequirements(student);
  el('studentEditTitle').textContent = `Edit ${studentDisplay(student)}`;
  el('studentEditModal').classList.add('show');
}

function closeStudentEditModal() {
  el('studentEditModal').classList.remove('show');
}

function cellTypeOptionsHtml(selected = 'seat') {
  const builtIns = [
    ['seat','Seat'], ['empty','Empty'], ['blocked','Blocked'], ['teacher','Teacher Desk'], ['table','Table'], ['door','Door'],
    ['wall','Wall'], ['walkway','Walkway'], ['window','Window'], ['projector','Projector'], ['board','Board'], ['carpet','Carpet'], ['ada','ADA Space']
  ];
  const built = builtIns.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
  const custom = (state.customObjects || []).map(item => `<option value="${escapeHtml(item.type)}" ${item.type === selected ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
  return built + custom;
}

function seatEditBatchContext(cellKey, options = {}) {
  const primaryObjectId = String(options.freeformObjectId || '');
  if (primaryObjectId && uiState.freeformSelectedObjectIds?.size > 1 && uiState.freeformSelectedObjectIds.has(primaryObjectId)) {
    const objects = (state.freeformLayout?.objects || []).filter(obj => obj.type === 'seat' && uiState.freeformSelectedObjectIds.has(String(obj.id)));
    const entries = objects.map(obj => {
      const key = ensureFreeformSeatGridLink(obj);
      if (key) mirrorFreeformSeatToGrid(obj, { clearStudentDuplicates: false, preserveObjectLock: true });
      return { id: String(obj.id), key };
    }).filter(item => item.key && state.cells[item.key]?.type === 'seat');
    if (entries.length > 1) return { keys: [...new Set(entries.map(item => item.key))], objectIds: [...new Set(entries.map(item => item.id))] };
  }
  if (!primaryObjectId && isContextCellSelectionBatch(cellKey)) {
    const keys = selectedCellKeysArray().filter(key => state.cells[key]?.type === 'seat');
    if (keys.length > 1) return { keys, objectIds: [] };
  }
  return { keys: [cellKey], objectIds: primaryObjectId ? [primaryObjectId] : [] };
}

function seatEditZoneOptionsHtml() {
  return ['<option value="">Choose a zone</option>'].concat(
    [...(state.zones || [])].sort((a,b) => String(a.name || '').localeCompare(String(b.name || '')))
      .map(zone => `<option value="${escapeHtml(zone.id)}">${escapeHtml(zone.name || 'Unnamed zone')}</option>`)
  ).join('');
}

function openSeatEditModal(cellKey, options = {}) {
  if (eyeModeBlocksSeatEditing() || eyeModeBlocksRoomEditing()) return blockEyeModeAction(eyeModeBlocksSeatEditing() ? 'seat' : 'room');
  const cell = state.cells[cellKey];
  if (!cell || cell.type !== 'seat') return false;
  const batch = seatEditBatchContext(cellKey, options);
  uiState.activeSeatEditCellKey = cellKey;
  uiState.activeSeatEditFreeformObjectId = options.freeformObjectId || null;
  uiState.activeSeatEditBatchCellKeys = batch.keys;
  uiState.activeSeatEditBatchFreeformObjectIds = batch.objectIds;
  const freeformObj = activeSeatEditFreeformObject();
  if (freeformObj) mirrorFreeformSeatToGrid(freeformObj, { clearStudentDuplicates: false, preserveObjectLock: true });
  const targets = activeSeatEditTargets();
  const batchMode = targets.length > 1;
  const lockedCount = targets.filter(item => item.locked).length;
  const editableCount = targets.length - lockedCount;
  const seatLocked = targets.length > 0 && lockedCount === targets.length;
  const student = getStudent(cell.assignedStudentId);
  const anchors = (cell.anchorGroupIds || []).map(getGroup).filter(Boolean);
  const zones = (cell.zoneIds || []).map(zoneById).filter(Boolean);
  el('seatEditTitle').textContent = batchMode ? `Edit ${targets.length} Selected Seats` : `Edit Cell ${cell.row},${cell.col}`;
  el('seatEditSummary').textContent = batchMode
    ? `${targets.length} selected seats · ${editableCount} editable${lockedCount ? ` · ${lockedCount} locked and skipped by batch changes` : ''}`
    : `Current: ${objectLabel(cell.type)}${student ? ` · ${studentDisplay(student)}` : ''}${anchors.length ? ` · Reserved for ${anchors.map(b => b.name).join(', ')}` : ''}${zones.length ? ` · Zones: ${zones.map(zone => zone.name).join(', ')}` : ''}${seatLocked ? ' · Locked (read-only until unlocked)' : ' · Unlocked'}`;
  const batchNotice = el('seatEditBatchNotice');
  if (batchNotice) {
    batchNotice.hidden = !batchMode;
    batchNotice.textContent = batchMode
      ? `Group and zone changes apply to all ${editableCount} unlocked selected seats. Student assignment and cell type remain individual-seat actions.${lockedCount ? ` ${lockedCount} locked seat${lockedCount === 1 ? ' is' : 's are'} left unchanged.` : ''}`
      : '';
  }
  const studentOptions = ['<option value="">No student selected</option>'].concat(
    [...state.students].sort((a,b) => studentDisplay(a).localeCompare(studentDisplay(b))).map(s => `<option value="${escapeHtml(s.id)}" ${String(s.id) === String(cell.assignedStudentId) ? 'selected' : ''}>${escapeHtml(studentDisplay(s))} - ${escapeHtml(studentMetaText(s))}</option>`)
  ).join('');
  el('seatEditStudentSelect').innerHTML = studentOptions;
  const groupOptions = ['<option value="">Choose a group</option>'].concat(
    [...state.groups].sort((a,b) => a.name.localeCompare(b.name)).map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)} - ${escapeHtml(typeLabel(b.type))}</option>`)
  ).join('');
  el('seatEditGroupSelect').innerHTML = groupOptions;
  el('seatEditZoneSelect').innerHTML = seatEditZoneOptionsHtml();
  el('seatEditTypeSelect').innerHTML = cellTypeOptionsHtml(cell.type);
  el('seatEditLockBtn').textContent = seatLocked ? 'Unlock Seat' : 'Lock Seat';
  el('seatEditLockBtn').disabled = batchMode || cell.type !== 'seat' || (!cell.assignedStudentId && !freeformObj);
  setSeatEditLockedControls(seatLocked);
  if (freeformObj && !batchMode) {
    el('seatEditTitle').textContent = `Edit Freeform Seat${cell.row && cell.col ? ` · Grid ${cell.row},${cell.col}` : ''}`;
    el('seatEditSummary').textContent += freeformObj.locked ? ' · Freeform locked: unlock before changing assignment, groups, zones, or type' : ' · Freeform unlocked';
  }
  el('seatEditModal').classList.add('show');
  requestAnimationFrame(() => (batchMode ? el('seatEditGroupSelect') : (seatLocked ? el('seatEditLockBtn') : el('seatEditStudentSelect')))?.focus());
  return true;
}

function closeSeatEditModal() {
  el('seatEditModal').classList.remove('show');
  el('seatEditModal')?.querySelector('.seat-edit-modal')?.classList.remove('batch-edit');
  uiState.activeSeatEditCellKey = null;
  uiState.activeSeatEditFreeformObjectId = null;
  uiState.activeSeatEditBatchCellKeys = [];
  uiState.activeSeatEditBatchFreeformObjectIds = [];
}

function refreshSeatEditModal() {
  const key = uiState.activeSeatEditCellKey;
  const freeformObjectId = uiState.activeSeatEditFreeformObjectId;
  if (key && el('seatEditModal').classList.contains('show')) openSeatEditModal(key, { freeformObjectId });
}


const HELP_GUIDE_SECTIONS = [
  {
    "id": "quick-start",
    "category": "Start",
    "title": "Quick Start Workflow",
    "keywords": "start first time workflow checklist sample quick start guided lessons practice explain",
    "intro": "Use the eight-step Quick Start for orientation, then open a focused lesson or the reference guide when you need deeper help.",
    "items": [
      {
        "title": "1. Choose or create a class",
        "text": "Use the Class dropdown, New, Rename, Duplicate, and trash controls to manage separate sections. Duplicate a class when several sections use the same room layout."
      },
      {
        "title": "2. Complete Class Setup",
        "text": "Use the Class Setup subsections to add or import students, define shared rules, review individual requirements, and create any named zones you expect to use."
      },
      {
        "title": "3. Build the room",
        "text": "Move to Room Design, choose Standard Grid or Freeform Room, then create seats and room objects such as walls, doors, walkways, boards, teacher desks, tables, windows, and custom objects."
      },
      {
        "title": "4. Review setup and seat students",
        "text": "Use Review Setup to catch roster or rule issues, then move to Seat Students for manual placement or generated seating options. Seat placement is not performed from the roster editor."
      },
      {
        "title": "5. Generate, review, print, and save",
        "text": "Generate or randomize the chart, run Analyze, choose print privacy options, then use Save Now and download a backup copy after major changes. For shared editing, use Share Drive Save and choose each person's Viewer or Editor role."
      }
    ],
    "tips": [
      "Use sample data before training staff or testing a new layout.",
      "Set encryption before saving or downloading real student notes."
    ],
    "examples": [
      "Build Room 104 once, save it as a room template, duplicate the class for Period 2, import the new roster, and generate a new chart."
    ],
    "warnings": [
      "Browser-managed data stays in the current browser. Use Save Now with a chosen file, Download All Classes, or Download Complete Backup Package when the data needs to be safe, portable, or stored elsewhere."
    ]
  },
  {
    "id": "planning-intelligence",
    "category": "Planning",
    "title": "Seat Guidance, Planning History, and Advanced Tools",
    "keywords": "valid seats live preview best seat conflict override fairness history schedule bulk requirements template library comments duplicate filters csv support bundle image shortcuts language collaboration polling",
    "intro": "Advanced classroom tools connect the seating rules to daily placement, long-term planning, exports, and shared-file checks without changing the portable single-file workflow.",
    "items": [
      {
        "title": "Show valid seats",
        "text": "Use Valid seats on a student card or Advanced tools > Seat guidance. Green seats satisfy current required rules, yellow seats need preference review, and red seats are locked, unavailable, or create a required conflict. Hover or focus a highlighted seat for the plain-language reason."
      },
      {
        "title": "Resolve or override conflicts",
        "text": "From Seat guidance, show alternatives, move the student to the best current seat, or intentionally ignore a specific finding. Recorded overrides remain visible and can be restored later."
      },
      {
        "title": "History, fairness, comparison, and schedules",
        "text": "History & fairness summarizes repeated seats, neighbors, and room areas across the current chart and named plans. Compare two plans side by side, add plan comments, and schedule a plan as a suggestion for selected days or date ranges. Scheduled plans never replace the current chart automatically."
      },
      {
        "title": "Bulk needs and roster quality",
        "text": "Apply reusable requirements to selected students, choose preferred or excluded zones, create a together group, or keep selected students separated. Roster quality suggests possible duplicate records but never merges them automatically."
      },
      {
        "title": "Shared templates, comments, and exports",
        "text": "Export or import room-template libraries through a shared Drive folder or district repository. Seat, zone, and plan comments remain optional. Export assignments or rule findings as CSV, copy the chart as an image, print a blank room, or download a privacy-sanitized support bundle."
      },
      {
        "title": "Drive checks, shortcuts, and language packs",
        "text": "Optional Drive change checks look for newer shared-file revisions while the page is open and send them through the existing merge workflow. Shortcuts can be reassigned, and translation packs can add interface dictionaries without changing classroom data."
      }
    ],
    "tips": [
      "Use valid-seat preview before placing a student instead of waiting for Review to report a conflict.",
      "Save named plans periodically so fairness analysis has meaningful history."
    ],
    "warnings": [
      "Drive polling provides revision notices and merge assistance, not simultaneous live seat movement or cursor presence."
    ]
  },
  {
    "id": "classes",
    "category": "Classes",
    "title": "Classes and Class Manager",
    "keywords": "class select new rename duplicate delete period sections class manager",
    "intro": "Classes are separate workspaces inside the same file. Each class has its own students, groups, zones, layout, assignments, locks, snapshots, and chart details.",
    "items": [
      {
        "title": "Class dropdown",
        "text": "Switches the active class. The roster, rules, layout, and assignments change with the selected class."
      },
      {
        "title": "New",
        "text": "Creates a blank class."
      },
      {
        "title": "Rename",
        "text": "Changes the class name only."
      },
      {
        "title": "Duplicate",
        "text": "Copies the current class, including layout and setup details. This is helpful when multiple sections share a room."
      },
      {
        "title": "Compare & Merge Class",
        "text": "Compares the active class with another class or a compatible save file, then merges selected categories. Student references are remapped, the destination class identity is preserved, and an optional snapshot protects the original state."
      },
      {
        "title": "Trash",
        "text": "Deletes the current class. At least one class must remain."
      }
    ],
    "tips": [
      "Use names that include period, course, teacher, or room when multiple staff members use the file."
    ],
    "examples": [
      "Period 1 Math - Room 104",
      "Reading Group A - Fall"
    ]
  },
  {
    "id": "save-load",
    "category": "Save",
    "title": "Saving, Backups, Uploads, and Recovery",
    "keywords": "save load local export import json pdf svg snapshot room template backup restore recovery kit key encrypted portable file",
    "intro": "The disk icon opens a short daily save menu: Save Now, Load Save File, and More Save Options. Use More Save Options for backup downloads, selected data exports, and restore/upload tools.",
    "items": [
      {
        "title": "Linked Save File",
        "text": "Recommended when supported. Choose a real JSON file once, then save directly back to it. Store it in a synced, network, or backed-up folder when available."
      },
      {
        "title": "Share Drive Save with People",
        "text": "After a Google Drive save is active, open Save & Share > Share Drive Save > Share and collaborate, use the disk menu, or open Settings > Google. Enter a Google-account email and choose Viewer or Editor."
      },
      {
        "title": "Password-protected read-only HTML",
        "text": "Safe Sharing can encrypt a faithful Grid or Freeform viewer with a separate password. The recipient can view the selected audience profile but cannot edit or overwrite the planner save."
      },
      {
        "title": "Auto-save interval",
        "text": "When enabled in Settings, major changes queue an automatic save to the selected file. Save Now remains available for manual control."
      },
      {
        "title": "Download All Classes",
        "text": "Downloads an editable backup containing every class. Use this after important changes and before experiments."
      },
      {
        "title": "Download Save Package",
        "text": "Advanced option: downloads a ZIP package containing classes.json, backup-info.json, and a README with restore instructions."
      },
      {
        "title": "Download All Current Classes",
        "text": "Downloads an editable backup containing every class currently in the app. This is a reliable fallback when linked saving is unavailable."
      },
      {
        "title": "Download Current Class",
        "text": "Downloads only the active class. Use this when sharing one class without the rest."
      },
      {
        "title": "Upload Classes File",
        "text": "Opens a saved or downloaded file and then asks what to restore. You can restore everything or selected students, groups, rooms, zones, snapshots, templates, and settings. Encrypted files require the same encryption key."
      },
      {
        "title": "Snapshots",
        "text": "Save named restore points for the current class before major edits, imports, or randomizing."
      },
      {
        "title": "Room Templates",
        "text": "Save a layout without student assignments so it can be reused in other classes."
      },
      {
        "title": "Offline Recovery Kit",
        "text": "Creates an encrypted recovery backup and a separate recovery key. Store the two files in different secure locations; anyone with both can open the backup."
      },
      {
        "title": "Password Recovery Package",
        "text": "Optional security tool that wraps the active encryption password with a separate one-time recovery code. Keep the package and code in different secure locations. Either item alone is useless."
      },
      {
        "title": "Operation Recovery Center",
        "text": "Records privacy-safe details for failed imports and Google operations, explains whether data changed, offers retries when available, and can download rejected CSV rows or a sanitized support report."
      },
      {
        "title": "PDF / SVG in Print Options",
        "text": "Print Preview, Download PDF, and Download SVG all use the same selected options. Standard Grid exports preserve the room cells and object styles; Freeform exports preserve canvas dimensions, object position, size, rotation, color, stacking, locks, and front-of-room orientation. PDF always shrinks the complete Freeform room onto one chart page, even when the canvas print mode is tiled or actual size. Enable Crop to occupied room content and fill the chart page to remove unused outer Grid cells or Freeform canvas margins and enlarge the remaining seats and room objects in both PDF and SVG output. The room stays on one chart page; selected notes, group configuration, and zone configuration are added as separate supporting pages. Use JSON when you need an editable backup."
      }
    ],
    "tips": [
      "Choose a real save file when the browser supports it, then use Save Now from the disk menu for day-to-day work.",
      "Download All Classes or a Complete Backup Package after major changes, even when auto-save is on.",
      "Take a snapshot before bulk imports, large roster edits, or randomizing.",
      "Use templates for common rooms such as labs, intervention rooms, or shared classrooms."
    ],
    "warnings": [
      "If student notes exist, save/export may require encryption to protect sensitive data."
    ],
    "examples": [
      "Before changing the plan for a new quarter, save a snapshot named Before Q2 changes."
    ]
  },
  {
    "id": "drive-sharing-collaboration",
    "category": "Share",
    "title": "Google Drive Sharing and Multi-User Collaboration",
    "keywords": "share drive save collaborator people user email viewer editor writer reader role permission multi-user multi user concurrent merge shared file picker notification revoke remove access hidden view only can edit preset custom seating assistant room designer reviewer",
    "intro": "The editable multi-user workflow uses one encrypted Google Drive save. The file owner chooses people and roles in Share and collaborate. This is revision-aware shared-file editing with conflict detection and three-way merge, not live Google Docs-style cursor streaming.",
    "items": [
      {
        "title": "Where the owner chooses people",
        "text": "Open Save & Share, find Share Drive Save, and choose Share and collaborate. The same dialog is available from the disk menu as Share Drive Save with People, and from Settings > Google as Share Current Drive Save."
      },
      {
        "title": "Prerequisite: an active Drive save",
        "text": "Connect Google Drive and save or load the editable planner file first. Sharing permissions belong to that active Drive file; browser-only or downloaded JSON files do not have a Google collaborator list."
      },
      {
        "title": "Choose the collaborator",
        "text": "Enter the person's Google-account email address in Choose who can open the editable save. The planner sends the permission request to the Google Drive API; it does not maintain a separate user directory or account database."
      },
      {
        "title": "Viewer versus Editor",
        "text": "Google Drive Viewer is always read-only and overrides every planner setting. Google Drive Editor makes saving technically possible, but the owner can still hide individual planner areas or make them view only. Give Editor only to staff who may modify at least part of the master working copy."
      },
      {
        "title": "Planner interface access",
        "text": "After choosing the Drive role, choose Full editor, Seating assistant, Room designer, Roster and rules editor, Reviewer and printer, or Custom permissions. Every profile can set Class Setup, Room Design, Seat Students, Review/Print, Save, Share, Settings, and Class Management to Hidden, View only, or Can edit. Drive Viewer automatically converts every Can edit choice to View only."
      },
      {
        "title": "What Hidden and View only do",
        "text": "Hidden removes workflow tabs, menu actions, settings entry points, and commands for that area. View only leaves the area available for inspection but blocks forms, buttons, Grid-cell actions, Freeform dragging, context menus, and keyboard mutations. Review/Print and non-mutating exports remain usable when their area is view only."
      },
      {
        "title": "Notification and message",
        "text": "Leave Send Google notification enabled to have Google email the recipient. The optional message can explain which hosted planner site to open, which interface profile was assigned, and whether the recipient should edit the master or only review it."
      },
      {
        "title": "How the recipient opens the shared save",
        "text": "The recipient opens the same hosted Classroom Seating Planner deployment, connects Google Drive, and uses Load from Drive or Manage Saves & Revisions. If the file is not visible under the narrow per-file scope, use Choose Another Drive File through Google Picker when the deployment provides it."
      },
      {
        "title": "Reloading the planner",
        "text": "An unexpired Drive access token is retained only for the current browser tab, so reloading that tab normally restores Drive access without another connection step. After the token expires, the next user-initiated Drive command requests fresh access and reuses the existing Google grant when possible. Disconnect, Lock, Presentation Mode, Factory Reset, a closed tab, or browser storage restrictions clear this temporary access."
      },
      {
        "title": "Current permissions",
        "text": "The Current Drive permissions list shows the people Google returns for the file. The owner can change Viewer/Editor access, choose a planner preset, customize all eight interface areas, save the interface profile, or remove a collaborator without creating a new save file."
      },
      {
        "title": "Concurrent edits and merge",
        "text": "The app checks Drive revision metadata before saving. Non-overlapping classroom changes can be merged automatically. Export timestamps, save hashes and revisions, backup manifests, record update times, and device-local settings are resolved automatically and never shown as classroom conflicts. Only genuine overlapping classroom edits open Resolve Drive merge conflicts. Users do not see each other's seats move live."
      },
      {
        "title": "Editable save versus encrypted viewer package",
        "text": "For collaborative editing, grant Google Drive Editor access and then give the person Can edit access only to the planner areas they need. Hidden and View only profiles control this application's workflows but do not remove data from the encrypted master save. Use an encrypted read-only HTML package or encrypted viewer file for substitutes, students, or anyone who must receive a purpose-limited copy. Send the viewer password through a separate channel."
      },
      {
        "title": "Copy link, change access, or revoke access",
        "text": "Copy Drive link copies Google's link for the active file. Use the permission list to change a role or remove access. Removing Drive access does not recall copies the recipient already downloaded or printed."
      }
    ],
    "tips": [
      "Use a short message that names the hosted planner URL and tells the recipient to connect the Google account that received the permission.",
      "Ask editors to save and close before another editor begins a large room redesign when practical; the merge system is a safety net, not a substitute for coordination.",
      "Use the encrypted viewer package when the recipient needs a stable view rather than the editable master."
    ],
    "warnings": [
      "Google Drive sharing does not provide live cursors or instant seat movement. Changes become visible after another user loads or refreshes the Drive copy.",
      "A Viewer cannot save changes back to the shared file. A recipient who needs to edit must receive Editor access from the owner and Can edit access for the relevant planner area.",
      "Planner interface profiles are convenience and workflow controls enforced by this application. They do not remove data from the encrypted save and are not a substitute for an encrypted purpose-limited viewer package when the recipient must not receive certain information.",
      "The application uses a narrow per-file Drive scope. A shared file may require Google Picker to grant this deployment access for the recipient."
    ],
    "examples": [
      "The intervention specialist receives Drive Editor plus Seating assistant access. A room aide receives Drive Editor plus Room designer access. A substitute receives a password-protected read-only HTML package instead."
    ]
  },
  {
    "id": "today-plans",
    "category": "Daily Workflow",
    "title": "Today Mode, Attendance, Guests, and Named Seating Plans",
    "keywords": "today attendance absent guest temporary seating named plan history restore compare testing substitute",
    "intro": "Use Today mode for temporary changes and named plans for durable seating milestones. Neither workflow requires rewriting the permanent roster each day.",
    "items": [
      { "title": "Today mode", "text": "Records absences, temporary guests, a day-only note, and temporary seating while preserving a master assignment snapshot." },
      { "title": "Generate for present students", "text": "Excludes students marked absent and includes temporary guests when producing new seating options." },
      { "title": "Restore master seating", "text": "Returns assignments to the snapshot captured when Today mode began without ending Today mode." },
      { "title": "End Today mode", "text": "Removes temporary guests, clears the daily attendance layer, and restores the permanent master seating chart." },
      { "title": "Named seating plans", "text": "Saves a dated room and assignment version with a name, reason, and notes. Restore assignments only or restore the entire room." },
      { "title": "Compare plans", "text": "Shows how many students moved, were added, or were removed and whether the room layout changed." }
    ],
    "tips": ["Use Today mode for one-day changes. Use named plans for quarter changes, testing layouts, or arrangements you may need again."],
    "examples": ["Mark two students absent, add a visiting student, generate a present-student chart, then end Today mode to return to the permanent plan."]
  },
  {
    "id": "security",
    "category": "Security",
    "title": "Security, Encryption, Locking, and Privacy",
    "keywords": "security encryption key encrypted save export private notes lock pin password eye visibility settings access auto-lock privacy FERPA substitute",
    "intro": "Use these controls before entering real student notes or sharing the file. They help protect student information in linked saves, downloads, uploads, and presentation views.",
    "items": [
      {
        "title": "Encrypt saved/downloaded classes files",
        "text": "Encrypts the full save payload using the current session encryption key, including browser local saves, linked saves, backup packages, snapshots, settings, rosters, notes, groups, zones, and room data."
      },
      {
        "title": "Encryption key",
        "text": "The key is remembered only for the current browser session and is not stored in exported files. During manual Lock or Presentation Mode with a PIN available, the key is stored only as an encrypted wrapped value and removed from active memory."
      },
      {
        "title": "Settings Access",
        "text": "Requires Auto, Lock PIN, Presentation PIN, or Encryption Key before Settings opens, or can be disabled after a warning confirmation."
      },
      {
        "title": "Lock PIN/password",
        "text": "Locks the chart screen, encrypts the full working dataset while locked, and wraps the session encryption key with the Lock PIN/password when available."
      },
      {
        "title": "Presentation Mode PIN",
        "text": "Protects exit from the locked Presentation workspace and can wrap the session encryption key while Presentation Mode is active. Presentation Mode always switches to Review, removes both side panels and editing controls, and blocks every Grid, Freeform, drag, keyboard, context-menu, and rotation mutation path."
      },
      {
        "title": "Auto-lock after inactive minutes",
        "text": "Locks the chart after inactivity. Use 0 to disable."
      },
      {
        "title": "Private/Substitute/Public notes",
        "text": "Note categories control which notes appear in print modes. Private notes stay hidden unless explicitly included."
      }
    ],
    "tips": [
      "Suggested setup: enable encryption, enter a key, save Lock PIN, save Presentation PIN, set Settings Access to Auto, then Download All Current Classes for your durable backup.",
      "Use Substitute notes for information a substitute should see; keep Private notes for staff-only context."
    ],
    "warnings": [
      "Encrypted exports still require the correct password unless you previously created and separately stored the optional Password Recovery Package and its recovery code. Losing all three means the data cannot be recovered."
    ],
    "examples": [
      "For a substitute copy, print first and last names with Substitute notes and Public notes only."
    ]
  },
  {
    "id": "settings",
    "category": "Settings",
    "title": "Settings: What Each Section Controls",
    "keywords": "settings chart details appearance theme prismatic defaults hints Presentation Mode access pin encryption custom objects sample data about changelog local data auto lock google analytics opt out object labels empty seat titles",
    "intro": "Settings controls chart details, security, default views, visibility restrictions, custom room objects, and local data tools.",
    "items": [
      {
        "title": "Seating Chart Details",
        "text": "Title, date, period, room, and teacher/owner. These appear in print views and save with the class."
      },
      {
        "title": "Visual Theme and object labels",
        "text": "Choose the application color and surface treatment. Prismatic Flow uses flowing jewel-tone animation on the background, top strip, and primary controls while keeping panels, dialogs, seats, and room cards vivid but stable for reliable browser rendering. Operating-system reduced-motion preferences automatically disable its animation. The Appearance page can also hide the small Seat and room-object type indicators without hiding student names or custom labels."
      },
      {
        "title": "Session Timeout / Local Data",
        "text": "Set auto-lock minutes or clear all locally saved browser data."
      },
      {
        "title": "Page Load Defaults",
        "text": "Choose default Names Only mode, workflow guidance, the Seating roster panel, Review status panel, Layout Tools, CSV/Add Student collapse, design cell size, and hint visibility. Only controls that still exist in the current product workspace are listed. Changes do not rearrange the current workspace until applied."
      },
      {
        "title": "Presentation Mode",
        "text": "Presentation Mode always removes the Students, Groups & Zones panel. Presentation Mode is always read-only: it switches to Review, hides editing/navigation/history controls and both side panels, and blocks seating, room, student, group, zone, drag, keyboard, context-menu, and rotation mutations. Zoom and Text remain available. The privacy profile controls the basic names, group details, print availability, and room-header details shown in that protected view."
      },
      {
        "title": "Settings Access",
        "text": "Choose which credential is required to open Settings, or deliberately disable the prompt after confirming the risk."
      },
      {
        "title": "Lock / Presentation PINs",
        "text": "Create or update the Lock PIN and Presentation Mode PIN."
      },
      {
        "title": "Save / Download Encryption",
        "text": "Enable encrypted saves/downloads and set the session encryption key."
      },
      {
        "title": "Recommended Saving Workflow",
        "text": "Shows save health, auto-save timing, and the focused Save Options panel for downloads or restore/upload actions."
      },
      {
        "title": "Google Analytics preference",
        "text": "Hosted HTTP/HTTPS deployments can send the standard page view to measurement ID G-NMRMNM7ZCD. The Google settings area contains a browser-local opt-out. The choice is not stored in classroom saves, and local file copies do not load the tag."
      },
      {
        "title": "Right-Click Room Objects",
        "text": "Add custom room objects such as sink, bookshelf, lab bench, counter, shelf, kidney table, or charging cart."
      },
      {
        "title": "Sample Data",
        "text": "Loads demo students, groups, zones, and layout details into the current class."
      },
      {
        "title": "About / Change Log",
        "text": "Shows version, feature list, storage notes, and revision history."
      }
    ],
    "tips": [
      "Use collapsed defaults for presentation/student-facing views; keep tools open while training users.",
      "Use Prismatic Flow for a highly visual workspace; use Default or High Contrast when animation or decoration would be distracting.",
      "Reset Closed Hints restores hint boxes that were individually dismissed."
    ],
    "examples": [
      "Collapse the Seating roster and Review status panels on load while leaving Class Setup fully available."
    ]
  },
  {
    "id": "guided-learning-help",
    "category": "Help",
    "title": "Quick Start, Guided Lessons, and Reference Help",
    "keywords": "help guide lessons quick start practice class explain guide me progress resume tutorial onboarding freeform random seating candidates",
    "intro": "Help is divided into a short Quick Start, focused guided lessons, saved progress, and a searchable reference guide. Users can learn without blocking ordinary work.",
    "items": [
      {
        "title": "Quick Start",
        "text": "An eight-step overview of the complete workflow from class setup through saving, printing, and sharing."
      },
      {
        "title": "Explain mode",
        "text": "Opens the correct workspace, highlights the relevant controls, and explains the task without requiring classroom-data changes."
      },
      {
        "title": "Practice mode",
        "text": "Creates a clearly labeled disposable practice class, waits for meaningful actions, and verifies each completed task."
      },
      {
        "title": "Focused lessons",
        "text": "Separate lessons teach rosters, Grid and Freeform rooms, manual and random seating, candidate generation, rules and zones, Today Mode, recovery, printing, and Google tools."
      },
      {
        "title": "Guide me buttons",
        "text": "Contextual buttons in difficult tools open the matching lesson without forcing users through unrelated material."
      },
      {
        "title": "Resume and progress",
        "text": "The browser remembers the current lesson, completed steps, and completed lessons. Progress can be reviewed or reset from Help."
      },
      {
        "title": "Reference guide",
        "text": "Search by feature, button, workflow, setting, or problem when a structured lesson is unnecessary."
      }
    ],
    "tips": [
      "Use Quick Start for orientation, Explain mode for a reminder, and Practice mode when learning a hands-on tool.",
      "Practice classes are isolated from real classes and can be kept, restarted, or deleted when a lesson finishes."
    ],
    "examples": [
      "Open Guide me beside Freeform tools to practice movement, resizing, click or drag rotation, grouping, locking, student placement, and Undo.",
      "Open the Best-Fit Seating lesson to create rules, generate candidates, compare explanations, generate unique alternatives, and apply a plan."
    ]
  },
  {
    "id": "students",
    "category": "Students",
    "title": "Students, Notes, CSV Import, and Student Lists",
    "keywords": "students roster first name last name nickname grade id notes private substitute public csv import mapping profile duplicate edit delete assigned unassigned",
    "intro": "The Roster area is where you add, import, edit, and organize student records. Seat placement belongs in the Seat Students stage, where the chart is visible.",
    "items": [
      {
        "title": "Add Student fields",
        "text": "First Name, Last Name, Nickname, Grade, and ID. Nickname is used for display when present. ID should be unique."
      },
      {
        "title": "Student Notes",
        "text": "Opens a reusable notes popup. Add any number of notes and choose Private, Substitute, or Public."
      },
      {
        "title": "Add Student",
        "text": "Creates the student and clears the entry form."
      },
      {
        "title": "Clear Students",
        "text": "Removes all students, group memberships, and student seat assignments."
      },
      {
        "title": "CSV Import",
        "text": "Choose a CSV, map columns, preview rows, and import fields plus categorized notes."
      },
      {
        "title": "CSV Mapping Profiles",
        "text": "Save a successful column mapping for recurring roster files, then apply it to later imports instead of remapping the same district export each time."
      },
      {
        "title": "Student List",
        "text": "The roster list manages student records, notes, rules, and attendance. Open the Seat Students stage to place students because that stage keeps the chart visible beside the placement controls."
      },
      {
        "title": "Assigned / Unassigned lists",
        "text": "Chart Status shows students who are currently placed and students who still need seats."
      }
    ],
    "tips": [
      "Use stable IDs when importing from a student information system.",
      "Keep Private notes short and print them only when explicitly needed."
    ],
    "examples": [
      "CSV headers might be First Name, Last Name, Nickname, Grade, Student ID, Substitute Notes, Public Notes."
    ],
    "warnings": [
      "Private/Substitute notes require encryption before save/export. Any active encryption key encrypts the full save payload, not just note fields."
    ]
  },
  {
    "id": "groups",
    "category": "Groups & Rules",
    "title": "Groups and Seating Rules",
    "keywords": "groups rules groups together avoid special front back board teacher door window spread apart zone importance color students anchor reserve",
    "intro": "Groups and seating rules tell the generator which student relationships or room locations matter. The workspace presents relationship collections as groups while retaining the internal group data model for current-release operation.",
    "items": [
      {
        "title": "Group or Rule Name",
        "text": "Use a clear name such as Front Support, Avoid Pair, Reading Partners, or Quiet Zone."
      },
      {
        "title": "What should happen?",
        "text": "Choose whether students should stay together, stay apart, spread out, prefer a location, or use reserved seats assigned later in Room Design."
      },
      {
        "title": "Importance",
        "text": "Higher importance weighs more during generation. Use Must Try only for needs that should outrank ordinary preferences."
      },
      {
        "title": "Preferred Room Zone",
        "text": "For zone rules, choose which named zone the group prefers."
      },
      {
        "title": "Label Color",
        "text": "Shows visual indicators on student cards and seats."
      },
      {
        "title": "Students in the Rule",
        "text": "Search and select the students this rule applies to. A student may belong to more than one group or rule."
      },
      {
        "title": "Existing Groups and Rules",
        "text": "Review, edit, search, or delete rules here. Use the drag-and-drop manager for faster membership changes. Reserve visible seats during Room Design or Seat Students."
      }
    ],
    "tips": [
      "Avoid making every preference priority 10; the generator needs room to resolve conflicts.",
      "Use Avoid for conflicts and Spread Apart when students simply need distance."
    ],
    "examples": [
      "Create a Front Support group with Prefer Front priority 8 for students who need board access."
    ]
  },
  {
    "id": "zones",
    "category": "Zones",
    "title": "Zones and Preferred Areas",
    "keywords": "zones seat zone front left quiet area create apply clear selection group zone student zone preferred area",
    "intro": "Zones name meaningful areas of seats. They work well for supports, room regions, or places students should prefer or avoid.",
    "items": [
      {
        "title": "Create a Zone",
        "text": "Name and color a zone during Class Setup. Assign visible seats to that zone later during Room Design."
      },
      {
        "title": "Apply Zone",
        "text": "Adds the selected existing zone to selected cells."
      },
      {
        "title": "Clear Zones from Seats",
        "text": "Removes zone labels from selected cells."
      },
      {
        "title": "Zone List",
        "text": "Shows zones, members, and actions such as rename and trash."
      },
      {
        "title": "Groups with zones",
        "text": "A group can prefer a seat zone or be attached to zones in the Manager popup."
      }
    ],
    "tips": [
      "Use names such as Front Left, Near Teacher, Back Table, Quiet Area, Door Side, or Window Side.",
      "Create zones after defining actual seat cells."
    ],
    "examples": [
      "Select the first two rows, save them as Front, then create a Prefer Seat Zone group for students who need front placement."
    ]
  },
  {
    "id": "manager",
    "category": "Manager",
    "title": "Student / Group / Zone Manager",
    "keywords": "manager popup drag drop students groups zones remove member attach detach manage relationships",
    "intro": "The Manager popup gives larger columns for student, group, and zone relationship work.",
    "items": [
      {
        "title": "Students column",
        "text": "Drag students into groups or zones."
      },
      {
        "title": "Remove zone",
        "text": "Drop a group member on the remove area to remove them from that group."
      },
      {
        "title": "Groups column",
        "text": "Review rule members, drag students into groups and rules, and connect rules to zones."
      },
      {
        "title": "Zones column",
        "text": "Drag students or groups into zones and review relationships."
      },
      {
        "title": "Close",
        "text": "Returns to the main app. Changes are applied as you make them."
      }
    ],
    "tips": [
      "Use Manager after importing students to quickly build groups and zones."
    ],
    "examples": [
      "Drag a Reading Support group into the Front zone to attach that rule to front seats."
    ]
  },
  {
    "id": "layout",
    "category": "Layout",
    "title": "Room Layout Tools and Cell Types",
    "keywords": "room layout rows columns click tool build resize all seats empty grid seat blocked teacher table door wall walkway window projector board carpet ada custom object",
    "intro": "Room Layout defines the physical space that the seating generator uses.",
    "items": [
      {
        "title": "Rows and Columns",
        "text": "Set the grid size, then click Build/Resize Grid."
      },
      {
        "title": "Click Tool",
        "text": "Choose what type of cell to place when clicking cells."
      },
      {
        "title": "All Seats",
        "text": "Turns every cell into a seat."
      },
      {
        "title": "Empty Grid",
        "text": "Clears the grid to empty cells."
      },
      {
        "title": "Right-click cell menu",
        "text": "Quickly changes a cell type, including custom room objects."
      },
      {
        "title": "Custom room objects",
        "text": "Configured in Settings and available in the Click Tool and right-click menu."
      }
    ],
    "tips": [
      "Mark non-seat areas before generating so the app does not place students there.",
      "Use custom objects for classroom-specific items such as sinks, counters, carts, shelves, or lab benches."
    ],
    "examples": [
      "Create a 6 by 8 grid, mark doors and walkways, then convert usable spaces to seats."
    ]
  },
  {
    "id": "freeform-editing",
    "category": "Layout",
    "title": "Freeform Room Editing, Keyboard Controls, and Snapping",
    "keywords": "freeform keyboard arrows shift alt option drag rotate clockwise counterclockwise free rotation snap magnetic guides align distribute marquee pan fit room fit selected presets inspector collision overlap group layer",
    "intro": "Freeform Room is a visual editor for irregular rooms, pods, tables, pathways, and precisely positioned seats. Primary tools share the Layout Mode row; More tools opens over the canvas without taking workspace away.",
    "items": [
      { "title": "Move and select", "text": "Drag objects, shift-click to extend a selection, drag across blank canvas, or turn on Box Select to sweep across several seats and room objects." },
      { "title": "Keyboard movement", "text": "Use Arrow keys to move selected objects by the grid step, Shift+Arrow for a larger step, and Alt/Option+Arrow for one-pixel movement." },
      { "title": "Drag modifiers", "text": "Hold Shift while dragging to lock movement to one axis. Hold Alt/Option while dragging to temporarily bypass grid snapping." },
      { "title": "Rotate objects", "text": "Use the top-left handle for counterclockwise rotation and the top-right handle for clockwise rotation. Click for a 15-degree step, drag either handle for free rotation, or hold Shift while dragging to snap the angle to 15-degree increments." },
      { "title": "Snap and guides", "text": "Grid snap keeps coordinates consistent. Magnetic guides align edges and centers. Use Group to make selected seats and room objects move as one unit; Lock Group freezes the entire group until it is unlocked." },
      { "title": "Fit, pan, and presets", "text": "Fit Room shows the whole canvas, Fit Selected centers the current selection, Pan moves the viewport, and Presets inserts reusable room groups." },
      { "title": "More tools", "text": "Canvas size, zoom, movement rules, view controls, alignment, distribution, object dimensions, conversion, Room tools, and Audit room are available in the More tools overlay." }
    ],
    "tips": [
      "Keep Snap to grid on for repeatable rows and columns; use Alt/Option only for an intentional fine adjustment.",
      "Use Audit room after large edits to find overlaps, invalid assignments, or objects outside the canvas."
    ],
    "examples": [
      "Insert a Four-seat pod preset, select the group, duplicate it, then align the duplicated pods into rows."
    ]
  },
  {
    "id": "selection-design",
    "category": "Layout",
    "title": "Multi-Cell Selection, Names Only, and Design Mode",
    "keywords": "select cells multi select shift drag selection clear design mode size names only layout tools collapse",
    "intro": "These tools make room editing faster and help you switch between detailed seating work and compact layout planning.",
    "items": [
      {
        "title": "Select Cells",
        "text": "Turns on multi-cell selection. Drag or shift-select cells, then apply changes to the selected group."
      },
      {
        "title": "Clear Selection",
        "text": "Clears selected cells."
      },
      {
        "title": "Design Mode",
        "text": "Shrinks the grid and shows simplified labels for faster room-design work."
      },
      {
        "title": "Design size slider",
        "text": "Changes design-mode cell size."
      },
      {
        "title": "Names Only",
        "text": "Simplifies seat display by hiding group decorations and extra visual markers."
      },
      {
        "title": "Collapse Layout Tools",
        "text": "Hides the layout toolbar to give the grid more space."
      }
    ],
    "tips": [
      "Use Select Cells to mark a whole walkway or zone at once.",
      "Use Design Mode when building large rooms on smaller screens."
    ],
    "examples": [
      "Select a block of seats, right-click one selected cell, then apply Window Side or a custom object to the group."
    ]
  },
  {
    "id": "seating",
    "category": "Seating",
    "title": "Seating, Locking, Anchors, and Generation",
    "keywords": "seat students drag drop lock unlock anchor group reserve generate randomize clear assignments clear anchors",
    "intro": "Seating controls place students, preserve must-stay positions, reserve seats for groups, and generate a best-effort chart.",
    "items": [
      {
        "title": "Place students while the chart is visible",
        "text": "Open the Seat Students stage, then select, tap, or drag a student using the placement controls beside the visible chart. Moving onto an occupied seat swaps or moves students based on the current context."
      },
      {
        "title": "Lock / Unlock",
        "text": "Keeps a student in a specific seat during generation."
      },
      {
        "title": "Group seat reservations",
        "text": "In the Seat Students or Room Design stage, select a group and assign one or more visible seats as reserved anchors. The roster-only screen no longer tells users to drag onto a chart they cannot see."
      },
      {
        "title": "Rule Conflict Inspector",
        "text": "Checks room capacity, required front or accessible seating, excluded zones, minimum-distance geometry, locks, anchors, and contradictory rules before generation. Blocking findings must be fixed before candidate generation continues."
      },
      {
        "title": "Generate Chart",
        "text": "Seats students using current rules while preserving locks. Candidate cards include the pre-generation feasibility context so differences are explained instead of reduced to an unexplained score."
      },
      {
        "title": "Randomize + Seat Everyone",
        "text": "Tries many randomized seating charts and keeps the best-scoring result."
      },
      {
        "title": "Clear Assignments",
        "text": "Clears student placements."
      },
      {
        "title": "Clear Anchors",
        "text": "Removes group seat reservations without deleting groups."
      }
    ],
    "tips": [
      "Lock students who must stay in a specific seat before generating.",
      "Run the Rule Conflict Inspector before generation when requirements overlap or the room has limited front, accessible, or zone-qualified seats.",
      "Clear Anchors if old group reservations are forcing unexpected placements."
    ],
    "examples": [
      "Manually seat and lock a student with a fixed accommodation, then generate the rest of the class."
    ]
  },
  {
    "id": "status-analysis",
    "category": "Status",
    "title": "Chart Status, Rule Report, Assigned and Unassigned Lists",
    "keywords": "chart status analyze rule report violations conflicts seats placed students assigned unassigned live updates",
    "intro": "The status panel summarizes seating progress, rule results, and students who still need attention.",
    "items": [
      {
        "title": "Stats",
        "text": "Shows total students, usable seats, and placed students."
      },
      {
        "title": "Live updates",
        "text": "Shows recent messages and results."
      },
      {
        "title": "Rule Report",
        "text": "Analyze explains conflicts, warnings, and successful checks."
      },
      {
        "title": "Unassigned Students",
        "text": "Students not currently placed in a seat. Use this list from the Seat Students or Review stage, where the chart and placement controls are available."
      },
      {
        "title": "Assigned Students",
        "text": "Students currently seated, usually with quick actions."
      },
      {
        "title": "Analyze button",
        "text": "Refreshes the report after generation, group edits, or manual moves."
      }
    ],
    "tips": [
      "Run Analyze after changing groups or moving several students manually.",
      "If unassigned students remain, check seat count and locked placements."
    ],
    "examples": [
      "If Analyze reports too few seats, convert more cells to seats or remove unneeded blocked/empty cells."
    ]
  },
  {
    "id": "print",
    "category": "Print",
    "title": "Print Options, Substitute Print, Notes, Groups, and Zones",
    "keywords": "print printer clean names only substitute print details first last nickname grade id notes private public substitute print page",
    "intro": "Print controls decide what appears on paper or PDF. Review these options carefully when notes are included.",
    "items": [
      {
        "title": "Print as seen",
        "text": "Prints the current styled layout."
      },
      {
        "title": "Clean names only",
        "text": "Removes most styling and shows only clean student names."
      },
      {
        "title": "Substitute print",
        "text": "Uses a clean layout and can include selected note categories."
      },
      {
        "title": "Student details",
        "text": "Choose first name, last name, nickname, grade, and ID."
      },
      {
        "title": "Notes to include",
        "text": "Choose Private, Substitute, and/or Public notes. Private notes stay hidden unless checked."
      },
      {
        "title": "Open Print Page",
        "text": "Applies options and opens print preview mode. Use the browser print command after that."
      },
      {
        "title": "Read-only classroom package",
        "text": "Creates a faithful Grid or Freeform HTML view for a selected audience without the editable application. Enable password protection to encrypt the selected classroom data before sending the file."
      },
      {
        "title": "Editable Drive sharing",
        "text": "For another teacher who must edit the master, share the active Google Drive save and give that person Editor access. Read-only packages do not participate in multi-user editing."
      }
    ],
    "tips": [
      "For substitutes, include Substitute notes and optionally Public notes. Do not include Private notes by default.",
      "For student-facing copies, use Clean names only and no notes."
    ],
    "warnings": [
      "Always review note categories before printing. Printed copies and PDFs are not encrypted."
    ],
    "examples": [
      "Substitute copy: Substitute print + first/last name + substitute notes + public notes."
    ]
  },
  {
    "id": "mobile",
    "category": "Mobile",
    "title": "Mobile and Touch Workflow",
    "keywords": "mobile phone tablet navigation class setup room design seat students seating review save share carry workflow tap seat touch",
    "intro": "On narrow screens, use the same five-stage workflow as desktop. Each stage exposes the panel needed for that task so controls are not stacked over the chart.",
    "items": [
      {
        "title": "Five-stage navigation",
        "text": "Move through Class Setup, Room Design, Seat Students, Review, and Save & Share. The visible panel changes with the selected stage."
      },
      {
        "title": "Touch placement",
        "text": "Open Seat Students, select a student or group, then tap a visible seat. Placement is kept beside the chart rather than on the roster-only screen."
      },
      {
        "title": "Grid and Freeform are always visible",
        "text": "In Room Design, use the persistent Grid and Freeform buttons above the canvas. The adjacent Grid options or Freeform options button opens the complete matching tool set in a full-height mobile sheet. Choose Canvas only to hide the surrounding interface and use the floating controls button to restore it."
      },
      {
        "title": "More room actions",
        "text": "Use More actions beside the room-type switch for templates, search, display options, and Freeform presets, audit, and advanced room tools."
      },
      {
        "title": "Mobile action drawer",
        "text": "Seat Students and Review provide compact action panels for placement, editing, rules, and chart actions without covering the room permanently."
      },
      {
        "title": "Seat zoom and text size",
        "text": "The room header keeps Seat zoom and Text size in two fitted rows. Seat zoom changes how large seats and room objects appear; Text size changes the labels inside them without altering saved room geometry."
      },
      {
        "title": "Move around a large room",
        "text": "Swipe the room in Seat Students and Review to reach content beyond the phone screen. In Room Design, turn on Pan room before dragging the viewport so the gesture moves the view instead of a seat or object. Turn Pan off again to edit."
      },
      {
        "title": "Presentation Mode on mobile",
        "text": "Pan room turns on automatically in mobile Presentation Mode. Zoom, Text size, and Pan remain available while editing and workflow controls stay locked."
      }
    ],
    "tips": [
      "Use the visible Grid or Freeform switch first, then open the matching options sheet. The red X returns directly to the canvas.",
      "Use landscape orientation for detailed room layout edits when possible.",
      "When a room is larger than the screen, use ordinary swipes in Seat Students or Review, or turn on Pan room while designing."
    ],
    "examples": [
      "Open Seat Students, select an unassigned student, then tap the desired visible seat."
    ]
  },
  {
    "id": "dialogs-reference",
    "category": "Help",
    "title": "Tools, Dialogs, Editors, and Confirmation Windows",
    "keywords": "dialog modal popup window editor confirmation about changelog license global search class tools student edit notes seat edit group manager snapshot revision template audit preset workspace conflict diagnostics information",
    "intro": "This reference groups the application's pop-up tools by purpose so users can identify what opened, what it changes, and whether closing it is safe.",
    "items": [
      {
        "title": "Information and navigation windows",
        "text": "About, Change Log, License, Help & Lessons, and Global Search are informational or navigational. Closing them does not change classroom data."
      },
      {
        "title": "Class and roster editors",
        "text": "Class Name, Class Tools, District Roster, Student Editor, Student Notes, and Student / Group / Zone Manager change the active class only after the relevant Save, Add, Apply, or Delete action."
      },
      {
        "title": "Room and object editors",
        "text": "Seat Editor, Room Templates, Freeform Workspace, Freeform Presets, and Freeform Audit control room geometry and objects. Preview and audit windows do not change the room; Apply, Restore, or object-edit actions do."
      },
      {
        "title": "Seating explanation and review windows",
        "text": "Why This Placement, Rule Conflicts, Seating Candidates, Today Mode, Seating Plans, and Undo History explain or stage changes. Candidate selection, plan activation, attendance changes, and history restore actions modify the active class."
      },
      {
        "title": "Save, backup, revision, and recovery windows",
        "text": "Save Setup, Selective Restore, Snapshots, Snapshot Preview, Backup Verification, Drive File, Drive Manager, Drive Revisions, Save Conflict, Drive Merge, Operation Recovery, Offline Recovery Kit, and Password Recovery each state whether they are previewing, exporting, restoring, or writing data. Review the summary before Apply, Restore, Merge, or Save."
      },
      {
        "title": "Sharing and Google windows",
        "text": "Share and Collaborate chooses Google Drive people and Viewer or Editor access. Shared Viewer and Safe Sharing create restricted copies rather than changing Drive permissions. Deployment Diagnostics reports whether hosted Google features are configured."
      },
      {
        "title": "Security and privacy windows",
        "text": "Welcome Security, Encryption Password, Security Guided Help, Settings Access, Page Lock setup, Lock Now, Presentation Mode setup, Presentation Mode exit, and privacy-key protection control access to sensitive data. Closing a setup window without saving leaves the previous policy in place."
      },
      {
        "title": "Confirmations",
        "text": "The general confirmation window is reused for destructive or consequential actions. Read its message rather than assuming every confirmation performs the same operation; Cancel leaves the pending action unapplied."
      }
    ],
    "tips": [
      "Use the window title and its primary button to distinguish a preview from an action that writes data.",
      "When a dialog contains a Guide me button, open it for a focused lesson tied to the controls currently on screen."
    ],
    "warnings": [
      "Drive permission changes, restores, merges, imports, deletions, and factory reset actions can affect other users or stored data. Review the final confirmation and create a snapshot or backup when offered."
    ]
  },
  {
    "id": "wizards-how-to",
    "category": "Help",
    "title": "Wizards, Guided Help, and Recovery Flows",
    "keywords": "wizard guided flow how-to how to onboarding welcome security csv mapping import safe sharing restore reconciliation merge recovery password drive conflict setup steps cancel rollback",
    "intro": "The application uses several guided flows. This index explains where each one starts, what it changes, and which safety step protects existing work.",
    "items": [
      {
        "title": "Welcome Security Setup",
        "text": "Appears on first use or during startup recovery. It creates or verifies the encryption password before normal classroom work begins. Starting fresh is destructive only after the explicit reset confirmation."
      },
      {
        "title": "Security Guided Help",
        "text": "Open Settings > Security & Data > Security Guided Help. It checks encryption, Settings access, Lock PIN, Presentation PIN, auto-lock, and storage encryption. Valid options auto-save to encrypted browser storage; unmatched PIN fields block completion."
      },
      {
        "title": "Guided Lessons",
        "text": "Open Help & Lessons from the header or Settings. Explain mode points to real controls without changing class data. Practice mode creates a clearly labeled practice class and validates completed actions."
      },
      {
        "title": "CSV Mapping Wizard",
        "text": "Open Class Setup > Import Roster > Mapped CSV. Map columns, preview rows, choose duplicate handling, optionally create a snapshot, and then apply the import. Canceling before Apply leaves the class unchanged."
      },
      {
        "title": "Roster Reconciliation",
        "text": "Google Classroom and SIS imports show matched, new, missing, and duplicate students before applying changes. Existing notes, requirements, groups, zones, and seat references are preserved for matched students."
      },
      {
        "title": "Save Setup and Selective Restore",
        "text": "Open the save status or More Save Options. Choose durable storage, download backups, upload a compatible file, and select exactly which classes, settings, snapshots, templates, or components to restore."
      },
      {
        "title": "Safe Sharing and read-only package flow",
        "text": "Open Save & Share > Read-only classroom package. Choose the audience, included fields, and optional viewer password. The preview states what is included before the HTML file is created."
      },
      {
        "title": "Google Drive Share and Collaborate",
        "text": "Open Save & Share > Share Drive Save. Choose a Google-account email, Viewer or Editor, notification settings, and then review the Current Drive permissions list."
      },
      {
        "title": "Class Compare and Merge",
        "text": "Open the class manager's compare/merge action. Choose the source and categories, review the summary, and optionally create a snapshot before applying. The destination class identity is preserved."
      },
      {
        "title": "Drive Merge Conflict Resolver",
        "text": "Appears only when both local and remote users changed the same Drive save. Non-conflicting values merge automatically; each overlapping value must be resolved before Merge and save. Cancel preserves the newer remote file."
      },
      {
        "title": "Operation Recovery Center",
        "text": "Records privacy-safe details after failed imports or Google operations, explains whether data changed, and offers retry, rejected-row download, or a sanitized support report when available."
      },
      {
        "title": "Offline and Password Recovery",
        "text": "The Offline Recovery Kit creates an encrypted backup plus a separate key. The Password Recovery Package wraps the active encryption password with a separate recovery code. Each pair must be stored in separate secure locations."
      }
    ],
    "tips": [
      "Read the first hint in a wizard before pressing Continue; it states whether the flow changes data immediately or waits for a final Apply action.",
      "Create a snapshot before imports, merges, bulk seating changes, or any restore that affects real classes.",
      "Use Explain mode when training staff with real classes and Practice mode when they should click through the workflow themselves."
    ],
    "warnings": [
      "A wizard cannot recover a forgotten encryption password unless a recovery package and its separate code were created beforehand.",
      "Closing a confirmation or preview is safe; applying a restore, merge, import, permission change, or Factory Reset changes data or access and should be reviewed deliberately."
    ]
  },
  {
    "id": "troubleshooting",
    "category": "Troubleshooting",
    "title": "Common Problems and Fixes",
    "keywords": "troubleshooting help problem issue print wrong placement unassigned encryption key lost hints tour highlight not visible popup wrong spot seats not enough",
    "intro": "When something looks wrong, start here with the most common causes and fixes.",
    "items": [
      {
        "title": "Tour highlight is off",
        "text": "Resize the window or click Next/Back. Collapsed panels and modal scrolling can affect small screens."
      },
      {
        "title": "Students remain unassigned",
        "text": "Check usable seat count, locked seats, blocked cells, and high-priority conflicting groups."
      },
      {
        "title": "Generated chart ignores a preference",
        "text": "Lower-priority rules may lose to higher-priority conflicts. Use Analyze to see why."
      },
      {
        "title": "Print notes are missing",
        "text": "Open Print Options and confirm the note category or configuration section is checked."
      },
      {
        "title": "Encrypted save will not open",
        "text": "Use the same encryption key. There is no recovery if the key is lost."
      },
      {
        "title": "Hints disappeared",
        "text": "Check Settings > Hide all text hints, or click Reset Closed Hints."
      },
      {
        "title": "Share Drive Save is unavailable",
        "text": "Connect Google Drive and save or load a Drive file first. The owner also needs Google permission to share that file. Browser-only and downloaded saves do not have Drive collaborator controls."
      },
      {
        "title": "A collaborator cannot find the shared file",
        "text": "Confirm the same Google account received access, then use Load from Drive or Manage Saves & Revisions. Under the narrow per-file scope, Choose Another Drive File through Google Picker may be required when the deployment provides it."
      },
      {
        "title": "The shared file is view only or reports a conflict",
        "text": "View-only means the owner granted Viewer access. Generated save timestamps, hashes, revisions, manifests, and update times are handled automatically. A conflict dialog now means the remote Drive copy contains a genuine overlapping classroom edit; use the merge resolver, save a new copy, or cancel instead of overwriting blindly."
      },
      {
        "title": "Layout feels cramped",
        "text": "Collapse side panels, collapse Layout Tools, use Names Only, or use Design Mode."
      }
    ],
    "tips": [
      "Download All Current Classes before major cleanup. Backups make it easier to recover from large changes."
    ],
    "examples": [
      "If one student keeps landing in a bad location, manually place and lock that student first, then generate the rest."
    ]
  }
];

function helpGuideSearchText(section) {
  return [section.category, section.title, section.keywords, section.intro]
    .concat((section.items || []).flatMap(item => [item.title, item.text].concat(item.bullets || [])))
    .concat(section.tips || [], section.examples || [], section.warnings || [])
    .join(' ')
    .toLowerCase();
}

function helpGuideMatches(section, query) {
  const terms = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const text = helpGuideSearchText(section);
  return terms.every(term => text.includes(term));
}

function helpGuideCardHtml(item) {
  const bullets = (item.bullets || []).map(bullet => `<li>${escapeHtml(bullet)}</li>`).join('');
  return `<div class="help-guide-card"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text || '')}</span>${bullets ? `<ul>${bullets}</ul>` : ''}</div>`;
}

function helpGuideSectionHtml(section) {
  const items = (section.items || []).map(helpGuideCardHtml).join('');
  const tips = (section.tips || []).map(tip => `<div class="help-guide-tip"><strong>Tip:</strong> ${escapeHtml(tip)}</div>`).join('');
  const examples = (section.examples || []).map(example => `<div class="help-guide-example"><strong>Example:</strong> ${escapeHtml(example)}</div>`).join('');
  const warnings = (section.warnings || []).map(warning => `<div class="help-guide-warning"><strong>Important:</strong> ${escapeHtml(warning)}</div>`).join('');
  return `
        <section id="help-section-${escapeHtml(section.id)}" class="help-guide-section" data-help-section="${escapeHtml(section.id)}">
          <h3>${escapeHtml(section.title)} <span>${escapeHtml(section.category || 'Help')}</span></h3>
          <p>${escapeHtml(section.intro || '')}</p>
          <div class="help-guide-card-grid">${items}</div>
          ${tips}${examples}${warnings}
        </section>`;
}

function renderHelpGuide() {
  const query = el('helpGuideSearch')?.value || '';
  const sections = HELP_GUIDE_SECTIONS.filter(section => helpGuideMatches(section, query));
  const nav = el('helpGuideNav');
  const content = el('helpGuideContent');
  const summary = el('helpGuideSummary');
  if (summary) {
    summary.textContent = query.trim()
      ? `${sections.length} help topic${sections.length === 1 ? '' : 's'} matching “${query.trim()}”.`
      : `${HELP_GUIDE_SECTIONS.length} help topics covering the application.`;
  }
  if (nav) {
    nav.innerHTML = sections.map(section => `<button type="button" data-help-nav="${escapeHtml(section.id)}">${escapeHtml(section.title)}</button>`).join('') || '<div class="help-guide-empty">No topics</div>';
  }
  if (content) {
    content.innerHTML = sections.map(helpGuideSectionHtml).join('') || '<div class="help-guide-empty">No help topics match that search. Try “freeform keyboard”, “today attendance”, “CSV mapping”, “recovery backup”, “mobile seating”, “print”, or “settings”.</div>';
  }
  applyTooltips(el('helpGuideModal') || document);
}

function openHelpGuideModal(search = '') {
  const modal = el('helpGuideModal');
  const input = el('helpGuideSearch');
  if (!modal) return;
  if (input && search !== undefined) input.value = String(search || '');
  renderHelpGuide();
  modal.classList.add('show');
  setTimeout(() => {
    if (window.GuidedLearning) el('helpGuideLessonsTab')?.focus?.({ preventScroll: true });
    else el('helpGuideSearch')?.focus?.();
  }, 0);
}

function closeHelpGuideModal() {
  el('helpGuideModal')?.classList.remove('show');
}

function installHelpGuideSupport() {
  el('helpGuideBtn')?.addEventListener('click', () => window.GuidedLearning?.openHelp?.('lessons') || openHelpGuideModal());
  el('closeHelpGuideBtn')?.addEventListener('click', closeHelpGuideModal);
  el('helpGuideModal')?.addEventListener('click', event => {
    if (event.target.id === 'helpGuideModal') closeHelpGuideModal();
    const navBtn = event.target.closest?.('[data-help-nav]');
    if (navBtn) {
      const target = document.getElementById(`help-section-${navBtn.dataset.helpNav}`);
      target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      el('helpGuideNav')?.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', btn === navBtn));
    }
  });
  el('helpGuideSearch')?.addEventListener('input', renderHelpGuide);
  el('clearHelpGuideSearchBtn')?.addEventListener('click', () => {
    const input = el('helpGuideSearch');
    if (input) input.value = '';
    renderHelpGuide();
    input?.focus?.();
  });
  el('helpGuideOpenSettingsBtn')?.addEventListener('click', () => {
    closeHelpGuideModal();
    requestOpenSettingsModal();
  });
  el('helpGuideOpenPrintBtn')?.addEventListener('click', () => {
    closeHelpGuideModal();
    openPrintOptionsModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && el('helpGuideModal')?.classList.contains('show')) closeHelpGuideModal();
  });
}

function exportState(scope = 'all', options = {}) {
  persistActiveClass();
  const allClasses = deepClone(state.classes || []);
  const active = allClasses.find(cls => cls.id === state.activeClassId) || allClasses[0] || createClassRecord('Class 1');
  const classesToExport = scope === 'current' ? [active] : allClasses;
  const activeId = scope === 'current' ? active.id : state.activeClassId;
  const activeForExport = classesToExport.find(cls => cls.id === activeId) || classesToExport[0] || active;
  const collaborationAccess = collaborationAccessDocument();
  const saveIdentity = nextSaveIdentity({ classes: classesToExport, activeClassId: activeForExport.id, roomTemplates: state.roomTemplates || [], collaborationAccess }, {
    advanceRevision: options.advanceRevision === true,
    baseIdentity: Object.prototype.hasOwnProperty.call(options, 'saveIdentityBase') ? options.saveIdentityBase : undefined,
    commitIdentity: options.commitIdentity !== false
  });
  return JSON.stringify({
    format: SAVE_DOCUMENT_FORMAT,
    app: APP_NAME,
    version: APP_REVISION,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    minimumReaderSchemaVersion: MIN_SUPPORTED_DATA_SCHEMA_VERSION,
    encryptionEnvelopeVersion: ENCRYPTION_ENVELOPE_VERSION,
    exportedAt: new Date().toISOString(),
    exportScope: scope === 'current' ? 'current-class' : 'all-classes',
    saveIdentity,
    activeClassId: activeForExport.id,
    classes: classesToExport,
    roomTemplates: deepClone(state.roomTemplates || []),
    collaborationAccess,
    appSnapshots: appSnapshots(),
    pageSettings: mergePageSettings(uiState.pageSettings),
    preferences: { dismissedHintKeys: Array.from(loadDismissedHintKeys()) }
  }, null, 2);
}

function importStateCore(json) {
  assertImportTextWithinLimits(json, 'save data');
  const parsed = assertSupportedSaveDocument(JSON.parse(json), 'save data');
  uiState.saveIdentity = parsed.saveIdentity || null;
  uiState.previewSaveIdentity = null;
  state.roomTemplates = (parsed.roomTemplates || []).map(normalizeRoomTemplateRecord);
  state.collaborationAccess = normalizeCollaborationAccess(parsed.collaborationAccess);
  uiState.pageSettings = mergeImportedPageSettings(parsed.pageSettings || {});
  saveAppSnapshots((parsed.appSnapshots || []).map(normalizeAppSnapshotRecord));
  if (parsed.preferences?.dismissedHintKeys) saveDismissedHintKeys(new Set(parsed.preferences.dismissedHintKeys));
  state.classes = parsed.classes.map(normalizeClassRecord);
  state.activeClassId = parsed.activeClassId;
  applyClassToState(state.activeClassId);
  applyPageSettings(uiState.pageSettings, { skipRender: true, applyLoadDefaults: true });
  renderAll();
}

function downloadText(filename, text, mime = 'text/plain') {
  triggerBlobDownload(filename, new Blob([text], { type: mime }));
}

function loadSample() {
  state.students = [
    normalizeStudent({ id: '1001', firstName: 'Ava', lastName: 'Smith', grade: '6', notesPublic: 'Prefers to be called Ava.', notesSubstitute: 'Reliable peer helper for group transitions.' }),
    normalizeStudent({ id: '1002', firstName: 'Liam', lastName: 'Jones', grade: '6', notesSubstitute: 'Check in quietly after independent directions.', notesPrivate: 'Avoid seating beside Ava during long independent work.' }),
    normalizeStudent({ id: '1003', firstName: 'Mia', lastName: 'Patel', grade: '6', notesPublic: 'Uses glasses for board work.', notesSubstitute: 'Seat near front when possible.' }),
    normalizeStudent({ id: '1004', firstName: 'Noah', lastName: 'Brown', grade: '6', notesPrivate: 'Separate from Liam when possible.' }),
    normalizeStudent({ id: '1005', firstName: 'Sophia', lastName: 'Garcia', grade: '6', notesPublic: 'Helpful with cleanup routines.' }),
    normalizeStudent({ id: '1006', firstName: 'Ethan', lastName: 'Kim', grade: '6', notesSubstitute: 'Benefits from written directions.', notesPrivate: 'Front support group for focus.' }),
    normalizeStudent({ id: '1007', firstName: 'Isabella', lastName: 'Lee', grade: '6', notesPublic: 'Peer helper.' }),
    normalizeStudent({ id: '1008', firstName: 'Mason', lastName: 'Davis', grade: '6' }),
    normalizeStudent({ id: '1009', firstName: 'Olivia', lastName: 'Miller', grade: '6', notesSubstitute: 'Can assist a substitute with classroom routines.' }),
    normalizeStudent({ id: '1010', firstName: 'Lucas', lastName: 'Wilson', grade: '6' }),
    normalizeStudent({ id: '1011', firstName: 'Emma', lastName: 'Moore', grade: '6', notesPublic: 'Peer helper.' }),
    normalizeStudent({ id: '1012', firstName: 'James', lastName: 'Taylor', grade: '6' })
  ];
  state.rows = 5;
  state.cols = 6;
  state.cells = {};
  state.customObjects = [];
  ensureGrid();
  state.cells[keyOf(1, 3)].type = 'teacher';
  state.cells[keyOf(1, 4)].type = 'teacher';
  state.cells[keyOf(3, 1)].type = 'blocked';
  state.cells[keyOf(5, 6)].type = 'door';
  state.groups = [
    { id: 'b-front', name: 'Front Support', type: 'special', priority: 10, color: '#2f6fed', studentIds: ['1003', '1006'], anchorSeats: [keyOf(2,3), keyOf(2,4)] },
    { id: 'b-avoid', name: 'Separate If Possible', type: 'avoid', priority: 10, color: '#e11d48', studentIds: ['1001', '1002', '1004'], anchorSeats: [] },
    { id: 'b-team', name: 'Peer Helpers', type: 'together', priority: 6, color: '#16a34a', studentIds: ['1007', '1009', '1011'], anchorSeats: [] }
  ];
  state.cells[keyOf(2, 3)].anchorGroupIds = ['b-front'];
  state.cells[keyOf(2, 4)].anchorGroupIds = ['b-front'];
  renderAll();
}




function createHistorySnapshot() {
  persistActiveClass();
  return JSON.stringify({
    format: SNAPSHOT_DOCUMENT_FORMAT,
    app: APP_NAME,
    version: APP_REVISION,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    minimumReaderSchemaVersion: MIN_SUPPORTED_DATA_SCHEMA_VERSION,
    encryptionEnvelopeVersion: ENCRYPTION_ENVELOPE_VERSION,
    createdAt: new Date().toISOString(),
    classes: deepClone(state.classes || []),
    activeClassId: state.activeClassId,
    roomTemplates: deepClone(state.roomTemplates || []),
    pageSettings: mergePageSettings(uiState.pageSettings),
    ui: { namesOnlyLayout: !!uiState.namesOnlyLayout, activeSideTab: uiState.activeSideTab, designMode: !!uiState.designMode, designCellSize: uiState.designCellSize }
  });
}

function restoreHistorySnapshot(snapshotText) {
  if (!snapshotText) return;
  uiState.historyPaused = true;
  try {
    const rawSnapshot = typeof snapshotText === 'string' ? JSON.parse(snapshotText) : snapshotText;
    migrateLegacyGroupTerminologyDocument(rawSnapshot);
    const parsed = assertSupportedSnapshotDocument(rawSnapshot, 'snapshot');
    state.classes = Array.isArray(parsed.classes) ? parsed.classes.map(normalizeClassRecord) : [];
    state.roomTemplates = Array.isArray(parsed.roomTemplates) ? parsed.roomTemplates.map(normalizeRoomTemplateRecord) : [];
    state.activeClassId = parsed.activeClassId || state.classes[0]?.id || null;
    if (!state.classes.length) state.classes = [createClassRecord('Class 1')];
    if (!state.activeClassId || !state.classes.some(cls => cls.id === state.activeClassId)) state.activeClassId = state.classes[0].id;
    uiState.pageSettings = mergePageSettings(parsed.pageSettings || uiState.pageSettings);
    if (parsed.ui) {
      uiState.namesOnlyLayout = !!parsed.ui.namesOnlyLayout;
      uiState.activeSideTab = ['students','groups','zones'].includes(parsed.ui.activeSideTab) ? parsed.ui.activeSideTab : 'students';
      uiState.designMode = !!parsed.ui.designMode;
      uiState.designCellSize = clampNumber(parsed.ui.designCellSize || uiState.designCellSize, 20, 72);
    }
    applyClassToState(state.activeClassId, { restoreGeometrySession: false });
    renderAll();
    persistFreeformGeometrySession('history-restore');
  } finally {
    uiState.historyPaused = false;
  }
}

function pushUndoSnapshotCore(reason = 'change') {
  if (uiState.historyPaused || uiState.pageLocked) return;
  const snap = createHistorySnapshot();
  if (uiState.undoStack[uiState.undoStack.length - 1] === snap) return;
  uiState.lastUndoReason = reason;
  uiState.undoStack.push(snap);
  if (uiState.undoStack.length > 60) uiState.undoStack.shift();
  uiState.redoStack = [];
  updateUndoRedoButtons();
}

function undoLastChangeCore() {
  if (!uiState.undoStack.length) return;
  const current = createHistorySnapshot();
  const previous = uiState.undoStack.pop();
  uiState.redoStack.push(current);
  restoreHistorySnapshot(previous);
  updateUndoRedoButtons();
  setLiveStatusMessage('Undid the last change.');
}

function redoLastChangeCore() {
  if (!uiState.redoStack.length) return;
  const current = createHistorySnapshot();
  const next = uiState.redoStack.pop();
  uiState.undoStack.push(current);
  restoreHistorySnapshot(next);
  updateUndoRedoButtons();
  setLiveStatusMessage('Redid the last undone change.');
}

function updateUndoRedoButtons() {
  const undo = el('undoBtn');
  const redo = el('redoBtn');
  if (undo) undo.disabled = !uiState.undoStack.length;
  if (redo) redo.disabled = !uiState.redoStack.length;
}

function installHistoryCapture() {
  if (document.body.dataset.historyCaptureInstalled === 'true') return;
  document.body.dataset.historyCaptureInstalled = 'true';
  const clickSelector = [
    '#addStudentBtn','#clearStudentsBtn','#addGroupBtn','#clearGroupsBtn','#buildGridBtn','#makeAllSeatsBtn','#emptyGridBtn',
    '#generateBtn','#randomizeAllBtn','#clearAssignmentsBtn','#clearAnchorsBtn','#saveClassNameBtn','#duplicateClassBtn','#deleteClassBtn',
    '#seatEditAssignStudentBtn','#seatEditClearStudentBtn','#seatEditLockBtn','#seatEditAddGroupBtn','#seatEditClearGroupsBtn','#seatEditApplyTypeBtn',
    '#saveStudentEditBtn','#settingsSampleBtn','#saveZoneFromSelectionBtn','#applyZoneToSelectionBtn','#clearZonesFromSelectionBtn',
    '#saveSnapshotBtn',
    '[data-delete-student]','[data-delete-group]','[data-remove-group-member]','[data-toggle-seat-lock]','[data-clear-seat]',
    '[data-toggle-student-lock]','[data-clear-student-assignment]','[data-block-seat]','[data-make-seat]','[data-clear-anchor-seat]',
    '[data-menu-cell-type]','[data-toggle-student-group]','[data-rename-zone]','[data-delete-zone]','[data-remove-zone-student]','[data-detach-zone-group]'
  ].join(',');
  document.addEventListener('click', event => {
    if (event.target.closest('#undoBtn,#redoBtn,#saveLoadMenu,#snapshotModal,#roomTemplateModal')) return;
    if (event.target.closest(clickSelector)) pushUndoSnapshot('Before change');
    else if (event.target.closest('.cell[data-cell-key]') && !event.target.closest('button')) pushUndoSnapshot('Before cell edit');
  }, true);
  document.addEventListener('drop', event => {
    if (event.target.closest('.cell[data-cell-key],.group-card,.group-manager-group,.group-manager-zone,#groupManagerRemoveZone')) pushUndoSnapshot('Before drop');
  }, true);
}

function normalizeAppSnapshotRecord(snapshot, index = 0) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const rawData = typeof source.data === 'string' ? source.data : '';
  if (!rawData) return null;
  const record = {
    format: SNAPSHOT_RECORD_FORMAT,
    app: APP_NAME,
    version: APP_REVISION,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    minimumReaderSchemaVersion: MIN_SUPPORTED_DATA_SCHEMA_VERSION,
    encryptionEnvelopeVersion: ENCRYPTION_ENVELOPE_VERSION,
    id: source.id || uid('snapshot'),
    name: String(source.name || `Snapshot ${index + 1}`).trim().slice(0, 60) || `Snapshot ${index + 1}`,
    createdAt: source.createdAt || new Date().toISOString(),
    automatic: !!source.automatic,
    reason: String(source.reason || ''),
    data: rawData
  };
  record.signature = source.signature || hashString(record.data);
  return record;
}

function snapshotIndexStorageIsEncrypted() {
  return supportedStoredPayloadIsEncrypted(
    safeStorageGet('localStorage', LOCAL_AUTOSAVE_SNAPSHOT_KEY),
    APP_SNAPSHOT_INDEX_KEY,
    'snapshot-index'
  );
}

function snapshotRetentionStorageLimit() {
  return clampNumber(pageSettings().snapshotRetention || 50, 5, 200);
}

async function ensureAppSnapshotsLoaded(options = {}) {
  const force = !!options.force;
  if (uiState.appSnapshotsLoaded && !force) return uiState.appSnapshotsCache || [];
  const raw = await BrowserDataStore.getSnapshotIndex();
  if (!raw) {
    uiState.appSnapshotsCache = [];
    uiState.appSnapshotsLoaded = true;
    return uiState.appSnapshotsCache;
  }
  try {
    const envelope = assertSupportedEncryptedEnvelope(JSON.parse(raw), 'snapshot index', 'snapshot-index');
    if (!currentSessionEncryptionKey()) {
      uiState.appSnapshotsCache = [];
      uiState.appSnapshotsLoaded = false;
      return [];
    }
    const plain = await decryptTextEnvelope(envelope, currentSessionEncryptionKey());
    const inner = assertSupportedSnapshotIndex(JSON.parse(plain), 'snapshot index');
    uiState.appSnapshotsCache = inner.snapshots.map(normalizeAppSnapshotRecord).filter(Boolean).slice(0, snapshotRetentionStorageLimit());
    uiState.appSnapshotsLoaded = true;
  } catch (err) {
    uiState.appSnapshotsCache = [];
    uiState.appSnapshotsLoaded = true;
    setLiveStatusMessage(`Snapshot index rejected: ${err.message || err}`);
  }
  return uiState.appSnapshotsCache || [];
}

function appSnapshots() {
  return Array.isArray(uiState.appSnapshotsCache) ? uiState.appSnapshotsCache.filter(item => item && item.id && item.data) : [];
}

async function persistAppSnapshotsIndexEncrypted() {
  const token = ++uiState.snapshotIndexPersistToken;
  const items = (uiState.appSnapshotsCache || []).map(normalizeAppSnapshotRecord).filter(Boolean).slice(0, snapshotRetentionStorageLimit());
  const key = currentSessionEncryptionKey();
  if (!key) {
    if (!items.length) {
      await BrowserDataStore.removeSnapshotIndex();
    } else {
      setLiveStatusMessage('Snapshot index was updated in memory but cannot be written until the session encryption password is active.');
    }
    updateSecurityStatusPanel();
    return;
  }
  const plain = JSON.stringify({ format: SNAPSHOT_INDEX_FORMAT, app: APP_NAME, version: APP_REVISION, dataSchemaVersion: DATA_SCHEMA_VERSION, minimumReaderSchemaVersion: MIN_SUPPORTED_DATA_SCHEMA_VERSION, encryptionEnvelopeVersion: ENCRYPTION_ENVELOPE_VERSION, snapshots: items });
  const encrypted = await encryptTextWithSecret(plain, key, 'snapshot-index', { payloadKind: 'snapshot-index', snapshotIndexEncrypted: true });
  if (token === uiState.snapshotIndexPersistToken && !await BrowserDataStore.setSnapshotIndex(encrypted)) {
    setLiveStatusMessage('Snapshot index could not be stored in this browser. Check storage permissions or available space.');
    updateSecurityStatusPanel();
    return false;
  }
  updateSecurityStatusPanel();
  return true;
}


function openSnapshotModal() {
  const modal = el('snapshotModal');
  if (modal) modal.classList.add('show');
  void ensureAppSnapshotsLoaded().then(renderSnapshotList);
}

function closeSnapshotModal() {
  const modal = el('snapshotModal');
  if (modal) modal.classList.remove('show');
}

async function createAppSnapshotWithName(name, options = {}) {
  const snapshotName = String(name || '').trim() || `Snapshot ${new Date().toLocaleString()}`;
  const record = {
    format: SNAPSHOT_RECORD_FORMAT,
    app: APP_NAME,
    version: APP_REVISION,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    minimumReaderSchemaVersion: MIN_SUPPORTED_DATA_SCHEMA_VERSION,
    encryptionEnvelopeVersion: ENCRYPTION_ENVELOPE_VERSION,
    id: uid(options.automatic ? 'autosnapshot' : 'snapshot'),
    name: snapshotName,
    createdAt: new Date().toISOString(),
    automatic: !!options.automatic,
    reason: options.reason || '',
    data: await snapshotDataForStorage(createHistorySnapshot())
  };
  await ensureAppSnapshotsLoaded();
  const items = appSnapshots();
  const signature = hashString(record.data);
  if (options.automatic && items[0]?.signature === signature) return null;
  record.signature = signature;
  items.unshift(record);
  saveAppSnapshots(items);
  if (!options.silent) {
    renderSnapshotList();
    setLiveStatusMessage(`Snapshot saved: ${snapshotName}.`);
  }
  return record;
}

async function saveClassSnapshot() {
  const name = String(el('snapshotNameInput')?.value || '').trim() || `Snapshot ${new Date().toLocaleString()}`;
  const record = await createAppSnapshotWithName(name);
  if (record && el('snapshotNameInput')) el('snapshotNameInput').value = '';
}

async function quickSnapshotAndOpenList() {
  const button = el('snapshotQuickBtn');
  if (button?.disabled) return;
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.title = 'Saving snapshot…';
  }
  try {
    const record = await createAppSnapshotWithName(`Snapshot ${new Date().toLocaleString()}`);
    openSnapshotModal();
    if (record) {
      button?.classList.add('snapshot-saved');
      setLiveStatusMessage(`Snapshot saved: ${record.name}.`);
      window.setTimeout(() => button?.classList.remove('snapshot-saved'), 900);
    }
  } catch (error) {
    setLiveStatusMessage(error?.message || 'Could not create the snapshot.');
  } finally {
    if (button) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.title = 'Take a full-app snapshot and open the snapshot list';
    }
  }
}

async function createAutoLockSnapshot(reason = 'Auto-lock') {
  const label = String(reason || 'Auto-lock').trim() || 'Auto-lock';
  return createAppSnapshotWithName(`${label} ${new Date().toLocaleString()}`, { silent: true, automatic: true, reason: 'auto-lock' });
}

async function createAutosaveSnapshot(reason = 'Auto-save') {
  return createAppSnapshotWithName(`${reason} ${new Date().toLocaleString()}`, { silent: true, automatic: true, reason: 'autosave' });
}

async function createBeforeRestoreSnapshot(targetName = '') {
  const cleanedTarget = String(targetName || 'snapshot').trim().slice(0, 48) || 'snapshot';
  const label = `Return point before restoring ${cleanedTarget} - ${new Date().toLocaleString()}`;
  return createAppSnapshotWithName(label, { silent: true, automatic: false, reason: 'before-restore' });
}


async function restoreClassSnapshot(snapshotId) {
  await ensureAppSnapshotsLoaded();
  const snap = appSnapshots().find(item => item.id === snapshotId);
  if (!snap) return;
  const warning = `Restore full app snapshot "${snap.name}"?

This will replace the current classes, settings, room templates, and active layout with the snapshot contents. Before the restore runs, the app will save a new return-point snapshot of your current work so you can roll forward again.`;
  showInAppConfirm(warning, async () => {
    try {
      const snapshotText = await snapshotDataForRestore(snap.data);
      const returnPoint = await createBeforeRestoreSnapshot(snap.name);
      pushUndoSnapshot('Before restoring snapshot');
      restoreHistorySnapshot(snapshotText);
      setLiveStatusMessage(`Restored snapshot: ${snap.name}. Return point saved${returnPoint ? `: ${returnPoint.name}` : ''}.`);
      closeSnapshotModal();
    } catch (err) {
      setLiveStatusMessage(err.message || 'Could not restore snapshot.');
      renderSnapshotList();
    }
  }, { title: 'Restore Full App Snapshot?', confirmText: 'Restore Snapshot', cancelText: 'Cancel' });
}

async function deleteClassSnapshot(snapshotId) {
  await ensureAppSnapshotsLoaded();
  saveAppSnapshots(appSnapshots().filter(item => item.id !== snapshotId));
  renderSnapshotList();
  setLiveStatusMessage('Snapshot deleted.');
}

function openRoomTemplateModal() {
  renderRoomTemplateList();
  const modal = el('roomTemplateModal');
  if (modal) modal.classList.add('show');
}

function closeRoomTemplateModal() {
  const modal = el('roomTemplateModal');
  if (modal) modal.classList.remove('show');
}

function roomOnlyFreeformLayout(layout = null) {
  const cleaned = normalizeFreeformLayout(layout);
  cleaned.objects = (cleaned.objects || []).map((obj, index) => ({
    ...normalizeFreeformObject(obj, index),
    assignedStudentId: null,
    manual: false,
    locked: false,
    anchorGroupIds: [],
    zoneIds: Array.isArray(obj.zoneIds) ? [...obj.zoneIds] : []
  }));
  cleaned.nextZ = Math.max(1, ...(cleaned.objects || []).map(obj => Number(obj.zIndex) || 1)) + 1;
  return cleaned;
}

function saveRoomTemplate() {
  const name = String(el('roomTemplateNameInput')?.value || '').trim() || `Room Template ${new Date().toLocaleDateString()}`;
  const cleanedCells = {};
  Object.entries(state.cells || {}).forEach(([key, cell]) => {
    cleanedCells[key] = { row: cell.row, col: cell.col, type: cell.type, assignedStudentId: null, manual: false, anchorGroupIds: [], zoneIds: Array.isArray(cell.zoneIds) ? [...cell.zoneIds] : [] };
  });
  state.roomTemplates = Array.isArray(state.roomTemplates) ? state.roomTemplates : [];
  state.roomTemplates.unshift(normalizeRoomTemplateRecord({ id: uid('room-template'), name, rows: state.rows, cols: state.cols, cells: cleanedCells, layoutMode: state.layoutMode, freeformLayout: roomOnlyFreeformLayout(state.freeformLayout), zones: state.zones, customObjects: state.customObjects }));
  if (state.roomTemplates.length > 40) state.roomTemplates.length = 40;
  if (el('roomTemplateNameInput')) el('roomTemplateNameInput').value = '';
  renderRoomTemplateList();
  setLiveStatusMessage(`Room template saved: ${name}.`);
}

function renderRoomTemplateList() {
  const list = el('roomTemplateList');
  if (!list) return;
  const items = Array.isArray(state.roomTemplates) ? state.roomTemplates : [];
  if (!items.length) {
    list.innerHTML = '<div class="hint">No room templates saved yet.</div>';
    return;
  }
  list.innerHTML = items.map(item => `
        <div class="settings-list-row">
          <div class="settings-list-main"><strong>${escapeHtml(item.name)}</strong><div class="muted">${item.layoutMode === 'freeform' ? 'Freeform room' : `${item.rows} rows x ${item.cols} columns`}</div></div>
          <div class="button-row"><button class="tiny secondary" data-apply-room-template="${escapeHtml(item.id)}" type="button">Apply</button><button class="tiny danger icon-button" data-delete-room-template="${escapeHtml(item.id)}" type="button" aria-label="Delete room template" title="Delete this room template">🗑</button></div>
        </div>
      `).join('');
}

function applyRoomTemplate(templateId) {
  if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
  const template = (state.roomTemplates || []).find(item => item.id === templateId);
  if (!template) return;
  pushUndoSnapshot('Before applying room template');
  state.rows = template.rows;
  state.cols = template.cols;
  state.layoutMode = template.layoutMode === 'freeform' ? 'freeform' : 'grid';
  state.customObjects = deepClone(template.customObjects || []);
  state.zones = deepClone(template.zones || []);
  state.cells = normalizeCellsRecord(template.cells || {});
  state.freeformLayout = roomOnlyFreeformLayout(template.freeformLayout);
  Object.values(state.cells).forEach(cell => { cell.assignedStudentId = null; cell.manual = false; cell.anchorGroupIds = []; });
  state.groups.forEach(group => group.anchorSeats = []);
  resetFreeformGeometryCache();
  ensureGrid();
  renderAll();
  closeRoomTemplateModal();
  setLiveStatusMessage(`Applied room template: ${template.name}.`);
}

function deleteRoomTemplate(templateId) {
  state.roomTemplates = (state.roomTemplates || []).filter(item => item.id !== templateId);
  renderRoomTemplateList();
}

function zoneById(zoneId) {
  return (state.zones || []).find(zone => String(zone.id) === String(zoneId));
}

function zoneTagsHtml(cell, zoneMap = null) {
  const zones = (cell?.zoneIds || [])
    .map(zoneId => zoneMap ? zoneMap.get(String(zoneId)) : zoneById(zoneId))
    .filter(Boolean);
  if (!zones.length) return '';
  return `<div class="cell-zone-tags">${zones.map(zone => `<span class="zone-tag" title="Zone: ${escapeHtml(zone.name)}" style="border-color:${escapeHtml(zone.color)}"><span class="student-group-dot" style="background:${escapeHtml(zone.color)}"></span>${escapeHtml(zone.name)}</span>`).join('')}</div>`;
}

function renderZoneControls() {
  const select = el('zoneSelect');
  const groupZone = el('groupZoneSelect');
  const zones = Array.isArray(state.zones) ? state.zones : [];
  const html = '<option value="">No zone</option>' + zones.map(zone => `<option value="${escapeHtml(zone.id)}">${escapeHtml(zone.name)}</option>`).join('');
  if (select) select.innerHTML = html;
  if (groupZone) groupZone.innerHTML = html;
}

function saveSelectedCellsAsZone() {
  if (eyeModeBlocksGroupEditing() || eyeModeBlocksRoomEditing()) return blockEyeModeAction(eyeModeBlocksGroupEditing() ? 'group' : 'room');
  const keys = selectedCellKeysArray();
  if (!keys.length) { setLiveStatusMessage('Select one or more cells before saving a zone.'); return; }
  const name = String(el('zoneNameInput')?.value || '').trim() || `Zone ${state.zones.length + 1}`;
  const color = safeColor(el('zoneColorInput')?.value, defaultGroupColor(state.zones.length + 4));
  const zone = normalizeZoneRecord({ id: uid('zone'), name, color });
  state.zones = Array.isArray(state.zones) ? state.zones : [];
  state.zones.push(zone);
  keys.forEach(key => {
    const cell = state.cells[key];
    if (!cell) return;
    cell.zoneIds = Array.from(new Set([...(cell.zoneIds || []), zone.id]));
  });
  if (el('zoneNameInput')) el('zoneNameInput').value = '';
  renderAll();
  setLiveStatusMessage(`Saved zone "${zone.name}" for ${keys.length} cell(s).`);
}

function applyZoneToSelectedCells() {
  if (eyeModeBlocksGroupEditing() || eyeModeBlocksRoomEditing()) return blockEyeModeAction(eyeModeBlocksGroupEditing() ? 'group' : 'room');
  const zoneId = String(el('zoneSelect')?.value || '');
  const keys = selectedCellKeysArray();
  if (!zoneId || !keys.length) { setLiveStatusMessage('Choose a zone and select cells first.'); return; }
  keys.forEach(key => {
    const cell = state.cells[key];
    if (!cell) return;
    cell.zoneIds = Array.from(new Set([...(cell.zoneIds || []), zoneId]));
  });
  renderAll();
  setLiveStatusMessage(`Applied zone to ${keys.length} selected cell(s).`);
}

function clearZonesFromSelectedCells() {
  if (eyeModeBlocksGroupEditing() || eyeModeBlocksRoomEditing()) return blockEyeModeAction(eyeModeBlocksGroupEditing() ? 'group' : 'room');
  const keys = selectedCellKeysArray();
  if (!keys.length) { setLiveStatusMessage('Select cells first.'); return; }
  keys.forEach(key => { if (state.cells[key]) state.cells[key].zoneIds = []; });
  renderAll();
  setLiveStatusMessage(`Cleared zones from ${keys.length} selected cell(s).`);
}

function duplicateStudentFindings() {
  const findings = [];
  const byId = new Map();
  const byName = new Map();
  state.students.forEach(student => {
    const id = String(student.id || '').trim().toLowerCase();
    const name = studentFullName(student).trim().toLowerCase();
    if (id) byId.set(id, [...(byId.get(id) || []), student]);
    if (name) byName.set(name, [...(byName.get(name) || []), student]);
  });
  byId.forEach((items, id) => { if (items.length > 1) findings.push({ severity:'warn', message:`Duplicate student ID "${id}": ${items.map(studentDisplay).join(', ')}.` }); });
  byName.forEach((items, name) => { if (items.length > 1) findings.push({ severity:'warn', message:`Possible duplicate name "${name}": ${items.map(s => `${studentDisplay(s)} (${s.id})`).join(', ')}.` }); });
  return findings;
}

function hasSensitiveStudentNotes() {
  return state.students.some(student => studentHasSensitiveNotes(student));
}

function defaultPrintOptions() {
  return {
    mode: 'seen',
    details: { firstName: true, lastName: true, nickName: false, grade: false, id: false },
    chartDetails: { title: true, className: true, date: true, period: true, room: true, teacher: true },
    notes: { private: false, substitute: false, public: false },
    sections: { groups: false, zones: false },
    framing: { cropToContent: false },
    groupConfig: { rule: true, priority: true, zone: true, members: true, reservedSeats: true, color: true },
    zoneConfig: { color: true, students: true, groups: true, seats: true }
  };
}

function currentPrintOptions() {
  const defaults = defaultPrintOptions();
  uiState.printOptions = uiState.printOptions || defaults;
  uiState.printOptions.details = { ...defaults.details, ...(uiState.printOptions.details || {}) };
  uiState.printOptions.chartDetails = { ...defaults.chartDetails, ...(uiState.printOptions.chartDetails || {}) };
  uiState.printOptions.notes = { ...defaults.notes, ...(uiState.printOptions.notes || {}) };
  uiState.printOptions.sections = { ...defaults.sections, ...(uiState.printOptions.sections || {}) };
  uiState.printOptions.framing = { ...defaults.framing, ...(uiState.printOptions.framing || {}) };
  uiState.printOptions.groupConfig = { ...defaults.groupConfig, ...(uiState.printOptions.groupConfig || {}) };
  uiState.printOptions.zoneConfig = { ...defaults.zoneConfig, ...(uiState.printOptions.zoneConfig || {}) };
  return uiState.printOptions;
}

function noteCategoryLabel(category) {
  if (category === 'private') return 'Private';
  if (category === 'substitute') return 'Substitute';
  if (category === 'public') return 'Public';
  return category;
}

function noteCategoryTitle(categories) {
  const labels = categories.map(noteCategoryLabel);
  if (!labels.length) return 'Student Notes';
  if (labels.length === 1) return `${labels[0]} Notes`;
  if (labels.length === 2) return `${labels[0]} & ${labels[1]} Notes`;
  return `${labels.slice(0, -1).join(', ')} & ${labels.at(-1)} Notes`;
}

function setPrintOptionDefaultsForMode(mode) {
  const options = currentPrintOptions();
  options.mode = mode || 'seen';
  options.details = { firstName: true, lastName: true, nickName: false, grade: false, id: false };
  options.chartDetails = { ...defaultPrintOptions().chartDetails };
  options.notes = { private: false, substitute: false, public: false };
  options.sections = { groups: false, zones: false };
  options.framing = { cropToContent: false };
  options.groupConfig = { ...defaultPrintOptions().groupConfig };
  options.zoneConfig = { ...defaultPrintOptions().zoneConfig };
  if (options.mode === 'substitute') options.notes = { private: false, substitute: true, public: true };
  writePrintOptionsToModal();
}

function writePrintOptionsToModal() {
  const options = currentPrintOptions();
  if (el('printOptionMode')) el('printOptionMode').value = options.mode;
  document.querySelectorAll('[data-print-detail]').forEach(input => {
    input.checked = !!options.details[input.dataset.printDetail];
  });
  document.querySelectorAll('[data-print-note-category]').forEach(input => {
    input.checked = !!options.notes[input.dataset.printNoteCategory];
  });
  document.querySelectorAll('[data-print-chart-detail]').forEach(input => {
    input.checked = !!options.chartDetails[input.dataset.printChartDetail];
  });
  document.querySelectorAll('[data-print-side-section]').forEach(input => {
    input.checked = !!options.sections[input.dataset.printSideSection];
  });
  document.querySelectorAll('[data-print-group-detail]').forEach(input => {
    input.checked = !!options.groupConfig[input.dataset.printGroupDetail];
  });
  document.querySelectorAll('[data-print-zone-detail]').forEach(input => {
    input.checked = !!options.zoneConfig[input.dataset.printZoneDetail];
  });
  if (el('printCropToContentToggle')) el('printCropToContentToggle').checked = !!options.framing?.cropToContent;
}

function readPrintOptionsFromModal() {
  const options = defaultPrintOptions();
  options.mode = el('printOptionMode')?.value || 'seen';
  document.querySelectorAll('[data-print-detail]').forEach(input => {
    options.details[input.dataset.printDetail] = !!input.checked;
  });
  document.querySelectorAll('[data-print-note-category]').forEach(input => {
    options.notes[input.dataset.printNoteCategory] = !!input.checked;
  });
  document.querySelectorAll('[data-print-chart-detail]').forEach(input => {
    options.chartDetails[input.dataset.printChartDetail] = !!input.checked;
  });
  document.querySelectorAll('[data-print-side-section]').forEach(input => {
    options.sections[input.dataset.printSideSection] = !!input.checked;
  });
  document.querySelectorAll('[data-print-group-detail]').forEach(input => {
    options.groupConfig[input.dataset.printGroupDetail] = !!input.checked;
  });
  document.querySelectorAll('[data-print-zone-detail]').forEach(input => {
    options.zoneConfig[input.dataset.printZoneDetail] = !!input.checked;
  });
  options.framing.cropToContent = !!el('printCropToContentToggle')?.checked;
  if (!Object.values(options.details).some(Boolean)) {
    options.details.firstName = true;
    options.details.lastName = true;
  }
  uiState.printOptions = options;
  writePrintOptionsToModal();
  return options;
}

function openPrintOptionsModal() {
  writePrintOptionsToModal();
  el('printOptionsModal')?.classList.add('show');
}

function closePrintOptionsModal() {
  el('printOptionsModal')?.classList.remove('show');
}

function startPrintPreviewFromOptionsCore(options = readPrintOptionsFromModal()) {
  closePrintOptionsModal();
  const cleanMode = options.mode === 'clean' || options.mode === 'substitute';
  document.body.classList.toggle('print-clean', cleanMode);
  document.body.classList.toggle('print-substitute', options.mode === 'substitute');
  document.body.classList.add('print-preview-active');
  document.body.classList.remove('freeform-print-fit','freeform-print-actual','freeform-print-tile');
  if (state.layoutMode === 'freeform') {
    const printMode = state.freeformLayout?.canvas?.printScaleMode || 'tile';
    document.body.classList.add(`freeform-print-${printMode}`);
    if (printMode === 'fit') {
      const sizes = { letter:[8.5,11], legal:[8.5,14], a4:[8.27,11.69] };
      const canvas = state.freeformLayout?.canvas || {};
      let [pageW,pageH] = sizes[canvas.printPageSize] || sizes.letter;
      if (canvas.printOrientation === 'landscape') [pageW,pageH] = [pageH,pageW];
      const margin = Number(canvas.printMargin) || 0;
      const usableW = Math.max(96,(pageW-margin*2)*96);
      const usableH = Math.max(96,(pageH-margin*2)*96);
      const scale = Math.min(1, usableW/Math.max(1,canvas.width||2800), usableH/Math.max(1,canvas.height||1800));
      document.body.style.setProperty('--freeform-print-fit-scale', String(scale));
    }
  }
  renderGrid();
  renderPrintNotesPanel();
  setLiveStatusMessage('Print page opened with the selected options. Use the browser print command, Ctrl+P on Windows/ChromeOS or Cmd+P on Mac, then exit preview when done.');
}

function closePrintPreview() {
  document.body.classList.remove('print-preview-active', 'print-clean', 'print-substitute', 'print-has-notes', 'freeform-print-fit', 'freeform-print-actual', 'freeform-print-tile');
  document.body.style.removeProperty('--freeform-print-fit-scale');
  const panel = el('printNotesPanel');
  if (panel) panel.innerHTML = '';
  renderGrid();
  setLiveStatusMessage('Print preview closed.');
}

function studentPrintSeatHtml(student) {
  const options = currentPrintOptions();
  const details = options.details || {};
  const nameParts = [];
  if (details.nickName && student.nickName) nameParts.push(String(student.nickName).trim());
  const formalParts = [];
  if (details.firstName && student.firstName) formalParts.push(String(student.firstName).trim());
  if (details.lastName && student.lastName) formalParts.push(String(student.lastName).trim());
  if (formalParts.length) nameParts.push(formalParts.join(' '));
  const primary = nameParts.join(nameParts.length > 1 ? ' / ' : '') || studentDisplay(student);
  const meta = [];
  if (details.grade && student.grade) meta.push(`Grade: ${student.grade}`);
  if (details.id && student.id) meta.push(`ID: ${student.id}`);
  return `<span class="print-seat-name"><span class="print-seat-primary">${escapeHtml(primary)}</span>${meta.length ? `<span class="print-seat-detail">${escapeHtml(meta.join(' · '))}</span>` : ''}</span>`;
}

function seatStudentHtml(student) {
  if (!student) return '<span class="seat-empty">Drop student here</span>';
  if (document.body.classList.contains('print-preview-active')) return studentPrintSeatHtml(student);
  return escapeHtml(studentDisplay(student));
}

function printableNotesForCurrentMode(options = currentPrintOptions()) {
  const categories = ['private', 'substitute', 'public'].filter(category => !!options.notes?.[category]);
  if (!categories.length) return [];
  return [...state.students]
    .sort((a,b) => studentDisplay(a).localeCompare(studentDisplay(b)))
    .map(student => {
      const notes = categories
        .map(category => ({ category, text: studentNoteValue(student, category) }))
        .filter(item => item.text);
      return { student, notes };
    })
    .filter(item => item.notes.length);
}

function cellLocationLabel(cellKey) {
  const coords = cellCoordsFromKey(cellKey);
  return coords ? `R${coords.row}C${coords.col}` : String(cellKey || '');
}

function joinedList(items, emptyText = 'None') {
  const cleaned = (items || []).map(item => String(item || '').trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(', ') : emptyText;
}

function renderPrintNotesSection(categories, items) {
  if (!items.length) return '';
  return `<section class="print-panel-section print-student-notes-section"><h3>${escapeHtml(noteCategoryTitle(categories))}<span class="print-section-count">${items.length}</span></h3><ul>${items.map(item => {
        const lines = item.notes.map(note => `<div class="print-note-line print-note-${escapeHtml(note.category)}"><span class="print-note-bullet">•</span><span class="print-note-label">${escapeHtml(noteCategoryLabel(note.category))}:</span><span class="print-note-text">${escapeHtml(note.text)}</span></div>`).join('');
        return `<li><div class="print-note-student">${escapeHtml(studentDisplay(item.student))}</div><div class="print-note-lines">${lines}</div></li>`;
      }).join('')}</ul></section>`;
}

function renderPrintConfigRows(rowItems, emptyText) {
  if (!rowItems.length) return `<div class="print-config-detail-empty">${escapeHtml(emptyText)}</div>`;
  return rowItems.map(([label, value]) => `<span class="print-config-label">${escapeHtml(label)}</span><span class="print-config-value">${escapeHtml(value)}</span>`).join('');
}

function renderPrintGroupConfigSection() {
  const options = currentPrintOptions();
  const config = options.groupConfig || defaultPrintOptions().groupConfig;
  const groups = [...(state.groups || [])].sort((a,b) => Number(b.priority || 0) - Number(a.priority || 0) || String(a.name || '').localeCompare(String(b.name || '')));
  const zoneById = new Map((state.zones || []).map(zone => [String(zone.id), zone]));
  const studentById = new Map((state.students || []).map(student => [String(student.id), student]));
  if (!groups.length) {
    return '<section class="print-panel-section print-group-config-section"><h3>Group Configuration<span class="print-section-count">0</span></h3><div class="print-empty-section">No groups are defined for this class.</div></section>';
  }
  const cards = groups.map(group => {
    const members = (group.studentIds || []).map(id => studentById.get(String(id))).filter(Boolean).map(studentDisplay);
    const zone = group.zoneId ? zoneById.get(String(group.zoneId)) : null;
    const anchors = [...new Set([...(group.anchorSeats || [])])].map(cellLocationLabel);
    const rowItems = [];
    if (config.rule) rowItems.push(['Rule', typeLabel(group.type)]);
    if (config.priority) rowItems.push(['Priority', group.priority || 'None']);
    if (config.zone) rowItems.push(['Zone', zone ? zone.name : 'None']);
    if (config.members) rowItems.push(['Members', joinedList(members)]);
    if (config.reservedSeats) rowItems.push(['Reserved', joinedList(anchors, 'None')]);
    if (config.color) rowItems.push(['Color', safeColor(group.color, '#2f6fed')]);
    const rows = renderPrintConfigRows(rowItems, 'No group detail fields selected.');
    const swatch = config.color ? `<span class="print-config-swatch" style="background:${escapeHtml(safeColor(group.color, '#2f6fed'))}"></span>` : '';
    return `<li class="print-config-card"><div class="print-config-head"><div class="print-config-title">${escapeHtml(group.name || 'Group')}</div>${swatch}</div><div class="print-config-grid">${rows}</div></li>`;
  }).join('');
  return `<section class="print-panel-section print-group-config-section"><h3>Group Configuration<span class="print-section-count">${groups.length}</span></h3><ul class="print-config-list">${cards}</ul></section>`;
}

function renderPrintZoneConfigSection() {
  const options = currentPrintOptions();
  const config = options.zoneConfig || defaultPrintOptions().zoneConfig;
  const zones = [...(state.zones || [])].sort((a,b) => String(a.name || '').localeCompare(String(b.name || '')));
  const studentById = new Map((state.students || []).map(student => [String(student.id), student]));
  const groupById = new Map((state.groups || []).map(group => [String(group.id), group]));
  const seatsByZoneId = new Map();
  Object.entries(state.cells || {}).forEach(([cellKey, cell]) => {
    (cell.zoneIds || []).forEach(zoneId => {
      const id = String(zoneId);
      if (!seatsByZoneId.has(id)) seatsByZoneId.set(id, []);
      seatsByZoneId.get(id).push(cellLocationLabel(cellKey));
    });
  });
  if (!zones.length) {
    return '<section class="print-panel-section print-zone-config-section"><h3>Zone Configuration<span class="print-section-count">0</span></h3><div class="print-empty-section">No zones are defined for this class.</div></section>';
  }
  const cards = zones.map(zone => {
    const linkedStudentNames = (zone.studentIds || []).map(id => studentById.get(String(id))).filter(Boolean).map(studentDisplay);
    const explicitGroupIds = (zone.groupIds || []).map(String);
    const impliedGroupIds = (state.groups || []).filter(group => String(group.zoneId || '') === String(zone.id)).map(group => String(group.id));
    const groupNames = [...new Set([...explicitGroupIds, ...impliedGroupIds])].map(id => groupById.get(id)?.name || id).filter(Boolean);
    const seats = [...new Set(seatsByZoneId.get(String(zone.id)) || [])];
    const rowItems = [];
    if (config.color) rowItems.push(['Color', safeColor(zone.color, '#8b5cf6')]);
    if (config.students) rowItems.push(['Students', joinedList(linkedStudentNames)]);
    if (config.groups) rowItems.push(['Groups', joinedList(groupNames)]);
    if (config.seats) rowItems.push(['Seats', joinedList(seats, 'No seats assigned')]);
    const rows = renderPrintConfigRows(rowItems, 'No zone detail fields selected.');
    const swatch = config.color ? `<span class="print-config-swatch" style="background:${escapeHtml(safeColor(zone.color, '#8b5cf6'))}"></span>` : '';
    return `<li class="print-config-card"><div class="print-config-head"><div class="print-config-title">${escapeHtml(zone.name || 'Zone')}</div>${swatch}</div><div class="print-config-grid">${rows}</div></li>`;
  }).join('');
  return `<section class="print-panel-section print-zone-config-section"><h3>Zone Configuration<span class="print-section-count">${zones.length}</span></h3><ul class="print-config-list">${cards}</ul></section>`;
}

function renderPrintNotesPanel() {
  const panel = el('printNotesPanel');
  if (!panel) return;
  const options = currentPrintOptions();
  const categories = ['private', 'substitute', 'public'].filter(category => !!options.notes?.[category]);
  const items = printableNotesForCurrentMode();
  const sections = [];
  const notesHtml = renderPrintNotesSection(categories, items);
  if (notesHtml) sections.push(notesHtml);
  if (options.sections?.groups) sections.push(renderPrintGroupConfigSection());
  if (options.sections?.zones) sections.push(renderPrintZoneConfigSection());
  document.body.classList.toggle('print-has-notes', sections.length > 0);
  panel.innerHTML = sections.join('');
}


function printChartMetaLine(options = currentPrintOptions()) {
  const detail = options.chartDetails || defaultPrintOptions().chartDetails;
  const meta = normalizeChartMeta(state.chartMeta);
  const pieces = [];
  if (detail.title && meta.title) pieces.push(meta.title);
  if (detail.className) pieces.push(activeClassName());
  if (detail.date && meta.date) pieces.push(meta.date);
  if (detail.period && meta.period) pieces.push(meta.period);
  if (detail.room && meta.room) pieces.push(meta.room);
  if (detail.teacher && meta.teacher) pieces.push(meta.teacher);
  return pieces.filter(Boolean).join(' | ');
}


function loadChartDetailsIntoSettings() {
  const meta = normalizeChartMeta(state.chartMeta);
  if (el('chartTitleInput')) el('chartTitleInput').value = meta.title || '';
  if (el('chartDateInput')) el('chartDateInput').value = meta.date || '';
  if (el('chartPeriodInput')) el('chartPeriodInput').value = meta.period || '';
  if (el('chartRoomInput')) el('chartRoomInput').value = meta.room || '';
  if (el('chartTeacherInput')) el('chartTeacherInput').value = meta.teacher || '';
}

function saveChartDetailsFromSettings() {
  state.chartMeta = normalizeChartMeta({
    title: el('chartTitleInput')?.value || '',
    date: el('chartDateInput')?.value || '',
    period: el('chartPeriodInput')?.value || '',
    room: el('chartRoomInput')?.value || '',
    teacher: el('chartTeacherInput')?.value || ''
  });
  persistActiveClass();
  renderGrid();
  setLiveStatusMessage('Seating chart details saved.');
}

function csvRejectedRowSource(headers, row) {
  return Object.fromEntries((headers || []).slice(0, 40).map((header, column) => [
    String(header || `Column ${column + 1}`).slice(0, 80),
    String(row?.[column] || '').slice(0, 500)
  ]));
}

function parseCsvMatrix(text) {
  const sourceText = String(text || '');
  assertImportTextWithinLimits(sourceText, 'CSV roster', IMPORT_LIMITS.csvBytes);
  const rows = [];
  let current = [];
  let value = '';
  let inQuotes = false;
  for (let i = 0; i < sourceText.length; i++) {
    const ch = sourceText[i];
    const next = sourceText[i + 1];
    if (ch === '"' && inQuotes && next === '"') { value += '"'; i++; }
    else if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) {
      if (value.length > IMPORT_LIMITS.maxCsvCellLength) throw new Error(`A CSV cell exceeds the ${IMPORT_LIMITS.maxCsvCellLength.toLocaleString()} character safety limit.`);
      current.push(value.trim()); value = '';
      if (current.length > IMPORT_LIMITS.maxCsvColumns) throw new Error(`The CSV contains more than ${IMPORT_LIMITS.maxCsvColumns} columns.`);
    }
    else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      if (value.length > IMPORT_LIMITS.maxCsvCellLength) throw new Error(`A CSV cell exceeds the ${IMPORT_LIMITS.maxCsvCellLength.toLocaleString()} character safety limit.`);
      current.push(value.trim());
      if (current.length > IMPORT_LIMITS.maxCsvColumns) throw new Error(`The CSV contains more than ${IMPORT_LIMITS.maxCsvColumns} columns.`);
      if (current.some(v => v !== '')) rows.push(current);
      if (rows.length > IMPORT_LIMITS.maxCsvRows) throw new Error(`The CSV contains more than ${IMPORT_LIMITS.maxCsvRows.toLocaleString()} rows.`);
      current = []; value = '';
    }
    else {
      value += ch;
      if (value.length > IMPORT_LIMITS.maxCsvCellLength) throw new Error(`A CSV cell exceeds the ${IMPORT_LIMITS.maxCsvCellLength.toLocaleString()} character safety limit.`);
    }
  }
  current.push(value.trim());
  if (current.length > IMPORT_LIMITS.maxCsvColumns) throw new Error(`The CSV contains more than ${IMPORT_LIMITS.maxCsvColumns} columns.`);
  if (current.some(v => v !== '')) rows.push(current);
  if (rows.length > IMPORT_LIMITS.maxCsvRows) throw new Error(`The CSV contains more than ${IMPORT_LIMITS.maxCsvRows.toLocaleString()} rows.`);
  return rows;
}

function guessCsvColumn(headers, names) {
  const lower = headers.map(h => String(h || '').trim().toLowerCase());
  for (const name of names) {
    const index = lower.findIndex(header => header === name || header.includes(name));
    if (index >= 0) return String(index);
  }
  return '';
}

function openCsvMappingWizard(text) {
  const matrix = parseCsvMatrix(text);
  if (matrix.length < 2) throw new Error('CSV import needs a header row and at least one student row.');
  const headers = matrix[0];
  uiState.csvImportDraft = { headers, rows: matrix.slice(1) };
  renderCsvMappingWizard();
  el('csvMapModal')?.classList.add('show');
}

function renderCsvMappingWizardCore() {
  const draft = uiState.csvImportDraft;
  if (!draft) return;
  const fields = [
    ['firstName','First Name',['first','firstname','first name']],
    ['lastName','Last Name',['last','lastname','last name']],
    ['nickName','Nickname',['nick','nickname','nickname','preferred']],
    ['grade','Grade',['grade','level']],
    ['id','Student ID',['id','student id','student number','studentid']],
    ['notesPrivate','Private Notes',['private notes','confidential notes','notes','note','student notes']],
    ['notesSubstitute','Substitute Notes',['substitute notes','sub notes','substitute']],
    ['notesPublic','Public Notes',['public notes','student-facing notes','public']]
  ];
  const optionHtml = '<option value="">Do not import</option>' + draft.headers.map((header, index) => `<option value="${index}">${escapeHtml(header || `Column ${index + 1}`)}</option>`).join('');
  el('csvMappingFields').innerHTML = fields.map(([key,label]) => `<div class="field"><label for="csvMap_${key}">${label}</label><select id="csvMap_${key}" data-csv-map-field="${key}">${optionHtml}</select></div>`).join('');
  fields.forEach(([key,,aliases]) => { const select = el(`csvMap_${key}`); if (select) select.value = guessCsvColumn(draft.headers, aliases); });
  renderCsvPreview();
}

function mappedCsvValues(row) {
  const get = key => {
    const select = el(`csvMap_${key}`);
    const index = select && select.value !== '' ? Number(select.value) : -1;
    return index >= 0 ? String(row[index] || '').trim() : '';
  };
  return { firstName:get('firstName'), lastName:get('lastName'), nickName:get('nickName'), grade:get('grade'), id:get('id'), notesPrivate:get('notesPrivate'), notesSubstitute:get('notesSubstitute'), notesPublic:get('notesPublic') };
}

function mappedStudentFromCsvRow(row) {
  return normalizeStudent(mappedCsvValues(row));
}

function renderCsvPreview() {
  const draft = uiState.csvImportDraft;
  if (!draft) return;
  const rows = draft.rows.slice(0, 6).map(mappedStudentFromCsvRow);
  const warning = el('csvDuplicateWarning');
  if (warning) {
    const duplicates = rows.filter(row => state.students.some(existing => String(existing.id) === String(row.id) || (studentFullName(existing).toLowerCase() && studentFullName(existing).toLowerCase() === studentFullName(row).toLowerCase())));
    warning.style.display = duplicates.length ? 'block' : 'none';
    warning.textContent = duplicates.length ? `${duplicates.length} preview row(s) may match existing students. Existing matching IDs will update instead of creating a duplicate.` : '';
  }
  const headers = ['First','Last','Nick','Grade','ID','Private','Substitute','Public'];
  el('csvPreviewTable').innerHTML = `<table><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><td>${escapeHtml(r.firstName)}</td><td>${escapeHtml(r.lastName)}</td><td>${escapeHtml(r.nickName)}</td><td>${escapeHtml(r.grade)}</td><td>${escapeHtml(r.id)}</td><td>${escapeHtml(studentNoteValue(r, 'private') ? 'Yes' : '')}</td><td>${escapeHtml(studentNoteValue(r, 'substitute') ? 'Yes' : '')}</td><td>${escapeHtml(studentNoteValue(r, 'public') ? 'Yes' : '')}</td></tr>`).join('')}</tbody></table>`;
}


const PRINT_PAPER_SPECS = Object.freeze({
  letter: Object.freeze([612, 792]),
  legal: Object.freeze([612, 1008]),
  a4: Object.freeze([595.28, 841.89])
});

const PRINT_TYPE_PALETTE = Object.freeze({
  empty: Object.freeze({ fill: '#fbfcff', stroke: '#c9d3e3', text: '#475569' }),
  seat: Object.freeze({ fill: '#dbeafe', stroke: '#9db7ef', text: '#14213d' }),
  blocked: Object.freeze({ fill: '#313846', stroke: '#222a36', text: '#ffffff' }),
  teacher: Object.freeze({ fill: '#fff3d6', stroke: '#ffd074', text: '#58491f' }),
  table: Object.freeze({ fill: '#e8f7ec', stroke: '#9ce0b2', text: '#166534' }),
  door: Object.freeze({ fill: '#fce8ee', stroke: '#f6a3bb', text: '#9f1239' }),
  wall: Object.freeze({ fill: '#d9dee8', stroke: '#9aa7b8', text: '#344054' }),
  walkway: Object.freeze({ fill: '#ffffff', stroke: '#aab7c8', text: '#475467' }),
  window: Object.freeze({ fill: '#e0f2fe', stroke: '#7dd3fc', text: '#075985' }),
  projector: Object.freeze({ fill: '#eef2ff', stroke: '#a5b4fc', text: '#3730a3' }),
  board: Object.freeze({ fill: '#dcfce7', stroke: '#86efac', text: '#166534' }),
  carpet: Object.freeze({ fill: '#f5e8d3', stroke: '#d6a45f', text: '#7c4a03' }),
  ada: Object.freeze({ fill: '#ecfeff', stroke: '#67e8f9', text: '#155e75' }),
  custom: Object.freeze({ fill: '#eef2f7', stroke: '#b9c4d3', text: '#334155' })
});

function printPaperSpec() {
  const canvas = state.freeformLayout?.canvas || {};
  const key = state.layoutMode === 'freeform' && PRINT_PAPER_SPECS[canvas.printPageSize] ? canvas.printPageSize : 'letter';
  let [width, height] = PRINT_PAPER_SPECS[key] || PRINT_PAPER_SPECS.letter;
  const orientation = state.layoutMode === 'freeform' ? canvas.printOrientation : 'landscape';
  if (orientation === 'landscape') [width, height] = [height, width];
  const marginInches = state.layoutMode === 'freeform' ? clampNumber(canvas.printMargin ?? 0.35, 0, 1.5) : 0.35;
  return { width, height, margin: Math.max(12, marginInches * 72), key, orientation };
}

function printPaletteForType(type, mode = 'seen', explicitColor = '') {
  const normalized = String(type || 'empty').toLowerCase();
  const base = PRINT_TYPE_PALETTE[normalized] || PRINT_TYPE_PALETTE.custom;
  if (mode === 'clean' || mode === 'substitute') {
    return normalized === 'seat'
      ? { fill: '#ffffff', stroke: '#94a3b8', text: '#111827' }
      : { fill: normalized === 'empty' ? '#ffffff' : '#f3f4f6', stroke: '#94a3b8', text: '#111827' };
  }
  return { ...base, fill: explicitColor ? safeColor(explicitColor, base.fill) : base.fill };
}

function printStudentTextLines(student, options = currentPrintOptions()) {
  if (!student) return [];
  const details = options.details || {};
  const nameParts = [];
  if (details.nickName && String(student.nickName || '').trim()) nameParts.push(String(student.nickName).trim());
  const formal = [];
  if (details.firstName && String(student.firstName || '').trim()) formal.push(String(student.firstName).trim());
  if (details.lastName && String(student.lastName || '').trim()) formal.push(String(student.lastName).trim());
  if (formal.length) nameParts.push(formal.join(' '));
  const lines = [nameParts.join(nameParts.length > 1 ? ' / ' : '') || studentDisplay(student)];
  const meta = [];
  if (details.grade && String(student.grade || '').trim()) meta.push(`Grade ${student.grade}`);
  if (details.id && String(student.id || '').trim()) meta.push(`ID ${student.id}`);
  if (meta.length) lines.push(meta.join(' · '));
  return lines;
}

function printTextWidth(text, fontSize = 10, bold = false) {
  return String(text || '').length * fontSize * (bold ? 0.59 : 0.53);
}

function wrapPrintText(text, maxWidth, fontSize = 10, maxLines = 4) {
  const value = String(text || '').trim();
  if (!value) return [];
  const words = value.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || printTextWidth(candidate, fontSize) <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    let last = lines.at(-1);
    while (last.length > 1 && printTextWidth(`${last}…`, fontSize) > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function createPrintVectorPage(spec, title, subtitle = '') {
  const page = { width: spec.width, height: spec.height, commands: [], title };
  page.commands.push({ type: 'rect', x: 0, y: 0, width: spec.width, height: spec.height, fill: '#ffffff', stroke: 'none' });
  if (title) page.commands.push({ type: 'text', x: spec.margin, y: spec.margin + 18, text: title, size: 18, weight: 700, color: '#172033' });
  if (subtitle) page.commands.push({ type: 'text', x: spec.margin, y: spec.margin + 36, text: subtitle, size: 8.5, weight: 500, color: '#607089' });
  return page;
}

function printGroupColorsForSeat(studentId, anchorGroupIds = []) {
  const ids = new Set((anchorGroupIds || []).map(String));
  (state.groups || []).forEach(group => {
    if ((group.studentIds || []).map(String).includes(String(studentId || ''))) ids.add(String(group.id));
  });
  return [...ids].map(id => (state.groups || []).find(group => String(group.id) === id)).filter(Boolean).map(group => safeColor(group.color, '#2f6fed'));
}

function printZoneLabels(zoneIds = []) {
  const ids = new Set((zoneIds || []).map(String));
  return [...ids].map(id => (state.zones || []).find(zone => String(zone.id) === id)).filter(Boolean);
}

function addPrintTextBlock(page, lines, bounds, options = {}) {
  const fontSize = Number(options.fontSize || 10);
  const lineHeight = Number(options.lineHeight || fontSize * 1.25);
  const allLines = [];
  (lines || []).forEach((line, index) => {
    const wrapped = wrapPrintText(line, bounds.width, index === 0 ? fontSize : Math.max(7, fontSize - 1), index === 0 ? 3 : 2);
    allLines.push(...wrapped.map(text => ({ text, primary: index === 0 })));
  });
  const height = allLines.length * lineHeight;
  const startY = bounds.y + Math.max(lineHeight, (bounds.height - height) / 2 + lineHeight * 0.82);
  allLines.forEach((line, index) => page.commands.push({
    type: 'text',
    x: bounds.x + bounds.width / 2,
    y: startY + index * lineHeight,
    text: line.text,
    size: line.primary ? fontSize : Math.max(7, fontSize - 1.2),
    weight: line.primary ? 700 : 600,
    color: options.color || '#172033',
    align: 'center',
    rotation: options.rotation || 0,
    rotationCenterX: options.rotationCenterX,
    rotationCenterY: options.rotationCenterY
  }));
}

function printGridContentBounds(options = currentPrintOptions()) {
  const full = { minRow: 1, maxRow: Math.max(1, Number(state.rows) || 1), minCol: 1, maxCol: Math.max(1, Number(state.cols) || 1), cropped: false };
  if (!options.framing?.cropToContent) return full;
  const occupied = Object.values(state.cells || {}).filter(cell => {
    if (!cell) return false;
    const type = String(cell.type || 'empty');
    return type !== 'empty'
      || Boolean(cell.assignedStudentId)
      || Boolean((cell.anchorGroupIds || []).length)
      || Boolean((cell.zoneIds || []).length);
  });
  if (!occupied.length) return full;
  const rows = occupied.map(cell => clampNumber(cell.row, 1, full.maxRow));
  const cols = occupied.map(cell => clampNumber(cell.col, 1, full.maxCol));
  return {
    minRow: Math.min(...rows),
    maxRow: Math.max(...rows),
    minCol: Math.min(...cols),
    maxCol: Math.max(...cols),
    cropped: true
  };
}

function buildGridPrintPage(options, spec) {
  const bounds = printGridContentBounds(options);
  const visibleRows = bounds.maxRow - bounds.minRow + 1;
  const visibleCols = bounds.maxCol - bounds.minCol + 1;
  const title = printChartMetaLine(options) || 'Seating Chart';
  const cropText = bounds.cropped ? ` · cropped from ${state.rows} × ${state.cols}` : '';
  const subtitle = `${visibleRows} × ${visibleCols} Grid${cropText} · ${state.students.length} students`;
  const page = createPrintVectorPage(spec, title, subtitle);
  const top = spec.margin + 52;
  const footer = 18;
  const contentWidth = spec.width - spec.margin * 2;
  const contentHeight = spec.height - top - spec.margin - footer;
  const sourceCellWidth = 112;
  const sourceCellHeight = 133;
  const gap = 7;
  const sourceWidth = visibleCols * sourceCellWidth + Math.max(0, visibleCols - 1) * gap;
  const sourceHeight = visibleRows * sourceCellHeight + Math.max(0, visibleRows - 1) * gap;
  const scaleLimit = bounds.cropped ? Number.POSITIVE_INFINITY : 1.35;
  const scale = Math.min(contentWidth / Math.max(1, sourceWidth), contentHeight / Math.max(1, sourceHeight), scaleLimit);
  const roomWidth = sourceWidth * scale;
  const roomHeight = sourceHeight * scale;
  const originX = spec.margin + (contentWidth - roomWidth) / 2;
  const originY = top + (contentHeight - roomHeight) / 2;
  const labelSize = Math.max(5.5, Math.min(bounds.cropped ? 12 : 9, 8 * scale));
  const nameSize = Math.max(6.5, Math.min(bounds.cropped ? 18 : 12, 10.5 * scale));
  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
      const cell = state.cells[keyOf(row, col)] || { row, col, type: 'empty' };
      const type = String(cell.type || 'empty');
      const palette = printPaletteForType(type, options.mode);
      const x = originX + (col - bounds.minCol) * (sourceCellWidth + gap) * scale;
      const y = originY + (row - bounds.minRow) * (sourceCellHeight + gap) * scale;
      const width = sourceCellWidth * scale;
      const height = sourceCellHeight * scale;
      page.commands.push({ type: 'rect', x, y, width, height, radius: Math.min(12, 11 * scale), fill: palette.fill, stroke: palette.stroke, lineWidth: Math.max(0.7, Math.min(2.5, scale)) });
      const student = getStudent(cell.assignedStudentId);
      if (options.mode === 'seen') {
        page.commands.push({ type: 'text', x: x + 5 * scale, y: y + 12 * scale, text: `${row},${col}`, size: labelSize, weight: 700, color: palette.text });
        page.commands.push({ type: 'text', x: x + width - 5 * scale, y: y + 12 * scale, text: objectLabel(type), size: labelSize, weight: 700, color: palette.text, align: 'right' });
        const colors = printGroupColorsForSeat(student?.id, cell.anchorGroupIds).slice(0, 5);
        if (colors.length) {
          const stripeWidth = (width - 8 * scale) / colors.length;
          colors.forEach((color, index) => page.commands.push({ type: 'rect', x: x + 4 * scale + index * stripeWidth, y: y + 3 * scale, width: stripeWidth, height: Math.max(2, Math.min(9, 4 * scale)), fill: color, stroke: 'none' }));
        }
      }
      const lines = student
        ? printStudentTextLines(student, options)
        : type === 'seat'
          ? (options.mode === 'seen' ? ['Unassigned'] : [])
          : [String(cell.label || objectLabel(type))];
      addPrintTextBlock(page, lines, { x: x + 7 * scale, y: y + 20 * scale, width: width - 14 * scale, height: height - 32 * scale }, { fontSize: nameSize, color: palette.text });
      if (options.mode === 'seen') {
        const zones = printZoneLabels(cell.zoneIds).slice(0, 2);
        zones.forEach((zone, index) => {
          const badgeWidth = Math.min(width - 8 * scale, Math.max(24 * scale, printTextWidth(zone.name, labelSize) + 12 * scale));
          const badgeX = x + 4 * scale + index * (badgeWidth + 3 * scale);
          if (badgeX + badgeWidth > x + width - 3 * scale) return;
          page.commands.push({ type: 'rect', x: badgeX, y: y + height - 13 * scale, width: badgeWidth, height: 9 * scale, radius: 5 * scale, fill: '#ffffff', stroke: safeColor(zone.color, '#8b5cf6'), lineWidth: 0.8 });
          page.commands.push({ type: 'text', x: badgeX + badgeWidth / 2, y: y + height - 6.3 * scale, text: zone.name, size: Math.max(5.2, labelSize - 1), weight: 700, color: '#334155', align: 'center' });
        });
      }
    }
  }
  page.commands.push({ type: 'text', x: spec.width - spec.margin, y: spec.height - 10, text: bounds.cropped ? 'Cropped to occupied content · fit to page' : 'Classroom Seating Planner', size: 7, color: '#94a3b8', align: 'right' });
  return [page];
}

function printFreeformObjectBounds(object) {
  const width = Math.max(1, Number(object.width) || (object.type === 'seat' ? DEFAULT_FREEFORM_SEAT_WIDTH : 160));
  const height = Math.max(1, Number(object.height) || (object.type === 'seat' ? DEFAULT_FREEFORM_SEAT_HEIGHT : 96));
  const angle = Math.abs((Number(object.rotation) || 0) * Math.PI / 180);
  const rotatedWidth = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle));
  const rotatedHeight = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
  const centerX = (Number(object.x) || 0) + width / 2;
  const centerY = (Number(object.y) || 0) + height / 2;
  return { left: centerX - rotatedWidth / 2, top: centerY - rotatedHeight / 2, right: centerX + rotatedWidth / 2, bottom: centerY + rotatedHeight / 2 };
}

function freeformObjectIntersectsTile(object, tile) {
  const bounds = printFreeformObjectBounds(object);
  return bounds.right >= tile.x && bounds.left <= tile.x + tile.width && bounds.bottom >= tile.y && bounds.top <= tile.y + tile.height;
}

function printFreeformContentBounds(canvas, objects = [], cropToContent = false) {
  const canvasWidth = Math.max(1, Number(canvas?.width) || 1200);
  const canvasHeight = Math.max(1, Number(canvas?.height) || 760);
  const full = { x: 0, y: 0, width: canvasWidth, height: canvasHeight, cropped: false };
  if (!cropToContent || !objects.length) return full;
  const bounds = objects.map(printFreeformObjectBounds);
  const padding = Math.max(16, Number(canvas?.gridSize) || 20);
  const left = Math.max(0, Math.min(...bounds.map(item => item.left)) - padding);
  const top = Math.max(0, Math.min(...bounds.map(item => item.top)) - padding);
  const right = Math.min(canvasWidth, Math.max(...bounds.map(item => item.right)) + padding);
  const bottom = Math.min(canvasHeight, Math.max(...bounds.map(item => item.bottom)) + padding);
  if (!(right > left && bottom > top)) return full;
  return { x: left, y: top, width: right - left, height: bottom - top, cropped: true };
}

function addFreeformFrontMarker(page, canvas, tile, transform, roomBounds = null) {
  const side = ['top', 'right', 'bottom', 'left'].includes(String(canvas.frontSide || '').toLowerCase()) ? String(canvas.frontSide).toLowerCase() : 'top';
  const bounds = roomBounds || { x: 0, y: 0, width: canvas.width, height: canvas.height };
  const inset = Math.min(12, Math.max(4, Math.min(bounds.width, bounds.height) * 0.04));
  const source = side === 'top' ? { x: bounds.x + bounds.width / 2, y: bounds.y + inset, rotation: 0 }
    : side === 'bottom' ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height - inset, rotation: 0 }
      : side === 'left' ? { x: bounds.x + inset, y: bounds.y + bounds.height / 2, rotation: -90 }
        : { x: bounds.x + bounds.width - inset, y: bounds.y + bounds.height / 2, rotation: 90 };
  if (source.x < tile.x || source.x > tile.x + tile.width || source.y < tile.y || source.y > tile.y + tile.height) return;
  const x = transform.x + (source.x - tile.x) * transform.scale;
  const y = transform.y + (source.y - tile.y) * transform.scale;
  page.commands.push({ type: 'rect', x: x - 42, y: y - 9, width: 84, height: 18, radius: 9, fill: '#ffffff', stroke: '#93c5fd', lineWidth: 0.8, rotation: source.rotation, rotationCenterX: x, rotationCenterY: y });
  page.commands.push({ type: 'text', x, y: y + 3, text: 'FRONT OF ROOM', size: 7.5, weight: 700, color: '#1d4ed8', align: 'center', rotation: source.rotation, rotationCenterX: x, rotationCenterY: y });
}

function addFreeformGrid(page, canvas, tile, transform, options) {
  const x = transform.x;
  const y = transform.y;
  const width = tile.width * transform.scale;
  const height = tile.height * transform.scale;
  page.commands.push({ type: 'rect', x, y, width, height, fill: options.mode === 'seen' ? '#f8fafc' : '#ffffff', stroke: '#94a3b8', lineWidth: 0.9 });
  if (options.mode !== 'seen') return;
  const grid = Math.max(5, Number(canvas.gridSize) || 20);
  const firstX = Math.ceil(tile.x / grid) * grid;
  const firstY = Math.ceil(tile.y / grid) * grid;
  let lines = 0;
  for (let sourceX = firstX; sourceX < tile.x + tile.width && lines < 220; sourceX += grid, lines += 1) {
    const px = x + (sourceX - tile.x) * transform.scale;
    page.commands.push({ type: 'line', x1: px, y1: y, x2: px, y2: y + height, stroke: '#dbe3ef', lineWidth: 0.35 });
  }
  for (let sourceY = firstY; sourceY < tile.y + tile.height && lines < 440; sourceY += grid, lines += 1) {
    const py = y + (sourceY - tile.y) * transform.scale;
    page.commands.push({ type: 'line', x1: x, y1: py, x2: x + width, y2: py, stroke: '#dbe3ef', lineWidth: 0.35 });
  }
}

function addFreeformObjectToPage(page, object, tile, transform, options) {
  const type = String(object.type || 'custom');
  const student = getStudent(object.assignedStudentId);
  const sourceWidth = Math.max(1, Number(object.width) || (type === 'seat' ? DEFAULT_FREEFORM_SEAT_WIDTH : 160));
  const sourceHeight = Math.max(1, Number(object.height) || (type === 'seat' ? DEFAULT_FREEFORM_SEAT_HEIGHT : 96));
  const width = sourceWidth * transform.scale;
  const height = sourceHeight * transform.scale;
  const x = transform.x + ((Number(object.x) || 0) - tile.x) * transform.scale;
  const y = transform.y + ((Number(object.y) || 0) - tile.y) * transform.scale;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const rotation = Number(object.rotation) || 0;
  const palette = printPaletteForType(type, options.mode, options.mode === 'seen' ? object.color : '');
  const groupColors = printGroupColorsForSeat(student?.id, object.anchorGroupIds);
  const borderColor = options.mode === 'seen' && groupColors.length ? groupColors[0] : palette.stroke;
  page.commands.push({
    type: 'rect', x, y, width, height, radius: Math.min(12, 16 * transform.scale), fill: palette.fill, stroke: borderColor,
    lineWidth: Math.max(0.8, groupColors.length ? 2.2 : 1), dash: object.locked ? [4, 3] : null,
    rotation, rotationCenterX: centerX, rotationCenterY: centerY
  });
  const lines = student
    ? printStudentTextLines(student, options)
    : [type === 'seat' ? 'Unassigned' : String(object.label || objectLabel(type))];
  const labelSpace = type === 'seat' ? height - 24 * transform.scale : height - 18 * transform.scale;
  addPrintTextBlock(page, lines, { x: x + 8 * transform.scale, y: y + 6 * transform.scale, width: width - 16 * transform.scale, height: Math.max(18, labelSpace) }, {
    fontSize: Math.max(6.5, Math.min(12, 11 * transform.scale)), color: palette.text, rotation, rotationCenterX: centerX, rotationCenterY: centerY
  });
  const objectMeta = type === 'seat' ? (String(object.label || '').trim() && !/^seat$/i.test(object.label) ? object.label : 'Seat') : objectLabel(type);
  page.commands.push({ type: 'text', x: centerX, y: y + height - Math.max(5, 8 * transform.scale), text: objectMeta, size: Math.max(5.3, Math.min(8, 7 * transform.scale)), weight: 600, color: palette.text, align: 'center', rotation, rotationCenterX: centerX, rotationCenterY: centerY });
}

function buildFreeformPrintPages(options, spec, renderOptions = {}) {
  const canvas = state.freeformLayout?.canvas || {};
  const objects = [...(state.freeformLayout?.objects || [])]
    .sort((a, b) => Number(a.zIndex || 1) - Number(b.zIndex || 1));
  const cropToContent = Boolean(options.framing?.cropToContent);
  const roomBounds = printFreeformContentBounds(canvas, objects, cropToContent);
  const canvasWidth = roomBounds.width;
  const canvasHeight = roomBounds.height;
  const top = spec.margin + 52;
  const footer = 18;
  const contentWidth = spec.width - spec.margin * 2;
  const contentHeight = spec.height - top - spec.margin - footer;
  const mode = renderOptions.forceFreeformFit || cropToContent ? 'fit' : (canvas.printScaleMode || 'tile');
  const actualScale = 72 / 96;
  let sourcePerPageWidth = contentWidth / actualScale;
  let sourcePerPageHeight = contentHeight / actualScale;
  let columns = Math.max(1, Math.ceil(canvasWidth / sourcePerPageWidth));
  let rows = Math.max(1, Math.ceil(canvasHeight / sourcePerPageHeight));
  let fit = mode === 'fit';
  if (!fit && columns * rows > 64) fit = true;
  if (fit) {
    columns = 1;
    rows = 1;
    sourcePerPageWidth = canvasWidth;
    sourcePerPageHeight = canvasHeight;
  }
  const pages = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const tile = {
        x: roomBounds.x + col * sourcePerPageWidth,
        y: roomBounds.y + row * sourcePerPageHeight,
        width: Math.min(sourcePerPageWidth, canvasWidth - col * sourcePerPageWidth),
        height: Math.min(sourcePerPageHeight, canvasHeight - row * sourcePerPageHeight)
      };
      const title = printChartMetaLine(options) || 'Seating Chart';
      const tileText = rows * columns > 1 ? ` · Page ${row + 1}.${col + 1} of ${rows}.${columns}` : '';
      const cropText = roomBounds.cropped ? ` · cropped from ${Math.round(Number(canvas.width) || 1200)} × ${Math.round(Number(canvas.height) || 760)} px` : '';
      const subtitle = `Freeform room ${Math.round(canvasWidth)} × ${Math.round(canvasHeight)} px${cropText}${tileText}`;
      const page = createPrintVectorPage(spec, title, subtitle);
      const scale = fit
        ? Math.min(contentWidth / canvasWidth, contentHeight / canvasHeight)
        : actualScale;
      const roomWidth = tile.width * scale;
      const roomHeight = tile.height * scale;
      const transform = {
        scale,
        x: spec.margin + (contentWidth - roomWidth) / 2,
        y: top + (contentHeight - roomHeight) / 2
      };
      page.commands.push({ type: 'clipStart', x: transform.x, y: transform.y, width: roomWidth, height: roomHeight });
      addFreeformGrid(page, canvas, tile, transform, options);
      addFreeformFrontMarker(page, { ...canvas, width: Number(canvas.width) || 1200, height: Number(canvas.height) || 760 }, tile, transform, roomBounds);
      objects
        .filter(object => freeformObjectIntersectsTile(object, tile))
        .forEach(object => addFreeformObjectToPage(page, object, tile, transform, options));
      page.commands.push({ type: 'clipEnd' });
      const footerText = roomBounds.cropped
        ? 'Cropped to occupied content · fit to page'
        : fit ? 'Fit to page' : `${mode === 'actual' ? 'Actual size' : 'Tiled'} · ${row + 1}.${col + 1}`;
      page.commands.push({ type: 'text', x: spec.width - spec.margin, y: spec.height - 10, text: footerText, size: 7, color: '#94a3b8', align: 'right' });
      pages.push(page);
    }
  }
  return pages;
}

function printableGroupRows(options) {
  if (!options.sections?.groups) return [];
  const config = options.groupConfig || defaultPrintOptions().groupConfig;
  const zoneMap = new Map((state.zones || []).map(zone => [String(zone.id), zone]));
  const studentMap = new Map((state.students || []).map(student => [String(student.id), student]));
  return [...(state.groups || [])].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)).map(group => {
    const details = [];
    if (config.rule) details.push(`Rule: ${GROUP_TYPE_LABELS[group.type] || group.type || 'Rule'}`);
    if (config.priority) details.push(`Priority: ${Number(group.priority || 1)}`);
    if (config.zone) details.push(`Preferred zone: ${group.zoneId ? (zoneMap.get(String(group.zoneId))?.name || group.zoneId) : 'None'}`);
    if (config.members) details.push(`Members: ${joinedList((group.studentIds || []).map(id => studentMap.get(String(id))).filter(Boolean).map(studentDisplay))}`);
    if (config.reservedSeats) details.push(`Reserved seats: ${joinedList((group.anchorSeats || []).map(cellLocationLabel))}`);
    return { title: group.name || 'Group', color: config.color ? safeColor(group.color, '#2f6fed') : '', details };
  });
}

function printableZoneRows(options) {
  if (!options.sections?.zones) return [];
  const config = options.zoneConfig || defaultPrintOptions().zoneConfig;
  const studentMap = new Map((state.students || []).map(student => [String(student.id), student]));
  const groupMap = new Map((state.groups || []).map(group => [String(group.id), group]));
  return [...(state.zones || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))).map(zone => {
    const seatKeys = Object.entries(state.cells || {}).filter(([, cell]) => (cell.zoneIds || []).map(String).includes(String(zone.id))).map(([key]) => cellLocationLabel(key));
    const studentIds = new Set((zone.studentIds || []).map(String));
    const groupIds = new Set((zone.groupIds || []).map(String));
    Object.values(state.cells || {}).forEach(cell => {
      if (!(cell.zoneIds || []).map(String).includes(String(zone.id))) return;
      if (cell.assignedStudentId) studentIds.add(String(cell.assignedStudentId));
    });
    (state.groups || []).forEach(group => { if (String(group.zoneId || '') === String(zone.id)) groupIds.add(String(group.id)); });
    const details = [];
    if (config.students) details.push(`Linked students: ${joinedList([...studentIds].map(id => studentMap.get(id)).filter(Boolean).map(studentDisplay))}`);
    if (config.groups) details.push(`Linked groups: ${joinedList([...groupIds].map(id => groupMap.get(id)).filter(Boolean).map(group => group.name))}`);
    if (config.seats) details.push(`Assigned seats: ${joinedList(seatKeys)}`);
    return { title: zone.name || 'Zone', color: config.color ? safeColor(zone.color, '#8b5cf6') : '', details };
  });
}

function printableNoteRows(options) {
  const categories = ['private', 'substitute', 'public'].filter(category => options.notes?.[category]);
  if (!categories.length) return [];
  return printableNotesForCurrentMode(options).map(item => ({
    title: studentDisplay(item.student),
    color: '',
    details: item.notes.map(note => `${noteCategoryLabel(note.category)}: ${note.text}`)
  }));
}

function addPrintableCardsToPages(pages, spec, heading, rows) {
  if (!rows.length) return;
  const top = spec.margin + 48;
  const bottom = spec.height - spec.margin;
  let page = createPrintVectorPage(spec, heading, `${rows.length} item${rows.length === 1 ? '' : 's'}`);
  let y = top;
  const pushPage = () => { pages.push(page); page = createPrintVectorPage(spec, heading, `${rows.length} item${rows.length === 1 ? '' : 's'} · continued`); y = top; };
  rows.forEach(row => {
    const detailLines = [];
    (row.details || []).forEach(detail => detailLines.push(...wrapPrintText(detail, spec.width - spec.margin * 2 - 24, 8.5, 6)));
    const cardHeight = Math.max(44, 28 + detailLines.length * 12);
    if (y + cardHeight > bottom && y > top) pushPage();
    page.commands.push({ type: 'rect', x: spec.margin, y, width: spec.width - spec.margin * 2, height: cardHeight, radius: 7, fill: '#f8fafc', stroke: '#cbd5e1', lineWidth: 0.8 });
    if (row.color) page.commands.push({ type: 'rect', x: spec.margin + 8, y: y + 9, width: 10, height: 10, radius: 5, fill: row.color, stroke: '#64748b', lineWidth: 0.5 });
    page.commands.push({ type: 'text', x: spec.margin + (row.color ? 24 : 10), y: y + 17, text: row.title, size: 10, weight: 700, color: '#172033' });
    detailLines.forEach((line, index) => page.commands.push({ type: 'text', x: spec.margin + 10, y: y + 34 + index * 12, text: line, size: 8.5, weight: 500, color: '#475569' }));
    y += cardHeight + 8;
  });
  pages.push(page);
}

function buildPrintVectorPages(options = currentPrintOptions(), renderOptions = {}) {
  const normalized = { ...defaultPrintOptions(), ...options };
  normalized.details = { ...defaultPrintOptions().details, ...(options.details || {}) };
  normalized.chartDetails = { ...defaultPrintOptions().chartDetails, ...(options.chartDetails || {}) };
  normalized.notes = { ...defaultPrintOptions().notes, ...(options.notes || {}) };
  normalized.sections = { ...defaultPrintOptions().sections, ...(options.sections || {}) };
  normalized.framing = { ...defaultPrintOptions().framing, ...(options.framing || {}) };
  normalized.groupConfig = { ...defaultPrintOptions().groupConfig, ...(options.groupConfig || {}) };
  normalized.zoneConfig = { ...defaultPrintOptions().zoneConfig, ...(options.zoneConfig || {}) };
  const spec = printPaperSpec();
  const pages = state.layoutMode === 'freeform' ? buildFreeformPrintPages(normalized, spec, renderOptions) : buildGridPrintPage(normalized, spec);
  addPrintableCardsToPages(pages, spec, noteCategoryTitle(['private', 'substitute', 'public'].filter(category => normalized.notes[category])), printableNoteRows(normalized));
  addPrintableCardsToPages(pages, spec, 'Group and Rule Configuration', printableGroupRows(normalized));
  addPrintableCardsToPages(pages, spec, 'Zone Configuration', printableZoneRows(normalized));
  return pages;
}

function svgEscapeText(value) {
  return escapeHtml(String(value ?? ''));
}

function svgCommandMarkup(command, pageIndex, commandIndex) {
  const stroke = command.stroke && command.stroke !== 'none' ? ` stroke="${svgEscapeText(command.stroke)}" stroke-width="${Number(command.lineWidth || 1)}"` : ' stroke="none"';
  const fill = command.fill && command.fill !== 'none' ? svgEscapeText(command.fill) : 'none';
  const dash = Array.isArray(command.dash) ? ` stroke-dasharray="${command.dash.join(' ')}"` : '';
  const opacity = Number.isFinite(Number(command.opacity)) ? ` opacity="${Number(command.opacity)}"` : '';
  const rotation = Number(command.rotation || 0);
  const transform = rotation ? ` transform="rotate(${rotation} ${Number(command.rotationCenterX ?? command.x ?? 0)} ${Number(command.rotationCenterY ?? command.y ?? 0)})"` : '';
  if (command.type === 'clipStart') return `<defs><clipPath id="printClip-${pageIndex}-${commandIndex}"><rect x="${command.x}" y="${command.y}" width="${command.width}" height="${command.height}"/></clipPath></defs><g clip-path="url(#printClip-${pageIndex}-${commandIndex})">`;
  if (command.type === 'clipEnd') return '</g>';
  if (command.type === 'rect') return `<rect x="${command.x}" y="${command.y}" width="${command.width}" height="${command.height}" rx="${Number(command.radius || 0)}" fill="${fill}"${stroke}${dash}${opacity}${transform}/>`;
  if (command.type === 'line') return `<line x1="${command.x1}" y1="${command.y1}" x2="${command.x2}" y2="${command.y2}" stroke="${svgEscapeText(command.stroke || '#000000')}" stroke-width="${Number(command.lineWidth || 1)}"${dash}${opacity}${transform}/>`;
  if (command.type === 'text') {
    const anchor = command.align === 'center' ? 'middle' : command.align === 'right' ? 'end' : 'start';
    return `<text x="${command.x}" y="${command.y}" fill="${svgEscapeText(command.color || '#172033')}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="${Number(command.size || 10)}" font-weight="${Number(command.weight || 500)}" text-anchor="${anchor}"${opacity}${transform}>${svgEscapeText(command.text)}</text>`;
  }
  return '';
}

function buildPrintSvgDocument(options = currentPrintOptions(), pages = buildPrintVectorPages(options)) {
  const gap = 24;
  const outer = 18;
  const maxWidth = Math.max(...pages.map(page => page.width), 1);
  const totalHeight = pages.reduce((sum, page) => sum + page.height, 0) + gap * Math.max(0, pages.length - 1) + outer * 2;
  const width = maxWidth + outer * 2;
  let y = outer;
  const markup = pages.map((page, pageIndex) => {
    const commands = page.commands.map((command, commandIndex) => svgCommandMarkup(command, pageIndex, commandIndex)).join('');
    const result = `<g transform="translate(${outer + (maxWidth - page.width) / 2} ${y})"><rect x="-1" y="-1" width="${page.width + 2}" height="${page.height + 2}" rx="4" fill="#ffffff" stroke="#cbd5e1"/>${commands}</g>`;
    y += page.height + gap;
    return result;
  }).join('');
  const title = printChartMetaLine(options) || 'Seating Chart';
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}" role="img" aria-label="${svgEscapeText(title)}"><rect width="100%" height="100%" fill="#eef2f7"/>${markup}</svg>`;
}

function pdfNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function pdfColorOperators(color, stroke = false) {
  const value = String(color || '#000000').trim();
  const match = value.match(/^#([0-9a-f]{6})$/i);
  if (!match) return stroke ? '0 0 0 RG' : '0 0 0 rg';
  const hex = match[1];
  const values = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(pdfNumber);
  return `${values.join(' ')} ${stroke ? 'RG' : 'rg'}`;
}

function pdfSafeText(value) {
  return String(value ?? '')
    .replace(/×/g, 'x')
    .replace(/[·•]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/[\\()]/g, '\\$&');
}

function pdfRotationMatrix(command) {
  const angle = Number(command.rotation || 0) * Math.PI / 180;
  if (!angle) return '';
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = Number(command.rotationCenterX ?? command.x ?? 0);
  const cy = Number(command.rotationCenterY ?? command.y ?? 0);
  const e = cx - cos * cx + sin * cy;
  const f = cy - sin * cx - cos * cy;
  return `${pdfNumber(cos)} ${pdfNumber(sin)} ${pdfNumber(-sin)} ${pdfNumber(cos)} ${pdfNumber(e)} ${pdfNumber(f)} cm`;
}

function pdfCommandStream(command) {
  if (command.type === 'clipStart') return `q ${pdfNumber(command.x)} ${pdfNumber(command.y)} ${pdfNumber(command.width)} ${pdfNumber(command.height)} re W n\n`;
  if (command.type === 'clipEnd') return 'Q\n';
  const rotation = pdfRotationMatrix(command);
  const start = rotation ? `q ${rotation}\n` : '';
  const end = rotation ? 'Q\n' : '';
  if (command.type === 'rect') {
    const fill = command.fill && command.fill !== 'none';
    const stroke = command.stroke && command.stroke !== 'none';
    const paint = fill && stroke ? 'B' : fill ? 'f' : stroke ? 'S' : 'n';
    const dash = Array.isArray(command.dash) ? `[${command.dash.map(pdfNumber).join(' ')}] 0 d` : '[] 0 d';
    return `${start}${fill ? `${pdfColorOperators(command.fill)}\n` : ''}${stroke ? `${pdfColorOperators(command.stroke, true)} ${pdfNumber(command.lineWidth || 1)} w ${dash}\n` : ''}${pdfNumber(command.x)} ${pdfNumber(command.y)} ${pdfNumber(command.width)} ${pdfNumber(command.height)} re ${paint}\n${end}`;
  }
  if (command.type === 'line') return `${start}${pdfColorOperators(command.stroke || '#000000', true)} ${pdfNumber(command.lineWidth || 1)} w ${pdfNumber(command.x1)} ${pdfNumber(command.y1)} m ${pdfNumber(command.x2)} ${pdfNumber(command.y2)} l S\n${end}`;
  if (command.type === 'text') {
    const font = Number(command.weight || 500) >= 650 ? '/F2' : '/F1';
    const size = Number(command.size || 10);
    let x = Number(command.x || 0);
    if (command.align === 'center') x -= printTextWidth(command.text, size, font === '/F2') / 2;
    else if (command.align === 'right') x -= printTextWidth(command.text, size, font === '/F2');
    return `${start}BT ${font} ${pdfNumber(size)} Tf ${pdfColorOperators(command.color || '#172033')} 1 0 0 -1 ${pdfNumber(x)} ${pdfNumber(command.y)} Tm (${pdfSafeText(command.text)}) Tj ET\n${end}`;
  }
  return '';
}

function buildPrintPdfDocument(options = currentPrintOptions(), pages = buildPrintVectorPages(options, { forceFreeformFit: true })) {
  const objects = new Map();
  const setObject = (id, body) => objects.set(id, body);
  const pageObjectIds = [];
  let nextId = 5;
  pages.forEach(page => {
    const pageId = nextId++;
    const contentId = nextId++;
    pageObjectIds.push(pageId);
    const stream = `q 1 0 0 -1 0 ${pdfNumber(page.height)} cm\n${page.commands.map(pdfCommandStream).join('')}Q\n`;
    setObject(contentId, `<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    setObject(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfNumber(page.width)} ${pdfNumber(page.height)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
  });
  setObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  setObject(2, `<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`);
  setObject(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  setObject(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const maxId = Math.max(...objects.keys());
  let pdf = '%PDF-1.4\n% CSP vector print export\n';
  const offsets = Array(maxId + 1).fill(0);
  for (let id = 1; id <= maxId; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function exportChartSvgCore(options = readPrintOptionsFromModal()) {
  const pages = buildPrintVectorPages(options);
  const svg = buildPrintSvgDocument(options, pages);
  downloadText(`seating-chart-${new Date().toISOString().slice(0,10)}.svg`, svg, 'image/svg+xml');
  setLiveStatusMessage(`SVG exported with the selected print options across ${pages.length} page${pages.length === 1 ? '' : 's'}.${options.framing?.cropToContent ? ' The room chart was cropped to occupied content and enlarged to fill one page.' : ''}`);
}

function exportChartPdfCore(options = readPrintOptionsFromModal()) {
  const pages = buildPrintVectorPages(options, { forceFreeformFit: true });
  const pdf = buildPrintPdfDocument(options, pages);
  const blob = new Blob([pdf], { type: 'application/pdf' });
  triggerBlobDownload(`seating-chart-${new Date().toISOString().slice(0,10)}.pdf`, blob);
  setLiveStatusMessage(`PDF exported with the selected print options across ${pages.length} page${pages.length === 1 ? '' : 's'}. ${options.framing?.cropToContent ? 'The room chart was cropped to occupied content and enlarged to fill one page.' : 'Freeform room layouts are fit onto one chart page.'}`);
}


function autoLockTriggerEnabledForSettings(settings = pageSettings()) {
  const cfg = settings && typeof settings === 'object' ? settings : pageSettings();
  return Boolean(Number(cfg.autoLockMinutes || 0) > 0 || cfg.autoLockOnBlur || cfg.autoLockOnTabHidden || Number(cfg.autoLockOnReturnMinutes || 0) > 0);
}

function isAutoLockTriggerEnabled() {
  return autoLockTriggerEnabledForSettings(pageSettings());
}

function sameTabReloadKeyAllowed(settings = pageSettings()) {
  return !uiState.pageLocked && !uiState.visibilityMode && !autoLockTriggerEnabledForSettings(settings);
}

function clearSameTabReloadSessionKey() {
  safeStorageRemove('sessionStorage', SAME_TAB_RELOAD_WRAPPED_KEY_SESSION_KEY);
  safeStorageRemove('sessionStorage', SAME_TAB_RELOAD_SECRET_SESSION_KEY);
}

function sameTabReloadSecret() {
  let secret = safeStorageGet('sessionStorage', SAME_TAB_RELOAD_SECRET_SESSION_KEY);
  if (!secret && window.crypto?.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    secret = bytesToBase64(bytes);
    safeStorageSet('sessionStorage', SAME_TAB_RELOAD_SECRET_SESSION_KEY, secret);
  }
  return String(secret || '');
}

async function cacheSameTabReloadSessionEncryptionKey() {
  const key = currentSessionEncryptionKey();
  if (!key || !sameTabReloadKeyAllowed()) {
    clearSameTabReloadSessionKey();
    return false;
  }
  try {
    const secret = sameTabReloadSecret();
    if (!secret) return false;
    const wrapped = await encryptTextWithSecret(key, secret, 'same-tab-reload-session-key', {
      wrappedKind: 'same-tab-reload-session-key',
      wrappedFor: 'browser-refresh',
      storageScope: 'sessionStorage',
      warning: 'Convenience cache for same-tab refresh only. Cleared when auto-lock triggers are enabled, the page is locked, or the tab session ends.'
    });
    safeStorageSet('sessionStorage', SAME_TAB_RELOAD_WRAPPED_KEY_SESSION_KEY, wrapped);
    return true;
  } catch (err) {
    clearSameTabReloadSessionKey();
    return false;
  }
}

async function restoreSameTabReloadSessionEncryptionKey() {
  if (currentSessionEncryptionKey()) return true;
  const wrapped = safeStorageGet('sessionStorage', SAME_TAB_RELOAD_WRAPPED_KEY_SESSION_KEY);
  const secret = safeStorageGet('sessionStorage', SAME_TAB_RELOAD_SECRET_SESSION_KEY);
  if (!wrapped || !secret) return false;
  try {
    const parsed = JSON.parse(wrapped);
    if (!parsed || parsed.wrappedKind !== 'same-tab-reload-session-key') throw new Error('Reload key cache is not valid.');
    const restored = await decryptTextEnvelope(parsed, secret);
    if (!restored) throw new Error('Reload key cache is empty.');
    uiState.encryptionKey = restored;
    uiState.encryptionEnabled = true;
    return true;
  } catch (err) {
    clearSameTabReloadSessionKey();
    return false;
  }
}

function syncSameTabReloadKeyForSettings(settings = pageSettings()) {
  if (!sameTabReloadKeyAllowed(settings)) {
    clearSameTabReloadSessionKey();
    return;
  }
  if (currentSessionEncryptionKey()) void cacheSameTabReloadSessionEncryptionKey();
}

function clearUnlockedPageLockSessionMarker(reason = '') {
  if (uiState.pageLocked) return;
  const hadMarker = Boolean(safeStorageGet('sessionStorage', PAGE_LOCK_SESSION_KEY));
  safeStorageRemove('sessionStorage', PAGE_LOCK_SESSION_KEY);
  safeStorageRemove('sessionStorage', PAGE_LOCK_DATA_SESSION_KEY);
  safeStorageRemove('sessionStorage', PAGE_LOCK_WRAPPED_KEY_SESSION_KEY);
  uiState.lockedSnapshotEncrypted = '';
  if (hadMarker && reason) setLiveStatusMessage(reason);
}

function markPageExitingForNavigation() {
  uiState.isPageExiting = true;
  if (!uiState.pageLocked && !isAutoLockTriggerEnabled()) {
    clearUnlockedPageLockSessionMarker();
    syncSameTabReloadKeyForSettings(pageSettings());
  } else {
    clearSameTabReloadSessionKey();
  }
}

async function performConfiguredAutoLock(reason = 'inactivity') {
  if (uiState.isPageExiting || uiState.pageLocked || uiState.autoLockInProgress || !isAutoLockTriggerEnabled()) return;
  clearSameTabReloadSessionKey();
  uiState.autoLockInProgress = true;
  try {
    const keySecret = lockDataSecretFromSettings();
    const lockCredential = getLockCredential();
    const lockPinSecret = cachedPageLockSecretForAutoLock();
    if (keySecret && lockCredential && lockPinSecret) {
      await createAutoLockSnapshot(`Auto-lock before ${reason}`);
      await secureLockWithSecret(lockPinSecret, `auto-page-pin-${reason}`);
    }
    else if (keySecret && lockCredential && !lockPinSecret) {
      setLiveStatusMessage('Auto-lock skipped because the Lock PIN/password has not been entered in this page session. Enter it once by locking/unlocking manually or updating the Lock PIN in Settings; after that, auto-lock can unlock with the PIN without asking for the encryption key.');
    }
    else if (keySecret && !lockCredential) setLiveStatusMessage('Auto-lock skipped because no Lock PIN/password is set. Set a Lock PIN/password so the encrypted screen can be unlocked later.');
    else setLiveStatusMessage('Auto-lock skipped because no encryption key is available.');
  } finally {
    uiState.autoLockInProgress = false;
  }
}

function resetAutoLockTimer() {
  if (uiState.autoLockTimer) clearTimeout(uiState.autoLockTimer);
  const minutes = Number(pageSettings().autoLockMinutes || 0);
  if (!minutes || minutes < 1 || uiState.pageLocked) return;
  uiState.autoLockTimer = setTimeout(() => { void performConfiguredAutoLock('inactive timeout'); }, minutes * 60 * 1000);
}

function installAutoLockActivityTracking() {
  if (document.body.dataset.autoLockInstalled === 'true') return;
  document.body.dataset.autoLockInstalled = 'true';
  ['click','keydown','pointerdown','touchstart'].forEach(type => document.addEventListener(type, resetAutoLockTimer, { passive:true }));
  window.addEventListener('blur', () => {
    if (uiState.isPageExiting) return;
    uiState.hiddenAt = uiState.hiddenAt || Date.now();
    if (pageSettings().autoLockOnBlur) void performConfiguredAutoLock('window focus loss');
  });
  window.addEventListener('focus', () => {
    uiState.isPageExiting = false;
    const minutes = Number(pageSettings().autoLockOnReturnMinutes || 0);
    const hiddenAt = Number(uiState.hiddenAt || 0);
    uiState.hiddenAt = 0;
    if (minutes > 0 && hiddenAt && Date.now() - hiddenAt >= minutes * 60 * 1000) void performConfiguredAutoLock('return after inactive tab');
    resetAutoLockTimer();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (uiState.isPageExiting) return;
      uiState.hiddenAt = Date.now();
      if (pageSettings().autoLockOnTabHidden) void performConfiguredAutoLock('tab hidden');
    } else {
      uiState.isPageExiting = false;
      const minutes = Number(pageSettings().autoLockOnReturnMinutes || 0);
      const hiddenAt = Number(uiState.hiddenAt || 0);
      uiState.hiddenAt = 0;
      if (minutes > 0 && hiddenAt && Date.now() - hiddenAt >= minutes * 60 * 1000) void performConfiguredAutoLock('return after inactive tab');
      resetAutoLockTimer();
    }
  });
  window.addEventListener('beforeunload', markPageExitingForNavigation);
  window.addEventListener('pagehide', () => {
    markPageExitingForNavigation();
    if (uiState.appReady && !uiState.pageLocked && !uiState.startupRecoveryPending && currentSaveSignature() !== uiState.linkedSaveLastSignature) {
      void writeLocalBrowserSave({ reason: 'pagehide-fallback', announce: false, preserveFallbackWarning: true });
    }
  });
  resetAutoLockTimer();
}

function clearAllLocalData() {
  closeSettingsModal();
  showInAppConfirm('Clear local saved chart data, snapshots, session keys, lock PIN, Presentation PIN, save prompts, dismissed hints, and local app preferences from this browser? Export first if you need a copy.', async () => {
    uiState.browserSaveEpoch += 1;
    clearAutosaveSchedule();
    clearTimeout(uiState.pageSettingsPersistTimer);
    uiState.pageSettingsPersistTimer = null;
    await BrowserDataStore.removePrimarySave();
    await BrowserDataStore.removeSnapshotIndex();
    const localResult = clearPlannerWebStorage('localStorage');
    const sessionResult = clearPlannerWebStorage('sessionStorage');
    uiState.appSnapshotsCache = [];
    uiState.appSnapshotsLoaded = true;
    clearFreeformGeometrySession();
    clearWrappedSessionEncryptionKeys();
    clearCachedPageLockSecretForSession();
    uiState.encryptionKey = '';
    uiState.encryptionEnabled = false;
    uiState.linkedSaveLastSignature = currentSaveSignature();
    uiState.linkedSaveStatus = uiState.linkedSaveHandle ? uiState.linkedSaveStatus : 'No linked file selected.';
    const blockedCount = localResult.failed.length + sessionResult.failed.length;
    setLiveStatusMessage(blockedCount
      ? `Local browser data was cleared where permitted, but ${blockedCount} storage item${blockedCount === 1 ? '' : 's'} could not be removed. The current open chart remains in memory until you reset or reload.`
      : 'Local browser data, snapshots, saved PIN hashes, and planner preferences cleared. The current open chart remains in memory until you reset or reload.');
    updatePinStatus();
    updateSaveHealthPanel();
  }, { title: 'Clear Local Browser Data?', confirmText: 'Clear Local Data', cancelText: 'Cancel' });
}

function deleteLinkedSaveDatabase() {
  return new Promise(resolve => {
    try {
      if (!window.indexedDB) { resolve(false); return; }
      const request = indexedDB.deleteDatabase(LINKED_SAVE_DB_NAME);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    } catch (err) {
      resolve(false);
    }
  });
}

function deleteIndexedDatabaseByName(name) {
  return new Promise(resolve => {
    if (!window.indexedDB || !name) { resolve(false); return; }
    try {
      const request = indexedDB.deleteDatabase(String(name));
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    } catch (_) {
      resolve(false);
    }
  });
}

async function deleteAllPlannerDatabasesForOrigin() {
  if (!window.indexedDB || typeof indexedDB.databases !== 'function') return { supported: false, deleted: [], failed: [] };
  let databases = [];
  try {
    databases = await indexedDB.databases();
  } catch (_) {
    return { supported: false, deleted: [], failed: [] };
  }
  const plannerName = /^(?:classroom[-_ ]?seating[-_ ]?planner|classroomSeatingPlanner)/i;
  const names = Array.from(new Set(databases.map(item => String(item?.name || '')).filter(name => name && plannerName.test(name))));
  const deleted = [];
  const failed = [];
  for (const name of names) {
    if (await deleteIndexedDatabaseByName(name)) deleted.push(name);
    else failed.push(name);
  }
  return { supported: true, deleted, failed };
}

function resetInMemoryAppToFactory() {
  state.classes = [createClassRecord('Class 1')];
  state.activeClassId = state.classes[0].id;
  state.roomTemplates = [];
  state.students = [];
  state.groups = [];
  state.rows = 5;
  state.cols = 6;
  state.cells = {};
  state.layoutMode = 'grid';
  state.freeformLayout = null;
  state.customObjects = [];
  state.zones = [];
  state.chartMeta = {};
  state.rosterArchive = [];
  state.todaySession = null;
  state.seatingPlans = [];
  state.importProfiles = [];
  state.requirementPresets = [];
  state.ruleOverrides = [];
  uiState.pageSettings = mergePageSettings(null);
  uiState.namesOnlyLayout = uiState.pageSettings.defaultNamesOnly;
  uiState.activeSideTab = 'students';
  uiState.activeSettingsPage = 'chart';
  uiState.selectionMode = false;
  uiState.isSelectingCells = false;
  uiState.skipNextCellClick = false;
  uiState.selectionAnchorKey = null;
  uiState.activeSeatEditCellKey = null;
  uiState.activeSeatEditFreeformObjectId = null;
  uiState.activeSeatEditBatchCellKeys = [];
  uiState.activeSeatEditBatchFreeformObjectIds = [];
  uiState.designMode = false;
  uiState.designCellSize = 28;
  uiState.mobileActivePanel = 'layout';
  uiState.visibilityPreviousNamesOnly = true;
  uiState.encryptionEnabled = false;
  uiState.encryptionKey = '';
  clearWrappedSessionEncryptionKeys();
  clearCachedPageLockSecretForSession();
  clearFreeformGeometrySession();
  uiState.undoStack = [];
  uiState.redoStack = [];
  uiState.historyPaused = false;
  uiState.selectedCellKeys.clear();
  uiState.freeformSelectedObjectIds.clear();
  uiState.mobileCarryItem = null;
  uiState.csvImportDraft = null;
  uiState.noteEditorContext = null;
  uiState.noteEditorDraft = null;
  uiState.restoreImportDraft = null;
  uiState.printOptions = null;
  uiState.pageLocked = false;
  uiState.visibilityMode = false;
  uiState.appReady = false;
  uiState.lockedSnapshotEncrypted = '';
  uiState.appSnapshotsCache = [];
  uiState.appSnapshotsLoaded = true;
  uiState.snapshotIndexPersistToken += 1;
  clearTimeout(uiState.autoLockTimer);
  clearTimeout(uiState.linkedSaveAutoTimer);
  clearTimeout(uiState.linkedSaveMaxTimer);
  clearTimeout(uiState.pageSettingsPersistTimer);
  uiState.autoLockTimer = null;
  uiState.linkedSaveAutoTimer = null;
  uiState.linkedSaveMaxTimer = null;
  uiState.autosaveDirtySince = 0;
  uiState.autosaveInProgress = false;
  uiState.pageSettingsPersistTimer = null;
  uiState.linkedSaveHandle = null;
  uiState.linkedSaveFileName = '';
  uiState.linkedSaveBusy = false;
  uiState.linkedSavePending = false;
  uiState.linkedSaveLastSignature = '';
  uiState.linkedSaveStatus = 'No linked file selected.';
  uiState.googleDriveAccessToken = '';
  uiState.googleDriveTokenExpiresAt = 0;
  uiState.googleDriveTokenClient = null;
  clearGoogleDriveTokenSession();
  safeStorageRemove('sessionStorage', GOOGLE_DRIVE_USER_SESSION_KEY);
  uiState.googleDriveUser = null;
  uiState.sharedDriveInterfacePolicy = null;
  uiState.sharedDriveInterfacePermissionId = '';
  uiState.googleDriveBusy = false;
  uiState.googleDriveStatus = 'Google Drive is not connected.';
  uiState.googleDriveLastSyncAt = '';
  uiState.googleDriveFiles = [];
  uiState.googleDriveSelectedFileId = '';
  uiState.googleDriveChooserContext = null;
  uiState.saveFallbackWarning = '';
  uiState.dismissedSaveFallbackWarning = '';
  uiState.durableSavePromptActive = false;
  uiState.lastDurableSavePromptAt = 0;
  uiState.welcomeSecurityJustCompleted = false;
  uiState.suppressEncryptionPromptUntil = 0;
  uiState.saveIdentity = null;
  uiState.previewSaveIdentity = null;
  uiState.seatingWorker?.terminate?.();
  uiState.seatingWorker = null;
  uiState.seatingCandidates = [];
  uiState.seatingCandidateMode = 'generate';
  uiState.seatingCandidateSeed = '';
  uiState.seatingCandidateBatch = 0;
  uiState.seatingCandidateExcludedSignatures = [];
  uiState.seatingWorkerRunId = 0;
  uiState.linkedFileLastModified = 0;
  uiState.pendingSaveConflict = null;
  uiState.lastBackupVerification = null;
  uiState.browserStorageStatus = 'unknown';
  uiState.storageErrors = [];
  uiState.lastStorageError = '';
  uiState.concurrentTabDetected = false;
  uiState.concurrentTabOwner = '';
  uiState.concurrentTabLastSeenAt = 0;
  uiState.onboardingSecuritySavePromise = null;
  uiState.startupRecoveryPending = false;
  uiState.hiddenAt = 0;
  uiState.isPageExiting = false;
  uiState.autoLockInProgress = false;
  el('v50UpdateBanner')?.setAttribute('hidden', '');
  ensureGrid();
  ensureClassSystem();
  applyPageSettings(uiState.pageSettings, { skipRender: true, applyLoadDefaults: true });
  renderAll();
  updateUndoRedoButtons();
  updateSaveHealthPanel();
}

function factoryResetEverything() {
  closeSettingsModal();
  showInAppConfirm('This resets Classroom Seating Planner from scratch in this browser. It clears planner classes, settings, snapshots, room templates, planner-owned browser storage, and saved file permission metadata. It does not delete cookies or storage owned by other applications on the same origin. Export a backup first if you need anything. Continue?', async () => {
    const failures = [];
    uiState.browserSaveEpoch += 1;
    const localStorageResult = clearPlannerWebStorage('localStorage');
    const sessionStorageResult = clearPlannerWebStorage('sessionStorage');
    if (localStorageResult.failed.length) failures.push('local browser storage');
    if (sessionStorageResult.failed.length) failures.push('session storage');
    window.AppAudit?.clearForFactoryReset?.();
    window.GuidedLearning?.clearForFactoryReset?.();
    DistrictIntegrationsV57?.resetForFactoryReset?.();
    const databaseDeleted = await deleteLinkedSaveDatabase();
    if (!databaseDeleted && window.indexedDB) failures.push('linked-file permission database');
    BrowserDataStore.close();
    const appDatabaseDeleted = await BrowserDataStore.clearDatabase();
    if (!appDatabaseDeleted && window.indexedDB) failures.push('application data database (an open tab may still be holding it)');
    const plannerDatabaseCleanup = await deleteAllPlannerDatabasesForOrigin();
    if (plannerDatabaseCleanup.failed.length) failures.push(`planner database cleanup (${plannerDatabaseCleanup.failed.length} database${plannerDatabaseCleanup.failed.length === 1 ? '' : 's'} blocked)`);
    resetInMemoryAppToFactory();
    CrossTabCoordinator.resetForFactoryReset();
    if (failures.length) {
      setLiveStatusMessage(`Factory reset cleared the active app, but the browser blocked ${failures.join(' and ')}. Close this tab and clear this page's site data in browser settings before using it again.`);
    } else {
      setLiveStatusMessage('Factory reset complete. Secure setup is required again before continuing.');
    }
    openWelcomeSecurityModal();
  }, { title: 'Factory Reset Everything?', confirmText: 'Factory Reset', cancelText: 'Cancel' });
}


function hideMobileActionDrawer() {
  el('mobileActionDrawer')?.classList.remove('show');
}

function wireEvents() {
  el('welcomeSecurityStartBtn')?.addEventListener('click', completeWelcomeSecuritySetup);
  el('welcomeTogglePasswordBtn')?.addEventListener('click', () => toggleWelcomePasswordVisibility('welcomeEncryptionKeyInput'));
  el('welcomeTogglePasswordConfirmBtn')?.addEventListener('click', () => toggleWelcomePasswordVisibility('welcomeEncryptionKeyConfirmInput'));
  el('welcomeLoadExistingBtn')?.addEventListener('click', chooseExistingSaveFromWelcome);
  el('welcomeLoadGoogleDriveBtn')?.addEventListener('click', () => { loadGoogleDriveSaveFromWelcome().catch(err => { showWelcomeSecurityError(err.message || 'Could not list Google Drive saves.'); }); });
  el('closeGoogleDriveFileBtn')?.addEventListener('click', () => closeGoogleDriveFileChooser());
  el('cancelGoogleDriveFileBtn')?.addEventListener('click', () => closeGoogleDriveFileChooser());
  el('refreshGoogleDriveFilesBtn')?.addEventListener('click', () => { void refreshGoogleDriveFileChooser(); });
  el('googleDriveFileSearch')?.addEventListener('input', renderGoogleDriveFileList);
  el('openGoogleDriveFileBtn')?.addEventListener('click', () => { void openSelectedGoogleDriveFile(); });
  el('welcomeImportJson')?.addEventListener('change', importExistingSaveFromWelcome);
  ['welcomeEncryptionKeyInput','welcomeEncryptionKeyConfirmInput'].forEach(id => {
    el(id)?.addEventListener('keydown', event => { if (event.key === 'Enter') completeWelcomeSecuritySetup(); });
    el(id)?.addEventListener('input', () => updatePasswordStrengthDisplay('welcomeEncryptionKeyInput', 'welcomePasswordStrength'));
  });
  el('classSelect').addEventListener('change', event => switchClass(event.target.value));
  el('newClassBtn').addEventListener('click', newClass);
  el('renameClassBtn').addEventListener('click', renameActiveClass);
  el('duplicateClassBtn').addEventListener('click', duplicateActiveClass);
  el('deleteClassBtn').addEventListener('click', deleteActiveClass);
  el('closeClassNameBtn').addEventListener('click', closeClassNameModal);
  el('cancelClassNameBtn').addEventListener('click', closeClassNameModal);
  el('saveClassNameBtn').addEventListener('click', saveClassNameFromModal);
  el('classNameInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') saveClassNameFromModal();
  });
  el('classNameModal').addEventListener('click', event => {
    if (event.target.id === 'classNameModal') closeClassNameModal();
  });

  el('addStudentBtn').addEventListener('click', () => {
    if (eyeModeBlocksStudentEditing()) return blockEyeModeAction('student');
    const sensitiveDraft = noteDraftFromFields('studentNotes');
    if (sensitiveNotesNeedEncryptionWarning(sensitiveDraft)) warnSensitiveNotesNeedEncryption(sensitiveDraft);
    addStudent({
      firstName: el('firstName').value,
      lastName: el('lastName').value,
      nickName: el('nickName').value,
      grade: el('grade').value,
      id: el('studentId').value || uid('student'),
      notesPrivate: el('studentNotesPrivate').value,
      notesSubstitute: el('studentNotesSubstitute').value,
      notesPublic: el('studentNotesPublic').value
    });
    ['firstName','lastName','nickName','grade','studentId','studentNotesPrivate','studentNotesSubstitute','studentNotesPublic'].forEach(id => el(id).value = '');
    refreshAddStudentNotesSummary();
    renderAll();
    const dups = duplicateStudentFindings();
    if (dups.length) setLiveStatusMessage(dups[0].message);
  });

  ['firstName','lastName','nickName','grade','studentId','studentNotesPrivate','studentNotesSubstitute','studentNotesPublic'].forEach(id => {
    el(id).addEventListener('keydown', event => {
      if (event.key === 'Enter') el('addStudentBtn').click();
    });
  });

  el('openAddStudentNotesBtn')?.addEventListener('click', () => openStudentNotesModal({ mode: 'add' }));
  refreshAddStudentNotesSummary();

  el('clearStudentsBtn').addEventListener('click', () => {
    if (eyeModeBlocksStudentEditing()) return blockEyeModeAction('student');
    showInAppConfirm('Clear all students and remove them from groups and seats?', () => {
      state.students = [];
      state.groups.forEach(b => b.studentIds = []);
      clearAssignments(false);
      renderAll();
      setLiveStatusMessage('All students cleared.');
    }, {
      title: 'Clear Students?',
      confirmText: 'Clear Students',
      cancelText: 'Cancel'
    });
  });

  el('csvFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      openCsvMappingWizard(await readTextFileWithinLimits(file, 'CSV roster', IMPORT_LIMITS.csvBytes));
    } catch (err) {
      WorkflowRecoveryV62.reportFailure({
        operation: 'Open CSV Roster Import',
        source: file.name,
        error: err,
        dataChanged: false,
        snapshotCreated: false,
        remedy: 'Confirm the file is a valid comma-separated roster with one header row and at least one student row.',
        retry: async () => openCsvMappingWizard(await readTextFileWithinLimits(file, 'CSV roster', IMPORT_LIMITS.csvBytes))
      });
    } finally {
      event.target.value = '';
    }
  });

  el('addGroupBtn').addEventListener('click', () => {
    if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
    saveGroupEditor();
  });

  el('cancelGroupEditBtn')?.addEventListener('click', () => {
    document.querySelector('.class-setup-rule-form-card')?.classList.remove('editing-rule');
    resetGroupEditor();
    setLiveStatusMessage('Rule editing canceled.');
  });

  el('clearGroupsBtn').addEventListener('click', () => {
    if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
    showInAppConfirm('Clear all groups and seat anchors?', () => {
      state.groups = [];
      Object.values(state.cells).forEach(cell => cell.anchorGroupIds = []);
      renderAll();
      setLiveStatusMessage('All groups and anchors cleared.');
    }, {
      title: 'Clear Groups?',
      confirmText: 'Clear Groups',
      cancelText: 'Cancel'
    });
  });

  el('settingsAddCustomObjectBtn').addEventListener('click', () => {
    addCustomObject(el('settingsCustomObjectName').value);
    el('settingsCustomObjectName').value = '';
    renderCustomObjectManager();
  });
  el('settingsCustomObjectName').addEventListener('keydown', event => {
    if (event.key === 'Enter') el('settingsAddCustomObjectBtn').click();
  });

  el('selectCellsBtn').addEventListener('click', () => { if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room'); toggleCellSelectionMode(); });
  el('clearCellSelectionBtn').addEventListener('click', clearCellSelection);
  installGridEventDelegation();
  document.addEventListener('mousemove', selectCellFromPointer);
  document.addEventListener('mouseup', endCellSelection);

  el('buildGridBtn').addEventListener('click', applyGridResizeFromInputs);
  el('cancelGridResizeBtn')?.addEventListener('click', () => cancelGridResizeMode());
  ['rowsInput', 'colsInput'].forEach(id => {
    el(id)?.addEventListener('focus', () => enterGridResizeMode({ announce: false }));
    el(id)?.addEventListener('input', () => {
      enterGridResizeMode({ announce: false });
      syncGridResizeControls();
    });
    el(id)?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyGridResizeFromInputs();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelGridResizeMode();
      }
    });
  });

  el('layoutModeSelect')?.addEventListener('change', event => switchLayoutMode(event.target.value));
  el('convertGridToFreeformBtn')?.addEventListener('click', () => {
    if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
    showInAppConfirm('Convert the current grid into a freeform layout? Existing student assignments will be carried over into draggable seats.', () => {
      rebuildFreeformFromGrid({ keepAssignments: true });
      state.layoutMode = 'freeform';
      renderAll();
    }, { title: 'Convert Grid to Freeform?', confirmText: 'Convert', cancelText: 'Cancel' });
  });
  el('mapFreeformToGridBtn')?.addEventListener('click', () => {
    if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
    syncFreeformAssignmentsToGridByPosition();
    state.layoutMode = 'grid';
    renderAll();
    setLiveStatusMessage('Freeform seat order was mapped back into the standard grid.');
  });
  el('freeformCanvasWidthInput')?.addEventListener('change', updateFreeformCanvasSettings);
  el('freeformCanvasHeightInput')?.addEventListener('change', updateFreeformCanvasSettings);
  el('freeformGridSizeInput')?.addEventListener('change', updateFreeformCanvasSettings);
  el('freeformFrontSideSelect')?.addEventListener('change', updateFreeformCanvasSettings);
  el('freeformSnapToggle')?.addEventListener('change', updateFreeformCanvasSettings);
  el('freeformSeatPassThroughToggle')?.addEventListener('change', updateFreeformCanvasSettings);
  el('freeformSeatOverlapToggle')?.addEventListener('change', () => {
    updateFreeformCanvasSettings();
    ModernizationSuite?.handleSeatOverlapSettingChanged?.();
  });
  el('freeformMagneticGuidesToggle')?.addEventListener('change', updateFreeformCanvasSettings);
  el('addFreeformObjectBtn')?.addEventListener('click', () => { if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room'); addFreeformObject(); });
  el('duplicateFreeformObjectBtn')?.addEventListener('click', duplicateSelectedFreeformObject);
  el('deleteFreeformObjectBtn')?.addEventListener('click', deleteSelectedFreeformObject);
  el('clearFreeformRoomBtn')?.addEventListener('click', clearFreeformRoom);
  el('lockFreeformObjectBtn')?.addEventListener('click', () => lockSelectedFreeformObject(true));
  el('rotateFreeformObjectBtn')?.addEventListener('click', () => { const obj = selectedFreeformObject(); if (obj) rotateFreeformObject(obj.id, 15); });
  el('toggleFreeformCleanViewBtn')?.addEventListener('click', () => {
    uiState.pageSettings = mergePageSettings({ ...pageSettings(), freeformCleanView: !pageSettings().freeformCleanView });
    applyPageSettings(uiState.pageSettings, { skipRender: true });
    schedulePageSettingsPersistence('freeform-clean-view');
    syncFreeformToolbarState();
  });
  el('toggleFreeformMinimapInlineBtn')?.addEventListener('click', () => {
    if (typeof ModernizationSuite?.toggleFreeformMinimap === 'function') ModernizationSuite.toggleFreeformMinimap();
  });

  el('makeAllSeatsBtn').addEventListener('click', () => {
    if (state.layoutMode === 'freeform') return setLiveStatusMessage('Switch to Standard Grid to use All Seats. Use Freeform Add Object to add seats.');
    if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
    Object.values(state.cells).forEach(cell => cell.type = 'seat');
    if (state.layoutMode === 'freeform') rebuildFreeformFromGrid({ keepAssignments: true });
    renderAll();
  });

  el('emptyGridBtn').addEventListener('click', () => {
    if (state.layoutMode === 'freeform') return setLiveStatusMessage('Switch to Standard Grid to empty the row/column grid. Delete freeform objects directly in Freeform mode.');
    if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
    showInAppConfirm('Set every grid cell to empty and clear assignments and anchors?', () => {
      Object.values(state.cells).forEach(cell => {
        cell.type = 'empty';
        cell.assignedStudentId = null;
        cell.manual = false;
        cell.anchorGroupIds = [];
      });
      state.groups.forEach(b => b.anchorSeats = []);
      if (state.layoutMode === 'freeform') rebuildFreeformFromGrid({ keepAssignments: false });
      clearCellSelection();
      renderAll();
      setLiveStatusMessage('Grid emptied.');
    }, {
      title: 'Empty Grid?',
      confirmText: 'Empty Grid',
      cancelText: 'Cancel'
    });
  });

  el('generateBtn').addEventListener('click', () => ModernizationSuite.startCandidateGeneration('generate'));
  el('randomizeAllBtn').addEventListener('click', () => ModernizationSuite.startCandidateGeneration('randomize'));
  el('clearAssignmentsBtn').addEventListener('click', () => { if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat'); clearAssignments(false); renderAll(); });
  el('clearAnchorsBtn').addEventListener('click', () => { if (eyeModeBlocksGroupEditing() || eyeModeBlocksSeatEditing()) return blockEyeModeAction('group'); clearAnchors(); renderAll(); });
  el('analyzeBtn').addEventListener('click', runAnalyzeReport);
  el('settingsSampleBtn').addEventListener('click', handleLoadSampleData);
  el('resetDismissedHintsBtn')?.addEventListener('click', resetDismissedHints);

  document.body.addEventListener('dragstart', event => {
    const studentCard = event.target.closest('.student-card[data-student-id]');
    if (studentCard) {
      if (eyeModeBlocksSeatEditing()) { event.preventDefault(); return blockEyeModeAction('seat'); }
      studentCard.classList.add('dragging');
      event.dataTransfer.setData('application/json', JSON.stringify({ type: 'student', id: studentCard.dataset.studentId }));
      event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'student', id: studentCard.dataset.studentId }));
      event.dataTransfer.effectAllowed = 'move';
      return;
    }

    const groupCard = event.target.closest('.group-card[data-group-id]');
    if (groupCard) {
      if (eyeModeBlocksGroupEditing() || eyeModeBlocksSeatEditing()) { event.preventDefault(); return blockEyeModeAction('group'); }
      groupCard.classList.add('dragging');
      event.dataTransfer.setData('application/json', JSON.stringify({ type: 'group', id: groupCard.dataset.groupId }));
      event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'group', id: groupCard.dataset.groupId }));
      event.dataTransfer.effectAllowed = 'copyMove';
    }
  });

  document.body.addEventListener('dragend', event => {
    const card = event.target.closest('.student-card, .group-card');
    if (card) card.classList.remove('dragging');
  });


  document.body.addEventListener('dragover', event => {
    const groupCard = event.target.closest('.group-card[data-group-id]');
    if (!groupCard) return;
    if (eyeModeBlocksGroupEditing()) { event.preventDefault(); return blockEyeModeAction('group'); }
    event.preventDefault();
    groupCard.classList.add('drop-target', 'drag-drop-active');
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });

  document.body.addEventListener('dragleave', event => {
    const groupCard = event.target.closest('.group-card[data-group-id]');
    if (!groupCard) return;
    const related = event.relatedTarget;
    if (related && groupCard.contains(related)) return;
    groupCard.classList.remove('drop-target', 'drag-drop-active');
  });

  document.body.addEventListener('drop', event => {
    const groupCard = event.target.closest('.group-card[data-group-id]');
    if (!groupCard) return;
    event.preventDefault();
    if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
    groupCard.classList.remove('drop-target', 'drag-drop-active');
    const data = readDragData(event);
    if (data?.type === 'student') addStudentToGroup(groupCard.dataset.groupId, data.id, true);
    if (data?.type === 'zone') attachGroupToZone(groupCard.dataset.groupId, data.id, true);
  });

  document.body.addEventListener('contextmenu', event => {
    const studentCard = event.target.closest('.student-card[data-student-id], .group-member-chip[data-student-id], .group-manager-member[data-student-id]');
    if (studentCard) {
      event.preventDefault();
      if (eyeModeBlocksStudentEditing() && eyeModeBlocksGroupEditing()) { blockEyeModeAction('student'); return; }
      showStudentGroupContextMenu(studentCard.dataset.studentId, event.clientX, event.clientY);
      return;
    }
  });

  document.body.addEventListener('click', async event => {
    const mobileCarryPayload = mobileCarryPayloadFromTarget(event.target);
    if (mobileCarryPayload) {
      event.preventDefault();
      event.stopPropagation();
      setMobileCarryItem(mobileCarryPayload);
      return;
    }

    const studentGroupBtn = event.target.closest('[data-toggle-student-group]');
    if (studentGroupBtn) {
      event.preventDefault();
      event.stopPropagation();
      if (eyeModeBlocksGroupEditing()) { hideStudentGroupContextMenu(); return blockEyeModeAction('group'); }
      toggleStudentGroupMembership(studentGroupBtn.getAttribute('data-menu-student-id'), studentGroupBtn.getAttribute('data-toggle-student-group'));
      hideStudentGroupContextMenu();
      return;
    }

    const editStudentNotesBtn = event.target.closest('[data-edit-student-notes]');
    if (editStudentNotesBtn) {
      event.preventDefault();
      event.stopPropagation();
      openStudentNotesModal({ mode: 'student', studentId: editStudentNotesBtn.getAttribute('data-edit-student-notes') });
      hideStudentGroupContextMenu();
      return;
    }

    const editStudentBtn = event.target.closest('[data-edit-student-id]');
    if (editStudentBtn) {
      event.preventDefault();
      event.stopPropagation();
      if (eyeModeBlocksStudentEditing()) return blockEyeModeAction('student');
      openStudentEditModal(editStudentBtn.getAttribute('data-edit-student-id'));
      hideStudentGroupContextMenu();
      return;
    }

    const saveMenuBtn = event.target.closest('[data-save-menu-action]');
    if (saveMenuBtn) {
      event.preventDefault();
      const action = saveMenuBtn.getAttribute('data-save-menu-action');
      const insideSaveOptions = !!saveMenuBtn.closest('#saveSetupModal');
      await handleSaveMenuAction(action, insideSaveOptions);
      return;
    }

    const renameCustomBtn = event.target.closest('[data-rename-custom-object]');
    if (renameCustomBtn) {
      const type = renameCustomBtn.getAttribute('data-rename-custom-object');
      const input = Array.from(el('customObjectManagerList').querySelectorAll('[data-custom-object-label]')).find(item => item.getAttribute('data-custom-object-label') === type);
      renameCustomObject(type, input ? input.value : '');
      return;
    }

    const deleteCustomBtn = event.target.closest('[data-delete-custom-object]');
    if (deleteCustomBtn) {
      deleteCustomObject(deleteCustomBtn.getAttribute('data-delete-custom-object'));
      return;
    }

    if (!event.target.closest('#studentGroupContextMenu')) hideStudentGroupContextMenu();
    if (!event.target.closest('#saveLoadMenu') && !event.target.closest('#saveLoadMenuBtn')) hideSaveLoadMenu();

    const customObjectMenuBtn = event.target.closest('[data-add-custom-object-from-menu]');
    if (customObjectMenuBtn) {
      requestOpenSettingsModal();
      setTimeout(() => el('settingsCustomObjectName')?.focus(), 150);
      hideCellContextMenu();
      return;
    }

    const menuTypeBtn = event.target.closest('[data-menu-cell-type]');
    if (menuTypeBtn) {
      const menu = el('cellContextMenu');
      const freeformObjectId = menu?.dataset.freeformObjectId || '';
      const cellKey = menu?.dataset.cellKey || '';
      if (eyeModeBlocksRoomEditing()) { hideCellContextMenu(); return blockEyeModeAction('room'); }
      if (freeformObjectId) setFreeformObjectType(freeformObjectId, menuTypeBtn.dataset.menuCellType);
      else if (cellKey) setCellsType(contextCellKeys(cellKey), menuTypeBtn.dataset.menuCellType);
      hideCellContextMenu();
      return;
    }

    const clearSelectionMenuBtn = event.target.closest('[data-clear-cell-selection-from-menu]');
    if (clearSelectionMenuBtn) {
      clearCellSelection();
      return;
    }
    if (!event.target.closest('#cellContextMenu')) hideCellContextMenu();

    const removeGroupMemberBtn = event.target.closest('[data-remove-group-member]');
    if (removeGroupMemberBtn) {
      event.preventDefault();
      event.stopPropagation();
      if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
      removeStudentFromGroup(removeGroupMemberBtn.getAttribute('data-remove-group-member'), removeGroupMemberBtn.getAttribute('data-remove-student-id'));
      return;
    }

    const deleteStudentBtn = event.target.closest('[data-delete-student]');
    if (deleteStudentBtn) { if (eyeModeBlocksStudentEditing()) return blockEyeModeAction('student'); deleteStudent(deleteStudentBtn.dataset.deleteStudent); }

    const editGroupBtn = event.target.closest('[data-edit-group]');
    if (editGroupBtn) {
      event.preventDefault();
      if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
      beginEditGroup(editGroupBtn.dataset.editGroup);
      return;
    }

    const deleteGroupBtn = event.target.closest('[data-delete-group]');
    if (deleteGroupBtn) { if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group'); deleteGroup(deleteGroupBtn.dataset.deleteGroup); }


    const freeformClearBtn = event.target.closest('[data-freeform-clear-seat]');
    if (freeformClearBtn) {
      event.preventDefault();
      event.stopPropagation();
      if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
      const obj = (state.freeformLayout?.objects || []).find(item => item.id === freeformClearBtn.dataset.freeformClearSeat);
      if (obj) {
        obj.assignedStudentId = null;
        obj.manual = false;
        obj.locked = false;
        mirrorFreeformSeatToGrid(obj, { clearStudentDuplicates: false });
        rememberFreeformGeometry([obj]);
        commitFreeformLayoutChange('freeform-clear-seat', { render: true, syncToGrid: false });
      }
      return;
    }

    const freeformLockBtn = event.target.closest('[data-freeform-lock]');
    if (freeformLockBtn) {
      event.preventDefault();
      event.stopPropagation();
      const obj = (state.freeformLayout?.objects || []).find(item => item.id === freeformLockBtn.dataset.freeformLock);
      if (!obj) return;
      if (obj.type === 'seat' ? eyeModeBlocksSeatEditing() : eyeModeBlocksRoomEditing()) return blockEyeModeAction(obj.type === 'seat' ? 'seat' : 'room');
      setFreeformObjectLocked(obj, !obj.locked);
      rememberFreeformGeometry([obj]);
      commitFreeformLayoutChange('freeform-lock-object', { render: true, syncToGrid: false });
      return;
    }

    const freeformDeleteBtn = event.target.closest('[data-freeform-delete]');
    if (freeformDeleteBtn) {
      event.preventDefault();
      event.stopPropagation();
      if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
      uiState.freeformSelectedObjectIds = new Set([freeformDeleteBtn.dataset.freeformDelete]);
      deleteSelectedFreeformObject();
      return;
    }

    const toggleSeatLockBtn = event.target.closest('[data-toggle-seat-lock]');
    if (toggleSeatLockBtn) {
      if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
      toggleSeatLock(toggleSeatLockBtn.dataset.toggleSeatLock);
      return;
    }

    const clearSeatBtn = event.target.closest('[data-clear-seat]');
    if (clearSeatBtn) {
      if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
      const cell = state.cells[clearSeatBtn.dataset.clearSeat];
      if (cell) {
        cell.assignedStudentId = null;
        cell.manual = false;
        mirrorLinkedFreeformSeatsFromGrid(clearSeatBtn.dataset.clearSeat);
        renderAll();
      }
      return;
    }

    const toggleStudentLockBtn = event.target.closest('[data-toggle-student-lock]');
    if (toggleStudentLockBtn) {
      if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
      toggleStudentLock(toggleStudentLockBtn.dataset.toggleStudentLock);
      return;
    }

    const clearStudentAssignmentBtn = event.target.closest('[data-clear-student-assignment]');
    if (clearStudentAssignmentBtn) {
      if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
      unassignStudent(clearStudentAssignmentBtn.dataset.clearStudentAssignment);
      return;
    }

    const blockSeatBtn = event.target.closest('[data-block-seat]');
    if (blockSeatBtn) { if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room'); setCellType(blockSeatBtn.dataset.blockSeat, 'blocked'); }

    const makeSeatBtn = event.target.closest('[data-make-seat]');
    if (makeSeatBtn) { if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room'); setCellType(makeSeatBtn.dataset.makeSeat, 'seat'); }

    const clearAnchorBtn = event.target.closest('[data-clear-anchor-seat]');
    if (clearAnchorBtn) {
      if (eyeModeBlocksGroupEditing() || eyeModeBlocksSeatEditing()) return blockEyeModeAction('group');
      const cellKey = clearAnchorBtn.dataset.clearAnchorSeat;
      const cell = state.cells[cellKey];
      if (cell) {
        [...(cell.anchorGroupIds || [])].forEach(groupId => removeAnchorFromCell(groupId, cellKey));
      }
    }
  });

  el('toggleHeaderBtn').addEventListener('click', () => {
    document.body.classList.toggle('header-collapsed');
    refreshHeaderToggle();
  });

  el('toggleLeftPanelBtn').addEventListener('click', () => {
    document.body.classList.toggle('left-collapsed');
    refreshPanelToggleButtons();
  });

  el('toggleRightPanelBtn').addEventListener('click', () => {
    document.body.classList.toggle('right-collapsed');
    refreshPanelToggleButtons();
  });

  el('toggleLayoutToolsBtn').addEventListener('click', () => {
    document.body.classList.toggle('layout-tools-collapsed');
    if (isMobileViewport()) {
      safeStorageSet('sessionStorage', 'seatingPlannerMobileLayoutTools', document.body.classList.contains('layout-tools-collapsed') ? 'collapsed' : 'expanded');
    }
    refreshLayoutToolsToggle();
  });

  el('layoutNamesOnlyBtn').addEventListener('click', () => {
    uiState.namesOnlyLayout = !uiState.namesOnlyLayout;
    refreshNamesOnlyToggle();
    renderGrid();
  });

  el('hideUnassignedTitlesBtn')?.addEventListener('click', () => {
    uiState.pageSettings = mergePageSettings({ ...pageSettings(), hideUnassignedSeatTitles: !pageSettings().hideUnassignedSeatTitles });
    applyPageSettings(uiState.pageSettings, { skipRender: false });
    schedulePageSettingsPersistence('hide-unassigned-seat-titles');
    scheduleLinkedAutoSave('settings');
    setLiveStatusMessage(pageSettings().hideUnassignedSeatTitles ? 'Empty seat titles hidden.' : 'Empty seat titles shown.');
  });

  el('seatViewZoomSlider')?.addEventListener('input', event => setSeatViewZoom(event.target.value));
  el('seatViewZoomSlider')?.addEventListener('change', event => setSeatViewZoom(event.target.value, { announce: true }));
  el('seatTextSizeSlider')?.addEventListener('input', event => setSeatTextScale(event.target.value));
  el('seatTextSizeSlider')?.addEventListener('change', event => setSeatTextScale(event.target.value, { announce: true }));
  el('mobileRoomPanBtn')?.addEventListener('click', toggleMobileRoomPan);
  installMobileRoomPanHandlers();
  syncMobileRoomPanUi();

  el('designModeBtn').addEventListener('click', () => {
    uiState.designMode = !uiState.designMode;
    hideDesignModeTooltip();
    applyDesignModeUi();
    renderGrid();
  });

  el('designSizeSlider').addEventListener('input', event => {
    uiState.designCellSize = clampNumber(event.target.value, 20, 72);
    applyDesignModeUi();
    if (uiState.designMode) renderGrid();
  });

  el('settingsBtn').addEventListener('click', requestOpenSettingsModal);
  el('settingsAccessContinueBtn').addEventListener('click', attemptSettingsAccess);
  el('settingsAccessCancelBtn').addEventListener('click', closeSettingsAccessModal);
  el('settingsAccessCancelTopBtn').addEventListener('click', closeSettingsAccessModal);
  el('settingsAccessModal').addEventListener('click', event => { if (event.target.id === 'settingsAccessModal') closeSettingsAccessModal(); });
  el('settingsAccessInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') attemptSettingsAccess();
    if (event.key === 'Escape') closeSettingsAccessModal();
  });
  el('visibilityModeBtn').addEventListener('click', requestEnterVisibilityMode);
  el('presentationExitBtn')?.addEventListener('click', openVisibilityExitModal);
  el('pageLockBtn').addEventListener('click', startPageLockFlow);
  el('pageUnlockBtn').addEventListener('click', attemptPageUnlock);
  el('pageLockUnlockInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') attemptPageUnlock();
  });
  el('pageLockNowContinueBtn').addEventListener('click', verifyPinAndLockNow);
  el('pageLockNowCancelBtn').addEventListener('click', closePageLockNowModal);
  el('pageLockNowCancelTopBtn').addEventListener('click', closePageLockNowModal);
  el('pageLockNowModal').addEventListener('click', event => {
    if (event.target.id === 'pageLockNowModal') closePageLockNowModal();
  });
  el('pageLockNowInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') verifyPinAndLockNow();
    if (event.key === 'Escape') closePageLockNowModal();
  });
  el('pageLockSetupSaveBtn').addEventListener('click', savePageLockSetupAndLock);
  el('pageLockSetupCancelBtn').addEventListener('click', closePageLockSetupModal);
  el('pageLockSetupCancelTopBtn').addEventListener('click', closePageLockSetupModal);
  el('pageLockSetupModal').addEventListener('click', event => {
    if (event.target.id === 'pageLockSetupModal') closePageLockSetupModal();
  });
  ['pageLockSetupInput', 'pageLockSetupConfirmInput'].forEach(id => {
    el(id).addEventListener('keydown', event => {
      if (event.key === 'Enter') savePageLockSetupAndLock();
      if (event.key === 'Escape') closePageLockSetupModal();
    });
  });
  el('toggleCsvImportBtn').addEventListener('click', () => {
    const body = el('csvImportBody');
    setCsvCollapsed(body ? !body.classList.contains('collapsed') : true);
  });
  el('settingsEncryptionEnabled').addEventListener('change', event => {
    uiState.encryptionEnabled = !!event.target.checked;
    setLiveStatusMessage(uiState.encryptionEnabled ? 'Encryption enabled. Entering a key encrypts the full save payload for local saves, linked saves, downloads, snapshots, settings, rosters, notes, groups, zones, and room data.' : 'Encryption preference turned off, but secure save/export still requires an active session password.');
  });
  el('settingsEncryptionKey').addEventListener('input', () => updatePasswordStrengthDisplay('settingsEncryptionKey', 'settingsPasswordStrength'));
  el('settingsApplyEncryptionKeyBtn')?.addEventListener('click', applySettingsEncryptionKeyChange);
  el('settingsOpenSaveSetupBtn')?.addEventListener('click', openSaveSetupModal);
  el('inlineSaveStatus')?.addEventListener('click', openSaveSetupModal);
  el('localSaveBannerInfoBtn')?.addEventListener('click', openSaveSetupModal);
  el('localSaveBannerCloseBtn')?.addEventListener('click', () => {
    uiState.dismissedSaveFallbackWarning = String(uiState.saveFallbackWarning || '');
    updateLocalSaveBanner();
  });
  el('settingsGoogleDriveConnectBtn')?.addEventListener('click', connectGoogleDriveFromUi);
  el('settingsGoogleDriveSaveBtn')?.addEventListener('click', () => writeGoogleDriveSaveFile({ reason: 'manual', announce: true }));
  el('settingsGoogleDriveLoadBtn')?.addEventListener('click', loadFromGoogleDriveFile);
  el('settingsGoogleDriveForgetBtn')?.addEventListener('click', forgetGoogleDriveLink);
  el('settingGoogleAnalyticsEnabled')?.addEventListener('change', event => {
    setGoogleAnalyticsEnabled(!!event.target.checked, { announce: true });
  });
  ['saveOptionGoogleDriveFolderName'].forEach(id => {
    el(id)?.addEventListener('input', () => syncGoogleDriveInputsToSettings('saveOptions'));
  });
  el('settingsForgetLinkedFileBtn')?.addEventListener('click', () => {
    showInAppConfirm('Forget the linked save file permission? This does not delete the actual file.', () => { forgetLinkedSaveFile(); }, {
      title: 'Forget Linked File?',
      confirmText: 'Forget Linked File',
      cancelText: 'Cancel'
    });
  });
  el('closeSaveSetupBtn')?.addEventListener('click', () => closeSaveSetupModal(false));
  el('saveSetupDoneBtn')?.addEventListener('click', () => closeSaveSetupModal(true));
  el('saveSetupModal')?.addEventListener('click', event => { if (event.target.id === 'saveSetupModal') closeSaveSetupModal(false); });
  ['settingTheme','settingDefaultNamesOnly','settingHeaderCollapsed','settingLeftCollapsed','settingRightCollapsed','settingLayoutToolsCollapsed','settingCsvCollapsed','settingAddStudentCollapsed','settingHideHints','settingHideObjectTypeLabels','settingAutoSaveMinutes','settingPreferredStorage','settingGoogleDriveFolderName','settingDesignCellSize','settingSettingsAccessMethod','settingAutoLockMinutes','settingAutoLockOnBlur','settingAutoLockOnTabHidden','settingAutoLockOnReturnMinutes','settingPbkdf2Iterations','visHidePrint','visForceNamesOnly','visHideGroupDetails'].forEach(id => {
    const control = el(id);
    if (!control) return;
    control.addEventListener(control.tagName === 'SELECT' || control.type === 'number' ? 'input' : 'change', readPageSettingsForm);
  });
  el('applyPageLoadDefaultsNowBtn')?.addEventListener('click', () => {
    applyPageSettings(pageSettings(), { skipRender: false, applyLoadDefaults: true });
    setLiveStatusMessage('Page Load Defaults applied to the current workspace.');
  });
  el('settingsSaveLockPinBtn')?.addEventListener('click', saveLockPinFromSettings);
  el('settingsSaveVisibilityPinBtn')?.addEventListener('click', saveVisibilityPinFromSettings);
  el('visibilityProtectKeyContinueBtn')?.addEventListener('click', protectEncryptionKeyAndEnterVisibilityMode);
  el('visibilityProtectKeyCancelBtn')?.addEventListener('click', closeVisibilityProtectKeyModal);
  el('visibilityProtectKeyCancelTopBtn')?.addEventListener('click', closeVisibilityProtectKeyModal);
  el('visibilityProtectKeyModal')?.addEventListener('click', event => {
    if (event.target.id === 'visibilityProtectKeyModal') closeVisibilityProtectKeyModal();
  });
  el('visibilityProtectKeyInput')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') protectEncryptionKeyAndEnterVisibilityMode();
    if (event.key === 'Escape') closeVisibilityProtectKeyModal();
  });
  el('visibilityExitContinueBtn')?.addEventListener('click', attemptVisibilityExit);
  el('visibilityExitCancelBtn')?.addEventListener('click', closeVisibilityExitModal);
  el('visibilityExitCancelTopBtn')?.addEventListener('click', closeVisibilityExitModal);
  el('visibilityExitModal')?.addEventListener('click', event => { if (event.target.id === 'visibilityExitModal') closeVisibilityExitModal(); });
  el('visibilityExitInput')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') attemptVisibilityExit();
    if (event.key === 'Escape') closeVisibilityExitModal();
  });
  el('visibilitySetupSaveBtn')?.addEventListener('click', saveVisibilitySetupAndEnter);
  el('visibilitySetupCancelBtn')?.addEventListener('click', closeVisibilitySetupModal);
  el('visibilitySetupCancelTopBtn')?.addEventListener('click', closeVisibilitySetupModal);
  el('visibilitySetupModal')?.addEventListener('click', event => { if (event.target.id === 'visibilitySetupModal') closeVisibilitySetupModal(); });
  ['visibilitySetupInput','visibilitySetupConfirmInput'].forEach(id => {
    el(id)?.addEventListener('keydown', event => {
      if (event.key === 'Enter') saveVisibilitySetupAndEnter();
      if (event.key === 'Escape') closeVisibilitySetupModal();
    });
  });
  document.querySelectorAll('[data-side-tab]').forEach(button => {
    button.addEventListener('click', () => setSideTab(button.dataset.sideTab));
  });
  document.querySelectorAll('[data-mobile-panel]').forEach(button => {
    button.addEventListener('click', () => setMobilePanel(button.dataset.mobilePanel));
  });
  window.addEventListener('resize', keepMobileWorkspaceUsable);
  keepMobileWorkspaceUsable();

  el('openGroupManagerBtn').addEventListener('click', openGroupManagerModal);
  el('closeGroupManagerBtn').addEventListener('click', closeGroupManagerModal);
  el('groupManagerModal').addEventListener('click', event => {
    if (event.target.id === 'groupManagerModal') {
      closeGroupManagerModal();
      return;
    }

    const pickButton = event.target.closest('[data-group-manager-pick]');
    if (pickButton) {
      event.preventDefault();
      event.stopPropagation();
      setGroupManagerCarry({
        type: pickButton.dataset.groupManagerPick,
        id: pickButton.dataset.managerItemId,
        sourceGroupId: pickButton.dataset.managerSourceGroupId || ''
      });
      return;
    }

    if (!uiState.groupManagerCarryItem || event.target.closest('button, input, select, textarea, a')) return;
    const removeTarget = event.target.closest('#groupManagerRemoveZone');
    const groupTarget = event.target.closest('.group-manager-group[data-group-id]');
    const zoneTarget = event.target.closest('.group-manager-zone[data-zone-id]');
    if (removeTarget) {
      event.preventDefault();
      event.stopPropagation();
      applyGroupManagerCarry('remove', '');
    } else if (groupTarget) {
      event.preventDefault();
      event.stopPropagation();
      applyGroupManagerCarry('group', groupTarget.dataset.groupId);
    } else if (zoneTarget) {
      event.preventDefault();
      event.stopPropagation();
      applyGroupManagerCarry('zone', zoneTarget.dataset.zoneId);
    }
  });
  el('groupManagerCarryCancelBtn')?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    clearGroupManagerCarry();
  });
  installGroupManagerPointerDragSupport();
  installGroupManagerDragDelegation();
  el('closeSettingsBtn').addEventListener('click', closeSettingsModal);
  el('settingsModal').addEventListener('click', event => {
    if (event.target.id === 'settingsModal') closeSettingsModal();
  });
  document.querySelectorAll('[data-settings-nav]').forEach(button => {
    button.addEventListener('click', () => setSettingsPage(button.dataset.settingsNav));
  });

  if (el('closeAboutBtn')) el('closeAboutBtn').addEventListener('click', () => el('aboutModal').classList.remove('show'));
  if (el('aboutChangeLogBtn')) el('aboutChangeLogBtn').addEventListener('click', openChangeLogModal);
  if (el('settingsChangeLogBtn')) el('settingsChangeLogBtn').addEventListener('click', openChangeLogModal);
  if (el('aboutLicenseBtn')) el('aboutLicenseBtn').addEventListener('click', openLicenseModal);
  if (el('settingsLicenseBtn')) el('settingsLicenseBtn').addEventListener('click', openLicenseModal);
  if (el('closeChangeLogBtn')) el('closeChangeLogBtn').addEventListener('click', closeChangeLogModal);
  if (el('closeLicenseBtn')) el('closeLicenseBtn').addEventListener('click', closeLicenseModal);
  if (el('aboutModal')) el('aboutModal').addEventListener('click', event => {
    if (event.target.id === 'aboutModal') el('aboutModal').classList.remove('show');
  });
  installPayPalDonationSupport();
  if (el('licenseModal')) el('licenseModal').addEventListener('click', event => {
    if (event.target.id === 'licenseModal') closeLicenseModal();
  });

  installHelpGuideSupport();

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (uiState.selectedCellKeys.size || uiState.selectionMode) {
        uiState.selectionMode = false;
        clearCellSelection();
      }
      hideCellContextMenu();
      hideSaveLoadMenu();
      hideStudentGroupContextMenu();
      closeClassNameModal();
      closeSettingsModal();
      closeStudentEditModal();
      closeSeatEditModal();
      closePageLockSetupModal();
      closePageLockNowModal();
      closeVisibilityExitModal();
      closeVisibilitySetupModal();
      const encryptionKeyModal = el('encryptionKeyModal');
      if (encryptionKeyModal && encryptionKeyModal.classList.contains('show') && el('encryptionKeyCancelBtn')) {
        el('encryptionKeyCancelBtn').click();
      }
      if (el('aboutModal')) el('aboutModal').classList.remove('show');
    }
  });

  el('saveLoadMenuBtn').addEventListener('click', event => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    showSaveLoadMenu(rect.left, rect.bottom + 4);
  });
  el('saveLoadMenu')?.addEventListener('click', async event => {
    const saveMenuBtn = event.target.closest('[data-save-menu-action]');
    if (!saveMenuBtn) return;
    event.preventDefault();
    event.stopPropagation();
    await handleSaveMenuAction(saveMenuBtn.getAttribute('data-save-menu-action'), false);
  });
  el('snapshotQuickBtn')?.addEventListener('click', quickSnapshotAndOpenList);
  el('openRoomTemplatesBtn')?.addEventListener('click', openRoomTemplateModal);

  el('importJson').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await importStateFromText(await readTextFileWithinLimits(file, `uploaded file ${file.name}`, IMPORT_LIMITS.saveBytes), `uploaded file ${file.name}`);
    } catch (err) {
      WorkflowRecoveryV62.reportFailure({
        operation: 'Open Classes Save File',
        source: file.name,
        error: err,
        dataChanged: false,
        snapshotCreated: false,
        remedy: 'Use a current schema-compatible Classroom Seating Planner save and enter the matching encryption password when prompted.',
        retry: async () => importStateFromText(await readTextFileWithinLimits(file, `uploaded file ${file.name}`, IMPORT_LIMITS.saveBytes), `uploaded file ${file.name}`)
      });
    } finally {
      event.target.value = '';
    }
  });

  el('undoBtn')?.addEventListener('click', undoLastChange);
  el('redoBtn')?.addEventListener('click', redoLastChange);

  el('closeSelectiveRestoreBtn')?.addEventListener('click', closeSelectiveRestoreModal);
  el('cancelSelectiveRestoreBtn')?.addEventListener('click', closeSelectiveRestoreModal);
  el('applySelectiveRestoreBtn')?.addEventListener('click', applySelectiveRestore);
  el('restoreAllClassesToggle')?.addEventListener('change', updateRestorePartialEnabled);
  el('restoreSourceClassSelect')?.addEventListener('change', renderSelectiveRestoreModal);
  el('selectiveRestoreModal')?.addEventListener('click', event => {
    if (event.target.id === 'selectiveRestoreModal') closeSelectiveRestoreModal();
    const all = event.target.closest('[data-restore-select-all]');
    const none = event.target.closest('[data-restore-select-none]');
    if (all || none) {
      const kind = (all || none).getAttribute(all ? 'data-restore-select-all' : 'data-restore-select-none');
      document.querySelectorAll(`[data-restore-item="${kind}"]`).forEach(node => node.checked = !!all);
    }
  });

  el('closeSnapshotModalBtn')?.addEventListener('click', closeSnapshotModal);
  el('saveSnapshotBtn')?.addEventListener('click', saveClassSnapshot);
  el('snapshotModal')?.addEventListener('click', event => {
    if (event.target.id === 'snapshotModal') closeSnapshotModal();
    const restore = event.target.closest('[data-restore-snapshot]');
    const del = event.target.closest('[data-delete-snapshot]');
    if (restore) restoreClassSnapshot(restore.getAttribute('data-restore-snapshot'));
    if (del) deleteClassSnapshot(del.getAttribute('data-delete-snapshot'));
  });
  el('closeRoomTemplateModalBtn')?.addEventListener('click', closeRoomTemplateModal);
  el('saveRoomTemplateBtn')?.addEventListener('click', saveRoomTemplate);
  el('roomTemplateModal')?.addEventListener('click', event => {
    if (event.target.id === 'roomTemplateModal') closeRoomTemplateModal();
    const apply = event.target.closest('[data-apply-room-template]');
    const del = event.target.closest('[data-delete-room-template]');
    if (apply) applyRoomTemplate(apply.getAttribute('data-apply-room-template'));
    if (del) deleteRoomTemplate(del.getAttribute('data-delete-room-template'));
  });
  el('closeCsvMapModalBtn')?.addEventListener('click', () => el('csvMapModal')?.classList.remove('show'));
  el('cancelCsvMapBtn')?.addEventListener('click', () => el('csvMapModal')?.classList.remove('show'));
  el('importMappedCsvBtn')?.addEventListener('click', importMappedCsvStudents);
  el('csvMapModal')?.addEventListener('change', event => {
    if (event.target.closest('[data-csv-map-field]')) renderCsvPreview();
  });
  el('csvMapModal')?.addEventListener('click', event => { if (event.target.id === 'csvMapModal') el('csvMapModal')?.classList.remove('show'); });

  el('saveZoneFromSelectionBtn')?.addEventListener('click', saveSelectedCellsAsZone);
  el('applyZoneToSelectionBtn')?.addEventListener('click', applyZoneToSelectedCells);
  el('clearZonesFromSelectionBtn')?.addEventListener('click', clearZonesFromSelectedCells);
  document.addEventListener('click', event => {
    const renameZoneBtn = event.target.closest('[data-rename-zone]');
    if (renameZoneBtn) { renameZone(renameZoneBtn.dataset.renameZone); return; }
    const deleteZoneBtn = event.target.closest('[data-delete-zone]');
    if (deleteZoneBtn) { deleteZone(deleteZoneBtn.dataset.deleteZone); return; }
    const removeZoneStudentBtn = event.target.closest('[data-remove-zone-student]');
    if (removeZoneStudentBtn) { removeStudentFromZone(removeZoneStudentBtn.dataset.removeZoneStudent, removeZoneStudentBtn.dataset.removeStudentId, true); return; }
    const detachZoneGroupBtn = event.target.closest('[data-detach-zone-group]');
    if (detachZoneGroupBtn) { detachGroupFromZone(detachZoneGroupBtn.dataset.detachGroupId, detachZoneGroupBtn.dataset.detachZoneGroup, true); return; }
  });
  el('saveChartDetailsBtn')?.addEventListener('click', saveChartDetailsFromSettings);
  el('clearLocalDataBtn')?.addEventListener('click', clearAllLocalData);
  el('factoryResetEverythingBtn')?.addEventListener('click', factoryResetEverything);

  el('mobileActionPlaceBtn')?.addEventListener('click', () => { ProductExperience?.setWorkflow?.('seating'); setMobilePanel('layout'); });
  el('mobileActionCancelBtn')?.addEventListener('click', clearMobileCarryItem);
  el('mobileActionEditBtn')?.addEventListener('click', () => {
    if (eyeModeBlocksStudentEditing()) return blockEyeModeAction('student');
    if (uiState.mobileCarryItem?.type === 'student') openStudentEditModal(uiState.mobileCarryItem.id);
  });
  el('mobileActionGroupBtn')?.addEventListener('click', () => {
    if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
    if (uiState.mobileCarryItem?.type === 'student') showStudentGroupContextMenu(uiState.mobileCarryItem.id, 16, window.innerHeight - 220);
  });


  el('openEditStudentNotesBtn')?.addEventListener('click', () => openStudentNotesModal({ mode: 'edit' }));
  el('closeStudentNotesBtn')?.addEventListener('click', closeStudentNotesModal);
  el('cancelStudentNotesBtn')?.addEventListener('click', closeStudentNotesModal);
  el('saveStudentNotesBtn')?.addEventListener('click', saveStudentNotesModal);
  el('addStudentNoteLineBtn')?.addEventListener('click', addNoteLineToEditor);
  el('studentNotesModal')?.addEventListener('click', event => {
    if (event.target.id === 'studentNotesModal') closeStudentNotesModal();
    const revealBtn = event.target.closest?.('[data-reveal-note-key]');
    if (revealBtn) {
      event.preventDefault();
      revealNoteLineInEditor(revealBtn.getAttribute('data-reveal-note-key'));
      return;
    }
    const deleteBtn = event.target.closest?.('[data-delete-note-category]');
    if (deleteBtn) {
      event.preventDefault();
      deleteNoteLineFromEditor(deleteBtn.getAttribute('data-delete-note-category'), deleteBtn.getAttribute('data-delete-note-index'));
    }
  });

  el('closeStudentEditBtn').addEventListener('click', closeStudentEditModal);
  el('cancelStudentEditBtn').addEventListener('click', closeStudentEditModal);
  el('studentEditModal').addEventListener('click', event => {
    if (event.target.id === 'studentEditModal') closeStudentEditModal();
  });
  el('saveStudentEditBtn').addEventListener('click', () => {
    const oldId = el('editStudentOriginalId').value;
    const sensitiveDraft = noteDraftFromFields('editStudentNotes');
    if (sensitiveNotesNeedEncryptionWarning(sensitiveDraft)) warnSensitiveNotesNeedEncryption(sensitiveDraft);
    const saved = updateStudentRecord(oldId, {
      firstName: el('editFirstName').value,
      lastName: el('editLastName').value,
      nickName: el('editNickName').value,
      grade: el('editGrade').value,
      id: el('editStudentId').value || oldId,
      notesPrivate: el('editStudentNotesPrivate').value,
      notesSubstitute: el('editStudentNotesSubstitute').value,
      notesPublic: el('editStudentNotesPublic').value,
      requirements: ModernizationSuite.readStudentRequirements(oldId)
    });
    if (saved) closeStudentEditModal();
  });

  el('closeSeatEditBtn').addEventListener('click', closeSeatEditModal);
  el('seatEditModal').addEventListener('click', event => {
    if (event.target.id === 'seatEditModal') closeSeatEditModal();
  });
  el('seatEditAssignStudentBtn').addEventListener('click', () => {
    if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
    if (activeSeatEditIsBatch()) { setLiveStatusMessage('Student assignment is an individual-seat action. Open one seat without a multi-selection.'); return; }
    if (activeSeatEditLocked()) return blockLockedSeatEditAction();
    const cellKey = uiState.activeSeatEditCellKey;
    const studentId = el('seatEditStudentSelect').value;
    if (!cellKey || !studentId) return;
    const cell = state.cells[cellKey];
    if (cell && cell.type !== 'seat') applyCellTypeWithoutRender(cellKey, 'seat');
    assignStudentToCell(studentId, cellKey, true, true);
    mirrorActiveSeatEditFreeformFromGrid();
    refreshSeatEditModal();
  });
  el('seatEditClearStudentBtn').addEventListener('click', () => {
    if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
    if (activeSeatEditIsBatch()) { setLiveStatusMessage('Clearing a student is an individual-seat action. Open one seat without a multi-selection.'); return; }
    if (activeSeatEditLocked()) return blockLockedSeatEditAction();
    const cell = state.cells[uiState.activeSeatEditCellKey];
    if (cell) {
      cell.assignedStudentId = null;
      cell.manual = false;
      mirrorLinkedFreeformSeatsFromGrid(uiState.activeSeatEditCellKey);
      renderAll();
      refreshSeatEditModal();
    }
  });
  el('seatEditLockBtn').addEventListener('click', () => {
    if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
    const obj = activeSeatEditFreeformObject();
    const key = uiState.activeSeatEditCellKey;
    if (obj) {
      setFreeformObjectLocked(obj, !obj.locked);
      commitFreeformLayoutChange('freeform-seat-editor-lock', { render: true, syncToGrid: false });
      refreshSeatEditModal();
      return;
    }
    if (key) {
      toggleSeatLock(key);
      mirrorActiveSeatEditFreeformFromGrid();
      refreshSeatEditModal();
    }
  });
  el('seatEditAddGroupBtn').addEventListener('click', () => {
    if (eyeModeBlocksGroupEditing() || eyeModeBlocksSeatEditing()) return blockEyeModeAction('group');
    if (activeSeatEditLocked()) return blockLockedSeatEditAction();
    const groupId = el('seatEditGroupSelect').value;
    const targets = editableSeatEditTargets();
    if (!groupId || !targets.length) return;
    targets.forEach(({ key }) => {
      addGroupAnchorWithoutRender(groupId, key);
      mirrorLinkedFreeformSeatsFromGrid(key);
    });
    renderAll();
    setLiveStatusMessage(targets.length > 1 ? `Reserved ${targets.length} selected seats for that group.` : 'Seat group reservation updated.');
    refreshSeatEditModal();
  });
  el('seatEditClearGroupsBtn').addEventListener('click', () => {
    if (eyeModeBlocksGroupEditing() || eyeModeBlocksSeatEditing()) return blockEyeModeAction('group');
    if (activeSeatEditLocked()) return blockLockedSeatEditAction();
    const targets = editableSeatEditTargets();
    if (!targets.length) return;
    targets.forEach(({ key, cell }) => {
      [...(cell.anchorGroupIds || [])].forEach(groupId => {
        const group = getGroup(groupId);
        if (group) group.anchorSeats = (group.anchorSeats || []).filter(seatKey => seatKey !== key);
      });
      cell.anchorGroupIds = [];
      mirrorLinkedFreeformSeatsFromGrid(key);
    });
    renderAll();
    setLiveStatusMessage(targets.length > 1 ? `Cleared group reservations from ${targets.length} selected seats.` : 'Seat group reservations cleared.');
    refreshSeatEditModal();
  });
  el('seatEditAddZoneBtn').addEventListener('click', () => {
    if (eyeModeBlocksGroupEditing() || eyeModeBlocksSeatEditing()) return blockEyeModeAction('group');
    if (activeSeatEditLocked()) return blockLockedSeatEditAction();
    const zoneId = el('seatEditZoneSelect').value;
    const zone = zoneById(zoneId);
    const targets = editableSeatEditTargets();
    if (!zone || !targets.length) return;
    targets.forEach(({ key, cell }) => {
      cell.zoneIds = [...new Set([...(cell.zoneIds || []).map(String), String(zone.id)])];
      mirrorLinkedFreeformSeatsFromGrid(key);
    });
    renderAll();
    setLiveStatusMessage(`Assigned ${zone.name} to ${targets.length} seat${targets.length === 1 ? '' : 's'}.`);
    refreshSeatEditModal();
  });
  el('seatEditClearZonesBtn').addEventListener('click', () => {
    if (eyeModeBlocksGroupEditing() || eyeModeBlocksSeatEditing()) return blockEyeModeAction('group');
    if (activeSeatEditLocked()) return blockLockedSeatEditAction();
    const targets = editableSeatEditTargets();
    if (!targets.length) return;
    targets.forEach(({ key, cell }) => {
      cell.zoneIds = [];
      mirrorLinkedFreeformSeatsFromGrid(key);
    });
    renderAll();
    setLiveStatusMessage(`Cleared zone assignments from ${targets.length} seat${targets.length === 1 ? '' : 's'}.`);
    refreshSeatEditModal();
  });
  el('seatEditApplyTypeBtn').addEventListener('click', () => {
    if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
    if (activeSeatEditIsBatch()) { setLiveStatusMessage('Cell type is an individual-seat action in this editor. Use the Room Design selection tools for batch type changes.'); return; }
    if (activeSeatEditLocked()) return blockLockedSeatEditAction();
    const key = uiState.activeSeatEditCellKey;
    const nextType = el('seatEditTypeSelect').value;
    const obj = activeSeatEditFreeformObject();
    if (obj) {
      setFreeformObjectType(obj.id, nextType);
      refreshSeatEditModal();
      return;
    }
    if (!key) return;
    setCellType(key, nextType);
    mirrorLinkedFreeformSeatsFromGrid(key);
    refreshSeatEditModal();
  });

  el('printBtn')?.addEventListener('click', openPrintOptionsModal);
  el('closePrintOptionsBtn')?.addEventListener('click', closePrintOptionsModal);
  el('cancelPrintOptionsBtn')?.addEventListener('click', closePrintOptionsModal);
  el('openPrintPreviewBtn')?.addEventListener('click', startPrintPreviewFromOptions);
  el('printDownloadPdfBtn')?.addEventListener('click', exportChartPdf);
  el('printDownloadSvgBtn')?.addEventListener('click', exportChartSvg);
  el('printOptionsModal')?.addEventListener('click', event => {
    if (event.target.id === 'printOptionsModal') closePrintOptionsModal();
  });
  el('printOptionMode')?.addEventListener('change', event => setPrintOptionDefaultsForMode(event.target.value));

  const exitPrintPreviewBtn = el('exitPrintPreviewBtn');
  if (exitPrintPreviewBtn) exitPrintPreviewBtn.addEventListener('click', closePrintPreview);

  window.addEventListener('afterprint', closePrintPreview);
  installHistoryCapture();
  installAutoLockActivityTracking();
  updateUndoRedoButtons();
}


function installMobileTouchSupport() {
  const grid = el('seatGrid');
  if (!grid || grid.dataset.mobileTouchInstalled === 'true') return;
  grid.dataset.mobileTouchInstalled = 'true';
  let touchSelecting = false;

  const keyFromTouch = touch => {
    if (!touch) return '';
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = target && target.closest ? target.closest('.cell') : null;
    return cell ? cell.dataset.cellKey || '' : '';
  };

  grid.addEventListener('touchstart', event => {
    if (!uiState.selectionMode) return;
    if (event.target.closest && (event.target.closest('button') || event.target.closest('[data-seat-student-id]'))) return;
    const key = keyFromTouch(event.touches[0]);
    if (!key || !state.cells[key]) return;
    event.preventDefault();
    touchSelecting = true;
    uiState.isSelectingCells = true;
    uiState.selectionAnchorKey = uiState.selectionAnchorKey || key;
    uiState.skipNextCellClick = true;
    addCellToSelection(key);
  }, { passive: false });

  grid.addEventListener('touchmove', event => {
    if (!touchSelecting) return;
    const key = keyFromTouch(event.touches[0]);
    if (!key || !state.cells[key]) return;
    event.preventDefault();
    addCellToSelection(key);
  }, { passive: false });

  window.addEventListener('touchend', () => {
    if (!touchSelecting) return;
    touchSelecting = false;
    uiState.isSelectingCells = false;
    setTimeout(() => { uiState.skipNextCellClick = false; }, 0);
  }, { passive: true });
}







