import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text, 'utf8'); }
function replaceOnce(path, search, replacement) {
  const text = read(path);
  const count = text.split(search).length - 1;
  if (count !== 1) throw new Error(`${path}: expected exactly one occurrence, found ${count}: ${search.slice(0, 120)}`);
  write(path, text.replace(search, replacement));
}

const assistantPath = 'src/scripts/036-planner-assistant-v710.js';
let assistant = read(assistantPath);

assistant = assistant.replace(
  "  const HISTORY_PREFIX = 'classroom-seating-planner-assistant-history-v710:';\n  const MAX_HISTORY = 20;",
  "  const HISTORY_PREFIX = 'classroom-seating-planner-assistant-history-v710:';\n  const UI_PREFS_KEY = 'classroom-seating-planner-assistant-ui-v721';\n  const MAX_HISTORY = 20;"
);
assistant = assistant.replace(
  "  let installed = false;\n  let currentPreview = null;\n  let bodyObserver = null;",
  "  let installed = false;\n  let currentPreview = null;\n  let bodyObserver = null;\n  let uiPrefs = loadUiPrefs();"
);
assistant = assistant.replace(
  "  const countWarnings = findings => list(findings).filter(item => item?.severity !== 'bad').length;\n\n  function isPresentationMode()",
  `  const countWarnings = findings => list(findings).filter(item => item?.severity !== 'bad').length;\n\n  function loadUiPrefs() {\n    try {\n      const parsed = JSON.parse(localStorage.getItem(UI_PREFS_KEY) || '{}');\n      return { dockHidden:Boolean(parsed.dockHidden), guideOpen:Boolean(parsed.guideOpen) };\n    } catch (_) {\n      return { dockHidden:false, guideOpen:false };\n    }\n  }\n\n  function saveUiPrefs() {\n    try { localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiPrefs)); } catch (_) { /* preferences are optional */ }\n  }\n\n  function isPresentationMode()`
);

assistant = assistant.replace(
  "  function groupMatch(command) {",
  `  function parseCount(command, words = []) {\n    const text = lower(command);\n    for (const word of words) {\n      const match = text.match(new RegExp('\\\\b(\\\\d+)\\\\s+' + escapedRegex(word) + 's?\\\\b'));\n      if (match) return Math.max(1, Math.min(60, Number(match[1]) || 1));\n    }\n    return 0;\n  }\n\n  function requestedMaxMoves(command) {\n    const text = lower(command);\n    const match = text.match(/(?:move|moving|change|changing)\\s+(?:no more than|at most|max(?:imum)?(?: of)?|up to)\\s*(\\d+)\\s*students?|(?:no more than|at most|max(?:imum)?(?: of)?|up to)\\s*(\\d+)\\s*(?:student )?moves?/);\n    return match ? Math.max(1, Math.min(60, Number(match[1] || match[2]) || 1)) : 0;\n  }\n\n  function layoutPresetFromCommand(command) {\n    const text = lower(command);\n    const direct = [\n      ['direct', /\\b(direct instruction|rows?|lecture|front[- ]?facing)\\b/],\n      ['group', /\\b(group work|collaborative|collaboration|pods?|small groups?)\\b/],\n      ['discussion', /\\b(discussion|circle|seminar|socratic)\\b/],\n      ['lab', /\\b(lab|stations? layout|station work|centers?)\\b/],\n      ['independent', /\\b(independent|individual work|spaced work|quiet work)\\b/],\n      ['testing', /\\b(testing|test layout|assessment layout|exam layout)\\b/]\n    ];\n    return direct.find(([, pattern]) => pattern.test(text))?.[0] || '';\n  }\n\n  function groupMatch(command) {`
);

assistant = assistant.replace(
  "      title:'I could not map that request to a planner action',\n      summary:'Try a classroom-specific request using a student, rule, layout, testing, station rotation, or conflict-repair action.',",
  "      title:'I need a little more detail',\n      summary:'I did not recognize a safe planner action yet. Open the built-in guide for supported requests and examples, or name a student, group, layout, testing setup, station rotation, seating-plan action, or conflict to repair.',"
);

assistant = assistant.replace(
  "    if (ambiguities.length) {\n      result.intent = 'ambiguous';",
  `    if (ambiguities.length) {\n      result.intent = 'ambiguous';`
);

