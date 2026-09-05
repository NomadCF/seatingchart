window.PlannerAssistantWorkspaceV730 = (() => {
  'use strict';

  const VERSION = '7.3.0';
  const STORAGE_PREFIX = 'classroom-seating-planner-assistant-workspace-v730:';
  const STYLE_ID = 'plannerAssistantWorkspaceV730Styles';
  const PANEL_ID = 'plannerAssistantV730Workspace';
  const INPUT_ID = 'plannerAssistantV730Input';
  const RESPONSE_ID = 'plannerAssistantV730Response';
  const TRANSCRIPT_ID = 'plannerAssistantV730Transcript';
  const PLAN_ID = 'plannerAssistantV730Plan';
  const MAX_TURNS = 20;
  const MAX_CANDIDATES = 8;
  const base = window.PlannerAssistantV710;
  if (!base) return Object.freeze({ version:VERSION, installed:false });

  let installed = false;
  let observer = null;
  let refreshPending = false;
  let runtimePreview = null;

  const list = value => Array.isArray(value) ? value : [];
  const normalize = value => String(value || '').trim().replace(/\s+/g, ' ');
  const lower = value => normalize(value).toLowerCase();
  const clone = value => {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const esc = value => {
    try { if (typeof escapeHtml === 'function') return escapeHtml(String(value ?? '')); } catch (_) { /* fallback */ }
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  };

  function classId() {
    try {
      const record = typeof activeClassRecord === 'function' ? activeClassRecord() : null;
      if (record?.id) return String(record.id);
    } catch (_) { /* fallback */ }
    return String(state?.activeClassId || state?.classId || 'default');
  }

  function storageKey() { return `${STORAGE_PREFIX}${classId()}`; }

  function blankWorkspace() {
    return {
      version:1,
      turns:[],
      workingPlan:{
        title:'',
        goal:'',
        studentIds:[],
        groupIds:[],
        constraints:{ preserveLocked:false, preserveAccessibility:false, minimalMoves:false, maxMoves:0 },
        candidateSeats:[],
        candidateStudentId:'',
        selectedCandidateIndex:-1,
        proposedActions:[],
        comparison:null,
        updatedAt:''
      }
    };
  }

  function normalizeWorkspace(value) {
    const source = value && typeof value === 'object' ? value : {};
    const plan = source.workingPlan && typeof source.workingPlan === 'object' ? source.workingPlan : {};
    return {
      version:1,
      turns:list(source.turns).slice(0, MAX_TURNS).map(turn => ({
        role:turn?.role === 'assistant' ? 'assistant' : 'user',
        text:normalize(turn?.text),
        at:String(turn?.at || new Date().toISOString()),
        kind:String(turn?.kind || '')
      })),
      workingPlan:{
        title:normalize(plan.title).slice(0, 100),
        goal:normalize(plan.goal).slice(0, 500),
        studentIds:list(plan.studentIds).map(String).slice(0, 20),
        groupIds:list(plan.groupIds).map(String).slice(0, 20),
        constraints:{
          preserveLocked:Boolean(plan.constraints?.preserveLocked),
          preserveAccessibility:Boolean(plan.constraints?.preserveAccessibility),
          minimalMoves:Boolean(plan.constraints?.minimalMoves),
          maxMoves:Math.max(0, Math.min(60, Number(plan.constraints?.maxMoves) || 0))
        },
        candidateSeats:list(plan.candidateSeats).slice(0, MAX_CANDIDATES).map(item => ({
          key:String(item?.key || ''), status:String(item?.status || ''), score:Number(item?.score) || 0,
          messages:list(item?.messages).map(String).slice(0, 8), occupiedBy:String(item?.occupiedBy || '')
        })),
        candidateStudentId:String(plan.candidateStudentId || ''),
        selectedCandidateIndex:Number.isInteger(Number(plan.selectedCandidateIndex)) ? Number(plan.selectedCandidateIndex) : -1,
        proposedActions:list(plan.proposedActions).slice(0, 20).map(String),
        comparison:plan.comparison && typeof plan.comparison === 'object' ? clone(plan.comparison) : null,
        updatedAt:String(plan.updatedAt || '')
      }
    };
  }

  function loadWorkspace() {
    try { return normalizeWorkspace(JSON.parse(localStorage.getItem(storageKey()) || '{}')); }
    catch (_) { return blankWorkspace(); }
  }

  function saveWorkspace(workspace) {
    try { localStorage.setItem(storageKey(), JSON.stringify(normalizeWorkspace(workspace))); } catch (_) { /* optional */ }
  }

  function updateWorkspace(mutator) {
    const workspace = loadWorkspace();
    mutator(workspace);
    workspace.workingPlan.updatedAt = new Date().toISOString();
    saveWorkspace(workspace);
    renderWorkspaceState();
    return workspace;
  }

  function clearWorkspace() {
    try { localStorage.removeItem(storageKey()); } catch (_) { /* optional */ }
    runtimePreview = null;
    try { base.clearConversationContext?.(); } catch (_) { /* optional */ }
    renderWorkspaceState();
    renderResponse({ title:'Assistant workspace cleared', summary:'Conversation context, candidate seats, and the current working plan were cleared for this class.', kind:'info' });
  }

  function addTurn(role, message, kind = '') {
    const value = normalize(message);
    if (!value) return;
    updateWorkspace(workspace => {
      workspace.turns.unshift({ role:role === 'assistant' ? 'assistant' : 'user', text:value, at:new Date().toISOString(), kind });
      workspace.turns = workspace.turns.slice(0, MAX_TURNS);
    });
  }

  function students() { return list(state?.students).filter(student => student && !student.archived); }
  function studentById(id) { return students().find(student => String(student?.id) === String(id)); }
  function studentName(student) {
    try { if (typeof studentDisplay === 'function') return normalize(studentDisplay(student)); } catch (_) { /* fallback */ }
    return normalize([student?.nickName || student?.firstName, student?.lastName].filter(Boolean).join(' ')) || String(student?.id || 'Student');
  }
  function groupById(id) { return list(state?.groups).find(group => String(group?.id) === String(id)); }

  function seatLabel(key) {
    if (!key) return 'Unknown seat';
    if (state?.layoutMode === 'freeform') {
      const seat = list(state?.freeformLayout?.objects).find(object => object?.type === 'seat' && String(object.id) === String(key));
      return normalize(seat?.label) || String(key);
    }
    return String(key);
  }

  function currentSeatForStudent(studentId) {
    if (state?.layoutMode === 'freeform') {
      const seat = list(state?.freeformLayout?.objects).find(object => object?.type === 'seat' && String(object.assignedStudentId || '') === String(studentId));
      return seat ? String(seat.id) : '';
    }
    const found = Object.entries(state?.cells || {}).find(([, cell]) => cell?.type === 'seat' && String(cell.assignedStudentId || '') === String(studentId));
    return found ? String(found[0]) : '';
  }

  function occupiedBySeat(key) {
    if (state?.layoutMode === 'freeform') {
      return String(list(state?.freeformLayout?.objects).find(object => object?.type === 'seat' && String(object.id) === String(key))?.assignedStudentId || '');
    }
    return String(state?.cells?.[key]?.assignedStudentId || '');
  }

  function selectedOrContextStudentIds() {
    const workspace = loadWorkspace();
    const planIds = workspace.workingPlan.studentIds.filter(id => studentById(id));
    if (planIds.length) return planIds;
    try {
      const ctx = base.conversationContext?.();
      const ids = list(ctx?.students).map(String).filter(id => studentById(id));
      if (ids.length) return ids;
    } catch (_) { /* optional */ }
    try {
      const selected = uiState?.selectedStudentIds;
      if (selected?.size) return [...selected].map(String).filter(id => studentById(id));
    } catch (_) { /* optional */ }
    return [];
  }

  function namedStudentIds(command) {
    const value = lower(command);
    const matches = [];
    students().forEach(student => {
      const names = [studentName(student), student?.nickName, student?.firstName, student?.lastName, [student?.firstName, student?.lastName].filter(Boolean).join(' ')].map(normalize).filter(name => name.length >= 2);
      if (names.some(name => new RegExp(`(^|[^a-z0-9])${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`, 'i').test(value))) matches.push(String(student.id));
    });
    return [...new Set(matches)];
  }

  function namedGroup(command) {
    const value = lower(command);
    return list(state?.groups).filter(group => normalize(group?.name)).sort((a,b) => normalize(b.name).length - normalize(a.name).length).find(group => value.includes(lower(group.name))) || null;
  }

  function parseOrdinal(command) {
    const value = lower(command);
    const numeric = value.match(/\b(?:option|seat|choice)?\s*#?([1-8])\b/)?.[1];
    if (numeric) return Number(numeric) - 1;
    const words = [['first',0],['1st',0],['second',1],['2nd',1],['third',2],['3rd',2],['fourth',3],['4th',3],['fifth',4],['5th',4],['sixth',5],['6th',5],['seventh',6],['7th',6],['eighth',7],['8th',7]];
    return words.find(([word]) => new RegExp(`\\b${word}\\b`).test(value))?.[1] ?? -1;
  }

  function parseMaxMoves(command) {
    const match = lower(command).match(/(?:no more than|at most|max(?:imum)?(?: of)?|up to|only)\s*(\d+)\s*(?:student )?(?:moves?|students?|seats?)/);
    return match ? Math.max(1, Math.min(60, Number(match[1]) || 1)) : 0;
  }

  function isPresentationMode() { return Boolean(document.body?.classList.contains('visibility-mode')); }

  function normalAssistantPreview(command) {
    const normalizer = window.InterfaceAssistantAuditV721?.normalizeAssistantCommand;
    const normalized = typeof normalizer === 'function' ? normalizer(command) : command;
    const preview = base.preview(normalized);
    runtimePreview = preview;
    const ids = list(preview?.entities?.students).map(item => String(item.id));
    updateWorkspace(workspace => {
      if (ids.length) workspace.workingPlan.studentIds = ids;
      workspace.workingPlan.goal = normalize(command).slice(0, 500);
      workspace.workingPlan.proposedActions = list(preview?.operations).map(String).slice(0, 20);
    });
    return preview;
  }

  function candidateSeatPreview(studentId, command = '') {
    const student = studentById(studentId);
    if (!student) return null;
    const all = window.SeatGuidanceV66?.calculate?.(studentId) || [];
    const candidates = all.filter(item => item.status === 'valid' || item.status === 'caution').slice(0, MAX_CANDIDATES).map(item => ({
      key:String(item.key), status:String(item.status), score:Number(item.score) || 0, messages:list(item.messages).map(String), occupiedBy:String(item.target?.assignedStudentId || '')
    }));
    updateWorkspace(workspace => {
      workspace.workingPlan.goal = command || `Find seats for ${studentName(student)}`;
      workspace.workingPlan.studentIds = [String(studentId)];
      workspace.workingPlan.candidateStudentId = String(studentId);
      workspace.workingPlan.candidateSeats = candidates;
      workspace.workingPlan.selectedCandidateIndex = -1;
      workspace.workingPlan.proposedActions = ['Review ranked valid/caution seats', 'Choose a candidate before moving the student'];
      workspace.workingPlan.comparison = null;
    });
    return {
      kind:'seat-options',
      title:`Best seat options for ${studentName(student)}`,
      summary:candidates.length ? 'These are ranked using the existing Seat Guidance engine. Choosing an option still requires an explicit Apply action.' : 'No valid or caution-level seat options are currently available.',
      studentId:String(studentId), candidates
    };
  }

  function compareCandidate(index) {
    const workspace = loadWorkspace();
    const plan = workspace.workingPlan;
    const candidate = plan.candidateSeats[index];
    const student = studentById(plan.candidateStudentId);
    if (!candidate || !student) return null;
    const current = currentSeatForStudent(student.id);
    const occupied = candidate.occupiedBy ? studentById(candidate.occupiedBy) : null;
    const comparison = {
      studentId:String(student.id),
      studentName:studentName(student),
      currentKey:current,
      currentLabel:current ? seatLabel(current) : 'Unseated',
      targetKey:candidate.key,
      targetLabel:seatLabel(candidate.key),
      targetStatus:candidate.status,
      targetMessages:list(candidate.messages),
      swapWith:occupied ? studentName(occupied) : '',
      same:String(current) === String(candidate.key)
    };
    updateWorkspace(next => { next.workingPlan.selectedCandidateIndex = index; next.workingPlan.comparison = comparison; });
    return comparison;
  }

  function assignCandidate(index) {
    if (isPresentationMode()) return { ok:false, message:'Presentation mode is read-only.' };
    const workspace = loadWorkspace();
    const plan = workspace.workingPlan;
    const candidate = plan.candidateSeats[index];
    const student = studentById(plan.candidateStudentId);
    if (!candidate || !student) return { ok:false, message:'That seat option is no longer available in the Assistant working plan.' };
    const recalculated = window.SeatGuidanceV66?.calculate?.(student.id) || [];
    const current = recalculated.find(item => String(item.key) === String(candidate.key));
    if (!current || !['valid','caution'].includes(current.status)) return { ok:false, message:'That seat is no longer a valid/caution option. Refresh the seat options before applying it.' };
    try { if (typeof pushUndoSnapshot === 'function') pushUndoSnapshot(`Before Planner Assistant seat choice for ${studentName(student)}`); } catch (_) { /* optional */ }
    let ok = false;
    if (state?.layoutMode === 'freeform') {
      try { ok = Boolean(assignStudentToFreeformObject(student.id, candidate.key, true, true)); }
      catch (_) {
        try {
          const seat = list(state?.freeformLayout?.objects).find(object => object?.type === 'seat' && String(object.id) === String(candidate.key));
          if (seat && typeof applyFreeformStudentAssignmentDirect === 'function') { applyFreeformStudentAssignmentDirect(student, seat); ok = true; }
        } catch (_) { ok = false; }
      }
    } else {
      try { ok = Boolean(assignStudentToCell(student.id, candidate.key, true, true)); }
      catch (_) {
        try { if (typeof applyMoveOrSwap === 'function') { applyMoveOrSwap(student.id, candidate.key, true); ok = true; } } catch (_) { ok = false; }
      }
    }
    if (!ok) return { ok:false, message:'The planner could not apply that seat choice.' };
    try { persistActiveClass?.(); } catch (_) { /* optional */ }
    try { scheduleLinkedAutoSave?.('planner-assistant-seat-choice'); } catch (_) { /* optional */ }
    try { renderAll?.(); } catch (_) { /* optional */ }
    updateWorkspace(next => {
      next.workingPlan.selectedCandidateIndex = index;
      next.workingPlan.comparison = null;
      next.workingPlan.proposedActions = [`Placed ${studentName(student)} in ${seatLabel(candidate.key)}`];
    });
    return { ok:true, message:`Placed ${studentName(student)} in ${seatLabel(candidate.key)}. Undo remains available.` };
  }

  function currentFindings() {
    try { return typeof evaluateCurrentRuleViolations === 'function' ? list(evaluateCurrentRuleViolations({ includeUnseated:true })) : []; }
    catch (_) { return []; }
  }

  function unseatedStudents() {
    const assigned = new Set();
    if (state?.layoutMode === 'freeform') list(state?.freeformLayout?.objects).filter(object => object?.type === 'seat' && object.assignedStudentId).forEach(object => assigned.add(String(object.assignedStudentId)));
    else Object.values(state?.cells || {}).filter(cell => cell?.type === 'seat' && cell.assignedStudentId).forEach(cell => assigned.add(String(cell.assignedStudentId)));
    return students().filter(student => !assigned.has(String(student.id)));
  }

  function assignmentSnapshot() {
    const result = {};
    if (state?.layoutMode === 'freeform') {
      list(state?.freeformLayout?.objects).filter(object => object?.type === 'seat').forEach(object => { if (object.assignedStudentId) result[String(object.assignedStudentId)] = String(object.id); });
    } else {
      Object.entries(state?.cells || {}).forEach(([key,cell]) => { if (cell?.type === 'seat' && cell.assignedStudentId) result[String(cell.assignedStudentId)] = String(key); });
    }
    return result;
  }

  function planAssignments(plan) {
    const result = {};
    if (!plan) return result;
    if (plan.layoutMode === 'freeform') {
      list(plan.freeformLayout?.objects).filter(object => object?.type === 'seat' && object.assignedStudentId).forEach(object => { result[String(object.assignedStudentId)] = String(object.id); });
    } else {
      Object.entries(plan.cells || {}).forEach(([key,cell]) => { if (cell?.type === 'seat' && cell.assignedStudentId) result[String(cell.assignedStudentId)] = String(key); });
    }
    return result;
  }

  function fairnessComparison() {
    const current = assignmentSnapshot();
    const saved = list(state?.seatingPlans).filter(plan => plan && plan.status !== 'archived').sort((a,b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
    if (!saved) return { kind:'analysis', title:'Fairness comparison', summary:'There is no saved seating plan to compare against yet.', metrics:[], details:['Save a named plan first, then the Assistant can compare how many students moved and which placements repeated.'] };
    const before = planAssignments(saved);
    const ids = [...new Set([...Object.keys(current), ...Object.keys(before)])];
    const moved = ids.filter(id => before[id] && current[id] && before[id] !== current[id]);
    const same = ids.filter(id => before[id] && current[id] && before[id] === current[id]);
    const newlySeated = ids.filter(id => !before[id] && current[id]);
    const unseated = ids.filter(id => before[id] && !current[id]);
    return {
      kind:'analysis', title:`Compare with ${saved.name}`, summary:'This comparison measures repeated versus changed seat assignments. It does not claim that movement alone equals fairness; use it as a rotation signal alongside student needs and rules.',
      metrics:[['Moved',moved.length],['Same seat',same.length],['Newly seated',newlySeated.length],['Now unseated',unseated.length]],
      details:[
        same.length ? `${same.length} student${same.length === 1 ? '' : 's'} kept the same seat as ${saved.name}.` : `No students kept the same seat as ${saved.name}.`,
        moved.length ? `${moved.length} student${moved.length === 1 ? '' : 's'} changed seats.` : 'No seated students changed seats.',
        'Repeated placements may be intentional because of accessibility, front, aisle, teacher-proximity, or other configured needs.'
      ]
    };
  }

  function chartAnalysis(mode = 'summary') {
    const findings = currentFindings();
    const hard = findings.filter(item => item?.severity === 'bad');
    const warnings = findings.filter(item => item?.severity !== 'bad');
    const missing = unseatedStudents();
    const optionRows = students().map(student => {
      const results = window.SeatGuidanceV66?.calculate?.(student.id) || [];
      return { id:String(student.id), name:studentName(student), valid:results.filter(item => item.status === 'valid').length, caution:results.filter(item => item.status === 'caution').length };
    }).sort((a,b) => a.valid - b.valid || a.caution - b.caution || a.name.localeCompare(b.name));
    if (mode === 'hardest') return { kind:'analysis', title:'Students with the fewest seat options', summary:'Ranked from the existing Seat Guidance engine.', metrics:[['Students checked',optionRows.length],['Fewest valid seats',optionRows[0]?.valid ?? 0]], details:optionRows.slice(0,10).map(row => `${row.name}: ${row.valid} valid, ${row.caution} caution.`) };
    if (mode === 'priorities') {
      const details = [];
      if (hard.length) details.push(`1. Resolve required conflicts first. ${hard[0]?.message || ''}`.trim());
      if (missing.length) details.push(`2. Seat active students still unseated: ${missing.slice(0,8).map(studentName).join(', ')}${missing.length > 8 ? '…' : ''}`);
      if (optionRows[0]) details.push(`3. Protect students with the fewest alternatives: ${optionRows.slice(0,5).map(row => `${row.name} (${row.valid})`).join(', ')}.`);
      if (!details.length) details.push('No urgent required conflicts or unseated students were found. Review preference warnings next.');
      return { kind:'analysis', title:'What to fix first', summary:'Prioritized by required rules, unseated students, then students with the fewest alternatives.', metrics:[['Required conflicts',hard.length],['Unseated',missing.length],['Warnings',warnings.length]], details };
    }
    if (mode === 'pressure') {
      const grouped = new Map();
      findings.forEach(item => {
        const key = String(item?.message || item?.category || 'Rule finding');
        grouped.set(key, (grouped.get(key) || 0) + 1);
      });
      const rows = [...grouped.entries()].sort((a,b) => b[1]-a[1]).slice(0,10);
      return { kind:'analysis', title:'Most restrictive current rule findings', summary:'Repeated findings are ranked to show where the chart is under the most pressure.', metrics:[['Findings',findings.length],['Distinct causes',grouped.size]], details:rows.length ? rows.map(([message,count]) => `${count}× ${message}`) : ['No current rule findings were detected.'] };
    }
    return { kind:'analysis', title:'Seating chart health check', summary:'Current assignments, rule findings, and seat flexibility from the planner’s existing engines.', metrics:[['Active students',students().length],['Unseated',missing.length],['Required conflicts',hard.length],['Warnings',warnings.length],['Low-options students',optionRows.filter(row => row.valid <= 2).length]], details:[
      missing.length ? `${missing.length} active student${missing.length === 1 ? '' : 's'} still need a seat.` : 'Every active student currently has a seat.',
      hard.length ? `${hard.length} required conflict${hard.length === 1 ? '' : 's'} need attention.` : 'No required rule conflicts were detected.',
      optionRows.filter(row => row.valid <= 2).length ? `${optionRows.filter(row => row.valid <= 2).length} student${optionRows.filter(row => row.valid <= 2).length === 1 ? '' : 's'} have two or fewer fully valid seats.` : 'Every student has more than two fully valid seat options.'
    ] };
  }

  function testingPlan(command) {
    if (state?.layoutMode !== 'freeform') return { kind:'clarify', title:'Testing setup needs a Freeform room', summary:'Switch to a Freeform room before asking the Assistant to create a physical testing arrangement.', choices:[{label:'Open Room Design', action:'open-room'}] };
    const value = lower(command);
    const spacingMatch = value.match(/(\d+(?:\.\d+)?)\s*(feet|foot|ft|meters|meter|metres|metre|m)\b/);
    const preserveLocked = /\b(lock|locked|don'?t move|do not move|keep .* in place|preserve)\b/.test(value) || loadWorkspace().workingPlan.constraints.preserveLocked;
    const preserveAccessibility = /\b(accessib|ada|wheelchair|mobility|front|aisle)\b/.test(value) || loadWorkspace().workingPlan.constraints.preserveAccessibility;
    const room = window.ClassroomDigitalTwinV700?.physicalRoom?.() || { enabled:false, unit:'ft' };
    let spacing;
    if (spacingMatch && room.enabled) {
      spacing = Number(spacingMatch[1]);
      const sourceFeet = ['feet','foot','ft'].includes(spacingMatch[2]);
      const sourceMeters = ['meters','meter','metres','metre','m'].includes(spacingMatch[2]);
      if (room.unit === 'm' && sourceFeet) spacing *= 0.3048;
      if (room.unit === 'ft' && sourceMeters) spacing /= 0.3048;
    }
    const config = { name:/assessment/.test(value) ? 'Assessment' : 'Testing', preserveLocked, respectNeeds:preserveAccessibility || true };
    if (spacing) config.spacing = spacing;
    let analysis = null;
    try { analysis = window.TestingModeV703?.analyze?.(config) || null; } catch (_) { analysis = null; }
    updateWorkspace(workspace => {
      workspace.workingPlan.title = 'Testing plan';
      workspace.workingPlan.goal = normalize(command);
      workspace.workingPlan.constraints.preserveLocked = preserveLocked;
      workspace.workingPlan.constraints.preserveAccessibility = preserveAccessibility;
      workspace.workingPlan.proposedActions = ['Generate a non-destructive Testing Mode preview', preserveLocked ? 'Preserve locked seat positions and assignments' : 'Locked-seat preservation uses Testing Mode defaults', 'Respect configured accessibility/front/aisle needs', 'Explain any physical spacing limits before apply'];
    });
    if (!analysis) return { kind:'clarify', title:'Testing Mode could not analyze this room', summary:'The current room does not have enough physical information for a testing preview.', choices:[{label:'Open Testing Mode', action:'open-testing'}] };
    return {
      kind:'testing-plan', title:'Testing plan ready to preview', summary:'The Assistant built this from the existing Testing Mode engine. Nothing has moved yet.', config,
      metrics:[['Active students',analysis.report?.activeSeatCount ?? 0],['Moves proposed',analysis.report?.movedCount ?? 0],['Spacing conflicts',analysis.report?.spacingConflicts ?? 0],['Achieved spacing',`${Number(analysis.report?.achievedSpacing || 0).toFixed(1)} ${analysis.report?.unit || room.unit}`]],
      details:[...list(analysis.report?.impossibleReasons).slice(0,8), preserveLocked ? 'Locked seats are preserved.' : 'Testing Mode will use its normal locked-seat behavior.', 'Configured student needs remain part of the feasibility check.'],
      actions:[{label:'Open Testing preview', action:'apply-testing-preview'}]
    };
  }

  function saveNamedPlanRequest(command) {
    const match = normalize(command).match(/(?:save|name|store)(?: this| current)?(?: seating)? plan(?: as)?\s+["“]?(.+?)["”]?$/i);
    const name = normalize(match?.[1] || '').slice(0,80);
    return { kind:'save-plan', title:name ? `Save named plan: ${name}` : 'Save the current chart as a named plan', summary:'This uses the existing Named Seating Plans workflow and preserves the normal saved-plan format.', name, actions:[{label:name ? `Save “${name}”` : 'Open Named Plans', action:name ? 'save-named-plan' : 'open-plans'}] };
  }

  function compareSavedPlansRequest() {
    return { kind:'feature', title:'Compare saved seating plans', summary:'Open the existing side-by-side assignment and room comparison in Named Seating Plans.', actions:[{label:'Open plan comparison', action:'open-plans'}] };
  }

  function featureRequest(command) {
    const value = lower(command);
    if (/\b(today mode|today'?s classroom|attendance|present students|absent students|guest student)\b/.test(value)) return { title:'Today Mode', summary:'Open temporary attendance, guest, and today-only seating tools without changing the master chart until you choose to keep changes.', action:'open-today' };
    if (/\b(planner packs?|template library|shared templates?|reusable packs?)\b/.test(value)) return { title:'Planner Packs', summary:'Open the local reusable room/layout/rule/template pack library.', action:'open-packs' };
    if (/\b(station rotations?|rotation rounds?|stations workspace)\b/.test(value) && !/\b(create|make|build|set up|setup)\b/.test(value)) return { title:'Station Rotations', summary:'Open the existing Station Rotations workspace.', action:'open-rotations' };
    if (/\b(activity layouts?|arrangements workspace|layout library)\b/.test(value) && !/\b(create|make|build|switch|use|activate)\b/.test(value)) return { title:'Activity Layouts', summary:'Open named classroom arrangements for this Freeform room.', action:'open-layouts' };
    if (/\b(testing mode|testing workspace)\b/.test(value) && !/\b(create|make|build|spread|space|arrange|set up|setup)\b/.test(value)) return { title:'Testing Mode', summary:'Open the existing testing-layout workspace.', action:'open-testing' };
    if (/\b(print|print options|print this chart)\b/.test(value)) return { title:'Print options', summary:'Open the existing print workflow.', action:'open-print' };
    if (/\b(snapshot|restore point|backup before)\b/.test(value)) return { title:'Create a restore point', summary:'Use the existing full-app snapshot workflow before making larger changes.', action:'snapshot' };
    if (/\b(named plans?|saved plans?|plan comparison)\b/.test(value)) return { title:'Named Seating Plans', summary:'Open saved seating plans and comparison tools.', action:'open-plans' };
    return null;
  }

  function inferCompoundConstraints(command) {
    const value = lower(command);
    const maxMoves = parseMaxMoves(command);
    const namedIds = namedStudentIds(command);
    const group = namedGroup(command);
    updateWorkspace(workspace => {
      const plan = workspace.workingPlan;
      if (namedIds.length) plan.studentIds = namedIds;
      if (group) plan.groupIds = [String(group.id)];
      if (/\b(don'?t move|do not move|preserve|keep)\b.*\block(?:ed)?\b|\bkeep locked\b/.test(value)) plan.constraints.preserveLocked = true;
      if (/\b(accessib|ada|wheelchair|mobility|front|aisle)\b/.test(value) && /\b(keep|preserve|respect|maintain)\b/.test(value)) plan.constraints.preserveAccessibility = true;
      if (/\b(smallest|fewest|minimal|minimize|change as little|as little as possible)\b/.test(value)) plan.constraints.minimalMoves = true;
      if (maxMoves) plan.constraints.maxMoves = maxMoves;
      plan.goal = normalize(command).slice(0,500);
    });
  }

  function clarifyForGenericGroup(command) {
    const value = lower(command);
    if (!/\b(talkative|chatty|distract|behavior|behaviour|friends?|best friends?|high energy)\b/.test(value)) return null;
    const matchingGroups = list(state?.groups).filter(group => {
      const name = lower(group?.name);
      return name && ['talkative','chatty','distract','behavior','behaviour','friends','high energy'].some(term => value.includes(term) && name.includes(term));
    });
    if (matchingGroups.length === 1) {
      const group = matchingGroups[0];
      const spread = /\b(apart|spread|separate|farther|further)\b/.test(value);
      return normalAssistantPreview(`${group.name} ${spread ? 'spread apart' : 'together'}`);
    }
    return { kind:'clarify', title:'Which students do you mean?', summary:'The Assistant will not infer behavioral labels from student records. Use an existing group, select the students, or name them explicitly.', choices:list(state?.groups).slice(0,8).map(group => ({ label:group.name, action:'choose-group', value:String(group.id) })) };
  }

  function run(commandInput) {
    const command = normalize(commandInput);
    if (!command) return null;
    addTurn('user', command);
    inferCompoundConstraints(command);
    const value = lower(command);
    let response = null;

    const genericGroup = clarifyForGenericGroup(command);
    if (genericGroup) response = genericGroup;

    if (!response && /\b(undo|undo that|put it back|revert that|go back one)\b/.test(value)) response = { kind:'feature', title:'Undo the last planner change', summary:'This uses the planner’s existing undo stack.', actions:[{label:'Undo', action:'undo'}] };
    if (!response && /\b(redo|redo that|put it back again)\b/.test(value)) response = { kind:'feature', title:'Redo the last undone change', summary:'This uses the planner’s existing redo stack.', actions:[{label:'Redo', action:'redo'}] };

    if (!response && /\b(use|take|choose|pick|apply)\b.*\b(first|second|third|fourth|fifth|sixth|seventh|eighth|[1-8](?:st|nd|rd|th)?|option\s*[1-8]|seat\s*[1-8])\b/.test(value)) {
      const index = parseOrdinal(command);
      const comparison = compareCandidate(index);
      response = comparison ? { kind:'candidate-choice', title:`Use option ${index + 1}?`, summary:`Move ${comparison.studentName} from ${comparison.currentLabel} to ${comparison.targetLabel}${comparison.swapWith ? `, swapping with ${comparison.swapWith}` : ''}.`, comparison, actions:[{label:'Apply seat choice', action:'apply-candidate', value:index},{label:'Show seat options', action:'show-options'}] } : { kind:'clarify', title:'I do not have that seat option anymore', summary:'Ask the Assistant to show seat options for a student first.' };
    }

    if (!response && /\b(compare|what changes|difference|what would change)\b.*\b(option|seat|that|this)\b/.test(value)) {
      const workspace = loadWorkspace();
      const index = workspace.workingPlan.selectedCandidateIndex >= 0 ? workspace.workingPlan.selectedCandidateIndex : 0;
      const comparison = compareCandidate(index);
      response = comparison ? { kind:'candidate-choice', title:'Seat option comparison', summary:`${comparison.studentName}: ${comparison.currentLabel} → ${comparison.targetLabel}.`, comparison, actions:[{label:'Apply seat choice', action:'apply-candidate', value:index}] } : { kind:'clarify', title:'No seat candidate to compare yet', summary:'Ask “What seats would work?” after naming a student.' };
    }

    if (!response && (/\b(show|give|find|what|which)\b.*\b(options?|valid seats?|seat choices?|places? to sit|seats? would work)\b/.test(value) || /^where can (?:they|he|she|the student) sit\??$/.test(value))) {
      const ids = namedStudentIds(command);
      const studentId = ids[0] || selectedOrContextStudentIds()[0];
      response = studentId ? candidateSeatPreview(studentId, command) : { kind:'clarify', title:'Which student should I find seats for?', summary:'Name a student or first discuss that student with the Assistant.' };
    }

    if (!response && /\b(test|testing|exam|assessment)\b/.test(value) && /\b(tomorrow|layout|spread|space|arrange|prepare|set up|setup|maximum separation|as much as possible)\b/.test(value)) response = testingPlan(command);

    if (!response && /\b(save|name|store)(?: this| current)?(?: seating)? plan\b/.test(value)) response = saveNamedPlanRequest(command);
    if (!response && /\b(compare)\b.*\b(saved|named|plans?)\b/.test(value)) response = compareSavedPlansRequest();

    if (!response && /\b(fair|fairer|fairness|rotation fairness|same seat|repeated placements?)\b/.test(value) && /\b(last|previous|plan|chart|compare|fair)\b/.test(value)) response = fairnessComparison();
    if (!response && /\b(who is hardest to seat|fewest valid seats|least seat options|hardest students? to seat)\b/.test(value)) response = chartAnalysis('hardest');
    if (!response && /\b(what should i fix first|where should i start|top priorit(?:y|ies)|most urgent)\b/.test(value)) response = chartAnalysis('priorities');
    if (!response && /\b(which|what)\b.*\b(rule|requirement|constraint)\b.*\b(most|biggest|restrict|pressure|conflict)\b/.test(value)) response = chartAnalysis('pressure');
    if (!response && /\b(review|check|analyze|analyse|health check|how does|how good|what problems)\b.*\b(chart|seating|plan)\b/.test(value)) response = chartAnalysis('summary');

    const feature = !response ? featureRequest(command) : null;
    if (!response && feature) response = { kind:'feature', title:feature.title, summary:feature.summary, actions:[{label:`Open ${feature.title}`, action:feature.action}] };

    if (!response && /\b(make|create|generate|build|fix|repair|keep|seat|move|switch|change|show|why|explain|randomize|shuffle|spread|group|layout|station|front|aisle|teacher|door|window)\b/.test(value)) {
      const preview = normalAssistantPreview(command);
      response = previewToResponse(preview, command);
    }

    if (!response) {
      const preview = normalAssistantPreview(command);
      response = previewToResponse(preview, command);
      if (preview?.intent === 'unknown') {
        response = { kind:'clarify', title:'I can help with the classroom plan, but I need a planner goal', summary:'Name a student, group, rule, seat, layout, testing setup, station rotation, saved plan, analysis question, or repair goal. I will not guess at unrelated classroom decisions.', choices:smartPrompts().slice(0,6).map(label => ({label, action:'prompt', value:label})) };
      }
    }

    renderResponse(response);
    const assistantSummary = response?.title ? `${response.title}. ${response.summary || ''}` : response?.summary || '';
    addTurn('assistant', assistantSummary, response?.kind || '');
    return response;
  }

  function previewToResponse(preview, originalCommand = '') {
    if (!preview) return { kind:'error', title:'Planner Assistant is unavailable', summary:'The underlying planner action did not return a preview.' };
    if (String(preview.intent || '').startsWith('analysis_')) {
      return { kind:'analysis', title:preview.title, summary:preview.summary, metrics:list(preview.impact?.metrics).map(item => [item.label,item.value]), details:list(preview.details) };
    }
    const actions = [];
    if (preview.intent === 'show_valid_seats') actions.push({label:'Show valid seats', action:'apply-base'});
    else if (preview.canApply) actions.push({label:preview.applyLabel || (preview.mutates ? 'Apply changes' : 'Run action'), action:'apply-base'});
    if (preview.intent === 'preview_repair') actions.push({label:'Open repair tools', action:'open-planning'});
    return {
      kind:preview.intent === 'unknown' || preview.intent === 'ambiguous' ? 'clarify' : 'planner-preview',
      title:preview.title,
      summary:preview.summary,
      preview,
      metrics:list(preview.impact?.metrics).map(item => [item.label,item.value]),
      details:[...list(preview.details), ...list(preview.blockers).map(item => `Blocked: ${item}`)],
      operations:list(preview.operations),
      actions,
      originalCommand
    };
  }

  function smartPrompts() {
    const ids = selectedOrContextStudentIds();
    const first = studentById(ids[0]) || students()[0];
    const second = studentById(ids[1]) || students()[1];
    const prompts = [];
    if (first) prompts.push(`What seats would work for ${studentName(first)}?`, `Why is ${studentName(first)} seated here?`);
    if (first && second) prompts.push(`Keep ${studentName(first)} and ${studentName(second)} apart`);
    prompts.push('Review this seating chart', 'What should I fix first?', 'Who is hardest to seat?', 'Compare fairness with the previous saved plan', 'Prepare a testing layout and preserve locked seats', 'Make the smallest changes needed to fix conflicts', 'Open Today Mode', 'Open Planner Packs');
    return [...new Set(prompts)];
  }

  function executeAction(action, value) {
    let message = '';
    if (action === 'apply-base') {
      const result = base.apply?.();
      message = result?.message || (result?.ok ? 'Planner action applied.' : 'The planner action could not be applied.');
    } else if (action === 'apply-candidate') {
      const result = assignCandidate(Number(value));
      message = result.message;
    } else if (action === 'show-options') {
      const workspace = loadWorkspace();
      const response = candidateSeatPreview(workspace.workingPlan.candidateStudentId, workspace.workingPlan.goal);
      renderResponse(response); return response;
    } else if (action === 'apply-testing-preview') {
      const response = testingPlan(loadWorkspace().workingPlan.goal || 'Create a testing layout');
      const config = response?.config || { name:'Testing', preserveLocked:true, respectNeeds:true };
      window.TestingModeV703?.generatePreview?.(config);
      window.TestingModeV703?.open?.();
      message = 'Testing Mode preview opened. Review feasibility and use Testing Mode’s Apply button when ready.';
    } else if (action === 'save-named-plan') {
      const name = normalize(value || runtimePreview?.name || '').slice(0,80);
      document.getElementById('openSeatingPlansBtn')?.click();
      const nameInput = document.getElementById('seatingPlanNameInput');
      if (nameInput) nameInput.value = name;
      const reasonInput = document.getElementById('seatingPlanReasonInput');
      if (reasonInput) reasonInput.value = 'Saved from Planner Assistant';
      const notesInput = document.getElementById('seatingPlanNotesInput');
      if (notesInput) notesInput.value = loadWorkspace().workingPlan.goal.slice(0,1200);
      document.getElementById('saveSeatingPlanBtn')?.click();
      message = name ? `Saved named plan “${name}” using the normal plan workflow.` : 'Opened Named Seating Plans.';
    } else if (action === 'open-plans') { document.getElementById('openSeatingPlansBtn')?.click(); message = 'Named Seating Plans opened.';
    } else if (action === 'open-today') { document.getElementById('todayModeBtn')?.click(); message = 'Today Mode opened.';
    } else if (action === 'open-print') { document.getElementById('printBtn')?.click(); message = 'Print options opened.';
    } else if (action === 'snapshot') { document.getElementById('snapshotQuickBtn')?.click(); message = 'Snapshot workflow opened.';
    } else if (action === 'open-packs') { window.PlannerPacksV720?.open?.(); message = 'Planner Packs opened.';
    } else if (action === 'open-rotations') { window.StationRotationsV702?.open?.(); message = 'Station Rotations opened.';
    } else if (action === 'open-layouts') { window.ActivityLayoutsV701?.open?.(); message = 'Activity Layouts opened.';
    } else if (action === 'open-testing') { window.TestingModeV703?.open?.(); message = 'Testing Mode opened.';
    } else if (action === 'open-planning') { window.PlanningToolsV66?.open?.(); message = 'Planning tools opened.';
    } else if (action === 'open-room') { document.querySelector('[data-workflow="room"],#workflowRoomBtn')?.click(); message = 'Room workspace opened.';
    } else if (action === 'undo') { document.getElementById('undoBtn')?.click(); message = 'Undo requested.';
    } else if (action === 'redo') { document.getElementById('redoBtn')?.click(); message = 'Redo requested.';
    } else if (action === 'prompt') {
      const input = document.getElementById(INPUT_ID); if (input) input.value = String(value || ''); return run(value);
    } else if (action === 'choose-group') {
      const group = groupById(value);
      if (group) {
        updateWorkspace(workspace => { workspace.workingPlan.groupIds = [String(group.id)]; workspace.workingPlan.goal = `Work with ${group.name}`; });
        message = `${group.name} selected as the Assistant’s working group.`;
      }
    }
    if (message) {
      addTurn('assistant', message, 'action');
      renderResponse({ kind:'success', title:'Planner action completed', summary:message });
      try { setLiveStatusMessage?.(message); } catch (_) { /* optional */ }
    }
    return { message };
  }

  function responseMarkup(response) {
    if (!response) return '<div class="hint">Ask the Assistant for a classroom outcome, analysis, or planner action.</div>';
    const metrics = list(response.metrics);
    const details = list(response.details);
    const operations = list(response.operations);
    const actions = list(response.actions);
    const choices = list(response.choices);
    let extra = '';
    if (response.kind === 'seat-options') {
      extra = `<div class="v730-candidates">${list(response.candidates).map((candidate,index) => `<button type="button" class="v730-candidate" data-v730-candidate="${index}"><span><b>Option ${index+1}</b><small>${esc(seatLabel(candidate.key))}</small></span><span class="pill">${esc(candidate.status)}</span>${candidate.occupiedBy ? `<small>Would swap with ${esc(studentName(studentById(candidate.occupiedBy) || {id:candidate.occupiedBy}))}</small>` : '<small>Open seat</small>'}${candidate.messages?.[0] ? `<em>${esc(candidate.messages[0])}</em>` : ''}</button>`).join('') || '<div class="hint">No valid or caution-level seats are available.</div>'}</div>`;
    }
    if (response.comparison) {
      const c = response.comparison;
      extra += `<div class="v730-compare"><div><span>Current</span><strong>${esc(c.currentLabel)}</strong></div><div aria-hidden="true">→</div><div><span>Proposed</span><strong>${esc(c.targetLabel)}</strong><small>${esc(c.targetStatus)}</small></div>${c.swapWith ? `<div class="v730-swap">Swap with ${esc(c.swapWith)}</div>` : ''}</div>`;
    }
    return `<article class="v730-response-card ${esc(response.kind || '')}"><header><div><span class="v730-response-kind">${esc(String(response.kind || 'assistant').replaceAll('-',' '))}</span><h3>${esc(response.title || 'Planner Assistant')}</h3></div></header><p>${esc(response.summary || '')}</p>${metrics.length ? `<div class="v730-metrics">${metrics.map(([label,value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>` : ''}${operations.length ? `<div class="v730-block"><b>Proposed actions</b><ol>${operations.map(item => `<li>${esc(item)}</li>`).join('')}</ol></div>` : ''}${details.length ? `<div class="v730-block"><b>Details</b><ul>${details.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}${extra}${choices.length ? `<div class="v730-choice-row">${choices.map(choice => `<button type="button" class="secondary tiny" data-v730-action="${esc(choice.action)}" data-v730-value="${esc(choice.value || '')}">${esc(choice.label)}</button>`).join('')}</div>` : ''}${actions.length ? `<footer>${actions.map((item,index) => `<button type="button" class="${index ? 'secondary' : ''}" data-v730-action="${esc(item.action)}" data-v730-value="${esc(item.value ?? response.name ?? '')}">${esc(item.label)}</button>`).join('')}</footer>` : ''}</article>`;
  }

  function renderResponse(response) {
    runtimePreview = response;
    const node = document.getElementById(RESPONSE_ID);
    if (node) node.innerHTML = responseMarkup(response);
  }

  function transcriptMarkup() {
    const turns = loadWorkspace().turns;
    if (!turns.length) return '<div class="hint">No Assistant conversation for this class yet.</div>';
    return turns.slice(0,12).reverse().map(turn => `<div class="v730-turn ${turn.role}"><span>${turn.role === 'assistant' ? 'Assistant' : 'You'}</span><p>${esc(turn.text)}</p></div>`).join('');
  }

  function planMarkup() {
    const plan = loadWorkspace().workingPlan;
    const studentNames = plan.studentIds.map(studentById).filter(Boolean).map(studentName);
    const groupNames = plan.groupIds.map(groupById).filter(Boolean).map(group => group.name);
    const constraints = [];
    if (plan.constraints.preserveLocked) constraints.push('Preserve locked seats');
    if (plan.constraints.preserveAccessibility) constraints.push('Respect accessibility / required placement needs');
    if (plan.constraints.minimalMoves) constraints.push('Minimize movement');
    if (plan.constraints.maxMoves) constraints.push(`At most ${plan.constraints.maxMoves} moves`);
    return `<div class="v730-plan-head"><div><strong>${esc(plan.title || 'Working plan')}</strong><span>${esc(plan.goal || 'No active planning goal yet.')}</span></div><button id="plannerAssistantV730ClearPlan" class="ghost tiny" type="button">Clear</button></div><div class="v730-plan-chips">${studentNames.map(name => `<span class="pill">${esc(name)}</span>`).join('')}${groupNames.map(name => `<span class="pill">${esc(name)}</span>`).join('')}${constraints.map(value => `<span class="pill">${esc(value)}</span>`).join('') || '<span class="muted">No explicit constraints recorded.</span>'}</div>${plan.candidateSeats.length ? `<div class="hint">${plan.candidateSeats.length} ranked seat option${plan.candidateSeats.length === 1 ? '' : 's'} currently in context.</div>` : ''}`;
  }

  function renderWorkspaceState() {
    const transcript = document.getElementById(TRANSCRIPT_ID); if (transcript) transcript.innerHTML = transcriptMarkup();
    const plan = document.getElementById(PLAN_ID); if (plan) plan.innerHTML = planMarkup();
    const prompts = document.getElementById('plannerAssistantV730Prompts');
    if (prompts) prompts.innerHTML = smartPrompts().slice(0,8).map(prompt => `<button type="button" class="tiny ghost" data-v730-prompt="${esc(prompt)}">${esc(prompt)}</button>`).join('');
  }

  function workspaceMarkup() {
    return `<section id="${PANEL_ID}" class="section v730-workspace"><div class="v730-workspace-head"><div><span class="v730-kicker">V7.3 Planner Assistant workspace</span><h3>Plan with the classroom, not just commands</h3><p>Ask follow-ups, inspect alternatives, compare impact, analyze the chart, then deliberately apply changes.</p></div><div class="button-row"><button id="plannerAssistantV730Guide" class="secondary tiny" type="button">Guide</button><button id="plannerAssistantV730Clear" class="ghost tiny" type="button">Clear conversation</button></div></div><div id="${PLAN_ID}" class="v730-working-plan"></div><div class="v730-input-wrap"><label for="${INPUT_ID}">Ask the Planner Assistant</label><div class="v730-input-row"><textarea id="${INPUT_ID}" rows="2" placeholder="Example: I have a test tomorrow. Keep accessibility placements, preserve locked seats, spread everyone out as much as possible, and tell me what will not fit."></textarea><button id="plannerAssistantV730Send" type="button">Preview</button></div><div id="plannerAssistantV730Prompts" class="v730-prompts"></div></div><div class="v730-workspace-grid"><section><div class="v730-section-title"><strong>Assistant response</strong><span>Preview before apply</span></div><div id="${RESPONSE_ID}"><div class="hint">Ask for a classroom outcome, seat option, analysis, comparison, saved plan, testing setup, or planner tool.</div></div></section><section><div class="v730-section-title"><strong>Conversation</strong><span>Class-local context</span></div><div id="${TRANSCRIPT_ID}" class="v730-transcript"></div></section></div><details class="v730-tools"><summary>What the Assistant can control</summary><div class="v730-tools-grid"><span>Seat Guidance & candidate seats</span><span>Student requirements & pair/group rules</span><span>Conflict explanation & smallest-change repair</span><span>Activity Layouts</span><span>Testing Mode</span><span>Station Rotations</span><span>Today Mode</span><span>Named Seating Plans & comparisons</span><span>Snapshots / restore points</span><span>Print options</span><span>Planner Packs</span><span>Undo / redo</span></div></details></section>`;
  }

  function ensureWorkspace() {
    const modal = document.getElementById('plannerAssistantV710Modal');
    if (!modal || document.getElementById(PANEL_ID)) return;
    const body = modal.querySelector('.v710-modal-body');
    if (!body) return;
    const intro = body.querySelector('.v710-intro');
    const host = document.createElement('div'); host.innerHTML = workspaceMarkup();
    const panel = host.firstElementChild;
    if (intro) intro.insertAdjacentElement('afterend', panel); else body.prepend(panel);
    const legacyRequest = body.querySelector('.v710-request');
    if (legacyRequest) legacyRequest.classList.add('v730-legacy-request');
    const legacyImpact = [...body.querySelectorAll('.section')].find(section => section.querySelector('#plannerAssistantV710Preview'));
    if (legacyImpact) legacyImpact.classList.add('v730-legacy-preview');
    renderWorkspaceState();
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style'); style.id = STYLE_ID;
    style.textContent = `.v730-workspace{display:grid;gap:12px;border-width:2px}.v730-workspace-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.v730-workspace-head h3{margin:2px 0 3px}.v730-workspace-head p{margin:0;color:var(--muted,#64748b);font-size:11px}.v730-kicker{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:var(--muted,#64748b)}.v730-working-plan{display:grid;gap:7px;padding:10px;border:1px solid var(--border,#d8deea);border-radius:10px;background:color-mix(in srgb,var(--panel,#fff) 96%,#f8fafc 4%)}.v730-plan-head{display:flex;justify-content:space-between;gap:10px}.v730-plan-head>div{display:grid;gap:2px}.v730-plan-head span{font-size:10px;color:var(--muted,#64748b)}.v730-plan-chips{display:flex;gap:5px;flex-wrap:wrap}.v730-input-wrap{display:grid;gap:6px}.v730-input-wrap>label{font-weight:900}.v730-input-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:stretch}.v730-input-row textarea{resize:vertical;min-height:58px}.v730-prompts{display:flex;gap:5px;flex-wrap:wrap}.v730-prompts button{font-size:9.5px;text-align:left}.v730-workspace-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(250px,.65fr);gap:10px}.v730-workspace-grid>section{min-width:0;display:grid;align-content:start;gap:7px}.v730-section-title{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.v730-section-title span{font-size:9px;color:var(--muted,#64748b)}.v730-response-card{display:grid;gap:9px;padding:11px;border:1px solid var(--border,#d8deea);border-radius:11px;background:var(--panel,#fff)}.v730-response-card h3{margin:2px 0 0}.v730-response-card p{margin:0;color:var(--muted,#64748b);line-height:1.45}.v730-response-kind{font-size:8.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:900;color:var(--muted,#64748b)}.v730-response-card footer,.v730-choice-row{display:flex;gap:7px;flex-wrap:wrap}.v730-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px}.v730-metrics>div{display:grid;gap:2px;padding:8px;border:1px solid var(--border,#d8deea);border-radius:9px}.v730-metrics span{font-size:9px;color:var(--muted,#64748b)}.v730-metrics strong{font-size:14px}.v730-block{padding:8px 9px;border:1px solid var(--border,#d8deea);border-radius:9px;font-size:11px}.v730-block ol,.v730-block ul{margin:5px 0 0 18px;padding:0}.v730-candidates{display:grid;grid-template-columns:1fr 1fr;gap:6px}.v730-candidate{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px;text-align:left;padding:8px;border:1px solid var(--border,#d8deea);border-radius:9px;background:var(--panel,#fff);color:inherit}.v730-candidate span:first-child{display:grid}.v730-candidate small,.v730-candidate em{font-size:9px;color:var(--muted,#64748b);font-style:normal}.v730-candidate em{grid-column:1/-1}.v730-compare{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;padding:10px;border:1px solid var(--border,#d8deea);border-radius:9px}.v730-compare>div:not(.v730-swap){display:grid;gap:2px}.v730-compare span,.v730-compare small{font-size:9px;color:var(--muted,#64748b)}.v730-swap{grid-column:1/-1;font-size:10px;color:var(--muted,#64748b)}.v730-transcript{display:grid;gap:6px;max-height:420px;overflow:auto;padding-right:3px}.v730-turn{display:grid;gap:2px;padding:7px 9px;border-radius:9px;border:1px solid var(--border,#d8deea)}.v730-turn.user{background:color-mix(in srgb,var(--panel,#fff) 94%,var(--accent-soft,#dbeafe) 6%)}.v730-turn.assistant{background:var(--panel,#fff)}.v730-turn span{font-size:8.5px;font-weight:900;text-transform:uppercase;color:var(--muted,#64748b)}.v730-turn p{margin:0;font-size:10.5px;line-height:1.4}.v730-tools summary{font-weight:900;cursor:pointer}.v730-tools-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}.v730-tools-grid span{padding:7px;border:1px solid var(--border,#d8deea);border-radius:8px;font-size:10px}.v730-legacy-request,.v730-legacy-preview{display:none!important}@media(max-width:820px){.v730-workspace-head,.v730-plan-head{flex-direction:column;align-items:stretch}.v730-input-row{grid-template-columns:1fr}.v730-input-row button{width:100%}.v730-workspace-grid{grid-template-columns:1fr}.v730-transcript{max-height:260px}.v730-tools-grid{grid-template-columns:1fr 1fr}}@media(max-width:520px){.v730-candidates,.v730-tools-grid{grid-template-columns:1fr}.v730-prompts{display:grid;grid-template-columns:1fr}.v730-response-card footer,.v730-choice-row{display:grid}.v730-response-card footer button,.v730-choice-row button{width:100%}}`;
    document.head.appendChild(style);
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('#plannerAssistantV730Send')) { const input=document.getElementById(INPUT_ID); if (input) run(input.value); return; }
    if (target.closest('#plannerAssistantV730Clear')) { clearWorkspace(); return; }
    if (target.closest('#plannerAssistantV730ClearPlan')) { updateWorkspace(workspace => { workspace.workingPlan = blankWorkspace().workingPlan; }); renderResponse({kind:'info',title:'Working plan cleared',summary:'The conversation remains, but candidate seats and planning constraints were cleared.'}); return; }
    if (target.closest('#plannerAssistantV730Guide')) { base.showGuide?.(); return; }
    const prompt = target.closest('[data-v730-prompt]'); if (prompt) { const value=prompt.getAttribute('data-v730-prompt') || ''; const input=document.getElementById(INPUT_ID); if(input)input.value=value; run(value); return; }
    const candidate = target.closest('[data-v730-candidate]'); if (candidate) { const index=Number(candidate.getAttribute('data-v730-candidate')); const c=compareCandidate(index); if(c)renderResponse({kind:'candidate-choice',title:`Option ${index+1}: ${c.targetLabel}`,summary:`${c.studentName}: ${c.currentLabel} → ${c.targetLabel}${c.swapWith ? `, swapping with ${c.swapWith}` : ''}.`,comparison:c,actions:[{label:'Apply seat choice',action:'apply-candidate',value:index},{label:'Refresh options',action:'show-options'}]}); return; }
    const action = target.closest('[data-v730-action]'); if (action) { executeAction(action.getAttribute('data-v730-action') || '', action.getAttribute('data-v730-value') || ''); return; }
  }

  function onKeydown(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.id === INPUT_ID && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); run(target.value); }
  }

  function scheduleRefresh() { if (refreshPending) return; refreshPending=true; requestAnimationFrame(() => { refreshPending=false; ensureWorkspace(); renderWorkspaceState(); }); }

  function install() {
    if (installed) return;
    installed = true;
    installStyles();
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('change', event => { const target=event.target instanceof Element ? event.target : null; if(target?.matches?.('#classSelect,[data-class-id]')) setTimeout(() => { runtimePreview=null; renderWorkspaceState(); renderResponse(null); },0); }, true);
    if (document.body) { observer=new MutationObserver(scheduleRefresh); observer.observe(document.body,{childList:true,subtree:true}); }
    ensureWorkspace();
  }

  function afterReady() { ensureWorkspace(); renderWorkspaceState(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true }); else install();

  return Object.freeze({
    version:VERSION, installed:true, install, afterReady, run, executeAction, loadWorkspace, clearWorkspace, smartPrompts,
    candidateSeatPreview, compareCandidate, assignCandidate, chartAnalysis, fairnessComparison, testingPlan,
    currentResponse:() => clone(runtimePreview)
  });
})();
