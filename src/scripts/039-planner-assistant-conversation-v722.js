window.PlannerAssistantConversationV722 = (() => {
  'use strict';

  const VERSION = '7.2.2-conversation-1';
  const CONTEXT_PREFIX = 'classroom-seating-planner-assistant-context-v722:';
  const MAX_TURNS = 8;
  const base = window.PlannerAssistantV710;
  if (!base) return Object.freeze({ version:VERSION, installed:false });

  const text = value => String(value || '').trim().replace(/\s+/g, ' ');
  const lower = value => text(value).toLowerCase();
  const list = value => Array.isArray(value) ? value : [];
  const clone = value => {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return value; }
  };

  function classId() {
    try {
      const record = typeof activeClassRecord === 'function' ? activeClassRecord() : null;
      if (record?.id) return String(record.id);
    } catch (_) { /* fallback */ }
    return String(state?.activeClassId || state?.classId || 'default');
  }

  function contextKey() { return `${CONTEXT_PREFIX}${classId()}`; }

  function emptyContext() {
    return { students:[], groupId:'', layoutId:'', lastIntent:'', lastCommand:'', turns:[] };
  }

  function loadContext() {
    try {
      const parsed = JSON.parse(localStorage.getItem(contextKey()) || '{}');
      return {
        students:list(parsed.students).map(String).slice(0, 6),
        groupId:String(parsed.groupId || ''),
        layoutId:String(parsed.layoutId || ''),
        lastIntent:String(parsed.lastIntent || ''),
        lastCommand:String(parsed.lastCommand || ''),
        turns:list(parsed.turns).slice(0, MAX_TURNS)
      };
    } catch (_) { return emptyContext(); }
  }

  function saveContext(value) {
    try { localStorage.setItem(contextKey(), JSON.stringify(value)); } catch (_) { /* optional */ }
  }

  function resetContext() {
    try { localStorage.removeItem(contextKey()); } catch (_) { /* optional */ }
  }

  function students() {
    return list(state?.students).filter(student => student && !student.archived);
  }

  function studentName(student) {
    try { if (typeof studentDisplay === 'function') return text(studentDisplay(student)); } catch (_) { /* fallback */ }
    return text([student?.nickName || student?.firstName, student?.lastName].filter(Boolean).join(' ')) || String(student?.id || 'Student');
  }

  function aliases(student) {
    return [...new Set([
      studentName(student),
      [student?.firstName, student?.lastName].filter(Boolean).join(' '),
      student?.nickName,
      student?.firstName,
      student?.lastName
    ].map(text).filter(value => value.length >= 2).map(lower))].sort((a,b) => b.length - a.length);
  }

  function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function explicitStudentMatches(command) {
    const source = lower(command);
    const found = [];
    students().forEach(student => {
      aliases(student).forEach(alias => {
        const match = new RegExp(`(^|[^a-z0-9])(${escapeRegex(alias)})(?=$|[^a-z0-9])`, 'i').exec(source);
        if (!match) return;
        const start = match.index + match[1].length;
        found.push({ student, alias, start, end:start + alias.length });
      });
    });
    found.sort((a,b) => a.start - b.start || (b.end-b.start) - (a.end-a.start));
    const selected = [];
    found.forEach(candidate => {
      if (selected.some(item => candidate.start < item.end && candidate.end > item.start)) return;
      const same = found.filter(item => item.start === candidate.start && item.end === candidate.end && item.alias === candidate.alias);
      selected.push({
        start:candidate.start,
        end:candidate.end,
        students:[...new Map(same.map(item => [String(item.student.id), item.student])).values()]
      });
    });
    return selected;
  }

  function studentById(id) { return students().find(student => String(student?.id) === String(id)); }

  function contextStudentNames(ctx = loadContext()) {
    return ctx.students.map(studentById).filter(Boolean).map(studentName);
  }

  function referencedPronoun(command) {
    const value = lower(command);
    return /\b(him|her|them|that student|this student|the student|same student)\b/.test(value) || /^(and|but|also|then)\b/.test(value);
  }

  function referencedPreviousPair(command) {
    const value = lower(command);
    return /\b(them|those two|the two|both students|same pair)\b/.test(value);
  }

  function mergeContextIntoCommand(command) {
    const raw = text(command);
    if (!raw) return raw;
    const matches = explicitStudentMatches(raw);
    if (matches.length) return raw;
    const ctx = loadContext();
    const names = contextStudentNames(ctx);
    if (!names.length) return raw;
    const value = lower(raw);

    if (referencedPreviousPair(raw) && names.length >= 2) {
      if (/\b(apart|separate|away|not together|not next to)\b/.test(value)) return `Keep ${names[0]} and ${names[1]} apart`;
      if (/\b(together|next to|beside|near|close)\b/.test(value)) return `Seat ${names[0]} and ${names[1]} together`;
    }

    if (referencedPronoun(raw) || /^(front|back|aisle|teacher|door|window|accessible|why|where)\b/.test(value)) {
      const name = names[0];
      if (/\b(front|forward|closer to the front|near the front)\b/.test(value)) return `Keep ${name} near the front`;
      if (/\b(teacher|closer to me|near me|by me)\b/.test(value)) return `Keep ${name} near the teacher`;
      if (/\baisle\b/.test(value)) return `Keep ${name} near an aisle`;
      if (/\b(accessib|wheelchair|mobility)\b/.test(value)) return `Keep ${name} accessible`;
      if (/\b(away|far|not near)\b.*\bdoor\b/.test(value)) return `Keep ${name} away from the door`;
      if (/\b(away|far|not near)\b.*\bwindow\b/.test(value)) return `Keep ${name} away from the window`;
      if (/\bwhere\b.*\b(sit|seat|go|place)\b/.test(value)) return `Where can ${name} sit?`;
      if (/\bwhy\b/.test(value)) return `Why is ${name} seated here?`;
    }

    const secondMatch = students().find(student => aliases(student).some(alias => new RegExp(`(^|[^a-z0-9])${escapeRegex(alias)}(?=$|[^a-z0-9])`, 'i').test(lower(raw))));
    if (secondMatch && names[0] && String(secondMatch.id) !== String(ctx.students[0])) {
      if (/\b(not next to|not beside|away from|apart|separate)\b/.test(value)) return `Keep ${names[0]} and ${studentName(secondMatch)} apart`;
      if (/\b(next to|beside|with|together|near)\b/.test(value)) return `Seat ${names[0]} and ${studentName(secondMatch)} together`;
    }

    return raw;
  }

  function currentFindings() {
    try { return typeof evaluateCurrentRuleViolations === 'function' ? list(evaluateCurrentRuleViolations({ includeUnseated:true })) : []; }
    catch (_) { return []; }
  }

  function seatResults(studentId) {
    try { return window.SeatGuidanceV66?.calculate?.(studentId) || []; }
    catch (_) { return []; }
  }

  function unseatedStudents() {
    const assigned = new Set();
    if (state?.layoutMode === 'freeform') {
      list(state?.freeformLayout?.objects).filter(object => object?.type === 'seat' && object.assignedStudentId).forEach(object => assigned.add(String(object.assignedStudentId)));
    } else {
      Object.values(state?.cells || {}).filter(cell => cell?.type === 'seat' && cell.assignedStudentId).forEach(cell => assigned.add(String(cell.assignedStudentId)));
    }
    return students().filter(student => !assigned.has(String(student.id)));
  }

  function analysisIntent(command) {
    const value = lower(command);
    if (/\b(who|which student|students?)\b.*\b(fewest|least|hardest|most difficult)\b.*\b(valid seats?|seat options?|places? to sit)\b/.test(value) || /\bwho is hardest to seat\b/.test(value)) return 'analysis_hardest_to_seat';
    if (/\bwho\b.*\b(unseated|not seated|without a seat)\b|\bshow (me )?(the )?unseated\b/.test(value)) return 'analysis_unseated';
    if (/\b(summary|summarize|overview|health check|check this chart|review this chart|how does this chart look|how good is this chart)\b/.test(value)) return 'analysis_chart_summary';
    if (/\b(which|what)\b.*\b(rule|requirement|constraint)\b.*\b(most|biggest|hardest)\b.*\b(conflict|problem|issue|restrict)\b/.test(value)) return 'analysis_rule_pressure';
    if (/\bwhat should i fix first\b|\bwhere should i start\b.*\b(conflict|problem|chart)\b|\btop priorit(?:y|ies)\b/.test(value)) return 'analysis_priorities';
    return '';
  }

  function customInterpret(command) {
    const intent = analysisIntent(command);
    if (!intent) return null;
    const result = {
      schema:base.commandSchema || 'classroom-seating-planner-command-v1',
      version:1,
      command:text(command),
      intent,
      title:'Planner analysis',
      summary:'Analyze the current classroom state without changing assignments or rules.',
      mutates:false,
      entities:{ students:[] },
      parameters:{}, ambiguities:[], blockers:[], operations:['Analyze the current classroom state']
    };
    if (intent === 'analysis_hardest_to_seat') {
      result.title = 'Find the students who are hardest to seat';
      result.summary = 'Compare valid-seat counts across the active roster.';
      result.operations = ['Run Seat Guidance for each active student', 'Rank students by fewest valid seats'];
    } else if (intent === 'analysis_unseated') {
      result.title = 'Show unseated students';
      result.summary = 'List active students who do not currently have a seat.';
      result.operations = ['Compare active roster with current assignments'];
    } else if (intent === 'analysis_chart_summary') {
      result.title = 'Review the current seating chart';
      result.summary = 'Summarize assignments, unseated students, required conflicts, warnings, and seat flexibility.';
      result.operations = ['Count assignments and unseated students', 'Evaluate current rule findings', 'Estimate seat flexibility'];
    } else if (intent === 'analysis_rule_pressure') {
      result.title = 'Find the rules creating the most pressure';
      result.summary = 'Group current findings and identify repeated rule causes.';
      result.operations = ['Group rule findings by cause', 'Rank the most repeated constraints'];
    } else if (intent === 'analysis_priorities') {
      result.title = 'Prioritize what to fix first';
      result.summary = 'Identify required conflicts first, then warnings and students with very few alternatives.';
      result.operations = ['Rank required conflicts', 'Check unseated students', 'Check students with few valid alternatives'];
    }
    return result;
  }

  function enhancedInterpret(commandInput) {
    const original = text(commandInput);
    const contextual = mergeContextIntoCommand(original);
    const custom = customInterpret(contextual);
    if (custom) {
      custom.originalCommand = original;
      if (contextual !== original) custom.contextualCommand = contextual;
      return custom;
    }
    const result = clone(base.interpret(contextual));
    if (!result) return result;
    result.originalCommand = original;
    if (contextual !== original) {
      result.contextualCommand = contextual;
      result.summary = `${result.summary} Context used from the previous Assistant request.`;
    }
    if (result.intent === 'unknown') {
      const ctxNames = contextStudentNames();
      result.title = 'I understood part of that, but I need one more detail';
      result.summary = ctxNames.length
        ? `The current Assistant context is ${ctxNames.join(' and ')}. Add the action you want, or name a different student, group, layout, testing setup, station rotation, or conflict.`
        : 'Name the student, group, layout, testing setup, station rotation, seating action, or conflict you want the planner to work with.';
      result.operations = ['Clarify the missing planner action instead of changing the classroom'];
    }
    return result;
  }

  function makeMetric(label, value, detail = '') { return { label:String(label), value:String(value), detail:String(detail || '') }; }

  function customPreview(interpreted) {
    const preview = {
      ...clone(interpreted),
      createdAt:new Date().toISOString(),
      impact:{ metrics:[], notes:[] }, details:[], canApply:true, applyLabel:'Run analysis'
    };
    const findings = currentFindings();
    if (interpreted.intent === 'analysis_hardest_to_seat') {
      const rows = students().map(student => {
        const results = seatResults(student.id);
        return {
          name:studentName(student),
          valid:results.filter(item => item.status === 'valid').length,
          caution:results.filter(item => item.status === 'caution').length,
          invalid:results.filter(item => item.status === 'invalid' || item.status === 'blocked').length
        };
      }).sort((a,b) => a.valid - b.valid || b.invalid - a.invalid || a.name.localeCompare(b.name));
      preview.impact.metrics.push(makeMetric('Students checked', rows.length), makeMetric('Fewest valid seats', rows[0]?.valid ?? 0));
      preview.details = rows.slice(0, 8).map(row => `${row.name}: ${row.valid} valid, ${row.caution} caution, ${row.invalid} unavailable.`);
    } else if (interpreted.intent === 'analysis_unseated') {
      const missing = unseatedStudents();
      preview.impact.metrics.push(makeMetric('Unseated', missing.length), makeMetric('Active students', students().length));
      preview.details = missing.length ? missing.map(student => studentName(student)) : ['Every active student currently has a seat.'];
    } else if (interpreted.intent === 'analysis_chart_summary') {
      const missing = unseatedStudents();
      const required = findings.filter(item => item?.severity === 'bad').length;
      const warnings = findings.filter(item => item?.severity !== 'bad').length;
      const flexible = students().map(student => seatResults(student.id).filter(item => item.status === 'valid').length);
      const lowOptions = flexible.filter(count => count <= 2).length;
      preview.impact.metrics.push(
        makeMetric('Active students', students().length),
        makeMetric('Unseated', missing.length),
        makeMetric('Required conflicts', required),
        makeMetric('Warnings', warnings),
        makeMetric('Low-options students', lowOptions)
      );
      if (missing.length) preview.details.push(`${missing.length} active student${missing.length === 1 ? '' : 's'} still need a seat.`);
      if (required) preview.details.push(`${required} required rule conflict${required === 1 ? '' : 's'} should be addressed first.`);
      if (lowOptions) preview.details.push(`${lowOptions} student${lowOptions === 1 ? '' : 's'} currently have two or fewer valid seats.`);
      if (!preview.details.length) preview.details.push('The chart has no required conflicts, no unseated active students, and no student with two or fewer valid seats.');
    } else if (interpreted.intent === 'analysis_rule_pressure') {
      const grouped = new Map();
      findings.forEach(item => {
        const key = String(item?.message || item?.category || 'Rule finding');
        grouped.set(key, (grouped.get(key) || 0) + 1);
      });
      const ranked = [...grouped.entries()].sort((a,b) => b[1] - a[1]).slice(0, 10);
      preview.impact.metrics.push(makeMetric('Rule findings', findings.length), makeMetric('Distinct causes', grouped.size));
      preview.details = ranked.length ? ranked.map(([message,count]) => `${count}× ${message}`) : ['No current rule findings were detected.'];
    } else if (interpreted.intent === 'analysis_priorities') {
      const required = findings.filter(item => item?.severity === 'bad');
      const missing = unseatedStudents();
      const hard = students().map(student => ({ name:studentName(student), valid:seatResults(student.id).filter(item => item.status === 'valid').length })).sort((a,b) => a.valid - b.valid);
      preview.impact.metrics.push(makeMetric('Required conflicts', required.length), makeMetric('Unseated', missing.length), makeMetric('Lowest seat options', hard[0]?.valid ?? 0));
      if (required.length) preview.details.push(`1. Resolve required conflicts first. Example: ${required[0]?.message || 'Review required rule findings.'}`);
      if (missing.length) preview.details.push(`2. Seat unseated active students: ${missing.slice(0, 5).map(studentName).join(', ')}${missing.length > 5 ? '…' : ''}`);
      if (hard.length) preview.details.push(`3. Protect students with the fewest alternatives. ${hard.slice(0, 5).map(item => `${item.name} (${item.valid})`).join(', ')}.`);
      if (!preview.details.length) preview.details.push('Nothing urgent was found. Review preference-level warnings next.');
    }
    return preview;
  }

  function enhancedPreview(commandInput) {
    const interpreted = enhancedInterpret(commandInput);
    if (String(interpreted?.intent || '').startsWith('analysis_')) {
      const preview = customPreview(interpreted);
      updateContext(commandInput, preview);
      renderCustomPreview(preview);
      return preview;
    }
    const contextual = interpreted?.contextualCommand || text(commandInput);
    const preview = base.preview(contextual);
    if (preview) {
      preview.originalCommand = text(commandInput);
      if (interpreted?.contextualCommand) preview.contextualCommand = interpreted.contextualCommand;
      updateContext(commandInput, preview);
    }
    return preview;
  }

  function renderCustomPreview(preview) {
    const node = document.getElementById('plannerAssistantV710Preview');
    if (!node) return;
    const metrics = list(preview.impact?.metrics);
    node.innerHTML = `<article class="v710-preview-card"><header><div><strong>${escapeHtml(preview.title)}</strong><span>${escapeHtml(preview.summary)}</span></div><span class="v710-intent">${escapeHtml(preview.intent)}</span></header>${metrics.length ? `<div class="v710-metrics">${metrics.map(item => `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong>${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ''}</div>`).join('')}</div>` : ''}${preview.details.length ? `<div class="v710-block"><b>Findings</b><ol>${preview.details.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol></div>` : ''}<footer><span>This analysis does not change the classroom.</span><button id="plannerAssistantV722DoneBtn" type="button">Done</button></footer></article>`;
  }

  function escapeHtml(value) {
    try { if (typeof window.escapeHtml === 'function') return window.escapeHtml(String(value ?? '')); } catch (_) { /* fallback */ }
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  }

  function updateContext(command, preview) {
    const ctx = loadContext();
    const explicit = explicitStudentMatches(command).flatMap(match => match.students.length === 1 ? [String(match.students[0].id)] : []);
    const entityIds = list(preview?.entities?.students).map(item => String(item.id));
    const ids = [...new Set([...explicit, ...entityIds])];
    if (ids.length) ctx.students = ids.slice(0, 6);
    if (preview?.parameters?.groupId) ctx.groupId = String(preview.parameters.groupId);
    if (preview?.parameters?.layoutId) ctx.layoutId = String(preview.parameters.layoutId);
    ctx.lastIntent = String(preview?.intent || '');
    ctx.lastCommand = text(command);
    ctx.turns.unshift({ at:new Date().toISOString(), command:text(command), intent:ctx.lastIntent, students:[...ctx.students] });
    ctx.turns = ctx.turns.slice(0, MAX_TURNS);
    saveContext(ctx);
  }

  function enhancedOpen(initialCommand = '') {
    const command = text(initialCommand);
    const contextual = command ? mergeContextIntoCommand(command) : '';
    return base.open(contextual || command);
  }

  function enhancedApply() {
    const result = base.apply();
    try {
      const preview = base.currentPreview?.();
      if (preview) updateContext(preview.originalCommand || preview.command, preview);
    } catch (_) { /* context is optional */ }
    return result;
  }

  function suggestions(command = '') {
    const ctx = loadContext();
    const names = contextStudentNames(ctx);
    const first = names[0] || studentName(students()[0] || {});
    const second = names[1] || studentName(students()[1] || {});
    return [
      first ? `Where can ${first} sit?` : '',
      first ? `Keep ${first} near the front` : '',
      first && second ? `Seat ${first} and ${second} together` : '',
      'Who is hardest to seat?',
      'What should I fix first?',
      'Review this seating chart',
      'Explain the conflicts',
      'Make the smallest changes needed to fix conflicts'
    ].filter(Boolean);
  }

  function installModalEnhancements() {
    const modal = document.getElementById('plannerAssistantV710Modal');
    if (!modal || document.getElementById('plannerAssistantV722Context')) return;
    const request = modal.querySelector('.v710-request');
    if (!request) return;
    const section = document.createElement('section');
    section.id = 'plannerAssistantV722Context';
    section.className = 'v722-context-strip';
    const ctx = loadContext();
    const names = contextStudentNames(ctx);
    section.innerHTML = `<div><strong>Conversation context</strong><span id="plannerAssistantV722ContextText">${names.length ? `Following up on ${names.join(' and ')}${ctx.lastIntent ? ` · ${ctx.lastIntent.replaceAll('_',' ')}` : ''}` : 'No previous Assistant context for this class yet.'}</span></div><button id="plannerAssistantV722ClearContext" class="ghost tiny" type="button">Clear context</button>`;
    request.insertAdjacentElement('beforebegin', section);
  }

  function refreshContextStrip() {
    const node = document.getElementById('plannerAssistantV722ContextText');
    if (!node) return;
    const ctx = loadContext();
    const names = contextStudentNames(ctx);
    node.textContent = names.length ? `Following up on ${names.join(' and ')}${ctx.lastIntent ? ` · ${ctx.lastIntent.replaceAll('_',' ')}` : ''}` : 'No previous Assistant context for this class yet.';
  }

  function installGuideExpansion() {
    const guide = document.getElementById('plannerAssistantV710Guide');
    if (!guide || document.getElementById('plannerAssistantV722Guide')) return;
    const extra = document.createElement('div');
    extra.id = 'plannerAssistantV722Guide';
    extra.className = 'v722-guide-extra';
    extra.innerHTML = `<div class="v722-guide-grid"><article><strong>Ask follow-ups</strong><span>“Keep Maya near the front.”</span><span>Then: “But not next to Liam.”</span><span>The Assistant keeps short context for this class in this browser.</span></article><article><strong>Analyze the chart</strong><span>“Who is hardest to seat?”</span><span>“What should I fix first?”</span><span>“Review this seating chart.”</span></article><article><strong>Clarify instead of guessing</strong><span>If a name or action is ambiguous, the Assistant asks for the missing detail and leaves the classroom unchanged.</span></article><article><strong>One outcome at a time</strong><span>Requests can be conversational, but each preview remains an explicit planner action or analysis so undo, review, and safety stay predictable.</span></article></div>`;
    guide.appendChild(extra);
  }

  function installStyles() {
    if (document.getElementById('plannerAssistantV722Styles')) return;
    const style = document.createElement('style');
    style.id = 'plannerAssistantV722Styles';
    style.textContent = `.v722-context-strip{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--border,#d8deea);border-radius:10px;background:color-mix(in srgb,var(--panel,#fff) 96%,#eef6ff 4%)}.v722-context-strip>div{display:grid;gap:2px}.v722-context-strip span{font-size:10px;color:var(--muted,#64748b)}.v722-guide-extra{margin-top:8px}.v722-guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v722-guide-grid article{display:grid;gap:4px;padding:10px;border:1px solid var(--border,#d8deea);border-radius:10px}.v722-guide-grid span{font-size:10px;color:var(--muted,#64748b)}@media(max-width:760px){.v722-context-strip{align-items:stretch;flex-direction:column}.v722-guide-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function installEvents() {
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('#plannerAssistantV722ClearContext')) {
        resetContext();
        refreshContextStrip();
        try { if (typeof setLiveStatusMessage === 'function') setLiveStatusMessage('Planner Assistant conversation context cleared for this class.'); } catch (_) { /* optional */ }
      }
      if (target.closest('#plannerAssistantV722DoneBtn')) base.close?.();
    }, true);
    document.addEventListener('change', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.matches?.('#classSelect,[data-class-id]')) setTimeout(refreshContextStrip, 0);
    }, true);
  }

  const enhanced = Object.freeze({
    ...base,
    version:VERSION,
    interpret:enhancedInterpret,
    preview:enhancedPreview,
    open:enhancedOpen,
    apply:enhancedApply,
    conversationContext:loadContext,
    clearConversationContext:resetContext,
    contextualize:mergeContextIntoCommand,
    suggestions
  });
  window.PlannerAssistantV710 = enhanced;

  function install() {
    installStyles();
    installEvents();
    const observer = new MutationObserver(() => {
      installModalEnhancements();
      installGuideExpansion();
      refreshContextStrip();
    });
    if (document.body) observer.observe(document.body, { childList:true, subtree:true });
    installModalEnhancements();
    installGuideExpansion();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();

  return Object.freeze({ version:VERSION, installed:true, context:loadContext, clear:resetContext, contextualize:mergeContextIntoCommand, suggestions });
})();
