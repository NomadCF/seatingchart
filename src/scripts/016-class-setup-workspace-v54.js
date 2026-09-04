const ClassSetupWorkspaceV54 = (() => {
  let installed = false;
  let ready = false;
  let activeSection = 'overview';
  let movedRecords = [];
  let observer = null;
  const STORAGE_KEY = 'classroomSeatingPlannerClassSetupV6';
  const SECTIONS = [
    { id: 'overview', label: 'Overview', short: 'Overview', description: 'Readiness, next steps, and class summary.' },
    { id: 'import', label: 'Import Roster', short: 'Import', description: 'Upload, map, preview, and reconcile roster files.' },
    { id: 'students', label: 'Students', short: 'Students', description: 'Add, edit, search, archive, and manage the roster.' },
    { id: 'rules', label: 'Groups & Rules', short: 'Groups & Rules', description: 'Create together, apart, location, and support rules.' },
    { id: 'requirements', label: 'Student Needs', short: 'Student Needs', description: 'Review student-specific seating requirements.' },
    { id: 'zones', label: 'Zones', short: 'Zones', description: 'Name room areas and connect students or groups to them.' },
    { id: 'manager', label: 'Groups & Zones Manager', short: 'Manager', description: 'Manage memberships and zone links with drag and drop.' },
    { id: 'review', label: 'Review Setup', short: 'Review', description: 'Check setup quality before designing the room.' }
  ];
  const RULE_TYPE_HELP = {
    together: ['Keep nearby', 'Use for partners, support pairs, or students who should be placed close together.'],
    avoid: ['Keep separated', 'Use when selected students should not sit next to or near one another.'],
    special: ['Reserve anchored seats', 'Use when this group should be filled into specific seats selected later in Room Design.'],
    front: ['Prefer the front', 'Moves this group toward the selected front side of the room.'],
    back: ['Prefer the back', 'Moves this group away from the selected front side of the room.'],
    nearBoard: ['Near the board', 'Places this group closer to board or projector room objects when available.'],
    nearTeacher: ['Near the teacher', 'Places this group closer to the teacher desk when available.'],
    awayDoor: ['Away from doors', 'Places this group farther from door room objects when possible.'],
    awayWindow: ['Away from windows', 'Places this group farther from window room objects when possible.'],
    spread: ['Spread apart', 'Distributes selected students instead of clustering them together.'],
    zone: ['Prefer a zone', 'Places this group in a named room zone when seats are assigned to that zone.']
  };

  function node(id) { return document.getElementById(id); }

  function classSetupCollapseStorageKey(key) {
    return `${STORAGE_KEY}:collapse:${key}`;
  }

  function storedCollapseState(key, defaultCollapsed = true) {
    const stored = safeStorageGet('sessionStorage', classSetupCollapseStorageKey(key));
    if (stored === 'expanded') return false;
    if (stored === 'collapsed') return true;
    return defaultCollapsed;
  }

  function rememberCollapseState(key, collapsed) {
    safeStorageSet('sessionStorage', classSetupCollapseStorageKey(key), collapsed ? 'collapsed' : 'expanded');
  }

  function setClassSetupHeaderCollapsed(collapsed, { remember = true } = {}) {
    const compact = Boolean(collapsed && isMobileViewport());
    node('classSetupWorkspace')?.classList.toggle('class-setup-header-collapsed', compact);
    const button = node('toggleClassSetupHeaderBtn');
    if (button) {
      button.textContent = compact ? 'Show details' : 'Hide details';
      button.setAttribute('aria-expanded', compact ? 'false' : 'true');
      button.setAttribute('aria-label', compact ? 'Expand Class Setup details' : 'Collapse Class Setup details');
    }
    if (remember) rememberCollapseState('header', Boolean(collapsed));
  }

  function setMobileCollapsibleState(container, key, collapsed, { remember = true } = {}) {
    if (!container) return;
    const compact = Boolean(collapsed && isMobileViewport());
    container.classList.toggle('mobile-collapsed', compact);
    container.dataset.mobileCollapsed = collapsed ? 'true' : 'false';
    const button = container.querySelector(':scope > .mobile-collapse-toggle, :scope > .class-setup-section-heading-actions .mobile-collapse-toggle, :scope > .section-header-row .mobile-collapse-toggle');
    if (button) {
      button.textContent = compact ? 'Show' : 'Hide';
      button.setAttribute('aria-expanded', compact ? 'false' : 'true');
      button.setAttribute('aria-label', compact ? 'Expand this section' : 'Collapse this section');
    }
    if (remember) rememberCollapseState(key, Boolean(collapsed));
  }

  function ensureSectionHeadingCollapsibles() {
    node('classSetupWorkspace')?.querySelectorAll('.class-setup-section-panel').forEach(panel => {
      const heading = panel.querySelector(':scope > .class-setup-section-heading');
      if (!heading || heading.dataset.mobileCollapsibleReady === 'true') return;
      heading.dataset.mobileCollapsibleReady = 'true';
      const key = `heading-${panel.dataset.classSetupPanel || panel.id}`;
      const actions = document.createElement('div');
      actions.className = 'class-setup-section-heading-actions no-print';
      const existingAction = [...heading.children].find(child => child.tagName === 'BUTTON');
      if (existingAction) actions.appendChild(existingAction);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary tiny mobile-collapse-toggle';
      button.textContent = 'Show';
      button.addEventListener('click', () => {
        const next = heading.dataset.mobileCollapsed !== 'true';
        heading.dataset.mobileCollapsed = next ? 'true' : 'false';
        setMobileCollapsibleState(heading, key, next);
      });
      actions.appendChild(button);
      heading.appendChild(actions);
      const collapsed = storedCollapseState(key, true);
      heading.dataset.mobileCollapsed = collapsed ? 'true' : 'false';
      setMobileCollapsibleState(heading, key, collapsed, { remember: false });
    });
  }

  function ensureRosterSourceCollapsibles() {
    node('classSetupRosterSourceGrid')?.querySelectorAll('.class-setup-roster-source-card').forEach((card, index) => {
      if (card.dataset.mobileCollapsibleReady === 'true') return;
      card.dataset.mobileCollapsibleReady = 'true';
      const key = `roster-source-${index}`;
      const heading = card.querySelector('h4');
      if (!heading) return;
      const body = document.createElement('div');
      body.className = 'class-setup-mobile-collapsible-body';
      body.id = `classSetupRosterSourceBody-${index}`;
      while (heading.nextSibling) body.appendChild(heading.nextSibling);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary tiny mobile-collapse-toggle no-print';
      button.setAttribute('aria-controls', body.id);
      button.addEventListener('click', () => {
        const next = card.dataset.mobileCollapsed !== 'true';
        card.dataset.mobileCollapsed = next ? 'true' : 'false';
        setMobileCollapsibleState(card, key, next);
      });
      card.append(button, body);
      const collapsed = storedCollapseState(key, true);
      card.dataset.mobileCollapsed = collapsed ? 'true' : 'false';
      setMobileCollapsibleState(card, key, collapsed, { remember: false });
    });
  }

  function syncResponsiveCollapsibles() {
    const headerCollapsed = storedCollapseState('header', true);
    setClassSetupHeaderCollapsed(headerCollapsed, { remember: false });
    ensureSectionHeadingCollapsibles();
    ensureRosterSourceCollapsibles();
    node('classSetupWorkspace')?.querySelectorAll('[data-mobile-collapsible-ready="true"]').forEach(container => {
      const key = container.classList.contains('class-setup-section-heading')
        ? `heading-${container.closest('.class-setup-section-panel')?.dataset.classSetupPanel || container.closest('.class-setup-section-panel')?.id}`
        : `roster-source-${[...container.parentElement.children].indexOf(container)}`;
      setMobileCollapsibleState(container, key, container.dataset.mobileCollapsed === 'true', { remember: false });
    });
  }

  function requirementCount(student) {
    const r = effectiveStudentRequirements(student || {});
    return [
      r.front && r.front !== 'none', r.side && r.side !== 'none', r.nearTeacher, r.aisle,
      r.ada, r.awayDoor, r.awayWindow,
      Array.isArray(r.preferredZoneIds) && r.preferredZoneIds.length,
      Array.isArray(r.excludedZoneIds) && r.excludedZoneIds.length,
      Array.isArray(r.minDistanceStudentIds) && r.minDistanceStudentIds.length
    ].reduce((sum, value) => sum + (value ? 1 : 0), 0);
  }

  function noteCount(student) {
    return ['notesPrivate', 'notesSubstitute', 'notesPublic'].reduce((sum, key) => sum + (String(student?.[key] || '').trim() ? 1 : 0), 0);
  }

  function seatCount() {
    if (state.layoutMode === 'freeform') return (state.freeformLayout?.objects || []).filter(item => item.type === 'seat').length;
    return Object.values(state.cells || {}).filter(cell => cell.type === 'seat').length;
  }

  function setupSnapshot() {
    const students = state.students || [];
    const groups = state.groups || [];
    const zones = state.zones || [];
    const requirements = students.reduce((sum, student) => sum + requirementCount(student), 0);
    const studentsWithRequirements = students.filter(student => requirementCount(student) > 0).length;
    const missingNames = students.filter(student => !String(student.firstName || student.lastName || student.nickName || '').trim());
    const duplicateNames = new Map();
    students.forEach(student => {
      const key = `${String(student.firstName || '').trim()}|${String(student.lastName || '').trim()}`.toLowerCase();
      if (!key.replace('|', '')) return;
      duplicateNames.set(key, (duplicateNames.get(key) || 0) + 1);
    });
    const duplicateNameCount = [...duplicateNames.values()].filter(count => count > 1).reduce((sum, count) => sum + count, 0);
    const emptyRules = groups.filter(item => !(item.studentIds || item.memberStudentIds || item.members || []).length);
    const seats = seatCount();
    return {
      students, groups, zones, requirements, studentsWithRequirements, missingNames,
      duplicateNameCount, emptyRules, seats, ready: students.length > 0,
      completion: students.length ? Math.min(100, 50 + (missingNames.length ? 0 : 20) + (duplicateNameCount ? 0 : 15) + (emptyRules.length ? 0 : 15)) : 0
    };
  }

  function installDom() {
    if (node('classSetupWorkspace')) return;
    const main = document.querySelector('main.app');
    const center = document.querySelector('main.app > .center-panel');
    const leftPanel = document.querySelector('main.app > .left-panel');
    const leftBody = leftPanel?.querySelector('.panel-body');
    if (!main || !leftPanel || !leftBody) return;

    const nav = document.createElement('div');
    nav.id = 'classSetupRail';
    nav.className = 'class-setup-rail no-print';
    nav.innerHTML = `
          <div class="class-setup-rail-summary">
            <div><span class="class-setup-eyebrow">Setup progress</span><strong id="classSetupRailPercent">0%</strong></div>
            <div class="class-setup-progress-track" aria-hidden="true"><span id="classSetupProgressFill"></span></div>
            <span id="classSetupRailSummary">Start with the roster</span>
          </div>
          <nav id="classSetupRailNav" class="class-setup-rail-nav" aria-label="Class setup subsections"></nav>
          <div class="class-setup-rail-actions">
            <button id="classSetupGuidedHelpBtn" class="secondary" type="button">Guided help</button>
            <button id="classSetupContinueRoomBtn" type="button">Continue to Room Design</button>
          </div>`;
    leftBody.prepend(nav);

    const workspace = document.createElement('section');
    workspace.id = 'classSetupWorkspace';
    workspace.className = 'panel class-setup-workspace';
    workspace.innerHTML = `
          <header class="class-setup-header">
            <div class="class-setup-title-block">
              <span class="class-setup-eyebrow">Class Setup</span>
              <h2 id="classSetupTitle">Overview</h2>
              <p id="classSetupDescription">Readiness, next steps, and class summary.</p>
            </div>
            <div class="class-setup-header-actions no-print">
              <button id="toggleClassSetupHeaderBtn" class="secondary class-setup-collapse-button" type="button" aria-expanded="false">Show details</button>
              <button id="classSetupClassToolsBtn" class="secondary" type="button">Class tools</button>
              <button id="classSetupTopContinueBtn" type="button">Room Design</button>
            </div>
          </header>
          <nav id="classSetupTopNav" class="class-setup-top-nav no-print" aria-label="Class setup pages"></nav>
          <div id="classSetupMobileNav" class="class-setup-mobile-nav no-print">
            <label for="classSetupMobileSectionSelect">Setup section</label>
            <select id="classSetupMobileSectionSelect" aria-label="Choose Class Setup section"></select>
          </div>
          <div id="classSetupContent" class="class-setup-content">
            <section id="classSetupOverviewPanel" class="class-setup-section-panel active" data-class-setup-panel="overview"></section>
            <section id="classSetupImportPanel" class="class-setup-section-panel" data-class-setup-panel="import">
              <div class="class-setup-section-heading"><div><span class="class-setup-eyebrow">Roster tools</span><h3>Import Roster</h3><p>Choose a file, map its columns, preview the result, and reconcile changes before replacing or updating roster records.</p></div></div>
              <div id="classSetupImportMain" class="class-setup-import-main"></div>
            </section>
            <section id="classSetupStudentsPanel" class="class-setup-section-panel" data-class-setup-panel="students">
              <div class="class-setup-section-heading"><div><span class="class-setup-eyebrow">Roster</span><h3>Students</h3><p>Add and maintain roster records here. Actual seat placement happens in Seat Students, where the room and roster are visible together.</p></div><div class="class-setup-inline-status"><strong id="classSetupStudentCount">0</strong><span>Students</span></div></div>
              <div id="classSetupStudentsMain" class="class-setup-students-main"></div>
            </section>
            <section id="classSetupRulesPanel" class="class-setup-section-panel" data-class-setup-panel="rules">
              <div class="class-setup-section-heading"><div><span class="class-setup-eyebrow">Shared seating logic</span><h3>Groups &amp; Seating Rules</h3><p>Choose students, describe what should happen, and set how strongly the generator should try to honor the rule.</p></div><button id="classSetupManageRulesBtn" class="secondary no-print" type="button">Open Groups &amp; Zones Manager</button></div>
              <div id="classSetupRulesMain" class="class-setup-rules-main"></div>
            </section>
            <section id="classSetupRequirementsPanel" class="class-setup-section-panel" data-class-setup-panel="requirements">
              <div class="class-setup-section-heading"><div><span class="class-setup-eyebrow">Individual requirements</span><h3>Student Needs</h3><p>Review front, aisle, access, distance, and zone requirements. Edit the student record to change a need.</p></div><button id="classSetupRequirementsStudentsBtn" class="secondary no-print" type="button">Open student list</button></div>
              <div id="classSetupRequirementsSummary" class="class-setup-requirements-summary"></div>
              <div id="classSetupRequirementsList" class="class-setup-requirements-list"></div>
            </section>
            <section id="classSetupZonesPanel" class="class-setup-section-panel" data-class-setup-panel="zones">
              <div class="class-setup-section-heading"><div><span class="class-setup-eyebrow">Named room areas</span><h3>Zones</h3><p>Name useful areas now. Assign seats from their settings popup or with the Room Design selection tools.</p></div></div>
              <div id="classSetupZonesMain" class="class-setup-zones-main"></div>
            </section>
            <section id="classSetupManagerPanel" class="class-setup-section-panel" data-class-setup-panel="manager">
              <div class="class-setup-section-heading"><div><span class="class-setup-eyebrow">Visual membership editor</span><h3>Groups &amp; Zones Manager</h3><p>Use drag and drop to organize students into groups, connect groups and students to zones, and review memberships in one workspace.</p></div></div>
              <div class="workflow-card class-setup-manager-card">
                <strong>Open the visual manager</strong>
                <span>The manager uses the same saved groups and zones shown in the rest of Class Setup. Changes appear everywhere immediately.</span>
                <button id="classSetupOpenManagerBtn" type="button">Open Groups &amp; Zones Manager</button>
              </div>
            </section>
            <section id="classSetupReviewPanel" class="class-setup-section-panel" data-class-setup-panel="review">
              <div class="class-setup-section-heading"><div><span class="class-setup-eyebrow">Setup review</span><h3>Ready for Room Design?</h3><p>Check the roster and rules before building the room. Optional items remain optional and do not block the workflow.</p></div></div>
              <div id="classSetupReviewSummary" class="class-setup-review-summary"></div>
              <div id="classSetupReviewList" class="class-setup-review-list"></div>
              <div class="class-setup-review-actions no-print"><button id="classSetupReviewStudentsBtn" class="secondary" type="button">Review students</button><button id="classSetupReviewRulesBtn" class="secondary" type="button">Review groups &amp; rules</button><button id="classSetupReviewContinueBtn" type="button">Continue to Room Design</button></div>
            </section>
          </div>`;
    main.insertBefore(workspace, center || null);

    node('classSetupRailNav').innerHTML = SECTIONS.map((item, index) => `
          <button type="button" data-class-setup-section="${item.id}">
            <span class="class-setup-step-number" aria-hidden="true">${index + 1}</span>
            <span class="class-setup-nav-copy"><strong>${item.short}</strong><small id="classSetupNavMeta-${item.id}">${item.description}</small></span>
            <span class="class-setup-nav-state" id="classSetupNavState-${item.id}" aria-hidden="true"></span>
          </button>`).join('');
    node('classSetupTopNav').innerHTML = SECTIONS.map(item => `<button id="classSetup${item.id[0].toUpperCase()+item.id.slice(1)}Tab" type="button" data-class-setup-section="${item.id}" aria-selected="false">${item.label}</button>`).join('');
    node('classSetupMobileSectionSelect').innerHTML = SECTIONS.map(item => `<option value="${item.id}">${item.label}</option>`).join('');

    const dashboard = node('v4SetupDashboard');
    if (dashboard) node('classSetupOverviewPanel').appendChild(dashboard);
  }

  function rememberNode(item) {
    if (!item || movedRecords.some(record => record.node === item)) return;
    movedRecords.push({ node: item, parent: item.parentNode, next: item.nextSibling });
  }

  function moveNode(item, target) {
    if (!item || !target) return;
    rememberNode(item);
    target.appendChild(item);
  }


  function decorateStudentSections() {
    const target = node('classSetupStudentsMain');
    if (!target) return;
    const addSection = [...target.children].find(section => section.querySelector?.('#addStudentBtn'));
    const listSection = [...target.children].find(section => section.querySelector?.('#studentList'));
    if (addSection) {
      addSection.classList.add('class-setup-editor-card', 'class-setup-student-form-card');
      const heading = addSection.querySelector('h3');
      if (heading) heading.textContent = 'Add a Student';
      if (!addSection.querySelector('.class-setup-card-intro')) {
        const headingRow = heading?.closest('.section-header-row');
        (headingRow || heading)?.insertAdjacentHTML('afterend', '<p class="class-setup-card-intro">Enter the information you have. First and last name are enough to begin; a stable ID helps future imports match the same student.</p>');
      }
    }
    if (listSection) {
      listSection.classList.add('class-setup-editor-card', 'class-setup-student-list-card');
      listSection.classList.remove('v41-section-collapsed');
      const heading = listSection.querySelector(':scope > h3');
      if (heading?.firstChild) heading.firstChild.textContent = 'Students ';
      const hint = node('studentListContextHint');
      if (hint) hint.innerHTML = 'Manage names, notes, attendance, and requirements here. Use <strong>Seat Students</strong> later to place students because that screen shows the room and roster together.';
    }
    refreshAddStudentCollapse();
  }

  function decorateImportSection() {
    const container = node('classSetupImportMain');
    const section = container?.querySelector('.section');
    if (!container || !section) return;
    if (!node('classSetupRosterSourceGrid')) {
      const sources = document.createElement('div');
      sources.id = 'classSetupRosterSourceGrid';
      sources.className = 'class-setup-roster-source-grid';
      sources.innerHTML = `
            <section class="class-setup-roster-source-card google-classroom-source-card">
              <span class="class-setup-eyebrow">Google Classroom</span>
              <h4>Import a Classroom roster</h4>
              <p>Connect with read-only access, choose a course, and review roster changes before applying them. Matching students keep their notes, requirements, groups, zones, and seating references.</p>
              <div class="class-setup-roster-source-actions">
                <button id="classSetupGoogleClassroomConnectBtn" class="secondary" type="button">Connect Google Classroom</button>
                <button id="classSetupGoogleClassroomRefreshBtn" class="secondary" type="button">Refresh Courses</button>
              </div>
              <div class="field"><label for="classSetupGoogleClassroomCourseSelect">Course</label><select id="classSetupGoogleClassroomCourseSelect"><option value="">Connect to load courses</option></select></div>
              <button id="classSetupGoogleClassroomImportBtn" type="button">Review Classroom Roster</button>
              <div id="classSetupGoogleClassroomStatus" class="hint class-setup-roster-source-status">Not connected.</div>
            </section>
            <section class="class-setup-roster-source-card sis-roster-source-card">
              <span class="class-setup-eyebrow">SIS / OneRoster CSV</span>
              <h4>Quick standardized roster import</h4>
              <p>Automatically recognizes common SIS columns such as sourcedId, student ID, first name, last name, preferred name, and grade, then opens the same reconciliation review used by Classroom.</p>
              <input id="classSetupSisCsvInput" type="file" accept=".csv,text/csv" aria-label="Choose SIS CSV file" hidden />
              <button id="classSetupSisCsvBtn" class="secondary" type="button">Choose SIS / OneRoster CSV</button>
              <div id="classSetupSisStatus" class="hint class-setup-roster-source-status">No SIS file selected.</div>
            </section>`;
      section.before(sources);
    }
    section.classList.add('class-setup-editor-card', 'class-setup-import-card');
    const heading = section.querySelector('h3');
    if (heading) heading.textContent = 'Mapped CSV Import';
    const hint = section.querySelector('.hint');
    if (hint) hint.textContent = 'Use this flexible importer for any CSV layout. Choose the file, map columns yourself, preview the records, and select duplicate handling before importing.';
  }

  function refreshRuleTypeHelp() {
    const helper = node('classSetupRuleTypeHelp');
    const type = node('groupType')?.value || 'together';
    const [title, detail] = RULE_TYPE_HELP[type] || RULE_TYPE_HELP.together;
    if (helper) helper.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>`;
    const zoneField = node('groupZoneSelect')?.closest('.field');
    if (zoneField) zoneField.classList.toggle('rule-zone-field-active', type === 'zone');
  }

  function updateRuleMemberTools() {
    const picker = node('groupMemberPicker');
    if (!picker) return;
    const inputs = [...picker.querySelectorAll('input[type="checkbox"]')];
    const selected = inputs.filter(input => input.checked).length;
    const count = node('classSetupRuleMemberCount');
    if (count) count.textContent = `${selected} selected`;
    filterRuleMembers();
  }

  function filterRuleMembers() {
    const picker = node('groupMemberPicker');
    const query = String(node('classSetupRuleMemberSearch')?.value || '').trim().toLowerCase();
    if (!picker) return;
    picker.querySelectorAll('label.checkline').forEach(label => {
      const visible = !query || label.textContent.toLowerCase().includes(query);
      label.hidden = !visible;
    });
  }

  function filterRuleList() {
    const list = node('groupList');
    const query = String(node('classSetupRuleListSearch')?.value || '').trim().toLowerCase();
    if (!list) return;
    list.querySelectorAll('.group-card').forEach(card => {
      card.hidden = Boolean(query) && !card.textContent.toLowerCase().includes(query);
    });
  }

  function decorateRuleSections() {
    const target = node('classSetupRulesMain');
    if (!target) return;
    const createSection = [...target.children].find(section => section.querySelector?.('#addGroupBtn'));
    const listSection = [...target.children].find(section => section.querySelector?.('#groupList'));
    if (createSection) {
      createSection.classList.add('class-setup-editor-card', 'class-setup-rule-form-card');
      const heading = createSection.querySelector('h3');
      if (heading) heading.textContent = 'Create a Group or Seating Rule';
      if (!createSection.querySelector('.class-setup-card-intro')) heading?.insertAdjacentHTML('afterend', '<p class="class-setup-card-intro">A rule has a name, an outcome, an importance level, and the students it applies to. Students may belong to more than one rule.</p>');
      const typeSelect = node('groupType');
      if (typeSelect && !node('classSetupRuleTypeHelp')) typeSelect.closest('.field')?.insertAdjacentHTML('afterend', '<div id="classSetupRuleTypeHelp" class="class-setup-rule-type-help" aria-live="polite"></div>');
      const picker = node('groupMemberPicker');
      if (picker && !node('classSetupRuleMemberTools')) {
        picker.insertAdjacentHTML('beforebegin', `
              <div id="classSetupRuleMemberTools" class="class-setup-rule-member-tools">
                <label class="class-setup-rule-member-search"><span class="visually-hidden">Search students</span><input id="classSetupRuleMemberSearch" type="search" placeholder="Find a student…" autocomplete="off" /></label>
                <span id="classSetupRuleMemberCount" class="pill">0 selected</span>
                <button id="classSetupSelectVisibleMembersBtn" class="secondary tiny" type="button">Select visible</button>
                <button id="classSetupClearMembersBtn" class="secondary tiny" type="button">Clear</button>
              </div>`);
      }
    }
    if (listSection) {
      listSection.classList.add('class-setup-editor-card', 'class-setup-rule-list-card');
      const heading = listSection.querySelector('h3');
      if (heading?.firstChild) heading.firstChild.textContent = 'Existing Groups & Rules ';
      const hint = listSection.querySelector('.hint');
      if (hint) hint.textContent = 'Review memberships and settings here. Assign reserved seat anchors later in Room Design, when the room is visible.';
      if (!node('classSetupRuleListTools')) node('groupList')?.insertAdjacentHTML('beforebegin', '<div id="classSetupRuleListTools" class="class-setup-rule-list-tools"><input id="classSetupRuleListSearch" type="search" placeholder="Search groups and rules…" autocomplete="off" /><span class="muted">Use Edit to change the rule without rebuilding it.</span></div>');
    }
    refreshRuleTypeHelp();
    updateRuleMemberTools();
    filterRuleList();
  }

  function createZoneWithoutSeats() {
    if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
    const nameInput = node('zoneNameInput');
    const colorInput = node('zoneColorInput');
    const name = String(nameInput?.value || '').trim() || `Zone ${(state.zones || []).length + 1}`;
    const color = safeColor(colorInput?.value, defaultGroupColor((state.zones || []).length + 4));
    state.zones = Array.isArray(state.zones) ? state.zones : [];
    const duplicate = state.zones.some(zone => String(zone.name || '').trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      setLiveStatusMessage(`A zone named "${name}" already exists.`);
      nameInput?.focus();
      return;
    }
    state.zones.push(normalizeZoneRecord({ id: uid('zone'), name, color }));
    if (nameInput) nameInput.value = '';
    if (colorInput) colorInput.value = defaultGroupColor(state.zones.length + 4);
    renderAll();
    setLiveStatusMessage(`Created zone "${name}". Assign visible seats to it during Room Design.`);
    updateSummary();
  }

  function decorateZoneSections() {
    const target = node('classSetupZonesMain');
    if (!target) return;
    const createSection = [...target.children].find(section => section.querySelector?.('#zoneNameInput'));
    const listSection = [...target.children].find(section => section.querySelector?.('#zoneList'));
    if (createSection) {
      createSection.classList.add('class-setup-editor-card', 'class-setup-zone-form-card');
      const heading = createSection.querySelector('h3');
      if (heading) heading.textContent = 'Create a Named Zone';
      const hint = createSection.querySelector('.hint');
      if (hint) hint.textContent = 'Create the zone name and color here. During Room Design, select visible seats and assign them to this zone.';
      if (!node('classSetupCreateZoneBtn')) createSection.querySelector('.button-row')?.insertAdjacentHTML('afterbegin', '<button id="classSetupCreateZoneBtn" class="class-setup-zone-create-only" type="button">Create Zone</button>');
    }
    if (listSection) {
      listSection.classList.add('class-setup-editor-card', 'class-setup-zone-list-card');
      const heading = listSection.querySelector('h3');
      if (heading?.firstChild) heading.firstChild.textContent = 'Existing Zones ';
    }
  }

  function moveSetupEditorsIntoWorkspace() {
    const studentsPanel = node('studentsSideTabPanel');
    const groupsPanel = node('groupsSideTabPanel');
    const zonesPanel = node('zonesSideTabPanel');
    const studentSections = [...(studentsPanel?.children || [])].filter(item => item.matches?.('section.section'));
    const addSection = studentSections.find(section => section.querySelector('#addStudentBtn'));
    const importSection = studentSections.find(section => section.classList.contains('csv-import-section'));
    const listSection = studentSections.find(section => section.querySelector('#studentList'));
    moveNode(addSection, node('classSetupStudentsMain'));
    moveNode(listSection, node('classSetupStudentsMain'));
    moveNode(importSection, node('classSetupImportMain'));
    [...(groupsPanel?.children || [])].filter(item => item.matches?.('section.section')).forEach(section => moveNode(section, node('classSetupRulesMain')));
    [...(zonesPanel?.children || [])].filter(item => item.matches?.('section.section')).forEach(section => moveNode(section, node('classSetupZonesMain')));
    decorateStudentSections();
    decorateImportSection();
    decorateRuleSections();
    decorateZoneSections();
    syncResponsiveCollapsibles();
  }

  function restoreSetupEditors() {
    [...movedRecords].reverse().forEach(record => {
      if (!record.parent || !record.node) return;
      if (record.next && record.next.parentNode === record.parent) record.parent.insertBefore(record.node, record.next);
      else record.parent.appendChild(record.node);
    });
    movedRecords = [];
  }

  function setSection(section, options = {}) {
    if (!SECTIONS.some(item => item.id === section)) section = 'overview';
    activeSection = section;
    safeStorageSet('sessionStorage', STORAGE_KEY, section)
    document.querySelectorAll('[data-class-setup-section]').forEach(button => {
      const active = button.dataset.classSetupSection === section;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    if (node('classSetupMobileSectionSelect') && node('classSetupMobileSectionSelect').value !== section) {
      node('classSetupMobileSectionSelect').value = section;
    }
    document.querySelectorAll('[data-class-setup-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.classSetupPanel === section));
    const meta = SECTIONS.find(item => item.id === section);
    if (node('classSetupTitle')) node('classSetupTitle').textContent = meta.label;
    if (node('classSetupDescription')) node('classSetupDescription').textContent = meta.description;
    if (section === 'import' && !isMobileViewport()) {
      const body = node('csvImportBody');
      if (body?.classList.contains('collapsed')) node('toggleCsvImportBtn')?.click();
    }
    if (section === 'rules') decorateRuleSections();
    if (section === 'requirements') renderRequirements();
    if (section === 'manager') node('classSetupOpenManagerBtn')?.focus({ preventScroll: true });
    if (section === 'review') renderReview();
    updateSummary();
    if (!options.silent) {
      const tab = node(`classSetup${section[0].toUpperCase()+section.slice(1)}Tab`);
      const nav = node('classSetupTopNav');
      if (tab && nav) {
        const centeredLeft = Math.max(0, tab.offsetLeft - Math.max(0, (nav.clientWidth - tab.offsetWidth) / 2));
        if (typeof nav.scrollTo === 'function') nav.scrollTo({ left: centeredLeft, behavior: 'auto' });
        else nav.scrollLeft = centeredLeft;
      }
      const content = node('classSetupContent');
      if (content) content.scrollTop = 0;
    }
  }

  function renderRequirements() {
    const list = node('classSetupRequirementsList');
    const summary = node('classSetupRequirementsSummary');
    if (!list || !summary) return;
    const students = state.students || [];
    const configured = students.filter(student => requirementCount(student) > 0);
    summary.innerHTML = `<article><strong>${configured.length}</strong><span>Students with needs</span></article><article><strong>${students.reduce((sum, student) => sum + requirementCount(student), 0)}</strong><span>Configured requirements</span></article><article><strong>${students.length - configured.length}</strong><span>Using normal defaults</span></article>`;
    if (!students.length) {
      list.innerHTML = '<div class="class-setup-empty"><strong>No students yet</strong><span>Add or import the roster before configuring individual seating requirements.</span><button type="button" data-class-setup-section="students">Add students</button></div>';
      return;
    }
    list.innerHTML = students.map(student => {
      const count = requirementCount(student);
      const notes = noteCount(student);
      const r = effectiveStudentRequirements(student);
      const labels = [
            r.front && r.front !== 'none' ? `Front: ${r.front}` : '', r.side && r.side !== 'none' ? `Side: ${r.side}` : '',
            r.nearTeacher ? 'Near teacher' : '', r.aisle ? 'Aisle' : '', r.ada ? 'ADA/access' : '',
            r.awayDoor ? 'Away from door' : '', r.awayWindow ? 'Away from window' : '',
            (r.preferredZoneIds || []).length ? `${r.preferredZoneIds.length} preferred zone${r.preferredZoneIds.length === 1 ? '' : 's'}` : '',
            (r.excludedZoneIds || []).length ? `${r.excludedZoneIds.length} excluded zone${r.excludedZoneIds.length === 1 ? '' : 's'}` : '',
            (r.minDistanceStudentIds || []).length ? `${r.minDistanceStudentIds.length} distance rule${r.minDistanceStudentIds.length === 1 ? '' : 's'}` : ''
      ].filter(Boolean);
      return `<article class="class-setup-requirement-card${count ? ' configured' : ''}">
            <div class="class-setup-requirement-main"><strong>${escapeHtml(studentDisplay(student))}</strong><span>${count ? labels.map(label => escapeHtml(label)).join(' · ') : 'No individual seating requirements configured.'}</span></div>
            <div class="class-setup-requirement-meta"><span class="pill${count ? ' special' : ''}">${count} requirement${count === 1 ? '' : 's'}</span>${notes ? `<span class="pill">${notes} note categor${notes === 1 ? 'y' : 'ies'}</span>` : ''}<button type="button" class="secondary" data-edit-student-id="${escapeHtml(student.id)}">Edit student</button></div>
          </article>`;
    }).join('');
  }

  function reviewRow(kind, title, detail, action, actionLabel) {
    return `<article class="class-setup-review-row ${kind}"><span class="class-setup-review-icon" aria-hidden="true">${kind === 'good' ? '✓' : kind === 'warn' ? '!' : '•'}</span><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>${action ? `<button type="button" class="secondary" data-class-setup-section="${action}">${escapeHtml(actionLabel || 'Review')}</button>` : ''}</article>`;
  }

  function renderReview() {
    const summary = node('classSetupReviewSummary');
    const list = node('classSetupReviewList');
    if (!summary || !list) return;
    const data = setupSnapshot();
    summary.innerHTML = `<article><span>Students</span><strong>${data.students.length}</strong><small>${data.students.length ? 'Roster started' : 'Required before seating'}</small></article><article><span>Groups & rules</span><strong>${data.groups.length}</strong><small>Optional unless needed</small></article><article><span>Student needs</span><strong>${data.studentsWithRequirements}</strong><small>Students with requirements</small></article><article><span>Zones</span><strong>${data.zones.length}</strong><small>Seats assigned in Room Design</small></article>`;
    const rows = [];
    rows.push(data.students.length ? reviewRow('good', 'Roster is present', `${data.students.length} student${data.students.length === 1 ? '' : 's'} ready for room planning.`) : reviewRow('warn', 'Roster is empty', 'Add students manually or import a roster before continuing.', 'students', 'Add students'));
    rows.push(data.missingNames.length ? reviewRow('warn', 'Students are missing names', `${data.missingNames.length} roster record${data.missingNames.length === 1 ? '' : 's'} need a visible name.`, 'students', 'Review students') : reviewRow('good', 'Student names look complete', 'Every roster record has a visible name.'));
    rows.push(data.duplicateNameCount ? reviewRow('warn', 'Possible duplicate names', `${data.duplicateNameCount} records share a first-and-last-name combination. Verify IDs before importing updates.`, 'students', 'Check roster') : reviewRow('good', 'No obvious duplicate names', 'No repeated first-and-last-name combinations were found.'));
    rows.push(data.emptyRules.length ? reviewRow('warn', 'Some rules have no students', `${data.emptyRules.length} rule${data.emptyRules.length === 1 ? '' : 's'} will not affect generation until students are selected.`, 'rules', 'Review rules') : reviewRow('good', 'Groups and rules are usable', data.groups.length ? `${data.groups.length} configured rule${data.groups.length === 1 ? '' : 's'} have students.` : 'No shared rules are configured, which is perfectly valid.'));
    rows.push(reviewRow('neutral', 'Zone seats are assigned from seat settings or Room Design', data.zones.length ? `${data.zones.length} named zone${data.zones.length === 1 ? '' : 's'} exist. Assign visible seats from the seat settings popup or Room Design after the room is built.` : 'Zones are optional. Create them now or after the room is built.', 'zones', 'Review zones'));
    list.innerHTML = rows.join('');
    node('classSetupReviewContinueBtn').disabled = !data.students.length;
  }

  function updateSummary() {
    const data = setupSnapshot();
    if (node('classSetupRailPercent')) node('classSetupRailPercent').textContent = `${data.completion}%`;
    if (node('classSetupProgressFill')) node('classSetupProgressFill').style.width = `${data.completion}%`;
    if (node('classSetupRailSummary')) node('classSetupRailSummary').textContent = data.students.length ? `${data.students.length} students · ${data.groups.length} rules · ${data.zones.length} zones` : 'Start by adding or importing students.';
    if (node('classSetupStudentCount')) node('classSetupStudentCount').textContent = String(data.students.length);
    const navMeta = {
      overview: `${data.completion}% ready`, students: `${data.students.length} student${data.students.length === 1 ? '' : 's'}`,
      import: 'CSV and roster updates', rules: `${data.groups.length} rule${data.groups.length === 1 ? '' : 's'}`,
      requirements: `${data.studentsWithRequirements} configured`, zones: `${data.zones.length} zone${data.zones.length === 1 ? '' : 's'}`,
      manager: `${data.groups.length} groups · ${data.zones.length} zones`,
      review: data.ready ? 'Ready to review' : 'Roster required'
    };
    Object.entries(navMeta).forEach(([key, value]) => { const target = node(`classSetupNavMeta-${key}`); if (target) target.textContent = value; });
    const states = {
      overview: data.completion >= 100 ? '✓' : '', students: data.students.length ? '✓' : '', import: '',
      rules: data.emptyRules.length ? '!' : (data.groups.length ? '✓' : ''), requirements: data.studentsWithRequirements ? '✓' : '',
      zones: data.zones.length ? '✓' : '', manager: (data.groups.length || data.zones.length) ? '→' : '', review: data.ready ? '→' : '!'
    };
    Object.entries(states).forEach(([key, value]) => { const target = node(`classSetupNavState-${key}`); if (target) target.textContent = value; });
    updateRuleMemberTools();
    filterRuleList();
    if (activeSection === 'requirements') renderRequirements();
    if (activeSection === 'review') renderReview();
  }

  function enterSetup() {
    installDom();
    moveSetupEditorsIntoWorkspace();
    document.body.classList.add('class-setup-workspace-active');
    const title = document.querySelector('.left-panel .panel-header h2');
    if (title) title.textContent = 'Class Setup';
    const remembered = safeStorageGet('sessionStorage', STORAGE_KEY) || '';
    setSection(SECTIONS.some(item => item.id === remembered) ? remembered : activeSection, { silent: true });
    syncResponsiveCollapsibles();
    updateSummary();
  }

  function exitSetup() {
    document.body.classList.remove('class-setup-workspace-active');
    restoreSetupEditors();
    const title = document.querySelector('.left-panel .panel-header h2');
    if (title) title.textContent = document.body.dataset.workflow === 'seating' ? 'Students' : 'Class setup';
  }

  function onWorkflowChange(workflow) {
    if (!installed || !ready) return;
    if (workflow === 'setup') enterSetup(); else exitSetup();
  }

  function installEvents() {
    document.addEventListener('click', event => {
      const sectionButton = event.target.closest('[data-class-setup-section]');
      if (sectionButton && document.body.dataset.workflow === 'setup') {
        event.preventDefault();
        setSection(sectionButton.dataset.classSetupSection);
        return;
      }
      const sideTab = event.target.closest('[data-side-tab]');
      if (sideTab && document.body.dataset.workflow === 'setup') {
        const mapping = { students: 'students', groups: 'rules', zones: 'zones' };
        setTimeout(() => setSection(mapping[sideTab.dataset.sideTab] || 'overview'), 0);
      }
      if (event.target.closest('#classSetupSelectVisibleMembersBtn')) {
        node('groupMemberPicker')?.querySelectorAll('label.checkline:not([hidden]) input[type="checkbox"]').forEach(input => { input.checked = true; });
        updateRuleMemberTools();
      }
      if (event.target.closest('#classSetupClearMembersBtn')) {
        node('groupMemberPicker')?.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; });
        updateRuleMemberTools();
      }
      if (event.target.closest('#classSetupCreateZoneBtn')) createZoneWithoutSeats();
    }, true);
    document.addEventListener('input', event => {
      if (event.target.id === 'classSetupRuleMemberSearch') filterRuleMembers();
      if (event.target.id === 'classSetupRuleListSearch') filterRuleList();
    });
    document.addEventListener('change', event => {
      if (event.target.id === 'groupType') refreshRuleTypeHelp();
      if (event.target.closest('#groupMemberPicker')) updateRuleMemberTools();
    });
    node('classSetupGuidedHelpBtn')?.addEventListener('click', () => node('guidedLearningBtn')?.click());
    node('toggleClassSetupHeaderBtn')?.addEventListener('click', () => {
      const collapsed = !node('classSetupWorkspace')?.classList.contains('class-setup-header-collapsed');
      setClassSetupHeaderCollapsed(collapsed);
    });
    node('classSetupMobileSectionSelect')?.addEventListener('change', event => setSection(event.target.value));
    [node('classSetupContinueRoomBtn'), node('classSetupTopContinueBtn'), node('classSetupReviewContinueBtn')].forEach(button => button?.addEventListener('click', () => ProductExperience?.setWorkflow?.('room')));
    node('classSetupClassToolsBtn')?.addEventListener('click', () => node('classToolsBtn')?.click());
    node('classSetupManageRulesBtn')?.addEventListener('click', () => node('openGroupManagerBtn')?.click());
    node('classSetupOpenManagerBtn')?.addEventListener('click', () => node('openGroupManagerBtn')?.click());
    node('classSetupRequirementsStudentsBtn')?.addEventListener('click', () => setSection('students'));
    node('classSetupReviewStudentsBtn')?.addEventListener('click', () => setSection('students'));
    node('classSetupReviewRulesBtn')?.addEventListener('click', () => setSection('rules'));
    ['addStudentBtn','clearStudentsBtn','addGroupBtn','clearGroupsBtn','saveZoneFromSelectionBtn','applyZoneToSelectionBtn','clearZonesFromSelectionBtn','reconcileRosterBtn'].forEach(id => node(id)?.addEventListener('click', () => setTimeout(updateSummary, 80)));
    node('classSelect')?.addEventListener('change', () => setTimeout(updateSummary, 80));
  }

  function installObserver() {
    observer?.disconnect();
    observer = new MutationObserver(() => updateSummary());
    ['studentList','groupList','groupMemberPicker','zoneList','classSelect'].forEach(id => {
      const target = node(id);
      if (target) observer.observe(target, { childList: true, subtree: true, characterData: true });
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-workflow'] });
  }

  function installHelpContent() {
    if (!Array.isArray(HELP_GUIDE_SECTIONS) || HELP_GUIDE_SECTIONS.some(section => section.id === 'class-setup-workspace')) return;
    HELP_GUIDE_SECTIONS.splice(1, 0, {
      id: 'class-setup-workspace', category: 'Class Setup', title: 'Class Setup Workspace and Subsections',
      keywords: 'class setup overview import roster students groups rules requirements zones drag drop manager review center workspace navigation',
      intro: 'Class Setup uses the center workspace for real editing. The left rail provides progress and navigation instead of squeezing forms into a narrow sidebar.',
      items: [
        { title: 'Overview', text: 'Shows readiness, class counts, and recommended next steps.' },
        { title: 'Import Roster', text: 'Uploads a CSV, maps columns, previews changes, reconciles updates, and reuses mapping profiles. Start here when you already have a roster file.' },
        { title: 'Students', text: 'Adds, edits, searches, archives, and manages roster records after an import or for manual entry. Student placement is handled later in Seat Students, where the chart is visible.' },
        { title: 'Groups & Rules', text: 'Creates together, apart, location, support, and reserved-seat rules. Use the member search and selection tools to choose students.' },
        { title: 'Student Needs', text: 'Reviews individual needs such as front, aisle, access, zone, and distance preferences.' },
        { title: 'Zones', text: 'Creates named room areas and connects students or groups to those areas. Seat membership is assigned from the seat settings or Room Design selection tools.' },
        { title: 'Groups & Zones Manager', text: 'Opens the visual drag-and-drop manager for student memberships, groups, rules, and zone links.' },
        { title: 'Review Setup', text: 'Checks roster completeness, possible duplicates, empty rules, and readiness before Room Design.' }
      ],
      tips: ['Use stable student IDs when available so roster reconciliation preserves notes and requirements.', 'Rules and zones are optional. Add only those that serve a real classroom need.'],
      warnings: ['Do not try to place students from Class Setup. Use Seat Students so the roster and chart are visible together.']
    });
  }

  function install() {
    if (installed) return;
    installed = true;
    installDom();
    installHelpContent();
    installEvents();
    installObserver();
    document.body.dataset.classSetupWorkspace = APP_REVISION;
  }

  function afterReady() {
    ready = true;
    onWorkflowChange(document.body.dataset.workflow || 'setup');
    updateSummary();
  }

  return Object.freeze({ install, afterReady, setSection, onWorkflowChange, updateSummary, syncResponsiveCollapsibles });
})();


