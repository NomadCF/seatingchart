'use strict';

const APP_CONFIG = Object.freeze({
  name: 'Classroom Seating Planner',
  shortName: 'Seating Planner',
  version: '7.3.0',
  copyrightHolder: 'Chris L. Franklin',
  copyrightYear: '2026',
  releaseDate: '2026-09-05',
  releaseDateDisplay: 'September 5, 2026',
  buildDate: '2026-09-05T12:20:00Z',
  commit: 'local',
  environment: 'production',
  dataSchemaVersion: 13,
  minimumSupportedDataSchemaVersion: 13,
  encryptionEnvelopeVersion: 3,
  googleDriveClientId: '288395515246-7u19cjdqqqfmlp8bjs92c9tl6jvd8usk.apps.googleusercontent.com',
  googleDriveFolderName: 'Classroom Seating Planner Saves',
  googleDriveAppProperty: 'classroom-seating-planner',
  googlePickerApiKey: "",
  googlePickerAppId: '288395515246',
  supportUrl: '',
  repositoryUrl: ''
});

const PAYPAL_DONATION_CONFIG = Object.freeze({
  sdkUrl: 'https://www.paypalobjects.com/donate/sdk/donate-sdk.js',
  hostedButtonId: '9QMGWW9NAVE4W',
  image: Object.freeze({
    src: 'https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif',
    alt: 'Donate with PayPal button',
    title: 'PayPal - The safer, easier way to pay online!'
  })
});

const STORAGE_KEY = 'classroom-seating-planner-v6-primary';
const STORAGE_BACKUP_KEY = `${STORAGE_KEY}-backup`;
const STORAGE_PENDING_KEY = `${STORAGE_KEY}-pending`;
const LINKED_SAVE_DB_NAME = 'classroom-seating-planner-linked-save-v6';
const LINKED_SAVE_STORE_NAME = 'handles';
const LINKED_SAVE_HANDLE_KEY = 'primary-save-file';
const SAVE_META_STORAGE_KEY = 'classroom-seating-planner-save-meta-v6';
const SAVE_SETUP_STORAGE_KEY = 'classroom-seating-planner-save-setup-v6';
const LOCAL_DURABLE_SAVE_PROMPT_SESSION_KEY = 'classroom-seating-planner-durable-save-prompt-v6';
const LOCAL_DURABLE_SAVE_PROMPT_MIN_MS = 60000;
const LOCAL_AUTOSAVE_SNAPSHOT_KEY = 'classroom-seating-planner-snapshots-v6';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GOOGLE_DRIVE_USER_SESSION_KEY = 'classroom-seating-planner-google-drive-user-v6';
const COLLABORATION_ACCESS_VERSION = 1;
const COLLABORATION_AREAS = Object.freeze(['setup', 'room', 'seating', 'review', 'save', 'share', 'settings', 'classes']);
const COLLABORATION_AREA_LABELS = Object.freeze({
  setup: 'Class setup, roster, rules, and notes',
  room: 'Room design and objects',
  seating: 'Seat placement and generation',
  review: 'Review, analysis, print, PDF, and SVG',
  save: 'Save changes to the master Drive file',
  share: 'Export and sharing tools',
  settings: 'Settings and administrative tools',
  classes: 'Class switching and class management'
});
const COLLABORATION_PRESETS = Object.freeze({
  full: Object.freeze({ setup: 'edit', room: 'edit', seating: 'edit', review: 'edit', save: 'edit', share: 'edit', settings: 'edit', classes: 'edit' }),
  seating: Object.freeze({ setup: 'view', room: 'view', seating: 'edit', review: 'view', save: 'edit', share: 'none', settings: 'none', classes: 'view' }),
  room: Object.freeze({ setup: 'view', room: 'edit', seating: 'view', review: 'view', save: 'edit', share: 'none', settings: 'none', classes: 'view' }),
  roster: Object.freeze({ setup: 'edit', room: 'view', seating: 'view', review: 'view', save: 'edit', share: 'none', settings: 'none', classes: 'view' }),
  reviewer: Object.freeze({ setup: 'view', room: 'view', seating: 'view', review: 'view', save: 'none', share: 'view', settings: 'none', classes: 'view' })
});
const GOOGLE_CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly'
].join(' ');
const PBKDF2_MIN_ITERATIONS = 150000;
const PBKDF2_MAX_ITERATIONS = 2000000;
const NETWORK_TIMEOUT_MS = 60000;
const MAX_API_PAGES = 200;
const MIN_LOCAL_CREDENTIAL_LENGTH = 6;
const MAX_LOCAL_CREDENTIAL_LENGTH = 256;
const GOOGLE_ANALYTICS_MEASUREMENT_ID = 'G-NMRMNM7ZCD';
const GOOGLE_ANALYTICS_DISABLED_STORAGE_KEY = 'classroom-seating-planner-google-analytics-disabled-v6';

const IMPORT_LIMITS = Object.freeze({
  saveBytes: 64 * 1024 * 1024,
  csvBytes: 10 * 1024 * 1024,
  maxDepth: 72,
  maxNodes: 500000,
  maxStringLength: 2 * 1024 * 1024,
  maxClasses: 500,
  maxStudentsPerClass: 10000,
  maxCellsPerClass: 100000,
  maxFreeformObjectsPerClass: 100000,
  maxSnapshots: 500,
  maxCsvRows: 50000,
  maxCsvColumns: 150,
  maxCsvCellLength: 32768
});
const OBJECT_TYPE_COLORS = Object.freeze({
  seat: '#dbeafe',
  teacher: '#fff3d6',
  table: '#e8f7ec',
  door: '#fce8ee',
  wall: '#d9dee8',
  walkway: '#ffffff',
  window: '#e0f2fe',
  projector: '#eef2ff',
  board: '#dcfce7',
  carpet: '#f5e8d3',
  ada: '#ecfeff',
  shelf: '#f1e8dc',
  cabinet: '#e8e5df',
  lab: '#e5edf5',
  sink: '#dff3f5',
  station: '#eee7f7',
  blocked: '#313846',
  empty: '#fbfcff'
});
const BUILT_IN_OBJECT_LABELS = Object.freeze({
  empty: 'Empty',
  blocked: 'Blocked',
  teacher: 'Teacher Desk',
  table: 'Table',
  door: 'Door',
  wall: 'Wall',
  walkway: 'Walkway',
  window: 'Window',
  projector: 'Projector',
  board: 'Board',
  carpet: 'Carpet',
  ada: 'ADA Space',
  shelf: 'Shelf / Bookcase',
  cabinet: 'Cabinet / Storage',
  lab: 'Lab Station',
  sink: 'Sink / Utility',
  station: 'Activity Station',
  seat: 'Seat'
});
const GROUP_TYPE_LABELS = Object.freeze({
  together: 'Seat together / nearby',
  avoid: 'Avoid seating together',
  special: 'Special / anchored seats',
  front: 'Prefer front',
  back: 'Prefer back',
  nearBoard: 'Near board/projector',
  nearTeacher: 'Near teacher desk',
  awayDoor: 'Away from door',
  awayWindow: 'Away from window',
  spread: 'Spread apart',
  zone: 'Prefer seat zone'
});
const GROUP_TYPE_DESCRIPTIONS = Object.freeze({
  together: 'Keeps selected students close together when the room allows it.',
  avoid: 'Tries to keep selected students from sitting near one another.',
  special: 'Fills reserved seats for this group before placing other students.',
  front: 'Favors seats near the selected front side of the room.',
  back: 'Favors seats farther from the selected front side of the room.',
  nearBoard: 'Favors seats near a board or projector room object.',
  nearTeacher: 'Favors seats near the teacher desk.',
  awayDoor: 'Favors seats farther from door room objects.',
  awayWindow: 'Favors seats farther from window room objects.',
  spread: 'Distributes selected students across the room instead of clustering them.',
  zone: 'Favors seats assigned to the selected named room zone.'
});


 
 
const LEGACY_SCHEMA_12_GROUP_FIELDS = Object.freeze({
  collection: 'bubbles',
  anchorIds: 'anchorBubbleIds',
  zoneIds: 'bubbleIds',
  componentKind: 'seating-chart-bubbles-config',
  sideTab: 'bubbles',
  hideDetails: 'hideBubbleDetails',
  disableEditing: 'disableBubbleEditing'
});
const LEGACY_GROUP_SCHEMA_VERSION = 12;

const APP_NAME = APP_CONFIG.name;
const GOOGLE_DRIVE_CLIENT_ID = APP_CONFIG.googleDriveClientId;
const GOOGLE_DRIVE_APP_PROPERTY = APP_CONFIG.googleDriveAppProperty;
const deploymentConfigValue = value => {
  const text = String(value || '').trim();
  return /^__GOOGLE_[A-Z0-9_]+__$/.test(text) ? '' : text;
};
const GOOGLE_PICKER_API_KEY = deploymentConfigValue(APP_CONFIG.googlePickerApiKey);
const GOOGLE_PICKER_APP_ID = deploymentConfigValue(APP_CONFIG.googlePickerAppId);

const PAGE_LOCK_CREDENTIAL_KEY = 'classroom-seating-planner-lock-v6';
const PAGE_LOCK_SESSION_KEY = 'classroom-seating-planner-locked-session-v6';
const PAGE_LOCK_DATA_SESSION_KEY = 'classroom-seating-planner-locked-data-v6';
const PAGE_LOCK_WRAPPED_KEY_SESSION_KEY = 'classroom-seating-planner-lock-wrapped-key-v6';
const VISIBILITY_WRAPPED_KEY_SESSION_KEY = 'classroom-seating-planner-visibility-wrapped-key-v6';
const SAME_TAB_RELOAD_WRAPPED_KEY_SESSION_KEY = 'classroom-seating-planner-reload-wrapped-key-v6';
const SAME_TAB_RELOAD_SECRET_SESSION_KEY = 'classroom-seating-planner-reload-secret-v6';
const FREEFORM_GEOMETRY_SESSION_KEY = 'classroom-seating-planner-freeform-geometry-v6';
const GOOGLE_DRIVE_TOKEN_SESSION_KEY = 'classroom-seating-planner-google-drive-token-v6';
const DEFAULT_FREEFORM_SEAT_WIDTH = 176;
const DEFAULT_FREEFORM_SEAT_HEIGHT = 112;
const MIN_FREEFORM_SEAT_WIDTH = 160;
const MIN_FREEFORM_SEAT_HEIGHT = 100;
const DEFAULT_FREEFORM_GRID_CELL_WIDTH = 204;
const DEFAULT_FREEFORM_GRID_CELL_HEIGHT = 136;
const DEFAULT_FREEFORM_GRID_GAP = 24;
const VISIBILITY_DATA_SESSION_KEY = 'classroom-seating-planner-visibility-data-v6';
const WELCOME_SETUP_STORAGE_KEY = 'classroom-seating-planner-secure-welcome-v6';
const VISIBILITY_CREDENTIAL_KEY = 'classroom-seating-planner-visibility-v6';
const HINT_DISMISS_STORAGE_KEY = 'classroom-seating-planner-dismissed-hints-v6';
const APP_REVISION = APP_CONFIG.version;
const DATA_SCHEMA_VERSION = APP_CONFIG.dataSchemaVersion;
const MIN_SUPPORTED_DATA_SCHEMA_VERSION = APP_CONFIG.minimumSupportedDataSchemaVersion;
const ENCRYPTION_ENVELOPE_VERSION = APP_CONFIG.encryptionEnvelopeVersion;
const SAVE_DOCUMENT_FORMAT = 'classroom-seating-planner-save-v6';
const COMPONENT_EXPORT_FORMAT = 'classroom-seating-planner-component-export-v6';
const SAFE_SHARE_FORMAT = 'classroom-seating-planner-safe-share-v6';
const ENCRYPTED_ENVELOPE_FORMAT = 'classroom-seating-planner-encrypted-envelope-v6';
const SNAPSHOT_DOCUMENT_FORMAT = 'classroom-seating-planner-snapshot-v6';
const SNAPSHOT_RECORD_FORMAT = 'classroom-seating-planner-snapshot-record-v6';
const SNAPSHOT_INDEX_FORMAT = 'classroom-seating-planner-snapshot-index-v6';
const CLASS_SNAPSHOT_FORMAT = 'classroom-seating-planner-class-snapshot-v6';
const BROWSER_STORAGE_MARKER_FORMAT = 'classroom-seating-planner-browser-marker-v6';
const APP_DATABASE_NAME = 'classroom-seating-planner-v6';
const APP_DATABASE_VERSION = 1;
const APP_DATABASE_STORE = 'records';
const APP_PRIMARY_SAVE_KEY = 'primary-save';
const APP_PRIMARY_SAVE_BACKUP_KEY = 'primary-save-backup';
const APP_SNAPSHOT_INDEX_KEY = 'snapshot-index';
const APP_DEVICE_ID_KEY = 'classroom-seating-planner-device-id-v6';
const APP_LAST_UPDATED = APP_CONFIG.releaseDateDisplay;
const APP_TAB_LEASE_KEY = 'classroom-seating-planner-active-tab-v6';
const APP_TAB_CHANNEL_NAME = 'classroom-seating-planner-tab-sync-v6';
const TAB_TAKEOVER_BACKUP_SESSION_KEY = 'classroom-seating-planner-tab-takeover-backup-v6';
const APP_TAB_LEASE_TIMEOUT_MS = 45000;
const APP_TAB_HEARTBEAT_MS = 15000;

const APP_LICENSE = {
  name: 'MIT License',
  spdx: 'MIT',
  holder: APP_CONFIG.copyrightHolder || 'Chris L. Franklin',
  year: APP_CONFIG.copyrightYear || '2026',
  shortText: `MIT License. Copyright © ${APP_CONFIG.copyrightYear || '2026'} ${APP_CONFIG.copyrightHolder || 'Chris L. Franklin'}.`,
  text: [
    'MIT License',
    '',
        `Copyright (c) ${APP_CONFIG.copyrightYear || '2026'} ${APP_CONFIG.copyrightHolder || 'Chris L. Franklin'}`,
        '',
        'Permission is hereby granted, free of charge, to any person obtaining a copy',
        'of this software and associated documentation files (the "Software"), to deal',
        'in the Software without restriction, including without limitation the rights',
        'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
        'copies of the Software, and to permit persons to whom the Software is',
        'furnished to do so, subject to the following conditions:',
        '',
        'The above copyright notice and this permission notice shall be included in all',
        'copies or substantial portions of the Software.',
        '',
        'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
        'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
        'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
        'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
        'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
        'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
        'SOFTWARE.',
        '',
        'Additional project notice:',
        'This license covers the Classroom Seating Planner application code, interface text, help content, CSS, JavaScript, and bundled documentation. It does not claim ownership over user-entered classroom, student, roster, note, seating-chart, save-file, or backup data. Users are responsible for protecting student information and following applicable school, district, privacy, and data-retention rules.',
  ] .join('\n')
};

const PROJECT_FEATURES = [
  { title: 'Planner Packs', text: 'Bundle reusable room templates, student-need presets, custom room objects, Activity Layouts, Station Rotation blueprints, and Testing Mode defaults into privacy-guarded portable JSON packs that can be installed locally and shared without a server or roster data.' },
  { title: 'Planner Assistant', text: 'Use a first-class local planning workspace with broader classroom language, class-scoped conversational context, working plans, candidate-seat ranking and comparison, explicit apply and undo, chart-health and fairness analysis, testing orchestration, named-plan comparison, and direct launchers into Today Mode, Activity Layouts, Station Rotations, Planner Packs, snapshots, printing, and related planner workflows.' },
  { title: 'Testing Mode', text: 'Generate a separate testing Activity Layout that maximizes practical student separation, preserves locked seat positions and assignments, checks accessibility/front/aisle needs, explains physical spacing limits, and produces a normal-room-to-testing transition plan before anything is applied.' },
  { title: 'Station Rotations', text: 'Build timed classroom station rounds over the existing Digital Twin, use Activity Stations, Lab Stations, or tables as destinations, create explicit rotation teams from the active roster, and advance rounds without changing seat assignments.' },
  { title: 'Activity Layouts', text: 'Keep multiple named Freeform room arrangements for different lesson formats, switch without changing the shared physical room, duplicate or reflow arrangements from six classroom starters, and compare movement visually before resetting the room.' },
  { title: 'Classroom Digital Twin', text: 'Give Freeform rooms real dimensions, use scaled grids and rulers, align a floor-plan reference image, measure physical distances, and add fixed classroom furniture while preserving existing seating assignments and Freeform interactions.' },
  { title: 'Grouped seating visual language', text: 'Freeform tables, pods, seats, presentation views, printed charts, copied chart images, and plan comparisons share a clearer grouped-seating treatment with subtle pod boundaries, deliberate open-seat states, compact status cues, and zoom-aware readability.' },
  { title: 'Classroom Intelligence', text: 'Choose a planning objective, inspect plan health and concrete blockers, preview the smallest useful seating repair before applying it, and favor fairness or stability without hiding the underlying teacher-defined rules.' },
  { title: 'Live seat guidance', text: 'Preview valid, caution, conflicting, and locked seats while selecting or dragging a student, explain each result in plain language, and place the student in the best currently available seat.' },
  { title: 'Conflict resolution and intentional overrides', text: 'Move to a suggested seat, compare alternatives, keep an intentional exception, and retain the override for Review rather than silently discarding the teacher’s decision.' },
  { title: 'Planning history and fairness', text: 'Compare named plans, review repeated neighbors and location patterns, schedule plans by weekday or date, and use bulk requirement presets without assigning behavioral scores to students.' },
  { title: 'Portable templates and public formats', text: 'Exchange shared room-template libraries, locale packs, assignment and violation CSV files, sanitized support bundles, and documented JSON-schema data contracts while keeping the final release as one portable HTML file.' },
  { title: 'Five-stage planning workflow', text: 'Move from Class Setup to Room Design, Seat Students, Review, and Save & Share without exposing every advanced control at once.' },
  { title: 'Roster and class management', text: 'Maintain multiple classes, compare and merge class records, import or reconcile CSV rosters, preserve notes and requirements, archive classes, and roll classes into a new term.' },
  { title: 'Seating rules and student needs', text: 'Model together, avoid, anchored, spread, location, zone, object-distance, accessibility, and individual student requirements.' },
  { title: 'Explainable seating options', text: 'Run a preflight conflict inspector, then compare visual seating options using rule matches, required conflicts, individual needs, and student movement before applying a chart.' },
  { title: 'Grid and Freeform rooms', text: 'Design structured grids or physically positioned Freeform rooms with clockwise, counterclockwise, and free-drag rotation, collision handling, groups, layers, alignment, history, minimap, and room audits.' },
  { title: 'Manual and keyboard placement', text: 'Drag, swap, lock, clear, or keyboard-place students while preserving anchors, reserved seats, and intentional Freeform geometry.' },
  { title: 'Review and integrity checks', text: 'Inspect unassigned students, rule outcomes, duplicate assignments, invalid locks, overlaps, hidden objects, and other room or data problems.' },
  { title: 'Encrypted saving and recovery', text: 'Use encrypted browser autosave, linked working files, downloaded backups, snapshots, selective restore, guarded startup recovery, and an optional separately stored password-recovery package.' },
  { title: 'Optional Google Drive collaboration', text: 'Save and load encrypted working files through Google Drive, choose people by Google-account email, combine Drive Viewer or Editor roles with per-person Hidden, View only, or Can edit interface areas, and merge overlapping saves without pretending the app provides live cursor-level co-editing.' },
  { title: 'Purpose-limited sharing', text: 'Create teacher, substitute, student-facing, support-team, anonymous, and room-only outputs with a privacy summary before export.' },
  { title: 'Printing and room output', text: 'Prepare names-only, substitute, or detailed charts with selectable fields, notes, configuration details, paper sizes, scale, tiling, crop marks, and an optional crop-to-content mode that removes unused outer room space and enlarges the occupied Grid or Freeform layout while keeping the chart on one page. Selected notes and configuration may follow on supporting pages.' },
  { title: 'Security and privacy controls', text: 'Protect Settings, use Lock and Presentation Mode PINs, auto-lock the page, present a finished read-only chart, reveal sensitive notes deliberately, and erase browser-resident data through explicit recovery workflows.' },
  { title: 'Maintenance and diagnostics', text: 'Review build/schema information, storage health, privacy-safe activity/errors, import and integration recovery, deployment readiness, repair tools, sample data, cleanup, and Factory Reset.' },
  { title: 'Accessible responsive workspace', text: 'Use keyboard navigation, focus-managed dialogs, live announcements, skip navigation, focus mode, collapsible regions, persistent mobile Grid/Freeform controls, a full-screen Canvas-only Room Design view, full-height mobile option sheets, and reduced-motion support.' },
  { title: 'Themes and customization', text: 'Choose complete accessible themes including Default, Gradient Sky, Shimmer, Prismatic Flow, Aurora Focus, High Contrast, Windows XP, Windows 11, macOS Frosted, and Linux Terminal.' },
  { title: 'Offline and portable deployment', text: 'Run the self-contained HTML release or deploy the same application as a same-origin installable PWA with offline support and build verification.' }
];

const RELEASE_HISTORY = [
  {
    version: '7.3.0',
    date: 'September 5, 2026',
    title: 'Planner Assistant workspace and conversational planning',
    current: true,
    changes: [
      'Expanded Planner Assistant into a first-class planning workspace with a persistent class-scoped working plan and short multi-turn conversational context.',
      'Added candidate-seat workflows, current-versus-proposed seat comparison, explicit candidate application, and follow-ups such as show options then use the second one.',
      'Added chart-health, hardest-to-seat, unseated-student, rule-pressure, repair-priority, and fairness comparison analysis driven by existing planner engines.',
      'Added compound Testing Mode orchestration that can preserve locked seats and accessibility placements while reporting practical fit constraints before applying changes.',
      'Added direct Assistant launchers into named plans, Today Mode, Activity Layouts, Station Rotations, Planner Packs, snapshots, printing, undo, and redo.',
      'Centralized Assistant help and visibility controls, removed repeated Guide me buttons, improved natural-language normalization, and changed unrecognized requests into clarifications or useful suggestions instead of parser dead ends.',
      'Kept the Assistant browser-local and deterministic. It does not send classroom data to an external AI service and does not silently invent student behavior labels or mutate the classroom without explicit application.'
    ]
  },
  {
    version: '6.7.0',
    date: 'September 4, 2026',
    title: 'Production hardening, public contracts, and collaboration history',
    current: false,
    changes: [
      'Added deterministic source splitting and single-file rebuild validation, browser regression CI, release packaging, and public save/encryption JSON Schemas without changing data schema 13 or encryption envelope 3.',
      'Added repository-level MIT licensing, security, privacy, and data-handling documentation plus deployment guidance for Google OAuth and hosted releases.',
      'Fixed collaboration editing notices so presence metadata survives normalization and is actually included in saved planner documents.',
      'Added a bounded collaboration activity ledger showing editing notices, detected remote revisions, merge outcomes, and recent shared-file activity.',
      'Preserved the existing live seat guidance, fairness/history tools, scheduled plans, visual comparison, CSV/image/support exports, comments, template libraries, mobile workflow, and Analytics default-on behavior.'
    ]
  },
  {
    version: '6.6.3',
    date: 'September 4, 2026',
    title: 'Hosted PWA completion and Drive Picker deployment readiness',
    current: false,
    changes: [
      'Completed the hosted PWA package with a web app manifest, service worker, install icons, offline application-shell caching, and update-aware service-worker registration.',
      'Changed deployment diagnostics to report real service-worker registration and page-control state instead of treating browser support alone as a successful PWA deployment.',
      'Configured the Google Picker App ID from the existing Google Cloud project number and added precise diagnostics for the remaining browser API key requirement.',
      'Improved Google Picker unavailable messaging so shared-Drive access problems identify the missing deployment credential instead of silently falling back.',
      'Kept Google Analytics enabled by default while preserving the existing user opt-out control.'
    ]
  },
  {
    version: '6.6.2',
    date: 'September 4, 2026',
    title: 'Full code review, workflow repairs, and dead-style cleanup',
    current: false,
    changes: [
      'Fixed bulk requirement editing so preferred and excluded zone selections use a shared in-scope helper instead of throwing a ReferenceError.',
      'Repaired guided Google Drive access, startup error logging, and the Ctrl+Alt+S Save Now shortcut so each path targets the active production module or save workflow.',
      'Removed duplicate browser-storage marker keys, a duplicate Advanced Tools click handler, an unused exception binding, and obsolete CSS selectors left behind by earlier UI revisions.',
      'Standardized window-attached module references used by advanced tools and shortcuts for clearer, more robust classic-script behavior.',
      'Revalidated JavaScript syntax, CSS parsing, DOM IDs and accessibility references, responsive workflow bounds, and core modal/workflow smoke paths while preserving schema 13 and encryption envelope 3.'
    ]
  },
  {
    version: '6.6.1',
    date: 'July 16, 2026',
    title: 'Single-file audit, rendering efficiency, and delegated manager interactions',
    current: false,
    changes: [
      'Reduced broad and targeted rendering to one active-class snapshot instead of two while preserving the same post-render saved state.',
      'Made the Groups & Zones Manager render only while open and replaced per-card drag listeners with one guarded delegated handler set.',
      'Reused one assignment snapshot and one baseline rule evaluation during live seat guidance, with guaranteed restoration after each simulated placement.',
      'Indexed zone usage once per manager render instead of repeatedly scanning every room cell and group for each zone.',
      'Consolidated repeated CSV rejection mapping, print configuration rows, Freeform geometry restoration, security-wizard scrolling, and onboarding error handling.',
      'Preserved the single portable HTML product, schema 13, schema-12 compatibility, encryption envelope 3, storage keys, integrations, and recovery workflows.'
    ]
  },
  {
    version: '6.6.0',
    date: 'July 16, 2026',
    title: 'Live seat guidance, planning intelligence, portable data tools, and modular source',
    current: false,
    changes: [
      'Added live Grid and Freeform seat-validity previews, valid-seat highlighting, best-seat placement, plain-language conflict explanations, and intentional rule overrides.',
      'Added seating-history and fairness analysis, scheduled plans, visual plan comparison, bulk student requirement presets, duplicate-roster suggestions, and advanced student filters.',
      'Added shared room-template libraries, assignment and violation CSV exports, sanitized support bundles, chart-image copying, blank-layout printing, comments, configurable shortcuts, and a locale-pack framework.',
      'Added optional revision polling and remote-change notices for Google Drive collaboration without claiming server-style live co-editing.',
      'Split new planning capabilities into maintained source modules while the build still produces one self-contained portable HTML release.',
      'Published JSON Schema contracts, example files, and validation tooling for saves, class records, room-template libraries, and locale packs without changing schema 13 or encryption envelope 3.'
    ]
  },
  {
    version: '6.5.13',
    date: 'July 16, 2026',
    title: 'Compact mobile close controls and full-screen room canvas',
    current: false,
    changes: [
      'Replaced the filled red circular mobile Close treatment with a smaller square X button while retaining accessible names and full desktop Close labels.',
      'Applied the compact X treatment consistently to modal, sheet, and dynamically rendered Close controls on mobile.',
      'Added Canvas only to mobile Room Design so the top bar, workflow guidance, headers, menus, and tool panels can be hidden while the classroom canvas uses the full viewport.',
      'Added a small floating controls button and Escape support to restore the Room Design interface without leaving the canvas.',
      'Verified mobile Room Design controls, close-button normalization, responsive canvas focus, and the existing interaction and regression suites.'
    ]
  },
  {
    version: '6.5.12',
    date: 'July 16, 2026',
    title: 'Direct mobile room controls and stable Prismatic surfaces',
    current: false,
    changes: [
      'Added persistent Grid and Freeform choices above the mobile Room Design canvas with direct mode-specific options.',
      'Opened Grid and Freeform tools in a full-height mobile sheet with backdrop, Escape, and compact red-X dismissal.',
      'Kept advanced room actions available separately so basic layout controls no longer depend on a nested menu.',
      'Enlarged the printer control and converted mobile Close buttons to accessible traditional red X controls.',
      'Stabilized Prismatic Flow panels, dialogs, menus, seats, and cards while retaining animated jewel-tone background, top-strip, and primary-control effects.',
      'Verified phone portrait, phone landscape, tablet, real-browser interaction, Prismatic compositor styles, and the full regression suite.'
    ]
  },
  {
    version: '6.5.11',
    date: 'July 16, 2026',
    title: 'Full codebase consolidation and runtime listener optimization',
    current: false,
    changes: [
      'Completed a project-wide reference, control, dependency, duplicate-code, compatibility, and performance audit without changing the data schema or encryption envelope.',
      'Replaced per-render Freeform-object and zone-card listeners with fixed delegated handlers while preserving mouse, touch, drag, context-menu, and seat-settings behavior.',
      'Consolidated equivalent workflow forwarding functions, Grid-cell ordering, touch seat-settings gestures, and Freeform rotation suppression logic.',
      'Condensed release history, removed reproducible audit clutter, expanded static guards, and repaired tablet Class Setup navigation overflow.'
    ]
  },
  {
    version: '6.5.10',
    date: 'July 16, 2026',
    title: 'Clear rule warnings, Freeform safeguards, and SIS import repair',
    current: false,
    changes: [
      'Replaced technical seat-unit rule text with plain-language proximity descriptions.',
      'Added override-or-move-back warnings when Freeform moves introduce new seating-rule conflicts.',
      'Kept moved Freeform seats visually stable and repaired the dynamically created SIS / OneRoster file chooser.'
    ]
  },
  {
    version: '6.5.9',
    date: 'July 16, 2026',
    title: 'Presentation exit, batch seat zones, and rule integrity',
    current: false,
    changes: [
      'Added a persistent Presentation exit action and expanded Class Setup with a dedicated Groups & Zones Manager step.',
      'Added individual and batch group/zone assignment to Grid and Freeform seat settings.',
      'Unified review, placement warnings, and generated seating around student needs, groups, zones, room objects, reserved seats, and distance rules.'
    ]
  },
  {
    version: '6.5.7–6.5.8',
    date: 'July 15–16, 2026',
    title: 'Mobile control compaction and real-browser seat interaction repair',
    current: false,
    changes: [
      'Added stable mobile collapse states and workflow-specific compact room action menus.',
      'Repaired unlocked Grid and Freeform seat settings for real mouse double-clicks, touch double-tap, and long-press while preserving dragging.',
      'Restored Build/Resize as a visible, cancellable, undoable, and persistent mode, and added real Chromium interaction coverage.'
    ]
  },
  {
    version: '6.5.0–6.5.6',
    date: 'July 14–15, 2026',
    title: 'Security, Presentation, responsive UI, and import hardening',
    current: false,
    changes: [
      'Hardened encryption work limits, protected viewer packages, imports, downloads, service-worker boundaries, storage reset behavior, and privacy-safe diagnostics.',
      'Expanded Presentation privacy and lockout behavior, universal room zoom/text controls, crop-to-content exports, and optional hosted analytics.',
      'Completed responsive mobile and tablet audits, full-viewport room panning, workflow panel routing, theme contrast repair, and permanent UI/control release gates.',
      'Removed obsolete settings and report clutter while preserving save, schema, Drive, Classroom, viewer, and recovery compatibility.'
    ]
  },
  {
    version: '6.4.0–6.4.8',
    date: 'July 2026',
    title: 'Drive collaboration, protected sharing, Freeform rotation, and export fidelity',
    current: false,
    changes: [
      'Added direct Freeform rotation controls, cleanup and rendering optimizations, and complete Help and collaboration guidance.',
      'Added faithful encrypted read-only classroom packages, protected package profiles, revision-aware Drive sharing, conflict handling, and collaborator-specific workflow access.',
      'Improved print, PDF, and Freeform one-page output, Drive reload continuity, visual themes, and regression coverage.'
    ]
  },
  {
    version: '6.3.0–6.3.4',
    date: 'July 2026',
    title: 'Groups migration, data integrity, stable startup, and workspace repair',
    current: false,
    changes: [
      'Completed the Groups migration and manager interaction repair, including touch-friendly membership workflows.',
      'Hardened data cleanup and startup defaults, added optional About-page support, and repaired roster and Freeform workspace behavior.'
    ]
  },
  {
    version: '6.2.0–6.2.1',
    date: 'July 2026',
    title: 'Conflict insight, class merging, recovery, and responsive dialogs',
    current: false,
    changes: [
      'Added conflict inspection, class merge and recovery workflows, and improved candidate explanations.',
      'Repaired responsive dialog sizing and narrow-screen action reachability.'
    ]
  },
  {
    version: '6.1.0–6.1.3',
    date: 'July 2026',
    title: 'Guided learning, readable source architecture, and render optimization',
    current: false,
    changes: [
      'Introduced state-aware guided learning and unified popup, tour, and modal layering.',
      'Improved source organization, verified cleanup, and reduced unnecessary rendering while retaining dynamic workflows.'
    ]
  },
  {
    version: '6.0.0–6.0.4',
    date: 'July 2026',
    title: 'Clean generation reset, schema compatibility, search, Help, and CSS maintenance',
    current: false,
    changes: [
      'Reset format generation around a clean architecture while retaining schema-based save compatibility.',
      'Improved Global Search containment, Help and tour controls, Class Setup polish, and CSS maintainability.'
    ]
  },
  {
    version: '5.7–5.8',
    date: '2026',
    title: 'District integrations, cloud lifecycle, reliability, and deployment',
    current: false,
    changes: [
      'Expanded Google Drive and Classroom integration, cloud-file lifecycle management, recovery, diagnostics, and hosted deployment safeguards.',
      'Completed project-wide reliability and production-readiness audits.'
    ]
  },
  {
    version: '5.0–5.6',
    date: '2026',
    title: 'Production classroom workflow, saving, Class Setup, and cascade cleanup',
    current: false,
    changes: [
      'Matured the classroom workflow, Class Setup, reliable local and Drive saving, recovery, and production packaging.',
      'Consolidated CSS cascade structure and version history while preserving established behavior.'
    ]
  },
  {
    version: '4.0–4.6',
    date: '2026',
    title: 'Workflow-first product redesign',
    current: false,
    changes: [
      'Reorganized the product around setup, room design, seating, review, and sharing workflows.',
      'Expanded responsive navigation, presentation, printing, settings, and classroom-facing usability.'
    ]
  },
  {
    version: '3.0–3.1',
    date: '2026',
    title: 'Hosted deployment and complete Freeform rooms',
    current: false,
    changes: [
      'Added hosted deployment support and the complete Freeform room-design model, including persistent objects and canvas behavior.'
    ]
  },
  {
    version: '2.0',
    date: '2026',
    title: 'Architecture stabilization',
    current: false,
    changes: [
      'Stabilized application state, save/load behavior, rendering, and maintainable separation of major responsibilities.'
    ]
  },
  {
    version: '1.0–1.19',
    date: '2026',
    title: 'Seating planner foundation and operational classroom tools',
    current: false,
    changes: [
      'Established roster management, Grid seating, rules, assignment, review, print, undo/redo, settings, and privacy controls.',
      'Added mobile workspace support, substitute and operational tools, security, recovery, maintenance, and data-integrity improvements.'
    ]
  }
];

const state = {
  classes: [],
  activeClassId: null,
  students: [],
  groups: [],
  rows: 5,
  cols: 6,
  cells: {},
  layoutMode: 'grid',
  freeformLayout: null,
  customObjects: [],
  zones: [],
  roomTemplates: [],
  chartMeta: {},
  rosterArchive: [],
  todaySession: null,
  seatingPlans: [],
  importProfiles: [],
  requirementPresets: [],
  ruleOverrides: [],
  collaborationAccess: { version: COLLABORATION_ACCESS_VERSION, updatedAt: '', policies: {} }
};

const uiState = {
  selectedCellKeys: new Set(),
  selectionMode: false,
  isSelectingCells: false,
  skipNextCellClick: false,
  selectionAnchorKey: null,
  activeSeatEditCellKey: null,
  activeSeatEditFreeformObjectId: null,
  activeSeatEditBatchCellKeys: [],
  activeSeatEditBatchFreeformObjectIds: [],
  namesOnlyLayout: true,
  activeSideTab: 'students',
  encryptionEnabled: false,
  encryptionKey: '',
  pageLocked: false,
  designMode: false,
  designCellSize: 28,
  lockedSnapshotEncrypted: '',
  mobileActivePanel: 'layout',
  mobileCarryItem: null,
  mobileRoomPanActive: false,
  mobileRoomPanPointer: null,
  mobileRoomActionsOpen: false,
  mobileLayoutOptionsOpen: false,
  mobileRoomCanvasFocus: false,
  gridResizeModeActive: false,
  gridResizeOriginalRows: null,
  gridResizeOriginalCols: null,
  gridResizeDirty: false,
  visibilityPreviousMobileRoomPan: false,
  groupManagerCarryItem: null,
  visibilityMode: false,
  visibilityPreviousNamesOnly: true,
  visibilityPreviousWorkflow: 'review',
  pageSettings: null,
  undoStack: [],
  redoStack: [],
  historyPaused: false,
  csvImportDraft: null,
  autoLockTimer: null,
  textInputCallback: null,
  noteEditorContext: null,
  noteEditorDraft: null,
  printOptions: null,
  appReady: false,
  linkedSaveSupported: false,
  linkedSaveHandle: null,
  linkedSaveFileName: '',
  linkedSaveBusy: false,
  linkedSavePending: false,
  linkedSaveStatus: 'No linked file selected.',
  linkedSaveLastSignature: '',
  linkedSaveAutoTimer: null,
  linkedSaveMaxTimer: null,
  autosaveDirtySince: 0,
  autosaveInProgress: false,
  autosaveGeneration: 0,
  browserSaveEpoch: 0,
  googleDriveAccessToken: '',
  googleDriveTokenExpiresAt: 0,
  googleDriveTokenClient: null,
  googleDriveBusy: false,
  googleDriveStatus: 'Google Drive is not connected.',
  googleDriveLastSyncAt: '',
  googleDriveFiles: [],
  googleDriveSelectedFileId: '',
  googleDriveChooserContext: null,
  googleDriveCapabilities: null,
  googleDriveAccessRole: 'unknown',
  googleDriveUser: null,
  sharedDriveInterfacePolicy: null,
  sharedDriveInterfacePermissionId: '',
  sharedDriveBaseDocument: null,
  sharedDriveBaseFileId: '',
  sharedDriveMergePending: null,
  sharedViewerDocument: null,
  saveFallbackWarning: '',
  pageSettingsPersistTimer: null,
  restoreImportDraft: null,
  activeSettingsPage: 'chart',
  appSnapshotsCache: null,
  appSnapshotsLoaded: false,
  snapshotIndexPersistToken: 0,
  hiddenAt: 0,
  isPageExiting: false,
  autoLockInProgress: false,
  pageLockSecretForSession: '',
  freeformSelectedObjectIds: new Set(),
  freeformDrag: null,
  freeformRotation: null,
  suppressFreeformRotateClick: null,
  freeformGeometryCache: new Map(),
  freeformGeometryCacheReady: false,
  durableSavePromptActive: false,
  lastDurableSavePromptAt: 0,
  welcomeSecurityJustCompleted: false,
  suppressEncryptionPromptUntil: 0,
  saveIdentity: null,
  previewSaveIdentity: null,
  keyboardCarryStudentId: '',
  seatingWorker: null,
  seatingCandidates: [],
  seatingCandidateMode: 'generate',
  seatingCandidateSeed: '',
  seatingCandidateBatch: 0,
  seatingCandidateExcludedSignatures: [],
  seatingWorkerRunId: 0,
  linkedFileLastModified: 0,
  pendingSaveConflict: null,
  lastBackupVerification: null,
  appDatabaseReady: false,
  browserStorageStatus: 'unknown',
  storageErrors: [],
  lastStorageError: '',
  tabInstanceId: '',
  concurrentTabDetected: false,
  concurrentTabOwner: '',
  concurrentTabLastSeenAt: 0,
  onboardingSecuritySavePromise: null
};

const el = (id) => document.getElementById(id);

function selectedOptionValues(select) {
  return Array.from(select?.selectedOptions || []).map(option => String(option.value));
}
function setControlValue(id, value) {
  const control = el(id);
  if (control) control.value = String(value ?? '');
}

function setControlChecked(id, value) {
  const control = el(id);
  if (control) control.checked = Boolean(value);
}

function notifyPlacementCompletion(completion, placed, reason = '') {
  if (typeof completion?.onComplete === 'function') completion.onComplete(Boolean(placed), reason);
}

function optionalColumnIndex(value) {
  return value === '' ? -1 : Number(value);
}

function cloneJsonValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeCollaborationMode(value, fallback = 'none') {
  const mode = String(value || '').toLowerCase();
  return ['none', 'view', 'edit'].includes(mode) ? mode : fallback;
}

function collaborationPresetCapabilities(preset = 'full', driveRole = 'writer') {
  const source = COLLABORATION_PRESETS[preset] || COLLABORATION_PRESETS.full;
  const capabilities = {};
  COLLABORATION_AREAS.forEach(area => {
    const mode = normalizeCollaborationMode(source[area], 'none');
    capabilities[area] = driveRole === 'reader' && mode === 'edit' ? 'view' : mode;
  });
  return capabilities;
}

function collaborationPresetForCapabilities(capabilities = {}, driveRole = 'writer') {
  const normalized = {};
  COLLABORATION_AREAS.forEach(area => { normalized[area] = normalizeCollaborationMode(capabilities[area], 'none'); });
  for (const preset of Object.keys(COLLABORATION_PRESETS)) {
    const expected = collaborationPresetCapabilities(preset, driveRole);
    if (COLLABORATION_AREAS.every(area => expected[area] === normalized[area])) return preset;
  }
  return 'custom';
}

function normalizeCollaborationPolicy(policy = {}, fallback = {}) {
  const roleValue = fallback.driveRole || policy.driveRole || 'writer';
  const driveRole = roleValue === 'reader' ? 'reader' : 'writer';
  const requestedPreset = String(policy.preset || fallback.preset || 'full');
  const sourceCapabilities = policy.capabilities && typeof policy.capabilities === 'object'
    ? policy.capabilities
    : collaborationPresetCapabilities(requestedPreset, driveRole);
  const capabilities = {};
  COLLABORATION_AREAS.forEach(area => {
    let mode = normalizeCollaborationMode(sourceCapabilities[area], collaborationPresetCapabilities('full', driveRole)[area]);
    if (driveRole === 'reader' && mode === 'edit') mode = 'view';
    capabilities[area] = mode;
  });
  return {
    permissionId: String(policy.permissionId || fallback.permissionId || ''),
    email: String(policy.email || fallback.email || '').trim().toLowerCase(),
    displayName: String(policy.displayName || fallback.displayName || ''),
    driveRole,
    preset: collaborationPresetForCapabilities(capabilities, driveRole),
    capabilities,
    updatedAt: String(policy.updatedAt || fallback.updatedAt || '')
  };
}

function normalizeCollaborationAccess(value = null) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const policies = {};
  const rawPolicies = source.policies && typeof source.policies === 'object' && !Array.isArray(source.policies) ? source.policies : {};
  Object.entries(rawPolicies).forEach(([permissionId, policy]) => {
    const normalized = normalizeCollaborationPolicy(policy, { permissionId });
    if (normalized.permissionId) policies[normalized.permissionId] = normalized;
  });
  const rawPresence = source.presence && typeof source.presence === 'object' && !Array.isArray(source.presence) ? source.presence : {};
  const presence = Object.keys(rawPresence).length ? {
    deviceId: String(rawPresence.deviceId || '').slice(0, 160),
    email: String(rawPresence.email || '').slice(0, 200),
    displayName: String(rawPresence.displayName || '').slice(0, 120),
    workflow: String(rawPresence.workflow || '').slice(0, 40),
    activeClassId: String(rawPresence.activeClassId || '').slice(0, 160),
    updatedAt: String(rawPresence.updatedAt || '').slice(0, 40)
  } : null;
  const changeLedger = (Array.isArray(source.changeLedger) ? source.changeLedger : []).slice(-80).map(entry => ({
    id: String(entry?.id || uid('collab-log')).slice(0, 180),
    type: String(entry?.type || 'activity').slice(0, 60),
    summary: String(entry?.summary || '').slice(0, 500),
    deviceId: String(entry?.deviceId || '').slice(0, 160),
    email: String(entry?.email || '').slice(0, 200),
    displayName: String(entry?.displayName || '').slice(0, 120),
    workflow: String(entry?.workflow || '').slice(0, 40),
    activeClassId: String(entry?.activeClassId || '').slice(0, 160),
    createdAt: String(entry?.createdAt || '').slice(0, 40)
  }));
  return { version: COLLABORATION_ACCESS_VERSION, updatedAt: String(source.updatedAt || ''), policies, presence, changeLedger };
}

function collaborationAccessDocument() {
  state.collaborationAccess = normalizeCollaborationAccess(state.collaborationAccess);
  return cloneJsonValue(state.collaborationAccess);
}

function recordStorageFailure(storageName, operation, key, error) {
  const message = `${storageName}.${operation} failed for ${String(key || 'unknown key')}: ${error?.message || 'storage unavailable'}`;
  uiState.lastStorageError = message;
  uiState.browserStorageStatus = 'error';
  uiState.storageErrors.push({ storageName, operation, key: String(key || ''), message, at: new Date().toISOString() });
  if (uiState.storageErrors.length > 20) uiState.storageErrors.splice(0, uiState.storageErrors.length - 20);
}
function safeStorageGet(storageName, key) {
  try { return window[storageName]?.getItem(key) || null; }
  catch (err) { recordStorageFailure(storageName, 'getItem', key, err); return null; }
}
function safeStorageSet(storageName, key, value) {
  try { window[storageName]?.setItem(key, value); return true; }
  catch (err) { recordStorageFailure(storageName, 'setItem', key, err); return false; }
}
function safeStorageRemove(storageName, key) {
  try { window[storageName]?.removeItem(key); return true; }
  catch (err) { recordStorageFailure(storageName, 'removeItem', key, err); return false; }
}

const PLANNER_STORAGE_KEY_PREFIXES = Object.freeze([
  'classroom-seating-planner',
  'classroomSeatingPlanner'
]);

function isPlannerStorageKey(key) {
  const value = String(key || '');
  return PLANNER_STORAGE_KEY_PREFIXES.some(prefix => value.startsWith(prefix));
}

function clearPlannerWebStorage(storageName) {
  const removed = [];
  const failed = [];
  try {
    const storage = window[storageName];
    if (!storage) return { removed, failed };
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (isPlannerStorageKey(key)) keys.push(key);
    }
    keys.forEach(key => {
      if (safeStorageRemove(storageName, key)) removed.push(key);
      else failed.push(key);
    });
  } catch (err) {
    recordStorageFailure(storageName, 'enumerate', 'planner keys', err);
    failed.push('planner keys');
  }
  return { removed, failed };
}
const keyOf = (row, col) => `${row}-${col}`;
function secureRandomToken(byteLength = 16) {
  const size = Math.max(8, Math.min(64, Number(byteLength) || 16));
  if (!window.crypto?.getRandomValues) throw new Error('Secure random-number generation is required by this browser.');
  const bytes = window.crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
const uid = (prefix) => `${prefix}-${window.crypto?.randomUUID?.() || secureRandomToken(16)}`;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[ch]));
const cssEscape = (value) => (window.CSS && typeof window.CSS.escape === 'function') ? window.CSS.escape(String(value)) : String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '\\$&');
const GROUP_COLORS = ['#2f6fed', '#e11d48', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569'];
const THEME_OPTIONS = ['default','gradient','shimmer','prismatic','aurora','highContrast','windowsXp','windows11','macos','linux'];
const defaultGroupColor = (index = 0) => GROUP_COLORS[Math.abs(index) % GROUP_COLORS.length];
const safeColor = (value, fallback = '#2f6fed') => /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? String(value) : fallback;
const clampNumber = (value, min, max) => { const numeric = Number(value); return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : min)); };
const DEFAULT_PAGE_SETTINGS = Object.freeze({
  defaultNamesOnly: true,
  theme: 'default',
  headerCollapsed: false,
  leftCollapsed: true,
  rightCollapsed: false,
  layoutToolsCollapsed: false,
  csvCollapsed: true,
  addStudentCollapsed: true,
  hideHints: false,
  hideObjectTypeLabels: false,
  hideUnassignedSeatTitles: false,
  gridViewZoom: 100,
  seatTextScale: 100,
  autoSaveMinutes: 1,
  preferredStorage: 'browser',
  googleDriveClientId: GOOGLE_DRIVE_CLIENT_ID,
  googleDriveFolderName: APP_CONFIG.googleDriveFolderName,
  googleDriveFolderId: '',
  googleDriveFileId: '',
  googleDriveFileName: '',
  googleDriveLastSavedAt: '',
  googleDriveFileVersion: '',
  googleDriveHeadRevisionId: '',
  googleDriveRemoteMd5: '',
  designCellSize: 28,
  freeformSnapToGrid: true,
  freeformAllowSeatPassThrough: true,
  freeformAllowSeatOverlapOnDrop: true,
  freeformMagneticGuides: true,
  freeformShowMinimap: true,
  freeformShowPrintBoundaries: false,
  freeformCleanView: false,
  freeformGridSize: 40,
  generatorSeed: '',
  generatorCandidateCount: 3,
  generatorAttempts: 180,
  showArchivedClasses: false,
  googleDriveConflictPolicy: 'ask',
  settingsAccessMethod: 'auto',
  autoLockMinutes: 0,
  autoLockOnBlur: false,
  autoLockOnTabHidden: false,
  autoLockOnReturnMinutes: 0,
  pbkdf2Iterations: 310000,
  visibility: {
    hideClassActions: true,
    hideWizard: true,
    hideSaveLoad: true,
    hideSettings: true,
    hidePrint: true,
    hideLayoutTools: true,
    hideStudentsPanel: true,
    hideStatusPanel: true,
    hideChartActions: true,
    forceNamesOnly: true,
    hideGroupDetails: true,
    disableSeatEditing: true,
    disableRoomEditing: true,
    disableStudentEditing: true,
    disableGroupEditing: true
  }
});

function mergePageSettingsCore(value) {
  const source = value && typeof value === 'object' ? value : {};
  const visibility = source.visibility && typeof source.visibility === 'object' ? source.visibility : {};
  return {
    defaultNamesOnly: source.defaultNamesOnly ?? DEFAULT_PAGE_SETTINGS.defaultNamesOnly,
    theme: THEME_OPTIONS.includes(source.theme) ? source.theme : DEFAULT_PAGE_SETTINGS.theme,
    headerCollapsed: source.headerCollapsed ?? DEFAULT_PAGE_SETTINGS.headerCollapsed,
    leftCollapsed: source.leftCollapsed ?? DEFAULT_PAGE_SETTINGS.leftCollapsed,
    rightCollapsed: source.rightCollapsed ?? DEFAULT_PAGE_SETTINGS.rightCollapsed,
    layoutToolsCollapsed: source.layoutToolsCollapsed ?? DEFAULT_PAGE_SETTINGS.layoutToolsCollapsed,
    csvCollapsed: source.csvCollapsed ?? DEFAULT_PAGE_SETTINGS.csvCollapsed,
    addStudentCollapsed: source.addStudentCollapsed ?? DEFAULT_PAGE_SETTINGS.addStudentCollapsed,
    hideHints: source.hideHints ?? DEFAULT_PAGE_SETTINGS.hideHints,
    hideObjectTypeLabels: source.hideObjectTypeLabels ?? DEFAULT_PAGE_SETTINGS.hideObjectTypeLabels,
    hideUnassignedSeatTitles: source.hideUnassignedSeatTitles ?? DEFAULT_PAGE_SETTINGS.hideUnassignedSeatTitles,
    gridViewZoom: clampNumber(source.gridViewZoom ?? DEFAULT_PAGE_SETTINGS.gridViewZoom, 35, 175),
    seatTextScale: clampNumber(source.seatTextScale ?? DEFAULT_PAGE_SETTINGS.seatTextScale, 70, 200),
    autoSaveMinutes: clampNumber(source.autoSaveMinutes ?? (source.autoSaveLinkedFile ? 3 : DEFAULT_PAGE_SETTINGS.autoSaveMinutes), 0, 120),
    preferredStorage: ['browser','linked','googleDrive'].includes(source.preferredStorage) ? source.preferredStorage : DEFAULT_PAGE_SETTINGS.preferredStorage,
    googleDriveClientId: String(source.googleDriveClientId || GOOGLE_DRIVE_CLIENT_ID || '').trim(),
    googleDriveFolderName: String(source.googleDriveFolderName || DEFAULT_PAGE_SETTINGS.googleDriveFolderName || APP_CONFIG.googleDriveFolderName).trim().slice(0, 120) || APP_CONFIG.googleDriveFolderName,
    googleDriveFolderId: String(source.googleDriveFolderId || '').trim(),
    googleDriveFileId: String(source.googleDriveFileId || '').trim(),
    googleDriveFileName: String(source.googleDriveFileName || '').trim(),
    googleDriveLastSavedAt: String(source.googleDriveLastSavedAt || '').trim(),
    googleDriveFileVersion: String(source.googleDriveFileVersion || '').trim(),
    googleDriveHeadRevisionId: String(source.googleDriveHeadRevisionId || '').trim(),
    googleDriveRemoteMd5: String(source.googleDriveRemoteMd5 || '').trim(),
    designCellSize: clampNumber(source.designCellSize ?? DEFAULT_PAGE_SETTINGS.designCellSize, 20, 72),
    freeformSnapToGrid: source.freeformSnapToGrid ?? DEFAULT_PAGE_SETTINGS.freeformSnapToGrid,
    freeformAllowSeatPassThrough: source.freeformAllowSeatPassThrough ?? DEFAULT_PAGE_SETTINGS.freeformAllowSeatPassThrough,
    freeformAllowSeatOverlapOnDrop: source.freeformAllowSeatOverlapOnDrop ?? DEFAULT_PAGE_SETTINGS.freeformAllowSeatOverlapOnDrop,
    freeformMagneticGuides: source.freeformMagneticGuides ?? DEFAULT_PAGE_SETTINGS.freeformMagneticGuides,
    freeformShowMinimap: source.freeformShowMinimap ?? DEFAULT_PAGE_SETTINGS.freeformShowMinimap,
    freeformShowPrintBoundaries: source.freeformShowPrintBoundaries ?? DEFAULT_PAGE_SETTINGS.freeformShowPrintBoundaries,
    freeformCleanView: source.freeformCleanView ?? DEFAULT_PAGE_SETTINGS.freeformCleanView,
    freeformGridSize: clampNumber(source.freeformGridSize ?? DEFAULT_PAGE_SETTINGS.freeformGridSize, 5, 80),
    generatorSeed: String(source.generatorSeed || DEFAULT_PAGE_SETTINGS.generatorSeed).slice(0, 120),
    generatorCandidateCount: clampNumber(source.generatorCandidateCount ?? DEFAULT_PAGE_SETTINGS.generatorCandidateCount, 1, 5),
    generatorAttempts: clampNumber(source.generatorAttempts ?? DEFAULT_PAGE_SETTINGS.generatorAttempts, 20, 1200),
    showArchivedClasses: source.showArchivedClasses ?? DEFAULT_PAGE_SETTINGS.showArchivedClasses,
    googleDriveConflictPolicy: ['ask','overwrite','copy'].includes(source.googleDriveConflictPolicy) ? source.googleDriveConflictPolicy : DEFAULT_PAGE_SETTINGS.googleDriveConflictPolicy,
    settingsAccessMethod: ['auto','lock','eye','encryption','none'].includes(source.settingsAccessMethod) ? source.settingsAccessMethod : DEFAULT_PAGE_SETTINGS.settingsAccessMethod,
    autoLockMinutes: clampNumber(source.autoLockMinutes ?? DEFAULT_PAGE_SETTINGS.autoLockMinutes, 0, 240),
    autoLockOnBlur: source.autoLockOnBlur ?? DEFAULT_PAGE_SETTINGS.autoLockOnBlur,
    autoLockOnTabHidden: source.autoLockOnTabHidden ?? DEFAULT_PAGE_SETTINGS.autoLockOnTabHidden,
    autoLockOnReturnMinutes: clampNumber(source.autoLockOnReturnMinutes ?? DEFAULT_PAGE_SETTINGS.autoLockOnReturnMinutes, 0, 240),
    pbkdf2Iterations: clampNumber(source.pbkdf2Iterations ?? DEFAULT_PAGE_SETTINGS.pbkdf2Iterations, 150000, 2000000),
    visibility: {
      hideClassActions: true,
      hideWizard: true,
      hideSaveLoad: true,
      hideSettings: true,
      hidePrint: visibility.hidePrint ?? DEFAULT_PAGE_SETTINGS.visibility.hidePrint,
      hideLayoutTools: true,
      hideStudentsPanel: true,  
      hideStatusPanel: true,
      hideChartActions: true,
      forceNamesOnly: visibility.forceNamesOnly ?? DEFAULT_PAGE_SETTINGS.visibility.forceNamesOnly,
      hideGroupDetails: visibility.hideGroupDetails ?? visibility[LEGACY_SCHEMA_12_GROUP_FIELDS.hideDetails] ?? DEFAULT_PAGE_SETTINGS.visibility.hideGroupDetails,
      disableSeatEditing: true,
      disableRoomEditing: true,
      disableStudentEditing: true,
      disableGroupEditing: true
    }
  };
}

function pageSettings() {
  if (!uiState.pageSettings) uiState.pageSettings = mergePageSettings(null);
  return uiState.pageSettings;
}

function mergeImportedPageSettings(value) {
  const current = uiState.pageSettings ? mergePageSettings(uiState.pageSettings) : mergePageSettings(null);
  const imported = mergePageSettings(value || {});
   
   
  return {
    ...imported,
    googleDriveClientId: current.googleDriveClientId || APP_CONFIG.googleDriveClientId,
    googleDriveFolderId: current.googleDriveFolderId || '',
    googleDriveFileId: current.googleDriveFileId || '',
    googleDriveFileName: current.googleDriveFileName || '',
    googleDriveLastSavedAt: current.googleDriveLastSavedAt || '',
    googleDriveFileVersion: current.googleDriveFileVersion || '',
    googleDriveHeadRevisionId: current.googleDriveHeadRevisionId || '',
    googleDriveRemoteMd5: current.googleDriveRemoteMd5 || ''
  };
}


function hashString(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36);
}


function utf8ByteLength(value) {
  return new TextEncoder().encode(String(value || '')).byteLength;
}

async function sha256Hex(value) {
  if (!window.crypto?.subtle) throw new Error('SHA-256 verification requires Web Crypto support.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function stableJsonStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => stableJsonStringify(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`).join(',')}}`;
}

async function addBackupManifest(jsonText, scope = 'all') {
  const document = JSON.parse(String(jsonText || ''));
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('Backup manifest creation requires an object-based save document.');
  delete document.backupManifest;
  const canonical = stableJsonStringify(document);
  document.backupManifest = {
    format: 'classroom-seating-planner-backup-v6',
    algorithm: 'SHA-256',
    contentHash: await sha256Hex(canonical),
    canonicalBytes: utf8ByteLength(canonical),
    createdAt: new Date().toISOString(),
    appVersion: String(document.version || APP_REVISION),
    dataSchemaVersion: Number(document.dataSchemaVersion || DATA_SCHEMA_VERSION),
    minimumReaderSchemaVersion: Number(document.minimumReaderSchemaVersion || MIN_SUPPORTED_DATA_SCHEMA_VERSION),
    scope: scope === 'current' ? 'current-class' : String(scope || 'all-classes')
  };
  return JSON.stringify(document, null, 2);
}

async function verifyBackupManifest(document, sourceLabel = 'save or backup') {
  const manifest = document?.backupManifest;
  if (!manifest) throw unsupportedFormatError(sourceLabel, 'A current SHA-256 backup manifest is required.');
  if (manifest.format !== 'classroom-seating-planner-backup-v6' || manifest.algorithm !== 'SHA-256' || !manifest.contentHash) {
    throw unsupportedFormatError(sourceLabel, 'The backup manifest is unsupported or incomplete.');
  }
  const documentSchema = readSchemaCompatibility(document, sourceLabel);
  const manifestSchema = readSchemaCompatibility(manifest, `${sourceLabel} manifest`);
  if (!String(manifest.appVersion || '').trim() || manifest.appVersion !== document.version) {
    throw unsupportedFormatError(sourceLabel, 'The manifest application version must match the producing version recorded by the document.');
  }
  if (manifestSchema.schemaVersion !== documentSchema.schemaVersion || manifestSchema.minimumReaderSchemaVersion !== documentSchema.minimumReaderSchemaVersion) {
    throw unsupportedFormatError(sourceLabel, 'The manifest schema compatibility metadata does not match the document.');
  }
  const copy = JSON.parse(JSON.stringify(document));
  delete copy.backupManifest;
  const canonical = stableJsonStringify(copy);
  const actual = await sha256Hex(canonical);
  if (actual !== String(manifest.contentHash)) throw new Error(`The ${sourceLabel} failed SHA-256 integrity verification. It may be incomplete, damaged, or modified.`);
  if (Number(manifest.canonicalBytes) !== utf8ByteLength(canonical)) throw new Error(`The ${sourceLabel} byte-length manifest does not match its contents.`);
  return { present: true, verified: true, algorithm: 'SHA-256', contentHash: actual, canonicalBytes: utf8ByteLength(canonical) };
}

function assertImportTextWithinLimits(text, sourceLabel = 'file/local save', limit = IMPORT_LIMITS.saveBytes) {
  const bytes = utf8ByteLength(text);
  if (bytes > limit) throw new Error(`The selected ${sourceLabel} is ${Math.ceil(bytes / 1048576)} MB. The safety limit is ${Math.floor(limit / 1048576)} MB.`);
  return bytes;
}

function assertImportByteLengthWithinLimits(byteLength, sourceLabel = 'file/local save', limit = IMPORT_LIMITS.saveBytes) {
  const bytes = Number(byteLength);
  if (Number.isFinite(bytes) && bytes > limit) throw new Error(`The selected ${sourceLabel} is ${Math.ceil(bytes / 1048576)} MB. The safety limit is ${Math.floor(limit / 1048576)} MB.`);
  return Number.isFinite(bytes) ? bytes : 0;
}

async function readTextFileWithinLimits(file, sourceLabel = 'file/local save', limit = IMPORT_LIMITS.saveBytes) {
  if (!file || typeof file.text !== 'function') throw new Error(`The selected ${sourceLabel} is unavailable or unreadable.`);
  assertImportByteLengthWithinLimits(file.size, sourceLabel, limit);
  const text = await file.text();
  assertImportTextWithinLimits(text, sourceLabel, limit);
  return text;
}

async function readResponseTextWithinLimits(response, sourceLabel = 'network file', limit = IMPORT_LIMITS.saveBytes) {
  if (!response || typeof response.text !== 'function') throw new Error(`The ${sourceLabel} response is unavailable or unreadable.`);
  const contentLength = response.headers?.get?.('content-length');
  if (contentLength) assertImportByteLengthWithinLimits(Number(contentLength), sourceLabel, limit);
  const text = await response.text();
  assertImportTextWithinLimits(text, sourceLabel, limit);
  return text;
}

function validateImportStructure(root, sourceLabel = 'file/local save') {
  const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
  let nodes = 0;
  const stack = [{ value: root, depth: 0, path: '$' }];
  while (stack.length) {
    const current = stack.pop();
    nodes += 1;
    if (nodes > IMPORT_LIMITS.maxNodes) throw new Error(`The selected ${sourceLabel} contains too many nested values to import safely.`);
    if (current.depth > IMPORT_LIMITS.maxDepth) throw new Error(`The selected ${sourceLabel} is nested too deeply to import safely.`);
    if (typeof current.value === 'string') {
      if (current.value.length > IMPORT_LIMITS.maxStringLength) throw new Error(`The selected ${sourceLabel} contains an unexpectedly large text value at ${current.path}.`);
      continue;
    }
    if (!current.value || typeof current.value !== 'object') continue;
    for (const key of Object.keys(current.value)) {
      if (forbidden.has(key)) throw new Error(`The selected ${sourceLabel} contains a prohibited property (${key}).`);
      stack.push({ value: current.value[key], depth: current.depth + 1, path: `${current.path}.${key}` });
    }
  }
  return nodes;
}

function validateImportRecordLimits(document, sourceLabel = 'file/local save') {
  let classes = [];
  if (document?.format === SAVE_DOCUMENT_FORMAT) classes = Array.isArray(document.classes) ? document.classes : [];
  else if (document?.format === COMPONENT_EXPORT_FORMAT) {
    if (document.kind === 'seating-chart-student-data') classes = [{ name: document.className, students: document.students || [], cells: {}, freeformLayout: { objects: [] } }];
    if (document.kind === 'seating-chart-groups-config') classes = [{ name: document.className, students: [], cells: {}, freeformLayout: { objects: [] } }];
    if (document.kind === 'seating-chart-room-layouts') classes = [{ name: document.className, students: [], cells: document.currentRoom?.cells || {}, freeformLayout: document.currentRoom?.freeformLayout || { objects: [] } }];
  }
  if (classes.length > IMPORT_LIMITS.maxClasses) throw new Error(`The selected ${sourceLabel} contains ${classes.length} classes; the safety limit is ${IMPORT_LIMITS.maxClasses}.`);
  classes.forEach((cls, index) => {
    const label = String(cls?.name || `Class ${index + 1}`);
    if ((cls?.students || []).length > IMPORT_LIMITS.maxStudentsPerClass) throw new Error(`${label} contains more than ${IMPORT_LIMITS.maxStudentsPerClass} students.`);
    if (Object.keys(cls?.cells || {}).length > IMPORT_LIMITS.maxCellsPerClass) throw new Error(`${label} contains more than ${IMPORT_LIMITS.maxCellsPerClass} room cells.`);
    if ((cls?.freeformLayout?.objects || []).length > IMPORT_LIMITS.maxFreeformObjectsPerClass) throw new Error(`${label} contains more than ${IMPORT_LIMITS.maxFreeformObjectsPerClass} Freeform objects.`);
  });
  const snapshots = document?.format === SAVE_DOCUMENT_FORMAT ? document.appSnapshots || [] : [];
  if (snapshots.length > IMPORT_LIMITS.maxSnapshots) throw new Error(`The selected ${sourceLabel} contains more than ${IMPORT_LIMITS.maxSnapshots} snapshots.`);
  return true;
}

function validateImportDocument(document, sourceLabel = 'file/local save') {
  validateImportStructure(document, sourceLabel);
  validateImportRecordLimits(document, sourceLabel);
  return document;
}

function supportedFormatRequirement() {
  return `${APP_NAME} data schema ${DATA_SCHEMA_VERSION}, or a generation-6 schema ${LEGACY_GROUP_SCHEMA_VERSION} save that can be migrated`;
}

function unsupportedFormatError(sourceLabel, detail = '') {
  const suffix = detail ? ` ${detail}` : '';
  return new Error(`The selected ${sourceLabel} is not a supported ${supportedFormatRequirement()} document.${suffix}`);
}

function readSchemaCompatibility(document, sourceLabel = 'file/local save') {
  const schemaVersion = Number(document?.dataSchemaVersion);
  if (!Number.isInteger(schemaVersion)) throw unsupportedFormatError(sourceLabel, 'A numeric dataSchemaVersion is required.');
  const isLegacyGroupSchema = schemaVersion === LEGACY_GROUP_SCHEMA_VERSION;
  if (schemaVersion < MIN_SUPPORTED_DATA_SCHEMA_VERSION && !isLegacyGroupSchema) {
    throw unsupportedFormatError(sourceLabel, `Schema ${schemaVersion} is older than the minimum supported schema ${MIN_SUPPORTED_DATA_SCHEMA_VERSION}.`);
  }
  const declaredMinimum = document?.minimumReaderSchemaVersion;
  let minimumReaderSchemaVersion;
  if (declaredMinimum === undefined || declaredMinimum === null || declaredMinimum === '') {
    if (isLegacyGroupSchema) minimumReaderSchemaVersion = LEGACY_GROUP_SCHEMA_VERSION;
    else if (schemaVersion !== MIN_SUPPORTED_DATA_SCHEMA_VERSION) {
      throw unsupportedFormatError(sourceLabel, `Schema ${schemaVersion} must declare minimumReaderSchemaVersion before an older reader can open it.`);
    } else minimumReaderSchemaVersion = MIN_SUPPORTED_DATA_SCHEMA_VERSION;
  } else {
    minimumReaderSchemaVersion = Number(declaredMinimum);
  }
  if (!Number.isInteger(minimumReaderSchemaVersion) || minimumReaderSchemaVersion < 1 || minimumReaderSchemaVersion > schemaVersion) {
    throw unsupportedFormatError(sourceLabel, 'minimumReaderSchemaVersion must be a positive integer no greater than dataSchemaVersion.');
  }
  if (minimumReaderSchemaVersion > DATA_SCHEMA_VERSION) {
    throw unsupportedFormatError(sourceLabel, `Schema ${schemaVersion} requires reader schema ${minimumReaderSchemaVersion}, but this application reads through schema ${DATA_SCHEMA_VERSION}.`);
  }
  return { schemaVersion, minimumReaderSchemaVersion, isFutureSchema: schemaVersion > DATA_SCHEMA_VERSION };
}

function assertEnvelopePayloadCompatibility(envelope, payload, sourceLabel = 'encrypted data') {
  if (!envelope || !payload) throw unsupportedFormatError(sourceLabel, 'The encrypted wrapper or decrypted payload is missing.');
  if (String(envelope.version || '') !== String(payload.version || '')) {
    throw unsupportedFormatError(sourceLabel, 'The encrypted wrapper application version does not match the decrypted payload.');
  }
  const outer = readSchemaCompatibility(envelope, `${sourceLabel} envelope`);
  const inner = readSchemaCompatibility(payload, `${sourceLabel} payload`);
  if (outer.schemaVersion !== inner.schemaVersion || outer.minimumReaderSchemaVersion !== inner.minimumReaderSchemaVersion) {
    throw unsupportedFormatError(sourceLabel, 'The encrypted wrapper schema compatibility metadata does not match the decrypted payload.');
  }
  return payload;
}

function assertSupportedPayloadMetadata(document, sourceLabel = 'file/local save', expectedFormat = '') {
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw unsupportedFormatError(sourceLabel, 'The document root must be an object.');
  if (expectedFormat && document.format !== expectedFormat) throw unsupportedFormatError(sourceLabel, `Expected format ${expectedFormat}.`);
  if (document.app !== APP_NAME) throw unsupportedFormatError(sourceLabel, `Expected application name “${APP_NAME}”.`);
  if (!String(document.version || '').trim()) throw unsupportedFormatError(sourceLabel, 'The producing application version is missing.');
  readSchemaCompatibility(document, sourceLabel);
  if (Number(document.encryptionEnvelopeVersion) !== ENCRYPTION_ENVELOPE_VERSION) throw unsupportedFormatError(sourceLabel, `Expected encryption envelope ${ENCRYPTION_ENVELOPE_VERSION}, received ${String(document.encryptionEnvelopeVersion ?? 'missing')}.`);
  return document;
}

function isSupportedBrowserStorageMarker(document, expectedKey = '') {
  try {
    if (!(document
          && document.format === BROWSER_STORAGE_MARKER_FORMAT
          && document.app === APP_NAME
          && String(document.version || '').trim()
          && document.indexedDb === true
          && document.database === APP_DATABASE_NAME
          && (!expectedKey || document.key === expectedKey))) return false;
    readSchemaCompatibility(document, 'browser storage marker');
    return true;
  } catch (error) {
    return false;
  }
}

function supportedStoredPayloadIsEncrypted(rawValue, expectedKey = '', expectedPayloadKind = '') {
  const raw = String(rawValue || '');
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (isSupportedBrowserStorageMarker(parsed, expectedKey)) {
      if (expectedKey === APP_SNAPSHOT_INDEX_KEY) return parsed.encrypted === true && parsed.snapshotIndexEncrypted === true;
      return parsed.encrypted === true;
    }
    assertSupportedEncryptedEnvelope(parsed, expectedKey === APP_SNAPSHOT_INDEX_KEY ? 'snapshot index' : 'browser save', expectedPayloadKind);
    return true;
  } catch (_) {
    return false;
  }
}

function assertRequiredSupportedFields(record, fields, sourceLabel) {
  const missing = fields.filter(field => !Object.prototype.hasOwnProperty.call(record, field));
  if (missing.length) throw unsupportedFormatError(sourceLabel, `Missing required current field${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`);
  return record;
}

function assertSupportedClassRecord(record, sourceLabel = 'class record') {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw unsupportedFormatError(sourceLabel, 'The class record must be an object.');
  assertRequiredSupportedFields(record, [
    'id','name','students','groups','rows','cols','cells','layoutMode','freeformLayout','customObjects','zones','snapshots',
    'chartMeta','rosterArchive','todaySession','seatingPlans','importProfiles','archived','academicYear','term','createdAt','updatedAt'
  ], sourceLabel);
  if (!String(record.id || '').trim() || !String(record.name || '').trim()) throw unsupportedFormatError(sourceLabel, 'The class ID and name are required.');
  for (const field of ['students','groups','customObjects','zones','snapshots','rosterArchive','seatingPlans','importProfiles']) {
    if (!Array.isArray(record[field])) throw unsupportedFormatError(sourceLabel, `${field} must be an array.`);
  }
  if (!Number.isInteger(Number(record.rows)) || !Number.isInteger(Number(record.cols))) throw unsupportedFormatError(sourceLabel, 'Room rows and columns must be integers.');
  if (!record.cells || typeof record.cells !== 'object' || Array.isArray(record.cells)) throw unsupportedFormatError(sourceLabel, 'Room cells must be an object.');
  if (!['grid','freeform'].includes(record.layoutMode)) throw unsupportedFormatError(sourceLabel, 'layoutMode must be grid or freeform.');
  if (!record.freeformLayout || typeof record.freeformLayout !== 'object' || Array.isArray(record.freeformLayout)) throw unsupportedFormatError(sourceLabel, 'freeformLayout must be a current layout object.');
  if (!record.chartMeta || typeof record.chartMeta !== 'object' || Array.isArray(record.chartMeta)) throw unsupportedFormatError(sourceLabel, 'chartMeta must be an object.');
  if (!record.todaySession || typeof record.todaySession !== 'object' || Array.isArray(record.todaySession)) throw unsupportedFormatError(sourceLabel, 'todaySession must be an object.');
  record.students.forEach((student, index) => {
    if (!student || typeof student !== 'object' || Array.isArray(student) || !String(student.id || '').trim()) throw unsupportedFormatError(sourceLabel, `Student ${index + 1} is missing a current student record and ID.`);
  });
  return record;
}

function assertSupportedClassSnapshot(snapshot, sourceLabel = 'class snapshot') {
  assertSupportedPayloadMetadata(snapshot, sourceLabel, CLASS_SNAPSHOT_FORMAT);
  if (!snapshot.id || !snapshot.data || typeof snapshot.data !== 'object' || Array.isArray(snapshot.data)) throw unsupportedFormatError(sourceLabel, 'The class snapshot record is incomplete.');
  return snapshot;
}

function assertSupportedAppSnapshotRecord(snapshot, sourceLabel = 'snapshot') {
  assertSupportedPayloadMetadata(snapshot, sourceLabel, SNAPSHOT_RECORD_FORMAT);
  if (!snapshot.id || typeof snapshot.data !== 'string' || !snapshot.data) throw unsupportedFormatError(sourceLabel, 'The snapshot record is incomplete.');
  let inner;
  try {
    inner = JSON.parse(snapshot.data);
  } catch (error) {
    throw unsupportedFormatError(sourceLabel, 'The snapshot payload is not valid JSON.');
  }
  if (inner?.encrypted) assertSupportedEncryptedEnvelope(inner, `${sourceLabel} payload`, 'snapshot');
  else {
    migrateLegacyGroupTerminologyDocument(inner);
    snapshot.data = JSON.stringify(inner);
    assertSupportedSnapshotDocument(inner, `${sourceLabel} payload`);
  }
  return snapshot;
}

function assertSupportedSnapshotDocument(document, sourceLabel = 'snapshot') {
  assertSupportedPayloadMetadata(document, sourceLabel, SNAPSHOT_DOCUMENT_FORMAT);
  assertRequiredSupportedFields(document, ['createdAt','classes','activeClassId','roomTemplates','pageSettings','ui'], sourceLabel);
  if (!Array.isArray(document.classes) || !document.classes.length) throw unsupportedFormatError(sourceLabel, 'The snapshot contains no classes.');
  document.classes.forEach((record, index) => assertSupportedClassRecord(record, `${sourceLabel}, class ${index + 1}`));
  if (!document.classes.some(record => String(record.id) === String(document.activeClassId))) throw unsupportedFormatError(sourceLabel, 'The snapshot active class reference is invalid.');
  if (!Array.isArray(document.roomTemplates)) throw unsupportedFormatError(sourceLabel, 'The snapshot roomTemplates field must be an array.');
  return document;
}

function assertSupportedSnapshotIndex(document, sourceLabel = 'snapshot index') {
  assertSupportedPayloadMetadata(document, sourceLabel, SNAPSHOT_INDEX_FORMAT);
  if (!Array.isArray(document.snapshots)) throw unsupportedFormatError(sourceLabel, 'The snapshot index is incomplete.');
  document.snapshots.forEach((snapshot, index) => assertSupportedAppSnapshotRecord(snapshot, `${sourceLabel} item ${index + 1}`));
  return document;
}

function validateEncryptionEnvelopeParameters(encryption, sourceLabel = 'encrypted data') {
  if (!encryption || typeof encryption !== 'object' || Array.isArray(encryption)) throw unsupportedFormatError(sourceLabel, 'The encryption parameters are missing.');
  if (encryption.algorithm !== 'AES-GCM' || encryption.kdf !== 'PBKDF2-SHA-256') throw unsupportedFormatError(sourceLabel, 'The encryption algorithm or key derivation is not current.');
  validatedPbkdf2IterationCount(encryption.iterations, sourceLabel, DEFAULT_PAGE_SETTINGS.pbkdf2Iterations);
  for (const [field, maximumLength] of [['salt', 64], ['iv', 64], ['ciphertext', Math.ceil(IMPORT_LIMITS.saveBytes * 4 / 3) + 16]]) {
    if (typeof encryption[field] !== 'string' || !encryption[field] || encryption[field].length > maximumLength) {
      throw encryptionEnvelopeError(`The ${sourceLabel} contains invalid ${field} data.`);
    }
  }
  let salt;
  let iv;
  let ciphertext;
  try {
    salt = base64ToBytes(encryption.salt);
    iv = base64ToBytes(encryption.iv);
    ciphertext = base64ToBytes(encryption.ciphertext);
  } catch (error) {
    throw encryptionEnvelopeError(`The ${sourceLabel} contains damaged Base64 encryption data.`, 'INVALID_ENCRYPTION_ENVELOPE', error);
  }
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17 || ciphertext.length > IMPORT_LIMITS.saveBytes) {
    throw encryptionEnvelopeError(`The ${sourceLabel} contains incomplete or oversized encryption data.`);
  }
  return { salt, iv, ciphertext };
}

function assertSupportedEncryptedEnvelope(document, sourceLabel = 'encrypted data', expectedPayloadKind = '') {
  assertSupportedPayloadMetadata(document, sourceLabel, ENCRYPTED_ENVELOPE_FORMAT);
  assertRequiredSupportedFields(document, ['exportedAt','encrypted','exportScope','payloadKind','encryption'], sourceLabel);
  if (document.encrypted !== true || !document.encryption || typeof document.encryption !== 'object' || Array.isArray(document.encryption)) throw unsupportedFormatError(sourceLabel, 'The encryption envelope is incomplete.');
  assertRequiredSupportedFields(document.encryption, ['algorithm','kdf','iterations','salt','iv','ciphertext'], sourceLabel);
  validateEncryptionEnvelopeParameters(document.encryption, sourceLabel);
  if (expectedPayloadKind && document.payloadKind !== expectedPayloadKind) throw unsupportedFormatError(sourceLabel, `Expected encrypted payload kind ${expectedPayloadKind}.`);
  return document;
}

function assertSupportedComponentExport(document, sourceLabel = 'component export') {
  assertSupportedPayloadMetadata(document, sourceLabel, COMPONENT_EXPORT_FORMAT);
  assertRequiredSupportedFields(document, ['kind','className','exportedAt'], sourceLabel);
  const supportedKinds = new Set(['seating-chart-student-data', 'seating-chart-groups-config', 'seating-chart-room-layouts']);
  if (!supportedKinds.has(document.kind)) throw unsupportedFormatError(sourceLabel, `Unsupported component kind ${String(document.kind || 'missing')}.`);
  if (document.kind === 'seating-chart-student-data' && !Array.isArray(document.students)) throw unsupportedFormatError(sourceLabel, 'Current student-data exports require a students array.');
  if (document.kind === 'seating-chart-groups-config' && (!Array.isArray(document.groups) || !Array.isArray(document.zones))) throw unsupportedFormatError(sourceLabel, 'Current group exports require groups and zones arrays.');
  if (document.kind === 'seating-chart-room-layouts' && (!document.currentRoom || typeof document.currentRoom !== 'object' || !Array.isArray(document.roomTemplates))) throw unsupportedFormatError(sourceLabel, 'Current room exports require currentRoom and roomTemplates data.');
  return document;
}

function assertSupportedSaveDocument(document, sourceLabel = 'save or backup') {
  validateImportDocument(document, sourceLabel);
  assertSupportedPayloadMetadata(document, sourceLabel, SAVE_DOCUMENT_FORMAT);
  assertRequiredSupportedFields(document, ['exportedAt','exportScope','saveIdentity','activeClassId','classes','roomTemplates','appSnapshots','pageSettings','preferences'], sourceLabel);
  if (!Array.isArray(document.classes) || !document.classes.length) throw unsupportedFormatError(sourceLabel, 'The save contains no classes.');
  if (!document.activeClassId || !document.classes.some(cls => String(cls?.id || '') === String(document.activeClassId))) throw unsupportedFormatError(sourceLabel, 'The active class reference is missing or invalid.');
  if (!Array.isArray(document.roomTemplates) || !Array.isArray(document.appSnapshots)) throw unsupportedFormatError(sourceLabel, 'roomTemplates and appSnapshots must be arrays.');
  if (!document.pageSettings || typeof document.pageSettings !== 'object' || Array.isArray(document.pageSettings)) throw unsupportedFormatError(sourceLabel, 'pageSettings must be an object.');
  if (!document.preferences || typeof document.preferences !== 'object' || Array.isArray(document.preferences)) throw unsupportedFormatError(sourceLabel, 'preferences must be an object.');
  if (!document.saveIdentity || typeof document.saveIdentity !== 'object' || Array.isArray(document.saveIdentity)) throw unsupportedFormatError(sourceLabel, 'saveIdentity must be an object.');
  assertRequiredSupportedFields(document.saveIdentity, ['saveId','revisionNumber','parentRevision','deviceId','createdAt','modifiedAt','contentHash'], `${sourceLabel} saveIdentity`);
  document.classes.forEach((cls, classIndex) => {
    assertSupportedClassRecord(cls, `${sourceLabel}, class ${classIndex + 1}`);
    cls.snapshots.forEach((snapshot, snapshotIndex) => assertSupportedClassSnapshot(snapshot, `${sourceLabel}, class ${classIndex + 1}, snapshot ${snapshotIndex + 1}`));
  });
  document.appSnapshots.forEach((snapshot, index) => assertSupportedAppSnapshotRecord(snapshot, `${sourceLabel}, full-app snapshot ${index + 1}`));
  return document;
}

async function parseSupportedPayloadText(text, sourceLabel = 'file/local save', { allowComponents = false } = {}) {
  assertImportTextWithinLimits(text, sourceLabel);
  let parsed = JSON.parse(text);
  let encrypted = false;
  let envelope = null;
  if (parsed?.encrypted) {
    envelope = assertSupportedEncryptedEnvelope(parsed, sourceLabel);
    const decryptedText = await decryptEncryptedPayloadUsingActiveKeyFirst(parsed, sourceLabel);
    assertImportTextWithinLimits(decryptedText, `${sourceLabel} after decryption`);
    parsed = JSON.parse(decryptedText);
    encrypted = true;
  }
  const isSave = parsed?.format === SAVE_DOCUMENT_FORMAT;
  const isComponent = allowComponents && parsed?.format === COMPONENT_EXPORT_FORMAT;
  if (!isSave && !isComponent) {
    throw unsupportedFormatError(sourceLabel, allowComponents ? 'Expected a supported full save or supported component export.' : 'Expected a supported full save.');
  }
  validateImportDocument(parsed, sourceLabel);
  if (envelope) assertEnvelopePayloadCompatibility(envelope, parsed, sourceLabel);
  await verifyBackupManifest(parsed, sourceLabel);
  migrateLegacyGroupTerminologyDocument(parsed);
  if (isSave) assertSupportedSaveDocument(parsed, sourceLabel);
  else assertSupportedComponentExport(parsed, sourceLabel);
  return { parsed, encrypted };
}

function loadDismissedHintKeys() {
  try {
    const parsed = JSON.parse(safeStorageGet('localStorage', HINT_DISMISS_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : []);
  } catch (err) {
    return new Set();
  }
}

function saveDismissedHintKeys(keys) {
  safeStorageSet('localStorage', HINT_DISMISS_STORAGE_KEY, JSON.stringify(Array.from(keys || [])));
}

function hintText(node) {
  if (!node) return '';
  return Array.from(node.childNodes)
    .filter(child => !(child.nodeType === Node.ELEMENT_NODE && child.classList?.contains('hint-close')))
    .map(child => child.textContent || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hintKey(node) {
  if (!node) return '';
  if (node.id) return `hint-id-${node.id}`;
  const parentId = node.closest?.('[id]')?.id || 'document';
  return `hint-${hashString(`${parentId}|${hintText(node)}`)}`;
}

function enhanceHints(root = document) {
  const dismissed = loadDismissedHintKeys();
  const hints = Array.from((root || document).querySelectorAll?.('.hint') || []);
  hints.forEach(hint => {
    const text = hintText(hint);
    if (!text) return;
    const key = hintKey(hint);
    hint.dataset.hintKey = key;
    hint.classList.add('dismissible-hint');
    hint.classList.toggle('hint-dismissed', dismissed.has(key));
    const hasButton = Array.from(hint.children).some(child => child.classList?.contains('hint-close'));
    if (!hasButton) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hint-close icon-button';
      button.setAttribute('aria-label', 'Close hint');
      button.setAttribute('title', 'Close this hint');
      button.textContent = '×';
      hint.appendChild(button);
    }
  });
}

let hintEnhanceQueued = false;
function queueEnhanceHints(root = document) {
  if (hintEnhanceQueued) return;
  hintEnhanceQueued = true;
  requestAnimationFrame(() => {
    hintEnhanceQueued = false;
    enhanceHints(root);
  });
}

function dismissHint(node) {
  const hint = node?.closest?.('.hint');
  if (!hint) return;
  const key = hint.dataset.hintKey || hintKey(hint);
  const dismissed = loadDismissedHintKeys();
  dismissed.add(key);
  saveDismissedHintKeys(dismissed);
  hint.classList.add('hint-dismissed');
}

function resetDismissedHints() {
  safeStorageRemove('localStorage', HINT_DISMISS_STORAGE_KEY);
  document.querySelectorAll('.hint.hint-dismissed').forEach(hint => hint.classList.remove('hint-dismissed'));
  queueEnhanceHints();
  setLiveStatusMessage('Closed text hints reset. Tiny educational popups are once again permitted to exist.');
}

function installHintDismissalSupport() {
  document.body.addEventListener('click', event => {
    const closeButton = event.target.closest?.('.hint-close');
    if (!closeButton) return;
    event.preventDefault();
    event.stopPropagation();
    dismissHint(closeButton);
  });
  const observer = new MutationObserver(records => {
    const hintChanged = records.some(record => {
      const targetElement = record.target instanceof Element ? record.target : record.target?.parentElement;
      if (targetElement?.closest?.('.hint')) return true;
      return Array.from(record.addedNodes || []).some(node =>
        node instanceof Element && (node.matches('.hint') || Boolean(node.querySelector('.hint')))
      );
    });
    if (hintChanged) queueEnhanceHints();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  enhanceHints(document);
}

function gridViewScale() {
  return clampNumber(pageSettings().gridViewZoom ?? 100, 35, 175) / 100;
}

function seatTextScale() {
  return clampNumber(pageSettings().seatTextScale ?? 100, 70, 200) / 100;
}

function currentSeatViewZoomPercent() {
  if (state.layoutMode === 'freeform') return Math.round(clampNumber(state.freeformLayout?.canvas?.zoom ?? 1, 0.35, 1.75) * 100);
  return Math.round(clampNumber(pageSettings().gridViewZoom ?? 100, 35, 175));
}

function syncSeatDisplayControls() {
  const zoom = currentSeatViewZoomPercent();
  const textPercent = Math.round(clampNumber(pageSettings().seatTextScale ?? 100, 70, 200));
  const zoomSlider = el('seatViewZoomSlider');
  const zoomValue = el('seatViewZoomValue');
  const textSlider = el('seatTextSizeSlider');
  const textValue = el('seatTextSizeValue');
  if (zoomSlider && document.activeElement !== zoomSlider) zoomSlider.value = String(zoom);
  if (zoomValue) zoomValue.textContent = `${zoom}%`;
  if (textSlider && document.activeElement !== textSlider) textSlider.value = String(textPercent);
  if (textValue) textValue.textContent = `${textPercent}%`;
  document.body.style.setProperty('--seat-text-scale', String(textPercent / 100));
}

function setSeatViewZoom(value, { announce = false } = {}) {
  const percent = clampNumber(value, 35, 175);
  if (state.layoutMode === 'freeform') {
    ensureFreeformLayout();
    state.freeformLayout.canvas.zoom = percent / 100;
    persistFreeformGeometrySession('seat-view-zoom');
    persistActiveClass();
    scheduleLinkedAutoSave('seat-view-zoom');
    renderFreeformLayout();
  } else {
    uiState.pageSettings = mergePageSettings({ ...pageSettings(), gridViewZoom: percent });
    schedulePageSettingsPersistence('grid-view-zoom');
    renderGrid();
  }
  syncSeatDisplayControls();
  if (announce) setLiveStatusMessage(`Seat and room zoom set to ${Math.round(percent)}%.`);
}

function setSeatTextScale(value, { announce = false } = {}) {
  const percent = clampNumber(value, 70, 200);
  uiState.pageSettings = mergePageSettings({ ...pageSettings(), seatTextScale: percent });
  document.body.style.setProperty('--seat-text-scale', String(percent / 100));
  schedulePageSettingsPersistence('seat-text-scale');
  syncSeatDisplayControls();
  if (announce) setLiveStatusMessage(`Seat text size set to ${Math.round(percent)}%.`);
}

function syncMobileRoomPanUi() {
  const mobile = isMobileViewport();
  if (!mobile) {
    uiState.mobileRoomPanActive = false;
    uiState.mobileRoomPanPointer = null;
  }
  document.body.classList.toggle('mobile-room-pan-mode', mobile && !!uiState.mobileRoomPanActive);
  const button = el('mobileRoomPanBtn');
  if (!button) return;
  button.hidden = !mobile;
  const active = mobile && !!uiState.mobileRoomPanActive;
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  button.textContent = active ? 'Pan: On' : 'Pan room';
  button.title = active
    ? 'Drag anywhere in the room to move the viewport. Turn Pan off to edit seats or room objects.'
    : 'Turn Pan on to drag around a room that is larger than the mobile screen.';
}

function setMobileRoomPanActive(active, { announce = false } = {}) {
  uiState.mobileRoomPanActive = Boolean(active && isMobileViewport());
  uiState.mobileRoomPanPointer = null;
  syncMobileRoomPanUi();
  if (announce) {
    setLiveStatusMessage(uiState.mobileRoomPanActive
      ? 'Room Pan is on. Drag anywhere in the room to move around without editing seats or objects.'
      : 'Room Pan is off. Normal seat and room interactions are available.');
  }
}

function toggleMobileRoomPan() {
  setMobileRoomPanActive(!uiState.mobileRoomPanActive, { announce: true });
}

function beginMobileRoomPan(event) {
  if (!uiState.mobileRoomPanActive || !isMobileViewport() || event.button !== 0 || event.isPrimary === false) return;
  const scroller = event.currentTarget;
  if (!(scroller instanceof HTMLElement) || event.target.closest('.freeform-minimap')) return;
  uiState.mobileRoomPanPointer = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: scroller.scrollLeft,
    scrollTop: scroller.scrollTop,
    moved: false,
    scroller
  };
  scroller.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopImmediatePropagation();
}

function moveMobileRoomPan(event) {
  const pan = uiState.mobileRoomPanPointer;
  if (!pan || event.pointerId !== pan.pointerId) return;
  const deltaX = event.clientX - pan.startX;
  const deltaY = event.clientY - pan.startY;
  if (!pan.moved && Math.hypot(deltaX, deltaY) >= 4) pan.moved = true;
  pan.scroller.scrollLeft = Math.max(0, pan.scrollLeft - deltaX);
  pan.scroller.scrollTop = Math.max(0, pan.scrollTop - deltaY);
  event.preventDefault();
  event.stopImmediatePropagation();
}

function finishMobileRoomPan(event) {
  const pan = uiState.mobileRoomPanPointer;
  if (!pan || event.pointerId !== pan.pointerId) return;
  pan.scroller.releasePointerCapture?.(event.pointerId);
  if (pan.moved) {
    uiState.skipNextCellClick = true;
    uiState.suppressFreeformCanvasClick = true;
    setTimeout(() => {
      uiState.skipNextCellClick = false;
      uiState.suppressFreeformCanvasClick = false;
    }, 80);
  }
  uiState.mobileRoomPanPointer = null;
  event.preventDefault();
  event.stopImmediatePropagation();
}

function installMobileRoomPanHandlers() {
  const scroller = el('seatGrid')?.closest('.grid-wrap');
  if (!scroller || scroller.dataset.mobileRoomPanInstalled === 'true') return;
  scroller.dataset.mobileRoomPanInstalled = 'true';
  scroller.addEventListener('pointerdown', beginMobileRoomPan, true);
  scroller.addEventListener('pointermove', moveMobileRoomPan, true);
  scroller.addEventListener('pointerup', finishMobileRoomPan, true);
  scroller.addEventListener('pointercancel', finishMobileRoomPan, true);
}

const normalCellFloor = () => Math.round(142 * gridViewScale());
const designCellWidth = () => clampNumber(uiState.designCellSize || 28, 20, 72);
const designCellHeight = () => Math.max(26, Math.round(designCellWidth() * 1.32));


function mobilePanelsForWorkflow(workflow = document.body.dataset.workflow || 'setup') {
  if (uiState.visibilityMode) return ['layout'];
  if (workflow === 'seating') return ['layout', 'people'];
  if (workflow === 'review') return ['layout', 'status'];
  return [];
}

function syncMobilePanelNavigation(preferredPanel = uiState.mobileActivePanel || 'layout') {
  const mobile = isMobileViewport();
  const allowedPanels = mobile ? mobilePanelsForWorkflow() : [];
  const panel = allowedPanels.includes(preferredPanel) ? preferredPanel : (allowedPanels[0] || 'layout');
  const switcherVisible = mobile && allowedPanels.length > 1;
  uiState.mobileActivePanel = panel;
  document.body.classList.toggle('mobile-view-layout', mobile && panel === 'layout');
  document.body.classList.toggle('mobile-view-people', mobile && panel === 'people');
  document.body.classList.toggle('mobile-view-status', mobile && panel === 'status');
  document.body.classList.toggle('mobile-panel-switcher-active', switcherVisible);
  const nav = el('mobilePanelNav');
  if (nav) nav.hidden = !switcherVisible;
  document.querySelectorAll('[data-mobile-panel]').forEach(button => {
    const available = allowedPanels.includes(button.dataset.mobilePanel);
    const active = available && button.dataset.mobilePanel === panel;
    button.hidden = !available;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.tabIndex = available ? 0 : -1;
  });
  return panel;
}

function setMobilePanel(panelName = 'layout') {
  const validPanels = new Set(['layout', 'people', 'status']);
  const requestedPanel = validPanels.has(panelName) ? panelName : 'layout';
  const panel = syncMobilePanelNavigation(requestedPanel);
  if (typeof updateMobileCarryUi === 'function') updateMobileCarryUi();
  syncMobileRoomPanUi();
  return panel;
}

function isMobileViewport() {
  return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
}

function refreshLayoutToolsToggle() {
  const button = el('toggleLayoutToolsBtn');
  if (!button) return;
  const collapsed = document.body.classList.contains('layout-tools-collapsed');
  button.textContent = collapsed ? '▾' : '▴';
  button.dataset.mobileLabel = collapsed ? 'Layout tools' : 'Hide tools';
  button.setAttribute('aria-label', collapsed ? 'Expand layout tools' : 'Collapse layout tools');
  button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
}

function applyMobileLayoutToolsPreference(workflow = document.body.dataset.workflow || '') {
  if (!isMobileViewport() || workflow !== 'room') return;
  const stored = safeStorageGet('sessionStorage', 'seatingPlannerMobileLayoutTools');
  const collapsed = stored === 'expanded' ? false : true;
  document.body.classList.toggle('layout-tools-collapsed', collapsed);
  refreshLayoutToolsToggle();
}

function normalizedGridInputValue(id, fallback) {
  return Math.max(1, Math.min(30, Number(el(id)?.value) || Number(fallback) || 1));
}

function syncGridResizeControls() {
  const active = Boolean(uiState.gridResizeModeActive && state.layoutMode === 'grid');
  const nextRows = normalizedGridInputValue('rowsInput', state.rows || 5);
  const nextCols = normalizedGridInputValue('colsInput', state.cols || 6);
  const changed = nextRows !== Number(state.rows) || nextCols !== Number(state.cols);
  uiState.gridResizeDirty = active && changed;
  document.body.classList.toggle('grid-resize-mode', active);

  const button = el('buildGridBtn');
  if (button) {
    button.textContent = active ? 'Apply Grid Size' : 'Build/Resize Grid';
    button.classList.toggle('active-tool', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.title = active
      ? 'Apply the pending row and column values to the room grid.'
      : 'Enter grid resize mode, then change rows or columns and apply the new size.';
  }

  const cancel = el('cancelGridResizeBtn');
  if (cancel) cancel.hidden = !active;

  const status = el('gridResizeStatus');
  if (status) {
    status.textContent = active
      ? changed
        ? `Pending: ${nextRows} rows × ${nextCols} columns. Current: ${state.rows} × ${state.cols}.`
        : `Resize mode active. Current grid: ${state.rows} rows × ${state.cols} columns.`
      : `Current grid: ${state.rows} rows × ${state.cols} columns`;
  }
}

function enterGridResizeMode({ announce = true } = {}) {
  if (state.layoutMode !== 'grid') {
    setLiveStatusMessage('Switch to Standard Grid before changing rows or columns.');
    return false;
  }
  if (eyeModeBlocksRoomEditing()) {
    blockEyeModeAction('room');
    return false;
  }
  if (!uiState.gridResizeModeActive) {
    uiState.gridResizeModeActive = true;
    uiState.gridResizeOriginalRows = Number(state.rows) || 5;
    uiState.gridResizeOriginalCols = Number(state.cols) || 6;
  }
  document.body.classList.remove('layout-tools-collapsed');
  refreshLayoutToolsToggle();
  syncGridResizeControls();
  if (announce) setLiveStatusMessage('Grid resize mode is active. Change Rows or Columns, then choose Apply Grid Size.');
  return true;
}

function cancelGridResizeMode({ announce = true } = {}) {
  const wasActive = uiState.gridResizeModeActive;
  uiState.gridResizeModeActive = false;
  uiState.gridResizeDirty = false;
  uiState.gridResizeOriginalRows = null;
  uiState.gridResizeOriginalCols = null;
  if (el('rowsInput')) el('rowsInput').value = String(state.rows);
  if (el('colsInput')) el('colsInput').value = String(state.cols);
  syncGridResizeControls();
  if (announce && wasActive) setLiveStatusMessage('Grid resize canceled. The room size was not changed.');
}

function applyGridResizeFromInputs() {
  if (!uiState.gridResizeModeActive) return enterGridResizeMode();
  if (state.layoutMode !== 'grid') {
    cancelGridResizeMode({ announce: false });
    setLiveStatusMessage('Switch to Standard Grid before changing rows or columns.');
    return false;
  }
  if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
  const nextRows = normalizedGridInputValue('rowsInput', state.rows || 5);
  const nextCols = normalizedGridInputValue('colsInput', state.cols || 6);
  const changed = nextRows !== Number(state.rows) || nextCols !== Number(state.cols);
  if (!changed) {
    cancelGridResizeMode({ announce: false });
    setLiveStatusMessage(`Grid remains ${state.rows} rows by ${state.cols} columns.`);
    return true;
  }

  pushUndoSnapshot(`Before resizing grid to ${nextRows}×${nextCols}`);
  state.rows = nextRows;
  state.cols = nextCols;
  ensureGrid();
  uiState.gridResizeModeActive = false;
  uiState.gridResizeDirty = false;
  uiState.gridResizeOriginalRows = null;
  uiState.gridResizeOriginalCols = null;
  renderAll();
  syncGridResizeControls();
  setLiveStatusMessage(`Grid resized to ${nextRows} rows by ${nextCols} columns. Undo is available.`);
  return true;
}

function refreshNamesOnlyToggle() {
  document.body.classList.toggle('names-only-layout', !!uiState.namesOnlyLayout);
  const button = el('layoutNamesOnlyBtn');
  if (button) {
    button.setAttribute('aria-pressed', uiState.namesOnlyLayout ? 'true' : 'false');
    button.textContent = uiState.namesOnlyLayout ? 'Names Only: On' : 'Names Only';
  }
}

function refreshUnassignedSeatTitlesToggle() {
  const hidden = !!pageSettings().hideUnassignedSeatTitles;
  document.body.classList.toggle('hide-unassigned-seat-titles', hidden);
  const button = el('hideUnassignedTitlesBtn');
  if (!button) return;
  button.setAttribute('aria-pressed', hidden ? 'true' : 'false');
  button.textContent = hidden ? 'Show Empty Titles' : 'Hide Empty Titles';
  button.title = hidden
    ? 'Show the Drop student here and Unassigned titles on empty seats.'
    : 'Hide the Drop student here and Unassigned titles on empty seats while keeping the seats usable.';
}

function refreshHeaderToggle() {
  const button = el('toggleHeaderBtn');
  if (!button) return;
  const collapsed = document.body.classList.contains('header-collapsed');
  button.textContent = collapsed ? '▾' : '▴';
  button.setAttribute('aria-label', collapsed ? 'Expand header' : 'Collapse header');
  button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
}

function refreshPanelToggleButtons() {
  const left = document.body.classList.contains('left-collapsed');
  const leftBtn = el('toggleLeftPanelBtn');
  if (leftBtn) {
    leftBtn.textContent = left ? '▸' : '◂';
    leftBtn.setAttribute('aria-label', left ? 'Expand Students, Groups & Zones panel' : 'Collapse Students, Groups & Zones panel');
    leftBtn.setAttribute('aria-expanded', left ? 'false' : 'true');
  }
  const right = document.body.classList.contains('right-collapsed');
  const rightBtn = el('toggleRightPanelBtn');
  if (rightBtn) {
    rightBtn.textContent = right ? '◂' : '▸';
    rightBtn.setAttribute('aria-label', right ? 'Expand Chart Status panel' : 'Collapse Chart Status panel');
    rightBtn.setAttribute('aria-expanded', right ? 'false' : 'true');
  }
}

function setCsvCollapsed(collapsed) {
  const body = el('csvImportBody');
  const btn = el('toggleCsvImportBtn');
  if (!body || !btn) return;
  body.classList.toggle('collapsed', !!collapsed);
  btn.textContent = collapsed ? '▾' : '▴';
  btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
}

function ensureAddStudentCollapseUi() {
  const panel = el('studentsSideTabPanel');
  if (!panel || panel.dataset.addStudentWrapped === 'true') return;
  const sections = Array.from(panel.querySelectorAll(':scope > section.section'));
  const section = sections.find(item => item.querySelector('h3')?.textContent?.trim() === 'Add Student');
  if (!section) return;
  panel.dataset.addStudentWrapped = 'true';
  const heading = section.querySelector('h3');
  const header = document.createElement('div');
  header.className = 'section-header-row';
  const title = document.createElement('h3');
  title.textContent = 'Add Student';
  const button = document.createElement('button');
  button.id = 'toggleAddStudentBtn';
  button.className = 'tiny secondary icon-button no-print';
  button.type = 'button';
  button.title = 'Expand or collapse the Add Student panel.';
  button.setAttribute('aria-expanded', 'false');
  header.append(title, button);
  const body = document.createElement('div');
  body.id = 'addStudentBody';
  body.className = 'add-student-body';
  heading.replaceWith(header);
  while (header.nextSibling) body.appendChild(header.nextSibling);
  section.appendChild(body);
  button.addEventListener('click', () => {
    uiState.addStudentCollapsed = !body.classList.contains('collapsed');
    refreshAddStudentCollapse();
  });
}

function refreshAddStudentCollapse() {
  ensureAddStudentCollapseUi();
  const body = el('addStudentBody');
  const btn = el('toggleAddStudentBtn');
  if (!body || !btn) return;
  if (!state.students.length && !isMobileViewport()) uiState.addStudentCollapsed = false;
  if (typeof uiState.addStudentCollapsed !== 'boolean') uiState.addStudentCollapsed = !!pageSettings().addStudentCollapsed;
  const collapsed = !!uiState.addStudentCollapsed && (state.students.length > 0 || isMobileViewport());
  body.classList.toggle('collapsed', collapsed);
  const section = body.closest('.class-setup-student-form-card');
  const workspace = body.closest('.class-setup-students-main');
  section?.classList.toggle('add-student-panel-collapsed', collapsed);
  workspace?.classList.toggle('add-student-panel-collapsed', collapsed);
  btn.textContent = collapsed ? '▸' : '◂';
  btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  btn.setAttribute('aria-label', collapsed ? 'Expand Add Student panel' : 'Collapse Add Student panel');
  btn.title = collapsed ? 'Expand the Add Student panel.' : 'Collapse the Add Student panel to give the roster more room.';
}

function applyPageLoadDefaults(cfg) {
  uiState.namesOnlyLayout = !!cfg.defaultNamesOnly;
  uiState.designCellSize = clampNumber(cfg.designCellSize, 20, 72);
  uiState.addStudentCollapsed = !!cfg.addStudentCollapsed;

  const productWorkspace = document.body.classList.contains('product-v4');
  if (productWorkspace) {
     
     
    document.body.classList.remove('header-collapsed', 'left-collapsed', 'right-collapsed');
    WorkspaceLayoutV41.applyPageLoadDefaults(cfg);
  } else {
    document.body.classList.toggle('header-collapsed', !!cfg.headerCollapsed);
    document.body.classList.toggle('left-collapsed', !!cfg.leftCollapsed);
    document.body.classList.toggle('right-collapsed', !!cfg.rightCollapsed);
  }

  document.body.classList.toggle('layout-tools-collapsed', !!cfg.layoutToolsCollapsed);
  refreshHeaderToggle();
  refreshPanelToggleButtons();
  refreshLayoutToolsToggle();
  refreshNamesOnlyToggle();
  setCsvCollapsed(!!cfg.csvCollapsed);
  applyDesignModeUi();
  refreshAddStudentCollapse();
  setSideTab(uiState.activeSideTab);
}

function applyPageSettings(settings = pageSettings(), options = {}) {
  uiState.pageSettings = mergePageSettings(settings);
  const cfg = pageSettings();
  document.body.dataset.theme = cfg.theme || 'default';
  document.body.classList.toggle('hide-all-hints', !!cfg.hideHints);
  document.body.classList.toggle('hide-object-type-labels', !!cfg.hideObjectTypeLabels);
  document.body.classList.toggle('freeform-clean-view', !!cfg.freeformCleanView);
  document.body.style.setProperty('--seat-text-scale', String(seatTextScale()));
  refreshUnassignedSeatTitlesToggle();
  syncSeatDisplayControls();
  if (options.applyLoadDefaults === true) applyPageLoadDefaults(cfg);
  queueEnhanceHints();
  applyVisibilityClasses();
  resetAutoLockTimer();
  syncSameTabReloadKeyForSettings(cfg);
  if (!options.skipRender && el('seatGrid')) renderGrid();
}

function applyMobileFirstLoadCollapseDefaults() {
  if (document.body.classList.contains('product-v4')) {
    document.body.classList.remove('header-collapsed', 'left-collapsed', 'right-collapsed');
  } else {
    document.body.classList.add('header-collapsed', 'left-collapsed', 'right-collapsed');
  }
  document.body.classList.add('layout-tools-collapsed');
  uiState.addStudentCollapsed = true;
  setCsvCollapsed(true);
  refreshHeaderToggle();
  refreshPanelToggleButtons();
  refreshLayoutToolsToggle();
  refreshAddStudentCollapse();
}

function keepMobileWorkspaceUsable() {
  if (isMobileViewport()) {
    setMobilePanel(uiState.mobileActivePanel || 'layout');
    if (!document.body.classList.contains('mobile-tools-initialized')) {
      document.body.classList.add('mobile-tools-initialized');
    }
    if (uiState.appReady && !document.body.classList.contains('mobile-first-load-collapsed')) {
      document.body.classList.add('mobile-first-load-collapsed');
      applyMobileFirstLoadCollapseDefaults();
    }
  } else {
    syncMobilePanelNavigation('layout');
    setMobileRoomPanActive(false);
  }
  syncMobileRoomPanUi();
  ClassSetupWorkspaceV54?.syncResponsiveCollapsibles?.();
}


function mobileCarryLabel(payload) {
  if (!payload) return '';
  if (payload.type === 'student') {
    const student = getStudent(payload.id);
    return student ? `Place ${studentDisplay(student)}` : 'Place student';
  }
  if (payload.type === 'group') {
    const group = getGroup(payload.id);
    return group ? `Reserve a seat for ${group.name}` : 'Reserve a seat';
  }
  return 'Place item';
}

function mobileCarryPayloadFromTarget(target) {
  if (!isMobileViewport() || uiState.pageLocked || !target) return null;
  if (target.closest?.('#groupManagerModal')) return null;
  if (target.closest?.('button, input, select, textarea, a, .context-menu')) return null;
  const seated = target.closest?.('[data-seat-student-id]');
  if (seated?.dataset?.seatStudentId) return { type: 'student', id: seated.dataset.seatStudentId };
  const studentCard = target.closest?.('.student-card[data-student-id], .group-member-chip[data-student-id], .group-manager-member[data-student-id]');
  if (studentCard?.dataset?.studentId) return { type: 'student', id: studentCard.dataset.studentId };
  const groupCard = target.closest?.('.group-card[data-group-id], .group-manager-group[data-group-id]');
  if (groupCard?.dataset?.groupId) return { type: 'group', id: groupCard.dataset.groupId };
  return null;
}

function mountMobileCarryBanner(banner) {
  if (!banner) return;
  const centerPanel = document.querySelector('main.app > .center-panel');
  const gridWrap = centerPanel ? Array.from(centerPanel.children).find(child => child.classList?.contains('grid-wrap')) : null;
  if (centerPanel && gridWrap) {
    if (banner.parentElement !== centerPanel || banner.nextElementSibling !== gridWrap) centerPanel.insertBefore(banner, gridWrap);
  } else if (banner.parentElement !== document.body) {
    document.body.appendChild(banner);
  }
}

function ensureMobileCarryBanner() {
  let banner = document.getElementById('mobileCarryBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'mobileCarryBanner';
    banner.className = 'mobile-carry-banner no-print';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `
          <div class="mobile-carry-text"><strong id="mobileCarryTitle">Ready to place</strong><span id="mobileCarryHint">Choose a student, then tap a seat.</span></div>
          <button id="mobileCarryCancelBtn" class="secondary tiny" type="button">Cancel</button>
        `;
    banner.querySelector('#mobileCarryCancelBtn')?.addEventListener('click', clearMobileCarryItem);
  }
  mountMobileCarryBanner(banner);
  return banner;
}

function updateMobileCarryUi() {
  const payload = uiState.mobileCarryItem;
  document.body.classList.toggle('mobile-carrying', Boolean(payload));
  const banner = ensureMobileCarryBanner();
  mountMobileCarryBanner(banner);
  const title = banner.querySelector('#mobileCarryTitle');
  const hint = banner.querySelector('#mobileCarryHint');
  if (title) title.textContent = payload ? mobileCarryLabel(payload) : 'Ready to place';
  if (hint) {
    if (!payload) hint.textContent = 'Choose a student or group, then tap a seat.';
    else if (payload.type === 'student') hint.textContent = 'Tap anywhere on a seat. If it is occupied, the students will swap.';
    else hint.textContent = 'Tap anywhere on a seat to reserve it for this group.';
  }
  document.querySelectorAll('.mobile-carry-selected').forEach(item => item.classList.remove('mobile-carry-selected'));
  if (payload?.type === 'student') {
    document.querySelectorAll(`[data-student-id="${cssEscape(payload.id)}"], [data-seat-student-id="${cssEscape(payload.id)}"]`).forEach(item => item.classList.add('mobile-carry-selected'));
  }
  if (payload?.type === 'group') {
    document.querySelectorAll(`[data-group-id="${cssEscape(payload.id)}"]`).forEach(item => item.classList.add('mobile-carry-selected'));
  }
  document.querySelectorAll('.cell.seat, .freeform-object.seat').forEach(seat => {
    seat.classList.toggle('mobile-placement-target', Boolean(payload));
    seat.toggleAttribute('data-mobile-placement-target', Boolean(payload));
  });
}

function setMobileCarryItem(payload) {
  if (!payload || !isMobileViewport()) return false;
  if (payload.type === 'student' && !getStudent(payload.id)) return false;
  if (payload.type === 'group' && !getGroup(payload.id)) return false;
  uiState.mobileCarryItem = { type: payload.type, id: String(payload.id) };
  if (uiState.mobileActivePanel !== 'layout') setMobilePanel('layout');
  updateMobileCarryUi();
  hideMobileActionDrawer();
  setLiveStatusMessage(`${mobileCarryLabel(uiState.mobileCarryItem)} selected. Tap anywhere on a seat.`);
  return true;
}

function clearMobileCarryItem() {
  uiState.mobileCarryItem = null;
  document.querySelectorAll('.mobile-carry-target').forEach(item => item.classList.remove('mobile-carry-target'));
  updateMobileCarryUi();
  hideMobileActionDrawer();
}

function applyMobileCarryToCell(cellKey) {
  const payload = uiState.mobileCarryItem;
  const cell = state.cells[cellKey];
  if (!payload || !cell) return false;
  if (cell.type !== 'seat') {
    setLiveStatusMessage(`${objectLabel(cell.type)} is not an assignable seat. Choose a seat cell.`);
    updateMobileCarryUi();
    return true;
  }
  if (payload.type === 'student') {
    const student = getStudent(payload.id);
    assignStudentToCell(payload.id, cellKey, true, true, {
      onComplete: (placed, reason = '') => {
        if (placed) {
          clearMobileCarryItem();
          if (student) setLiveStatusMessage(`Placed ${studentDisplay(student)} at seat ${cell.row},${cell.col}.`);
        } else {
          updateMobileCarryUi();
          if (student && reason === 'cancelled') setLiveStatusMessage(`Placement canceled. ${studentDisplay(student)} is still selected; tap another seat or Cancel.`);
          else if (student && reason !== 'pending-confirmation') setLiveStatusMessage(`Could not place ${studentDisplay(student)} in that seat. Choose another seat or Cancel.`);
        }
      }
    });
    return true;
  }
  if (payload.type === 'group') {
    const keys = isContextCellSelectionBatch(cellKey) ? selectedCellKeysArray() : [cellKey];
    let changed = 0;
    keys.forEach(key => { if (addGroupAnchorWithoutRender(payload.id, key)) changed += 1; });
    const group = getGroup(payload.id);
    clearMobileCarryItem();
    renderAll();
    setLiveStatusMessage(`Reserved ${changed || 1} seat${(changed || 1) === 1 ? '' : 's'} for group "${group ? group.name : 'Group'}".`);
    return true;
  }
  return false;
}

function applyMobileCarryToFreeformObject(objectId) {
  const payload = uiState.mobileCarryItem;
  const target = (state.freeformLayout?.objects || []).find(obj => String(obj.id) === String(objectId));
  if (!payload || !target) return false;
  if (target.type !== 'seat') {
    setLiveStatusMessage(`${objectLabel(target.type)} is not an assignable seat. Choose a seat object.`);
    updateMobileCarryUi();
    return true;
  }
  if (target.locked) {
    blockLockedSeatEditAction();
    updateMobileCarryUi();
    return true;
  }
  if (payload.type === 'student') {
    const student = getStudent(payload.id);
    assignStudentToFreeformObject(payload.id, target.id, true, true, {
      onComplete: (placed, reason = '') => {
        if (placed) {
          clearMobileCarryItem();
          if (student) setLiveStatusMessage(`${studentDisplay(student)} placed in the selected Freeform seat.`);
        } else {
          updateMobileCarryUi();
          if (student && reason === 'cancelled') setLiveStatusMessage(`Placement canceled. ${studentDisplay(student)} is still selected; tap another seat or Cancel.`);
          else if (student && reason !== 'pending-confirmation') setLiveStatusMessage(`Could not place ${studentDisplay(student)} in that Freeform seat. Choose another seat or Cancel.`);
        }
      }
    });
    return true;
  }
  if (payload.type === 'group') {
    const cellKey = ensureFreeformSeatGridLink(target);
    if (!cellKey) return true;
    addGroupAnchorWithoutRender(payload.id, cellKey);
    mirrorLinkedFreeformSeatsFromGrid(cellKey);
    const group = getGroup(payload.id);
    clearMobileCarryItem();
    renderAll();
    setLiveStatusMessage(`Reserved this Freeform seat for group "${group ? group.name : 'Group'}".`);
    return true;
  }
  return false;
}

function ensureMobileCarryGhost() {
  let ghost = document.getElementById('mobileCarryGhost');
  if (!ghost) {
    ghost = document.createElement('div');
    ghost.id = 'mobileCarryGhost';
    ghost.className = 'mobile-carry-ghost no-print';
    document.body.appendChild(ghost);
  }
  return ghost;
}

function installMobileCarrySupport() {
  if (document.body.dataset.mobileCarryInstalled === 'true') return;
  document.body.dataset.mobileCarryInstalled = 'true';
  let pending = null;
  let dragActive = false;

  const resetDragVisuals = () => {
    ensureMobileCarryGhost().classList.remove('show');
    document.querySelectorAll('.mobile-carry-target').forEach(item => item.classList.remove('mobile-carry-target'));
    dragActive = false;
  };

  document.addEventListener('pointerdown', event => {
    if (!isMobileViewport() || uiState.pageLocked) return;
    const payload = mobileCarryPayloadFromTarget(event.target);
    if (!payload) return;
    pending = { payload, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
  }, { passive: true });

  document.addEventListener('pointermove', event => {
    if (!pending || pending.pointerId !== event.pointerId || !isMobileViewport()) return;
    const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
    if (!dragActive && distance < 14) return;
    if (!dragActive) {
      dragActive = true;
      setMobileCarryItem(pending.payload);
    }
    event.preventDefault();
    const ghost = ensureMobileCarryGhost();
    ghost.textContent = mobileCarryLabel(uiState.mobileCarryItem || pending.payload);
    ghost.style.left = `${event.clientX}px`;
    ghost.style.top = `${event.clientY}px`;
    ghost.classList.add('show');

    document.querySelectorAll('.mobile-carry-target').forEach(item => item.classList.remove('mobile-carry-target'));
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const navButton = under?.closest?.('[data-mobile-panel]');
    if (navButton?.dataset.mobilePanel === 'layout') {
      navButton.classList.add('mobile-carry-target');
      if (uiState.mobileActivePanel !== 'layout') setMobilePanel('layout');
      return;
    }
    const cell = under?.closest?.('.cell[data-cell-key]');
    if (cell && state.cells[cell.dataset.cellKey]?.type === 'seat') cell.classList.add('mobile-carry-target');
  }, { passive: false });

  document.addEventListener('pointerup', event => {
    if (!pending || pending.pointerId !== event.pointerId) return;
    const wasDragging = dragActive;
    const payload = pending.payload;
    pending = null;
    resetDragVisuals();
    if (!isMobileViewport()) return;
    if (!wasDragging) return;

    event.preventDefault();
    if (!uiState.mobileCarryItem) setMobileCarryItem(payload);
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const navButton = under?.closest?.('[data-mobile-panel]');
    const cell = under?.closest?.('.cell[data-cell-key]');
    const groupDrop = under?.closest?.('.group-card[data-group-id], .group-manager-group[data-group-id]');

    if (navButton?.dataset.mobilePanel) {
      setMobilePanel(navButton.dataset.mobilePanel);
      updateMobileCarryUi();
      return;
    }
    if (cell?.dataset?.cellKey) {
      applyMobileCarryToCell(cell.dataset.cellKey);
      return;
    }
    if (groupDrop?.dataset?.groupId && (uiState.mobileCarryItem || payload).type === 'student') {
      addStudentToGroup(groupDrop.dataset.groupId, (uiState.mobileCarryItem || payload).id, true);
      clearMobileCarryItem();
      return;
    }
    updateMobileCarryUi();
  }, { passive: false });

  document.addEventListener('pointercancel', () => {
    pending = null;
    resetDragVisuals();
  }, { passive: true });
}

function applyDesignModeUi() {
  document.body.classList.toggle('design-mode', !!uiState.designMode);
  document.body.style.setProperty('--design-cell-width', `${designCellWidth()}px`);
  document.body.style.setProperty('--design-cell-height', `${designCellHeight()}px`);
  const designBtn = el('designModeBtn');
  if (designBtn) {
    designBtn.setAttribute('aria-pressed', uiState.designMode ? 'true' : 'false');
    designBtn.textContent = uiState.designMode ? 'Design Mode: On' : 'Design Mode';
  }
  const sizeSlider = el('designSizeSlider');
  if (sizeSlider && Number(sizeSlider.value) !== designCellWidth()) sizeSlider.value = String(designCellWidth());
  const sizeValue = el('designSizeValue');
  if (sizeValue) sizeValue.textContent = `${designCellWidth()}px`;
}

function ensureDesignModeTooltip() {
  let node = document.getElementById('designModeTooltip');
  if (!node) {
    node = document.createElement('div');
    node.id = 'designModeTooltip';
    node.className = 'design-mode-tooltip';
    document.body.appendChild(node);
  }
  return node;
}

function moveDesignModeTooltip(event) {
  const node = document.getElementById('designModeTooltip');
  if (!node || node.style.display === 'none') return;
  const pad = 10;
  const gap = 14;
  const rect = node.getBoundingClientRect();
  let left = event.clientX - rect.width / 2;
  left = Math.max(pad, Math.min(left, window.innerWidth - rect.width - pad));
  let top = event.clientY - rect.height - gap;
  let placement = 'above';
  if (top < pad) {
    top = event.clientY + gap;
    placement = 'below';
  }
  if (top + rect.height > window.innerHeight - pad) top = Math.max(pad, window.innerHeight - rect.height - pad);
  node.classList.toggle('above', placement === 'above');
  node.classList.toggle('below', placement === 'below');
  node.style.left = `${Math.round(left)}px`;
  node.style.top = `${Math.round(top)}px`;
}

function showDesignModeTooltip(cellEl, event) {
  if (!uiState.designMode || !cellEl?.dataset?.designTooltip) return;
  const node = ensureDesignModeTooltip();
  node.textContent = cellEl.dataset.designTooltip;
  node.style.display = 'block';
  node.classList.add('above');
  moveDesignModeTooltip(event);
}

function hideDesignModeTooltip() {
  const node = document.getElementById('designModeTooltip');
  if (node) node.style.display = 'none';
}


function showInAppConfirm(message, onConfirm, options = {}) {
  const modal = el('confirmModal');
  const title = el('confirmModalTitle');
  const messageBox = el('confirmModalMessage');
  const confirmBtn = el('confirmContinueBtn');
  const cancelBtn = el('confirmCancelBtn');
  const topCancelBtn = el('confirmCancelTopBtn');
  if (!modal || !messageBox || !confirmBtn || !cancelBtn) {
    const approved = typeof window.confirm === 'function' && window.confirm(String(message || 'Continue?'));
    if (approved) {
      if (typeof onConfirm === 'function') onConfirm();
    } else if (typeof options.onCancel === 'function') options.onCancel();
    return;
  }
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  title.textContent = options.title || 'Please Confirm';
  messageBox.textContent = String(message || 'Continue?');
  const confirmText = options.confirmText || 'Continue';
  const isDestructiveAction = /delete|clear|reset|factory|erase|remove/i.test(confirmText);
  confirmBtn.textContent = confirmText;
  confirmBtn.classList.remove('icon-button');
  confirmBtn.classList.toggle('danger', isDestructiveAction);
  confirmBtn.setAttribute('aria-label', confirmText);
  confirmBtn.setAttribute('title', confirmText);
  cancelBtn.textContent = options.cancelText || 'Cancel';
  const handleKeydown = event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    cancel();
  };
  const close = () => {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
    if (topCancelBtn) topCancelBtn.onclick = null;
    modal.onclick = null;
    document.removeEventListener('keydown', handleKeydown, true);
    if (previousFocus?.isConnected) setTimeout(() => previousFocus.focus({ preventScroll: true }), 0);
  };
  confirmBtn.onclick = () => {
    close();
    if (typeof onConfirm === 'function') onConfirm();
  };
  const cancel = () => {
    close();
    if (typeof options.onCancel === 'function') options.onCancel();
  };
  cancelBtn.onclick = cancel;
  if (topCancelBtn) topCancelBtn.onclick = cancel;
  modal.onclick = event => {
    if (event.target === modal) cancel();
  };
  modal.removeAttribute('aria-hidden');
  modal.classList.add('show');
  document.addEventListener('keydown', handleKeydown, true);
  setTimeout(() => (isDestructiveAction ? cancelBtn : confirmBtn).focus({ preventScroll: true }), 0);
}


function getLockCredential() {
  return getHashedCredential(PAGE_LOCK_CREDENTIAL_KEY);
}

function timingSafeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    mismatch |= left.charCodeAt(i % Math.max(left.length, 1)) ^ right.charCodeAt(i % Math.max(right.length, 1));
  }
  return mismatch === 0;
}

async function hashPageLockSecret(secret, saltBytes, iterations = 180000) {
  if (!window.crypto || !crypto.subtle) throw new Error('This browser does not support secure page locking.');
  const iterationCount = validatedPbkdf2IterationCount(iterations, 'stored lock credential', 180000);
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(String(secret || '')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: iterationCount, hash: 'SHA-256' },
    baseKey,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function savePageLockCredential(secret) {
  return saveHashedCredential(
    PAGE_LOCK_CREDENTIAL_KEY,
    secret,
    'The Lock PIN/password could not be stored in this browser. Check storage permissions or available space.'
  );
}

async function verifyPageLockSecret(secret) {
  return verifyHashedCredential(PAGE_LOCK_CREDENTIAL_KEY, secret);
}

function getHashedCredential(storageKey) {
  try {
    const raw = safeStorageGet('localStorage', storageKey);
    if (!raw || raw.length > 4096) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || parsed?.algorithm !== 'PBKDF2-SHA-256') throw new Error('Unsupported stored credential format.');
    const iterations = validatedPbkdf2IterationCount(parsed.iterations, 'stored lock credential', 180000);
    if (typeof parsed.salt !== 'string' || parsed.salt.length > 64 || typeof parsed.hash !== 'string' || parsed.hash.length > 128) {
      throw new Error('Invalid stored credential encoding.');
    }
    const salt = base64ToBytes(parsed.salt);
    const hash = base64ToBytes(parsed.hash);
    if (salt.length !== 16 || hash.length !== 32) throw new Error('Invalid stored credential length.');
    return { ...parsed, iterations };
  } catch (error) {
    safeStorageRemove('localStorage', storageKey);
    return null;
  }
}

function newLocalCredentialValidationMessage(secret, label = 'PIN/password') {
  const value = String(secret || '');
  if (value.length < MIN_LOCAL_CREDENTIAL_LENGTH) return `Use at least ${MIN_LOCAL_CREDENTIAL_LENGTH} characters for the ${label}.`;
  if (value.length > MAX_LOCAL_CREDENTIAL_LENGTH) return `Use no more than ${MAX_LOCAL_CREDENTIAL_LENGTH} characters for the ${label}.`;
  return '';
}

async function saveHashedCredential(storageKey, secret, storageErrorMessage = 'The credential could not be stored in this browser. Check storage permissions or available space.') {
  const validationMessage = newLocalCredentialValidationMessage(secret);
  if (validationMessage) throw new Error(validationMessage);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = encryptionIterationsForNewData();
  const hash = await hashPageLockSecret(secret, salt, iterations);
  const saved = safeStorageSet('localStorage', storageKey, JSON.stringify({
    version: 1,
    algorithm: 'PBKDF2-SHA-256',
    iterations,
    salt: bytesToBase64(salt),
    hash,
    createdAt: new Date().toISOString()
  }));
  if (!saved) throw new Error(storageErrorMessage);
}

async function verifyHashedCredential(storageKey, secret) {
  const value = String(secret || '');
  if (!value || value.length > MAX_LOCAL_CREDENTIAL_LENGTH) return false;
  const credential = getHashedCredential(storageKey);
  if (!credential) return false;
  const salt = base64ToBytes(credential.salt);
  const testHash = await hashPageLockSecret(value, salt, Number(credential.iterations) || 180000);
  return timingSafeEqual(testHash, credential.hash);
}

const getVisibilityCredential = () => getHashedCredential(VISIBILITY_CREDENTIAL_KEY);
const saveVisibilityCredential = (secret) => saveHashedCredential(VISIBILITY_CREDENTIAL_KEY, secret);

async function visibilitySecretSource(secret, allowEncryptionKey = true) {
  const value = String(secret || '');
  if (!value) return '';
  if (getVisibilityCredential() && await verifyHashedCredential(VISIBILITY_CREDENTIAL_KEY, value)) return 'eye-pin';
  if (getLockCredential() && await verifyPageLockSecret(value)) return 'lock-pin';
  if (allowEncryptionKey && currentSessionEncryptionKey() && value === currentSessionEncryptionKey()) return 'encryption-key';
  return '';
}


function hasAnyVisibilityExitSecret() {
  return Boolean(getVisibilityCredential() || getLockCredential() || currentSessionEncryptionKey());
}

function updateVisibilityCredentialNote() {
  const target = el('visibilityCredentialNote');
  if (!target) return;
  if (getVisibilityCredential()) target.textContent = 'Presentation Mode has its own exit PIN set.';
  else if (getLockCredential()) target.textContent = 'No Presentation PIN is set, so Presentation Mode will use the Lock/Unlock PIN as a fallback.';
  else if (currentSessionEncryptionKey()) target.textContent = 'No Presentation PIN is set, so Presentation Mode can be exited with the current session encryption key.';
  else target.textContent = 'No exit secret is set. The first time presentation mode is used, the app will ask for a Presentation PIN.';
}

function showPageLockError(message) {
  const error = el('pageLockError');
  if (!error) return;
  error.textContent = String(message || 'Unable to unlock.');
  error.style.display = 'block';
}

function clearPageLockError() {
  const error = el('pageLockError');
  if (!error) return;
  error.textContent = '';
  error.style.display = 'none';
}

function cachePageLockSecretForSession(secret) {
  const value = String(secret || '');
  uiState.pageLockSecretForSession = value;
}

function clearCachedPageLockSecretForSession() {
  uiState.pageLockSecretForSession = '';
}

function cachedPageLockSecretForAutoLock() {
  return String(uiState.pageLockSecretForSession || '');
}

function lockDataSecretFromSettings() {
  const key = currentSessionEncryptionKey();
  return key ? { secret: key, source: 'encryption-key' } : null;
}

function renderLockedBlank() {
  ['studentList','groupList','groupMemberPicker','groupManagerStudentList','groupManagerGroupList','assignedList','unassignedList','customObjectManagerList'].forEach(id => {
    const target = el(id);
    if (target) target.innerHTML = '';
  });
  const grid = el('seatGrid');
  if (grid) grid.innerHTML = '<div class="locked-data-placeholder">Chart data is encrypted while locked. Unlock to restore the seating chart.</div>';
  const classSelect = el('classSelect');
  if (classSelect) classSelect.innerHTML = '<option>Locked</option>';
  ['statStudents','statSeats','statPlaced'].forEach(id => { const target = el(id); if (target) target.textContent = '0'; });
  const ruleReport = el('ruleReport');
  if (ruleReport) ruleReport.innerHTML = '<div class="warning">Locked. Data is encrypted in memory and local storage.</div>';
  const printStats = el('printStats');
  if (printStats) printStats.textContent = 'Locked';
}

function scrubSensitiveDomForLock() {
  document.querySelectorAll('.modal-backdrop.show').forEach(modal => { if (modal.id !== 'pageLockOverlay') modal.classList.remove('show'); });
  document.querySelectorAll('textarea, input[type="text"], input[type="search"], input[type="password"]').forEach(input => { if (input.id !== 'pageLockUnlockInput') input.value = ''; });
}

function wipeInMemoryChartDataForLock() {
  state.classes = [];
  state.activeClassId = null;
  state.students = [];
  state.groups = [];
  state.rows = 1;
  state.cols = 1;
  state.cells = {};
  state.customObjects = [];
  state.zones = [];
  state.roomTemplates = [];
  state.chartMeta = {};
  if (uiState.selectedCellKeys) uiState.selectedCellKeys.clear();
  uiState.activeSeatEditCellKey = null;
  uiState.activeSeatEditFreeformObjectId = null;
  uiState.activeSeatEditBatchCellKeys = [];
  uiState.activeSeatEditBatchFreeformObjectIds = [];
  uiState.mobileCarryItem = null;
  uiState.keyboardCarryStudentId = '';
  uiState.csvImportDraft = null;
  uiState.textInputCallback = null;
  uiState.noteEditorContext = null;
  uiState.noteEditorDraft = null;
  uiState.restoreImportDraft = null;
  uiState.printOptions = null;
  uiState.undoStack = [];
  uiState.redoStack = [];
  uiState.linkedSaveLastSignature = '';
  uiState.googleDriveAccessToken = '';
  uiState.googleDriveTokenExpiresAt = 0;
  clearGoogleDriveTokenSession();
  scrubSensitiveDomForLock();
  hideMobileActionDrawer?.();
  updateUndoRedoButtons();
  renderLockedBlank();
}

async function secureLockWithSecret(secret, source = 'page-pin') {
  try {
    let plain = exportState('all');
    const protectorSecret = String(secret || '');
    const activeEncryptionKey = currentSessionEncryptionKey();
    const canWrapWithEnteredSecret = activeEncryptionKey && !String(source || '').includes('encryption-key');
    const wrappedKey = canWrapWithEnteredSecret
      ? await wrapSessionEncryptionKeyValue(activeEncryptionKey, protectorSecret, 'page-lock', source)
      : '';
    const dataSecret = activeEncryptionKey || protectorSecret;
    const lockEncryptionSource = activeEncryptionKey
      ? (wrappedKey ? 'wrapped-encryption-key' : 'encryption-key')
      : source;
    const encrypted = await encryptTextWithSecret(plain, dataSecret, 'locked-session', {
      lockProtected: true,
      lockEncryptionSource,
      wrappedSessionKey: !!wrappedKey
    });
    plain = '';
    const wrappedSaved = !wrappedKey || safeStorageSet('sessionStorage', PAGE_LOCK_WRAPPED_KEY_SESSION_KEY, wrappedKey);
    const sessionDataSaved = safeStorageSet('sessionStorage', PAGE_LOCK_DATA_SESSION_KEY, encrypted);
    const localDataSaved = safeStorageSet('localStorage', STORAGE_KEY, encrypted);
    const markerSaved = safeStorageSet('sessionStorage', PAGE_LOCK_SESSION_KEY, 'true');
    if (!wrappedSaved || !sessionDataSaved || !localDataSaved || !markerSaved) {
      safeStorageRemove('sessionStorage', PAGE_LOCK_SESSION_KEY);
      safeStorageRemove('sessionStorage', PAGE_LOCK_DATA_SESSION_KEY);
      if (wrappedKey) safeStorageRemove('sessionStorage', PAGE_LOCK_WRAPPED_KEY_SESSION_KEY);
      throw new Error('The encrypted lock copy could not be stored safely. Check browser storage permissions or available space; the page was not locked.');
    }
    uiState.lockedSnapshotEncrypted = encrypted;
    wipeInMemoryChartDataForLock();
    if (activeEncryptionKey) clearSessionEncryptionKeyFromMemory();
    uiState.pageLocked = true;
    document.body.classList.add('page-locked');
    clearPageLockError();
    const input = el('pageLockUnlockInput');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 50);
    }
  } catch (err) {
    setLiveStatusMessage(`Could not lock page securely: ${err.message}`);
  }
}

function startPageLockFlow() {
  const credential = getLockCredential();
  if (!credential) {
    openPageLockSetupModal();
    return;
  }
  openPageLockNowModal();
}

function deactivatePageLock() {
  uiState.pageLocked = false;
  safeStorageRemove('sessionStorage', PAGE_LOCK_SESSION_KEY);
  safeStorageRemove('sessionStorage', PAGE_LOCK_DATA_SESSION_KEY);
  safeStorageRemove('sessionStorage', PAGE_LOCK_WRAPPED_KEY_SESSION_KEY);
  uiState.lockedSnapshotEncrypted = '';
  document.body.classList.remove('page-locked');
  clearPageLockError();
  const input = el('pageLockUnlockInput');
  if (input) input.value = '';
  setLiveStatusMessage('Page unlocked. Editing is available again.');
}

async function attemptPageUnlock() {
  const input = el('pageLockUnlockInput');
  const secret = String(input?.value || '');
  if (!secret) {
    showPageLockError('Enter the PIN/password to unlock this page.');
    if (input) input.focus();
    return;
  }
  try {
    const ok = await verifyPageLockSecret(secret);
    if (!ok) {
      showPageLockError('Incorrect PIN/password.');
      if (input) {
        input.select();
        input.focus();
      }
      return;
    }
    cachePageLockSecretForSession(secret);
    const lockedText = uiState.lockedSnapshotEncrypted || safeStorageGet('sessionStorage', PAGE_LOCK_DATA_SESSION_KEY) || '';
    if (lockedText) {
      const envelope = JSON.parse(lockedText);
      let decryptSecret = secret;
      if (envelope.lockEncryptionSource === 'wrapped-encryption-key') {
        decryptSecret = await restoreProtectedSessionEncryptionKey('page-lock', secret);
        if (!decryptSecret) {
          showPageLockError('Could not restore the wrapped encryption key with that PIN/password.');
          return;
        }
      } else if (envelope.lockEncryptionSource === 'encryption-key') {
        decryptSecret = currentSessionEncryptionKey();
        if (!decryptSecret) decryptSecret = await requestEncryptionKey('This locked page was encrypted with the Settings encryption key. Enter that key to restore the chart data.');
        if (!decryptSecret) {
          showPageLockError('Encryption key is required to restore the locked data.');
          return;
        }
      }
      const decrypted = await decryptTextEnvelope(envelope, decryptSecret);
      if (envelope.lockEncryptionSource === 'wrapped-encryption-key' || envelope.lockEncryptionSource === 'encryption-key') setSessionEncryptionKey(decryptSecret);
      deactivatePageLock();
      importState(decrypted);
      setLiveStatusMessage('Page unlocked and encrypted chart data restored.');
      return;
    }
    deactivatePageLock();
    const saved = safeStorageGet('localStorage', STORAGE_KEY);
    if (saved) await importStateDirectFromText(saved, 'encrypted local save');
  } catch (err) {
    showPageLockError(err.message || 'Could not unlock this page.');
  }
}

function showPageLockNowError(message) {
  const error = el('pageLockNowError');
  if (!error) return;
  error.textContent = String(message || 'Could not lock page.');
  error.style.display = 'block';
}

function openPageLockNowModal() {
  const modal = el('pageLockNowModal');
  const input = el('pageLockNowInput');
  const error = el('pageLockNowError');
  if (!modal || !input) return;
  input.value = '';
  if (error) {
    error.textContent = '';
    error.style.display = 'none';
  }
  modal.classList.add('show');
  setTimeout(() => input.focus(), 50);
}

function closePageLockNowModal() {
  const modal = el('pageLockNowModal');
  if (modal) modal.classList.remove('show');
}

async function verifyPinAndLockNow() {
  const input = el('pageLockNowInput');
  const secret = String(input?.value || '');
  if (!secret) {
    showPageLockNowError('Enter the PIN/password to lock and encrypt this page.');
    if (input) input.focus();
    return;
  }
  try {
    const ok = await verifyPageLockSecret(secret);
    if (!ok) {
      showPageLockNowError('Incorrect PIN/password.');
      if (input) {
        input.select();
        input.focus();
      }
      return;
    }
    cachePageLockSecretForSession(secret);
    closePageLockNowModal();
    await secureLockWithSecret(secret, 'page-pin');
  } catch (err) {
    showPageLockNowError(err.message || 'Could not lock this page.');
  }
}

function openPageLockSetupModal() {
  const modal = el('pageLockSetupModal');
  const input = el('pageLockSetupInput');
  const confirmInput = el('pageLockSetupConfirmInput');
  const error = el('pageLockSetupError');
  if (!modal || !input || !confirmInput) return;
  input.value = '';
  confirmInput.value = '';
  if (error) {
    error.textContent = '';
    error.style.display = 'none';
  }
  modal.classList.add('show');
  setTimeout(() => input.focus(), 50);
}

function closePageLockSetupModal() {
  const modal = el('pageLockSetupModal');
  if (modal) modal.classList.remove('show');
}

function showPageLockSetupError(message) {
  const error = el('pageLockSetupError');
  if (!error) return;
  error.textContent = String(message || 'Could not set page lock.');
  error.style.display = 'block';
}

async function savePageLockSetupAndLock() {
  const input = el('pageLockSetupInput');
  const confirmInput = el('pageLockSetupConfirmInput');
  const secret = String(input?.value || '');
  const confirmSecret = String(confirmInput?.value || '');
  const validationMessage = newLocalCredentialValidationMessage(secret);
  if (validationMessage) {
    showPageLockSetupError(validationMessage);
    if (input) input.focus();
    return;
  }
  if (secret !== confirmSecret) {
    showPageLockSetupError('The PIN/password entries do not match.');
    if (confirmInput) {
      confirmInput.select();
      confirmInput.focus();
    }
    return;
  }
  try {
    await savePageLockCredential(secret);
    cachePageLockSecretForSession(secret);
    closePageLockSetupModal();
    setLiveStatusMessage('Page lock PIN/password saved as a salted hash. Page locked.');
    await secureLockWithSecret(secret, 'page-pin');
  } catch (err) {
    showPageLockSetupError(err.message || 'Could not set page lock.');
  }
}

function slugifyCustomObjectName(name) {
  const base = String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  return base || `object-${Date.now().toString(36)}`;
}

function normalizeCustomObject(item) {
  const label = String(item?.label || item?.name || '').trim().slice(0, 28);
  if (!label) return null;
  let type = String(item?.type || '').trim().toLowerCase();
  if (!type.startsWith('custom-')) type = `custom-${slugifyCustomObjectName(label)}`;
  type = type.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 42);
  return { type, label };
}

function isCustomCellType(type) {
  return String(type || '').startsWith('custom-');
}

function customObjectForType(type) {
  return (state.customObjects || []).find(item => item.type === type) || null;
}

function addCustomObject(label) {
  const normalized = normalizeCustomObject({ label });
  if (!normalized) {
    setLiveStatusMessage('Enter a custom object name first.');
    return;
  }
  state.customObjects = Array.isArray(state.customObjects) ? state.customObjects : [];
  const exists = state.customObjects.some(item => item.type === normalized.type || item.label.toLowerCase() === normalized.label.toLowerCase());
  if (exists) {
    setLiveStatusMessage('That custom object already exists in the menu.');
    return;
  }
  state.customObjects.push(normalized);
  renderAll();
}

function studentFullName(student) {
  if (!student) return '';
  return `${student.firstName || ''} ${student.lastName || ''}`.trim();
}

function studentDisplay(student) {
  if (!student) return 'Unknown Student';
  const nick = String(student.nickName || student.nickname || student.nick || '').trim();
  return nick || studentFullName(student) || student.id || 'Unnamed Student';
}

function studentMetaText(student) {
  if (!student) return '';
  const details = [];
  const full = studentFullName(student);
  if (student.nickName && full && full !== student.nickName) details.push(`Name: ${full}`);
  details.push(`Grade: ${student.grade || '-'}`);
  details.push(`ID: ${student.id || '-'}`);
  return details.join(' · ');
}

function studentNoteValue(student, category) {
  if (!student) return '';
  const buckets = student.noteCategories && typeof student.noteCategories === 'object' ? student.noteCategories : {};
  if (category === 'private') return String(student.notesPrivate || buckets.private || student.notes || '').trim();
  if (category === 'substitute') return String(student.notesSubstitute || buckets.substitute || '').trim();
  if (category === 'public') return String(student.notesPublic || buckets.public || '').trim();
  return '';
}

function studentHasAnyNotes(student) {
  return ['private', 'substitute', 'public'].some(category => studentNoteValue(student, category));
}

function studentHasSensitiveNotes(student) {
  return ['private', 'substitute'].some(category => studentNoteValue(student, category));
}

function studentNoteFlags(student) {
  if (!studentHasAnyNotes(student)) return '';
  const flags = [];
  if (studentNoteValue(student, 'private')) flags.push('<span class="student-note-flag private" title="Private notes exist. Hidden from substitute and student-facing views.">Private</span>');
  if (studentNoteValue(student, 'substitute')) flags.push('<span class="student-note-flag substitute" title="Substitute notes exist. Safe for substitute-facing use.">Sub</span>');
  if (studentNoteValue(student, 'public')) flags.push('<span class="student-note-flag public" title="Public notes exist. Safe for public/student-facing use.">Public</span>');
  return `<span class="student-note-flags">${flags.join('')}</span>`;
}

const NOTE_CATEGORY_META = {
  private: { label: 'Private', className: 'private', description: 'Private notes are confidential and hidden from substitute/student-facing print views.' },
  substitute: { label: 'Substitute', className: 'substitute', description: 'Substitute notes are shown only in Substitute print mode.' },
  public: { label: 'Public', className: 'public', description: 'Public notes may be included on printouts when the Public notes option is selected.' }
};

function splitNoteLines(value) {
  return String(value || '')
    .split(/\r?\n+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function joinNoteLines(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .join('\n');
}

function noteDraftFromValues(values = {}) {
  return {
    private: splitNoteLines(values.private),
    substitute: splitNoteLines(values.substitute),
    public: splitNoteLines(values.public)
  };
}

function noteDraftFromStudent(student) {
  return noteDraftFromValues({
    private: studentNoteValue(student, 'private'),
    substitute: studentNoteValue(student, 'substitute'),
    public: studentNoteValue(student, 'public')
  });
}

function noteDraftFromFields(prefix) {
  return noteDraftFromValues({
    private: el(`${prefix}Private`)?.value || '',
    substitute: el(`${prefix}Substitute`)?.value || '',
    public: el(`${prefix}Public`)?.value || ''
  });
}

function writeNoteDraftToFields(prefix, draft) {
  const next = draft || { private: [], substitute: [], public: [] };
  if (el(`${prefix}Private`)) el(`${prefix}Private`).value = joinNoteLines(next.private);
  if (el(`${prefix}Substitute`)) el(`${prefix}Substitute`).value = joinNoteLines(next.substitute);
  if (el(`${prefix}Public`)) el(`${prefix}Public`).value = joinNoteLines(next.public);
}

function noteDraftToStudentPatch(draft) {
  const next = draft || { private: [], substitute: [], public: [] };
  const notesPrivate = joinNoteLines(next.private);
  const notesSubstitute = joinNoteLines(next.substitute);
  const notesPublic = joinNoteLines(next.public);
  return {
    notesPrivate,
    notesSubstitute,
    notesPublic,
    noteCategories: { private: notesPrivate, substitute: notesSubstitute, public: notesPublic }
  };
}

function noteDraftCount(draft) {
  const next = draft || { private: [], substitute: [], public: [] };
  return ['private', 'substitute', 'public'].reduce((sum, category) => sum + (Array.isArray(next[category]) ? next[category].length : 0), 0);
}

function noteDraftSummaryText(draft) {
  const next = draft || { private: [], substitute: [], public: [] };
  const parts = ['private', 'substitute', 'public']
    .filter(category => Array.isArray(next[category]) && next[category].length)
    .map(category => `${next[category].length} ${NOTE_CATEGORY_META[category].label}`);
  return parts.length ? parts.join(' · ') : 'No notes defined.';
}

function refreshStudentNotesSummary(fieldPrefix, countId, summaryId) {
  const draft = noteDraftFromFields(fieldPrefix);
  const countNode = el(countId);
  const summaryNode = el(summaryId);
  if (countNode) countNode.textContent = noteDraftCount(draft);
  if (summaryNode) summaryNode.textContent = noteDraftSummaryText(draft);
}

function refreshAddStudentNotesSummary() {
  refreshStudentNotesSummary('studentNotes', 'addStudentNotesCount', 'addStudentNotesSummary');
}

function refreshEditStudentNotesSummary() {
  refreshStudentNotesSummary('editStudentNotes', 'editStudentNotesCount', 'editStudentNotesSummary');
}

function renderNotesEditor() {
  const draft = uiState.noteEditorDraft || { private: [], substitute: [], public: [] };
  const list = el('notesEditorList');
  if (!list) return;
  const rows = [];
  ['private', 'substitute', 'public'].forEach(category => {
    const meta = NOTE_CATEGORY_META[category];
    (draft[category] || []).forEach((note, index) => {
      const noteKey = `${category}-${index}`;
      const sensitive = category !== 'public';
      const revealed = !sensitive || !!uiState.noteEditorRevealed?.[noteKey];
      const noteTextHtml = revealed
        ? escapeHtml(note)
        : `Hidden ${escapeHtml(meta.label)} note. Click Reveal to view this note.`;
      rows.push(`
            <div class="note-editor-row ${sensitive && !revealed ? 'sensitive-note-hidden' : ''}">
              <span class="note-category-pill ${meta.className}" title="${escapeHtml(meta.description)}">${escapeHtml(meta.label)}</span>
              <div class="note-editor-text ${sensitive && !revealed ? 'hidden-sensitive-note' : ''}">${noteTextHtml}</div>
              <span class="card-actions">
                ${sensitive && !revealed ? `<button class="tiny secondary note-reveal-button" type="button" data-reveal-note-key="${escapeHtml(noteKey)}" title="Reveal this ${escapeHtml(meta.label)} note only.">Reveal</button>` : ''}
                <button class="tiny danger icon-button" type="button" data-delete-note-category="${escapeHtml(category)}" data-delete-note-index="${index}" aria-label="Delete note" title="Remove this note from the current notes editor draft.">🗑</button>
              </span>
            </div>
          `);
    });
  });
  list.innerHTML = rows.length ? rows.join('') : '<div class="hint">No notes defined for this student yet.</div>';
}

function openStudentNotesModal(context) {
  uiState.noteEditorRevealed = {};
  uiState.noteEditorContext = context || { mode: 'add' };
  if (uiState.noteEditorContext.mode === 'edit') {
    uiState.noteEditorDraft = noteDraftFromFields('editStudentNotes');
    const studentId = el('editStudentOriginalId')?.value;
    const student = getStudent(studentId);
    el('studentNotesTitle').textContent = student ? `Notes for ${studentDisplay(student)}` : 'Edit Student Notes';
    el('notesEditorContextHint').textContent = 'Editing notes for the current student. Save Notes returns the changes to the Edit Student form.';
  } else if (uiState.noteEditorContext.mode === 'student') {
    const student = getStudent(uiState.noteEditorContext.studentId);
    if (!student) return;
    uiState.noteEditorDraft = noteDraftFromStudent(student);
    el('studentNotesTitle').textContent = `Notes for ${studentDisplay(student)}`;
    el('notesEditorContextHint').textContent = 'Editing notes directly for this student. Private notes remain hidden from substitute and student-facing print modes.';
  } else {
    uiState.noteEditorDraft = noteDraftFromFields('studentNotes');
    el('studentNotesTitle').textContent = 'Notes for New Student';
    el('notesEditorContextHint').textContent = 'Add notes before creating the student. Choose Private, Substitute, or Public for each note.';
  }
  el('noteEditorCategory').value = 'private';
  el('noteEditorText').value = '';
  renderNotesEditor();
  el('studentNotesModal').classList.add('show');
  setTimeout(() => el('noteEditorText')?.focus(), 50);
}

function closeStudentNotesModalCore() {
  el('studentNotesModal')?.classList.remove('show');
  uiState.noteEditorContext = null;
  uiState.noteEditorDraft = null;
  uiState.noteEditorRevealed = {};
}

function recentlyCompletedWelcomeSecuritySetup() {
  return !!uiState.welcomeSecurityJustCompleted || (Number(uiState.suppressEncryptionPromptUntil || 0) > Date.now());
}

function welcomeEncryptionSetupRecorded() {
  try {
    return safeStorageGet('localStorage', WELCOME_SETUP_STORAGE_KEY) === 'true';
  } catch (err) {
    return false;
  }
}

function noteEncryptionSessionIsConfigured() {
  return !!currentSessionEncryptionKey() || !!uiState.encryptionEnabled || recentlyCompletedWelcomeSecuritySetup() || welcomeEncryptionSetupRecorded();
}

function activeEncryptionKeyIsReady() {
  return noteEncryptionSessionIsConfigured();
}

function sensitiveNotesNeedEncryptionWarning(draft = null) {
  const source = draft || uiState.noteEditorDraft || { private: [], substitute: [] };
  const hasSensitive = (Array.isArray(source.private) && source.private.some(Boolean)) || (Array.isArray(source.substitute) && source.substitute.some(Boolean));
  return hasSensitive && !noteEncryptionSessionIsConfigured();
}

function welcomeSecurityModalIsActive() {
  return document.body.classList.contains('welcome-security-active') || !!el('welcomeSecurityModal')?.classList.contains('show');
}

function warnSensitiveNotesNeedEncryption(draft = null) {
  if (noteEncryptionSessionIsConfigured() || welcomeSecurityModalIsActive()) return;
  const hasSensitiveDraft = draft ? sensitiveNotesNeedEncryptionWarning(draft) : hasSensitiveStudentNotes();
  if (!hasSensitiveDraft) return;
  showInAppConfirm('Private and Substitute notes can contain sensitive student information. Set an encryption key before saving so local autosaves, linked saves, and downloads are encrypted. Use a phrase you can remember but others cannot guess. There is no recovery if the key is lost.', () => {
    openSettingsToEncryptionKey();
  }, {
    title: 'Encryption Recommended for Notes',
    confirmText: 'Set Encryption Key',
    cancelText: 'Continue Without Key'
  });
}

function addNoteLineToEditor() {
  const category = el('noteEditorCategory')?.value || 'private';
  const text = String(el('noteEditorText')?.value || '').trim();
  if (!text) {
    setLiveStatusMessage('Enter a note before adding it.');
    return;
  }
  uiState.noteEditorDraft = uiState.noteEditorDraft || { private: [], substitute: [], public: [] };
  uiState.noteEditorDraft[category] = Array.isArray(uiState.noteEditorDraft[category]) ? uiState.noteEditorDraft[category] : [];
  uiState.noteEditorDraft[category].push(text);
  if ((category === 'private' || category === 'substitute') && !activeEncryptionKeyIsReady() && !recentlyCompletedWelcomeSecuritySetup()) warnSensitiveNotesNeedEncryption(uiState.noteEditorDraft);
  el('noteEditorText').value = '';
  renderNotesEditor();
}

function revealNoteLineInEditorCore(noteKey) {
  uiState.noteEditorRevealed = uiState.noteEditorRevealed || {};
  uiState.noteEditorRevealed[String(noteKey || '')] = true;
  renderNotesEditor();
}

function deleteNoteLineFromEditor(category, index) {
  const draft = uiState.noteEditorDraft;
  if (!draft || !Array.isArray(draft[category])) return;
  draft[category].splice(Number(index), 1);
  renderNotesEditor();
}

function saveStudentNotesModal() {
  const context = uiState.noteEditorContext || { mode: 'add' };
  const draft = uiState.noteEditorDraft || { private: [], substitute: [], public: [] };
  if (sensitiveNotesNeedEncryptionWarning(draft)) warnSensitiveNotesNeedEncryption(draft);
  if (context.mode === 'edit') {
    writeNoteDraftToFields('editStudentNotes', draft);
    refreshEditStudentNotesSummary();
    setLiveStatusMessage('Student notes updated in the edit form. Save the student to keep the changes.');
  } else if (context.mode === 'student') {
    const student = getStudent(context.studentId);
    if (student) {
      Object.assign(student, noteDraftToStudentPatch(draft));
      delete student.notes;
      delete student.note;
      renderAll();
      setLiveStatusMessage(`Updated notes for ${studentDisplay(student)}.`);
    }
  } else {
    writeNoteDraftToFields('studentNotes', draft);
    refreshAddStudentNotesSummary();
    setLiveStatusMessage('Notes added to the new-student form.');
  }
  closeStudentNotesModal();
}

function getStudent(id) {
  const targetId = String(id || "");
  return state.students.find(s => String(s.id) === targetId);
}

function getGroup(id) {
  const targetId = String(id || "");
  return state.groups.find(b => String(b.id) === targetId);
}

function buildLookupMaps() {
  const students = new Map(state.students.map(student => [String(student.id), student]));
  const groups = new Map(state.groups.map(group => [String(group.id), group]));
  const zones = new Map((state.zones || []).map(zone => [String(zone.id), zone]));
  const groupsByStudent = new Map();
  state.groups.forEach(group => {
    (group.studentIds || []).forEach(studentId => {
      const key = String(studentId);
      if (!groupsByStudent.has(key)) groupsByStudent.set(key, []);
      groupsByStudent.get(key).push(group);
    });
  });
  return { students, groups, zones, groupsByStudent };
}

function ensureGrid(options = {}) {
  state.customObjects = Array.isArray(state.customObjects)
    ? state.customObjects.map(normalizeCustomObject).filter(Boolean)
    : [];
  const next = {};
  for (let r = 1; r <= state.rows; r++) {
    for (let c = 1; c <= state.cols; c++) {
      const key = keyOf(r, c);
      next[key] = state.cells[key] || {
        row: r,
        col: c,
        type: 'seat',
        assignedStudentId: null,
        manual: false,
        anchorGroupIds: [],
        zoneIds: [],
        comment: ''
      };
      next[key].row = r;
      next[key].col = c;
      next[key].type = next[key].type || 'seat';
      next[key].anchorGroupIds = next[key].anchorGroupIds || [];
      next[key].zoneIds = Array.isArray(next[key].zoneIds) ? next[key].zoneIds : [];
      next[key].manual = Boolean(next[key].manual);
      next[key].comment = String(next[key].comment || '').slice(0, 1200);
    }
  }
  state.cells = next;
  if (options.cleanup !== false) cleanupInvalidAssignmentsAndAnchors();
}



function objectTypeColor(type) {
  return OBJECT_TYPE_COLORS[type] || '#eef2f7';
}

function normalizeFreeformObject(object, index = 0) {
  const source = object && typeof object === 'object' ? object : {};
  const type = source.type || 'seat';
  const isSeat = type === 'seat';
  return {
    id: source.id || uid('freeform-object'),
    cellKey: source.cellKey ? String(source.cellKey) : '',
    type,
    label: String(source.label || '').slice(0, 80),
    assignedStudentId: source.assignedStudentId ? String(source.assignedStudentId) : null,
    manual: Boolean(source.manual),
    anchorGroupIds: Array.isArray(source.anchorGroupIds) ? Array.from(new Set(source.anchorGroupIds.map(String))) : [],
    zoneIds: Array.isArray(source.zoneIds) ? Array.from(new Set(source.zoneIds.map(String))) : [],
    x: clampNumber(source.x ?? (40 + index * 18), 0, 10000),
    y: clampNumber(source.y ?? (40 + index * 18), 0, 10000),
    width: clampNumber(source.width ?? (isSeat ? DEFAULT_FREEFORM_SEAT_WIDTH : 160), isSeat ? MIN_FREEFORM_SEAT_WIDTH : 28, 2000),
    height: clampNumber(source.height ?? (isSeat ? DEFAULT_FREEFORM_SEAT_HEIGHT : 96), isSeat ? MIN_FREEFORM_SEAT_HEIGHT : 24, 2000),
    rotation: clampNumber(source.rotation ?? 0, -360, 360),
    locked: Boolean(source.locked),
    zIndex: clampNumber(source.zIndex ?? (index + 1), 1, 100000),
    color: safeColor(source.color, objectTypeColor(type)),
    groupId: source.groupId ? String(source.groupId) : '',
    comment: String(source.comment || '').trim().slice(0, 1200)
  };
}

function normalizePhysicalRoomRecord(value) {
  const source = value && typeof value === 'object' ? value : {};
  const background = source.background && typeof source.background === 'object' ? source.background : {};
  const unit = source.unit === 'm' ? 'm' : 'ft';
  const dataUrl = /^data:image\//i.test(String(background.dataUrl || '')) && String(background.dataUrl || '').length <= 8000000
    ? String(background.dataUrl)
    : '';
  return {
    enabled: Boolean(source.enabled),
    unit,
    width: clampNumber(source.width ?? (unit === 'm' ? 9 : 30), unit === 'm' ? 2 : 6, unit === 'm' ? 100 : 330),
    height: clampNumber(source.height ?? (unit === 'm' ? 7.3 : 24), unit === 'm' ? 2 : 6, unit === 'm' ? 100 : 330),
    gridStep: clampNumber(source.gridStep ?? (unit === 'm' ? .5 : 1), unit === 'm' ? .1 : .25, unit === 'm' ? 10 : 20),
    showGrid: source.showGrid !== false,
    showRulers: source.showRulers !== false,
    showObjectMeasurements: source.showObjectMeasurements !== false,
    background: {
      dataUrl,
      name: String(background.name || '').slice(0, 120),
      visible: background.visible !== false,
      opacity: clampNumber(background.opacity ?? .42, .05, 1),
      scalePct: clampNumber(background.scalePct ?? 100, 20, 300),
      offsetXPct: clampNumber(background.offsetXPct ?? 0, -100, 100),
      offsetYPct: clampNumber(background.offsetYPct ?? 0, -100, 100),
      rotation: clampNumber(background.rotation ?? 0, -180, 180),
      print: Boolean(background.print),
      locked: background.locked !== false
    }
  };
}

function normalizeFreeformLayout(layout) {
  const sourceIsObject = Boolean(layout && typeof layout === 'object');
  const source = sourceIsObject ? layout : {};
  const canvas = source.canvas && typeof source.canvas === 'object' ? source.canvas : {};
  const hasObjectCollection = Array.isArray(source.objects);
  const objects = hasObjectCollection ? source.objects.map(normalizeFreeformObject) : [];
  return {
    initialized: source.initialized === true || objects.length > 0,
    physicalRoom: normalizePhysicalRoomRecord(source.physicalRoom),
    activityLayouts: source.activityLayouts && typeof source.activityLayouts === 'object' ? deepClone(source.activityLayouts) : null,
    stationRotations: source.stationRotations && typeof source.stationRotations === 'object' ? deepClone(source.stationRotations) : null,
    testingMode: source.testingMode && typeof source.testingMode === 'object' ? deepClone(source.testingMode) : null,
    canvas: {
      width: clampNumber(canvas.width ?? 2800, 400, 12000),
      height: clampNumber(canvas.height ?? 1800, 300, 12000),
      gridSize: clampNumber(canvas.gridSize ?? DEFAULT_PAGE_SETTINGS.freeformGridSize, 5, 80),
      snap: canvas.snap ?? DEFAULT_PAGE_SETTINGS.freeformSnapToGrid,
      allowSeatPassThrough: canvas.allowSeatPassThrough ?? DEFAULT_PAGE_SETTINGS.freeformAllowSeatPassThrough,
      allowSeatOverlapOnDrop: canvas.allowSeatOverlapOnDrop ?? DEFAULT_PAGE_SETTINGS.freeformAllowSeatOverlapOnDrop,
      magneticGuides: canvas.magneticGuides ?? DEFAULT_PAGE_SETTINGS.freeformMagneticGuides,
      showMinimap: canvas.showMinimap ?? DEFAULT_PAGE_SETTINGS.freeformShowMinimap,
      showPrintBoundaries: canvas.showPrintBoundaries ?? DEFAULT_PAGE_SETTINGS.freeformShowPrintBoundaries,
      printPageSize: ['letter','legal','a4'].includes(String(canvas.printPageSize || '').toLowerCase()) ? String(canvas.printPageSize).toLowerCase() : 'letter',
      printOrientation: ['portrait','landscape'].includes(String(canvas.printOrientation || '').toLowerCase()) ? String(canvas.printOrientation).toLowerCase() : 'landscape',
      printMargin: clampNumber(canvas.printMargin ?? 0.35, 0, 1.5),
      printScaleMode: ['actual','fit','tile'].includes(String(canvas.printScaleMode || '').toLowerCase()) ? String(canvas.printScaleMode).toLowerCase() : 'tile',
      printCropMarks: Boolean(canvas.printCropMarks),
      frontSide: ['top','right','bottom','left'].includes(String(canvas.frontSide || '').toLowerCase()) ? String(canvas.frontSide).toLowerCase() : 'top',
      zoom: clampNumber(canvas.zoom ?? 1, 0.2, 2.5)
    },
    objects,
    groups: Array.isArray(source.groups) ? source.groups.map((group, index) => ({
          id: group?.id ? String(group.id) : uid('freeform-group'),
          name: String(group?.name || `Group ${index + 1}`).trim().slice(0, 60) || `Group ${index + 1}`,
          color: safeColor(group?.color, defaultGroupColor(index + 5)),
          locked: Boolean(group?.locked)
        })) : [],
    roomHistory: Array.isArray(source.roomHistory) ? source.roomHistory.slice(0, 24).map((entry, index) => ({
          id: entry?.id ? String(entry.id) : uid('room-version'),
          name: String(entry?.name || `Room Version ${index + 1}`).trim().slice(0, 80) || `Room Version ${index + 1}`,
          createdAt: entry?.createdAt || new Date().toISOString(),
          initialized: entry?.initialized === true || (Array.isArray(entry?.objects) && entry.objects.length > 0),
          canvas: entry?.canvas && typeof entry.canvas === 'object' ? deepClone(entry.canvas) : {},
          groups: Array.isArray(entry?.groups) ? deepClone(entry.groups) : [],
          objects: Array.isArray(entry?.objects) ? deepClone(entry.objects) : []
        })) : [],
    nextZ: Math.max(Number(source.nextZ) || 1, objects.reduce((max, obj) => Math.max(max, Number(obj.zIndex) || 1), 1) + 1)
  };
}

function compareGridCellEntries(a, b) {
  return (Number(a[1].row) - Number(b[1].row)) || (Number(a[1].col) - Number(b[1].col));
}

function gridSeatEntriesSorted() {
  ensureGrid();
  return Object.entries(state.cells)
    .filter(([, cell]) => cell.type === 'seat')
    .sort(compareGridCellEntries);
}

function freeformObjectsSorted(objects = state.freeformLayout?.objects || []) {
  return [...objects].sort((a, b) => (Number(a.y) - Number(b.y)) || (Number(a.x) - Number(b.x)) || String(a.id).localeCompare(String(b.id)));
}

function freeformSeatObjectsSorted() {
  ensureFreeformLayout();
  return freeformObjectsSorted((state.freeformLayout.objects || []).filter(obj => obj.type === 'seat'));
}
function freeformRoomFrontSide() {
  const side = String(state.freeformLayout?.canvas?.frontSide || 'top').toLowerCase();
  return ['top','right','bottom','left'].includes(side) ? side : 'top';
}

function freeformCanvasZoom(layout = state.freeformLayout) {
  return clampNumber(layout?.canvas?.zoom ?? 1, 0.35, 1.75);
}


function freeformScroller() {
  return el('seatGrid')?.closest('.grid-wrap') || null;
}

function freeformCanvasStageElement() {
  return el('seatGrid')?.closest('.freeform-canvas-stage') || null;
}

function ensureFreeformCanvasStage() {
  const grid = el('seatGrid');
  const scroller = freeformScroller();
  if (!grid || !scroller) return null;
  let stage = freeformCanvasStageElement();
  if (!stage) {
    stage = document.createElement('div');
    stage.className = 'freeform-canvas-stage';
    grid.parentNode.insertBefore(stage, grid);
    stage.appendChild(grid);
  }
  return stage;
}

function releaseFreeformCanvasStage() {
  const grid = el('seatGrid');
  const stage = freeformCanvasStageElement();
  if (!grid || !stage || !stage.parentNode) return;
  stage.parentNode.insertBefore(grid, stage);
  stage.remove();
}

function syncFreeformCanvasStage(layout = state.freeformLayout) {
  const stage = ensureFreeformCanvasStage();
  if (!stage) return;
  const zoom = freeformCanvasZoom(layout);
  stage.style.width = `${Math.max(1, Number(layout?.canvas?.width) || 2800) * zoom}px`;
  stage.style.height = `${Math.max(1, Number(layout?.canvas?.height) || 1800) * zoom}px`;
}

function captureFreeformViewportAnchor() {
  const grid = el('seatGrid');
  const scroller = freeformScroller();
  if (!grid || !scroller || state.layoutMode !== 'freeform') return null;
  const zoom = freeformCanvasZoom();
  const gridRect = grid.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  return {
    x: (scrollerRect.left + scroller.clientWidth / 2 - gridRect.left) / zoom,
    y: (scrollerRect.top + scroller.clientHeight / 2 - gridRect.top) / zoom
  };
}

function centerFreeformCanvasPoint(x, y, behavior = 'auto') {
  const grid = el('seatGrid');
  const scroller = freeformScroller();
  if (!grid || !scroller) return;
  const zoom = freeformCanvasZoom();
  const gridRect = grid.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const targetClientX = gridRect.left + Number(x || 0) * zoom;
  const targetClientY = gridRect.top + Number(y || 0) * zoom;
  const deltaX = targetClientX - (scrollerRect.left + scroller.clientWidth / 2);
  const deltaY = targetClientY - (scrollerRect.top + scroller.clientHeight / 2);
  scroller.scrollTo({
    left: Math.max(0, scroller.scrollLeft + deltaX),
    top: Math.max(0, scroller.scrollTop + deltaY),
    behavior
  });
}

function restoreFreeformViewportAnchor(anchor, behavior = 'auto') {
  if (!anchor) return;
  requestAnimationFrame(() => centerFreeformCanvasPoint(anchor.x, anchor.y, behavior));
}

function freeformSeatRuleCoordinates(obj, layout = state.freeformLayout) {
  const canvas = layout?.canvas || {};
  const side = String(canvas.frontSide || 'top').toLowerCase();
  const centerX = (Number(obj.x) || 0) + (Number(obj.width) || 0) / 2;
  const centerY = (Number(obj.y) || 0) + (Number(obj.height) || 0) / 2;
  const scale = Math.max(40, Number(canvas.gridSize) || 20, ((Number(obj.width) || DEFAULT_FREEFORM_SEAT_WIDTH) + (Number(obj.height) || DEFAULT_FREEFORM_SEAT_HEIGHT)) / 2);
  if (side === 'bottom') return { row: Math.max(1, ((Number(canvas.height) || 1800) - centerY) / scale + 1), col: Math.max(1, centerX / scale + 1) };
  if (side === 'left') return { row: Math.max(1, centerX / scale + 1), col: Math.max(1, centerY / scale + 1) };
  if (side === 'right') return { row: Math.max(1, ((Number(canvas.width) || 2800) - centerX) / scale + 1), col: Math.max(1, centerY / scale + 1) };
  return { row: Math.max(1, centerY / scale + 1), col: Math.max(1, centerX / scale + 1) };
}


function prepareGridMirrorFromFreeformSeats({ clearUnlockedAssignments = false } = {}) {
  ensureFreeformLayout();
  let seats = freeformSeatObjectsSorted();
  const layout = state.freeformLayout;
  if (!seats.length) return false;
  const seatCount = seats.length;
  const currentCols = Math.max(1, Math.min(30, Number(state.cols) || Math.ceil(Math.sqrt(seatCount)) || 1));
  let cols = currentCols;
  let rows = Math.ceil(seatCount / cols);
  if (rows > 30) {
    cols = Math.min(30, Math.max(cols, Math.ceil(seatCount / 30)));
    rows = Math.ceil(seatCount / cols);
  }
  state.cols = Math.max(1, Math.min(30, cols));
  state.rows = Math.max(1, Math.min(30, rows));
  ensureGrid();
   
   
  seats = freeformSeatObjectsSorted();
  const entries = Object.entries(state.cells).sort(compareGridCellEntries);
  entries.forEach(([, cell]) => {
    cell.type = 'empty';
    cell.assignedStudentId = null;
    cell.manual = false;
    cell.anchorGroupIds = [];
    cell.zoneIds = [];
  });
  seats.forEach((obj, index) => {
    const entry = entries[index];
    if (!entry) return;
    const [cellKey, cell] = entry;
    const ruleCoords = freeformSeatRuleCoordinates(obj, layout);
    obj.cellKey = cellKey;
    cell.type = 'seat';
    cell.row = ruleCoords.row;
    cell.col = ruleCoords.col;
    const keepAssignment = !clearUnlockedAssignments || Boolean(obj.locked || obj.manual);
    cell.assignedStudentId = keepAssignment ? (obj.assignedStudentId || null) : null;
    cell.manual = Boolean(cell.assignedStudentId && (obj.locked || obj.manual));
    cell.anchorGroupIds = deepClone(obj.anchorGroupIds || []);
    cell.zoneIds = deepClone(obj.zoneIds || []);
    cell.comment = String(obj.comment || '').slice(0, 1200);
  });
  return true;
}

function createFreeformObjectsFromGrid({ keepAssignments = true } = {}) {
  ensureGrid();
  const objects = [];
  const cellWidth = DEFAULT_FREEFORM_GRID_CELL_WIDTH;
  const cellHeight = DEFAULT_FREEFORM_GRID_CELL_HEIGHT;
  const gap = DEFAULT_FREEFORM_GRID_GAP;
  Object.entries(state.cells).sort((a, b) => (a[1].row - b[1].row) || (a[1].col - b[1].col)).forEach(([cellKey, cell], index) => {
    const type = cell.type || 'seat';
    const width = type === 'seat' ? DEFAULT_FREEFORM_SEAT_WIDTH : (type === 'table' ? 240 : 160);
    const height = type === 'seat' ? DEFAULT_FREEFORM_SEAT_HEIGHT : (type === 'wall' ? 42 : 110);
    objects.push(normalizeFreeformObject({
      id: `freeform-${cellKey}`,
      cellKey,
      type,
      label: type === 'seat' ? '' : objectLabel(type),
      assignedStudentId: keepAssignments && type === 'seat' ? cell.assignedStudentId || null : null,
      manual: keepAssignments && type === 'seat' ? Boolean(cell.manual) : false,
      anchorGroupIds: keepAssignments && type === 'seat' ? deepClone(cell.anchorGroupIds || []) : [],
      zoneIds: deepClone(cell.zoneIds || []),
      comment: String(cell.comment || '').slice(0, 1200),
      x: 40 + (Number(cell.col) - 1) * (cellWidth + gap),
      y: 40 + (Number(cell.row) - 1) * (cellHeight + gap),
      width,
      height,
      rotation: 0,
      locked: Boolean(cell.manual),
      zIndex: index + 1,
      color: objectTypeColor(type)
    }, index));
  });
  return objects;
}

function freeformObjectPolygon(obj, candidate = null, padding = 0) {
  const source = candidate ? { ...obj, ...candidate } : obj;
  if (!source) return [];
  const x = Number(source.x) || 0;
  const y = Number(source.y) || 0;
  const width = Math.max(1, Number(source.width) || (source.type === 'seat' ? DEFAULT_FREEFORM_SEAT_WIDTH : 160)) + Math.max(0, Number(padding) || 0) * 2;
  const height = Math.max(1, Number(source.height) || (source.type === 'seat' ? DEFAULT_FREEFORM_SEAT_HEIGHT : 96)) + Math.max(0, Number(padding) || 0) * 2;
  const centerX = x + (Number(source.width) || width) / 2;
  const centerY = y + (Number(source.height) || height) / 2;
  const radians = (Number(source.rotation) || 0) * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const halfW = width / 2;
  const halfH = height / 2;
  return [[-halfW,-halfH],[halfW,-halfH],[halfW,halfH],[-halfW,halfH]].map(([dx,dy]) => ({
    x: centerX + dx * cos - dy * sin,
    y: centerY + dx * sin + dy * cos
  }));
}

function freeformPolygonAxes(points) {
  return (points || []).map((point, index) => {
    const next = points[(index + 1) % points.length];
    const edgeX = next.x - point.x;
    const edgeY = next.y - point.y;
    const length = Math.hypot(edgeX, edgeY) || 1;
    return { x: -edgeY / length, y: edgeX / length };
  });
}

function freeformProjection(points, axis) {
  const values = (points || []).map(point => point.x * axis.x + point.y * axis.y);
  return { min: Math.min(...values), max: Math.max(...values) };
}

function freeformPolygonsOverlap(aPoints, bPoints) {
  if (!aPoints?.length || !bPoints?.length) return false;
  const axes = [...freeformPolygonAxes(aPoints), ...freeformPolygonAxes(bPoints)];
  return axes.every(axis => {
    const a = freeformProjection(aPoints, axis);
    const b = freeformProjection(bPoints, axis);
    return a.max > b.min && b.max > a.min;
  });
}

function freeformRectOverlaps(a, b, { padding = 8 } = {}) {
  if (!a || !b) return false;
  return freeformPolygonsOverlap(freeformObjectPolygon(a, null, padding / 2), freeformObjectPolygon(b, null, padding / 2));
}

function freeformObjectBounds(obj) {
  const points = freeformObjectPolygon(obj);
  if (!points.length) return { x:0, y:0, width:1, height:1 };
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) };
}

function freeformSeatCenter(obj) {
  return { x: (Number(obj?.x) || 0) + (Number(obj?.width) || 0) / 2, y: (Number(obj?.y) || 0) + (Number(obj?.height) || 0) / 2 };
}

function findFreeformOverlap(obj, candidate = null, objects = state.freeformLayout?.objects || [], options = {}) {
  const test = candidate ? { ...obj, ...candidate } : obj;
  if (!test) return null;
  const canvas = state.freeformLayout?.canvas || {};
  const phase = options.phase || 'drop';
  const excluded = options.excludeIds instanceof Set ? options.excludeIds : new Set(options.excludeIds || []);
  return (objects || []).find(other => {
    if (!other || other.id === obj.id || excluded.has(other.id)) return false;
    const seatPair = test.type === 'seat' && other.type === 'seat';
    const seatPassThrough = seatPair && !options.forceSeatCollision && phase === 'drag' && Boolean(canvas.allowSeatPassThrough);
    const seatOverlapAllowed = seatPair && !options.forceSeatCollision && phase !== 'drag' && Boolean(canvas.allowSeatOverlapOnDrop);
    if (seatPassThrough || seatOverlapAllowed) return false;
    return freeformRectOverlaps(test, other, { padding: options.padding ?? 8 });
  }) || null;
}

function positionFreeformObjectWithoutOverlap(obj, { startX = null, startY = null, maxAttempts = 240, forceSeatCollision = false, objects = null } = {}) {
  if (!obj) return obj;
  const layout = state.freeformLayout?.canvas || {};
  const stepX = Math.max(DEFAULT_FREEFORM_GRID_GAP, Number(layout.gridSize) || DEFAULT_FREEFORM_GRID_GAP, Math.round((Number(obj.width) || DEFAULT_FREEFORM_SEAT_WIDTH) * 0.32));
  const stepY = Math.max(DEFAULT_FREEFORM_GRID_GAP, Number(layout.gridSize) || DEFAULT_FREEFORM_GRID_GAP, Math.round((Number(obj.height) || DEFAULT_FREEFORM_SEAT_HEIGHT) * 0.32));
  let x = freeformSnap(startX ?? obj.x ?? 80);
  let y = freeformSnap(startY ?? obj.y ?? 80);
  const maxX = Math.max(0, (Number(layout.width) || 2800) - (Number(obj.width) || DEFAULT_FREEFORM_SEAT_WIDTH));
  const maxY = Math.max(0, (Number(layout.height) || 1800) - (Number(obj.height) || DEFAULT_FREEFORM_SEAT_HEIGHT));
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = { x: clampNumber(x, 0, maxX), y: clampNumber(y, 0, maxY) };
    if (!findFreeformOverlap(obj, candidate, objects || state.freeformLayout?.objects || [], { phase: 'drop', forceSeatCollision })) {
      obj.x = candidate.x;
      obj.y = candidate.y;
      return obj;
    }
    x += stepX;
    if (x > maxX) {
      x = 80;
      y += stepY;
    }
    if (y > maxY) {
      x = 80 + (attempt % 7) * stepX;
      y = 80 + Math.floor(attempt / 7) * stepY;
    }
  }
  return obj;
}

function ensureFreeformLayout({ rebuildMissing = false } = {}) {
  state.freeformLayout = normalizeFreeformLayout(state.freeformLayout);
  const objects = state.freeformLayout.objects || [];
  if (!objects.length && !state.freeformLayout.initialized) {
    state.freeformLayout.objects = createFreeformObjectsFromGrid({ keepAssignments: true });
    state.freeformLayout.initialized = true;
  } else if (objects.length && rebuildMissing) {
     
     
     
     
    const existingKeys = new Set(objects.map(obj => String(obj.cellKey || obj.id)));
    const additions = createFreeformObjectsFromGrid({ keepAssignments: true }).filter(obj => !existingKeys.has(String(obj.cellKey || obj.id)));
    if (additions.length) state.freeformLayout.objects.push(...additions.map((obj, index) => normalizeFreeformObject(obj, objects.length + index)));
  }
  restoreFreeformGeometryFromCache({ seedIfEmpty: true });
  state.freeformLayout.nextZ = Math.max(Number(state.freeformLayout.nextZ) || 1, ...state.freeformLayout.objects.map(obj => Number(obj.zIndex) || 1)) + 1;
  return state.freeformLayout;
}

function rebuildFreeformFromGrid({ keepAssignments = true } = {}) {
  state.freeformLayout = normalizeFreeformLayout(state.freeformLayout);
  state.freeformLayout.objects = createFreeformObjectsFromGrid({ keepAssignments });
  state.freeformLayout.initialized = true;
  state.freeformLayout.nextZ = state.freeformLayout.objects.length + 1;
  resetFreeformGeometryCache();
  persistFreeformGeometrySession('freeform-rebuild-from-grid');
}

function syncGridAssignmentsToFreeformByPosition() {
  ensureFreeformLayout({ rebuildMissing: true });
   
   
   
  const gridSeats = gridSeatEntriesSorted().map(([, cell]) => cell);
  const seats = freeformSeatObjectsSorted();
  seats.forEach((obj, index) => {
    const cell = obj.cellKey && state.cells[obj.cellKey] && state.cells[obj.cellKey].type === 'seat' ? state.cells[obj.cellKey] : gridSeats[index];
    if (!cell) return;
    obj.assignedStudentId = cell.assignedStudentId || null;
    obj.manual = Boolean(cell.manual);
    obj.locked = Boolean(cell.manual);
    obj.anchorGroupIds = deepClone(cell.anchorGroupIds || []);
    obj.zoneIds = deepClone(cell.zoneIds || []);
  });
  restoreFreeformGeometryFromCache();
}

function syncFreeformAssignmentsToGridByPosition() {
  if (!state.freeformLayout) return;
  ensureGrid();
  const seats = freeformSeatObjectsSorted();
  const gridSeatEntries = gridSeatEntriesSorted();
  gridSeatEntries.forEach(([, cell]) => { cell.assignedStudentId = null; cell.manual = false; });
  seats.forEach((obj, index) => {
    const entry = gridSeatEntries[index];
    if (!entry) return;
    const [cellKey, cell] = entry;
    cell.assignedStudentId = obj.assignedStudentId || null;
    cell.manual = Boolean(obj.manual || obj.locked);
    cell.anchorGroupIds = deepClone(obj.anchorGroupIds || []);
    cell.zoneIds = deepClone(obj.zoneIds || []);
    obj.cellKey = obj.cellKey || cellKey;
  });
}

function switchLayoutMode(mode) {
  const nextMode = mode === 'freeform' ? 'freeform' : 'grid';
  if (nextMode === state.layoutMode) {
    ProductExperience?.syncMobileRoomActions?.();
    return;
  }
  if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
  if (uiState.gridResizeModeActive) cancelGridResizeMode({ announce: false });
  if (state.layoutMode === 'freeform') syncFreeformAssignmentsToGridByPosition();
  if (nextMode === 'freeform') {
    state.layoutMode = 'freeform';
    ensureFreeformLayout({ rebuildMissing: true });
    syncGridAssignmentsToFreeformByPosition();
  } else {
    syncFreeformAssignmentsToGridByPosition();
    state.layoutMode = 'grid';
  }
  clearCellSelection();
  renderAll();
  ProductExperience?.syncMobileRoomActions?.();
  setLiveStatusMessage(nextMode === 'freeform' ? 'Switched to Freeform Room Layout.' : 'Switched to Standard Grid and mapped freeform seat order into row/column seats.');
}

function syncFreeformControlsFromState() {
  const mode = el('layoutModeSelect');
  if (mode && document.activeElement !== mode) mode.value = state.layoutMode === 'freeform' ? 'freeform' : 'grid';
  const layout = normalizeFreeformLayout(state.freeformLayout);
  const w = el('freeformCanvasWidthInput');
  const h = el('freeformCanvasHeightInput');
  const gridSize = el('freeformGridSizeInput');
  const frontSide = el('freeformFrontSideSelect');
  const snap = el('freeformSnapToggle');
  const passThrough = el('freeformSeatPassThroughToggle');
  const overlapOnDrop = el('freeformSeatOverlapToggle');
  const guides = el('freeformMagneticGuidesToggle');
  const zoomSlider = el('seatViewZoomSlider');
  const zoomValue = el('seatViewZoomValue');
  if (w && document.activeElement !== w) w.value = layout.canvas.width;
  if (h && document.activeElement !== h) h.value = layout.canvas.height;
  if (gridSize && document.activeElement !== gridSize) gridSize.value = layout.canvas.gridSize;
  if (frontSide && document.activeElement !== frontSide) frontSide.value = layout.canvas.frontSide || 'top';
  if (zoomSlider && document.activeElement !== zoomSlider) zoomSlider.value = Math.round((Number(layout.canvas.zoom) || 1) * 100);
  if (zoomValue) zoomValue.textContent = `${Math.round((Number(layout.canvas.zoom) || 1) * 100)}%`;
  if (snap) snap.checked = layout.canvas.snap !== false;
  if (passThrough) passThrough.checked = Boolean(layout.canvas.allowSeatPassThrough);
  if (overlapOnDrop) overlapOnDrop.checked = Boolean(layout.canvas.allowSeatOverlapOnDrop);
  if (guides) guides.checked = layout.canvas.magneticGuides !== false;
  document.body.classList.toggle('freeform-layout-mode', state.layoutMode === 'freeform');
}

function freeformSnap(value) {
   
   
  const layout = state.freeformLayout && state.freeformLayout.canvas ? state.freeformLayout : normalizeFreeformLayout(state.freeformLayout);
  const size = Math.max(5, Number(layout.canvas?.gridSize) || 40);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return layout.canvas?.snap === false ? numeric : Math.round(numeric / size) * size;
}

function freeformGeometryRecord(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return {
    id: String(obj.id || ''),
    cellKey: obj.cellKey ? String(obj.cellKey) : '',
    type: String(obj.type || 'seat'),
    label: String(obj.label || ''),
    color: obj.color || objectTypeColor(obj.type || 'seat'),
    x: Number.isFinite(Number(obj.x)) ? Number(obj.x) : 0,
    y: Number.isFinite(Number(obj.y)) ? Number(obj.y) : 0,
    width: Number.isFinite(Number(obj.width)) ? Math.max(obj.type === 'seat' ? MIN_FREEFORM_SEAT_WIDTH : 28, Number(obj.width)) : (obj.type === 'seat' ? DEFAULT_FREEFORM_SEAT_WIDTH : 160),
    height: Number.isFinite(Number(obj.height)) ? Math.max(obj.type === 'seat' ? MIN_FREEFORM_SEAT_HEIGHT : 24, Number(obj.height)) : (obj.type === 'seat' ? DEFAULT_FREEFORM_SEAT_HEIGHT : 96),
    rotation: Number.isFinite(Number(obj.rotation)) ? Number(obj.rotation) : 0,
    locked: Boolean(obj.locked),
    zIndex: Number.isFinite(Number(obj.zIndex)) ? Number(obj.zIndex) : 1
  };
}

function ensureFreeformGeometryCache() {
  if (!(uiState.freeformGeometryCache instanceof Map)) uiState.freeformGeometryCache = new Map();
  return uiState.freeformGeometryCache;
}

function rememberFreeformGeometry(objects = state.freeformLayout?.objects || [], { replace = false } = {}) {
  const cache = ensureFreeformGeometryCache();
  if (replace) cache.clear();
  if (!Array.isArray(objects)) return cache;
  objects.forEach(obj => {
    const record = freeformGeometryRecord(obj);
    if (!record || !record.id) return;
    cache.set(`id:${record.id}`, record);
    if (record.cellKey) cache.set(`cell:${record.cellKey}`, record);
  });
  uiState.freeformGeometryCacheReady = cache.size > 0;
  return cache;
}

function forgetFreeformGeometry(ids = []) {
  const cache = ensureFreeformGeometryCache();
  const idSet = new Set(Array.from(ids || []).map(String));
  if (!idSet.size) return;
  for (const key of Array.from(cache.keys())) {
    const record = cache.get(key);
    if (record && idSet.has(String(record.id || ''))) cache.delete(key);
  }
  uiState.freeformGeometryCacheReady = cache.size > 0;
}

function restoreFreeformGeometryFromCache({ seedIfEmpty = false } = {}) {
  if (!Array.isArray(state.freeformLayout?.objects)) return false;
  const cache = ensureFreeformGeometryCache();
  if (!cache.size && seedIfEmpty) {
    rememberFreeformGeometry(state.freeformLayout.objects, { replace: true });
    return false;
  }
  let restored = false;
  state.freeformLayout.objects.forEach(obj => {
    if (!obj || typeof obj !== 'object') return;
    const record = cache.get(`id:${String(obj.id || '')}`) || (obj.cellKey ? cache.get(`cell:${String(obj.cellKey)}`) : null);
    if (!record) return;
    obj.x = record.x;
    obj.y = record.y;
    obj.width = record.width;
    obj.height = record.height;
    obj.rotation = record.rotation;
    obj.type = record.type;
    obj.label = record.label;
    obj.color = safeColor(record.color, objectTypeColor(record.type));
    obj.locked = Boolean(record.locked);
    obj.zIndex = record.zIndex;
    restored = true;
  });
  return restored;
}

function resetFreeformGeometryCache() {
  const cache = ensureFreeformGeometryCache();
  cache.clear();
  uiState.freeformGeometryCacheReady = false;
  rememberFreeformGeometry(state.freeformLayout?.objects || [], { replace: true });
}

function freeformGeometrySessionClassKey() {
  return String(state.activeClassId || activeClassRecord()?.id || 'default-class');
}

function persistFreeformGeometrySession(reason = 'freeform-geometry') {
  if (!Array.isArray(state.freeformLayout?.objects) || !state.freeformLayout.objects.length) {
    clearFreeformGeometrySession();
    return true;
  }
  const records = state.freeformLayout.objects.map(freeformGeometryRecord).filter(Boolean);
  const payload = {
    revision: APP_REVISION,
    reason,
    savedAt: new Date().toISOString(),
    classId: freeformGeometrySessionClassKey(),
    layoutMode: state.layoutMode === 'freeform' ? 'freeform' : 'grid',
    canvas: deepClone(state.freeformLayout.canvas || {}),
    objects: records
  };
  return safeStorageSet('sessionStorage', FREEFORM_GEOMETRY_SESSION_KEY, JSON.stringify(payload));
}

function clearFreeformGeometrySession() {
  safeStorageRemove('sessionStorage', FREEFORM_GEOMETRY_SESSION_KEY);
}

function restoreFreeformGeometrySessionForCurrentClass() {
  if (!Array.isArray(state.freeformLayout?.objects) || !state.freeformLayout.objects.length) return false;
  let payload = null;
  try { payload = JSON.parse(safeStorageGet('sessionStorage', FREEFORM_GEOMETRY_SESSION_KEY) || 'null'); }
  catch (err) { payload = null; }
  if (!payload || !Array.isArray(payload.objects)) return false;
  const classKey = freeformGeometrySessionClassKey();
  if (payload.classId && String(payload.classId) !== classKey) return false;
  const byId = new Map();
  const byCell = new Map();
  payload.objects.forEach(record => {
    if (!record || typeof record !== 'object') return;
    if (record.id) byId.set(`id:${String(record.id)}`, record);
    if (record.cellKey) byCell.set(`cell:${String(record.cellKey)}`, record);
  });
  let restored = false;
  state.freeformLayout.objects.forEach(obj => {
    if (!obj || typeof obj !== 'object') return;
    const record = byId.get(`id:${String(obj.id || '')}`) || (obj.cellKey ? byCell.get(`cell:${String(obj.cellKey)}`) : null);
    if (!record) return;
    obj.x = clampNumber(record.x, 0, 12000);
    obj.y = clampNumber(record.y, 0, 12000);
    obj.width = clampNumber(record.width, obj.type === 'seat' ? MIN_FREEFORM_SEAT_WIDTH : 28, 2000);
    obj.height = clampNumber(record.height, obj.type === 'seat' ? MIN_FREEFORM_SEAT_HEIGHT : 24, 2000);
    obj.rotation = clampNumber(record.rotation, -360, 360);
    obj.type = record.type || obj.type || 'seat';
    obj.label = String(record.label || obj.label || '').slice(0, 80);
    obj.color = safeColor(record.color, objectTypeColor(obj.type));
    obj.locked = Boolean(record.locked);
    obj.zIndex = clampNumber(record.zIndex, 1, 100000);
    restored = true;
  });
  if (payload.canvas && typeof payload.canvas === 'object') {
    state.freeformLayout.canvas = {
      ...state.freeformLayout.canvas,
      width: clampNumber(payload.canvas.width ?? state.freeformLayout.canvas.width, 400, 12000),
      height: clampNumber(payload.canvas.height ?? state.freeformLayout.canvas.height, 300, 12000),
      gridSize: clampNumber(payload.canvas.gridSize ?? state.freeformLayout.canvas.gridSize, 5, 80),
      snap: payload.canvas.snap ?? state.freeformLayout.canvas.snap,
      frontSide: ['top','right','bottom','left'].includes(String(payload.canvas.frontSide || '').toLowerCase()) ? String(payload.canvas.frontSide).toLowerCase() : state.freeformLayout.canvas.frontSide,
      zoom: clampNumber(payload.canvas.zoom ?? state.freeformLayout.canvas.zoom ?? 1, 0.35, 1.75)
    };
  }
  if (restored) rememberFreeformGeometry(state.freeformLayout.objects || [], { replace: true });
  return restored;
}

function captureFreeformObjectStateSnapshot() {
  const objects = Array.isArray(state.freeformLayout?.objects) ? state.freeformLayout.objects : [];
  const snapshot = { byId: new Map(), byCellKey: new Map() };
  objects.forEach(obj => {
    if (!obj || typeof obj !== 'object') return;
    const item = {
      id: String(obj.id || ''),
      cellKey: obj.cellKey ? String(obj.cellKey) : '',
      type: String(obj.type || 'seat'),
      label: String(obj.label || ''),
      color: obj.color || objectTypeColor(obj.type || 'seat'),
      x: Number(obj.x) || 0,
      y: Number(obj.y) || 0,
      width: Math.max(obj.type === 'seat' ? MIN_FREEFORM_SEAT_WIDTH : 28, Number(obj.width) || (obj.type === 'seat' ? DEFAULT_FREEFORM_SEAT_WIDTH : 160)),
      height: Math.max(obj.type === 'seat' ? MIN_FREEFORM_SEAT_HEIGHT : 24, Number(obj.height) || (obj.type === 'seat' ? DEFAULT_FREEFORM_SEAT_HEIGHT : 96)),
      rotation: Number(obj.rotation) || 0,
      locked: Boolean(obj.locked),
      zIndex: Number(obj.zIndex) || 1,
      manual: Boolean(obj.manual),
      assignedStudentId: obj.assignedStudentId ? String(obj.assignedStudentId) : null,
      anchorGroupIds: deepClone(obj.anchorGroupIds || []),
      zoneIds: deepClone(obj.zoneIds || []),
      groupId: String(obj.groupId || '')
    };
    if (item.id) snapshot.byId.set(item.id, item);
    if (item.cellKey) snapshot.byCellKey.set(item.cellKey, item);
  });
  return snapshot;
}

function restoreFreeformObjectStateSnapshot(snapshot, { includeAssignments = false } = {}) {
  if (!snapshot || !Array.isArray(state.freeformLayout?.objects)) return false;
  let restored = false;
  state.freeformLayout.objects.forEach(obj => {
    if (!obj || typeof obj !== 'object') return;
    const item = snapshot.byId?.get(String(obj.id || '')) || (obj.cellKey ? snapshot.byCellKey?.get(String(obj.cellKey)) : null);
    if (!item) return;
    obj.x = item.x;
    obj.y = item.y;
    obj.width = item.width;
    obj.height = item.height;
    obj.rotation = item.rotation;
    obj.type = item.type;
    obj.label = item.label;
    obj.color = safeColor(item.color, objectTypeColor(item.type));
    obj.locked = item.locked;
    obj.zIndex = item.zIndex;
    obj.manual = item.manual;
    obj.groupId = String(item.groupId || '');
    if (includeAssignments) {
      obj.assignedStudentId = item.assignedStudentId;
      obj.anchorGroupIds = deepClone(item.anchorGroupIds || []);
      obj.zoneIds = deepClone(item.zoneIds || []);
    }
    restored = true;
  });
  return restored;
}

function commitFreeformLayoutChange(reason = 'freeform-edit', { render = true, syncToGrid = false, fullRender = false } = {}) {
  rememberFreeformGeometry(state.freeformLayout?.objects || []);
  const editedSnapshot = captureFreeformObjectStateSnapshot();
  ensureFreeformLayout();
  restoreFreeformGeometryFromCache();
   
   
   
   
   
  restoreFreeformObjectStateSnapshot(editedSnapshot, { includeAssignments: true });
  if (syncToGrid) syncFreeformAssignmentsToGridByPosition();
  restoreFreeformObjectStateSnapshot(editedSnapshot, { includeAssignments: true });
  restoreFreeformGeometryFromCache();
  rememberFreeformGeometry(state.freeformLayout?.objects || []);
  persistActiveClass();
  restoreFreeformObjectStateSnapshot(editedSnapshot, { includeAssignments: true });
  restoreFreeformGeometryFromCache();
  rememberFreeformGeometry(state.freeformLayout?.objects || []);
  persistFreeformGeometrySession(reason);
  scheduleLinkedAutoSave(reason);
  updateSaveHealthPanel();
  if (render) {
    if (fullRender) {
      renderAll();
      restoreFreeformObjectStateSnapshot(editedSnapshot, { includeAssignments: true });
    } else {
      renderFreeformLayout();
      renderStatus();
      updateCellSelectionVisuals();
      applyTooltips();
    }
  }
}

function selectedFreeformObject() {
  const id = Array.from(uiState.freeformSelectedObjectIds || [])[0];
  return (state.freeformLayout?.objects || []).find(obj => obj.id === id) || null;
}

function selectFreeformObject(id, additive = false, forceSingle = false) {
  if (!uiState.freeformSelectedObjectIds) uiState.freeformSelectedObjectIds = new Set();
  if (!additive) uiState.freeformSelectedObjectIds.clear();
  if (id) {
    const object = (state.freeformLayout?.objects || []).find(item => String(item.id) === String(id));
    const groupId = !forceSingle ? String(object?.groupId || '') : '';
    if (groupId) {
      (state.freeformLayout?.objects || []).filter(item => String(item.groupId || '') === groupId).forEach(item => uiState.freeformSelectedObjectIds.add(String(item.id)));
    } else {
      uiState.freeformSelectedObjectIds.add(String(id));
    }
  }
  updateFreeformSelectionVisuals();
}

function updateFreeformSelectionVisuals() {
  document.querySelectorAll('.freeform-object').forEach(node => {
    node.classList.toggle('selected', uiState.freeformSelectedObjectIds?.has(node.dataset.objectId));
  });
  ModernizationSuite?.onFreeformSelectionChanged?.();
  syncFreeformToolbarState();
}

function freeformSeatFallbackCell(obj) {
  if (!obj || obj.type !== 'seat' || !obj.cellKey) return null;
  const cell = state.cells?.[String(obj.cellKey)];
  return cell && cell.type === 'seat' ? cell : null;
}

function repairFreeformMissingAssignmentDetailsFromGrid() {
  if (!state.freeformLayout || !Array.isArray(state.freeformLayout.objects)) return;
  const assignedElsewhere = new Set(state.freeformLayout.objects
    .filter(obj => obj.type === 'seat' && obj.assignedStudentId)
    .map(obj => String(obj.assignedStudentId)));
  state.freeformLayout.objects.forEach(obj => {
    if (!obj || obj.type !== 'seat') return;
    const cell = freeformSeatFallbackCell(obj);
    if (!cell) return;
    if (!obj.assignedStudentId && cell.assignedStudentId && !assignedElsewhere.has(String(cell.assignedStudentId))) {
      obj.assignedStudentId = String(cell.assignedStudentId);
      obj.manual = Boolean(cell.manual);
      obj.locked = Boolean(cell.manual);
      assignedElsewhere.add(String(cell.assignedStudentId));
    }
    if ((!obj.anchorGroupIds || !obj.anchorGroupIds.length) && Array.isArray(cell.anchorGroupIds) && cell.anchorGroupIds.length) {
      obj.anchorGroupIds = deepClone(cell.anchorGroupIds);
    }
    if ((!obj.zoneIds || !obj.zoneIds.length) && Array.isArray(cell.zoneIds) && cell.zoneIds.length) {
      obj.zoneIds = deepClone(cell.zoneIds);
    }
  });
}

function gridSeatEntryForStudent(studentId) {
  const id = String(studentId || '');
  if (!id) return null;
  return Object.entries(state.cells || {}).find(([, cell]) => cell && cell.type === 'seat' && String(cell.assignedStudentId || '') === id) || null;
}

function ensureFreeformSeatGridLink(obj) {
  if (!obj || obj.type !== 'seat') return '';
  ensureGrid({ cleanup: false });
  if (obj.cellKey && state.cells[obj.cellKey] && state.cells[obj.cellKey].type === 'seat') return obj.cellKey;
  const assignedEntry = gridSeatEntryForStudent(obj.assignedStudentId);
  if (assignedEntry) {
    obj.cellKey = assignedEntry[0];
    return obj.cellKey;
  }
  const seats = freeformSeatObjectsSorted();
  const gridSeats = gridSeatEntriesSorted();
  const index = Math.max(0, seats.findIndex(seat => seat.id === obj.id));
  const mapped = gridSeats[index] || gridSeats.find(([, cell]) => !cell.assignedStudentId) || null;
  if (mapped) {
    obj.cellKey = mapped[0];
    return obj.cellKey;
  }
  return '';
}

function activeSeatEditFreeformObject() {
  const id = uiState.activeSeatEditFreeformObjectId || '';
  return id ? (state.freeformLayout?.objects || []).find(obj => obj.id === id && obj.type === 'seat') || null : null;
}

function mirrorGridSeatToFreeformObject(obj) {
  if (!obj || obj.type !== 'seat') return false;
  const cell = freeformSeatFallbackCell(obj);
  if (!cell) return false;
  obj.assignedStudentId = cell.assignedStudentId || null;
  obj.manual = Boolean(cell.manual);
  obj.locked = Boolean(cell.manual);
  obj.anchorGroupIds = deepClone(cell.anchorGroupIds || []);
  obj.zoneIds = deepClone(cell.zoneIds || []);
  obj.comment = String(cell.comment || '').slice(0, 1200);
  return true;
}

function mirrorLinkedFreeformSeatsFromGrid(cellKey = '') {
  if (!state.freeformLayout || !Array.isArray(state.freeformLayout.objects)) return;
  state.freeformLayout.objects.forEach(obj => {
    if (!obj || obj.type !== 'seat') return;
    if (cellKey && String(obj.cellKey || '') !== String(cellKey)) return;
    mirrorGridSeatToFreeformObject(obj);
  });
}

function mirrorFreeformSeatToGrid(obj, { clearStudentDuplicates = true, preserveObjectLock = true } = {}) {
  if (!obj) return false;
  ensureGrid({ cleanup: false });
  if (obj.type !== 'seat') {
    if (obj.cellKey && state.cells[obj.cellKey]) applyCellTypeWithoutRender(obj.cellKey, obj.type || 'empty');
    return true;
  }
  const cellKey = ensureFreeformSeatGridLink(obj);
  const cell = cellKey ? state.cells[cellKey] : null;
  if (!cell) return false;
  if (clearStudentDuplicates && obj.assignedStudentId) {
    Object.entries(state.cells).forEach(([key, other]) => {
      if (key !== cellKey && other && other.assignedStudentId === obj.assignedStudentId) {
        other.assignedStudentId = null;
        other.manual = false;
      }
    });
  }
  cell.type = 'seat';
  cell.assignedStudentId = obj.assignedStudentId || null;
  cell.manual = Boolean(obj.assignedStudentId && (obj.locked || obj.manual));
  obj.manual = Boolean(cell.manual);
  if (!preserveObjectLock) obj.locked = Boolean(cell.manual);
  cell.anchorGroupIds = deepClone(obj.anchorGroupIds || []);
  cell.zoneIds = deepClone(obj.zoneIds || []);
  cell.comment = String(obj.comment || '').slice(0, 1200);
  return true;
}

function mirrorActiveSeatEditFreeformFromGrid() {
  const obj = activeSeatEditFreeformObject();
  if (!obj) return false;
  mirrorGridSeatToFreeformObject(obj);
  return true;
}

function setFreeformObjectLocked(obj, locked) {
  if (!obj) return false;
  obj.locked = Boolean(locked);
  if (obj.type === 'seat') {
    obj.manual = Boolean(obj.assignedStudentId && obj.locked);
    mirrorFreeformSeatToGrid(obj, { preserveObjectLock: true });
  }
  return true;
}

function activeSeatEditIsBatch() {
  return (uiState.activeSeatEditBatchCellKeys || []).length > 1;
}

function activeSeatEditTargets() {
  const freeformById = new Map((state.freeformLayout?.objects || []).map(obj => [String(obj.id), obj]));
  const freeformIds = new Set((uiState.activeSeatEditBatchFreeformObjectIds || []).map(String));
  const keys = activeSeatEditIsBatch()
    ? (uiState.activeSeatEditBatchCellKeys || [])
    : [uiState.activeSeatEditCellKey].filter(Boolean);
  return keys.map(key => {
    const cell = state.cells?.[key] || null;
    const object = [...freeformIds].map(id => freeformById.get(id)).find(obj => String(obj?.cellKey || '') === String(key))
      || (String(activeSeatEditFreeformObject()?.cellKey || '') === String(key) ? activeSeatEditFreeformObject() : null);
    return { key, cell, object, locked: object ? Boolean(object.locked) : Boolean(cell?.manual) };
  }).filter(item => item.cell?.type === 'seat');
}

function editableSeatEditTargets() {
  return activeSeatEditTargets().filter(item => !item.locked);
}

function activeSeatEditLocked() {
  const targets = activeSeatEditTargets();
  return targets.length > 0 && targets.every(item => item.locked);
}

function blockLockedSeatEditAction() {
  setLiveStatusMessage(activeSeatEditIsBatch()
    ? 'Every selected seat is locked. Unlock seats before changing their groups or zones.'
    : 'Unlock this seat before changing its student, groups, zones, type, or assignment.');
  return true;
}

function setSeatEditLockedControls(isLocked) {
  const batch = activeSeatEditIsBatch();
  const ids = ['seatEditStudentSelect','seatEditAssignStudentBtn','seatEditClearStudentBtn','seatEditGroupSelect','seatEditAddGroupBtn','seatEditClearGroupsBtn','seatEditZoneSelect','seatEditAddZoneBtn','seatEditClearZonesBtn','seatEditTypeSelect','seatEditApplyTypeBtn'];
  ids.forEach(id => {
    const node = el(id);
    if (!node) return;
    const batchAllowed = batch && ['seatEditGroupSelect','seatEditAddGroupBtn','seatEditClearGroupsBtn','seatEditZoneSelect','seatEditAddZoneBtn','seatEditClearZonesBtn'].includes(id);
    const disabled = batchAllowed ? editableSeatEditTargets().length === 0 : Boolean(isLocked);
    node.disabled = disabled;
    node.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    if (disabled) node.title = batchAllowed ? 'Every selected seat is locked.' : 'Unlock this seat before editing this value.';
    else if (!['seatEditZoneSelect','seatEditAddZoneBtn','seatEditClearZonesBtn'].includes(id)) node.removeAttribute('title');
  });
  const modal = el('seatEditModal');
  modal?.classList.toggle('seat-edit-locked', Boolean(isLocked));
  modal?.querySelector('.seat-edit-modal')?.classList.toggle('batch-edit', batch);
  const notice = el('seatEditLockNotice');
  if (notice) notice.hidden = batch || !isLocked;
}

function freeformObjectStudent(obj, lookups) {
  if (!obj || obj.type !== 'seat') return null;
  let studentId = obj.assignedStudentId || '';
  if (!studentId) {
    const cell = freeformSeatFallbackCell(obj);
    studentId = cell?.assignedStudentId || '';
  }
  return lookups.students.get(String(studentId || '')) || null;
}

function freeformObjectGroupDisplay(obj, student, lookups) {
  const cell = freeformSeatFallbackCell(obj);
  const studentGroups = student ? (lookups.groupsByStudent.get(String(student.id)) || []) : [];
  const anchorIds = Array.from(new Set([...(obj.anchorGroupIds || []), ...((!obj.anchorGroupIds || !obj.anchorGroupIds.length) ? (cell?.anchorGroupIds || []) : [])].map(String)));
  const anchors = anchorIds.map(id => lookups.groups.get(String(id))).filter(Boolean);
  const zoneIds = Array.from(new Set([...(obj.zoneIds || []), ...((!obj.zoneIds || !obj.zoneIds.length) ? (cell?.zoneIds || []) : [])].map(String)));
  const pseudoCell = { zoneIds };
  const studentGroupTitle = studentGroups.length
    ? `Student group colors: ${studentGroups.map(b => `${b.name} (${typeLabel(b.type)}, priority ${b.priority})`).join(' | ')}`
    : '';
  const anchorTitle = anchors.length
    ? `Seat reserved for: ${anchors.map(b => `${b.name} (${typeLabel(b.type)}, priority ${b.priority})`).join(' | ')}`
    : '';
  const primaryGroup = studentGroups[0] || anchors[0] || null;
  const chips = [
    ...studentGroups.map(b => `<span class="freeform-group-chip" title="Student group: ${escapeHtml(b.name)}"><span class="freeform-group-dot" style="background:${escapeHtml(b.color)}"></span>${escapeHtml(b.name)}</span>`),
    ...anchors.filter(anchor => !studentGroups.some(b => String(b.id) === String(anchor.id))).map(b => `<span class="freeform-group-chip reserved" title="Reserved for group: ${escapeHtml(b.name)}"><span class="freeform-group-dot" style="background:${escapeHtml(b.color)}"></span>${escapeHtml(b.name)}</span>`)
  ];
  return {
    studentGroups,
    anchors,
    zones: zoneIds.map(id => lookups.zones.get(String(id))).filter(Boolean),
    bars: '',
    primaryColor: primaryGroup ? safeColor(primaryGroup.color) : '',
    chipsHtml: chips.length ? `<div class="freeform-group-summary">${chips.join('')}</div>` : '',
    zonesHtml: zoneIds.length ? zoneTagsHtml(pseudoCell, lookups.zones) : '',
    titleText: [studentGroupTitle, anchorTitle, zoneIds.length ? `Zones: ${zoneIds.map(id => lookups.zones.get(String(id))?.name || id).join(', ')}` : ''].filter(Boolean).join(' | ')
  };
}

function freeformObjectLabel(obj, lookups) {
  if (!obj) return '';
  if (obj.type === 'seat') {
    const student = freeformObjectStudent(obj, lookups);
    return student ? studentDisplay(student) : (obj.label ? `${obj.label} · Unassigned seat` : 'Unassigned seat');
  }
  return obj.label || objectLabel(obj.type);
}

function freeformObjectInnerHtml(obj, lookups) {
  const student = freeformObjectStudent(obj, lookups);
  const locked = obj.locked || obj.manual;
  if (obj.type === 'seat') {
    const groupDisplay = freeformObjectGroupDisplay(obj, student, lookups);
    const seatLabel = String(obj.label || '').trim();
    const seatLabelHtml = seatLabel && !/^seat$/i.test(seatLabel) ? `<span class="pill subtle" title="${escapeHtml(seatLabel)}">${escapeHtml(seatLabel)}</span>` : '';
    return `
          ${groupDisplay.bars}
          <div class="freeform-object-title${student ? '' : ' placeholder'}">${student ? seatStudentHtml(student) : 'Unassigned'}</div>
          <div class="freeform-object-meta"><span class="pill freeform-type-pill">Seat</span>${seatLabelHtml}${groupDisplay.studentGroups.length ? `<span class="pill" title="${escapeHtml(groupDisplay.titleText)}">${groupDisplay.studentGroups.length} group${groupDisplay.studentGroups.length === 1 ? '' : 's'}</span>` : ''}${groupDisplay.anchors.length ? `<span class="pill" title="${escapeHtml(groupDisplay.titleText)}">${groupDisplay.anchors.length} reserved</span>` : ''}</div>
          ${groupDisplay.chipsHtml}
          ${groupDisplay.zonesHtml}
          <div class="freeform-object-actions no-print">
            ${student ? `<button class="tiny secondary" data-freeform-clear-seat="${escapeHtml(obj.id)}" title="Clear this student from the freeform seat." aria-label="Clear student from this freeform seat">Clear</button>` : ''}
            <button class="tiny secondary" data-freeform-lock="${escapeHtml(obj.id)}" title="${locked ? 'Unlock this freeform seat' : 'Lock this freeform seat'}" aria-label="${locked ? 'Unlock this freeform seat' : 'Lock this freeform seat'}">${locked ? 'Unlock' : 'Lock'}</button>
          </div>`;
  }
  return `
        <div class="freeform-object-title">${escapeHtml(obj.label || objectLabel(obj.type))}</div>
        <div class="freeform-object-meta"><span class="pill subtle freeform-type-pill">${escapeHtml(objectLabel(obj.type))}</span></div>
        <div class="freeform-object-actions no-print">
          <button class="tiny secondary" data-freeform-lock="${escapeHtml(obj.id)}" title="${locked ? 'Unlock this freeform object' : 'Lock this freeform object'}" aria-label="${locked ? 'Unlock this freeform object' : 'Lock this freeform object'}">${locked ? 'Unlock' : 'Lock'}</button>
        </div>`;
}

function syncFreeformToolbarState() {
  const selectedIds = uiState.freeformSelectedObjectIds || new Set();
  const selected = (state.freeformLayout?.objects || []).filter(obj => selectedIds.has(obj.id));
  const count = selected.length;
  const primary = selected[0] || null;
  const allLocked = count > 0 && selected.every(obj => obj.locked || obj.manual);
  const selectionStatus = el('freeformSelectionStatus');
  if (selectionStatus) {
    if (!count) selectionStatus.textContent = 'No object selected';
    else if (count === 1) selectionStatus.textContent = `${freeformObjectLabel(primary, buildLookupMaps())} selected`;
    else selectionStatus.textContent = `${count} selected`;
  }
  const lockBtn = el('lockFreeformObjectBtn');
  if (lockBtn) {
    lockBtn.disabled = !count;
    lockBtn.textContent = !count ? 'Lock' : count > 1 ? (allLocked ? 'Unlock Selected' : 'Lock / Unlock') : (primary?.locked || primary?.manual ? 'Unlock' : 'Lock');
    lockBtn.title = !count ? 'Select an object first.' : count > 1 ? 'Lock or unlock the current selection.' : (primary?.locked || primary?.manual ? 'Unlock the selected object.' : 'Lock the selected object.');
    lockBtn.setAttribute('aria-label', lockBtn.title);
  }
  const duplicateBtn = el('duplicateFreeformObjectBtn');
  if (duplicateBtn) duplicateBtn.disabled = !count;
  const deleteBtn = el('deleteFreeformObjectBtn');
  if (deleteBtn) deleteBtn.disabled = !count;
  const rotateBtn = el('rotateFreeformObjectBtn');
  if (rotateBtn) rotateBtn.disabled = count !== 1 || eyeModeBlocksRoomEditing();
  ['toggleFreeformMinimapBtn','toggleFreeformMinimapInlineBtn'].forEach(id => {
    const minimapBtn = el(id);
    if (minimapBtn) {
      const visible = state.freeformLayout?.canvas?.showMinimap !== false;
      minimapBtn.textContent = visible ? 'Hide Minimap' : 'Show Minimap';
      minimapBtn.setAttribute('aria-pressed', visible ? 'true' : 'false');
    }
  });
  const cleanViewBtn = el('toggleFreeformCleanViewBtn');
  if (cleanViewBtn) {
    const active = !!pageSettings().freeformCleanView;
    cleanViewBtn.textContent = active ? 'Exit Clean View' : 'Clean View';
    cleanViewBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
}

function renderFreeformLayout() {
  restoreFreeformGeometryFromCache({ seedIfEmpty: true });
  const freeformRenderSnapshot = captureFreeformObjectStateSnapshot();
  ensureFreeformLayout();
  restoreFreeformGeometryFromCache();
  restoreFreeformObjectStateSnapshot(freeformRenderSnapshot, { includeAssignments: false });
  restoreFreeformGeometryFromCache();
  repairFreeformMissingAssignmentDetailsFromGrid();
  restoreFreeformObjectStateSnapshot(freeformRenderSnapshot, { includeAssignments: false });
  const grid = el('seatGrid');
  if (!grid) return;
  const layout = state.freeformLayout;
  const lookups = buildLookupMaps();
  const assignedIds = new Set();
  const seatCount = layout.objects.filter(obj => obj.type === 'seat').length;
  layout.objects.forEach(obj => {
    const student = freeformObjectStudent(obj, lookups);
    if (student) assignedIds.add(String(student.id));
  });
  grid.classList.add('freeform-canvas');
  grid.style.gridTemplateColumns = '';
  grid.style.gridAutoRows = '';
  grid.style.setProperty('--cell-height', 'auto');
  grid.style.width = `${layout.canvas.width}px`;
  grid.style.height = `${layout.canvas.height}px`;
  grid.style.backgroundSize = `${layout.canvas.gridSize}px ${layout.canvas.gridSize}px`;
  grid.style.transform = `scale(${freeformCanvasZoom(layout)})`;
  grid.style.transformOrigin = 'top left';
  syncFreeformCanvasStage(layout);
  const frontSide = freeformRoomFrontSide();
  grid.innerHTML = `<div class="freeform-room-marker front side-${frontSide}" aria-hidden="true">Front of Room</div>`;
  const fragment = document.createDocumentFragment();
  [...layout.objects].sort((a, b) => (Number(a.zIndex) || 1) - (Number(b.zIndex) || 1)).forEach(obj => {
    const node = document.createElement('div');
    const student = freeformObjectStudent(obj, lookups);
    const groupDisplay = obj.type === 'seat' ? freeformObjectGroupDisplay(obj, student, lookups) : null;
    const seatStateClass = obj.type === 'seat' ? (student ? ' assigned' : ' unassigned') : '';
    const groupClasses = groupDisplay ? [groupDisplay.studentGroups.length || groupDisplay.anchors.length ? 'has-groups' : '', groupDisplay.zones.length ? 'has-zones' : ''].filter(Boolean).join(' ') : '';
    node.className = `freeform-object ${obj.type}${seatStateClass}${obj.locked ? ' locked' : ''}${obj.groupId ? ' grouped' : ''}${uiState.freeformAuditObjectIds?.has?.(obj.id) ? ' audit-highlight' : ''}${groupClasses ? ' ' + groupClasses : ''}`;
    node.dataset.objectId = obj.id;
    node.dataset.type = obj.type;
    node.dataset.groupId = obj.groupId || '';
    node.style.left = `${obj.x}px`;
    node.style.top = `${obj.y}px`;
    node.style.width = `${obj.width}px`;
    node.style.height = `${obj.height}px`;
    node.style.zIndex = String(obj.zIndex || 1);
    node.style.background = obj.color || objectTypeColor(obj.type);
    if (groupDisplay?.primaryColor) node.style.borderColor = groupDisplay.primaryColor;
    node.style.transform = `rotate(${Number(obj.rotation) || 0}deg)`;
    node.title = `${freeformObjectLabel(obj, lookups)} · x ${Math.round(obj.x)}, y ${Math.round(obj.y)}${obj.rotation ? ` · ${obj.rotation}°` : ''}${groupDisplay?.titleText ? ` · ${groupDisplay.titleText}` : ''}`;
    node.innerHTML = `${freeformObjectInnerHtml(obj, lookups)}<button type="button" class="freeform-rotate-handle freeform-rotate-counterclockwise no-print" data-freeform-rotate="${escapeHtml(obj.id)}" data-freeform-rotate-direction="-1" aria-label="Rotate counterclockwise. Click for 15 degrees or drag for free rotation." title="Rotate counterclockwise 15°; drag for free rotation">⟲</button><button type="button" class="freeform-rotate-handle freeform-rotate-clockwise no-print" data-freeform-rotate="${escapeHtml(obj.id)}" data-freeform-rotate-direction="1" aria-label="Rotate clockwise. Click for 15 degrees or drag for free rotation." title="Rotate clockwise 15°; drag for free rotation">⟳</button><span class="freeform-resize-handle no-print" data-freeform-resize="${escapeHtml(obj.id)}" title="Resize"></span>`;
    if (obj.type === 'seat') {
      node.title += ' · Double-click with a mouse, or double-tap or press and hold on touch, to open seat settings.';
    }
    fragment.appendChild(node);
  });
  grid.appendChild(fragment);
  installFreeformEventDelegation(grid);
  grid.onclick = event => { if (uiState.suppressFreeformCanvasClick) { uiState.suppressFreeformCanvasClick = false; return; } if (!event.target.closest('.freeform-object')) selectFreeformObject(null); };
  grid.ondragover = event => { if (state.layoutMode === 'freeform') event.preventDefault(); };
  grid.ondrop = event => {
    if (state.layoutMode !== 'freeform') return;
    event.preventDefault();
    let data;
    try { data = JSON.parse(event.dataTransfer.getData('application/json')); } catch { return; }
    if (data.type === 'student') {
      setLiveStatusMessage('Drop students directly onto an existing freeform seat. Blank canvas drops do not create seats; use Add Object > Seat when you need another seat.');
    }
  };
  el('printStats').textContent = `${printChartMetaLine() || activeClassName()} · Freeform layout · ${state.students.length} students · ${seatCount} seats · ${assignedIds.size} assigned`;
  syncSeatDisplayControls();
  updateFreeformSelectionVisuals();
  document.querySelectorAll('.freeform-object[data-object-id]').forEach(node => node.classList.toggle('keyboard-freeform-selected', uiState.freeformSelectedObjectIds?.has(node.dataset.objectId)));
  syncFreeformToolbarState();
  ModernizationSuite?.enhanceRenderedWorkspace?.();
}

function freeformRotationTargets(id) {
  restoreFreeformGeometryFromCache();
  const objects = state.freeformLayout?.objects || [];
  const selected = objects.filter(item => uiState.freeformSelectedObjectIds?.has(item.id) && !item.locked);
  return selected.length && selected.some(item => item.id === id)
    ? selected
    : objects.filter(item => item.id === id && !item.locked);
}

function freeformPointerAngle(event, center) {
  return Math.atan2(event.clientY - center.y, event.clientX - center.x) * 180 / Math.PI;
}

function shortestRotationDelta(from, to) {
  return ((to - from + 540) % 360) - 180;
}

function normalizedRotation(value) {
  const rotation = Number(value) || 0;
  const normalized = ((rotation % 360) + 360) % 360;
  return Math.round(normalized * 10) / 10;
}

function suppressNextFreeformRotateClick(objectId) {
  const suppression = { id: objectId, until: Date.now() + 700 };
  uiState.suppressFreeformRotateClick = suppression;
  setTimeout(() => {
    if (uiState.suppressFreeformRotateClick === suppression) uiState.suppressFreeformRotateClick = null;
  }, 0);
}

function beginFreeformPointerRotation(event, id, direction = 1) {
  if (event.button !== 0 || eyeModeBlocksRoomEditing()) return;
  const targets = freeformRotationTargets(id);
  if (!targets.length) {
    setLiveStatusMessage('Unlock the Freeform object before rotating it.');
    return;
  }
  const objectNode = event.target.closest('.freeform-object[data-object-id]');
  const handle = event.target.closest('[data-freeform-rotate]');
  if (!objectNode || !handle) return;
  const rect = objectNode.getBoundingClientRect();
  const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const startAngle = freeformPointerAngle(event, center);
  const originals = new Map(targets.map(item => [item.id, Number(item.rotation) || 0]));
  const targetIds = new Set(targets.map(item => item.id));
  uiState.freeformRotation = {
    id,
    direction: direction < 0 ? -1 : 1,
    pointerId: event.pointerId,
    handle,
    center,
    startX: event.clientX,
    startY: event.clientY,
    lastPointerAngle: startAngle,
    accumulatedDelta: 0,
    originals,
    targetIds,
    active: false,
    changed: false,
    undoCaptured: false,
    blocked: false
  };
  event.preventDefault();
  event.stopPropagation();
  handle.setPointerCapture?.(event.pointerId);
  const move = moveEvent => updateFreeformPointerRotation(moveEvent);
  const finish = finishEvent => finishFreeformPointerRotation(finishEvent);
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', finish, { once: true });
  document.addEventListener('pointercancel', finish, { once: true });
  uiState.freeformRotation.cleanup = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', finish);
    document.removeEventListener('pointercancel', finish);
  };
}

function updateFreeformPointerRotation(event) {
  const rotation = uiState.freeformRotation;
  if (!rotation || event.pointerId !== rotation.pointerId) return;
  const distance = Math.hypot(event.clientX - rotation.startX, event.clientY - rotation.startY);
  const currentAngle = freeformPointerAngle(event, rotation.center);
  const delta = shortestRotationDelta(rotation.lastPointerAngle, currentAngle);
  rotation.lastPointerAngle = currentAngle;
  rotation.accumulatedDelta += delta;
  if (!rotation.active && distance < 4 && Math.abs(rotation.accumulatedDelta) < 2) return;
  rotation.active = true;
  event.preventDefault();
  const objects = state.freeformLayout?.objects || [];
  const targets = objects.filter(item => rotation.targetIds.has(item.id));
  const external = objects.filter(item => !rotation.targetIds.has(item.id));
  const requestedDelta = event.shiftKey
    ? Math.round(rotation.accumulatedDelta / 15) * 15
    : rotation.accumulatedDelta;
  const candidates = new Map(targets.map(item => [item.id, {
    rotation: normalizedRotation((rotation.originals.get(item.id) || 0) + requestedDelta)
  }]));
  const overlap = targets.find(item => findFreeformOverlap(item, candidates.get(item.id), external, {
    phase: 'drop',
    excludeIds: rotation.targetIds
  }));
  if (overlap) {
    rotation.blocked = true;
    if (!rotation.lastOverlapMessageAt || Date.now() - rotation.lastOverlapMessageAt > 900) {
      rotation.lastOverlapMessageAt = Date.now();
      setLiveStatusMessage('Free rotation is blocked because the new angle would overlap another room object.');
    }
    return;
  }
  if (!rotation.undoCaptured) {
    pushUndoSnapshot('Before freeform rotation');
    rotation.undoCaptured = true;
  }
  rotation.blocked = false;
  rotation.changed = true;
  targets.forEach(item => {
    item.rotation = candidates.get(item.id).rotation;
    const node = document.querySelector(`.freeform-object[data-object-id="${cssEscape(item.id)}"]`);
    if (node) {
      node.classList.add('freeform-rotating');
      node.style.transform = `rotate(${item.rotation}deg)`;
    }
  });
  ModernizationSuite?.updateFreeformMinimap?.();
}

function finishFreeformPointerRotation(event) {
  const rotation = uiState.freeformRotation;
  if (!rotation || event.pointerId !== rotation.pointerId) return;
  rotation.cleanup?.();
  rotation.handle?.releasePointerCapture?.(event.pointerId);
  document.querySelectorAll('.freeform-object.freeform-rotating').forEach(node => node.classList.remove('freeform-rotating'));
  uiState.freeformRotation = null;
  if (!rotation.active) {
    if (event.type === 'pointercancel') return;
    event.preventDefault();
    suppressNextFreeformRotateClick(rotation.id);
    rotateFreeformObject(rotation.id, rotation.direction * 15);
    return;
  }
  event.preventDefault();
  suppressNextFreeformRotateClick(rotation.id);
  if (!rotation.changed) {
    setLiveStatusMessage(rotation.blocked
      ? 'The object stayed at its previous angle because the requested rotation would overlap another room object.'
      : 'Free rotation ended without changing the object angle.');
    renderFreeformLayout();
    return;
  }
  const targets = (state.freeformLayout?.objects || []).filter(item => rotation.targetIds.has(item.id));
  rememberFreeformGeometry(targets);
  persistFreeformGeometrySession('freeform-rotate-finish');
  commitFreeformLayoutChange('freeform-rotate-object', { render: true, syncToGrid: false });
  const primary = targets.find(item => item.id === rotation.id) || targets[0];
  setLiveStatusMessage(`${targets.length === 1 ? 'Object' : `${targets.length} objects`} rotated to ${Math.round(Number(primary?.rotation) || 0)}°.`);
}

function beginFreeformPointerDrag(event, id) {
  if (event.button !== 0 || eyeModeBlocksRoomEditing()) return;
  if (isMobileViewport() && (uiState.mobileRoomPanActive || document.body.dataset.workflow !== 'room')) return;
  restoreFreeformGeometryFromCache();
  const obj = (state.freeformLayout?.objects || []).find(item => item.id === id);
  if (!obj) return;
  const rotateControl = event.target.closest('[data-freeform-rotate]');
  if (rotateControl?.dataset.freeformRotate === id) {
    beginFreeformPointerRotation(event, id, Number(rotateControl.dataset.freeformRotateDirection) < 0 ? -1 : 1);
    return;
  }
  if (event.target.closest('button')) return;
  const resize = event.target.dataset.freeformResize === id;
  const alreadySelected = uiState.freeformSelectedObjectIds?.has(id);
  const groupedIds = obj.groupId
    ? (state.freeformLayout?.objects || []).filter(item => String(item.groupId || '') === String(obj.groupId)).map(item => String(item.id))
    : [];
  const selectionCoversGroup = groupedIds.length > 0 && groupedIds.every(groupedId => uiState.freeformSelectedObjectIds?.has(groupedId));
  if (!alreadySelected || event.shiftKey || event.altKey || (obj.groupId && !selectionCoversGroup)) {
    selectFreeformObject(id, event.shiftKey, event.altKey);
  }
  const selectedIds = resize ? new Set([id]) : new Set(uiState.freeformSelectedObjectIds || [id]);
  const dragObjects = (state.freeformLayout?.objects || []).filter(item => selectedIds.has(item.id) && !item.locked);
  if (!dragObjects.length) return;
  const originals = new Map(dragObjects.map(item => [item.id, { x:item.x, y:item.y, width:item.width, height:item.height, zIndex:item.zIndex }]));
  uiState.freeformDrag = {
    id,
    ids: new Set(dragObjects.map(item => item.id)),
    resize,
    activated: false,
    pointerId: event.pointerId,
    handle: event.target.closest('.freeform-object[data-object-id]') || event.currentTarget,
    startX: event.clientX,
    startY: event.clientY,
    originals,
    lastDropValid: new Map(dragObjects.map(item => [item.id, { ...originals.get(item.id) }])),
    blocked: false,
    dropInvalid: false,
    temporarySnapOverride: false,
    beforeRuleFindings: evaluateCurrentRuleViolations({ includeUnseated: false }),
    undoStackLengthBefore: uiState.undoStack.length,
    undoHistoryLengthBefore: (uiState.undoHistoryLabels || []).length
  };
  const move = ev => updateFreeformPointerDrag(ev);
  const finish = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', finish);
    document.removeEventListener('pointercancel', finish);
    finishFreeformPointerDrag();
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', finish, { once: true });
  document.addEventListener('pointercancel', finish, { once: true });
}

function updateFreeformPointerDrag(event) {
  const drag = uiState.freeformDrag;
  if (!drag || (drag.pointerId !== undefined && event.pointerId !== undefined && drag.pointerId !== event.pointerId)) return;
  const objects = state.freeformLayout?.objects || [];
  const primary = objects.find(item => item.id === drag.id);
  if (!primary) return;
  if (!drag.activated) {
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    drag.activated = true;
    pushUndoSnapshot('Before freeform pointer edit');
    drag.handle?.setPointerCapture?.(drag.pointerId);
    objects.filter(item => drag.ids.has(item.id)).forEach(item => { item.zIndex = state.freeformLayout.nextZ++; });
  }
  event.preventDefault();
  const zoom = freeformCanvasZoom();
  let dx = (event.clientX - drag.startX) / zoom;
  let dy = (event.clientY - drag.startY) / zoom;
  const layout = state.freeformLayout?.canvas || {};
  const temporarySnapOverride = Boolean(event.altKey);
  drag.temporarySnapOverride = temporarySnapOverride;
  const useGridSnap = layout.snap !== false && !temporarySnapOverride;
  if (!drag.resize && event.shiftKey) {
    if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
    else dx = 0;
  }
  const snapValue = value => useGridSnap ? freeformSnap(value) : Number(value);
  const snapStatus = el('freeformSnapTarget');
  if (snapStatus) {
    snapStatus.classList.add('active');
    snapStatus.textContent = temporarySnapOverride ? 'Snap temporarily off (Alt/Option)' : event.shiftKey && !drag.resize ? 'Axis locked · grid snap' : (useGridSnap ? 'Snap: grid + guides' : 'Snap: guides only');
  }
  let candidates = new Map();
  if (drag.resize) {
    const original = drag.originals.get(primary.id);
    candidates.set(primary.id, {
      width: Math.max(primary.type === 'seat' ? MIN_FREEFORM_SEAT_WIDTH : 28, snapValue(original.width + dx)),
      height: Math.max(primary.type === 'seat' ? MIN_FREEFORM_SEAT_HEIGHT : 24, snapValue(original.height + dy))
    });
  } else {
    const originalPrimary = drag.originals.get(primary.id);
    if (!originalPrimary) return;
    const canvasWidth = Number(layout.width) || 2800;
    const canvasHeight = Number(layout.height) || 1800;
    const originalSelection = Array.from(drag.ids).map(objectId => {
      const item = objects.find(candidate => candidate.id === objectId);
      const original = drag.originals.get(objectId);
      return item && original ? { item, original } : null;
    }).filter(Boolean);
    const minOriginalX = Math.min(...originalSelection.map(entry => entry.original.x));
    const minOriginalY = Math.min(...originalSelection.map(entry => entry.original.y));
    const maxOriginalRight = Math.max(...originalSelection.map(entry => entry.original.x + (Number(entry.item.width) || DEFAULT_FREEFORM_SEAT_WIDTH)));
    const maxOriginalBottom = Math.max(...originalSelection.map(entry => entry.original.y + (Number(entry.item.height) || DEFAULT_FREEFORM_SEAT_HEIGHT)));
    const desiredPrimaryX = layout.snap === false ? originalPrimary.x + dx : freeformSnap(originalPrimary.x + dx);
    const desiredPrimaryY = layout.snap === false ? originalPrimary.y + dy : freeformSnap(originalPrimary.y + dy);
    let deltaX = desiredPrimaryX - originalPrimary.x;
    let deltaY = desiredPrimaryY - originalPrimary.y;
    deltaX = clampNumber(deltaX, -minOriginalX, canvasWidth - maxOriginalRight);
    deltaY = clampNumber(deltaY, -minOriginalY, canvasHeight - maxOriginalBottom);
    originalSelection.forEach(({ item, original }) => {
      candidates.set(item.id, { x: original.x + deltaX, y: original.y + deltaY });
    });
    drag.magneticAlignedX = false;
    drag.magneticAlignedY = false;
    candidates = ModernizationSuite?.applyMagneticAlignment?.(drag, candidates) || candidates;
    const candidateEntries = Array.from(candidates.entries()).map(([objectId, candidate]) => {
      const item = objects.find(value => value.id === objectId);
      return item ? { objectId, item, candidate } : null;
    }).filter(Boolean);
    if (candidateEntries.length) {
      const minX = Math.min(...candidateEntries.map(entry => Number(entry.candidate.x) || 0));
      const minY = Math.min(...candidateEntries.map(entry => Number(entry.candidate.y) || 0));
      const maxRight = Math.max(...candidateEntries.map(entry => (Number(entry.candidate.x) || 0) + (Number(entry.item.width) || DEFAULT_FREEFORM_SEAT_WIDTH)));
      const maxBottom = Math.max(...candidateEntries.map(entry => (Number(entry.candidate.y) || 0) + (Number(entry.item.height) || DEFAULT_FREEFORM_SEAT_HEIGHT)));
      const boundaryShiftX = minX < 0 ? -minX : maxRight > canvasWidth ? canvasWidth - maxRight : 0;
      const boundaryShiftY = minY < 0 ? -minY : maxBottom > canvasHeight ? canvasHeight - maxBottom : 0;
      if (boundaryShiftX || boundaryShiftY) {
        const bounded = new Map();
        candidates.forEach((candidate, objectId) => bounded.set(objectId, {
          ...candidate,
          x: candidate.x == null ? candidate.x : candidate.x + boundaryShiftX,
          y: candidate.y == null ? candidate.y : candidate.y + boundaryShiftY
        }));
        candidates = bounded;
      }
    }
  }
  const externalObjects = objects.filter(item => !drag.ids.has(item.id));
  let blockingOverlap = null;
  for (const [objectId, candidate] of candidates) {
    const item = objects.find(value => value.id === objectId);
    blockingOverlap = findFreeformOverlap(item, candidate, externalObjects, { phase:'drag', excludeIds:drag.ids });
    if (blockingOverlap) break;
  }
  if (blockingOverlap) {
    drag.blocked = true;
    if (!drag.lastOverlapMessageAt || Date.now() - drag.lastOverlapMessageAt > 1000) {
      drag.lastOverlapMessageAt = Date.now();
      setLiveStatusMessage(`Freeform movement is blocked by ${freeformObjectLabel(blockingOverlap, buildLookupMaps())}.`);
    }
    return;
  }
  for (const [objectId, candidate] of candidates) {
    const item = objects.find(value => value.id === objectId);
    if (item) Object.assign(item, candidate);
  }
  let dropInvalid = false;
  for (const objectId of drag.ids) {
    const item = objects.find(value => value.id === objectId);
    if (findFreeformOverlap(item, null, externalObjects, { phase:'drop', excludeIds:drag.ids })) { dropInvalid = true; break; }
  }
  drag.dropInvalid = dropInvalid;
  if (!dropInvalid) {
    drag.lastDropValid = new Map(Array.from(drag.ids).map(objectId => {
      const item = objects.find(value => value.id === objectId);
      return [objectId, { x:item.x, y:item.y, width:item.width, height:item.height }];
    }));
  }
  drag.blocked = false;
  Array.from(drag.ids).forEach(objectId => {
    const item = objects.find(value => value.id === objectId);
    const node = document.querySelector(`.freeform-object[data-object-id="${cssEscape(objectId)}"]`);
    if (!item || !node) return;
    node.style.left = `${item.x}px`;
    node.style.top = `${item.y}px`;
    node.style.width = `${item.width}px`;
    node.style.height = `${item.height}px`;
    node.style.transform = `rotate(${Number(item.rotation) || 0}deg)`;
    node.classList.toggle('drop-invalid', dropInvalid);
  });
  rememberFreeformGeometry(objects.filter(item => drag.ids.has(item.id)));
  persistFreeformGeometrySession('freeform-drag-live');
  ModernizationSuite?.updateFreeformMinimap?.();
}

function restoreFreeformGeometryEntries(entries) {
  entries?.forEach((value, objectId) => {
    const item = (state.freeformLayout?.objects || []).find(candidate => candidate.id === objectId);
    if (item) Object.assign(item, value);
  });
}

function restoreFreeformDragOriginals(drag) {
  if (!drag) return;
  restoreFreeformGeometryEntries(drag.originals);
  uiState.undoStack.length = Math.min(uiState.undoStack.length, Number(drag.undoStackLengthBefore) || 0);
  if (Array.isArray(uiState.undoHistoryLabels)) uiState.undoHistoryLabels.length = Math.min(uiState.undoHistoryLabels.length, Number(drag.undoHistoryLengthBefore) || 0);
  updateUndoRedoButtons();
  rememberFreeformGeometry(state.freeformLayout?.objects || []);
  persistFreeformGeometrySession('freeform-drag-cancelled');
}

function commitFinishedFreeformDrag(drag, statusMessage = '') {
  rememberFreeformGeometry(state.freeformLayout?.objects || []);
  persistFreeformGeometrySession('freeform-drag-finish');
  commitFreeformLayoutChange(drag?.resize ? 'freeform-resize' : 'freeform-move', { render: true, syncToGrid: false });
  if (statusMessage) setLiveStatusMessage(statusMessage);
}

function finishFreeformPointerDrag() {
  const drag = uiState.freeformDrag;
  if (drag && !drag.activated) {
    uiState.freeformDrag = null;
    return;
  }
  if (drag) {
    if (drag.dropInvalid) {
      restoreFreeformGeometryEntries(drag.lastDropValid);
      setLiveStatusMessage('Seats may pass through one another, but this drop would leave an overlap. The selection returned to its last valid position. Enable “Allow seats to remain overlapping” to keep stacked seats.');
    } else if (!drag.resize) {
      drag.ids.forEach(objectId => {
        const item = (state.freeformLayout?.objects || []).find(candidate => candidate.id === objectId);
        if (!item) return;
        item.x = Math.round((Number(item.x) || 0) * 1000) / 1000;
        item.y = Math.round((Number(item.y) || 0) * 1000) / 1000;
      });
    }
  }
  ModernizationSuite?.clearAlignmentGuides?.();
  const snapStatus = el('freeformSnapTarget');
  if (snapStatus) { snapStatus.classList.remove('active'); snapStatus.textContent = state.freeformLayout?.canvas?.snap === false ? 'Snap: guides only' : 'Snap: grid'; }
  document.querySelectorAll('.freeform-object.drop-invalid').forEach(node => node.classList.remove('drop-invalid'));
  uiState.freeformDrag = null;
  if (!drag) return;

  const afterRuleFindings = evaluateCurrentRuleViolations({ includeUnseated: false });
  const createdFindings = newRuleFindings(drag.beforeRuleFindings, afterRuleFindings);
  const warning = buildRuleFindingsWarning(createdFindings, drag.resize ? 'Resizing this Freeform selection' : 'Moving this Freeform selection');
  if (!warning) {
    commitFinishedFreeformDrag(drag);
    return;
  }

  showInAppConfirm(`${warning}

Choose Keep Move to override the warning, or Move Back to restore the previous position.`, () => {
    commitFinishedFreeformDrag(drag, 'Freeform move kept after a seating-rule warning.');
  }, {
    title: 'Freeform Seating Rule Warning',
    confirmText: 'Keep Move',
    cancelText: 'Move Back',
    onCancel: () => {
      restoreFreeformDragOriginals(drag);
      renderFreeformLayout();
      setLiveStatusMessage('The Freeform selection was moved back because of the seating-rule warning.');
    }
  });
}

function addFreeformObject(type = null, overrides = {}) {
  ensureFreeformLayout();
  const selectedType = type || el('freeformObjectTool')?.value || el('layoutTool')?.value || 'seat';
  const centerX = 80 + (state.freeformLayout.objects.length % 8) * (DEFAULT_FREEFORM_GRID_CELL_WIDTH + DEFAULT_FREEFORM_GRID_GAP);
  const centerY = 80 + Math.floor(state.freeformLayout.objects.length / 8) * (DEFAULT_FREEFORM_GRID_CELL_HEIGHT + DEFAULT_FREEFORM_GRID_GAP);
  const obj = normalizeFreeformObject({
    type: selectedType,
    label: selectedType === 'seat' ? '' : objectLabel(selectedType),
    x: freeformSnap(overrides.x ?? centerX),
    y: freeformSnap(overrides.y ?? centerY),
    width: overrides.width ?? (selectedType === 'seat' ? DEFAULT_FREEFORM_SEAT_WIDTH : selectedType === 'table' ? 240 : 160),
    height: overrides.height ?? (selectedType === 'seat' ? DEFAULT_FREEFORM_SEAT_HEIGHT : selectedType === 'wall' ? 42 : 110),
    assignedStudentId: overrides.assignedStudentId || null,
    manual: Boolean(overrides.manual),
    locked: Boolean(overrides.locked),
    zIndex: state.freeformLayout.nextZ++,
    color: objectTypeColor(selectedType)
  }, state.freeformLayout.objects.length);
  positionFreeformObjectWithoutOverlap(obj, { startX: obj.x, startY: obj.y });
  state.freeformLayout.initialized = true;
  state.freeformLayout.objects.push(obj);
  selectFreeformObject(obj.id);
  rememberFreeformGeometry([obj]);
  commitFreeformLayoutChange('freeform-add-object', { render: true, syncToGrid: false });
  return obj;
}

function duplicateSelectedFreeformObject() {
  const selected = (state.freeformLayout?.objects || []).filter(obj => uiState.freeformSelectedObjectIds?.has(obj.id) && !obj.locked);
  if (!selected.length) return;
  pushUndoSnapshot('Before freeform duplicate');
  const groupMap = new Map();
  const copies = selected.map(obj => {
    let groupId = '';
    if (obj.groupId) {
      if (!groupMap.has(obj.groupId)) groupMap.set(obj.groupId, uid('freeform-group'));
      groupId = groupMap.get(obj.groupId);
    }
    return normalizeFreeformObject({ ...deepClone(obj), id: uid('freeform-object'), cellKey: '', x: obj.x + DEFAULT_FREEFORM_GRID_GAP, y: obj.y + DEFAULT_FREEFORM_GRID_GAP, zIndex: state.freeformLayout.nextZ++, assignedStudentId: null, manual: false, locked: false, groupId }, state.freeformLayout.objects.length);
  });
  groupMap.forEach((newId, oldId) => {
    const oldGroup = state.freeformLayout.groups?.find(group => group.id === oldId);
    state.freeformLayout.groups.push({ id:newId, name:`${oldGroup?.name || 'Group'} Copy`, color:oldGroup?.color || defaultGroupColor(state.freeformLayout.groups.length), locked:false });
  });
  copies.forEach(copy => positionFreeformObjectWithoutOverlap(copy, { startX:copy.x, startY:copy.y }));
  state.freeformLayout.objects.push(...copies);
  uiState.freeformSelectedObjectIds = new Set(copies.map(copy => copy.id));
  rememberFreeformGeometry(copies);
  commitFreeformLayoutChange('freeform-duplicate-object', { render: true, syncToGrid: false });
}

function deleteSelectedFreeformObject() {
  if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
  ensureFreeformLayout();
  const selectedIds = new Set(uiState.freeformSelectedObjectIds || []);
  if (!selectedIds.size) return;
  const removableIds = new Set((state.freeformLayout.objects || []).filter(obj => selectedIds.has(obj.id) && !obj.locked).map(obj => obj.id));
  if (!removableIds.size) {
    setLiveStatusMessage('The selected Freeform objects are locked. Unlock them before deleting.');
    return;
  }
  pushUndoSnapshot('Before deleting freeform objects');
  state.freeformLayout.objects = (state.freeformLayout.objects || []).filter(obj => !removableIds.has(obj.id));
  state.freeformLayout.initialized = true;
  const usedGroupIds = new Set(state.freeformLayout.objects.map(obj => String(obj.groupId || '')).filter(Boolean));
  state.freeformLayout.groups = (state.freeformLayout.groups || []).filter(group => usedGroupIds.has(String(group.id)));
  forgetFreeformGeometry(removableIds);
  uiState.freeformSelectedObjectIds = new Set();
  commitFreeformLayoutChange('freeform-delete-object', { render: true, syncToGrid: false });
  setLiveStatusMessage(`${removableIds.size} Freeform object${removableIds.size === 1 ? '' : 's'} deleted.`);
}

function clearFreeformRoom() {
  if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
  ensureFreeformLayout();
  const objectCount = (state.freeformLayout.objects || []).length;
  if (!objectCount) {
    setLiveStatusMessage('The Freeform room is already blank.');
    return;
  }
  showInAppConfirm(
    `Remove all ${objectCount} Freeform object${objectCount === 1 ? '' : 's'}, including seats and defined room objects?

Students, groups, zones, saved room history, and the Standard Grid layout are kept. You can also use Undo immediately after clearing.`,
    () => {
      pushUndoSnapshot('Before clearing freeform room');
      state.freeformLayout.objects = [];
      state.freeformLayout.groups = [];
      state.freeformLayout.initialized = true;
      state.freeformLayout.nextZ = 1;
      uiState.freeformSelectedObjectIds = new Set();
      resetFreeformGeometryCache();
      clearFreeformGeometrySession();
      commitFreeformLayoutChange('freeform-clear-room', { render: true, syncToGrid: false });
      setLiveStatusMessage('Freeform room cleared. The blank canvas is ready for a new floor plan.');
    },
    { title: 'Clear Freeform Room?', confirmText: 'Clear Room', cancelText: 'Cancel' }
  );
}

function rotateFreeformObject(id, degrees = 15) {
  if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
  const targets = freeformRotationTargets(id);
  if (!targets.length) return;
  pushUndoSnapshot('Before freeform rotation');
  const originals = new Map(targets.map(item => [item.id, Number(item.rotation) || 0]));
  targets.forEach(item => { item.rotation = ((Number(item.rotation) || 0) + degrees) % 360; });
  const targetIds = new Set(targets.map(item => item.id));
  const external = (state.freeformLayout?.objects || []).filter(item => !targetIds.has(item.id));
  const overlap = targets.find(item => findFreeformOverlap(item, null, external, { phase:'drop', excludeIds:targetIds }));
  if (overlap) {
    targets.forEach(item => { item.rotation = originals.get(item.id); });
    setLiveStatusMessage('Rotation was blocked because it would overlap another room object.');
    renderFreeformLayout();
    return;
  }
  rememberFreeformGeometry(targets);
  commitFreeformLayoutChange('freeform-rotate-object', { render: true, syncToGrid: false });
}


function lockSelectedFreeformObject(toggle = true) {
  restoreFreeformGeometryFromCache();
  const selectedIds = new Set(uiState.freeformSelectedObjectIds || []);
  const selected = (state.freeformLayout?.objects || []).filter(obj => selectedIds.has(obj.id));
  if (!selected.length) return;
  pushUndoSnapshot('Before freeform lock change');
  const shouldLock = toggle ? !selected.every(obj => obj.locked) : true;
  selected.forEach(obj => {
    obj.locked = shouldLock;
    if (obj.type === 'seat') {
      obj.manual = Boolean(obj.assignedStudentId && shouldLock);
      const cell = obj.cellKey ? state.cells?.[obj.cellKey] : null;
      if (cell && cell.type === 'seat') cell.manual = obj.manual;
    }
  });
  rememberFreeformGeometry(selected);
  commitFreeformLayoutChange('freeform-lock-object', { render: true, syncToGrid: false });
}

function applyFreeformStudentAssignmentDirect(student, target) {
  const targetId = String(typeof target === 'string' ? target : target?.id || '');
  ensureFreeformLayout();
  const activeTarget = (state.freeformLayout.objects || []).find(obj => String(obj.id) === targetId && obj.type === 'seat');
  if (!student || !activeTarget) return false;
  (state.freeformLayout.objects || []).forEach(obj => {
    if (obj.type === 'seat' && obj.assignedStudentId === student.id && obj.id !== activeTarget.id) {
      obj.assignedStudentId = null;
      obj.manual = false;
      obj.locked = false;
      mirrorFreeformSeatToGrid(obj, { clearStudentDuplicates: false });
    }
  });
  activeTarget.assignedStudentId = student.id;
  activeTarget.manual = true;
  activeTarget.locked = true;
  mirrorFreeformSeatToGrid(activeTarget);
  return true;
}

function affectedFreeformStudentIdsForAssignment(studentId, target) {
  const ids = new Set([String(studentId || '')]);
  if (target?.assignedStudentId) ids.add(String(target.assignedStudentId));
  (state.freeformLayout?.objects || []).forEach(obj => {
    if (obj.type === 'seat' && String(obj.assignedStudentId || '') === String(studentId || '')) ids.add(String(obj.assignedStudentId));
  });
  return Array.from(ids).filter(Boolean);
}

function assignStudentToFreeformObject(studentId, objectId, render = true, warnOnRules = true, completion = null) {
  const student = getStudent(studentId);
  const target = (state.freeformLayout?.objects || []).find(obj => obj.id === objectId && obj.type === 'seat');
  if (!student || !target) {
    notifyPlacementCompletion(completion, false, 'invalid-target');
    return false;
  }
  if (target.locked) {
    blockLockedSeatEditAction();
    notifyPlacementCompletion(completion, false, 'locked');
    return false;
  }
  if (warnOnRules) {
    const affectedIds = affectedFreeformStudentIdsForAssignment(student.id, target);
    const snapshot = snapshotAssignments();
    const beforeMessages = freeformCollisionMessagesForStudents(affectedIds);
    applyFreeformStudentAssignmentDirect(student, target);
    const afterMessages = freeformCollisionMessagesForStudents(affectedIds);
    restoreAssignments(snapshot);
    const warning = buildCollisionWarning(beforeMessages, afterMessages, `Assigning ${studentDisplay(student)} to this freeform seat`);
    if (warning) {
      showInAppConfirm(`${warning}

Choose Override Placement to keep this assignment anyway, or Move Back to leave the student where they started.`, () => assignStudentToFreeformObject(student.id, objectId, render, false, completion), {
        title: 'Freeform Seating Rule Warning',
        confirmText: 'Override Placement',
        cancelText: 'Move Back',
        onCancel: () => {
          restoreAssignments(snapshot);
          rememberFreeformGeometry(state.freeformLayout?.objects || []);
          renderFreeformLayout();
          setLiveStatusMessage('Freeform placement was moved back because of the seating-rule warning.');
          notifyPlacementCompletion(completion, false, 'cancelled');
        }
      });
      renderFreeformLayout();
      notifyPlacementCompletion(completion, false, 'pending-confirmation');
      return false;
    }
  }
  applyFreeformStudentAssignmentDirect(student, target);
  rememberFreeformGeometry(state.freeformLayout.objects || []);
  commitFreeformLayoutChange('freeform-assign-student', { render, syncToGrid: false });
  const conflicts = freeformCollisionMessagesForStudents([student.id]);
  if (conflicts.length) setLiveStatusMessage(conflicts[0].replace(/^(bad|warn):/, ''));
  else setLiveStatusMessage(`${studentDisplay(student)} assigned to the selected freeform seat.`);
  notifyPlacementCompletion(completion, true, 'placed');
  return true;
}

function updateFreeformCanvasSettings() {
  ensureFreeformLayout();
  const viewportAnchor = captureFreeformViewportAnchor();
  const layout = state.freeformLayout;
  layout.canvas.width = clampNumber(el('freeformCanvasWidthInput')?.value ?? layout.canvas.width, 400, 12000);
  layout.canvas.height = clampNumber(el('freeformCanvasHeightInput')?.value ?? layout.canvas.height, 300, 12000);
  layout.canvas.gridSize = clampNumber(el('freeformGridSizeInput')?.value ?? layout.canvas.gridSize, 5, 80);
  const frontSide = String(el('freeformFrontSideSelect')?.value || layout.canvas.frontSide || 'top').toLowerCase();
  layout.canvas.frontSide = ['top','right','bottom','left'].includes(frontSide) ? frontSide : 'top';
  layout.canvas.zoom = clampNumber((Number(el('seatViewZoomSlider')?.value || Math.round((layout.canvas.zoom || 1) * 100)) / 100), 0.35, 1.75);
  layout.canvas.snap = Boolean(el('freeformSnapToggle')?.checked);
  layout.canvas.allowSeatPassThrough = Boolean(el('freeformSeatPassThroughToggle')?.checked);
  layout.canvas.allowSeatOverlapOnDrop = Boolean(el('freeformSeatOverlapToggle')?.checked);
  layout.canvas.magneticGuides = el('freeformMagneticGuidesToggle') ? Boolean(el('freeformMagneticGuidesToggle').checked) : layout.canvas.magneticGuides !== false;
  const zoomValue = el('seatViewZoomValue');
  if (zoomValue) zoomValue.textContent = `${Math.round(layout.canvas.zoom * 100)}%`;
  uiState.pageSettings.freeformGridSize = layout.canvas.gridSize;
  uiState.pageSettings.freeformSnapToGrid = layout.canvas.snap;
  uiState.pageSettings.freeformAllowSeatPassThrough = layout.canvas.allowSeatPassThrough;
  uiState.pageSettings.freeformAllowSeatOverlapOnDrop = layout.canvas.allowSeatOverlapOnDrop;
  uiState.pageSettings.freeformMagneticGuides = layout.canvas.magneticGuides;
  schedulePageSettingsPersistence('freeform-settings');
  persistFreeformGeometrySession('freeform-canvas-settings');
  persistActiveClass();
  scheduleLinkedAutoSave('freeform-canvas-settings');
  renderAll();
  restoreFreeformViewportAnchor(viewportAnchor);
}

function cleanupInvalidAssignmentsAndAnchors() {
  const studentIds = new Set(state.students.map(student => student.id));
  const groupIds = new Set(state.groups.map(group => group.id));
  const validSeatKeys = new Set(Object.entries(state.cells).filter(([, cell]) => cell.type === 'seat').map(([key]) => key));
  const zoneIds = new Set((state.zones || []).map(zone => zone.id));

  Object.values(state.cells).forEach(cell => {
    if (cell.type !== 'seat') {
      cell.assignedStudentId = null;
      cell.manual = false;
      cell.anchorGroupIds = [];
      cell.zoneIds = (cell.zoneIds || []).filter(id => zoneIds.has(id));
      return;
    }
    if (cell.assignedStudentId && !studentIds.has(cell.assignedStudentId)) {
      cell.assignedStudentId = null;
      cell.manual = false;
    }
    cell.anchorGroupIds = (cell.anchorGroupIds || []).filter(id => groupIds.has(id));
    cell.zoneIds = (cell.zoneIds || []).filter(id => zoneIds.has(id));
  });

  if (state.freeformLayout && Array.isArray(state.freeformLayout.objects)) {
    state.freeformLayout.objects = state.freeformLayout.objects.map((obj, index) => normalizeFreeformObject(obj, index)).filter(Boolean);
    state.freeformLayout.objects.forEach(obj => {
      obj.color = safeColor(obj.color, objectTypeColor(obj.type));
      obj.anchorGroupIds = (obj.anchorGroupIds || []).filter(id => groupIds.has(id));
      obj.zoneIds = (obj.zoneIds || []).filter(id => zoneIds.has(id));
      if (obj.type !== 'seat') {
        obj.assignedStudentId = null;
        obj.manual = false;
        obj.anchorGroupIds = [];
        obj.zoneIds = [];
      } else if (obj.assignedStudentId && !studentIds.has(obj.assignedStudentId)) {
        obj.assignedStudentId = null;
        obj.manual = false;
        obj.locked = false;
      }
    });
  }

  state.groups.forEach((group, index) => {
    group.color = safeColor(group.color, defaultGroupColor(index));
    group.anchorSeats = (group.anchorSeats || []).filter(key => validSeatKeys.has(key));
    if (group.zoneId && !zoneIds.has(String(group.zoneId))) group.zoneId = '';
    group.anchorSeats.forEach(key => {
      const cell = state.cells[key];
      if (cell && cell.type === 'seat') {
        cell.anchorGroupIds = cell.anchorGroupIds || [];
        if (!cell.anchorGroupIds.includes(group.id)) cell.anchorGroupIds.push(group.id);
      }
    });
  });
  state.zones = (state.zones || []).map((zone, index) => normalizeZoneRecord(zone, index)).filter(zone => zoneIds.has(zone.id));
  state.zones.forEach(zone => {
    zone.studentIds = (zone.studentIds || []).map(String).filter(id => studentIds.has(id));
    zone.groupIds = Array.from(new Set([...(zone.groupIds || []).map(String), ...state.groups.filter(group => String(group.zoneId || '') === String(zone.id)).map(group => String(group.id))])).filter(id => groupIds.has(id));
  });
}

function distance(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function seatCells() {
  return Object.values(state.cells).filter(cell => cell.type === 'seat');
}

function assignedSeatForStudent(studentId) {
  return Object.values(state.cells).find(cell => cell.assignedStudentId === studentId) || null;
}

function assignedSeatsByStudent() {
  const seats = new Map();
  Object.values(state.cells).forEach(cell => {
    const studentId = cell.assignedStudentId;
    if (studentId && !seats.has(String(studentId))) seats.set(String(studentId), cell);
  });
  return seats;
}

function assignedStudentIds() {
  const ids = new Set(Object.values(state.cells).map(c => c.assignedStudentId).filter(Boolean).map(String));
  (state.freeformLayout?.objects || []).forEach(obj => {
    if (obj?.type === 'seat' && obj.assignedStudentId) ids.add(String(obj.assignedStudentId));
  });
  return ids;
}

function removeStudentFromCells(studentId) {
  Object.values(state.cells).forEach(cell => {
    if (cell.assignedStudentId === studentId) {
      cell.assignedStudentId = null;
      cell.manual = false;
    }
  });
  if (state.freeformLayout && Array.isArray(state.freeformLayout.objects)) {
    state.freeformLayout.objects.forEach(obj => {
      if (obj.type === 'seat' && obj.assignedStudentId === studentId) {
        obj.assignedStudentId = null;
        obj.manual = false;
        obj.locked = false;
      }
    });
  }
}

function affectedStudentIdsForMove(studentId, targetCellKey) {
  const ids = new Set([studentId]);
  const target = state.cells[targetCellKey];
  const source = assignedSeatForStudent(studentId);
  if (target?.assignedStudentId) ids.add(target.assignedStudentId);
  if (source?.assignedStudentId) ids.add(source.assignedStudentId);
  return [...ids].filter(Boolean);
}

function effectiveStudentRequirements(student) {
  const normalized = normalizeStudent(student || {});
  const requirements = deepClone(normalized.requirements || {});
  const preferred = new Set((requirements.preferredZoneIds || []).map(String));
  (state.zones || []).forEach(zone => {
    if ((zone.studentIds || []).map(String).includes(String(student?.id || ''))) preferred.add(String(zone.id));
  });
  requirements.preferredZoneIds = [...preferred];
  requirements.excludedZoneIds = [...new Set((requirements.excludedZoneIds || []).map(String))];
  requirements.minDistanceStudentIds = [...new Set((requirements.minDistanceStudentIds || []).map(String).filter(id => id && id !== String(student?.id || '')))];
  return requirements;
}

function studentsWithEffectiveRuleRequirements() {
  return seatingStudents().map(student => ({ ...deepClone(student), requirements: effectiveStudentRequirements(student) }));
}

function currentRuleSeatDescriptors() {
  try {
    const seats = ModernizationSuite?.buildGeneratorSeats?.();
    if (Array.isArray(seats)) return seats;
  } catch {
     
  }
  return Object.entries(state.cells || {}).filter(([, cell]) => cell?.type === 'seat').map(([key, cell]) => ({
    key, label: `Seat ${cell.row},${cell.col}`, row: Number(cell.row) || 1, col: Number(cell.col) || 1,
    ruleX: Number(cell.col) || 1, ruleY: Number(cell.row) || 1,
    frontRatio: (Number(cell.row) - 1) / Math.max(1, Number(state.rows) - 1),
    sideRatio: (Number(cell.col) - 1) / Math.max(1, Number(state.cols) - 1),
    zoneIds: [...(cell.zoneIds || [])], anchorGroupIds: [...(cell.anchorGroupIds || [])],
    assignedStudentId: cell.assignedStudentId || null, manual: Boolean(cell.manual),
    edge: Number(cell.row) === 1 || Number(cell.col) === 1 || Number(cell.row) === Number(state.rows) || Number(cell.col) === Number(state.cols),
    teacherDistance: 999, boardDistance: 999, doorDistance: 999, windowDistance: 999, nearAda: false
  }));
}

function ruleSeatDistance(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot((Number.isFinite(Number(a.ruleY)) ? Number(a.ruleY) : Number(a.row) || 0) - (Number.isFinite(Number(b.ruleY)) ? Number(b.ruleY) : Number(b.row) || 0),
                    (Number.isFinite(Number(a.ruleX)) ? Number(a.ruleX) : Number(a.col) || 0) - (Number.isFinite(Number(b.ruleX)) ? Number(b.ruleX) : Number(b.col) || 0));
}

function describeRuleProximity(value, target) {
  const distanceValue = Number(value);
  if (!Number.isFinite(distanceValue)) return `too close to ${target}`;
  if (distanceValue <= 1.15) return `directly beside ${target}`;
  if (distanceValue <= 2) return `very close to ${target}`;
  return `closer to ${target} than the rule allows`;
}

function describeRuleSeparation(value) {
  const distanceValue = Number(value);
  if (!Number.isFinite(distanceValue)) return 'too close together';
  if (distanceValue <= 1.15) return 'next to each other';
  if (distanceValue <= 2) return 'very close together';
  return 'too close together';
}

function newRuleFindings(beforeFindings, afterFindings) {
  const beforeIds = new Set((beforeFindings || []).map(item => String(item?.id || '')));
  return (afterFindings || []).filter(item => item?.id && !beforeIds.has(String(item.id)));
}

function buildRuleFindingsWarning(findings, actionText) {
  if (!findings?.length) return '';
  const readable = findings.slice(0, 5).map(item => String(item.message || '').trim()).filter(Boolean);
  if (!readable.length) return '';
  return `${actionText} creates a new seating-rule or student-need conflict.

New issue${readable.length === 1 ? '' : 's'}:
- ${readable.join('\n- ')}`;
}

function evaluateCurrentRuleViolations(options = {}) {
  const includeUnseated = options.includeUnseated !== false;
  const findings = [];
  const seen = new Set();
  const students = studentsWithEffectiveRuleRequirements();
  const studentById = new Map(students.map(student => [String(student.id), student]));
  const seats = currentRuleSeatDescriptors();
  const seatByKey = new Map(seats.map(seat => [String(seat.key), seat]));
  const seatsByStudent = new Map(seats.filter(seat => seat.assignedStudentId).map(seat => [String(seat.assignedStudentId), seat]));
  const label = student => student ? studentDisplay(student) : 'Unknown student';
  const seatLabel = seat => seat?.label || (seat ? `Seat ${seat.row},${seat.col}` : 'Unassigned');
  const add = (id, severity, message, studentIds = [], category = 'rule') => {
    const key = String(id || message);
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ id: key, severity, message, studentIds: [...new Set(studentIds.map(String).filter(Boolean))], category });
  };
  const hasMeasuredObject = field => seats.some(seat => Number(seat[field]) < 999);
  const roomObjectWarnings = new Set();
  const noteMissingObject = (kind, field, description) => {
    if (roomObjectWarnings.has(kind) || hasMeasuredObject(field)) return;
    roomObjectWarnings.add(kind);
    add(`room-object:${kind}`, 'warn', `The room has no ${description}, so active ${kind} rules and student needs cannot be measured.`, [], 'room');
  };

  students.forEach(student => {
    const id = String(student.id);
    const req = effectiveStudentRequirements(student);
    const seat = seatsByStudent.get(id);
    const configured = req.front !== 'none' || req.side !== 'none' || req.nearTeacher || req.aisle || req.ada || req.awayDoor || req.awayWindow || req.preferredZoneIds.length || req.excludedZoneIds.length || req.minDistanceStudentIds.length;
    if (!seat) {
      if (includeUnseated && configured) add(`student:${id}:unseated-needs`, req.front === 'require' || req.ada ? 'bad' : 'warn', `${label(student)} is unseated, so the configured individual seating needs cannot be satisfied.`, [id], 'student');
      return;
    }
    const front = Number.isFinite(Number(seat.frontRatio)) ? Number(seat.frontRatio) : 0;
    const side = Number.isFinite(Number(seat.sideRatio)) ? Number(seat.sideRatio) : 0.5;
    const zones = new Set((seat.zoneIds || []).map(String));
    if (req.front === 'require' && front > .42) add(`student:${id}:front-required`, 'bad', `${label(student)} is at ${seatLabel(seat)}, outside the required front area.`, [id], 'student');
    else if (req.front === 'prefer' && front > .45) add(`student:${id}:front-preferred`, 'warn', `${label(student)} prefers the front but is at ${seatLabel(seat)} outside the front target.`, [id], 'student');
    if (req.side === 'left' && side > .5) add(`student:${id}:side-left`, 'warn', `${label(student)} prefers the left side but is at ${seatLabel(seat)} on the opposite half.`, [id], 'student');
    if (req.side === 'right' && side < .5) add(`student:${id}:side-right`, 'warn', `${label(student)} prefers the right side but is at ${seatLabel(seat)} on the opposite half.`, [id], 'student');
    if (req.nearTeacher) {
      noteMissingObject('near-teacher', 'teacherDistance', 'teacher desk object');
      if (Number(seat.teacherDistance) < 999 && Number(seat.teacherDistance) > 2.5) add(`student:${id}:near-teacher`, 'warn', `${label(student)} needs a seat near the teacher, but ${seatLabel(seat)} is outside the nearby teacher area.`, [id], 'student');
    }
    if (req.aisle && !seat.edge) add(`student:${id}:aisle`, 'warn', `${label(student)} needs an aisle or room-edge seat, but ${seatLabel(seat)} is not one.`, [id], 'student');
    if (req.ada && !seat.nearAda) add(`student:${id}:ada`, 'bad', `${label(student)} requires an ADA/accessibility area, but ${seatLabel(seat)} is not in one.`, [id], 'student');
    if (req.awayDoor) {
      noteMissingObject('away-door', 'doorDistance', 'door object');
      if (Number(seat.doorDistance) < 3) add(`student:${id}:away-door`, 'warn', `${label(student)} needs a seat away from doors, but ${seatLabel(seat)} is ${describeRuleProximity(seat.doorDistance, 'a door')}.`, [id], 'student');
    }
    if (req.awayWindow) {
      noteMissingObject('away-window', 'windowDistance', 'window object');
      if (Number(seat.windowDistance) < 3) add(`student:${id}:away-window`, 'warn', `${label(student)} needs a seat away from windows, but ${seatLabel(seat)} is ${describeRuleProximity(seat.windowDistance, 'a window')}.`, [id], 'student');
    }
    if (req.preferredZoneIds.length && !req.preferredZoneIds.some(zoneId => zones.has(String(zoneId)))) {
      const names = req.preferredZoneIds.map(zoneId => zoneById(zoneId)?.name || zoneId).join(', ');
      add(`student:${id}:preferred-zone`, 'warn', `${label(student)} is at ${seatLabel(seat)} outside the preferred zone${req.preferredZoneIds.length === 1 ? '' : 's'}: ${names}.`, [id], 'zone');
    }
    const excluded = req.excludedZoneIds.filter(zoneId => zones.has(String(zoneId)));
    if (excluded.length) {
      const names = excluded.map(zoneId => zoneById(zoneId)?.name || zoneId).join(', ');
      add(`student:${id}:excluded-zone`, 'bad', `${label(student)} is at ${seatLabel(seat)} inside excluded zone${excluded.length === 1 ? '' : 's'}: ${names}.`, [id], 'zone');
    }
    req.minDistanceStudentIds.forEach(otherId => {
      const other = studentById.get(String(otherId));
      const otherSeat = seatsByStudent.get(String(otherId));
      if (!other || !otherSeat) return;
      const pair = [id, String(otherId)].sort();
      if (pair[0] !== id) return;
      const d = ruleSeatDistance(seat, otherSeat);
      if (d < 3) add(`student-distance:${pair.join('|')}`, 'bad', `${label(student)} and ${label(other)} need to be seated apart, but their current seats are ${describeRuleSeparation(d)}.`, pair, 'student');
    });
  });

  (state.groups || []).forEach(group => {
    const groupId = String(group.id || group.name || 'group');
    const memberIds = (group.studentIds || []).map(String).filter(id => studentById.has(id));
    const placed = memberIds.map(id => ({ id, student: studentById.get(id), seat: seatsByStudent.get(id) })).filter(item => item.seat);
    const missing = memberIds.filter(id => !seatsByStudent.has(id));
    const priority = Number(group.priority || 1);
    if (includeUnseated && missing.length && priority >= 8) add(`group:${groupId}:unseated`, 'warn', `${group.name}: ${missing.length} high-priority member${missing.length === 1 ? ' is' : 's are'} not seated.`, missing, 'group');
    const pairs = [];
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) pairs.push([placed[i], placed[j]]);
    if (['avoid', 'spread'].includes(group.type)) {
      pairs.forEach(([a, b]) => {
        const d = ruleSeatDistance(a.seat, b.seat);
        if (d < 2) add(`group:${groupId}:apart:${[a.id,b.id].sort().join('|')}`, 'bad', `${group.name}: ${label(a.student)} and ${label(b.student)} are ${describeRuleSeparation(d)}, which breaks this separation rule.`, [a.id,b.id], 'group');
        else if (d < 3) add(`group:${groupId}:apart:${[a.id,b.id].sort().join('|')}`, 'warn', `${group.name}: ${label(a.student)} and ${label(b.student)} are ${describeRuleSeparation(d)}, so this separation preference is not being met.`, [a.id,b.id], 'group');
      });
    }
    if (['together', 'special'].includes(group.type) && pairs.length) {
      const farthest = pairs.map(([a,b]) => ({ a, b, d: ruleSeatDistance(a.seat,b.seat) })).sort((a,b) => b.d-a.d)[0];
      if (farthest.d > 4) add(`group:${groupId}:together`, priority >= 8 ? 'bad' : 'warn', `${group.name}: ${label(farthest.a.student)} and ${label(farthest.b.student)} are too far apart for this nearby-seating rule.`, [farthest.a.id,farthest.b.id], 'group');
    }
    placed.forEach(({ id, student, seat }) => {
      const front = Number(seat.frontRatio || 0);
      if (group.type === 'front' && front > .45) add(`group:${groupId}:front:${id}`, 'warn', `${group.name}: ${label(student)} is outside the front target at ${seatLabel(seat)}.`, [id], 'group');
      if (group.type === 'back' && front < .55) add(`group:${groupId}:back:${id}`, 'warn', `${group.name}: ${label(student)} is outside the back target at ${seatLabel(seat)}.`, [id], 'group');
      if (group.type === 'nearTeacher') {
        noteMissingObject('near-teacher', 'teacherDistance', 'teacher desk object');
        if (Number(seat.teacherDistance) < 999 && Number(seat.teacherDistance) > 2.5) add(`group:${groupId}:teacher:${id}`, 'warn', `${group.name}: ${label(student)} is outside the nearby teacher area.`, [id], 'group');
      }
      if (group.type === 'nearBoard') {
        noteMissingObject('near-board', 'boardDistance', 'board or projector object');
        if (Number(seat.boardDistance) < 999 && Number(seat.boardDistance) > 2.5) add(`group:${groupId}:board:${id}`, 'warn', `${group.name}: ${label(student)} is outside the nearby board or projector area.`, [id], 'group');
      }
      if (group.type === 'awayDoor') {
        noteMissingObject('away-door', 'doorDistance', 'door object');
        if (Number(seat.doorDistance) < 3) add(`group:${groupId}:door:${id}`, 'warn', `${group.name}: ${label(student)} is too close to a door at ${seatLabel(seat)}.`, [id], 'group');
      }
      if (group.type === 'awayWindow') {
        noteMissingObject('away-window', 'windowDistance', 'window object');
        if (Number(seat.windowDistance) < 3) add(`group:${groupId}:window:${id}`, 'warn', `${group.name}: ${label(student)} is too close to a window at ${seatLabel(seat)}.`, [id], 'group');
      }
      if ((group.type === 'zone' || group.zoneId) && group.zoneId && !(seat.zoneIds || []).map(String).includes(String(group.zoneId))) {
        add(`group:${groupId}:zone:${id}`, 'warn', `${group.name}: ${label(student)} is outside preferred zone ${zoneById(group.zoneId)?.name || group.zoneId}.`, [id], 'zone');
      }
    });
    const anchors = new Set((group.anchorSeats || []).map(String).filter(key => seatByKey.has(key)));
    if (anchors.size && placed.length) {
      const needed = Math.min(anchors.size, placed.length);
      const used = placed.filter(item => anchors.has(String(item.seat.key))).length;
      if (used < needed) add(`group:${groupId}:anchors`, 'warn', `${group.name}: only ${used} of ${needed} reserved seat${needed === 1 ? '' : 's'} are occupied by group members.`, placed.map(item => item.id), 'group');
    }
  });

  seats.forEach(seat => {
    const studentId = String(seat.assignedStudentId || '');
    if (!studentId || !(seat.anchorGroupIds || []).length) return;
    const studentGroups = new Set((state.groups || []).filter(group => (group.studentIds || []).map(String).includes(studentId)).map(group => String(group.id)));
    const conflicting = (seat.anchorGroupIds || []).map(String).filter(groupId => !studentGroups.has(groupId));
    conflicting.forEach(groupId => {
      const group = getGroup(groupId);
      if (!group || !(group.studentIds || []).some(id => !seatsByStudent.has(String(id)))) return;
      add(`reservation:${seat.key}:${groupId}`, 'warn', `${seatLabel(seat)} is reserved for ${group.name}, but ${label(studentById.get(studentId))} is not a member while a group member remains unseated.`, [studentId, ...(group.studentIds || [])], 'group');
    });
  });

  const pairRules = new Map();
  (state.groups || []).forEach(group => {
    const ids = (group.studentIds || []).map(String).filter(id => studentById.has(id)).sort();
    for (let i=0;i<ids.length;i++) for (let j=i+1;j<ids.length;j++) {
      const key = `${ids[i]}|${ids[j]}`;
      if (!pairRules.has(key)) pairRules.set(key, []);
      pairRules.get(key).push(group);
    }
  });
  pairRules.forEach((rules, key) => {
    if (!rules.some(rule => ['avoid','spread'].includes(rule.type)) || !rules.some(rule => ['together','special'].includes(rule.type))) return;
    const ids = key.split('|');
    add(`conflicting-rules:${key}`, 'warn', `Colliding group rules: ${label(studentById.get(ids[0]))} and ${label(studentById.get(ids[1]))} are included in both proximity and separation rules.`, ids, 'group');
  });

  const ignored = new Set((state.ruleOverrides || []).map(item => String(item.id || item)));
  return findings.filter(item => !ignored.has(String(item.id)));
}

function freeformCollisionMessagesForStudents(studentIds) {
  return collisionMessagesForStudents(studentIds);
}

function collisionMessagesForStudents(studentIds) {
  const watched = new Set((studentIds || []).map(String).filter(Boolean));
  return evaluateCurrentRuleViolations({ includeUnseated: false })
    .filter(item => item.studentIds?.some(id => watched.has(String(id))))
    .map(item => `${item.severity === 'bad' ? 'bad' : 'warn'}:${item.message}`);
}

function buildCollisionWarning(beforeMessages, afterMessages, actionText) {
  const beforeSet = new Set(beforeMessages);
  const newMessages = afterMessages.filter(message => !beforeSet.has(message));
  if (!newMessages.length) return '';
  const readable = newMessages.slice(0, 5).map(message => message.replace(/^(bad|warn):/, ''));
  return `${actionText} creates a new seating-rule or student-need conflict. Continue?\n\nNew possible issue(s):\n- ${readable.join('\n- ')}`;
}

function applyMoveOrSwap(studentId, targetCellKey, manual = true) {
  const target = state.cells[targetCellKey];
  if (!getStudent(studentId) || !target || target.type !== 'seat') return false;
  const source = assignedSeatForStudent(studentId);
  const targetStudentId = target.assignedStudentId || null;
  if (targetStudentId === studentId) {
    target.manual = Boolean(manual || target.manual);
    return true;
  }
  const incomingWasLocked = Boolean(source?.manual);
  const targetWasLocked = Boolean(target.manual);
  if (source) {
    source.assignedStudentId = targetStudentId;
    source.manual = targetStudentId ? targetWasLocked : false;
    target.assignedStudentId = studentId;
    target.manual = incomingWasLocked;
  } else {
    target.assignedStudentId = studentId;
    target.manual = Boolean(manual || target.manual);
  }
  return true;
}


function assignStudentToCell(studentId, cellKey, manual = true, warnOnRules = true, completion = null) {
  if (eyeModeBlocksSeatEditing()) {
    blockEyeModeAction('seat');
    notifyPlacementCompletion(completion, false, 'blocked');
    return false;
  }
  const target = state.cells[cellKey];
  const student = getStudent(studentId);
  if (!student || !target || target.type !== 'seat') {
    notifyPlacementCompletion(completion, false, 'invalid-target');
    return false;
  }
  const source = assignedSeatForStudent(studentId);
  const targetStudent = getStudent(target.assignedStudentId);
  const actionText = targetStudent && source
    ? `Moving ${studentDisplay(student)} to seat ${target.row},${target.col} will swap with ${studentDisplay(targetStudent)}`
    : targetStudent
          ? `Moving ${studentDisplay(student)} to occupied seat ${target.row},${target.col} will replace ${studentDisplay(targetStudent)}`
          : `Moving ${studentDisplay(student)} to seat ${target.row},${target.col}`;

  if (warnOnRules) {
    const affectedIds = affectedStudentIdsForMove(studentId, cellKey);
    const snapshot = snapshotAssignments();
    const beforeMessages = collisionMessagesForStudents(affectedIds);
    applyMoveOrSwap(studentId, cellKey, manual);
    const afterMessages = collisionMessagesForStudents(affectedIds);
    restoreAssignments(snapshot);
    const warning = buildCollisionWarning(beforeMessages, afterMessages, actionText);
    if (warning) {
      showInAppConfirm(warning, () => {
        applyMoveOrSwap(studentId, cellKey, manual);
        mirrorLinkedFreeformSeatsFromGrid();
        renderAll();
        setLiveStatusMessage('Move completed after a seating-rule warning.');
        notifyPlacementCompletion(completion, true, 'confirmed');
      }, {
        title: 'Seating Rule Warning',
        confirmText: 'Continue Move',
        cancelText: 'Cancel',
        onCancel: () => notifyPlacementCompletion(completion, false, 'cancelled')
      });
      renderAll();
      notifyPlacementCompletion(completion, false, 'pending-confirmation');
      return false;
    }
  }

  applyMoveOrSwap(studentId, cellKey, manual);
  mirrorLinkedFreeformSeatsFromGrid();
  renderAll();
  notifyPlacementCompletion(completion, true, 'placed');
  return true;
}

function applyCellTypeWithoutRender(cellKey, type) {
  const cell = state.cells[cellKey];
  if (!cell) return false;
  cell.type = type;
  if (type !== 'seat') {
    cell.assignedStudentId = null;
    cell.manual = false;
    (cell.anchorGroupIds || []).forEach(groupId => {
      const group = getGroup(groupId);
      if (group) group.anchorSeats = (group.anchorSeats || []).filter(key => key !== cellKey);
    });
    cell.anchorGroupIds = [];
  } else {
    cell.anchorGroupIds = cell.anchorGroupIds || [];
  }
  return true;
}

function setCellType(cellKey, type) {
  setCellsType([cellKey], type);
}

function setCellsType(cellKeys, type) {
  if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
  const keys = Array.from(new Set((cellKeys || []).filter(key => state.cells[key])));
  if (!keys.length) return;
  let changed = 0;
  keys.forEach(key => {
    if (applyCellTypeWithoutRender(key, type)) changed += 1;
  });
  keys.forEach(key => mirrorLinkedFreeformSeatsFromGrid(key));
  renderAll();
  if (changed > 1) setLiveStatusMessage(`Marked ${changed} cells as ${objectLabel(type)}.`);
}

function selectedCellKeysArray() {
  cleanupSelectedCellKeys();
  return Array.from(uiState.selectedCellKeys);
}

function cleanupSelectedCellKeys() {
  if (!uiState?.selectedCellKeys) return;
  Array.from(uiState.selectedCellKeys).forEach(key => {
    if (!state.cells[key]) uiState.selectedCellKeys.delete(key);
  });
  if (uiState.selectionAnchorKey && !state.cells[uiState.selectionAnchorKey]) uiState.selectionAnchorKey = null;
}

function isContextCellSelectionBatch(cellKey) {
  cleanupSelectedCellKeys();
  return uiState.selectedCellKeys.size > 1 && uiState.selectedCellKeys.has(cellKey);
}

function contextCellKeys(cellKey) {
  return isContextCellSelectionBatch(cellKey) ? selectedCellKeysArray() : [cellKey].filter(Boolean);
}

function cellCoordsFromKey(cellKey) {
  const [row, col] = String(cellKey || '').split('-').map(Number);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  return { row, col };
}

function cellRangeKeys(fromKey, toKey) {
  const from = cellCoordsFromKey(fromKey);
  const to = cellCoordsFromKey(toKey);
  if (!from || !to) return [];
  const rowStart = Math.min(from.row, to.row);
  const rowEnd = Math.max(from.row, to.row);
  const colStart = Math.min(from.col, to.col);
  const colEnd = Math.max(from.col, to.col);
  const keys = [];
  for (let row = rowStart; row <= rowEnd; row++) {
    for (let col = colStart; col <= colEnd; col++) {
      const key = keyOf(row, col);
      if (state.cells[key]) keys.push(key);
    }
  }
  return keys;
}

function addCellRangeToSelection(fromKey, toKey) {
  cellRangeKeys(fromKey, toKey).forEach(key => uiState.selectedCellKeys.add(key));
  updateCellSelectionVisuals();
}

function updateCellSelectionVisuals() {
  cleanupSelectedCellKeys();
  const grid = el('seatGrid');
  if (grid) {
    grid.querySelectorAll('.cell[data-cell-key]').forEach(cellEl => {
      cellEl.classList.toggle('multi-selected', uiState.selectedCellKeys.has(cellEl.dataset.cellKey));
    });
  }
  const count = uiState.selectedCellKeys.size;
  const countEl = el('selectedCellCount');
  if (countEl) countEl.textContent = `${count} selected`;
  const modeBtn = el('selectCellsBtn');
  if (modeBtn) {
    modeBtn.classList.toggle('active', uiState.selectionMode);
    modeBtn.setAttribute('aria-pressed', uiState.selectionMode ? 'true' : 'false');
    modeBtn.textContent = uiState.selectionMode ? 'Selecting' : 'Select Cells';
  }
  document.body.classList.toggle('cell-selection-mode', uiState.selectionMode || uiState.isSelectingCells);
}

function clearCellSelection() {
  uiState.selectedCellKeys.clear();
  uiState.isSelectingCells = false;
  uiState.selectionAnchorKey = null;
  updateCellSelectionVisuals();
  hideCellContextMenu();
}

function toggleCellSelectionMode() {
  uiState.selectionMode = !uiState.selectionMode;
  updateCellSelectionVisuals();
  setLiveStatusMessage(uiState.selectionMode ? 'Cell selection mode on. Drag or click cells to select them; Shift adds a range. Right-click one selected cell to apply an object to all selected cells.' : 'Cell selection mode off. Normal cell clicks apply the Click Tool.');
}

function addCellToSelection(cellKey, shouldUpdate = true) {
  if (!state.cells[cellKey]) return;
  uiState.selectedCellKeys.add(cellKey);
  if (shouldUpdate) updateCellSelectionVisuals();
}

function toggleCellSelection(cellKey) {
  if (!state.cells[cellKey]) return;
  if (uiState.selectedCellKeys.has(cellKey)) uiState.selectedCellKeys.delete(cellKey);
  else uiState.selectedCellKeys.add(cellKey);
  uiState.selectionAnchorKey = cellKey;
  updateCellSelectionVisuals();
}

function beginCellSelection(event, cellKey) {
  if (!state.cells[cellKey]) return false;
  event.preventDefault();
  event.stopPropagation();
  uiState.isSelectingCells = true;
  uiState.skipNextCellClick = true;
  const additive = event.shiftKey || event.ctrlKey || event.metaKey;
  if (!additive) uiState.selectedCellKeys.clear();
  if (event.shiftKey && uiState.selectionAnchorKey && state.cells[uiState.selectionAnchorKey]) {
    addCellRangeToSelection(uiState.selectionAnchorKey, cellKey);
  } else {
    addCellToSelection(cellKey);
    uiState.selectionAnchorKey = cellKey;
  }
  return true;
}

function endCellSelection() {
  if (!uiState.isSelectingCells) return;
  uiState.isSelectingCells = false;
  updateCellSelectionVisuals();
}

function selectCellFromPointer(event) {
  if (!uiState.isSelectingCells) return;
  const elementUnderPointer = document.elementFromPoint(event.clientX, event.clientY);
  const cellEl = elementUnderPointer?.closest?.('.cell[data-cell-key]');
  if (!cellEl) return;
  const cellKey = cellEl.dataset.cellKey;
  if (event.shiftKey && uiState.selectionAnchorKey && state.cells[uiState.selectionAnchorKey]) {
    addCellRangeToSelection(uiState.selectionAnchorKey, cellKey);
  } else {
    addCellToSelection(cellKey);
  }
}

function unassignStudent(studentId) {
  removeStudentFromCells(studentId);
  renderAll();
}

function toggleSeatLock(cellKey) {
  if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
  const cell = state.cells[cellKey];
  if (!cell || cell.type !== 'seat' || !cell.assignedStudentId) return;
  cell.manual = !cell.manual;
  mirrorLinkedFreeformSeatsFromGrid(cellKey);
  renderAll();
}

function toggleStudentLock(studentId) {
  if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
  const entry = gridSeatEntryForStudent(studentId);
  if (!entry) return;
  const [cellKey, cell] = entry;
  cell.manual = !cell.manual;
  mirrorLinkedFreeformSeatsFromGrid(cellKey);
  renderAll();
}

function clearAssignments(keepManual = false) {
  if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
  Object.values(state.cells).forEach(cell => {
    if (!keepManual || !cell.manual) {
      cell.assignedStudentId = null;
      cell.manual = false;
    }
  });
  if (state.freeformLayout && Array.isArray(state.freeformLayout.objects)) {
    state.freeformLayout.objects.forEach(obj => {
      if (obj.type === 'seat' && (!keepManual || !obj.locked)) {
        obj.assignedStudentId = null;
        obj.manual = false;
        obj.locked = false;
      }
    });
  }
}

function clearAnchors() {
  if (eyeModeBlocksGroupEditing() || eyeModeBlocksSeatEditing()) return blockEyeModeAction('group');
  Object.values(state.cells).forEach(cell => cell.anchorGroupIds = []);
  if (state.freeformLayout && Array.isArray(state.freeformLayout.objects)) {
    state.freeformLayout.objects.forEach(obj => { if (obj.type === 'seat') obj.anchorGroupIds = []; });
  }
  state.groups.forEach(b => b.anchorSeats = []);
}

function normalizeStudent(raw) {
  raw = raw || {};
  const firstName = String(raw.firstName || raw.firstname || raw.first || raw['first name'] || raw['First Name'] || '').trim();
  const lastName = String(raw.lastName || raw.lastname || raw.last || raw['last name'] || raw['Last Name'] || '').trim();
  const nickName = String(raw.nickName || raw.nickname || raw.nick || raw['nickname'] || raw['Nickname'] || raw['Nickname'] || '').trim();
  const grade = String(raw.grade || raw.Grade || '').trim();
  const fallbackNotes = String(raw.notes || raw.note || raw['student notes'] || raw['Student Notes'] || raw['Notes'] || '').trim();
  const noteBucket = raw.noteCategories && typeof raw.noteCategories === 'object' ? raw.noteCategories : {};
  const notesPrivate = String(raw.notesPrivate || raw.privateNotes || raw['private notes'] || raw['Private Notes'] || noteBucket.private || fallbackNotes || '').trim();
  const notesSubstitute = String(raw.notesSubstitute || raw.substituteNotes || raw['substitute notes'] || raw['Substitute Notes'] || noteBucket.substitute || '').trim();
  const notesPublic = String(raw.notesPublic || raw.publicNotes || raw['public notes'] || raw['Public Notes'] || noteBucket.public || '').trim();
  const rawId = String(raw.id || raw.ID || raw.studentId || raw['student id'] || raw['Student ID'] || raw.studentID || '').trim();
  const id = rawId || uid('student');
  const requirementsSource = raw.requirements && typeof raw.requirements === 'object' ? raw.requirements : {};
  const requirements = {
    front: ['none','prefer','require'].includes(requirementsSource.front) ? requirementsSource.front : 'none',
    side: ['none','left','right'].includes(requirementsSource.side) ? requirementsSource.side : 'none',
    nearTeacher: Boolean(requirementsSource.nearTeacher),
    aisle: Boolean(requirementsSource.aisle),
    ada: Boolean(requirementsSource.ada),
    awayDoor: Boolean(requirementsSource.awayDoor),
    awayWindow: Boolean(requirementsSource.awayWindow),
    preferredZoneIds: Array.isArray(requirementsSource.preferredZoneIds) ? Array.from(new Set(requirementsSource.preferredZoneIds.map(String))) : [],
    excludedZoneIds: Array.isArray(requirementsSource.excludedZoneIds) ? Array.from(new Set(requirementsSource.excludedZoneIds.map(String))) : [],
    minDistanceStudentIds: Array.isArray(requirementsSource.minDistanceStudentIds) ? Array.from(new Set(requirementsSource.minDistanceStudentIds.map(String))).filter(value => value !== id) : []
  };
  return { id, firstName, lastName, nickName, grade, notesPrivate, notesSubstitute, notesPublic, noteCategories: { private: notesPrivate, substitute: notesSubstitute, public: notesPublic }, requirements, archived: Boolean(raw.archived), todayGuest: Boolean(raw.todayGuest), sourceSystem: String(raw.sourceSystem || '').slice(0, 80), sourceCourseId: String(raw.sourceCourseId || '').slice(0, 160), sourceUserId: String(raw.sourceUserId || '').slice(0, 160), sourceIdentifiers: raw.sourceIdentifiers && typeof raw.sourceIdentifiers === 'object' ? Object.fromEntries(Object.entries(raw.sourceIdentifiers).slice(0, 20).map(([key,value]) => [String(key).slice(0,80), String(value).slice(0,240)])) : {} };
}


function deepClone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function moveLegacyArrayField(record, currentKey, legacyKey) {
  if (!record || typeof record !== 'object') return record;
  if (!Array.isArray(record[currentKey]) && Array.isArray(record[legacyKey])) record[currentKey] = record[legacyKey];
  if (Object.prototype.hasOwnProperty.call(record, legacyKey)) delete record[legacyKey];
  return record;
}

function migrateLegacyCellGroupFields(cell) {
  if (!cell || typeof cell !== 'object') return cell;
  moveLegacyArrayField(cell, 'anchorGroupIds', LEGACY_SCHEMA_12_GROUP_FIELDS.anchorIds);
  return cell;
}

function migrateLegacyZoneGroupFields(zone) {
  if (!zone || typeof zone !== 'object') return zone;
  moveLegacyArrayField(zone, 'groupIds', LEGACY_SCHEMA_12_GROUP_FIELDS.zoneIds);
  return zone;
}

function migrateLegacyPageSettingsGroupFields(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  const visibility = settings.visibility && typeof settings.visibility === 'object' ? settings.visibility : null;
  if (visibility) {
    if (visibility.hideGroupDetails === undefined && visibility[LEGACY_SCHEMA_12_GROUP_FIELDS.hideDetails] !== undefined) {
      visibility.hideGroupDetails = visibility[LEGACY_SCHEMA_12_GROUP_FIELDS.hideDetails];
    }
    if (visibility.disableGroupEditing === undefined && visibility[LEGACY_SCHEMA_12_GROUP_FIELDS.disableEditing] !== undefined) {
      visibility.disableGroupEditing = visibility[LEGACY_SCHEMA_12_GROUP_FIELDS.disableEditing];
    }
    delete visibility[LEGACY_SCHEMA_12_GROUP_FIELDS.hideDetails];
    delete visibility[LEGACY_SCHEMA_12_GROUP_FIELDS.disableEditing];
  }
  return settings;
}

function migrateLegacyClassGroupFields(record) {
  if (!record || typeof record !== 'object') return record;
  moveLegacyArrayField(record, 'groups', LEGACY_SCHEMA_12_GROUP_FIELDS.collection);
  Object.values(record.cells || {}).forEach(migrateLegacyCellGroupFields);
  (record.zones || []).forEach(migrateLegacyZoneGroupFields);
  (record.seatingPlans || []).forEach(plan => Object.values(plan?.cells || {}).forEach(migrateLegacyCellGroupFields));
  (record.snapshots || []).forEach(snapshot => {
    if (snapshot?.data && typeof snapshot.data === 'object') migrateLegacyClassGroupFields(snapshot.data);
  });
  return record;
}

function migrateLegacyRoomGroupFields(room) {
  if (!room || typeof room !== 'object') return room;
  Object.values(room.cells || {}).forEach(migrateLegacyCellGroupFields);
  (room.zones || []).forEach(migrateLegacyZoneGroupFields);
  return room;
}

function migrateLegacyGroupTerminologyDocument(document) {
  if (!document || typeof document !== 'object') return document;
  if (document.kind === LEGACY_SCHEMA_12_GROUP_FIELDS.componentKind) document.kind = 'seating-chart-groups-config';
  moveLegacyArrayField(document, 'groups', LEGACY_SCHEMA_12_GROUP_FIELDS.collection);
  (document.classes || []).forEach(migrateLegacyClassGroupFields);
  if (document.class && typeof document.class === 'object') migrateLegacyClassGroupFields(document.class);
  (document.roomTemplates || []).forEach(migrateLegacyRoomGroupFields);
  if (document.currentRoom) migrateLegacyRoomGroupFields(document.currentRoom);
  migrateLegacyPageSettingsGroupFields(document.pageSettings);
  if (document.ui?.activeSideTab === LEGACY_SCHEMA_12_GROUP_FIELDS.sideTab) document.ui.activeSideTab = 'groups';
  (document.appSnapshots || document.snapshots || []).forEach(snapshot => {
    if (!snapshot || typeof snapshot.data !== 'string') return;
    try {
      const parsed = JSON.parse(snapshot.data);
      if (!parsed?.encrypted) {
        migrateLegacyGroupTerminologyDocument(parsed);
        snapshot.data = JSON.stringify(parsed);
      }
    } catch {
       
    }
  });
  return document;
}

function normalizeGroupRecord(b, index = 0) {
  return {
    id: b?.id || uid('group'),
    name: b?.name || 'Group',
    type: ['together', 'avoid', 'special', 'front', 'back', 'nearBoard', 'nearTeacher', 'awayDoor', 'awayWindow', 'spread', 'zone'].includes(b?.type) ? b.type : 'together',
    priority: Number(b?.priority) || 6,
    color: safeColor(b?.color, defaultGroupColor(index)),
    studentIds: Array.isArray(b?.studentIds) ? Array.from(new Set(b.studentIds.map(String))) : [],
    anchorSeats: Array.isArray(b?.anchorSeats) ? Array.from(new Set(b.anchorSeats.map(String))) : [],
    zoneId: b?.zoneId ? String(b.zoneId) : '',
    sourceSystem: String(b?.sourceSystem || '').slice(0, 80),
    sourceCourseId: String(b?.sourceCourseId || '').slice(0, 160),
    sourceGroupId: String(b?.sourceGroupId || '').slice(0, 240)
  };
}

function normalizeCellsRecord(cells) {
  const source = cells && typeof cells === 'object' ? cells : {};
  const normalized = {};
  Object.entries(source).forEach(([key, cell]) => {
    if (!cell || typeof cell !== 'object') return;
    normalized[key] = {
      row: Number(cell.row) || 1,
      col: Number(cell.col) || 1,
      type: cell.type || 'seat',
      assignedStudentId: cell.assignedStudentId ? String(cell.assignedStudentId) : null,
      manual: Boolean(cell.manual),
      anchorGroupIds: Array.from(new Set((Array.isArray(cell.anchorGroupIds) ? cell.anchorGroupIds : Array.isArray(cell[LEGACY_SCHEMA_12_GROUP_FIELDS.anchorIds]) ? cell[LEGACY_SCHEMA_12_GROUP_FIELDS.anchorIds] : []).map(String))),
      zoneIds: Array.isArray(cell.zoneIds) ? Array.from(new Set(cell.zoneIds.map(String))) : [],
      comment: String(cell.comment || '').trim().slice(0, 1200)
    };
  });
  return normalized;
}


function normalizeZoneRecord(zone, index = 0) {
  const source = zone && typeof zone === 'object' ? zone : {};
  const label = String(source.name || source.label || `Zone ${index + 1}`).trim().slice(0, 32) || `Zone ${index + 1}`;
  return {
    id: source.id || uid('zone'),
    name: label,
    color: safeColor(source.color, defaultGroupColor(index + 3)),
    studentIds: Array.isArray(source.studentIds) ? Array.from(new Set(source.studentIds.map(String))) : [],
    groupIds: Array.from(new Set((Array.isArray(source.groupIds) ? source.groupIds : Array.isArray(source[LEGACY_SCHEMA_12_GROUP_FIELDS.zoneIds]) ? source[LEGACY_SCHEMA_12_GROUP_FIELDS.zoneIds] : []).map(String))),
    comment: String(source.comment || '').trim().slice(0, 1200)
  };
}

function normalizeRoomTemplateRecord(template, index = 0) {
  const source = template && typeof template === 'object' ? template : {};
  return {
    id: source.id || uid('room-template'),
    name: String(source.name || `Room Template ${index + 1}`).trim().slice(0, 60) || `Room Template ${index + 1}`,
    rows: Math.max(1, Math.min(30, Number(source.rows) || 5)),
    cols: Math.max(1, Math.min(30, Number(source.cols) || 6)),
    cells: normalizeCellsRecord(source.cells),
    layoutMode: ['grid','freeform'].includes(source.layoutMode) ? source.layoutMode : 'grid',
    freeformLayout: normalizeFreeformLayout(source.freeformLayout),
    zones: Array.isArray(source.zones) ? source.zones.map(normalizeZoneRecord) : [],
    customObjects: Array.isArray(source.customObjects) ? source.customObjects.map(normalizeCustomObject).filter(Boolean) : [],
    description: String(source.description || '').trim().slice(0, 500),
    librarySource: String(source.librarySource || '').trim().slice(0, 160),
    shared: Boolean(source.shared),
    createdAt: source.createdAt || new Date().toISOString()
  };
}

function normalizeSnapshotRecord(snapshot, index = 0) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  return {
    format: CLASS_SNAPSHOT_FORMAT,
    app: APP_NAME,
    version: APP_REVISION,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    minimumReaderSchemaVersion: MIN_SUPPORTED_DATA_SCHEMA_VERSION,
    encryptionEnvelopeVersion: ENCRYPTION_ENVELOPE_VERSION,
    id: source.id || uid('snapshot'),
    name: String(source.name || `Snapshot ${index + 1}`).trim().slice(0, 60) || `Snapshot ${index + 1}`,
    createdAt: source.createdAt || new Date().toISOString(),
    data: source.data && typeof source.data === 'object' ? source.data : {}
  };
}

function normalizeChartMeta(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    title: String(source.title || '').slice(0, 120),
    date: String(source.date || '').slice(0, 30),
    period: String(source.period || '').slice(0, 60),
    room: String(source.room || '').slice(0, 60),
    teacher: String(source.teacher || '').slice(0, 80)
  };
}

function normalizeTodaySession(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    active: Boolean(source.active),
    date: String(source.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
    absentStudentIds: Array.isArray(source.absentStudentIds) ? Array.from(new Set(source.absentStudentIds.map(String))) : [],
    guestStudentIds: Array.isArray(source.guestStudentIds) ? Array.from(new Set(source.guestStudentIds.map(String))) : [],
    note: String(source.note || '').slice(0, 1000),
    masterAssignments: source.masterAssignments && typeof source.masterAssignments === 'object' ? deepClone(source.masterAssignments) : null,
    startedAt: source.startedAt || '',
    updatedAt: source.updatedAt || ''
  };
}

function normalizePlanSchedule(value) {
  const source = value && typeof value === 'object' ? value : {};
  const days = Array.isArray(source.daysOfWeek) ? source.daysOfWeek.map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6) : [];
  return {
    enabled: Boolean(source.enabled),
    daysOfWeek: Array.from(new Set(days)),
    startDate: String(source.startDate || '').slice(0, 10),
    endDate: String(source.endDate || '').slice(0, 10),
    period: String(source.period || '').trim().slice(0, 60),
    autoSuggest: source.autoSuggest !== false,
    lastAppliedAt: String(source.lastAppliedAt || '').slice(0, 40)
  };
}

function normalizeRequirementPreset(value, index = 0) {
  const source = value && typeof value === 'object' ? value : {};
  const sample = normalizeStudent({ id: `preset-${index}`, requirements: source.requirements || {} });
  return {
    id: source.id ? String(source.id) : uid('requirement-preset'),
    name: String(source.name || `Requirement Preset ${index + 1}`).trim().slice(0, 80) || `Requirement Preset ${index + 1}`,
    requirements: sample.requirements,
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: source.updatedAt || new Date().toISOString()
  };
}

function normalizeRuleOverride(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    id: String(source.id || '').slice(0, 240),
    reason: String(source.reason || '').trim().slice(0, 500),
    createdAt: source.createdAt || new Date().toISOString()
  };
}

function normalizeSeatingPlan(value, index = 0) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    id: source.id ? String(source.id) : uid('seating-plan'),
    name: String(source.name || `Plan ${index + 1}`).trim().slice(0, 80) || `Plan ${index + 1}`,
    reason: String(source.reason || '').trim().slice(0, 160),
    notes: String(source.notes || source.comment || '').trim().slice(0, 1200),
    comment: String(source.comment || source.notes || '').trim().slice(0, 1200),
    status: ['current','previous','archived'].includes(source.status) ? source.status : 'previous',
    createdAt: source.createdAt || new Date().toISOString(),
    schedule: normalizePlanSchedule(source.schedule),
    layoutMode: source.layoutMode === 'freeform' ? 'freeform' : 'grid',
    rows: Math.max(1, Math.min(30, Number(source.rows) || 5)),
    cols: Math.max(1, Math.min(30, Number(source.cols) || 6)),
    cells: normalizeCellsRecord(source.cells),
    freeformLayout: normalizeFreeformLayout(source.freeformLayout)
  };
}

function normalizeImportProfile(value, index = 0) {
  const source = value && typeof value === 'object' ? value : {};
  const mapping = source.mapping && typeof source.mapping === 'object' ? source.mapping : {};
  return {
    id: source.id ? String(source.id) : uid('import-profile'),
    name: String(source.name || `Import Profile ${index + 1}`).trim().slice(0, 80) || `Import Profile ${index + 1}`,
    mapping: Object.fromEntries(Object.entries(mapping).map(([key,val]) => [String(key), String(val)])),
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: source.updatedAt || new Date().toISOString()
  };
}

function todaySessionActive() {
  return Boolean(state.todaySession?.active);
}

function seatingStudents() {
  const absent = todaySessionActive() ? new Set((state.todaySession?.absentStudentIds || []).map(String)) : new Set();
  return (state.students || []).filter(student => !student.archived && !absent.has(String(student.id)));
}

function createClassRecord(name = 'Class 1') {
  return normalizeClassRecord({
    id: uid('class'),
    name,
    students: [],
    groups: [],
    rows: 5,
    cols: 6,
    cells: {},
    layoutMode: 'grid',
    freeformLayout: null,
    customObjects: [],
    zones: [],
    snapshots: [],
    chartMeta: {},
    todaySession: normalizeTodaySession(null),
    seatingPlans: [],
    importProfiles: [],
    rosterSourceGroups: [],
    rosterImportHistory: [],
    requirementPresets: [],
    ruleOverrides: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function normalizeClassRecord(record, index = 0) {
  const fallbackName = `Class ${index + 1}`;
  const cls = record && typeof record === 'object' ? record : {};
  return {
    id: cls.id || uid('class'),
    name: String(cls.name || cls.className || fallbackName).trim().slice(0, 80) || fallbackName,
    students: Array.isArray(cls.students) ? cls.students.map(normalizeStudent) : [],
    groups: (Array.isArray(cls.groups) ? cls.groups : Array.isArray(cls[LEGACY_SCHEMA_12_GROUP_FIELDS.collection]) ? cls[LEGACY_SCHEMA_12_GROUP_FIELDS.collection] : []).map(normalizeGroupRecord),
    rows: Math.max(1, Math.min(30, Number(cls.rows) || 5)),
    cols: Math.max(1, Math.min(30, Number(cls.cols) || 6)),
    cells: normalizeCellsRecord(cls.cells),
    layoutMode: ['grid','freeform'].includes(cls.layoutMode) ? cls.layoutMode : 'grid',
    freeformLayout: normalizeFreeformLayout(cls.freeformLayout),
    customObjects: Array.isArray(cls.customObjects) ? cls.customObjects.map(normalizeCustomObject).filter(Boolean) : [],
    zones: Array.isArray(cls.zones) ? cls.zones.map(normalizeZoneRecord) : [],
    snapshots: Array.isArray(cls.snapshots) ? cls.snapshots.map(normalizeSnapshotRecord) : [],
    chartMeta: normalizeChartMeta(cls.chartMeta),
    rosterArchive: Array.isArray(cls.rosterArchive) ? cls.rosterArchive.map(normalizeStudent) : [],
    todaySession: normalizeTodaySession(cls.todaySession),
    seatingPlans: Array.isArray(cls.seatingPlans) ? cls.seatingPlans.map(normalizeSeatingPlan) : [],
    importProfiles: Array.isArray(cls.importProfiles) ? cls.importProfiles.map(normalizeImportProfile) : [],
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
    requirementPresets: Array.isArray(cls.requirementPresets) ? cls.requirementPresets.map(normalizeRequirementPreset) : [],
    ruleOverrides: Array.isArray(cls.ruleOverrides) ? cls.ruleOverrides.map(normalizeRuleOverride).filter(item => item.id) : [],
    guidedPractice: Boolean(cls.guidedPractice),
    guidedLessonId: String(cls.guidedLessonId || '').slice(0, 80),
    guidedCreatedAt: String(cls.guidedCreatedAt || '').slice(0, 40),
    archived: Boolean(cls.archived),
    academicYear: String(cls.academicYear || '').slice(0, 20),
    term: String(cls.term || '').slice(0, 40),
    createdAt: cls.createdAt || new Date().toISOString(),
    updatedAt: cls.updatedAt || new Date().toISOString()
  };
}

function activeClassRecord() {
  return (state.classes || []).find(cls => cls.id === state.activeClassId) || null;
}

function activeClassName() {
  return activeClassRecord()?.name || 'Class';
}

function snapshotCurrentClassData() {
  return {
    students: deepClone(state.students || []),
    groups: deepClone(state.groups || []),
    rows: Number(state.rows) || 5,
    cols: Number(state.cols) || 6,
    cells: deepClone(state.cells || {}),
    layoutMode: state.layoutMode === 'freeform' ? 'freeform' : 'grid',
    freeformLayout: normalizeFreeformLayout(state.freeformLayout),
    customObjects: deepClone(state.customObjects || []),
    zones: deepClone(state.zones || []),
    snapshots: deepClone(activeClassRecord()?.snapshots || []),
    chartMeta: deepClone(state.chartMeta || {}),
    rosterArchive: deepClone(state.rosterArchive || []),
    todaySession: normalizeTodaySession(state.todaySession),
    seatingPlans: deepClone(state.seatingPlans || []),
    importProfiles: deepClone(state.importProfiles || []),
    requirementPresets: deepClone(state.requirementPresets || []),
    ruleOverrides: deepClone(state.ruleOverrides || []),
    updatedAt: new Date().toISOString()
  };
}

function persistActiveClass() {
  if (!Array.isArray(state.classes)) state.classes = [];
  let cls = activeClassRecord();
  if (!cls) {
    cls = normalizeClassRecord({ id: state.activeClassId || uid('class'), name: 'Class 1' });
    state.activeClassId = cls.id;
    state.classes.push(cls);
  }
  Object.assign(cls, snapshotCurrentClassData());
}

function applyClassToState(classId, { restoreGeometrySession = true } = {}) {
  const cls = (state.classes || []).find(item => item.id === classId) || state.classes?.[0];
  if (!cls) return;
  state.activeClassId = cls.id;
  state.students = deepClone(cls.students || []);
  state.groups = deepClone(cls.groups || []);
  state.rows = Number(cls.rows) || 5;
  state.cols = Number(cls.cols) || 6;
  state.cells = deepClone(cls.cells || {});
  state.layoutMode = cls.layoutMode === 'freeform' ? 'freeform' : 'grid';
  state.freeformLayout = normalizeFreeformLayout(cls.freeformLayout);
  state.customObjects = deepClone(cls.customObjects || []);
  state.zones = deepClone(cls.zones || []);
  state.chartMeta = normalizeChartMeta(cls.chartMeta);
  state.rosterArchive = deepClone(cls.rosterArchive || []);
  state.todaySession = normalizeTodaySession(cls.todaySession);
  state.seatingPlans = deepClone(cls.seatingPlans || []);
  state.importProfiles = deepClone(cls.importProfiles || []);
  state.requirementPresets = deepClone(cls.requirementPresets || []);
  state.ruleOverrides = deepClone(cls.ruleOverrides || []);
  if (restoreGeometrySession) restoreFreeformGeometrySessionForCurrentClass();
  resetFreeformGeometryCache();
  ensureGrid();
  if (uiState?.selectedCellKeys) {
    uiState.selectedCellKeys.clear();
    uiState.isSelectingCells = false;
    uiState.selectionAnchorKey = null;
  }
}

function ensureClassSystem() {
  state.classes = Array.isArray(state.classes) ? state.classes.map(normalizeClassRecord) : [];
  if (!state.classes.length) {
    const first = normalizeClassRecord({
      id: uid('class'),
      name: 'Class 1',
      students: state.students,
      groups: state.groups,
      rows: state.rows,
      cols: state.cols,
      cells: state.cells,
      layoutMode: state.layoutMode,
      freeformLayout: state.freeformLayout,
      customObjects: state.customObjects,
      zones: state.zones,
      chartMeta: state.chartMeta,
      todaySession: state.todaySession,
      seatingPlans: state.seatingPlans,
      importProfiles: state.importProfiles,
      requirementPresets: state.requirementPresets,
      ruleOverrides: state.ruleOverrides
    });
    state.classes.push(first);
    state.activeClassId = first.id;
  }
  if (!state.activeClassId || !state.classes.some(cls => cls.id === state.activeClassId)) {
    state.activeClassId = state.classes[0].id;
  }
  applyClassToState(state.activeClassId);
}

function renderClassManager() {
  const select = el('classSelect');
  if (!select) return;
  const current = state.activeClassId;
  const active = (state.classes || []).filter(cls => !cls.archived);
  const archived = (state.classes || []).filter(cls => cls.archived);
  const options = cls => {
    const studentCount = Array.isArray(cls.students) ? cls.students.length : 0;
    const term = [cls.academicYear, cls.term].filter(Boolean).join(' · ');
    return `<option value="${escapeHtml(cls.id)}">${escapeHtml(cls.name)} (${studentCount})${term ? ` · ${escapeHtml(term)}` : ''}</option>`;
  };
  const groups = [];
  if (active.length) groups.push(`<optgroup label="Active Classes">${active.map(options).join('')}</optgroup>`);
  if (pageSettings().showArchivedClasses && archived.length) groups.push(`<optgroup label="Archived Classes">${archived.map(options).join('')}</optgroup>`);
  if (!groups.length && archived.length) groups.push(`<optgroup label="Archived Classes">${archived.map(options).join('')}</optgroup>`);
  select.innerHTML = groups.join('');
  if (current && Array.from(select.options).some(option => option.value === current)) select.value = current;
  else if (select.options[0]) {
    select.value = select.options[0].value;
    if (select.value !== current) applyClassToState(select.value);
  }
}

function switchClass(classId) {
  if (!classId || classId === state.activeClassId) return;
  persistActiveClass();
  applyClassToState(classId);
  renderAll();
}

function newClass() {
  openClassNameModal('new');
}

function renameActiveClass() {
  openClassNameModal('rename');
}

function openTextInputModal({ title, label, value, confirmText, onConfirm }) {
  uiState.textInputCallback = typeof onConfirm === 'function' ? onConfirm : null;
  el('classNameMode').value = 'custom-input';
  el('classNameModalTitle').textContent = title || 'Enter Value';
  const labelEl = document.querySelector('label[for="classNameInput"]');
  if (labelEl) labelEl.textContent = label || 'Value';
  el('classNameInput').value = value || '';
  el('saveClassNameBtn').textContent = confirmText || 'Save';
  el('classNameModal').classList.add('show');
  setTimeout(() => el('classNameInput').select(), 50);
}

function openClassNameModal(mode) {
  const isRename = mode === 'rename';
  const cls = activeClassRecord();
  uiState.textInputCallback = null;
  const labelEl = document.querySelector('label[for="classNameInput"]');
  if (labelEl) labelEl.textContent = 'Class Name';
  el('classNameMode').value = isRename ? 'rename' : 'new';
  el('classNameModalTitle').textContent = isRename ? 'Rename Class' : 'New Class';
  el('classNameInput').value = isRename && cls ? cls.name : `Class ${(state.classes || []).length + 1}`;
  el('saveClassNameBtn').textContent = isRename ? 'Rename Class' : 'Create Class';
  el('classNameModal').classList.add('show');
  setTimeout(() => el('classNameInput').select(), 50);
}

function closeClassNameModal() {
  el('classNameModal').classList.remove('show');
}

function saveClassNameFromModal() {
  const mode = el('classNameMode').value;
  const name = String(el('classNameInput').value || '').trim().slice(0, 80) || `Class ${(state.classes || []).length + 1}`;
  if (mode === 'custom-input') {
    const callback = uiState.textInputCallback;
    uiState.textInputCallback = null;
    closeClassNameModal();
    if (callback) callback(name);
    return;
  }
  if (mode === 'rename') {
    const cls = activeClassRecord();
    if (cls) cls.name = name;
  } else {
    persistActiveClass();
    const cls = createClassRecord(name);
    state.classes.push(cls);
    applyClassToState(cls.id);
  }
  closeClassNameModal();
  renderAll();
}

function duplicateActiveClass() {
  persistActiveClass();
  const cls = activeClassRecord();
  if (!cls) return;
  const copy = normalizeClassRecord(deepClone(cls));
  copy.id = uid('class');
  copy.name = `${cls.name} Copy`;
  copy.createdAt = new Date().toISOString();
  copy.updatedAt = new Date().toISOString();
  state.classes.push(copy);
  applyClassToState(copy.id);
  renderAll();
}

function deleteActiveClass() {
  if ((state.classes || []).length <= 1) {
    setLiveStatusMessage('You must keep at least one class.');
    return;
  }
  const cls = activeClassRecord();
  if (!cls) return;
  showInAppConfirm(`Delete "${cls.name}" and everything inside it? Students, groups, seats, locks, anchors, and placements.`, () => {
    const currentIndex = state.classes.findIndex(item => item.id === cls.id);
    state.classes = state.classes.filter(item => item.id !== cls.id);
    const next = state.classes[Math.max(0, currentIndex - 1)] || state.classes[0];
    applyClassToState(next.id);
    renderAll();
    setLiveStatusMessage('Class deleted.');
  }, {
    title: 'Delete Class?',
    confirmText: 'Delete Class',
    cancelText: 'Cancel'
  });
}

function addStudent(student) {
  if (eyeModeBlocksStudentEditing()) return blockEyeModeAction('student');
  const normalized = normalizeStudent(student);
  if (!normalized.firstName && !normalized.lastName && !normalized.id) return;
  const existing = state.students.find(s => s.id === normalized.id);
  if (existing) {
    delete existing.notes;
    delete existing.note;
    Object.assign(existing, normalized);
  } else {
    state.students.push(normalized);
  }
}


function readDragData(event) {
  if (!event || !event.dataTransfer) return null;
  const types = ['application/json', 'text/plain'];
  for (const type of types) {
    const raw = event.dataTransfer.getData(type);
    if (!raw) continue;
    try { return JSON.parse(raw); } catch {   }
  }
  return null;
}

function addStudentToGroup(groupId, studentId, shouldRender = true) {
  if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group') && false;
  const group = getGroup(groupId);
  const student = getStudent(studentId);
  if (!group || !student) return false;
  const targetId = String(student.id);
  group.studentIds = Array.from(new Set((group.studentIds || []).map(String)));
  if (group.studentIds.includes(targetId)) {
    if (shouldRender) setLiveStatusMessage(`${studentDisplay(student)} is already in group "${group.name}".`);
    return false;
  }
  group.studentIds.push(targetId);
  if (shouldRender) {
    renderAll();
    setLiveStatusMessage(`Added ${studentDisplay(student)} to group "${group.name}".`);
  }
  return true;
}

function toggleStudentGroupMembership(studentId, groupId) {
  if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
  const group = getGroup(groupId);
  const student = getStudent(studentId);
  if (!group || !student) return;
  const targetId = String(student.id);
  group.studentIds = Array.from(new Set((group.studentIds || []).map(String)));
  if (group.studentIds.includes(targetId)) {
    removeStudentFromGroup(group.id, targetId);
  } else {
    addStudentToGroup(group.id, targetId, true);
  }
}

function removeStudentFromGroup(groupId, studentId) {
  if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
  const group = getGroup(groupId);
  if (!group) return;
  const targetId = String(studentId || '');
  const before = (group.studentIds || []).length;
  group.studentIds = (group.studentIds || []).map(String).filter(id => id !== targetId);

  if (group.studentIds.length === before) {
    renderAll();
    setLiveStatusMessage('That student was not found in this group.');
    return;
  }

  const student = getStudent(targetId);
  renderAll();
  setLiveStatusMessage(`Removed ${student ? studentDisplay(student) : targetId} from group "${group.name}".`);
}

function deleteStudent(studentId) {
  if (eyeModeBlocksStudentEditing()) return blockEyeModeAction('student');
  state.students = state.students.filter(s => s.id !== studentId);
  state.groups.forEach(b => b.studentIds = (b.studentIds || []).map(String).filter(id => id !== String(studentId)));
  state.zones.forEach(zone => zone.studentIds = (zone.studentIds || []).map(String).filter(id => id !== String(studentId)));
  removeStudentFromCells(studentId);
  renderAll();
}

function addGroup({ name, type, priority, studentIds, color, zoneId }) {
  if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
  const cleanName = String(name || '').trim() || `Group ${state.groups.length + 1}`;
  state.groups.push({
    id: uid('group'),
    name: cleanName,
    type: type || 'together',
    priority: Number(priority) || 6,
    color: safeColor(color, defaultGroupColor(state.groups.length)),
    studentIds: Array.from(new Set((studentIds || []).map(String))),
    anchorSeats: [],
    zoneId: zoneId ? String(zoneId) : ''
  });
  renderAll();
}

function resetGroupEditor() {
  const addButton = el('addGroupBtn');
  if (addButton) {
    delete addButton.dataset.editingGroupId;
    addButton.textContent = 'Create Rule';
  }
  const cancelButton = el('cancelGroupEditBtn');
  if (cancelButton) cancelButton.hidden = true;
  if (el('groupName')) el('groupName').value = '';
  if (el('groupType')) el('groupType').value = 'together';
  if (el('groupPriority')) el('groupPriority').value = '6';
  if (el('groupZoneSelect')) el('groupZoneSelect').value = '';
  if (el('groupColor')) el('groupColor').value = defaultGroupColor(state.groups.length);
  el('groupMemberPicker')?.querySelectorAll('input').forEach(input => { input.checked = false; });
  ClassSetupWorkspaceV54?.updateSummary?.();
}

function beginEditGroup(groupId) {
  if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
  const group = getGroup(groupId);
  if (!group) return;
  ClassSetupWorkspaceV54?.setSection?.('rules');
  if (el('groupName')) el('groupName').value = group.name || '';
  if (el('groupType')) el('groupType').value = group.type || 'together';
  if (el('groupPriority')) el('groupPriority').value = String(Number(group.priority) || 6);
  if (el('groupZoneSelect')) el('groupZoneSelect').value = String(group.zoneId || '');
  if (el('groupColor')) el('groupColor').value = safeColor(group.color, '#2f6fed');
  const addButton = el('addGroupBtn');
  if (addButton) {
    addButton.dataset.editingGroupId = String(group.id);
    addButton.textContent = 'Save Changes';
  }
  const cancelButton = el('cancelGroupEditBtn');
  if (cancelButton) cancelButton.hidden = false;
  renderGroupMemberPicker();
  const selected = new Set((group.studentIds || []).map(String));
  el('groupMemberPicker')?.querySelectorAll('input').forEach(input => { input.checked = selected.has(String(input.value)); });
  document.querySelector('.class-setup-rule-form-card')?.classList.add('editing-rule');
  el('groupName')?.focus();
  document.querySelector('.class-setup-rule-form-card')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  ClassSetupWorkspaceV54?.updateSummary?.();
  setLiveStatusMessage(`Editing group or rule "${group.name}".`);
}

function saveGroupEditor() {
  const addButton = el('addGroupBtn');
  const editingId = String(addButton?.dataset.editingGroupId || '');
  const studentIds = Array.from(el('groupMemberPicker')?.querySelectorAll('input:checked') || []).map(input => input.value);
  const values = {
    name: String(el('groupName')?.value || '').trim(),
    type: el('groupType')?.value || 'together',
    priority: Number(el('groupPriority')?.value) || 6,
    color: el('groupColor')?.value || '#2f6fed',
    zoneId: el('groupZoneSelect')?.value || '',
    studentIds
  };
  if (!editingId) {
    addGroup(values);
    resetGroupEditor();
    setLiveStatusMessage(`Created group or seating rule "${values.name || state.groups[state.groups.length - 1]?.name || 'New rule'}".`);
    return;
  }
  const group = getGroup(editingId);
  if (!group) {
    resetGroupEditor();
    return;
  }
  const oldZoneId = String(group.zoneId || '');
  group.name = values.name || group.name || `Rule ${state.groups.length}`;
  group.type = values.type;
  group.priority = values.priority;
  group.color = safeColor(values.color, group.color || '#2f6fed');
  group.studentIds = Array.from(new Set(values.studentIds.map(String)));
  group.zoneId = String(values.zoneId || '');
  if (oldZoneId !== group.zoneId) {
    state.zones.forEach(zone => { zone.groupIds = (zone.groupIds || []).map(String).filter(id => id !== String(group.id)); });
    const newZone = group.zoneId ? zoneById(group.zoneId) : null;
    if (newZone) newZone.groupIds = Array.from(new Set([...(newZone.groupIds || []).map(String), String(group.id)]));
  }
  renderAll();
  document.querySelector('.class-setup-rule-form-card')?.classList.remove('editing-rule');
  resetGroupEditor();
  setLiveStatusMessage(`Saved changes to group or rule "${group.name}".`);
}

function deleteGroup(groupId) {
  if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
  state.groups = state.groups.filter(b => b.id !== groupId);
  Object.values(state.cells).forEach(cell => {
    cell.anchorGroupIds = (cell.anchorGroupIds || []).filter(id => id !== groupId);
  });
  (state.freeformLayout?.objects || []).forEach(obj => {
    obj.anchorGroupIds = (obj.anchorGroupIds || []).filter(id => String(id) !== String(groupId));
  });
  state.zones.forEach(zone => {
    zone.groupIds = (zone.groupIds || []).map(String).filter(id => id !== String(groupId));
  });
  renderAll();
}

function addGroupAnchorWithoutRender(groupId, cellKey) {
  if (eyeModeBlocksGroupEditing() || eyeModeBlocksSeatEditing()) return false;
  const group = getGroup(groupId);
  const cell = state.cells[cellKey];
  if (!group || !cell || cell.type !== 'seat') return false;
  group.anchorSeats = group.anchorSeats || [];
  if (!group.anchorSeats.includes(cellKey)) group.anchorSeats.push(cellKey);
  cell.anchorGroupIds = cell.anchorGroupIds || [];
  if (!cell.anchorGroupIds.includes(groupId)) cell.anchorGroupIds.push(groupId);
  return true;
}


function removeAnchorFromCell(groupId, cellKey) {
  if (eyeModeBlocksGroupEditing() || eyeModeBlocksSeatEditing()) return blockEyeModeAction('group');
  const group = getGroup(groupId);
  const cell = state.cells[cellKey];
  if (!cell) return;
  cell.anchorGroupIds = (cell.anchorGroupIds || []).filter(id => id !== groupId);
  if (group) group.anchorSeats = (group.anchorSeats || []).filter(key => key !== cellKey);
  renderAll();
}

function addStudentToZone(zoneId, studentId, shouldRender = true) {
  if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group') && false;
  const zone = zoneById(zoneId);
  const student = getStudent(studentId);
  if (!zone || !student) return false;
  zone.studentIds = Array.from(new Set([...(zone.studentIds || []).map(String), String(student.id)]));
  if (shouldRender) {
    renderAll();
    setLiveStatusMessage(`Added ${studentDisplay(student)} to zone "${zone.name}".`);
  }
  return true;
}

function removeStudentFromZone(zoneId, studentId, shouldRender = true) {
  if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group') && false;
  const zone = zoneById(zoneId);
  if (!zone) return false;
  zone.studentIds = (zone.studentIds || []).map(String).filter(id => id !== String(studentId));
  if (shouldRender) {
    renderAll();
    const student = getStudent(studentId);
    setLiveStatusMessage(`Removed ${student ? studentDisplay(student) : studentId} from zone "${zone.name}".`);
  }
  return true;
}

function attachGroupToZone(groupId, zoneId, shouldRender = true) {
  if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group') && false;
  const group = getGroup(groupId);
  const zone = zoneById(zoneId);
  if (!group || !zone) return false;
  group.zoneId = String(zone.id);
  zone.groupIds = Array.from(new Set([...(zone.groupIds || []).map(String), String(group.id)]));
  if (shouldRender) {
    renderAll();
    setLiveStatusMessage(`Attached group "${group.name}" to zone "${zone.name}".`);
  }
  return true;
}

function detachGroupFromZone(groupId, zoneId = null, shouldRender = true) {
  if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group') && false;
  const group = getGroup(groupId);
  const targetZoneId = String(zoneId || group?.zoneId || '');
  if (group && (!targetZoneId || String(group.zoneId || '') === targetZoneId)) group.zoneId = '';
  state.zones.forEach(zone => {
    if (!targetZoneId || String(zone.id) === targetZoneId) zone.groupIds = (zone.groupIds || []).map(String).filter(id => id !== String(groupId));
  });
  if (shouldRender) {
    renderAll();
    setLiveStatusMessage('Group detached from zone.');
  }
  return true;
}

function renameZone(zoneId) {
  if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
  const zone = zoneById(zoneId);
  if (!zone) return;
  openTextInputModal({
    title: 'Rename Zone',
    label: 'Zone name',
    value: zone.name,
    confirmText: 'Save Zone',
    onConfirm: value => {
      zone.name = String(value || zone.name).trim().slice(0, 32) || zone.name;
      renderAll();
      setLiveStatusMessage(`Renamed zone to "${zone.name}".`);
    }
  });
}

function deleteZone(zoneId) {
  if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
  const zone = zoneById(zoneId);
  if (!zone) return;
  showInAppConfirm(`Delete zone "${zone.name}" and remove it from all seats and groups?`, () => {
    state.zones = (state.zones || []).filter(item => String(item.id) !== String(zoneId));
    Object.values(state.cells).forEach(cell => { cell.zoneIds = (cell.zoneIds || []).filter(id => String(id) !== String(zoneId)); });
    (state.freeformLayout?.objects || []).forEach(obj => { obj.zoneIds = (obj.zoneIds || []).filter(id => String(id) !== String(zoneId)); });
    state.groups.forEach(group => { if (String(group.zoneId || '') === String(zoneId)) group.zoneId = ''; });
    renderAll();
    setLiveStatusMessage(`Deleted zone "${zone.name}".`);
  }, { title: 'Delete Zone?', confirmText: 'Delete Zone', cancelText: 'Cancel' });
}

function renderStudents() {
  const list = el('studentList');
  const count = el('studentCount');
  count.textContent = state.students.length;
  const subCount = document.getElementById('studentSubCount');
  if (subCount) subCount.textContent = state.students.length;
  list.innerHTML = '';
  if (!state.students.length) {
    list.innerHTML = '<div class="hint">No students yet. Add a student manually or import a CSV roster.</div>';
  }
  const groupsByStudent = buildLookupMaps().groupsByStudent;
  const assignedSeats = assignedSeatsByStudent();
  const fragment = document.createDocumentFragment();
  const sorted = [...state.students].sort((a,b) => studentDisplay(a).localeCompare(studentDisplay(b)));
  sorted.forEach(student => {
    const groups = groupsByStudent.get(String(student.id)) || [];
    const assigned = assignedSeats.get(String(student.id)) || null;
    const card = document.createElement('div');
    card.className = 'student-card';
    card.draggable = !eyeModeBlocksSeatEditing();
    card.dataset.studentId = student.id;
    card.innerHTML = `
          <div class="student-name">
            <span class="student-name-main">${studentGroupDots(student.id, groups)}<span class="student-name-text">${escapeHtml(studentDisplay(student))}</span>${studentNoteFlags(student)}</span>
            <span class="card-actions">
              <button class="tiny secondary icon-button" type="button" data-edit-student-notes="${escapeHtml(student.id)}" aria-label="Open notes" title="Open categorized notes for this student.">📝</button>
              <button class="tiny secondary student-edit-action" type="button" data-edit-student-id="${escapeHtml(student.id)}" title="Edit this student's first name, last name, nickname, grade, or ID.">Edit</button>
              <button class="tiny danger icon-button" type="button" data-delete-student="${escapeHtml(student.id)}" aria-label="Delete student" title="Delete this student">🗑</button>
            </span>
          </div>
          <div class="student-meta">${escapeHtml(studentMetaText(student))}</div>
          <div class="pill-row">
            ${assigned ? `<span class="pill manual">Seat ${assigned.row},${assigned.col}${assigned.manual ? ' · locked' : ''}</span>` : ''}
            ${groups.map(b => `<span class="pill ${escapeHtml(b.type)}">${escapeHtml(b.name)}</span>`).join('')}
            ${ModernizationSuite.studentRequirementPills(student)}
          </div>
        `;
    fragment.appendChild(card);
  });
  list.appendChild(fragment);
  window.SeatGuidanceV66?.enhanceStudentCards?.(list);
  window.PlanningToolsV66?.refreshStudentFilters?.();
}

function renderGroupMemberPicker() {
  const picker = el('groupMemberPicker');
  if (!picker) return;
  const editingId = String(el('addGroupBtn')?.dataset.editingGroupId || '');
  const editingGroup = editingId ? getGroup(editingId) : null;
  const previouslyChecked = new Set(Array.from(picker.querySelectorAll('input:checked')).map(input => String(input.value)));
  const checkedIds = editingGroup ? new Set((editingGroup.studentIds || []).map(String)) : previouslyChecked;
  picker.innerHTML = '';
  if (!state.students.length) {
    picker.innerHTML = '<div class="class-setup-empty compact"><strong>No students available</strong><span>Add or import students before creating a group or seating rule.</span></div>';
    return;
  }
  const fragment = document.createDocumentFragment();
  const sorted = [...state.students].sort((a,b) => studentDisplay(a).localeCompare(studentDisplay(b)));
  sorted.forEach(student => {
    const label = document.createElement('label');
    label.className = 'checkline group-member-option';
    const checked = checkedIds.has(String(student.id)) ? ' checked' : '';
    label.innerHTML = `<input type="checkbox" value="${escapeHtml(student.id)}"${checked} /> <span><strong>${escapeHtml(studentDisplay(student))}</strong><small>${escapeHtml(studentMetaText(student) || 'Student')}</small></span>`;
    fragment.appendChild(label);
  });
  picker.appendChild(fragment);
}

function renderGroups() {
  const list = el('groupList');
  if (!list) return;
  el('groupCount').textContent = state.groups.length;
  const groupSubCount = document.getElementById('groupSubCount');
  if (groupSubCount) groupSubCount.textContent = state.groups.length;
  list.innerHTML = '';
  if (!state.groups.length) {
    list.innerHTML = '<div class="class-setup-empty"><strong>No groups or seating rules yet</strong><span>Create only the relationships or location preferences that matter for this class. You can return and add more later.</span></div>';
    return;
  }
  const fragment = document.createDocumentFragment();
  const sorted = [...state.groups].sort((a,b) => b.priority - a.priority || a.name.localeCompare(b.name));
  sorted.forEach(group => {
    const members = (group.studentIds || []).map(getStudent).filter(Boolean).sort((a,b) => studentDisplay(a).localeCompare(studentDisplay(b)));
    const anchors = group.anchorSeats || [];
    const card = document.createElement('article');
    card.className = 'group-card rule-card';
    card.draggable = document.body.dataset.workflow !== 'setup' && !eyeModeBlocksGroupEditing() && !eyeModeBlocksSeatEditing();
    card.dataset.groupId = group.id;
    card.style.setProperty('--rule-color', safeColor(group.color, '#2f6fed'));
    card.title = document.body.dataset.workflow === 'setup'
      ? 'Use Edit to change this rule. Seat anchors are assigned later when the room is visible.'
      : 'Drag this rule onto visible seats to reserve anchors for its members.';
    const attachedZone = group.zoneId ? zoneById(group.zoneId) : null;
    const memberListHtml = members.length
      ? members.map(student => `
            <span class="rule-member-chip" data-student-id="${escapeHtml(student.id)}">
              <span>${escapeHtml(studentDisplay(student))}</span>
              <button type="button" class="rule-member-remove" data-remove-group-member="${escapeHtml(group.id)}" data-remove-student-id="${escapeHtml(student.id)}" aria-label="Remove ${escapeHtml(studentDisplay(student))} from ${escapeHtml(group.name)}" title="Remove this student from this rule">×</button>
            </span>`).join('')
      : '<span class="rule-card-empty-members">No students selected yet</span>';
    const anchorText = anchors.length ? `${anchors.length} reserved seat${anchors.length === 1 ? '' : 's'}` : 'No reserved seats yet';
    card.innerHTML = `
          <div class="rule-card-header">
            <div class="rule-card-title-wrap"><span class="group-swatch" style="background:${escapeHtml(safeColor(group.color, '#2f6fed'))}"></span><div><strong class="rule-card-title">${escapeHtml(group.name)}</strong><span class="rule-card-type">${escapeHtml(typeLabel(group.type))}</span></div></div>
            <div class="rule-card-actions">
              <button class="tiny secondary" type="button" data-edit-group="${escapeHtml(group.id)}">Edit</button>
              <button class="tiny danger icon-button" type="button" data-delete-group="${escapeHtml(group.id)}" aria-label="Delete rule" title="Delete this group or rule">🗑</button>
            </div>
          </div>
          <p class="rule-card-description">${escapeHtml(ruleTypeDescription(group.type))}</p>
          <div class="rule-card-stats"><span class="pill">${escapeHtml(priorityLabel(group.priority))}</span><span class="pill">${members.length} student${members.length === 1 ? '' : 's'}</span>${attachedZone ? `<span class="pill special">Zone: ${escapeHtml(attachedZone.name)}</span>` : ''}</div>
          <div class="rule-card-section"><span class="rule-card-section-label">Students</span><div class="rule-card-members">${memberListHtml}</div></div>
          <footer class="rule-card-footer"><span>${escapeHtml(anchorText)}</span><span>${anchors.length ? 'Manage anchors in Room Design' : 'Assign anchors later in Room Design'}</span></footer>`;
    fragment.appendChild(card);
  });
  list.appendChild(fragment);
  ClassSetupWorkspaceV54?.updateSummary?.();
}


function installZoneListEventDelegation(list) {
  if (!list || list.dataset.zoneEventsInstalled === 'true') return;
  list.dataset.zoneEventsInstalled = 'true';

  const zoneCard = event => {
    const target = event.target instanceof Element ? event.target : null;
    const card = target?.closest('.zone-list-card[data-zone-id]');
    return card && list.contains(card) ? card : null;
  };

  list.addEventListener('dragstart', event => {
    const card = zoneCard(event);
    if (!card) return;
    card.classList.add('dragging');
    const payload = JSON.stringify({ type: 'zone', id: card.dataset.zoneId });
    event.dataTransfer?.setData('application/json', payload);
    event.dataTransfer?.setData('text/plain', payload);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copyMove';
  });

  list.addEventListener('dragend', event => zoneCard(event)?.classList.remove('dragging'));
  list.addEventListener('dragover', event => {
    const card = zoneCard(event);
    if (!card) return;
    event.preventDefault();
    card.classList.add('drop-target');
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });
  list.addEventListener('dragleave', event => {
    const card = zoneCard(event);
    if (!card || (event.relatedTarget instanceof Node && card.contains(event.relatedTarget))) return;
    card.classList.remove('drop-target');
  });
  list.addEventListener('drop', event => {
    const card = zoneCard(event);
    if (!card) return;
    event.preventDefault();
    event.stopPropagation();
    card.classList.remove('drop-target');
    const data = readDragData(event);
    if (!data) return;
    if (data.type === 'student' || data.type === 'groupMember') addStudentToZone(card.dataset.zoneId, data.id, true);
    if (data.type === 'group') attachGroupToZone(data.id, card.dataset.zoneId, true);
  });
}

function buildZoneUsageIndex(zones = state.zones || []) {
  const zoneIds = new Set(zones.map(zone => String(zone.id)));
  const cellCounts = new Map([...zoneIds].map(zoneId => [zoneId, 0]));
  Object.values(state.cells || {}).forEach(cell => {
    (cell.zoneIds || []).forEach(zoneId => {
      const id = String(zoneId);
      if (cellCounts.has(id)) cellCounts.set(id, cellCounts.get(id) + 1);
    });
  });

  const explicitZonesByGroup = new Map();
  zones.forEach(zone => {
    (zone.groupIds || []).forEach(groupId => {
      const id = String(groupId);
      if (!explicitZonesByGroup.has(id)) explicitZonesByGroup.set(id, []);
      explicitZonesByGroup.get(id).push(String(zone.id));
    });
  });

  const groupsByZone = new Map([...zoneIds].map(zoneId => [zoneId, []]));
  (state.groups || []).forEach(group => {
    const attachedZoneIds = new Set(explicitZonesByGroup.get(String(group.id)) || []);
    if (group.zoneId) attachedZoneIds.add(String(group.zoneId));
    attachedZoneIds.forEach(zoneId => {
      if (groupsByZone.has(zoneId)) groupsByZone.get(zoneId).push(group);
    });
  });

  return { cellCounts, groupsByZone };
}

function renderZones() {
  const zoneCount = el('zoneCount');
  const zoneSubCount = el('zoneSubCount');
  const list = el('zoneList');
  const zones = Array.isArray(state.zones) ? state.zones : [];
  const zoneUsage = buildZoneUsageIndex(zones);
  if (zoneCount) zoneCount.textContent = zones.length;
  if (zoneSubCount) zoneSubCount.textContent = zones.length;
  if (!list) return;
  installZoneListEventDelegation(list);
  list.innerHTML = '';
  if (!zones.length) {
    list.innerHTML = '<div class="hint">No zones yet. Select cells in the room grid, then save them as a zone.</div>';
    return;
  }
  const fragment = document.createDocumentFragment();
  zones.forEach(zone => {
    const zoneId = String(zone.id);
    const cellCount = zoneUsage.cellCounts.get(zoneId) || 0;
    const students = (zone.studentIds || []).map(getStudent).filter(Boolean).sort((a,b) => studentDisplay(a).localeCompare(studentDisplay(b)));
    const groups = zoneUsage.groupsByZone.get(zoneId) || [];
    const card = document.createElement('div');
    card.className = 'zone-list-card';
    card.draggable = true;
    card.dataset.zoneId = zone.id;
    card.style.borderColor = safeColor(zone.color, '#8b5cf6');
    card.innerHTML = `
          <div class="zone-list-card-head">
            <div>
              <strong><span class="zone-swatch" style="background:${escapeHtml(safeColor(zone.color, '#8b5cf6'))}"></span> ${escapeHtml(zone.name)}</strong>
              <div class="student-meta">${cellCount} cell(s) · ${students.length} student(s) · ${groups.length} group(s)</div>
            </div>
            <span class="card-actions">
              <button class="tiny secondary" type="button" data-rename-zone="${escapeHtml(zone.id)}">Edit</button>
              <button class="tiny danger icon-button" type="button" data-delete-zone="${escapeHtml(zone.id)}" aria-label="Delete zone" title="Delete this zone">🗑</button>
            </span>
          </div>
          <div class="pill-row">${groups.map(b => `<span class="pill ${escapeHtml(b.type)}">${escapeHtml(b.name)}</span>`).join('') || '<span class="muted">No attached groups</span>'}</div>
          <div>${students.map(student => `<div class="zone-member-row"><span>${studentGroupDots(student.id)} ${escapeHtml(studentDisplay(student))}</span><button class="tiny secondary" type="button" data-remove-zone-student="${escapeHtml(zone.id)}" data-remove-student-id="${escapeHtml(student.id)}">Remove</button></div>`).join('')}</div>
        `;
    fragment.appendChild(card);
  });
  list.appendChild(fragment);
}


function groupManagerCarryDescription(payload = uiState.groupManagerCarryItem) {
  if (!payload) return { title: 'Ready to move', hint: 'Choose Pick Up on a student, group, zone, or group member.' };
  if (payload.type === 'student' || payload.type === 'groupMember') {
    const student = getStudent(payload.id);
    return {
      title: `Moving ${student ? studentDisplay(student) : 'student'}`,
      hint: payload.type === 'groupMember'
        ? 'Tap a group or zone to add this student there, or tap the remove area to remove them from the source group.'
        : 'Tap a group or zone to add this student.'
    };
  }
  if (payload.type === 'group') {
    const group = getGroup(payload.id);
    return { title: `Moving group ${group?.name || ''}`.trim(), hint: 'Tap a zone to attach this group to that preferred zone.' };
  }
  if (payload.type === 'zone') {
    const zone = zoneById(payload.id);
    return { title: `Moving zone ${zone?.name || ''}`.trim(), hint: 'Tap a group to attach that group to this preferred zone.' };
  }
  return { title: 'Ready to move', hint: 'Choose Pick Up on a student, group, zone, or group member.' };
}

function updateGroupManagerCarryUi() {
  const payload = uiState.groupManagerCarryItem;
  const banner = el('groupManagerCarryBanner');
  const description = groupManagerCarryDescription(payload);
  if (banner) banner.hidden = !payload;
  if (el('groupManagerCarryTitle')) el('groupManagerCarryTitle').textContent = description.title;
  if (el('groupManagerCarryHint')) el('groupManagerCarryHint').textContent = description.hint;

  document.querySelectorAll('#groupManagerModal .group-manager-carry-source, #groupManagerModal .group-manager-carry-target')
    .forEach(node => node.classList.remove('group-manager-carry-source', 'group-manager-carry-target'));
  if (!payload) return;

  const sourceSelector = payload.type === 'student'
    ? `.group-manager-student[data-student-id="${cssEscape(payload.id)}"]`
    : payload.type === 'groupMember'
      ? `.group-manager-member[data-student-id="${cssEscape(payload.id)}"][data-source-group-id="${cssEscape(payload.sourceGroupId || '')}"]`
      : payload.type === 'group'
        ? `.group-manager-group[data-group-id="${cssEscape(payload.id)}"]`
        : `.group-manager-zone[data-zone-id="${cssEscape(payload.id)}"]`;
  document.querySelectorAll(`#groupManagerModal ${sourceSelector}`).forEach(node => node.classList.add('group-manager-carry-source'));

  if (payload.type === 'student' || payload.type === 'groupMember') {
    document.querySelectorAll('#groupManagerModal .group-manager-group, #groupManagerModal .group-manager-zone')
      .forEach(node => node.classList.add('group-manager-carry-target'));
    if (payload.type === 'groupMember') el('groupManagerRemoveZone')?.classList.add('group-manager-carry-target');
  } else if (payload.type === 'group') {
    document.querySelectorAll('#groupManagerModal .group-manager-zone').forEach(node => node.classList.add('group-manager-carry-target'));
  } else if (payload.type === 'zone') {
    document.querySelectorAll('#groupManagerModal .group-manager-group').forEach(node => node.classList.add('group-manager-carry-target'));
  }
}

function clearGroupManagerCarry() {
  uiState.groupManagerCarryItem = null;
  updateGroupManagerCarryUi();
}

function setGroupManagerCarry(payload) {
  if (!payload || eyeModeBlocksGroupEditing()) return false;
  const normalized = { type: payload.type, id: String(payload.id || '') };
  if (payload.sourceGroupId) normalized.sourceGroupId = String(payload.sourceGroupId);
  const valid = normalized.type === 'student' ? !!getStudent(normalized.id)
    : normalized.type === 'groupMember' ? !!getStudent(normalized.id) && !!getGroup(normalized.sourceGroupId)
      : normalized.type === 'group' ? !!getGroup(normalized.id)
        : normalized.type === 'zone' ? !!zoneById(normalized.id)
          : false;
  if (!valid) return false;
  uiState.groupManagerCarryItem = normalized;
  updateGroupManagerCarryUi();
  return true;
}

function applyGroupManagerCarry(targetType, targetId) {
  const payload = uiState.groupManagerCarryItem;
  if (!payload) return false;
  const target = String(targetId || '');
  clearGroupManagerCarry();

  if (targetType === 'remove') {
    if (payload.type !== 'groupMember' || !payload.sourceGroupId) return false;
    removeStudentFromGroup(payload.sourceGroupId, payload.id);
    return true;
  }
  if (targetType === 'group') {
    if (payload.type === 'student' || payload.type === 'groupMember') return addStudentToGroup(target, payload.id, true);
    if (payload.type === 'zone') return attachGroupToZone(target, payload.id, true);
    return false;
  }
  if (targetType === 'zone') {
    if (payload.type === 'student' || payload.type === 'groupMember') return addStudentToZone(target, payload.id, true);
    if (payload.type === 'group') return attachGroupToZone(payload.id, target, true);
  }
  return false;
}

function writeManagerDragData(event, payload) {
  if (!event?.dataTransfer || !payload) return false;
  const text = JSON.stringify(payload);
  event.dataTransfer.setData('application/json', text);
  event.dataTransfer.setData('text/plain', text);
  event.dataTransfer.effectAllowed = payload.type === 'groupMember' ? 'move' : 'copyMove';
  return true;
}

function groupManagerPayloadFromTarget(target) {
  if (!target || target.closest?.('button, input, select, textarea, a')) return null;
  const member = target.closest?.('.group-manager-member[data-student-id][data-source-group-id]');
  if (member) {
    return {
      type: 'groupMember',
      id: member.dataset.studentId,
      sourceGroupId: member.dataset.sourceGroupId
    };
  }
  const student = target.closest?.('.group-manager-student[data-student-id]');
  if (student) return { type: 'student', id: student.dataset.studentId };
  const group = target.closest?.('.group-manager-group[data-group-id]');
  if (group) return { type: 'group', id: group.dataset.groupId };
  const zone = target.closest?.('.group-manager-zone[data-zone-id]');
  if (zone) return { type: 'zone', id: zone.dataset.zoneId };
  return null;
}

function groupManagerDropDestinationAt(clientX, clientY, payload = uiState.groupManagerCarryItem) {
  if (!payload || typeof document.elementFromPoint !== 'function') return null;
  const under = document.elementFromPoint(clientX, clientY);
  if (!under || !under.closest?.('#groupManagerModal')) return null;
  const remove = under.closest('#groupManagerRemoveZone');
  if (remove && payload.type === 'groupMember') return { type: 'remove', id: '', node: remove };
  const group = under.closest('.group-manager-group[data-group-id]');
  if (group && ['student', 'groupMember', 'zone'].includes(payload.type)) {
    return { type: 'group', id: group.dataset.groupId, node: group };
  }
  const zone = under.closest('.group-manager-zone[data-zone-id]');
  if (zone && ['student', 'groupMember', 'group'].includes(payload.type)) {
    return { type: 'zone', id: zone.dataset.zoneId, node: zone };
  }
  return null;
}

function groupManagerDragNode(target, payload) {
  if (!target || !payload) return null;
  if (payload.type === 'groupMember') return target.closest?.('.group-manager-member[data-student-id][data-source-group-id]') || null;
  if (payload.type === 'student') return target.closest?.('.group-manager-student[data-student-id]') || null;
  if (payload.type === 'group') return target.closest?.('.group-manager-group[data-group-id]') || null;
  if (payload.type === 'zone') return target.closest?.('.group-manager-zone[data-zone-id]') || null;
  return null;
}

function installGroupManagerDragDelegation() {
  const modal = el('groupManagerModal');
  if (!modal || modal.dataset.dragEventsInstalled === 'true') return;
  modal.dataset.dragEventsInstalled = 'true';

  const dropTarget = target => target?.closest?.('#groupManagerRemoveZone, .group-manager-group[data-group-id], .group-manager-zone[data-zone-id]') || null;
  const clearDropTarget = target => target?.classList?.remove('drop-target');

  modal.addEventListener('dragstart', event => {
    if (eyeModeBlocksGroupEditing()) {
      event.preventDefault();
      blockEyeModeAction('group');
      return;
    }
    const payload = groupManagerPayloadFromTarget(event.target);
    if (!payload) return;
    const node = groupManagerDragNode(event.target, payload);
    node?.classList.add('dragging');
    writeManagerDragData(event, payload);
  });

  modal.addEventListener('dragend', event => {
    event.target.closest?.('.group-manager-student, .group-manager-member, .group-manager-group, .group-manager-zone')?.classList.remove('dragging');
    modal.querySelectorAll('.drop-target').forEach(clearDropTarget);
  });

  modal.addEventListener('dragover', event => {
    const target = dropTarget(event.target);
    if (!target) return;
    event.preventDefault();
    if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
    target.classList.add('drop-target');
    if (event.dataTransfer) event.dataTransfer.dropEffect = target.id === 'groupManagerRemoveZone' ? 'move' : 'copy';
  });

  modal.addEventListener('dragleave', event => {
    const target = dropTarget(event.target);
    if (!target) return;
    const related = event.relatedTarget;
    if (related && target.contains(related)) return;
    clearDropTarget(target);
  });

  modal.addEventListener('drop', event => {
    const target = dropTarget(event.target);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    clearDropTarget(target);
    if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
    const data = readDragData(event);
    if (!data) return;

    if (target.id === 'groupManagerRemoveZone') {
      if (data.type === 'groupMember' && data.sourceGroupId && data.id) removeStudentFromGroup(data.sourceGroupId, data.id);
      return;
    }
    if (target.matches('.group-manager-group[data-group-id]')) {
      if (data.type === 'student' || data.type === 'groupMember') addStudentToGroup(target.dataset.groupId, data.id, true);
      if (data.type === 'zone') attachGroupToZone(target.dataset.groupId, data.id, true);
      return;
    }
    if (data.type === 'student' || data.type === 'groupMember') addStudentToZone(target.dataset.zoneId, data.id, true);
    if (data.type === 'group') attachGroupToZone(data.id, target.dataset.zoneId, true);
  });
}

function installGroupManagerPointerDragSupport() {
  const modal = el('groupManagerModal');
  if (!modal || modal.dataset.pointerDragInstalled === 'true') return;
  modal.dataset.pointerDragInstalled = 'true';
  let pending = null;
  let activeTarget = null;
  let suppressNextClick = false;

  const clearTarget = () => {
    activeTarget?.classList.remove('drop-target');
    activeTarget = null;
  };
  const reset = ({ clearCarry = true } = {}) => {
    clearTarget();
    modal.classList.remove('group-manager-pointer-dragging');
    pending = null;
    if (clearCarry) clearGroupManagerCarry();
  };
  const updateTarget = event => {
    clearTarget();
    const destination = groupManagerDropDestinationAt(event.clientX, event.clientY, pending?.payload);
    if (destination?.node) {
      activeTarget = destination.node;
      activeTarget.classList.add('drop-target');
    }
    return destination;
  };

  modal.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.pointerType === 'touch' || uiState.pageLocked) return;
    const payload = groupManagerPayloadFromTarget(event.target);
    if (!payload || eyeModeBlocksGroupEditing()) return;
    pending = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      payload,
      source: event.target.closest('.group-manager-member, .group-manager-student, .group-manager-group, .group-manager-zone'),
      active: false
    };
    pending.source?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }, true);

  modal.addEventListener('pointermove', event => {
    if (!pending || event.pointerId !== pending.pointerId) return;
    if (!pending.active) {
      const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
      if (distance < 7) return;
      pending.active = setGroupManagerCarry(pending.payload);
      if (!pending.active) return reset();
      modal.classList.add('group-manager-pointer-dragging');
      suppressNextClick = true;
    }
    event.preventDefault();
    updateTarget(event);
  }, { capture: true, passive: false });

  modal.addEventListener('pointerup', event => {
    if (!pending || event.pointerId !== pending.pointerId) return;
    const wasActive = pending.active;
    const destination = wasActive ? updateTarget(event) : null;
    pending.source?.releasePointerCapture?.(event.pointerId);
    if (wasActive) {
      event.preventDefault();
      clearTarget();
      modal.classList.remove('group-manager-pointer-dragging');
      pending = null;
      if (destination) applyGroupManagerCarry(destination.type, destination.id);
      else clearGroupManagerCarry();
      return;
    }
    pending = null;
  }, true);

  modal.addEventListener('pointercancel', event => {
    if (!pending || event.pointerId !== pending.pointerId) return;
    reset();
  }, true);

  modal.addEventListener('click', event => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}


function renderGroupManager() {
  const studentList = document.getElementById('groupManagerStudentList');
  const groupList = document.getElementById('groupManagerGroupList');
  const zoneList = document.getElementById('groupManagerZoneList');
  const studentCount = document.getElementById('groupManagerStudentCount');
  const groupCount = document.getElementById('groupManagerGroupCount');
  const zoneCount = document.getElementById('groupManagerZoneCount');
  if (!studentList || !groupList) return;

  if (studentCount) studentCount.textContent = state.students.length;
  if (groupCount) groupCount.textContent = state.groups.length;
  if (zoneCount) zoneCount.textContent = (state.zones || []).length;
  const assignedSeats = assignedSeatsByStudent();
  const zoneUsage = buildZoneUsageIndex(state.zones || []);

  studentList.innerHTML = '';
  if (!state.students.length) {
    studentList.innerHTML = '<div class="group-manager-empty">No students yet. Add students from Class Setup > Students or use Import Roster.</div>';
  } else {
    [...state.students]
      .sort((a, b) => studentDisplay(a).localeCompare(studentDisplay(b)))
      .forEach(student => {
        const card = document.createElement('div');
        card.className = 'student-card group-manager-student';
        card.draggable = true;
        card.dataset.studentId = student.id;
        card.title = 'Drag this student into a group or zone. On touch devices, choose Pick Up and then tap a destination.';
        const assigned = assignedSeats.get(String(student.id)) || null;
        card.innerHTML = `
              <div class="student-name">
                <span>${studentGroupDots(student.id)} ${escapeHtml(studentDisplay(student))}</span>
                <span class="card-actions">
                  <button class="tiny secondary" type="button" data-group-manager-pick="student" data-manager-item-id="${escapeHtml(student.id)}">Pick Up</button>
                  <button class="tiny secondary icon-button" type="button" data-edit-student-notes="${escapeHtml(student.id)}" aria-label="Open notes" title="Open categorized notes for this student.">📝</button>
                  <button class="tiny secondary student-edit-action" type="button" data-edit-student-id="${escapeHtml(student.id)}" title="Edit this student's information.">Edit</button>
                </span>
              </div>
              <div class="student-meta">${escapeHtml(studentMetaText(student))}${assigned ? ` · Seat ${assigned.row},${assigned.col}` : ''}</div>
            `;
        studentList.appendChild(card);
      });
  }

  groupList.innerHTML = '';
  if (!state.groups.length) {
    groupList.innerHTML = '<div class="group-manager-empty">No groups or rules yet. Create one from Class Setup > Groups & Rules first.</div>';
  } else {
    [...state.groups]
      .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
      .forEach(group => {
        const members = (group.studentIds || []).map(getStudent).filter(Boolean).sort((a, b) => studentDisplay(a).localeCompare(studentDisplay(b)));
        const attachedZone = group.zoneId ? zoneById(group.zoneId) : null;
        const card = document.createElement('div');
        card.className = 'group-manager-group';
        card.draggable = true;
        card.dataset.groupId = group.id;
        card.style.setProperty('--manager-group-color', safeColor(group.color));
        card.title = 'Drop students here to add them to this group, or drop a zone here to attach this group to that zone.';
        const membersHtml = members.length
          ? members.map(student => `
                <div class="group-manager-member" draggable="true" data-student-id="${escapeHtml(student.id)}" data-source-group-id="${escapeHtml(group.id)}" title="Drag to the remove area to take this student out of this group. Right-click for all group options.">
                  <span>${studentGroupDots(student.id)} ${escapeHtml(studentDisplay(student))} <span class="muted">${escapeHtml(studentMetaText(student))}</span></span>
                  <span class="card-actions"><button type="button" class="tiny secondary" data-group-manager-pick="groupMember" data-manager-item-id="${escapeHtml(student.id)}" data-manager-source-group-id="${escapeHtml(group.id)}">Pick Up</button><button type="button" class="tiny secondary" data-remove-group-member="${escapeHtml(group.id)}" data-remove-student-id="${escapeHtml(student.id)}" title="Remove this student from this group only.">Remove</button></span>
                </div>
              `).join('')
          : '<div class="group-manager-empty">Drop students here to add them to this group.</div>';
        card.innerHTML = `
              <div class="group-manager-group-head">
                <div>
                  <div class="group-name"><span style="display:inline-flex;align-items:center;gap:7px;"><span class="group-swatch" style="background:${escapeHtml(safeColor(group.color))}"></span>${escapeHtml(group.name)}</span></div>
                  <div class="group-meta">${escapeHtml(typeLabel(group.type))} · Priority ${escapeHtml(String(group.priority))}${attachedZone ? ` · Zone: ${escapeHtml(attachedZone.name)}` : ''}</div>
                </div>
                <span class="card-actions"><span class="pill">${members.length} students</span><button class="tiny secondary" type="button" data-group-manager-pick="group" data-manager-item-id="${escapeHtml(group.id)}">Pick Up</button></span>
              </div>
              <div class="group-manager-members">${membersHtml}</div>
            `;
        groupList.appendChild(card);
      });
  }

  if (zoneList) {
    zoneList.innerHTML = '';
    const zones = state.zones || [];
    if (!zones.length) {
      zoneList.innerHTML = '<div class="group-manager-empty">No zones yet. Select cells in Room Layout, then save a zone from the Zones tab.</div>';
    } else {
      zones.forEach(zone => {
        const zoneId = String(zone.id);
        const students = (zone.studentIds || []).map(getStudent).filter(Boolean).sort((a,b) => studentDisplay(a).localeCompare(studentDisplay(b)));
        const groups = [...(zoneUsage.groupsByZone.get(zoneId) || [])].sort((a,b) => a.name.localeCompare(b.name));
        const cellCount = zoneUsage.cellCounts.get(zoneId) || 0;
        const card = document.createElement('div');
        card.className = 'group-manager-zone';
        card.draggable = true;
        card.dataset.zoneId = zone.id;
        card.style.setProperty('--manager-zone-color', safeColor(zone.color, '#8b5cf6'));
        card.title = 'Drop students or groups here. Drag this zone onto a group to attach that group to the zone.';
        const studentsHtml = students.length
          ? students.map(student => `<div class="zone-manager-member"><span>${studentGroupDots(student.id)} ${escapeHtml(studentDisplay(student))}</span><button class="tiny secondary" type="button" data-remove-zone-student="${escapeHtml(zone.id)}" data-remove-student-id="${escapeHtml(student.id)}">Remove</button></div>`).join('')
          : '<div class="group-manager-empty">Drop students here to mark them for this zone.</div>';
        const groupsHtml = groups.length
          ? groups.map(group => `<div class="zone-manager-group-chip"><span><span class="group-swatch" style="background:${escapeHtml(safeColor(group.color))}"></span> ${escapeHtml(group.name)}</span><button class="tiny secondary" type="button" data-detach-zone-group="${escapeHtml(zone.id)}" data-detach-group-id="${escapeHtml(group.id)}">Detach</button></div>`).join('')
          : '<div class="group-manager-empty">Drop groups here to attach them to this zone.</div>';
        card.innerHTML = `
              <div class="group-manager-zone-head">
                <div>
                  <div class="group-name"><span style="display:inline-flex;align-items:center;gap:7px;"><span class="zone-swatch" style="background:${escapeHtml(safeColor(zone.color, '#8b5cf6'))}"></span>${escapeHtml(zone.name)}</span></div>
                  <div class="group-meta">${cellCount} cell(s) · ${students.length} student(s) · ${groups.length} group(s)</div>
                </div>
                <span class="card-actions"><button class="tiny secondary" type="button" data-group-manager-pick="zone" data-manager-item-id="${escapeHtml(zone.id)}">Pick Up</button><button class="tiny secondary" type="button" data-rename-zone="${escapeHtml(zone.id)}">Edit</button><button class="tiny danger icon-button" type="button" data-delete-zone="${escapeHtml(zone.id)}" aria-label="Delete zone" title="Delete this zone">🗑</button></span>
              </div>
              <strong class="muted">Students</strong>
              <div class="group-manager-zone-members">${studentsHtml}</div>
              <strong class="muted" style="margin-top:7px;display:block;">Attached groups</strong>
              <div class="group-manager-zone-groups">${groupsHtml}</div>
            `;
        zoneList.appendChild(card);
      });
    }
  }

  updateGroupManagerCarryUi();
}

function typeLabel(type) {
  return GROUP_TYPE_LABELS[type] || GROUP_TYPE_LABELS.together;
}

function ruleTypeDescription(type) {
  return GROUP_TYPE_DESCRIPTIONS[type] || GROUP_TYPE_DESCRIPTIONS.together;
}

function priorityLabel(priority) {
  const value = Number(priority) || 6;
  if (value >= 10) return 'Must try';
  if (value >= 8) return 'Very high importance';
  if (value >= 6) return 'Important';
  if (value >= 4) return 'Preferred';
  return 'Nice to have';
}

function studentGroups(studentId) {
  const targetId = String(studentId || '');
  return state.groups.filter(group => (group.studentIds || []).map(String).includes(targetId));
}

function studentGroupDots(studentId, groups = studentGroups(studentId)) {
  if (!groups.length) {
    return '<span class="student-group-dots" title="No groups assigned"><span class="student-group-dot empty"></span></span>';
  }
  const title = groups.map(group => `${group.name} (${typeLabel(group.type)}, priority ${group.priority})`).join(' | ');
  return `<span class="student-group-dots" title="${escapeHtml(title)}">${groups.map(group => `<span class="student-group-dot" role="img" style="background:${escapeHtml(safeColor(group.color, '#2f6fed'))}" aria-label="${escapeHtml(group.name)}"></span>`).join('')}</span>`;
}

function calculateCellHeight(lookups = buildLookupMaps()) {
  let needed = normalCellFloor();
  Object.values(state.cells).forEach(cell => {
    if (!cell) return;
    const student = lookups.students.get(String(cell.assignedStudentId || ''));
    const studentGroupCount = student ? (lookups.groupsByStudent.get(String(student.id)) || []).length : 0;
    const anchorCount = (cell.anchorGroupIds || []).length;
    const groupRows = Math.ceil(Math.max(studentGroupCount, anchorCount) / 2);
    const nameLength = student ? studentDisplay(student).length : objectLabel(cell.type).length;
    const nameRows = Math.max(1, Math.ceil(nameLength / 15));
    let actionCount = cell.type === 'seat' ? 1 : 0;  
    if (student) actionCount += 2;  
    if (anchorCount) actionCount += 1;  
    if (cell.type === 'blocked') actionCount += 1;  
    const actionRows = Math.ceil(actionCount / 2);
    const labelRows = 1 + (cell.manual ? 1 : 0) + Math.ceil(anchorCount / 3);
    const groupPadding = Math.max(0, groupRows) * 8;
    const estimate = 82 + (labelRows * 12) + (nameRows * 17) + (actionRows * 29) + groupPadding;
    needed = Math.max(needed, estimate);
  });
  return Math.max(normalCellFloor(), Math.ceil(needed));
}

function delegatedGridCell(event) {
  const target = event.target instanceof Element ? event.target : null;
  const cell = target?.closest('.cell[data-cell-key]');
  const grid = el('seatGrid');
  return cell && grid?.contains(cell) ? cell : null;
}

function delegatedGridStudent(event) {
  const target = event.target instanceof Element ? event.target : null;
  const student = target?.closest('[data-seat-student-id]');
  const grid = el('seatGrid');
  return student && grid?.contains(student) ? student : null;
}

function seatGestureTargetIsAction(target) {
  return Boolean(target?.closest?.([
    '[data-toggle-seat-lock]',
    '[data-clear-seat]',
    '[data-clear-anchor-seat]',
    '[data-block-seat]',
    '[data-make-seat]',
    '[data-placement-why]',
    '[data-freeform-clear-seat]',
    '[data-freeform-lock]',
    '[data-freeform-delete]',
    '[data-freeform-rotate]',
    '[data-freeform-resize]',
    'input',
    'select',
    'textarea'
  ].join(',')));
}

function delegatedFreeformObject(event) {
  const target = event.target instanceof Element ? event.target : null;
  const node = target?.closest('.freeform-object[data-object-id]');
  const grid = el('seatGrid');
  return node && grid?.contains(node) ? node : null;
}

function freeformObjectFromNode(node) {
  const objectId = String(node?.dataset?.objectId || '');
  return objectId ? (state.freeformLayout?.objects || []).find(item => String(item.id) === objectId) || null : null;
}

function openFreeformSeatSettings(objectId) {
  if (eyeModeBlocksSeatEditing() || eyeModeBlocksRoomEditing()) {
    blockEyeModeAction(eyeModeBlocksSeatEditing() ? 'seat' : 'room');
    return false;
  }
  const obj = (state.freeformLayout?.objects || []).find(item => String(item.id) === String(objectId) && item.type === 'seat');
  if (!obj) return false;
  const cellKey = ensureFreeformSeatGridLink(obj);
  if (!cellKey || !state.cells[cellKey]) return false;
  mirrorFreeformSeatToGrid(obj, { clearStudentDuplicates: false });
  return openSeatEditModal(cellKey, { freeformObjectId: obj.id });
}

function seatSettingsGestureContext(event) {
  if (state.layoutMode === 'freeform') {
    const node = delegatedFreeformObject(event);
    const obj = freeformObjectFromNode(node);
    return obj?.type === 'seat' ? { key: `freeform:${obj.id}`, kind: 'freeform', id: obj.id } : null;
  }
  const node = delegatedGridCell(event);
  const cellKey = String(node?.dataset?.cellKey || '');
  const cell = cellKey ? state.cells[cellKey] : null;
  return cell?.type === 'seat' && !uiState.designMode ? { key: `grid:${cellKey}`, kind: 'grid', id: cellKey } : null;
}

function openSeatSettingsGesture(context) {
  if (!context) return false;
  if (context.kind === 'freeform') return openFreeformSeatSettings(context.id);
  if (eyeModeBlocksSeatEditing() || eyeModeBlocksRoomEditing()) {
    blockEyeModeAction(eyeModeBlocksSeatEditing() ? 'seat' : 'room');
    return false;
  }
  return openSeatEditModal(context.id);
}

function installDelegatedSeatSettingsGesture(grid) {
  if (!grid || grid.dataset.seatSettingsGestureInstalled === 'true') return;
  grid.dataset.seatSettingsGestureInstalled = 'true';
  let pointer = null;
  let lastTap = null;
  let suppression = null;

  const clearPointer = () => {
    if (pointer?.timer) clearTimeout(pointer.timer);
    pointer = null;
  };
  const resetLastTap = () => { lastTap = null; };
  const open = (context, reason) => {
    if (!openSeatSettingsGesture(context)) return false;
    suppression = { key: context.key, until: Date.now() + 650 };
    setLiveStatusMessage(reason === 'long-press'
      ? 'Seat settings opened. Press and hold is the touch equivalent of double-click.'
      : 'Seat settings opened from a double-tap.');
    return true;
  };

  grid.addEventListener('pointerdown', event => {
    const context = seatSettingsGestureContext(event);
    if (!context || !['touch', 'pen'].includes(event.pointerType) || event.isPrimary === false || event.button !== 0) return;
    if (uiState.mobileRoomPanActive || seatGestureTargetIsAction(event.target)) return;
    clearPointer();
    pointer = {
      id: event.pointerId,
      context,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      longPress: false,
      timer: setTimeout(() => {
        if (!pointer || pointer.id !== event.pointerId || pointer.moved) return;
        pointer.longPress = open(pointer.context, 'long-press');
      }, 550)
    };
  }, true);

  grid.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) <= 10) return;
    pointer.moved = true;
    if (pointer.timer) clearTimeout(pointer.timer);
    pointer.timer = null;
  }, true);

  grid.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const completed = pointer;
    clearPointer();
    if (completed.moved) {
      resetLastTap();
      return;
    }
    if (completed.longPress) {
      event.preventDefault();
      event.stopImmediatePropagation();
      resetLastTap();
      return;
    }
    const now = Date.now();
    if (lastTap?.key === completed.context.key && now - lastTap.at <= 360) {
      resetLastTap();
      if (open(completed.context, 'double-tap')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }
    lastTap = { key: completed.context.key, at: now };
  }, true);

  grid.addEventListener('pointercancel', clearPointer, true);
  ['click', 'contextmenu'].forEach(type => grid.addEventListener(type, event => {
    if (!suppression || Date.now() > suppression.until) return;
    if (seatSettingsGestureContext(event)?.key !== suppression.key) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true));
}

function installFreeformEventDelegation(grid) {
  if (!grid || grid.dataset.freeformEventsInstalled === 'true') return;
  grid.dataset.freeformEventsInstalled = 'true';

  grid.addEventListener('pointerdown', event => {
    const node = delegatedFreeformObject(event);
    const obj = freeformObjectFromNode(node);
    if (!obj || (isMobileViewport() && uiState.mobileCarryItem)) return;
    beginFreeformPointerDrag(event, obj.id);
  });

  grid.addEventListener('click', event => {
    const node = delegatedFreeformObject(event);
    const obj = freeformObjectFromNode(node);
    if (!obj || !(event.target instanceof Element)) return;
    const rotateControl = event.target.closest('[data-freeform-rotate]');
    if (rotateControl) {
      event.preventDefault();
      event.stopPropagation();
      const suppression = uiState.suppressFreeformRotateClick;
      uiState.suppressFreeformRotateClick = null;
      if (suppression && suppression.id === obj.id && suppression.until >= Date.now()) return;
      rotateFreeformObject(obj.id, Number(rotateControl.dataset.freeformRotateDirection) < 0 ? -15 : 15);
      return;
    }
    if (isMobileViewport() && uiState.mobileCarryItem && obj.type === 'seat') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
      applyMobileCarryToFreeformObject(obj.id);
      return;
    }
    if (event.target.closest('[data-freeform-clear-seat], [data-freeform-lock], [data-freeform-delete]')) return;
    event.stopPropagation();
    const selectedIds = uiState.freeformSelectedObjectIds || new Set();
    if (!event.shiftKey && !event.altKey && selectedIds.size > 1 && selectedIds.has(String(obj.id))) {
      updateFreeformSelectionVisuals();
      return;
    }
    selectFreeformObject(obj.id, event.shiftKey, event.altKey);
  });

  grid.addEventListener('contextmenu', event => {
    const node = delegatedFreeformObject(event);
    const obj = freeformObjectFromNode(node);
    if (!obj) return;
    event.preventDefault();
    event.stopPropagation();
    selectFreeformObject(obj.id, event.shiftKey, event.altKey);
    if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
    showFreeformObjectContextMenu(obj.id, event.clientX, event.clientY);
  });

  grid.addEventListener('dblclick', event => {
    const node = delegatedFreeformObject(event);
    const obj = freeformObjectFromNode(node);
    if (obj?.type !== 'seat' || seatGestureTargetIsAction(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    openFreeformSeatSettings(obj.id);
  });

  grid.addEventListener('dragover', event => {
    const node = delegatedFreeformObject(event);
    const obj = freeformObjectFromNode(node);
    if (obj?.type !== 'seat' || obj.locked || eyeModeBlocksSeatEditing()) return;
    event.preventDefault();
    event.stopPropagation();
    node.classList.add('drop-target');
  });

  grid.addEventListener('dragleave', event => {
    const node = delegatedFreeformObject(event);
    if (!node || (event.relatedTarget instanceof Node && node.contains(event.relatedTarget))) return;
    node.classList.remove('drop-target');
  });

  grid.addEventListener('drop', event => {
    const node = delegatedFreeformObject(event);
    const obj = freeformObjectFromNode(node);
    if (!obj) return;
    event.preventDefault();
    event.stopPropagation();
    node.classList.remove('drop-target');
    if (obj.type !== 'seat') return;
    if (obj.locked) return blockLockedSeatEditAction();
    if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
    let data;
    try { data = JSON.parse(event.dataTransfer.getData('application/json')); } catch { return; }
    if (data.type === 'student') assignStudentToFreeformObject(data.id, obj.id, true);
  });
}

function installGridEventDelegation() {
  const grid = el('seatGrid');
  if (!grid || grid.dataset.delegatedEventsInstalled === 'true') return;
  grid.dataset.delegatedEventsInstalled = 'true';
  installDelegatedSeatSettingsGesture(grid);
  installFreeformEventDelegation(grid);

  const pendingSeatToolClicks = new Map();
  const cancelPendingSeatToolClick = cellKey => {
    const timer = pendingSeatToolClicks.get(cellKey);
    if (timer) clearTimeout(timer);
    pendingSeatToolClicks.delete(cellKey);
  };
  const scheduleSeatToolClick = (cellKey, type) => {
    cancelPendingSeatToolClick(cellKey);
    const timer = setTimeout(() => {
      pendingSeatToolClicks.delete(cellKey);
      const cell = state.cells[cellKey];
      if (!cell || state.layoutMode !== 'grid' || cell.type !== 'seat') return;
      if (eyeModeBlocksRoomEditing()) return;
      setCellType(cellKey, type);
    }, 560);
    pendingSeatToolClicks.set(cellKey, timer);
  };

  grid.addEventListener('contextmenu', event => {
    const studentTarget = delegatedGridStudent(event);
    if (studentTarget) {
      event.preventDefault();
      event.stopPropagation();
      if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
      showStudentGroupContextMenu(studentTarget.dataset.seatStudentId, event.clientX, event.clientY);
      return;
    }
    const cell = delegatedGridCell(event);
    if (!cell) return;
    event.preventDefault();
    if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
    showCellContextMenu(cell.dataset.cellKey, event.clientX, event.clientY);
  });

  grid.addEventListener('dblclick', event => {
    const cell = delegatedGridCell(event);
    const target = event.target instanceof Element ? event.target : null;
    if (!cell || seatGestureTargetIsAction(target)) return;
    const button = target?.closest('button');
    if (button && !button.classList.contains('keyboard-seat-focus')) return;
    cancelPendingSeatToolClick(cell.dataset.cellKey);
    event.preventDefault();
    event.stopPropagation();
    if (eyeModeBlocksSeatEditing() || eyeModeBlocksRoomEditing()) return blockEyeModeAction(eyeModeBlocksSeatEditing() ? 'seat' : 'room');
    openSeatEditModal(cell.dataset.cellKey);
  });

  grid.addEventListener('dragstart', event => {
    const studentTarget = delegatedGridStudent(event);
    if (!studentTarget) return;
    if (eyeModeBlocksSeatEditing()) {
      event.preventDefault();
      blockEyeModeAction('seat');
      return;
    }
    event.stopPropagation();
    event.dataTransfer?.setData('application/json', JSON.stringify({
      type: 'student',
      id: studentTarget.dataset.seatStudentId,
      sourceCellKey: delegatedGridCell(event)?.dataset.cellKey || ''
    }));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });

  grid.addEventListener('mousedown', event => {
    const cell = delegatedGridCell(event);
    if (!cell || event.button !== 0 || !(event.target instanceof Element)) return;
    if (event.target.closest('button, [data-seat-student-id]') || eyeModeBlocksRoomEditing()) return;
    if (uiState.selectionMode || event.shiftKey) beginCellSelection(event, cell.dataset.cellKey);
  });

  grid.addEventListener('mouseover', event => {
    const cell = delegatedGridCell(event);
    if (!cell || (event.relatedTarget instanceof Node && cell.contains(event.relatedTarget))) return;
    if (uiState.designMode) showDesignModeTooltip(cell, event);
    if (!uiState.isSelectingCells || event.buttons !== 1) return;
    const cellKey = cell.dataset.cellKey;
    if (event.shiftKey && uiState.selectionAnchorKey && state.cells[uiState.selectionAnchorKey]) addCellRangeToSelection(uiState.selectionAnchorKey, cellKey);
    else addCellToSelection(cellKey);
  });

  grid.addEventListener('mousemove', event => {
    if (uiState.designMode && delegatedGridCell(event)) moveDesignModeTooltip(event);
  });

  grid.addEventListener('mouseout', event => {
    const cell = delegatedGridCell(event);
    if (!cell || (event.relatedTarget instanceof Node && cell.contains(event.relatedTarget))) return;
    if (uiState.designMode) hideDesignModeTooltip();
  });

  grid.addEventListener('click', event => {
    const cell = delegatedGridCell(event);
    if (!cell || !(event.target instanceof Element)) return;
    const cellKey = cell.dataset.cellKey;
    if (uiState.mobileCarryItem && isMobileViewport()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
      applyMobileCarryToCell(cellKey);
      return;
    }
    if (event.target.closest('button, [data-seat-student-id]')) return;
    if (uiState.skipNextCellClick) {
      uiState.skipNextCellClick = false;
      return;
    }
    if (uiState.selectionMode) {
      if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
      toggleCellSelection(cellKey);
      return;
    }
    if (event.shiftKey) {
      if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
      if (uiState.selectionAnchorKey && state.cells[uiState.selectionAnchorKey]) addCellRangeToSelection(uiState.selectionAnchorKey, cellKey);
      else addCellToSelection(cellKey);
      uiState.selectionAnchorKey = cellKey;
      return;
    }
    if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
    const selectedType = el('layoutTool')?.value || 'seat';
    const currentCell = state.cells[cellKey];
    if (!currentCell || currentCell.type === selectedType) return;
    if (currentCell.type === 'seat') {
      if (event.detail > 1) {
        cancelPendingSeatToolClick(cellKey);
        return;
      }
      if (event.detail === 0) {
        setCellType(cellKey, selectedType);
        return;
      }
      scheduleSeatToolClick(cellKey, selectedType);
      return;
    }
    setCellType(cellKey, selectedType);
  });

  grid.addEventListener('dragover', event => {
    const cell = delegatedGridCell(event);
    if (!cell || state.cells[cell.dataset.cellKey]?.type !== 'seat' || eyeModeBlocksSeatEditing()) return;
    event.preventDefault();
    cell.classList.add('drop-target');
  });

  grid.addEventListener('dragleave', event => {
    const cell = delegatedGridCell(event);
    if (!cell || (event.relatedTarget instanceof Node && cell.contains(event.relatedTarget))) return;
    cell.classList.remove('drop-target');
  });

  grid.addEventListener('drop', event => {
    const cell = delegatedGridCell(event);
    if (!cell) return;
    event.preventDefault();
    cell.classList.remove('drop-target');
    const cellKey = cell.dataset.cellKey;
    if (state.cells[cellKey]?.type !== 'seat') return;
    if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
    let data;
    try { data = JSON.parse(event.dataTransfer?.getData('application/json') || ''); } catch { return; }
    if (data.type === 'student') assignStudentToCell(data.id, cellKey, true, true);
    if (data.type === 'group') {
      if (eyeModeBlocksGroupEditing()) return blockEyeModeAction('group');
      const keys = isContextCellSelectionBatch(cellKey) ? selectedCellKeysArray() : [cellKey];
      keys.forEach(key => addGroupAnchorWithoutRender(data.id, key));
      renderAll();
      if (keys.length > 1) setLiveStatusMessage(`Reserved ${keys.length} selected seats for that group.`);
    }
  });
}

function renderGrid() {
  ensureGrid();
  if (state.layoutMode === 'freeform') return renderFreeformLayout();
  releaseFreeformCanvasStage();
  const grid = el('seatGrid');
  grid.classList.remove('freeform-canvas');
  grid.style.width = '';
  grid.style.height = '';
  grid.style.backgroundSize = '';
  grid.style.transform = '';
  grid.style.transformOrigin = '';
  const lookups = buildLookupMaps();
  let seatCount = 0;
  const assignedIds = new Set();
  const calculatedCellHeight = uiState.designMode ? designCellHeight() : calculateCellHeight(lookups);
  const baseCellWidth = Number.parseFloat(getComputedStyle(document.body).getPropertyValue('--cell-width')) || 112;
  const scaledCellWidth = uiState.designMode ? designCellWidth() : Math.round(baseCellWidth * gridViewScale());
  grid.style.setProperty('--cell-width', `${scaledCellWidth}px`);
  grid.style.setProperty('--cell-height', `${calculatedCellHeight}px`);
  grid.style.gridTemplateColumns = `repeat(${state.cols}, var(--cell-width))`;
  grid.innerHTML = '';
  const fragment = document.createDocumentFragment();
  for (let r = 1; r <= state.rows; r++) {
    for (let c = 1; c <= state.cols; c++) {
      const cellKey = keyOf(r, c);
      const cell = state.cells[cellKey];
      if (cell.type === 'seat') seatCount++;
      if (cell.assignedStudentId) assignedIds.add(String(cell.assignedStudentId));
      const student = lookups.students.get(String(cell.assignedStudentId || ''));
      const anchors = (cell.anchorGroupIds || []).map(id => lookups.groups.get(String(id))).filter(Boolean);
      const groupsForStudent = student ? (lookups.groupsByStudent.get(String(student.id)) || []) : [];
      const visualGroups = [];
      groupsForStudent.forEach(group => visualGroups.push({ group, kind: 'Student group' }));
      anchors.forEach(group => {
        if (!visualGroups.some(item => item.group.id === group.id)) visualGroups.push({ group, kind: 'Seat reserved for group' });
      });
      const studentGroupTitle = groupsForStudent.length
        ? `Student group colors: ${groupsForStudent.map(b => `${b.name} (${typeLabel(b.type)}, priority ${b.priority})`).join(' | ')}`
        : '';
      const anchorTitle = anchors.length
        ? `Seat reserved for: ${anchors.map(b => `${b.name} (${typeLabel(b.type)}, priority ${b.priority})`).join(' | ')}`
        : '';
      const studentGroupBar = groupsForStudent.length
        ? `<div class="group-color-bar" title="${escapeHtml(studentGroupTitle)}">${groupsForStudent.map(b => `<span style="background:${escapeHtml(b.color)}"></span>`).join('')}</div>`
        : '';
      const anchorGroupBar = anchors.length
        ? `<div class="group-color-bar reserved" title="${escapeHtml(anchorTitle)}">${anchors.map(b => `<span style="background:${escapeHtml(b.color)}"></span>`).join('')}</div>`
        : '';
      const div = document.createElement('div');
      const groupClasses = [visualGroups.length ? 'has-groups' : '', groupsForStudent.length ? 'has-student-groups' : '', anchors.length ? 'has-anchor-groups' : '', isCustomCellType(cell.type) ? 'custom-object' : ''].filter(Boolean).join(' ');
      div.className = `cell ${cell.type}${cell.type === 'seat' && !student ? ' unassigned-seat' : ''}${groupClasses ? ' ' + groupClasses : ''}`;
      if (visualGroups.length) div.style.setProperty('--primary-group-color', safeColor(visualGroups[0].group.color));
      div.dataset.cellKey = cellKey;
      if (uiState.designMode) div.dataset.designTooltip = `Defined as: ${objectLabel(cell.type)}${(cell.zoneIds || []).length ? ' | Zones: ' + (cell.zoneIds || []).map(id => lookups.zones.get(String(id))?.name || id).join(', ') : ''} (row ${r}, column ${c})`;
      if (uiState.selectedCellKeys.has(cellKey)) div.classList.add('multi-selected');
      if (uiState.designMode) {
        const designLabel = objectLabel(cell.type);
        div.innerHTML = `<div class="design-cell-label" title="${escapeHtml(designLabel)} at row ${r}, column ${c}">${escapeHtml(designLabel)}</div>`;
      } else {
        const anchorDots = anchors.map(anchor => `<span class="anchor-dot" style="background:${escapeHtml(anchor.color)}" title="Reserved for ${escapeHtml(anchor.name)}"></span>`).join('');
        div.innerHTML = `
              ${studentGroupBar}${anchorGroupBar}${zoneTagsHtml(cell, lookups.zones)}
              <div class="cell-label">
                <span>${r},${c}</span>
                <span class="cell-status"><span class="cell-type-label">${escapeHtml(objectLabel(cell.type))}</span> ${cell.manual ? '<span class="pill locked" title="This student is locked here and randomize will not move them.">Locked</span>' : ''} ${anchorDots}</span>
              </div>
              ${cell.type === 'seat' ? `
                <div class="seat-person" ${student ? `${eyeModeBlocksSeatEditing() ? '' : 'draggable="true"'} data-seat-student-id="${escapeHtml(student.id)}" data-source-cell="${cellKey}" title="${eyeModeBlocksSeatEditing() ? 'Presentation mode blocks seat moves until it is exited.' : `Drag ${escapeHtml(studentDisplay(student))} to another seat. If the target is occupied, the two students swap.`}"` : ''}>${seatStudentHtml(student)}</div>
                <div class="cell-actions">
                  ${student ? `<button class="tiny ${cell.manual ? 'ghost' : 'secondary'}" data-toggle-seat-lock="${cellKey}" title="${cell.manual ? 'Unlock this student so Generate and Randomize may move them again.' : 'Lock this student to this seat so Generate and Randomize will not move them.'}">${cell.manual ? 'Unlock' : 'Lock'}</button>` : ''}
                  ${student ? `<button class="tiny secondary" data-clear-seat="${cellKey}" title="Remove this student from this seat and return them to the unassigned list.">Clear</button>` : ''}
                  ${anchors.length ? `<button class="tiny secondary" data-clear-anchor-seat="${cellKey}" title="Remove all group reservations from this seat.">Anchors</button>` : ''}
                  <button class="tiny danger" data-block-seat="${cellKey}" title="Turn this seat into a blocked space. Any assignment here is removed first.">Block</button>
                </div>
              ` : `
                <div class="seat-empty">${escapeHtml(objectLabel(cell.type))}${cell.type === 'blocked' ? '<span class="blocked-note">Assignments blocked</span>' : ''}</div>
                <div class="cell-actions">${cell.type === 'blocked' ? `<button class="tiny secondary wide" data-make-seat="${cellKey}" title="Convert this blocked cell back into an assignable seat.">Make Seat</button>` : ''}</div>
              `}
            `;
      }
      if (cell.type === 'seat' && !uiState.designMode) {
        div.title = `${div.title ? `${div.title} · ` : ''}Double-click with a mouse, or double-tap or press and hold on touch, to open seat settings.`;
      }
      fragment.appendChild(div);
    }
  }
  grid.appendChild(fragment);
  el('printStats').textContent = `${printChartMetaLine() || activeClassName()} · ${state.students.length} students · ${seatCount} seats · ${assignedIds.size} assigned`;
  syncSeatDisplayControls();
  requestAnimationFrame(() => {
    normalizeCellHeight(calculatedCellHeight);
    requestAnimationFrame(() => normalizeCellHeight(calculatedCellHeight));
  });
}

function normalizeCellHeight(minHeight) {
  const grid = el('seatGrid');
  if (!grid) return;
  const cells = Array.from(grid.querySelectorAll('.cell'));
  if (!cells.length) return;
  const floor = uiState.designMode ? Math.max(designCellHeight(), Number(minHeight) || designCellHeight()) : Math.max(normalCellFloor(), Number(minHeight) || normalCellFloor());

   
  grid.style.gridAutoRows = 'auto';
  grid.style.setProperty('--cell-height', `${floor}px`);
  cells.forEach(cell => {
    cell.style.minHeight = `${floor}px`;
    cell.style.height = 'auto';
  });

   
  void grid.offsetHeight;
  const tallest = cells.reduce((max, cell) => {
    const rectHeight = cell.getBoundingClientRect().height;
    const scrollHeight = cell.scrollHeight;
    return Math.max(max, rectHeight, scrollHeight);
  }, floor);
  const finalHeight = Math.ceil(Math.max(floor, tallest)) + 4;
  grid.style.setProperty('--cell-height', `${finalHeight}px`);
  grid.style.gridAutoRows = 'var(--cell-height)';
  cells.forEach(cell => {
    cell.style.minHeight = `${finalHeight}px`;
    cell.style.height = `${finalHeight}px`;
  });
}

function objectLabel(type) {
  if (BUILT_IN_OBJECT_LABELS[type]) return BUILT_IN_OBJECT_LABELS[type];
  const custom = customObjectForType(type);
  if (custom) return custom.label;
  if (isCustomCellType(type)) return String(type).replace(/^custom-/, '').replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
  return type;
}

function renderStatus() {
  const seats = seatCells();
  const placed = assignedStudentIds().size;
  const groupsByStudent = buildLookupMaps().groupsByStudent;
  const assignedSeats = assignedSeatsByStudent();
  el('statStudents').textContent = state.students.length;
  el('statSeats').textContent = seats.length;
  el('statPlaced').textContent = placed;

  const assignedList = el('assignedList');
  const unassignedList = el('unassignedList');
  const assigned = [];
  const unassigned = [];
  state.students.forEach(student => {
    const seat = assignedSeats.get(String(student.id)) || null;
    if (seat) assigned.push({ student, seat });
    else unassigned.push(student);
  });
  assigned.sort((a,b) => a.seat.row - b.seat.row || a.seat.col - b.seat.col);
  assignedList.innerHTML = assigned.length ? assigned.map(({student, seat}) => `
        <div class="student-card assigned" draggable="true" data-student-id="${escapeHtml(student.id)}">
          <div class="student-name">
            <span class="student-name-main">${studentGroupDots(student.id, groupsByStudent.get(String(student.id)) || [])}<span class="student-name-text">${escapeHtml(studentDisplay(student))}</span></span>
            <span class="card-actions">
              <button class="tiny secondary icon-button" type="button" data-edit-student-notes="${escapeHtml(student.id)}" aria-label="Open notes" title="Open categorized notes for this student.">📝</button>
              <button class="tiny secondary student-edit-action" type="button" data-edit-student-id="${escapeHtml(student.id)}" title="Edit this student's first name, last name, nickname, grade, or ID.">Edit</button>
              <button class="tiny ${seat.manual ? 'ghost' : 'secondary'}" data-toggle-student-lock="${escapeHtml(student.id)}">${seat.manual ? 'Unlock' : 'Lock'}</button>
              <button class="tiny secondary" data-clear-student-assignment="${escapeHtml(student.id)}">Unassign</button>
            </span>
          </div>
          <div class="student-meta">Seat ${seat.row},${seat.col}${seat.manual ? ' · locked for generate/randomize' : ''}</div>
        </div>
      `).join('') : '<div class="hint">No assigned students yet.</div>';
  unassigned.sort((a,b) => studentDisplay(a).localeCompare(studentDisplay(b)));
  unassignedList.innerHTML = unassigned.length ? unassigned.map(student => `
        <div class="student-card unassigned" draggable="true" data-student-id="${escapeHtml(student.id)}">
          <div class="student-name">
            <span class="student-name-main">${studentGroupDots(student.id, groupsByStudent.get(String(student.id)) || [])}<span class="student-name-text">${escapeHtml(studentDisplay(student))}</span></span>
            <span class="card-actions"><button class="tiny secondary icon-button" type="button" data-edit-student-notes="${escapeHtml(student.id)}" aria-label="Open notes" title="Open categorized notes for this student.">📝</button><button class="tiny secondary student-edit-action" type="button" data-edit-student-id="${escapeHtml(student.id)}" title="Edit this student's first name, last name, nickname, grade, or ID.">Edit</button></span>
          </div>
          <div class="student-meta">${escapeHtml(studentMetaText(student))}</div>
        </div>
      `).join('') : '<div class="successbox">Everyone is assigned.</div>';

  const blocked = Object.values(state.cells).filter(cell => cell.type === 'blocked').length;
  const openSeats = Math.max(seats.length - placed, 0);
  el('liveUpdateNote').textContent = `${unassigned.length} unassigned · ${openSeats} open seats · ${blocked} blocked cells · updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`;

  renderRuleReport();
}

function setLiveStatusMessage(message) {
  const note = el('liveUpdateNote');
  if (!note) return;
  note.textContent = message;
  note.classList.remove('analysis-flash');
  void note.offsetWidth;
  note.classList.add('analysis-flash');
}

function runAnalyzeReport() {
  renderRuleReport();
  setLiveStatusMessage(`Analysis refreshed ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}. Rule report is current.`);
}

function renderRuleReport() {
  const report = el('ruleReport');
  const findings = analyzeRules();
  const hasNeeds = (state.students || []).some(student => {
    const r = effectiveStudentRequirements(student);
    return r.front !== 'none' || r.side !== 'none' || r.nearTeacher || r.aisle || r.ada || r.awayDoor || r.awayWindow || r.preferredZoneIds.length || r.excludedZoneIds.length || r.minDistanceStudentIds.length;
  });
  const hasZoneLinks = (state.zones || []).some(zone => (zone.studentIds || []).length || (zone.groupIds || []).length);
  if (!state.groups.length && !hasNeeds && !hasZoneLinks) {
    const duplicates = duplicateStudentFindings();
    report.innerHTML = duplicates.length
      ? duplicates.map(item => `<div class="warningbox">${escapeHtml(item.message)}</div>`).join('')
      : '<div class="hint">No group rules, zone links, or individual seating needs are configured yet.</div>';
    return;
  }
  if (!findings.length) {
    report.innerHTML = '<div class="successbox">No obvious group, zone, room-object, or individual-needs problems were found in the current chart.</div>';
    return;
  }
  report.innerHTML = findings.map(item => `<div class="${item.severity === 'warn' ? 'warningbox' : 'violation'}">${escapeHtml(item.message)}</div>`).join('');
}

function analyzeRules() {
  const findings = [...evaluateCurrentRuleViolations({ includeUnseated: true }), ...duplicateStudentFindings()];
  const seen = new Set();
  return findings.filter(item => {
    const key = item.id || item.message;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 48);
}


const CONTROL_TOOLTIPS = {
  toggleHeaderBtn: 'Collapse or expand the title/header area to give the room grid more vertical space.',
  toggleLeftPanelBtn: 'Collapse or expand the Students, Groups & Zones panel to give the room grid more horizontal space.',
  studentsSideTabBtn: 'Show the student tools: add students, import CSV, and view the student list.',
  groupsSideTabBtn: 'Show group and seating-rule tools: create rules, choose students, and review existing rules.',
  toggleRightPanelBtn: 'Collapse or expand the Chart Status panel to give the room grid more horizontal space.',
  guidedLearningBtn: 'Open Quick Start and focused lessons for Freeform, room design, seating, rules, saving, printing, and Google tools.',
  helpGuideBtn: 'Open the searchable help guide with explanations, tips, examples, security guidance, and troubleshooting for the whole application.',
  settingsBtn: 'Open Settings for page defaults, Presentation Mode, security PINs, encryption, recommended saving workflow, custom room objects, sample data, About, and the Change Log.',
  visibilityModeBtn: 'Enter or exit Presentation mode. Presentation switches to Review, hides editing/navigation controls, and protects hidden data. Exiting requires the Presentation PIN, Lock PIN, or current encryption key.',
  presentationExitBtn: 'Exit Presentation Mode and restore the normal workflow. A Presentation PIN, Lock PIN, or encryption key may be required.',
  seatEditZoneSelect: 'Choose a zone to assign to this seat or all selected seats.',
  seatEditAddZoneBtn: 'Assign the selected zone to this seat or all selected seats.',
  seatEditClearZonesBtn: 'Remove all zone assignments from this seat or all selected seats.',
  pageLockBtn: 'Lock the page with a PIN/password. If no lock PIN/password exists yet, you will be asked to create one before the screen locks.',
  saveLoadMenuBtn: 'Open the Save menu for Save Now, Load Save File, and More Save Options.',
  snapshotQuickBtn: 'Take a snapshot of the current class and open the snapshot list so snapshots can be restored later.',
  openRoomTemplatesBtn: 'Open room templates to save the current room layout or apply a saved layout template.',
  printBtn: 'Open print options for print-as-seen, clean names-only, substitute print, student detail fields, and note categories.',
  openPrintPreviewBtn: 'Open the printable page using the selected print options. Use Ctrl+P/Cmd+P or your browser menu to send it to a printer.',
  settingsSampleBtn: 'Load sample students, groups, anchors, and a room layout into the current class so you can test the tool quickly.',
  settingsOpenSaveSetupBtn: 'Open the Save & Backup Options panel for downloads, selected-data exports, and restore/upload tools.',
  settingsForgetLinkedFileBtn: 'Forget the linked file permission without deleting the actual file.',
  settingsGoogleDriveConnectBtn: 'Connect Google Drive with the built-in app OAuth Client ID so encrypted saves can be stored in the user\'s Drive.',
  settingsGoogleDriveSaveBtn: 'Upload the encrypted full-app save to Google Drive.',
  settingsGoogleDriveLoadBtn: 'Download the encrypted full-app save from Google Drive and open restore options.',
  settingsGoogleDriveForgetBtn: 'Forget this page\'s Google Drive token and file/folder link without deleting Drive files.',
  classSelect: 'Switch between classes. Each class has its own students, groups, layout, seats, locks, anchors, and placements.',
  newClassBtn: 'Create a new empty class with its own independent roster, groups, layout, anchors, locks, and seating chart.',
  renameClassBtn: 'Rename the current class without changing its students, groups, layout, or seating chart.',
  duplicateClassBtn: 'Copy the current class, including students, groups, grid, custom objects, seats, anchors, locks, and placements.',
  deleteClassBtn: 'Delete the current class and everything inside it. At least one class must remain.',
  addStudentBtn: 'Add the student using the first name, last name, nickname, grade, and ID fields above.',
  clearStudentsBtn: 'Remove every student, clear their group memberships, and clear all seat assignments.',
  addGroupBtn: 'Create a group/rule using the selected rule type, priority, and checked students.',
  clearGroupsBtn: 'Remove all groups and all group anchors from the seating chart.',
  generateBtn: 'Generate a seating chart using group rules while keeping locked seats in place. In Freeform mode, this fills the existing freeform seats and mirrors the result to the grid.',
  randomizeAllBtn: 'Clear unlocked assignments, keep locked seats fixed, compare many randomized charts against the rules, and keep the strongest match. In Freeform mode, this fills existing freeform seats only.',
  clearAssignmentsBtn: 'Clear all seat assignments, including locked seats. Groups, anchors, and layout objects stay in place.',
  clearAnchorsBtn: 'Remove all group anchors from seats without deleting the groups themselves.',
  toggleLayoutToolsBtn: 'Show or hide the full Layout Tools section for rows, columns, click tools, and multi-cell selection.',
  layoutNamesOnlyBtn: 'Toggle the Room Layout into a names-only view that hides group color bars and reservation dots while editing.',
  hideUnassignedTitlesBtn: 'Hide or show the Drop student here and Unassigned titles on empty seats without removing the seats.',
  buildGridBtn: 'Apply the row and column numbers and resize the grid while keeping existing cells that still fit.',
  makeAllSeatsBtn: 'Turn every grid cell into an assignable student seat.',
  emptyGridBtn: 'Turn every grid cell into empty space and clear all assignments and anchors.',
  analyzeBtn: 'Refresh the rule report and show likely group conflicts in the current chart.',
  closeAboutBtn: 'Close the About window.',
  aboutChangeLogBtn: 'Open the Change Log showing each revision and what changed.',
  settingsChangeLogBtn: 'Open the Change Log showing each revision and what changed.',
  aboutLicenseBtn: 'Open the embedded app license and copyright notice.',
  settingsLicenseBtn: 'Open the embedded app license and copyright notice.',
  closeChangeLogBtn: 'Close the Change Log window.',
  closeLicenseBtn: 'Close the License window.',
  firstName: 'Enter the student first name used on student cards and seat labels.',
  lastName: 'Enter the student last name used on student cards and seat labels.',
  nickName: 'Enter an optional nickname. If present, this is the name shown on seats and student cards.',
  grade: 'Enter an optional grade level for reference and filtering later.',
  studentId: 'Enter a unique student ID. If left blank, the tool creates a temporary local ID.',
  csvFile: 'Import students from a CSV file with headers such as firstName,lastName,grade,id.',
  groupName: 'Name this group/rule so staff can understand the seating need.',
  groupType: 'Choose whether this group tries to seat students together, keep them apart, or place them near anchored seats.',
  groupPriority: 'Choose how strongly the generator should try to honor this group compared with other rules.',
  groupColor: 'Choose the color used for this group. Seats show color bars for student memberships and for seats reserved by this group.',
  rowsInput: 'Set the number of grid rows in the room layout. The grid updates after a short pause or with Build/Resize Grid.',
  colsInput: 'Set the number of grid columns in the room layout. The grid updates after a short pause or with Build/Resize Grid.',
  layoutTool: 'Choose what a normal left-click places on grid cells: seat, blocked, wall, walkway, teacher desk, table, door, window, projector, board, carpet, ADA space, custom objects, or empty.',
  selectCellsBtn: 'Turn multi-cell selection mode on or off. When on, drag or click grid cells to select several cells, then right-click a selected cell to apply one object to all selected cells. You can also hold Shift to add a range.',
  clearCellSelectionBtn: 'Clear the current multi-cell selection without changing any seats or room objects.',
  selectedCellCount: 'Shows how many grid cells are currently selected for a batch right-click action.',
  designModeBtn: 'Toggle Design Mode. Design Mode shrinks cells to layout-planning size and shows only the cell type or defined room object while keeping click, right-click, shift-select, and drag selection tools active.',
  designSizeSlider: 'Resize cells while Design Mode is on. This only affects the layout-design view; turning Design Mode off restores normal seat sizing.',
  settingHideHints: 'Hide all text hints throughout the app without deleting them from the file.',
  settingHideObjectTypeLabels: 'Hide the small Seat and room-object type indicators while keeping student names and custom seat labels visible.',
  settingGoogleAnalyticsEnabled: 'Allow or disable anonymous Google Analytics page measurement on this browser. This preference is not saved inside classroom files.',
  settingAutoSaveMinutes: 'Set how many minutes to wait before auto-saving changes to the chosen save file. Use 0 to turn auto-save off.',
  resetDismissedHintsBtn: 'Show hints again after they have been closed with the X button.',
  settingsCustomObjectName: 'Type a custom room object name to add to the Click Tool and right-click menu.',
  settingsAddCustomObjectBtn: 'Add the typed custom object to the Click Tool and right-click menu. It will save with this chart.',
  settingsSaveLockPinBtn: 'Save or replace the Lock/Unlock PIN/password. It is stored as a salted hash, not plain text.',
  settingsSaveVisibilityPinBtn: 'Save or replace the Presentation Mode exit PIN/password. It is stored as a salted hash, not plain text.',
  toggleAddStudentBtn: 'Expand or collapse the Add Student panel. When collapsed, the roster uses the reclaimed space. It opens automatically when there are no students.',
  closeClassNameBtn: 'Close the class name window without saving.',
  saveClassNameBtn: 'Create or rename the class using the entered class name.',
  cancelClassNameBtn: 'Close the class name window without saving.',
  closeSettingsBtn: 'Close the Settings window.',
  closeStudentEditBtn: 'Close the student edit window without saving changes.',
  saveStudentEditBtn: 'Save changes to this student and update any group memberships or seat assignments if the ID changed.',
  cancelStudentEditBtn: 'Close the student edit window without saving changes.',
  closeSeatEditBtn: 'Close the seat edit window.',
  seatEditAssignStudentBtn: 'Assign the selected student to this cell. If the cell is not a seat, it becomes a seat first.',
  seatEditClearStudentBtn: 'Remove the current student from this seat and unlock the seat.',
  seatEditLockBtn: 'Lock or unlock the current seat. In Freeform mode, locked seats cannot be moved, reassigned, converted, or retagged until unlocked.',
  seatEditAddGroupBtn: 'Reserve this seat for the selected group. More than one group can reserve the same seat.',
  seatEditClearGroupsBtn: 'Remove all group reservations from this seat.',
  seatEditApplyTypeBtn: 'Change this cell to the selected room object or seat type.',
  undoBtn: 'Undo the last seating, roster, group, or layout change.',
  redoBtn: 'Redo the last undone change.',
  saveSnapshotBtn: 'Save a named restore point for the current class.',
  saveRoomTemplateBtn: 'Save the current room layout as a reusable room template without student assignments.',
  saveZoneFromSelectionBtn: 'Create a named seat zone from the currently selected grid cells.',
  applyZoneToSelectionBtn: 'Apply the selected seat zone to the selected grid cells.',
  clearZonesFromSelectionBtn: 'Remove zone labels from selected grid cells.',
  saveChartDetailsBtn: 'Save chart title, date, period, room, and teacher information for print/export.',
  clearLocalDataBtn: 'Clear local saves, saved PIN hashes, dismissed hints, saved snapshot data, and session lock data from this browser.',
  factoryResetEverythingBtn: 'Factory reset the app from scratch by clearing Classroom Seating Planner browser storage, settings, classes, templates, snapshots, and saved file permission metadata. Cookies and data owned by other applications on the same origin are not touched.',
  localSaveBannerInfoBtn: 'Open Save & Backup Options to choose a linked save file or download a durable backup copy.',
  importMappedCsvBtn: 'Import students using the selected CSV column mapping.',
  mobileActionPlaceBtn: 'Open Seat Students with the chart visible so the selected item can be placed.',
  mobileActionEditBtn: 'Edit the selected mobile student.',
  mobileActionGroupBtn: 'Open group membership options for the selected mobile student.',
  mobileActionCancelBtn: 'Cancel the selected mobile item.',
  closeHelpGuideBtn: 'Close the searchable Help Guide.',
  helpGuideSearch: 'Search the Help Guide by feature, setting, button name, or problem.',
  helpGuideOpenSettingsBtn: 'Close the Help Guide and open Settings.',
  helpGuideOpenPrintBtn: 'Close the Help Guide and open Print Options.',
};

const CELL_TYPE_TOOLTIPS = {
  seat: 'Make this cell an assignable student seat. Students and groups can be dropped here.',
  blocked: 'Block this cell from seating. Any current student or group anchor is removed.',
  teacher: 'Mark this cell as a teacher desk. It is a layout object and cannot receive students.',
  table: 'Mark this cell as a table or furniture. It is a layout object and cannot receive students.',
  door: 'Mark this cell as a door. It is a layout object and cannot receive students.',
  wall: 'Mark this cell as a wall. It blocks assignments and helps represent the real room.',
  walkway: 'Mark this cell as a walkway. It blocks assignments while showing a walking path.',
  window: 'Mark this cell as a window area. It is a layout object and cannot receive students.',
  projector: 'Mark this cell as a projector area. It is a layout object and cannot receive students.',
  board: 'Mark this cell as a board or whiteboard area. It is a layout object and cannot receive students.',
  carpet: 'Mark this cell as carpet or floor group space. It is a layout object and cannot receive students.',
  ada: 'Mark this cell as ADA/accessibility space. It is reserved layout space and cannot receive students.',
  empty: 'Make this cell empty space. It is not counted as a usable student seat.'
};

function setTooltip(element, text) {
  if (!element || !text) return;
  element.title = text;
  if (!element.getAttribute('aria-label') && element.tagName === 'BUTTON') {
    element.setAttribute('aria-label', text);
  }
}

function applyTooltips(root = document) {
  Object.entries(CONTROL_TOOLTIPS).forEach(([id, text]) => setTooltip(el(id), text));

  root.querySelectorAll('[data-delete-student]').forEach(button => setTooltip(button, 'Delete this student from the roster, remove them from groups, and clear their seat assignment.'));
  root.querySelectorAll('[data-delete-group]').forEach(button => setTooltip(button, 'Delete this group/rule and remove any anchors it placed on the grid.'));
  root.querySelectorAll('[data-remove-group-member]').forEach(button => setTooltip(button, 'Remove this student from this group only. The student stays in the class and keeps any seat assignment.'));
  root.querySelectorAll('[data-clear-seat]').forEach(button => setTooltip(button, 'Clear the student from this seat and remove the lock from this seat.'));
  root.querySelectorAll('[data-toggle-seat-lock]').forEach(button => {
    const cell = state.cells[button.dataset.toggleSeatLock];
    setTooltip(button, cell?.manual ? 'Unlock this assigned student so Generate and Randomize may move them again.' : 'Lock this assigned student to this exact seat so Generate and Randomize will not move them.');
  });
  root.querySelectorAll('[data-toggle-student-lock]').forEach(button => {
    const cell = assignedSeatForStudent(button.dataset.toggleStudentLock);
    setTooltip(button, cell?.manual ? 'Unlock this student so Generate and Randomize may move them again.' : 'Lock this student to their current seat so Generate and Randomize will not move them.');
  });
  root.querySelectorAll('[data-clear-student-assignment]').forEach(button => setTooltip(button, 'Unassign this student from their current seat and remove any seat lock.'));
  root.querySelectorAll('[data-block-seat]').forEach(button => setTooltip(button, 'Turn this seat into a blocked cell. The current assignment and any anchors on this cell are removed.'));
  root.querySelectorAll('[data-make-seat]').forEach(button => setTooltip(button, 'Turn this blocked cell back into a usable student seat.'));
  root.querySelectorAll('[data-clear-anchor-seat]').forEach(button => setTooltip(button, 'Remove all group anchors from this seat. Student assignment stays unless you clear it separately.'));
  root.querySelectorAll('[data-menu-cell-type]').forEach(button => setTooltip(button, CELL_TYPE_TOOLTIPS[button.dataset.menuCellType] || `Mark this cell as ${objectLabel(button.dataset.menuCellType)}. Custom objects block student assignments.`));
  root.querySelectorAll('[data-add-custom-object-from-menu]').forEach(button => setTooltip(button, 'Add a new custom room object to this right-click menu and the Click Tool list.'));
  root.querySelectorAll('[data-clear-cell-selection-from-menu]').forEach(button => setTooltip(button, 'Clear the current selected cells without changing the room layout.'));
  root.querySelectorAll('[data-wizard-action="apply-grid"]').forEach(button => setTooltip(button, 'Apply the wizard row and column numbers to resize the room grid.'));
  root.querySelectorAll('[data-wizard-action="close-to-layout"]').forEach(button => setTooltip(button, 'Close the wizard so you can right-click or click grid cells to edit the room layout.'));
  root.querySelectorAll('[data-wizard-action="generate"]').forEach(button => setTooltip(button, 'Generate a seating chart from the wizard while keeping locked seats fixed.'));
  root.querySelectorAll('[data-wizard-action="randomize"]').forEach(button => setTooltip(button, 'Randomize from the wizard while keeping locked seats fixed and respecting group rules as much as possible.'));
  root.querySelectorAll('[data-save-menu-action="drive-share-manager"]').forEach(button => setTooltip(button, 'Open the Google Drive sharing manager to add, review, change, or remove Viewer and Editor access for the active Drive save.'));

  root.querySelectorAll('button').forEach(button => {
    if (!button.title) {
      const label = button.textContent.trim() || 'Button';
      setTooltip(button, `${label}: run this control.`);
    }
  });
}


function setSideTab(tabName) {
  const tab = ['students','groups','zones'].includes(tabName) ? tabName : 'students';
  uiState.activeSideTab = tab;
  document.querySelectorAll('[data-side-tab]').forEach(button => {
    const isActive = button.dataset.sideTab === tab;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  document.querySelectorAll('[data-side-tab-panel]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.sideTabPanel === tab);
  });
}

function renderAll() {
  if (state.layoutMode === 'freeform') restoreFreeformGeometryFromCache({ seedIfEmpty: true });
  const freeformRenderSnapshot = state.layoutMode === 'freeform' ? captureFreeformObjectStateSnapshot() : null;
  cleanupInvalidAssignmentsAndAnchors();
  if (freeformRenderSnapshot) restoreFreeformObjectStateSnapshot(freeformRenderSnapshot, { includeAssignments: true });
  const rowsInput = el('rowsInput');
  const colsInput = el('colsInput');
  if (!uiState.gridResizeModeActive && document.activeElement !== rowsInput) rowsInput.value = state.rows;
  if (!uiState.gridResizeModeActive && document.activeElement !== colsInput) colsInput.value = state.cols;
  syncGridResizeControls();
  syncFreeformControlsFromState();
  renderClassManager();
  renderGroupMemberPicker();
  renderStudents();
  renderGroups();
  renderZones();
  if (el('groupManagerModal')?.classList.contains('show')) renderGroupManager();
  setSideTab(uiState.activeSideTab);
  renderCustomObjectMenus();
  renderCustomObjectManager();
  renderZoneControls();
  refreshAddStudentCollapse();
  refreshNamesOnlyToggle();
  applyDesignModeUi();
  applyVisibilityClasses();
  renderGrid();
  renderStatus();
  updateCellSelectionVisuals();
  persistActiveClass();
  applyTooltips();
  queueEnhanceHints();
  scheduleLinkedAutoSave('render');
  updateSaveHealthPanel();
  ModernizationSuite.enhanceRenderedWorkspace();
  ClassroomWorkflowV53?.enhanceRenderedWorkspace?.();
}


function renderTargeted(targets = ['all'], options = {}) {
  const requested = new Set(Array.isArray(targets) ? targets : [targets]);
  if (requested.has('all')) { renderAll(); return; }
  cleanupInvalidAssignmentsAndAnchors();
  if (requested.has('class-manager')) renderClassManager();
  if (requested.has('roster')) { renderGroupMemberPicker(); renderStudents(); refreshAddStudentCollapse(); }
  if (requested.has('rules')) { renderGroups(); renderZones(); if (el('groupManagerModal')?.classList.contains('show')) renderGroupManager(); renderZoneControls(); }
  if (requested.has('room')) { syncFreeformControlsFromState(); renderCustomObjectMenus(); renderCustomObjectManager(); applyDesignModeUi(); renderGrid(); updateCellSelectionVisuals(); }
  if (requested.has('status')) renderStatus();
  if (requested.has('settings')) { updatePageSettingsForm(); applyVisibilityClasses(); }
  if (requested.has('saving')) updateSaveHealthPanel();
  setSideTab(uiState.activeSideTab);
  persistActiveClass();
  applyTooltips();
  queueEnhanceHints();
  if (options.autosave !== false) scheduleLinkedAutoSave(options.reason || 'targeted-render');
  ModernizationSuite.enhanceRenderedWorkspace();
  ClassroomWorkflowV53?.enhanceRenderedWorkspace?.();
}




function snapshotAssignments() {
  const snapshot = {};
  Object.entries(state.cells).forEach(([key, cell]) => {
    snapshot[key] = { assignedStudentId: cell.assignedStudentId || null, manual: Boolean(cell.manual) };
  });
  snapshot.__freeform = (state.freeformLayout?.objects || []).filter(obj => obj.type === 'seat').map(obj => ({ id: obj.id, assignedStudentId: obj.assignedStudentId || null, manual: Boolean(obj.manual), locked: Boolean(obj.locked) }));
  return snapshot;
}

function restoreAssignments(snapshot) {
  Object.entries(state.cells).forEach(([key, cell]) => {
    const saved = snapshot[key] || {};
    cell.assignedStudentId = saved.assignedStudentId || null;
    cell.manual = Boolean(saved.manual);
  });
  const freeformById = new Map(Array.isArray(snapshot.__freeform) ? snapshot.__freeform.map(item => [String(item.id), item]) : []);
  (state.freeformLayout?.objects || []).forEach(obj => {
    if (obj.type !== 'seat') return;
    const saved = freeformById.get(String(obj.id));
    if (!saved) return;
    obj.assignedStudentId = saved.assignedStudentId || null;
    obj.manual = Boolean(saved.manual);
    obj.locked = Boolean(saved.locked);
  });
}











function renderCustomObjectMenus() {
  state.customObjects = Array.isArray(state.customObjects) ? state.customObjects.map(normalizeCustomObject).filter(Boolean) : [];
  const layoutTool = el('layoutTool');
  if (layoutTool) {
    const selectedValue = layoutTool.value;
    Array.from(layoutTool.querySelectorAll('option[data-custom-object-option]')).forEach(option => option.remove());
    state.customObjects.forEach(item => {
      const option = document.createElement('option');
      option.value = item.type;
      option.textContent = item.label;
      option.dataset.customObjectOption = 'true';
      layoutTool.appendChild(option);
    });
    if (Array.from(layoutTool.options).some(option => option.value === selectedValue)) layoutTool.value = selectedValue;
  }
  const container = el('customContextMenuItems');
  if (container) {
    if (!state.customObjects.length) {
      container.innerHTML = '<div class="context-menu-separator"></div><div class="context-menu-empty-note">Add custom room objects from Settings.</div>';
    } else {
      container.innerHTML = `<div class="context-menu-separator"></div>${state.customObjects.map(item => `<button type="button" data-menu-cell-type="${escapeHtml(item.type)}">${escapeHtml(item.label)}</button>`).join('')}`;
    }
  }
}

function showStudentGroupContextMenu(studentId, x, y) {
  const menu = el('studentGroupContextMenu');
  const title = el('studentGroupContextTitle');
  const items = el('studentGroupContextItems');
  const student = getStudent(studentId);
  if (!menu || !items || !student) return;
  const targetId = String(student.id);
  menu.dataset.studentId = targetId;
  title.textContent = studentDisplay(student);
  const editButton = `<button type="button" data-edit-student-id="${escapeHtml(targetId)}" title="Edit this student's first name, last name, nickname, grade, or ID.">Edit Student Information...</button><button type="button" data-edit-student-notes="${escapeHtml(targetId)}" title="Open categorized notes for this student.">📝 Student Notes...</button><div class="context-menu-separator"></div>`;
  if (eyeModeBlocksGroupEditing()) {
    items.innerHTML = editButton + '<div class="context-menu-empty-note">Group membership editing is disabled in the current Presentation Mode.</div>';
  } else if (!state.groups.length) {
    items.innerHTML = editButton + '<div class="context-menu-empty-note">No groups exist yet. Create a group first, then assign students here.</div>';
  } else {
    items.innerHTML = editButton + state.groups
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(group => {
        const inGroup = (group.studentIds || []).map(String).includes(targetId);
        const action = inGroup ? 'Remove from' : 'Add to';
        const check = inGroup ? '✓ ' : '';
        return `<button type="button" data-toggle-student-group="${escapeHtml(group.id)}" data-menu-student-id="${escapeHtml(targetId)}" title="${escapeHtml(action)} ${escapeHtml(studentDisplay(student))} ${inGroup ? 'from' : 'to'} ${escapeHtml(group.name)}."><span class="group-swatch" style="background:${escapeHtml(safeColor(group.color))}"></span><span>${check}${action} ${escapeHtml(group.name)}</span></button>`;
      })
      .join('');
  }
  applyTooltips(menu);
  menu.classList.add('show');
  const menuWidth = 285;
  const menuHeight = Math.min(menu.scrollHeight || 440, window.innerHeight - 20);
  const left = Math.min(x, window.innerWidth - menuWidth - 10);
  const top = Math.min(y, window.innerHeight - menuHeight - 10);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
}

function hideStudentGroupContextMenu() {
  const menu = el('studentGroupContextMenu');
  if (menu) menu.classList.remove('show');
}

function showCellContextMenu(cellKey, x, y) {
  const menu = el('cellContextMenu');
  const cell = state.cells[cellKey];
  if (!menu || !cell) return;
  menu.dataset.cellKey = cellKey;
  delete menu.dataset.freeformObjectId;
  const batchKeys = contextCellKeys(cellKey);
  const selectedTypes = batchKeys.map(key => state.cells[key]?.type).filter(Boolean);
  const sameSelectedType = selectedTypes.length && selectedTypes.every(type => type === selectedTypes[0]);
  const activeType = batchKeys.length > 1 ? (sameSelectedType ? selectedTypes[0] : '') : cell.type;
  el('cellContextTitle').textContent = batchKeys.length > 1 ? `${batchKeys.length} selected cells` : `Cell ${cell.row},${cell.col}`;
  const selectionNote = el('cellContextSelectionNote');
  if (selectionNote) {
    selectionNote.style.display = batchKeys.length > 1 ? 'block' : 'none';
    selectionNote.textContent = batchKeys.length > 1
      ? `${sameSelectedType ? `Current type: ${objectLabel(activeType)}. ` : 'Selected cells have mixed types. '}Chosen object applies to all selected cells.`
      : '';
  }
  renderCustomObjectMenus();
  menu.querySelectorAll('[data-menu-cell-type]').forEach(button => {
    const isCurrent = activeType && button.dataset.menuCellType === activeType;
    button.classList.toggle('current-selection', !!isCurrent);
    if (isCurrent) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
  applyTooltips(menu);
  menu.classList.add('show');
  const menuWidth = 250;
  const menuHeight = Math.min(menu.scrollHeight || 560, window.innerHeight - 20);
  const left = Math.min(x, window.innerWidth - menuWidth - 10);
  const top = Math.min(y, window.innerHeight - menuHeight - 10);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
}

function hideCellContextMenu() {
  const menu = el('cellContextMenu');
  if (menu) {
    menu.classList.remove('show');
    delete menu.dataset.freeformObjectId;
  }
}

function showFreeformObjectContextMenu(objectId, x, y) {
  const menu = el('cellContextMenu');
  const obj = (state.freeformLayout?.objects || []).find(item => item.id === objectId);
  if (!menu || !obj) return;
  menu.dataset.freeformObjectId = objectId;
  menu.dataset.cellKey = '';
  const title = el('cellContextTitle');
  if (title) title.textContent = `Freeform ${objectLabel(obj.type)}`;
  const selectionNote = el('cellContextSelectionNote');
  if (selectionNote) {
    selectionNote.style.display = 'block';
    selectionNote.textContent = obj.type === 'seat' && obj.assignedStudentId
      ? 'Changing this freeform seat to another object will clear the student assignment for that object.'
      : 'Chosen object applies to this freeform item.';
  }
  renderCustomObjectMenus();
  menu.querySelectorAll('[data-menu-cell-type]').forEach(button => {
    const isCurrent = button.dataset.menuCellType === obj.type;
    button.classList.toggle('current-selection', !!isCurrent);
    if (isCurrent) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
  applyTooltips(menu);
  menu.classList.add('show');
  const menuWidth = 250;
  const menuHeight = Math.min(menu.scrollHeight || 560, window.innerHeight - 20);
  const left = Math.min(x, window.innerWidth - menuWidth - 10);
  const top = Math.min(y, window.innerHeight - menuHeight - 10);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
}

function setFreeformObjectType(objectId, type) {
  if (eyeModeBlocksRoomEditing()) return blockEyeModeAction('room');
  restoreFreeformGeometryFromCache();
  const obj = (state.freeformLayout?.objects || []).find(item => item.id === objectId);
  if (!obj) return false;
  if (obj.locked) return blockLockedSeatEditAction() && false;
  const nextType = String(type || 'empty');
  const wasSeat = obj.type === 'seat';
  obj.type = nextType;
  obj.label = nextType === 'seat' ? '' : objectLabel(nextType);
  obj.color = objectTypeColor(nextType);
  if (nextType !== 'seat') {
    const oldCellKey = obj.cellKey || '';
    obj.assignedStudentId = null;
    obj.manual = false;
    obj.anchorGroupIds = [];
    obj.zoneIds = [];
    obj.locked = false;
    if (oldCellKey && state.cells[oldCellKey]) applyCellTypeWithoutRender(oldCellKey, nextType);
  } else if (!wasSeat) {
    obj.width = Math.max(Number(obj.width) || DEFAULT_FREEFORM_SEAT_WIDTH, DEFAULT_FREEFORM_SEAT_WIDTH);
    obj.height = Math.max(Number(obj.height) || DEFAULT_FREEFORM_SEAT_HEIGHT, DEFAULT_FREEFORM_SEAT_HEIGHT);
    obj.anchorGroupIds = obj.anchorGroupIds || [];
    positionFreeformObjectWithoutOverlap(obj, { startX: obj.x, startY: obj.y });
    mirrorFreeformSeatToGrid(obj, { clearStudentDuplicates: false });
  } else {
    mirrorFreeformSeatToGrid(obj, { clearStudentDuplicates: false });
  }
  state.freeformLayout.objects = state.freeformLayout.objects.map((item, index) => item.id === obj.id ? normalizeFreeformObject(obj, index) : item);
  rememberFreeformGeometry(state.freeformLayout.objects || []);
  commitFreeformLayoutChange('freeform-context-type', { render: true, syncToGrid: false });
  setLiveStatusMessage(`Changed freeform object to ${objectLabel(nextType)}.`);
  return true;
}


function renderCustomObjectManager() {
  const list = el('customObjectManagerList');
  if (!list) return;
  state.customObjects = Array.isArray(state.customObjects) ? state.customObjects.map(normalizeCustomObject).filter(Boolean) : [];
  if (!state.customObjects.length) {
    list.innerHTML = '<div class="hint">No custom right-click objects yet.</div>';
    return;
  }
  list.innerHTML = state.customObjects.map(item => `
        <div class="settings-object-row">
          <input value="${escapeHtml(item.label)}" data-custom-object-label="${escapeHtml(item.type)}" maxlength="28" aria-label="Custom object label" />
          <button type="button" class="tiny secondary" data-rename-custom-object="${escapeHtml(item.type)}">Save</button>
          <button type="button" class="tiny danger icon-button" data-delete-custom-object="${escapeHtml(item.type)}" aria-label="Delete custom object" title="Delete this custom object">🗑</button>
        </div>
      `).join('');
  applyTooltips(list);
}

function renameCustomObject(type, newLabel) {
  const item = state.customObjects.find(obj => obj.type === type);
  if (!item) return;
  const label = String(newLabel || '').trim().slice(0, 28);
  if (!label) {
    setLiveStatusMessage('Custom object name cannot be blank.');
    renderCustomObjectManager();
    return;
  }
  const duplicate = state.customObjects.some(obj => obj.type !== type && obj.label.toLowerCase() === label.toLowerCase());
  if (duplicate) {
    setLiveStatusMessage('Another custom object already uses that name.');
    renderCustomObjectManager();
    return;
  }
  item.label = label;
  renderAll();
  renderCustomObjectManager();
  setLiveStatusMessage(`Renamed custom object to ${label}.`);
}

function deleteCustomObject(type) {
  const item = state.customObjects.find(obj => obj.type === type);
  if (!item) return;
  showInAppConfirm(`Delete custom object "${item.label}"? Any cells using it will become empty space.`, () => {
    state.customObjects = state.customObjects.filter(obj => obj.type !== type);
    Object.values(state.cells).forEach(cell => {
      if (cell.type === type) {
        cell.type = 'empty';
        cell.assignedStudentId = null;
        cell.manual = false;
        cell.anchorGroupIds = [];
      }
    });
    renderAll();
    renderCustomObjectManager();
    setLiveStatusMessage(`Deleted custom object ${item.label}.`);
  }, {
    title: 'Delete Custom Object?',
    confirmText: 'Delete Object',
    cancelText: 'Cancel'
  });
}

function openGroupManagerModal() {
  renderGroupManager();
  const modal = el('groupManagerModal');
  if (modal) modal.classList.add('show');
  ModernizationSuite?.enhanceRenderedWorkspace?.();
}

function closeGroupManagerModal() {
  clearGroupManagerCarry();
  const modal = el('groupManagerModal');
  if (modal) modal.classList.remove('show');
}

function renderFeatureList(targetId) {
  const target = el(targetId);
  if (!target) return;
  target.innerHTML = PROJECT_FEATURES.map(feature => `
        <div class="feature-card">
          <strong>${escapeHtml(feature.title)}</strong>
          <span>${escapeHtml(feature.text)}</span>
        </div>
      `).join('');
}

function renderAllFeatureLists() {
  renderFeatureList('aboutFeatureList');
  renderFeatureList('settingsFeatureList');
}

let paypalDonationSdkPromise = null;

function paypalDonationTargets() {
  return Array.from(document.querySelectorAll('[data-paypal-donate-target]'));
}

function setPayPalDonationStatus(target, message, state = 'waiting') {
  if (!target) return;
  target.dataset.paypalDonationState = state;
  target.replaceChildren();
  const status = document.createElement('span');
  status.textContent = message;
  target.appendChild(status);
}

function loadPayPalDonationSdk() {
  if (window.PayPal?.Donation?.Button) return Promise.resolve(window.PayPal);
  if (paypalDonationSdkPromise) return paypalDonationSdkPromise;
  paypalDonationSdkPromise = loadExternalScriptOnce({
    src: PAYPAL_DONATION_CONFIG.sdkUrl,
    markerAttribute: 'data-paypal-donation-sdk',
    ready: () => Boolean(window.PayPal?.Donation?.Button),
    errorMessage: 'PayPal donation controls could not be loaded.',
    timeoutMs: 20000
  }).then(() => window.PayPal).finally(() => {
    paypalDonationSdkPromise = null;
  });
  return paypalDonationSdkPromise;
}

async function initializePayPalDonationButtons() {
  const targets = paypalDonationTargets().filter(target => !['loading', 'rendered'].includes(target.dataset.paypalDonationState));
  if (!targets.length) return;
  targets.forEach(target => setPayPalDonationStatus(target, 'Loading optional PayPal donation button...', 'loading'));
  try {
    const paypal = await loadPayPalDonationSdk();
    for (const target of targets) {
      target.replaceChildren();
      target.dataset.paypalDonationState = 'rendering';
      const button = paypal.Donation.Button({
        env: 'production',
        hosted_button_id: PAYPAL_DONATION_CONFIG.hostedButtonId,
        image: { ...PAYPAL_DONATION_CONFIG.image }
      });
      await Promise.resolve(button.render(`#${target.id}`));
      target.dataset.paypalDonationState = 'rendered';
    }
  } catch {
    targets.forEach(target => setPayPalDonationStatus(target, 'The optional PayPal donation button is unavailable while offline or blocked by the browser.', 'unavailable'));
  }
}

function installPayPalDonationSupport() {
  const aboutModal = el('aboutModal');
  if (!aboutModal || aboutModal.dataset.paypalDonationObserver === 'true') return;
  aboutModal.dataset.paypalDonationObserver = 'true';
  if (typeof MutationObserver !== 'function') return;
  const observer = new MutationObserver(() => {
    if (aboutModal.classList.contains('show')) initializePayPalDonationButtons();
  });
  observer.observe(aboutModal, { attributes: true, attributeFilter: ['class'] });
}

function openChangeLogModal() {
  renderChangeLog();
  const modal = el('changeLogModal');
  if (modal) modal.classList.add('show');
}

function closeChangeLogModal() {
  const modal = el('changeLogModal');
  if (modal) modal.classList.remove('show');
}

function updateLicenseInfo() {
  if (el('aboutLicenseSummary')) el('aboutLicenseSummary').textContent = APP_LICENSE.shortText;
  if (el('settingsLicenseSummary')) el('settingsLicenseSummary').textContent = APP_LICENSE.shortText;
  if (el('licenseName')) el('licenseName').textContent = APP_LICENSE.name;
  if (el('licenseSpdx')) el('licenseSpdx').textContent = APP_LICENSE.spdx || 'MIT';
  if (el('licenseHolder')) el('licenseHolder').textContent = APP_LICENSE.holder;
  if (el('licenseYear')) el('licenseYear').textContent = APP_LICENSE.year;
  if (el('licenseText')) el('licenseText').textContent = APP_LICENSE.text;
}

function openLicenseModal() {
  updateLicenseInfo();
  const modal = el('licenseModal');
  if (modal) modal.classList.add('show');
}

function closeLicenseModal() {
  const modal = el('licenseModal');
  if (modal) modal.classList.remove('show');
}

function appLicenseMetadata() {
  return {
    name: APP_LICENSE.name,
    spdx: APP_LICENSE.spdx || 'MIT',
    holder: APP_LICENSE.holder,
    year: APP_LICENSE.year,
    shortText: APP_LICENSE.shortText,
    text: APP_LICENSE.text
  };
}

function updateAboutInfo() {
  if (el('aboutRevision')) el('aboutRevision').textContent = APP_REVISION;
  if (el('aboutUpdated')) el('aboutUpdated').textContent = APP_LAST_UPDATED;
  if (el('settingsRevision')) el('settingsRevision').textContent = APP_REVISION;
  if (el('settingsUpdated')) el('settingsUpdated').textContent = APP_LAST_UPDATED;
  updateLicenseInfo();
  renderAllFeatureLists();
}

function updatePageSettingsFormCore() {
  const cfg = pageSettings();
  setControlValue('settingTheme', cfg.theme || 'default');
  setControlChecked('settingDefaultNamesOnly', cfg.defaultNamesOnly);
  setControlChecked('settingHeaderCollapsed', cfg.headerCollapsed);
  setControlChecked('settingLeftCollapsed', cfg.leftCollapsed);
  setControlChecked('settingRightCollapsed', cfg.rightCollapsed);
  setControlChecked('settingLayoutToolsCollapsed', cfg.layoutToolsCollapsed);
  setControlChecked('settingCsvCollapsed', cfg.csvCollapsed);
  setControlChecked('settingAddStudentCollapsed', cfg.addStudentCollapsed);
  setControlChecked('settingHideHints', cfg.hideHints);
  setControlChecked('settingHideObjectTypeLabels', cfg.hideObjectTypeLabels);
  setControlChecked('settingGoogleAnalyticsEnabled', googleAnalyticsEnabled());
  updateGoogleAnalyticsStatus();
  setControlValue('settingAutoSaveMinutes', cfg.autoSaveMinutes || 0);
  setControlValue('settingPreferredStorage', cfg.preferredStorage || 'browser');
  setControlValue('settingGoogleDriveClientId', cfg.googleDriveClientId || GOOGLE_DRIVE_CLIENT_ID || '');
  setControlValue('settingGoogleDriveFolderName', cfg.googleDriveFolderName || APP_CONFIG.googleDriveFolderName);
  setControlValue('saveOptionGoogleDriveFolderName', cfg.googleDriveFolderName || APP_CONFIG.googleDriveFolderName);
  setControlValue('settingDesignCellSize', cfg.designCellSize);
  setControlValue('settingSettingsAccessMethod', cfg.settingsAccessMethod || 'auto');
  setControlValue('settingAutoLockMinutes', cfg.autoLockMinutes || 0);
  setControlChecked('settingAutoLockOnBlur', cfg.autoLockOnBlur);
  setControlChecked('settingAutoLockOnTabHidden', cfg.autoLockOnTabHidden);
  setControlValue('settingAutoLockOnReturnMinutes', cfg.autoLockOnReturnMinutes || 0);
  setControlValue('settingPbkdf2Iterations', cfg.pbkdf2Iterations || DEFAULT_PAGE_SETTINGS.pbkdf2Iterations);
  updatePasswordStrengthDisplay('settingsEncryptionKey', 'settingsPasswordStrength');
  setControlChecked('visHidePrint', cfg.visibility.hidePrint);
  setControlChecked('visForceNamesOnly', cfg.visibility.forceNamesOnly);
  setControlChecked('visHideGroupDetails', cfg.visibility.hideGroupDetails);
  updateVisibilityCredentialNote();
  updatePinStatus();
  updateGoogleDriveControls();
}

function readPageSettingsFormCore() {
  const checked = id => !!el(id)?.checked;
  const value = id => el(id)?.value;
  const previousSettingsAccessMethod = pageSettings().settingsAccessMethod || 'auto';
  const requestedSettingsAccessMethod = value('settingSettingsAccessMethod') || 'auto';
  if (requestedSettingsAccessMethod === 'none' && previousSettingsAccessMethod !== 'none' && !uiState.allowSettingsAccessNoneOnce) {
    const select = el('settingSettingsAccessMethod');
    if (select) select.value = previousSettingsAccessMethod;
    showInAppConfirm('Disable the Settings access prompt? Anyone with this unlocked page could open Settings and change security, Presentation Mode, save, local data, and reset options. The chart data can still be encrypted at rest, but the Settings door itself will be open while the page is unlocked.', () => {
      uiState.allowSettingsAccessNoneOnce = true;
      if (select) select.value = 'none';
      readPageSettingsForm();
      uiState.allowSettingsAccessNoneOnce = false;
    }, { title: 'Disable Settings Protection?', confirmText: 'Disable Prompt', cancelText: 'Keep Protected' });
    return;
  }
  uiState.allowSettingsAccessNoneOnce = false;
  uiState.pageSettings = mergePageSettings({
    defaultNamesOnly: checked('settingDefaultNamesOnly'),
    theme: value('settingTheme'),
    headerCollapsed: checked('settingHeaderCollapsed'),
    leftCollapsed: checked('settingLeftCollapsed'),
    rightCollapsed: checked('settingRightCollapsed'),
    layoutToolsCollapsed: checked('settingLayoutToolsCollapsed'),
    csvCollapsed: checked('settingCsvCollapsed'),
    addStudentCollapsed: checked('settingAddStudentCollapsed'),
    hideHints: checked('settingHideHints'),
    hideObjectTypeLabels: checked('settingHideObjectTypeLabels'),
    hideUnassignedSeatTitles: pageSettings().hideUnassignedSeatTitles,
    gridViewZoom: pageSettings().gridViewZoom,
    seatTextScale: pageSettings().seatTextScale,
    autoSaveMinutes: clampNumber(value('settingAutoSaveMinutes'), 0, 120),
    preferredStorage: value('settingPreferredStorage') || pageSettings().preferredStorage || 'browser',
    googleDriveClientId: value('settingGoogleDriveClientId') || pageSettings().googleDriveClientId || GOOGLE_DRIVE_CLIENT_ID || '',
    googleDriveFolderName: value('settingGoogleDriveFolderName') || pageSettings().googleDriveFolderName || APP_CONFIG.googleDriveFolderName,
    googleDriveFolderId: pageSettings().googleDriveFolderId || '',
    googleDriveFileId: pageSettings().googleDriveFileId || '',
    googleDriveFileName: pageSettings().googleDriveFileName || '',
    googleDriveLastSavedAt: pageSettings().googleDriveLastSavedAt || '',
    designCellSize: value('settingDesignCellSize'),
    settingsAccessMethod: value('settingSettingsAccessMethod'),
    autoLockMinutes: value('settingAutoLockMinutes'),
    autoLockOnBlur: checked('settingAutoLockOnBlur'),
    autoLockOnTabHidden: checked('settingAutoLockOnTabHidden'),
    autoLockOnReturnMinutes: value('settingAutoLockOnReturnMinutes'),
    pbkdf2Iterations: value('settingPbkdf2Iterations'),
    visibility: {
      hideClassActions: true,
      hideWizard: true,
      hideSaveLoad: true,
      hideSettings: true,
      hidePrint: checked('visHidePrint'),
      hideLayoutTools: true,
      hideStudentsPanel: true,
      hideStatusPanel: true,
      hideChartActions: true,
      forceNamesOnly: checked('visForceNamesOnly'),
      hideGroupDetails: checked('visHideGroupDetails'),
      disableSeatEditing: true,
      disableRoomEditing: true,
      disableStudentEditing: true,
      disableGroupEditing: true
    }
  });
  applyPageSettings(uiState.pageSettings, { skipRender: true });
  const accessStatus = el('settingsAccessStatus');
  if (accessStatus) accessStatus.textContent = settingsAccessRequirementText();
  updateSaveHealthPanel();
  schedulePageSettingsPersistence('settings');
  updateSecurityStatusPanel();
  resetAutoLockTimer();
  syncSameTabReloadKeyForSettings(pageSettings());
  scheduleLinkedAutoSave('settings');
  setLiveStatusMessage('Settings updated. Page Load Defaults will apply the next time a save is loaded, or when Apply Defaults to Current View is selected.');
}

function updatePinStatus(message = '') {
  const node = el('settingsPinStatus');
  if (!node) return;
  const parts = [];
  parts.push(getLockCredential() ? 'Lock PIN is set.' : 'Lock PIN is not set.');
  parts.push(getVisibilityCredential() ? 'Presentation PIN is set.' : (getLockCredential() ? 'Presentation Mode will fall back to the Lock PIN.' : 'Presentation PIN is not set.'));
  parts.push(settingsAccessRequirementText());
  if (message) parts.push(message);
  node.textContent = parts.join(' ');
}

async function saveLockPinFromSettings() {
  const pin = String(el('settingsLockPin')?.value || '');
  const confirm = String(el('settingsLockPinConfirm')?.value || '');
  const validationMessage = newLocalCredentialValidationMessage(pin, 'lock PIN/password');
  if (validationMessage) { updatePinStatus(validationMessage); return; }
  if (pin !== confirm) { updatePinStatus('Lock PIN/password entries do not match.'); return; }
  try {
    await savePageLockCredential(pin);
    cachePageLockSecretForSession(pin);
    el('settingsLockPin').value = '';
    el('settingsLockPinConfirm').value = '';
    updatePinStatus('Lock PIN/password saved.');
    updateVisibilityCredentialNote();
    updateSecurityStatusPanel();
    setLiveStatusMessage('Lock PIN/password saved as a salted hash.');
  } catch (err) {
    updatePinStatus(err.message || 'Could not save lock PIN/password.');
  }
}

async function saveVisibilityPinFromSettings() {
  const pin = String(el('settingsVisibilityPin')?.value || '');
  const confirm = String(el('settingsVisibilityPinConfirm')?.value || '');
  const validationMessage = newLocalCredentialValidationMessage(pin, 'presentation mode PIN/password');
  if (validationMessage) { updatePinStatus(validationMessage); return; }
  if (pin !== confirm) { updatePinStatus('Presentation Mode PIN/password entries do not match.'); return; }
  try {
    await saveVisibilityCredential(pin);
    el('settingsVisibilityPin').value = '';
    el('settingsVisibilityPinConfirm').value = '';
    updatePinStatus('Presentation Mode PIN/password saved.');
    updateVisibilityCredentialNote();
    updateSecurityStatusPanel();
    setLiveStatusMessage('Presentation Mode PIN/password saved as a salted hash.');
  } catch (err) {
    updatePinStatus(err.message || 'Could not save presentation mode PIN/password.');
  }
}

function applyVisibilityClasses() {
  const cfg = pageSettings().visibility;
  if (uiState.visibilityMode && cfg.hideGroupDetails && ['groups','zones'].includes(uiState.activeSideTab)) setSideTab('students');
  const presentationActive = !!uiState.visibilityMode;
  document.body.classList.toggle('visibility-mode', !!uiState.visibilityMode);
  document.body.classList.toggle('vis-hide-class-actions', !!uiState.visibilityMode);
  document.body.classList.toggle('vis-hide-wizard', !!uiState.visibilityMode);
  document.body.classList.toggle('vis-hide-save-load', !!uiState.visibilityMode);
  document.body.classList.toggle('vis-hide-settings', !!uiState.visibilityMode);
  document.body.classList.toggle('vis-hide-print', !!uiState.visibilityMode && !!cfg.hidePrint);
  document.body.classList.toggle('vis-hide-layout-tools', !!uiState.visibilityMode);
  document.body.classList.toggle('vis-hide-students', !!uiState.visibilityMode);
  document.body.classList.toggle('vis-hide-status', !!uiState.visibilityMode);
  document.body.classList.toggle('vis-hide-chart-actions', !!uiState.visibilityMode);
  document.body.classList.toggle('vis-hide-group-details', !!uiState.visibilityMode && !!cfg.hideGroupDetails);
  document.body.classList.toggle('vis-disable-seat-editing', !!uiState.visibilityMode);
  document.body.classList.toggle('vis-disable-room-editing', !!uiState.visibilityMode);
  document.body.classList.toggle('vis-disable-student-editing', !!uiState.visibilityMode);
  document.body.classList.toggle('vis-disable-group-editing', !!uiState.visibilityMode);
  const chartReviewPanel = document.querySelector('main.app > .right-panel');
  if (chartReviewPanel) {
    chartReviewPanel.hidden = presentationActive;
    chartReviewPanel.inert = presentationActive;
    if (presentationActive) chartReviewPanel.setAttribute('aria-hidden', 'true');
    else chartReviewPanel.removeAttribute('aria-hidden');
  }
  const button = el('visibilityModeBtn');
  if (button) {
    button.setAttribute('aria-pressed', uiState.visibilityMode ? 'true' : 'false');
    button.textContent = uiState.visibilityMode ? '🙈' : '👁';
    button.title = uiState.visibilityMode ? 'Exit Presentation Mode. PIN/password or encryption key required.' : 'Enter the protected read-only Presentation Mode.';
  }
  syncMobilePanelNavigation(uiState.visibilityMode ? 'layout' : uiState.mobileActivePanel);
}

function blockEyeModeAction(kind, message = '') {
  const labels = {
    seat: 'Presentation mode is blocking seating edits. Exit Presentation mode to change assignments, locks, or seat actions.',
    room: 'Presentation mode is blocking room/cell editing. Exit Presentation mode to change the room layout.',
    student: 'Presentation mode is blocking student info edits. Exit Presentation mode to add, edit, or delete student records.',
    group: 'Presentation mode is blocking group/zone edits. Exit Presentation mode to change groups, zones, or memberships.'
  };
  setLiveStatusMessage(message || labels[kind] || 'Presentation mode is blocking that edit. Exit Presentation mode to make changes.');
  hideCellContextMenu?.();
  hideStudentGroupContextMenu?.();
  hideMobileActionDrawer?.();
  return true;
}

function eyeModeBlocksSeatEditing() { return !!uiState.visibilityMode; }
function eyeModeBlocksRoomEditing() { return !!uiState.visibilityMode; }
function eyeModeBlocksStudentEditing() { return !!uiState.visibilityMode; }
function eyeModeBlocksGroupEditing() { return !!uiState.visibilityMode; }

function enterVisibilityMode() {
  uiState.visibilityPreviousNamesOnly = uiState.namesOnlyLayout;
  uiState.visibilityPreviousWorkflow = document.body.dataset.workflow || 'review';
  uiState.visibilityPreviousMobileRoomPan = !!uiState.mobileRoomPanActive;
  if (uiState.designMode) {
    uiState.designMode = false;
    hideDesignModeTooltip();
    applyDesignModeUi();
  }
  uiState.visibilityMode = true;
  document.getElementById('v4CommandPalette')?.classList.remove('show');
  ProductExperience?.setWorkflow?.('review', { silent: true, presentation: true });
  if (isMobileViewport()) setMobileRoomPanActive(true);
  if (pageSettings().visibility.forceNamesOnly) uiState.namesOnlyLayout = true;
  if (pageSettings().visibility.hideGroupDetails && ['groups','zones'].includes(uiState.activeSideTab)) setSideTab('students');
  refreshNamesOnlyToggle();
  applyVisibilityClasses();
  renderGrid();
  if (safeStorageGet('sessionStorage', VISIBILITY_WRAPPED_KEY_SESSION_KEY)) setLiveStatusMessage('Presentation Mode enabled. Review is read-only; the full original chart is encrypted and the session key is wrapped until exit.');
  else if (!getVisibilityCredential() && getLockCredential()) setLiveStatusMessage('Presentation Mode enabled. Review is read-only; the full original chart is encrypted and the Lock PIN will be accepted to exit.');
  else setLiveStatusMessage('Presentation Mode enabled. Review is read-only and hidden details are scrubbed from the visible state.');
}

async function requestEnterVisibilityMode() {
  if (uiState.visibilityMode) {
    openVisibilityExitModal();
    return;
  }
  if (!hasAnyVisibilityExitSecret()) {
    openVisibilitySetupModal();
    return;
  }
  if (getVisibilityCredential() || getLockCredential()) {
    openVisibilityProtectKeyModal();
    return;
  }
  try {
    const protectedOk = await protectVisibilityModeData(currentSessionEncryptionKey());
    if (!protectedOk) throw new Error('Presentation Mode needs an encryption key or PIN/password to protect hidden data.');
    enterVisibilityMode();
  } catch (err) {
    setLiveStatusMessage(`Could not enter Presentation Mode securely: ${err.message}`);
  }
}

function exitVisibilityMode() {
  uiState.visibilityMode = false;
  uiState.namesOnlyLayout = !!uiState.visibilityPreviousNamesOnly;
  setMobileRoomPanActive(!!uiState.visibilityPreviousMobileRoomPan);
  ProductExperience?.setWorkflow?.(uiState.visibilityPreviousWorkflow || 'review', { silent: true });
  safeStorageRemove('sessionStorage', VISIBILITY_WRAPPED_KEY_SESSION_KEY);
  safeStorageRemove('sessionStorage', VISIBILITY_DATA_SESSION_KEY);
  refreshNamesOnlyToggle();
  applyVisibilityClasses();
  renderGrid();
  setLiveStatusMessage('Presentation Mode disabled. The previous workflow and hidden controls were restored.');
}

function showVisibilityExitError(message) {
  const node = el('visibilityExitError');
  if (!node) return;
  node.textContent = String(message || 'Could not exit presentation mode.');
  node.style.display = 'block';
}

function showVisibilityProtectKeyError(message) {
  const node = el('visibilityProtectKeyError');
  if (!node) return;
  node.textContent = String(message || 'Could not protect the encryption key for presentation mode.');
  node.style.display = 'block';
}

function openVisibilityProtectKeyModal() {
  const modal = el('visibilityProtectKeyModal');
  const input = el('visibilityProtectKeyInput');
  const error = el('visibilityProtectKeyError');
  if (!modal || !input) return;
  input.value = '';
  if (error) { error.textContent = ''; error.style.display = 'none'; }
  modal.classList.add('show');
  setTimeout(() => input.focus(), 50);
}

function closeVisibilityProtectKeyModal() {
  el('visibilityProtectKeyModal')?.classList.remove('show');
}

async function protectEncryptionKeyAndEnterVisibilityMode() {
  const input = el('visibilityProtectKeyInput');
  const secret = String(input?.value || '');
  if (!secret) { showVisibilityProtectKeyError('Enter the Presentation PIN or Lock PIN/password.'); return; }
  try {
    const source = await visibilitySecretSource(secret, false);
    if (!source) {
      showVisibilityProtectKeyError('Incorrect Presentation PIN or Lock PIN/password.');
      input?.select();
      input?.focus();
      return;
    }
    const activeKey = currentSessionEncryptionKey();
    if (activeKey) {
      await protectVisibilityModeData(activeKey);
      await protectSessionEncryptionKeyForMode('visibility', secret, source);
    } else {
      await protectVisibilityModeData(secret);
    }
    closeVisibilityProtectKeyModal();
    enterVisibilityMode();
  } catch (err) {
    showVisibilityProtectKeyError(err.message || 'Could not protect the encryption key for presentation mode.');
  }
}

function openVisibilityExitModal() {
  const modal = el('visibilityExitModal');
  const input = el('visibilityExitInput');
  const error = el('visibilityExitError');
  if (!modal || !input) return;
  input.value = '';
  if (error) { error.textContent = ''; error.style.display = 'none'; }
  modal.classList.add('show');
  setTimeout(() => input.focus(), 50);
}

function closeVisibilityExitModal() {
  el('visibilityExitModal')?.classList.remove('show');
}

async function attemptVisibilityExit() {
  const input = el('visibilityExitInput');
  const secret = String(input?.value || '');
  if (!secret) { showVisibilityExitError('Enter the Presentation PIN, lock PIN, or current encryption key.'); return; }
  try {
    const source = await visibilitySecretSource(secret, true);
    if (!source) {
      showVisibilityExitError('Incorrect PIN/password or encryption key.');
      input.select();
      input.focus();
      return;
    }
    if (safeStorageGet('sessionStorage', VISIBILITY_WRAPPED_KEY_SESSION_KEY)) {
      const restored = await restoreProtectedSessionEncryptionKey('visibility', secret);
      if (!restored) {
        showVisibilityExitError('Could not restore the wrapped encryption key with that PIN/password.');
        input.select();
        input.focus();
        return;
      }
    }
    await restoreVisibilityModeData(secret);
    closeVisibilityExitModal();
    exitVisibilityMode();
  } catch (err) {
    showVisibilityExitError(err.message || 'Could not exit presentation mode.');
  }
}

function openVisibilitySetupModal() {
  const modal = el('visibilitySetupModal');
  const input = el('visibilitySetupInput');
  const confirm = el('visibilitySetupConfirmInput');
  const error = el('visibilitySetupError');
  if (!modal || !input || !confirm) return;
  input.value = '';
  confirm.value = '';
  if (error) { error.textContent = ''; error.style.display = 'none'; }
  modal.classList.add('show');
  setTimeout(() => input.focus(), 50);
}

function closeVisibilitySetupModal() {
  el('visibilitySetupModal')?.classList.remove('show');
}

function showVisibilitySetupError(message) {
  const node = el('visibilitySetupError');
  if (!node) return;
  node.textContent = String(message || 'Could not set presentation mode PIN.');
  node.style.display = 'block';
}

async function saveVisibilitySetupAndEnter() {
  const input = el('visibilitySetupInput');
  const confirmInput = el('visibilitySetupConfirmInput');
  const secret = String(input?.value || '');
  const confirmSecret = String(confirmInput?.value || '');
  const validationMessage = newLocalCredentialValidationMessage(secret, 'presentation mode PIN/password');
  if (validationMessage) { showVisibilitySetupError(validationMessage); return; }
  if (secret !== confirmSecret) { showVisibilitySetupError('The presentation mode PIN/password entries do not match.'); return; }
  try {
    await saveVisibilityCredential(secret);
    const activeKey = currentSessionEncryptionKey();
    if (activeKey) {
      await protectVisibilityModeData(activeKey);
      await protectSessionEncryptionKeyForMode('visibility', secret, 'eye-pin');
    } else {
      await protectVisibilityModeData(secret);
    }
    closeVisibilitySetupModal();
    updateVisibilityCredentialNote();
    enterVisibilityMode();
  } catch (err) {
    showVisibilitySetupError(err.message || 'Could not save presentation mode PIN/password.');
  }
}

function settingsAccessRequirement() {
  const cfg = pageSettings();
  const method = cfg.settingsAccessMethod || 'auto';
  const lockAvailable = !!getLockCredential();
  const eyeAvailable = !!getVisibilityCredential();
  const encryptionAvailable = !!currentSessionEncryptionKey();
  const make = (type) => {
    if (type === 'lock' && lockAvailable) return { type, label: 'Lock/Unlock PIN', message: 'Enter the Lock/Unlock PIN to open Settings.' };
    if (type === 'eye' && eyeAvailable) return { type, label: 'Presentation Mode PIN', message: 'Enter the Presentation Mode PIN to open Settings.' };
    if (type === 'encryption' && encryptionAvailable) return { type, label: 'Encryption key', message: 'Enter the current session encryption key to open Settings.' };
    return null;
  };
  if (method === 'none') return null;
  if (method === 'lock' || method === 'eye' || method === 'encryption') return make(method);
  return make('lock') || make('eye') || make('encryption');
}

function settingsAccessRequirementText() {
  const req = settingsAccessRequirement();
  const method = pageSettings().settingsAccessMethod || 'auto';
  if (req) return `Settings access currently requires: ${req.label}.`;
  if (method === 'none') return 'Settings access is currently unlocked. Anyone using this unlocked page can open Settings until this is changed.';
  if (method === 'auto') return 'Settings access is currently open because no Lock PIN, Presentation PIN, or session encryption key is configured.';
  return `Settings access is currently open because the selected ${method === 'lock' ? 'Lock PIN' : method === 'eye' ? 'Presentation PIN' : 'Encryption key'} is not configured.`;
}

async function verifySettingsAccessSecret(secret, requirement) {
  const value = String(secret || '');
  if (!requirement || !value) return false;
  if (requirement.type === 'lock') return verifyPageLockSecret(value);
  if (requirement.type === 'eye') return verifyHashedCredential(VISIBILITY_CREDENTIAL_KEY, value);
  if (requirement.type === 'encryption') return value === currentSessionEncryptionKey();
  return false;
}

function showSettingsAccessError(message) {
  const node = el('settingsAccessError');
  if (!node) return;
  node.textContent = String(message || 'Could not open Settings.');
  node.style.display = 'block';
}

function closeSettingsAccessModal() {
  el('settingsAccessModal')?.classList.remove('show');
}

function openSettingsAccessModal(requirement) {
  const modal = el('settingsAccessModal');
  const input = el('settingsAccessInput');
  const error = el('settingsAccessError');
  const message = el('settingsAccessMessage');
  const label = el('settingsAccessInputLabel');
  if (!modal || !input) return;
  input.value = '';
  modal.dataset.requirementType = requirement?.type || '';
  if (message) message.textContent = requirement?.message || 'Enter the required credential to open Settings.';
  if (label) label.textContent = requirement?.label || 'PIN/password or encryption key';
  if (error) { error.textContent = ''; error.style.display = 'none'; }
  modal.classList.add('show');
  setTimeout(() => input.focus(), 50);
}

async function attemptSettingsAccess() {
  const modal = el('settingsAccessModal');
  const input = el('settingsAccessInput');
  const type = modal?.dataset?.requirementType || '';
  const requirement = settingsAccessRequirement();
  if (!requirement || requirement.type !== type) {
    closeSettingsAccessModal();
    openSettingsModal();
    return;
  }
  const secret = String(input?.value || '');
  if (!secret) { showSettingsAccessError(`Enter the ${requirement.label}.`); return; }
  try {
    const ok = await verifySettingsAccessSecret(secret, requirement);
    if (!ok) {
      showSettingsAccessError(`Incorrect ${requirement.label}.`);
      input?.select();
      input?.focus();
      return;
    }
    closeSettingsAccessModal();
    openSettingsModal();
  } catch (err) {
    showSettingsAccessError(err.message || 'Could not verify Settings access.');
  }
}

function requestOpenSettingsModal() {
  const requirement = settingsAccessRequirement();
  if (!requirement) {
    openSettingsModal();
    return;
  }
  openSettingsAccessModal(requirement);
}

function openSettingsModalCore() {
  updateAboutInfo();
  updatePageSettingsForm();
  const accessStatus = el('settingsAccessStatus');
  if (accessStatus) accessStatus.textContent = settingsAccessRequirementText();
  const enabled = el('settingsEncryptionEnabled');
  const keyInput = el('settingsEncryptionKey');
  if (enabled) enabled.checked = !!uiState.encryptionEnabled;
  if (keyInput) {
    keyInput.value = '';
    keyInput.placeholder = currentSessionEncryptionKey() ? 'Session key is active and hidden. Type to replace it.' : 'Enter encryption password for this session';
  }
  renderCustomObjectManager();
  renderZoneControls();
  loadChartDetailsIntoSettings();
  renderAllFeatureLists();
  updateSaveHealthPanel();
  el('settingsModal').classList.add('show');
  setSettingsPage(uiState.activeSettingsPage || 'chart');
}

function closeSettingsModalCore() {
  const keyInput = el('settingsEncryptionKey');
  if (keyInput) keyInput.value = '';
  ['settingsLockPin','settingsLockPinConfirm','settingsVisibilityPin','settingsVisibilityPinConfirm','settingsEncryptionKey'].forEach(id => { const input = el(id); if (input) input.value = ''; });
  updatePasswordStrengthDisplay('settingsEncryptionKey', 'settingsPasswordStrength');
  el('settingsModal').classList.remove('show');
}

const SETTINGS_PAGE_IDS = ['chart','appearance','help','eye','saving','security','room','about'];

function setSettingsPage(page = 'chart') {
  const selected = SETTINGS_PAGE_IDS.includes(page) ? page : 'chart';
  uiState.activeSettingsPage = selected;
  document.querySelectorAll('[data-settings-nav]').forEach(button => {
    const active = button.dataset.settingsNav === selected;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('[data-settings-panel]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.settingsPanel === selected);
  });
  const mobilePageSelect = el('settingsMobilePageSelect');
  if (mobilePageSelect && Array.from(mobilePageSelect.options).some(option => option.value === selected)) {
    mobilePageSelect.value = selected;
  }
  if (selected === 'about') initializePayPalDonationButtons();
}



function showSaveLoadMenu(x, y) {
  const menu = el('saveLoadMenu');
  if (!menu) return;
  menu.classList.add('show');
  applyTooltips(menu);
  const menuWidth = 250;
  const menuHeight = Math.min(menu.scrollHeight || 320, window.innerHeight - 20);
  const left = Math.min(x, window.innerWidth - menuWidth - 10);
  const top = Math.min(y, window.innerHeight - menuHeight - 10);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
}

function hideSaveLoadMenu() {
  const menu = el('saveLoadMenu');
  if (menu) menu.classList.remove('show');
}

async function handleSaveMenuAction(action, insideSaveOptions = false) {
  if (!action) return false;
  hideSaveLoadMenu();
  window.GuidedLearning?.closeLesson?.();
  if (action === 'open-save-options') { openSaveSetupModal(); return true; }
  if (action === 'save-primary') await writeLinkedSaveFile({ reason: 'manual', announce: true });
  if (action === 'choose-linked-file') await chooseLinkedSaveFile();
  if (action === 'load-linked') await loadFromLinkedSaveFile();
  if (action === 'google-drive-connect') await connectGoogleDriveFromUi();
  if (action === 'google-drive-save') await writeGoogleDriveSaveFile({ reason: 'manual', announce: true });
  if (action === 'google-drive-load') await loadFromGoogleDriveFile();
  if (action === 'google-drive-disconnect') forgetGoogleDriveLink();
  if (action === 'drive-share-manager') SharedDriveCollaborationV64.openManager();
  if (action === 'safe-share') ModernizationSuite.openSafeShare();
  if (action === 'download-package') await downloadSavePackage();
  if (action === 'download-students') await downloadStudentDataJson();
  if (action === 'download-groups') await downloadGroupConfigJson();
  if (action === 'download-rooms') await downloadRoomLayoutJson();
  if (action === 'export-all') await exportAndDownload('all');
  if (action === 'export-current') await exportAndDownload('current');
  if (action === 'import-json') el('importJson')?.click();
  if (insideSaveOptions && !['load-linked','google-drive-connect','google-drive-save','google-drive-load','google-drive-disconnect'].includes(action)) closeSaveSetupModal(true);
  return true;
}


function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(String(base64 || ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function validatedPbkdf2IterationCount(iterations, label = 'encrypted data', fallback = DEFAULT_PAGE_SETTINGS.pbkdf2Iterations) {
  const candidate = iterations === null || iterations === undefined || iterations === '' ? fallback : Number(iterations);
  if (!Number.isInteger(candidate) || candidate < PBKDF2_MIN_ITERATIONS || candidate > PBKDF2_MAX_ITERATIONS) {
    throw encryptionEnvelopeError(`${label} contains a PBKDF2 iteration count outside the supported ${PBKDF2_MIN_ITERATIONS.toLocaleString()}-${PBKDF2_MAX_ITERATIONS.toLocaleString()} range.`);
  }
  return candidate;
}

function encryptionIterationsForNewData() {
  return validatedPbkdf2IterationCount(pageSettings().pbkdf2Iterations, 'encryption settings', DEFAULT_PAGE_SETTINGS.pbkdf2Iterations);
}

function encryptionEnvelopeError(message, code = 'INVALID_ENCRYPTION_ENVELOPE', cause = null) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function encryptionIterationCount(iterations = null) {
  return validatedPbkdf2IterationCount(iterations, 'The encrypted save', encryptionIterationsForNewData());
}

async function deriveEncryptionKey(secret, salt, iterations = null) {
  const encoder = new TextEncoder();
  const count = encryptionIterationCount(iterations);
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: count, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptTextWithSecret(plainText, secret, scope = 'all', extra = {}) {
  if (!window.crypto || !crypto.subtle) throw new Error('This browser does not support Web Crypto encryption.');
  if (!String(secret || '')) throw new Error('An encryption key or PIN/password is required.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iterationCount = encryptionIterationsForNewData();
  const key = await deriveEncryptionKey(String(secret || ''), salt, iterationCount);
  const cipherBytes = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plainText)));
  return JSON.stringify({
    format: ENCRYPTED_ENVELOPE_FORMAT,
    app: APP_NAME,
    version: APP_REVISION,
    license: appLicenseMetadata(),
    exportedAt: new Date().toISOString(),
    encrypted: true,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    minimumReaderSchemaVersion: MIN_SUPPORTED_DATA_SCHEMA_VERSION,
    encryptionEnvelopeVersion: ENCRYPTION_ENVELOPE_VERSION,
    exportScope: scope === 'current' ? 'current-class' : scope === 'locked-session' ? 'locked-session' : 'all-classes',
    payloadKind: String(extra.payloadKind || scope || 'data'),
    ...extra,
    encryption: {
      algorithm: 'AES-GCM',
      kdf: 'PBKDF2-SHA-256',
      iterations: iterationCount,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(cipherBytes)
    }
  }, null, 2);
}

async function encryptText(plainText, scope = 'all') {
  return encryptTextWithSecret(plainText, currentSessionEncryptionKey(), scope);
}

function requestEncryptionKey(message = 'This file/local save is encrypted. Enter the encryption key to continue.') {
  return new Promise(resolve => {
    const modal = el('encryptionKeyModal');
    const input = el('encryptionKeyPromptInput');
    const messageBox = el('encryptionKeyModalMessage');
    const errorBox = el('encryptionKeyPromptError');
    const continueBtn = el('encryptionKeyContinueBtn');
    const cancelBtn = el('encryptionKeyCancelBtn');
    const topCancelBtn = el('encryptionKeyCancelTopBtn');
    if (!modal || !input || !continueBtn || !cancelBtn) {
      resolve(currentSessionEncryptionKey());
      return;
    }
    messageBox.textContent = currentSessionEncryptionKey() ? `${message} You can leave the field blank and press Continue to use the active session key.` : message;
    input.value = '';
    input.placeholder = currentSessionEncryptionKey() ? 'Leave blank to use active session key' : '';
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.style.display = 'none';
    }
    const close = value => {
      modal.classList.remove('show');
      continueBtn.onclick = null;
      cancelBtn.onclick = null;
      if (topCancelBtn) topCancelBtn.onclick = null;
      input.onkeydown = null;
      modal.onclick = null;
      resolve(value);
    };
    continueBtn.onclick = () => {
      const enteredKey = String(input.value || '');
      const key = enteredKey || currentSessionEncryptionKey();
      if (!key) {
        if (errorBox) {
          errorBox.textContent = 'Enter the encryption key to continue.';
          errorBox.style.display = 'block';
        }
        input.focus();
        return;
      }
      close(key);
    };
    cancelBtn.onclick = () => close(null);
    if (topCancelBtn) topCancelBtn.onclick = () => close(null);
    input.onkeydown = event => {
      if (event.key === 'Enter') continueBtn.click();
      if (event.key === 'Escape') close(null);
    };
    modal.onclick = event => {
      if (event.target === modal) close(null);
    };
    modal.classList.add('show');
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
  });
}

async function decryptTextEnvelopeWithDetails(parsed, keyOverride = '') {
  assertSupportedEncryptedEnvelope(parsed, 'encrypted data');
  const supplied = String(keyOverride || currentSessionEncryptionKey() || '');
  if (!supplied) throw new Error('This encrypted data requires the current release encryption password.');
  if (!window.crypto || !crypto.subtle) throw new Error('This browser does not support Web Crypto decryption.');
  const encryption = parsed.encryption;
  if (encryption.algorithm !== 'AES-GCM') throw encryptionEnvelopeError(`This data uses unsupported encryption algorithm ${String(encryption.algorithm || 'missing')}.`);
  if (encryption.kdf !== 'PBKDF2-SHA-256') throw encryptionEnvelopeError(`This data uses unsupported key derivation ${String(encryption.kdf || 'missing')}.`);
  const validated = validateEncryptionEnvelopeParameters(encryption, 'encrypted data');
  const salt = validated.salt;
  const iv = validated.iv;
  const cipherBytes = validated.ciphertext;
  const iterations = encryptionIterationCount(encryption.iterations);
  try {
    const key = await deriveEncryptionKey(supplied, salt, iterations);
    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
    return { plainText: new TextDecoder().decode(plainBuffer), secret: supplied, iterations };
  } catch (error) {
    throw encryptionEnvelopeError('Could not decrypt. Check the encryption password and try again. The data may also be damaged.', 'DECRYPT_FAILED', error);
  }
}

async function decryptTextEnvelope(parsed, keyOverride = '') {
  const result = await decryptTextEnvelopeWithDetails(parsed, keyOverride);
  return result?.plainText ?? null;
}

async function decryptTextEnvelopeAndTrustKey(parsed, keyOverride = '') {
  const result = await decryptTextEnvelopeWithDetails(parsed, keyOverride);
  if (result?.secret) setSessionEncryptionKey(result.secret);
  return result?.plainText ?? null;
}

function currentSessionEncryptionKey() {
  return String(uiState.encryptionKey || '').trim();
}

function savePayloadWillEncrypt() {
  return Boolean(currentSessionEncryptionKey());
}

function setSessionEncryptionKey(value) {
  const key = String(value || '');
  uiState.encryptionKey = key;
  if (key) uiState.encryptionEnabled = true;
  const settingsInput = el('settingsEncryptionKey');
  if (settingsInput && document.activeElement !== settingsInput) settingsInput.value = '';
  const settingsEnabled = el('settingsEncryptionEnabled');
  if (settingsEnabled) settingsEnabled.checked = !!uiState.encryptionEnabled;
  updateVisibilityCredentialNote();
  updateSaveHealthPanel();
  schedulePageSettingsPersistence('settings');
  updateSecurityStatusPanel();
  syncSameTabReloadKeyForSettings(pageSettings());
  void ensureAppSnapshotsLoaded({ force: false });
}

function clearSessionEncryptionKeyFromMemory() {
  uiState.encryptionKey = '';
  uiState.encryptionEnabled = true;
  const settingsInput = el('settingsEncryptionKey');
  if (settingsInput) settingsInput.value = '';
  const settingsEnabled = el('settingsEncryptionEnabled');
  if (settingsEnabled) settingsEnabled.checked = true;
  updateVisibilityCredentialNote();
  updateSaveHealthPanel();
  schedulePageSettingsPersistence('settings');
  updateSecurityStatusPanel();
  clearSameTabReloadSessionKey();
}

function wrappedKeyStorageForMode(mode) {
  return mode === 'visibility' ? VISIBILITY_WRAPPED_KEY_SESSION_KEY : PAGE_LOCK_WRAPPED_KEY_SESSION_KEY;
}

async function wrapSessionEncryptionKeyValue(keyValue, protectorSecret, mode, source = 'pin') {
  const keyText = String(keyValue || '').trim();
  const protector = String(protectorSecret || '');
  if (!keyText || !protector) return '';
  return encryptTextWithSecret(keyText, protector, `wrapped-encryption-key-${mode}`, {
    wrappedKind: 'session-encryption-key',
    wrappedFor: mode,
    wrappedBy: source
  });
}

async function protectSessionEncryptionKeyForMode(mode, protectorSecret, source = 'pin') {
  const keyText = currentSessionEncryptionKey();
  if (!keyText) return '';
  const wrapped = await wrapSessionEncryptionKeyValue(keyText, protectorSecret, mode, source);
  if (wrapped) {
    safeStorageSet('sessionStorage', wrappedKeyStorageForMode(mode), wrapped);
    clearSessionEncryptionKeyFromMemory();
  }
  return wrapped;
}

async function restoreProtectedSessionEncryptionKey(mode, protectorSecret) {
  const stored = safeStorageGet('sessionStorage', wrappedKeyStorageForMode(mode));
  if (!stored) return '';
  const parsed = JSON.parse(stored);
  if (!parsed || parsed.wrappedKind !== 'session-encryption-key') return '';
  const restored = await decryptTextEnvelope(parsed, protectorSecret);
  if (restored) {
    setSessionEncryptionKey(restored);
    safeStorageRemove('sessionStorage', wrappedKeyStorageForMode(mode));
  }
  return restored;
}

function clearWrappedSessionEncryptionKeys() {
  safeStorageRemove('sessionStorage', PAGE_LOCK_WRAPPED_KEY_SESSION_KEY);
  safeStorageRemove('sessionStorage', VISIBILITY_WRAPPED_KEY_SESSION_KEY);
  safeStorageRemove('sessionStorage', VISIBILITY_DATA_SESSION_KEY);
  clearSameTabReloadSessionKey();
}


function passwordStrengthDetails(password) {
  const text = String(password || '');
  const words = text.trim().split(/\s+/).filter(Boolean);
  let score = 0;
  if (text.length >= 10) score += 1;
  if (text.length >= 14 || words.length >= 3) score += 1;
  if (/[a-z]/.test(text) && /[A-Z]/.test(text)) score += 1;
  if (/\d/.test(text)) score += 1;
  if (/[^A-Za-z0-9\s]/.test(text)) score += 1;
  if (words.length >= 4 && text.length >= 18) score += 2;
  score = Math.max(0, Math.min(score, 5));
  const labels = ['Too weak','Weak','Fair','Good','Strong','Excellent'];
  const colors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e','#047857'];
  const tips = [];
  if (text.length < 12) tips.push('Use at least 12 characters; 16+ is better.');
  if (words.length < 4) tips.push('A passphrase with 4+ unrelated words is easier to remember and harder to guess.');
  if (!(/[a-z]/.test(text) && /[A-Z]/.test(text)) && words.length < 4) tips.push('Mix upper/lowercase or use a longer passphrase.');
  if (!/\d/.test(text) && words.length < 4) tips.push('Add numbers or make the phrase longer.');
  if (!/[^A-Za-z0-9\s]/.test(text) && words.length < 4) tips.push('Add punctuation or make the phrase longer.');
  if (!tips.length) tips.push('Good passphrase pattern. Keep it somewhere recoverable according to your workflow.');
  return { score, label: labels[score], color: colors[score], width: `${Math.max(8, (score + 1) * 16)}%`, acceptable: score >= 2 && (text.length >= 10 || words.length >= 3), tips };
}

function renderPasswordStrengthHtml(password) {
  const details = passwordStrengthDetails(password);
  return `<div class="password-strength-label">Strength: ${escapeHtml(details.label)}</div><div class="password-strength-bar" style="--strength-width:${escapeHtml(details.width)};--strength-color:${escapeHtml(details.color)}"><span class="password-strength-fill"></span></div><ul class="password-strength-tips">${details.tips.map(tip => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>`;
}

function updatePasswordStrengthDisplay(inputId, targetId) {
  const target = el(targetId);
  if (!target) return;
  const value = String(el(inputId)?.value || '');
  target.innerHTML = value ? renderPasswordStrengthHtml(value) : '<div class="password-strength-label">Strength: Not entered</div><div>Use a memorable passphrase, ideally 4+ unrelated words or 16+ mixed characters. No recovery exists for encrypted saves.</div>';
}

function shouldShowWelcomeSecuritySetup() {
  return !currentSessionEncryptionKey();
}

function showWelcomeSecurityError(message) {
  const node = el('welcomeEncryptionError');
  if (!node) return;
  node.textContent = String(message || 'Could not set the encryption password.');
  node.hidden = false;
}

function clearWelcomeSecurityError() {
  const node = el('welcomeEncryptionError');
  if (!node) return;
  node.textContent = '';
  node.hidden = true;
}

function setWelcomePasswordVisibility(targetId, visible) {
  const input = el(targetId);
  if (input) input.type = visible ? 'text' : 'password';
  const buttonId = targetId === 'welcomeEncryptionKeyConfirmInput' ? 'welcomeTogglePasswordConfirmBtn' : 'welcomeTogglePasswordBtn';
  const btn = el(buttonId);
  if (btn) {
    btn.textContent = visible ? 'Hide' : 'Show';
    btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
    btn.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    btn.title = visible ? 'Hide this password' : 'Show this password';
  }
}

function setWelcomePasswordFieldsHidden() {
  setWelcomePasswordVisibility('welcomeEncryptionKeyInput', false);
  setWelcomePasswordVisibility('welcomeEncryptionKeyConfirmInput', false);
}

function toggleWelcomePasswordVisibility(targetId = 'welcomeEncryptionKeyInput') {
  const input = el(targetId);
  setWelcomePasswordVisibility(targetId, !(input && input.type === 'text'));
}

function openWelcomeSecurityModalCore() {
  const modal = el('welcomeSecurityModal');
  const input = el('welcomeEncryptionKeyInput');
  const confirm = el('welcomeEncryptionKeyConfirmInput');
  if (!modal || !input || !confirm) return;
  input.value = '';
  confirm.value = '';
  setWelcomePasswordFieldsHidden();
  clearWelcomeSecurityError();
  updatePasswordStrengthDisplay('welcomeEncryptionKeyInput', 'welcomePasswordStrength');
  document.body.classList.add('welcome-security-active');
  modal.classList.add('show');
  setTimeout(() => input.focus(), 50);
}

function closeWelcomeSecurityModalCore() {
  el('welcomeSecurityModal')?.classList.remove('show');
  document.body.classList.remove('welcome-security-active');
  clearWelcomeSecurityError();
}

async function completeWelcomeSecuritySetupCore() {
  const input = el('welcomeEncryptionKeyInput');
  const confirmInput = el('welcomeEncryptionKeyConfirmInput');
  const password = String(input?.value || '');
  const confirm = String(confirmInput?.value || '');
  if (!window.crypto || !crypto.subtle) {
    showWelcomeSecurityError('This browser does not support Web Crypto. Use a modern browser before storing student data.');
    return;
  }
  const strength = passwordStrengthDetails(password);
  if (!strength.acceptable) {
    showWelcomeSecurityError('Use a stronger encryption password. A 4-word passphrase or 16+ mixed characters is recommended.');
    updatePasswordStrengthDisplay('welcomeEncryptionKeyInput', 'welcomePasswordStrength');
    input?.focus();
    return;
  }
  if (password !== confirm) {
    showWelcomeSecurityError('The encryption password entries do not match.');
    confirmInput?.select();
    confirmInput?.focus();
    return;
  }
  try {
    setSessionEncryptionKey(password);
    uiState.encryptionEnabled = true;
    uiState.welcomeSecurityJustCompleted = true;
    uiState.suppressEncryptionPromptUntil = Date.now() + 120000;
    safeStorageSet('localStorage', WELCOME_SETUP_STORAGE_KEY, 'true');
    const confirmTitle = el('confirmModalTitle');
    if (confirmTitle && confirmTitle.textContent === 'Encryption Recommended for Notes') {
      el('confirmModal')?.classList.remove('show');
    }
    updateSaveSetupDismissed(true);
    updateSaveMeta({ localOnlyChangeCount: 0, localSavePromptCount: 0, localSaveActive: true });
    await writeLocalBrowserSave({ reason: 'welcome', announce: false, skipDurablePrompt: true });
    await ensureAppSnapshotsLoaded({ force: true });
    if (input) input.value = '';
    if (confirmInput) confirmInput.value = '';
    closeWelcomeSecurityModal();
    setLiveStatusMessage('Secure setup complete. Your browser autosaves are encrypted. Additional security options are available in Settings.');
  } catch (err) {
    showWelcomeSecurityError(err.message || 'Could not complete secure setup.');
  }
}

function chooseExistingSaveFromWelcome() {
  const input = el('welcomeImportJson');
  if (!input) {
    showWelcomeSecurityError('The file picker is not available in this browser.');
    return;
  }
  input.value = '';
  input.click();
}

async function importExistingSaveFromWelcome(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  closeWelcomeSecurityModal();
  try {
    const text = await readTextFileWithinLimits(file, 'uploaded save or backup', IMPORT_LIMITS.saveBytes);
    await importStateDirectFromText(text, 'uploaded save or backup');
    if (typeof StartupRecoveryV45 !== 'undefined') StartupRecoveryV45.completeExternalLoad();
    uiState.linkedSaveLastSignature = currentSaveSignature();
    uiState.appReady = true;
    updateSaveHealthPanel();
    if (!currentSessionEncryptionKey()) {
      openWelcomeSecurityModal();
      showWelcomeSecurityError('That save loaded, but it did not unlock an encryption key. Create an encryption password before continuing so future local saves, snapshots, and backups are encrypted.');
      return;
    }
    safeStorageSet('localStorage', WELCOME_SETUP_STORAGE_KEY, 'true');
    setLiveStatusMessage('Loaded existing encrypted save/backup. Continue working from the restored data.');
  } catch (err) {
    openWelcomeSecurityModal();
    showWelcomeSecurityError(`Could not load that save file: ${err.message || err}`);
  } finally {
    if (event?.target) event.target.value = '';
  }
}

async function loadGoogleDriveSaveFromWelcome() {
  clearWelcomeSecurityError();
  return openGoogleDriveFileChooser({ skipConfirm: true, direct: true, fromWelcome: true });
}

function sanitizedStudentForVisibility(student) {
  const source = normalizeStudent(student);
  const cfg = pageSettings().visibility || {};
  return {
    ...source,
    grade: cfg.disableStudentEditing ? '' : source.grade,
    notesPrivate: '',
    notesSubstitute: '',
    notesPublic: cfg.disableStudentEditing ? '' : source.notesPublic
  };
}

function sanitizedCellForVisibility(cell) {
  const source = cell && typeof cell === 'object' ? { ...cell } : {};
  if (pageSettings().visibility.hideGroupDetails) {
    source.anchorGroupIds = [];
    source.zoneIds = [];
  }
  return source;
}

function sanitizedClassForVisibilityMode(classRecord) {
  const cls = normalizeClassRecord(classRecord);
  const cfg = pageSettings().visibility;
  const cells = {};
  Object.entries(cls.cells || {}).forEach(([key, cell]) => {
    cells[key] = sanitizedCellForVisibility(cell);
  });
  return {
    ...cls,
    students: (cls.students || []).map(sanitizedStudentForVisibility),
    groups: cfg.hideGroupDetails ? [] : (cls.groups || []).map(group => ({ ...group })),
    zones: cfg.hideGroupDetails ? [] : (cls.zones || []).map(zone => ({ ...zone })),
    cells,
    snapshots: [],
    chartMeta: normalizeChartMeta(cls.chartMeta || {})
  };
}

function sanitizeInMemoryForVisibilityMode() {
  persistActiveClass();
  const activeId = state.activeClassId;
  state.classes = (state.classes || []).map(sanitizedClassForVisibilityMode);
  state.roomTemplates = [];
  uiState.undoStack = [];
  uiState.redoStack = [];
  uiState.csvImportDraft = null;
  uiState.noteEditorContext = null;
  uiState.noteEditorDraft = null;
  uiState.restoreImportDraft = null;
  uiState.mobileCarryItem = null;
  uiState.selectedCellKeys?.clear();
  if (state.classes.some(cls => cls.id === activeId)) state.activeClassId = activeId;
  applyClassToState(state.activeClassId || state.classes[0]?.id);
  hideMobileActionDrawer?.();
  updateUndoRedoButtons();
}

async function protectVisibilityModeData(secret = '') {
  const protector = String(secret || currentSessionEncryptionKey() || '');
  if (!protector) return false;
  let plain = exportState('all');
  const encrypted = await encryptTextWithSecret(plain, protector, 'visibility-session', {
    visibilityProtected: true,
    protectedAt: new Date().toISOString()
  });
  plain = '';
  if (!safeStorageSet('sessionStorage', VISIBILITY_DATA_SESSION_KEY, encrypted)) {
    throw new Error('Presentation Mode could not store its encrypted recovery copy. Check browser storage permissions or available space; the chart was not hidden.');
  }
  sanitizeInMemoryForVisibilityMode();
  return true;
}

async function restoreVisibilityModeData(secret = '') {
  const stored = safeStorageGet('sessionStorage', VISIBILITY_DATA_SESSION_KEY);
  if (!stored) return false;
  const parsed = JSON.parse(stored);
  const candidates = [];
  [currentSessionEncryptionKey(), secret].forEach(value => {
    const text = String(value || '');
    if (text && !candidates.includes(text)) candidates.push(text);
  });
  let lastError = null;
  for (const candidate of candidates) {
    try {
      const decrypted = await decryptTextEnvelope(parsed, candidate);
      importState(decrypted);
      safeStorageRemove('sessionStorage', VISIBILITY_DATA_SESSION_KEY);
      return true;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Could not restore Presentation Mode protected data.');
}

async function snapshotDataForStorage(plainText) {
  const plain = String(plainText || '');
  if (!currentSessionEncryptionKey()) return plain;
  return encryptTextWithSecret(plain, currentSessionEncryptionKey(), 'snapshot', {
    payloadKind: 'snapshot',
    snapshotEncrypted: true
  });
}

async function snapshotDataForRestore(data) {
  const text = String(data || '');
  if (!text) return text;
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return text;
  }
  if (!parsed?.encrypted) {
    assertSupportedSnapshotDocument(parsed, 'snapshot');
    return text;
  }
  const envelope = assertSupportedEncryptedEnvelope(parsed, 'snapshot', 'snapshot');
  let key = currentSessionEncryptionKey();
  if (!key) {
    key = await requestEncryptionKey('This snapshot is encrypted and there is no active session key. Enter the encryption key to restore it.');
  }
  if (!key) throw new Error('Encrypted snapshot restore canceled.');
  const decrypted = await decryptTextEnvelopeAndTrustKey(parsed, key);
  const snapshot = assertSupportedSnapshotDocument(JSON.parse(decrypted), 'snapshot');
  assertEnvelopePayloadCompatibility(envelope, snapshot, 'snapshot');
  return decrypted;
}

async function prepareExportPayload(scope = 'all') {
  const baseIdentity = uiState.saveIdentity || uiState.previewSaveIdentity ? deepClone(uiState.saveIdentity || uiState.previewSaveIdentity) : null;
  const plain = await addBackupManifest(exportState(scope, {
    advanceRevision: true,
    saveIdentityBase: baseIdentity,
    commitIdentity: false
  }), scope);
  if (!currentSessionEncryptionKey()) {
    throw new Error('A session encryption password is required before saving or exporting app data. Use the Welcome screen or Settings > Saving to set it.');
  }
  const document = JSON.parse(plain);
  return {
    payload: await encryptText(plain, scope),
    saveIdentity: deepClone(document.saveIdentity),
    baseIdentity,
    document
  };
}

function commitPreparedSave(prepared) {
  if (!prepared?.saveIdentity) return false;
  const proposed = prepared.saveIdentity;
  const current = uiState.saveIdentity;
  const proposedRevision = Math.max(0, Number(proposed.revisionNumber || 0));
  const currentRevision = Math.max(0, Number(current?.revisionNumber || 0));
  if (current && proposedRevision < currentRevision) return false;
  if (current && proposedRevision === currentRevision && String(current.contentHash || '') !== String(proposed.contentHash || '')) return false;
  uiState.saveIdentity = deepClone(proposed);
  uiState.previewSaveIdentity = null;
  return true;
}

async function exportPayload(scope = 'all') {
  const prepared = await prepareExportPayload(scope);
  commitPreparedSave(prepared);
  return prepared.payload;
}

async function decryptEncryptedPayloadUsingActiveKeyFirst(parsed, sourceLabel = 'encrypted data') {
  const activeKey = currentSessionEncryptionKey();
  if (activeKey) {
    try {
      return await decryptTextEnvelopeAndTrustKey(parsed, activeKey);
    } catch (err) {
    }
  }
  let attempt = 0;
  while (true) {
    const prompt = attempt === 0
      ? `This ${sourceLabel} is encrypted. Enter the password used when that save was created.`
      : `That password did not unlock this ${sourceLabel}. Check capitalization and spacing, then try again or cancel.`;
    const key = await requestEncryptionKey(prompt);
    if (!key) throw new Error('Encrypted load canceled.');
    try {
      return await decryptTextEnvelopeAndTrustKey(parsed, key);
    } catch (err) {
      if (err?.code === 'INVALID_ENCRYPTION_ENVELOPE') throw err;
      attempt += 1;
    }
  }
}

async function importStateFromText(text, sourceLabel = 'file/local save') {
  const { parsed, encrypted } = await parseSupportedPayloadText(text, sourceLabel, { allowComponents: true });
  const draft = buildSelectiveRestoreDraft(parsed, sourceLabel, encrypted);
  openSelectiveRestoreModal(draft);
  setLiveStatusMessage('Schema-compatible file loaded. Choose what to restore.');
}


function classFromCurrentComponentExport(parsed) {

  const source = assertSupportedComponentExport(parsed, 'component export');
  const incoming = source;
  if (source.kind === 'seating-chart-student-data') {
    return normalizeClassRecord({
      id: incoming.activeClassId || uid('import-class'),
      name: source.className || incoming.className || 'Imported Student Data',
      students: Array.isArray(source.students) ? source.students : [],
      groups: [],
      rows: state.rows,
      cols: state.cols,
      cells: {},
      zones: []
    });
  }
  if (source.kind === 'seating-chart-groups-config') {
    return normalizeClassRecord({
      id: incoming.activeClassId || uid('import-class'),
      name: source.className || 'Imported Group Config',
      students: [],
      groups: Array.isArray(source.groups) ? source.groups : [],
      zones: Array.isArray(source.zones) ? source.zones : [],
      rows: state.rows,
      cols: state.cols,
      cells: {}
    });
  }
  if (source.kind === 'seating-chart-room-layouts') {
    const room = source.currentRoom || {};
    return normalizeClassRecord({
      id: incoming.activeClassId || uid('import-class'),
      name: source.className || 'Imported Room Layout',
      students: [],
      groups: [],
      rows: room.rows || incoming.rows || state.rows,
      cols: room.cols || incoming.cols || state.cols,
      cells: room.cells || incoming.cells || {},
      layoutMode: room.layoutMode || incoming.layoutMode || 'grid',
      freeformLayout: room.freeformLayout || incoming.freeformLayout || null,
      customObjects: room.customObjects || incoming.customObjects || [],
      zones: room.zones || incoming.zones || []
    });
  }
  throw unsupportedFormatError('component export', `Unsupported component kind ${String(source.kind || 'missing')}.`);
}

function buildSelectiveRestoreDraft(parsed, sourceLabel = 'file', encrypted = false) {
  const root = parsed && typeof parsed === 'object' ? parsed : {};
  const fullSave = root.format === SAVE_DOCUMENT_FORMAT;
  if (fullSave) assertSupportedSaveDocument(root, sourceLabel);
  else assertSupportedComponentExport(root, sourceLabel);
  const rawClasses = fullSave ? root.classes : [classFromCurrentComponentExport(root)];
  const fullRestoreRecommended = fullSave;
  const classes = rawClasses.map(normalizeClassRecord);
  const activeClassId = fullSave ? root.activeClassId : classes[0]?.id || '';
  const roomTemplates = fullSave ? (root.roomTemplates || []).map(normalizeRoomTemplateRecord) : (root.kind === 'seating-chart-room-layouts' ? (root.roomTemplates || []).map(normalizeRoomTemplateRecord) : []);
  const pageSettings = fullSave ? root.pageSettings || null : null;
  const collaborationAccess = fullSave ? normalizeCollaborationAccess(root.collaborationAccess) : normalizeCollaborationAccess(null);
  const appSnapshotsFromFile = fullSave ? root.appSnapshots || [] : [];
  const preferences = fullSave && root.preferences && typeof root.preferences === 'object' ? root.preferences : null;
  return {
    sourceLabel,
    encrypted,
    parsed: root,
    exportedAt: root.exportedAt || root.createdAt || '',
    classes,
    activeClassId: classes.some(cls => cls.id === activeClassId) ? activeClassId : classes[0]?.id,
    roomTemplates,
    appSnapshots: appSnapshotsFromFile.map(normalizeAppSnapshotRecord).filter(Boolean),
    pageSettings: pageSettings ? mergeImportedPageSettings(pageSettings) : null,
    collaborationAccess,
    preferences,
    fullRestoreRecommended
  };
}

function closeSelectiveRestoreModal() {
  el('selectiveRestoreModal')?.classList.remove('show');
  uiState.restoreImportDraft = null;
}

function openSelectiveRestoreModal(draft) {
  uiState.restoreImportDraft = draft;
  const fullToggle = el('restoreAllClassesToggle');
  if (fullToggle) fullToggle.checked = !!draft.fullRestoreRecommended;
  renderSelectiveRestoreModal();
  el('selectiveRestoreModal')?.classList.add('show');
}

function restoreSourceClass() {
  const draft = uiState.restoreImportDraft;
  if (!draft) return null;
  const select = el('restoreSourceClassSelect');
  const selectedId = select?.value || draft.activeClassId || draft.classes[0]?.id;
  return draft.classes.find(cls => cls.id === selectedId) || draft.classes[0] || null;
}

function restoreItemLabel(kind, item) {
  if (!item) return '';
  if (kind === 'students') return `${studentDisplay(item)}${item.id ? ` (${item.id})` : ''}`;
  if (kind === 'groups') return `${item.name || item.id || 'Group'}${item.type ? ` • ${typeLabel(item.type)}` : ''}`;
  if (kind === 'zones') return item.name || item.id || 'Zone';
  if (kind === 'snapshots') return `${item.name || 'Snapshot'}${item.createdAt ? ` • ${formatSaveDate(item.createdAt)}` : ''}`;
  return item.name || item.id || '';
}

function renderRestoreItemList(kind, items) {
  if (!Array.isArray(items) || !items.length) return '<div class="restore-empty">Nothing in this file for this section.</div>';
  return `<div class="restore-section-actions"><button type="button" class="tiny secondary" data-restore-select-all="${kind}">All</button><button type="button" class="tiny secondary" data-restore-select-none="${kind}">None</button></div><div class="restore-item-list">${items.map(item => `<label class="restore-item"><input type="checkbox" data-restore-item="${kind}" value="${escapeHtml(item.id || item.name || '')}" checked /><span>${escapeHtml(restoreItemLabel(kind, item))}</span></label>`).join('')}</div>`;
}

function renderSelectiveRestoreModal() {
  const draft = uiState.restoreImportDraft;
  if (!draft) return;
  const classSelect = el('restoreSourceClassSelect');
  const priorSelected = classSelect?.value || draft.activeClassId || draft.classes[0]?.id || '';
  if (classSelect) {
    classSelect.innerHTML = draft.classes.map(cls => `<option value="${escapeHtml(cls.id)}" ${cls.id === priorSelected ? 'selected' : ''}>${escapeHtml(cls.name || cls.id)}</option>`).join('');
  }
  const source = restoreSourceClass() || draft.classes[0] || normalizeClassRecord({ name: 'Imported Data' });
  const summary = el('restoreSourceSummary');
  if (summary) {
    const parts = [
          `${draft.sourceLabel || 'File'}${draft.encrypted ? ' • encrypted' : ''}`,
          `${draft.classes.length} class${draft.classes.length === 1 ? '' : 'es'}`,
          `${source.students.length} students`,
          `${source.groups.length} groups`,
          `${source.zones.length} zones`,
          `${(source.snapshots || []).length} class snapshots`,
          `${(draft.appSnapshots || []).length} full-app snapshots`
    ];
    summary.textContent = `${parts.join(' • ')}. Choose full restore, or uncheck it to restore selected pieces into the current class.`;
  }
  const sections = el('restoreSections');
  if (sections) {
    sections.innerHTML = [
          `<section class="restore-section"><h3>Students</h3>${renderRestoreItemList('students', source.students || [])}</section>`,
          `<section class="restore-section"><h3>Groups / Config</h3>${renderRestoreItemList('groups', source.groups || [])}</section>`,
          `<section class="restore-section"><h3>Zones</h3>${renderRestoreItemList('zones', source.zones || [])}</section>`,
          `<section class="restore-section"><h3>Snapshots</h3>${renderRestoreItemList('snapshots', source.snapshots || [])}</section>`,
          `<section class="restore-section"><h3>Room layout</h3><label class="restore-item"><input id="restoreRoomLayoutToggle" type="checkbox" ${Object.keys(source.cells || {}).length ? 'checked' : ''} /><span>Rows, columns, cell types, room objects, reserved group seats, and zone tags. Existing student seat assignments are preserved only where still valid.</span></label></section>`
    ].join('');
  }
  if (el('restoreRoomTemplatesToggle')) el('restoreRoomTemplatesToggle').checked = !!draft.roomTemplates.length;
  if (el('restorePageSettingsToggle')) el('restorePageSettingsToggle').checked = !!draft.pageSettings;
  if (el('restoreAppSnapshotsToggle')) el('restoreAppSnapshotsToggle').checked = !!(draft.appSnapshots || []).length;
  if (el('restoreChartDetailsToggle')) el('restoreChartDetailsToggle').checked = !!Object.keys(source.chartMeta || {}).length;
  updateRestorePartialEnabled();
}

function updateRestorePartialEnabled() {
  const full = !!el('restoreAllClassesToggle')?.checked;
  el('restorePartialPanel')?.classList.toggle('disabled', full);
  const apply = el('applySelectiveRestoreBtn');
  if (apply) apply.textContent = full ? 'Restore Entire File' : 'Restore Selected';
}

function selectedRestoreIds(kind) {
  return Array.from(document.querySelectorAll(`[data-restore-item="${kind}"]:checked`)).map(node => String(node.value));
}

function upsertById(list, incoming, normalizer) {
  const output = Array.isArray(list) ? deepClone(list) : [];
  incoming.forEach(item => {
    const next = normalizer ? normalizer(item) : deepClone(item);
    const id = String(next.id || '');
    const index = output.findIndex(existing => String(existing.id || '') === id);
    if (index >= 0) output[index] = next;
    else output.push(next);
  });
  return output;
}

function layoutOnlyCellsFromImport(sourceCells = {}, existingCells = {}) {
  const output = {};
  Object.entries(sourceCells || {}).forEach(([key, cell]) => {
    const imported = normalizeCellsRecord({ [key]: cell })[key] || { row: 1, col: 1, type: 'seat', anchorGroupIds: [], zoneIds: [] };
    const existing = existingCells[key] || {};
    const assigned = existing.assignedStudentId && (state.students || []).some(student => String(student.id) === String(existing.assignedStudentId)) ? String(existing.assignedStudentId) : '';
    output[key] = {
      ...imported,
      assignedStudentId: assigned || null,
      manual: Boolean(assigned && existing.manual)
    };
  });
  return output;
}

function layoutOnlyFreeformFromImport(sourceLayout = null, existingLayout = null) {
  const imported = normalizeFreeformLayout(sourceLayout);
  const existing = normalizeFreeformLayout(existingLayout);
  const existingById = new Map((existing.objects || []).map(obj => [String(obj.id), obj]));
  const existingByCell = new Map((existing.objects || []).filter(obj => obj.cellKey).map(obj => [String(obj.cellKey), obj]));
  const validStudents = new Set((state.students || []).map(student => String(student.id)));
  imported.objects = (imported.objects || []).map((obj, index) => {
    const normalized = normalizeFreeformObject(obj, index);
    const prior = existingById.get(String(normalized.id)) || (normalized.cellKey ? existingByCell.get(String(normalized.cellKey)) : null);
    const assigned = prior?.assignedStudentId && validStudents.has(String(prior.assignedStudentId)) ? String(prior.assignedStudentId) : null;
    return {
      ...normalized,
      assignedStudentId: assigned,
      manual: Boolean(assigned && prior?.manual),
      locked: Boolean(assigned && prior?.locked)
    };
  });
  imported.nextZ = Math.max(1, ...(imported.objects || []).map(obj => Number(obj.zIndex) || 1)) + 1;
  return imported;
}

function sanitizeActiveStateReferences() {
  const studentIds = new Set((state.students || []).map(student => String(student.id)));
  const zoneIds = new Set((state.zones || []).map(zone => String(zone.id)));
  const validSeatKeys = new Set(Object.entries(state.cells || {}).filter(([, cell]) => cell?.type === 'seat').map(([key]) => String(key)));
  state.groups = (state.groups || []).map((group, index) => {
    const next = normalizeGroupRecord(group, index);
    next.studentIds = next.studentIds.filter(id => studentIds.has(String(id)));
    next.anchorSeats = next.anchorSeats.filter(key => validSeatKeys.has(String(key)));
    if (next.zoneId && !zoneIds.has(String(next.zoneId))) next.zoneId = '';
    return next;
  });
  const normalizedGroupIds = new Set(state.groups.map(group => String(group.id)));
  state.zones = (state.zones || []).map((zone, index) => {
    const next = normalizeZoneRecord(zone, index);
    next.studentIds = next.studentIds.filter(id => studentIds.has(String(id)));
    next.groupIds = next.groupIds.filter(id => normalizedGroupIds.has(String(id)));
    state.groups.filter(group => String(group.zoneId || '') === String(next.id)).forEach(group => {
      if (!next.groupIds.includes(String(group.id))) next.groupIds.push(String(group.id));
    });
    return next;
  });
  Object.values(state.cells || {}).forEach(cell => {
    if (!cell) return;
    cell.anchorGroupIds = (cell.anchorGroupIds || []).map(String).filter(id => normalizedGroupIds.has(id));
    cell.zoneIds = (cell.zoneIds || []).map(String).filter(id => zoneIds.has(id));
    if (cell.assignedStudentId && !studentIds.has(String(cell.assignedStudentId))) {
      cell.assignedStudentId = null;
      cell.manual = false;
    }
  });
  (state.freeformLayout?.objects || []).forEach(obj => {
    obj.anchorGroupIds = (obj.anchorGroupIds || []).map(String).filter(id => normalizedGroupIds.has(id));
    obj.zoneIds = (obj.zoneIds || []).map(String).filter(id => zoneIds.has(id));
    if (obj.assignedStudentId && !studentIds.has(String(obj.assignedStudentId))) {
      obj.assignedStudentId = null;
      obj.manual = false;
      obj.locked = false;
    }
  });
}

function restoreEntireImportedFile() {
  const draft = uiState.restoreImportDraft;
  if (!draft || draft.parsed?.format !== SAVE_DOCUMENT_FORMAT) throw unsupportedFormatError('restore draft', 'Only a current full save can replace the complete application state.');
  const parsed = assertSupportedSaveDocument(draft.parsed, draft.sourceLabel || 'restore draft');
  uiState.saveIdentity = parsed.saveIdentity || null;
  uiState.previewSaveIdentity = null;
  state.classes = parsed.classes.map(normalizeClassRecord);
  state.activeClassId = parsed.activeClassId;
  state.roomTemplates = (parsed.roomTemplates || []).map(normalizeRoomTemplateRecord);
  state.collaborationAccess = normalizeCollaborationAccess(parsed.collaborationAccess);
  uiState.pageSettings = mergeImportedPageSettings(parsed.pageSettings || {});
  saveAppSnapshots((parsed.appSnapshots || []).map(normalizeAppSnapshotRecord));
  if (parsed.preferences?.dismissedHintKeys) saveDismissedHintKeys(new Set(parsed.preferences.dismissedHintKeys));
  applyClassToState(state.activeClassId);
  applyPageSettings(uiState.pageSettings, { skipRender: true, applyLoadDefaults: true });
  renderAll();
}

function applySelectedRestoreChanges(draft, source) {
  const studentIds = new Set(selectedRestoreIds('students'));
  const groupIds = new Set(selectedRestoreIds('groups'));
  const zoneIds = new Set(selectedRestoreIds('zones'));
  const snapshotIds = new Set(selectedRestoreIds('snapshots'));
  state.students = upsertById(state.students, (source.students || []).filter(item => studentIds.has(String(item.id))), normalizeStudent);
  state.groups = upsertById(state.groups, (source.groups || []).filter(item => groupIds.has(String(item.id))), normalizeGroupRecord);
  state.zones = upsertById(state.zones, (source.zones || []).filter(item => zoneIds.has(String(item.id))), normalizeZoneRecord);
  if (el('restoreRoomLayoutToggle')?.checked) {
    state.rows = Number(source.rows) || state.rows || 5;
    state.cols = Number(source.cols) || state.cols || 6;
    state.layoutMode = source.layoutMode === 'freeform' ? 'freeform' : 'grid';
    state.customObjects = Array.isArray(source.customObjects) ? source.customObjects.map(normalizeCustomObject).filter(Boolean) : state.customObjects;
    state.cells = layoutOnlyCellsFromImport(source.cells || {}, state.cells || {});
    state.freeformLayout = layoutOnlyFreeformFromImport(source.freeformLayout, state.freeformLayout);
    ensureGrid();
  }
  if (el('restoreChartDetailsToggle')?.checked) state.chartMeta = normalizeChartMeta(source.chartMeta || {});
  const selectedSnapshots = (source.snapshots || []).filter(item => snapshotIds.has(String(item.id))).map(normalizeSnapshotRecord);
  if (selectedSnapshots.length) {
    const current = activeClassRecord();
    if (current) current.snapshots = upsertById(current.snapshots || [], selectedSnapshots, normalizeSnapshotRecord);
  }
  if (el('restoreRoomTemplatesToggle')?.checked && draft.roomTemplates.length) {
    state.roomTemplates = upsertById(state.roomTemplates || [], draft.roomTemplates, normalizeRoomTemplateRecord);
  }
  if (el('restoreAppSnapshotsToggle')?.checked && (draft.appSnapshots || []).length) {
    saveAppSnapshots(upsertById(appSnapshots(), draft.appSnapshots, normalizeAppSnapshotRecord));
  }
  if (el('restorePageSettingsToggle')?.checked && draft.pageSettings) {
    uiState.pageSettings = mergePageSettings(draft.pageSettings);
    if (draft.preferences?.dismissedHintKeys) saveDismissedHintKeys(new Set(draft.preferences.dismissedHintKeys));
    applyPageSettings(uiState.pageSettings, { skipRender: true, applyLoadDefaults: true });
  }
  sanitizeActiveStateReferences();
  renderAll();
}

async function applySelectiveRestore() {
  const draft = uiState.restoreImportDraft;
  if (!draft) return;
  const source = restoreSourceClass();
  if (!source) return;
  const rollbackSaveIdentity = uiState.saveIdentity ? deepClone(uiState.saveIdentity) : null;
  const rollbackPreviewSaveIdentity = uiState.previewSaveIdentity ? deepClone(uiState.previewSaveIdentity) : null;
  const rollbackDocument = exportState('all');
  let snapshotCreated = false;
  try {
    pushUndoSnapshot('Before selective file restore');
    snapshotCreated = Boolean(await createAutoLockSnapshot('Before selective file restore'));
    if (el('restoreAllClassesToggle')?.checked) restoreEntireImportedFile();
    else applySelectedRestoreChanges(draft, source);
    closeSelectiveRestoreModal();
    updateSaveHealthPanel();
    setLiveStatusMessage(el('restoreAllClassesToggle')?.checked ? 'Entire file restored.' : 'Selected file contents restored.');
  } catch (error) {
    let rollbackError = null;
    try {
      importStateCore(rollbackDocument);
      uiState.saveIdentity = rollbackSaveIdentity;
      uiState.previewSaveIdentity = rollbackPreviewSaveIdentity;
    } catch (failure) {
      rollbackError = failure;
    }
    const restored = !rollbackError;
    WorkflowRecoveryV62.reportFailure({
      operation: 'Restore Imported Data',
      source: draft.sourceLabel || 'selected save file',
      error: rollbackError || error,
      dataChanged: !restored,
      snapshotCreated,
      remedy: restored
        ? 'The restore was rolled back safely. Review the selected sections and source file, then retry.'
        : 'The automatic rollback also failed. Do not save over existing backups; reload the page and restore the pre-restore snapshot or a downloaded backup.',
      retry: restored ? () => applySelectiveRestore() : null
    });
  }
}


function appIsEmbeddedFrame() {
  try {
    return window.self !== window.top;
  } catch (err) {
    return true;
  }
}

function linkedSaveApiSupported() {
  return !appIsEmbeddedFrame() && typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function' && typeof window.indexedDB !== 'undefined';
}

function isFilePickerBlockedError(err) {
  const message = String(err?.message || err || '').toLowerCase();
  return message.includes('cross origin') || message.includes('iframe') || message.includes('sub frame') || message.includes('file picker');
}

function openUploadClassesFileFallback(reason = '') {
  const input = el('importJson');
  if (!input) {
    setLiveStatusMessage('Upload Classes File is not available. Use Download Backup, then reopen this page and upload the file manually.');
    return false;
  }
  if (reason) setLiveStatusMessage(reason);
  input.click();
  return true;
}

function saveMeta() {
  try {
    const parsed = JSON.parse(safeStorageGet('localStorage', SAVE_META_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    return {};
  }
}

function updateSaveMeta(updates = {}) {
  const next = { ...saveMeta(), ...updates };
  safeStorageSet('localStorage', SAVE_META_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function formatSaveDate(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function openLinkedSaveDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('This browser does not support linked save file storage.')); return; }
    const request = indexedDB.open(LINKED_SAVE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LINKED_SAVE_STORE_NAME)) db.createObjectStore(LINKED_SAVE_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open linked save storage.'));
  });
}

async function linkedSaveDbGet(key) {
  const db = await openLinkedSaveDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LINKED_SAVE_STORE_NAME, 'readonly');
    const req = tx.objectStore(LINKED_SAVE_STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('Could not read linked save handle.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Could not read linked save handle.')); };
  });
}

async function linkedSaveDbSet(key, value) {
  const db = await openLinkedSaveDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LINKED_SAVE_STORE_NAME, 'readwrite');
    tx.objectStore(LINKED_SAVE_STORE_NAME).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Could not store linked save handle.')); };
  });
}

async function linkedSaveDbDelete(key) {
  const db = await openLinkedSaveDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LINKED_SAVE_STORE_NAME, 'readwrite');
    tx.objectStore(LINKED_SAVE_STORE_NAME).delete(key);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Could not remove linked save handle.')); };
  });
}

async function loadLinkedSaveHandleFromStorage() {
  uiState.linkedSaveSupported = linkedSaveApiSupported();
  if (!uiState.linkedSaveSupported) {
    uiState.linkedSaveStatus = appIsEmbeddedFrame()
      ? 'Linked files are blocked in embedded pages. Use Upload Classes File and Download Backup instead.'
      : 'Linked files are not supported in this browser. Use backup downloads instead.';
    return null;
  }
  try {
    const handle = await linkedSaveDbGet(LINKED_SAVE_HANDLE_KEY);
    if (handle) {
      uiState.linkedSaveHandle = handle;
      uiState.linkedSaveFileName = handle.name || saveMeta().linkedFileName || 'Linked save file';
      uiState.linkedSaveStatus = 'Linked file remembered. Permission may be requested when saving.';
      updateSaveMeta({ linkedFileName: uiState.linkedSaveFileName });
    }
    return handle;
  } catch (err) {
    uiState.linkedSaveStatus = `Could not restore linked file: ${err.message}`;
    return null;
  }
}

async function setLinkedSaveHandle(handle) {
  uiState.linkedSaveHandle = handle || null;
  uiState.linkedSaveFileName = handle?.name || '';
  if (handle) {
    try { uiState.linkedFileLastModified = Number((await handle.getFile()).lastModified || 0); }
    catch (err) { uiState.linkedFileLastModified = 0; }
    try { await linkedSaveDbSet(LINKED_SAVE_HANDLE_KEY, handle); }
    catch (err) { setLiveStatusMessage(`Linked file selected, but this browser could not remember it: ${err.message}`); }
    updateSaveMeta({ linkedFileName: uiState.linkedSaveFileName });
  }
  updateSaveHealthPanel();
}

async function forgetLinkedSaveFile() {
  uiState.linkedSaveHandle = null;
  uiState.linkedSaveFileName = '';
  uiState.linkedSaveStatus = 'No linked file selected.';
  try { await linkedSaveDbDelete(LINKED_SAVE_HANDLE_KEY); } catch {   }
  updateSaveMeta({ linkedFileName: '', linkedLastSavedAt: '' });
  updateSaveHealthPanel();
  setLiveStatusMessage('Forgot the linked save file. Existing files were not deleted.');
}

async function ensureLinkedSavePermission(handle, mode = 'readwrite') {
  if (!handle) return false;
  const options = { mode };
  try {
    if (typeof handle.queryPermission === 'function') {
      const existing = await handle.queryPermission(options);
      if (existing === 'granted') return true;
    }
    if (typeof handle.requestPermission === 'function') {
      const requested = await handle.requestPermission(options);
      return requested === 'granted';
    }
  } catch (err) {
    return false;
  }
  return true;
}

function currentSaveSignature() {
  persistActiveClass();
  try {
    return hashString(JSON.stringify({
      classes: state.classes || [],
      activeClassId: state.activeClassId || '',
      roomTemplates: state.roomTemplates || [],
      pageSettings: mergePageSettings(uiState.pageSettings)
    }));
  } catch (err) {
    return String(Date.now());
  }
}

function linkedSavePickerOptions() {
  return {
    suggestedName: exportFilename('all', savePayloadWillEncrypt()),
    types: [{
      description: 'Seating Chart Classes JSON',
      accept: { 'application/json': ['.json'] }
    }]
  };
}

async function chooseLinkedSaveFile() {
  if (!linkedSaveApiSupported()) {
    showLinkedSaveUnsupported();
    return null;
  }
  try {
    const handle = await window.showSaveFilePicker(linkedSavePickerOptions());
    await setLinkedSaveHandle(handle);
    updateGoogleDriveSettings({ preferredStorage: 'linked' });
    await writeLinkedSaveFile({ reason: 'manual', announce: true });
    updateSaveSetupDismissed(true);
    return handle;
  } catch (err) {
    if (err && err.name === 'AbortError') return null;
    if (isFilePickerBlockedError(err)) {
      uiState.linkedSaveStatus = 'Linked save file picker is blocked in this embedded page.';
      updateSaveHealthPanel();
      showLinkedSaveUnsupported('The browser blocked direct linked-file saving because this page is embedded. Use Download Backup or open the HTML file directly in a full browser tab to use linked saving.');
      return null;
    }
    setLiveStatusMessage(`Could not choose linked save file: ${err.message}`);
    return null;
  }
}

async function chooseLinkedLoadFile() {
  if (!linkedSaveApiSupported()) {
    openUploadClassesFileFallback(appIsEmbeddedFrame()
      ? 'Linked file loading is blocked inside this embedded page. Choose your classes JSON file using the standard upload picker instead.'
      : 'Linked file loading is not supported in this browser. Choose your classes JSON file using Upload Classes File instead.');
    return null;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: 'Seating Chart Classes JSON', accept: { 'application/json': ['.json'] } }]
    });
    await setLinkedSaveHandle(handle);
    return handle;
  } catch (err) {
    if (err && err.name === 'AbortError') return null;
    if (isFilePickerBlockedError(err)) {
      uiState.linkedSaveStatus = 'Linked load file picker is blocked in this embedded page.';
      updateSaveHealthPanel();
      openUploadClassesFileFallback('The browser blocked direct linked-file loading because this page is embedded. Choose your classes JSON file using the standard upload picker instead.');
      return null;
    }
    setLiveStatusMessage(`Could not choose linked load file: ${err.message}`);
    return null;
  }
}

function showLinkedSaveUnsupported(message = '') {
  const detail = message || (appIsEmbeddedFrame()
    ? 'This embedded page cannot use direct linked-file saving. Use Download Backup and Upload Classes File, or open the HTML file directly in a full browser tab to use linked saving.'
    : 'This browser does not support direct linked-file saving. Use Download Backup or Download All Current Classes instead. Chrome, Edge, and many Chromebooks support linked save files when opened from a secure page.');
  showInAppConfirm(detail, () => exportAndDownload('all'), {
    title: 'Linked File Save Not Available',
    confirmText: 'Download All Current Classes',
    cancelText: 'Cancel'
  });
}


function openSettingsToEncryptionKey() {
  closeSaveSetupModal(false);
  requestOpenSettingsModal();
  setTimeout(() => {
    const enabled = el('settingsEncryptionEnabled');
    if (enabled) enabled.checked = true;
    uiState.encryptionEnabled = true;
    const input = el('settingsEncryptionKey');
    if (input) {
      input.focus();
      input.select?.();
    }
    setLiveStatusMessage('Create an encryption key before saving. Use a phrase you can remember, but others cannot guess. There is no recovery if it is lost.');
    updateSaveHealthPanel();
  }, 120);
}

function offerEncryptionBeforeFirstSave() {
  const hasKey = !!currentSessionEncryptionKey();
  const sensitiveNotes = hasSensitiveStudentNotes();
  const keyRequired = (uiState.encryptionEnabled || sensitiveNotes) && !hasKey;
  if (!keyRequired) return Promise.resolve(true);
  return new Promise(resolve => {
    const message = sensitiveNotes
      ? 'Private or Substitute notes exist, so Save Now needs an encryption key before those notes can be written to a linked file, browser local storage, or a downloaded backup. Set an encryption key, then press Save Now again.'
      : 'Encryption is enabled, but no usable encryption key is set. Set an encryption key, then press Save Now again.';
    showInAppConfirm(message, () => {
      openSettingsToEncryptionKey();
      resolve(false);
    }, {
      title: 'Encryption Key Needed',
      confirmText: 'Set Encryption Key',
      cancelText: 'Cancel Save',
      onCancel: () => resolve(false)
    });
  });
}


function googleDriveConfig() {
  const cfg = pageSettings();
  return {
    clientId: String(cfg.googleDriveClientId || GOOGLE_DRIVE_CLIENT_ID || '').trim(),
    folderName: String(cfg.googleDriveFolderName || APP_CONFIG.googleDriveFolderName).trim() || APP_CONFIG.googleDriveFolderName,
    folderId: String(cfg.googleDriveFolderId || '').trim(),
    fileId: String(cfg.googleDriveFileId || '').trim(),
    fileName: String(cfg.googleDriveFileName || '').trim(),
    lastSavedAt: String(cfg.googleDriveLastSavedAt || '').trim(),
    fileVersion: String(cfg.googleDriveFileVersion || '').trim(),
    headRevisionId: String(cfg.googleDriveHeadRevisionId || '').trim(),
    remoteMd5: String(cfg.googleDriveRemoteMd5 || '').trim(),
    pickerApiKey: GOOGLE_PICKER_API_KEY,
    pickerAppId: GOOGLE_PICKER_APP_ID
  };
}

function googleDriveConfigured() {
  return !!googleDriveConfig().clientId;
}

function googlePickerConfigurationStatus() {
  const cfg = googleDriveConfig();
  const hostedOrigin = location.protocol === 'https:' || (location.protocol === 'http:' && ['localhost','127.0.0.1'].includes(location.hostname));
  const missing = [];
  if (!hostedOrigin) missing.push('HTTPS hosted origin');
  if (!cfg.clientId) missing.push('OAuth client ID');
  if (!cfg.pickerApiKey) missing.push('Browser API key');
  if (!cfg.pickerAppId) missing.push('Cloud project number');
  return { ready: missing.length === 0, missing, hostedOrigin };
}

function googlePickerConfigured() {
  return googlePickerConfigurationStatus().ready;
}

function googleDriveStorageConnected() {
  const cfg = googleDriveConfig();
  return googleDriveConfigured() && !!(cfg.folderId || cfg.fileId || hasUsableGoogleDriveToken());
}

function setSaveFallbackWarning(message = '') {
  uiState.saveFallbackWarning = String(message || '').trim();
  updateLocalSaveBanner();
}

function clearSaveFallbackWarning() {
  if (!uiState.saveFallbackWarning) return;
  uiState.saveFallbackWarning = '';
  updateLocalSaveBanner();
}

function schedulePageSettingsPersistence(reason = 'settings') {
  if (!uiState.appReady || uiState.pageLocked) return;
  clearTimeout(uiState.pageSettingsPersistTimer);
  uiState.pageSettingsPersistTimer = setTimeout(() => {
    uiState.pageSettingsPersistTimer = null;
    void writeLocalBrowserSave({ reason, announce: false, preserveFallbackWarning: true });
  }, 450);
}

function updateGoogleDriveControls() {
  const connected = googleDriveStorageConnected();
  const label = connected ? 'Google Drive Connected' : 'Connect Google Drive';
  const title = connected
    ? 'Google Drive is already configured for this browser session. Use Save Encrypted Copy, Load from Google Drive, or Disconnect.'
    : 'Connect Google Drive so encrypted saves can be stored in the user\'s Drive.';
  [el('settingsGoogleDriveConnectBtn'), ...document.querySelectorAll('[data-save-menu-action="google-drive-connect"]')].forEach(btn => {
    if (!btn) return;
    btn.disabled = connected;
    btn.textContent = label;
    btn.title = title;
    btn.setAttribute('aria-disabled', connected ? 'true' : 'false');
  });
}

function updateGoogleDriveSettings(updates = {}, options = {}) {
  uiState.pageSettings = mergePageSettings({ ...pageSettings(), ...updates });
  updatePageSettingsForm();
  updateGoogleDriveControls();
  updateSaveHealthPanel();
  if (options.persist !== false) schedulePageSettingsPersistence('google-drive-settings');
}

function escapeDriveQueryString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}


function trustedGoogleDriveWebLink(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.hostname)) return '';
    return url.href;
  } catch (_) {
    return '';
  }
}


async function fetchWithTimeout(url, options = {}, timeoutMs = NETWORK_TIMEOUT_MS) {
  const duration = Math.max(1000, Math.min(180000, Number(timeoutMs) || NETWORK_TIMEOUT_MS));
  const controller = new AbortController();
  const externalSignal = options.signal;
  let timedOut = false;
  const abortFromCaller = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) abortFromCaller();
    else externalSignal.addEventListener('abort', abortFromCaller, { once: true });
  }
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, duration);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error(`Network request timed out after ${Math.ceil(duration / 1000)} seconds.`);
      timeoutError.code = 'NETWORK_TIMEOUT';
      timeoutError.cause = error;
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener?.('abort', abortFromCaller);
  }
}

function loadExternalScriptOnce({ src, markerAttribute, ready, errorMessage, timeoutMs = 20000 }) {
  if (typeof ready === 'function' && ready()) return Promise.resolve(true);
  return new Promise((resolve, reject) => {
    let script = document.querySelector(`script[${markerAttribute}]`);
    let settled = false;
    let timer = 0;
    const finish = (ok, error = null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      script?.removeEventListener('load', onLoad);
      script?.removeEventListener('error', onError);
      if (ok && (!ready || ready())) resolve(true);
      else {
        if (script && (!ready || !ready())) script.remove();
        reject(error || new Error(errorMessage));
      }
    };
    const onLoad = () => finish(true);
    const onError = () => finish(false, new Error(errorMessage));
    timer = window.setTimeout(() => finish(false, new Error(`${errorMessage} The script load timed out.`)), timeoutMs);
    const created = !script;
    if (created) {
      script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.setAttribute(markerAttribute, 'true');
    }
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (created) document.head.appendChild(script);
  });
}

let googleAnalyticsLoadPromise = null;
let googleAnalyticsConfigured = false;

function googleAnalyticsEnabled() {
  return safeStorageGet('localStorage', GOOGLE_ANALYTICS_DISABLED_STORAGE_KEY) !== 'true';
}

function googleAnalyticsRuntimeSupported() {
  const protocol = String(window.location?.protocol || '');
  const userAgent = String(window.navigator?.userAgent || '');
  return ['http:', 'https:'].includes(protocol) && !/jsdom|node\.js/i.test(userAgent);
}

function updateGoogleAnalyticsStatus(message = '') {
  const status = el('googleAnalyticsSettingsStatus');
  const enabled = googleAnalyticsEnabled();
  const checkbox = el('settingGoogleAnalyticsEnabled');
  if (checkbox && checkbox.checked !== enabled) checkbox.checked = enabled;
  if (!status) return;
  if (message) { status.textContent = message; return; }
  if (!enabled) {
    status.textContent = 'Disabled on this browser. The Google tag is not loaded on future page loads, and collection is disabled for the current page.';
    return;
  }
  if (!googleAnalyticsRuntimeSupported()) {
    status.textContent = 'Enabled, but analytics runs only when the planner is hosted over HTTP or HTTPS. Local file copies do not load the Google tag.';
    return;
  }
  status.textContent = googleAnalyticsConfigured ? 'Enabled for this hosted page.' : 'Enabled. The Google tag will load for this hosted page.';
}

function configureGoogleAnalyticsQueue() {
  if (googleAnalyticsConfigured) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { analytics_storage: 'granted' });
  window.gtag('js', new Date());
  window.gtag('config', GOOGLE_ANALYTICS_MEASUREMENT_ID);
  googleAnalyticsConfigured = true;
}

async function initializeGoogleAnalytics() {
  const enabled = googleAnalyticsEnabled();
  window[`ga-disable-${GOOGLE_ANALYTICS_MEASUREMENT_ID}`] = !enabled;
  updateGoogleAnalyticsStatus();
  if (!enabled || !googleAnalyticsRuntimeSupported()) return false;
  configureGoogleAnalyticsQueue();
  if (!googleAnalyticsLoadPromise) {
    updateGoogleAnalyticsStatus('Loading the Google Analytics tag for this hosted page...');
    googleAnalyticsLoadPromise = loadExternalScriptOnce({
      src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ANALYTICS_MEASUREMENT_ID)}`,
      markerAttribute: 'data-google-analytics',
      errorMessage: 'Google Analytics could not be loaded.',
      timeoutMs: 20000
    }).catch(error => {
      googleAnalyticsLoadPromise = null;
      document.querySelector('script[data-google-analytics]')?.remove();
      throw error;
    });
  }
  try {
    await googleAnalyticsLoadPromise;
    updateGoogleAnalyticsStatus('Enabled for this hosted page. No classroom data is added as a custom analytics event.');
    return true;
  } catch (_) {
    updateGoogleAnalyticsStatus('Enabled, but the Google Analytics tag is currently blocked, offline, or unavailable.');
    return false;
  }
}

function setGoogleAnalyticsEnabled(enabled, options = {}) {
  const next = !!enabled;
  const persisted = next
    ? safeStorageRemove('localStorage', GOOGLE_ANALYTICS_DISABLED_STORAGE_KEY)
    : safeStorageSet('localStorage', GOOGLE_ANALYTICS_DISABLED_STORAGE_KEY, 'true');
  window[`ga-disable-${GOOGLE_ANALYTICS_MEASUREMENT_ID}`] = !next;
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', { analytics_storage: next ? 'granted' : 'denied' });
  }
  if (next) void initializeGoogleAnalytics();
  else updateGoogleAnalyticsStatus(persisted ? '' : 'Analytics is disabled for this page, but the browser could not persist the preference.');
  if (options.announce !== false) {
    setLiveStatusMessage(next ? 'Google Analytics enabled on this browser.' : 'Google Analytics disabled on this browser.');
  }
}

function syncGoogleDriveInputsToSettings(source = 'settings') {
  const folderInput = el(source === 'saveOptions' ? 'saveOptionGoogleDriveFolderName' : 'settingGoogleDriveFolderName');
  const clientInput = source === 'settings' ? el('settingGoogleDriveClientId') : null;
  const folderName = String(folderInput?.value || pageSettings().googleDriveFolderName || APP_CONFIG.googleDriveFolderName).trim() || APP_CONFIG.googleDriveFolderName;
  const clientId = String(clientInput?.value || pageSettings().googleDriveClientId || GOOGLE_DRIVE_CLIENT_ID || '').trim();
  updateGoogleDriveSettings({ googleDriveClientId: clientId, googleDriveFolderName: folderName });
  return googleDriveConfig();
}

function updateGoogleDriveStatus(message = '') {
  const cfg = googleDriveConfig();
  const connected = !!uiState.googleDriveAccessToken;
  const fileText = cfg.fileName ? ` File: ${cfg.fileName}.` : '';
  const base = message || uiState.googleDriveStatus || (connected ? `Connected to Google Drive.${fileText}` : 'Google Drive is not connected.');
  uiState.googleDriveStatus = base;
  ['googleDriveSettingsStatus','googleDriveSaveOptionsStatus','saveHealthGoogleDriveStatus'].forEach(id => {
    const node = el(id);
    if (node) node.textContent = base;
  });
  updateGoogleDriveControls();
}

function loadGoogleIdentityServicesScript() {
  return loadExternalScriptOnce({
    src: 'https://accounts.google.com/gsi/client',
    markerAttribute: 'data-google-identity-services',
    ready: () => Boolean(window.google?.accounts?.oauth2),
    errorMessage: 'Could not load Google Identity Services. Check internet access and content-blocking settings.'
  });
}

function hasUsableGoogleDriveToken() {
  return !!uiState.googleDriveAccessToken && Date.now() < Number(uiState.googleDriveTokenExpiresAt || 0) - 60000;
}

function clearGoogleDriveTokenSession() {
  safeStorageRemove('sessionStorage', GOOGLE_DRIVE_TOKEN_SESSION_KEY);
}

function cacheGoogleDriveTokenForSession() {
  const cfg = googleDriveConfig();
  if (!hasUsableGoogleDriveToken() || !cfg.clientId) {
    clearGoogleDriveTokenSession();
    return false;
  }
  return safeStorageSet('sessionStorage', GOOGLE_DRIVE_TOKEN_SESSION_KEY, JSON.stringify({
    accessToken: uiState.googleDriveAccessToken,
    expiresAt: Number(uiState.googleDriveTokenExpiresAt || 0),
    clientId: cfg.clientId,
    scope: GOOGLE_DRIVE_SCOPE
  }));
}

function restoreGoogleDriveTokenFromSession() {
  let cached = null;
  try { cached = JSON.parse(safeStorageGet('sessionStorage', GOOGLE_DRIVE_TOKEN_SESSION_KEY) || 'null'); }
  catch { clearGoogleDriveTokenSession(); return false; }
  const cfg = googleDriveConfig();
  const valid = cached
    && typeof cached.accessToken === 'string'
    && cached.accessToken
    && Number(cached.expiresAt || 0) > Date.now() + 60000
    && cached.clientId === cfg.clientId
    && cached.scope === GOOGLE_DRIVE_SCOPE;
  if (!valid) {
    clearGoogleDriveTokenSession();
    return false;
  }
  uiState.googleDriveAccessToken = cached.accessToken;
  uiState.googleDriveTokenExpiresAt = Number(cached.expiresAt);
  updateGoogleDriveStatus('Google Drive access restored for this browser tab.');
  return true;
}

async function ensureGoogleDriveToken(interactive = true, forceConsent = false) {
  if (!forceConsent && (hasUsableGoogleDriveToken() || restoreGoogleDriveTokenFromSession())) return uiState.googleDriveAccessToken;
  const cfg = googleDriveConfig();
  if (!cfg.clientId) throw new Error('Google Drive is not configured for this build. Contact the app publisher.');
  if (!interactive) throw new Error('Google Drive needs a fresh sign-in token. Use Connect Google Drive or Save to Google Drive.');
  await loadGoogleIdentityServicesScript();
  return new Promise((resolve, reject) => {
    try {
      uiState.googleDriveTokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: cfg.clientId,
        scope: GOOGLE_DRIVE_SCOPE,
        prompt: '',
        callback: response => {
          if (!response || response.error) {
            reject(new Error(response?.error_description || response?.error || 'Google authorization was canceled or failed.'));
            return;
          }
          uiState.googleDriveAccessToken = response.access_token || '';
          uiState.googleDriveTokenExpiresAt = Date.now() + (Number(response.expires_in || 3600) * 1000);
          cacheGoogleDriveTokenForSession();
          updateGoogleDriveStatus('Connected to Google Drive. Encrypted saves can be uploaded or loaded.');
          resolve(uiState.googleDriveAccessToken);
        }
      });
      uiState.googleDriveTokenClient.requestAccessToken({ prompt: forceConsent ? 'consent' : '' });
    } catch (err) {
      reject(err);
    }
  });
}

async function googleDriveFetch(url, options = {}, interactive = true) {
  let token = await ensureGoogleDriveToken(interactive);
  const { timeoutMs = NETWORK_TIMEOUT_MS, ...requestOptions } = options;
  const send = async () => fetchWithTimeout(url, {
    ...requestOptions,
    headers: {
      ...(requestOptions.headers || {}),
      Authorization: `Bearer ${token}`
    }
  }, timeoutMs);
  let response = await send();
  if (response.status === 401 && interactive) {
    uiState.googleDriveAccessToken = '';
    uiState.googleDriveTokenExpiresAt = 0;
    clearGoogleDriveTokenSession();
    token = await ensureGoogleDriveToken(true);
    response = await send();
  }
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json())?.error?.message || ''; } catch {   }
    throw new Error(detail || `Google Drive request failed (${response.status}).`);
  }
  return response;
}

async function findGoogleDriveAppFolder() {
  const cfg = googleDriveConfig();
  if (cfg.folderId) return cfg.folderId;
  const q = [
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
        `name = '${escapeDriveQueryString(cfg.folderName)}'`,
        `appProperties has { key='app' and value='${GOOGLE_DRIVE_APP_PROPERTY}' }`
  ].join(' and ');
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive&pageSize=10`;
  const response = await googleDriveFetch(url, { method: 'GET' });
  const data = await response.json();
  const found = Array.isArray(data.files) && data.files[0];
  if (found?.id) {
    updateGoogleDriveSettings({ googleDriveFolderId: found.id });
    return found.id;
  }
  return '';
}

async function createGoogleDriveAppFolder() {
  const cfg = googleDriveConfig();
  const metadata = {
    name: cfg.folderName,
    mimeType: 'application/vnd.google-apps.folder',
    appProperties: { app: GOOGLE_DRIVE_APP_PROPERTY, kind: 'save-folder' }
  };
  const response = await googleDriveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata)
  });
  const created = await response.json();
  updateGoogleDriveSettings({ googleDriveFolderId: created.id || '', googleDriveFolderName: created.name || cfg.folderName });
  return created.id;
}

async function ensureGoogleDriveAppFolder() {
  return await findGoogleDriveAppFolder() || await createGoogleDriveAppFolder();
}

function googleDriveMultipartBody(metadata, content, contentType = 'application/json') {
  const boundary = `seating_chart_boundary_${secureRandomToken(18)}`;
  const body = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        `Content-Type: ${contentType}; charset=UTF-8`,
        '',
        content,
        `--${boundary}--`,
        ''
  ].join('\r\n');
  return { boundary, body };
}

function googleDriveCurrentSaveFileName() {
  const classPart = String(activeClassRecord()?.name || 'all-classes').replace(/[^a-z0-9._ -]+/gi, '-').replace(/\s+/g, '-').slice(0, 50) || 'all-classes';
  return `seating-chart-${classPart}-current-encrypted.json`;
}

async function uploadGoogleDriveCurrentSave(payload, folderId) {
  const cfg = googleDriveConfig();
  const fileName = cfg.fileName || googleDriveCurrentSaveFileName();
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    appProperties: {
      app: GOOGLE_DRIVE_APP_PROPERTY,
      kind: 'current-save',
      encrypted: 'true',
      appVersion: APP_REVISION,
      dataSchemaVersion: String(DATA_SCHEMA_VERSION),
      minimumReaderSchemaVersion: String(MIN_SUPPORTED_DATA_SCHEMA_VERSION)
    }
  };
  if (!cfg.fileId && folderId) metadata.parents = [folderId];
  const { boundary, body } = googleDriveMultipartBody(metadata, payload, 'application/json');
  const isUpdate = !!cfg.fileId;
  const url = isUpdate
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(cfg.fileId)}?uploadType=multipart&fields=id,name,modifiedTime,webViewLink,version,md5Checksum,headRevisionId,capabilities(canEdit,canShare)`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,webViewLink,version,md5Checksum,headRevisionId,capabilities(canEdit,canShare)';
  const response = await googleDriveFetch(url, {
    method: isUpdate ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  });
  return response.json();
}

async function connectGoogleDriveFromUi() {
  try {
    syncGoogleDriveInputsToSettings(document.activeElement?.id?.startsWith('saveOption') ? 'saveOptions' : 'settings');
    await ensureGoogleDriveToken(true, true);
    const folderId = await ensureGoogleDriveAppFolder();
    updateGoogleDriveSettings({ preferredStorage: 'googleDrive', googleDriveFolderId: folderId });
    updateSaveSetupDismissed(true);
    updateGoogleDriveStatus('Connected to Google Drive. Folder is ready for encrypted saves.');
    clearSaveFallbackWarning();
    setLiveStatusMessage('Google Drive connected. Encrypted saves can now use Drive storage.');
    await writeLocalBrowserSave({ reason: 'settings', announce: false });
    return true;
  } catch (err) {
    updateGoogleDriveStatus(`Google Drive connection failed: ${err.message}`);
    setLiveStatusMessage(`Google Drive connection failed: ${err.message}`);
    WorkflowRecoveryV62.reportFailure({
      operation: 'Connect Google Drive',
      source: 'Google Drive OAuth and application folder',
      error: err,
      dataChanged: false,
      snapshotCreated: false,
      remedy: 'Confirm the deployment client ID, pop-up permissions, network access, and Google account authorization, then retry.',
      retry: () => connectGoogleDriveFromUi()
    });
    return false;
  }
}

async function writeGoogleDriveSaveFile(options = {}) {
  if (!CrossTabCoordinator.canWrite({ announce: options.announce !== false })) return false;
  const reason = options.reason || 'manual';
  const announce = options.announce !== false;
  let preparedSave = null;
  try {
    if (!autosaveRequestStillCurrent(options)) return false;
    if (uiState.googleDriveBusy) return false;
    syncGoogleDriveInputsToSettings(document.activeElement?.id?.startsWith('saveOption') ? 'saveOptions' : 'settings');
    if (!googleDriveConfigured()) throw new Error('Google Drive is not configured for this build.');
    if (!currentSessionEncryptionKey()) throw new Error('A session encryption password is required before saving to Google Drive.');
    if (reason === 'auto' && !hasUsableGoogleDriveToken()) {
      const fallbackMessage = 'Google Drive auto-save needs a fresh sign-in token. Saved an encrypted browser fallback until Google Drive saves successfully again.';
      updateGoogleDriveStatus('Google Drive auto-save is pending. Use Save to Google Drive or Load from Google Drive to refresh access.');
      setSaveFallbackWarning(fallbackMessage);
      await writeLocalBrowserSave({ reason: 'google-drive-fallback', announce: false, preserveFallbackWarning: true, autosaveGeneration: options.autosaveGeneration });
      return false;
    }
    uiState.googleDriveBusy = true;
    updateGoogleDriveStatus('Saving encrypted copy to Google Drive...');
    const folderId = await ensureGoogleDriveAppFolder();
    const cfg = googleDriveConfig();
    SharedDriveCollaborationV64.assertCanWriteCurrentDriveFile();
    if (!options.forceOverwrite && cfg.fileId && pageSettings().googleDriveConflictPolicy !== 'overwrite') {
      const conflict = await ModernizationSuite.googleDriveConflict(cfg.fileId, cfg);
      if (conflict) {
        let remoteInspection = null;
        try {
          remoteInspection = await SharedDriveCollaborationV64.inspectRemoteDriveChange(cfg.fileId);
        } catch (_) {
          remoteInspection = null;
        }
        if (remoteInspection?.metadataOnly) {
          updateGoogleDriveSettings({
            googleDriveLastSavedAt: conflict.modifiedTime || cfg.lastSavedAt || '',
            googleDriveFileVersion: String(conflict.version || cfg.fileVersion || ''),
            googleDriveHeadRevisionId: String(conflict.headRevisionId || cfg.headRevisionId || ''),
            googleDriveRemoteMd5: String(conflict.md5Checksum || cfg.remoteMd5 || '')
          }, { persist: false });
          SharedDriveCollaborationV64.captureBaseDocument(remoteInspection.remote, cfg.fileId);
          updateGoogleDriveStatus('Google Drive revision metadata changed, but the classroom content did not. Continuing the save without a false conflict.');
        } else {
          uiState.googleDriveBusy = false;
          if (pageSettings().googleDriveConflictPolicy === 'copy') {
            updateGoogleDriveSettings({ googleDriveFileId: '', googleDriveFileName: '' }, { persist: false });
          } else {
            return ModernizationSuite.saveConflict(`The Google Drive copy changed after this tab's last confirmed save. ${conflict.reasons?.join(' ') || `Remote modified time: ${new Date(conflict.modifiedTime).toLocaleString()}.`}`, {
              overwrite: () => writeGoogleDriveSaveFile({ ...options, forceOverwrite: true, announce: true }),
              copy: () => { updateGoogleDriveSettings({ googleDriveFileId: '', googleDriveFileName: '' }, { persist: false }); return writeGoogleDriveSaveFile({ ...options, forceOverwrite: true, announce: true }); },
              merge: () => SharedDriveCollaborationV64.mergeRemoteDriveChanges(options),
              cancel: () => setLiveStatusMessage('Google Drive save canceled. The newer remote copy was preserved.')
            });
          }
        }
      }
    }
    preparedSave = await prepareExportPayload('all');
    if (!autosaveRequestStillCurrent(options)) return false;
    const saved = await uploadGoogleDriveCurrentSave(preparedSave.payload, folderId);
    if (!autosaveRequestStillCurrent(options)) return false;
    commitPreparedSave(preparedSave);
    const now = saved.modifiedTime || new Date().toISOString();
    updateGoogleDriveSettings({
      preferredStorage: 'googleDrive',
      googleDriveFolderId: folderId,
      googleDriveFileId: saved.id || pageSettings().googleDriveFileId || '',
      googleDriveFileName: saved.name || googleDriveCurrentSaveFileName(),
      googleDriveLastSavedAt: now,
      googleDriveFileVersion: String(saved.version || ''),
      googleDriveHeadRevisionId: String(saved.headRevisionId || ''),
      googleDriveRemoteMd5: String(saved.md5Checksum || '')
    });
    uiState.googleDriveLastSyncAt = now;
    uiState.linkedSaveLastSignature = currentSaveSignature();
    completeAutosaveCycle();
    updateSaveMeta({ googleDriveLastSavedAt: now, lastBackupAt: now, localSaveActive: true });
    clearSaveFallbackWarning();
    updateGoogleDriveStatus(`Saved encrypted copy to Google Drive: ${saved.name || 'current save'}.`);
    if (announce) setLiveStatusMessage(`Saved encrypted copy to Google Drive: ${saved.name || 'current save'}.`);
    updateSaveSetupDismissed(true);
    updateSaveHealthPanel();
    await writeLocalBrowserSave({ reason: 'google-drive-mirror', announce: false, preparedSave, autosaveGeneration: options.autosaveGeneration });
    SharedDriveCollaborationV64.captureBaseDocument(preparedSave.document, saved.id || pageSettings().googleDriveFileId || '');
    SharedDriveCollaborationV64.applyDriveCapabilities(saved.capabilities || uiState.googleDriveCapabilities);
    await SharedDriveCollaborationV64.refreshCurrentUserAccess(false);
    return true;
  } catch (err) {
    if (!autosaveRequestStillCurrent(options)) return false;
    const fallbackMessage = `Google Drive save failed: ${err.message}. Saved an encrypted browser fallback for now. The warning will clear after the next successful Google Drive save.`;
    updateGoogleDriveStatus(`Google Drive save failed: ${err.message}`);
    await writeLocalBrowserSave({ reason: 'google-drive-fallback', announce: false, preserveFallbackWarning: true, preparedSave, autosaveGeneration: options.autosaveGeneration });
    setSaveFallbackWarning(fallbackMessage);
    if (announce || reason !== 'auto') {
      setLiveStatusMessage(fallbackMessage);
      WorkflowRecoveryV62.reportFailure({
        operation: 'Save to Google Drive',
        source: googleDriveCurrentSaveFileName(),
        error: err,
        dataChanged: false,
        snapshotCreated: false,
        remedy: 'The browser fallback remains available. Reconnect Google Drive, review any remote conflict, and retry the save.',
        retry: () => writeGoogleDriveSaveFile({ ...options, announce: true })
      });
    }
    updateSaveHealthPanel();
    return false;
  } finally {
    uiState.googleDriveBusy = false;
  }
}

function googleDriveFileSizeLabel(size) {
  const bytes = Number(size || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Size unavailable';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function nextBoundedPageToken(seenTokens, rawToken, completedPages, label, maximumPages = MAX_API_PAGES) {
  const token = String(rawToken || '');
  if (!token) return '';
  if (completedPages >= maximumPages) throw new Error(`${label} exceeded the ${maximumPages.toLocaleString()}-page safety limit.`);
  if (seenTokens.has(token)) throw new Error(`${label} returned a repeated pagination token.`);
  seenTokens.add(token);
  return token;
}

async function listGoogleDriveFilesForQuery(q) {
  const files = [];
  const seenPageTokens = new Set();
  let completedPages = 0;
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q,
      fields: 'nextPageToken,files(id,name,modifiedTime,createdTime,size,mimeType,parents,appProperties,webViewLink,version,md5Checksum,headRevisionId,ownedByMe,capabilities(canEdit,canShare,canTrash,canRename,canCopy),permissionIds)',
      spaces: 'drive',
      pageSize: '100',
      orderBy: 'modifiedTime desc'
    });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await googleDriveFetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, { method: 'GET' });
    const data = await response.json();
    if (Array.isArray(data.files)) files.push(...data.files);
    completedPages += 1;
    pageToken = nextBoundedPageToken(seenPageTokens, data.nextPageToken, completedPages, 'Google Drive file listing');
  } while (pageToken);
  return files;
}

async function listGoogleDriveSaveFiles() {
  await ensureGoogleDriveToken(true);
  const found = new Map();
  const appQuery = [
    'trashed = false',
    "mimeType = 'application/json'",
        `appProperties has { key='app' and value='${GOOGLE_DRIVE_APP_PROPERTY}' }`
  ].join(' and ');
  const appFiles = await listGoogleDriveFilesForQuery(appQuery);
  appFiles.forEach(file => {
    if (!file?.id) return;
    try {
      readSchemaCompatibility({
        dataSchemaVersion: file.appProperties?.dataSchemaVersion,
        minimumReaderSchemaVersion: file.appProperties?.minimumReaderSchemaVersion
      }, `Google Drive file ${file.name || file.id}`);
      found.set(file.id, file);
    } catch (error) {
       
    }
  });
  return Array.from(found.values()).sort((a, b) => String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || '')));
}

function renderGoogleDriveFileList() {
  const list = el('googleDriveFileList');
  const search = String(el('googleDriveFileSearch')?.value || '').trim().toLowerCase();
  const files = (uiState.googleDriveFiles || []).filter(file => !search || String(file.name || '').toLowerCase().includes(search));
  if (!list) return;
  list.innerHTML = '';
  if (!files.length) {
    const empty = document.createElement('div');
    empty.className = 'google-drive-file-empty';
    empty.textContent = (uiState.googleDriveFiles || []).length
      ? 'No available save matches this search.'
      : 'No schema-compatible encrypted Classroom Seating Planner saves were found. Connecting succeeded, but there is nothing this reader can safely open under the current Drive permission.';
    list.appendChild(empty);
    el('openGoogleDriveFileBtn').disabled = true;
    return;
  }
  files.forEach(file => {
    const row = document.createElement('label');
    row.className = `google-drive-file-row${uiState.googleDriveSelectedFileId === file.id ? ' selected' : ''}`;
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'googleDriveSaveFile';
    radio.value = file.id;
    radio.checked = uiState.googleDriveSelectedFileId === file.id;
    radio.setAttribute('aria-label', `Select ${file.name || 'Google Drive save'}`);
    const details = document.createElement('span');
    details.className = 'google-drive-file-details';
    const name = document.createElement('strong');
    name.textContent = file.name || 'Unnamed Google Drive save';
    const meta = document.createElement('span');
    const modified = file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : 'Unknown date';
    meta.textContent = `Modified ${modified} · ${googleDriveFileSizeLabel(file.size)}`;
    details.append(name, meta);
    const badge = document.createElement('span');
    badge.className = 'google-drive-file-badge';
    badge.textContent = file.appProperties?.kind === 'current-save' ? 'Current save' : 'Planner JSON';
    radio.addEventListener('change', () => {
      uiState.googleDriveSelectedFileId = file.id;
      renderGoogleDriveFileList();
      el('openGoogleDriveFileBtn').disabled = false;
    });
    row.append(radio, details, badge);
    list.appendChild(row);
  });
  el('openGoogleDriveFileBtn').disabled = !uiState.googleDriveSelectedFileId || !files.some(file => file.id === uiState.googleDriveSelectedFileId);
}

async function refreshGoogleDriveFileChooser() {
  const status = el('googleDriveFileStatus');
  const refresh = el('refreshGoogleDriveFilesBtn');
  const open = el('openGoogleDriveFileBtn');
  if (refresh) refresh.disabled = true;
  if (open) open.disabled = true;
  if (status) status.textContent = 'Connecting to Google Drive and listing available encrypted saves…';
  try {
    uiState.googleDriveFiles = await listGoogleDriveSaveFiles();
    const previous = uiState.googleDriveSelectedFileId;
    if (!uiState.googleDriveFiles.some(file => file.id === previous)) uiState.googleDriveSelectedFileId = uiState.googleDriveFiles[0]?.id || '';
    if (status) status.textContent = uiState.googleDriveFiles.length
      ? `${uiState.googleDriveFiles.length} available app-created save${uiState.googleDriveFiles.length === 1 ? '' : 's'} found. Choose the file to open.`
      : 'Google Drive connected successfully, but no app-created encrypted saves are available to this app.';
    updateGoogleDriveStatus('Connected to Google Drive. Choose an available save to load.');
    renderGoogleDriveFileList();
  } catch (err) {
    uiState.googleDriveFiles = [];
    uiState.googleDriveSelectedFileId = '';
    if (status) status.textContent = `Could not list Google Drive saves: ${err.message}`;
    renderGoogleDriveFileList();
  } finally {
    if (refresh) refresh.disabled = false;
  }
}

async function openGoogleDriveFileChooser(options = {}) {
  uiState.googleDriveChooserContext = { direct: !!options.direct, fromWelcome: !!options.fromWelcome };
  uiState.googleDriveSelectedFileId = '';
  const search = el('googleDriveFileSearch');
  if (search) search.value = '';
  el('googleDriveFileModal')?.classList.add('show');
  await refreshGoogleDriveFileChooser();
  return true;
}

function closeGoogleDriveFileChooser({ returnToWelcome = true } = {}) {
  el('googleDriveFileModal')?.classList.remove('show');
  const context = uiState.googleDriveChooserContext;
  uiState.googleDriveChooserContext = null;
  if (returnToWelcome && context?.fromWelcome && !uiState.appReady) openWelcomeSecurityModal();
}

async function loadGoogleDriveFileById(file, options = {}) {
  if (!file?.id) throw new Error('Choose a Google Drive save first.');
  if (!file.version || !file.modifiedTime || !file.headRevisionId) {
    try {
      const metadataResponse = await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?fields=id,name,modifiedTime,size,mimeType,webViewLink,version,md5Checksum,headRevisionId,capabilities(canEdit,canShare,canCopy),permissionIds`, { method: 'GET' });
      file = { ...file, ...(await metadataResponse.json()) };
    } catch (_) {   }
  }
  updateGoogleDriveStatus(`Downloading encrypted save from Google Drive: ${file.name || 'selected save'}...`);
  const response = await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, { method: 'GET' });
  assertImportByteLengthWithinLimits(file.size, `Google Drive save ${file.name || ''}`.trim(), IMPORT_LIMITS.saveBytes);
  const text = await readResponseTextWithinLimits(response, `Google Drive save ${file.name || ''}`.trim(), IMPORT_LIMITS.saveBytes);
  const viewerHandled = await SharedDriveCollaborationV64.tryOpenEncryptedViewerPayload(text, file);
  if (viewerHandled) {
    SharedDriveCollaborationV64.applyDriveCapabilities(file.capabilities || null);
    return true;
  }
  if (options.fromWelcome) {
    closeGoogleDriveFileChooser({ returnToWelcome: false });
    closeWelcomeSecurityModal();
  }
  let loadedDriveDocument = null;
  if (options.direct) loadedDriveDocument = await importStateDirectFromText(text, `Google Drive save ${file.name || ''}`.trim());
  else await importStateFromText(text, `Google Drive save ${file.name || ''}`.trim());
  SharedDriveCollaborationV64.applyDriveCapabilities(file.capabilities || null);
  await SharedDriveCollaborationV64.refreshCurrentUserAccess(false);
  updateGoogleDriveSettings({
    preferredStorage: 'googleDrive',
    googleDriveFileId: file.id,
    googleDriveFileName: file.name || '',
    googleDriveLastSavedAt: file.modifiedTime || pageSettings().googleDriveLastSavedAt || '',
    googleDriveFileVersion: String(file.version || ''),
    googleDriveHeadRevisionId: String(file.headRevisionId || ''),
    googleDriveRemoteMd5: String(file.md5Checksum || '')
  });
  clearSaveFallbackWarning();
  updateGoogleDriveStatus(options.direct ? `Loaded Google Drive save: ${file.name || 'selected save'}.` : `Restore options opened for Google Drive save: ${file.name || 'selected save'}.`);
  setLiveStatusMessage(options.direct ? `Google Drive save loaded: ${file.name || 'selected save'}.` : 'Google Drive save downloaded. Choose what to restore.');
  updateSaveSetupDismissed(true);
  updateSaveHealthPanel();
  if (loadedDriveDocument) SharedDriveCollaborationV64.captureBaseDocument(loadedDriveDocument, file.id);
  else SharedDriveCollaborationV64.captureBaseFromCurrent(file.id);
  if (options.fromWelcome && options.direct) {
    if (typeof StartupRecoveryV45 !== 'undefined') StartupRecoveryV45.completeExternalLoad();
    safeStorageSet('localStorage', WELCOME_SETUP_STORAGE_KEY, 'true');
    uiState.appReady = true;
    uiState.linkedSaveLastSignature = currentSaveSignature();
    await ensureAppSnapshotsLoaded({ force: true });
    await writeLocalBrowserSave({ reason: 'google-drive-load', announce: false, skipDurablePrompt: true });
  }
  return true;
}

async function openSelectedGoogleDriveFile() {
  const context = uiState.googleDriveChooserContext || {};
  const file = (uiState.googleDriveFiles || []).find(item => item.id === uiState.googleDriveSelectedFileId);
  if (!file) return false;
  const button = el('openGoogleDriveFileBtn');
  if (button) button.disabled = true;
  try {
    return await loadGoogleDriveFileById(file, context);
  } catch (err) {
    updateGoogleDriveStatus(`Google Drive load failed: ${err.message}`);
    setLiveStatusMessage(`Google Drive load failed: ${err.message}`);
    if (context.fromWelcome) {
      closeGoogleDriveFileChooser({ returnToWelcome: false });
      openWelcomeSecurityModal();
      showWelcomeSecurityError(err.message === 'Encrypted load canceled.'
        ? 'Google Drive loading was canceled. Choose Open from Google Drive to try again, or open another backup.'
        : `Could not load the selected Google Drive save: ${err.message}`);
    } else {
      const status = el('googleDriveFileStatus');
      if (status) status.textContent = `Could not load the selected file: ${err.message}`;
    }
    if (err.message !== 'Encrypted load canceled.') {
      WorkflowRecoveryV62.reportFailure({
        operation: 'Load Google Drive Save',
        source: file.name || file.id,
        error: err,
        dataChanged: false,
        snapshotCreated: false,
        remedy: 'Reconnect Google Drive, confirm access to the file, and enter the matching encryption password. A canceled password prompt is not treated as data loss.',
        retry: () => loadGoogleDriveFileById(file, context)
      });
    }
    return false;
  } finally {
    if (button && el('googleDriveFileModal')?.classList.contains('show')) button.disabled = false;
  }
}


async function loadFromGoogleDriveFile(options = {}) {
  if (options.fileId) {
    const file = options.file || { id: options.fileId, name: options.fileName || 'Google Drive save' };
    try { return await loadGoogleDriveFileById(file, options); }
    catch (err) {
      updateGoogleDriveStatus(`Google Drive load failed: ${err.message}`);
      setLiveStatusMessage(`Google Drive load failed: ${err.message}`);
      if (err.message !== 'Encrypted load canceled.') {
        WorkflowRecoveryV62.reportFailure({
          operation: 'Load Linked Google Drive Save',
          source: file.name || file.id,
          error: err,
          dataChanged: false,
          snapshotCreated: false,
          remedy: 'Reconnect Google Drive, verify the linked file still exists, and retry with the matching encryption password.',
          retry: () => loadGoogleDriveFileById(file, options)
        });
      }
      return false;
    }
  }
  if (options.skipConfirm || options.fromWelcome) return openGoogleDriveFileChooser(options);
  showInAppConfirm('Connect to Google Drive and choose which encrypted save to load. The app will not automatically select the newest file.', () => {
    void openGoogleDriveFileChooser(options);
  }, {
    title: 'Choose a Google Drive Save',
    confirmText: 'Connect and Choose File',
    cancelText: 'Cancel'
  });
  return true;
}

function forgetGoogleDriveLink() {
  const tokenToRevoke = uiState.googleDriveAccessToken;
  if (tokenToRevoke && window.google?.accounts?.oauth2?.revoke) {
    try { window.google.accounts.oauth2.revoke(tokenToRevoke, () => {}); }
    catch (err) {   }
  }
  uiState.googleDriveAccessToken = '';
  uiState.googleDriveTokenExpiresAt = 0;
  uiState.googleDriveTokenClient = null;
  clearGoogleDriveTokenSession();
  safeStorageRemove('sessionStorage', GOOGLE_DRIVE_USER_SESSION_KEY);
  uiState.googleDriveUser = null;
  SharedDriveCollaborationV64.applyInterfacePolicy(null, '');
  updateGoogleDriveSettings({
    preferredStorage: pageSettings().preferredStorage === 'googleDrive' ? 'browser' : pageSettings().preferredStorage,
    googleDriveFolderId: '',
    googleDriveFileId: '',
    googleDriveFileName: '',
    googleDriveLastSavedAt: ''
  });
  clearSaveFallbackWarning();
  updateGoogleDriveStatus('Google Drive disconnected. Existing Drive files were not deleted.');
  setLiveStatusMessage('Google Drive link forgotten. Existing Drive files were not deleted.');
  void writeLocalBrowserSave({ reason: 'settings', announce: false });
}

async function writeLinkedSaveFile(options = {}) {
  if (!autosaveRequestStillCurrent(options)) return false;
  if (!CrossTabCoordinator.canWrite({ announce: options.announce !== false })) return false;
  const reason = options.reason || 'manual';
  const announce = options.announce !== false;
  if (pageSettings().preferredStorage === 'googleDrive' && googleDriveConfigured()) return writeGoogleDriveSaveFile(options);
  if (!uiState.linkedSaveHandle) {
    if (reason === 'auto') return writeLocalBrowserSave({ reason: 'auto', announce: false, autosaveGeneration: options.autosaveGeneration });
    const proceed = await offerEncryptionBeforeFirstSave();
    if (!proceed) return false;
    if (!linkedSaveApiSupported()) return writeLocalBrowserSave({ reason: 'manual', announce: true });
    const picked = await chooseLinkedSaveFile();
    if (!picked) return writeLocalBrowserSave({ reason: 'manual', announce: true });
  }
  if (uiState.linkedSaveBusy) {
    uiState.linkedSavePending = true;
    return false;
  }
  uiState.linkedSaveBusy = true;
  let preparedSave = null;
  document.body.classList.add('linked-save-busy');
  updateSaveHealthPanel('Saving linked file...');
  try {
    const allowed = await ensureLinkedSavePermission(uiState.linkedSaveHandle, 'readwrite');
    if (!allowed) throw new Error('Permission to write this linked file was not granted.');
    if (!options.forceOverwrite && await ModernizationSuite.linkedFileConflict(uiState.linkedSaveHandle)) {
      uiState.linkedSaveBusy = false;
      document.body.classList.remove('linked-save-busy');
      return ModernizationSuite.saveConflict('The linked save file changed outside this tab after it was opened. Review or preserve both versions before replacing it.', {
        overwrite: () => writeLinkedSaveFile({ ...options, forceOverwrite: true, announce: true }),
        copy: async () => { await forgetLinkedSaveFile(); await chooseLinkedSaveFile(); },
        cancel: () => setLiveStatusMessage('Linked-file save canceled. The external version was not overwritten.')
      });
    }
    preparedSave = await prepareExportPayload('all');
    if (!autosaveRequestStillCurrent(options)) return false;
    const writable = await uiState.linkedSaveHandle.createWritable();
    await writable.write(new Blob([preparedSave.payload], { type: 'application/json' }));
    await writable.close();
    if (!autosaveRequestStillCurrent(options)) return false;
    commitPreparedSave(preparedSave);
    try { uiState.linkedFileLastModified = Number((await uiState.linkedSaveHandle.getFile()).lastModified || Date.now()); }
    catch (err) { uiState.linkedFileLastModified = Date.now(); }
    const now = new Date().toISOString();
    uiState.linkedSaveFileName = uiState.linkedSaveHandle.name || uiState.linkedSaveFileName || 'Linked save file';
    uiState.linkedSaveLastSignature = currentSaveSignature();
    completeAutosaveCycle();
    uiState.linkedSaveStatus = reason === 'auto' ? 'Auto-saved to linked file.' : 'Saved to linked file.';
    clearSaveFallbackWarning();
    updateSaveMeta({ linkedFileName: uiState.linkedSaveFileName, linkedLastSavedAt: now });
    if (announce) setLiveStatusMessage(reason === 'auto' ? 'Auto-saved to linked file.' : `Saved to linked file: ${uiState.linkedSaveFileName}.`);
    updateSaveSetupDismissed(true);
    updateSaveHealthPanel();
    return true;
  } catch (err) {
    uiState.linkedSaveStatus = `Linked save failed: ${err.message}`;
    const fallbackMessage = `Linked save failed: ${err.message}. Saved an encrypted browser fallback for now. The warning will clear after the next successful linked-file save.`;
    await writeLocalBrowserSave({ reason: 'linked-file-fallback', announce: false, preserveFallbackWarning: true, preparedSave, autosaveGeneration: options.autosaveGeneration });
    setSaveFallbackWarning(fallbackMessage);
    if (announce || reason !== 'auto') setLiveStatusMessage(fallbackMessage);
    updateSaveHealthPanel();
    return false;
  } finally {
    uiState.linkedSaveBusy = false;
    document.body.classList.remove('linked-save-busy');
    if (uiState.linkedSavePending) {
      uiState.linkedSavePending = false;
      scheduleLinkedAutoSave('pending-save');
    }
  }
}

async function loadFromLinkedSaveFile() {
  let handle = uiState.linkedSaveHandle;
  if (!handle) handle = await chooseLinkedLoadFile();
  if (!handle) return false;
  const load = async () => {
    try {
      const allowed = await ensureLinkedSavePermission(handle, 'read');
      if (!allowed) throw new Error('Permission to read this linked file was not granted.');
      const file = await handle.getFile();
      const text = await readTextFileWithinLimits(file, 'linked save file', IMPORT_LIMITS.saveBytes);
      await importStateFromText(text, 'linked save file');
      await setLinkedSaveHandle(handle);
      uiState.linkedSaveStatus = `Restore options opened for ${handle.name || 'linked save file'}.`;
      updateSaveMeta({ linkedFileName: handle.name || '' });
      updateSaveSetupDismissed(true);
      updateSaveHealthPanel();
      setLiveStatusMessage(`Review restore options for ${handle.name || 'selected file'}.`);
      return true;
    } catch (err) {
      setLiveStatusMessage(`Could not load linked file: ${err.message}`);
      uiState.linkedSaveStatus = `Linked load failed: ${err.message}`;
      updateSaveHealthPanel();
      return false;
    }
  };
  showInAppConfirm('Load from the linked save file? You will choose whether to restore everything or only selected parts of the file.', () => { load(); }, {
    title: 'Load Linked File?',
    confirmText: 'Review Restore Options',
    cancelText: 'Cancel'
  });
  return true;
}

async function writeLocalBrowserSave(options = {}) {
  if (!autosaveRequestStillCurrent(options)) return false;
  if (!CrossTabCoordinator.canWrite({ announce: options.announce !== false })) return false;
  const saveEpoch = uiState.browserSaveEpoch;
  const reason = options.reason || 'auto';
  const announce = options.announce === true;
  if (uiState.startupRecoveryPending) {
    if (announce) setLiveStatusMessage('The encrypted browser save is still locked. Unlock it or choose Start Fresh before saving new data.');
    return false;
  }
  try {
    const preparedSave = options.preparedSave || await prepareExportPayload('all');
    if (!autosaveRequestStillCurrent(options) || saveEpoch !== uiState.browserSaveEpoch) return false;
    if (!await BrowserDataStore.setPrimarySave(preparedSave.payload)) throw new Error('Browser storage is unavailable or full. No local save was written. Choose a linked file, Google Drive, or download a backup.');
    if (!autosaveRequestStillCurrent(options) || saveEpoch !== uiState.browserSaveEpoch) return false;
    commitPreparedSave(preparedSave);
    const now = new Date().toISOString();
    uiState.linkedSaveLastSignature = currentSaveSignature();
    completeAutosaveCycle();
    updateSaveMeta({ localLastSavedAt: now, localSaveActive: true, linkedLastSavedAt: saveMeta().linkedLastSavedAt || '' });
    if (reason === 'auto') await createAutosaveSnapshot('Auto snapshot');
    if (!options.preserveFallbackWarning && !String(reason).includes('fallback')) clearSaveFallbackWarning();
    if (announce) setLiveStatusMessage('Saved to browser local storage. Choose a real save file for safer long-term storage.');
    updateSaveHealthPanel();
    if (!options.skipDurablePrompt && !String(reason).includes('fallback') && !['google-drive-mirror','settings','google-drive-settings','welcome','security-wizard','security-setup'].includes(reason)) maybePromptDurableSaveAfterLocalChanges();
    return true;
  } catch (err) {
    if (reason !== 'auto' && reason !== 'welcome' && !noteEncryptionSessionIsConfigured() && String(err.message || '').toLowerCase().includes('encryption')) {
      if (hasSensitiveStudentNotes()) warnSensitiveNotesNeedEncryption();
    }
    if (announce) setLiveStatusMessage(`Local browser save failed: ${err.message}`);
    updateSaveHealthPanel(`Local browser save failed: ${err.message}`);
    return false;
  }
}

function noteLocalOnlyChange() {
  const meta = saveMeta();
  const nextCount = Number(meta.localOnlyChangeCount || 0) + 1;
  updateSaveMeta({ localOnlyChangeCount: nextCount, localSaveActive: true });
  return nextCount;
}

function lastDurableSavePromptTime(meta = saveMeta()) {
  const storedMs = Number(meta.localSavePromptLastAtMs || 0);
  const storedIsoMs = Date.parse(meta.localSavePromptLastAt || '');
  const sessionMs = Number(safeStorageGet('sessionStorage', LOCAL_DURABLE_SAVE_PROMPT_SESSION_KEY) || 0);
  return Math.max(
        Number.isFinite(storedMs) ? storedMs : 0,
        Number.isFinite(storedIsoMs) ? storedIsoMs : 0,
        Number.isFinite(sessionMs) ? sessionMs : 0,
        Number(uiState.lastDurableSavePromptAt || 0)
  );
}

function durableSavePromptIsThrottled(meta = saveMeta(), now = Date.now()) {
  const lastShownAt = lastDurableSavePromptTime(meta);
  return lastShownAt > 0 && (now - lastShownAt) < LOCAL_DURABLE_SAVE_PROMPT_MIN_MS;
}

function markDurableSavePromptShown(count, now = Date.now()) {
  uiState.lastDurableSavePromptAt = now;
  safeStorageSet('sessionStorage', LOCAL_DURABLE_SAVE_PROMPT_SESSION_KEY, String(now));
  updateSaveMeta({
    localSavePromptCount: count,
    localSavePromptLastAt: new Date(now).toISOString(),
    localSavePromptLastAtMs: now
  });
}

function maybePromptDurableSaveAfterLocalChanges() {
  if (uiState.linkedSaveHandle || (pageSettings().preferredStorage === 'googleDrive' && googleDriveStorageConnected()) || appIsEmbeddedFrame()) return;
  if (uiState.durableSavePromptActive) return;
  const confirmModal = el('confirmModal');
  if (confirmModal?.classList.contains('show')) return;
  const meta = saveMeta();
  const count = Number(meta.localOnlyChangeCount || 0);
  const lastPrompt = Number(meta.localSavePromptCount || 0);
  if (count < 8 || count === lastPrompt) return;
  const now = Date.now();
  if (durableSavePromptIsThrottled(meta, now)) return;
  uiState.durableSavePromptActive = true;
  markDurableSavePromptShown(count, now);
  showInAppConfirm('You have made several changes that are only being auto-saved inside this browser. Browser local storage can be cleared by browser settings, device cleanup, profile changes, or using another device. Choose a real save file for safer storage, and set an encryption key if you use Private or Substitute notes.', async () => {
    uiState.durableSavePromptActive = false;
    const proceed = await offerEncryptionBeforeFirstSave();
    if (proceed) await chooseLinkedSaveFile();
  }, {
    title: 'Create a Safer Save File?',
    confirmText: 'Choose Save File',
    cancelText: 'Keep Browser Save',
    onCancel: () => { uiState.durableSavePromptActive = false; }
  });
}

function clearAutosaveSchedule({ keepDirty = false, invalidateInFlight = true } = {}) {
  if (invalidateInFlight) {
    uiState.autosaveGeneration = Number(uiState.autosaveGeneration || 0) + 1;
    uiState.browserSaveEpoch = Number(uiState.browserSaveEpoch || 0) + 1;
  }
  clearTimeout(uiState.linkedSaveAutoTimer);
  clearTimeout(uiState.linkedSaveMaxTimer);
  uiState.linkedSaveAutoTimer = null;
  uiState.linkedSaveMaxTimer = null;
  if (!keepDirty) uiState.autosaveDirtySince = 0;
}

function completeAutosaveCycle() {
  clearAutosaveSchedule({ invalidateInFlight: false });
  uiState.autosaveInProgress = false;
}

function autosaveRequestStillCurrent(options = {}) {
  const expectedGeneration = Number(options.autosaveGeneration);
  if (!Number.isFinite(expectedGeneration)) return true;
  return expectedGeneration === Number(uiState.autosaveGeneration || 0)
    && uiState.appReady
    && !uiState.pageLocked
    && !uiState.startupRecoveryPending;
}

async function runScheduledAutoSave(trigger = 'idle') {
  if (uiState.autosaveInProgress || !uiState.appReady || uiState.pageLocked || uiState.startupRecoveryPending) return false;
  const currentSignature = currentSaveSignature();
  if (currentSignature === uiState.linkedSaveLastSignature) {
    completeAutosaveCycle();
    return true;
  }
  uiState.autosaveInProgress = true;
  const autosaveGeneration = Number(uiState.autosaveGeneration || 0);
  clearTimeout(uiState.linkedSaveAutoTimer);
  clearTimeout(uiState.linkedSaveMaxTimer);
  uiState.linkedSaveAutoTimer = null;
  uiState.linkedSaveMaxTimer = null;
  let saved = false;
  try {
    if (pageSettings().preferredStorage === 'googleDrive' && googleDriveConfigured()) saved = await writeGoogleDriveSaveFile({ reason: 'auto', announce: false, autosaveTrigger: trigger, autosaveGeneration });
    else if (uiState.linkedSaveHandle) saved = await writeLinkedSaveFile({ reason: 'auto', announce: false, autosaveTrigger: trigger, autosaveGeneration });
    else saved = await writeLocalBrowserSave({ reason: 'auto', announce: false, autosaveTrigger: trigger, autosaveGeneration });
    return saved;
  } finally {
    uiState.autosaveInProgress = false;
    if (currentSaveSignature() !== uiState.linkedSaveLastSignature) {
      uiState.autosaveDirtySince = uiState.autosaveDirtySince || Date.now();
      scheduleLinkedAutoSave('retry');
    }
  }
}

function scheduleLinkedAutoSave(reason = 'change') {
  if (!uiState.appReady || uiState.pageLocked || uiState.startupRecoveryPending) return;
  const minutes = Number(pageSettings().autoSaveMinutes || 0);
  if (!minutes || minutes < 1) {
    clearAutosaveSchedule();
    return;
  }
  const now = Date.now();
  const maxWaitMs = Math.max(10000, minutes * 60 * 1000);
  const idleWaitMs = Math.min(5000, maxWaitMs);
  if (!uiState.autosaveDirtySince) {
    const sig = currentSaveSignature();
    if (sig === uiState.linkedSaveLastSignature) {
      clearAutosaveSchedule();
      return;
    }
    uiState.autosaveDirtySince = now;
    clearTimeout(uiState.linkedSaveMaxTimer);
    uiState.linkedSaveMaxTimer = setTimeout(() => { void runScheduledAutoSave('maximum-wait'); }, maxWaitMs);
  }
  clearTimeout(uiState.linkedSaveAutoTimer);
  uiState.linkedSaveAutoTimer = setTimeout(() => { void runScheduledAutoSave('idle'); }, idleWaitMs);
  const reasonLabel = reason === 'settings' ? 'settings change' : reason === 'pending-save' ? 'pending save' : reason === 'retry' ? 'unsaved change retry' : 'change';
  const deadlineAt = new Date(uiState.autosaveDirtySince + maxWaitMs);
  const deadlineText = deadlineAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  if (pageSettings().preferredStorage === 'googleDrive' && googleDriveConfigured()) {
    uiState.linkedSaveStatus = `Unsaved ${reasonLabel}; Google Drive save will run after 5 seconds of inactivity and no later than ${deadlineText}.`;
    updateGoogleDriveStatus(uiState.linkedSaveStatus);
  } else if (uiState.linkedSaveHandle) {
    uiState.linkedSaveStatus = `Unsaved ${reasonLabel}; linked-file save will run after 5 seconds of inactivity and no later than ${deadlineText}.`;
  } else {
    uiState.linkedSaveStatus = `Unsaved ${reasonLabel}; browser save will run after 5 seconds of inactivity and no later than ${deadlineText}.`;
    noteLocalOnlyChange();
  }
  updateSaveHealthPanel();
}

function updateSaveSetupDismissed(value) {
  safeStorageSet('localStorage', SAVE_SETUP_STORAGE_KEY, value ? 'true' : 'false');
}

function openSaveSetupModal() {
  updatePageSettingsForm();
  updateGoogleDriveStatus();
  renderSaveHealthPanel();
  const modal = el('saveSetupModal');
  if (!modal) return;
  const status = el('saveSetupStatus');
  if (status) status.textContent = linkedSaveApiSupported()
    ? 'Choose exactly what to download or restore. Student data downloads encrypt automatically when an encryption key is available.'
    : 'Linked file saving is not available in this browser. Use downloads/uploads from this panel instead.';
  modal.classList.add('show');
}

function closeSaveSetupModal(dismiss = false) {
  el('saveSetupModal')?.classList.remove('show');
  if (dismiss) updateSaveSetupDismissed(true);
}

function renderSaveHealthPanel(statusOverride = '') {
  updateSaveHealthPanel(statusOverride);
}

function updateSaveHealthPanel(statusOverride = '') {
  const meta = saveMeta();
  const linked = !!uiState.linkedSaveHandle;
  const googleDrivePreferred = pageSettings().preferredStorage === 'googleDrive' && googleDriveConfigured();
  const googleDriveConnected = googleDriveStorageConnected();
  const supported = linkedSaveApiSupported();
  const localActive = !!meta.localSaveActive || !!safeStorageGet('localStorage', STORAGE_KEY);
  const methodNode = el('saveHealthMethod');
  const fileNode = el('saveHealthFile');
  const linkedNode = el('saveHealthLastLinked');
  const backupNode = el('saveHealthLastBackup');
  const encryptionNode = el('saveHealthEncryption');
  const statusNode = el('saveHealthLinkedStatus');
  const googleNode = el('saveHealthGoogleDriveStatus');
  if (methodNode) {
    const cls = googleDrivePreferred ? (googleDriveConnected ? 'good' : 'warn') : linked ? 'good' : supported ? 'warn' : 'bad';
    const text = googleDrivePreferred ? (googleDriveConnected ? 'Google Drive' : 'Google Drive needs sign-in') : linked ? 'Linked file' : localActive ? 'Browser local autosave' : supported ? 'No linked file yet' : 'Browser local autosave';
    methodNode.innerHTML = `<span class="save-method-badge ${cls}">${escapeHtml(text)}</span>`;
  }
  if (fileNode) fileNode.textContent = googleDrivePreferred ? (pageSettings().googleDriveFileName || pageSettings().googleDriveFolderName || 'Google Drive app folder') : linked ? (uiState.linkedSaveFileName || meta.linkedFileName || 'Linked save file') : 'Browser local save is active by default.';
  if (linkedNode) linkedNode.textContent = googleDrivePreferred ? formatSaveDate(pageSettings().googleDriveLastSavedAt || meta.googleDriveLastSavedAt) : linked ? formatSaveDate(meta.linkedLastSavedAt) : formatSaveDate(meta.localLastSavedAt);
  if (backupNode) backupNode.textContent = formatSaveDate(meta.lastBackupAt || meta.lastPackageAt);
  if (encryptionNode) encryptionNode.textContent = currentSessionEncryptionKey()
    ? 'Full-save encryption ready. Local saves, linked saves, downloads, snapshots, settings, roster data, notes, groups, zones, and room data will be encrypted.'
    : safeStorageGet('sessionStorage', PAGE_LOCK_WRAPPED_KEY_SESSION_KEY) || safeStorageGet('sessionStorage', VISIBILITY_WRAPPED_KEY_SESSION_KEY)
          ? 'Encryption key is wrapped while locked/presentation mode is active. Unlock or exit presentation mode to restore it.'
          : hasSensitiveStudentNotes()
            ? 'Private or Substitute notes exist. Set the session encryption password before saving or downloading.'
            : 'Encryption password is not set. Secure save/export is blocked until a session password is active.';
  if (googleNode) googleNode.textContent = googleDriveConnected ? (uiState.googleDriveStatus || `Connected folder: ${pageSettings().googleDriveFolderName || APP_CONFIG.googleDriveFolderName}.`) : googleDriveConfigured() ? (uiState.googleDriveStatus || 'Not connected. Use Connect Google Drive to authorize encrypted Drive storage.') : 'Google Drive is not configured for this build.';
  if (statusNode) statusNode.textContent = statusOverride || (googleDrivePreferred ? (uiState.googleDriveStatus || 'Google Drive is selected.') : uiState.linkedSaveStatus) || (linked ? 'Ready.' : 'Browser local autosave is active. Choose a save file for safer long-term storage.');
  const auto = el('settingAutoSaveMinutes');
  if (auto && String(auto.value) !== String(pageSettings().autoSaveMinutes || 0)) auto.value = pageSettings().autoSaveMinutes || 0;
  const inline = el('inlineSaveStatus');
  if (inline) {
    const hasDurableSave = googleDrivePreferred || linked || !!meta.linkedFileName;
    const last = googleDrivePreferred
      ? (pageSettings().googleDriveLastSavedAt || meta.googleDriveLastSavedAt || '')
      : hasDurableSave
            ? (meta.linkedLastSavedAt || '')
            : (meta.localLastSavedAt || '');
    inline.hidden = false;
    inline.classList.toggle('durable', !!hasDurableSave);
    inline.classList.toggle('browser-only', !hasDurableSave && !!localActive);
    inline.classList.toggle('needs-attention', !hasDurableSave && !localActive);
    if (hasDurableSave) {
      inline.textContent = last ? `Saved • ${formatSaveDate(last)}` : `Save ready`;
      inline.title = googleDrivePreferred
        ? `Saved to Google Drive. Folder: ${pageSettings().googleDriveFolderName || 'Classroom Seating Planner Saves'}. Select to review save options.`
        : `Linked save file: ${uiState.linkedSaveFileName || meta.linkedFileName || 'selected'}. Select to review save options.`;
    } else if (localActive) {
      inline.textContent = last ? `Browser autosave • ${formatSaveDate(last)}` : 'Browser autosave';
      inline.title = 'Saved in this browser only. Select to choose a linked file, Google Drive, or a downloadable backup.';
    } else {
      inline.textContent = 'Not saved';
      inline.title = 'No completed save was found. Select to review save options.';
    }
  }
  const menuStatus = el('saveMenuStatus');
  if (menuStatus) menuStatus.textContent = googleDrivePreferred ? `Using: Google Drive • ${pageSettings().googleDriveFileName || pageSettings().googleDriveFolderName || 'configured'} • Last save: ${formatSaveDate(pageSettings().googleDriveLastSavedAt || meta.googleDriveLastSavedAt)}` : linked ? `Using: ${uiState.linkedSaveFileName || meta.linkedFileName || 'Linked save file'} • Last save: ${formatSaveDate(meta.linkedLastSavedAt)}` : `Browser local autosave active • Last save: ${formatSaveDate(meta.localLastSavedAt)}`;
  updateLocalSaveBanner();
  updateSecurityStatusPanel();
}

function storageEnvelopeEncrypted(storageKey) {
  try {
    const parsed = JSON.parse(safeStorageGet('localStorage', storageKey) || 'null');
    return !!(parsed && ((parsed.encrypted && parsed.encryption && parsed.encryption.ciphertext) || (parsed.indexedDb && parsed.encrypted)));
  } catch (err) {
    return false;
  }
}

function setSecurityStatus(id, ok, goodText, badText, warn = false) {
  const node = el(id);
  if (!node) return;
  node.textContent = ok ? goodText : badText;
  node.classList.toggle('good', !!ok && !warn);
  node.classList.toggle('warn', !!warn || !ok);
  node.classList.toggle('bad', !ok && !warn);
}

function updateSecurityStatusPanelCore() {
  const activeKey = !!currentSessionEncryptionKey();
  const wrappedKey = !!(safeStorageGet('sessionStorage', PAGE_LOCK_WRAPPED_KEY_SESSION_KEY) || safeStorageGet('sessionStorage', VISIBILITY_WRAPPED_KEY_SESSION_KEY));
  const saveEncrypted = storageEnvelopeEncrypted(STORAGE_KEY);
  const snapshotRaw = safeStorageGet('localStorage', LOCAL_AUTOSAVE_SNAPSHOT_KEY);
  const snapshotsEncrypted = !snapshotRaw || snapshotRaw === '[]' || snapshotIndexStorageIsEncrypted();
  const settingsProtected = (pageSettings().settingsAccessMethod || 'auto') !== 'none';
  setSecurityStatus('securityStatusActiveKey', activeKey, 'Present', wrappedKey ? 'Wrapped while locked/presentation mode' : 'Missing', wrappedKey);
  setSecurityStatus('securityStatusStorageEncrypted', saveEncrypted && snapshotsEncrypted, 'Encrypted', saveEncrypted ? 'Snapshot index not encrypted' : 'Local save missing/not encrypted', saveEncrypted && !snapshotsEncrypted);
  setSecurityStatus('securityStatusSettingsProtected', settingsProtected, 'Protected', 'Not protected');
  setSecurityStatus('securityStatusLockPin', !!getLockCredential(), 'Set', 'Not set');
  setSecurityStatus('securityStatusEyePin', !!getVisibilityCredential(), 'Set', 'Not set');
}

function updateLocalSaveBanner() {
  const banner = el('localSaveBanner');
  if (!banner) return;
  const warning = String(uiState.saveFallbackWarning || '').trim();
  if (!warning) uiState.dismissedSaveFallbackWarning = '';
  const dismissed = warning && uiState.dismissedSaveFallbackWarning === warning;
  const show = !document.body.classList.contains('print-preview-active') && !!warning && !dismissed;
  document.body.classList.toggle('local-save-warning-visible', show);
  banner.classList.toggle('fallback-warning', !!warning);
  banner.hidden = !show;
  const textNode = el('localSaveBannerText');
  if (textNode) textNode.textContent = warning || 'The latest save could not be completed.';
}

function backupFilename(kind = 'backup', extension = 'json') {
  const stamp = new Date().toISOString().replace(/[:]/g, '-').slice(0, 19);
  return `seating-chart-${kind}-${stamp}.${extension}`;
}

function triggerBlobDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
   
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function utf8Bytes(value) {
  return new TextEncoder().encode(String(value ?? ''));
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach(part => { out.set(part, offset); offset += part.length; });
  return out;
}

function le16(value) {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value & 0xffff, true);
  return out;
}

function le32(value) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
}

