window.InteroperabilityV69 = (() => {
  'use strict';

  const VERSION = '6.9.0';
  const ADAPTER_VERSION = 1;
  const PACKAGE_FORMAT = 'classroom-seating-planner-roster-import-v1';
  const STYLE_ID = 'interoperabilityV69Styles';
  const HISTORY_LIMIT = 30;
  const MAX_ROWS = 10000;
  const MAX_GROUPS = 500;
  let installed = false;
  let reviewSession = null;
  let mappingSession = null;
  let oneRosterSession = null;
  let microsoftSession = null;

  const list = value => Array.isArray(value) ? value : [];
  const text = value => String(value ?? '').trim();
  const lower = value => text(value).toLocaleLowerCase();
  const esc = value => typeof escapeHtml === 'function'
    ? escapeHtml(String(value ?? ''))
    : String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const nowIso = () => new Date().toISOString();
  const activeState = () => { try { return typeof state !== 'undefined' ? state : (window.state || null); } catch (_) { return window.state || null; } };

  function stableSourceSystem(value, fallback = 'csv') {
    const normalized = lower(value).replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return (normalized || fallback).slice(0, 80);
  }

  function sourceLabel(system) {
    const key = stableSourceSystem(system);
    const labels = {
      'google-classroom': 'Google Classroom',
      'oneroster-1.2': 'OneRoster 1.2',
      'microsoft-education': 'Microsoft Education',
      'sis-csv': 'SIS CSV',
      'csv': 'CSV'
    };
    return labels[key] || text(system) || 'Roster import';
  }

  function canonicalHeader(value) {
    return lower(value).replace(/[^a-z0-9]+/g, '');
  }

  function firstValue(record, aliases) {
    if (!record || typeof record !== 'object') return '';
    const entries = Object.entries(record);
    const map = new Map(entries.map(([key, value]) => [canonicalHeader(key), value]));
    for (const alias of aliases) {
      const value = map.get(canonicalHeader(alias));
      if (value !== undefined && text(value)) return text(value);
    }
    return '';
  }

  function splitMulti(value) {
    return text(value).split(/[;,|]/).map(item => item.trim()).filter(Boolean);
  }

  function emailKey(value) {
    const email = lower(value);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
  }

  function nameKey(record) {
    const first = lower(record?.firstName || record?.preferredName || record?.nickName);
    const last = lower(record?.lastName);
    return `${first}|${last}`;
  }

  function externalKey(system, externalId) {
    const id = text(externalId);
    return id ? `${stableSourceSystem(system)}|${id}` : '';
  }

  function sourceIdentifiers(input = {}, extra = {}) {
    const raw = input?.sourceIdentifiers && typeof input.sourceIdentifiers === 'object' ? input.sourceIdentifiers : {};
    const combined = { ...raw, ...extra };
    return Object.fromEntries(Object.entries(combined)
      .map(([key, value]) => [text(key).slice(0, 80), text(value).slice(0, 240)])
      .filter(([key, value]) => key && value)
      .slice(0, 24));
  }

  function normalizeGroupDescriptor(group, context = {}) {
    const sourceSystem = stableSourceSystem(group?.sourceSystem || context.sourceSystem || 'csv');
    const externalId = text(group?.externalId || group?.sourceGroupId || group?.id || group?.title || group?.name).slice(0, 240);
    const title = text(group?.title || group?.name || externalId || 'Imported group').slice(0, 120);
    return {
      adapterVersion: ADAPTER_VERSION,
      sourceSystem,
      sourceCourseId: text(group?.sourceCourseId || group?.courseId || context.sourceCourseId).slice(0, 160),
      externalId,
      title,
      memberExternalIds: Array.from(new Set(list(group?.memberExternalIds || group?.userIds || group?.members).map(value => text(value?.userId || value?.id || value)).filter(Boolean))).slice(0, MAX_ROWS)
    };
  }

  function normalizeRecord(input, context = {}) {
    const raw = input && typeof input === 'object' ? input : {};
    const sourceSystem = stableSourceSystem(raw.sourceSystem || context.sourceSystem || 'csv');
    const rawExternalId = text(raw.externalId || raw.sourceUserId || raw.sourceIdentifiers?.externalId || raw.sourceIdentifiers?.sourcedId || (raw.sourceSystem ? raw.id : '') || context.externalId);
    const email = emailKey(raw.email || raw.emailAddress || raw.sourceIdentifiers?.email || raw.sourceIdentifiers?.username || '');
    const sourceUserId = text(raw.sourceUserId || rawExternalId).slice(0, 160);
    const identifiers = sourceIdentifiers(raw, {
      externalId: rawExternalId,
      email,
      username: raw.username || raw.sourceIdentifiers?.username,
      identifier: raw.identifier || raw.sourceIdentifiers?.identifier,
      sourcedId: raw.sourceIdentifiers?.sourcedId || (sourceSystem === 'oneroster-1.2' ? rawExternalId : '')
    });
    const groups = list(raw.sourceGroups || raw.groups).map(group => {
      if (typeof group === 'string') return { externalId: group, title: group };
      return group;
    }).map(group => normalizeGroupDescriptor(group, { sourceSystem, sourceCourseId: raw.sourceCourseId || context.sourceCourseId }));
    return {
      adapterVersion: ADAPTER_VERSION,
      sourceSystem,
      sourceLabel: text(context.label || context.sourceLabel || sourceLabel(sourceSystem)).slice(0, 120),
      sourceCourseId: text(raw.sourceCourseId || context.sourceCourseId).slice(0, 160),
      sourceUserId,
      externalId: rawExternalId.slice(0, 240),
      firstName: text(raw.firstName || raw.firstname || raw.first || raw.givenName).slice(0, 120),
      lastName: text(raw.lastName || raw.lastname || raw.last || raw.familyName || raw.surname).slice(0, 120),
      nickName: text(raw.nickName || raw.nickname || raw.preferredName || raw.preferredGivenName).slice(0, 120),
      grade: text(raw.grade || raw.gradeLevel || raw.grades).slice(0, 80),
      email,
      sourceIdentifiers: identifiers,
      sourceGroups: groups
    };
  }

  function normalizeRecords(records, context = {}) {
    return list(records).slice(0, MAX_ROWS).map(record => normalizeRecord(record, context)).filter(record => record.externalId || record.email || record.firstName || record.lastName);
  }

  function existingExternalIds(student) {
    const identifiers = student?.sourceIdentifiers && typeof student.sourceIdentifiers === 'object' ? student.sourceIdentifiers : {};
    return Array.from(new Set([
      text(student?.sourceUserId),
      text(identifiers.externalId),
      text(identifiers.sourcedId),
      text(student?.sourceSystem ? student?.id : '')
    ].filter(Boolean)));
  }

  function buildExistingIndexes(students) {
    const external = new Map();
    const emails = new Map();
    const names = new Map();
    list(students).forEach(student => {
      const system = stableSourceSystem(student?.sourceSystem || 'unknown');
      existingExternalIds(student).forEach(id => {
        const key = externalKey(system, id);
        if (key) {
          if (!external.has(key)) external.set(key, []);
          external.get(key).push(student);
        }
      });
      const email = emailKey(student?.sourceIdentifiers?.email || student?.email || '');
      if (email) {
        if (!emails.has(email)) emails.set(email, []);
        emails.get(email).push(student);
      }
      const key = nameKey(student);
      if (key !== '|') {
        if (!names.has(key)) names.set(key, []);
        names.get(key).push(student);
      }
    });
    return { external, emails, names };
  }

  function changesFor(existing, incoming) {
    const changes = [];
    const pairs = [
      ['firstName', existing?.firstName, incoming.firstName],
      ['lastName', existing?.lastName, incoming.lastName],
      ['nickName', existing?.nickName, incoming.nickName],
      ['grade', existing?.grade, incoming.grade]
    ];
    pairs.forEach(([field, before, after]) => {
      if (text(after) && text(before) !== text(after)) changes.push({ field, before: text(before), after: text(after) });
    });
    const currentEmail = emailKey(existing?.sourceIdentifiers?.email || '');
    if (incoming.email && currentEmail !== incoming.email) changes.push({ field: 'email', before: currentEmail, after: incoming.email });
    if (incoming.sourceSystem && stableSourceSystem(existing?.sourceSystem || '') !== incoming.sourceSystem) changes.push({ field: 'sourceSystem', before: text(existing?.sourceSystem), after: incoming.sourceSystem });
    if (incoming.sourceCourseId && text(existing?.sourceCourseId) !== incoming.sourceCourseId) changes.push({ field: 'sourceCourseId', before: text(existing?.sourceCourseId), after: incoming.sourceCourseId });
    if (incoming.sourceUserId && text(existing?.sourceUserId) !== incoming.sourceUserId) changes.push({ field: 'sourceUserId', before: text(existing?.sourceUserId), after: incoming.sourceUserId });
    return changes;
  }

  function buildReconciliation(records, context = {}) {
    const stateNow = activeState();
    const incoming = normalizeRecords(records, context);
    const indexes = buildExistingIndexes(stateNow?.students || []);
    const seenExternal = new Map();
    const seenEmail = new Map();
    const rows = [];
    const matchedIds = new Set();

    incoming.forEach((record, index) => {
      const extKey = externalKey(record.sourceSystem, record.externalId || record.sourceUserId);
      const incomingEmail = record.email;
      const duplicateIncoming = (extKey && seenExternal.has(extKey)) || (incomingEmail && seenEmail.has(incomingEmail));
      if (extKey) seenExternal.set(extKey, index);
      if (incomingEmail) seenEmail.set(incomingEmail, index);
      if (duplicateIncoming) {
        rows.push({ id: `row-${index}`, action: 'duplicate', confidence: 'none', checked: false, incoming: record, existing: null, changes: [], reason: 'Duplicate record in the incoming roster.' });
        return;
      }

      const externalMatches = extKey ? list(indexes.external.get(extKey)) : [];
      const emailMatches = incomingEmail ? list(indexes.emails.get(incomingEmail)) : [];
      const exactNameMatches = nameKey(record) !== '|' ? list(indexes.names.get(nameKey(record))) : [];
      let existing = null;
      let confidence = 'none';
      let reason = '';

      if (externalMatches.length === 1) {
        existing = externalMatches[0];
        confidence = 'stable-id';
        reason = 'Matched by source system and stable source ID.';
      } else if (externalMatches.length > 1) {
        rows.push({ id: `row-${index}`, action: 'review', confidence: 'ambiguous', checked: false, incoming: record, existing: null, candidates: externalMatches, changes: [], reason: 'More than one current student has this source ID.' });
        return;
      } else if (emailMatches.length === 1) {
        existing = emailMatches[0];
        confidence = 'email';
        reason = 'Matched by unique email address.';
      } else if (emailMatches.length > 1) {
        rows.push({ id: `row-${index}`, action: 'review', confidence: 'ambiguous', checked: false, incoming: record, existing: null, candidates: emailMatches, changes: [], reason: 'More than one current student has this email address.' });
        return;
      } else if (exactNameMatches.length === 1) {
        existing = exactNameMatches[0];
        confidence = 'name';
        reason = 'Possible match by name only. Teacher review required.';
      } else if (exactNameMatches.length > 1) {
        rows.push({ id: `row-${index}`, action: 'review', confidence: 'ambiguous', checked: false, incoming: record, existing: null, candidates: exactNameMatches, changes: [], reason: 'Multiple current students share this name.' });
        return;
      }

      if (!existing) {
        rows.push({ id: `row-${index}`, action: 'add', confidence: 'new', checked: true, incoming: record, existing: null, changes: [], reason: 'No current student matched this record.' });
        return;
      }

      matchedIds.add(String(existing.id));
      const changes = changesFor(existing, record);
      const action = changes.length ? (confidence === 'name' ? 'review' : 'update') : 'unchanged';
      rows.push({
        id: `row-${index}`,
        action,
        confidence,
        checked: action === 'update',
        incoming: record,
        existing,
        changes,
        reason
      });
    });

    const sourceSystem = stableSourceSystem(context.sourceSystem || incoming[0]?.sourceSystem || 'csv');
    const sourceCourseId = text(context.sourceCourseId || incoming[0]?.sourceCourseId);
    const missing = list(stateNow?.students).filter(student => {
      if (matchedIds.has(String(student.id))) return false;
      if (stableSourceSystem(student.sourceSystem || 'unknown') !== sourceSystem) return false;
      if (sourceCourseId && text(student.sourceCourseId) !== sourceCourseId) return false;
      return true;
    });

    return { rows, missing, sourceSystem, sourceCourseId };
  }

  function actionLabel(action) {
    return ({ add: 'New', update: 'Update', unchanged: 'Unchanged', review: 'Review', duplicate: 'Duplicate' })[action] || action;
  }

  function studentLabel(record) {
    const preferred = text(record?.nickName || record?.preferredName);
    const full = [text(record?.firstName), text(record?.lastName)].filter(Boolean).join(' ');
    return preferred && preferred !== record?.firstName ? `${full || preferred} (${preferred})` : full || text(record?.externalId) || 'Unnamed student';
  }

  function reviewCounts(plan) {
    return plan.rows.reduce((counts, row) => {
      counts[row.action] = (counts[row.action] || 0) + 1;
      return counts;
    }, { add: 0, update: 0, unchanged: 0, review: 0, duplicate: 0 });
  }


  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .interop-v69-modal .modal { width:min(1120px,calc(100vw - 28px)); max-height:min(92vh,960px); }
      .interop-v69-modal .modal-body { display:grid; gap:14px; overflow:auto; }
      .interop-v69-hero { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(240px,.8fr); gap:14px; align-items:start; }
      .interop-v69-hero-copy { padding:16px; border:1px solid var(--border); border-radius:14px; background:linear-gradient(145deg,var(--panel),var(--panel-2)); }
      .interop-v69-hero-copy h3 { margin:0 0 6px; }
      .interop-v69-source-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
      .interop-v69-source-card { display:grid; gap:7px; align-content:start; min-height:138px; padding:13px; border:1px solid var(--border); border-radius:13px; background:var(--panel); }
      .interop-v69-source-card strong { font-size:14px; }
      .interop-v69-source-card .hint { margin:0; font-size:11px; }
      .interop-v69-summary { display:grid; grid-template-columns:repeat(6,minmax(90px,1fr)); gap:8px; }
      .interop-v69-stat { padding:10px; border:1px solid var(--border); border-radius:11px; background:var(--panel-2); }
      .interop-v69-stat strong { display:block; font-size:20px; }
      .interop-v69-stat span { display:block; font-size:10px; color:var(--muted); font-weight:750; }
      .interop-v69-review-table { width:100%; border-collapse:separate; border-spacing:0; font-size:11px; }
      .interop-v69-review-table th,.interop-v69-review-table td { padding:7px 8px; border-bottom:1px solid var(--border); vertical-align:top; text-align:left; }
      .interop-v69-review-table th { position:sticky; top:0; z-index:2; background:var(--panel); }
      .interop-v69-review-table tr[data-action="review"] { background:color-mix(in srgb,#f59e0b 7%,transparent); }
      .interop-v69-review-table tr[data-action="duplicate"] { background:color-mix(in srgb,#ef4444 6%,transparent); }
      .interop-v69-review-table tr[data-action="unchanged"] { opacity:.72; }
      .interop-v69-badge { display:inline-flex; align-items:center; min-height:20px; padding:2px 7px; border:1px solid var(--border); border-radius:999px; font-size:9px; font-weight:850; white-space:nowrap; }
      .interop-v69-badge.add { color:#166534; border-color:#86efac; background:#f0fdf4; }
      .interop-v69-badge.update { color:#1d4ed8; border-color:#93c5fd; background:#eff6ff; }
      .interop-v69-badge.review { color:#92400e; border-color:#fcd34d; background:#fffbeb; }
      .interop-v69-badge.duplicate { color:#991b1b; border-color:#fca5a5; background:#fff1f2; }
      .interop-v69-changes { display:grid; gap:2px; color:var(--muted); }
      .interop-v69-groups { display:grid; gap:6px; max-height:170px; overflow:auto; padding:8px; border:1px solid var(--border); border-radius:11px; background:var(--panel-2); }
      .interop-v69-group-row { display:flex; justify-content:space-between; gap:10px; padding:5px 7px; border-radius:8px; background:var(--panel); }
      .interop-v69-mapping-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px 14px; }
      .interop-v69-history { display:grid; gap:6px; max-height:240px; overflow:auto; }
      .interop-v69-history-row { display:grid; grid-template-columns:minmax(150px,1fr) minmax(0,2fr); gap:10px; padding:9px 10px; border:1px solid var(--border); border-radius:10px; background:var(--panel); }
      .interop-v69-history-row span { color:var(--muted); font-size:11px; }
      .interop-v69-package-controls { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:end; }
      @media(max-width:900px){.interop-v69-source-grid{grid-template-columns:1fr 1fr}.interop-v69-summary{grid-template-columns:repeat(3,1fr)}.interop-v69-hero{grid-template-columns:1fr}}
      @media(max-width:620px){.interop-v69-modal .modal{width:calc(100vw - 12px);max-height:96vh}.interop-v69-source-grid,.interop-v69-mapping-grid{grid-template-columns:1fr}.interop-v69-summary{grid-template-columns:1fr 1fr}.interop-v69-review-table{min-width:760px}.interop-v69-table-wrap{overflow:auto}.interop-v69-package-controls{grid-template-columns:1fr}.interop-v69-history-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (document.getElementById('interopV69Modal')) return;
    const shell = document.createElement('div');
    shell.innerHTML = `
      <div id="interopV69Modal" class="modal-backdrop interop-v69-modal" role="dialog" aria-modal="true" aria-labelledby="interopV69Title">
        <div class="modal modern-modal">
          <div class="panel-header"><div><h2 id="interopV69Title">Roster Interoperability</h2><div class="hint">One review workflow for CSV, OneRoster, Microsoft Education, and Google Classroom.</div></div><button id="interopV69CloseBtn" class="tiny secondary" type="button">Close</button></div>
          <div class="modal-body">
            <section id="interopV69HubView">
              <div class="interop-v69-hero">
                <div class="interop-v69-hero-copy"><h3>Import without erasing teacher work</h3><div class="hint">Stable IDs and email are matched first. Name-only matches require review. Notes, requirements, seating assignments, locks, and planner-specific data are preserved when a roster refresh updates a student.</div></div>
                <div class="workflow-card"><strong>Adapter v${ADAPTER_VERSION}</strong><span>Normalized records are inspectable and can be exported as public interchange JSON.</span></div>
              </div>
              <div class="interop-v69-source-grid" style="margin-top:12px">
                <article class="interop-v69-source-card"><strong>CSV / SIS</strong><div class="hint">Map columns from almost any student CSV, then save the mapping for later refreshes.</div><button id="interopV69CsvBtn" class="secondary" type="button">Choose CSV</button><input id="interopV69CsvInput" type="file" accept=".csv,text/csv" hidden /></article>
                <article class="interop-v69-source-card"><strong>OneRoster 1.2 CSV</strong><div class="hint">Select users.csv, classes.csv, and enrollments.csv together. Choose the class before review.</div><button id="interopV69OneRosterBtn" class="secondary" type="button">Choose OneRoster files</button><input id="interopV69OneRosterInput" type="file" accept=".csv,text/csv" multiple hidden /></article>
                <article class="interop-v69-source-card"><strong>Microsoft Education</strong><div class="hint">Imports Microsoft School Data Sync / Education CSV sets or a student CSV without requiring tenant credentials.</div><button id="interopV69MicrosoftBtn" class="secondary" type="button">Choose Microsoft files</button><input id="interopV69MicrosoftInput" type="file" accept=".csv,text/csv" multiple hidden /></article>
                <article class="interop-v69-source-card"><strong>Google Classroom</strong><div class="hint">Existing Classroom sign-in and course selection now use this same safe reconciliation workflow. Classroom student groups can sync as reference groups.</div><button id="interopV69GoogleBtn" class="secondary" type="button">Open Google Classroom controls</button></article>
                <article class="interop-v69-source-card"><strong>Import history</strong><div class="hint">See what changed in recent roster refreshes without storing the source files themselves.</div><button id="interopV69HistoryBtn" class="secondary" type="button">View history</button></article>
                <article class="interop-v69-source-card"><strong>Public interchange</strong><div class="hint">The normalized roster package is versioned and documented for integrations that want to hand records to the planner.</div><button id="interopV69ExportLastBtn" class="secondary" type="button" disabled>Export last normalized package</button></article>
              </div>
            </section>
            <section id="interopV69MappingView" hidden></section>
            <section id="interopV69PackageView" hidden></section>
            <section id="interopV69ReviewView" hidden></section>
            <section id="interopV69HistoryView" hidden></section>
          </div>
        </div>
      </div>`;
    document.body.appendChild(shell.firstElementChild);
  }

  function view(id) {
    ['interopV69HubView','interopV69MappingView','interopV69PackageView','interopV69ReviewView','interopV69HistoryView'].forEach(viewId => {
      const element = document.getElementById(viewId);
      if (element) element.hidden = viewId !== id;
    });
  }

  function openHub() {
    ensureModal();
    view('interopV69HubView');
    document.getElementById('interopV69Modal')?.classList.add('show');
    refreshLastExportButton();
  }

  function closeHub() {
    document.getElementById('interopV69Modal')?.classList.remove('show');
  }

  function parseCsv(textValue) {
    const raw = String(textValue ?? '');
    if (raw.length > 10 * 1024 * 1024) throw new Error('CSV is larger than the 10 MB interoperability limit.');
    if (typeof parseCsvMatrix === 'function') return parseCsvMatrix(raw);
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < raw.length; i += 1) {
      const char = raw[i];
      if (quoted) {
        if (char === '"' && raw[i + 1] === '"') { field += '"'; i += 1; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ',') { row.push(field); field = ''; }
      else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
      else field += char;
    }
    if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
    return rows;
  }

  function matrixObjects(matrix) {
    if (!matrix?.length) return [];
    const headers = matrix[0].map(value => text(value));
    return matrix.slice(1, MAX_ROWS + 1).filter(row => row.some(cell => text(cell))).map(row => Object.fromEntries(headers.map((header, index) => [header || `column${index + 1}`, text(row[index])])));
  }

  async function fileObjects(file) {
    if (!file) throw new Error('No file was selected.');
    if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is larger than 10 MB.`);
    return matrixObjects(parseCsv(await file.text()));
  }

  function guessHeader(headers, aliases) {
    const normalized = headers.map(header => canonicalHeader(header));
    for (const alias of aliases) {
      const index = normalized.indexOf(canonicalHeader(alias));
      if (index >= 0) return headers[index];
    }
    return '';
  }

  const MAPPING_FIELDS = Object.freeze([
    ['externalId','Student ID',['sourcedId','student id','sis id','local id','student number','identifier','user id','id']],
    ['firstName','First name',['first name','firstname','given name','givenName','first']],
    ['lastName','Last name',['last name','lastname','family name','familyName','surname','last']],
    ['nickName','Preferred / nickname',['preferred name','preferredName','nickname','nick name','display name']],
    ['grade','Grade',['grade','grade level','gradeLevel','grades','level']],
    ['email','Email',['email','email address','emailAddress','mail','username']],
    ['group','Group / section',['group','group name','section','section name','class','class name']]
  ]);

  function currentImportProfiles() {
    return list(activeState()?.importProfiles);
  }

  function renderMapping(file, objects, sourceSystem = 'csv') {
    const headers = objects.length ? Object.keys(objects[0]) : [];
    if (!headers.length) throw new Error('The CSV has no usable header row.');
    const guesses = Object.fromEntries(MAPPING_FIELDS.map(([key,,aliases]) => [key, guessHeader(headers, aliases)]));
    mappingSession = { file, objects, headers, sourceSystem, mapping: guesses };
    ensureModal();
    const target = document.getElementById('interopV69MappingView');
    const profiles = currentImportProfiles();
    target.innerHTML = `
      <div class="panel-header"><div><h3>Map CSV columns</h3><div class="hint">${esc(file?.name || 'CSV')} · ${objects.length} row${objects.length === 1 ? '' : 's'}</div></div><button id="interopV69MappingBackBtn" class="tiny secondary" type="button">Back</button></div>
      <div class="field"><label for="interopV69MappingProfile">Saved mapping</label><select id="interopV69MappingProfile"><option value="">Use automatic mapping</option>${profiles.map(profile => `<option value="${esc(profile.id)}">${esc(profile.name)}</option>`).join('')}</select></div>
      <div class="interop-v69-mapping-grid">${MAPPING_FIELDS.map(([key,label]) => `<div class="field"><label for="interopV69Map_${key}">${esc(label)}</label><select id="interopV69Map_${key}" data-interop-map="${esc(key)}"><option value="">Not imported</option>${headers.map(header => `<option value="${esc(header)}"${header === guesses[key] ? ' selected' : ''}>${esc(header)}</option>`).join('')}</select></div>`).join('')}</div>
      <div class="row"><div class="field"><label for="interopV69ProfileName">Save mapping as</label><input id="interopV69ProfileName" type="text" maxlength="80" placeholder="Example: District SIS export" /></div><label class="checkline"><input id="interopV69SaveProfile" type="checkbox" /> Save this mapping for future CSV refreshes</label></div>
      <div id="interopV69MappingStatus" class="hint">A student ID is preferred. If it is unavailable, email is the next safest match. Name-only matches will always require teacher review.</div>
      <div class="button-row"><button id="interopV69MappingReviewBtn" type="button">Review import</button><button id="interopV69MappingCancelBtn" class="secondary" type="button">Cancel</button></div>`;
    view('interopV69MappingView');
  }

  function mappingFromControls() {
    return Object.fromEntries(MAPPING_FIELDS.map(([key]) => [key, document.getElementById(`interopV69Map_${key}`)?.value || '']));
  }

  function applyMappingProfile(profileId) {
    const profile = currentImportProfiles().find(item => String(item.id) === String(profileId));
    if (!profile) return;
    MAPPING_FIELDS.forEach(([key]) => {
      const select = document.getElementById(`interopV69Map_${key}`);
      if (select && Array.from(select.options).some(option => option.value === profile.mapping?.[key])) select.value = profile.mapping[key];
    });
  }

  function saveMappingProfile(mapping) {
    if (!document.getElementById('interopV69SaveProfile')?.checked) return;
    const name = text(document.getElementById('interopV69ProfileName')?.value) || `CSV mapping ${new Date().toLocaleDateString()}`;
    const stateNow = activeState();
    if (!stateNow) return;
    stateNow.importProfiles = list(stateNow.importProfiles);
    stateNow.importProfiles.push({ id: typeof uid === 'function' ? uid('import-profile') : `import-profile-${Date.now()}`, name: name.slice(0, 80), mapping: { ...mapping }, createdAt: nowIso(), updatedAt: nowIso() });
    if (typeof persistActiveClass === 'function') persistActiveClass();
  }

  function mappedRecords() {
    const mapping = mappingFromControls();
    if (!mapping.externalId && !mapping.email && !mapping.firstName && !mapping.lastName) throw new Error('Map a student ID, email, first name, or last name before continuing.');
    const value = (row, key) => mapping[key] ? text(row[mapping[key]]) : '';
    const sourceSystem = stableSourceSystem(mappingSession?.sourceSystem || 'csv');
    const groupMap = new Map();
    const records = mappingSession.objects.map(row => {
      const groupName = value(row, 'group');
      if (groupName && !groupMap.has(groupName)) groupMap.set(groupName, { externalId: groupName, title: groupName, memberExternalIds: [] });
      const record = normalizeRecord({
        externalId: value(row, 'externalId'),
        firstName: value(row, 'firstName'),
        lastName: value(row, 'lastName'),
        nickName: value(row, 'nickName'),
        grade: value(row, 'grade'),
        email: value(row, 'email'),
        sourceSystem
      }, { sourceSystem, label: sourceLabel(sourceSystem) });
      if (groupName) {
        record.sourceGroups = [normalizeGroupDescriptor(groupMap.get(groupName), { sourceSystem })];
        const memberId = record.externalId || record.email;
        if (memberId) groupMap.get(groupName).memberExternalIds.push(memberId);
      }
      return record;
    }).filter(record => record.externalId || record.email || record.firstName || record.lastName);
    saveMappingProfile(mapping);
    const groups = [...groupMap.values()].map(group => normalizeGroupDescriptor(group, { sourceSystem }));
    return { records, groups, sourceSystem };
  }

  async function openCsvFile(file, sourceSystem = 'csv') {
    try {
      const objects = await fileObjects(file);
      renderMapping(file, objects, sourceSystem);
    } catch (error) {
      setStatus(`CSV import could not be opened: ${error.message}`);
    }
  }

  function fileMap(files) {
    return new Map(list(files).map(file => [lower(file.name), file]));
  }

  function findFile(files, names) {
    const map = fileMap(files);
    for (const name of names) {
      if (map.has(lower(name))) return map.get(lower(name));
    }
    return null;
  }

  function classTitle(record) {
    return firstValue(record, ['title','name','class name','section name','sectionName','displayName','classCode']) || firstValue(record, ['sourcedId','classSourcedId','sectionSourcedId']);
  }

  async function parseOneRosterPackage(files) {
    const selected = list(files);
    const usersFile = findFile(selected, ['users.csv']);
    const classesFile = findFile(selected, ['classes.csv']);
    const enrollmentsFile = findFile(selected, ['enrollments.csv']);
    if (!usersFile || !classesFile || !enrollmentsFile) throw new Error('OneRoster needs users.csv, classes.csv, and enrollments.csv selected together.');
    const [users, classes, enrollments] = await Promise.all([fileObjects(usersFile), fileObjects(classesFile), fileObjects(enrollmentsFile)]);
    const userById = new Map(users.map(user => [firstValue(user, ['sourcedId']), user]).filter(([id]) => id));
    const classById = new Map(classes.map(record => [firstValue(record, ['sourcedId']), record]).filter(([id]) => id));
    const classStudents = new Map();
    enrollments.forEach(enrollment => {
      const role = lower(firstValue(enrollment, ['role']));
      const status = lower(firstValue(enrollment, ['status']));
      if (role && role !== 'student') return;
      if (status === 'tobedeleted') return;
      const classId = firstValue(enrollment, ['classSourcedId']);
      const userId = firstValue(enrollment, ['userSourcedId']);
      if (!classId || !userId || !classById.has(classId) || !userById.has(userId)) return;
      if (!classStudents.has(classId)) classStudents.set(classId, []);
      classStudents.get(classId).push(userId);
    });
    const courseOptions = [...classStudents.keys()].map(id => ({ id, title: classTitle(classById.get(id)) || id, count: classStudents.get(id).length })).sort((a,b) => a.title.localeCompare(b.title));
    if (!courseOptions.length) throw new Error('No student enrollments connected users.csv to classes.csv.');
    return { kind: 'oneroster', users, classes, enrollments, userById, classById, classStudents, courseOptions };
  }

  function oneRosterRecords(session, classId) {
    const classRecord = session.classById.get(classId);
    const userIds = session.classStudents.get(classId) || [];
    const records = userIds.map(userId => session.userById.get(userId)).filter(Boolean).map(user => {
      const externalId = firstValue(user, ['sourcedId']);
      const grades = splitMulti(firstValue(user, ['grades','grade']));
      const email = firstValue(user, ['email']);
      const username = firstValue(user, ['username']);
      return normalizeRecord({
        externalId,
        firstName: firstValue(user, ['givenName','firstName']),
        lastName: firstValue(user, ['familyName','lastName']),
        nickName: firstValue(user, ['preferredGivenName','preferredName']),
        grade: grades[0] || '',
        email,
        username,
        sourceSystem: 'oneroster-1.2',
        sourceCourseId: classId,
        sourceUserId: externalId,
        sourceIdentifiers: { sourcedId: externalId, identifier: firstValue(user, ['identifier']), username, email }
      }, { sourceSystem: 'oneroster-1.2', label: 'OneRoster 1.2', sourceCourseId: classId });
    });
    return { records, groups: [], context: { sourceSystem: 'oneroster-1.2', label: `OneRoster 1.2 · ${classTitle(classRecord) || classId}`, sourceCourseId: classId } };
  }

  async function parseMicrosoftPackage(files) {
    const selected = list(files);
    if (!selected.length) throw new Error('Choose at least one Microsoft Education CSV.');
    const studentFile = findFile(selected, ['student.csv','students.csv','user.csv','users.csv']);
    const sectionFile = findFile(selected, ['section.csv','sections.csv','class.csv','classes.csv']);
    const enrollmentFile = findFile(selected, ['studentenrollment.csv','studentenrollments.csv','enrollment.csv','enrollments.csv']);
    if (!studentFile) {
      if (selected.length === 1) return { kind: 'mapping', file: selected[0], objects: await fileObjects(selected[0]) };
      throw new Error('Microsoft Education CSV sets need Student.csv/Students.csv or Users.csv.');
    }
    const students = await fileObjects(studentFile);
    if (!sectionFile || !enrollmentFile) return { kind: 'students', students, courseOptions: [] };
    const [sections, enrollments] = await Promise.all([fileObjects(sectionFile), fileObjects(enrollmentFile)]);
    const studentById = new Map(students.map(student => [firstValue(student, ['SIS ID','Student SIS ID','Student ID','Source ID','User ID','id']), student]).filter(([id]) => id));
    const sectionById = new Map(sections.map(section => [firstValue(section, ['SIS ID','Section SIS ID','Section ID','Class ID','Source ID','id']), section]).filter(([id]) => id));
    const sectionStudents = new Map();
    enrollments.forEach(enrollment => {
      const studentId = firstValue(enrollment, ['Student SIS ID','Student ID','User ID','SIS ID','studentSourcedId','userSourcedId']);
      const sectionId = firstValue(enrollment, ['Section SIS ID','Section ID','Class ID','sectionSourcedId','classSourcedId']);
      if (!studentId || !sectionId || !studentById.has(studentId) || !sectionById.has(sectionId)) return;
      if (!sectionStudents.has(sectionId)) sectionStudents.set(sectionId, []);
      sectionStudents.get(sectionId).push(studentId);
    });
    const courseOptions = [...sectionStudents.keys()].map(id => ({ id, title: classTitle(sectionById.get(id)) || id, count: sectionStudents.get(id).length })).sort((a,b) => a.title.localeCompare(b.title));
    return { kind: 'sections', students, sections, enrollments, studentById, sectionById, sectionStudents, courseOptions };
  }

  function microsoftStudentRecord(student, courseId = '') {
    const externalId = firstValue(student, ['SIS ID','Student SIS ID','Student ID','Source ID','User ID','id']);
    const email = firstValue(student, ['Email','Email Address','Primary Email','Username','User Principal Name','UPN']);
    return normalizeRecord({
      externalId,
      firstName: firstValue(student, ['First Name','FirstName','Given Name','GivenName','first']),
      lastName: firstValue(student, ['Last Name','LastName','Family Name','FamilyName','Surname','last']),
      nickName: firstValue(student, ['Preferred Name','PreferredName','Nickname']),
      grade: firstValue(student, ['Grade','Grade Level','GradeLevel']),
      email,
      sourceSystem: 'microsoft-education',
      sourceCourseId: courseId,
      sourceUserId: externalId,
      sourceIdentifiers: { externalId, email, username: firstValue(student, ['Username','User Principal Name','UPN']) }
    }, { sourceSystem: 'microsoft-education', label: 'Microsoft Education', sourceCourseId: courseId });
  }

  function microsoftRecords(session, sectionId = '') {
    if (session.kind === 'students') {
      return { records: session.students.map(student => microsoftStudentRecord(student)), groups: [], context: { sourceSystem: 'microsoft-education', label: 'Microsoft Education' } };
    }
    const ids = session.sectionStudents.get(sectionId) || [];
    const section = session.sectionById.get(sectionId);
    return { records: ids.map(id => session.studentById.get(id)).filter(Boolean).map(student => microsoftStudentRecord(student, sectionId)), groups: [], context: { sourceSystem: 'microsoft-education', label: `Microsoft Education · ${classTitle(section) || sectionId}`, sourceCourseId: sectionId } };
  }

  function renderPackageChoice(session, type) {
    ensureModal();
    const target = document.getElementById('interopV69PackageView');
    const title = type === 'oneroster' ? 'Choose OneRoster class' : 'Choose Microsoft Education class';
    const description = type === 'oneroster' ? 'The selected CSV set contains multiple class enrollments. Choose which class to reconcile into the active planner class.' : 'Choose the Microsoft Education section to reconcile into the active planner class.';
    target.innerHTML = `<div class="panel-header"><div><h3>${esc(title)}</h3><div class="hint">${esc(description)}</div></div><button id="interopV69PackageBackBtn" class="tiny secondary" type="button">Back</button></div><div class="interop-v69-package-controls"><div class="field"><label for="interopV69PackageClassSelect">Class / section</label><select id="interopV69PackageClassSelect">${session.courseOptions.map(option => `<option value="${esc(option.id)}">${esc(option.title)} (${option.count})</option>`).join('')}</select></div><button id="interopV69PackageReviewBtn" type="button" data-package-type="${esc(type)}">Review roster</button></div>`;
    view('interopV69PackageView');
  }

  async function openOneRosterFiles(files) {
    try {
      oneRosterSession = await parseOneRosterPackage(files);
      if (oneRosterSession.courseOptions.length === 1) {
        const packageData = oneRosterRecords(oneRosterSession, oneRosterSession.courseOptions[0].id);
        reviewRecords(packageData.records, { ...packageData.context, groups: packageData.groups });
      } else renderPackageChoice(oneRosterSession, 'oneroster');
    } catch (error) {
      setStatus(`OneRoster import could not be opened: ${error.message}`);
    }
  }

  async function openMicrosoftFiles(files) {
    try {
      microsoftSession = await parseMicrosoftPackage(files);
      if (microsoftSession.kind === 'mapping') {
        renderMapping(microsoftSession.file, microsoftSession.objects, 'microsoft-education');
        return;
      }
      if (microsoftSession.kind === 'students' || microsoftSession.courseOptions.length === 0) {
        const packageData = microsoftRecords(microsoftSession);
        reviewRecords(packageData.records, packageData.context);
      } else if (microsoftSession.courseOptions.length === 1) {
        const packageData = microsoftRecords(microsoftSession, microsoftSession.courseOptions[0].id);
        reviewRecords(packageData.records, packageData.context);
      } else renderPackageChoice(microsoftSession, 'microsoft');
    } catch (error) {
      setStatus(`Microsoft Education import could not be opened: ${error.message}`);
    }
  }

  async function pagedClassroomList(fetcher, baseUrl, collectionName) {
    const output = [];
    let token = '';
    const seen = new Set();
    let pages = 0;
    do {
      const params = new URLSearchParams({ pageSize: '75' });
      if (token) params.set('pageToken', token);
      const response = await fetcher(`${baseUrl}?${params}`);
      const data = await response.json();
      output.push(...list(data[collectionName]));
      const next = text(data.nextPageToken);
      pages += 1;
      if (!next) break;
      if (seen.has(next) || pages > 200) throw new Error('Google Classroom pagination did not converge safely.');
      seen.add(next);
      token = next;
    } while (token);
    return output;
  }

  async function loadGoogleClassroomGroups(courseId, fetcher) {
    if (!courseId || typeof fetcher !== 'function') return [];
    const base = `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/studentGroups`;
    const groups = await pagedClassroomList(fetcher, base, 'studentGroups');
    const normalized = [];
    for (const group of groups.slice(0, MAX_GROUPS)) {
      const members = await pagedClassroomList(fetcher, `${base}/${encodeURIComponent(group.id)}/studentGroupMembers`, 'studentGroupMembers');
      normalized.push(normalizeGroupDescriptor({
        externalId: group.id,
        title: group.title,
        sourceSystem: 'google-classroom',
        sourceCourseId: courseId,
        memberExternalIds: members.map(member => member.userId)
      }, { sourceSystem: 'google-classroom', sourceCourseId: courseId }));
    }
    return normalized;
  }

  function renderGroups(groups) {
    if (!groups.length) return '<div class="hint">No source groups were supplied with this roster.</div>';
    return `<div class="interop-v69-groups">${groups.map(group => `<div class="interop-v69-group-row"><strong>${esc(group.title)}</strong><span>${group.memberExternalIds.length} member${group.memberExternalIds.length === 1 ? '' : 's'}</span></div>`).join('')}</div>`;
  }

  function reviewRecords(records, options = {}) {
    const sourceSystem = stableSourceSystem(options.sourceSystem || records?.[0]?.sourceSystem || (lower(options.label || options.source).includes('google classroom') ? 'google-classroom' : lower(options.label || options.source).includes('sis') ? 'sis-csv' : 'csv'));
    const sourceCourseId = text(options.sourceCourseId || records?.[0]?.sourceCourseId);
    const label = text(options.label || options.source || sourceLabel(sourceSystem));
    const normalized = normalizeRecords(records, { sourceSystem, sourceCourseId, label });
    const groups = list(options.groups || records?.sourceGroups).map(group => normalizeGroupDescriptor(group, { sourceSystem, sourceCourseId }));
    const plan = buildReconciliation(normalized, { sourceSystem, sourceCourseId, label });
    reviewSession = { sourceSystem, sourceCourseId, label, records: normalized, groups, plan, createdAt: nowIso() };
    ensureModal();
    document.getElementById('interopV69Modal')?.classList.add('show');
    renderReview();
    return reviewSession;
  }

  function renderReview() {
    if (!reviewSession) return;
    const { plan, groups, label } = reviewSession;
    const counts = reviewCounts(plan);
    const target = document.getElementById('interopV69ReviewView');
    target.innerHTML = `
      <div class="panel-header"><div><h3>Review ${esc(label)}</h3><div class="hint">Nothing is applied until you approve this reconciliation.</div></div><button id="interopV69ReviewBackBtn" class="tiny secondary" type="button">Back</button></div>
      <div class="interop-v69-summary">
        <div class="interop-v69-stat"><strong>${counts.add}</strong><span>NEW</span></div>
        <div class="interop-v69-stat"><strong>${counts.update}</strong><span>UPDATES</span></div>
        <div class="interop-v69-stat"><strong>${counts.unchanged}</strong><span>UNCHANGED</span></div>
        <div class="interop-v69-stat"><strong>${counts.review}</strong><span>NEEDS REVIEW</span></div>
        <div class="interop-v69-stat"><strong>${counts.duplicate}</strong><span>DUPLICATES</span></div>
        <div class="interop-v69-stat"><strong>${plan.missing.length}</strong><span>SOURCE-MISSING</span></div>
      </div>
      <div class="interop-v69-table-wrap"><table class="interop-v69-review-table"><thead><tr><th>Apply</th><th>Status</th><th>Incoming</th><th>Current match</th><th>Reason / changes</th></tr></thead><tbody>${plan.rows.map(row => {
        const selectable = ['add','update','review'].includes(row.action);
        const changes = row.changes.length ? row.changes.map(change => `<span>${esc(change.field)}: ${esc(change.before || '—')} → ${esc(change.after || '—')}</span>`).join('') : `<span>${esc(row.reason)}</span>`;
        return `<tr data-action="${esc(row.action)}" data-row-id="${esc(row.id)}"><td>${selectable ? `<input type="checkbox" data-interop-row-check="${esc(row.id)}"${row.checked ? ' checked' : ''} aria-label="Apply ${esc(studentLabel(row.incoming))}" />` : ''}</td><td><span class="interop-v69-badge ${esc(row.action)}">${esc(actionLabel(row.action))}</span><div class="hint mini">${esc(row.confidence)}</div></td><td><strong>${esc(studentLabel(row.incoming))}</strong><div class="hint mini">${esc(row.incoming.externalId || row.incoming.email || '')}</div></td><td>${row.existing ? `<strong>${esc(studentLabel(row.existing))}</strong>` : row.candidates?.length ? `${row.candidates.length} possible matches` : '—'}</td><td><div class="interop-v69-changes">${changes}</div></td></tr>`;
      }).join('')}</tbody></table></div>
      <section class="section"><h3>Source groups</h3>${renderGroups(groups)}${groups.length ? `<label class="checkline"><input id="interopV69SyncSourceGroups" type="checkbox" checked /> Sync these as reference groups. Reference groups do not change seating rules.</label><label class="checkline"><input id="interopV69PromoteGroups" type="checkbox" /> Also create/update planner seating groups from these source groups. This can affect automatic seating and is intentionally off by default.</label>` : ''}</section>
      ${plan.missing.length ? `<section class="section"><h3>Students missing from this source roster</h3><div class="hint">Only students previously tied to this same source${reviewSession.sourceCourseId ? ' and course' : ''} appear here. They are preserved by default.</div><label class="checkline"><input id="interopV69ArchiveMissing" type="checkbox" /> Archive ${plan.missing.length} source-missing student${plan.missing.length === 1 ? '' : 's'} after applying this refresh</label></section>` : ''}
      <div class="button-row"><button id="interopV69ApplyBtn" type="button">Apply selected changes</button><button id="interopV69ExportBtn" class="secondary" type="button">Export normalized package</button><button id="interopV69CancelReviewBtn" class="secondary" type="button">Cancel</button></div>`;
    view('interopV69ReviewView');
  }

  function updateExistingStudent(existing, incoming) {
    const mergedIdentifiers = sourceIdentifiers(existing, incoming.sourceIdentifiers);
    if (incoming.firstName) existing.firstName = incoming.firstName;
    if (incoming.lastName) existing.lastName = incoming.lastName;
    if (incoming.nickName) existing.nickName = incoming.nickName;
    if (incoming.grade) existing.grade = incoming.grade;
    existing.sourceSystem = incoming.sourceSystem;
    existing.sourceCourseId = incoming.sourceCourseId || existing.sourceCourseId || '';
    existing.sourceUserId = incoming.sourceUserId || incoming.externalId || existing.sourceUserId || '';
    existing.sourceIdentifiers = mergedIdentifiers;
    return existing;
  }

  function createStudentFromRecord(incoming) {
    const id = typeof uid === 'function' ? uid('student') : `student-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const raw = {
      id,
      firstName: incoming.firstName,
      lastName: incoming.lastName,
      nickName: incoming.nickName,
      grade: incoming.grade,
      sourceSystem: incoming.sourceSystem,
      sourceCourseId: incoming.sourceCourseId,
      sourceUserId: incoming.sourceUserId || incoming.externalId,
      sourceIdentifiers: incoming.sourceIdentifiers
    };
    return typeof normalizeStudent === 'function' ? normalizeStudent(raw) : raw;
  }

  function selectedReviewRows() {
    if (!reviewSession) return [];
    const selected = new Set([...document.querySelectorAll('[data-interop-row-check]:checked')].map(input => input.dataset.interopRowCheck));
    return reviewSession.plan.rows.filter(row => selected.has(row.id) && ['add','update','review'].includes(row.action));
  }

  function upsertSourceGroups(groups, incomingToInternal) {
    const stateNow = activeState();
    if (!stateNow) return { synced: 0, promoted: 0 };
    stateNow.rosterSourceGroups = list(stateNow.rosterSourceGroups);
    const promote = Boolean(document.getElementById('interopV69PromoteGroups')?.checked);
    let synced = 0;
    let promoted = 0;
    groups.forEach((group, index) => {
      const memberStudentIds = Array.from(new Set(group.memberExternalIds.map(externalId => incomingToInternal.get(text(externalId))).filter(Boolean)));
      const existing = stateNow.rosterSourceGroups.find(item => item.sourceSystem === group.sourceSystem && text(item.sourceCourseId) === text(group.sourceCourseId) && text(item.externalId) === text(group.externalId));
      const record = {
        id: existing?.id || (typeof uid === 'function' ? uid('source-group') : `source-group-${Date.now()}-${index}`),
        sourceSystem: group.sourceSystem,
        sourceCourseId: group.sourceCourseId,
        externalId: group.externalId,
        title: group.title,
        studentIds: memberStudentIds,
        syncedAt: nowIso()
      };
      if (existing) Object.assign(existing, record);
      else stateNow.rosterSourceGroups.push(record);
      synced += 1;

      if (promote) {
        stateNow.groups = list(stateNow.groups);
        let plannerGroup = stateNow.groups.find(item => text(item.sourceSystem) === group.sourceSystem && text(item.sourceCourseId) === text(group.sourceCourseId) && text(item.sourceGroupId) === text(group.externalId));
        if (!plannerGroup) {
          plannerGroup = {
            id: typeof uid === 'function' ? uid('group') : `group-${Date.now()}-${index}`,
            name: group.title,
            type: 'together',
            priority: 4,
            color: typeof defaultGroupColor === 'function' ? defaultGroupColor(stateNow.groups.length) : '#8aa4d8',
            studentIds: [],
            anchorSeats: [],
            zoneId: '',
            sourceSystem: group.sourceSystem,
            sourceCourseId: group.sourceCourseId,
            sourceGroupId: group.externalId
          };
          stateNow.groups.push(plannerGroup);
        }
        plannerGroup.name = group.title;
        plannerGroup.studentIds = memberStudentIds;
        plannerGroup.sourceSystem = group.sourceSystem;
        plannerGroup.sourceCourseId = group.sourceCourseId;
        plannerGroup.sourceGroupId = group.externalId;
        promoted += 1;
      }
    });
    return { synced, promoted };
  }

  function archiveMissingStudents(missing) {
    const stateNow = activeState();
    if (!stateNow || !missing.length) return 0;
    const ids = new Set(missing.map(student => String(student.id)));
    stateNow.rosterArchive = list(stateNow.rosterArchive);
    missing.forEach(student => {
      if (!stateNow.rosterArchive.some(item => String(item.id) === String(student.id))) stateNow.rosterArchive.push(typeof normalizeStudent === 'function' ? normalizeStudent(student) : { ...student });
      if (typeof removeStudentFromCells === 'function') removeStudentFromCells(student.id);
    });
    list(stateNow.groups).forEach(group => { group.studentIds = list(group.studentIds).filter(id => !ids.has(String(id))); });
    stateNow.students = list(stateNow.students).filter(student => !ids.has(String(student.id)));
    return ids.size;
  }

  function recordHistory(entry) {
    const stateNow = activeState();
    if (!stateNow) return;
    stateNow.rosterImportHistory = list(stateNow.rosterImportHistory);
    stateNow.rosterImportHistory.unshift({
      id: typeof uid === 'function' ? uid('roster-import') : `roster-import-${Date.now()}`,
      importedAt: nowIso(),
      sourceSystem: entry.sourceSystem,
      sourceLabel: entry.sourceLabel,
      sourceCourseId: entry.sourceCourseId || '',
      added: Number(entry.added) || 0,
      updated: Number(entry.updated) || 0,
      unchanged: Number(entry.unchanged) || 0,
      reviewSkipped: Number(entry.reviewSkipped) || 0,
      duplicates: Number(entry.duplicates) || 0,
      archived: Number(entry.archived) || 0,
      groupsSynced: Number(entry.groupsSynced) || 0,
      groupsPromoted: Number(entry.groupsPromoted) || 0
    });
    stateNow.rosterImportHistory = stateNow.rosterImportHistory.slice(0, HISTORY_LIMIT);
  }

  function applyReview() {
    if (!reviewSession) return null;
    const stateNow = activeState();
    if (!stateNow) throw new Error('No active class is available.');
    const selected = selectedReviewRows();
    if (typeof pushUndoSnapshot === 'function') pushUndoSnapshot('V6.9 roster interoperability import');
    const incomingToInternal = new Map();
    let added = 0;
    let updated = 0;

    reviewSession.plan.rows.forEach(row => {
      if (row.existing) {
        const incomingId = row.incoming.externalId || row.incoming.sourceUserId || row.incoming.email;
        if (incomingId) incomingToInternal.set(text(incomingId), String(row.existing.id));
      }
    });

    selected.forEach(row => {
      if (row.existing) {
        updateExistingStudent(row.existing, row.incoming);
        updated += 1;
        const incomingId = row.incoming.externalId || row.incoming.sourceUserId || row.incoming.email;
        if (incomingId) incomingToInternal.set(text(incomingId), String(row.existing.id));
      } else {
        const created = createStudentFromRecord(row.incoming);
        stateNow.students.push(created);
        added += 1;
        const incomingId = row.incoming.externalId || row.incoming.sourceUserId || row.incoming.email;
        if (incomingId) incomingToInternal.set(text(incomingId), String(created.id));
      }
    });

    const syncGroups = Boolean(document.getElementById('interopV69SyncSourceGroups')?.checked);
    const groupResult = syncGroups ? upsertSourceGroups(reviewSession.groups, incomingToInternal) : { synced: 0, promoted: 0 };
    const archived = document.getElementById('interopV69ArchiveMissing')?.checked ? archiveMissingStudents(reviewSession.plan.missing) : 0;
    const counts = reviewCounts(reviewSession.plan);
    const selectedIds = new Set(selected.map(row => row.id));
    const reviewSkipped = reviewSession.plan.rows.filter(row => row.action === 'review' && !selectedIds.has(row.id)).length;
    recordHistory({
      sourceSystem: reviewSession.sourceSystem,
      sourceLabel: reviewSession.label,
      sourceCourseId: reviewSession.sourceCourseId,
      added,
      updated,
      unchanged: counts.unchanged,
      reviewSkipped,
      duplicates: counts.duplicate,
      archived,
      groupsSynced: groupResult.synced,
      groupsPromoted: groupResult.promoted
    });

    if (typeof persistActiveClass === 'function') persistActiveClass();
    if (typeof scheduleLinkedAutoSave === 'function') scheduleLinkedAutoSave('roster-interoperability');
    if (typeof renderAll === 'function') renderAll();
    else if (typeof renderTargeted === 'function') renderTargeted(['class-manager','roster','rules','room','status'], { reason: 'roster-interoperability' });
    const message = `${reviewSession.label}: added ${added}, updated ${updated}, archived ${archived}, synced ${groupResult.synced} source group${groupResult.synced === 1 ? '' : 's'}.`;
    if (typeof setLiveStatusMessage === 'function') setLiveStatusMessage(message);
    const result = { added, updated, archived, ...groupResult };
    view('interopV69HubView');
    refreshLastExportButton();
    return result;
  }

  function normalizedPackage(session = reviewSession) {
    if (!session) return null;
    return {
      format: PACKAGE_FORMAT,
      adapterVersion: ADAPTER_VERSION,
      exportedAt: nowIso(),
      source: {
        system: session.sourceSystem,
        label: session.label,
        courseId: session.sourceCourseId || ''
      },
      records: session.records.map(record => ({ ...record })),
      groups: session.groups.map(group => ({ ...group, memberExternalIds: [...group.memberExternalIds] }))
    };
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportNormalizedPackage() {
    const packageData = normalizedPackage();
    if (!packageData) return false;
    const slug = stableSourceSystem(reviewSession.sourceSystem || 'roster');
    downloadJson(`roster-import-${slug}-${new Date().toISOString().slice(0, 10)}.json`, packageData);
    return true;
  }

  function refreshLastExportButton() {
    const button = document.getElementById('interopV69ExportLastBtn');
    if (button) button.disabled = !reviewSession;
  }

  function renderHistory() {
    ensureModal();
    const history = list(activeState()?.rosterImportHistory);
    const sourceGroups = list(activeState()?.rosterSourceGroups);
    const target = document.getElementById('interopV69HistoryView');
    target.innerHTML = `<div class="panel-header"><div><h3>Roster import history</h3><div class="hint">History stores counts and source identifiers, not copies of the original roster files.</div></div><button id="interopV69HistoryBackBtn" class="tiny secondary" type="button">Back</button></div><div class="workflow-card"><strong>${sourceGroups.length} synced reference group${sourceGroups.length === 1 ? '' : 's'}</strong><span>Reference groups are inert until explicitly promoted into planner seating groups.</span></div><div class="interop-v69-history">${history.length ? history.map(entry => `<article class="interop-v69-history-row"><div><strong>${esc(entry.sourceLabel || sourceLabel(entry.sourceSystem))}</strong><span>${esc(entry.importedAt ? new Date(entry.importedAt).toLocaleString() : '')}</span></div><span>Added ${Number(entry.added)||0} · updated ${Number(entry.updated)||0} · unchanged ${Number(entry.unchanged)||0} · archived ${Number(entry.archived)||0} · groups ${Number(entry.groupsSynced)||0}</span></article>`).join('') : '<div class="restore-empty">No V6.9 roster imports have been applied yet.</div>'}</div>`;
    view('interopV69HistoryView');
  }

  function setStatus(message) {
    if (typeof setLiveStatusMessage === 'function') setLiveStatusMessage(message);
    const target = document.getElementById('interopV69MappingStatus');
    if (target) target.textContent = message;
  }

  function openGoogleClassroomControls() {
    closeHub();
    const button = document.getElementById('classSetupGoogleClassroomConnectBtn') || document.getElementById('googleHubClassroomConnectBtn');
    const section = button?.closest('.section, .workflow-card, .panel') || document.getElementById('classSetupGoogleClassroomStatus')?.parentElement;
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
      button?.focus?.();
      if (typeof setLiveStatusMessage === 'function') setLiveStatusMessage('Google Classroom roster review now uses the V6.9 interoperability workflow. Choose a course and review its roster here.');
      return true;
    }
    if (typeof setLiveStatusMessage === 'function') setLiveStatusMessage('Open Class Setup or Google Settings to connect Google Classroom, then review a course roster.');
    return false;
  }

  function injectEntryPoints() {
    const sisInput = document.getElementById('classSetupSisCsvInput');
    const container = sisInput?.closest('.field, .section, .workflow-card') || sisInput?.parentElement;
    if (container && !document.getElementById('openInteroperabilityV69Btn')) {
      const button = document.createElement('button');
      button.id = 'openInteroperabilityV69Btn';
      button.className = 'secondary';
      button.type = 'button';
      button.textContent = 'Roster Interoperability';
      button.title = 'CSV, OneRoster, Microsoft Education, Google Classroom, mapping presets, and import history';
      container.appendChild(button);
    }
    const moreMenu = document.getElementById('v4MoreMenu');
    if (moreMenu?.classList.contains('ui51-action-menu') && !document.getElementById('interopV69MenuGroup')) {
      const group = document.createElement('section');
      group.id = 'interopV69MenuGroup';
      group.className = 'ui51-menu-group';
      group.innerHTML = `<div class="ui51-menu-heading">Roster data</div><div class="ui51-menu-desc">Import and reconcile class rosters without overwriting teacher-specific planner data.</div><div class="ui51-menu-list"><button id="openInteroperabilityV69MenuBtn" class="secondary ui51-menu-item" role="menuitem" type="button"><span>Roster interoperability</span><small>CSV, OneRoster, Microsoft Education, Classroom, and import history.</small></button></div>`;
      const application = [...moreMenu.querySelectorAll('.ui51-menu-group')].find(item => /application/i.test(item.querySelector('.ui51-menu-heading')?.textContent || ''));
      moreMenu.insertBefore(group, application || null);
    }
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('#openInteroperabilityV69Btn,#openInteroperabilityV69MenuBtn')) { event.preventDefault(); openHub(); return; }
      if (target.closest('#interopV69CloseBtn')) { closeHub(); return; }
      if (target.closest('#interopV69CsvBtn')) { document.getElementById('interopV69CsvInput')?.click(); return; }
      if (target.closest('#interopV69OneRosterBtn')) { document.getElementById('interopV69OneRosterInput')?.click(); return; }
      if (target.closest('#interopV69MicrosoftBtn')) { document.getElementById('interopV69MicrosoftInput')?.click(); return; }
      if (target.closest('#interopV69GoogleBtn')) { openGoogleClassroomControls(); return; }
      if (target.closest('#interopV69HistoryBtn')) { renderHistory(); return; }
      if (target.closest('#interopV69HistoryBackBtn,#interopV69MappingBackBtn,#interopV69PackageBackBtn,#interopV69ReviewBackBtn,#interopV69MappingCancelBtn,#interopV69CancelReviewBtn')) { view('interopV69HubView'); refreshLastExportButton(); return; }
      if (target.closest('#interopV69MappingReviewBtn')) {
        try {
          const data = mappedRecords();
          reviewRecords(data.records, { sourceSystem: data.sourceSystem, label: sourceLabel(data.sourceSystem), groups: data.groups });
        } catch (error) { setStatus(error.message); }
        return;
      }
      if (target.closest('#interopV69PackageReviewBtn')) {
        const classId = document.getElementById('interopV69PackageClassSelect')?.value || '';
        const type = target.closest('#interopV69PackageReviewBtn')?.dataset.packageType;
        const packageData = type === 'oneroster' ? oneRosterRecords(oneRosterSession, classId) : microsoftRecords(microsoftSession, classId);
        reviewRecords(packageData.records, { ...packageData.context, groups: packageData.groups });
        return;
      }
      if (target.closest('#interopV69ApplyBtn')) {
        try { applyReview(); } catch (error) { setStatus(`Roster changes were not applied: ${error.message}`); }
        return;
      }
      if (target.closest('#interopV69ExportBtn,#interopV69ExportLastBtn')) { exportNormalizedPackage(); return; }
    });

    document.addEventListener('change', event => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
      if (target.id === 'interopV69CsvInput') { const file = target.files?.[0]; target.value = ''; if (file) void openCsvFile(file, 'csv'); }
      if (target.id === 'interopV69OneRosterInput') { const files = [...(target.files || [])]; target.value = ''; if (files.length) void openOneRosterFiles(files); }
      if (target.id === 'interopV69MicrosoftInput') { const files = [...(target.files || [])]; target.value = ''; if (files.length) void openMicrosoftFiles(files); }
      if (target.id === 'interopV69MappingProfile') applyMappingProfile(target.value);
    });
  }

  function install() {
    if (installed) return;
    installed = true;
    ensureStyles();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { ensureModal(); injectEntryPoints(); }, { once: true });
    else { ensureModal(); injectEntryPoints(); }
    bindEvents();
  }

  function afterReady() {
    ensureModal();
    injectEntryPoints();
  }

  install();

  return Object.freeze({
    version: VERSION,
    adapterVersion: ADAPTER_VERSION,
    packageFormat: PACKAGE_FORMAT,
    install,
    afterReady,
    openHub,
    reviewRecords,
    normalizeRecord,
    normalizeRecords,
    buildReconciliation,
    parseOneRosterPackage,
    oneRosterRecords,
    parseMicrosoftPackage,
    microsoftRecords,
    loadGoogleClassroomGroups,
    normalizedPackage,
    exportNormalizedPackage,
    applyReview
  });
})();

'use strict';
