window.ClassroomIntelligenceV68 = (() => {
  let installed = false;
  let observer = null;
  let activeScenario = 'balanced';
  let repairPreview = null;
  let maxMovesOverride = 0;

  const SCENARIOS = Object.freeze({
    balanced: Object.freeze({
      id: 'balanced',
      name: 'Balanced classroom',
      short: 'Balance requirements, preferences, stability, and rotation.',
      movementWeight: 14,
      warningWeight: 55,
      fairnessWeight: 18,
      maxMoves: 8
    }),
    stable: Object.freeze({
      id: 'stable',
      name: 'Minimal movement',
      short: 'Repair problems while moving as few students as possible.',
      movementWeight: 40,
      warningWeight: 60,
      fairnessWeight: 4,
      maxMoves: 5
    }),
    rotation: Object.freeze({
      id: 'rotation',
      name: 'Fair rotation',
      short: 'Favor a fresh arrangement for students who have repeated locations.',
      movementWeight: 7,
      warningWeight: 55,
      fairnessWeight: 45,
      maxMoves: 12
    }),
    accessibility: Object.freeze({
      id: 'accessibility',
      name: 'Accessibility first',
      short: 'Treat required student needs as the first planning priority.',
      movementWeight: 10,
      warningWeight: 45,
      fairnessWeight: 8,
      maxMoves: 10
    }),
    testing: Object.freeze({
      id: 'testing',
      name: 'Quiet testing',
      short: 'Favor separation rules, stable seats, and the smallest safe repair.',
      movementWeight: 26,
      warningWeight: 75,
      fairnessWeight: 2,
      maxMoves: 8
    }),
    collaboration: Object.freeze({
      id: 'collaboration',
      name: 'Collaborative lesson',
      short: 'Favor configured together/group relationships while keeping requirements intact.',
      movementWeight: 12,
      warningWeight: 80,
      fairnessWeight: 12,
      maxMoves: 12
    })
  });

  const scenario = () => SCENARIOS[activeScenario] || SCENARIOS.balanced;
  const safeArray = value => Array.isArray(value) ? value : [];
  const hardFindings = findings => safeArray(findings).filter(item => item?.severity === 'bad');
  const warningFindings = findings => safeArray(findings).filter(item => item?.severity !== 'bad');

  function activeStudents() {
    if (typeof seatingStudents === 'function') return safeArray(seatingStudents());
    return safeArray(state?.students).filter(student => !student?.archived);
  }

  function assignmentMap() {
    const map = new Map();
    Object.entries(state?.cells || {}).forEach(([key, cell]) => {
      if (cell?.type === 'seat' && cell.assignedStudentId) map.set(String(cell.assignedStudentId), `grid:${key}`);
    });
    safeArray(state?.freeformLayout?.objects).forEach(object => {
      if (object?.type === 'seat' && object.assignedStudentId) map.set(String(object.assignedStudentId), `freeform:${object.id}`);
    });
    return map;
  }

  function availableSeatCount() {
    if (state?.layoutMode === 'freeform') {
      return safeArray(state?.freeformLayout?.objects).filter(object => object?.type === 'seat').length;
    }
    return Object.values(state?.cells || {}).filter(cell => cell?.type === 'seat').length;
  }

  function movedStudents(baseline) {
    const current = assignmentMap();
    const ids = new Set([...baseline.keys(), ...current.keys()]);
    return [...ids].filter(id => (baseline.get(id) || '') !== (current.get(id) || ''));
  }

  function currentFindings() {
    try {
      return typeof evaluateCurrentRuleViolations === 'function'
        ? safeArray(evaluateCurrentRuleViolations({ includeUnseated: true }))
        : [];
    } catch (_) {
      return [];
    }
  }

  function scoreState(findings, baseline, fairnessIds = new Set()) {
    const config = scenario();
    const moved = movedStudents(baseline);
    const fairnessMisses = [...fairnessIds].filter(id => !moved.includes(String(id))).length;
    return hardFindings(findings).length * 100000
      + warningFindings(findings).length * config.warningWeight
      + moved.length * config.movementWeight
      + fairnessMisses * config.fairnessWeight;
  }

  function fairnessPriorityIds() {
    if (typeof window.PlanningToolsV66?.fairnessAnalysis !== 'function') return new Set();
    try {
      const metrics = window.PlanningToolsV66.fairnessAnalysis();
      return new Set(metrics
        .filter(metric => metric.observed >= 2 && metric.repeatedSeatCount >= Math.max(2, metric.observed - 1))
        .sort((a, b) => (b.repeatedSeatCount / Math.max(1, b.observed)) - (a.repeatedSeatCount / Math.max(1, a.observed)))
        .slice(0, 8)
        .map(metric => String(metric.studentId)));
    } catch (_) {
      return new Set();
    }
  }

  function implicatedStudentIds(findings) {
    const ids = [];
    safeArray(findings).forEach(item => safeArray(item?.studentIds).forEach(id => {
      const value = String(id || '');
      if (value && !ids.includes(value)) ids.push(value);
    }));
    const assigned = assignmentMap();
    activeStudents().forEach(student => {
      const id = String(student.id);
      if (!assigned.has(id) && !ids.includes(id)) ids.push(id);
    });
    if (activeScenario === 'rotation') {
      fairnessPriorityIds().forEach(id => { if (!ids.includes(id)) ids.push(id); });
    }
    return ids;
  }

  function applyTargetDirect(studentId, result) {
    const student = typeof getStudent === 'function' ? getStudent(studentId) : null;
    if (!student || !result?.target) return false;
    if (state.layoutMode === 'freeform') {
      if (typeof applyFreeformStudentAssignmentDirect !== 'function') return false;
      applyFreeformStudentAssignmentDirect(student, result.target);
      return true;
    }
    if (typeof applyMoveOrSwap !== 'function') return false;
    applyMoveOrSwap(String(studentId), String(result.key), true);
    return true;
  }

  function candidateResults(studentId) {
    if (typeof window.SeatGuidanceV66?.calculate !== 'function') return [];
    try {
      return window.SeatGuidanceV66.calculate(studentId)
        .filter(item => item && item.status !== 'blocked')
        .sort((a, b) => {
          const rank = { valid: 0, caution: 1, invalid: 2, blocked: 3 };
          return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || Number(a.score || 0) - Number(b.score || 0);
        });
    } catch (_) {
      return [];
    }
  }

  function explainBlockers(findings = currentFindings()) {
    const blockers = [];
    const active = activeStudents();
    const seats = availableSeatCount();
    if (active.length > seats) {
      blockers.push({
        type: 'capacity',
        title: 'Not enough seats for students present',
        detail: `${active.length} students are active today but only ${seats} seats are available. Add ${active.length - seats} seat${active.length - seats === 1 ? '' : 's'}, mark absences, or change the room layout.`
      });
    }

    const hard = hardFindings(findings);
    const byMessage = new Map();
    hard.forEach(item => {
      const message = String(item?.message || 'Required seating rule cannot currently be satisfied.');
      const key = `${item?.category || 'rule'}:${message}`;
      if (!byMessage.has(key)) byMessage.set(key, { count: 0, message, category: item?.category || 'rule', ids: new Set() });
      const record = byMessage.get(key);
      record.count += 1;
      safeArray(item?.studentIds).forEach(id => record.ids.add(String(id)));
    });
    [...byMessage.values()].slice(0, 8).forEach(record => blockers.push({
      type: 'rule',
      title: record.count > 1 ? `${record.count} required conflicts: ${record.message}` : record.message,
      detail: record.ids.size ? `Affects ${record.ids.size} student${record.ids.size === 1 ? '' : 's'}. Review the requirement, unlock a conflicting seat, or use Show valid seats before overriding it.` : 'Review the related rule or room requirement before generating another plan.'
    }));

    const checkIds = implicatedStudentIds(hard).slice(0, 12);
    checkIds.forEach(id => {
      const student = typeof getStudent === 'function' ? getStudent(id) : null;
      const results = candidateResults(id);
      const valid = results.filter(item => item.status === 'valid').length;
      const caution = results.filter(item => item.status === 'caution').length;
      if (!valid && !caution) {
        blockers.push({
          type: 'student',
          title: `${student ? studentDisplay(student) : 'A student'} has no currently usable seat`,
          detail: 'Every seat is locked, unavailable, or creates a required conflict. This is a strong sign that the current rule set is impossible without changing at least one constraint.'
        });
      }
    });

    return blockers.slice(0, 12);
  }

  function healthSummary() {
    const findings = currentFindings();
    const hard = hardFindings(findings);
    const warnings = warningFindings(findings);
    const active = activeStudents();
    const assignments = assignmentMap();
    const unseated = active.filter(student => !assignments.has(String(student.id)));
    const blockers = explainBlockers(findings);
    const grade = hard.length || active.length > availableSeatCount() ? 'needs-work' : warnings.length || unseated.length ? 'review' : 'ready';
    return {
      findings,
      hard,
      warnings,
      activeCount: active.length,
      seatCount: availableSeatCount(),
      unseated,
      blockers,
      grade
    };
  }

  function buildRepairPreview() {
    if (typeof snapshotAssignments !== 'function' || typeof restoreAssignments !== 'function') return null;
    const originalSnapshot = snapshotAssignments();
    const baselineMap = assignmentMap();
    const fairnessIds = activeScenario === 'rotation' ? fairnessPriorityIds() : new Set();
    const startingFindings = currentFindings();
    const startingScore = scoreState(startingFindings, baselineMap, fairnessIds);
    let bestSnapshot = snapshotAssignments();
    let bestFindings = startingFindings;
    let bestScore = startingScore;
    const changes = [];

    try {
      const moveLimit=maxMovesOverride>0?Math.min(maxMovesOverride,scenario().maxMoves):scenario().maxMoves;
      for (let step = 0; step < moveLimit; step += 1) {
        restoreAssignments(bestSnapshot);
        const ids = implicatedStudentIds(bestFindings).slice(0, 14);
        if (!ids.length) break;
        let stepWinner = null;

        for (const studentId of ids) {
          restoreAssignments(bestSnapshot);
          const options = candidateResults(studentId).filter(item => item.status === 'valid' || item.status === 'caution').slice(0, 6);
          for (const option of options) {
            restoreAssignments(bestSnapshot);
            const beforeSeat = assignmentMap().get(String(studentId)) || 'unseated';
            if (!applyTargetDirect(studentId, option)) continue;
            const findings = currentFindings();
            const score = scoreState(findings, baselineMap, fairnessIds);
            const afterSeat = assignmentMap().get(String(studentId)) || 'unseated';
            if (!stepWinner || score < stepWinner.score) {
              stepWinner = {
                studentId: String(studentId),
                beforeSeat,
                afterSeat,
                status: option.status,
                score,
                findings,
                snapshot: snapshotAssignments()
              };
            }
          }
        }

        if (!stepWinner || stepWinner.score >= bestScore) break;
        bestSnapshot = stepWinner.snapshot;
        bestFindings = stepWinner.findings;
        bestScore = stepWinner.score;
        changes.push(stepWinner);
        if (!hardFindings(bestFindings).length && !warningFindings(bestFindings).length && activeScenario !== 'rotation') break;
      }

      restoreAssignments(bestSnapshot);
      const finalMap = assignmentMap();
      const movedIds = movedStudents(baselineMap);
      const moved = movedIds.map(id => ({
        studentId: id,
        name: typeof getStudent === 'function' && getStudent(id) ? studentDisplay(getStudent(id)) : id,
        from: baselineMap.get(id) || 'unseated',
        to: finalMap.get(id) || 'unseated'
      }));
      const preview = {
        scenarioId: activeScenario,
        originalSnapshot,
        proposedSnapshot: snapshotAssignments(),
        baselineMap,
        startingFindings,
        finalFindings: bestFindings,
        startingScore,
        finalScore: bestScore,
        moved,
        changes,
        createdAt: new Date().toISOString()
      };
      return preview;
    } finally {
      restoreAssignments(originalSnapshot);
    }
  }

  function applyRepairPreview() {
    if (!repairPreview?.proposedSnapshot || typeof restoreAssignments !== 'function') return false;
    if (typeof pushUndoSnapshot === 'function') pushUndoSnapshot(`Before V6.8 ${scenario().name} repair`);
    restoreAssignments(repairPreview.proposedSnapshot);
    if (typeof persistActiveClass === 'function') persistActiveClass();
    if (typeof scheduleLinkedAutoSave === 'function') scheduleLinkedAutoSave('classroom-intelligence-repair');
    if (typeof renderAll === 'function') renderAll();
    const count = repairPreview.moved.length;
    if (typeof setLiveStatusMessage === 'function') setLiveStatusMessage(`Applied ${scenario().name} repair. ${count} student${count === 1 ? '' : 's'} moved.`);
    repairPreview = null;
    render();
    return true;
  }

  function formatSeatLabel(value) {
    const text = String(value || 'unseated');
    if (text === 'unseated') return 'Unseated';
    return text.replace(/^grid:/, 'Grid ').replace(/^freeform:/, 'Seat ');
  }

  function scenarioCards() {
    return Object.values(SCENARIOS).map(item => `
      <button type="button" class="intelligence-scenario-card${item.id === activeScenario ? ' active' : ''}" data-intelligence-scenario="${escapeHtml(item.id)}" aria-pressed="${item.id === activeScenario ? 'true' : 'false'}">
        <strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.short)}</span>
      </button>`).join('');
  }

  function renderPreview() {
    if (!repairPreview) return '';
    const beforeHard = hardFindings(repairPreview.startingFindings).length;
    const afterHard = hardFindings(repairPreview.finalFindings).length;
    const beforeWarn = warningFindings(repairPreview.startingFindings).length;
    const afterWarn = warningFindings(repairPreview.finalFindings).length;
    const movedMarkup = repairPreview.moved.length
      ? repairPreview.moved.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(formatSeatLabel(item.from))}</td><td>${escapeHtml(formatSeatLabel(item.to))}</td></tr>`).join('')
      : '<tr><td colspan="3">No seat changes improve the current plan under this scenario.</td></tr>';
    return `
      <section class="section intelligence-preview">
        <div class="intelligence-section-heading"><div><h3>Proposed smallest-change repair</h3><p class="muted">Nothing has been applied yet. Review the impact first.</p></div><span class="intelligence-preview-badge">${repairPreview.moved.length} moved</span></div>
        <div class="intelligence-metrics">
          <div><strong>${beforeHard} → ${afterHard}</strong><span>required conflicts</span></div>
          <div><strong>${beforeWarn} → ${afterWarn}</strong><span>preference warnings</span></div>
          <div><strong>${repairPreview.moved.length}</strong><span>students moved</span></div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Student</th><th>Current</th><th>Proposed</th></tr></thead><tbody>${movedMarkup}</tbody></table></div>
        <div class="button-row"><button id="applyIntelligenceRepairBtn" type="button" ${repairPreview.finalScore >= repairPreview.startingScore ? 'disabled' : ''}>Apply this repair</button><button id="discardIntelligenceRepairBtn" class="secondary" type="button">Discard preview</button></div>
      </section>`;
  }

  function renderBlockers(blockers) {
    if (!blockers.length) return '<div class="successbox">No structural blockers were detected. The current room and required rules appear feasible.</div>';
    return `<div class="intelligence-blocker-list">${blockers.map(item => `<article class="planning-finding ${item.type === 'capacity' || item.type === 'student' ? 'bad' : 'warn'}"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div></article>`).join('')}</div>`;
  }

  function setScenario(id,options={}){const next=String(id||'balanced');if(!SCENARIOS[next])return false;activeScenario=next;maxMovesOverride=Math.max(0,Math.min(60,Number(options.maxMoves)||0));repairPreview=null;render();return true}

  function render() {
    const body = el('planningToolsBody');
    if (!body) return;
    ensureTab();
    document.querySelectorAll('[data-planning-tab]').forEach(button => {
      button.classList.remove('active');
      button.setAttribute('aria-selected', 'false');
    });
    const tab = document.querySelector('[data-intelligence-tab]');
    if (tab) {
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
    }

    const health = healthSummary();
    const healthTitle = health.grade === 'ready' ? 'Ready to use' : health.grade === 'review' ? 'Usable with review' : 'Needs attention';
    const healthText = health.grade === 'ready'
      ? 'No required conflicts or unseated active students were detected.'
      : `${health.hard.length} required conflict${health.hard.length === 1 ? '' : 's'}, ${health.warnings.length} preference warning${health.warnings.length === 1 ? '' : 's'}, and ${health.unseated.length} unseated active student${health.unseated.length === 1 ? '' : 's'}.`;

    body.innerHTML = `
      <section class="section intelligence-hero">
        <div><span class="v44-modal-eyebrow">V6.8 Classroom Intelligence</span><h3>Plan for what you are doing today</h3><p class="muted">Choose an objective. The planner keeps required rules explicit, previews the smallest useful change, and explains when the room or rule set cannot work as configured.</p></div>
        <div class="intelligence-health ${health.grade}"><strong>${escapeHtml(healthTitle)}</strong><span>${escapeHtml(healthText)}</span></div>
      </section>
      <section class="section"><h3>Planning objective</h3><div class="intelligence-scenario-grid">${scenarioCards()}</div><div class="hint">Objectives change how proposed repairs balance movement, preferences, and fairness. They do not silently add student rules or change saved requirements.</div></section>
      <section class="section"><div class="intelligence-section-heading"><div><h3>Smart repair</h3><p class="muted">Search for a better arrangement while preserving as much of the current chart as the selected objective allows.</p></div></div><div class="button-row"><button id="previewIntelligenceRepairBtn" type="button">Preview smallest repair</button><button id="refreshIntelligenceHealthBtn" class="secondary" type="button">Recheck plan</button></div></section>
      ${renderPreview()}
      <section class="section"><h3>Why a perfect plan may be impossible</h3><p class="muted">These are concrete blockers from the current room and explicit rules, not mystery scores.</p>${renderBlockers(health.blockers)}</section>`;
  }

  function ensureStyles() {
    if (el('classroomIntelligenceV68Styles')) return;
    const style = document.createElement('style');
    style.id = 'classroomIntelligenceV68Styles';
    style.textContent = `
      .intelligence-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,.4fr);gap:16px;align-items:start}
      .intelligence-health{border:1px solid var(--border,#cbd5e1);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:4px;background:var(--surface-soft,#f8fafc)}
      .intelligence-health.ready{border-color:#86efac}.intelligence-health.review{border-color:#fde68a}.intelligence-health.needs-work{border-color:#fca5a5}
      .intelligence-health span,.intelligence-scenario-card span{font-size:.88rem;line-height:1.35;color:var(--muted,#64748b)}
      .intelligence-scenario-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .intelligence-scenario-card{min-height:78px;text-align:left;display:flex;flex-direction:column;align-items:flex-start;gap:5px;padding:12px;border:1px solid var(--border,#cbd5e1);border-radius:12px;background:var(--surface,#fff);color:inherit}
      .intelligence-scenario-card.active{outline:2px solid var(--accent,#2563eb);outline-offset:1px}
      .intelligence-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .intelligence-preview-badge{white-space:nowrap;border-radius:999px;padding:5px 9px;background:var(--surface-soft,#eef2ff);font-size:.8rem;font-weight:700}
      .intelligence-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}
      .intelligence-metrics>div{border:1px solid var(--border,#cbd5e1);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:3px}
      .intelligence-metrics strong{font-size:1.05rem}.intelligence-metrics span{font-size:.78rem;color:var(--muted,#64748b)}
      .intelligence-blocker-list{display:flex;flex-direction:column;gap:8px}
      @media (max-width:720px){.intelligence-hero{grid-template-columns:1fr}.intelligence-scenario-grid{grid-template-columns:1fr}.intelligence-metrics{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureTab() {
    const nav = document.querySelector('.planning-tools-tabs');
    if (!nav || nav.querySelector('[data-intelligence-tab]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.intelligenceTab = 'true';
    button.textContent = 'Intelligence';
    button.setAttribute('aria-selected', 'false');
    button.title = 'Choose a classroom objective, preview the smallest useful repair, and explain impossible plans.';
    nav.prepend(button);
  }

  function installEvents() {
    document.addEventListener('click', event => {
      const intelligenceTab = event.target.closest?.('[data-intelligence-tab]');
      if (intelligenceTab) {
        event.preventDefault();
        render();
        return;
      }
      const scenarioButton = event.target.closest?.('[data-intelligence-scenario]');
      if (scenarioButton) {
        const next = scenarioButton.dataset.intelligenceScenario;
        if (SCENARIOS[next]) {
          activeScenario = next;
          maxMovesOverride = 0;
          repairPreview = null;
          render();
          if (typeof setLiveStatusMessage === 'function') setLiveStatusMessage(`${SCENARIOS[next].name} planning objective selected.`);
        }
        return;
      }
      if (event.target.closest?.('#previewIntelligenceRepairBtn')) {
        repairPreview = buildRepairPreview();
        render();
        return;
      }
      if (event.target.closest?.('#applyIntelligenceRepairBtn')) {
        applyRepairPreview();
        return;
      }
      if (event.target.closest?.('#discardIntelligenceRepairBtn')) {
        repairPreview = null;
        render();
        return;
      }
      if (event.target.closest?.('#refreshIntelligenceHealthBtn')) {
        repairPreview = null;
        render();
        return;
      }
      if (event.target.closest?.('[data-planning-tab]')) {
        document.querySelector('[data-intelligence-tab]')?.classList.remove('active');
      }
    });
  }

  function install() {
    if (installed) return;
    installed = true;
    ensureStyles();
    installEvents();
    if (document.body) {
      observer = new MutationObserver(() => ensureTab());
      observer.observe(document.body, { childList: true, subtree: true });
    }
    ensureTab();
    window.setTimeout(ensureTab, 250);
  }

  function afterReady() {
    ensureTab();
  }

  install();

  return Object.freeze({
    install,
    afterReady,
    render,
    healthSummary,
    explainBlockers,
    buildRepairPreview,
    applyRepairPreview,
    setScenario,
    scenarios: () => Object.values(SCENARIOS).map(item => ({ ...item })),
    activeScenario: () => activeScenario
  });
})();

'use strict';
