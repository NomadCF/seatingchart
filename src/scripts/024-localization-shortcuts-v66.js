window.LocalizationShortcutsV66 = (() => {
  const STORAGE_KEY = 'classroom-seating-planner-shortcuts-v1';
  const LOCALE_KEY = 'classroom-seating-planner-locale-v1';
  let installed = false;
  let shortcuts = {};
  let locale = 'en';
  const dictionaries = new Map();

  const ACTIONS = Object.freeze({
    planning: { label: 'Open advanced classroom tools', defaultShortcut: 'Ctrl+Alt+P', run: () => window.PlanningToolsV66?.open?.() },
    exports: { label: 'Open export and support tools', defaultShortcut: 'Ctrl+Alt+E', run: () => window.ExportSupportV66?.open?.() },
    search: { label: 'Open global search', defaultShortcut: 'Ctrl+Alt+F', run: () => ClassroomWorkflowV53?.openGlobalSearch?.() },
    save: { label: 'Save now', defaultShortcut: 'Ctrl+Alt+S', run: () => void handleSaveMenuAction('save-primary', false) },
    presentation: { label: 'Toggle Presentation Mode', defaultShortcut: 'Ctrl+Alt+V', run: () => el('visibilityModeBtn')?.click() },
    room: { label: 'Open Room Design', defaultShortcut: 'Ctrl+Alt+R', run: () => ProductExperience?.setWorkflow?.('room') },
    seating: { label: 'Open Seat Students', defaultShortcut: 'Ctrl+Alt+A', run: () => ProductExperience?.setWorkflow?.('seating') },
    review: { label: 'Open Review', defaultShortcut: 'Ctrl+Alt+Y', run: () => ProductExperience?.setWorkflow?.('review') }
  });

  dictionaries.set('en', Object.freeze({
    'app.name': APP_NAME,
    'planning.title': 'Advanced classroom tools',
    'exports.title': 'Data, image, and support tools',
    'seat.valid': 'Valid seat',
    'seat.caution': 'Seat needs review',
    'seat.invalid': 'Seat conflicts with a rule',
    'common.close': 'Close',
    'common.save': 'Save'
  }));

  function normalizeShortcut(value) {
    const parts = String(value || '').trim().split('+').map(part => part.trim()).filter(Boolean);
    const modifiers = [];
    let key = '';
    parts.forEach(part => {
      const lower = part.toLowerCase();
      if (['ctrl', 'control'].includes(lower)) modifiers.push('Ctrl');
      else if (['alt', 'option'].includes(lower)) modifiers.push('Alt');
      else if (['shift'].includes(lower)) modifiers.push('Shift');
      else if (['meta', 'cmd', 'command'].includes(lower)) modifiers.push('Meta');
      else key = part.length === 1 ? part.toUpperCase() : part;
    });
    return [...new Set(modifiers), key].filter(Boolean).join('+');
  }

  function eventShortcut(event) {
    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');
    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) parts.push(key);
    return parts.join('+');
  }

  function load() {
    locale = safeStorageGet('localStorage', LOCALE_KEY) || 'en';
    if (!dictionaries.has(locale)) locale = 'en';
    try {
      const saved = JSON.parse(safeStorageGet('localStorage', STORAGE_KEY) || '{}');
      shortcuts = Object.fromEntries(Object.entries(ACTIONS).map(([id, action]) => [id, normalizeShortcut(saved[id] || action.defaultShortcut)]));
    } catch {
      shortcuts = Object.fromEntries(Object.entries(ACTIONS).map(([id, action]) => [id, action.defaultShortcut]));
    }
  }

  function save() {
    safeStorageSet('localStorage', STORAGE_KEY, JSON.stringify(shortcuts));
    safeStorageSet('localStorage', LOCALE_KEY, locale);
  }

  function t(key, fallback = '') {
    return dictionaries.get(locale)?.[key] || dictionaries.get('en')?.[key] || fallback || key;
  }

  function registerLocale(code, dictionary) {
    const normalized = String(code || '').trim().toLowerCase();
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(normalized) || !dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary)) return false;
    const safe = Object.fromEntries(Object.entries(dictionary).slice(0, 2000).map(([key, value]) => [String(key).slice(0, 160), String(value).slice(0, 1000)]));
    dictionaries.set(normalized, Object.freeze(safe));
    return true;
  }

  function applyTranslations(root = document) {
    root.querySelectorAll?.('[data-i18n]').forEach(node => {
      const key = node.dataset.i18n;
      const translated = t(key, node.textContent);
      if (node instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(node.type)) node.value = translated;
      else node.textContent = translated;
    });
    document.documentElement.lang = locale;
  }

  function ensureModal() {
    let modal = el('shortcutLocaleModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'shortcutLocaleModal';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'shortcutLocaleTitle');
    modal.innerHTML = `
      <div class="modal shortcut-locale-modal"><div class="panel-header"><div><span class="v44-modal-eyebrow">Keyboard and language</span><h2 id="shortcutLocaleTitle">Shortcuts and localization</h2></div><button id="closeShortcutLocaleBtn" class="secondary mobile-compact-close" type="button" aria-label="Close">Close</button></div><div class="modal-body"><section class="section"><h3>Configurable keyboard shortcuts</h3><p class="muted">Shortcuts are ignored while typing in a field or while a dialog is open.</p><div id="shortcutConfigList" class="shortcut-config-list"></div><div class="button-row"><button id="saveShortcutConfigBtn" type="button">Save shortcuts</button><button id="resetShortcutConfigBtn" class="secondary" type="button">Restore defaults</button></div></section><section class="section"><h3>Localization framework</h3><div class="field"><label for="plannerLocaleSelect">Interface language</label><select id="plannerLocaleSelect"></select></div><p class="muted">English is built in. Additional translation packs can be imported without changing the save schema.</p><div class="button-row"><button id="importLocalePackBtn" class="secondary" type="button">Import translation pack</button><button id="exportLocaleTemplateBtn" class="secondary" type="button">Export translation template</button><input id="localePackFileInput" type="file" accept="application/json,.json" aria-label="Choose translation pack file" hidden></div></section></div></div>`;
    document.body.appendChild(modal);
    el('closeShortcutLocaleBtn')?.addEventListener('click', close);
    el('saveShortcutConfigBtn')?.addEventListener('click', saveShortcutConfiguration);
    el('resetShortcutConfigBtn')?.addEventListener('click', resetShortcuts);
    el('plannerLocaleSelect')?.addEventListener('change', event => {
      locale = event.target.value;
      save();
      applyTranslations();
      setLiveStatusMessage(`Interface language set to ${locale}.`);
    });
    el('importLocalePackBtn')?.addEventListener('click', () => el('localePackFileInput')?.click());
    el('localePackFileInput')?.addEventListener('change', event => void importLocalePack(event.target.files?.[0]));
    el('exportLocaleTemplateBtn')?.addEventListener('click', exportLocaleTemplate);
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    return modal;
  }

  function renderModal() {
    const list = el('shortcutConfigList');
    if (list) list.innerHTML = Object.entries(ACTIONS).map(([id, action]) => `<label class="shortcut-config-row"><span>${escapeHtml(action.label)}</span><input data-shortcut-action="${escapeHtml(id)}" value="${escapeHtml(shortcuts[id] || '')}" placeholder="Ctrl+Alt+Key"></label>`).join('');
    const localeSelect = el('plannerLocaleSelect');
    if (localeSelect) {
      localeSelect.innerHTML = [...dictionaries.keys()].sort().map(code => `<option value="${escapeHtml(code)}">${code === 'en' ? 'English' : escapeHtml(code)}</option>`).join('');
      localeSelect.value = locale;
    }
  }

  function saveShortcutConfiguration() {
    const next = {};
    document.querySelectorAll('[data-shortcut-action]').forEach(input => { next[input.dataset.shortcutAction] = normalizeShortcut(input.value); });
    const values = Object.values(next).filter(Boolean);
    if (new Set(values).size !== values.length) return setLiveStatusMessage('Each keyboard shortcut must be unique.');
    shortcuts = { ...shortcuts, ...next };
    save();
    setLiveStatusMessage('Keyboard shortcuts saved.');
  }

  function resetShortcuts() {
    shortcuts = Object.fromEntries(Object.entries(ACTIONS).map(([id, action]) => [id, action.defaultShortcut]));
    save();
    renderModal();
  }

  async function importLocalePack(file) {
    if (!file) return;
    try {
      const payload = JSON.parse(await readTextFileWithinLimits(file, 'translation pack', IMPORT_LIMITS.saveBytes));
      if (payload?.format !== 'classroom-seating-planner-locale-v1' || !registerLocale(payload.locale, payload.messages)) throw new Error('This is not a supported translation pack.');
      locale = String(payload.locale).toLowerCase();
      save();
      renderModal();
      applyTranslations();
      setLiveStatusMessage(`Translation pack ${locale} imported.`);
    } catch (error) {
      setLiveStatusMessage(`Translation pack import failed: ${error.message}`);
    } finally {
      if (el('localePackFileInput')) el('localePackFileInput').value = '';
    }
  }

  function exportLocaleTemplate() {
    downloadText('classroom-seating-planner-locale-template.json', JSON.stringify({
      format: 'classroom-seating-planner-locale-v1',
      locale: 'xx',
      basedOnVersion: APP_REVISION,
      messages: dictionaries.get('en')
    }, null, 2), 'application/json');
  }

  function open() {
    load();
    ensureModal().classList.add('show');
    renderModal();
    DialogManager.synchronize();
  }

  function close() {
    el('shortcutLocaleModal')?.classList.remove('show');
    DialogManager.synchronize();
  }

  function installEntryPoint() {
    if (el('openShortcutLocaleBtn')) return;
    const button = document.createElement('button');
    button.id = 'openShortcutLocaleBtn';
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = 'Shortcuts & language';
    button.title = 'Configure keyboard shortcuts and import interface translation packs.';
    (el('v4MoreMenu') || document.querySelector('.center-panel > .panel-header .button-row'))?.appendChild(button);
    button.addEventListener('click', open);
  }

  function handleShortcut(event) {
    if (event.defaultPrevented || event.repeat || event.target.closest?.('input,textarea,select,[contenteditable="true"]') || document.querySelector('.modal-backdrop.show')) return;
    const pressed = eventShortcut(event);
    const match = Object.entries(shortcuts).find(([, shortcut]) => shortcut && shortcut === pressed);
    if (!match) return;
    event.preventDefault();
    ACTIONS[match[0]]?.run();
  }

  function install() {
    if (installed) return;
    installed = true;
    load();
    ensureModal();
    document.addEventListener('keydown', handleShortcut, true);
  }

  function afterReady() {
    installEntryPoint();
    applyTranslations();
  }

  return Object.freeze({ install, afterReady, open, t, registerLocale, applyTranslations, locale: () => locale });
})();

'use strict';

