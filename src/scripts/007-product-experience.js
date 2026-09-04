const ProductExperience = (() => {
  let installed = false;
  let activeWorkflow = 'setup';
  let observersInstalled = false;
  let mobileCloseObserver = null;

  const WORKFLOWS = Object.freeze({
    setup: {
      number: '01',
      label: 'Class Setup',
      short: 'Setup',
      title: 'Set up your class',
      description: 'Add students and define the rules that matter before arranging the room.',
      primary: { label: 'Add students', action: 'setup-students' },
      secondary: { label: 'Class tools', action: 'class-tools' }
    },
    room: {
      number: '02',
      label: 'Room Design',
      short: 'Room',
      title: 'Design the room',
      description: 'Arrange seats and classroom features in Grid or Freeform.',
      primary: { label: 'Open room tools', action: 'room-tools' },
      secondary: { label: 'Room audit', action: 'room-audit' }
    },
    seating: {
      number: '03',
      label: 'Seat Students',
      short: 'Seat',
      title: 'Place students',
      description: 'Seat manually or compare generated plans using your rules and requirements.',
      primary: { label: 'Generate options', action: 'generate' },
      secondary: { label: 'Randomize options', action: 'randomize' }
    },
    review: {
      number: '04',
      label: 'Review',
      short: 'Review',
      title: 'Review the chart',
      description: 'Resolve conflicts, check assignments, and confirm the final layout.',
      primary: { label: 'Analyze chart', action: 'analyze' },
      secondary: { label: 'Toggle names only', action: 'names-only' }
    },
    share: {
      number: '05',
      label: 'Save & Share',
      short: 'Share',
      title: 'Save and share',
      description: 'Choose a durable save and prepare the right version for each audience.',
      primary: { label: 'Save options', action: 'save' },
      secondary: { label: 'Print options', action: 'print' }
    }
  });

  const ICONS = Object.freeze({
    logo: '<path d="M5 4.5h14v15H5z"/><path d="M8 8h3v3H8zm5 0h3v3h-3zm-5 5h3v3H8zm5 0h3v3h-3z"/>',
    setup: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6m3-3h-6"/>',
    room: '<path d="M3 3h18v18H3z"/><path d="M9 3v18M3 10h18M14 10v11"/>',
    seating: '<path d="M7 4v6h10V4"/><path d="M5 10h14v5H5zM7 15v5m10-5v5"/>',
    review: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
    undo: '<path d="M9 14l-4-4 4-4"/><path d="M5 10h8a6 6 0 0 1 6 6v2"/>',
    redo: '<path d="M15 14l4-4-4-4"/><path d="M19 10h-8a6 6 0 0 0-6 6v2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.07 14H3v-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63h.02A1.7 1.7 0 0 0 10 3.07V3h4v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9v.02A1.7 1.7 0 0 0 20.93 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15z"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.2 2c-1.3 1-2.3 1.5-2.3 3"/><path d="M12 18h.01"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.8-3.8"/>',
    chevron: '<path d="M9 18l6-6-6-6"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    snapshot: '<path d="M14.5 4l1.2 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.3l1.2-2z"/><circle cx="12" cy="13" r="4"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  });

  function svg(name, className = '') {
    return `<svg class="v4-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.more}</svg>`;
  }

  function buttonLabel(button, icon, label, { iconOnly = false } = {}) {
    if (!button) return;
    const accessible = button.getAttribute('aria-label') || button.title || label;
    button.innerHTML = `${svg(icon)}${iconOnly ? '' : `<span>${label}</span>`}`;
    button.setAttribute('aria-label', accessible);
    button.title = accessible;
    button.classList.add('v4-action-button');
    if (iconOnly) button.classList.add('v4-icon-button');
  }

  function createElement(tag, className, html = '') {
    const node = document.createElement(tag);
    node.className = className;
    node.innerHTML = html;
    return node;
  }

  function buildTopbar() {
    const header = document.querySelector('body > header');
    if (!header || header.dataset.v4Ready === 'true') return;
    header.dataset.v4Ready = 'true';
    header.className = 'v4-topbar no-print';

    const originalHeaderTitle = header.querySelector('.header-title');
    const classManager = header.querySelector('.class-manager');
    const settingsSlot = header.querySelector('.header-settings-slot');
    const headerActions = header.querySelector('.header-actions');
    const toggleSlot = header.querySelector('.header-toggle-slot');

    const brand = createElement('div', 'v4-brand', `${svg('logo')}<div><strong>Classroom Seating Planner</strong><span>Plan rooms, place students, and share safely</span></div>`);
    const classDock = createElement('div', 'v4-class-dock');
    const quickDock = createElement('div', 'v4-quick-dock');
    const utilityDock = createElement('div', 'v4-utility-dock');
    const originalHeaderControls = createElement('div', 'v4-original-controls');
    originalHeaderControls.id = 'v4OriginalControls';
    originalHeaderControls.hidden = true;
    originalHeaderControls.setAttribute('aria-hidden', 'true');
    originalHeaderControls.inert = true;

    if (classManager) {
      const label = classManager.querySelector('label');
      if (label) label.textContent = 'Current class';
      classDock.appendChild(classManager);
      const classMenuButton = createElement('button', 'secondary v4-icon-button', svg('more'));
      classMenuButton.id = 'v4ClassMenuBtn';
      classMenuButton.type = 'button';
      classMenuButton.setAttribute('aria-label', 'Open class actions');
      classMenuButton.title = 'Class actions';
      classDock.appendChild(classMenuButton);
      const menu = createElement('div', 'v4-popover v4-class-menu');
      menu.id = 'v4ClassMenu';
      menu.setAttribute('role', 'menu');
      ['newClassBtn', 'renameClassBtn', 'duplicateClassBtn', 'classToolsBtn', 'deleteClassBtn'].forEach(id => {
        const node = classManager.querySelector(`#${id}`);
        if (node) menu.appendChild(node);
      });
      classDock.appendChild(menu);
    }

    const inlineSaveStatus = document.getElementById('inlineSaveStatus');
    if (inlineSaveStatus) quickDock.appendChild(inlineSaveStatus);
    const quickIds = ['undoBtn', 'redoBtn', 'saveLoadMenuBtn', 'printBtn'];
    quickIds.forEach(id => {
      const node = document.getElementById(id);
      if (node) quickDock.appendChild(node);
    });
    buttonLabel(document.getElementById('undoBtn'), 'undo', 'Undo', { iconOnly: true });
    buttonLabel(document.getElementById('redoBtn'), 'redo', 'Redo', { iconOnly: true });
    buttonLabel(document.getElementById('saveLoadMenuBtn'), 'save', 'Save', { iconOnly: true });
    buttonLabel(document.getElementById('printBtn'), 'print', 'Print', { iconOnly: true });

    const commandButton = createElement('button', 'secondary v4-command-button', `${svg('search')}<span>Find a command</span><kbd>Ctrl K</kbd>`);
    commandButton.id = 'v4CommandButton';
    commandButton.type = 'button';
    utilityDock.appendChild(commandButton);

    const help = document.getElementById('helpGuideBtn');
    const snapshot = document.getElementById('snapshotQuickBtn');
    const settings = document.getElementById('settingsBtn');
    if (help) utilityDock.appendChild(help);
    if (snapshot) utilityDock.appendChild(snapshot);
    if (settings) utilityDock.appendChild(settings);
    buttonLabel(help, 'help', 'Help', { iconOnly: true });
    buttonLabel(snapshot, 'snapshot', 'Take snapshot', { iconOnly: true });
    buttonLabel(settings, 'settings', 'Settings', { iconOnly: true });

    const moreButton = createElement('button', 'secondary v4-icon-button', svg('more'));
    moreButton.id = 'v4MoreMenuBtn';
    moreButton.type = 'button';
    moreButton.setAttribute('aria-label', 'Open more actions');
    moreButton.title = 'More actions';
    utilityDock.appendChild(moreButton);

    const moreMenu = createElement('div', 'v4-popover v4-more-menu');
    moreMenu.id = 'v4MoreMenu';
    moreMenu.setAttribute('role', 'menu');
    ['guidedLearningBtn', 'visibilityModeBtn', 'pageLockBtn'].forEach(id => {
      const node = document.getElementById(id);
      if (node) moreMenu.appendChild(node);
    });
    utilityDock.appendChild(moreMenu);
    buttonLabel(document.getElementById('visibilityModeBtn'), 'eye', 'Presentation mode');
    buttonLabel(document.getElementById('pageLockBtn'), 'lock', 'Lock workspace');

    [headerActions, settingsSlot, toggleSlot, originalHeaderTitle].forEach(container => {
      if (!container) return;
      [...container.children].forEach(child => originalHeaderControls.appendChild(child));
      container.remove();
    });
    document.body.appendChild(originalHeaderControls);
    header.replaceChildren(brand, classDock, quickDock, utilityDock);
  }

  function buildWorkflowNavigation() {
    const header = document.querySelector('.v4-topbar');
    if (!header || document.getElementById('v4WorkflowNav')) return;
    const shell = createElement('div', 'v4-workflow-shell no-print');
    const nav = createElement('nav', 'v4-workflow-nav');
    nav.id = 'v4WorkflowNav';
    nav.setAttribute('aria-label', 'Planning workflow');
    Object.entries(WORKFLOWS).forEach(([key, item]) => {
      const button = createElement('button', 'v4-workflow-step', `${svg(key === 'seating' ? 'seating' : key)}<span class="v4-step-number">${item.number}</span><span class="v4-step-copy"><strong data-mobile-label="${item.short}">${item.label}</strong><small>${workflowStepHint(key)}</small></span><span class="v4-step-state" aria-hidden="true"></span>`);
      button.type = 'button';
      button.dataset.workflow = key;
      button.setAttribute('aria-label', `Step ${item.number}: ${item.label}`);
      button.setAttribute('aria-pressed', 'false');
      nav.appendChild(button);
    });
    const context = createElement('section', 'v4-workflow-context');
    context.id = 'v4WorkflowContext';
    context.innerHTML = `<div class="v4-context-copy"><span id="v4ContextKicker">Step 01</span><h2 id="v4ContextTitle"></h2><p id="v4ContextDescription"></p></div><div class="v4-context-actions"><button id="v4ContextSecondary" class="secondary" type="button"></button><button id="v4ContextPrimary" type="button"></button></div>`;
    shell.append(nav, context);
    header.after(shell);
  }

  function workflowStepHint(key) {
    return ({ setup: 'Roster & rules', room: 'Layout & objects', seating: 'Place & generate', review: 'Validate & refine', share: 'Protect & distribute' })[key];
  }

  function buildSetupDashboard() {
    const main = document.querySelector('main.app');
    if (!main || document.getElementById('v4SetupDashboard')) return;
    const panel = createElement('section', 'panel v4-dashboard v4-setup-dashboard');
    panel.id = 'v4SetupDashboard';
    panel.innerHTML = `
          <div class="v4-dashboard-header">
            <div><span class="v4-eyebrow">Class readiness</span><h2>Set up the class</h2><p>Add the roster first, then define only the seating rules and zones you actually need.</p></div>
            <div class="v4-readiness-ring" id="v4ReadinessRing"><strong id="v4ReadinessPercent">0%</strong><span>ready</span></div>
          </div>
          <div class="v4-metric-grid">
            <article><span>Students</span><strong id="v4SetupStudents">0</strong><small id="v4SetupStudentsNote">Add or import a roster</small></article>
            <article><span>Seating rules</span><strong id="v4SetupRules">0</strong><small>Groups and individual needs</small></article>
            <article><span>Zones</span><strong id="v4SetupZones">0</strong><small>Optional room preferences</small></article>
            <article><span>Room seats</span><strong id="v4SetupSeats">0</strong><small>Designed in the next step</small></article>
          </div>
          <div class="v4-dashboard-grid">
            <article class="v4-feature-card v4-feature-primary">
              <div class="v4-feature-icon">${svg('setup')}</div><div><span class="v4-eyebrow">Start here</span><h3>Add the roster</h3><p>Add students individually or reconcile a CSV export while preserving existing notes and requirements.</p><div class="button-row"><button type="button" data-v4-action="focus-add-student">Add student</button><button type="button" class="secondary" data-v4-action="import-roster">Import roster</button></div></div>
            </article>
            <article class="v4-feature-card">
              <div class="v4-feature-icon">${svg('review')}</div><div><h3>Define groups and seating rules</h3><p>Create shared together, apart, location, and support rules. Use Student Needs for individual requirements.</p><button type="button" class="secondary" data-v4-action="open-rules">Open Groups &amp; Rules</button></div>
            </article>
            <article class="v4-feature-card">
              <div class="v4-feature-icon">${svg('room')}</div><div><h3>Prepare room zones</h3><p>Name meaningful areas such as Front Left, Near Teacher, or Quiet Work before generating seats.</p><button type="button" class="secondary" data-v4-action="open-zones">Open zones</button></div>
            </article>
            <article class="v4-feature-card">
              <div class="v4-feature-icon">${svg('share')}</div><div><h3>Reuse a previous class</h3><p>Roll over a roster, room, or rules without copying assignments you no longer need.</p><button type="button" class="secondary" data-v4-action="class-tools">Class rollover</button></div>
            </article>
          </div>`;
    main.appendChild(panel);
  }

  function buildShareDashboard() {
    const main = document.querySelector('main.app');
    if (!main || document.getElementById('v4ShareDashboard')) return;
    const panel = createElement('section', 'panel v4-dashboard v4-share-dashboard');
    panel.id = 'v4ShareDashboard';
    panel.innerHTML = `
          <div class="v4-dashboard-header">
            <div><span class="v4-eyebrow">Save & share</span><h2>Save the working file, then choose an output</h2><p>Keep the editable planner separate from printouts and audience-specific exports.</p></div>
            <div class="v4-security-badge">${svg('shield')}<span><strong>Privacy first</strong><small>Review included fields before export</small></span></div>
          </div>
          <div class="v4-share-summary" id="v4ShareSummary"><strong id="v4ShareClassName">Current class</strong><span id="v4ShareCounts">0 students · 0 placed</span><span id="v4ShareSaveState">Checking save status…</span></div>
          <div class="v4-share-grid">
            <article class="v4-share-card v4-share-card-primary"><div class="v4-share-icon">${svg('save')}</div><span class="v4-eyebrow">Working file</span><h3>Save the editable planner</h3><p>Use encrypted browser storage, a linked file, or Google Drive for the complete working copy.</p><button type="button" data-v4-action="save">Open save options</button></article>
            <article class="v4-share-card"><div class="v4-share-icon">${svg('snapshot')}</div><span class="v4-eyebrow">Recovery</span><h3>Create a snapshot</h3><p>Capture a restore point before a major roster, room, or seating change.</p><button type="button" class="secondary" data-v4-action="snapshot">Take snapshot</button></article>
            <article class="v4-share-card"><div class="v4-share-icon">${svg('print')}</div><span class="v4-eyebrow">Paper or PDF</span><h3>Print a purpose-built chart</h3><p>Choose names-only, substitute, notes, details, paper size, and Freeform page handling.</p><button type="button" class="secondary" data-v4-action="print">Open print options</button></article>
            <article class="v4-share-card"><div class="v4-share-icon">${svg('share')}</div><span class="v4-eyebrow">Controlled export</span><h3>Share only what is needed</h3><p>Create teacher, substitute, student-facing, support-team, anonymous, or room-only files.</p><button type="button" class="secondary" data-v4-action="safe-share">Safe sharing presets</button></article>
          </div>
          <section class="v4-privacy-checklist"><div><span class="v4-eyebrow">Before distributing</span><h3>Quick privacy check</h3></div><ul><li>Use an encrypted save for the full editable file.</li><li>Keep private and substitute notes out of student-facing copies.</li><li>Verify the recipient and included fields before sending.</li><li>Create a snapshot before replacing a shared or linked file.</li></ul><button type="button" class="ghost" data-v4-action="diagnostics">Storage diagnostics</button></section>`;
    main.appendChild(panel);
  }

  function buildStudentSearch() {
    if (document.getElementById('v4StudentSearch')) return;
    const list = document.getElementById('studentList');
    const section = list?.closest('.section');
    if (!list || !section) return;
    const search = createElement('div', 'v4-student-search', `${svg('search')}<input id="v4StudentSearch" type="search" autocomplete="off" placeholder="Find a student…" aria-label="Filter student list"><button id="v4StudentSearchClear" class="ghost v4-icon-button" type="button" aria-label="Clear student search">${svg('close')}</button>`);
    section.insertBefore(search, list);
    const apply = () => {
      const term = String(document.getElementById('v4StudentSearch')?.value || '').trim().toLowerCase();
      list.querySelectorAll('.student-card').forEach(card => {
        card.hidden = Boolean(term && !card.textContent.toLowerCase().includes(term));
      });
    };
    document.getElementById('v4StudentSearch')?.addEventListener('input', apply);
    document.getElementById('v4StudentSearchClear')?.addEventListener('click', () => {
      const input = document.getElementById('v4StudentSearch');
      if (input) { input.value = ''; input.focus(); }
      apply();
    });
    new MutationObserver(apply).observe(list, { childList: true, subtree: true });
  }

  function buildCommandPalette() {
    if (document.getElementById('v4CommandPalette')) return;
    const backdrop = createElement('div', 'modal-backdrop v4-command-backdrop');
    backdrop.id = 'v4CommandPalette';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'v4CommandTitle');
    backdrop.innerHTML = `<div class="v4-command-panel"><div class="v4-command-search">${svg('search')}<input id="v4CommandInput" autocomplete="off" placeholder="Search actions, workflows, and tools…" aria-label="Search commands"><kbd>Esc</kbd></div><div class="v4-command-heading"><strong id="v4CommandTitle">Commands</strong><span>Use ↑ ↓ and Enter</span></div><div id="v4CommandResults" class="v4-command-results"></div></div>`;
    document.body.appendChild(backdrop);
  }

  function commandDefinitions() {
    const commands = [
      ['Go to Class Setup', 'Roster, students, rules, and zones', 'setup', () => setWorkflow('setup'), 'setup'],
      ['Go to Room Design', 'Grid and Freeform layout tools', 'room', () => setWorkflow('room'), 'room'],
      ['Go to Seat Students', 'Manual placement and generated seating options', 'seating', () => setWorkflow('seating'), 'seating'],
      ['Go to Review', 'Rule report and assignment status', 'review', () => setWorkflow('review'), 'review'],
      ['Go to Save & Share', 'Backups, printing, and controlled exports', 'share', () => setWorkflow('share'), 'share'],
      ['Generate seating options', 'Compare rule matches before applying', 'seating', () => document.getElementById('generateBtn')?.click(), 'seating'],
      ['Add a student', 'Open the roster and focus the new-student form', 'setup', () => runAction('focus-add-student'), 'setup'],
      ['Import or reconcile roster', 'Load a CSV roster', 'setup', () => runAction('import-roster'), 'setup'],
      ['Open room tools', 'Groups, alignment, layers, history, and print pages', 'room', () => document.getElementById('openFreeformWorkspaceBtn')?.click(), 'room'],
      ['Insert a Freeform preset', 'Pods, testing rows, lab stations, meeting areas, and accessible pathways', 'room', () => ClassroomWorkflowV53.openPresets(), 'room'],
      ['Audit Freeform room', 'Find overlaps, invalid objects, and assignment problems', 'review', () => document.getElementById('openFreeformAuditBtn')?.click(), 'review'],
      ['Open Today mode', 'Attendance, temporary guests, notes, and present-student seating', 'seating', () => ClassroomWorkflowV53.openTodayMode(), 'seating'],
      ['Open named seating plans', 'Save, compare, and restore room or assignment versions', 'seating', () => ClassroomWorkflowV53.openSeatingPlans(), 'seating'],
      ['Search planner data', 'Find classes, students, rules, zones, templates, and saved plans', 'search', () => ClassroomWorkflowV53.openGlobalSearch()],
      ['Save options', 'Encrypted local, linked-file, and Drive saves', 'share', () => openSaveSetupModal(), 'save'],
      ['Print options', 'Names, notes, details, and page setup', 'share', () => document.getElementById('printBtn')?.click(), 'review'],
      ['Safe sharing presets', 'Purpose-specific exports with field review', 'share', () => ModernizationSuite.openSafeShare(), 'share'],
      ['Take a snapshot', 'Create a restore point', 'share', () => document.getElementById('snapshotQuickBtn')?.click(), 'save'],
      ['Open settings', 'Security, defaults, appearance, saving, and Drive', 'settings', () => document.getElementById('settingsBtn')?.click(), 'settings'],
      ['Open help guide', 'Search all features and workflows', 'help', () => document.getElementById('helpGuideBtn')?.click()],
      ['Lock workspace', 'Protect the active chart', 'security', () => document.getElementById('pageLockBtn')?.click(), 'settings'],
      ['Focus workspace', 'Hide workflow guidance and maximize the active working area', 'room', () => WorkspaceLayoutV41.toggleFocusMode(), 'room'],
      ['Minimize workflow guidance', 'Replace the workflow header with a compact stage ribbon', 'room', () => WorkspaceLayoutV41.toggleWorkflow(), 'room'],
      ['Reset workspace layout', 'Restore expanded headers, panels, and dashboard summaries', 'settings', () => WorkspaceLayoutV41.resetLayout(), 'settings']
    ].map((item, index) => ({ id: `command-${index}`, title: item[0], description: item[1], category: item[2], run: item[3], accessArea: item[4] || '' }));
    return commands.filter(command => !command.accessArea || document.body.dataset[`collab${command.accessArea[0].toUpperCase()}${command.accessArea.slice(1)}`] !== 'none');
  }

  function renderCommands(query = '') {
    const results = document.getElementById('v4CommandResults');
    if (!results) return;
    const term = String(query || '').trim().toLowerCase();
    const commands = commandDefinitions().filter(item => !term || `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(term));
    results.innerHTML = commands.length ? commands.map((item, index) => `<button type="button" class="v4-command-result${index === 0 ? ' active' : ''}" data-command-id="${item.id}"><span class="v4-command-result-icon">${svg(item.category === 'seating' ? 'seating' : (ICONS[item.category] ? item.category : 'arrow'))}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></span><kbd>Enter</kbd></button>`).join('') : '<div class="v4-command-empty">No matching commands.</div>';
  }

  function openCommandPalette() {
    if (uiState.visibilityMode) {
      setLiveStatusMessage('Command search is hidden in Presentation mode. Exit Presentation mode to use editing commands.');
      return;
    }
    const modal = document.getElementById('v4CommandPalette');
    if (!modal) return;
    modal.classList.add('show');
    renderCommands('');
    const input = document.getElementById('v4CommandInput');
    if (input) { input.value = ''; setTimeout(() => input.focus(), 0); }
  }

  function closeCommandPalette() {
    document.getElementById('v4CommandPalette')?.classList.remove('show');
  }

  function executeCommand(id) {
    const command = commandDefinitions().find(item => item.id === id);
    if (!command) return;
    closeCommandPalette();
    command.run();
  }

  function runAction(action) {
    const accessArea = ({ save: 'save', 'class-tools': 'classes', 'room-tools': 'room', 'room-audit': 'review', generate: 'seating', randomize: 'seating', analyze: 'review', 'names-only': 'review', print: 'review', snapshot: 'save', diagnostics: 'settings', 'safe-share': 'share', 'setup-students': 'setup', 'focus-add-student': 'setup', 'import-roster': 'setup', 'open-rules': 'setup', 'open-zones': 'setup' })[action] || '';
    const accessMode = accessArea ? document.body.dataset[`collab${accessArea[0].toUpperCase()}${accessArea.slice(1)}`] : '';
    if (accessArea && accessMode === 'none') {
      setLiveStatusMessage(`${COLLABORATION_AREA_LABELS[accessArea] || 'This command'} is hidden by your collaborator interface profile.`);
      return;
    }
    if (['save', 'generate', 'randomize', 'snapshot'].includes(action) && accessArea && accessMode === 'view') {
      setLiveStatusMessage(`${COLLABORATION_AREA_LABELS[accessArea] || 'This command'} is view only for your collaborator account.`);
      return;
    }
    if (action === 'save') {
      closePopovers();
      hideSaveLoadMenu();
      openSaveSetupModal();
      return;
    }
    if (action === 'room-tools' && isMobileViewport() && activeWorkflow === 'room') {
      setMobileLayoutOptionsOpen(!uiState.mobileLayoutOptionsOpen);
      return;
    }
    const clicks = {
      'class-tools': 'classToolsBtn',
      'room-tools': 'openFreeformWorkspaceBtn',
      'room-audit': 'openFreeformAuditBtn',
      generate: 'generateBtn',
      randomize: 'randomizeAllBtn',
      analyze: 'analyzeBtn',
      'names-only': 'layoutNamesOnlyBtn',
      print: 'printBtn',
      snapshot: 'snapshotQuickBtn',
      diagnostics: 'deploymentDiagnosticsBtn'
    };
    if (clicks[action]) {
      const target = document.getElementById(clicks[action]);
      if (target) target.click();
      return;
    }
    if (action === 'safe-share') {
      ModernizationSuite.openSafeShare();
      return;
    }
    if (action === 'setup-students' || action === 'focus-add-student') {
      setWorkflow('setup');
      ClassSetupWorkspaceV54?.setSection?.('students');
      document.getElementById('studentsSideTabBtn')?.click();
      const expand = document.getElementById('toggleAddStudentBtn');
      if (document.getElementById('addStudentBody')?.classList.contains('collapsed')) expand?.click();
      setTimeout(() => document.getElementById('firstName')?.focus(), 40);
      return;
    }
    if (action === 'import-roster') {
      setWorkflow('setup');
      ClassSetupWorkspaceV54?.setSection?.('import');
      document.getElementById('studentsSideTabBtn')?.click();
      const body = document.getElementById('csvImportBody');
      if (body?.classList.contains('collapsed')) document.getElementById('toggleCsvImportBtn')?.click();
      setTimeout(() => document.getElementById('csvFile')?.focus(), 40);
      return;
    }
    if (action === 'open-rules') {
      setWorkflow('setup');
      ClassSetupWorkspaceV54?.setSection?.('rules');
      document.getElementById('groupsSideTabBtn')?.click();
      return;
    }
    if (action === 'open-zones') {
      setWorkflow('setup');
      ClassSetupWorkspaceV54?.setSection?.('zones');
      document.getElementById('zonesSideTabBtn')?.click();
    }
  }

  function setWorkflow(key, options = {}) {
    if (!WORKFLOWS[key]) key = 'setup';
    if (uiState.visibilityMode && key !== 'review') {
      if (!options.silent) setLiveStatusMessage('Presentation mode stays in Review. Exit Presentation mode to open editing workflows.');
      key = 'review';
    }
    if (activeWorkflow === 'room' && key !== 'room') {
      if (uiState.gridResizeModeActive) cancelGridResizeMode({ announce: false });
      if (uiState.designMode) {
        uiState.designMode = false;
        hideDesignModeTooltip();
        applyDesignModeUi();
        renderGrid();
      }
    }
    const requestedAccessKey = `collab${key[0].toUpperCase()}${key.slice(1)}`;
    if (document.body.dataset[requestedAccessKey] === 'none') {
      const fallback = Object.keys(WORKFLOWS).find(workflow => document.body.dataset[`collab${workflow[0].toUpperCase()}${workflow.slice(1)}`] !== 'none');
      if (!fallback) return false;
      if (!options.silent) setLiveStatusMessage(`${WORKFLOWS[key].label} is hidden by your collaborator interface profile.`);
      key = fallback;
    }
    if (!['room', 'seating', 'review'].includes(key)) uiState.mobileRoomActionsOpen = false;
    if (key !== 'room') {
      uiState.mobileLayoutOptionsOpen = false;
      uiState.mobileRoomCanvasFocus = false;
    }
    activeWorkflow = key;
    document.body.dataset.workflow = key;
    safeStorageSet('sessionStorage', 'seatingPlannerWorkflow', key)
    applyMobileLayoutToolsPreference(key);
    if (isMobileViewport()) setMobilePanel('layout');
    else syncMobilePanelNavigation('layout');
    document.querySelectorAll('.v4-workflow-step[data-workflow]').forEach(button => {
      const active = button.dataset.workflow === key;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const item = WORKFLOWS[key];
    const kicker = document.getElementById('v4ContextKicker');
    const title = document.getElementById('v4ContextTitle');
    const description = document.getElementById('v4ContextDescription');
    const primary = document.getElementById('v4ContextPrimary');
    const secondary = document.getElementById('v4ContextSecondary');
    if (kicker) kicker.textContent = `Step ${item.number} of 05`;
    if (title) title.textContent = item.title;
    if (description) description.textContent = item.description;
    if (primary) { primary.innerHTML = `<span>${item.primary.label}</span>${svg('arrow')}`; primary.dataset.v4Action = item.primary.action; }
    if (secondary) { secondary.textContent = item.secondary.label; secondary.dataset.v4Action = item.secondary.action; }
    if (key === 'seating') document.getElementById('studentsSideTabBtn')?.click();
    closePopovers();
    updateExperience();
    ClassSetupWorkspaceV54?.onWorkflowChange?.(key);
    if (!options.silent) {
      const workspace = document.querySelector('main.app');
      if (workspace) workspace.scrollTop = 0;
    }
  }

  function readiness() {
    const studentCount = Number(document.getElementById('statStudents')?.textContent || state?.students?.length || 0);
    const seatCount = Number(document.getElementById('statSeats')?.textContent || 0);
    const placedCount = Number(document.getElementById('statPlaced')?.textContent || 0);
    const groupCount = Number(document.getElementById('groupCount')?.textContent || state?.groups?.length || 0);
    const zoneCount = Number(document.getElementById('zoneCount')?.textContent || state?.zones?.length || 0);
    const individualRuleCount = Array.isArray(state?.students) ? state.students.filter(student => student.requirements && Object.values(student.requirements).some(value => Array.isArray(value) ? value.length : Boolean(value))).length : 0;
    const rules = groupCount + individualRuleCount;
    const setupReady = studentCount > 0;
    const roomReady = studentCount > 0 && seatCount >= studentCount;
    const seatingReady = studentCount > 0 && placedCount >= studentCount;
    const reviewReady = seatingReady && !document.querySelector('#ruleReport .violation');
    const percent = Math.round(([setupReady, roomReady, seatingReady, reviewReady].filter(Boolean).length / 4) * 100);
    return { studentCount, seatCount, placedCount, groupCount, zoneCount, rules, setupReady, roomReady, seatingReady, reviewReady, percent };
  }

  function updateExperience() {
    const data = readiness();
    const ring = document.getElementById('v4ReadinessRing');
    if (ring) ring.style.setProperty('--readiness', `${data.percent * 3.6}deg`);
    const values = {
      v4ReadinessPercent: `${data.percent}%`,
      v4SetupStudents: String(data.studentCount),
      v4SetupRules: String(data.rules),
      v4SetupZones: String(data.zoneCount),
      v4SetupSeats: String(data.seatCount)
    };
    Object.entries(values).forEach(([id, value]) => { const node = document.getElementById(id); if (node) node.textContent = value; });
    const note = document.getElementById('v4SetupStudentsNote');
    if (note) note.textContent = data.studentCount ? `${data.studentCount} roster record${data.studentCount === 1 ? '' : 's'}` : 'Add or import a roster';
    const completion = { setup: data.setupReady, room: data.roomReady, seating: data.seatingReady, review: data.reviewReady, share: Boolean(document.getElementById('inlineSaveStatus')?.textContent && !/not saved/i.test(document.getElementById('inlineSaveStatus').textContent)) };
    document.querySelectorAll('.v4-workflow-step').forEach(button => {
      button.classList.toggle('complete', Boolean(completion[button.dataset.workflow]));
      const stateNode = button.querySelector('.v4-step-state');
      if (stateNode) stateNode.textContent = completion[button.dataset.workflow] ? '✓' : '';
    });
    const className = document.getElementById('classSelect')?.selectedOptions?.[0]?.textContent || 'Current class';
    const shareClass = document.getElementById('v4ShareClassName');
    const shareCounts = document.getElementById('v4ShareCounts');
    const shareState = document.getElementById('v4ShareSaveState');
    if (shareClass) shareClass.textContent = className;
    if (shareCounts) shareCounts.textContent = `${data.studentCount} student${data.studentCount === 1 ? '' : 's'} · ${data.placedCount} placed · ${data.seatCount} seats`;
    if (shareState) shareState.textContent = document.getElementById('inlineSaveStatus')?.textContent || 'Browser save status unavailable';
    const title = document.querySelector('.center-panel > .panel-header > h2');
    if (title) title.textContent = activeWorkflow === 'room' ? 'Classroom canvas' : activeWorkflow === 'seating' ? 'Seating workspace' : activeWorkflow === 'review' ? 'Chart preview' : 'Classroom workspace';
    syncMobileRoomActions();
  }

  function mobileRoomActionLabel(button) {
    const visibleText = String(button?.textContent || '').trim().replace(/\s+/g, ' ');
    if (/[A-Za-z0-9]/.test(visibleText)) return visibleText;
    return String(button?.getAttribute('aria-label') || button?.title || 'Room action').trim().replace(/\s+/g, ' ');
  }

  function mobileRoomActionIds(workflow = activeWorkflow) {
    const shared = ['todayModeBtn', 'hideUnassignedTitlesBtn', 'openSeatingPlansBtn', 'globalSearchBtn', 'layoutNamesOnlyBtn'];
    if (workflow === 'room') {
      const freeform = state.layoutMode === 'freeform' ? ['openFreeformWorkspaceBtn', 'openFreeformPresetsBtn', 'openFreeformAuditBtn'] : [];
      return [...freeform, 'openRoomTemplatesBtn', ...shared];
    }
    if (workflow === 'seating') return ['generateBtn', 'randomizeAllBtn', 'guideRandomSeatingBtn', 'clearAssignmentsBtn', 'clearAnchorsBtn', ...shared];
    if (workflow === 'review') return shared;
    return [];
  }

  function mobileRoomActionTitle(workflow = activeWorkflow) {
    if (workflow === 'seating') return 'Seating actions';
    if (workflow === 'review') return 'Review actions';
    return 'Room actions';
  }

  function renderMobileRoomModeBar() {
    const center = document.querySelector('main.app > .center-panel');
    if (!center) return null;
    let bar = document.getElementById('mobileRoomModeBar');
    if (!bar) {
      bar = createElement('section', 'mobile-room-mode-bar no-print', `
        <div class="mobile-room-mode-copy"><div><span class="class-setup-eyebrow">Room type</span><strong id="mobileRoomModeTitle">Standard Grid</strong></div><button id="mobileCanvasFocusBtn" class="secondary mobile-canvas-focus-button" type="button" aria-pressed="false" title="Hide the mobile interface and give the classroom canvas the full screen">Canvas only</button></div>
        <div class="mobile-room-mode-switch" role="group" aria-label="Choose room layout type">
          <button id="mobileGridModeBtn" class="secondary" type="button" data-mobile-layout-mode="grid" aria-pressed="true">Grid</button>
          <button id="mobileFreeformModeBtn" class="secondary" type="button" data-mobile-layout-mode="freeform" aria-pressed="false">Freeform</button>
        </div>
        <div class="mobile-room-mode-actions">
          <button id="mobileLayoutOptionsBtn" type="button" aria-expanded="false" aria-controls="layoutToolsPanel">Grid options</button>
          <button id="mobileMoreRoomActionsBtn" class="secondary" type="button" aria-expanded="false" aria-controls="mobileRoomActionsPanel">More actions</button>
        </div>`);
      bar.id = 'mobileRoomModeBar';
      center.insertBefore(bar, document.getElementById('layoutToolsPanel') || center.firstChild);
      bar.addEventListener('click', event => {
        const modeButton = event.target.closest('[data-mobile-layout-mode]');
        if (modeButton) {
          switchLayoutMode(modeButton.dataset.mobileLayoutMode);
          return;
        }
        if (event.target.closest('#mobileLayoutOptionsBtn')) {
          setMobileLayoutOptionsOpen(!uiState.mobileLayoutOptionsOpen);
          return;
        }
        if (event.target.closest('#mobileMoreRoomActionsBtn')) {
          setMobileRoomActionsOpen(!uiState.mobileRoomActionsOpen);
          return;
        }
        if (event.target.closest('#mobileCanvasFocusBtn')) setMobileRoomCanvasFocus(true);
      });
      document.getElementById('closeMobileLayoutToolsBtn')?.addEventListener('click', () => setMobileLayoutOptionsOpen(false));
    }
    let focusExit = document.getElementById('mobileCanvasFocusExitBtn');
    if (!focusExit) {
      focusExit = createElement('button', 'mobile-canvas-focus-exit no-print');
      focusExit.id = 'mobileCanvasFocusExitBtn';
      focusExit.type = 'button';
      focusExit.hidden = true;
      focusExit.setAttribute('aria-label', 'Show Room Design controls');
      focusExit.title = 'Show Room Design controls';
      focusExit.innerHTML = '<span aria-hidden="true">☰</span>';
      focusExit.addEventListener('click', () => setMobileRoomCanvasFocus(false));
      document.body.appendChild(focusExit);
    }
    let backdrop = document.getElementById('mobileLayoutOptionsBackdrop');
    if (!backdrop) {
      backdrop = createElement('button', 'mobile-layout-options-backdrop no-print');
      backdrop.id = 'mobileLayoutOptionsBackdrop';
      backdrop.type = 'button';
      backdrop.setAttribute('aria-label', 'Close layout options');
      backdrop.hidden = true;
      backdrop.addEventListener('click', () => setMobileLayoutOptionsOpen(false));
      document.body.appendChild(backdrop);
    }
    return bar;
  }

  function syncMobileLayoutOptionsUi() {
    const available = isMobileViewport() && activeWorkflow === 'room' && !uiState.visibilityMode && !uiState.mobileRoomCanvasFocus;
    if (!available) uiState.mobileLayoutOptionsOpen = false;
    const open = Boolean(available && uiState.mobileLayoutOptionsOpen);
    document.body.classList.toggle('mobile-layout-options-open', open);
    const backdrop = document.getElementById('mobileLayoutOptionsBackdrop');
    if (backdrop) backdrop.hidden = !open;
    const mode = state.layoutMode === 'freeform' ? 'freeform' : 'grid';
    const modeLabel = mode === 'freeform' ? 'Freeform Room' : 'Standard Grid';
    const optionsLabel = mode === 'freeform' ? 'Freeform options' : 'Grid options';
    const title = document.getElementById('mobileRoomModeTitle');
    if (title) title.textContent = modeLabel;
    document.querySelectorAll('[data-mobile-layout-mode]').forEach(button => {
      const active = button.dataset.mobileLayoutMode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const optionsButton = document.getElementById('mobileLayoutOptionsBtn');
    if (optionsButton) {
      optionsButton.textContent = open ? `Close ${optionsLabel}` : optionsLabel;
      optionsButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    const summary = document.getElementById('mobileLayoutToolsModeSummary');
    if (summary) summary.textContent = optionsLabel;
    const close = document.getElementById('closeMobileLayoutToolsBtn');
    if (close) close.hidden = !available;
  }

  function setMobileLayoutOptionsOpen(open, { announce = true } = {}) {
    const allowed = isMobileViewport() && activeWorkflow === 'room' && !uiState.visibilityMode && !uiState.mobileRoomCanvasFocus;
    uiState.mobileLayoutOptionsOpen = Boolean(open && allowed);
    if (uiState.mobileLayoutOptionsOpen) {
      uiState.mobileRoomActionsOpen = false;
      document.body.classList.remove('layout-tools-collapsed');
      refreshLayoutToolsToggle();
    }
    syncMobileRoomActions();
    if (announce) {
      setLiveStatusMessage(uiState.mobileLayoutOptionsOpen
        ? `${state.layoutMode === 'freeform' ? 'Freeform' : 'Grid'} layout options opened. Close the panel to return to the room.`
        : 'Layout options closed.');
    }
  }

  function syncMobileRoomCanvasFocus() {
    const available = isMobileViewport() && activeWorkflow === 'room' && !uiState.visibilityMode;
    if (!available) uiState.mobileRoomCanvasFocus = false;
    const active = Boolean(available && uiState.mobileRoomCanvasFocus);
    document.body.classList.toggle('mobile-room-canvas-focus', active);
    const enter = document.getElementById('mobileCanvasFocusBtn');
    if (enter) {
      enter.setAttribute('aria-pressed', active ? 'true' : 'false');
      enter.textContent = active ? 'Canvas only active' : 'Canvas only';
    }
    const exit = document.getElementById('mobileCanvasFocusExitBtn');
    if (exit) exit.hidden = !active;
  }

  function setMobileRoomCanvasFocus(open, { announce = true } = {}) {
    const allowed = isMobileViewport() && activeWorkflow === 'room' && !uiState.visibilityMode;
    uiState.mobileRoomCanvasFocus = Boolean(open && allowed);
    if (uiState.mobileRoomCanvasFocus) {
      uiState.mobileRoomActionsOpen = false;
      uiState.mobileLayoutOptionsOpen = false;
    }
    syncMobileRoomActions();
    if (announce) setLiveStatusMessage(uiState.mobileRoomCanvasFocus
      ? 'Canvas-only view active. Use the floating controls button to restore Room Design controls.'
      : 'Room Design controls restored.');
  }

  function normalizeMobileCloseButtons(root = document) {
    const candidates = [];
    if (root instanceof HTMLButtonElement) candidates.push(root);
    if (root?.querySelectorAll) candidates.push(...root.querySelectorAll('button'));
    candidates.forEach(button => {
      const text = String(button.textContent || '').trim().replace(/\s+/g, ' ');
      const isClose = /^close$/i.test(text) || /^close[A-Z0-9_-]/.test(button.id || '') || /CancelTopBtn$/.test(button.id || '');
      if (!isClose) return;
      button.classList.add('mobile-compact-close');
      if (!button.getAttribute('aria-label') && /^close$/i.test(text)) button.setAttribute('aria-label', 'Close');
      if (!button.title && /^close$/i.test(text)) button.title = 'Close';
    });
  }

  function observeMobileCloseButtons() {
    if (mobileCloseObserver || !document.body) return;
    mobileCloseObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) normalizeMobileCloseButtons(node);
      }));
    });
    mobileCloseObserver.observe(document.body, { childList: true, subtree: true });
  }

  function renderMobileRoomActions() {
    const center = document.querySelector('main.app > .center-panel');
    const source = center?.querySelector(':scope > .panel-header .button-row');
    if (!center || !source) return null;
    let toggleRow = document.getElementById('mobileRoomActionsToggleRow');
    if (!toggleRow) {
      toggleRow = createElement('div', 'mobile-room-actions-toggle-row no-print', '<button id="mobileRoomActionsToggleBtn" class="secondary" type="button" aria-expanded="false" aria-controls="mobileRoomActionsPanel">Room actions</button>');
      toggleRow.id = 'mobileRoomActionsToggleRow';
      center.insertBefore(toggleRow, document.getElementById('layoutToolsPanel') || center.firstChild);
      toggleRow.querySelector('#mobileRoomActionsToggleBtn')?.addEventListener('click', () => setMobileRoomActionsOpen(!uiState.mobileRoomActionsOpen));
    }
    let panel = document.getElementById('mobileRoomActionsPanel');
    if (!panel) {
      panel = createElement('section', 'mobile-room-actions-panel no-print');
      panel.id = 'mobileRoomActionsPanel';
      panel.setAttribute('aria-label', 'Room actions');
      center.insertBefore(panel, document.getElementById('layoutToolsPanel') || center.firstChild);
      panel.addEventListener('click', event => {
        const close = event.target.closest('#closeMobileRoomActionsBtn');
        if (close) {
          setMobileRoomActionsOpen(false);
          return;
        }
        const proxy = event.target.closest('[data-mobile-room-action-target]');
        if (!proxy) return;
        const target = document.getElementById(proxy.dataset.mobileRoomActionTarget);
        if (!target || target.disabled) return;
        target.click();
        requestAnimationFrame(() => {
          renderMobileRoomActions();
          if (target.id === 'toggleLayoutToolsBtn') setMobileRoomActionsOpen(false);
        });
      });
    }

    const buttons = mobileRoomActionIds().map(id => document.getElementById(id)).filter(button => button instanceof HTMLButtonElement && !button.hidden);
    const title = mobileRoomActionTitle();
    panel.setAttribute('aria-label', title);
    panel.innerHTML = `
      <div class="mobile-room-actions-header">
        <div><span class="class-setup-eyebrow">Workspace controls</span><strong>${title}</strong><small>${buttons.length} available</small></div>
        <button id="closeMobileRoomActionsBtn" class="secondary mobile-compact-close" type="button" aria-label="Close room actions" title="Close room actions">Close</button>
      </div>
      <div class="mobile-room-actions-grid"></div>`;
    const grid = panel.querySelector('.mobile-room-actions-grid');
    buttons.forEach(button => {
      const proxy = document.createElement('button');
      proxy.type = 'button';
      proxy.className = button.classList.contains('danger') ? 'danger' : 'secondary';
      proxy.dataset.mobileRoomActionTarget = button.id;
      proxy.disabled = button.disabled;
      proxy.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
      if (button.hasAttribute('aria-pressed')) proxy.setAttribute('aria-pressed', button.getAttribute('aria-pressed'));
      proxy.textContent = button.id === 'toggleLayoutToolsBtn'
        ? (document.body.classList.contains('layout-tools-collapsed') ? 'Show layout controls' : 'Hide layout controls')
        : mobileRoomActionLabel(button);
      grid.appendChild(proxy);
    });
    normalizeMobileCloseButtons(panel);
    return panel;
  }

  function syncMobileRoomActions() {
    const panel = renderMobileRoomActions();
    const modeBar = renderMobileRoomModeBar();
    const available = isMobileViewport() && ['room', 'seating', 'review'].includes(activeWorkflow) && !uiState.visibilityMode;
    const roomAvailable = available && activeWorkflow === 'room';
    if (!roomAvailable) uiState.mobileRoomCanvasFocus = false;
    const controlsAvailable = available && !uiState.mobileRoomCanvasFocus;
    if (!available) uiState.mobileRoomActionsOpen = false;
    if (!roomAvailable) uiState.mobileLayoutOptionsOpen = false;
    if (panel) panel.hidden = !(controlsAvailable && uiState.mobileRoomActionsOpen);
    if (modeBar) modeBar.hidden = !(roomAvailable && !uiState.mobileRoomCanvasFocus);
    document.body.classList.toggle('mobile-room-actions-open', Boolean(controlsAvailable && uiState.mobileRoomActionsOpen));
    const toggleRow = document.getElementById('mobileRoomActionsToggleRow');
    const toggle = document.getElementById('mobileRoomActionsToggleBtn');
    if (toggleRow) toggleRow.hidden = !(controlsAvailable && activeWorkflow !== 'room');
    if (toggle) {
      toggle.textContent = uiState.mobileRoomActionsOpen ? `Close ${mobileRoomActionTitle().toLowerCase()}` : mobileRoomActionTitle();
      toggle.setAttribute('aria-expanded', uiState.mobileRoomActionsOpen ? 'true' : 'false');
    }
    const moreButton = document.getElementById('mobileMoreRoomActionsBtn');
    if (moreButton) {
      moreButton.textContent = uiState.mobileRoomActionsOpen ? 'Close actions' : 'More actions';
      moreButton.setAttribute('aria-expanded', uiState.mobileRoomActionsOpen ? 'true' : 'false');
    }
    syncMobileRoomCanvasFocus();
    syncMobileLayoutOptionsUi();
    const primary = document.getElementById('v4ContextPrimary');
    if (primary && roomAvailable) {
      const open = Boolean(uiState.mobileLayoutOptionsOpen);
      primary.innerHTML = `<span>${open ? 'Close layout options' : 'Layout options'}</span>${svg(open ? 'close' : 'arrow')}`;
      primary.setAttribute('aria-expanded', open ? 'true' : 'false');
      primary.setAttribute('aria-controls', 'layoutToolsPanel');
    } else if (primary) {
      primary.removeAttribute('aria-expanded');
      primary.removeAttribute('aria-controls');
    }
  }

  function setMobileRoomActionsOpen(open) {
    uiState.mobileRoomActionsOpen = Boolean(open && isMobileViewport() && ['room', 'seating', 'review'].includes(activeWorkflow) && !uiState.visibilityMode && !uiState.mobileRoomCanvasFocus);
    if (uiState.mobileRoomActionsOpen) uiState.mobileLayoutOptionsOpen = false;
    syncMobileRoomActions();
    if (uiState.mobileRoomActionsOpen) {
      setLiveStatusMessage('Room actions expanded. Choose an action or close the panel to return to the canvas.');
    }
  }

  function closePopovers(except = '') {
    ['v4ClassMenu', 'v4MoreMenu'].forEach(id => {
      if (id !== except) document.getElementById(id)?.classList.remove('show');
    });
  }

  function togglePopover(id) {
    const menu = document.getElementById(id);
    if (!menu) return;
    const show = !menu.classList.contains('show');
    closePopovers(id);
    menu.classList.toggle('show', show);
  }

  function installEvents() {
    document.getElementById('v4WorkflowNav')?.addEventListener('click', event => {
      const button = event.target.closest('[data-workflow]');
      if (button) setWorkflow(button.dataset.workflow);
    });
    document.body.addEventListener('click', event => {
      const action = event.target.closest('[data-v4-action]');
      if (action) runAction(action.dataset.v4Action);
      if (!event.target.closest('.v4-class-dock, .v4-utility-dock')) closePopovers();
    });
    document.getElementById('v4ClassMenuBtn')?.addEventListener('click', event => { event.stopPropagation(); togglePopover('v4ClassMenu'); });
    document.getElementById('v4MoreMenuBtn')?.addEventListener('click', event => { event.stopPropagation(); togglePopover('v4MoreMenu'); });
    document.getElementById('v4CommandButton')?.addEventListener('click', openCommandPalette);
    document.getElementById('v4CommandPalette')?.addEventListener('click', event => {
      if (event.target.id === 'v4CommandPalette') closeCommandPalette();
      const command = event.target.closest('[data-command-id]');
      if (command) executeCommand(command.dataset.commandId);
    });
    document.getElementById('v4CommandInput')?.addEventListener('input', event => renderCommands(event.target.value));
    document.getElementById('v4CommandInput')?.addEventListener('keydown', event => {
      const results = [...document.querySelectorAll('.v4-command-result')];
      if (!results.length) return;
      let index = Math.max(0, results.findIndex(node => node.classList.contains('active')));
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        results[index].classList.remove('active');
        index = (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
        results[index].classList.add('active');
        results[index].scrollIntoView({ block: 'nearest' });
      } else if (event.key === 'Enter') {
        event.preventDefault();
        executeCommand(results[index].dataset.commandId);
      }
    });
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openCommandPalette(); }
      if (event.key === 'Escape' && document.getElementById('v4CommandPalette')?.classList.contains('show')) closeCommandPalette();
      else if (event.key === 'Escape' && uiState.mobileLayoutOptionsOpen) setMobileLayoutOptionsOpen(false);
      else if (event.key === 'Escape' && uiState.mobileRoomActionsOpen) setMobileRoomActionsOpen(false);
      else if (event.key === 'Escape' && uiState.mobileRoomCanvasFocus && !document.querySelector('.modal-backdrop.show')) setMobileRoomCanvasFocus(false);
    }, true);
    document.getElementById('classSelect')?.addEventListener('change', () => setTimeout(updateExperience, 0));
    window.addEventListener('resize', () => {
      document.body.classList.toggle('v4-compact', window.innerWidth < 1120);
      syncMobileRoomActions();
    });
  }

  function installObservers() {
    if (observersInstalled) return;
    observersInstalled = true;
    const observer = new MutationObserver(() => updateExperience());
    ['statStudents', 'statSeats', 'statPlaced', 'groupCount', 'zoneCount', 'inlineSaveStatus', 'ruleReport'].forEach(id => {
      const node = document.getElementById(id);
      if (node) observer.observe(node, { childList: true, subtree: true, characterData: true, attributes: true });
    });
  }

  function refineExistingCopy() {
    const leftTitle = document.querySelector('.left-panel .panel-header h2');
    if (leftTitle) leftTitle.textContent = 'Class setup';
    const rightTitle = document.querySelector('.right-panel .panel-header h2');
    if (rightTitle) rightTitle.textContent = 'Chart review';
    const tabs = [
      ['studentsSideTabBtn', 'Roster'],
      ['groupsSideTabBtn', 'Rules'],
      ['zonesSideTabBtn', 'Zones']
    ];
    tabs.forEach(([id, text]) => {
      const button = document.getElementById(id);
      if (!button) return;
      const pill = button.querySelector('.pill');
      button.childNodes[0].textContent = `${text} `;
      if (pill) button.appendChild(pill);
    });
    const manager = document.getElementById('openGroupManagerBtn');
    if (manager) manager.textContent = 'Manage rules';
    const generate = document.getElementById('generateBtn');
    if (generate) generate.textContent = 'Generate options';
    const randomize = document.getElementById('randomizeAllBtn');
    if (randomize) randomize.textContent = 'New random options';
  }

  function install() {
    if (installed) return;
    installed = true;
    document.documentElement.classList.add('product-v4-root');
    document.body.classList.add('product-v4');
    document.body.classList.remove('left-collapsed', 'right-collapsed', 'header-collapsed');
    buildTopbar();
    buildWorkflowNavigation();
    buildSetupDashboard();
    buildShareDashboard();
    buildStudentSearch();
    buildCommandPalette();
    refineExistingCopy();
    normalizeMobileCloseButtons();
    observeMobileCloseButtons();
    installEvents();
    installObservers();
    const remembered = safeStorageGet('sessionStorage', 'seatingPlannerWorkflow') || '';
    setWorkflow(WORKFLOWS[remembered] ? remembered : 'setup', { silent: true });
    document.body.classList.toggle('v4-compact', window.innerWidth < 1120);
    document.body.dataset.productExperience = '4.2';
  }

  function afterReady() {
    updateExperience();
  }

  return Object.freeze({ install, afterReady, setWorkflow, updateExperience, openCommandPalette, syncMobileRoomActions, setMobileLayoutOptionsOpen });
})();

