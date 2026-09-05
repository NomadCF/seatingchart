window.InterfaceAssistantAuditV721 = (() => {
  'use strict';

  const VERSION = '7.2.1-ui-audit-1';
  const PREF_KEY = 'classroom-seating-planner-assistant-display-v721';
  const STYLE_ID = 'interfaceAssistantAuditV721Styles';
  const DOCK_ID = 'plannerAssistantV721Dock';
  const COMPACT_ID = 'plannerAssistantV721Compact';
  const SETTINGS_ID = 'plannerAssistantV721Settings';
  const HELP_ID = 'plannerAssistantV721HelpCard';
  const MODES = new Set(['expanded', 'compact', 'hidden']);

  let installed = false;
  let bodyObserver = null;
  let pendingRefresh = false;
  let lastOriginalRequest = '';

  const normalizeText = value => String(value || '').trim().replace(/\s+/g, ' ');
  const lower = value => normalizeText(value).toLowerCase();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[char]);

  function assistant() {
    return window.PlannerAssistantV710 || null;
  }

  function isPresentationMode() {
    return Boolean(document.body?.classList.contains('visibility-mode'));
  }

  function loadMode() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      return MODES.has(parsed.mode) ? parsed.mode : 'expanded';
    } catch (_) {
      return 'expanded';
    }
  }

  let displayMode = loadMode();

  function saveMode() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ mode:displayMode })); } catch (_) { /* preference is best effort */ }
  }

  function setMode(mode, options = {}) {
    const next = MODES.has(mode) ? mode : 'expanded';
    displayMode = next;
    saveMode();
    applyDisplayMode();
    syncSettingsControls();
    if (options.announce !== false) announce(
      next === 'hidden' ? 'Planner Assistant hidden. You can turn it back on from Help & Guides in Settings.'
        : next === 'compact' ? 'Planner Assistant minimized to a compact launcher.'
        : 'Planner Assistant command bar shown.'
    );
    return displayMode;
  }

  function announce(message) {
    try { if (typeof setLiveStatusMessage === 'function') setLiveStatusMessage(String(message || '')); } catch (_) { /* optional */ }
  }

  function activeStudents() {
    return typeof state !== 'undefined' && Array.isArray(state?.students)
      ? state.students.filter(student => student && !student.archived)
      : [];
  }

  function studentName(student) {
    try {
      if (typeof studentDisplay === 'function') return normalizeText(studentDisplay(student));
    } catch (_) { /* fallback */ }
    return normalizeText([
      student?.nickName || student?.firstName,
      student?.lastName
    ].filter(Boolean).join(' ')) || String(student?.id || 'Student');
  }

  function aliases(student) {
    const names = [
      studentName(student),
      [student?.firstName, student?.lastName].filter(Boolean).join(' '),
      student?.nickName,
      student?.firstName,
      student?.lastName
    ].map(normalizeText).filter(value => value.length >= 2);
    return [...new Set(names)].sort((a, b) => b.length - a.length);
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function mentionedStudents(command) {
    const text = lower(command);
    const hits = [];
    activeStudents().forEach(student => {
      aliases(student).forEach(alias => {
        const regex = new RegExp(`(^|[^a-z0-9])(${escapeRegex(alias)})(?=$|[^a-z0-9])`, 'i');
        const match = regex.exec(text);
        if (!match) return;
        const start = match.index + match[1].length;
        hits.push({ student, alias:lower(alias), start, end:start + alias.length });
      });
    });
    hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const selected = [];
    hits.forEach(hit => {
      if (selected.some(existing => hit.start < existing.end && hit.end > existing.start)) return;
      const same = hits.filter(item => item.start === hit.start && item.end === hit.end && item.alias === hit.alias);
      const students = [...new Map(same.map(item => [String(item.student?.id || ''), item.student])).values()];
      selected.push({ start:hit.start, end:hit.end, alias:hit.alias, students });
    });
    return selected;
  }

  function spacingPhrase(command) {
    const match = lower(command).match(/(\d+(?:\.\d+)?)\s*(feet|foot|ft|meters|meter|metres|metre|m)\b/);
    return match ? ` with at least ${match[1]} ${match[2]} between students` : '';
  }

  function legacyInterpret(command) {
    try { return assistant()?.interpret?.(command) || null; }
    catch (_) { return null; }
  }

  function recognized(command) {
    const result = legacyInterpret(command);
    return Boolean(result && !['unknown', 'ambiguous'].includes(result.intent));
  }

  function aliasIsUnique(alias, studentId) {
    const key = lower(alias);
    if (!key) return false;
    const matches = activeStudents().filter(student => aliases(student).some(value => lower(value) === key));
    return matches.length === 1 && String(matches[0]?.id || '') === String(studentId || '');
  }

  function safeStudentReference(student) {
    const reserved = /\b(ada|front|aisle|left|right|teacher|door|window|accessible|accessibility)\b/i;
    const display = studentName(student);
    if (!reserved.test(display)) return display;
    const candidates = [student?.lastName, student?.nickName, [student?.firstName, student?.lastName].filter(Boolean).join(' ')].map(normalizeText).filter(Boolean);
    const safe = candidates.find(value => !reserved.test(value) && aliasIsUnique(value, student?.id));
    return safe || display;
  }

  function canonicalNames(command) {
    return mentionedStudents(command).filter(hit => hit.students.length === 1).map(hit => safeStudentReference(hit.students[0]));
  }

  function displayMentionNames(command) {
    return mentionedStudents(command).filter(hit => hit.students.length === 1).map(hit => studentName(hit.students[0]));
  }

  function normalizeAssistantCommand(input) {
    const raw = normalizeText(input);
    if (!raw) return raw;

    const text = lower(raw);
    const names = canonicalNames(raw);
    const first = names[0] || '';
    const second = names[1] || '';

    if (/^(help|commands|examples|what can you do|how does this work)\??$/.test(text) ||
        /\b(help|show|tell|explain)\b.*\b(planner assistant|assistant)\b/.test(text)) {
      return 'Help me use the Planner Assistant';
    }

    if (first && second) {
      if (/\b(apart|separate|away from|not next to|not together|keep .* away)\b/.test(text) || /\b(?:do not|don't)\b.*\b(next to|beside|by|near|together)\b/.test(text)) {
        return `Keep ${first} and ${second} apart`;
      }
      if (/\b(next to|beside|by|together|partner|partners|near|near each other|close to|close to each other)\b/.test(text)) {
        return `Seat ${first} and ${second} together`;
      }
    }

    if (first) {
      if (/\b(where|which seat|find|show)\b.*\b(sit|seat|place|go)\b|\bseat options?\b|\bplaces? for\b/.test(text)) {
        return `Where can ${first} sit?`;
      }
      if (/\bwhy\b.*\b(sit|seat|sitting|seated|placed|placement)\b/.test(text)) {
        return `Why is ${first} seated here?`;
      }
      if (/\b(front|front row|closer to the front|near the front)\b/.test(text)) {
        return `Keep ${first} near the front`;
      }
      if (/\b(near|close to)\b.*\bteacher\b/.test(text)) {
        return `Keep ${first} near the teacher`;
      }
      if (/\baisle\b/.test(text)) return `Keep ${first} near an aisle`;
      if (/\b(accessib(?:le|ility)?|wheelchair|mobility|ada\s+(?:seat|seating|access|requirement|accommodation))\b/.test(text)) {
        return `Keep ${first} accessible`;
      }
      if (/\b(away|far)\b.*\bdoor\b/.test(text)) return `Keep ${first} away from the door`;
      if (/\b(away|far)\b.*\bwindow\b/.test(text)) return `Keep ${first} away from the window`;
    }

    if (recognized(raw)) return raw;

    if (/\b(direct instruction|rows?|lecture|front facing|front-facing)\b/.test(text) &&
        /\b(make|create|build|arrange|layout|set up|setup|put)\b/.test(text)) {
      return 'Create a Direct Instruction layout';
    }
    if (/\b(group work|groups?|pods?|collaborative|collaboration|team tables?)\b/.test(text) &&
        /\b(make|create|build|arrange|layout|set up|setup|put|desks?)\b/.test(text)) {
      return 'Create a Group Work layout';
    }
    if (/\b(discussion|circle|seminar|socratic)\b/.test(text) &&
        /\b(make|create|build|arrange|layout|set up|setup)\b/.test(text)) {
      return 'Create a Discussion Circle layout';
    }
    if (/\b(lab|centers?|station work)\b/.test(text) &&
        /\b(make|create|build|arrange|layout|set up|setup)\b/.test(text)) {
      return 'Create a Lab / Stations layout';
    }
    if (/\b(independent|individual|quiet work|spaced work)\b/.test(text) &&
        /\b(make|create|build|arrange|layout|set up|setup)\b/.test(text)) {
      return 'Create an Independent Work layout';
    }

    if (/\b(test|testing|exam|assessment)\b/.test(text) &&
        /\b(make|create|build|arrange|layout|spread|space|set up|setup)\b/.test(text)) {
      return `Create a testing layout${spacingPhrase(raw)}`;
    }

    if (/\b(station|stations|centers?)\b/.test(text) && /\b(rotat|rotation|rotate|rounds?)\b/.test(text)) {
      const count = text.match(/\b(\d+)\s*(groups?|teams?)\b/)?.[1];
      return count ? `Make a station rotation with ${count} groups` : 'Set up station rotations';
    }

    if (/\b(fix|repair|resolve|clean up|improve)\b/.test(text) && /\b(chart|plan|seating|conflict|problem|issue)\b/.test(text)) {
      const limit = text.match(/\b(?:at most|no more than|max(?:imum)?(?: of)?|up to)\s*(\d+)\s*(?:student )?(?:moves?|students?)\b/)?.[1];
      return limit ? `Fix this plan but move no more than ${limit} students` : 'Make the smallest changes needed to fix conflicts';
    }

    if (/\b(what is wrong|what's wrong|show problems?|show issues?|explain conflicts?|why are there conflicts?)\b/.test(text)) {
      return 'Explain the conflicts';
    }

    if (/\b(randomize|randomise|shuffle|mix up)\b/.test(text)) return 'Randomize the seats';

    if (/\b(generate|make|create|build)\b/.test(text) && /\b(seating chart|seating plan|best chart|best plan|best seating)\b/.test(text)) {
      return 'Generate the best seating plan';
    }

    return raw;
  }

  function hideLegacyAssistantChrome() {
    const legacyDock = document.getElementById('plannerAssistantV710Dock');
    if (legacyDock) legacyDock.setAttribute('aria-hidden', 'true');
    const legacyRestore = document.getElementById('plannerAssistantV710Restore');
    if (legacyRestore) legacyRestore.setAttribute('aria-hidden', 'true');
  }

  function dockMarkup() {
    return `<button id="plannerAssistantV721DockOpen" type="button" class="v721-dock-label" title="Open Planner Assistant (Ctrl+Alt+P)">Planner Assistant</button>
      <input id="plannerAssistantV721DockInput" aria-label="Planner Assistant request" autocomplete="off" placeholder="Ask for a seating, rule, layout, testing, or repair action…" />
      <button id="plannerAssistantV721DockPreview" type="button">Preview</button>
      <button id="plannerAssistantV721DockGuide" class="secondary tiny" type="button" title="How to use Planner Assistant">?</button>
      <button id="plannerAssistantV721DockCompact" class="ghost tiny" type="button" aria-label="Minimize Planner Assistant" title="Minimize Planner Assistant">−</button>
      <button id="plannerAssistantV721DockHide" class="ghost tiny" type="button" aria-label="Hide Planner Assistant" title="Hide Planner Assistant">×</button>`;
  }

  function ensureLaunchers() {
    let dock = document.getElementById(DOCK_ID);
    if (!dock) {
      dock = document.createElement('div');
      dock.id = DOCK_ID;
      dock.className = 'v721-assistant-dock no-print';
      dock.innerHTML = dockMarkup();
      document.body.appendChild(dock);
    }

    let compact = document.getElementById(COMPACT_ID);
    if (!compact) {
      compact = document.createElement('button');
      compact.id = COMPACT_ID;
      compact.type = 'button';
      compact.className = 'v721-assistant-compact secondary tiny no-print';
      compact.textContent = 'Planner Assistant';
      compact.title = 'Open Planner Assistant';
      document.body.appendChild(compact);
    }
    applyDisplayMode();
    return { dock, compact };
  }

  function applyDisplayMode() {
    hideLegacyAssistantChrome();
    const dock = document.getElementById(DOCK_ID);
    const compact = document.getElementById(COMPACT_ID);
    const presentation = isPresentationMode();
    if (dock) dock.hidden = presentation || displayMode !== 'expanded';
    if (compact) compact.hidden = presentation || displayMode !== 'compact';
  }

  function openWithRequest(raw) {
    if (isPresentationMode()) return null;
    const source = normalizeText(raw);
    const canonical = normalizeAssistantCommand(source);
    lastOriginalRequest = source;
    const api = assistant();
    if (!api) {
      announce('Planner Assistant is unavailable in this build.');
      return null;
    }
    api.open?.(canonical);
    const preview = api.preview?.(canonical);
    setTimeout(() => enhancePreview(preview, source, canonical), 0);
    return preview;
  }

  function showGuide() {
    const api = assistant();
    if (!api) return;
    api.showGuide?.();
    setTimeout(enhanceGuide, 0);
  }

  function enhanceGuide() {
    const guide = document.getElementById('plannerAssistantV710Guide');
    if (!guide || document.getElementById('plannerAssistantV721GuideNote')) return;
    const note = document.createElement('div');
    note.id = 'plannerAssistantV721GuideNote';
    note.className = 'v721-guide-note';
    note.innerHTML = '<strong>What this assistant is</strong><span>It is a local classroom command interpreter, not an open-ended chatbot. Ask for one clear planner outcome at a time. Student names, groups, layouts, testing, station rotations, rule conflicts, and repair requests work best.</span><strong>If a request is not recognized</strong><span>Nothing changes. Use one of the suggested examples, or rephrase the request with the student or planner action named explicitly.</span>';
    guide.appendChild(note);
  }

  function suggestionsFor(raw) {
    const names = displayMentionNames(raw);
    const first = names[0] || activeStudents()[0] && studentName(activeStudents()[0]);
    const second = names[1] || activeStudents()[1] && studentName(activeStudents()[1]);
    const suggestions = [];
    if (first) suggestions.push(`Where can ${first} sit?`, `Keep ${first} near the front`);
    if (first && second) suggestions.push(`Seat ${first} and ${second} together`);
    suggestions.push('Explain the conflicts', 'Make the smallest changes needed to fix conflicts', 'Generate the best seating plan');
    return [...new Set(suggestions)].slice(0, 6);
  }

  function sanitizePreview(preview, original) {
    if (!preview || preview.intent !== 'rule_changes') return preview;
    const changes = preview.parameters?.requirementChanges;
    if (!changes || changes.ada !== true) return preview;
    const namedAda = mentionedStudents(original).some(hit => hit.students.length === 1 && aliases(hit.students[0]).some(alias => lower(alias) === 'ada'));
    const explicitlyAccessibility = /\b(accessib(?:le|ility)?|wheelchair|mobility|ada\s+(?:seat|seating|access|requirement|accommodation))\b/i.test(String(original || ''));
    if (!namedAda || explicitlyAccessibility) return preview;
    delete changes.ada;
    if (Array.isArray(preview.operations)) preview.operations = preview.operations.filter(item => !/: ada =/i.test(String(item)));
    if (!Object.keys(changes).length) {
      preview.parameters.requirementTargetIds = [];
      if (!preview.parameters.relation) {
        preview.intent = 'unknown';
        preview.title = 'I need a little more detail';
        preview.summary = 'I recognized the student name, but not a planner action. Try a seating, rule, layout, testing, station-rotation, explanation, or conflict-repair request.';
        preview.canApply = false;
        preview.mutates = false;
        preview.operations = [];
      }
    }
    return preview;
  }

  function enhancePreview(preview, original = lastOriginalRequest, canonical = '') {
    preview = sanitizePreview(preview, original || canonical);
    const node = document.getElementById('plannerAssistantV710Preview');
    if (!node) return;
    node.querySelector('#plannerAssistantV721RequestNote')?.remove();
    node.querySelector('#plannerAssistantV721Suggestions')?.remove();

    if (original && canonical && lower(original) !== lower(canonical)) {
      const note = document.createElement('div');
      note.id = 'plannerAssistantV721RequestNote';
      note.className = 'hint v721-request-note';
      note.textContent = `You asked: “${original}”  •  Interpreted as: “${canonical}”`;
      node.prepend(note);
    }

    const current = preview || assistant()?.currentPreview?.();
    if (!current || !['unknown', 'ambiguous'].includes(current.intent)) return;

    const panel = document.createElement('div');
    panel.id = 'plannerAssistantV721Suggestions';
    panel.className = 'v721-assistant-suggestions';
    const suggestions = suggestionsFor(original || current.command || '');
    panel.innerHTML = `<div><strong>${current.intent === 'ambiguous' ? 'Choose a more specific student name' : 'Try one of these classroom requests'}</strong><span>The Assistant never guesses when it cannot safely map a request.</span></div>
      <div class="v721-suggestion-row">${suggestions.map(value => `<button type="button" class="tiny secondary" data-v721-suggestion="${esc(value)}">${esc(value)}</button>`).join('')}</div>
      <button id="plannerAssistantV721PreviewGuide" class="ghost tiny" type="button">Open the Planner Assistant guide</button>`;
    node.appendChild(panel);
  }

  function removeRepeatedContextHelp() {
    document.querySelectorAll('.guided-context-button').forEach(button => button.remove());
    document.querySelectorAll('button').forEach(button => {
      if (/^guide me$/i.test(normalizeText(button.textContent)) && !button.closest('#guidedLessonOverlay')) button.remove();
    });
  }

  function injectSettings() {
    const page = document.getElementById('settingsPageHelp');
    if (!page || document.getElementById(SETTINGS_ID)) return;
    const section = document.createElement('section');
    section.id = SETTINGS_ID;
    section.className = 'section settings-section';
    section.innerHTML = `<h3>Planner Assistant</h3>
      <div class="hint">The Planner Assistant is a local command interpreter for classroom-specific actions. It does not send classroom data to an external AI service.</div>
      <div class="field">
        <label for="plannerAssistantV721DisplayMode">Assistant display</label>
        <select id="plannerAssistantV721DisplayMode">
          <option value="expanded">Command bar</option>
          <option value="compact">Compact launcher</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>
      <div class="button-row">
        <button id="plannerAssistantV721SettingsOpen" class="secondary" type="button">Open Planner Assistant</button>
        <button id="plannerAssistantV721SettingsGuide" class="secondary" type="button">How to use it</button>
      </div>
      <div class="hint">If hidden, the Assistant stays out of the workspace entirely. Re-enable it here at any time.</div>`;
    page.appendChild(section);
    syncSettingsControls();
  }

  function injectGlobalHelp() {
    const view = document.getElementById('helpGuideReferenceView');
    if (!view || document.getElementById(HELP_ID)) return;
    const card = document.createElement('section');
    card.id = HELP_ID;
    card.className = 'section v721-help-card';
    card.innerHTML = `<div class="v721-help-card-head"><div><strong>Planner Assistant</strong><span>Use plain classroom requests to preview existing planner actions before anything changes.</span></div><div class="button-row"><button id="plannerAssistantV721HelpOpen" class="secondary" type="button">Open Assistant</button><button id="plannerAssistantV721HelpGuide" class="secondary" type="button">How to use it</button></div></div>
      <div class="v721-help-grid"><span><b>Students & rules</b> “Keep Maya near the front.” “Seat Ada next to Grace.”</span><span><b>Layouts & testing</b> “Make rows.” “Create a testing layout with 5 feet between students.”</span><span><b>Repair & explain</b> “What is wrong with this chart?” “Fix it but move no more than 4 students.”</span><span><b>Stations & seating</b> “Make a station rotation with 3 groups.” “Generate the best seating plan.”</span></div>`;
    const searchRow = view.querySelector('.help-guide-search-row');
    if (searchRow) searchRow.insertAdjacentElement('afterend', card);
    else view.prepend(card);
  }

  function syncSettingsControls() {
    const select = document.getElementById('plannerAssistantV721DisplayMode');
    if (select && select.value !== displayMode) select.value = displayMode;
  }

  function prepareLegacyModal() {
    const hide = document.getElementById('plannerAssistantV710HideDockBtn');
    if (hide) {
      if (hide.textContent !== 'Hide Assistant') hide.textContent = 'Hide Assistant';
      const help = 'Hide the Planner Assistant from the workspace. Re-enable it from Settings > Help & Guides.';
      if (hide.title !== help) hide.title = help;
    }
    const title = document.querySelector('#plannerAssistantV710Modal .v710-kicker');
    if (title && title.textContent !== 'Local Planner Assistant') title.textContent = 'Local Planner Assistant';
    enhanceGuide();
  }

  function normalizeLegacyModalInput() {
    const input = document.getElementById('plannerAssistantV710Input');
    if (!input) return;
    const raw = normalizeText(input.value);
    if (!raw) return;
    const canonical = normalizeAssistantCommand(raw);
    if (canonical !== raw) {
      input.dataset.v721OriginalRequest = raw;
      lastOriginalRequest = raw;
      input.value = canonical;
    } else {
      lastOriginalRequest = raw;
    }
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('#plannerAssistantV721DockOpen')) { assistant()?.open?.(); return; }
    if (target.closest('#plannerAssistantV721DockPreview')) {
      openWithRequest(document.getElementById('plannerAssistantV721DockInput')?.value || '');
      return;
    }
    if (target.closest('#plannerAssistantV721DockGuide')) { showGuide(); return; }
    if (target.closest('#plannerAssistantV721DockCompact')) { setMode('compact'); return; }
    if (target.closest('#plannerAssistantV721DockHide')) { setMode('hidden'); return; }
    if (target.closest(`#${COMPACT_ID}`)) { assistant()?.open?.(); return; }

    if (target.closest('#plannerAssistantV721SettingsOpen, #plannerAssistantV721HelpOpen')) { assistant()?.open?.(); return; }
    if (target.closest('#plannerAssistantV721SettingsGuide, #plannerAssistantV721HelpGuide, #plannerAssistantV721PreviewGuide')) { showGuide(); return; }

    const suggestion = target.closest('[data-v721-suggestion]');
    if (suggestion) {
      const value = suggestion.getAttribute('data-v721-suggestion') || '';
      const input = document.getElementById('plannerAssistantV710Input');
      if (input) input.value = value;
      openWithRequest(value);
      return;
    }

    if (target.closest('#plannerAssistantV710HideDockBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setMode('hidden');
      assistant()?.close?.();
      return;
    }

    if (target.closest('#plannerAssistantV710PreviewBtn')) {
      normalizeLegacyModalInput();
      setTimeout(() => {
        const input = document.getElementById('plannerAssistantV710Input');
        const canonical = normalizeText(input?.value || '');
        const original = input?.dataset.v721OriginalRequest || lastOriginalRequest || canonical;
        enhancePreview(assistant()?.currentPreview?.(), original, canonical);
      }, 0);
    }
  }

  function onKeydown(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.id === 'plannerAssistantV721DockInput' && event.key === 'Enter') {
      event.preventDefault();
      openWithRequest(target.value);
      return;
    }
    if (target.id === 'plannerAssistantV710Input' && event.key === 'Enter' && !event.shiftKey) {
      normalizeLegacyModalInput();
      setTimeout(() => {
        const canonical = normalizeText(target.value || '');
        const original = target.dataset.v721OriginalRequest || lastOriginalRequest || canonical;
        enhancePreview(assistant()?.currentPreview?.(), original, canonical);
      }, 0);
    }
  }

  function onChange(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.id === 'plannerAssistantV721DisplayMode') setMode(target.value);
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #plannerAssistantV710Dock,#plannerAssistantV710Restore{display:none!important}
      .v721-assistant-dock{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:721;display:grid;grid-template-columns:auto minmax(220px,1fr) auto auto auto auto;gap:7px;align-items:center;width:min(840px,calc(100vw - 24px));padding:7px;border:1px solid color-mix(in srgb,var(--border,#cbd5e1) 78%,#2563eb 22%);border-radius:14px;background:color-mix(in srgb,var(--panel,#fff) 96%,#eff6ff 4%);box-shadow:0 10px 28px rgba(15,23,42,.18);backdrop-filter:blur(8px)}
      .v721-assistant-dock[hidden],.v721-assistant-compact[hidden]{display:none!important}
      .v721-assistant-dock input{min-width:0}.v721-dock-label{white-space:nowrap;background:transparent!important;color:inherit!important;border-color:transparent!important;font-weight:900}
      .v721-assistant-compact{position:fixed;right:10px;bottom:10px;z-index:720}
      .v721-guide-note{display:grid;gap:5px;padding:10px;border:1px solid var(--border,#d8deea);border-radius:10px;background:color-mix(in srgb,var(--panel,#fff) 94%,#eef6ff 6%)}.v721-guide-note span{font-size:10.5px;color:var(--muted,#64748b);line-height:1.4}
      .v721-request-note{padding:7px 9px;border-radius:8px;background:color-mix(in srgb,var(--panel,#fff) 96%,#dbeafe 4%)}
      .v721-assistant-suggestions{display:grid;gap:8px;padding:10px;border:1px dashed var(--border,#cbd5e1);border-radius:10px}.v721-assistant-suggestions>div:first-child{display:grid;gap:2px}.v721-assistant-suggestions span{font-size:10px;color:var(--muted,#64748b)}.v721-suggestion-row{display:flex;gap:6px;flex-wrap:wrap}
      .v721-help-card{display:grid;gap:10px;margin:10px 0}.v721-help-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v721-help-card-head>div:first-child{display:grid;gap:3px}.v721-help-card-head span{font-size:11px;color:var(--muted,#64748b)}.v721-help-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v721-help-grid>span{display:grid;gap:3px;padding:9px;border:1px solid var(--border,#d8deea);border-radius:9px;font-size:10.5px;color:var(--muted,#64748b)}.v721-help-grid b{color:var(--text,#0f172a)}
      body.visibility-mode .v721-assistant-dock,body.visibility-mode .v721-assistant-compact{display:none!important}@media print{.v721-assistant-dock,.v721-assistant-compact{display:none!important}}
      @media(max-width:760px){.v721-assistant-dock{grid-template-columns:minmax(0,1fr) auto auto auto;bottom:7px;width:calc(100vw - 12px)}.v721-dock-label,.v721-assistant-dock #plannerAssistantV721DockGuide{display:none}.v721-help-card-head{flex-direction:column}.v721-help-grid{grid-template-columns:1fr}}
      @media(max-width:460px){.v721-assistant-dock{grid-template-columns:minmax(0,1fr) auto auto}.v721-assistant-dock #plannerAssistantV721DockCompact{display:none}.v721-suggestion-row{display:grid;grid-template-columns:1fr}.v721-suggestion-row button{text-align:left}}
    `;
    document.head.appendChild(style);
  }

  function refreshUi() {
    pendingRefresh = false;
    removeRepeatedContextHelp();
    hideLegacyAssistantChrome();
    ensureLaunchers();
    injectSettings();
    injectGlobalHelp();
    prepareLegacyModal();
    applyDisplayMode();
    syncSettingsControls();
  }

  function scheduleRefresh() {
    if (pendingRefresh) return;
    pendingRefresh = true;
    requestAnimationFrame(refreshUi);
  }

  function audit() {
    const ids = [...document.querySelectorAll('[id]')].map(node => node.id).filter(Boolean);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    const guideMe = [...document.querySelectorAll('button')].filter(button => /^guide me$/i.test(normalizeText(button.textContent)));
    const pageOverflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
    return {
      version:VERSION,
      displayMode,
      duplicateIds,
      guideMeCount:guideMe.length,
      contextualGuideCount:document.querySelectorAll('.guided-context-button').length,
      pageOverflow,
      legacyDockVisible:Boolean(document.getElementById('plannerAssistantV710Dock')?.offsetParent),
      legacyRestoreVisible:Boolean(document.getElementById('plannerAssistantV710Restore')?.offsetParent),
      dockVisible:Boolean(document.getElementById(DOCK_ID)?.offsetParent),
      compactVisible:Boolean(document.getElementById(COMPACT_ID)?.offsetParent)
    };
  }

  function install() {
    if (installed) return;
    installed = true;
    installStyles();
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('change', onChange, true);
    if (document.body) {
      bodyObserver = new MutationObserver(scheduleRefresh);
      bodyObserver.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
    }
    refreshUi();
  }

  function afterReady() {
    refreshUi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();

  return Object.freeze({
    version:VERSION,
    install,
    afterReady,
    audit,
    mode:() => displayMode,
    setMode,
    normalizeAssistantCommand,
    open:openWithRequest,
    showGuide,
    cleanupGuideButtons:removeRepeatedContextHelp
  });
})();
