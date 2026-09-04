window.PlanningToolsV66 = (() => {
  let installed = false;
  let activeTab = 'guidance';
  let scheduledBannerTimer = null;
  let seatModalObserver = null;

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function planAssignmentMap(plan) {
    const map = new Map();
    Object.entries(plan?.cells || {}).forEach(([key, cell]) => {
      if (cell?.assignedStudentId) map.set(String(cell.assignedStudentId), `Grid ${key}`);
    });
    (plan?.freeformLayout?.objects || []).forEach(object => {
      if (object?.type === 'seat' && object.assignedStudentId) map.set(String(object.assignedStudentId), `Freeform ${object.id}`);
    });
    return map;
  }

  function planSeatDescriptors(plan) {
    const descriptors = [];
    Object.entries(plan?.cells || {}).forEach(([key, cell]) => {
      if (cell?.type !== 'seat') return;
      descriptors.push({ key, x: Number(cell.col) || 0, y: Number(cell.row) || 0, studentId: String(cell.assignedStudentId || '') });
    });
    (plan?.freeformLayout?.objects || []).forEach(object => {
      if (object?.type !== 'seat') return;
      descriptors.push({ key: String(object.id), x: Number(object.x) || 0, y: Number(object.y) || 0, studentId: String(object.assignedStudentId || '') });
    });
    return descriptors;
  }

  function historyPlans() {
    const current = normalizeSeatingPlan({
      id: 'current-live-chart',
      name: 'Current live chart',
      status: 'current',
      createdAt: new Date().toISOString(),
      layoutMode: state.layoutMode,
      rows: state.rows,
      cols: state.cols,
      cells: state.cells,
      freeformLayout: state.freeformLayout
    });
    return [current, ...(state.seatingPlans || []).filter(plan => plan.status !== 'archived').map(normalizeSeatingPlan)];
  }

  function fairnessAnalysis() {
    const plans = historyPlans();
    const metrics = new Map((state.students || []).map(student => [String(student.id), {
      student,
      observed: 0,
      positions: new Map(),
      neighbors: new Map(),
      front: 0,
      edge: 0
    }]));
    plans.forEach(plan => {
      const seats = planSeatDescriptors(plan);
      const maxY = Math.max(1, ...seats.map(seat => seat.y));
      const maxX = Math.max(1, ...seats.map(seat => seat.x));
      seats.filter(seat => seat.studentId).forEach(seat => {
        const metric = metrics.get(seat.studentId);
        if (!metric) return;
        metric.observed += 1;
        metric.positions.set(seat.key, (metric.positions.get(seat.key) || 0) + 1);
        if (seat.y <= Math.max(1, maxY * 0.4)) metric.front += 1;
        if (seat.x <= 1 || seat.y <= 1 || seat.x >= maxX || seat.y >= maxY) metric.edge += 1;
      });
      for (let index = 0; index < seats.length; index += 1) {
        const first = seats[index];
        if (!first.studentId) continue;
        for (let next = index + 1; next < seats.length; next += 1) {
          const second = seats[next];
          if (!second.studentId || Math.hypot(first.x - second.x, first.y - second.y) > 1.6) continue;
          const firstMetric = metrics.get(first.studentId);
          const secondMetric = metrics.get(second.studentId);
          if (firstMetric) firstMetric.neighbors.set(second.studentId, (firstMetric.neighbors.get(second.studentId) || 0) + 1);
          if (secondMetric) secondMetric.neighbors.set(first.studentId, (secondMetric.neighbors.get(first.studentId) || 0) + 1);
        }
      }
    });
    return [...metrics.values()].map(metric => {
      const repeatedSeat = [...metric.positions.entries()].sort((a, b) => b[1] - a[1])[0] || ['', 0];
      const repeatedNeighbor = [...metric.neighbors.entries()].sort((a, b) => b[1] - a[1])[0] || ['', 0];
      return {
        studentId: String(metric.student.id),
        name: studentDisplay(metric.student),
        observed: metric.observed,
        distinctSeats: metric.positions.size,
        repeatedSeatCount: repeatedSeat[1],
        repeatedNeighborId: repeatedNeighbor[0],
        repeatedNeighborCount: repeatedNeighbor[1],
        frontCount: metric.front,
        edgeCount: metric.edge
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  function matchingScheduledPlans(date = new Date()) {
    const iso = date.toISOString().slice(0, 10);
    const day = date.getDay();
    return (state.seatingPlans || []).map(normalizeSeatingPlan).filter(plan => {
      const schedule = plan.schedule;
      if (!schedule.enabled || !schedule.autoSuggest) return false;
      if (schedule.startDate && iso < schedule.startDate) return false;
      if (schedule.endDate && iso > schedule.endDate) return false;
      if (schedule.daysOfWeek.length && !schedule.daysOfWeek.includes(day)) return false;
      return true;
    });
  }

  function ensureScheduledBanner() {
    let banner = el('scheduledPlanBanner');
    if (banner) return banner;
    banner = document.createElement('section');
    banner.id = 'scheduledPlanBanner';
    banner.className = 'scheduled-plan-banner no-print';
    banner.hidden = true;
    banner.innerHTML = `
      <div><strong id="scheduledPlanBannerTitle">Scheduled seating plan available</strong><span id="scheduledPlanBannerText"></span></div>
      <div class="button-row"><button id="applyScheduledPlanBtn" type="button">Apply</button><button id="dismissScheduledPlanBtn" class="secondary" type="button">Dismiss</button></div>`;
    document.body.appendChild(banner);
    el('applyScheduledPlanBtn')?.addEventListener('click', () => {
      const planId = banner.dataset.planId;
      if (!planId) return;
      ClassroomWorkflowV53?.openSeatingPlans?.();
      setTimeout(() => document.querySelector(`[data-plan-full="${cssEscape(planId)}"]`)?.click(), 50);
      const plan = (state.seatingPlans || []).find(item => String(item.id) === String(planId));
      if (plan) plan.schedule = { ...normalizePlanSchedule(plan.schedule), lastAppliedAt: new Date().toISOString() };
      persistActiveClass();
      banner.hidden = true;
    });
    el('dismissScheduledPlanBtn')?.addEventListener('click', () => {
      safeStorageSet('sessionStorage', `scheduled-plan-dismissed:${banner.dataset.planId}`, new Date().toISOString().slice(0, 10));
      banner.hidden = true;
    });
    return banner;
  }

  function refreshScheduledPlanBanner() {
    clearTimeout(scheduledBannerTimer);
    scheduledBannerTimer = setTimeout(() => {
      const banner = ensureScheduledBanner();
      const plan = matchingScheduledPlans()[0];
      if (!plan || safeStorageGet('sessionStorage', `scheduled-plan-dismissed:${plan.id}`) === new Date().toISOString().slice(0, 10)) {
        banner.hidden = true;
        return;
      }
      banner.dataset.planId = plan.id;
      el('scheduledPlanBannerTitle').textContent = `Scheduled plan: ${plan.name}`;
      el('scheduledPlanBannerText').textContent = plan.schedule.period ? `Suggested for ${plan.schedule.period}. Review and apply when ready.` : 'Review and apply this plan when ready.';
      banner.hidden = false;
    }, 80);
  }

  function ensureModal() {
    let modal = el('planningToolsModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'planningToolsModal';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'planningToolsTitle');
    modal.innerHTML = `
      <div class="modal planning-tools-modal">
        <div class="panel-header"><div><span class="v44-modal-eyebrow">Planning and analysis</span><h2 id="planningToolsTitle">Advanced classroom tools</h2></div><button id="closePlanningToolsBtn" class="secondary mobile-compact-close" type="button" aria-label="Close">Close</button></div>
        <div class="planning-tools-shell">
          <nav class="planning-tools-tabs" aria-label="Advanced classroom tools">
            <button type="button" data-planning-tab="guidance">Seat guidance</button>
            <button type="button" data-planning-tab="history">History & fairness</button>
            <button type="button" data-planning-tab="schedules">Schedules</button>
            <button type="button" data-planning-tab="bulk">Bulk needs</button>
            <button type="button" data-planning-tab="templates">Template library</button>
            <button type="button" data-planning-tab="duplicates">Roster quality</button>
          </nav>
          <div id="planningToolsBody" class="planning-tools-body"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    el('closePlanningToolsBtn')?.addEventListener('click', close);
    modal.addEventListener('click', event => {
      if (event.target === modal) close();
      const tab = event.target.closest('[data-planning-tab]');
      if (tab) setTab(tab.dataset.planningTab);
      const show = event.target.closest('[data-guidance-student]');
      if (show) window.SeatGuidanceV66.show(show.dataset.guidanceStudent, { pinned: true });
      const best = event.target.closest('[data-best-seat-student]');
      if (best) window.SeatGuidanceV66.placeBestSeat(best.dataset.bestSeatStudent);
      const ignore = event.target.closest('[data-ignore-finding]');
      if (ignore) {
        window.SeatGuidanceV66.ignoreFinding(ignore.dataset.ignoreFinding, 'Ignored from Advanced classroom tools');
        renderGuidance();
      }
      const applyPlan = event.target.closest('[data-schedule-apply-plan]');
      if (applyPlan) applyPlanById(applyPlan.dataset.scheduleApplyPlan);
      const saveSchedule = event.target.closest('[data-save-plan-schedule]');
      if (saveSchedule) savePlanSchedule(saveSchedule.dataset.savePlanSchedule);
      const removeOverride = event.target.closest('[data-remove-rule-override]');
      if (removeOverride) {
        state.ruleOverrides = (state.ruleOverrides || []).filter(item => String(item.id) !== String(removeOverride.dataset.removeRuleOverride));
        persistActiveClass();
        renderGuidance();
      }
      const applyPreset = event.target.closest('[data-apply-requirement-preset]');
      if (applyPreset) applyBulkPreset(applyPreset.dataset.applyRequirementPreset);
      const deletePreset = event.target.closest('[data-delete-requirement-preset]');
      if (deletePreset) deleteRequirementPreset(deletePreset.dataset.deleteRequirementPreset);
      const templateApply = event.target.closest('[data-library-template-apply]');
      if (templateApply) applyTemplate(templateApply.dataset.libraryTemplateApply);
      const templateComment = event.target.closest('[data-library-template-comment]');
      if (templateComment) saveTemplateComment(templateComment.dataset.libraryTemplateComment);
      const zoneComment = event.target.closest('[data-zone-comment-save]');
      if (zoneComment) saveZoneComment(zoneComment.dataset.zoneCommentSave);
    });
    modal.addEventListener('change', event => {
      if (event.target.matches('[data-bulk-student-toggle="all"]')) {
        modal.querySelectorAll('[data-bulk-student-id]').forEach(input => { input.checked = event.target.checked; });
      }
    });
    return modal;
  }

  function open(tab = activeTab) {
    ensureModal().classList.add('show');
    DialogManager.synchronize();
    setTab(tab);
  }

  function close() {
    el('planningToolsModal')?.classList.remove('show');
    DialogManager.synchronize();
  }

  function setTab(tab) {
    activeTab = ['guidance', 'history', 'schedules', 'bulk', 'templates', 'duplicates'].includes(tab) ? tab : 'guidance';
    document.querySelectorAll('[data-planning-tab]').forEach(button => {
      const selected = button.dataset.planningTab === activeTab;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    if (activeTab === 'guidance') renderGuidance();
    else if (activeTab === 'history') renderHistory();
    else if (activeTab === 'schedules') renderSchedules();
    else if (activeTab === 'bulk') renderBulk();
    else if (activeTab === 'templates') renderTemplates();
    else renderDuplicates();
  }

  function renderGuidance() {
    const body = el('planningToolsBody');
    if (!body) return;
    const findings = evaluateCurrentRuleViolations();
    const studentOptions = (state.students || []).map(student => `<option value="${escapeHtml(student.id)}">${escapeHtml(studentDisplay(student))}</option>`).join('');
    const findingsMarkup = findings.length ? findings.map(item => {
      const studentId = item.studentIds?.[0] || '';
      return `<article class="planning-finding ${item.severity === 'bad' ? 'bad' : 'warn'}"><div><strong>${escapeHtml(item.message)}</strong><span>${escapeHtml(item.category || 'rule')} · ${escapeHtml(item.severity)}</span></div><div class="button-row">${studentId ? `<button class="tiny secondary" type="button" data-guidance-student="${escapeHtml(studentId)}">Show valid seats</button><button class="tiny secondary" type="button" data-best-seat-student="${escapeHtml(studentId)}">Move to best seat</button>` : ''}<button class="tiny ghost" type="button" data-ignore-finding="${escapeHtml(item.id)}">Ignore this finding</button></div></article>`;
    }).join('') : '<div class="successbox">No active seating-rule or student-need conflicts were found.</div>';
    const overrides = (state.ruleOverrides || []).length ? `<section class="section"><h3>Recorded overrides</h3>${state.ruleOverrides.map(item => `<div class="planning-override"><span>${escapeHtml(item.id)}</span><button class="tiny secondary" type="button" data-remove-rule-override="${escapeHtml(item.id)}">Restore warning</button></div>`).join('')}</section>` : '';
    body.innerHTML = `
      <section class="section"><h3>Live seat-validity preview</h3><p class="muted">Choose a student to highlight every Grid or Freeform seat. Green seats meet current rules, yellow seats break a preference, and red seats are unavailable or create a required conflict.</p><div class="inline-control"><select id="planningGuidanceStudent"><option value="">Choose a student</option>${studentOptions}</select><button id="planningShowValidSeatsBtn" type="button">Show valid seats</button></div></section>
      <section class="section"><h3>Conflict-resolution actions</h3><div class="planning-finding-list">${findingsMarkup}</div></section>${overrides}`;
    el('planningShowValidSeatsBtn')?.addEventListener('click', () => {
      const id = el('planningGuidanceStudent')?.value;
      if (id) window.SeatGuidanceV66.show(id, { pinned: true });
    });
  }

  function renderHistory() {
    const body = el('planningToolsBody');
    if (!body) return;
    const metrics = fairnessAnalysis();
    const rows = metrics.map(metric => {
      const neighbor = getStudent(metric.repeatedNeighborId);
      const repeated = metric.observed ? Math.round((metric.repeatedSeatCount / metric.observed) * 100) : 0;
      return `<tr><td>${escapeHtml(metric.name)}</td><td>${metric.observed}</td><td>${metric.distinctSeats}</td><td>${metric.repeatedSeatCount} (${repeated}%)</td><td>${neighbor ? `${escapeHtml(studentDisplay(neighbor))} (${metric.repeatedNeighborCount})` : 'None repeated'}</td><td>${metric.frontCount}</td><td>${metric.edgeCount}</td></tr>`;
    }).join('');
    body.innerHTML = `
      <section class="section"><h3>Seating-history and fairness analysis</h3><p class="muted">This report describes repeated placements across the current chart and saved named plans. It does not assign behavioral or student-quality scores.</p><div class="table-scroll"><table class="planning-table"><thead><tr><th>Student</th><th>Plans</th><th>Distinct seats</th><th>Most repeated seat</th><th>Most repeated neighbor</th><th>Front count</th><th>Edge count</th></tr></thead><tbody>${rows || '<tr><td colspan="7">No seating history is available yet.</td></tr>'}</tbody></table></div></section>
      <section class="section"><h3>Plan comparison</h3><div class="row"><div class="field"><label for="planningCompareA">Plan A</label><select id="planningCompareA"></select></div><div class="field"><label for="planningCompareB">Plan B</label><select id="planningCompareB"></select></div></div><button id="planningComparePlansBtn" type="button">Compare visually</button><div id="planningVisualComparison" class="planning-visual-comparison"></div></section>`;
    const options = historyPlans().map(plan => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</option>`).join('');
    ['planningCompareA', 'planningCompareB'].forEach(id => { if (el(id)) el(id).innerHTML = options; });
    if (el('planningCompareB')?.options.length > 1) el('planningCompareB').selectedIndex = 1;
    el('planningComparePlansBtn')?.addEventListener('click', renderVisualComparison);
  }

  function studentInitialsText(student) {
    if (!student) return '';
    const first = String(student.firstName || '').trim().charAt(0);
    const last = String(student.lastName || '').trim().charAt(0);
    return `${first}${last}`.toUpperCase() || String(student.nickName || student.id || '').trim().slice(0, 2).toUpperCase();
  }

  function planVisualMarkup(plan, changedStudentIds, label) {
    const changed = new Set(changedStudentIds);
    if (plan.layoutMode === 'freeform') {
      const objects = (plan.freeformLayout?.objects || []).filter(object => object.type === 'seat');
      const canvas = plan.freeformLayout?.canvas || {};
      const width = Math.max(1, Number(canvas.width) || 1200);
      const height = Math.max(1, Number(canvas.height) || 800);
      return `<article class="planning-plan-preview"><h4>${escapeHtml(label)}: ${escapeHtml(plan.name)}</h4><div class="planning-mini-freeform" aria-label="${escapeHtml(label)} Freeform seating preview">${objects.map((object, index) => {
        const studentId = String(object.assignedStudentId || '');
        const student = getStudent(studentId);
        const left = Math.max(0, Math.min(96, (Number(object.x || 0) / width) * 100));
        const top = Math.max(0, Math.min(94, (Number(object.y || 0) / height) * 100));
        const seatWidth = Math.max(3, Math.min(22, (Number(object.width || 160) / width) * 100));
        const seatHeight = Math.max(4, Math.min(20, (Number(object.height || 100) / height) * 100));
        return `<span class="planning-mini-seat${changed.has(studentId) ? ' changed' : ''}" style="left:${left}%;top:${top}%;width:${seatWidth}%;height:${seatHeight}%" title="${escapeHtml(student ? studentDisplay(student) : object.label || `Seat ${index + 1}`)}">${escapeHtml(student ? studentInitialsText(student) : '')}</span>`;
      }).join('')}</div></article>`;
    }
    const cells = Object.entries(plan.cells || {}).filter(([, cell]) => cell?.type === 'seat');
    const seatMap = new Map(cells.map(([key, cell]) => [`${cell.row}:${cell.col}`, { key, cell }]));
    const rows = Math.max(1, Number(plan.rows) || 1);
    const cols = Math.max(1, Number(plan.cols) || 1);
    const markup = [];
    for (let row = 1; row <= rows; row += 1) {
      for (let col = 1; col <= cols; col += 1) {
        const entry = seatMap.get(`${row}:${col}`);
        if (!entry) {
          markup.push('<span class="planning-mini-seat empty" aria-hidden="true"></span>');
          continue;
        }
        const studentId = String(entry.cell.assignedStudentId || '');
        const student = getStudent(studentId);
        markup.push(`<span class="planning-mini-seat${changed.has(studentId) ? ' changed' : ''}" title="${escapeHtml(student ? studentDisplay(student) : `Seat ${row},${col}`)}">${escapeHtml(student ? studentInitialsText(student) : '')}</span>`);
      }
    }
    return `<article class="planning-plan-preview"><h4>${escapeHtml(label)}: ${escapeHtml(plan.name)}</h4><div class="planning-mini-grid" style="--planning-cols:${cols}" aria-label="${escapeHtml(label)} Grid seating preview">${markup.join('')}</div></article>`;
  }

  function renderVisualComparison() {
    const plans = historyPlans();
    const a = plans.find(plan => String(plan.id) === String(el('planningCompareA')?.value));
    const b = plans.find(plan => String(plan.id) === String(el('planningCompareB')?.value));
    const out = el('planningVisualComparison');
    if (!out || !a || !b) return;
    const mapA = planAssignmentMap(a);
    const mapB = planAssignmentMap(b);
    const students = new Set([...mapA.keys(), ...mapB.keys()]);
    const changes = [...students].map(id => ({ id, student: getStudent(id), from: mapA.get(id) || 'Unassigned', to: mapB.get(id) || 'Unassigned' })).filter(item => item.from !== item.to);
    const changedIds = changes.map(item => item.id);
    out.innerHTML = `<div class="planning-comparison-summary"><strong>${changes.length} student placement${changes.length === 1 ? '' : 's'} changed</strong><span>${escapeHtml(a.name)} compared with ${escapeHtml(b.name)}. Highlighted seats contain students whose placement changed.</span></div><div class="planning-preview-pair">${planVisualMarkup(a, changedIds, 'Plan A')}${planVisualMarkup(b, changedIds, 'Plan B')}</div>${changes.map(item => `<div class="planning-comparison-row"><strong>${escapeHtml(studentDisplay(item.student || { id: 'Unknown' }))}</strong><span>${escapeHtml(item.from)} → ${escapeHtml(item.to)}</span></div>`).join('') || '<div class="successbox">The assignments are identical.</div>'}`;
  }

  function applyPlanById(planId) {
    const id = String(planId || '');
    if (!id || !(state.seatingPlans || []).some(plan => String(plan.id) === id)) return false;
    close();
    ClassroomWorkflowV53?.openSeatingPlans?.();
    setTimeout(() => {
      const button = document.querySelector(`[data-plan-full="${cssEscape(id)}"]`);
      if (button) button.click();
      else setLiveStatusMessage('The selected seating plan could not be opened.');
    }, 50);
    return true;
  }

  function renderSchedules() {
    const body = el('planningToolsBody');
    if (!body) return;
    const plans = (state.seatingPlans || []).map(normalizeSeatingPlan);
    body.innerHTML = `<section class="section"><h3>Scheduled seating plans</h3><p class="muted">Schedules suggest a plan on matching days. The application never silently replaces the current chart.</p><div class="planning-schedule-list">${plans.map(plan => {
      const days = WEEKDAYS.map((day, index) => `<label class="checkline"><input type="checkbox" data-plan-day="${index}" ${plan.schedule.daysOfWeek.includes(index) ? 'checked' : ''}> ${day}</label>`).join('');
      return `<article class="planning-schedule-card" data-plan-schedule-card="${escapeHtml(plan.id)}"><div class="section-header-row"><div><strong>${escapeHtml(plan.name)}</strong><span>${escapeHtml(plan.reason || 'Named seating plan')}</span></div><label class="checkline"><input data-plan-schedule-enabled type="checkbox" ${plan.schedule.enabled ? 'checked' : ''}> Enabled</label></div><div class="planning-days">${days}</div><div class="row"><div class="field"><label>Start date</label><input data-plan-start-date type="date" value="${escapeHtml(plan.schedule.startDate)}"></div><div class="field"><label>End date</label><input data-plan-end-date type="date" value="${escapeHtml(plan.schedule.endDate)}"></div></div><div class="field"><label>Class period or use</label><input data-plan-period value="${escapeHtml(plan.schedule.period)}" placeholder="Period 2, Monday lab, testing day"></div><div class="field"><label>Plan comment</label><textarea data-plan-comment rows="2" maxlength="1200" placeholder="Optional context for this saved plan">${escapeHtml(plan.comment || plan.notes || '')}</textarea></div><div class="button-row"><button type="button" data-save-plan-schedule="${escapeHtml(plan.id)}">Save schedule and comment</button><button class="secondary" type="button" data-schedule-apply-plan="${escapeHtml(plan.id)}">Apply now</button></div></article>`;
    }).join('') || '<div class="restore-empty">Save a named seating plan before adding a schedule.</div>'}</div></section>`;
  }

  function savePlanSchedule(planId) {
    const plan = (state.seatingPlans || []).find(item => String(item.id) === String(planId));
    const card = document.querySelector(`[data-plan-schedule-card="${cssEscape(planId)}"]`);
    if (!plan || !card) return;
    plan.comment = String(card.querySelector('[data-plan-comment]')?.value || '').trim().slice(0, 1200);
    plan.notes = plan.comment;
    plan.schedule = normalizePlanSchedule({
      enabled: card.querySelector('[data-plan-schedule-enabled]')?.checked,
      daysOfWeek: [...card.querySelectorAll('[data-plan-day]:checked')].map(input => Number(input.dataset.planDay)),
      startDate: card.querySelector('[data-plan-start-date]')?.value,
      endDate: card.querySelector('[data-plan-end-date]')?.value,
      period: card.querySelector('[data-plan-period]')?.value,
      autoSuggest: true,
      lastAppliedAt: plan.schedule?.lastAppliedAt
    });
    persistActiveClass();
    scheduleLinkedAutoSave('plan-schedule');
    refreshScheduledPlanBanner();
    setLiveStatusMessage(`Schedule saved for “${plan.name}”.`);
  }

  function builtInPresets() {
    return [
      normalizeRequirementPreset({ id: 'builtin-front', name: 'Prefer front', requirements: { front: 'prefer' } }),
      normalizeRequirementPreset({ id: 'builtin-near-teacher', name: 'Near teacher', requirements: { nearTeacher: true } }),
      normalizeRequirementPreset({ id: 'builtin-away-door', name: 'Away from door', requirements: { awayDoor: true } }),
      normalizeRequirementPreset({ id: 'builtin-away-window', name: 'Away from window', requirements: { awayWindow: true } }),
      normalizeRequirementPreset({ id: 'builtin-aisle', name: 'Aisle access', requirements: { aisle: true } }),
      normalizeRequirementPreset({ id: 'builtin-ada', name: 'Accessibility area required', requirements: { ada: true } })
    ];
  }

  function renderBulk() {
    const body = el('planningToolsBody');
    if (!body) return;
    const presets = [...builtInPresets(), ...(state.requirementPresets || []).map(normalizeRequirementPreset)];
    const studentRows = (state.students || []).map(student => `<label class="bulk-student-row"><input type="checkbox" data-bulk-student-id="${escapeHtml(student.id)}"><span>${escapeHtml(studentDisplay(student))}</span></label>`).join('');
    body.innerHTML = `
      <section class="section"><h3>Choose students</h3><label class="checkline"><input type="checkbox" data-bulk-student-toggle="all"> Select all active students</label><div class="bulk-student-list">${studentRows}</div></section>
      <section class="section"><h3>Apply a requirement preset</h3><div class="planning-preset-grid">${presets.map(preset => `<article class="planning-preset-card"><strong>${escapeHtml(preset.name)}</strong><span>${escapeHtml(requirementSummary(preset.requirements))}</span><div class="button-row"><button class="tiny secondary" type="button" data-apply-requirement-preset="${escapeHtml(preset.id)}">Apply</button>${preset.id.startsWith('builtin-') ? '' : `<button class="tiny danger" type="button" data-delete-requirement-preset="${escapeHtml(preset.id)}">Delete</button>`}</div></article>`).join('')}</div></section>
      <section class="section"><h3>Create a reusable preset</h3><div class="field"><label for="bulkPresetName">Preset name</label><input id="bulkPresetName" maxlength="80"></div>${requirementsEditorMarkup('bulk')}<div class="button-row"><button id="applyBulkRequirementsBtn" type="button">Apply these needs</button><button id="saveRequirementPresetBtn" class="secondary" type="button">Save as preset</button><button id="createBulkGroupRuleBtn" class="secondary" type="button">Create group rule</button></div></section>`;
    el('applyBulkRequirementsBtn')?.addEventListener('click', () => applyBulkRequirements(readRequirementsEditor('bulk')));
    el('saveRequirementPresetBtn')?.addEventListener('click', saveRequirementPreset);
    el('createBulkGroupRuleBtn')?.addEventListener('click', createBulkGroupRule);
  }

  function selectedBulkStudentIds() {
    return [...document.querySelectorAll('[data-bulk-student-id]:checked')].map(input => String(input.dataset.bulkStudentId));
  }

  function requirementsEditorMarkup(prefix) {
    const zoneOptions = (state.zones || []).map(zone => `<option value="${escapeHtml(zone.id)}">${escapeHtml(zone.name)}</option>`).join('');
    return `<div class="requirements-grid"><div class="field"><label for="${prefix}Front">Front</label><select id="${prefix}Front"><option value="none">No front requirement</option><option value="prefer">Prefer front</option><option value="require">Require front</option></select></div><div class="field"><label for="${prefix}Side">Side</label><select id="${prefix}Side"><option value="none">No side preference</option><option value="left">Prefer left</option><option value="right">Prefer right</option></select></div><label class="checkline"><input id="${prefix}NearTeacher" type="checkbox"> Near teacher</label><label class="checkline"><input id="${prefix}Aisle" type="checkbox"> Aisle access</label><label class="checkline"><input id="${prefix}Ada" type="checkbox"> Accessibility area</label><label class="checkline"><input id="${prefix}AwayDoor" type="checkbox"> Away from door</label><label class="checkline"><input id="${prefix}AwayWindow" type="checkbox"> Away from window</label><div class="field"><label for="${prefix}PreferredZones">Preferred zones</label><select id="${prefix}PreferredZones" multiple>${zoneOptions}</select></div><div class="field"><label for="${prefix}ExcludedZones">Excluded zones</label><select id="${prefix}ExcludedZones" multiple>${zoneOptions}</select></div><label class="checkline"><input id="${prefix}SeparateSelected" type="checkbox"> Keep the selected students separated from one another</label></div>`;
  }

  function readRequirementsEditor(prefix) {
    const requirements = normalizeStudent({ requirements: {
      front: el(`${prefix}Front`)?.value,
      side: el(`${prefix}Side`)?.value,
      nearTeacher: el(`${prefix}NearTeacher`)?.checked,
      aisle: el(`${prefix}Aisle`)?.checked,
      ada: el(`${prefix}Ada`)?.checked,
      awayDoor: el(`${prefix}AwayDoor`)?.checked,
      awayWindow: el(`${prefix}AwayWindow`)?.checked,
      preferredZoneIds: selectedOptionValues(el(`${prefix}PreferredZones`)),
      excludedZoneIds: selectedOptionValues(el(`${prefix}ExcludedZones`))
    } }).requirements;
    requirements.separateSelected = Boolean(el(`${prefix}SeparateSelected`)?.checked);
    return requirements;
  }

  function requirementSummary(requirements) {
    const req = normalizeStudent({ requirements }).requirements;
    const parts = [];
    if (req.front !== 'none') parts.push(req.front === 'require' ? 'Require front' : 'Prefer front');
    if (req.side !== 'none') parts.push(`Prefer ${req.side}`);
    if (req.nearTeacher) parts.push('Near teacher');
    if (req.aisle) parts.push('Aisle');
    if (req.ada) parts.push('Accessibility');
    if (req.awayDoor) parts.push('Away door');
    if (req.awayWindow) parts.push('Away window');
    if (req.preferredZoneIds.length) parts.push(`${req.preferredZoneIds.length} preferred zone${req.preferredZoneIds.length === 1 ? '' : 's'}`);
    if (req.excludedZoneIds.length) parts.push(`${req.excludedZoneIds.length} excluded zone${req.excludedZoneIds.length === 1 ? '' : 's'}`);
    if (requirements?.separateSelected) parts.push('Separate selected students');
    return parts.join(', ') || 'No requirements';
  }

  function applyBulkRequirements(requirements) {
    const ids = new Set(selectedBulkStudentIds());
    if (!ids.size) return setLiveStatusMessage('Select at least one student first.');
    pushUndoSnapshot('Before bulk student needs update');
    const requested = deepClone(requirements);
    const separateSelected = Boolean(requested.separateSelected);
    delete requested.separateSelected;
    state.students.forEach(student => {
      if (!ids.has(String(student.id))) return;
      const existing = effectiveStudentRequirements(student);
      student.requirements = { ...existing, ...deepClone(requested) };
      if (separateSelected) {
        student.requirements.minDistanceStudentIds = [...new Set([...(existing.minDistanceStudentIds || []), ...[...ids].filter(id => id !== String(student.id))])];
      }
    });
    persistActiveClass();
    renderTargeted(['roster', 'rules', 'status'], { reason: 'bulk-requirements' });
    scheduleLinkedAutoSave('bulk-requirements');
    setLiveStatusMessage(`Updated seating needs for ${ids.size} student${ids.size === 1 ? '' : 's'}.`);
  }

  function saveRequirementPreset() {
    const name = String(el('bulkPresetName')?.value || '').trim();
    if (!name) return setLiveStatusMessage('Enter a preset name first.');
    state.requirementPresets = Array.isArray(state.requirementPresets) ? state.requirementPresets : [];
    state.requirementPresets.push(normalizeRequirementPreset({ name, requirements: readRequirementsEditor('bulk') }, state.requirementPresets.length));
    persistActiveClass();
    renderBulk();
  }

  function applyBulkPreset(presetId) {
    const preset = [...builtInPresets(), ...(state.requirementPresets || [])].find(item => String(item.id) === String(presetId));
    if (preset) applyBulkRequirements(preset.requirements);
  }

  function deleteRequirementPreset(presetId) {
    state.requirementPresets = (state.requirementPresets || []).filter(item => String(item.id) !== String(presetId));
    persistActiveClass();
    renderBulk();
  }

  function createBulkGroupRule() {
    const ids = selectedBulkStudentIds();
    if (!ids.length) return setLiveStatusMessage('Select at least one student first.');
    const name = String(el('bulkPresetName')?.value || '').trim() || `Bulk group ${state.groups.length + 1}`;
    addGroup({ name, type: 'together', priority: 6, studentIds: ids, color: defaultGroupColor(state.groups.length), zoneId: '' });
    renderBulk();
  }

  function renderTemplates() {
    const body = el('planningToolsBody');
    if (!body) return;
    const templates = (state.roomTemplates || []).map(template => `<article class="planning-template-card"><div><strong>${escapeHtml(template.name)}</strong><span>${template.rows} × ${template.cols} · ${escapeHtml(template.layoutMode)}${template.librarySource ? ` · ${escapeHtml(template.librarySource)}` : ''}</span><div class="field"><label>Template comment</label><textarea rows="2" maxlength="500" data-template-description="${escapeHtml(template.id)}">${escapeHtml(template.description || '')}</textarea></div></div><div class="button-row"><button class="tiny secondary" type="button" data-library-template-apply="${escapeHtml(template.id)}">Apply</button><button class="tiny ghost" type="button" data-library-template-comment="${escapeHtml(template.id)}">Save comment</button></div></article>`).join('') || '<div class="restore-empty">No room templates are saved yet.</div>';
    const zones = (state.zones || []).map(zone => `<article class="planning-zone-comment-card"><div><strong>${escapeHtml(zone.name)}</strong><span>Comment stored with this class and shared room templates.</span></div><textarea rows="2" maxlength="1200" data-zone-comment-input="${escapeHtml(zone.id)}" aria-label="Comment for ${escapeHtml(zone.name)}">${escapeHtml(zone.comment || '')}</textarea><button class="tiny secondary" type="button" data-zone-comment-save="${escapeHtml(zone.id)}">Save zone comment</button></article>`).join('') || '<div class="restore-empty">Create a zone before adding zone comments.</div>';
    body.innerHTML = `<section class="section"><h3>Shared template library</h3><p class="muted">Export this library file to a shared Drive folder or district repository. Other teachers can import the same file without a server.</p><div class="button-row"><button id="exportTemplateLibraryBtn" type="button">Export library</button><button id="importTemplateLibraryBtn" class="secondary" type="button">Import library file</button><input id="templateLibraryFileInput" type="file" accept="application/json,.json" aria-label="Choose room-template library file" hidden></div><div class="planning-template-list">${templates}</div></section><section class="section"><h3>Zone comments</h3><p class="muted">Use zone comments for instructional intent, equipment, accessibility, or room reminders. They do not change seating rules.</p><div class="planning-zone-comment-list">${zones}</div></section>`;
    el('exportTemplateLibraryBtn')?.addEventListener('click', exportTemplateLibrary);
    el('importTemplateLibraryBtn')?.addEventListener('click', () => el('templateLibraryFileInput')?.click());
    el('templateLibraryFileInput')?.addEventListener('change', event => void importTemplateLibrary(event.target.files?.[0]));
  }

  function exportTemplateLibrary() {
    const payload = {
      format: 'classroom-seating-planner-template-library-v1',
      app: APP_NAME,
      version: APP_REVISION,
      dataSchemaVersion: DATA_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      source: activeClassName(),
      templates: (state.roomTemplates || []).map(normalizeRoomTemplateRecord)
    };
    downloadText(`classroom-room-template-library-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }

  async function importTemplateLibrary(file) {
    if (!file) return;
    try {
      const text = await readTextFileWithinLimits(file, 'room-template library', IMPORT_LIMITS.saveBytes);
      const payload = JSON.parse(text);
      if (payload?.format !== 'classroom-seating-planner-template-library-v1' || !Array.isArray(payload.templates)) throw new Error('This is not a supported room-template library.');
      const existing = new Map((state.roomTemplates || []).map(item => [String(item.id), normalizeRoomTemplateRecord(item)]));
      payload.templates.forEach((item, index) => {
        const template = normalizeRoomTemplateRecord({ ...item, librarySource: payload.source || file.name, shared: true }, index);
        if (existing.has(template.id)) template.id = uid('room-template');
        existing.set(template.id, template);
      });
      state.roomTemplates = [...existing.values()].slice(0, 200);
      scheduleLinkedAutoSave('template-library-import');
      renderTemplates();
      setLiveStatusMessage(`Imported ${payload.templates.length} shared room template${payload.templates.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setLiveStatusMessage(`Template library import failed: ${error.message}`);
    } finally {
      if (el('templateLibraryFileInput')) el('templateLibraryFileInput').value = '';
    }
  }

  function applyTemplate(templateId) {
    const button = document.querySelector(`[data-apply-room-template="${cssEscape(templateId)}"]`);
    if (button) button.click();
    else {
      const template = (state.roomTemplates || []).find(item => String(item.id) === String(templateId));
      if (!template) return;
      pushUndoSnapshot('Before applying shared room template');
      state.rows = template.rows;
      state.cols = template.cols;
      state.cells = normalizeCellsRecord(deepClone(template.cells));
      state.layoutMode = template.layoutMode;
      state.freeformLayout = normalizeFreeformLayout(deepClone(template.freeformLayout));
      state.zones = deepClone(template.zones || []);
      state.customObjects = deepClone(template.customObjects || []);
      renderAll();
    }
    close();
  }

  function saveTemplateComment(templateId) {
    const template = (state.roomTemplates || []).find(item => String(item.id) === String(templateId));
    const input = document.querySelector(`[data-template-description="${cssEscape(templateId)}"]`);
    if (!template || !input) return;
    template.description = String(input.value || '').trim().slice(0, 500);
    persistActiveClass();
    scheduleLinkedAutoSave('template-comment');
    setLiveStatusMessage(`Comment saved for room template “${template.name}”.`);
  }

  function saveZoneComment(zoneId) {
    const zone = (state.zones || []).find(item => String(item.id) === String(zoneId));
    const input = document.querySelector(`[data-zone-comment-input="${cssEscape(zoneId)}"]`);
    if (!zone || !input) return;
    zone.comment = String(input.value || '').trim().slice(0, 1200);
    persistActiveClass();
    scheduleLinkedAutoSave('zone-comment');
    setLiveStatusMessage(`Comment saved for zone “${zone.name}”.`);
  }

  function normalizedName(student) {
    return `${student.firstName || ''} ${student.lastName || ''}`.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function levenshtein(a, b) {
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
      let diagonal = previous[0];
      previous[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const above = previous[j];
        previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
        diagonal = above;
      }
    }
    return previous[b.length];
  }

  function duplicateSuggestions() {
    const students = state.students || [];
    const pairs = [];
    for (let i = 0; i < students.length; i += 1) {
      const first = normalizedName(students[i]);
      if (!first) continue;
      for (let j = i + 1; j < students.length; j += 1) {
        const second = normalizedName(students[j]);
        if (!second) continue;
        const distance = levenshtein(first, second);
        const sameId = students[i].id && String(students[i].id) === String(students[j].id);
        const sameSource = students[i].sourceUserId && String(students[i].sourceUserId) === String(students[j].sourceUserId);
        if (sameId || sameSource || first === second || (Math.max(first.length, second.length) >= 6 && distance <= 2)) pairs.push({ first: students[i], second: students[j], distance, sameId, sameSource });
      }
    }
    return pairs;
  }

  function renderDuplicates() {
    const body = el('planningToolsBody');
    if (!body) return;
    const suggestions = duplicateSuggestions();
    body.innerHTML = `<section class="section"><h3>Duplicate-detection suggestions</h3><p class="muted">Suggestions are based on matching IDs, source identifiers, exact normalized names, or very similar names. Nothing is merged automatically.</p><div class="planning-duplicate-list">${suggestions.map(item => `<article class="planning-duplicate-card"><strong>${escapeHtml(studentDisplay(item.first))} ↔ ${escapeHtml(studentDisplay(item.second))}</strong><span>${item.sameId ? 'Matching student ID' : item.sameSource ? 'Matching source-system ID' : item.distance === 0 ? 'Matching normalized name' : `Names differ by ${item.distance} character${item.distance === 1 ? '' : 's'}`}</span><div class="button-row"><button class="tiny secondary" type="button" data-edit-student-id="${escapeHtml(item.first.id)}">Review first</button><button class="tiny secondary" type="button" data-edit-student-id="${escapeHtml(item.second.id)}">Review second</button></div></article>`).join('') || '<div class="successbox">No likely duplicate roster records were found.</div>'}</div></section>`;
  }

  function ensureSeatCommentEditor() {
    const modal = el('seatEditModal');
    const body = modal?.querySelector('.modal-body');
    if (!body || el('seatCommentSection')) return;
    const section = document.createElement('section');
    section.id = 'seatCommentSection';
    section.className = 'section';
    section.innerHTML = '<h3>Seat comment</h3><div class="field"><label for="seatCommentInput">Optional comment for this seat</label><textarea id="seatCommentInput" rows="3" maxlength="1200" placeholder="Instructional use, equipment note, or room-specific reminder"></textarea></div><button id="saveSeatCommentBtn" class="secondary" type="button">Save comment</button>';
    body.appendChild(section);
    el('saveSeatCommentBtn')?.addEventListener('click', saveSeatComment);
  }

  function populateSeatComment() {
    ensureSeatCommentEditor();
    const input = el('seatCommentInput');
    if (!input) return;
    const obj = activeSeatEditFreeformObject();
    const cell = uiState.activeSeatEditCellKey ? state.cells[uiState.activeSeatEditCellKey] : null;
    input.value = String(obj?.comment || cell?.comment || '');
    input.disabled = Boolean(uiState.activeSeatEditBatchCellKeys?.length || uiState.activeSeatEditBatchFreeformObjectIds?.length);
  }

  function saveSeatComment() {
    const text = String(el('seatCommentInput')?.value || '').trim().slice(0, 1200);
    const obj = activeSeatEditFreeformObject();
    const cell = uiState.activeSeatEditCellKey ? state.cells[uiState.activeSeatEditCellKey] : null;
    if (obj) {
      obj.comment = text;
      mirrorFreeformSeatToGrid(obj, { clearStudentDuplicates: false });
    } else if (cell) {
      cell.comment = text;
      mirrorLinkedFreeformSeatsFromGrid(uiState.activeSeatEditCellKey);
    }
    persistActiveClass();
    scheduleLinkedAutoSave('seat-comment');
    setLiveStatusMessage('Seat comment saved.');
  }

  function installSeatCommentObserver() {
    ensureSeatCommentEditor();
    const modal = el('seatEditModal');
    if (!modal || seatModalObserver) return;
    seatModalObserver = new MutationObserver(() => {
      if (modal.classList.contains('show')) populateSeatComment();
    });
    seatModalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  function ensureStudentFilters() {
    const list = el('studentList');
    if (!list || el('studentAdvancedFilters')) return;
    const filters = document.createElement('div');
    filters.id = 'studentAdvancedFilters';
    filters.className = 'student-advanced-filters';
    filters.innerHTML = '<label class="checkline"><input type="checkbox" value="unseated"> Unseated</label><label class="checkline"><input type="checkbox" value="conflict"> Rule conflict</label><label class="checkline"><input type="checkbox" value="notes"> Notes</label><label class="checkline"><input type="checkbox" value="locked"> Locked</label><label class="checkline"><input type="checkbox" value="absent"> Absent today</label><button id="clearStudentAdvancedFiltersBtn" class="tiny secondary" type="button">Clear filters</button>';
    list.parentElement?.insertBefore(filters, list);
    filters.addEventListener('change', applyStudentFilters);
    el('clearStudentAdvancedFiltersBtn')?.addEventListener('click', () => {
      filters.querySelectorAll('input').forEach(input => { input.checked = false; });
      applyStudentFilters();
    });
  }

  function applyStudentFilters() {
    const cards = [...document.querySelectorAll('.student-card[data-student-id]')];
    const filters = new Set([...document.querySelectorAll('#studentAdvancedFilters input:checked')].map(input => input.value));
    if (!filters.size) {
      cards.forEach(card => { card.hidden = false; });
      return;
    }
    const assigned = filters.has('unseated') ? assignedStudentIds() : new Set();
    const conflicts = filters.has('conflict')
      ? new Set(evaluateCurrentRuleViolations().flatMap(item => item.studentIds || []).map(String))
      : new Set();
    const locked = filters.has('locked')
      ? new Set(Object.values(state.cells || {}).filter(cell => cell.manual && cell.assignedStudentId).map(cell => String(cell.assignedStudentId)))
      : new Set();
    if (filters.has('locked')) {
      (state.freeformLayout?.objects || []).filter(object => object.type === 'seat' && object.locked && object.assignedStudentId).forEach(object => locked.add(String(object.assignedStudentId)));
    }
    const absent = filters.has('absent') ? new Set((state.todaySession?.absentStudentIds || []).map(String)) : new Set();
    cards.forEach(card => {
      const student = filters.has('notes') ? getStudent(card.dataset.studentId) : null;
      const id = String(card.dataset.studentId);
      const notes = Boolean(student?.notesPrivate || student?.notesSubstitute || student?.notesPublic);
      const visible = (!filters.has('unseated') || !assigned.has(id))
        && (!filters.has('conflict') || conflicts.has(id))
        && (!filters.has('notes') || notes)
        && (!filters.has('locked') || locked.has(id))
        && (!filters.has('absent') || absent.has(id));
      card.hidden = !visible;
    });
  }

  function installEntryPoint() {
    let button = el('openPlanningToolsBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'openPlanningToolsBtn';
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = 'Advanced tools';
      button.title = 'Open live seat guidance, fairness analysis, schedules, bulk needs, template libraries, and roster-quality tools.';
      const moreMenu = el('v4MoreMenu');
      if (moreMenu) moreMenu.appendChild(button);
      else document.querySelector('.center-panel > .panel-header .button-row')?.appendChild(button);
    }
  }

  function install() {
    if (installed) return;
    installed = true;
    ensureModal();
    ensureScheduledBanner();
    installSeatCommentObserver();
    document.addEventListener('click', event => {
      if (event.target.closest('#openPlanningToolsBtn')) open();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && el('planningToolsModal')?.classList.contains('show')) close();
    });
  }

  function refreshStudentFilters() {
    ensureStudentFilters();
    applyStudentFilters();
    if (activeTab === 'guidance' && el('planningToolsModal')?.classList.contains('show')) renderGuidance();
  }

  function afterReady() {
    installEntryPoint();
    refreshStudentFilters();
    refreshScheduledPlanBanner();
  }

  return Object.freeze({
    install,
    afterReady,
    open,
    close,
    setTab,
    fairnessAnalysis,
    matchingScheduledPlans,
    refreshScheduledPlanBanner,
    duplicateSuggestions,
    refreshStudentFilters,
    exportTemplateLibrary
  });
})();

'use strict';

