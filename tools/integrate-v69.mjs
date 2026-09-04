import fs from 'node:fs';

function replace(file, from, to) {
  let source = fs.readFileSync(file, 'utf8');
  if (!source.includes(from)) throw new Error(`${file}: expected source fragment not found`);
  source = source.replace(from, to);
  fs.writeFileSync(file, source);
}

function replaceRegex(file, regex, replacement) {
  let source = fs.readFileSync(file, 'utf8');
  if (!regex.test(source)) throw new Error(`${file}: expected pattern not found: ${regex}`);
  source = source.replace(regex, replacement);
  fs.writeFileSync(file, source);
}

// Wire the interoperability module into the deterministic modular build.
replace('src/manifest.json',
  '    "029-physical-table-pods-v682.js",\n    "025-classroom-feature-pack-v66.js",',
  '    "029-physical-table-pods-v682.js",\n    "030-interoperability-v69.js",\n    "025-classroom-feature-pack-v66.js",');

// Feature-pack lifecycle should initialize all post-6.8 modules too.
replace('src/scripts/025-classroom-feature-pack-v66.js',
  '    window.ClassroomIntelligenceV68,\n    window.GroupedSeatingVisualsV681\n',
  '    window.ClassroomIntelligenceV68,\n    window.GroupedSeatingVisualsV681,\n    window.PhysicalTablePodsV682,\n    window.InteroperabilityV69\n');
replace('src/scripts/025-classroom-feature-pack-v66.js',
  "document.body.dataset.featurePack = '6.8.1';",
  "document.body.dataset.featurePack = '6.9.0';");

// Classic scripts share the global lexical environment; do not require state to be a window property.
replace('src/scripts/030-interoperability-v69.js',
  '  const activeState = () => window.state || null;',
  "  const activeState = () => { try { return typeof state !== 'undefined' ? state : (window.state || null); } catch (_) { return window.state || null; } };");

// Persist V6.9 source linkage on planner groups.
replace('src/scripts/000-core.js',
`    anchorSeats: Array.isArray(b?.anchorSeats) ? Array.from(new Set(b.anchorSeats.map(String))) : [],
    zoneId: b?.zoneId ? String(b.zoneId) : ''
  };
}`,
`    anchorSeats: Array.isArray(b?.anchorSeats) ? Array.from(new Set(b.anchorSeats.map(String))) : [],
    zoneId: b?.zoneId ? String(b.zoneId) : '',
    sourceSystem: String(b?.sourceSystem || '').slice(0, 80),
    sourceCourseId: String(b?.sourceCourseId || '').slice(0, 160),
    sourceGroupId: String(b?.sourceGroupId || '').slice(0, 240)
  };
}`);

// Preserve inert source groups and compact import history through class normalization.
replace('src/scripts/000-core.js',
`    importProfiles: [],
    requirementPresets: [],`,
`    importProfiles: [],
    rosterSourceGroups: [],
    rosterImportHistory: [],
    requirementPresets: [],`);
replace('src/scripts/000-core.js',
`    importProfiles: Array.isArray(cls.importProfiles) ? cls.importProfiles.map(normalizeImportProfile) : [],
    requirementPresets: Array.isArray(cls.requirementPresets) ? cls.requirementPresets.map(normalizeRequirementPreset) : [],`,
`    importProfiles: Array.isArray(cls.importProfiles) ? cls.importProfiles.map(normalizeImportProfile) : [],
    rosterSourceGroups: Array.isArray(cls.rosterSourceGroups) ? cls.rosterSourceGroups.slice(0, 500).map(item => ({
      id: String(item?.id || uid('source-group')).slice(0, 240),
      sourceSystem: String(item?.sourceSystem || '').slice(0, 80),
      sourceCourseId: String(item?.sourceCourseId || '').slice(0, 160),
      externalId: String(item?.externalId || '').slice(0, 240),
      title: String(item?.title || 'Imported group').trim().slice(0, 120),
      studentIds: Array.from(new Set((Array.isArray(item?.studentIds) ? item.studentIds : []).map(String))),
      syncedAt: String(item?.syncedAt || '')
    })) : [],
    rosterImportHistory: Array.isArray(cls.rosterImportHistory) ? cls.rosterImportHistory.slice(0, 30).map(item => ({
      id: String(item?.id || uid('roster-import')).slice(0, 240),
      importedAt: String(item?.importedAt || ''),
      sourceSystem: String(item?.sourceSystem || '').slice(0, 80),
      sourceLabel: String(item?.sourceLabel || '').slice(0, 120),
      sourceCourseId: String(item?.sourceCourseId || '').slice(0, 160),
      added: Math.max(0, Number(item?.added) || 0),
      updated: Math.max(0, Number(item?.updated) || 0),
      unchanged: Math.max(0, Number(item?.unchanged) || 0),
      reviewSkipped: Math.max(0, Number(item?.reviewSkipped) || 0),
      duplicates: Math.max(0, Number(item?.duplicates) || 0),
      archived: Math.max(0, Number(item?.archived) || 0),
      groupsSynced: Math.max(0, Number(item?.groupsSynced) || 0),
      groupsPromoted: Math.max(0, Number(item?.groupsPromoted) || 0)
    })) : [],
    requirementPresets: Array.isArray(cls.requirementPresets) ? cls.requirementPresets.map(normalizeRequirementPreset) : [],`);