assistant = assistant.replace(
  "    if (/\\b(which|what)\\b.*\\b(requirement|rule|constraint)\\b.*\\b(conflict|problem|issue)|\\bwhat('?s| is) causing (the )?most conflicts?\\b/.test(text)) {",
  `    if (/\\b(help|how do i|how can i|what can|what does)\\b.*\\b(planner assistant|assistant)\\b|^\\s*(help|commands|examples)\\s*$/.test(text)) {\n      result.intent = 'assistant_help';\n      result.title = 'Planner Assistant guide';\n      result.summary = 'Open the built-in guide with supported request types, examples, and the review-before-apply workflow.';\n      result.operations = ['Open Planner Assistant guide'];\n      return result;\n    }\n\n    if (/\\b(which|what)\\b.*\\b(requirement|rule|constraint)\\b.*\\b(conflict|problem|issue)|\\bwhat('?s| is) causing (the )?most conflicts?\\b|\\b(explain|show|what(?: is|'s))\\b.*\\b(conflicts?|problems?|issues?|wrong)\\b|\\bwhat(?: is|'s) wrong\\b/.test(text)) {`
);

assistant = assistant.replace(
  "    if (/\\bvalid seats?\\b|\\bshow (me )?(the )?seats?\\b/.test(text) && exactStudents.length === 1) {",
  "    if ((/\\bvalid seats?\\b|\\bshow (me )?(the )?seats?\\b|\\bwhere can\\b.*\\b(sit|seat)\\b|\\bwhere (?:should|could)\\b.*\\b(sit|seat)\\b/.test(text)) && exactStudents.length === 1) {"
);

assistant = assistant.replace(
  "    if (/\\bwhy\\b.*\\b(sit|seat)\\b.*\\bthere\\b/.test(text) && exactStudents.length === 1) {",
  "    if (/\\bwhy\\b.*\\b(sit|seat|sitting|seated)\\b.*\\b(here|there|this seat)\\b/.test(text) && exactStudents.length === 1) {"
);

assistant = assistant.replace(
  "    if (/\\btesting\\b|\\btest layout\\b|\\bassessment layout\\b/.test(text)) {",
  "    if (/\\btesting\\b|\\btest layout\\b|\\bassessment layout\\b|\\b(spread|space)\\b.*\\b(test|exam|assessment)\\b/.test(text)) {"
);

assistant = assistant.replace(
  "    if (/\\bstation\\b.*\\brotation|\\brotation\\b.*\\bstation/.test(text)) {\n      result.intent = 'open_station_rotations';\n      result.title = 'Open Station Rotations';\n      result.summary = 'Open the existing Station Rotations workspace. No seating assignments will change.';\n      result.operations = ['Open Station Rotations'];\n      return result;\n    }",
  `    if (/\\bstations?\\b.*\\b(rotat|rotation)|\\b(rotat|rotation)\\b.*\\bstations?\\b/.test(text)) {\n      const groupCount = parseCount(command, ['group','team']);\n      const wantsCreate = /\\b(create|make|build|set up|setup|generate|plan)\\b/.test(text) || groupCount > 0 || /\\bthrough the stations?\\b/.test(text);\n      result.intent = wantsCreate ? 'create_station_rotation' : 'open_station_rotations';\n      result.title = wantsCreate ? 'Create a station rotation' : 'Open Station Rotations';\n      result.summary = wantsCreate ? 'Build a rotation from the current Freeform station anchors and active roster, then open it for review.' : 'Open the existing Station Rotations workspace. No seating assignments will change.';\n      result.parameters.teamCount = groupCount || 0;\n      result.parameters.teamSource = /\\b(existing|current|classroom) groups?\\b/.test(text) ? 'classroom-groups' : 'balanced';\n      if (wantsCreate) {\n        const candidates = window.StationRotationsV702?.stationCandidates?.() || [];\n        if (state?.layoutMode !== 'freeform') result.blockers.push('Station rotations require a Freeform room.');\n        if (candidates.length < 2) result.blockers.push('Add at least two Activity Stations, Lab Stations, or tables before creating a rotation.');\n        result.operations = ['Use current station anchors', 'Build teams from the active roster', 'Create the rotation and open Station Rotations'];\n      } else result.operations = ['Open Station Rotations'];\n      return result;\n    }`
);

