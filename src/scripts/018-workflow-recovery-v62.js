const WorkflowRecoveryV62 = (() => {
  const PASSWORD_RECOVERY_KIND = 'encryption-password-recovery';
  const PASSWORD_RECOVERY_FORMAT = 'classroom-seating-planner-password-recovery-v1';
  const MAX_FAILURE_RECORDS = 30;
  let installed = false;
  let pendingGenerationMode = '';
  let classMergeExternalClasses = [];
  let currentMergeSourceLabel = '';
  let failureSequence = 0;
  let pendingPasswordRecoveryFile = null;
  let candidateObserver = null;
  let settingsObserver = null;
  const failureRecords = [];

  const node = id => document.getElementById(id);
  const text = value => String(value || '').trim();
  const same = (a, b) => stableJsonStringify(a) === stableJsonStringify(b);

  function appendModalMarkup() {
    if (node('ruleConflictModal')) return;
    const shell = document.createElement('div');
    shell.innerHTML = `
      <div id="ruleConflictModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ruleConflictTitle">
        <div class="modal modern-modal rule-conflict-modal">
          <div class="panel-header"><h2 id="ruleConflictTitle">Rule Conflict Inspector</h2><button id="closeRuleConflictBtn" class="tiny secondary" type="button">Close</button></div>
          <div class="modal-body rule-conflict-body">
            <div id="ruleConflictSummary" class="rule-conflict-summary"></div>
            <div id="ruleConflictList" class="rule-conflict-list"></div>
            <div class="button-row rule-conflict-actions"><button id="ruleConflictGenerateAnywayBtn" type="button" hidden>Generate Anyway</button><button id="ruleConflictRecheckBtn" class="secondary" type="button">Check Again</button><button id="ruleConflictCloseBottomBtn" class="secondary" type="button">Close</button></div>
          </div>
        </div>
      </div>
      <div id="classMergeModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="classMergeTitle">
        <div class="modal modern-modal class-merge-modal">
          <div class="panel-header"><h2 id="classMergeTitle">Compare &amp; Merge Class</h2><button id="closeClassMergeBtn" class="tiny secondary" type="button">Close</button></div>
          <div class="modal-body class-merge-body">
            <div class="class-merge-source-row">
              <div class="field"><label for="classMergeSourceSelect">Source class</label><select id="classMergeSourceSelect"></select></div>
              <div class="button-row"><button id="classMergeLoadFileBtn" class="secondary" type="button">Load Classes File</button><input id="classMergeFileInput" type="file" accept="application/json,.json,.txt" aria-label="Choose classes merge file" hidden /></div>
            </div>
            <div id="classMergeSourceStatus" class="hint">Choose another class in this save or load an encrypted classes file.</div>
            <div id="classMergeComparison" class="class-merge-comparison"></div>
            <section class="section class-merge-options"><h3>Choose what the source may update</h3>
              <div class="class-merge-option-grid">
                <label class="checkline"><input data-class-merge-category="roster" type="checkbox" checked /> <span>Roster and student identity fields</span></label>
                <label class="checkline"><input data-class-merge-category="notes" type="checkbox" checked /> <span>Student notes</span></label>
                <label class="checkline"><input data-class-merge-category="requirements" type="checkbox" checked /> <span>Individual seating requirements</span></label>
                <label class="checkline"><input data-class-merge-category="rules" type="checkbox" checked /> <span>Groups and rules</span></label>
                <label class="checkline"><input data-class-merge-category="zones" type="checkbox" checked /> <span>Zones and seat-zone membership</span></label>
                <label class="checkline"><input data-class-merge-category="room" type="checkbox" checked /> <span>Room layout and objects</span></label>
                <label class="checkline"><input data-class-merge-category="assignments" type="checkbox" checked /> <span>Student assignments and locks</span></label>
                <label class="checkline"><input data-class-merge-category="plans" type="checkbox" checked /> <span>Named seating plans</span></label>
                <label class="checkline"><input data-class-merge-category="details" type="checkbox" /> <span>Chart details, academic year, and term</span></label>
              </div>
              <div class="settings-grid two-col class-merge-policy-grid">
                <div class="field"><label for="classMergeRosterMode">Roster behavior</label><select id="classMergeRosterMode"><option value="merge">Merge source students into current class</option><option value="replace">Replace current roster with source roster</option></select></div>
                <label class="checkline class-merge-source-wins"><input id="classMergeSourceWins" type="checkbox" checked /> <span>Source values win when both classes contain the student</span></label>
              </div>
              <label class="checkline"><input id="classMergeSnapshotBefore" type="checkbox" checked /> <span>Create an encrypted snapshot before applying the merge</span></label>
              <div class="warningbox">The current class remains the destination. Its class name and ID are never replaced. Review the comparison and selected categories before applying.</div>
            </section>
            <div class="button-row"><button id="applyClassMergeBtn" type="button">Apply Selected Merge</button><button id="cancelClassMergeBtn" class="secondary" type="button">Cancel</button></div>
          </div>
        </div>
      </div>
      <div id="passwordRecoveryRestoreModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="passwordRecoveryRestoreTitle">
        <div class="modal modern-modal password-recovery-restore-modal">
          <div class="panel-header"><h2 id="passwordRecoveryRestoreTitle">Restore Encryption Password</h2><button id="closePasswordRecoveryRestoreBtn" class="tiny secondary" type="button">Close</button></div>
          <div class="modal-body password-recovery-restore-body">
            <div id="passwordRecoveryRestoreFile" class="hint">Choose a password recovery package first.</div>
            <div class="field"><label for="passwordRecoveryCodeInput">One-time recovery code</label><input id="passwordRecoveryCodeInput" type="password" autocomplete="off" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" /></div>
            <div id="passwordRecoveryRestoreError" class="warning" hidden></div>
            <div class="button-row"><button id="continuePasswordRecoveryRestoreBtn" type="button">Recover Password</button><button id="cancelPasswordRecoveryRestoreBtn" class="secondary" type="button">Cancel</button></div>
          </div>
        </div>
      </div>
      <div id="operationRecoveryModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="operationRecoveryTitle">
        <div class="modal modern-modal operation-recovery-modal">
          <div class="panel-header"><h2 id="operationRecoveryTitle">Operation Recovery Center</h2><button id="closeOperationRecoveryBtn" class="tiny secondary" type="button">Close</button></div>
          <div class="modal-body operation-recovery-body">
            <div id="operationRecoveryCurrent"></div>
            <section class="section"><div class="section-header-row"><h3>Recent operation failures</h3><button id="clearOperationFailureHistoryBtn" class="tiny secondary" type="button">Clear History</button></div><div id="operationRecoveryHistory" class="operation-recovery-history"></div></section>
          </div>
        </div>
      </div>`;
    while (shell.firstElementChild) document.body.appendChild(shell.firstElementChild);
  }

  function installEntryPoints() {
    const generation = document.querySelector('.generation-controls');
    if (generation && !node('ruleConflictInspectorBtn')) {
      const button = document.createElement('button');
      button.id = 'ruleConflictInspectorBtn';
      button.className = 'secondary';
      button.type = 'button';
      button.textContent = 'Check Rule Conflicts';
      generation.appendChild(button);
    }
    const classGrid = node('classToolsModal')?.querySelector('.class-tools-grid');
    if (classGrid && !node('compareMergeClassBtn')) {
      const section = document.createElement('section');
      section.className = 'workflow-card';
      section.innerHTML = '<h3>Compare &amp; Merge</h3><p class="muted">Compare this class with another class or an encrypted classes file, then choose which categories the source may update.</p><button id="compareMergeClassBtn" class="secondary" type="button">Compare / Merge Class</button>';
      classGrid.appendChild(section);
    }
    const maintenance = node('settingsMaintenanceTools');
    if (maintenance && !node('openOperationRecoveryCenterBtn')) {
      const section = document.createElement('section');
      section.className = 'section settings-section';
      section.innerHTML = '<h3>Import &amp; Integration Recovery</h3><div class="hint">Review failed imports and cloud operations, retry a supported operation, copy a privacy-safe technical report, or download rejected rows when available.</div><div class="button-row"><button id="openOperationRecoveryCenterBtn" class="secondary" type="button">Open Recovery Center</button></div>';
      maintenance.after(section);
    }
    installEncryptionRecoveryControls();
  }

  function installEncryptionRecoveryControls() {
    const securityPage = node('settingsPageSecurity');
    if (securityPage && !node('openPasswordRecoveryPackageBtn')) {
      const section = document.createElement('section');
      section.className = 'section settings-section';
      section.innerHTML = `
        <h3>Optional Encryption Password Recovery</h3>
        <div class="hint">Create a separate package that wraps the current encryption password with a one-time recovery code. Store the package and code in different secure locations. This does not change or weaken ordinary saves.</div>
        <div class="button-row"><button id="openPasswordRecoveryPackageBtn" class="secondary" type="button">Create Password Recovery Package</button><button id="restorePasswordRecoveryPackageBtn" class="secondary" type="button">Restore Password from Package</button><input id="passwordRecoveryPackageInput" type="file" accept="application/json,.json" aria-label="Choose password recovery package" hidden /></div>
        <div id="passwordRecoverySettingsStatus" class="muted">No recovery action performed in this session.</div>`;
      const firstSection = securityPage.querySelector('.settings-section');
      if (firstSection) firstSection.before(section);
      else securityPage.appendChild(section);
    }
    const welcomeActions = node('welcomeLoadExistingBtn')?.closest('.button-row');
    if (welcomeActions && !node('welcomeRecoverPasswordBtn')) {
      const button = document.createElement('button');
      button.id = 'welcomeRecoverPasswordBtn';
      button.className = 'secondary';
      button.type = 'button';
      button.textContent = 'Recover encryption password';
      button.title = 'Use an optional password recovery package and its separately stored one-time code';
      welcomeActions.insertBefore(button, node('welcomeStartFreshBtn'));
    }
    const recoveryBody = node('recoveryKitModal')?.querySelector('.modal-body');
    if (recoveryBody && !node('passwordRecoveryPackageCard')) {
      const card = document.createElement('section');
      card.id = 'passwordRecoveryPackageCard';
      card.className = 'section password-recovery-card';
      card.innerHTML = `
        <h3>Recover the normal encryption password</h3>
        <p class="muted">This creates a small recovery package containing the current encryption password wrapped by a new one-time code. It is separate from the full offline recovery backup above.</p>
        <div class="button-row"><button id="createPasswordRecoveryPackageBtn" type="button">Create Password Recovery Package</button><button id="choosePasswordRecoveryPackageBtn" class="secondary" type="button">Restore Existing Package</button></div>
        <div id="passwordRecoveryCodePanel" class="password-recovery-code-panel" hidden><strong>One-time recovery code</strong><code id="passwordRecoveryCodeValue"></code><div class="button-row"><button id="copyPasswordRecoveryCodeBtn" class="secondary tiny" type="button">Copy Code</button></div><div class="warningbox">The code is shown only for this session. Keep it separate from the recovery package. Anyone with both can recover the encryption password.</div></div>
        <div id="passwordRecoveryPackageStatus" class="muted">No password recovery package created.</div>`;
      recoveryBody.appendChild(card);
    }
  }

  function settingsTitle(button) {
    return text(button.querySelector('.settings-page-title')?.textContent || button.textContent);
  }

  function refreshSortedSettingsMobileSelect(buttons) {
    const select = node('settingsMobilePageSelect');
    if (!select) return;
    const current = uiState.activeSettingsPage || select.value || buttons[0]?.dataset.settingsNav || '';
    const options = buttons.map(button => ({ value: button.dataset.settingsNav, title: settingsTitle(button) }));
    select.innerHTML = options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.title)}</option>`).join('');
    select.value = options.some(option => option.value === current) ? current : (options[0]?.value || '');
  }

  function sortSettingsNavigation() {
    const nav = node('settingsPageNav');
    if (!nav) return;
    const currentButtons = Array.from(nav.querySelectorAll('.settings-page-tab[data-settings-nav]'));
    if (!currentButtons.length) return;
    const buttons = [...currentButtons].sort((a, b) => {
      const aAbout = a.dataset.settingsNav === 'about';
      const bAbout = b.dataset.settingsNav === 'about';
      if (aAbout !== bAbout) return aAbout ? 1 : -1;
      return settingsTitle(a).localeCompare(settingsTitle(b), undefined, { sensitivity: 'base', numeric: true });
    });
    const order = buttons.map(button => button.dataset.settingsNav);
    const currentOrder = currentButtons.map(button => button.dataset.settingsNav);
    if (order.some((value, index) => value !== currentOrder[index])) buttons.forEach(button => nav.appendChild(button));
    SETTINGS_PAGE_IDS.splice(0, SETTINGS_PAGE_IDS.length, ...order);
    refreshSortedSettingsMobileSelect(buttons);
  }

  function generatorDistance(a, b) {
    return Math.hypot(Number(a?.ruleX || 0) - Number(b?.ruleX || 0), Number(a?.ruleY || 0) - Number(b?.ruleY || 0));
  }

  function requirementSeatMatch(student, seat) {
    const req = student.requirements || {};
    const zones = new Set((seat.zoneIds || []).map(String));
    const failures = [];
    if (req.front === 'require' && Number(seat.frontRatio || 0) > 0.42) failures.push('required front area');
    if (req.ada && !seat.nearAda) failures.push('ADA/accessibility area');
    if ((req.excludedZoneIds || []).some(id => zones.has(String(id)))) failures.push('excluded zone');
    return failures;
  }

  function addConflict(findings, severity, title, explanation, remedy, action = '') {
    findings.push({ id: `rule-conflict-${findings.length + 1}`, severity, title, explanation, remedy, action });
  }

  function analyzeRuleConflicts() {
    const findings = [];
    const students = studentsWithEffectiveRuleRequirements();
    const seats = ModernizationSuite.buildGeneratorSeats();
    const seatByKey = new Map(seats.map(seat => [String(seat.key), seat]));
    const studentById = new Map(students.map(student => [String(student.id), student]));
    const label = student => student ? studentDisplay(student) : 'Unknown student';
    const requiredFront = students.filter(student => student.requirements?.front === 'require');
    const requiredAda = students.filter(student => student.requirements?.ada);
    const lockedSeats = seats.filter(seat => seat.manual && seat.assignedStudentId);
    const lockedStudentIds = new Set(lockedSeats.map(seat => String(seat.assignedStudentId)));

    if (!students.length) addConflict(findings, 'info', 'No active students', 'The generator has no active students to place.', 'Add or restore a roster before generating seating options.', 'students');
    if (!seats.length) addConflict(findings, 'error', 'No usable seats', 'The current room does not contain a usable Grid or Freeform seat.', 'Add seats in Room Design before generating.', 'room');
    if (students.length > seats.length) addConflict(findings, 'error', 'Not enough seats', `${students.length} active students need seats, but the room has only ${seats.length} usable seats. At least ${students.length - seats.length} student${students.length - seats.length === 1 ? '' : 's'} cannot be assigned.`, 'Add seats, mark absent students in Today Mode, or reduce the active roster.', 'room');

    const frontSeats = seats.filter(seat => Number(seat.frontRatio || 0) <= 0.42);
    const frontDemandRemaining = requiredFront.filter(student => !lockedStudentIds.has(String(student.id))).length;
    const frontCapacityRemaining = frontSeats.filter(seat => !seat.manual || !seat.assignedStudentId).length;
    if (frontDemandRemaining > frontCapacityRemaining) addConflict(findings, 'error', 'Required front-seat capacity is too small', `${requiredFront.length} students require the front area, but locked placements and room geometry leave only ${frontCapacityRemaining} open qualifying front seats for ${frontDemandRemaining} still-unlocked students.`, 'Unlock or move a conflicting placement, add front seats, or change some requirements from Required to Preferred.', 'requirements');

    const adaSeats = seats.filter(seat => seat.nearAda);
    const adaDemandRemaining = requiredAda.filter(student => !lockedStudentIds.has(String(student.id))).length;
    const adaCapacityRemaining = adaSeats.filter(seat => !seat.manual || !seat.assignedStudentId).length;
    if (requiredAda.length && !adaSeats.length) addConflict(findings, 'error', 'No ADA/accessibility seat area exists', `${requiredAda.length} student${requiredAda.length === 1 ? '' : 's'} require an ADA/accessibility area, but no seat is near an ADA room object.`, 'Add an ADA Space near qualifying seats or revise the requirements.', 'room');
    else if (adaDemandRemaining > adaCapacityRemaining) addConflict(findings, 'error', 'ADA/accessibility capacity is too small', `${requiredAda.length} students require accessible seating, but only ${adaCapacityRemaining} open qualifying seats remain for ${adaDemandRemaining} unlocked students.`, 'Add accessible seats, move locked placements, or review the requirements.', 'requirements');

    let maximumSeatDistance = 0;
    for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) maximumSeatDistance = Math.max(maximumSeatDistance, generatorDistance(seats[i], seats[j]));

    students.forEach(student => {
      const req = student.requirements || {};
      const excluded = new Set((req.excludedZoneIds || []).map(String));
      const hasHardSeatRequirement = req.front === 'require' || Boolean(req.ada) || excluded.size > 0;
      const studentIsLocked = lockedStudentIds.has(String(student.id));
      if (hasHardSeatRequirement && !studentIsLocked) {
        const openSeats = seats.filter(seat => !seat.manual || !seat.assignedStudentId);
        const matchingSeats = openSeats.filter(seat => requirementSeatMatch(student, seat).length === 0);
        if (!matchingSeats.length) {
          const constraints = [req.front === 'require' ? 'front-area seating' : '', req.ada ? 'ADA/accessibility seating' : '', excluded.size ? `${excluded.size} excluded zone${excluded.size === 1 ? '' : 's'}` : ''].filter(Boolean);
          addConflict(findings, 'error', `${label(student)} has no seat satisfying all hard requirements`, `The available seats were checked against ${constraints.join(', ')} together, and none satisfies the complete combination. Individual capacity totals can look sufficient even when their overlap is empty.`, 'Change one hard requirement, free or add a qualifying seat, or adjust the room and zone geometry.', 'requirements');
        }
      }
      if (excluded.size) {
        const allowed = seats.filter(seat => !(seat.zoneIds || []).some(id => excluded.has(String(id))));
        if (!allowed.length) addConflict(findings, 'error', `${label(student)} has no allowed seat`, 'Every usable seat belongs to at least one zone excluded for this student.', 'Remove an excluded zone, change seat-zone membership, or add an allowed seat.', 'requirements');
        if (req.front === 'require' && !allowed.some(seat => Number(seat.frontRatio || 0) <= 0.42)) addConflict(findings, 'error', `${label(student)} has incompatible front and zone requirements`, 'No front-area seat remains after the student’s excluded zones are applied.', 'Change the excluded zones, add a front seat outside them, or relax the front requirement.', 'requirements');
      }
      (req.minDistanceStudentIds || []).forEach(otherId => {
        if (String(student.id).localeCompare(String(otherId)) >= 0) return;
        const other = studentById.get(String(otherId));
        if (!other) return;
        if (maximumSeatDistance < 3) addConflict(findings, 'error', `${label(student)} and ${label(other)} cannot reach the required distance`, `Even the two farthest usable seats are too close together to satisfy this rule.`, 'Increase room spacing in Freeform, add farther-apart Grid seats, or remove the minimum-distance rule.', 'room');
      });
    });

    lockedSeats.forEach(seat => {
      const student = studentById.get(String(seat.assignedStudentId));
      if (!student) return;
      const failures = requirementSeatMatch(student, seat);
      if (failures.length) addConflict(findings, 'error', `Locked placement conflicts with ${label(student)}`, `${seat.label} is locked but violates: ${failures.join(', ')}. Generated options preserve this placement, so the conflict cannot be repaired automatically.`, 'Unlock the seat or move the student before generating.', 'requirements');
    });

    const pairRules = new Map();
    const locationMembership = new Map();
    (state.groups || []).forEach(group => {
      const members = (group.studentIds || []).map(String).filter(id => studentById.has(id));
      if (!members.length) addConflict(findings, 'warning', `${group.name} has no active members`, 'This rule does not currently affect candidate generation.', 'Add active students to the rule or remove the unused rule.', 'rules');
      if (group.type === 'special') {
        const validAnchors = (group.anchorSeats || []).filter(key => seatByKey.has(String(key)));
        if (!validAnchors.length) addConflict(findings, 'warning', `${group.name} has no usable reserved seats`, 'The special/reserved rule has members but no anchor seat that exists in the current room.', 'Reserve seats for this rule or change its type.', 'rules');
        else if (validAnchors.length < members.length) addConflict(findings, 'warning', `${group.name} has fewer reserved seats than members`, `${members.length} active members share ${validAnchors.length} reserved seat${validAnchors.length === 1 ? '' : 's'}. Some members must be placed outside the reserved seats.`, 'Reserve more seats or reduce the rule membership.', 'rules');
      }
      if (group.type === 'zone') {
        const zone = (state.zones || []).find(item => String(item.id) === String(group.zoneId));
        if (!zone) addConflict(findings, 'error', `${group.name} references a missing zone`, 'The preferred-zone rule cannot be evaluated because its zone no longer exists.', 'Choose an existing zone or recreate the missing zone.', 'zones');
        else if (!seats.some(seat => (seat.zoneIds || []).map(String).includes(String(zone.id)))) addConflict(findings, 'warning', `${group.name} points to an empty zone`, `${zone.name} exists, but no usable seat belongs to it.`, 'Assign seats to the zone in Room Design or select another zone.', 'zones');
      }
      if (['front', 'back'].includes(group.type)) members.forEach(id => {
        if (!locationMembership.has(id)) locationMembership.set(id, new Set());
        locationMembership.get(id).add(group.type);
      });
      if (['together', 'special', 'avoid', 'spread'].includes(group.type)) {
        for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
          const key = [members[i], members[j]].sort().join('|');
          if (!pairRules.has(key)) pairRules.set(key, []);
          pairRules.get(key).push(group);
        }
      }
    });

    pairRules.forEach((rules, key) => {
      const close = rules.filter(rule => ['together', 'special'].includes(rule.type));
      const apart = rules.filter(rule => ['avoid', 'spread'].includes(rule.type));
      if (!close.length || !apart.length) return;
      const [a, b] = key.split('|').map(id => studentById.get(id));
      addConflict(findings, 'warning', `${label(a)} and ${label(b)} have opposing group rules`, `${close.map(rule => rule.name).join(', ')} asks them to sit nearby, while ${apart.map(rule => rule.name).join(', ')} asks them to sit apart. The generator must trade one rule against the other.`, 'Remove one rule, change membership, or lower the less-important rule priority.', 'rules');
    });

    locationMembership.forEach((types, studentId) => {
      if (types.has('front') && types.has('back')) {
        const student = studentById.get(studentId);
        addConflict(findings, 'warning', `${label(student)} is in both front and back rules`, 'The generator receives opposing location preferences for this student.', 'Remove the student from one location rule or lower its priority.', 'rules');
      }
    });

    const roomChecks = [
      ['nearTeacher', 'nearTeacher', 'teacherDistance', 'teacher desk'],
      ['nearBoard', '', 'boardDistance', 'board or projector'],
      ['awayDoor', 'awayDoor', 'doorDistance', 'door'],
      ['awayWindow', 'awayWindow', 'windowDistance', 'window']
    ];
    roomChecks.forEach(([groupType, requirement, distanceField, objectName]) => {
      const studentNeedActive = requirement && students.some(student => student.requirements?.[requirement]);
      const groupRuleActive = (state.groups || []).some(group => group.type === groupType && (group.studentIds || []).length);
      if (!studentNeedActive && !groupRuleActive) return;
      if (!seats.some(seat => Number(seat[distanceField]) < 999)) addConflict(findings, 'warning', `No ${objectName} object exists for an active rule`, `At least one student or group uses a rule based on the ${objectName}, but the room has no matching object. The generator cannot measure that preference meaningfully.`, `Add a ${objectName} room object or remove the related rule.`, 'room');
    });

    const rank = { error: 0, warning: 1, info: 2 };
    findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title));
    return {
      findings,
      errors: findings.filter(item => item.severity === 'error').length,
      warnings: findings.filter(item => item.severity === 'warning').length,
      info: findings.filter(item => item.severity === 'info').length,
      students: students.length,
      seats: seats.length
    };
  }

  function conflictSummaryHtml(report) {
    const status = report.errors ? 'bad' : report.warnings ? 'warn' : 'good';
    const headline = report.errors ? 'Generation has conflicts that cannot be solved automatically.' : report.warnings ? 'Generation can continue, but some rules compete or lack room support.' : 'No obvious rule-capacity conflict was found.';
    return `<div class="rule-conflict-head ${status}"><div><strong>${escapeHtml(headline)}</strong><span>${report.students} active students · ${report.seats} usable seats</span></div><div class="rule-conflict-counts"><span class="bad">${report.errors} blocking</span><span class="warn">${report.warnings} warning</span><span>${report.info} information</span></div></div>`;
  }

  function renderRuleConflictReport(report = analyzeRuleConflicts()) {
    const summary = node('ruleConflictSummary');
    const list = node('ruleConflictList');
    if (summary) summary.innerHTML = conflictSummaryHtml(report);
    if (list) list.innerHTML = report.findings.length ? report.findings.map(item => `
      <article class="rule-conflict-item ${escapeHtml(item.severity)}">
        <div class="rule-conflict-icon" aria-hidden="true">${item.severity === 'error' ? '!' : item.severity === 'warning' ? '△' : 'i'}</div>
        <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.explanation)}</p><span>${escapeHtml(item.remedy)}</span>${item.action ? `<button class="tiny secondary" type="button" data-rule-conflict-action="${escapeHtml(item.action)}">Open related tools</button>` : ''}</div>
      </article>`).join('') : '<div class="successbox">No obvious rule-capacity or contradictory-rule conflict was found. Candidate generation may still trade soft preferences against one another.</div>';
    const generate = node('ruleConflictGenerateAnywayBtn');
    if (generate) {
      generate.hidden = !pendingGenerationMode;
      generate.textContent = report.errors ? 'Generate Anyway With Conflicts' : 'Continue to Generate';
    }
    return report;
  }

  function openRuleConflictInspector(options = {}) {
    if (options.pendingMode) pendingGenerationMode = options.pendingMode;
    renderRuleConflictReport();
    node('ruleConflictModal')?.classList.add('show');
    DialogManager.synchronize();
  }

  function closeRuleConflictInspector() {
    node('ruleConflictModal')?.classList.remove('show');
    pendingGenerationMode = '';
    DialogManager.synchronize();
  }

  function openConflictTools(action) {
    closeRuleConflictInspector();
    if (action === 'room') ProductExperience?.setWorkflow?.('room');
    else {
      ProductExperience?.setWorkflow?.('setup');
      const section = action === 'requirements' ? 'requirements' : action === 'zones' ? 'zones' : action === 'students' ? 'students' : 'rules';
      ClassSetupWorkspaceV54?.setSection?.(section);
    }
  }

  function candidateRuleContextHtml() {
    const report = analyzeRuleConflicts();
    if (!report.findings.length) return '<section class="candidate-preflight-context good"><strong>Pre-generation feasibility</strong><span>No obvious capacity or contradictory-rule conflict was detected.</span><button class="tiny secondary" type="button" data-open-rule-conflict-inspector>Review rule check</button></section>';
    const top = report.findings.slice(0, 3);
    return `<section class="candidate-preflight-context ${report.errors ? 'bad' : 'warn'}"><div><strong>Pre-generation feasibility: ${report.errors} blocking, ${report.warnings} warning</strong><span>${escapeHtml(top.map(item => item.title).join(' · '))}${report.findings.length > top.length ? ` · ${report.findings.length - top.length} more` : ''}</span></div><button class="tiny secondary" type="button" data-open-rule-conflict-inspector>Explain conflicts</button></section>`;
  }

  function decorateCandidateDetail() {
    const detail = node('seatingCandidateDetail');
    if (!detail || !detail.innerHTML || detail.querySelector('.candidate-preflight-context')) return;
    detail.insertAdjacentHTML('afterbegin', candidateRuleContextHtml());
  }

  function interceptGeneratorButton(button, mode) {
    button?.addEventListener('click', event => {
      const report = analyzeRuleConflicts();
      if (!report.errors) {
        if (report.warnings) setLiveStatusMessage(`Rule check found ${report.warnings} warning${report.warnings === 1 ? '' : 's'}. Generation will compare the tradeoffs in each option.`);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      pendingGenerationMode = mode;
      openRuleConflictInspector({ pendingMode: mode });
    }, true);
  }

  function classStudentKey(student) {
    const id = text(student?.id);
    const source = text(student?.sourceUserId);
    const name = `${text(student?.firstName).toLowerCase()}|${text(student?.lastName).toLowerCase()}`;
    return { id, source, name };
  }

  function buildUniqueStudentIndex(students, selector) {
    const buckets = new Map();
    students.forEach(student => {
      const key = text(selector(student));
      if (!key) return;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(student);
    });
    return new Map(Array.from(buckets.entries()).filter(([, values]) => values.length === 1).map(([key, values]) => [key, values[0]]));
  }

  function buildStudentMatch(sourceStudents, targetStudents) {
    const byId = buildUniqueStudentIndex(targetStudents, student => student.id);
    const bySource = buildUniqueStudentIndex(targetStudents, student => student.sourceUserId);
    const byName = buildUniqueStudentIndex(targetStudents, student => classStudentKey(student).name === '|' ? '' : classStudentKey(student).name);
    const map = new Map();
    const matchedTargetIds = new Set();
    sourceStudents.forEach(source => {
      const key = classStudentKey(source);
      const candidates = [key.id && byId.get(key.id), key.source && bySource.get(key.source), key.name !== '|' && byName.get(key.name)].filter(Boolean);
      const target = candidates.find(candidate => !matchedTargetIds.has(String(candidate.id))) || null;
      if (target) {
        map.set(String(source.id), String(target.id));
        matchedTargetIds.add(String(target.id));
      }
    });
    return { map, matchedTargetIds };
  }

  function mergeSourceOptions() {
    const targetId = String(state.activeClassId || '');
    const current = (state.classes || []).filter(item => String(item.id) !== targetId).map(item => ({ value: `class:${item.id}`, label: `${item.name} · current save`, classRecord: item }));
    const external = classMergeExternalClasses.map((item, index) => ({ value: `file:${index}`, label: `${item.name} · loaded file`, classRecord: item }));
    return [...current, ...external];
  }

  function selectedMergeSource() {
    const value = node('classMergeSourceSelect')?.value || '';
    if (value.startsWith('class:')) return (state.classes || []).find(item => String(item.id) === value.slice(6)) || null;
    if (value.startsWith('file:')) return classMergeExternalClasses[Number(value.slice(5))] || null;
    return null;
  }

  function renderClassMergeSources(preferred = '') {
    persistActiveClass();
    const select = node('classMergeSourceSelect');
    if (!select) return;
    const options = mergeSourceOptions();
    select.innerHTML = options.length ? options.map(item => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join('') : '<option value="">No source class available</option>';
    if (preferred && options.some(item => item.value === preferred)) select.value = preferred;
    currentMergeSourceLabel = select.selectedOptions?.[0]?.textContent || '';
    renderClassMergeComparison();
  }

  function countAssignments(cls) {
    const grid = Object.values(cls.cells || {}).filter(cell => cell?.assignedStudentId).length;
    const freeform = (cls.freeformLayout?.objects || []).filter(item => item.type === 'seat' && item.assignedStudentId).length;
    return Math.max(grid, freeform);
  }

  function classComparisonRows(target, source) {
    const match = buildStudentMatch(source.students || [], target.students || []);
    const targetById = new Map((target.students || []).map(student => [String(student.id), student]));
    let fieldChanges = 0;
    let noteChanges = 0;
    let requirementChanges = 0;
    (source.students || []).forEach(sourceStudent => {
      const targetId = match.map.get(String(sourceStudent.id));
      const targetStudent = targetById.get(String(targetId || ''));
      if (!targetStudent) return;
      if (['firstName', 'lastName', 'nickName', 'grade', 'sourceSystem', 'sourceCourseId', 'sourceUserId'].some(key => text(sourceStudent[key]) !== text(targetStudent[key]))) fieldChanges += 1;
      if (!same([sourceStudent.notesPrivate, sourceStudent.notesSubstitute, sourceStudent.notesPublic], [targetStudent.notesPrivate, targetStudent.notesSubstitute, targetStudent.notesPublic])) noteChanges += 1;
      if (!same(sourceStudent.requirements, targetStudent.requirements)) requirementChanges += 1;
    });
    const sourceOnly = (source.students || []).length - match.map.size;
    const targetOnly = (target.students || []).length - match.matchedTargetIds.size;
    return [
      ['Roster', `${target.students.length} students`, `${source.students.length} students`, `${match.map.size} matched · ${sourceOnly} source-only · ${targetOnly} current-only · ${fieldChanges} field changes`],
      ['Notes', `${target.students.filter(student => student.notesPrivate || student.notesSubstitute || student.notesPublic).length} students with notes`, `${source.students.filter(student => student.notesPrivate || student.notesSubstitute || student.notesPublic).length} students with notes`, `${noteChanges} matched students differ`],
      ['Student needs', `${target.students.filter(student => !same(student.requirements, normalizeStudent({}).requirements)).length} configured`, `${source.students.filter(student => !same(student.requirements, normalizeStudent({}).requirements)).length} configured`, `${requirementChanges} matched students differ`],
      ['Groups & rules', `${target.groups.length} rules`, `${source.groups.length} rules`, same(target.groups, source.groups) ? 'No structural difference' : 'Rule definitions differ'],
      ['Zones', `${target.zones.length} zones`, `${source.zones.length} zones`, same(target.zones, source.zones) ? 'No structural difference' : 'Zone definitions or memberships differ'],
      ['Room', `${target.layoutMode} · ${target.rows}×${target.cols}`, `${source.layoutMode} · ${source.rows}×${source.cols}`, same([target.rows, target.cols, target.layoutMode, target.cells, target.freeformLayout, target.customObjects], [source.rows, source.cols, source.layoutMode, source.cells, source.freeformLayout, source.customObjects]) ? 'No structural difference' : 'Room layout differs'],
      ['Assignments', `${countAssignments(target)} placed`, `${countAssignments(source)} placed`, countAssignments(target) === countAssignments(source) ? 'Counts match; positions may still differ' : 'Placed-student counts differ'],
      ['Named plans', `${target.seatingPlans.length} plans`, `${source.seatingPlans.length} plans`, same(target.seatingPlans, source.seatingPlans) ? 'No structural difference' : 'Plan history differs']
    ];
  }

  function renderClassMergeComparison() {
    const box = node('classMergeComparison');
    const status = node('classMergeSourceStatus');
    const source = selectedMergeSource();
    const target = normalizeClassRecord(activeClassRecord());
    if (!box) return;
    if (!source) {
      box.innerHTML = '<div class="restore-empty">Choose another class or load a classes file to compare.</div>';
      if (status) status.textContent = classMergeExternalClasses.length ? 'Choose a loaded class.' : 'No other class is available in the current save. Load a classes file to continue.';
      return;
    }
    const normalizedSource = normalizeClassRecord(source);
    const rows = classComparisonRows(target, normalizedSource);
    box.innerHTML = `<div class="class-merge-summary"><strong>Current: ${escapeHtml(target.name)}</strong><span>Source: ${escapeHtml(normalizedSource.name)}</span></div><div class="csv-preview-table"><table><thead><tr><th>Category</th><th>Current</th><th>Source</th><th>Difference</th></tr></thead><tbody>${rows.map(row => `<tr><th>${escapeHtml(row[0])}</th><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}</td><td>${escapeHtml(row[3])}</td></tr>`).join('')}</tbody></table></div>`;
    if (status) status.textContent = `Comparing ${normalizedSource.name} with the current class. Nothing changes until Apply Selected Merge is confirmed.`;
  }

  function openClassMerge() {
    classMergeExternalClasses = [];
    node('classToolsModal')?.classList.remove('show');
    renderClassMergeSources();
    node('classMergeModal')?.classList.add('show');
    DialogManager.synchronize();
  }

  function closeClassMerge() {
    node('classMergeModal')?.classList.remove('show');
    classMergeExternalClasses = [];
    DialogManager.synchronize();
  }

  function mergeCategories() {
    return Object.fromEntries(Array.from(document.querySelectorAll('[data-class-merge-category]')).map(input => [input.dataset.classMergeCategory, Boolean(input.checked)]));
  }

  function sourceStudentToMergedId(sourceStudent, mapping, mergedStudents) {
    const existing = mapping.get(String(sourceStudent.id));
    if (existing) return existing;
    let nextId = String(sourceStudent.id || uid('student'));
    const used = new Set(mergedStudents.map(student => String(student.id)));
    if (used.has(nextId)) nextId = uid('student');
    mapping.set(String(sourceStudent.id), nextId);
    return nextId;
  }

  function applyStudentCategory(targetStudent, sourceStudent, categories, sourceWins) {
    const next = deepClone(targetStudent);
    const emptyValue = value => value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length) || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length);
    const copy = (field, allowBlank = false) => {
      const sourceValue = sourceStudent[field];
      if (sourceWins ? (allowBlank || sourceValue !== undefined) : emptyValue(next[field])) next[field] = deepClone(sourceValue);
    };
    if (categories.roster) {
      ['firstName', 'lastName', 'nickName', 'grade', 'archived', 'sourceSystem', 'sourceCourseId', 'sourceUserId', 'sourceIdentifiers'].forEach(field => copy(field, true));
    }
    if (categories.notes) {
      ['notesPrivate', 'notesSubstitute', 'notesPublic', 'noteCategories'].forEach(field => copy(field, true));
    }
    if (categories.requirements) copy('requirements', true);
    return normalizeStudent({ ...next, id: targetStudent.id });
  }

  function remapClassAssignments(record, studentMap) {
    const next = deepClone(record);
    Object.values(next.cells || {}).forEach(cell => {
      if (!cell.assignedStudentId) return;
      cell.assignedStudentId = studentMap.get(String(cell.assignedStudentId)) || null;
      if (!cell.assignedStudentId) cell.manual = false;
    });
    (next.freeformLayout?.objects || []).forEach(item => {
      if (item.type !== 'seat' || !item.assignedStudentId) return;
      item.assignedStudentId = studentMap.get(String(item.assignedStudentId)) || null;
      if (!item.assignedStudentId) { item.manual = false; item.locked = false; }
    });
    return next;
  }

  function clearClassAssignments(record) {
    Object.values(record.cells || {}).forEach(cell => { cell.assignedStudentId = null; cell.manual = false; });
    (record.freeformLayout?.objects || []).forEach(item => { if (item.type === 'seat') { item.assignedStudentId = null; item.manual = false; item.locked = false; } });
  }

  function applySourceAssignmentsToExistingRoom(merged, source, studentMap) {
    clearClassAssignments(merged);
    Object.entries(source.cells || {}).forEach(([key, sourceCell]) => {
      const targetCell = merged.cells?.[key];
      if (!targetCell || targetCell.type !== 'seat' || !sourceCell.assignedStudentId) return;
      targetCell.assignedStudentId = studentMap.get(String(sourceCell.assignedStudentId)) || null;
      targetCell.manual = Boolean(targetCell.assignedStudentId && sourceCell.manual);
    });
    const sourceFreeByKey = new Map((source.freeformLayout?.objects || []).filter(item => item.type === 'seat').map(item => [String(item.cellKey || item.id), item]));
    (merged.freeformLayout?.objects || []).filter(item => item.type === 'seat').forEach(targetSeat => {
      const sourceSeat = sourceFreeByKey.get(String(targetSeat.cellKey || targetSeat.id));
      if (!sourceSeat?.assignedStudentId) return;
      targetSeat.assignedStudentId = studentMap.get(String(sourceSeat.assignedStudentId)) || null;
      targetSeat.manual = Boolean(targetSeat.assignedStudentId && sourceSeat.manual);
      targetSeat.locked = Boolean(targetSeat.assignedStudentId && sourceSeat.locked);
    });
  }

  function mergeClassRecords(targetRecord, sourceRecord, categories, options = {}) {
    const target = normalizeClassRecord(deepClone(targetRecord));
    const source = normalizeClassRecord(deepClone(sourceRecord));
    const sourceWins = options.sourceWins !== false;
    const rosterMode = options.rosterMode === 'replace' ? 'replace' : 'merge';
    const initialMatch = buildStudentMatch(source.students, target.students);
    const studentMap = new Map(initialMatch.map);
    let mergedStudents = rosterMode === 'replace' && categories.roster ? [] : target.students.map(student => deepClone(student));
    const mergedById = () => new Map(mergedStudents.map(student => [String(student.id), student]));

    source.students.forEach(sourceStudent => {
      let targetId = studentMap.get(String(sourceStudent.id));
      let targetStudent = targetId ? mergedById().get(String(targetId)) : null;
      if (!targetStudent && categories.roster) {
        targetId = sourceStudentToMergedId(sourceStudent, studentMap, mergedStudents);
        targetStudent = normalizeStudent({ ...deepClone(sourceStudent), id: targetId });
        mergedStudents.push(targetStudent);
      }
      if (!targetStudent) return;
      const updated = applyStudentCategory(targetStudent, sourceStudent, categories, sourceWins);
      const index = mergedStudents.findIndex(student => String(student.id) === String(targetStudent.id));
      if (index >= 0) mergedStudents[index] = updated;
    });
    target.students = mergedStudents.map(normalizeStudent);

    if (categories.rules) {
      target.groups = source.groups.map((group, index) => normalizeGroupRecord({ ...deepClone(group), studentIds: (group.studentIds || []).map(id => studentMap.get(String(id))).filter(Boolean) }, index));
    }
    if (categories.zones) {
      target.zones = source.zones.map((zone, index) => normalizeZoneRecord({ ...deepClone(zone), studentIds: (zone.studentIds || []).map(id => studentMap.get(String(id))).filter(Boolean) }, index));
    }
    if (categories.room) {
      target.rows = source.rows;
      target.cols = source.cols;
      target.cells = deepClone(source.cells);
      target.layoutMode = source.layoutMode;
      target.freeformLayout = deepClone(source.freeformLayout);
      target.customObjects = deepClone(source.customObjects);
      if (!categories.rules) {
        Object.values(target.cells || {}).forEach(cell => { cell.anchorGroupIds = []; });
        (target.freeformLayout?.objects || []).forEach(item => { if (item.type === 'seat') item.anchorGroupIds = []; });
      }
      if (!categories.zones) {
        Object.values(target.cells || {}).forEach(cell => { cell.zoneIds = []; });
        (target.freeformLayout?.objects || []).forEach(item => { if (item.type === 'seat') item.zoneIds = []; });
      }
    } else if (categories.zones) {
      Object.values(target.cells || {}).forEach(cell => { cell.zoneIds = []; });
      Object.entries(source.cells || {}).forEach(([key, sourceCell]) => { if (target.cells?.[key]) target.cells[key].zoneIds = deepClone(sourceCell.zoneIds || []); });
      const sourceFreeByKey = new Map((source.freeformLayout?.objects || []).filter(item => item.type === 'seat').map(item => [String(item.cellKey || item.id), item]));
      (target.freeformLayout?.objects || []).filter(item => item.type === 'seat').forEach(item => { item.zoneIds = deepClone(sourceFreeByKey.get(String(item.cellKey || item.id))?.zoneIds || []); });
    }

    if (categories.assignments) {
      if (categories.room) {
        const remapped = remapClassAssignments(target, studentMap);
        target.cells = remapped.cells;
        target.freeformLayout = remapped.freeformLayout;
      } else applySourceAssignmentsToExistingRoom(target, source, studentMap);
    } else if (categories.room) clearClassAssignments(target);

    if (categories.rules && !categories.room) {
      const validSeats = new Set(Object.entries(target.cells || {}).filter(([, cell]) => cell.type === 'seat').map(([key]) => String(key)));
      (target.freeformLayout?.objects || []).filter(item => item.type === 'seat').forEach(item => validSeats.add(String(item.cellKey || item.id)));
      target.groups.forEach(group => { group.anchorSeats = (group.anchorSeats || []).filter(key => validSeats.has(String(key))); });
    }

    if (categories.plans) {
      const existing = new Map(target.seatingPlans.map(plan => [String(plan.id), plan]));
      source.seatingPlans.map(plan => remapClassAssignments(normalizeSeatingPlan(plan), studentMap)).forEach(plan => existing.set(String(plan.id), normalizeSeatingPlan(plan)));
      target.seatingPlans = Array.from(existing.values());
    }
    if (categories.details) {
      target.chartMeta = deepClone(source.chartMeta);
      target.academicYear = source.academicYear;
      target.term = source.term;
    }
    target.id = targetRecord.id;
    target.name = targetRecord.name;
    target.updatedAt = new Date().toISOString();
    return normalizeClassRecord(target);
  }

  function requestClassMerge() {
    const source = selectedMergeSource();
    if (!source) {
      setLiveStatusMessage('Choose a source class before merging.');
      return;
    }
    const categories = mergeCategories();
    const selected = Object.entries(categories).filter(([, enabled]) => enabled).map(([name]) => name);
    if (!selected.length) {
      setLiveStatusMessage('Select at least one category to merge.');
      return;
    }
    const rosterMode = node('classMergeRosterMode')?.value === 'replace' && categories.roster ? ' The current roster will be replaced by the source roster.' : '';
    const snapshot = node('classMergeSnapshotBefore')?.checked ? ' An encrypted restore snapshot will be created first.' : ' No encrypted restore snapshot was requested.';
    showInAppConfirm(
      `Merge ${selected.join(', ')} from “${source.name}” into the current class?${rosterMode}${snapshot}`,
      () => void applyClassMerge(),
      { title: 'Apply Class Merge?', confirmText: 'Apply Merge', cancelText: 'Review Again' }
    );
  }

  async function applyClassMerge() {
    const source = selectedMergeSource();
    if (!source) {
      setLiveStatusMessage('Choose a source class before merging.');
      return;
    }
    const categories = mergeCategories();
    if (!Object.values(categories).some(Boolean)) {
      setLiveStatusMessage('Select at least one category to merge.');
      return;
    }
    persistActiveClass();
    const target = normalizeClassRecord(activeClassRecord());
    const sourceRecord = normalizeClassRecord(source);
    const sourceLabel = currentMergeSourceLabel || sourceRecord.name;
    const beforeClasses = deepClone(state.classes || []);
    const beforeActiveId = state.activeClassId;
    const snapshotRequested = Boolean(node('classMergeSnapshotBefore')?.checked);
    let snapshotCreated = false;
    let commitStarted = false;
    try {
      const merged = mergeClassRecords(target, sourceRecord, categories, {
        rosterMode: node('classMergeRosterMode')?.value,
        sourceWins: Boolean(node('classMergeSourceWins')?.checked)
      });
      if (snapshotRequested) {
        await createAppSnapshotWithName(`Before class merge from ${sourceRecord.name} - ${new Date().toLocaleString()}`, { silent: true, reason: 'before-class-merge' });
        snapshotCreated = true;
      }
      pushUndoSnapshot('Before class comparison merge');
      const index = state.classes.findIndex(item => String(item.id) === String(target.id));
      if (index < 0) throw new Error('The destination class is no longer available.');
      commitStarted = true;
      state.classes[index] = merged;
      state.activeClassId = merged.id;
      applyClassToState(merged.id);
      renderAll();
      closeClassMerge();
      setLiveStatusMessage(`Merged selected categories from ${sourceRecord.name} into ${target.name}. A restore point was ${snapshotCreated ? 'created' : 'not requested'}.`);
    } catch (error) {
      if (commitStarted) {
        state.classes = beforeClasses.map(normalizeClassRecord);
        state.activeClassId = beforeActiveId;
        applyClassToState(beforeActiveId);
        renderAll();
      }
      reportFailure({
        operation: 'Compare & Merge Class',
        source: sourceLabel,
        error,
        dataChanged: false,
        snapshotCreated,
        remedy: 'The destination class was restored to its pre-merge state. Review the selected categories and source class, then retry.',
        retry: () => applyClassMerge()
      });
    }
  }

  async function loadClassMergeFile(file) {
    if (!file) return;
    try {
      const payload = await readTextFileWithinLimits(file, `class merge file ${file.name}`, IMPORT_LIMITS.saveBytes);
      const { parsed } = await parseSupportedPayloadText(payload, `class merge file ${file.name}`);
      classMergeExternalClasses = parsed.classes.map(normalizeClassRecord);
      renderClassMergeSources(classMergeExternalClasses.length ? 'file:0' : '');
      const status = node('classMergeSourceStatus');
      if (status) status.textContent = `Loaded ${classMergeExternalClasses.length} class${classMergeExternalClasses.length === 1 ? '' : 'es'} from ${file.name}. Choose a source and review the comparison.`;
    } catch (error) {
      reportFailure({ operation: 'Load Class Merge File', source: file.name, error, dataChanged: false, snapshotCreated: false, remedy: 'Use a current schema-compatible encrypted or plain Classroom Seating Planner classes file.', retry: () => loadClassMergeFile(file) });
    } finally {
      if (node('classMergeFileInput')) node('classMergeFileInput').value = '';
    }
  }

  function generatedRecoveryCode() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('').match(/.{1,8}/g).join('-').toUpperCase();
  }

  function normalizeRecoveryCode(value) {
    return String(value || '').replace(/[^a-fA-F0-9]/g, '').toLowerCase();
  }

  async function createPasswordRecoveryPackage() {
    const status = node('passwordRecoveryPackageStatus');
    const settingsStatus = node('passwordRecoverySettingsStatus');
    const activeKey = currentSessionEncryptionKey();
    try {
      if (!activeKey) throw new Error('Set or unlock the current encryption password before creating a password recovery package.');
      if (!window.crypto?.subtle) throw new Error('This browser does not support the required Web Crypto functions.');
      if (status) status.textContent = 'Validating the active password and creating the recovery package…';
      const stored = await BrowserDataStore.getPrimarySaveDetailed();
      if (stored.status === 'ok' && stored.payload) {
        const storedDocument = JSON.parse(stored.payload);
        if (storedDocument?.encrypted) {
          await decryptTextEnvelope(storedDocument, activeKey);
        }
      }
      const recoveryCode = generatedRecoveryCode();
      const normalizedCode = normalizeRecoveryCode(recoveryCode);
      const wrappedText = await encryptTextWithSecret(activeKey, normalizedCode, PASSWORD_RECOVERY_KIND, {
        payloadKind: PASSWORD_RECOVERY_KIND,
        recoveryFormat: PASSWORD_RECOVERY_FORMAT,
        createdAt: new Date().toISOString()
      });
      const parsed = JSON.parse(wrappedText);
      const verification = await decryptTextEnvelope(parsed, normalizedCode);
      if (verification !== activeKey) throw new Error('The recovery package verification failed before download.');
      const date = new Date().toISOString().slice(0, 10);
      downloadText(`classroom-seating-planner-password-recovery-${date}.json`, wrappedText, 'application/json');
      downloadText(`classroom-seating-planner-password-recovery-code-${date}.txt`, `Classroom Seating Planner Encryption Password Recovery Code\n\n${recoveryCode}\n\nStore this code separately from the password recovery package. Anyone with both can recover the planner encryption password. Test the package before relying on it.\n`, 'text/plain');
      const panel = node('passwordRecoveryCodePanel');
      const codeNode = node('passwordRecoveryCodeValue');
      if (panel) panel.hidden = false;
      if (codeNode) codeNode.textContent = recoveryCode;
      if (status) status.textContent = 'Recovery package self-test passed. Package and code downloads were requested; confirm both files exist and store them separately.';
      if (settingsStatus) settingsStatus.textContent = 'A password recovery package was created and verified in this session.';
    } catch (error) {
      if (status) status.textContent = `Password recovery package failed: ${error.message}`;
      if (settingsStatus) settingsStatus.textContent = `Recovery package failed: ${error.message}`;
      reportFailure({ operation: 'Create Encryption Password Recovery Package', source: 'current session encryption password', error, dataChanged: false, snapshotCreated: false, remedy: 'Unlock the current encryption password, confirm Web Crypto is available, and retry.' });
    }
  }

  function closePasswordRecoveryRestore() {
    node('passwordRecoveryRestoreModal')?.classList.remove('show');
    pendingPasswordRecoveryFile = null;
    const input = node('passwordRecoveryCodeInput');
    if (input) input.value = '';
    const errorBox = node('passwordRecoveryRestoreError');
    if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }
    DialogManager.synchronize();
  }

  async function preparePasswordRecoveryRestore(file) {
    if (!file) return;
    try {
      const raw = await readTextFileWithinLimits(file, 'password recovery package', 2 * 1024 * 1024);
      const parsed = JSON.parse(raw);
      assertSupportedEncryptedEnvelope(parsed, 'password recovery package', PASSWORD_RECOVERY_KIND);
      if (parsed.recoveryFormat !== PASSWORD_RECOVERY_FORMAT || parsed.payloadKind !== PASSWORD_RECOVERY_KIND) throw new Error('The selected file is not a supported encryption password recovery package.');
      pendingPasswordRecoveryFile = file;
      const label = node('passwordRecoveryRestoreFile');
      if (label) label.textContent = `Package: ${file.name}. Enter the separately stored one-time recovery code.`;
      const errorBox = node('passwordRecoveryRestoreError');
      if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }
      node('passwordRecoveryRestoreModal')?.classList.add('show');
      DialogManager.synchronize();
      setTimeout(() => node('passwordRecoveryCodeInput')?.focus(), 0);
    } catch (error) {
      reportFailure({ operation: 'Open Encryption Password Recovery Package', source: file.name, error, dataChanged: false, snapshotCreated: false, remedy: 'Choose a password recovery package created by this application. A full offline recovery kit is a different file type.', retry: () => preparePasswordRecoveryRestore(file) });
    } finally {
      if (node('passwordRecoveryPackageInput')) node('passwordRecoveryPackageInput').value = '';
    }
  }

  async function restorePasswordRecoveryPackage(file = pendingPasswordRecoveryFile, enteredCode = node('passwordRecoveryCodeInput')?.value || '') {
    if (!file) return;
    const errorBox = node('passwordRecoveryRestoreError');
    try {
      const normalizedCode = normalizeRecoveryCode(enteredCode);
      if (normalizedCode.length !== 48) throw new Error('Enter the complete one-time recovery code from the separate code file.');
      const raw = await readTextFileWithinLimits(file, 'password recovery package', 2 * 1024 * 1024);
      const parsed = JSON.parse(raw);
      assertSupportedEncryptedEnvelope(parsed, 'password recovery package', PASSWORD_RECOVERY_KIND);
      if (parsed.recoveryFormat !== PASSWORD_RECOVERY_FORMAT || parsed.payloadKind !== PASSWORD_RECOVERY_KIND) throw new Error('The selected file is not a supported encryption password recovery package.');
      const recoveredKey = await decryptTextEnvelope(parsed, normalizedCode);
      if (!recoveredKey) throw new Error('The password recovery package did not contain a usable encryption password.');
      setSessionEncryptionKey(recoveredKey);
      let validation = 'The recovered password is active for this session.';
      const stored = await BrowserDataStore.getPrimarySaveDetailed();
      if (stored.status === 'ok' && stored.payload) {
        try {
          const storedParsed = JSON.parse(stored.payload);
          if (storedParsed?.encrypted) {
            await decryptTextEnvelope(storedParsed, recoveredKey);
            validation = 'The recovered password successfully unlocked the current encrypted browser save and is active for this session.';
          }
        } catch (_) {
          validation = 'The package was valid, but the recovered password did not match the current browser save. It may belong to another downloaded save.';
        }
      }
      const status = node('passwordRecoveryPackageStatus');
      const settingsStatus = node('passwordRecoverySettingsStatus');
      if (StartupRecoveryV45.hasPendingSave()) {
        const welcomeInput = node('welcomeEncryptionKeyInput');
        if (welcomeInput) welcomeInput.value = recoveredKey;
        const unlocked = await StartupRecoveryV45.handlePrimaryAction();
        if (!unlocked) {
          clearSessionEncryptionKeyFromMemory();
          throw new Error('The package was valid, but the recovered password did not unlock the browser save currently waiting at startup. The package may belong to another save.');
        }
        validation = 'The recovery package unlocked and restored the encrypted browser save. The recovered password is active for this session.';
      }
      if (status) status.textContent = validation;
      if (settingsStatus) settingsStatus.textContent = validation;
      closePasswordRecoveryRestore();
      setLiveStatusMessage(validation);
    } catch (error) {
      if (errorBox) { errorBox.hidden = false; errorBox.textContent = error.message; }
      reportFailure({ operation: 'Restore Encryption Password Recovery Package', source: file.name, error, dataChanged: false, snapshotCreated: false, remedy: 'Verify that the package and one-time recovery code are the matching pair. Capitalization and dashes in the code are ignored.', retry: () => preparePasswordRecoveryRestore(file) });
    }
  }

  function failureCode(operation, error) {
    const base = text(error?.code || error?.name || 'ERROR').replace(/[^A-Z0-9]+/gi, '-').toUpperCase();
    const op = text(operation).replace(/[^A-Z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase().slice(0, 28) || 'OPERATION';
    return `${op}-${base}-${String(++failureSequence).padStart(3, '0')}`;
  }

  function reportFailure(options = {}) {
    const error = options.error instanceof Error ? options.error : new Error(text(options.error) || 'Unknown operation failure.');
    const record = {
      id: uid('operation-failure'),
      time: new Date().toISOString(),
      operation: text(options.operation) || 'Operation',
      source: text(options.source) || 'Not specified',
      message: text(error.message) || 'The operation failed.',
      code: options.code || failureCode(options.operation, error),
      dataChanged: Boolean(options.dataChanged),
      snapshotCreated: Boolean(options.snapshotCreated),
      rejectedRows: Array.isArray(options.rejectedRows) ? deepClone(options.rejectedRows).slice(0, 5000) : [],
      remedy: text(options.remedy) || 'Review the message, confirm the source data and connection, then retry.',
      retry: typeof options.retry === 'function' ? options.retry : null
    };
    failureRecords.unshift(record);
    if (failureRecords.length > MAX_FAILURE_RECORDS) failureRecords.length = MAX_FAILURE_RECORDS;
    renderOperationRecovery(record);
    node('operationRecoveryModal')?.classList.add('show');
    DialogManager.synchronize();
    setLiveStatusMessage(`${record.operation} failed. Opened the Recovery Center with code ${record.code}.`);
    return record;
  }

  function supportReport(record) {
    return [
      `Classroom Seating Planner ${APP_REVISION}`,
      `Operation: ${record.operation}`,
      `Time: ${record.time}`,
      `Source label: ${record.source}`,
      `Failure code: ${record.code}`,
      `Message: ${record.message}`,
      `Data changed: ${record.dataChanged ? 'yes' : 'no'}`,
      `Recovery snapshot created: ${record.snapshotCreated ? 'yes' : 'no'}`,
      `Rejected row count: ${record.rejectedRows.length}`,
      `Suggested remedy: ${record.remedy}`,
      `Browser: ${navigator.userAgent}`,
      '',
      'This report excludes student records, notes, OAuth tokens, passwords, encryption keys, and rejected-row contents.'
    ].join('\n');
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  function spreadsheetSafeCsvValue(value) {
    const text = String(value ?? '');
    return /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
  }

  function rejectedRowsCsv(record) {
    const rows = record.rejectedRows || [];
    const headers = Array.from(new Set(rows.flatMap(item => Object.keys(item || {}))));
    if (!headers.length) return 'reason\nNo rejected-row details were recorded.\n';
    const quote = value => `"${spreadsheetSafeCsvValue(value).replace(/"/g, '""')}"`;
    return [headers.map(quote).join(','), ...rows.map(row => headers.map(header => quote(row?.[header])).join(','))].join('\n');
  }

  function renderOperationRecovery(current = failureRecords[0] || null) {
    const currentBox = node('operationRecoveryCurrent');
    const history = node('operationRecoveryHistory');
    if (currentBox) currentBox.innerHTML = current ? `
      <section class="operation-recovery-current">
        <div class="operation-recovery-heading"><div><span class="candidate-option-kicker">${escapeHtml(new Date(current.time).toLocaleString())}</span><h3>${escapeHtml(current.operation)}</h3></div><span class="save-method-badge bad">${escapeHtml(current.code)}</span></div>
        <div class="save-health-grid compact"><div class="save-health-card"><strong>Source</strong><span>${escapeHtml(current.source)}</span></div><div class="save-health-card"><strong>Data changed</strong><span>${current.dataChanged ? 'Possibly. Review the operation result.' : 'No change was committed.'}</span></div><div class="save-health-card"><strong>Recovery snapshot</strong><span>${current.snapshotCreated ? 'Created or requested.' : 'Not created.'}</span></div><div class="save-health-card"><strong>Rejected rows</strong><span>${current.rejectedRows.length}</span></div></div>
        <div class="warningbox"><strong>${escapeHtml(current.message)}</strong><br>${escapeHtml(current.remedy)}</div>
        <div class="button-row"><button class="secondary" type="button" data-operation-copy="${escapeHtml(current.id)}">Copy Safe Report</button>${current.retry ? `<button type="button" data-operation-retry="${escapeHtml(current.id)}">Retry Operation</button>` : ''}${current.rejectedRows.length ? `<button class="secondary" type="button" data-operation-rejected="${escapeHtml(current.id)}">Download Rejected Rows</button>` : ''}</div>
      </section>` : '<div class="successbox">No import or integration failure has been recorded in this page session.</div>';
    if (history) history.innerHTML = failureRecords.length ? failureRecords.map(record => `<button type="button" class="operation-recovery-history-row" data-operation-open="${escapeHtml(record.id)}"><span><strong>${escapeHtml(record.operation)}</strong><small>${escapeHtml(new Date(record.time).toLocaleString())} · ${escapeHtml(record.source)}</small></span><b>${escapeHtml(record.code)}</b></button>`).join('') : '<div class="restore-empty">No recent failures.</div>';
  }

  function openOperationRecovery(record = failureRecords[0] || null) {
    renderOperationRecovery(record);
    node('operationRecoveryModal')?.classList.add('show');
    DialogManager.synchronize();
  }

  function operationRecord(id) {
    return failureRecords.find(record => String(record.id) === String(id));
  }

  function installEvents() {
    node('ruleConflictInspectorBtn')?.addEventListener('click', () => openRuleConflictInspector());
    node('closeRuleConflictBtn')?.addEventListener('click', closeRuleConflictInspector);
    node('ruleConflictCloseBottomBtn')?.addEventListener('click', closeRuleConflictInspector);
    node('ruleConflictRecheckBtn')?.addEventListener('click', () => renderRuleConflictReport());
    node('ruleConflictGenerateAnywayBtn')?.addEventListener('click', () => {
      const mode = pendingGenerationMode || 'generate';
      closeRuleConflictInspector();
      ModernizationSuite.startCandidateGeneration(mode);
    });
    node('ruleConflictList')?.addEventListener('click', event => {
      const button = event.target.closest('[data-rule-conflict-action]');
      if (button) openConflictTools(button.dataset.ruleConflictAction);
    });
    document.addEventListener('click', event => {
      if (event.target.closest('[data-open-rule-conflict-inspector]')) openRuleConflictInspector();
    });
    interceptGeneratorButton(node('generateBtn'), 'generate');
    interceptGeneratorButton(node('randomizeAllBtn'), 'randomize');

    node('compareMergeClassBtn')?.addEventListener('click', openClassMerge);
    node('closeClassMergeBtn')?.addEventListener('click', closeClassMerge);
    node('cancelClassMergeBtn')?.addEventListener('click', closeClassMerge);
    node('classMergeSourceSelect')?.addEventListener('change', () => { currentMergeSourceLabel = node('classMergeSourceSelect')?.selectedOptions?.[0]?.textContent || ''; renderClassMergeComparison(); });
    node('classMergeLoadFileBtn')?.addEventListener('click', () => node('classMergeFileInput')?.click());
    node('classMergeFileInput')?.addEventListener('change', event => void loadClassMergeFile(event.target.files?.[0]));
    node('applyClassMergeBtn')?.addEventListener('click', requestClassMerge);
    document.querySelectorAll('[data-class-merge-category],#classMergeRosterMode,#classMergeSourceWins').forEach(input => input.addEventListener('change', renderClassMergeComparison));

    node('openPasswordRecoveryPackageBtn')?.addEventListener('click', () => { node('settingsModal')?.classList.remove('show'); node('recoveryKitModal')?.classList.add('show'); node('passwordRecoveryPackageCard')?.scrollIntoView({ block: 'center' }); DialogManager.synchronize(); });
    node('createPasswordRecoveryPackageBtn')?.addEventListener('click', () => void createPasswordRecoveryPackage());
    node('choosePasswordRecoveryPackageBtn')?.addEventListener('click', () => node('passwordRecoveryPackageInput')?.click());
    node('restorePasswordRecoveryPackageBtn')?.addEventListener('click', () => node('passwordRecoveryPackageInput')?.click());
    node('welcomeRecoverPasswordBtn')?.addEventListener('click', () => node('passwordRecoveryPackageInput')?.click());
    node('passwordRecoveryPackageInput')?.addEventListener('change', event => void preparePasswordRecoveryRestore(event.target.files?.[0]));
    node('continuePasswordRecoveryRestoreBtn')?.addEventListener('click', () => void restorePasswordRecoveryPackage());
    node('closePasswordRecoveryRestoreBtn')?.addEventListener('click', closePasswordRecoveryRestore);
    node('cancelPasswordRecoveryRestoreBtn')?.addEventListener('click', closePasswordRecoveryRestore);
    node('passwordRecoveryCodeInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') void restorePasswordRecoveryPackage(); if (event.key === 'Escape') closePasswordRecoveryRestore(); });
    node('copyPasswordRecoveryCodeBtn')?.addEventListener('click', () => void copyText(node('passwordRecoveryCodeValue')?.textContent || '').then(() => setLiveStatusMessage('Recovery code copied. Store it separately from the package.')));

    node('openOperationRecoveryCenterBtn')?.addEventListener('click', () => openOperationRecovery());
    node('closeOperationRecoveryBtn')?.addEventListener('click', () => { node('operationRecoveryModal')?.classList.remove('show'); DialogManager.synchronize(); });
    node('clearOperationFailureHistoryBtn')?.addEventListener('click', () => { failureRecords.length = 0; renderOperationRecovery(null); });
    node('operationRecoveryModal')?.addEventListener('click', event => {
      const open = event.target.closest('[data-operation-open]');
      const retry = event.target.closest('[data-operation-retry]');
      const copy = event.target.closest('[data-operation-copy]');
      const rejected = event.target.closest('[data-operation-rejected]');
      if (open) renderOperationRecovery(operationRecord(open.dataset.operationOpen));
      if (retry) {
        const record = operationRecord(retry.dataset.operationRetry);
        node('operationRecoveryModal')?.classList.remove('show');
        Promise.resolve(record?.retry?.()).catch(error => reportFailure({ operation: record?.operation || 'Retry operation', source: record?.source || '', error, remedy: record?.remedy || '' }));
      }
      if (copy) {
        const record = operationRecord(copy.dataset.operationCopy);
        if (record) void copyText(supportReport(record)).then(() => setLiveStatusMessage('Privacy-safe operation report copied.'));
      }
      if (rejected) {
        const record = operationRecord(rejected.dataset.operationRejected);
        if (record) downloadText(`classroom-seating-planner-rejected-rows-${new Date().toISOString().slice(0, 10)}.csv`, rejectedRowsCsv(record), 'text/csv');
      }
    });
  }

  function installObservers() {
    const detail = node('seatingCandidateDetail');
    if (detail) {
      candidateObserver?.disconnect();
      candidateObserver = new MutationObserver(() => decorateCandidateDetail());
      candidateObserver.observe(detail, { childList: true });
    }
    const nav = node('settingsPageNav');
    if (nav) {
      settingsObserver?.disconnect();
      let sorting = false;
      settingsObserver = new MutationObserver(() => {
        if (sorting) return;
        sorting = true;
        sortSettingsNavigation();
        queueMicrotask(() => { sorting = false; });
      });
      settingsObserver.observe(nav, { childList: true });
    }
  }

  function install() {
    if (installed) return;
    installed = true;
    appendModalMarkup();
    installEntryPoints();
    sortSettingsNavigation();
    installEvents();
    installObservers();
    document.body.dataset.workflowRecovery = APP_REVISION;
  }

  function afterReady() {
    sortSettingsNavigation();
    decorateCandidateDetail();
  }

  return Object.freeze({
    install,
    afterReady,
    analyzeRuleConflicts,
    openRuleConflictInspector,
    renderCandidateRuleContext: candidateRuleContextHtml,
    mergeClassRecords,
    openClassMerge,
    reportFailure,
    openOperationRecovery,
    createPasswordRecoveryPackage,
    preparePasswordRecoveryRestore,
    restorePasswordRecoveryPackage,
    rejectedRowsCsv,
    spreadsheetSafeCsvValue,
    sortSettingsNavigation
  });
})();