// Route Google Classroom through the shared V6.9 reconciliation layer, including read-only group sync.
replaceRegex('src/scripts/017-district-integrations-v57.js',
/records\.push\(\.\.\.\(data\.students \|\| \[\]\)\.map\(item => normalizeStudent\(\{[\s\S]*?sourceUserId: item\.userId \|\| item\.profile\?\.id \|\| ''\n\s*\}\)\)\);/,
`records.push(...(data.students || []).map(item => ({
          externalId: item.userId || item.profile?.id || '',
          firstName: item.profile?.name?.givenName || '',
          lastName: item.profile?.name?.familyName || '',
          nickName: item.profile?.name?.fullName && !item.profile?.name?.familyName ? item.profile.name.fullName : '',
          grade: '',
          email: item.profile?.emailAddress || '',
          sourceSystem: 'google-classroom',
          sourceCourseId: courseId,
          sourceUserId: item.userId || item.profile?.id || '',
          sourceIdentifiers: { externalId: item.userId || item.profile?.id || '', email: item.profile?.emailAddress || '' }
        })));`);
replace('src/scripts/017-district-integrations-v57.js',
`      openRosterDraft(records, 'Google Classroom');
      updateClassroomStatus(\`Loaded \${records.length} students for reconciliation.\`);`,
`      let sourceGroups = [];
      let groupNotice = '';
      if (window.InteroperabilityV69?.loadGoogleClassroomGroups) {
        try {
          sourceGroups = await window.InteroperabilityV69.loadGoogleClassroomGroups(courseId, classroomFetch);
        } catch (groupError) {
          groupNotice = \` Student groups could not be loaded: \${groupError.message}\`;
        }
      }
      if (window.InteroperabilityV69?.reviewRecords) {
        window.InteroperabilityV69.reviewRecords(records, { sourceSystem: 'google-classroom', label: 'Google Classroom', sourceCourseId: courseId, groups: sourceGroups });
      } else {
        openRosterDraft(records.map(normalizeStudent), 'Google Classroom');
      }
      updateClassroomStatus(\`Loaded \${records.length} students and \${sourceGroups.length} Classroom group\${sourceGroups.length === 1 ? '' : 's'} for reconciliation.\${groupNotice}\`);`);

// V6.9 release metadata. Data schema/encryption envelope remain unchanged.
replace('package.json', '"version": "6.8.2"', '"version": "6.9.0"');
replace('src/index.template.html', 'name="app-version" content="6.8.2"', 'name="app-version" content="6.9.0"');
replace('src/scripts/000-core.js', "version: '6.8.2'", "version: '6.9.0'");
replace('service-worker.js', 'classroom-seating-planner-v6.8.2-pwa1', 'classroom-seating-planner-v6.9.0-pwa1');

// Release validation now includes the normalized roster adapter and public schema.
replaceRegex('tools/validate-release.mjs', /\['V6\.8\.2 app version metadata',[^\n]+\]/, "['V6.9.0 app version metadata', /name=[\"']app-version[\"']\\s+content=[\"']6\\.9\\.0[\"']/i.test(built)]");
replace('tools/validate-release.mjs',
`  ['V6.8.2 physical table renderer present', /PhysicalTablePodsV682/.test(built)]`,
`  ['V6.8.2 physical table renderer present', /PhysicalTablePodsV682/.test(built)],
  ['V6.9 interoperability engine present', /InteroperabilityV69/.test(built)],
  ['V6.9 OneRoster adapter present', /parseOneRosterPackage/.test(built)],
  ['V6.9 Microsoft Education adapter present', /parseMicrosoftPackage/.test(built)],
  ['V6.9 Classroom group sync present', /loadGoogleClassroomGroups/.test(built)],
  ['V6.9 public roster package present', /classroom-seating-planner-roster-import-v1/.test(built)]`);
replace('tools/validate-release.mjs',
`  'service-worker.js'\n])`,
`  'service-worker.js',\n  'schemas/roster-import-v1.schema.json'\n])`);

// Changelog entry.
let changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
if (!changelog.includes('## 6.9.0')) {
  const entry = `## 6.9.0 - 2026-09-04\n\n### Roster interoperability\n- Added one normalized roster reconciliation workflow for CSV/SIS, OneRoster 1.2 CSV, Microsoft Education/SDS CSV, and Google Classroom.\n- Stable source IDs match first, unique email second, while name-only and ambiguous matches require explicit teacher review.\n- Roster refreshes preserve planner-owned notes, requirements, assignments, locks, groups, and other teacher data. Students missing from the same source roster are preserved unless archive is explicitly selected.\n- Added reusable CSV column mappings and compact per-class import history.\n- Added Google Classroom student-group sync as inert source/reference groups; promotion into seating-affecting planner groups is explicit and off by default.\n- Added public normalized interchange schema at schemas/roster-import-v1.schema.json.\n- Data schema remains 13 and encryption envelope remains 3.\n\n`;
  const match = changelog.match(/^#.*\n+/);
  changelog = match ? changelog.slice(0, match[0].length) + entry + changelog.slice(match[0].length) : entry + changelog;
  fs.writeFileSync('CHANGELOG.md', changelog);
}

console.log('Integrated V6.9 interoperability into modular source.');