assistant = assistant.replace(
  "    if (/\\b(switch|change|go)\\b.*\\b(layout|arrangement)\\b/.test(text)) {",
  `    const layoutPreset = layoutPresetFromCommand(command);\n    if (layoutPreset && /\\b(create|make|build|generate|new|layout|arrangement|classroom)\\b/.test(text) && !/\\btesting\\b|\\btest layout\\b|\\bassessment layout\\b/.test(text)) {\n      const preset = window.ActivityLayoutsV701?.presets?.find?.(item => item.id === layoutPreset);\n      result.intent = 'create_activity_layout';\n      result.title = \\`Create \\${preset?.name || 'Activity'} layout\\`;\n      result.summary = 'Create a separate Activity Layout from the current Freeform room using the existing starter arrangement. The current arrangement remains available.';\n      result.mutates = true;\n      result.parameters.presetId = layoutPreset;\n      result.parameters.presetName = preset?.name || layoutPreset;\n      result.operations = [\\`Create a new \\${preset?.name || layoutPreset} Activity Layout\\`, 'Keep fixed physical-room objects shared', 'Switch to the new arrangement for review'];\n      if (state?.layoutMode !== 'freeform') result.blockers.push('Activity Layouts require a Freeform room.');\n      return result;\n    }\n\n    if (/\\b(switch|change|go|use|activate)\\b.*\\b(layout|arrangement)\\b/.test(text)) {`
);

assistant = assistant.replace(
  "    if (/\\b(fix|repair|resolve)\\b.*\\b(conflicts?|problems?|issues?)\\b|\\bsmallest changes?\\b/.test(text)) {",
  "    if (/\\b(fix|repair|resolve|improve)\\b.*\\b(conflicts?|problems?|issues?|chart|plan|seating)|\\bsmallest changes?\\b|\\bchange as little as possible\\b|\\bminimal movement\\b/.test(text)) {"
);
assistant = assistant.replace(
  "      result.parameters.scenario = /\\bfair|rotation\\b/.test(text) ? 'rotation'",
  "      result.parameters.scenario = /\\bfair|rotation\\b/.test(text) ? 'rotation'"
);
assistant = assistant.replace(
  "      result.operations = [`Use the ${result.parameters.scenario} Classroom Intelligence objective`, 'Build a non-destructive repair preview'];\n      return result;",
  "      result.parameters.maxMoves = requestedMaxMoves(command);\n      result.operations = [`Use the ${result.parameters.scenario} Classroom Intelligence objective`, result.parameters.maxMoves ? `Limit the repair to at most ${result.parameters.maxMoves} student moves` : 'Use the objective’s normal movement limit', 'Build a non-destructive repair preview'];\n      return result;"
);

assistant = assistant.replace(
  "    const reqChanges = requirementChanges(command);",
  `    if (/\\b(randomize|shuffle|mix up)\\b.*\\b(seats?|students?|chart)?\\b/.test(text)) {\n      result.intent = 'randomize_chart';\n      result.title = 'Randomize and seat everyone';\n      result.summary = 'Use the existing Randomize + Seat Everyone action. Locked/manual placements remain protected by the normal seating workflow.';\n      result.mutates = true;\n      result.operations = ['Run Randomize + Seat Everyone'];\n      return result;\n    }\n\n    if (/\\b(make|create|generate|build)\\b.*\\b(seating chart|seating plan|best plan|best seating)\\b/.test(text)) {\n      result.intent = 'generate_chart';\n      result.title = 'Generate a seating chart';\n      result.summary = 'Use the existing rule-aware Generate Chart workflow and leave its normal candidate/review controls in charge.';\n      result.operations = ['Run the existing Generate Chart action', 'Review the generated seating option before accepting it'];\n      return result;\n    }\n\n    const reqChanges = requirementChanges(command);`
);

assistant = assistant.replace(
  "    const matchedGroup = groupMatch(command);\n    if (matchedGroup && /\\b(together|spread|apart)\\b/.test(text)) {",
  "    const matchedGroup = groupMatch(command);\n    if (matchedGroup && /\\b(together|spread|apart|separate|nearby|close)\\b/.test(text)) {"
);
assistant = assistant.replace(
  "      const nextType = /\\bspread|apart\\b/.test(text) ? 'spread' : 'together';",
  "      const nextType = /\\bspread|apart|separate\\b/.test(text) ? 'spread' : 'together';"
);

