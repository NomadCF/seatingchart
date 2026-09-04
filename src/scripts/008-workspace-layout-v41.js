const WorkspaceLayoutV41 = (() => {
  const STORAGE_KEY = 'classroomSeatingPlannerWorkspaceLayoutV6';
  const DEFAULTS = Object.freeze({
    focusMode: false,
    workflowCollapsed: false,
    panelStates: { setupLeft: false, seatingLeft: false, reviewRight: false },
    dashboardStates: { setup: false, share: false, privacy: false },
    sectionStates: {}
  });

  let installed = false;
  let state = loadState();
  let workflowObserver = null;

  const ICONS = Object.freeze({
    focus: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/><path d="M3 8l5-5m8 0 5 5M3 16l5 5m8 0 5-5"/>',
    exitFocus: '<path d="M9 9H4V4M15 9h5V4M9 15H4v5M15 15h5v5"/><path d="M4 9l5-5m6 0 5 5M4 15l5 5m6 0 5-5"/>',
    collapse: '<path d="M6 15l6-6 6 6"/>',
    expand: '<path d="M6 9l6 6 6-6"/>',
    left: '<path d="M15 18l-6-6 6-6"/>',
    right: '<path d="M9 18l6-6-6-6"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    workflow: '<path d="M4 6h5M15 6h5M9 6h6M4 12h9M17 12h3M13 12h4M4 18h3M11 18h9M7 18h4"/>',
    previous: '<path d="M15 18l-6-6 6-6"/>',
    next: '<path d="M9 18l6-6-6-6"/>'
  });

  function cloneDefaults() {
    return {
      focusMode: DEFAULTS.focusMode,
      workflowCollapsed: DEFAULTS.workflowCollapsed,
      panelStates: { ...DEFAULTS.panelStates },
      dashboardStates: { ...DEFAULTS.dashboardStates },
      sectionStates: {}
    };
  }

  function loadState() {
    const fallback = cloneDefaults();
    try {
      const parsed = JSON.parse(safeStorageGet('localStorage', STORAGE_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object') return fallback;
      return {
        focusMode: Boolean(parsed.focusMode),
        workflowCollapsed: Boolean(parsed.workflowCollapsed),
        panelStates: { ...fallback.panelStates, ...(parsed.panelStates || {}) },
        dashboardStates: { ...fallback.dashboardStates, ...(parsed.dashboardStates || {}) },
        sectionStates: parsed.sectionStates && typeof parsed.sectionStates === 'object' ? { ...parsed.sectionStates } : {}
      };
    } catch (_) {
      return fallback;
    }
  }

  function saveState() {
    safeStorageSet('localStorage', STORAGE_KEY, JSON.stringify(state))
  }

  function icon(name) {
    return `<svg class="v4-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.minus}</svg>`;
  }

  function makeIconButton(id, label, iconName, className = 'secondary v4-icon-button') {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = `${className} v41-layout-control`;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = icon(iconName);
    return button;
  }

  function currentWorkflow() {
    return document.body.dataset.workflow || 'setup';
  }

  function updateFocusButton() {
    const button = document.getElementById('v41FocusModeBtn');
    if (!button) return;
    const active = Boolean(state.focusMode);
    const label = active ? 'Exit focus mode' : 'Focus workspace';
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.setAttribute('aria-label', label);
    button.title = `${label} (F10)`;
    button.innerHTML = icon(active ? 'exitFocus' : 'focus');
    const menuButton = document.getElementById('v41FocusMenuBtn');
    if (menuButton) menuButton.innerHTML = `${icon(active ? 'exitFocus' : 'focus')}<span>${active ? 'Exit focus mode' : 'Focus workspace'}</span>`;
  }

  function updateWorkflowControls() {
    const toggle = document.getElementById('v41WorkflowCollapseBtn');
    const ribbonToggle = document.getElementById('v41WorkflowExpandBtn');
    const collapsed = Boolean(state.workflowCollapsed);
    if (toggle) {
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggle.setAttribute('aria-label', collapsed ? 'Show workflow guidance' : 'Minimize workflow guidance');
      toggle.title = `${collapsed ? 'Show' : 'Minimize'} workflow guidance (Ctrl+Shift+M)`;
      toggle.innerHTML = icon(collapsed ? 'expand' : 'collapse');
    }
    if (ribbonToggle) {
      ribbonToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      ribbonToggle.setAttribute('aria-label', 'Show full workflow guidance');
      ribbonToggle.title = 'Show full workflow guidance';
    }
    document.body.classList.toggle('v41-workflow-collapsed', collapsed);
    const menuButton = document.getElementById('v41WorkflowMenuBtn');
    if (menuButton) menuButton.innerHTML = `${icon('workflow')}<span>${collapsed ? 'Show workflow guidance' : 'Minimize workflow guidance'}</span>`;
  }

  function updatePanelButtons() {
    const workflow = currentWorkflow();
    const leftKey = workflow === 'setup' ? 'setupLeft' : workflow === 'seating' ? 'seatingLeft' : '';
    const rightKey = workflow === 'review' ? 'reviewRight' : '';
    const leftCollapsed = leftKey ? Boolean(state.panelStates[leftKey]) : false;
    const rightCollapsed = rightKey ? Boolean(state.panelStates[rightKey]) : false;
    document.body.classList.toggle('v41-left-panel-collapsed', leftCollapsed);
    document.body.classList.toggle('v41-right-panel-collapsed', rightCollapsed);

    const leftTitle = document.querySelector('.left-panel > .panel-header h2');
    if (leftTitle) leftTitle.textContent = workflow === 'seating' ? 'Students' : 'Class setup';
    const rightTitle = document.querySelector('.right-panel > .panel-header h2');
    if (rightTitle) rightTitle.textContent = 'Chart review';

    const manualSeatingGuide = document.getElementById('guideManualSeatingBtn');
    if (manualSeatingGuide) manualSeatingGuide.hidden = leftCollapsed;

    const leftButton = document.getElementById('v41ToggleLeftPanel');
    if (leftButton) {
      const panelName = workflow === 'seating' ? 'student list' : 'class setup';
      const label = leftCollapsed ? `Expand ${panelName}` : `Minimize ${panelName}`;
      leftButton.hidden = !leftKey;
      leftButton.setAttribute('aria-expanded', leftCollapsed ? 'false' : 'true');
      leftButton.setAttribute('aria-label', label);
      leftButton.title = `${label} (Ctrl+Shift+B)`;
      leftButton.innerHTML = icon(leftCollapsed ? 'right' : 'left');
    }
    const rightButton = document.getElementById('v41ToggleRightPanel');
    if (rightButton) {
      const label = rightCollapsed ? 'Expand review panel' : 'Minimize review panel';
      rightButton.hidden = !rightKey;
      rightButton.setAttribute('aria-expanded', rightCollapsed ? 'false' : 'true');
      rightButton.setAttribute('aria-label', label);
      rightButton.title = `${label} (Ctrl+Shift+B)`;
      rightButton.innerHTML = icon(rightCollapsed ? 'left' : 'right');
    }
  }

  function updateDashboardButtons() {
    const configs = [
      ['v4SetupDashboard', 'setup', 'v41SetupDashboardToggle'],
      ['v4ShareDashboard', 'share', 'v41ShareDashboardToggle'],
      ['v4ShareDashboard', 'privacy', 'v41PrivacyChecklistToggle']
    ];
    configs.forEach(([dashboardId, key, buttonId]) => {
      const dashboard = document.getElementById(dashboardId);
      const button = document.getElementById(buttonId);
      const collapsed = Boolean(state.dashboardStates[key]);
      if (key === 'privacy') dashboard?.querySelector('.v4-privacy-checklist')?.classList.toggle('v41-block-collapsed', collapsed);
      else dashboard?.classList.toggle('v41-dashboard-summary-collapsed', collapsed);
      if (button) {
        button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        button.setAttribute('aria-label', collapsed ? 'Expand dashboard summary' : 'Minimize dashboard summary');
        button.title = collapsed ? 'Expand dashboard summary' : 'Minimize dashboard summary';
        button.innerHTML = icon(collapsed ? 'plus' : 'minus');
      }
    });
  }

  function applyLayoutState() {
    document.body.classList.toggle('v41-focus-mode', Boolean(state.focusMode));
    updateFocusButton();
    updateWorkflowControls();
    updatePanelButtons();
    updateDashboardButtons();
    updateRibbon();
  }

  function applyPageLoadDefaults(settings = {}) {
    state.workflowCollapsed = Boolean(settings.headerCollapsed);
    state.panelStates.seatingLeft = Boolean(settings.leftCollapsed);
    state.panelStates.reviewRight = Boolean(settings.rightCollapsed);
    saveState();
    applyLayoutState();
  }

  function toggleFocusMode(force) {
    state.focusMode = typeof force === 'boolean' ? force : !state.focusMode;
    saveState();
    applyLayoutState();
    document.getElementById('v41FocusModeBtn')?.focus({ preventScroll: true });
  }

  function toggleWorkflow(force) {
    state.workflowCollapsed = typeof force === 'boolean' ? force : !state.workflowCollapsed;
    saveState();
    applyLayoutState();
  }

  function panelStateKey(side) {
    const workflow = currentWorkflow();
    if (side === 'left') return workflow === 'setup' ? 'setupLeft' : workflow === 'seating' ? 'seatingLeft' : '';
    if (side === 'right') return workflow === 'review' ? 'reviewRight' : '';
    return '';
  }

  function togglePanel(side, force) {
    const key = panelStateKey(side);
    if (!key) return;
    state.panelStates[key] = typeof force === 'boolean' ? force : !state.panelStates[key];
    saveState();
    updatePanelButtons();
  }

  function toggleDashboard(key) {
    if (!(key in state.dashboardStates)) return;
    state.dashboardStates[key] = !state.dashboardStates[key];
    saveState();
    updateDashboardButtons();
  }

  function resetLayout() {
    state = cloneDefaults();
    document.querySelectorAll('.v41-section-collapsed').forEach(section => section.classList.remove('v41-section-collapsed'));
    saveState();
    applyLayoutState();
    updateSectionControls();
  }

  function buildTopbarControl() {
    const dock = document.querySelector('.v4-utility-dock');
    if (!dock || document.getElementById('v41FocusModeBtn')) return;
    const button = makeIconButton('v41FocusModeBtn', 'Focus workspace', 'focus');
    button.setAttribute('aria-pressed', 'false');
    dock.insertBefore(button, document.getElementById('v4MoreMenuBtn') || null);

    const menu = document.getElementById('v4MoreMenu');
    if (menu && !document.getElementById('v41ResetWorkspaceBtn')) {
      const focusMenu = document.createElement('button');
      focusMenu.id = 'v41FocusMenuBtn';
      focusMenu.type = 'button';
      focusMenu.className = 'v41-menu-action';
      focusMenu.innerHTML = `${icon('focus')}<span>Focus workspace</span>`;
      focusMenu.addEventListener('click', () => toggleFocusMode());

      const workflowMenu = document.createElement('button');
      workflowMenu.id = 'v41WorkflowMenuBtn';
      workflowMenu.type = 'button';
      workflowMenu.className = 'v41-menu-action';
      workflowMenu.innerHTML = `${icon('workflow')}<span>Minimize workflow guidance</span>`;
      workflowMenu.addEventListener('click', () => toggleWorkflow());

      const reset = document.createElement('button');
      reset.id = 'v41ResetWorkspaceBtn';
      reset.type = 'button';
      reset.className = 'v41-menu-action';
      reset.innerHTML = `${icon('reset')}<span>Reset workspace layout</span>`;
      reset.addEventListener('click', resetLayout);
      menu.prepend(reset);
      menu.prepend(workflowMenu);
      menu.prepend(focusMenu);
    }
  }

  function buildWorkflowControls() {
    const contextActions = document.querySelector('.v4-context-actions');
    if (contextActions && !document.getElementById('v41WorkflowCollapseBtn')) {
      const button = makeIconButton('v41WorkflowCollapseBtn', 'Minimize workflow guidance', 'collapse', 'secondary v41-guidance-toggle');
      button.setAttribute('aria-expanded', 'true');
      contextActions.prepend(button);
    }
    const shell = document.querySelector('.v4-workflow-shell');
    if (shell && !document.getElementById('v41StageRibbon')) {
      const ribbon = document.createElement('div');
      ribbon.id = 'v41StageRibbon';
      ribbon.className = 'v41-stage-ribbon';
      ribbon.innerHTML = `
            <button id="v41PreviousWorkflow" class="secondary v4-icon-button" type="button" aria-label="Previous workflow step" title="Previous workflow step">${icon('previous')}</button>
            <div class="v41-ribbon-copy"><span id="v41RibbonStep">Step 01 of 05</span><strong id="v41RibbonTitle">Class Setup</strong></div>
            <button id="v41NextWorkflow" class="secondary v4-icon-button" type="button" aria-label="Next workflow step" title="Next workflow step">${icon('next')}</button>
            <button id="v41WorkflowExpandBtn" class="secondary v41-ribbon-expand" type="button" aria-label="Show full workflow guidance" title="Show full workflow guidance">${icon('workflow')}<span>Show workflow</span></button>`;
      shell.appendChild(ribbon);
    }
  }

  function buildPanelControls() {
    const leftHeader = document.querySelector('.left-panel > .panel-header');
    if (leftHeader && !document.getElementById('v41ToggleLeftPanel')) {
      const button = makeIconButton('v41ToggleLeftPanel', 'Minimize class panel', 'left');
      button.classList.add('v41-panel-toggle');
      button.setAttribute('aria-expanded', 'true');
      leftHeader.appendChild(button);
    }
    const rightHeader = document.querySelector('.right-panel > .panel-header');
    if (rightHeader && !document.getElementById('v41ToggleRightPanel')) {
      const button = makeIconButton('v41ToggleRightPanel', 'Minimize review panel', 'right');
      button.classList.add('v41-panel-toggle');
      button.setAttribute('aria-expanded', 'true');
      rightHeader.appendChild(button);
    }
  }

  function buildDashboardControls() {
    const configs = [
      ['v4SetupDashboard', 'v41SetupDashboardToggle', 'setup'],
      ['v4ShareDashboard', 'v41ShareDashboardToggle', 'share']
    ];
    configs.forEach(([dashboardId, buttonId, key]) => {
      const dashboard = document.getElementById(dashboardId);
      const header = dashboard?.querySelector('.v4-dashboard-header');
      if (!header || document.getElementById(buttonId)) return;
      const button = makeIconButton(buttonId, 'Minimize dashboard summary', 'minus');
      button.classList.add('v41-dashboard-toggle');
      button.setAttribute('aria-expanded', 'true');
      button.addEventListener('click', () => toggleDashboard(key));
      header.appendChild(button);
    });
    const privacy = document.querySelector('#v4ShareDashboard .v4-privacy-checklist');
    const privacyHeading = privacy?.firstElementChild;
    if (privacy && privacyHeading && !document.getElementById('v41PrivacyChecklistToggle')) {
      const button = makeIconButton('v41PrivacyChecklistToggle', 'Minimize privacy checklist', 'minus');
      button.classList.add('v41-block-toggle');
      button.setAttribute('aria-expanded', 'true');
      button.addEventListener('click', () => toggleDashboard('privacy'));
      privacyHeading.appendChild(button);
    }
  }

  function sectionKey(section, index) {
    const heading = section.querySelector(':scope > h3, :scope > .section-header-row h3');
    const title = String(heading?.textContent || `section-${index}`).replace(/\s+/g, ' ').trim().toLowerCase();
    const panel = section.closest('.left-panel') ? 'left' : section.closest('.right-panel') ? 'right' : section.closest('.v4-dashboard') ? 'dashboard' : 'center';
    return `${panel}:${title}:${index}`;
  }

  function installSectionControls() {
    const candidates = [...document.querySelectorAll('.left-panel .section, .right-panel .section')];
    candidates.forEach((section, index) => {
      if (section.dataset.v41SectionReady === 'true') return;
      const row = section.querySelector(':scope > .section-header-row');
      const heading = section.querySelector(':scope > h3');
      const host = row || heading;
      if (!host) return;
      if (host.querySelector('.v41-section-toggle')) return;
      if (row && row.querySelector('button[id^="toggle"]')) {
        section.dataset.v41SectionReady = 'true';
        return;
      }
      const key = sectionKey(section, index);
      section.dataset.v41SectionKey = key;
      const button = makeIconButton('', 'Minimize section', 'minus', 'secondary v41-section-toggle');
      button.removeAttribute('id');
      button.setAttribute('aria-expanded', 'true');
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const collapsed = !section.classList.contains('v41-section-collapsed');
        section.classList.toggle('v41-section-collapsed', collapsed);
        state.sectionStates[key] = collapsed;
        saveState();
        updateSectionButton(section, button);
      });
      host.appendChild(button);
      section.classList.toggle('v41-section-collapsed', Boolean(state.sectionStates[key]));
      updateSectionButton(section, button);
      section.dataset.v41SectionReady = 'true';
    });
  }

  function updateSectionButton(section, button) {
    const collapsed = section.classList.contains('v41-section-collapsed');
    const label = collapsed ? 'Expand section' : 'Minimize section';
    button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = icon(collapsed ? 'plus' : 'minus');
  }

  function updateSectionControls() {
    document.querySelectorAll('.v41-section-toggle').forEach(button => {
      const section = button.closest('.section');
      if (section) updateSectionButton(section, button);
    });
  }

  function workflowKeys() {
    return ['setup', 'room', 'seating', 'review', 'share'];
  }

  function moveWorkflow(delta) {
    const keys = workflowKeys();
    const index = Math.max(0, keys.indexOf(currentWorkflow()));
    ProductExperience.setWorkflow(keys[(index + delta + keys.length) % keys.length]);
  }

  function updateRibbon() {
    const workflow = currentWorkflow();
    const keys = workflowKeys();
    const index = Math.max(0, keys.indexOf(workflow));
    const activeButton = document.querySelector(`.v4-workflow-step[data-workflow="${workflow}"]`);
    const title = activeButton?.querySelector('.v4-step-copy strong')?.textContent || workflow;
    const step = document.getElementById('v41RibbonStep');
    const titleNode = document.getElementById('v41RibbonTitle');
    if (step) step.textContent = `Step ${String(index + 1).padStart(2, '0')} of 05`;
    if (titleNode) titleNode.textContent = title;
  }

  function installEvents() {
    document.getElementById('v41FocusModeBtn')?.addEventListener('click', () => toggleFocusMode());
    document.getElementById('v41WorkflowCollapseBtn')?.addEventListener('click', () => toggleWorkflow());
    document.getElementById('v41WorkflowExpandBtn')?.addEventListener('click', () => toggleWorkflow(false));
    document.getElementById('v41PreviousWorkflow')?.addEventListener('click', () => moveWorkflow(-1));
    document.getElementById('v41NextWorkflow')?.addEventListener('click', () => moveWorkflow(1));
    document.getElementById('v41ToggleLeftPanel')?.addEventListener('click', () => togglePanel('left'));
    document.getElementById('v41ToggleRightPanel')?.addEventListener('click', () => togglePanel('right'));

    document.addEventListener('keydown', event => {
      if (event.key === 'F10') {
        event.preventDefault();
        toggleFocusMode();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        toggleWorkflow();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'b') {
        const workflow = currentWorkflow();
        if (workflow === 'setup' || workflow === 'seating') {
          event.preventDefault();
          togglePanel('left');
        } else if (workflow === 'review') {
          event.preventDefault();
          togglePanel('right');
        }
      }
    }, true);
  }

  function installObserver() {
    workflowObserver = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.attributeName === 'data-workflow')) {
        updatePanelButtons();
        updateRibbon();
        installSectionControls();
      }
    });
    workflowObserver.observe(document.body, { attributes: true, attributeFilter: ['data-workflow'] });
  }

  function install() {
    if (installed) return;
    installed = true;
    document.body.classList.add('workspace-v41');
    buildTopbarControl();
    buildWorkflowControls();
    buildPanelControls();
    buildDashboardControls();
    installSectionControls();
    installEvents();
    installObserver();
    applyLayoutState();
    document.body.dataset.workspaceExperience = '4.1';
  }

  function afterReady() {
    installSectionControls();
    applyLayoutState();
  }

  return Object.freeze({ install, afterReady, applyPageLoadDefaults, toggleFocusMode, toggleWorkflow, togglePanel, resetLayout, getState: () => cloneJsonValue(state) });
})();

