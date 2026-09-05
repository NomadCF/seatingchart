window.PlannerAssistantFollowupFixV722 = (() => {
  'use strict';

  const VERSION = '7.2.2-followup-1';
  const previous = window.PlannerAssistantV710;
  const conversation = window.PlannerAssistantConversationV722;
  if (!previous || !conversation?.installed) return Object.freeze({ version:VERSION, installed:false });

  const normalize = value => String(value || '').trim().replace(/\s+/g, ' ');
  const lower = value => normalize(value).toLowerCase();

  function students() {
    return Array.isArray(state?.students) ? state.students.filter(student => student && !student.archived) : [];
  }

  function studentName(student) {
    try { if (typeof studentDisplay === 'function') return normalize(studentDisplay(student)); } catch (_) { /* fallback */ }
    return normalize([student?.nickName || student?.firstName, student?.lastName].filter(Boolean).join(' ')) || String(student?.id || 'Student');
  }

  function aliases(student) {
    return [...new Set([
      studentName(student),
      [student?.firstName, student?.lastName].filter(Boolean).join(' '),
      student?.nickName,
      student?.firstName,
      student?.lastName
    ].map(normalize).filter(value => value.length >= 2).map(lower))].sort((a,b) => b.length - a.length);
  }

  function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function namedStudents(command) {
    const source = lower(command);
    const hits = [];
    students().forEach(student => {
      aliases(student).forEach(alias => {
        const match = new RegExp(`(^|[^a-z0-9])(${escapeRegex(alias)})(?=$|[^a-z0-9])`, 'i').exec(source);
        if (!match) return;
        const start = match.index + match[1].length;
        hits.push({ student, alias, start, end:start + alias.length });
      });
    });
    hits.sort((a,b) => a.start - b.start || (b.end-b.start) - (a.end-a.start));
    const selected = [];
    hits.forEach(hit => {
      if (selected.some(existing => hit.start < existing.end && hit.end > existing.start)) return;
      selected.push(hit);
    });
    return selected.map(hit => hit.student);
  }

  function contextStudents() {
    const ctx = typeof previous.conversationContext === 'function' ? previous.conversationContext() : conversation.context?.();
    const ids = Array.isArray(ctx?.students) ? ctx.students : [];
    return ids.map(id => students().find(student => String(student.id) === String(id))).filter(Boolean);
  }

  function rewriteFollowup(command) {
    const raw = normalize(command);
    if (!raw) return raw;
    const value = lower(raw);
    const explicit = namedStudents(raw);
    const context = contextStudents();
    const primary = context[0];

    if (!primary) return raw;

    if (explicit.length === 1 && String(explicit[0].id) !== String(primary.id)) {
      const other = explicit[0];
      if (/\b(not next to|not beside|not near|away from|apart|separate|keep .* away)\b/.test(value) || /^(but|and|also)\b.*\b(not|away|apart|separate)\b/.test(value)) {
        return `Keep ${studentName(primary)} and ${studentName(other)} apart`;
      }
      if (/\b(next to|beside|near|with|together|close to)\b/.test(value) || /^(and|also|then)\b.*\b(next|beside|near|with|together)\b/.test(value)) {
        return `Seat ${studentName(primary)} and ${studentName(other)} together`;
      }
    }

    if (explicit.length === 0) {
      const name = studentName(primary);
      if (/^(but|and|also|then)\b/.test(value) || /\b(him|her|them|that student|this student|same student)\b/.test(value)) {
        if (/\b(front|forward|closer to the front|near the front)\b/.test(value)) return `Keep ${name} near the front`;
        if (/\b(teacher|closer to me|near me|by me)\b/.test(value)) return `Keep ${name} near the teacher`;
        if (/\baisle\b/.test(value)) return `Keep ${name} near an aisle`;
        if (/\b(accessib|wheelchair|mobility)\b/.test(value)) return `Keep ${name} accessible`;
        if (/\b(away|far|not near)\b.*\bdoor\b/.test(value)) return `Keep ${name} away from the door`;
        if (/\b(away|far|not near)\b.*\bwindow\b/.test(value)) return `Keep ${name} away from the window`;
        if (/\bwhere\b.*\b(sit|seat|go|place)\b/.test(value)) return `Where can ${name} sit?`;
        if (/\bwhy\b/.test(value)) return `Why is ${name} seated here?`;
      }
    }

    return raw;
  }

  function interpret(command) {
    const rewritten = rewriteFollowup(command);
    const result = previous.interpret(rewritten);
    if (result && rewritten !== normalize(command)) {
      result.originalCommand = normalize(command);
      result.contextualCommand = rewritten;
      result.summary = `${String(result.summary || '').replace(/\s+$/, '')} Context used from the previous Assistant request.`;
    }
    return result;
  }

  function preview(command) {
    const rewritten = rewriteFollowup(command);
    const result = previous.preview(rewritten);
    if (result && rewritten !== normalize(command)) {
      result.originalCommand = normalize(command);
      result.contextualCommand = rewritten;
    }
    return result;
  }

  function open(command = '') {
    const rewritten = rewriteFollowup(command);
    return previous.open(rewritten);
  }

  const enhanced = Object.freeze({
    ...previous,
    version:VERSION,
    interpret,
    preview,
    open,
    rewriteFollowup
  });

  window.PlannerAssistantV710 = enhanced;

  return Object.freeze({ version:VERSION, installed:true, rewriteFollowup });
})();
