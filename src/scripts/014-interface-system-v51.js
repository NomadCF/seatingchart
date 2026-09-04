const InterfaceSystemV51 = (() => {
  let installed = false;
  let moreMenuObserver = null;
  let lastMenuTrigger = null;

  const ICONS = Object.freeze({
    start: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h6M8 16h4"/>',
    wizard: '<path d="M12 3l1.2 3.4L17 7.5l-3 2.2.9 3.6-2.9-2-2.9 2 .9-3.6-3-2.2 3.8-1.1z"/><path d="M5 19l10-10"/>',
    tour: '<path d="M4 6h16v12H4z"/><path d="M8 10h8M8 14h5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 1 1 4.7 1.8c-1.2.9-2.2 1.5-2.2 3.1M12 17h.01"/>',
    focus: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/><path d="M3 8l5-5m8 0 5 5M3 16l5 5m8 0 5-5"/>',
    workflow: '<path d="M4 6h5M15 6h5M9 6h6M4 12h9M17 12h3M13 12h4M4 18h3M11 18h9M7 18h4"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    snapshot: '<path d="M14.5 4l1.2 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.3l1.2-2z"/><circle cx="12" cy="13" r="4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.07 14H3v-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63h.02A1.7 1.7 0 0 0 10 3.07V3h4v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9v.02A1.7 1.7 0 0 0 20.93 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15z"/>',
    classNew: '<path d="M12 5v14M5 12h14"/>',
    rename: '<path d="M4 20h4l11-11-4-4L4 16zM13.5 6.5l4 4"/>',
    duplicate: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/>',
    tools: '<path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-3-3z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
    arrow: '<path d="M9 18l6-6-6-6"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>'
  });

  const MORE_ITEMS = Object.freeze({
    guidedLearningBtn: ['start', 'Guided learning', 'Quick Start, hands-on practice lessons, and resumable help.'],
    ui51HelpMenuBtn: ['help', 'Reference guide', 'Search feature documentation, examples, and troubleshooting.'],
    v41FocusMenuBtn: ['focus', 'Focus workspace', 'Hide guidance and secondary chrome to maximize the canvas.'],
    v41WorkflowMenuBtn: ['workflow', 'Minimize workflow guidance', 'Collapse the workflow explanation while keeping stage navigation.'],
    v41ResetWorkspaceBtn: ['reset', 'Reset workspace layout', 'Restore panels, guidance, and dashboard sections to their defaults.'],
    ui51SnapshotMenuBtn: ['snapshot', 'Take a snapshot', 'Create a local restore point before a major change.'],
    visibilityModeBtn: ['eye', 'Presentation mode', 'Show a safer, simplified view with configured details hidden.'],
    pageLockBtn: ['lock', 'Lock workspace', 'Prevent changes until the workspace PIN or password is entered.'],
    ui51SettingsMenuBtn: ['settings', 'Settings', 'Appearance, saving, privacy, security, room objects, and maintenance.']
  });

  const CLASS_ITEMS = Object.freeze({
    newClassBtn: ['classNew', 'New class', 'Create a separate class workspace.'],
    renameClassBtn: ['rename', 'Rename class', 'Change the current class name.'],
    duplicateClassBtn: ['duplicate', 'Duplicate class', 'Copy the current class into a new workspace.'],
    classToolsBtn: ['tools', 'Class tools', 'Rollover, copy, import, and class-management options.'],
    deleteClassBtn: ['trash', 'Delete class', 'Permanently remove the current class from this save.']
  });

  const SETTINGS_ICONS = Object.freeze({
    chart: 'tour', appearance: 'wizard', help: 'help', eye: 'eye', saving: 'snapshot', security: 'lock', room: 'tools', about: 'start', maintenance: 'settings'
  });

  function icon(name, className = '') {
    return `<svg class="ui51-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.arrow}</svg>`;
  }

  function createProxyButton(id, targetId) {
    let button = document.getElementById(id);
    if (button) return button;
    button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.addEventListener('click', () => document.getElementById(targetId)?.click());
    return button;
  }

  function normalizeMenuItem(button, config) {
    if (!button || !config) return;
    const [iconName, label, description] = config;
    button.classList.add('ui51-menu-item');
    button.classList.toggle('ui51-menu-danger', button.id === 'deleteClassBtn');
    button.setAttribute('role', 'menuitem');
    button.setAttribute('aria-label', label);
    button.dataset.ui51Description = description;
    button.dataset.ui51Label = label;
    button.dataset.ui51Icon = iconName;
    button.innerHTML = `${icon(iconName, 'ui51-menu-item-icon')}<span class="ui51-menu-item-copy"><strong>${label}</strong><small>${description}</small></span>${icon('arrow', 'ui51-menu-item-arrow')}`;
  }

  function group(title, description, buttons) {
    const section = document.createElement('section');
    section.className = 'ui51-menu-group';
    const heading = document.createElement('div');
    heading.className = 'ui51-menu-group-heading';
    heading.innerHTML = `<strong>${title}</strong>${description ? `<span>${description}</span>` : ''}`;
    const list = document.createElement('div');
    list.className = 'ui51-menu-list';
    buttons.filter(Boolean).forEach(button => list.appendChild(button));
    section.append(heading, list);
    return section;
  }

  function positionMenu(menu, trigger) {
    if (!menu || !trigger) return;
    if (window.matchMedia('(max-width: 900px)').matches) {
      menu.style.removeProperty('top');
      menu.style.removeProperty('left');
      menu.style.removeProperty('right');
      menu.style.removeProperty('bottom');
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(390, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width));
    menu.style.top = `${Math.round(rect.bottom + 8)}px`;
    menu.style.left = `${Math.round(left)}px`;
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
  }

  function closeMenu(menu, { restoreFocus = false } = {}) {
    if (!menu) return;
    menu.classList.remove('show');
    document.body.classList.remove('ui51-more-open', 'ui51-class-menu-open');
    const trigger = menu.id === 'v4MoreMenu' ? document.getElementById('v4MoreMenuBtn') : document.getElementById('v4ClassMenuBtn');
    trigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) (lastMenuTrigger || trigger)?.focus();
  }

  function buildMenuHeader(menu, title, subtitle) {
    const header = document.createElement('div');
    header.className = 'ui51-menu-header';
    header.innerHTML = `<div><strong>${title}</strong><span>${subtitle}</span></div><button type="button" class="secondary ui51-menu-close" aria-label="Close ${title.toLowerCase()}">${icon('close')}</button>`;
    header.querySelector('button')?.addEventListener('click', () => closeMenu(menu, { restoreFocus: true }));
    return header;
  }

  function enhanceMoreMenu() {
    const menu = document.getElementById('v4MoreMenu');
    const trigger = document.getElementById('v4MoreMenuBtn');
    if (!menu || !trigger || menu.dataset.ui51Ready === 'true') return;
    menu.dataset.ui51Ready = 'true';
    menu.classList.add('ui51-action-menu', 'ui51-more-menu');
    menu.setAttribute('aria-label', 'More actions');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-controls', menu.id);
    trigger.setAttribute('aria-expanded', 'false');

    const helpProxy = createProxyButton('ui51HelpMenuBtn', 'helpGuideBtn');
    const snapshotProxy = createProxyButton('ui51SnapshotMenuBtn', 'snapshotQuickBtn');
    const settingsProxy = createProxyButton('ui51SettingsMenuBtn', 'settingsBtn');
    const nodes = {};
    Object.keys(MORE_ITEMS).forEach(id => {
      nodes[id] = id === 'ui51HelpMenuBtn' ? helpProxy : id === 'ui51SnapshotMenuBtn' ? snapshotProxy : id === 'ui51SettingsMenuBtn' ? settingsProxy : document.getElementById(id);
      normalizeMenuItem(nodes[id], MORE_ITEMS[id]);
    });

    menu.replaceChildren(
      buildMenuHeader(menu, 'More actions', 'Guidance, workspace controls, and privacy tools'),
      group('Learn and get started', 'Quick Start, focused lessons, and searchable help.', [nodes.guidedLearningBtn, nodes.ui51HelpMenuBtn]),
      group('Workspace', 'Adjust the interface without changing classroom data.', [nodes.v41FocusMenuBtn, nodes.v41WorkflowMenuBtn, nodes.v41ResetWorkspaceBtn]),
      group('Privacy and recovery', 'Protect the screen and create a restore point.', [nodes.ui51SnapshotMenuBtn, nodes.visibilityModeBtn, nodes.pageLockBtn]),
      group('Application', '', [nodes.ui51SettingsMenuBtn])
    );

    menu.addEventListener('click', event => {
      event.stopPropagation();
      const item = event.target.closest('.ui51-menu-item');
      if (item) setTimeout(() => closeMenu(menu), 0);
    });
    document.body.appendChild(menu);

    moreMenuObserver = new MutationObserver(() => {
      const shown = menu.classList.contains('show');
      document.body.classList.toggle('ui51-more-open', shown);
      trigger.setAttribute('aria-expanded', shown ? 'true' : 'false');
      if (shown) {
        lastMenuTrigger = trigger;
        positionMenu(menu, trigger);
        requestAnimationFrame(() => menu.querySelector('.ui51-menu-item')?.focus({ preventScroll: true }));
      }
    });
    moreMenuObserver.observe(menu, { attributes: true, attributeFilter: ['class'] });
  }

  function enhanceClassMenu() {
    const menu = document.getElementById('v4ClassMenu');
    const trigger = document.getElementById('v4ClassMenuBtn');
    if (!menu || !trigger || menu.dataset.ui51Ready === 'true') return;
    menu.dataset.ui51Ready = 'true';
    menu.classList.add('ui51-action-menu', 'ui51-class-menu');
    menu.setAttribute('aria-label', 'Class actions');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-controls', menu.id);
    trigger.setAttribute('aria-expanded', 'false');
    const nodes = Object.fromEntries(Object.keys(CLASS_ITEMS).map(id => [id, document.getElementById(id)]));
    Object.entries(nodes).forEach(([id, button]) => normalizeMenuItem(button, CLASS_ITEMS[id]));
    menu.replaceChildren(
      buildMenuHeader(menu, 'Class actions', 'Manage the current class workspace'),
      group('Class workspace', '', [nodes.newClassBtn, nodes.renameClassBtn, nodes.duplicateClassBtn, nodes.classToolsBtn]),
      group('Danger zone', '', [nodes.deleteClassBtn])
    );
    menu.addEventListener('click', event => {
      event.stopPropagation();
      if (event.target.closest('.ui51-menu-item')) setTimeout(() => closeMenu(menu), 0);
    });
    document.body.appendChild(menu);
    new MutationObserver(() => {
      const shown = menu.classList.contains('show');
      document.body.classList.toggle('ui51-class-menu-open', shown);
      trigger.setAttribute('aria-expanded', shown ? 'true' : 'false');
      if (shown) {
        lastMenuTrigger = trigger;
        positionMenu(menu, trigger);
        requestAnimationFrame(() => menu.querySelector('.ui51-menu-item')?.focus({ preventScroll: true }));
      }
    }).observe(menu, { attributes: true, attributeFilter: ['class'] });
  }

  function addMenuScrim() {
    if (document.getElementById('ui51MenuScrim')) return;
    const scrim = document.createElement('button');
    scrim.id = 'ui51MenuScrim';
    scrim.type = 'button';
    scrim.className = 'ui51-menu-scrim';
    scrim.setAttribute('aria-label', 'Close open menu');
    scrim.addEventListener('click', () => {
      closeMenu(document.getElementById('v4MoreMenu'));
      closeMenu(document.getElementById('v4ClassMenu'));
    });
    document.body.appendChild(scrim);
  }

  function enhanceSettingsNavigation() {
    document.querySelectorAll('.settings-page-tab[data-settings-nav]').forEach(button => {
      if (button.querySelector('.ui51-settings-tab-icon')) return;
      const iconName = SETTINGS_ICONS[button.dataset.settingsNav] || 'settings';
      button.insertAdjacentHTML('afterbegin', `<span class="ui51-settings-tab-icon">${icon(iconName)}</span>`);
    });
    const modal = document.querySelector('#settingsModal .settings-modal');
    if (modal) modal.classList.add('ui51-settings-modal');
  }

  function enhanceSemanticControls() {
    document.querySelectorAll('.checkline').forEach(line => {
      if (line.querySelector('input[type="checkbox"]')) line.classList.add('ui51-checkline');
    });
    document.querySelectorAll('.modal > .panel-header').forEach(header => header.classList.add('ui51-modal-header'));
    document.querySelectorAll('.modal-body').forEach(body => body.classList.add('ui51-modal-body'));
    const moreButton = document.getElementById('v4MoreMenuBtn');
    if (moreButton) moreButton.title = 'More actions and workspace tools';
  }

  function refreshMoreMenuItems() {
    Object.entries(MORE_ITEMS).forEach(([id, baseConfig]) => {
      const button = document.getElementById(id);
      if (!button) return;
      let config = baseConfig;
      if (id === 'v41FocusMenuBtn') {
        const active = document.body.classList.contains('v41-focus-mode');
        config = ['focus', active ? 'Exit focus mode' : 'Focus workspace', baseConfig[2]];
      } else if (id === 'v41WorkflowMenuBtn') {
        const collapsed = document.body.classList.contains('v41-workflow-collapsed');
        config = ['workflow', collapsed ? 'Show workflow guidance' : 'Minimize workflow guidance', baseConfig[2]];
      }
      normalizeMenuItem(button, config);
    });
  }

  function installEvents() {
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const more = document.getElementById('v4MoreMenu');
      const classMenu = document.getElementById('v4ClassMenu');
      if (more?.classList.contains('show')) { event.preventDefault(); closeMenu(more, { restoreFocus: true }); }
      else if (classMenu?.classList.contains('show')) { event.preventDefault(); closeMenu(classMenu, { restoreFocus: true }); }
    }, true);
    document.getElementById('v4MoreMenuBtn')?.addEventListener('click', () => {
      lastMenuTrigger = document.getElementById('v4MoreMenuBtn');
      refreshMoreMenuItems();
    }, true);
    document.getElementById('v4ClassMenuBtn')?.addEventListener('click', () => { lastMenuTrigger = document.getElementById('v4ClassMenuBtn'); });
    window.addEventListener('resize', () => {
      const more = document.getElementById('v4MoreMenu');
      const classMenu = document.getElementById('v4ClassMenu');
      if (more?.classList.contains('show')) positionMenu(more, document.getElementById('v4MoreMenuBtn'));
      if (classMenu?.classList.contains('show')) positionMenu(classMenu, document.getElementById('v4ClassMenuBtn'));
    });
  }

  function install() {
    if (installed) return;
    installed = true;
    document.body.classList.add('interface-v51');
    document.body.dataset.productExperience = '5.1';
    addMenuScrim();
    enhanceMoreMenu();
    enhanceClassMenu();
    enhanceSettingsNavigation();
    enhanceSemanticControls();
    installEvents();
  }

  function afterReady() {
    enhanceMoreMenu();
    enhanceClassMenu();
    enhanceSettingsNavigation();
    enhanceSemanticControls();
    refreshMoreMenuItems();
  }

  return Object.freeze({ install, afterReady, enhanceMoreMenu, enhanceClassMenu });
})();