assistant = assistant.replace(
  "    } else if (intent.intent === 'preview_repair') {\n      try {\n        setIntelligenceScenario(intent.parameters.scenario || 'balanced');",
  `    } else if (intent.intent === 'create_activity_layout') {\n      preview.impact.metrics.push(metric('Starter', intent.parameters.presetName || intent.parameters.presetId), metric('Current seats', list(state?.freeformLayout?.objects).filter(item => item?.type === 'seat').length));\n      preview.details.push('A new Activity Layout will be created. The current layout remains available for switching back.');\n    } else if (intent.intent === 'create_station_rotation') {\n      const candidates = window.StationRotationsV702?.stationCandidates?.() || [];\n      const active = typeof seatingStudents === 'function' ? list(seatingStudents()) : students();\n      const requestedTeams = Number(intent.parameters.teamCount) || Math.min(candidates.length, Math.max(1, active.length));\n      preview.impact.metrics.push(metric('Station anchors', candidates.length), metric('Active students', active.length), metric('Teams requested', Math.min(requestedTeams, candidates.length || requestedTeams)));\n    } else if (intent.intent === 'randomize_chart') {\n      preview.impact.metrics.push(metric('Active students', typeof seatingStudents === 'function' ? list(seatingStudents()).length : students().length), metric('Locked placements', document.querySelectorAll('.seat.locked,.freeform-object.seat.locked').length));\n    } else if (intent.intent === 'generate_chart') {\n      preview.impact.metrics.push(metric('Active students', typeof seatingStudents === 'function' ? list(seatingStudents()).length : students().length), metric('Current required conflicts', countHard(currentFindings())));\n    } else if (intent.intent === 'preview_repair') {\n      try {\n        setIntelligenceScenario(intent.parameters.scenario || 'balanced', intent.parameters.maxMoves || 0);`
);

assistant = assistant.replace(
  "  function setIntelligenceScenario(scenario) {\n    const api = window.ClassroomIntelligenceV68;\n    if (!api) return;\n    try {\n      api.render?.();\n      const button = document.querySelector(`[data-intelligence-scenario=\"${String(scenario)}\"]`);\n      if (button && !button.classList.contains('active')) button.click();\n    } catch (_) { /* objective selection is best effort */ }\n  }",
  `  function setIntelligenceScenario(scenario, maxMoves = 0) {\n    const api = window.ClassroomIntelligenceV68;\n    if (!api) return;\n    try {\n      if (typeof api.setScenario === 'function') api.setScenario(scenario, { maxMoves });\n      else {\n        api.render?.();\n        const button = document.querySelector(\\`[data-intelligence-scenario="\\${String(scenario)}"]\\`);\n        if (button && !button.classList.contains('active')) button.click();\n      }\n    } catch (_) { /* objective selection is best effort */ }\n  }`
);

assistant = assistant.replace(
  "      } else if (preview.intent === 'testing_preview') {",
  `      } else if (preview.intent === 'assistant_help') {\n        setGuideOpen(true);\n        message = 'Planner Assistant guide opened.';\n      } else if (preview.intent === 'create_activity_layout') {\n        if (typeof pushUndoSnapshot === 'function') pushUndoSnapshot(\\`Before Planner Assistant layout: \\${preview.command}\\`);\n        const entry = window.ActivityLayoutsV701?.create?.(preview.parameters.presetId, { name:preview.parameters.presetName });\n        if (!entry) return { ok:false, message:'The Activity Layout could not be created.' };\n        window.ActivityLayoutsV701?.open?.();\n        message = \\`Created \\${entry.name} as a separate Activity Layout and opened Activity Layouts for review.\\`;\n      } else if (preview.intent === 'create_station_rotation') {\n        const candidates = window.StationRotationsV702?.stationCandidates?.() || [];\n        const plan = window.StationRotationsV702?.createPlan?.({\n          name:'Station Rotation',\n          teamCount:preview.parameters.teamCount || Math.min(candidates.length, 6),\n          teamSource:preview.parameters.teamSource || 'balanced',\n          stationIds:candidates.map(item => item.objectId)\n        });\n        if (!plan) return { ok:false, message:'The station rotation could not be created. Check the station anchors and active roster.' };\n        window.StationRotationsV702?.open?.();\n        message = \\`Created \\${plan.name} with \\${plan.teams.length} teams and \\${plan.stations.length} stations.\\`;\n      } else if (preview.intent === 'randomize_chart') {\n        const button = document.getElementById('randomizeAllBtn');\n        if (!button) return { ok:false, message:'The Randomize + Seat Everyone action is unavailable on this screen.' };\n        button.click();\n        message = 'Ran Randomize + Seat Everyone using the normal seating workflow.';\n      } else if (preview.intent === 'generate_chart') {\n        const button = document.getElementById('generateBtn');\n        if (!button) return { ok:false, message:'Generate Chart is unavailable on this screen.' };\n        button.click();\n        message = 'Opened the normal Generate Chart workflow for review.';\n      } else if (preview.intent === 'testing_preview') {`
);
assistant = assistant.replace(
  "        setIntelligenceScenario(preview.data?.repairScenario || preview.parameters.scenario || 'balanced');",
  "        setIntelligenceScenario(preview.data?.repairScenario || preview.parameters.scenario || 'balanced', preview.parameters.maxMoves || 0);"
);

