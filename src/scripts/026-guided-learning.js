const GuidedLearning = (() => {
  const STORAGE_KEY = 'classroom-seating-planner-guided-learning-v6';
  const PRACTICE_CLASS_PREFIX = '[Practice]';
  const PROGRESS_VERSION = 1;
  const EVALUATION_INTERVAL_MS = 450;

  const learningState = {
    installed: false,
    active: false,
    lessonId: '',
    mode: 'explain',
    stepIndex: 0,
    stepComplete: false,
    skippedSteps: new Set(),
    signals: new Set(),
    baseline: null,
    target: null,
    renderToken: 0,
    evaluationTimer: null,
    returnClassId: '',
    practiceClassId: '',
    helpView: 'lessons',
    layerHandle: null,
    contextReady: false,
    contextDescriptor: null,
    lastContextTarget: null
  };

  function lessonStep(config) {
    return Object.freeze({
      id: config.id,
      title: config.title,
      body: config.body,
      task: config.task || 'Review the highlighted area.',
      selector: config.selector || '',
      fallback: config.fallback || '',
      workflow: config.workflow || '',
      classSetupSection: config.classSetupSection || '',
      panel: config.panel || '',
      sideTab: config.sideTab || '',
      expandLayoutTools: Boolean(config.expandLayoutTools),
      requiredInPractice: config.requiredInPractice !== false,
      requiredInExplain: Boolean(config.requiredInExplain),
      check: config.check || (() => true),
      contextCheck: config.contextCheck || null,
      prepare: config.prepare || null,
      openContext: config.openContext || null,
      contextLabel: config.contextLabel || '',
      contextHelp: config.contextHelp || '',
      important: Boolean(config.important),
      actionLabel: config.actionLabel || ''
    });
  }

  function simpleStep(id, title, body, task, selector, options = {}) {
    return lessonStep({ id, title, body, task, selector, ...options });
  }

  function countGridSeats() {
    return Object.values(state.cells || {}).filter(cell => cell?.type === 'seat').length;
  }

  function countGridObjects() {
    return Object.values(state.cells || {}).filter(cell => cell && !['seat', 'empty'].includes(cell.type)).length;
  }

  function freeformObjects() {
    return Array.isArray(state.freeformLayout?.objects) ? state.freeformLayout.objects : [];
  }

  function freeformSeats() {
    return freeformObjects().filter(object => object.type === 'seat');
  }

  function countAssignments() {
    if (state.layoutMode === 'freeform') {
      return freeformSeats().filter(object => object.assignedStudentId).length;
    }
    return Object.values(state.cells || {}).filter(cell => cell?.type === 'seat' && cell.assignedStudentId).length;
  }

  function countLockedAssignments() {
    if (state.layoutMode === 'freeform') {
      return freeformSeats().filter(object => object.assignedStudentId && (object.locked || object.manual)).length;
    }
    return Object.values(state.cells || {}).filter(cell => cell?.type === 'seat' && cell.assignedStudentId && cell.manual).length;
  }

  function assignmentSignature() {
    if (state.layoutMode === 'freeform') {
      return freeformSeats()
        .map(object => `${object.id}:${object.assignedStudentId || ''}:${object.locked ? 1 : 0}`)
        .sort()
        .join('|');
    }
    return Object.entries(state.cells || {})
      .filter(([, cell]) => cell?.type === 'seat')
      .map(([key, cell]) => `${key}:${cell.assignedStudentId || ''}:${cell.manual ? 1 : 0}`)
      .sort()
      .join('|');
  }

  function freeformGeometrySignature() {
    return freeformObjects()
      .map(object => [object.id, object.x, object.y, object.width, object.height, object.rotation, object.groupId, object.locked ? 1 : 0].join(':'))
      .sort()
      .join('|');
  }

  function countZonedSeats() {
    if (state.layoutMode === 'freeform') {
      return freeformSeats().filter(object => Array.isArray(object.zoneIds) && object.zoneIds.length).length;
    }
    return Object.values(state.cells || {}).filter(cell => Array.isArray(cell?.zoneIds) && cell.zoneIds.length).length;
  }

  function snapshotMetrics() {
    return {
      studentCount: state.students?.length || 0,
      groupCount: state.groups?.length || 0,
      zoneCount: state.zones?.length || 0,
      gridSeatCount: countGridSeats(),
      gridObjectCount: countGridObjects(),
      rowCount: Number(state.rows) || 0,
      colCount: Number(state.cols) || 0,
      selectedCellCount: uiState.selectedCellKeys?.size || 0,
      freeformObjectCount: freeformObjects().length,
      freeformSeatCount: freeformSeats().length,
      freeformGroupCount: state.freeformLayout?.groups?.length || 0,
      freeformGeometry: freeformGeometrySignature(),
      selectedFreeformCount: uiState.freeformSelectedObjectIds?.size || 0,
      assignedCount: countAssignments(),
      lockedAssignmentCount: countLockedAssignments(),
      assignmentSignature: assignmentSignature(),
      roomTemplateCount: state.roomTemplates?.length || 0,
      seatingPlanCount: state.seatingPlans?.length || 0,
      snapshotCount: typeof appSnapshots === 'function' ? appSnapshots().length : 0,
      zonedSeatCount: countZonedSeats(),
      todayActive: Boolean(state.todaySession?.active),
      todayGuestCount: state.todaySession?.guestStudentIds?.length || 0,
      undoDepth: uiState.undoStack?.length || 0,
      layoutMode: state.layoutMode,
      candidateCount: document.querySelectorAll('#seatingCandidateGrid [data-candidate-index], #seatingCandidateGrid .candidate-card').length,
      candidateText: el('seatingCandidateGrid')?.textContent || ''
    };
  }

  function signalSeen(...selectorsOrIds) {
    return selectorsOrIds.some(value => learningState.signals.has(value));
  }

  function geometryChanged(kind) {
    const before = learningState.baseline;
    if (!before) return false;
    if (kind === 'move') {
      return signalSeen('freeform-moved') || freeformGeometrySignature() !== before.freeformGeometry;
    }
    if (kind === 'resize') {
      return signalSeen('freeform-resized', 'applyFreeformInspectorBtn');
    }
    if (kind === 'rotate') {
      return signalSeen('rotateFreeformObjectBtn', 'freeform-rotated');
    }
    return false;
  }

  const CHECKS = Object.freeze({
    always: () => true,
    gridMode: () => state.layoutMode === 'grid',
    freeformMode: () => state.layoutMode === 'freeform',
    studentAdded: () => (state.students?.length || 0) > (learningState.baseline?.studentCount || 0),
    studentEditorOpened: () => el('studentEditModal')?.classList.contains('show') || signalSeen('student-editor-opened', 'saveStudentEditBtn'),
    gridSizeChanged: () => Number(state.rows) !== learningState.baseline?.rowCount || Number(state.cols) !== learningState.baseline?.colCount || signalSeen('buildGridBtn'),
    cellsSelected: () => (uiState.selectedCellKeys?.size || 0) >= 2,
    gridObjectAdded: () => countGridObjects() > (learningState.baseline?.gridObjectCount || 0),
    gridSeatsAdded: () => countGridSeats() > (learningState.baseline?.gridSeatCount || 0) || signalSeen('makeAllSeatsBtn'),
    templateSaved: () => (state.roomTemplates?.length || 0) > (learningState.baseline?.roomTemplateCount || 0),
    freeformSeatAdded: () => freeformSeats().length > (learningState.baseline?.freeformSeatCount || 0),
    freeformObjectAdded: () => freeformObjects().length > (learningState.baseline?.freeformObjectCount || 0) && freeformObjects().some(object => object.type !== 'seat'),
    freeformMoved: () => geometryChanged('move'),
    freeformResized: () => geometryChanged('resize'),
    freeformRotated: () => geometryChanged('rotate'),
    freeformDuplicated: () => freeformObjects().length > (learningState.baseline?.freeformObjectCount || 0) || signalSeen('duplicateFreeformObjectBtn'),
    freeformMultiSelected: () => (uiState.freeformSelectedObjectIds?.size || 0) >= 2,
    freeformArranged: () => signalSeen('freeform-arranged'),
    freeformGrouped: () => {
      const groups = new Map();
      freeformObjects().forEach(object => {
        if (!object.groupId) return;
        groups.set(object.groupId, (groups.get(object.groupId) || 0) + 1);
      });
      return [...groups.values()].some(count => count >= 2);
    },
    freeformGroupMoved: () => geometryChanged('move') && CHECKS.freeformGrouped(),
    freeformUngrouped: () => signalSeen('ungroupFreeformBtn', 'ungroupFreeformSelectionInlineBtn') || (state.freeformLayout?.groups?.length || 0) < (learningState.baseline?.freeformGroupCount || 0),
    freeformLocked: () => freeformObjects().some(object => object.locked) || signalSeen('lockFreeformObjectBtn', 'lockFreeformGroupBtn'),
    assignmentAdded: () => countAssignments() > (learningState.baseline?.assignedCount || 0),
    assignmentChanged: () => assignmentSignature() !== learningState.baseline?.assignmentSignature,
    assignmentLocked: () => countLockedAssignments() > (learningState.baseline?.lockedAssignmentCount || 0),
    undoUsed: () => signalSeen('undoBtn'),
    randomizationUsed: () => signalSeen('randomizeAllBtn') && assignmentSignature() !== learningState.baseline?.assignmentSignature,
    analysisUsed: () => signalSeen('analyzeBtn') || document.body.dataset.workflow === 'review',
    candidateGenerated: () => el('seatingCandidateModal')?.classList.contains('show') && document.querySelectorAll('#seatingCandidateGrid [data-candidate-index], #seatingCandidateGrid .candidate-card').length > 0,
    candidateInspected: () => signalSeen('candidate-card', 'candidate-detail'),
    moreCandidatesGenerated: () => signalSeen('generateMoreCandidatesBtn') && (el('seatingCandidateGrid')?.textContent || '') !== learningState.baseline?.candidateText,
    candidateApplied: () => signalSeen('acceptSeatingCandidateBtn') && assignmentSignature() !== learningState.baseline?.assignmentSignature,
    seatingPlanSaved: () => (state.seatingPlans?.length || 0) > (learningState.baseline?.seatingPlanCount || 0),
    groupAdded: () => (state.groups?.length || 0) > (learningState.baseline?.groupCount || 0),
    zoneAdded: () => (state.zones?.length || 0) > (learningState.baseline?.zoneCount || 0),
    zoneApplied: () => countZonedSeats() > (learningState.baseline?.zonedSeatCount || 0),
    todayEnabled: () => Boolean(state.todaySession?.active),
    todayGuestAdded: () => (state.todaySession?.guestStudentIds?.length || 0) > (learningState.baseline?.todayGuestCount || 0),
    todaySaved: () => signalSeen('saveTodayModeBtn'),
    snapshotCreated: () => (typeof appSnapshots === 'function' ? appSnapshots().length : 0) > (learningState.baseline?.snapshotCount || 0),
    saveOptionsOpened: () => el('saveSetupModal')?.classList.contains('show'),
    printOptionsOpened: () => el('printOptionsModal')?.classList.contains('show'),
    printPreviewOpened: () => document.body.classList.contains('print-preview-active') || signalSeen('openPrintPreviewBtn'),
    safeShareOpened: () => el('safeShareModal')?.classList.contains('show') || signalSeen('downloadReadOnlyClassroomBtn'),
    sharedDriveManagerOpened: () => el('sharedDriveModal')?.classList.contains('show'),
    securityWizardOpened: () => el('securitySetupWizardModal')?.classList.contains('show'),
    settingsGoogleOpened: () => el('settingsModal')?.classList.contains('show') && uiState.activeSettingsPage === 'google',
    driveActionUsed: () => signalSeen('googleHubDriveConnectBtn', 'settingsGoogleDriveManageBtn', 'settingsGoogleDriveConnectBtn'),
    classroomActionUsed: () => signalSeen('googleHubClassroomConnectBtn', 'classSetupGoogleClassroomConnectBtn'),
    rosterImportViewed: () => el('classSetupImportPanel')?.classList.contains('active'),
    mappedCsvOpened: () => signalSeen('importMappedCsvBtn', 'csvFile') || el('csvMapModal')?.classList.contains('show'),
    reviewOpened: () => el('classSetupReviewPanel')?.classList.contains('active') || document.body.dataset.workflow === 'review'
  });

  const LESSONS = Object.freeze([
    {
      id: 'quick-start',
      category: 'Start here',
      title: 'Quick Start',
      summary: 'Understand the complete planning workflow in eight focused steps.',
      duration: '4–6 minutes',
      difficulty: 'Beginner',
      practiceSupported: false,
      steps: [
        simpleStep('class', 'Choose the class', 'Each class keeps its own roster, room, rules, notes, seating plans, and snapshots.', 'Choose or create the class you want to work on.', '.v4-class-dock', { workflow: 'setup', check: CHECKS.always }),
        simpleStep('roster', 'Add or import the roster', 'Class Setup keeps manual entry, Google Classroom, SIS/OneRoster CSV, and mapped CSV import in one place.', 'Open Import Roster or Students depending on how your roster arrives.', '#classSetupImportMain', { fallback: '#classSetupImportTab', workflow: 'setup', classSetupSection: 'import', check: CHECKS.always }),
        simpleStep('rules', 'Add only meaningful rules', 'Groups, relationship rules, individual needs, and zones guide the generator without replacing teacher judgment.', 'Configure only the requirements that matter for this class.', '#classSetupRulesPanel .class-setup-section-heading', { fallback: '#classSetupRulesTab', workflow: 'setup', classSetupSection: 'rules', check: CHECKS.always }),
        simpleStep('room', 'Build the real room', 'Choose Standard Grid for rows and columns or Freeform for precise physical placement and irregular layouts.', 'Select the room model and create all usable seats.', '#layoutModeSelect', { workflow: 'room', expandLayoutTools: true, check: CHECKS.always }),
        simpleStep('seat', 'Seat students', 'Place important students manually, lock required placements, randomize quickly, or generate rule-aware candidates.', 'Open Seat Students and choose the method that fits the task.', '#generateBtn', { workflow: 'seating', panel: 'left', check: CHECKS.always }),
        simpleStep('review', 'Review before accepting', 'Placement totals, rule results, conflicts, and analysis explain whether the chart is usable.', 'Review required conflicts first and decide which preferences matter.', '#analyzeBtn', { workflow: 'review', panel: 'right', check: CHECKS.always }),
        simpleStep('save', 'Save and create restore points', 'Browser autosave is convenient; linked files, Drive saves, downloads, named plans, and snapshots protect important work.', 'Take a snapshot before large changes and keep a durable backup.', '#snapshotQuickBtn', { workflow: 'share', check: CHECKS.always }),
        simpleStep('share', 'Print or share the right amount', 'Print options and read-only packages let you include only the names, notes, and room details each audience needs.', 'Use Print or Safe Sharing instead of sending the editable master save.', '#printBtn', { workflow: 'share', check: CHECKS.always })
      ]
    },
    {
      id: 'class-roster',
      category: 'Class setup',
      title: 'Create a Class and Import a Roster',
      summary: 'Learn manual entry, Google Classroom, SIS/OneRoster CSV, mapped CSV, notes, and reconciliation.',
      duration: '8–12 minutes',
      difficulty: 'Beginner',
      practiceSupported: true,
      steps: [
        simpleStep('import-options', 'Choose the right roster method', 'Google Classroom and SIS imports recognize known fields automatically. Mapped CSV works with arbitrary spreadsheets.', 'Review the import choices before adding records.', '#classSetupImportMain', { workflow: 'setup', classSetupSection: 'import', check: CHECKS.rosterImportViewed, requiredInPractice: false }),
        simpleStep('manual-add', 'Add one student manually', 'Manual entry is useful for a small class, a late enrollee, or a correction after import.', 'Enter a first and last name, then choose Add Student.', '#addStudentBtn', { workflow: 'setup', classSetupSection: 'students', check: CHECKS.studentAdded }),
        simpleStep('edit-record', 'Review a student record', 'The editor holds names, IDs, grade, notes, individual seating needs, and archive status.', 'Open a student for editing, review the fields, and save or close it.', '#studentList', { workflow: 'setup', classSetupSection: 'students', check: CHECKS.studentEditorOpened, requiredInExplain: true }),
        simpleStep('mapped-csv', 'Use mapped CSV for an unusual spreadsheet', 'Mapped CSV lets the user identify which columns contain names, IDs, grade, nickname, and other fields.', 'Open the mapped CSV flow or continue if your district uses Classroom or SIS fields.', '#importMappedCsvBtn', { workflow: 'setup', classSetupSection: 'import', check: CHECKS.mappedCsvOpened, requiredInPractice: false }),
        simpleStep('reconcile', 'Reconcile instead of replacing blindly', 'Roster reconciliation preserves existing notes, requirements, memberships, and seat references for matched students.', 'After choosing a Classroom or SIS roster, the reconciliation window shows matched, new, missing, and duplicate records before anything is applied.', '#classSetupImportMain', { workflow: 'setup', classSetupSection: 'import', check: CHECKS.always, requiredInPractice: false }),
        simpleStep('review', 'Review setup readiness', 'The review page points out missing names, duplicate IDs, or setup choices that may affect seating.', 'Open Review Setup and resolve issues that matter for this class.', '#classSetupReviewPanel', { workflow: 'setup', classSetupSection: 'review', check: CHECKS.reviewOpened })
      ]
    },
    {
      id: 'grid-room',
      category: 'Room design',
      title: 'Design a Standard Grid Room',
      summary: 'Create rows, select cells, mark room objects, build seats, and save a reusable room template.',
      duration: '8–10 minutes',
      difficulty: 'Beginner',
      practiceSupported: true,
      steps: [
        simpleStep('mode', 'Switch to Standard Grid', 'Grid mode is the fastest way to model rows, columns, aisles, and rectangular rooms.', 'Choose Standard Grid from Layout Mode.', '#layoutModeSelect', { workflow: 'room', expandLayoutTools: true, check: CHECKS.gridMode }),
        simpleStep('size', 'Set the room size', 'Rows and columns define the editable grid. Start close to the real room and adjust later.', 'Change Rows or Columns, then apply the grid size.', '#buildGridBtn', { workflow: 'room', expandLayoutTools: true, check: CHECKS.gridSizeChanged }),
        simpleStep('select', 'Select several cells', 'Multi-select applies one room type, zone, or other change to several cells at once.', 'Turn on Select Cells and select at least two cells.', '#selectCellsBtn', { workflow: 'room', expandLayoutTools: true, check: CHECKS.cellsSelected }),
        simpleStep('objects', 'Mark room objects and pathways', 'Doors, boards, teacher areas, blocked spaces, and walkways make the digital room match the physical one.', 'Apply a non-seat room object to a selected cell.', '#layoutTool', { workflow: 'room', expandLayoutTools: true, check: CHECKS.gridObjectAdded }),
        simpleStep('seats', 'Create usable seats', 'Only cells marked as seats can receive students.', 'Convert empty cells to seats or use Make All Seats.', '#makeAllSeatsBtn', { workflow: 'room', expandLayoutTools: true, check: CHECKS.gridSeatsAdded }),
        simpleStep('inspect', 'Inspect the finished room', 'Check that room objects are not counted as seats and that every intended seat is available.', 'Pan through the grid and correct any accidental object types.', '#seatGrid', { workflow: 'room', check: CHECKS.always, requiredInPractice: false }),
        simpleStep('template', 'Save the room as a template', 'Templates let several classes reuse the same physical room without sharing rosters or assignments.', 'Open Room Templates and save the current layout.', '#openRoomTemplatesBtn', { workflow: 'room', check: CHECKS.templateSaved })
      ]
    },
    {
      id: 'freeform-room',
      category: 'Room design',
      title: 'Master Freeform Room Design',
      summary: 'Practice adding, moving, resizing, rotating, aligning, grouping, locking, seating, undoing, and templating.',
      duration: '15–20 minutes',
      difficulty: 'Intermediate',
      practiceSupported: true,
      steps: [
        simpleStep('mode', 'Switch to Freeform Room', 'Freeform uses physical positions instead of fixed rows and columns.', 'Choose Freeform Room from Layout Mode.', '#layoutModeSelect', { workflow: 'room', expandLayoutTools: true, check: CHECKS.freeformMode }),
        simpleStep('add-seat', 'Add a seat', 'Freeform seats can be placed anywhere on the room canvas.', 'Choose the Seat object type and add one seat.', '#addFreeformObjectBtn', { workflow: 'room', expandLayoutTools: true, check: CHECKS.freeformSeatAdded }),
        simpleStep('add-object', 'Add a room object', 'Boards, doors, tables, walkways, and teacher areas make the layout understandable and improve location rules.', 'Add one non-seat room object.', '#freeformObjectTool', { workflow: 'room', expandLayoutTools: true, check: CHECKS.freeformObjectAdded }),
        simpleStep('move', 'Move an object', 'Drag an unlocked object or use the arrow keys after selecting it.', 'Move any Freeform object to a new position.', '#seatGrid', { workflow: 'room', check: CHECKS.freeformMoved }),
        simpleStep('resize', 'Resize an object', 'Resize handles and the object inspector change width and height precisely.', 'Resize the selected seat or room object.', '#freeformObjectInspector', { workflow: 'room', expandLayoutTools: true, check: CHECKS.freeformResized }),
        simpleStep('rotate', 'Rotate an object', 'Rotation helps model angled tables, boards, doors, and irregular furniture.', 'Click either corner rotation handle for a 15-degree step, drag a handle for free rotation, or enter a precise value in the inspector.', '#rotateFreeformObjectBtn', { workflow: 'room', expandLayoutTools: true, check: CHECKS.freeformRotated }),
        simpleStep('duplicate', 'Duplicate an object', 'Duplicate is faster than repeatedly rebuilding identical seats or tables.', 'Duplicate the selected object.', '#duplicateFreeformObjectBtn', { workflow: 'room', expandLayoutTools: true, check: CHECKS.freeformDuplicated }),
        simpleStep('multi-select', 'Select several objects', 'Box Select, marquee selection, Shift-click, and group selection let tools operate on several objects.', 'Select at least two Freeform objects.', '#toggleFreeformMarqueeBtn', { workflow: 'room', expandLayoutTools: true, check: CHECKS.freeformMultiSelected }),
        simpleStep('arrange', 'Align or distribute the selection', 'Alignment creates clean rows, columns, and evenly spaced pods without hand-tuning every coordinate.', 'Use any Align or Distribute command.', '#freeformMultiSelectionTools', { workflow: 'room', expandLayoutTools: true, check: CHECKS.freeformArranged }),
        simpleStep('group', 'Group the selection', 'A group lets several objects move together while preserving their relative positions.', 'Group the selected objects.', '#groupFreeformSelectionBtn', { workflow: 'room', expandLayoutTools: true, check: CHECKS.freeformGrouped }),
        simpleStep('move-group', 'Move the group', 'Grouped objects can be repositioned as one unit.', 'Move the newly created group.', '#seatGrid', { workflow: 'room', check: CHECKS.freeformGroupMoved }),
        simpleStep('ungroup', 'Ungroup the objects', 'Ungrouping returns independent control to every member.', 'Select any group member and choose Ungroup.', '#ungroupFreeformSelectionInlineBtn', { fallback: '#ungroupFreeformBtn', workflow: 'room', expandLayoutTools: true, check: CHECKS.freeformUngrouped }),
        simpleStep('lock', 'Lock an object or group', 'Locking prevents accidental movement, resizing, conversion, or reassignment.', 'Lock one selected object or group.', '#lockFreeformObjectBtn', { workflow: 'room', expandLayoutTools: true, check: CHECKS.freeformLocked }),
        simpleStep('place-student', 'Place a student into a Freeform seat', 'Freeform seats accept the same roster, locking, notes, zones, and rules as grid seats.', 'Move to Seat Students and assign one student.', '#studentList', { workflow: 'seating', panel: 'left', sideTab: 'students', check: CHECKS.assignmentAdded }),
        simpleStep('undo', 'Undo a change', 'Undo restores room and seating changes without requiring a snapshot.', 'Use Undo once, then Redo if you want the change back.', '#undoBtn', { check: CHECKS.undoUsed }),
        simpleStep('template', 'Save the Freeform room as a template', 'A template preserves room geometry without carrying student assignments.', 'Open Room Templates and save this practice room.', '#openRoomTemplatesBtn', { workflow: 'room', check: CHECKS.templateSaved })
      ]
    },
    {
      id: 'manual-seating',
      category: 'Seat students',
      title: 'Place Students Manually',
      summary: 'Select, place, swap, clear, lock, find, and undo student assignments on desktop or mobile.',
      duration: '8–10 minutes',
      difficulty: 'Beginner',
      practiceSupported: true,
      steps: [
        simpleStep('roster', 'Open the seating roster', 'Seat Students keeps the roster and room visible together.', 'Find an unassigned student in the roster.', '#studentList', { workflow: 'seating', panel: 'left', sideTab: 'students', check: CHECKS.always, requiredInPractice: false }),
        simpleStep('place', 'Place one student', 'Select or drag a student, then choose an open seat.', 'Assign one student to an open seat.', '#studentList', { workflow: 'seating', panel: 'left', check: CHECKS.assignmentAdded }),
        simpleStep('swap', 'Swap two students', 'Placing a student on an occupied seat swaps or replaces according to the selected workflow.', 'Place a second student, then move one onto the other student’s seat.', '#seatGrid', { workflow: 'seating', check: CHECKS.assignmentChanged }),
        simpleStep('lock', 'Lock an important placement', 'Locked placements remain fixed during randomization and candidate generation.', 'Lock one assigned student or seat.', '#seatGrid', { workflow: 'seating', check: CHECKS.assignmentLocked }),
        simpleStep('clear', 'Clear an assignment', 'Clearing removes the student from the seat without deleting the student record.', 'Clear one assigned seat or student assignment.', '#seatGrid', { workflow: 'seating', check: CHECKS.assignmentChanged }),
        simpleStep('mobile', 'Use mobile carry-and-place when needed', 'On a phone, select a student, switch to Room Layout, and tap the destination seat.', 'Review the mobile placement guidance. The same data and locks are used on desktop.', '#mobilePanelNav', { workflow: 'seating', check: CHECKS.always, requiredInPractice: false }),
        simpleStep('undo', 'Recover a mistaken placement', 'Undo and Redo are faster than manually reconstructing a chart after a mistaken swap.', 'Use Undo once.', '#undoBtn', { check: CHECKS.undoUsed })
      ]
    },
    {
      id: 'random-seating',
      category: 'Seat students',
      title: 'Create Random Seating',
      summary: 'Use quick random seating while preserving locks, absences, unusable seats, and deliberate placements.',
      duration: '6–8 minutes',
      difficulty: 'Beginner',
      practiceSupported: true,
      steps: [
        simpleStep('locks', 'Review locked placements', 'Random seating preserves locked or manual assignments and fills only the remaining seats.', 'Lock any placement that must not move, or continue without locks.', '#seatGrid', { workflow: 'seating', check: CHECKS.always, requiredInPractice: false }),
        simpleStep('randomize', 'Randomize and seat everyone', 'Randomize clears unlocked assignments, shuffles eligible students, and fills usable seats.', 'Choose Randomize + Seat Everyone.', '#randomizeAllBtn', { workflow: 'seating', check: CHECKS.randomizationUsed }),
        simpleStep('review', 'Review the result', 'Random does not mean rule-aware perfection. Check locks, absences, open seats, and obvious conflicts.', 'Open Review or Analyze the chart.', '#analyzeBtn', { workflow: 'review', panel: 'right', check: CHECKS.analysisUsed }),
        simpleStep('undo', 'Undo the random chart', 'Undo restores the previous assignment state immediately.', 'Use Undo to return to the previous chart.', '#undoBtn', { check: CHECKS.undoUsed }),
        simpleStep('again', 'Create a different random chart', 'A second randomization should produce a different arrangement while preserving the same fixed placements.', 'Return to Seat Students and randomize again.', '#randomizeAllBtn', { workflow: 'seating', check: CHECKS.randomizationUsed }),
        simpleStep('plan', 'Save a useful result as a named plan', 'Named plans preserve an arrangement for later comparison or restoration.', 'Open Plans and save the current chart.', '#openSeatingPlansBtn', { workflow: 'seating', check: CHECKS.seatingPlanSaved })
      ]
    },
    {
      id: 'best-fit-seating',
      category: 'Seat students',
      title: 'Generate and Compare Best-Fit Seating',
      summary: 'Generate rule-aware candidates, understand scores, request unique alternatives, apply one, and save it.',
      duration: '10–14 minutes',
      difficulty: 'Intermediate',
      practiceSupported: true,
      steps: [
        simpleStep('rules', 'Review the rules being scored', 'Candidate generation uses shared rules, individual needs, zones, reserved seats, room objects, and locked placements.', 'Review Groups & Seating Rules before generation.', '#classSetupRulesPanel .class-setup-section-heading', { workflow: 'setup', classSetupSection: 'rules', check: CHECKS.always, requiredInPractice: false }),
        simpleStep('generate', 'Generate candidate seating plans', 'Generation creates several alternatives instead of immediately replacing the current chart.', 'Choose Generate Chart.', '#generateBtn', { workflow: 'seating', check: CHECKS.candidateGenerated, requiredInExplain: true }),
        simpleStep('compare', 'Compare candidate cards', 'Each candidate explains required conflicts, fulfilled preferences, student movement, and other trade-offs.', 'Select a candidate card to inspect its details.', '#seatingCandidateGrid', { check: CHECKS.candidateInspected }),
        simpleStep('details', 'Read the explanation, not just the score', 'Scores are comparative. Required conflicts and named student or rule findings matter more than a raw number.', 'Review the candidate detail panel and identify one trade-off.', '#seatingCandidateDetail', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('more', 'Generate genuinely different options', 'Generate More advances the batch seed and excludes assignments already shown.', 'Choose Generate Different Options.', '#generateMoreCandidatesBtn', { check: CHECKS.moreCandidatesGenerated }),
        simpleStep('apply', 'Apply a candidate', 'Applying changes the current chart only after you choose the candidate.', 'Select a candidate and choose Apply.', '#acceptSeatingCandidateBtn', { check: CHECKS.candidateApplied }),
        simpleStep('analyze', 'Analyze the applied chart', 'Analysis verifies placements and explains remaining rule conflicts or warnings.', 'Open Analyze and review the result.', '#analyzeBtn', { workflow: 'review', panel: 'right', check: CHECKS.analysisUsed }),
        simpleStep('undo', 'Undo the applied candidate', 'Undo restores the chart that existed before the candidate was applied.', 'Use Undo once.', '#undoBtn', { check: CHECKS.undoUsed }),
        simpleStep('save-plan', 'Save the preferred chart', 'Named plans preserve a useful candidate without replacing snapshots or external backups.', 'Apply or restore the preferred chart, then save a named plan.', '#openSeatingPlansBtn', { workflow: 'seating', check: CHECKS.seatingPlanSaved })
      ]
    },
    {
      id: 'groups-rules-zones',
      category: 'Class setup',
      title: 'Use Groups, Rules, Student Needs, and Zones',
      summary: 'Model relationships and location preferences without over-constraining candidate generation.',
      duration: '10–14 minutes',
      difficulty: 'Intermediate',
      practiceSupported: true,
      steps: [
        simpleStep('rule', 'Create a shared seating rule', 'Use together, apart, spread, support, location, or special rules for needs shared by several students.', 'Create one rule and choose at least two students.', '#addGroupBtn', { workflow: 'setup', classSetupSection: 'rules', check: CHECKS.groupAdded }),
        simpleStep('priority', 'Choose required versus preferred behavior', 'High priority and required rules constrain the generator more strongly. Too many hard rules can leave no valid chart.', 'Review the rule priority and use the minimum strength that matches the real need.', '#groupPriority', { workflow: 'setup', classSetupSection: 'rules', check: CHECKS.always, requiredInPractice: false }),
        simpleStep('individual', 'Use Student Needs for one student', 'Front, aisle, access, distance, and other individual needs belong on the student record rather than in a group.', 'Open an individual student requirement and review its options.', '#classSetupRequirementsPanel', { workflow: 'setup', classSetupSection: 'requirements', check: CHECKS.studentEditorOpened, requiredInPractice: false, requiredInExplain: true }),
        simpleStep('zone', 'Create a named zone', 'Zones give meaningful names to room areas such as Near Teacher, Quiet Work, or Accessible Path.', 'Create one zone.', '#addZoneBtn', { workflow: 'setup', classSetupSection: 'zones', check: CHECKS.zoneAdded }),
        simpleStep('apply-zone', 'Assign seats to the zone', 'A zone does nothing until seats are included in it.', 'Move to Room Design, select seats, and apply the zone.', '#applyZoneToSelectionBtn', { workflow: 'room', expandLayoutTools: true, check: CHECKS.zoneApplied }),
        simpleStep('connect', 'Connect a rule or need to the zone', 'Zone preferences can be shared by a group or assigned to one student.', 'Return to Groups & Rules or Student Needs and choose the new zone.', '#groupZoneSelect', { workflow: 'setup', classSetupSection: 'rules', check: CHECKS.always, requiredInPractice: false }),
        simpleStep('generate', 'Generate a chart using the rules', 'The generator balances required constraints first and then compares preferred outcomes.', 'Generate candidates and inspect whether the new rule or zone was honored.', '#generateBtn', { workflow: 'seating', check: CHECKS.candidateGenerated }),
        simpleStep('review', 'Resolve conflicts intentionally', 'A warning may be acceptable; a required conflict usually needs a rule, room, or lock change.', 'Open Review and inspect the rule results.', '#analyzeBtn', { workflow: 'review', panel: 'right', check: CHECKS.analysisUsed })
      ]
    },
    {
      id: 'today-mode',
      category: 'Daily use',
      title: 'Use Today Mode',
      summary: 'Handle absences, guests, temporary notes, and day-only seating without changing the master chart.',
      duration: '6–8 minutes',
      difficulty: 'Beginner',
      practiceSupported: true,
      steps: [
        simpleStep('open', 'Open Today mode', 'Today mode keeps temporary classroom changes separate from the permanent roster and master seating plan.', 'Open Today.', '#todayModeBtn', { workflow: 'seating', check: () => el('todayModeModal')?.classList.contains('show'), requiredInExplain: true }),
        simpleStep('enable', 'Enable Today mode', 'Turning Today mode on captures the master assignments so they can be restored later.', 'Enable Use Today mode.', '#todayModeActiveToggle', { check: CHECKS.todayEnabled }),
        simpleStep('attendance', 'Mark an absence', 'Absent students are excluded from day-only generation without being removed from the roster.', 'Mark at least one student absent.', '#todayAttendanceList', { check: () => signalSeen('today-attendance-changed') }),
        simpleStep('guest', 'Add a guest', 'Guests can be included for one day without creating a permanent roster record.', 'Enter a guest name and add the guest.', '#addTodayGuestBtn', { check: CHECKS.todayGuestAdded }),
        simpleStep('note', 'Add a temporary note', 'Today-only notes can explain testing, substitute, or schedule changes.', 'Enter a temporary note.', '#todayNoteInput', { check: () => Boolean(el('todayNoteInput')?.value.trim()) }),
        simpleStep('save', 'Save the daily state', 'Save Today records the attendance, guests, and temporary note.', 'Choose Save Today.', '#saveTodayModeBtn', { check: CHECKS.todaySaved }),
        simpleStep('restore', 'Return to the master chart', 'Restore Master Seating or end Today mode when the temporary situation is over.', 'Review the restore controls. Do not end the practice mode unless you are ready.', '#restoreMasterFromTodayBtn', { check: CHECKS.always, requiredInPractice: false })
      ]
    },
    {
      id: 'save-recover',
      category: 'Save and recover',
      title: 'Save, Snapshot, and Recover Safely',
      summary: 'Understand browser autosave, durable files, Drive, snapshots, named plans, selective restore, and recovery.',
      duration: '10–12 minutes',
      difficulty: 'Intermediate',
      practiceSupported: true,
      steps: [
        simpleStep('status', 'Read the current save status', 'The top save status explains whether work is only in browser storage, linked to a file, synchronized to Drive, paused, or needs attention.', 'Open the save status.', '#inlineSaveStatus', { workflow: 'share', check: CHECKS.saveOptionsOpened, requiredInExplain: true }),
        simpleStep('snapshot', 'Take a restore-point snapshot', 'Snapshots are fast, named checkpoints inside the planner.', 'Close Save Options if needed, then use the camera beside Settings.', '#snapshotQuickBtn', { workflow: 'share', check: CHECKS.snapshotCreated }),
        simpleStep('change', 'Make a visible practice change', 'A restore point becomes meaningful only after something changes.', 'Move or reassign one student in the practice class.', '#seatGrid', { workflow: 'seating', check: CHECKS.assignmentChanged }),
        simpleStep('snapshot-list', 'Open snapshot history', 'The snapshot list previews and restores earlier application states.', 'Open the Snapshot Timeline and locate the checkpoint you created.', '#openSnapshotTimelineBtn', { check: () => el('snapshotModal')?.classList.contains('show'), requiredInExplain: true, prepare: () => openSettingsPageForLearning('snapshots') }),
        simpleStep('plans', 'Know when to use named seating plans', 'Named plans preserve seating arrangements for comparison; snapshots protect broader application state.', 'Open Plans and review the saved-plan tools.', '#openSeatingPlansBtn', { workflow: 'seating', check: () => el('seatingPlansModal')?.classList.contains('show'), requiredInExplain: true }),
        simpleStep('durable', 'Choose a durable save destination', 'A linked file, Drive copy, or downloaded backup protects against browser cleanup and device loss.', 'Open Save Options and review the available durable methods.', '#inlineSaveStatus', { workflow: 'share', check: CHECKS.saveOptionsOpened, requiredInExplain: true }),
        simpleStep('download', 'Create a portable backup', 'Downloaded backups can be stored in district-approved storage and restored on another device.', 'Review Download All Classes or the complete backup package.', '#saveSetupModal', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('restore', 'Use selective restore carefully', 'Selective restore can recover classes, templates, settings, or snapshots without replacing everything.', 'Review the restore/upload controls before using them with real data.', '#saveSetupModal', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('health', 'Run Save Health when uncertain', 'Save Health verifies encryption, browser records, snapshots, linked files, and cloud status.', 'Open Settings → Saving and review Save Health.', '#saveHealthPanel', { check: CHECKS.always, requiredInPractice: false, prepare: () => openSettingsPageForLearning('saving') })
      ]
    },
    {
      id: 'print-share',
      category: 'Print and share',
      title: 'Print and Create Safe Classroom Packages',
      summary: 'Choose print fields, substitute notes, privacy presets, and read-only packages for the intended audience.',
      duration: '7–9 minutes',
      difficulty: 'Beginner',
      practiceSupported: true,
      steps: [
        simpleStep('open', 'Open Print Options', 'Print Options separates what is visible on screen from what is included in the output.', 'Open Print Options.', '#printBtn', { workflow: 'share', check: CHECKS.printOptionsOpened, requiredInExplain: true }),
        simpleStep('mode', 'Choose the print type', 'Print as seen, clean names only, and substitute print serve different audiences.', 'Choose a print type and review the explanation.', '#printOptionMode', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('details', 'Choose student details', 'Names, grade, nickname, ID, and other fields should be included only when the audience needs them.', 'Review the student-detail checkboxes.', '#printOptionsModal .print-options-grid', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('notes', 'Choose note categories deliberately', 'Substitute notes may be appropriate while private notes are not.', 'Review the note-category choices.', '#printNoteSubstituteLabel', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('preview', 'Open print preview', 'Preview catches clipping, unwanted details, and page-layout problems before printing.', 'Open Print Preview.', '#openPrintPreviewBtn', { check: CHECKS.printPreviewOpened, requiredInExplain: true }),
        simpleStep('safe-share', 'Create a read-only package', 'Safe Sharing creates audience-specific HTML without including the editable application or hidden sensitive data.', 'Open Safe Sharing and choose an audience preset.', '#downloadReadOnlyClassroomBtn', { workflow: 'share', check: CHECKS.safeShareOpened, requiredInExplain: true }),
        simpleStep('verify', 'Verify the audience before sending', 'Teacher, substitute, student-facing, support-team, anonymous, and room-only packages include different information.', 'Review the preview before downloading or sharing.', '#safeSharePreview', { check: CHECKS.always, requiredInPractice: false })
      ]
    },
    {
      id: 'security-privacy',
      category: 'Security and privacy',
      title: 'Set Up Security, Locking, and Privacy',
      summary: 'Use the Security Guided Help to verify encryption, Settings access, Lock and Presentation PINs, auto-lock, and encrypted storage.',
      duration: '7–9 minutes',
      difficulty: 'Intermediate',
      practiceSupported: false,
      steps: [
        simpleStep('open', 'Open Security Guided Help', 'The security wizard gathers the related controls in one status-driven checklist.', 'Open Settings > Security & Data, then choose Open Security Guided Help.', '#securitySetupWizardOpenBtn', { check: CHECKS.securityWizardOpened, requiredInExplain: true, prepare: () => openSettingsPageForLearning('security') }),
        simpleStep('encryption', 'Verify the encryption password', 'The active encryption password protects browser saves, snapshots, downloaded saves, Drive saves, and protected viewer packages. It is not recoverable unless a recovery package was created beforehand.', 'Review Encryption password status.', '#securityWizardSteps [data-security-check="encryption"]', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('settings-access', 'Protect Settings access', 'Settings can require the Lock PIN, Presentation PIN, encryption password, or an automatic fallback order. No prompt is available but should be intentional.', 'Open Settings access requirement and review the selected method.', '#securityWizardSteps [data-security-check="settings"]', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('lock-pin', 'Configure the Lock PIN', 'The Lock PIN restores a normally locked or auto-locked page. It is stored as a salted PBKDF2 hash rather than plain text.', 'Review the Lock PIN row.', '#securityWizardSteps [data-security-check="lock"]', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('eye-pin', 'Configure the Presentation Mode PIN', 'Presentation Mode hides disallowed details and uses its exit PIN without exposing the full encryption password during ordinary classroom display.', 'Review the Presentation Mode PIN row.', '#securityWizardSteps [data-security-check="eye"]', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('autolock', 'Choose auto-lock triggers', 'Inactivity, window blur, hidden-tab, and return-after-time rules can protect an unattended classroom screen.', 'Review the Auto-lock rules row.', '#securityWizardSteps [data-security-check="autolock"]', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('storage', 'Confirm encrypted browser storage', 'After setup, save once so the current browser record and snapshot index are encrypted with the active password.', 'Review Storage encryption status.', '#securityWizardSteps [data-security-check="storage"]', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('finish', 'Save and finish deliberately', 'Valid fields auto-save; Save Security Setup provides an explicit checkpoint. Unmatched PIN fields prevent completion.', 'Use Save Security Setup or Done after the checklist reflects the intended policy.', '#securityWizardSaveBtn', { check: CHECKS.always, requiredInPractice: false })
      ]
    },
    {
      id: 'drive-collaboration',
      category: 'Google Drive sharing',
      title: 'Share an Editable Drive Save with Other Staff',
      summary: 'Choose collaborators, combine Drive roles with per-person planner access, explain how recipients open the file, and understand revision-aware merging.',
      duration: '6–8 minutes',
      difficulty: 'Intermediate',
      practiceSupported: false,
      steps: [
        simpleStep('open', 'Open Share and collaborate', 'The collaborator picker belongs to the active Google Drive save, not to browser-only autosave or a downloaded file.', 'Open Save & Share > Share Drive Save with People, the disk menu command, or Settings > Google > Share Current Drive Save.', '#openSharedDriveManagerBtn', { workflow: 'share', check: CHECKS.sharedDriveManagerOpened, requiredInExplain: true }),
        simpleStep('prerequisite', 'Confirm the active Drive file', 'Connect Drive and save or load the master file first. The status line names the Drive file and whether the current account may manage sharing.', 'Read the sharing status before adding anyone.', '#sharedDriveStatus', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('email', 'Choose the person', 'Enter the Google-account email that should receive access. Google Drive owns this permission; the planner does not create a separate app account.', 'Review the Google account email field.', '#sharedDriveEmail', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('role', 'Choose Drive Viewer or Editor', 'Drive Viewer is always read-only. Drive Editor allows saving only when the planner interface profile also grants Can edit access to the relevant area.', 'Choose the least Drive access the recipient needs.', '#sharedDriveRole', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('interface-access', 'Choose the planner areas this person can use', 'Start with Full editor, Seating assistant, Room designer, Roster and rules editor, or Reviewer and printer. Expand the custom grid to set Class Setup, Room Design, Seat Students, Review/Print, Save, Share, Settings, and Class Management to Hidden, View only, or Can edit.', 'Review the Planner interface access preset and its eight-area permission grid.', '#sharedDriveInterfacePreset', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('notify', 'Send useful opening instructions', 'Google can notify the recipient. The message should identify the district-hosted planner and tell the recipient to connect the Google account that received access.', 'Review the notification and optional message controls.', '#sharedDriveNotify', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('permissions', 'Review and maintain access', 'Current Drive permissions lets the owner change Viewer/Editor roles, change presets, customize each interface area, save the interface profile, or remove a collaborator later.', 'Review the permission list and the Save interface access action.', '#sharedDrivePermissionList', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('recipient', 'Explain how the recipient opens the save', 'The recipient opens the same hosted planner, connects Drive, and uses Load from Drive or Manage Saves & Revisions. Google Picker may be required to grant per-file access when the deployment provides it.', 'Use Copy Drive link only as a convenience; the recipient still opens the file through the planner.', '#copySharedDriveLinkBtn', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('merge', 'Understand multi-user timing', 'This is not live cursor-level co-editing. The app checks Drive revisions when saving, merges non-overlapping changes, and asks which value wins for overlapping edits.', 'Remember that another editor sees changes after loading or refreshing the Drive copy.', '#sharedDriveHowTo', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('viewer', 'Use a viewer package when data must be excluded', 'Planner interface profiles hide or disable controls but do not remove fields from the encrypted master save. A password-protected read-only HTML or encrypted viewer file is safer for substitutes, students, or anyone who should not receive parts of the master data.', 'Review the separate encrypted viewer controls and send its password through another channel.', '#sharedViewerPreset', { check: CHECKS.always, requiredInPractice: false })
      ]
    },
    {
      id: 'google-connections',
      category: 'Google tools',
      title: 'Connect Google Drive and Google Classroom',
      summary: 'Understand authorization, Drive saves, revisions, conflicts, Classroom rosters, and deployment-managed Picker support.',
      duration: '8–10 minutes',
      difficulty: 'Intermediate',
      practiceSupported: false,
      steps: [
        simpleStep('settings', 'Open the Google Settings page', 'Google Drive and Classroom authorization are managed centrally without asking teachers for API keys.', 'Open Settings → Google.', '#settingsPageGoogle', { check: CHECKS.settingsGoogleOpened, prepare: () => openSettingsPageForLearning('google') }),
        simpleStep('drive-auth', 'Connect Google Drive', 'Drive uses a narrow OAuth scope to create, update, list, revise, and manage files available to the planner.', 'Use Connect Drive when the hosted deployment is configured.', '#googleHubDriveConnectBtn', { check: CHECKS.driveActionUsed, requiredInPractice: false }),
        simpleStep('drive-files', 'Manage Drive saves', 'The Drive manager can choose the active file, rename, duplicate, open, trash, and browse revisions.', 'Open Manage Drive Files and review the controls.', '#settingsGoogleDriveManageBtn', { check: () => el('driveManagerModal')?.classList.contains('show'), requiredInPractice: false, requiredInExplain: true }),
        simpleStep('sharing', 'Know where collaborators are chosen', 'After a Drive save is active, use Save & Share > Share Drive Save with People, the disk menu command, or Settings > Google > Share Current Drive Save. The dedicated Drive Sharing lesson explains roles and recipient opening steps.', 'Review the Share Current Drive Save entry point.', '#googleHubDriveShareBtn', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('conflicts', 'Understand revision-aware conflicts', 'Before overwriting, the planner compares version, head revision, checksum, and modified time. If a real conflict occurs, the choices are overwrite deliberately, save a new copy, merge, or cancel.', 'Review the Drive manager status and remember that the conflict window appears only when a genuine remote change is detected.', '#driveManagerStatus', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('picker', 'Understand optional Google Picker', 'Picker is a deployment feature for browsing other Drive files. Teachers never enter API keys or project IDs.', 'Check the Picker deployment status on the Google page.', '#googleHubPickerStatus', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('classroom-auth', 'Connect Google Classroom', 'Classroom uses separate read-only course and roster scopes.', 'Connect Classroom when authorized by the district.', '#googleHubClassroomConnectBtn', { check: CHECKS.classroomActionUsed, requiredInPractice: false }),
        simpleStep('course', 'Choose a Classroom course', 'Selecting a course loads its roster into the reconciliation preview instead of replacing the current class immediately.', 'Refresh courses, choose one, and review the roster preview.', '#googleHubClassroomCourseSelect', { check: CHECKS.always, requiredInPractice: false }),
        simpleStep('privacy', 'Keep deployment and privacy boundaries clear', 'OAuth client IDs and restricted Picker keys belong to the deployment. Student data should follow district storage and retention policies.', 'Review the Google deployment and privacy guidance before broad rollout.', '#settingsPageGoogle', { check: CHECKS.always, requiredInPractice: false, prepare: () => openSettingsPageForLearning('google') })
      ]
    }
  ]);

  function lessonById(id) {
    return LESSONS.find(lesson => lesson.id === id) || LESSONS[0];
  }

  function activeLesson() {
    return lessonById(learningState.lessonId);
  }

  function activeStep() {
    const lesson = activeLesson();
    return lesson.steps[Math.max(0, Math.min(lesson.steps.length - 1, learningState.stepIndex))];
  }

  function defaultProgress() {
    return {
      version: PROGRESS_VERSION,
      completedLessons: [],
      completedSteps: {},
      resume: null,
      practiceClasses: {}
    };
  }

  function loadProgress() {
    try {
      const parsed = JSON.parse(safeStorageGet('localStorage', STORAGE_KEY) || 'null');
      if (!parsed || parsed.version !== PROGRESS_VERSION) return defaultProgress();
      return {
        ...defaultProgress(),
        ...parsed,
        completedLessons: Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [],
        completedSteps: parsed.completedSteps && typeof parsed.completedSteps === 'object' ? parsed.completedSteps : {},
        practiceClasses: parsed.practiceClasses && typeof parsed.practiceClasses === 'object' ? parsed.practiceClasses : {}
      };
    } catch {
      return defaultProgress();
    }
  }

  function saveProgress(progress) {
    safeStorageSet('localStorage', STORAGE_KEY, JSON.stringify(progress));
  }

  function currentResumeRecord() {
    if (!learningState.lessonId) return null;
    return {
      lessonId: learningState.lessonId,
      mode: learningState.mode,
      stepIndex: learningState.stepIndex,
      practiceClassId: learningState.practiceClassId || '',
      updatedAt: new Date().toISOString()
    };
  }

  function updateResumeProgress(resume = learningState.active ? currentResumeRecord() : null) {
    const progress = loadProgress();
    progress.resume = resume;
    saveProgress(progress);
    renderHelpProgress();
    updateResumeButtons(progress);
  }

  function updateResumeButtons(progress = loadProgress()) {
    const resume = progress.resume;
    const helpButton = el('helpGuideResumeLessonBtn');
    if (helpButton) {
      helpButton.hidden = !resume?.lessonId;
      helpButton.textContent = resume?.lessonId ? `Resume ${lessonById(resume.lessonId).title}` : 'Resume lesson';
    }
    const settingsButton = el('settingsResumeLessonBtn');
    if (settingsButton) {
      settingsButton.disabled = !resume?.lessonId;
      settingsButton.textContent = resume?.lessonId ? 'Resume last lesson' : 'No lesson to resume';
    }
  }

  function markStepComplete(lessonId, stepId) {
    const progress = loadProgress();
    const completed = new Set(progress.completedSteps[lessonId] || []);
    completed.add(stepId);
    progress.completedSteps[lessonId] = [...completed];
    saveProgress(progress);
  }

  function markLessonComplete(lessonId) {
    const progress = loadProgress();
    const completed = new Set(progress.completedLessons || []);
    completed.add(lessonId);
    progress.completedLessons = [...completed];
    progress.resume = null;
    saveProgress(progress);
  }

  function practiceStudents() {
    const names = [
      ['Ava', 'Smith'], ['Liam', 'Jones'], ['Mia', 'Patel'], ['Noah', 'Brown'],
      ['Sophia', 'Garcia'], ['Ethan', 'Kim'], ['Isabella', 'Lee'], ['Mason', 'Davis'],
      ['Olivia', 'Miller'], ['Lucas', 'Wilson'], ['Emma', 'Moore'], ['James', 'Taylor']
    ];
    return names.map(([firstName, lastName], index) => normalizeStudent({
      id: `practice-${index + 1}`,
      firstName,
      lastName,
      grade: '6',
      notesPublic: index === 2 ? 'Uses glasses for board work.' : '',
      notesSubstitute: index === 5 ? 'Benefits from written directions.' : ''
    }));
  }

  function practiceGridCells(rows = 4, cols = 4) {
    const cells = {};
    for (let row = 1; row <= rows; row += 1) {
      for (let col = 1; col <= cols; col += 1) {
        cells[keyOf(row, col)] = {
          row,
          col,
          type: 'seat',
          assignedStudentId: null,
          manual: false,
          anchorGroupIds: [],
          zoneIds: []
        };
      }
    }
    cells[keyOf(1, 1)].type = 'teacher';
    cells[keyOf(1, cols)].type = 'board';
    cells[keyOf(rows, cols)].type = 'door';
    return cells;
  }

  function practiceFreeformLayout() {
    const objects = [];
    let index = 0;
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        objects.push(normalizeFreeformObject({
          id: `practice-seat-${++index}`,
          type: 'seat',
          label: `Seat ${index}`,
          x: 180 + col * 220,
          y: 260 + row * 160,
          width: DEFAULT_FREEFORM_SEAT_WIDTH,
          height: DEFAULT_FREEFORM_SEAT_HEIGHT
        }, index));
      }
    }
    objects.push(normalizeFreeformObject({ id: 'practice-board', type: 'board', label: 'Front board', x: 280, y: 60, width: 620, height: 70 }, objects.length));
    objects.push(normalizeFreeformObject({ id: 'practice-door', type: 'door', label: 'Door', x: 1050, y: 680, width: 110, height: 180 }, objects.length));
    objects.push(normalizeFreeformObject({ id: 'practice-table', type: 'table', label: 'Small-group table', x: 1080, y: 260, width: 280, height: 180 }, objects.length));
    return normalizeFreeformLayout({
      canvas: { width: 1600, height: 1000, gridSize: 20, snap: true, magneticGuides: true, showMinimap: true, frontSide: 'top' },
      objects,
      groups: []
    });
  }

  function buildPracticeClass(lessonId) {
    const students = practiceStudents();
    const freeform = lessonId === 'freeform-room';
    const record = createClassRecord(`${PRACTICE_CLASS_PREFIX} ${lessonById(lessonId).title}`);
    Object.assign(record, {
      guidedPractice: true,
      guidedLessonId: lessonId,
      guidedCreatedAt: new Date().toISOString(),
      students,
      rows: 4,
      cols: 4,
      cells: practiceGridCells(4, 4),
      layoutMode: freeform ? 'freeform' : 'grid',
      freeformLayout: freeform ? practiceFreeformLayout() : normalizeFreeformLayout(null),
      groups: [
        normalizeGroupRecord({ id: 'practice-apart', name: 'Keep Apart', type: 'avoid', priority: 9, color: '#e11d48', studentIds: ['practice-1', 'practice-2'] }),
        normalizeGroupRecord({ id: 'practice-support', name: 'Front Support', type: 'special', priority: 8, color: '#2563eb', studentIds: ['practice-3', 'practice-6'] }),
        normalizeGroupRecord({ id: 'practice-peers', name: 'Peer Helpers', type: 'together', priority: 5, color: '#16a34a', studentIds: ['practice-7', 'practice-9', 'practice-11'] })
      ],
      zones: [normalizeZoneRecord({ id: 'practice-front-zone', name: 'Near Front', color: '#8b5cf6', seatKeys: [] })],
      chartMeta: normalizeChartMeta({ title: 'Guided Practice', room: 'Practice Room', teacher: 'Training' }),
      snapshots: [],
      seatingPlans: []
    });
    return normalizeClassRecord(record);
  }

  function ensurePracticeClass(lessonId) {
    persistActiveClass();
    const progress = loadProgress();
    let practiceClass = state.classes.find(classRecord => classRecord.guidedPractice && classRecord.guidedLessonId === lessonId);
    if (!practiceClass) {
      practiceClass = buildPracticeClass(lessonId);
      state.classes.push(practiceClass);
    }
    progress.practiceClasses[lessonId] = practiceClass.id;
    saveProgress(progress);
    learningState.practiceClassId = practiceClass.id;
    state.activeClassId = practiceClass.id;
    applyClassToState(practiceClass.id);
    renderAll();
    setLiveStatusMessage(`Practice class ready for ${lessonById(lessonId).title}. Real classes were not changed.`);
    return practiceClass;
  }

  function deletePracticeClass(classId, returnClassId = '') {
    persistActiveClass();
    const index = state.classes.findIndex(classRecord => classRecord.id === classId && classRecord.guidedPractice);
    if (index < 0) return false;
    state.classes.splice(index, 1);
    const next = state.classes.find(classRecord => classRecord.id === returnClassId) || state.classes.find(classRecord => !classRecord.guidedPractice) || state.classes[0];
    if (!next) state.classes.push(createClassRecord('Class 1'));
    state.activeClassId = (next || state.classes[0]).id;
    applyClassToState(state.activeClassId);
    renderAll();
    const progress = loadProgress();
    Object.entries(progress.practiceClasses).forEach(([lessonId, storedId]) => {
      if (storedId === classId) delete progress.practiceClasses[lessonId];
    });
    saveProgress(progress);
    return true;
  }

  function openSettingsPageForLearning(page) {
    uiState.activeSettingsPage = page;
    requestOpenSettingsModal();
    setTimeout(() => {
      if (el('settingsModal')?.classList.contains('show')) setSettingsPage(page);
    }, 80);
  }

  function modalContextLabel(modal) {
    if (!(modal instanceof Element)) return 'the required window';
    const labelledBy = modal.getAttribute('aria-labelledby');
    const labelledNode = labelledBy ? document.getElementById(labelledBy) : null;
    const text = labelledNode?.textContent?.trim() || modal.querySelector('.panel-header h2, .panel-header h3, h2, h3')?.textContent?.trim();
    return text || modal.id.replace(/Modal$/, '').replace(/([a-z])([A-Z])/g, '$1 $2') || 'the required window';
  }

  function clickLearningControl(id) {
    const control = el(id);
    if (!control || control.disabled) return false;
    control.click();
    return true;
  }

  function modalContextOpener(modal) {
    const modalId = modal?.id || '';
    const openers = {
      settingsModal: () => {
        requestOpenSettingsModal();
        return true;
      },
      todayModeModal: () => clickLearningControl('todayModeBtn'),
      printOptionsModal: () => {
        openPrintOptionsModal();
        return true;
      },
      snapshotModal: () => {
        openSnapshotModal();
        return true;
      },
      seatingPlansModal: () => clickLearningControl('openSeatingPlansBtn'),
      roomTemplateModal: () => {
        openRoomTemplateModal();
        return true;
      },
      saveSetupModal: () => {
        openSaveSetupModal();
        return true;
      },
      safeShareModal: () => {
        ModernizationSuite.openSafeShare();
        return true;
      },
      studentEditModal: () => {
        const studentId = state.students?.[0]?.id;
        if (!studentId) return false;
        openStudentEditModal(studentId);
        return true;
      },
      seatingCandidateModal: () => clickLearningControl('generateBtn'),
      driveManagerModal: () => {
        void DistrictIntegrationsV57.openDriveManager();
        return true;
      },
      sharedDriveModal: () => {
        SharedDriveCollaborationV64.openManager();
        return true;
      },
      securitySetupWizardModal: () => clickLearningControl('securitySetupWizardOpenBtn'),
      helpGuideModal: () => {
        openHelpGuideModal();
        return true;
      }
    };
    return openers[modalId] || null;
  }

  function closeModalForLearning(modal) {
    if (!(modal instanceof Element)) return false;
    const closeButton = modal.querySelector([
      'button[id^="close"]',
      'button[id^="cancel"]',
      'button[id$="CancelBtn"]',
      'button[data-modal-close]'
    ].join(', '));
    if (closeButton && !closeButton.disabled) {
      closeButton.click();
    } else {
      modal.classList.remove('show');
    }
    DialogManager.synchronize();
    return true;
  }

  function rawStepTarget(step) {
    for (const selector of [step.selector, step.fallback]) {
      if (!selector) continue;
      const target = document.querySelector(selector);
      if (target instanceof Element) return target;
    }
    return null;
  }

  function elementIsContextVisible(target) {
    if (!(target instanceof Element) || !target.isConnected) return false;
    let current = target;
    while (current && current !== document.documentElement) {
      if (current.hidden || current.getAttribute('aria-hidden') === 'true') return false;
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      current = current.parentElement;
    }
    return true;
  }

  function contextTarget(step) {
    for (const selector of [step.selector, step.fallback]) {
      if (!selector) continue;
      const target = document.querySelector(selector);
      if (elementIsContextVisible(target)) return target;
    }
    return null;
  }

  function stepRequiresAction(step) {
    return learningState.mode === 'practice' ? step.requiredInPractice : step.requiredInExplain;
  }

  function inspectStepContext(step) {
    let rawTarget = rawStepTarget(step);
    if (stepRequiresAction(step)) {
      try {
        if (step.check()) {
          return { ready: true, target: null, reason: '', action: null, actionLabel: '', actionComplete: true };
        }
      } catch {
         
      }
    }
    let explicitContextReady = true;
    if (typeof step.contextCheck === 'function') {
      try {
        explicitContextReady = Boolean(step.contextCheck());
      } catch {
        explicitContextReady = false;
      }
    }

    if (!rawTarget) {
      return {
        ready: false,
        target: null,
        reason: step.contextHelp || 'The control for this step is not available in the current interface state.',
        action: typeof step.openContext === 'function' ? step.openContext : null,
        actionLabel: step.actionLabel || 'Open it for me'
      };
    }

    DialogManager.synchronize();
    const targetModal = rawTarget.closest('.modal-backdrop');
    const topModal = DialogManager.top();

    if (targetModal && !targetModal.classList.contains('show')) {
      const opener = typeof step.openContext === 'function' ? step.openContext : modalContextOpener(targetModal);
      const label = step.contextLabel || modalContextLabel(targetModal);
      return {
        ready: false,
        target: rawTarget,
        reason: step.contextHelp || `${label} is not open. Open it before continuing so the lesson can point to the correct controls.`,
        action: opener,
        actionLabel: step.actionLabel || `Open ${label}`
      };
    }

    if (topModal && topModal !== targetModal) {
      const label = modalContextLabel(topModal);
      return {
        ready: false,
        target: rawTarget,
        reason: `${label} is covering the controls for this step. Close it before continuing.`,
        action: () => closeModalForLearning(topModal),
        actionLabel: `Close ${label}`
      };
    }

    if (document.body.classList.contains('print-preview-active') && !rawTarget.closest('#printPreviewBanner')) {
      return {
        ready: false,
        target: rawTarget,
        reason: 'Print Preview is still active and is hiding the normal workspace.',
        action: () => clickLearningControl('exitPrintPreviewBtn'),
        actionLabel: 'Exit Print Preview'
      };
    }

    const target = contextTarget(step);
    if (!target || !explicitContextReady) {
      return {
        ready: false,
        target: rawTarget,
        reason: step.contextHelp || 'The expected panel or control is not ready yet. Open the requested area, then try again.',
        action: typeof step.openContext === 'function' ? step.openContext : () => {
          prepareStep(step);
          return true;
        },
        actionLabel: step.actionLabel || 'Open this area'
      };
    }

    return { ready: true, target, reason: '', action: null, actionLabel: '' };
  }

  function updateContextActions(descriptor) {
    const actions = el('guidedLessonContextActions');
    const openButton = el('guidedLessonOpenContextBtn');
    const retryButton = el('guidedLessonRetryContextBtn');
    if (!actions || !openButton || !retryButton) return;
    actions.hidden = descriptor.ready;
    openButton.hidden = descriptor.ready || typeof descriptor.action !== 'function';
    openButton.textContent = descriptor.actionLabel || 'Open it for me';
    retryButton.hidden = descriptor.ready;
  }

  async function openCurrentStepContext() {
    if (!learningState.active) return;
    const descriptor = learningState.contextDescriptor || inspectStepContext(activeStep());
    if (typeof descriptor.action !== 'function') return;
    const openButton = el('guidedLessonOpenContextBtn');
    if (openButton) {
      openButton.disabled = true;
      openButton.setAttribute('aria-busy', 'true');
    }
    const status = el('guidedLessonStatus');
    if (status) {
      status.className = 'guided-learning-status waiting';
      status.textContent = 'Opening the required area…';
    }
    try {
      await descriptor.action();
    } catch (error) {
      if (status) status.textContent = `The required area could not be opened: ${error?.message || 'Unknown error'}`;
    } finally {
      if (openButton) {
        openButton.disabled = false;
        openButton.removeAttribute('aria-busy');
      }
      setTimeout(() => {
        if (!learningState.active) return;
        evaluateStep();
      }, 140);
    }
  }

  function retryCurrentStepContext() {
    if (!learningState.active) return;
    prepareStep(activeStep());
    const status = el('guidedLessonStatus');
    if (status) {
      status.className = 'guided-learning-status waiting';
      status.textContent = 'Checking the requested area again…';
    }
    setTimeout(evaluateStep, 120);
  }

  function prepareStep(step) {
    document.querySelectorAll('.v4-popover.show, .context-menu.show').forEach(node => node.classList.remove('show'));
    if (typeof WorkspaceLayoutV41 !== 'undefined') {
      WorkspaceLayoutV41.toggleFocusMode(false);
      WorkspaceLayoutV41.toggleWorkflow(false);
    }
    if (step.workflow && typeof ProductExperience !== 'undefined') {
      ProductExperience.setWorkflow(step.workflow, { silent: true });
    }
    if (step.classSetupSection && typeof ClassSetupWorkspaceV54 !== 'undefined') {
      ClassSetupWorkspaceV54.setSection(step.classSetupSection, { silent: true });
    }
    if (step.panel && typeof WorkspaceLayoutV41 !== 'undefined') {
      WorkspaceLayoutV41.togglePanel(step.panel, false);
    }
    if (step.sideTab && typeof setSideTab === 'function') setSideTab(step.sideTab);
    if (step.expandLayoutTools) {
      document.body.classList.remove('layout-tools-collapsed');
      if (typeof refreshLayoutToolsToggle === 'function') refreshLayoutToolsToggle();
    }
    if (typeof step.prepare === 'function') step.prepare();
  }

  function visibleTarget(selector) {
    if (!selector) return null;
    const target = document.querySelector(selector);
    if (!(target instanceof Element)) return null;
    const style = getComputedStyle(target);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return null;
    const rect = target.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    return target;
  }

  function clearTarget() {
    learningState.target?.classList.remove('guided-learning-target');
    learningState.target = null;
  }

  function nearestScrollContainer(target) {
    let current = target?.parentElement || null;
    while (current && current !== document.body && current !== document.documentElement) {
      const style = getComputedStyle(current);
      const scrollableY = /(auto|scroll)/.test(style.overflowY || '') && current.scrollHeight > current.clientHeight + 2;
      const scrollableX = /(auto|scroll)/.test(style.overflowX || '') && current.scrollWidth > current.clientWidth + 2;
      if (scrollableY || scrollableX) return current;
      current = current.parentElement;
    }
    return null;
  }

  function scrollTargetIntoPanel(target) {
    const container = nearestScrollContainer(target);
    if (!container || !target) {
      target?.focus?.({ preventScroll: true });
      return;
    }
    const targetRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (targetRect.top < containerRect.top) container.scrollTop -= containerRect.top - targetRect.top + 10;
    else if (targetRect.bottom > containerRect.bottom) container.scrollTop += targetRect.bottom - containerRect.bottom + 10;
    if (targetRect.left < containerRect.left) container.scrollLeft -= containerRect.left - targetRect.left + 10;
    else if (targetRect.right > containerRect.right) container.scrollLeft += targetRect.right - containerRect.right + 10;
  }

  function targetRect(target) {
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    if (!rect || rect.width < 2 || rect.height < 2) return null;
    const left = Math.max(6, rect.left - 7);
    const top = Math.max(6, rect.top - 7);
    const right = Math.min(window.innerWidth - 6, rect.right + 7);
    const bottom = Math.min(window.innerHeight - 6, rect.bottom + 7);
    if (right <= left || bottom <= top) return null;
    return { left, top, width: right - left, height: bottom - top };
  }

  function positionPopover(rect) {
    const popover = el('guidedLessonPopover');
    if (!popover) return;
    const margin = 12;
    const width = Math.min(420, window.innerWidth - 24);
    popover.style.width = `${width}px`;
    const height = Math.min(Math.max(popover.scrollHeight || 280, 220), window.innerHeight - 24);
    const box = rect || { left: margin, top: margin, width: 120, height: 44 };
    const candidates = [
      { left: box.left + box.width / 2 - width / 2, top: box.top + box.height + margin },
      { left: box.left + box.width / 2 - width / 2, top: box.top - height - margin },
      { left: box.left + box.width + margin, top: box.top + box.height / 2 - height / 2 },
      { left: box.left - width - margin, top: box.top + box.height / 2 - height / 2 }
    ];
    const fit = candidates.find(position => position.left >= margin && position.top >= margin && position.left + width <= window.innerWidth - margin && position.top + height <= window.innerHeight - margin) || candidates[0];
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    popover.style.left = `${Math.round(clamp(fit.left, margin, Math.max(margin, window.innerWidth - width - margin)))}px`;
    popover.style.top = `${Math.round(clamp(fit.top, margin, Math.max(margin, window.innerHeight - height - margin)))}px`;
  }

  function renderSpotlight(step) {
    const token = ++learningState.renderToken;
    const spotlight = el('guidedLessonSpotlight');
    requestAnimationFrame(() => setTimeout(() => {
      if (!learningState.active || token !== learningState.renderToken) return;
      let target = visibleTarget(step.selector) || visibleTarget(step.fallback);
      if (!target) {
        if (spotlight) spotlight.hidden = true;
        positionPopover(null);
        return;
      }
      target.classList.add('guided-learning-target');
      learningState.target = target;
      scrollTargetIntoPanel(target);
      requestAnimationFrame(() => {
        if (!learningState.active || token !== learningState.renderToken) return;
        target = visibleTarget(step.selector) || visibleTarget(step.fallback);
        const rect = targetRect(target);
        if (!target || !rect) {
          if (spotlight) spotlight.hidden = true;
          positionPopover(null);
          return;
        }
        target.classList.add('guided-learning-target');
        learningState.target = target;
        if (spotlight) {
          spotlight.hidden = false;
          spotlight.style.left = `${Math.round(rect.left)}px`;
          spotlight.style.top = `${Math.round(rect.top)}px`;
          spotlight.style.width = `${Math.round(rect.width)}px`;
          spotlight.style.height = `${Math.round(rect.height)}px`;
        }
        positionPopover(rect);
      });
    }, 100));
  }

  function canAdvance() {
    const step = activeStep();
    if (learningState.skippedSteps.has(step.id)) return true;
    if (!learningState.contextReady) return false;
    if (!stepRequiresAction(step)) return true;
    return learningState.stepComplete;
  }

  function evaluateStep() {
    if (!learningState.active) return;
    const step = activeStep();
    const descriptor = inspectStepContext(step);
    const contextWasReady = learningState.contextReady;
    const targetChanged = learningState.lastContextTarget !== descriptor.target;
    learningState.contextReady = descriptor.ready;
    learningState.contextDescriptor = descriptor;
    learningState.lastContextTarget = descriptor.target;
    updateContextActions(descriptor);

    const skipButton = el('guidedLessonSkipBtn');
    if (skipButton) {
      skipButton.hidden = descriptor.ready && !(stepRequiresAction(step) && !learningState.stepComplete);
    }

    if (!descriptor.ready) {
      clearTarget();
      if (el('guidedLessonSpotlight')) el('guidedLessonSpotlight').hidden = true;
      learningState.stepComplete = false;
      const status = el('guidedLessonStatus');
      if (status) {
        status.className = 'guided-learning-status missing';
        status.textContent = descriptor.reason;
      }
      el('guidedLessonNextBtn').disabled = true;
      positionPopover(null);
      return;
    }

    if (descriptor.target && (!contextWasReady || targetChanged || !learningState.target)) renderSpotlight(step);
    if (!descriptor.target && el('guidedLessonSpotlight')) {
      clearTarget();
      el('guidedLessonSpotlight').hidden = true;
      positionPopover(null);
    }

    const actionRequired = stepRequiresAction(step);
    let complete = !actionRequired;
    if (actionRequired) {
      try {
        complete = Boolean(step.check());
      } catch {
        complete = false;
      }
    }

    if (complete && !learningState.stepComplete) {
      learningState.stepComplete = true;
      markStepComplete(learningState.lessonId, step.id);
      const status = el('guidedLessonStatus');
      if (status) {
        status.className = 'guided-learning-status complete';
        status.textContent = actionRequired
          ? 'Step complete. Continue when you are ready.'
          : 'The correct area is open. Continue when you are ready.';
      }
      el('guidedLessonNextBtn').disabled = false;
      renderHelpProgress();
    } else if (!complete) {
      learningState.stepComplete = false;
      const status = el('guidedLessonStatus');
      if (status) {
        status.className = 'guided-learning-status waiting';
        status.textContent = learningState.mode === 'explain'
          ? 'Complete the requested action so the lesson can verify that the next step will be in the correct window. You can also skip this step.'
          : 'Waiting for the requested action. You can skip this step without affecting the planner.';
      }
      el('guidedLessonNextBtn').disabled = true;
    } else {
      el('guidedLessonNextBtn').disabled = !canAdvance();
    }
  }

  function releaseOverlayLayer() {
    learningState.layerHandle?.unregister?.();
    learningState.layerHandle = null;
  }

  function synchronizeOverlayLayer() {
    const overlay = el('guidedLessonOverlay');
    const popover = el('guidedLessonPopover');
    if (!overlay || !popover || overlay.getAttribute('aria-hidden') === 'true') {
      releaseOverlayLayer();
      return;
    }
    DialogManager.synchronize();
    const options = {
      anchorDepth: DialogManager.stack().length,
      hideWhenCovered: true,
      focusTarget: popover
    };
    if (!learningState.layerHandle) {
      learningState.layerHandle = DialogManager.registerAuxiliarySurface(overlay, options);
    } else {
      learningState.layerHandle.update(options);
    }
  }

  function renderStep() {
    if (!learningState.active) return;
    const lesson = activeLesson();
    const step = activeStep();
    clearTarget();
    prepareStep(step);
    learningState.signals.clear();
    learningState.baseline = snapshotMetrics();
    learningState.stepComplete = false;
    learningState.contextReady = false;
    learningState.contextDescriptor = null;
    learningState.lastContextTarget = null;

    const overlay = el('guidedLessonOverlay');
    const popover = el('guidedLessonPopover');
    if (!overlay || !popover) return;
    overlay.setAttribute('aria-hidden', 'false');
    synchronizeOverlayLayer();
    el('guidedLessonSection').textContent = `${lesson.title} · ${learningState.mode === 'practice' ? 'Practice' : 'Explain'}`;
    el('guidedLessonProgress').textContent = `${learningState.stepIndex + 1} / ${lesson.steps.length}`;
    el('guidedLessonTitle').textContent = step.title;
    el('guidedLessonBody').textContent = step.body;
    el('guidedLessonTask').textContent = step.task;
    popover.classList.toggle('important', step.important);
    el('guidedLessonBackBtn').disabled = learningState.stepIndex === 0;
    el('guidedLessonSkipBtn').hidden = true;
    const next = el('guidedLessonNextBtn');
    next.textContent = learningState.stepIndex === lesson.steps.length - 1 ? 'Finish lesson' : 'Next';
    next.disabled = true;
    const status = el('guidedLessonStatus');
    status.className = 'guided-learning-status waiting';
    status.textContent = 'Preparing the correct area for this step…';
    updateContextActions({ ready: true });
    updateResumeProgress();
    if (el('guidedLessonSpotlight')) el('guidedLessonSpotlight').hidden = true;
    positionPopover(null);
    popover.focus({ preventScroll: true });
    setTimeout(evaluateStep, 120);
  }

  function startLesson(lessonId, mode = 'explain', options = {}) {
    const lesson = lessonById(lessonId);
    const requestedMode = mode === 'practice' && lesson.practiceSupported ? 'practice' : 'explain';
    if (!learningState.active) {
      const currentClass = state.classes?.find(classRecord => classRecord.id === state.activeClassId);
      learningState.returnClassId = currentClass?.guidedPractice
        ? (state.classes.find(classRecord => !classRecord.guidedPractice)?.id || '')
        : (state.activeClassId || '');
    }
    learningState.lessonId = lesson.id;
    learningState.mode = requestedMode;
    learningState.stepIndex = Math.max(0, Math.min(lesson.steps.length - 1, Number(options.stepIndex) || 0));
    learningState.active = true;
    learningState.skippedSteps = new Set();
    if (requestedMode === 'practice') ensurePracticeClass(lesson.id);
    closeHelpGuideModal();
    document.body.classList.add('guided-learning-active');
    if (learningState.evaluationTimer) clearInterval(learningState.evaluationTimer);
    learningState.evaluationTimer = setInterval(evaluateStep, EVALUATION_INTERVAL_MS);
    renderStep();
    setLiveStatusMessage(`${lesson.title} started in ${requestedMode} mode.`);
  }

  function resumeLesson() {
    const resume = loadProgress().resume;
    if (!resume?.lessonId) {
      openHelp('lessons');
      return false;
    }
    if (resume.practiceClassId && state.classes?.some(classRecord => classRecord.id === resume.practiceClassId)) {
      learningState.practiceClassId = resume.practiceClassId;
    }
    startLesson(resume.lessonId, resume.mode, { stepIndex: resume.stepIndex });
    return true;
  }

  function closeLesson({ preserveResume = true } = {}) {
    if (!learningState.active) return;
    const resume = preserveResume ? currentResumeRecord() : null;
    learningState.renderToken += 1;
    clearTarget();
    learningState.active = false;
    document.body.classList.remove('guided-learning-active');
    el('guidedLessonOverlay')?.setAttribute('aria-hidden', 'true');
    updateContextActions({ ready: true });
    releaseOverlayLayer();
    if (el('guidedLessonSpotlight')) el('guidedLessonSpotlight').hidden = true;
    if (learningState.evaluationTimer) clearInterval(learningState.evaluationTimer);
    learningState.evaluationTimer = null;
    updateResumeProgress(resume);
    setLiveStatusMessage(preserveResume ? 'Guided lesson closed. Your place was saved.' : 'Guided lesson closed.');
  }

  function finishLesson() {
    const lesson = activeLesson();
    markLessonComplete(lesson.id);
    learningState.active = false;
    document.body.classList.remove('guided-learning-active');
    clearTarget();
    if (el('guidedLessonSpotlight')) el('guidedLessonSpotlight').hidden = true;
    if (learningState.evaluationTimer) clearInterval(learningState.evaluationTimer);
    learningState.evaluationTimer = null;

    const popover = el('guidedLessonPopover');
    const overlay = el('guidedLessonOverlay');
    if (!popover || !overlay) return;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('guided-learning-active');
    synchronizeOverlayLayer();
    el('guidedLessonSection').textContent = 'Lesson complete';
    el('guidedLessonProgress').textContent = '✓';
    el('guidedLessonTitle').textContent = `${lesson.title} complete`;
    el('guidedLessonBody').textContent = 'You can return to the lesson list, restart this lesson, or keep practicing without the overlay.';
    el('guidedLessonTask').textContent = learningState.practiceClassId
      ? 'This lesson used a clearly labeled practice class. Keep it for more practice or delete it and return to your previous class.'
      : 'Your learning progress has been saved on this browser.';
    const status = el('guidedLessonStatus');
    status.className = 'guided-learning-status complete guided-learning-completion';
    updateContextActions({ ready: true });
    status.innerHTML = `
      <div class="guided-learning-completion-actions">
        <button type="button" data-guided-complete-action="lessons">Lesson list</button>
        <button type="button" class="secondary" data-guided-complete-action="restart">Restart lesson</button>
        ${learningState.practiceClassId ? '<button type="button" class="secondary" data-guided-complete-action="keep">Keep practice class</button><button type="button" class="danger" data-guided-complete-action="delete">Delete practice class</button>' : '<button type="button" class="secondary" data-guided-complete-action="close">Close</button>'}
      </div>`;
    ['guidedLessonBackBtn', 'guidedLessonNextBtn', 'guidedLessonSkipBtn'].forEach(id => { if (el(id)) el(id).hidden = true; });
    el('guidedLessonExitBtn').hidden = true;
    el('guidedLessonHelpBtn').hidden = true;
    positionPopover(null);
    popover.focus({ preventScroll: true });
    renderHelpProgress();
  }

  function completeAction(action) {
    const lessonId = learningState.lessonId;
    const mode = learningState.mode;
    const practiceClassId = learningState.practiceClassId;
    const returnClassId = learningState.returnClassId;
    document.body.classList.remove('guided-learning-active');
    el('guidedLessonOverlay')?.setAttribute('aria-hidden', 'true');
    updateContextActions({ ready: true });
    releaseOverlayLayer();
    ['guidedLessonBackBtn', 'guidedLessonNextBtn', 'guidedLessonSkipBtn', 'guidedLessonExitBtn', 'guidedLessonHelpBtn'].forEach(id => { if (el(id)) el(id).hidden = false; });
    if (action === 'restart') {
      startLesson(lessonId, mode, { stepIndex: 0 });
      return;
    }
    if (action === 'delete' && practiceClassId) deletePracticeClass(practiceClassId, returnClassId);
    if (action === 'keep' && returnClassId && state.classes.some(classRecord => classRecord.id === returnClassId)) {
      persistActiveClass();
      state.activeClassId = returnClassId;
      applyClassToState(returnClassId);
      renderAll();
    }
    learningState.practiceClassId = '';
    if (action === 'lessons') openHelp('lessons');
    else setLiveStatusMessage(action === 'delete' ? 'Practice class deleted.' : 'Lesson complete.');
  }

  function nextStep() {
    if (!learningState.active) return;
    if (!canAdvance()) {
      const status = el('guidedLessonStatus');
      if (status) {
        status.textContent = learningState.contextReady
          ? 'Complete the requested action or choose Skip step before continuing.'
          : (learningState.contextDescriptor?.reason || 'Open the requested area, use Open it for me, or choose Skip step before continuing.');
      }
      return;
    }
    const lesson = activeLesson();
    markStepComplete(lesson.id, activeStep().id);
    if (learningState.stepIndex >= lesson.steps.length - 1) {
      finishLesson();
      return;
    }
    learningState.stepIndex += 1;
    renderStep();
  }

  function previousStep() {
    if (!learningState.active) return;
    learningState.stepIndex = Math.max(0, learningState.stepIndex - 1);
    renderStep();
  }

  function skipStep() {
    if (!learningState.active) return;
    const step = activeStep();
    learningState.skippedSteps.add(step.id);
    learningState.stepComplete = true;
    markStepComplete(learningState.lessonId, step.id);
    nextStep();
  }

  function signalFromEvent(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const button = target.closest('button, input, select, textarea, [data-candidate-index], .candidate-card, .freeform-object');
    if (!button) return;
    if (button.id) learningState.signals.add(button.id);
    if (button.matches('[data-candidate-index], .candidate-card')) learningState.signals.add('candidate-card');
    if (button.closest('#seatingCandidateDetail')) learningState.signals.add('candidate-detail');
    if (button.matches('[data-freeform-inline-arrange], [data-freeform-arrange]')) learningState.signals.add('freeform-arranged');
    if (button.matches('.freeform-object')) learningState.signals.add('freeform-object-interaction');
    if (button.closest('#todayAttendanceList')) learningState.signals.add('today-attendance-changed');
    evaluateStep();
    setTimeout(installContextButtons, 0);
  }

  function handlePointerSignal(event) {
    if (!learningState.active) return;
    const target = event.target instanceof Element ? event.target.closest('.freeform-object') : null;
    if (!target) return;
    const before = freeformGeometrySignature();
    setTimeout(() => {
      if (!learningState.active) return;
      if (freeformGeometrySignature() !== before) learningState.signals.add('freeform-moved');
      evaluateStep();
    }, 80);
  }

  function isTextEntryTarget(target) {
    return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  }

  function handleKeyboard(event) {
    if (!learningState.active || event.defaultPrevented || event.isComposing || event.repeat) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeLesson();
      return;
    }
    if (isTextEntryTarget(event.target)) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      previousStep();
      return;
    }
    if (event.key === 'Enter' || event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') {
      event.preventDefault();
      event.stopPropagation();
      nextStep();
    }
  }

  function lessonCardHtml(lesson, progress) {
    const completed = progress.completedLessons.includes(lesson.id);
    const completedSteps = new Set(progress.completedSteps[lesson.id] || []);
    const percent = Math.round((completedSteps.size / Math.max(1, lesson.steps.length)) * 100);
    return `
      <article class="guided-lesson-card ${completed ? 'complete' : ''}" data-lesson-id="${escapeHtml(lesson.id)}">
        <div class="guided-lesson-card-heading">
          <div><span>${escapeHtml(lesson.category)}</span><h3>${escapeHtml(lesson.title)}</h3></div>
          <span class="guided-lesson-completion">${completed ? 'Completed' : `${percent}%`}</span>
        </div>
        <p>${escapeHtml(lesson.summary)}</p>
        <div class="guided-lesson-meta"><span>${escapeHtml(lesson.duration)}</span><span>${escapeHtml(lesson.difficulty)}</span><span>${lesson.steps.length} steps</span></div>
        <div class="guided-lesson-progress-bar" aria-label="${percent}% complete"><span style="--lesson-progress:${percent}%"></span></div>
        <div class="guided-lesson-card-actions">
          <button type="button" data-guided-start="${escapeHtml(lesson.id)}" data-guided-mode="explain">Explain it</button>
          ${lesson.practiceSupported ? `<button type="button" class="secondary" data-guided-start="${escapeHtml(lesson.id)}" data-guided-mode="practice">Practice it</button>` : ''}
        </div>
      </article>`;
  }

  function renderLessonCatalog() {
    const catalog = el('guidedLessonCatalog');
    if (!catalog) return;
    const progress = loadProgress();
    catalog.innerHTML = LESSONS.map(lesson => lessonCardHtml(lesson, progress)).join('');
    updateResumeButtons(progress);
  }

  function renderHelpProgress() {
    const container = el('guidedLearningProgressList');
    if (!container) return;
    const progress = loadProgress();
    container.innerHTML = LESSONS.map(lesson => {
      const completedSteps = new Set(progress.completedSteps[lesson.id] || []);
      const complete = progress.completedLessons.includes(lesson.id);
      return `
        <article class="guided-progress-row ${complete ? 'complete' : ''}">
          <span class="guided-progress-icon" aria-hidden="true">${complete ? '✓' : completedSteps.size}</span>
          <div><strong>${escapeHtml(lesson.title)}</strong><span>${completedSteps.size} of ${lesson.steps.length} steps completed</span></div>
          <button type="button" class="secondary" data-guided-start="${escapeHtml(lesson.id)}" data-guided-mode="${lesson.practiceSupported ? 'practice' : 'explain'}">${complete ? 'Review' : 'Continue'}</button>
        </article>`;
    }).join('');
  }

  function setHelpView(view) {
    const next = ['lessons', 'reference', 'progress'].includes(view) ? view : 'lessons';
    learningState.helpView = next;
    document.querySelectorAll('[data-help-view]').forEach(button => {
      const active = button.dataset.helpView === next;
      button.classList.toggle('active', active);
      button.classList.toggle('secondary', !active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.help-guide-view').forEach(panel => {
      const active = panel.id === `helpGuide${next[0].toUpperCase()}${next.slice(1)}View`;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
    if (next === 'lessons') renderLessonCatalog();
    if (next === 'progress') renderHelpProgress();
    if (next === 'reference') renderHelpGuide();
  }

  function openHelp(view = 'lessons') {
    if (learningState.active) closeLesson();
    openHelpGuideModal();
    setHelpView(view);
  }

  function installContextButtons(){ /* Global Guided Help replaces repeated contextual Guide me buttons. */ }

  function resetProgress() {
    showInAppConfirm('Reset guided-learning progress on this browser? Practice classes are not deleted.', () => {
      safeStorageRemove('localStorage', STORAGE_KEY);
      renderLessonCatalog();
      renderHelpProgress();
      setLiveStatusMessage('Guided-learning progress reset.');
    }, {
      title: 'Reset Guided Learning?',
      confirmText: 'Reset Progress',
      cancelText: 'Cancel'
    });
  }

  function handleClick(event) {
    const completeButton = event.target.closest('[data-guided-complete-action]');
    if (completeButton) {
      completeAction(completeButton.dataset.guidedCompleteAction);
      return;
    }
    const start = event.target.closest('[data-guided-start]');
    if (start) {
      startLesson(start.dataset.guidedStart, start.dataset.guidedMode || 'explain');
      return;
    }
    if (event.target.closest('#guidedLearningBtn')) openHelp('lessons');
    if (event.target.closest('#helpGuideQuickStartBtn')) startLesson('quick-start', 'explain');
    if (event.target.closest('#helpGuideResumeLessonBtn, #settingsResumeLessonBtn')) resumeLesson();
    if (event.target.closest('#settingsQuickStartBtn')) {
      closeSettingsModal();
      startLesson('quick-start', 'explain');
    }
  }

  function installEvents() {
    document.addEventListener('click', event => {
      handleClick(event);
      signalFromEvent(event);
    }, true);
    document.addEventListener('change', signalFromEvent, true);
    document.addEventListener('input', signalFromEvent, true);
    document.addEventListener('pointerup', handlePointerSignal, true);
    document.addEventListener('keydown', handleKeyboard, true);
    window.addEventListener('resize', () => {
      if (learningState.active) renderSpotlight(activeStep());
    });
    el('guidedLessonExitBtn')?.addEventListener('click', () => closeLesson());
    el('guidedLessonHelpBtn')?.addEventListener('click', () => openHelp('lessons'));
    el('guidedLessonSkipBtn')?.addEventListener('click', skipStep);
    el('guidedLessonOpenContextBtn')?.addEventListener('click', () => void openCurrentStepContext());
    el('guidedLessonRetryContextBtn')?.addEventListener('click', retryCurrentStepContext);
    el('guidedLessonBackBtn')?.addEventListener('click', previousStep);
    el('guidedLessonNextBtn')?.addEventListener('click', nextStep);
    el('resetGuidedLearningProgressBtn')?.addEventListener('click', resetProgress);
    document.querySelectorAll('[data-help-view]').forEach(button => {
      button.addEventListener('click', () => setHelpView(button.dataset.helpView));
    });
  }

  function installHelpObserver() {
    const modal = el('helpGuideModal');
    if (!modal) return;
    new MutationObserver(() => {
      if (!modal.classList.contains('show')) return;
      setHelpView(learningState.helpView || 'lessons');
      installContextButtons();
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  function install() {
    if (learningState.installed) return;
    learningState.installed = true;
    document.body.classList.add('guided-learning-ready');
    installEvents();
    installHelpObserver();
    installContextButtons();
    renderLessonCatalog();
    renderHelpProgress();
    updateResumeButtons();
    window.GuidedLearning = Object.freeze({
      openHelp,
      startLesson,
      resumeLesson,
      closeLesson,
      lessons: LESSONS,
      state: () => ({ ...learningState, signals: [...learningState.signals], skippedSteps: [...learningState.skippedSteps] }),
      clearForFactoryReset: () => safeStorageRemove('localStorage', STORAGE_KEY),
      storageKey: STORAGE_KEY
    });
  }

  return Object.freeze({ install, openHelp, startLesson, resumeLesson, closeLesson, lessons: LESSONS, storageKey: STORAGE_KEY });
})();

window.GuidedLearningInstaller = GuidedLearning;

'use strict';

window.ClassroomFeaturePackV66?.install();

window.initializeClassroomSeatingPlanner()
  .then(() => {
    window.ClassroomFeaturePackV66?.afterReady();
    return window.GuidedLearningInstaller.install();
  })
  .catch(error => {
    window.AppAudit?.recordError?.('startup', error);
    throw error;
  });