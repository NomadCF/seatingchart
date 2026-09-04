const ProductRepairV43 = (() => {
  const ONBOARDING_KEY = 'classroomSeatingPlannerSecurityOnboardingV6';
  const THEMES = [
    ['default', 'Default', '#2558d8', '#f3f5f8'],
    ['gradient', 'Gradient Sky', '#2563eb', '#ecfeff'],
    ['shimmer', 'Shimmer', '#7c3aed', '#fdf2f8'],
    ['prismatic', 'Prismatic Flow', '#a855f7', '#22d3ee'],
    ['aurora', 'Aurora Focus', '#55d6be', '#071426'],
    ['highContrast', 'High Contrast', '#22d3ee', '#000000'],
    ['windowsXp', 'Windows XP', '#245edb', '#ece9d8'],
    ['windows11', 'Windows 11', '#0078d4', '#eff6ff'],
    ['macos', 'macOS Frosted', '#0a84ff', '#f8fafc'],
    ['linux', 'Linux Terminal', '#22c55e', '#020617']
  ];
  let installed = false;
  let welcomeWasOpen = false;

  function markOnboardingSeen() {
    safeStorageSet('localStorage', ONBOARDING_KEY, 'true');
  }

  function onboardingHasBeenSeen() {
    return safeStorageGet('localStorage', ONBOARDING_KEY) === 'true';
  }

  function ensureOnboardingShell() {
    if (document.getElementById('gettingStartedModal')) return;
    const modal = document.createElement('div');
    modal.id = 'gettingStartedModal';
    modal.className = 'modal-backdrop v44-onboarding-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'gettingStartedTitle');
    document.body.appendChild(modal);
  }

  function openGettingStarted({ automatic = false } = {}) {
    ensureOnboardingShell();
    const modal = document.getElementById('gettingStartedModal');
    if (!modal) return;
    modal.dataset.automatic = automatic ? 'true' : 'false';
    modal.classList.add('show');
    document.body.classList.add('v44-onboarding-open');
  }

  function closeGettingStarted() {
    document.getElementById('gettingStartedModal')?.classList.remove('show');
    document.body.classList.remove('v44-onboarding-open');
    markOnboardingSeen();
  }

  function themeButtonMarkup(value, label, primary, surface) {
    return `<button type="button" class="v43-theme-choice" data-v43-theme="${value}" aria-pressed="false"><span class="v43-theme-swatch" style="--theme-primary:${primary};--theme-surface:${surface}"><i></i><i></i></span><span>${label}</span></button>`;
  }

  function updateThemeChoices() {
    const current = document.body.dataset.theme || 'default';
    document.querySelectorAll('[data-v43-theme]').forEach(button => {
      const active = button.dataset.v43Theme === current;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function installThemeChooser() {
    const select = document.getElementById('settingTheme');
    if (!select) return;
    const section = select.closest('.settings-section');
    if (section && !document.getElementById('v43ThemeChoices')) {
      const chooser = document.createElement('div');
      chooser.id = 'v43ThemeChoices';
      chooser.className = 'v43-theme-grid';
      chooser.setAttribute('aria-label', 'Theme preview choices');
      chooser.innerHTML = THEMES.map(theme => themeButtonMarkup(...theme)).join('');
      section.appendChild(chooser);
      chooser.addEventListener('click', event => {
        const button = event.target.closest('[data-v43-theme]');
        if (!button) return;
        select.value = button.dataset.v43Theme;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        document.body.dataset.theme = button.dataset.v43Theme;
        updateThemeChoices();
        setLiveStatusMessage(`${button.textContent.trim()} theme applied.`);
      });
    }
    if (select.dataset.themeChooserBound !== 'true') {
      select.dataset.themeChooserBound = 'true';
      select.addEventListener('change', () => {
        document.body.dataset.theme = select.value || 'default';
        readPageSettingsForm();
        updateThemeChoices();
      });
    }
    updateThemeChoices();
  }

  function observeWelcomeCompletion() {
    const welcome = document.getElementById('welcomeSecurityModal');
    if (!welcome) return;
    welcomeWasOpen = welcome.classList.contains('show');
    new MutationObserver(() => {
      const open = welcome.classList.contains('show');
      if (welcomeWasOpen && !open && uiState.welcomeSecurityJustCompleted && !onboardingHasBeenSeen()) {
        setTimeout(() => openGettingStarted({ automatic: true }), 160);
      }
      welcomeWasOpen = open;
    }).observe(welcome, { attributes: true, attributeFilter: ['class'] });
  }

  function install() {
    if (installed) return;
    installed = true;
    document.body.classList.add('product-v43');
    document.body.dataset.productExperience = '4.3';
    document.body.dataset.workspaceExperience = '4.3';
    ensureOnboardingShell();
    installThemeChooser();
    new MutationObserver(updateThemeChoices).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    observeWelcomeCompletion();
    const welcomeButton = document.getElementById('welcomeSecurityStartBtn');
    if (welcomeButton) welcomeButton.textContent = 'Create password and continue';
  }

  function afterReady() {
    installThemeChooser();
    updateThemeChoices();
  }

  return Object.freeze({ install, afterReady, openGettingStarted, closeGettingStarted, updateThemeChoices });
})();


