window.PlannerAssistantV710 = (() => {
  'use strict';

  const VERSION = '7.1.0';
  const COMMAND_SCHEMA = 'classroom-seating-planner-command-v1';
  const STYLE_ID = 'plannerAssistantV710Styles';
  const MODAL_ID = 'plannerAssistantV710Modal';
  const DOCK_ID = 'plannerAssistantV710Dock';
  const HISTORY_PREFIX = 'classroom-seating-planner-assistant-history-v710:';
  const UI_PREFS_KEY = 'classroom-seating-planner-assistant-ui-v721';
  const MAX_HISTORY = 20;
  const EXAMPLES = Object.freeze([
    'Show valid seats for Ada',
    'Keep Katherine near the front and away from Alan',
    'Seat Ada and Grace together',
    'Create a testing layout with at least 5 feet between students',
    'Make the smallest changes needed to fix conflicts',
    'Why is Dorothy seated here?'
  ]);

  let installed = false;
  let currentPreview = null;
  let bodyObserver = null;
  let uiPrefs = loadUiPrefs();

  const list = value => Array.isArray(value) ? value : [];
  const clone = value => {
    if (typeof deepClone === 'function') return deepClone(value);
    return JSON.parse(JSON.stringify(value ?? null));
  };
  const esc = value => typeof escapeHtml === 'function'
    ? escapeHtml(String(value ?? ''))
    : String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const nowIso = () => new Date().toISOString();
  const normalizeText = value => String(value || '').trim().replace(/\s+/g, ' ');
  const lower = value => normalizeText(value).toLowerCase();
  const countHard = findings => list(findings).filter(item => item?.severity === 'bad').length;
  const countWarnings = findings => list(findings).filter(item => item?.severity !== 'bad').length;

  function loadUiPrefs(){try{const x=JSON.parse(localStorage.getItem(UI_PREFS_KEY)||'{}');return{dockHidden:Boolean(x.dockHidden),guideOpen:Boolean(x.guideOpen)}}catch(_){return{dockHidden:false,guideOpen:false}}}
  function saveUiPrefs(){try{localStorage.setItem(UI_PREFS_KEY,JSON.stringify(uiPrefs))}catch(_){}}

  function isPresentationMode() {
    return Boolean(document.body?.classList.contains('visibility-mode'));
  }

  function activeClassId() {
    try {
      const record = typeof activeClassRecord === 'function' ? activeClassRecord() : null;
      if (record?.id) return String(record.id);
    } catch (_) { /* fallback */ }
    return String(state?.activeClassId || state?.classId || 'default');
  }

  function historyKey() {
    return `${HISTORY_PREFIX}${activeClassId()}`;
  }

  function loadHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(historyKey()) || '[]');
      return list(parsed).slice(0, MAX_HISTORY).filter(item => item && item.command);
    } catch (_) {
      return [];
    }
  }

  function saveHistory(items) {
    try { localStorage.setItem(historyKey(), JSON.stringify(list(items).slice(0, MAX_HISTORY))); } catch (_) { /* local history is optional */ }
  }

  function recordHistory(command, preview, outcome = '') {
    const item = {
      command:normalizeText(command),
      intent:String(preview?.intent || ''),
      title:String(preview?.title || ''),
      outcome:String(outcome || '').slice(0, 240),
      at:nowIso()
    };
    const next = loadHistory().filter(entry => lower(entry.command) !== lower(item.command));
    next.unshift(item);
    saveHistory(next);
    renderHistory();
  }

  function students() {
    return list(state?.students).filter(student => student && !student.archived);
  }

  function displayStudent(student) {
    try { if (typeof studentDisplay === 'function') return studentDisplay(student); } catch (_) { /* fallback */ }
    return [student?.nickName || student?.firstName, student?.lastName].filter(Boolean).join(' ').trim() || String(student?.id || 'Student');
  }

  function studentAliases(student) {
    const values = [
      displayStudent(student),
      [student?.firstName, student?.lastName].filter(Boolean).join(' '),
      student?.nickName,
      student?.firstName,
      student?.lastName
    ].map(normalizeText).filter(value => value.length >= 2);
    return [...new Set(values.map(value => value.toLowerCase()))].sort((a, b) => b.length - a.length);
  }

  function escapedRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function studentMentions(command) {
    const text = lower(command);
    const candidates = [];
    students().forEach(student => {
      studentAliases(student).forEach(alias => {
        const pattern = new RegExp(`(^|[^a-z0-9])(${escapedRegex(alias)})(?=$|[^a-z0-9])`, 'i');
        const match = pattern.exec(text);
        if (!match) return;
        const start = match.index + match[1].length;
        candidates.push({ start, end:start + alias.length, alias, student });
      });
    });
    candidates.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const selected = [];
    candidates.forEach(candidate => {
      if (selected.some(item => candidate.start < item.end && candidate.end > item.start)) return;
      const same = candidates.filter(item => item.start === candidate.start && item.end === candidate.end && item.alias === candidate.alias);
      selected.push({
        start:candidate.start,
        end:candidate.end,
        text:candidate.alias,
        students:[...new Map(same.map(item => [String(item.student.id), item.student])).values()]
      });
    });
    return selected.sort((a, b) => a.start - b.start);
  }

  function parseCount(command,words=[]){const text=lower(command);for(const word of words){const m=text.match(new RegExp('\\b(\\d+)\\s+'+escapedRegex(word)+'s?\\b'));if(m)return Math.max(1,Math.min(60,Number(m[1])||1))}return 0}
  function requestedMaxMoves(command){const m=lower(command).match(/(?:move|moving|change|changing)\s+(?:no more than|at most|max(?:imum)?(?: of)?|up to)\s*(\d+)\s*students?|(?:no more than|at most|max(?:imum)?(?: of)?|up to)\s*(\d+)\s*(?:student )?moves?/);return m?Math.max(1,Math.min(60,Number(m[1]||m[2])||1)):0}
  function layoutPresetFromCommand(command){const text=lower(command);const e=[['direct',/\b(direct instruction|rows?|lecture|front[- ]?facing)\b/],['group',/\b(group work|collaborative|collaboration|pods?|small groups?)\b/],['discussion',/\b(discussion|circle|seminar|socratic)\b/],['lab',/\b(lab|stations? layout|station work|centers?)\b/],['independent',/\b(independent|individual work|spaced work|quiet work)\b/]];return e.find(([,q])=>q.test(text))?.[0]||''}

  function groupMatch(command) {
    const text = lower(command);
    return list(state?.groups)
      .map(group => ({ group, name:lower(group?.name) }))
      .filter(item => item.name && text.includes(item.name))
      .sort((a, b) => b.name.length - a.name.length)[0]?.group || null;
  }

  function activityLayoutMatch(command) {
    const layouts = window.ActivityLayoutsV701;
    if (!layouts?.ensureStore) return null;
    const store = layouts.ensureStore({ reconcileActive:false });
    const text = lower(command);
    return list(store?.layouts)
      .map(entry => ({ entry, name:lower(entry?.name) }))
      .filter(item => item.name && text.includes(item.name))
      .sort((a, b) => b.name.length - a.name.length)[0]?.entry || null;
  }

  function requirementChanges(command) {
    const text = lower(command);
    const clearing = /\b(remove|clear|stop|no longer|do not|don't)\b/.test(text);
    const changes = {};
    if (/\b(front|front row|near the front|near front)\b/.test(text)) {
      changes.front = clearing ? 'none' : /\b(require|required|must|needs? to|has to)\b/.test(text) ? 'require' : 'prefer';
    }
    if (/\b(left side|left-hand side)\b/.test(text)) changes.side = clearing ? 'none' : 'left';
    if (/\b(right side|right-hand side)\b/.test(text)) changes.side = clearing ? 'none' : 'right';
    if (/\b(near|close to) (the )?teacher\b|\bnearTeacher\b/i.test(command)) changes.nearTeacher = !clearing;
    if (/\b(aisle|near an aisle|near the aisle)\b/.test(text)) changes.aisle = !clearing;
    if (/\b(ada|accessible|accessibility)\b/.test(text)) changes.ada = !clearing;
    if (/\baway from (the )?door\b|\bfar from (the )?door\b/.test(text)) changes.awayDoor = !clearing;
    if (/\baway from (the )?window\b|\bfar from (the )?window\b/.test(text)) changes.awayWindow = !clearing;
    return changes;
  }

  function parseSpacing(command) {
    const text = lower(command);
    const match = text.match(/(?:at least|min(?:imum)?|spacing(?: of)?|between(?: students)?(?: of)?)?\s*(\d+(?:\.\d+)?)\s*(feet|foot|ft|meters|meter|metres|metre|m)\b/);
    if (!match) return null;
    return { value:Number(match[1]), unit:match[2] };
  }

  function normalizedSpacing(parsed) {
    if (!parsed) return null;
    const room = window.ClassroomDigitalTwinV700?.physicalRoom?.() || { enabled:false, unit:'ft' };
    if (!room.enabled) return { blocker:'Enable real room dimensions before requesting testing spacing in feet or meters.' };
    const sourceFeet = ['feet','foot','ft'].includes(parsed.unit);
    const sourceMeters = ['meters','meter','metres','metre','m'].includes(parsed.unit);
    let value = parsed.value;
    if (room.unit === 'm' && sourceFeet) value *= 0.3048;
    if (room.unit === 'ft' && sourceMeters) value /= 0.3048;
    return { value, unit:room.unit, original:parsed };
  }

  function ambiguityBlock(mentions) {
    const ambiguous = mentions.filter(item => item.students.length !== 1);
    if (!ambiguous.length) return [];
    return ambiguous.map(item => ({
      message:`“${item.text}” matches more than one student. Use a full name or nickname so the planner does not guess.`,
      candidates:item.students.map(student => ({ id:String(student.id), name:displayStudent(student) }))
    }));
  }

  function interpret(commandInput) {
    const command = normalizeText(commandInput);
    const text = lower(command);
    const mentions = studentMentions(command);
    const ambiguities = ambiguityBlock(mentions);
    const exactStudents = mentions.filter(item => item.students.length === 1).map(item => item.students[0]);
    const result = {
      schema:COMMAND_SCHEMA,
      version:1,
      command,
      intent:'unknown',
      title:'I need a little more detail',
      summary:'I did not recognize a safe planner action yet. Open the built-in guide for supported requests and examples, or name a student, group, layout, testing setup, station rotation, seating-plan action, or conflict to repair.',
      mutates:false,
      entities:{ students:exactStudents.map(student => ({ id:String(student.id), name:displayStudent(student) })) },
      parameters:{},
      ambiguities,
      blockers:[],
      operations:[]
    };
    if (!command) {
      result.title = 'Enter a classroom planning request';
      result.summary = 'The local interpreter will translate it into explicit planner operations before anything changes.';
      return result;
    }
    if (ambiguities.length) {
      result.intent = 'ambiguous';
      result.title = 'Student name needs clarification';
      result.summary = 'The planner found multiple possible students and will not choose one on your behalf.';
      return result;
    }

    if (/\b(help|how do i|how can i|what can|what does)\b.*\b(planner assistant|assistant)\b|^\s*(help|commands|examples)\s*$/.test(text)){result.intent='assistant_help';result.title='Planner Assistant guide';result.summary='Open the built-in guide with supported request types and examples.';result.operations=['Open Planner Assistant guide'];return result}

    if (/\b(which|what)\b.*\b(requirement|rule|constraint)\b.*\b(conflict|problem|issue)|\bwhat('?s| is) causing (the )?most conflicts?\b|\b(explain|show|what(?: is|'s))\b.*\b(conflicts?|problems?|issues?|wrong)\b|\bwhat(?: is|'s) wrong\b/.test(text)) {
      result.intent = 'explain_conflicts';
      result.title = 'Explain the biggest rule conflicts';
      result.summary = 'Review current rule findings and identify the most frequent concrete causes.';
      result.operations = ['Analyze current explicit rule findings', 'Rank repeated conflict causes without changing the chart'];
      return result;
    }

    if ((/\bvalid seats?\b|\bshow (me )?(the )?seats?\b|\bwhere can\b.*\b(sit|seat)\b|\bwhere (?:should|could)\b.*\b(sit|seat)\b/.test(text)) && exactStudents.length === 1) {
      result.intent = 'show_valid_seats';
      result.title = `Show valid seats for ${displayStudent(exactStudents[0])}`;
      result.summary = 'Highlight seats using the existing Seat Guidance engine and the student’s explicit requirements.';
      result.operations = [`Run Seat Guidance for ${displayStudent(exactStudents[0])}`];
      return result;
    }

    if (/\bwhy\b.*\b(sit|seat|sitting|seated)\b.*\b(here|there|this seat)\b/.test(text) && exactStudents.length === 1) {
      result.intent = 'explain_selected_seat';
      result.title = `Explain the selected seat for ${displayStudent(exactStudents[0])}`;
      result.summary = 'Check the currently selected seat against the same rule engine used by Seat Guidance.';
      result.operations = ['Evaluate the selected seat', 'Show the concrete rule result and messages'];
      return result;
    }

    if (/\btesting\b|\btest layout\b|\bassessment layout\b|\b(spread|space)\b.*\b(test|exam|assessment)\b/.test(text)) {
      result.intent = 'testing_preview';
      result.title = 'Preview a Testing Mode layout';
      result.summary = 'Generate a non-destructive testing arrangement preview. Applying the assistant action will still leave Testing Mode’s own final Apply step in place.';
      const parsed = parseSpacing(command);
      const spacing = normalizedSpacing(parsed);
      if (spacing?.blocker) result.blockers.push(spacing.blocker);
      if (spacing?.value) result.parameters.spacing = spacing.value;
      result.parameters.name = /assessment/.test(text) ? 'Assessment' : 'Testing';
      result.operations = ['Analyze active-student spacing', 'Preserve locked seats and assignments', 'Open the generated Testing Mode preview for teacher review'];
      return result;
    }

    if (/\bstations?\b.*\b(rotat|rotation)|\b(rotat(?:e|es|ed|ing|ion)?)\b.*\bstations?\b/.test(text)){const c=parseCount(command,['group','team']);const make=/\b(create|make|build|set up|setup|generate|plan)\b/.test(text)||c>0||/\bthrough the stations?\b/.test(text);result.intent=make?'create_station_rotation':'open_station_rotations';result.title=make?'Create a station rotation':'Open Station Rotations';result.summary=make?'Build a rotation from the current station anchors and active roster.':'Open Station Rotations.';result.parameters.teamCount=c;result.parameters.teamSource=/\b(existing|current|classroom) groups?\b/.test(text)?'classroom-groups':'balanced';if(make){const x=window.StationRotationsV702?.stationCandidates?.()||[];if(state?.layoutMode!=='freeform')result.blockers.push('Station rotations require a Freeform room.');if(x.length<2)result.blockers.push('Add at least two Activity Stations, Lab Stations, or tables before creating a rotation.');result.operations=['Use current station anchors','Build teams from the active roster','Create the rotation and open Station Rotations']}else result.operations=['Open Station Rotations'];return result}

    const layoutPreset=layoutPresetFromCommand(command);
    if(layoutPreset&&/\b(create|make|build|generate|new|layout|arrangement|classroom)\b/.test(text)){const preset=window.ActivityLayoutsV701?.presets?.find?.(x=>x.id===layoutPreset);result.intent='create_activity_layout';result.title='Create '+(preset?.name||'Activity')+' layout';result.summary='Create a separate Activity Layout while keeping the current arrangement available.';result.mutates=true;result.parameters.presetId=layoutPreset;result.parameters.presetName=preset?.name||layoutPreset;result.operations=['Create a new '+(preset?.name||layoutPreset)+' Activity Layout','Keep fixed physical-room objects shared'];if(state?.layoutMode!=='freeform')result.blockers.push('Activity Layouts require a Freeform room.');return result}

    if (/\b(switch|change|go|use|activate)\b.*\b(layout|arrangement)\b/.test(text)) {
      const target = activityLayoutMatch(command);
      result.intent = 'switch_activity_layout';
      result.title = target ? `Switch to ${target.name}` : 'Choose an Activity Layout';
      result.summary = target ? 'Switch the physical room arrangement while preserving matching student assignments.' : 'Name an existing Activity Layout in the request.';
      if (target) {
        result.parameters.layoutId = String(target.id);
        result.parameters.layoutName = String(target.name);
        result.mutates = true;
        result.operations = [`Switch the active Activity Layout to ${target.name}`];
      } else result.blockers.push('No existing Activity Layout name was found in the request.');
      return result;
    }

    if (/\b(fix|repair|resolve|improve)\b.*\b(conflicts?|problems?|issues?|chart|plan|seating)|\bsmallest changes?\b|\bchange as little as possible\b|\bminimal movement\b/.test(text)) {
      result.intent = 'preview_repair';
      result.title = 'Preview a smallest-change repair';
      result.summary = 'Use Classroom Intelligence to search for a better arrangement, then leave the normal repair preview visible for review.';
      result.parameters.scenario = /\bfair|rotation\b/.test(text) ? 'rotation'
        : /\baccessib/.test(text) ? 'accessibility'
        : /\bcollabor/.test(text) ? 'collaboration'
        : /\bminimal|smallest|fewest\b/.test(text) ? 'stable'
        : 'balanced';
      result.parameters.maxMoves=requestedMaxMoves(command);
      result.operations=[`Use the ${result.parameters.scenario} Classroom Intelligence objective`,result.parameters.maxMoves?`Limit the repair to at most ${result.parameters.maxMoves} student moves`:'Use the objective’s normal movement limit','Build a non-destructive repair preview'];
      return result;
    }

    if(/\b(randomize|shuffle|mix up)\b.*\b(seats?|students?|chart)?\b/.test(text)){result.intent='randomize_chart';result.title='Randomize and seat everyone';result.summary='Use the existing Randomize + Seat Everyone action.';result.mutates=true;result.operations=['Run Randomize + Seat Everyone'];return result}
    if(/\b(make|create|generate|build)\b.*\b(seating chart|seating plan|best plan|best seating)\b/.test(text)){result.intent='generate_chart';result.title='Generate a seating chart';result.summary='Use the existing rule-aware Generate Chart workflow.';result.operations=['Run Generate Chart','Review the generated option'];return result}

    const reqChanges = requirementChanges(command);
    const betweenFirstTwo = mentions.length >= 2 ? text.slice(mentions[0].end, mentions[1].start) : '';
    const relation = exactStudents.length >= 2 && (/\b(separate|apart|not together|avoid)\b/.test(text) || /\baway from\b/.test(betweenFirstTwo)) ? 'separate'
      : exactStudents.length >= 2 && /\b(together|near each other|next to each other|close together)\b/.test(text) ? 'together'
      : '';
    if (Object.keys(reqChanges).length || relation) {
      result.intent = 'rule_changes';
      result.mutates = true;
      result.title = 'Update explicit seating rules';
      result.summary = 'Translate the request into normal student requirements and/or a normal seating group. Nothing is hidden from the existing rule editor.';
      result.parameters.requirementChanges = reqChanges;
      result.parameters.relation = relation;
      result.parameters.requirementTargetIds = Object.keys(reqChanges).length ? (relation ? exactStudents.slice(0, 1) : exactStudents).map(student => String(student.id)) : [];
      if (Object.keys(reqChanges).length && exactStudents.length < 1) result.blockers.push('At least one student must be named for the individual seating requirement.');
      if (relation && exactStudents.length < 2) result.blockers.push('Two students must be named for a pair seating rule.');
      if (Object.keys(reqChanges).length) {
        exactStudents.filter(student => result.parameters.requirementTargetIds.includes(String(student.id))).forEach(student => {
          Object.entries(reqChanges).forEach(([key, value]) => result.operations.push(`Set ${displayStudent(student)}: ${key} = ${String(value)}`));
        });
      }
      if (relation === 'separate') result.operations.push(`Keep ${displayStudent(exactStudents[0])} and ${displayStudent(exactStudents[1])} apart using the existing minimum-distance pair rule`);
      if (relation === 'together') result.operations.push(`Create or reuse a normal “Seat together / nearby” group for ${displayStudent(exactStudents[0])} and ${displayStudent(exactStudents[1])}`);
      return result;
    }

    const matchedGroup = groupMatch(command);
    if (matchedGroup && /\b(together|spread|apart|separate|nearby|close)\b/.test(text)) {
      result.intent = 'group_rule_change';
      result.mutates = true;
      const nextType = /\bspread|apart|separate\b/.test(text) ? 'spread' : 'together';
      result.parameters.groupId = String(matchedGroup.id);
      result.parameters.groupType = nextType;
      result.title = `Change ${matchedGroup.name} to ${nextType === 'spread' ? 'Spread apart' : 'Seat together / nearby'}`;
      result.summary = 'Change the existing group rule type. Group membership is left untouched.';
      result.operations = [`Set ${matchedGroup.name} group type to ${nextType}`];
      return result;
    }

    if ((/\bwhy\b|\bexplain\b/.test(text)) && exactStudents.length === 1) {
      result.intent = 'explain_student';
      result.title = `Explain ${displayStudent(exactStudents[0])}’s current placement`;
      result.summary = 'Show current seat, relevant rule findings, and how many seats are currently valid.';
      result.operations = ['Inspect current assignment', 'Collect current rule findings for this student', 'Run Seat Guidance without moving anyone'];
      return result;
    }

    return result;
  }

  function currentFindings() {
    try { return typeof evaluateCurrentRuleViolations === 'function' ? list(evaluateCurrentRuleViolations({ includeUnseated:true })) : []; }
    catch (_) { return []; }
  }

  function findingsForStudent(studentId, findings = currentFindings()) {
    const id = String(studentId || '');
    return findings.filter(item => list(item?.studentIds).map(String).includes(id));
  }

  function seatGuidanceCounts(studentId) {
    try {
      const results = window.SeatGuidanceV66?.calculate?.(studentId) || [];
      return {
        valid:results.filter(item => item.status === 'valid').length,
        caution:results.filter(item => item.status === 'caution').length,
        invalid:results.filter(item => item.status === 'invalid' || item.status === 'blocked').length,
        results
      };
    } catch (_) {
      return { valid:0, caution:0, invalid:0, results:[] };
    }
  }

  function selectedSeatKey() {
    try {
      const ids = uiState?.freeformSelectedObjectIds;
      if (state?.layoutMode === 'freeform' && ids?.size === 1) return String([...ids][0]);
    } catch (_) { /* DOM fallback */ }
    const freeform = document.querySelector('.freeform-object.seat.selected[data-object-id], .freeform-object.seat.is-selected[data-object-id]');
    if (freeform) return String(freeform.dataset.objectId || '');
    const grid = document.querySelector('.cell.seat.selected[data-cell-key], .cell.seat.is-selected[data-cell-key]');
    return grid ? String(grid.dataset.cellKey || '') : '';
  }

  function seatLabelForStudent(studentId) {
    if (state?.layoutMode === 'freeform') {
      const seat = list(state?.freeformLayout?.objects).find(object => object?.type === 'seat' && String(object.assignedStudentId || '') === String(studentId));
      return seat ? String(seat.label || seat.id || 'Freeform seat') : 'Unseated';
    }
    const entry = Object.entries(state?.cells || {}).find(([, cell]) => cell?.type === 'seat' && String(cell.assignedStudentId || '') === String(studentId));
    return entry ? String(entry[0]) : 'Unseated';
  }

  function metric(label, value, detail = '') {
    return { label:String(label), value:String(value), detail:String(detail || '') };
  }

  function makePreview(intent) {
    const preview = {
      ...clone(intent),
      createdAt:nowIso(),
      impact:{ metrics:[], notes:[] },
      details:[],
      canApply:!intent.blockers.length && intent.intent !== 'unknown' && intent.intent !== 'ambiguous',
      applyLabel:intent.mutates ? 'Apply changes' : 'Run action'
    };
    if (isPresentationMode() && intent.mutates) {
      preview.blockers.push('Presentation mode is read-only. Exit Presentation mode before applying planner changes.');
      preview.canApply = false;
    }
    const studentIds = list(intent.entities?.students).map(item => String(item.id));

    if (intent.intent === 'show_valid_seats' && studentIds[0]) {
      const counts = seatGuidanceCounts(studentIds[0]);
      preview.impact.metrics.push(metric('Valid seats', counts.valid), metric('Warnings', counts.caution), metric('Unavailable', counts.invalid));
    } else if (intent.intent === 'explain_selected_seat' && studentIds[0]) {
      const key = selectedSeatKey();
      if (!key) {
        preview.blockers.push('Select one seat first, then rerun the request.');
        preview.canApply = false;
      } else {
        const counts = seatGuidanceCounts(studentIds[0]);
        const result = counts.results.find(item => String(item.key) === key);
        preview.details.push(result ? `${key}: ${result.status}. ${list(result.messages).join(' ') || 'No rule conflicts were reported.'}` : `${key}: no Seat Guidance result was available.`);
        preview.impact.metrics.push(metric('Seat', key), metric('Status', result?.status || 'unknown'));
      }
    } else if (intent.intent === 'explain_student' && studentIds[0]) {
      const findings = findingsForStudent(studentIds[0]);
      const counts = seatGuidanceCounts(studentIds[0]);
      preview.impact.metrics.push(metric('Current seat', seatLabelForStudent(studentIds[0])), metric('Required conflicts', countHard(findings)), metric('Warnings', countWarnings(findings)), metric('Valid seats', counts.valid));
      preview.details.push(...(findings.length ? findings.slice(0, 8).map(item => item.message) : ['No current rule findings involve this student.']));
    } else if (intent.intent === 'explain_conflicts') {
      const findings = currentFindings();
      const grouped = new Map();
      findings.forEach(item => {
        const key = String(item?.message || item?.category || 'Rule finding');
        const record = grouped.get(key) || { count:0, severity:item?.severity, message:key };
        record.count += 1;
        grouped.set(key, record);
      });
      const ranked = [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, 8);
      preview.impact.metrics.push(metric('Required conflicts', countHard(findings)), metric('Warnings', countWarnings(findings)), metric('Distinct causes', grouped.size));
      preview.details.push(...(ranked.length ? ranked.map(item => `${item.count}× ${item.message}`) : ['No current rule conflicts were detected.']));
    } else if (intent.intent === 'rule_changes') {
      buildRuleImpact(preview);
    } else if (intent.intent === 'group_rule_change') {
      const group = list(state?.groups).find(item => String(item.id) === String(intent.parameters.groupId));
      preview.impact.metrics.push(metric('Students affected', list(group?.studentIds).length), metric('Current rule', group?.type || 'unknown'), metric('Proposed rule', intent.parameters.groupType));
    } else if (intent.intent === 'testing_preview') {
      try {
        const config = { name:intent.parameters.name || 'Testing' };
        if (intent.parameters.spacing) config.spacing = intent.parameters.spacing;
        const analysis = window.TestingModeV703?.analyze?.(config);
        if (!analysis) {
          preview.blockers.push('Testing Mode needs a Freeform room.');
          preview.canApply = false;
        } else {
          preview.data = { testingConfig:config };
          preview.impact.metrics.push(metric('Active students', analysis.report.activeSeatCount), metric('Moves proposed', analysis.report.movedCount), metric('Minimum spacing', `${analysis.report.achievedSpacing.toFixed(analysis.report.achievedSpacing < 10 ? 1 : 0)} ${analysis.report.unit}`), metric('Spacing conflicts', analysis.report.spacingConflicts));
          preview.details.push(...analysis.report.impossibleReasons.slice(0, 6));
        }
      } catch (error) {
        preview.blockers.push(`Testing Mode could not analyze this room: ${error?.message || error}`);
        preview.canApply = false;
      }
    } else if (intent.intent === 'switch_activity_layout') {
      try {
        const layouts = window.ActivityLayoutsV701;
        const store = layouts?.ensureStore?.({ reconcileActive:true });
        const comparison = layouts?.comparison?.(store?.activeId, intent.parameters.layoutId, { syncCurrent:true });
        if (comparison) {
          preview.impact.metrics.push(metric('Objects moved', comparison.movedIds.length), metric('Objects added', comparison.addedIds.length), metric('Objects removed', comparison.removedIds.length));
          if (comparison.physicalMovement) preview.impact.metrics.push(metric('Total movement', `${comparison.physicalMovement.value.toFixed(1)} ${comparison.physicalMovement.unit}`));
        }
      } catch (_) { /* comparison is informative only */ }
    } else if(intent.intent==='create_activity_layout'){preview.impact.metrics.push(metric('Starter',intent.parameters.presetName||intent.parameters.presetId));preview.details.push('A separate Activity Layout will be created.');
    } else if(intent.intent==='create_station_rotation'){const x=window.StationRotationsV702?.stationCandidates?.()||[];preview.impact.metrics.push(metric('Station anchors',x.length),metric('Teams requested',intent.parameters.teamCount||x.length));
    } else if(intent.intent==='randomize_chart'||intent.intent==='generate_chart'){preview.impact.metrics.push(metric('Active students',typeof seatingStudents==='function'?list(seatingStudents()).length:students().length));
    } else if (intent.intent === 'preview_repair') {
      try {
        setIntelligenceScenario(intent.parameters.scenario || 'balanced',intent.parameters.maxMoves||0);
        const repair = window.ClassroomIntelligenceV68?.buildRepairPreview?.();
        if (repair) {
          preview.data = { repairScenario:intent.parameters.scenario || 'balanced' };
          preview.impact.metrics.push(metric('Students moved', repair.moved.length), metric('Required conflicts', `${countHard(repair.startingFindings)} → ${countHard(repair.finalFindings)}`), metric('Warnings', `${countWarnings(repair.startingFindings)} → ${countWarnings(repair.finalFindings)}`));
        } else preview.details.push('Classroom Intelligence did not produce a repair proposal.');
      } catch (error) {
        preview.details.push(`Repair preview could not be calculated: ${error?.message || error}`);
      }
    }
    preview.canApply = preview.canApply && !preview.blockers.length;
    return preview;
  }

  function setIntelligenceScenario(scenario,maxMoves=0){const api=window.ClassroomIntelligenceV68;if(!api)return;try{if(typeof api.setScenario==='function')api.setScenario(scenario,{maxMoves});else{api.render?.();const b=document.querySelector('[data-intelligence-scenario="'+String(scenario)+'"]');if(b&&!b.classList.contains('active'))b.click()}}catch(_){}}

  function buildRuleImpact(preview) {
    const ids = list(preview.entities?.students).map(item => String(item.id));
    const affected = [...new Set([
      ...list(preview.parameters?.requirementTargetIds).map(String),
      ...(preview.parameters?.relation ? ids.slice(0, 2) : [])
    ])].slice(0, 20);
    const beforeRequirements = new Map();
    affected.forEach(id => {
      const student = students().find(item => String(item.id) === id);
      beforeRequirements.set(id, clone(student?.requirements || {}));
    });
    const beforeGroups = clone(state?.groups || []);
    const beforeFindings = currentFindings();
    const beforeGuidance = new Map(affected.map(id => [id, seatGuidanceCounts(id)]));
    try {
      applyRuleChangesInMemory(preview, false);
      const afterFindings = currentFindings();
      const afterGuidance = new Map(affected.map(id => [id, seatGuidanceCounts(id)]));
      preview.impact.metrics.push(metric('Students affected', affected.length), metric('Required conflicts', `${countHard(beforeFindings)} → ${countHard(afterFindings)}`), metric('Warnings', `${countWarnings(beforeFindings)} → ${countWarnings(afterFindings)}`));
      affected.forEach(id => {
        const label = displayStudent(students().find(item => String(item.id) === id) || { id });
        const before = beforeGuidance.get(id);
        const after = afterGuidance.get(id);
        preview.impact.metrics.push(metric(`${label} valid seats`, `${before?.valid || 0} → ${after?.valid || 0}`));
      });
    } finally {
      affected.forEach(id => {
        const student = students().find(item => String(item.id) === id);
        if (student && beforeRequirements.has(id)) student.requirements = clone(beforeRequirements.get(id));
      });
      state.groups = beforeGroups;
    }
  }

  function normalizeRequirementsForStudent(student, nextRequirements) {
    try {
      if (typeof normalizeStudent === 'function') return normalizeStudent({ ...clone(student), requirements:nextRequirements }).requirements;
    } catch (_) { /* fallback */ }
    return clone(nextRequirements || {});
  }

  function applyRuleChangesInMemory(preview) {
    const ids = list(preview.entities?.students).map(item => String(item.id));
    const changes = preview.parameters?.requirementChanges || {};
    if (Object.keys(changes).length) {
      const targets = list(preview.parameters?.requirementTargetIds).map(String);
      (targets.length ? targets : ids.slice(0, 1)).forEach(id => {
        const student = students().find(item => String(item.id) === id);
        if (!student) return;
        const next = { ...clone(student.requirements || {}), ...clone(changes) };
        student.requirements = normalizeRequirementsForStudent(student, next);
      });
    }
    if (preview.parameters?.relation === 'separate' && ids.length >= 2) {
      ids.slice(0, 2).forEach((id, index) => {
        const other = ids[index === 0 ? 1 : 0];
        const student = students().find(item => String(item.id) === id);
        if (!student) return;
        const next = clone(student.requirements || {});
        next.minDistanceStudentIds = [...new Set([...list(next.minDistanceStudentIds).map(String), other])];
        student.requirements = normalizeRequirementsForStudent(student, next);
      });
    }
    if (preview.parameters?.relation === 'together' && ids.length >= 2) {
      const pair = ids.slice(0, 2).sort();
      const existing = list(state?.groups).find(group => group?.type === 'together' && pair.every(id => list(group.studentIds).map(String).includes(id)) && list(group.studentIds).length === pair.length);
      if (!existing) {
        const raw = {
          id:typeof uid === 'function' ? uid('group') : `group-${Date.now()}`,
          name:`${displayStudent(students().find(item => String(item.id) === pair[0]))} + ${displayStudent(students().find(item => String(item.id) === pair[1]))}`,
          type:'together',
          priority:7,
          studentIds:pair,
          anchorSeats:[],
          zoneId:''
        };
        state.groups = list(state.groups);
        state.groups.push(typeof normalizeGroupRecord === 'function' ? normalizeGroupRecord(raw, state.groups.length) : raw);
      }
    }
  }

  function applyPreview(previewInput = currentPreview) {
    const preview = previewInput;
    if (!preview || !preview.canApply) return { ok:false, message:'This preview is not ready to apply.' };
    let message = '';
    try {
      if (preview.intent === 'show_valid_seats') {
        const id = preview.entities.students[0].id;
        window.SeatGuidanceV66?.show?.(id, { pinned:true });
        message = `Showing valid seats for ${preview.entities.students[0].name}.`;
      } else if (preview.intent === 'explain_selected_seat' || preview.intent === 'explain_student' || preview.intent === 'explain_conflicts') {
        message = 'Explanation generated from the current planner state. No changes were made.';
      } else if (preview.intent === 'rule_changes') {
        if (typeof pushUndoSnapshot === 'function') pushUndoSnapshot(`Before Planner Assistant: ${preview.command}`);
        applyRuleChangesInMemory(preview);
        if (typeof persistActiveClass === 'function') persistActiveClass();
        if (typeof scheduleLinkedAutoSave === 'function') scheduleLinkedAutoSave('planner-assistant-rules');
        if (typeof renderAll === 'function') renderAll();
        message = 'Applied the explicit seating-rule changes. They are now visible in the normal rule editors.';
      } else if (preview.intent === 'group_rule_change') {
        const group = list(state?.groups).find(item => String(item.id) === String(preview.parameters.groupId));
        if (!group) return { ok:false, message:'The referenced group no longer exists.' };
        if (typeof pushUndoSnapshot === 'function') pushUndoSnapshot(`Before Planner Assistant: ${preview.command}`);
        group.type = preview.parameters.groupType;
        if (typeof persistActiveClass === 'function') persistActiveClass();
        if (typeof scheduleLinkedAutoSave === 'function') scheduleLinkedAutoSave('planner-assistant-group-rule');
        if (typeof renderAll === 'function') renderAll();
        message = `${group.name} now uses the ${group.type} rule.`;
      } else if(preview.intent==='assistant_help'){setGuideOpen(true);message='Planner Assistant guide opened.';
      } else if(preview.intent==='create_activity_layout'){if(typeof pushUndoSnapshot==='function')pushUndoSnapshot('Before Planner Assistant layout: '+preview.command);const e=window.ActivityLayoutsV701?.create?.(preview.parameters.presetId,{name:preview.parameters.presetName});if(!e)return{ok:false,message:'The Activity Layout could not be created.'};window.ActivityLayoutsV701?.open?.();message='Created '+e.name+'.';
      } else if(preview.intent==='create_station_rotation'){const x=window.StationRotationsV702?.stationCandidates?.()||[];const plan=window.StationRotationsV702?.createPlan?.({name:'Station Rotation',teamCount:preview.parameters.teamCount||Math.min(x.length,6),teamSource:preview.parameters.teamSource||'balanced',stationIds:x.map(y=>y.objectId)});if(!plan)return{ok:false,message:'The station rotation could not be created.'};window.StationRotationsV702?.open?.();message='Created '+plan.name+'.';
      } else if(preview.intent==='randomize_chart'){const b=document.getElementById('randomizeAllBtn');if(!b)return{ok:false,message:'Randomize is unavailable.'};b.click();message='Ran Randomize + Seat Everyone.';
      } else if(preview.intent==='generate_chart'){const b=document.getElementById('generateBtn');if(!b)return{ok:false,message:'Generate Chart is unavailable.'};b.click();message='Opened Generate Chart.';
      } else if (preview.intent === 'testing_preview') {
        const config = preview.data?.testingConfig || { name:preview.parameters.name || 'Testing', spacing:preview.parameters.spacing };
        window.TestingModeV703?.generatePreview?.(config);
        window.TestingModeV703?.open?.();
        message = 'Testing Mode preview generated. Review its feasibility report and use Testing Mode’s Apply button if you want the separate Activity Layout.';
      } else if (preview.intent === 'open_station_rotations') {
        window.StationRotationsV702?.open?.();
        message = 'Station Rotations opened.';
      } else if (preview.intent === 'switch_activity_layout') {
        if (typeof pushUndoSnapshot === 'function') pushUndoSnapshot(`Before Planner Assistant layout switch: ${preview.command}`);
        const ok = Boolean(window.ActivityLayoutsV701?.activate?.(preview.parameters.layoutId));
        if (!ok) return { ok:false, message:'The target Activity Layout could not be activated.' };
        message = `Switched to ${preview.parameters.layoutName}.`;
      } else if (preview.intent === 'preview_repair') {
        window.PlanningToolsV66?.open?.();
        setIntelligenceScenario(preview.data?.repairScenario || preview.parameters.scenario || 'balanced',preview.parameters.maxMoves||0);
        window.ClassroomIntelligenceV68?.render?.();
        document.querySelector('#previewIntelligenceRepairBtn')?.click();
        message = 'Classroom Intelligence repair preview opened. Review the proposed moves there before applying them.';
      } else {
        return { ok:false, message:'No executable planner action was found.' };
      }
      recordHistory(preview.command, preview, message);
      announce(message);
      renderPreview({ ...preview, outcome:message });
      return { ok:true, message };
    } catch (error) {
      const failure = `Planner Assistant could not complete the action: ${error?.message || error}`;
      announce(failure);
      return { ok:false, message:failure };
    }
  }

  function previewCommand(command) {
    const interpreted = interpret(command);
    currentPreview = makePreview(interpreted);
    renderPreview(currentPreview);
    return currentPreview;
  }

  function announce(message) {
    const status = document.getElementById('plannerAssistantV710Status');
    if (status) status.textContent = String(message || '');
    try { if (typeof setLiveStatusMessage === 'function') setLiveStatusMessage(String(message || '')); } catch (_) { /* optional */ }
  }

  function guideMarkup(){return '<section id="plannerAssistantV710Guide" class="section v710-guide" '+(uiPrefs.guideOpen?'':'hidden')+'><div class="v710-section-head"><div><h3>How to use Planner Assistant</h3><p>Describe the classroom outcome, preview the interpretation, then apply it.</p></div><button id="plannerAssistantV710GuideCloseBtn" class="tiny secondary" type="button">Hide guide</button></div><div class="v710-guide-grid"><article><strong>Students & rules</strong><span>Keep Maya near the front and away from the door.</span><span>Keep Noah and Eli apart.</span><span>Where can Ada sit?</span></article><article><strong>Layouts & testing</strong><span>Create a collaborative layout.</span><span>Make a discussion layout.</span><span>Create a testing layout with 5 feet between students.</span></article><article><strong>Repair & explain</strong><span>Fix this plan but move no more than 4 students.</span><span>Explain the conflicts.</span><span>Why is Ada sitting here?</span></article><article><strong>Stations & seating</strong><span>Make a station rotation with 3 groups.</span><span>Generate the best seating plan.</span><span>Randomize the seats.</span></article></div><div class="hint">Local and deterministic. It never silently applies a rule.</div></section>'}

  function modalMarkup() {
    return `<div id="${MODAL_ID}" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="plannerAssistantV710Title"><div class="modal v710-modal"><div class="panel-header"><div><span class="v710-kicker">V7.1 Local Planner Assistant</span><h2 id="plannerAssistantV710Title">Planner Assistant</h2></div><div class="button-row"><button id="plannerAssistantV710GuideBtn" class="tiny secondary" type="button">Guide</button><button id="plannerAssistantV710HideDockBtn" class="tiny secondary" type="button">Hide bar</button><button id="plannerAssistantV710CloseBtn" class="tiny secondary" type="button">Close</button></div></div><div class="modal-body v710-modal-body"><div class="v710-intro"><strong>Describe the classroom outcome you want.</strong><span>The assistant translates classroom language into explicit existing planner actions. It does not add hidden rules, call an external AI service, or change anything until you review the impact and apply it.</span></div>${guideMarkup()}<section class="section v710-request"><label for="plannerAssistantV710Input">Request</label><div class="v710-request-row"><input id="plannerAssistantV710Input" autocomplete="off" placeholder="Keep Maya near the front but away from Liam" /><button id="plannerAssistantV710PreviewBtn" type="button">Preview</button></div><div class="v710-example-row">${EXAMPLES.map(example => `<button type="button" class="tiny ghost" data-v710-example="${esc(example)}">${esc(example)}</button>`).join('')}</div></section><section class="section"><div class="v710-section-head"><div><h3>Interpretation & impact</h3><p>Request → interpretation → impact → explicit apply.</p></div><span class="pill">Local deterministic parser</span></div><div id="plannerAssistantV710Preview"></div></section><section class="section"><div class="v710-section-head"><div><h3>Recent commands</h3><p>Stored only in this browser for the current class.</p></div><button id="plannerAssistantV710ClearHistoryBtn" class="tiny secondary" type="button">Clear history</button></div><div id="plannerAssistantV710History" class="v710-history"></div></section><div id="plannerAssistantV710Status" class="hint" role="status" aria-live="polite"></div></div></div></div>`;
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    const host = document.createElement('div');
    host.innerHTML = modalMarkup();
    modal = host.firstElementChild;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target?.id === 'plannerAssistantV710CloseBtn') { close(); return; }
      const example = event.target.closest?.('[data-v710-example]');
      if (example) {
        const input = modal.querySelector('#plannerAssistantV710Input');
        if (input) input.value = example.dataset.v710Example || '';
        previewCommand(input?.value || '');
        return;
      }
      const rerun = event.target.closest?.('[data-v710-rerun]');
      if (rerun) {
        const input = modal.querySelector('#plannerAssistantV710Input');
        if (input) input.value = rerun.dataset.v710Rerun || '';
        previewCommand(input?.value || '');
        return;
      }
      if(event.target?.id==='plannerAssistantV710GuideBtn')setGuideOpen(!uiPrefs.guideOpen);
      if(event.target?.id==='plannerAssistantV710GuideCloseBtn')setGuideOpen(false);
      if(event.target?.id==='plannerAssistantV710HideDockBtn')setDockHidden(true);
      if (event.target?.id === 'plannerAssistantV710PreviewBtn') previewCommand(modal.querySelector('#plannerAssistantV710Input')?.value || '');
      if (event.target?.id === 'plannerAssistantV710ApplyBtn') applyPreview();
      if (event.target?.id === 'plannerAssistantV710ClearHistoryBtn') { saveHistory([]); renderHistory(); announce('Planner Assistant command history cleared for this class.'); }
    });
    modal.querySelector('#plannerAssistantV710Input')?.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); previewCommand(event.currentTarget.value); }
    });
    renderHistory();
    return modal;
  }

  function previewMarkup(preview) {
    if (!preview) return '<div class="hint">Enter a request to see exactly what the planner thinks it means before anything happens.</div>';
    const metrics = list(preview.impact?.metrics);
    const blockers = list(preview.blockers);
    const ambiguities = list(preview.ambiguities);
    return `<article class="v710-preview-card"><header><div><strong>${esc(preview.title)}</strong><span>${esc(preview.summary)}</span></div><span class="v710-intent">${esc(preview.intent)}</span></header>${preview.operations?.length ? `<div class="v710-block"><b>Proposed operations</b><ol>${preview.operations.map(item => `<li>${esc(item)}</li>`).join('')}</ol></div>` : ''}${metrics.length ? `<div class="v710-metrics">${metrics.map(item => `<div><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong>${item.detail ? `<small>${esc(item.detail)}</small>` : ''}</div>`).join('')}</div>` : ''}${preview.details?.length ? `<div class="v710-block"><b>Details</b><ul>${preview.details.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}${ambiguities.length ? `<div class="v710-block warning"><b>Needs clarification</b>${ambiguities.map(item => `<p>${esc(item.message)}</p><div class="v710-candidates">${item.candidates.map(candidate => `<span class="pill">${esc(candidate.name)}</span>`).join('')}</div>`).join('')}</div>` : ''}${blockers.length ? `<div class="v710-block warning"><b>Cannot apply yet</b><ul>${blockers.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}<footer><span>${preview.mutates ? 'No changes have been applied.' : 'This action does not alter saved planner rules or assignments.'}</span><button id="plannerAssistantV710ApplyBtn" type="button"${preview.canApply ? '' : ' disabled'}>${esc(preview.applyLabel)}</button></footer>${preview.outcome ? `<div class="successbox">${esc(preview.outcome)}</div>` : ''}</article>`;
  }

  function renderPreview(preview = currentPreview) {
    const node = document.getElementById('plannerAssistantV710Preview');
    if (node) node.innerHTML = previewMarkup(preview);
  }

  function renderHistory() {
    const node = document.getElementById('plannerAssistantV710History');
    if (!node) return;
    const history = loadHistory();
    node.innerHTML = history.length ? history.map(item => `<button type="button" class="v710-history-item" data-v710-rerun="${esc(item.command)}"><strong>${esc(item.command)}</strong><span>${esc(item.title || item.intent)} · ${esc(item.at ? new Date(item.at).toLocaleString() : '')}</span></button>`).join('') : '<div class="hint">No Planner Assistant commands have been applied for this class in this browser.</div>';
  }

  function setGuideOpen(open){uiPrefs.guideOpen=Boolean(open);saveUiPrefs();const g=document.getElementById('plannerAssistantV710Guide');if(g)g.hidden=!uiPrefs.guideOpen}
  function setDockHidden(hidden){uiPrefs.dockHidden=Boolean(hidden);saveUiPrefs();const d=document.getElementById(DOCK_ID);if(d){d.hidden=uiPrefs.dockHidden;d.classList.toggle('v710-hidden',uiPrefs.dockHidden)}const x=document.getElementById('plannerAssistantV710Restore');if(x){x.hidden=!uiPrefs.dockHidden||isPresentationMode();x.classList.toggle('v710-hidden',!uiPrefs.dockHidden||isPresentationMode())}}

  function dockMarkup() {
    return `<button id="plannerAssistantV710DockOpen" type="button" class="v710-dock-label" title="Open Planner Assistant (Ctrl+Alt+P)">Planner Assistant</button><input id="plannerAssistantV710DockInput" aria-label="Planner Assistant request" autocomplete="off" placeholder="Ask the planner…" /><button id="plannerAssistantV710DockPreview" type="button">Preview</button><button id="plannerAssistantV710DockHide" class="ghost tiny" type="button" aria-label="Hide Planner Assistant bar">×</button>`;
  }

  function ensureDock() {
    let dock = document.getElementById(DOCK_ID);
    if (dock) return dock;
    dock = document.createElement('div');
    dock.id = DOCK_ID;
    dock.className = 'v710-dock no-print';
    dock.innerHTML = dockMarkup();
    document.body.appendChild(dock);let restore=document.getElementById('plannerAssistantV710Restore');if(!restore){restore=document.createElement('button');restore.id='plannerAssistantV710Restore';restore.type='button';restore.className='v710-restore secondary tiny no-print';restore.textContent='Planner Assistant';document.body.appendChild(restore);restore.addEventListener('click',()=>setDockHidden(false))}
    dock.addEventListener('click', event => {
      if(event.target?.id==='plannerAssistantV710DockHide'){setDockHidden(true);return}
      if (event.target?.id === 'plannerAssistantV710DockOpen') { open(); return; }
      if (event.target?.id === 'plannerAssistantV710DockPreview') {
        const command = dock.querySelector('#plannerAssistantV710DockInput')?.value || '';
        open(command);
        previewCommand(command);
      }
    });
    setDockHidden(uiPrefs.dockHidden);
    dock.querySelector('#plannerAssistantV710DockInput')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); open(event.currentTarget.value); previewCommand(event.currentTarget.value); }
    });
    return dock;
  }

  function open(initialCommand = '') {
    if (isPresentationMode()) return;
    const modal = ensureModal();
    const input = modal.querySelector('#plannerAssistantV710Input');
    if (initialCommand && input) input.value = initialCommand;
    renderPreview(currentPreview);
    renderHistory();
    modal.classList.add('show');
    setTimeout(() => input?.focus(), 0);
  }

  function close() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.classList.remove('show');
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .v710-dock{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:720;display:grid;grid-template-columns:auto minmax(180px,1fr) auto auto;gap:7px;align-items:center;width:min(720px,calc(100vw - 24px));padding:7px;border:1px solid color-mix(in srgb,var(--border,#cbd5e1) 78%,#2563eb 22%);border-radius:14px;background:color-mix(in srgb,var(--panel,#fff) 96%,#eff6ff 4%);box-shadow:0 10px 28px rgba(15,23,42,.18);backdrop-filter:blur(8px)}.v710-dock input{min-width:0}.v710-dock.v710-hidden,.v710-restore.v710-hidden{display:none!important}.v710-dock-label{white-space:nowrap;background:transparent!important;color:inherit!important;border-color:transparent!important;font-weight:900}.v710-restore{position:fixed;right:10px;bottom:10px;z-index:719}.v710-modal{width:min(1040px,calc(100vw - 24px));height:min(900px,calc(100vh - 24px))}.v710-modal-body{display:grid;gap:13px;overflow:auto;padding-bottom:34px}.v710-kicker{display:block;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#64748b)}.v710-intro{display:grid;grid-template-columns:minmax(210px,.7fr) minmax(0,1.5fr);gap:14px;padding:12px 14px;border:1px solid var(--border,#d8deea);border-radius:12px;background:color-mix(in srgb,var(--panel,#fff) 94%,#2563eb 6%)}.v710-intro span{color:var(--muted,#64748b);line-height:1.4}.v710-request{display:grid;gap:7px}.v710-request>label{font-weight:900}.v710-request-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:7px}.v710-example-row{display:flex;gap:5px;flex-wrap:wrap}.v710-example-row button{font-size:9.5px}.v710-section-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v710-section-head h3{margin:0 0 3px}.v710-section-head p{margin:0;color:var(--muted,#64748b);font-size:11px}.v710-preview-card{display:grid;gap:10px}.v710-preview-card>header{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v710-preview-card>header>div{display:grid;gap:3px}.v710-preview-card>header span{color:var(--muted,#64748b);font-size:11px}.v710-intent{padding:4px 7px;border-radius:999px;border:1px solid var(--border,#d8deea);font-size:9px!important;font-weight:900;white-space:nowrap}.v710-block{padding:9px 10px;border:1px solid var(--border,#d8deea);border-radius:10px;background:var(--panel,#fff);font-size:11.5px}.v710-block ol,.v710-block ul{margin:6px 0 0 19px;padding:0}.v710-block p{margin:5px 0}.v710-block.warning{border-color:#f0c36b;background:color-mix(in srgb,var(--panel,#fff) 92%,#fff7d6 8%)}.v710-candidates{display:flex;gap:5px;flex-wrap:wrap}.v710-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.v710-metrics>div{display:grid;gap:2px;padding:9px;border:1px solid var(--border,#d8deea);border-radius:10px;background:var(--panel,#fff)}.v710-metrics span,.v710-metrics small{font-size:9px;color:var(--muted,#64748b)}.v710-metrics strong{font-size:15px}.v710-preview-card>footer{display:flex;justify-content:space-between;gap:10px;align-items:center}.v710-preview-card>footer span{font-size:10px;color:var(--muted,#64748b)}.v710-history{display:grid;gap:6px}.v710-history-item{display:grid;gap:2px;text-align:left;padding:8px 10px;border:1px solid var(--border,#d8deea);border-radius:10px;background:var(--panel,#fff);color:inherit}.v710-history-item span{font-size:9.5px;color:var(--muted,#64748b)}.v710-guide{display:grid;gap:10px}.v710-guide[hidden]{display:none!important}.v710-guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v710-guide-grid article{display:grid;gap:4px;padding:10px;border:1px solid var(--border,#d8deea);border-radius:10px}.v710-guide-grid article span{font-size:10px;color:var(--muted,#64748b)}body.visibility-mode .v710-dock,body.visibility-mode .v710-restore{display:none!important}@media print{.v710-dock,.v710-restore,.v710-modal{display:none!important}}
      @media(max-width:760px){.v710-dock{grid-template-columns:minmax(0,1fr) auto;bottom:7px;width:calc(100vw - 12px)}.v710-dock-label{display:none}.v710-modal{width:calc(100vw - 10px);height:calc(100vh - 10px)}.v710-intro{grid-template-columns:1fr}.v710-guide-grid{grid-template-columns:1fr}.v710-metrics{grid-template-columns:1fr 1fr}.v710-section-head,.v710-preview-card>header,.v710-preview-card>footer{flex-direction:column;align-items:stretch}.v710-preview-card>footer button{width:100%}}
      @media(max-width:460px){.v710-metrics{grid-template-columns:1fr}.v710-request-row{grid-template-columns:1fr}.v710-example-row{display:grid;grid-template-columns:1fr}.v710-example-row button{text-align:left}}
    `;
    document.head.appendChild(style);
  }

  function installEvents() {
    document.addEventListener('keydown', event => {
      if (event.ctrlKey && event.altKey && String(event.key || '').toLowerCase() === 'p') {
        event.preventDefault();
        open();
      }
      if (event.key === 'Escape' && document.getElementById(MODAL_ID)?.classList.contains('show')) close();
    });
    document.addEventListener('change', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.matches?.('#classSelect,[data-class-id]')) {
        currentPreview = null;
        setTimeout(() => { renderHistory(); renderPreview(null); }, 0);
      }
    }, true);
    if (document.body) {
      bodyObserver = new MutationObserver(() => {
        if (isPresentationMode()) close();
      });
      bodyObserver.observe(document.body, { attributes:true, attributeFilter:['class'] });
    }
  }

  function install() {
    if (installed) return;
    installed = true;
    installStyles();
    ensureModal();
    ensureDock();
    installEvents();
  }

  function afterReady() {
    ensureDock();
    setDockHidden(uiPrefs.dockHidden);
    setGuideOpen(uiPrefs.guideOpen);
    renderHistory();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();

  return Object.freeze({
    version:VERSION,
    commandSchema:COMMAND_SCHEMA,
    examples:EXAMPLES,
    install,
    afterReady,
    interpret,
    preview:previewCommand,
    apply:applyPreview,
    open,
    close,
    showGuide:()=>{open();setGuideOpen(true)},
    hideDock:()=>setDockHidden(true),
    showDock:()=>setDockHidden(false),
    dockHidden:()=>uiPrefs.dockHidden,
    history:loadHistory,
    clearHistory:() => { saveHistory([]); renderHistory(); },
    currentPreview:() => currentPreview
  });
})();

'use strict';
