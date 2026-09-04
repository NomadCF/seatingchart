window.SeatGuidanceV66 = (() => {
  let activeStudentId = '';
  let pinned = false;
  let installed = false;
  let observer = null;
  let results = [];
  let renderTimer = null;

  function studentName(studentId) {
    return studentDisplay(getStudent(studentId) || { id: studentId });
  }

  function resultKeyForElement(element) {
    if (!element) return '';
    if (state.layoutMode === 'freeform') return String(element.dataset.objectId || '');
    return String(element.dataset.cellKey || '');
  }

  function seatElements() {
    const grid = el('seatGrid');
    if (!grid) return [];
    return state.layoutMode === 'freeform'
      ? [...grid.querySelectorAll('.freeform-object.seat[data-object-id]')]
      : [...grid.querySelectorAll('.cell.seat[data-cell-key]')];
  }

  function affectedStudentIds(studentId, seat) {
    const ids = new Set([String(studentId || '')]);
    if (seat?.assignedStudentId) ids.add(String(seat.assignedStudentId));
    return [...ids].filter(Boolean);
  }

  function findingsForStudents(findings, studentIds) {
    const ids = new Set(studentIds.map(String));
    return findings.filter(item => (item.studentIds || []).some(id => ids.has(String(id))));
  }

  function classifySeat(studentId, target, context = {}) {
    const student = getStudent(studentId);
    if (!student || !target) return null;
    const locked = Boolean(target.locked || target.manual) && String(target.assignedStudentId || '') !== String(studentId);
    if (locked) {
      return {
        key: String(target.id || target.key || ''),
        status: 'blocked',
        score: 10000,
        messages: ['This seat is locked.'],
        target
      };
    }
    const snapshot = context.snapshot || snapshotAssignments();
    const baselineFindings = context.baselineFindings || evaluateCurrentRuleViolations({ includeUnseated: false });
    const affected = affectedStudentIds(studentId, target);
    const before = findingsForStudents(baselineFindings, affected);
    let after;
    try {
      if (state.layoutMode === 'freeform') applyFreeformStudentAssignmentDirect(student, target);
      else applyMoveOrSwap(studentId, String(target.key), true);
      after = findingsForStudents(evaluateCurrentRuleViolations({ includeUnseated: false }), affected);
    } finally {
      restoreAssignments(snapshot);
    }
    const introduced = newRuleFindings(before, after || []);
    const bad = introduced.filter(item => item.severity === 'bad');
    const warnings = introduced.filter(item => item.severity !== 'bad');
    const occupiedPenalty = target.assignedStudentId && String(target.assignedStudentId) !== String(studentId) ? 3 : 0;
    return {
      key: String(target.id || target.key || ''),
      status: bad.length ? 'invalid' : warnings.length ? 'caution' : 'valid',
      score: bad.length * 100 + warnings.length * 10 + occupiedPenalty,
      messages: introduced.map(item => item.message),
      target
    };
  }

  function candidateTargets() {
    if (state.layoutMode === 'freeform') {
      return (state.freeformLayout?.objects || []).filter(item => item.type === 'seat').map(item => ({ ...item, key: item.id }));
    }
    return Object.entries(state.cells || {})
      .filter(([, cell]) => cell?.type === 'seat')
      .map(([key, cell]) => ({ ...cell, key, id: key, locked: Boolean(cell.manual) }));
  }

  function calculate(studentId) {
    const targets = candidateTargets();
    const context = {
      snapshot: snapshotAssignments(),
      baselineFindings: evaluateCurrentRuleViolations({ includeUnseated: false })
    };
    return targets.map(target => classifySeat(studentId, target, context)).filter(Boolean).sort((a, b) => a.score - b.score || a.key.localeCompare(b.key));
  }

  function statusText(result) {
    if (!result) return '';
    if (result.status === 'valid') return 'Meets the configured rules and needs.';
    if (result.status === 'caution') return result.messages[0] || 'This seat breaks a preference.';
    if (result.status === 'invalid') return result.messages[0] || 'This seat breaks a required rule.';
    return result.messages[0] || 'This seat is unavailable.';
  }

  function ensureBanner() {
    let banner = el('seatGuidanceBanner');
    if (banner) return banner;
    banner = document.createElement('section');
    banner.id = 'seatGuidanceBanner';
    banner.className = 'seat-guidance-banner no-print';
    banner.hidden = true;
    banner.innerHTML = `
      <div class="seat-guidance-copy">
        <strong id="seatGuidanceTitle">Seat guidance</strong>
        <span id="seatGuidanceMessage">Choose a student to preview valid seats.</span>
      </div>
      <div class="button-row">
        <button id="seatGuidanceBestBtn" type="button">Place in best seat</button>
        <button id="seatGuidanceClearBtn" class="secondary" type="button">Clear</button>
      </div>`;
    document.body.appendChild(banner);
    el('seatGuidanceBestBtn')?.addEventListener('click', () => placeBestSeat(activeStudentId));
    el('seatGuidanceClearBtn')?.addEventListener('click', clear);
    return banner;
  }

  function applyVisuals() {
    const banner = ensureBanner();
    const byKey = new Map(results.map(item => [item.key, item]));
    seatElements().forEach(node => {
      const result = byKey.get(resultKeyForElement(node));
      node.classList.remove('seat-validity-valid', 'seat-validity-caution', 'seat-validity-invalid', 'seat-validity-blocked');
      node.removeAttribute('data-seat-validity-message');
      if (!result) return;
      node.classList.add(`seat-validity-${result.status}`);
      node.dataset.seatValidityMessage = statusText(result);
      node.setAttribute('aria-description', statusText(result));
    });
    if (!activeStudentId) {
      banner.hidden = true;
      return;
    }
    const valid = results.filter(item => item.status === 'valid').length;
    const caution = results.filter(item => item.status === 'caution').length;
    const invalid = results.length - valid - caution;
    banner.hidden = false;
    el('seatGuidanceTitle').textContent = `Valid seats for ${studentName(activeStudentId)}`;
    el('seatGuidanceMessage').textContent = `${valid} valid · ${caution} possible with a preference warning · ${invalid} unavailable or conflicting. Green is best, yellow needs review, and red should be avoided.`;
    const bestButton = el('seatGuidanceBestBtn');
    if (bestButton) bestButton.disabled = !results.some(item => item.status === 'valid');
  }

  function refreshVisualsSoon() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      if (!activeStudentId) return;
      results = calculate(activeStudentId);
      applyVisuals();
    }, 20);
  }

  function show(studentId, options = {}) {
    if (!getStudent(studentId)) return false;
    activeStudentId = String(studentId);
    pinned = options.pinned !== false;
    results = calculate(activeStudentId);
    applyVisuals();
    setLiveStatusMessage(`Showing valid seats for ${studentName(activeStudentId)}. Green seats meet current rules; yellow seats need review; red seats conflict or are unavailable.`);
    return true;
  }

  function clear(options = {}) {
    activeStudentId = '';
    pinned = false;
    results = [];
    seatElements().forEach(node => {
      node.classList.remove('seat-validity-valid', 'seat-validity-caution', 'seat-validity-invalid', 'seat-validity-blocked');
      node.removeAttribute('data-seat-validity-message');
      node.removeAttribute('aria-description');
    });
    const banner = el('seatGuidanceBanner');
    if (banner) banner.hidden = true;
    if (options.announce !== false) setLiveStatusMessage('Seat guidance cleared.');
  }

  function bestSeatForStudent(studentId) {
    const calculated = String(studentId) === activeStudentId && results.length ? results : calculate(studentId);
    return calculated.find(item => item.status === 'valid') || calculated.find(item => item.status === 'caution') || null;
  }

  function placeBestSeat(studentId) {
    const best = bestSeatForStudent(studentId);
    if (!best) {
      setLiveStatusMessage(`No available seat satisfies the configured requirements for ${studentName(studentId)}.`);
      return false;
    }
    if (state.layoutMode === 'freeform') assignStudentToFreeformObject(studentId, best.key, true, true);
    else assignStudentToCell(studentId, best.key, true, true);
    clear({ announce: false });
    setLiveStatusMessage(`${studentName(studentId)} was placed in the best currently available seat.`);
    return true;
  }

  function ignoreFinding(findingId, reason = 'Teacher override') {
    const id = String(findingId || '');
    if (!id) return false;
    state.ruleOverrides = Array.isArray(state.ruleOverrides) ? state.ruleOverrides : [];
    if (!state.ruleOverrides.some(item => String(item.id) === id)) {
      state.ruleOverrides.push(normalizeRuleOverride({ id, reason, createdAt: new Date().toISOString() }));
      persistActiveClass();
      scheduleLinkedAutoSave('rule-override');
      renderTargeted(['rules', 'status'], { reason: 'rule-override' });
    }
    return true;
  }

  function injectStudentButtons(root = document) {
    const cards = [];
    if (root?.matches?.('.student-card[data-student-id]')) cards.push(root);
    root?.querySelectorAll?.('.student-card[data-student-id]').forEach(card => cards.push(card));
    cards.forEach(card => {
      if (card.closest('#groupManagerModal') || card.querySelector('[data-show-valid-seats]')) return;
      const actions = card.querySelector('.card-actions') || card;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tiny secondary';
      button.dataset.showValidSeats = card.dataset.studentId;
      button.textContent = 'Valid seats';
      button.title = 'Highlight seats that satisfy this student’s configured rules and needs.';
      actions.appendChild(button);
    });
  }



  function installEvents() {
    document.addEventListener('click', event => {
      const button = event.target.closest?.('[data-show-valid-seats]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      show(button.dataset.showValidSeats, { pinned: true });
    });
    document.addEventListener('dragstart', event => {
      const card = event.target.closest?.('.student-card[data-student-id]');
      if (!card || card.closest('#groupManagerModal')) return;
      show(card.dataset.studentId, { pinned: false });
    }, true);
    const clearTransientGuidance = () => {
      if (!pinned) clear({ announce: false });
    };
    document.addEventListener('dragend', clearTransientGuidance, true);
    document.addEventListener('drop', clearTransientGuidance, true);
    document.addEventListener('pointerover', event => {
      if (!activeStudentId) return;
      const seat = event.target.closest?.('.cell.seat[data-seat-validity-message], .freeform-object.seat[data-seat-validity-message]');
      if (!seat) return;
      const message = el('seatGuidanceMessage');
      if (message) message.textContent = seat.dataset.seatValidityMessage;
    });
    document.addEventListener('pointerout', event => {
      if (!activeStudentId || !event.target.closest?.('[data-seat-validity-message]')) return;
      const message = el('seatGuidanceMessage');
      if (message) message.textContent = 'Green seats meet current rules, yellow seats need review, and red seats conflict or are unavailable.';
    });
  }

  function install() {
    if (installed) return;
    installed = true;
    ensureBanner();
    installEvents();
    const grid = el('seatGrid');
    if (grid) {
      observer = new MutationObserver(() => {
        if (activeStudentId) refreshVisualsSoon();
      });
      observer.observe(grid, { childList: true, subtree: true });
    }
  }

  function afterReady() {
    injectStudentButtons();
  }

  return Object.freeze({
    install,
    afterReady,
    show,
    clear,
    calculate,
    bestSeatForStudent,
    placeBestSeat,
    ignoreFinding,
    enhanceStudentCards: injectStudentButtons,
    refresh: refreshVisualsSoon,
    activeStudentId: () => activeStudentId,
    results: () => results.map(item => ({ ...item, target: undefined }))
  });
})();

'use strict';

