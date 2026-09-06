import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const write = (file, value) => fs.writeFileSync(file, value, 'utf8');
const replaceRequired = (text, before, after, label) => {
  if (!text.includes(before)) throw new Error(`Missing expected ${label}`);
  return text.replace(before, after);
};

// README / GitHub landing page.
let readme = read('README.md');
readme = replaceRequired(
  readme,
  '![Version](https://img.shields.io/badge/version-7.2.0-2563eb?style=flat-square)',
  '![Version](https://img.shields.io/badge/version-7.2.1-2563eb?style=flat-square)',
  'README version badge'
);
if (!readme.includes('### V7.2.1 current production release')) {
  readme = replaceRequired(
    readme,
    '### V7.2.0 Planner Packs',
    `### V7.2.1 current production release\n\nV7.2.1 is the active hosted and portable production baseline. It keeps the V7.2 Planner Packs feature set and adds the completed code-audit/UI-repair pass, including autosave path repairs, Digital Twin Freeform-mode repair, current Google Picker/Classroom globals, cleaned modal compatibility code, refreshed documentation, and a regenerated portable build. This is the last 7.x baseline with a recorded full desktop/mobile regression pass before later experimental work was archived.\n\n### V7.2.0 Planner Packs`,
    'README V7.2 section'
  );
}
readme = readme.replace('Ordered JavaScript modules: `src/scripts/` (38 modules in V7.2)', 'Ordered JavaScript modules: `src/scripts/` (38 modules in V7.2.1)');
readme = readme.replace(
  '`npm run build` assembles the portable HTML from the committed modular source. CI validates release structure, schema/service-worker behavior, build parity, and desktop/mobile browser regression coverage.\n\nThe legacy `npm run migrate:monolith-to-src` command exists for one-way migration/recovery and is not part of normal development.',
  '`npm run build` assembles the portable HTML from the committed modular source. Normal CI validates the deterministic V7.2.1 build, generated-file parity, schemas, and service-worker syntax in seconds. The complete Playwright desktop/mobile regression suite remains available through the scheduled/manual **Full browser regression** workflow and `npm run test:browser`.'
);
write('README.md', readme);

// Changelog: make the current release the first entry and normalize its heading.
let changelog = read('CHANGELOG.md');
const v720Start = changelog.indexOf('## 7.2.0 - 2026-09-05');
const v721Start = changelog.indexOf('## V7.2.1 - Code audit and maintenance');
const v710Start = changelog.indexOf('## 7.1.0 - 2026-09-05');
if (v720Start !== 0 || v721Start < 0 || v710Start < 0 || !(v720Start < v721Start && v721Start < v710Start)) {
  throw new Error('Unexpected CHANGELOG V7.2 ordering.');
}
const v720 = changelog.slice(v720Start, v721Start).trimEnd();
let v721 = changelog.slice(v721Start, v710Start).trimEnd();
v721 = v721.replace('## V7.2.1 - Code audit and maintenance', '## 7.2.1 - 2026-09-05\n\n### Code audit and maintenance');
changelog = `${v721}\n\n${v720}\n\n${changelog.slice(v710Start)}`;
write('CHANGELOG.md', changelog);

let security = read('SECURITY.md');
security = replaceRequired(
  security,
  'Security fixes target the current hosted release and the newest portable release.',
  'Security fixes target V7.2.1, the current hosted and portable production release. Later experimental branches are not the production support baseline unless explicitly promoted.',
  'security supported-version text'
);
write('SECURITY.md', security);

let assistantDoc = read('docs/PLANNER-ASSISTANT.md');
if (!assistantDoc.includes('Applies to the current V7.2.1 production release.')) {
  assistantDoc = assistantDoc.replace('# Planner Assistant\n\n', '# Planner Assistant\n\n**Applies to the current V7.2.1 production release.** The Planner Assistant was introduced in V7.1.0 and is retained in V7.2.1.\n\n');
}
write('docs/PLANNER-ASSISTANT.md', assistantDoc);