assistant = assistant.replace(
  "  function modalMarkup() {\n    return `<div id=\"${MODAL_ID}\"",
  `  function guideMarkup() {\n    return \\`<section id="plannerAssistantV710Guide" class="section v710-guide" \\${uiPrefs.guideOpen ? '' : 'hidden'}><div class="v710-section-head"><div><h3>How to use Planner Assistant</h3><p>Write the classroom outcome you want, preview the interpretation, then apply only after the proposed action looks right.</p></div><button id="plannerAssistantV710GuideCloseBtn" class="tiny secondary" type="button">Hide guide</button></div><div class="v710-guide-grid"><article><strong>Students & rules</strong><span>“Keep Maya near the front and away from the door.”</span><span>“Keep Noah and Eli apart.”</span><span>“Where can Ada sit?”</span></article><article><strong>Layouts & testing</strong><span>“Create a collaborative layout.”</span><span>“Make a discussion layout.”</span><span>“Create a testing layout with 5 feet between students.”</span></article><article><strong>Repair & explain</strong><span>“Fix this plan but move no more than 4 students.”</span><span>“Explain the conflicts.”</span><span>“Why is Ada sitting here?”</span></article><article><strong>Stations & seating</strong><span>“Make a station rotation with 3 groups.”</span><span>“Generate the best seating plan.”</span><span>“Randomize the seats.”</span></article></div><div class="hint">The assistant is local and deterministic. It recognizes classroom-planning language, not arbitrary conversation. It never invents a student or silently applies a rule.</div></section>\\`;\n  }\n\n  function modalMarkup() {\n    return \\`<div id="\\${MODAL_ID}"`
);

assistant = assistant.replace(
  "<button id=\"plannerAssistantV710CloseBtn\" class=\"tiny secondary\" type=\"button\">Close</button></div><div class=\"modal-body v710-modal-body\"><div class=\"v710-intro\">",
  "<div class=\"button-row\"><button id=\"plannerAssistantV710GuideBtn\" class=\"tiny secondary\" type=\"button\">Guide</button><button id=\"plannerAssistantV710HideDockBtn\" class=\"tiny secondary\" type=\"button\">Hide bar</button><button id=\"plannerAssistantV710CloseBtn\" class=\"tiny secondary\" type=\"button\">Close</button></div></div><div class=\"modal-body v710-modal-body\"><div class=\"v710-intro\">"
);
assistant = assistant.replace(
  "</div><section class=\"section v710-request\">",
  "</div>${guideMarkup()}<section class=\"section v710-request\">"
);

assistant = assistant.replace(
  "      if (event.target?.id === 'plannerAssistantV710PreviewBtn') previewCommand(modal.querySelector('#plannerAssistantV710Input')?.value || '');",
  `      if (event.target?.id === 'plannerAssistantV710GuideBtn') setGuideOpen(!uiPrefs.guideOpen);\n      if (event.target?.id === 'plannerAssistantV710GuideCloseBtn') setGuideOpen(false);\n      if (event.target?.id === 'plannerAssistantV710HideDockBtn') setDockHidden(true);\n      if (event.target?.id === 'plannerAssistantV710PreviewBtn') previewCommand(modal.querySelector('#plannerAssistantV710Input')?.value || '');`
);

assistant = assistant.replace(
  "    return `<article class=\"v710-preview-card\"><header>",
  "    const unknownHelp = preview.intent === 'unknown' ? '<div class=\"v710-block v710-unknown-help\"><b>Try one of these</b><div class=\"button-row\"><button type=\"button\" class=\"tiny secondary\" id=\"plannerAssistantV710GuideBtn\">Open guide</button></div><p>Examples: “Where can Maya sit?”, “Create a collaborative layout”, “Fix this plan but move no more than 4 students”, or “Explain the conflicts”.</p></div>' : '';\n    return `<article class=\"v710-preview-card\"><header>"
);
assistant = assistant.replace(
  "${blockers.length ? `<div class=\"v710-block warning\"><b>Cannot apply yet</b><ul>${blockers.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}<footer>",
  "${blockers.length ? `<div class=\"v710-block warning\"><b>Cannot apply yet</b><ul>${blockers.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}${unknownHelp}<footer>"
);

