from pathlib import Path
import re

VERSION = '7.3.0'
BUILD_DATE = '2026-09-06T03:40:00Z'


def replace_once(text, old, new, label):
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f'Could not synchronize {label}')


template_path = Path('src/index.template.html')
template = template_path.read_text()
template = re.sub(r'name="app-version" content="[^"]+"', f'name="app-version" content="{VERSION}"', template, count=1)
template = re.sub(r'name="build-date" content="[^"]+"', f'name="build-date" content="{BUILD_DATE}"', template, count=1)
template_path.write_text(template)

core_path = Path('src/scripts/000-core.js')
core = core_path.read_text()
core = re.sub(r"buildDate: '[^']+'", f"buildDate: '{BUILD_DATE}'", core, count=1)
core = replace_once(
    core,
    "  supportUrl: '',\n  repositoryUrl: ''",
    "  supportUrl: 'https://github.com/NomadCF/seatingchart/issues',\n  repositoryUrl: 'https://github.com/NomadCF/seatingchart'",
    'repository/support URLs'
)
core_path.write_text(core)

readme_path = Path('README.md')
readme = readme_path.read_text()
readme = readme.replace('version-7.2.0-2563eb', f'version-{VERSION}-2563eb', 1)
current_marker = 'The app combines **room design**, **student rules**, **manual placement**, **automatic plan generation**, **Classroom Intelligence**, **conflict review**, **history and fairness analysis**, and **privacy-controlled sharing** in one workflow.\n\n'
v73_section = """### V7.3.0 Planner Assistant workspace

Planner Assistant now works as a class-scoped planning workspace instead of only a one-shot command bar. It keeps short conversational context for follow-ups, shows a working plan, ranks candidate seats, compares current and proposed placements, analyzes hardest-to-seat and unseated students, surfaces rule pressure and fairness information, and can open existing tools such as Testing Mode, Activity Layouts, Station Rotations, named plans, Today Mode, Planner Packs, snapshots, print, undo, and redo. Mutating requests still use explicit preview/apply steps and the normal undo/autosave paths, and the built-in interpreter remains browser-local and deterministic.

"""
if '### V7.3.0 Planner Assistant workspace' not in readme:
    if current_marker not in readme:
        raise SystemExit('README current-release insertion marker not found')
    readme = readme.replace(current_marker, current_marker + v73_section, 1)
readme = readme.replace('### V7.1.0 Planner Assistant\n', '### V7.1.0 Planner Assistant foundation\n', 1)
readme = readme.replace('Ordered JavaScript modules: `src/scripts/` (38 modules in V7.2)', 'Ordered JavaScript modules: `src/scripts/` (declared in `src/manifest.json`)')
readme = readme.replace('Quick Start, searchable reference help, guided lessons, practice classes, contextual Guide Me tools, diagnostics, and troubleshooting', 'Quick Start, searchable reference help, guided lessons, practice classes, centralized Help & Guides / Planner Assistant access, diagnostics, and troubleshooting')
readme = readme.replace('npm test\nnpm run test:browser', 'npm test\nnpm run test:smoke\nnpm run test:browser')
readme = readme.replace(
    '`npm run build` assembles the portable HTML from the committed modular source. CI validates release structure, schema/service-worker behavior, build parity, and desktop/mobile browser regression coverage.',
    '`npm run build` assembles the portable HTML from the committed modular source. Normal CI runs deterministic release validation plus one consolidated critical smoke path on desktop and mobile. The complete historical browser suite runs on the scheduled/manual full-regression workflow; see [`docs/CI.md`](docs/CI.md).'
)
oauth_row = '| [`docs/OAUTH_DEPLOYMENT.md`](docs/OAUTH_DEPLOYMENT.md) | Google OAuth / Picker deployment guidance |\n'
extra_rows = '| [`docs/PLANNER-ASSISTANT.md`](docs/PLANNER-ASSISTANT.md) | Current V7.3 Planner Assistant behavior and privacy model |\n| [`docs/CI.md`](docs/CI.md) | Fast merge gate, generated-file rules, and full regression workflow |\n'
if extra_rows not in readme:
    readme = readme.replace(oauth_row, oauth_row + extra_rows, 1)
readme_path.write_text(readme)

changelog_path = Path('CHANGELOG.md')
changelog = changelog_path.read_text()
m720 = re.search(r'(?ms)^## 7\.2\.0 - 2026-09-05\n.*?(?=^## V7\.2\.1 - Code audit and maintenance)', changelog)
m721 = re.search(r'(?ms)^## V7\.2\.1 - Code audit and maintenance\n\n(.*?)(?=^## 7\.1\.0 - 2026-09-05)', changelog)
if m720 and m721:
    before = changelog[:m720.start()]
    after = changelog[m721.end():]
    block721 = '## 7.2.1 - 2026-09-05\n\n### Code audit and maintenance\n' + m721.group(1).lstrip()
    block720 = m720.group(0).rstrip() + '\n\n'
    changelog = before + block721.rstrip() + '\n\n' + block720 + after.lstrip()
elif '## 7.2.1 - 2026-09-05' not in changelog:
    raise SystemExit('Could not normalize V7.2.1 changelog ordering')

maintenance = """### Repository and CI maintenance
- Synchronized canonical V7.3.0 version metadata across the HTML template, generated app, README, package metadata, changelog, and PWA cache namespace.
- Added release validation that derives the expected version from `package.json` and rejects drift across canonical release surfaces.
- Synchronized the tracked `dist/Classroom-Seating-Planner.html` portable build with modular source and added CI protection against stale generated outputs.
- Replaced the duplicated per-push desktop/mobile/Planner Assistant full-regression matrix with a consolidated desktop/mobile critical smoke gate.
- Moved the complete browser regression suite to a scheduled/manual workflow, removed duplicate Assistant execution, disabled automatic retries, and added hard job time limits.
- Updated Planner Assistant and CI documentation for the active V7.3 release.

"""
if '### Repository and CI maintenance' not in changelog:
    next_release = changelog.find('\n## 7.2.1 - 2026-09-05')
    if next_release < 0:
        raise SystemExit('Could not find V7.2.1 heading after changelog normalization')
    changelog = changelog[:next_release] + '\n' + maintenance + changelog[next_release:]
changelog_path.write_text(changelog)

wcag_path = Path('docs/WCAG-2.2-AA-AUDIT.md')
wcag = wcag_path.read_text()
wcag = wcag.replace(
    'The current browser regression suite verifies that the application boots without uncaught runtime errors, core controls remain addressable, hosted PWA files are reachable, and desktop/mobile layouts do not create page-level horizontal overflow.',
    'The normal V7.3 critical smoke gate verifies startup, core workflow navigation, first-run security setup, hosted PWA files, Presentation Mode, uncaught runtime errors, and page-level desktop/mobile overflow. The complete historical Playwright suite runs separately on the scheduled/manual full-regression workflow described in `docs/CI.md`.'
)
wcag_path.write_text(wcag)