let handling = read('DATA-HANDLING.md');
handling = handling.replace('V7.1.0 stores up to 20 recent Planner Assistant commands per class', 'The V7.2.1 production release retains the V7.1 Planner Assistant behavior and stores up to 20 recent Planner Assistant commands per class');
handling = handling.replace('V7.2.0 Planner Packs are reusable configuration files', 'V7.2.1 retains the V7.2 Planner Packs model: Planner Packs are reusable configuration files');
write('DATA-HANDLING.md', handling);

// Canonical application metadata.
let core = read('src/scripts/000-core.js');
core = replaceRequired(core, "  supportUrl: '',\n  repositoryUrl: ''", "  supportUrl: 'https://github.com/NomadCF/seatingchart/issues',\n  repositoryUrl: 'https://github.com/NomadCF/seatingchart'", 'repository/support URLs');
write('src/scripts/000-core.js', core);

// Remove obsolete one-way migration command; modular source is authoritative.
const pkg = JSON.parse(read('package.json'));
delete pkg.scripts['migrate:monolith-to-src'];
write('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

// Normal CI: fast deterministic release gate only.
write('.github/workflows/ci.yml', `name: Build and release checks\n\non:\n  pull_request:\n    branches: [main]\n  push:\n    branches: [main]\n\nconcurrency:\n  group: build-check-\${{ github.workflow }}-\${{ github.ref }}\n  cancel-in-progress: true\n\npermissions:\n  contents: read\n\njobs:\n  build-check:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '24'\n      - name: Install build dependencies\n        run: npm install --no-package-lock\n      - name: Validate deterministic V7.2.1 release\n        run: npm test\n      - name: Verify committed portable build matches source\n        run: git diff --exit-code -- dist/Classroom-Seating-Planner.html\n      - name: Validate JSON schemas\n        run: |\n          node -e \"for (const f of ['schemas/planner-v13.schema.json','schemas/envelope-v3.schema.json','schemas/roster-import-v1.schema.json','schemas/planner-command-v1.schema.json','schemas/planner-pack-v1.schema.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('Schemas parse cleanly.')\"\n      - name: Check service worker syntax\n        run: node --check service-worker.js\n      - name: Check whitespace\n        run: git diff --check\n      - name: Upload portable build\n        uses: actions/upload-artifact@v4\n        with:\n          name: classroom-seating-planner-portable\n          path: dist/Classroom-Seating-Planner.html\n          retention-days: 7\n`);

// Heavy browser coverage is preserved, but does not block ordinary repository changes.
write('.github/workflows/full-browser-regression.yml', `name: Full browser regression\n\non:\n  workflow_dispatch:\n  schedule:\n    - cron: '17 9 * * *'\n\nconcurrency:\n  group: full-browser-regression\n  cancel-in-progress: true\n\npermissions:\n  contents: read\n\njobs:\n  browser-regression:\n    runs-on: ubuntu-latest\n    timeout-minutes: 45\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '24'\n      - name: Install dependencies\n        run: npm install --no-package-lock\n      - name: Validate release before browser tests\n        run: npm test\n      - name: Install Chromium\n        run: npx playwright install --with-deps chromium\n      - name: Run complete desktop/mobile Playwright regression\n        run: npm run test:browser\n      - name: Upload browser report on failure\n        if: failure()\n        uses: actions/upload-artifact@v4\n        with:\n          name: playwright-report\n          path: playwright-report/\n          if-no-files-found: ignore\n          retention-days: 7\n`);

// Proven-unused repository files.
for (const file of [
  '.github/workflows/ai-source-export.yml',
  'docs/media/product-tour.svg',
  'tools/generate-code-map.mjs',
  'tools/split-main-script.mjs',
  'tools/split-monolith.mjs'
]) {
  fs.rmSync(file, { force: true });
}

console.log('V7.2.1 repository synchronization applied.');