assistant = assistant.replace(
  "  function dockMarkup() {\n    return `<button id=\"plannerAssistantV710DockOpen\"",
  `  function setGuideOpen(open) {\n    uiPrefs.guideOpen = Boolean(open);\n    saveUiPrefs();\n    const guide = document.getElementById('plannerAssistantV710Guide');\n    if (guide) guide.hidden = !uiPrefs.guideOpen;\n    const button = document.getElementById('plannerAssistantV710GuideBtn');\n    if (button) button.setAttribute('aria-expanded', uiPrefs.guideOpen ? 'true' : 'false');\n  }\n\n  function setDockHidden(hidden) {\n    uiPrefs.dockHidden = Boolean(hidden);\n    saveUiPrefs();\n    const dock = document.getElementById(DOCK_ID);\n    if (dock) dock.hidden = uiPrefs.dockHidden;\n    const restore = document.getElementById('plannerAssistantV710Restore');\n    if (restore) restore.hidden = !uiPrefs.dockHidden || isPresentationMode();\n  }\n\n  function dockMarkup() {\n    return \\`<button id="plannerAssistantV710DockOpen"`
);
assistant = assistant.replace(
  "<button id=\"plannerAssistantV710DockPreview\" type=\"button\">Preview</button>`;",
  "<button id=\"plannerAssistantV710DockPreview\" type=\"button\">Preview</button><button id=\"plannerAssistantV710DockHide\" class=\"ghost tiny v710-dock-hide\" type=\"button\" aria-label=\"Hide Planner Assistant bar\" title=\"Hide Planner Assistant bar\">×</button>`;"
);
assistant = assistant.replace(
  "    document.body.appendChild(dock);\n    dock.addEventListener('click', event => {",
  "    document.body.appendChild(dock);\n    let restore = document.getElementById('plannerAssistantV710Restore');\n    if (!restore) { restore = document.createElement('button'); restore.id = 'plannerAssistantV710Restore'; restore.type = 'button'; restore.className = 'v710-restore secondary tiny no-print'; restore.textContent = 'Planner Assistant'; restore.title = 'Show Planner Assistant bar'; document.body.appendChild(restore); restore.addEventListener('click', () => setDockHidden(false)); }\n    dock.addEventListener('click', event => {"
);
assistant = assistant.replace(
  "      if (event.target?.id === 'plannerAssistantV710DockOpen') { open(); return; }",
  "      if (event.target?.id === 'plannerAssistantV710DockHide') { setDockHidden(true); return; }\n      if (event.target?.id === 'plannerAssistantV710DockOpen') { open(); return; }"
);
assistant = assistant.replace(
  "    dock.querySelector('#plannerAssistantV710DockInput')?.addEventListener('keydown', event => {",
  "    setDockHidden(uiPrefs.dockHidden);\n    dock.querySelector('#plannerAssistantV710DockInput')?.addEventListener('keydown', event => {"
);

assistant = assistant.replace(
  ".v710-dock{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:720;display:grid;grid-template-columns:auto minmax(180px,1fr) auto;",
  ".v710-dock{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:720;display:grid;grid-template-columns:auto minmax(180px,1fr) auto auto;"
);
assistant = assistant.replace(
  ".v710-dock-label{white-space:nowrap;background:transparent!important;color:inherit!important;border-color:transparent!important;font-weight:900}",
  ".v710-dock-label{white-space:nowrap;background:transparent!important;color:inherit!important;border-color:transparent!important;font-weight:900}.v710-dock-hide{min-width:32px;padding-inline:8px}.v710-restore{position:fixed;right:10px;bottom:10px;z-index:719;box-shadow:0 6px 18px rgba(15,23,42,.16)}"
);
assistant = assistant.replace(
  ".v710-history-item span{font-size:9.5px;color:var(--muted,#64748b)}body.visibility-mode .v710-dock{display:none!important}",
  ".v710-history-item span{font-size:9.5px;color:var(--muted,#64748b)}.v710-guide{display:grid;gap:10px}.v710-guide[hidden]{display:none!important}.v710-guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v710-guide-grid article{display:grid;gap:4px;padding:10px;border:1px solid var(--border,#d8deea);border-radius:10px;background:var(--panel,#fff)}.v710-guide-grid article span{font-size:10px;color:var(--muted,#64748b)}.v710-unknown-help p{margin:7px 0 0;color:var(--muted,#64748b)}body.visibility-mode .v710-dock,body.visibility-mode .v710-restore{display:none!important}"
);
assistant = assistant.replace(
  "@media print{.v710-dock,.v710-modal{display:none!important}}",
  "@media print{.v710-dock,.v710-restore,.v710-modal{display:none!important}}"
);
assistant = assistant.replace(
  "@media(max-width:760px){.v710-dock{grid-template-columns:minmax(0,1fr) auto;",
  "@media(max-width:760px){.v710-dock{grid-template-columns:minmax(0,1fr) auto auto;"
);
assistant = assistant.replace(
  ".v710-intro{grid-template-columns:1fr}.v710-metrics{grid-template-columns:1fr 1fr}",
  ".v710-intro{grid-template-columns:1fr}.v710-guide-grid{grid-template-columns:1fr}.v710-metrics{grid-template-columns:1fr 1fr}"
);

assistant = assistant.replace(
  "        if (isPresentationMode()) close();",
  "        if (isPresentationMode()) close();\n        document.getElementById('plannerAssistantV710Restore')?.toggleAttribute('hidden', !uiPrefs.dockHidden || isPresentationMode());"
);
assistant = assistant.replace(
  "    ensureDock();\n    renderHistory();",
  "    ensureDock();\n    setDockHidden(uiPrefs.dockHidden);\n    setGuideOpen(uiPrefs.guideOpen);\n    renderHistory();"
);
assistant = assistant.replace(
  "    close,\n    history:loadHistory,",
  "    close,\n    showGuide:() => { open(); setGuideOpen(true); },\n    hideDock:() => setDockHidden(true),\n    showDock:() => setDockHidden(false),\n    dockHidden:() => uiPrefs.dockHidden,\n    history:loadHistory,"
);
write(assistantPath, assistant);

// Classroom Intelligence: expose deterministic scenario selection and a temporary max-move override.
const intelligencePath = 'src/scripts/027-classroom-intelligence-v68.js';
let intelligence = read(intelligencePath);
intelligence = intelligence.replace(
  "  let activeScenario = 'balanced';\n  let repairPreview = null;",
  "  let activeScenario = 'balanced';\n  let repairPreview = null;\n  let maxMovesOverride = 0;"
);
intelligence = intelligence.replace(
  "      for (let step = 0; step < scenario().maxMoves; step += 1) {",
  "      const moveLimit = maxMovesOverride > 0 ? Math.min(maxMovesOverride, scenario().maxMoves) : scenario().maxMoves;\n      for (let step = 0; step < moveLimit; step += 1) {"
);
intelligence = intelligence.replace(
  "  function render() {",
  `  function setScenario(id, options = {}) {\n    const next = String(id || 'balanced');\n    if (!SCENARIOS[next]) return false;\n    activeScenario = next;\n    maxMovesOverride = Math.max(0, Math.min(60, Number(options.maxMoves) || 0));\n    repairPreview = null;\n    render();\n    return true;\n  }\n\n  function render() {`
);
intelligence = intelligence.replace(
  "          activeScenario = next;\n          repairPreview = null;\n          render();",
  "          activeScenario = next;\n          maxMovesOverride = 0;\n          repairPreview = null;\n          render();"
);
intelligence = intelligence.replace(
  "    applyRepairPreview,\n    scenarios:",
  "    applyRepairPreview,\n    setScenario,\n    scenarios:"
);
write(intelligencePath, intelligence);

// Guided Learning: one global Guided Help entry is enough. Remove the repeated contextual Guide me injections.
const guidedPath = 'src/scripts/026-guided-learning.js';
let guided = read(guidedPath);
const start = guided.indexOf("  function insertContextButton(");
const end = guided.indexOf("\n  function resetProgress()", start);
if (start < 0 || end < 0) throw new Error('Could not locate contextual guide injection block.');
guided = guided.slice(0, start) + "  function installContextButtons() {\n    // Contextual Guide me buttons were intentionally removed. Guided Help remains available from the global header/help entry.\n  }\n" + guided.slice(end);
write(guidedPath, guided);

// Feature pack reflects the maintenance/UI release while feature modules keep their own semantic versions.
replaceOnce('src/scripts/025-classroom-feature-pack-v66.js', "document.body.dataset.featurePack = '7.2.0';", "document.body.dataset.featurePack = '7.2.1';");

// Tests: make the UI audit enforce the fixed behavior instead of only reporting it.
const auditPath = 'tests/browser/ui-audit-v721.spec.mjs';
let audit = read(auditPath);
audit = audit.replace(
  "  expect(audit.duplicateIds).toEqual([]);\n  expect(audit.pageOverflow).toBeLessThanOrEqual(2);",
  "  expect(audit.duplicateIds).toEqual([]);\n  expect(audit.guides).toEqual([]);\n  expect(audit.unknown).toEqual([]);\n  expect(audit.pageOverflow).toBeLessThanOrEqual(2);"
);
// Replace the ineffective modal audit with direct open-and-measure checks.
const modalTestStart = audit.indexOf("test('V7.2.1 UI audit checks major modal bounds");
if (modalTestStart >= 0) {
  audit = audit.slice(0, modalTestStart) + `test('V7.2.1 Planner Assistant guide and hide controls work without page overflow', async ({ page }) => {\n  await ready(page);\n  await seedAuditClass(page);\n  await page.evaluate(() => window.PlannerAssistantV710.showGuide());\n  await expect(page.locator('#plannerAssistantV710Modal')).toHaveClass(/\\bshow\\b/);\n  await expect(page.locator('#plannerAssistantV710Guide')).toBeVisible();\n  await page.locator('#plannerAssistantV710HideDockBtn').click();\n  await expect(page.locator('#plannerAssistantV710Dock')).toBeHidden();\n  await expect(page.locator('#plannerAssistantV710Restore')).toBeVisible();\n  await page.locator('#plannerAssistantV710Restore').click();\n  await expect(page.locator('#plannerAssistantV710Dock')).toBeVisible();\n  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);\n  expect(overflow).toBeLessThanOrEqual(2);\n});\n`;
}
write(auditPath, audit);

// Add focused regression expectations for the newly supported teacher language.
const paTestPath = 'tests/browser/planner-assistant-v710.spec.mjs';
let paTest = read(paTestPath);
paTest += `\n\ntest('V7.2.1 Planner Assistant recognizes common teacher phrasing and exposes help/hide controls', async ({ page }) => {\n  await ready(page);\n  await seedPlannerRoom(page);\n  const result = await page.evaluate(() => {\n    const assistant = window.PlannerAssistantV710;\n    const commands = [\n      'Where can Ada sit?',\n      'Create a collaborative layout',\n      'Make a discussion layout',\n      'Spread everyone out for a test',\n      'Fix my seating chart',\n      'Fix this plan but move no more than 4 students',\n      'Explain the conflicts',\n      'Make a seating chart',\n      'Randomize the seats',\n      'What can the Planner Assistant do?'\n    ].map(command => ({ command, intent:assistant.interpret(command).intent }));\n    return { commands };\n  });\n  expect(result.commands.filter(item => item.intent === 'unknown')).toEqual([]);\n  expect(result.commands.find(item => item.command.startsWith('Fix this plan')).intent).toBe('preview_repair');\n  await page.evaluate(() => window.PlannerAssistantV710.showGuide());\n  await expect(page.locator('#plannerAssistantV710Guide')).toBeVisible();\n  await page.evaluate(() => window.PlannerAssistantV710.hideDock());\n  await expect(page.locator('#plannerAssistantV710Dock')).toBeHidden();\n  await page.evaluate(() => window.PlannerAssistantV710.showDock());\n  await expect(page.locator('#plannerAssistantV710Dock')).toBeVisible();\n});\n`;
write(paTestPath, paTest);

console.log('Planner Assistant and UI audit fixes staged.');
