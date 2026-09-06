# Continuous integration

Classroom Seating Planner keeps the normal merge gate intentionally small. The application is distributed as a single HTML file, but browser regression coverage spans many historical features; running the entire suite on every commit adds little signal and can take far longer than the build itself.

## Normal pull request and main-branch gate

`.github/workflows/ci.yml` runs two jobs:

1. **build-check** - installs the small Node dependency set, rebuilds the portable HTML, verifies `index.html` and the tracked `dist/Classroom-Seating-Planner.html` match modular source, validates canonical release metadata, parses public schemas, checks service-worker syntax, and uploads the portable build.
2. **critical-smoke** - installs Chromium once and runs `tests/browser/critical-smoke.spec.mjs` against desktop and mobile. The smoke path checks startup, the V7.3 version surface, first-run encryption setup, PWA companion files, the five primary workflow stages, Presentation Mode, core controls, page-level overflow, and uncaught runtime errors.

The normal gate does **not** run every historical feature suite.

### Why the smoke test uses a modular browser harness

The shipped application remains the generated single-file `index.html`. Its application bundle is roughly 2.9 MB of inline JavaScript. Small GitHub-hosted headless Chromium runners can spend more than a minute compiling that single inline block before Playwright can interact with the page, even though the same application is usable in normal desktop browsers.

`npm run test:smoke` therefore generates an ignored `critical-smoke.html` with `tools/build-browser-harness.mjs`. The harness uses the **same HTML template, CSS, 42 JavaScript modules, and manifest order** as the production build, but loads the modules as same-origin script files so Chromium can parse and compile them incrementally. The smoke test also fetches the exact production `index.html` and verifies its V7.3 version surface.

This does not replace production-build validation. `build-check` still proves that both tracked portable HTML files are deterministic rebuilds of the modular source. The scheduled/manual full regression continues to exercise the actual portable `index.html` bundle.

## Full browser regression

`.github/workflows/full-regression.yml` runs the complete Playwright directory for desktop and mobile. It is intentionally separate from the normal merge gate and runs:

- on its nightly schedule
- when manually started with **Run workflow** in GitHub Actions
- before or during a major release when broad regression evidence is needed

The full workflow runs desktop and mobile on separate runners and does not add a third duplicate Planner Assistant lane; Assistant tests are already part of the complete browser directory.

Each full browser job has a hard 90-minute limit so a broken test cannot occupy a runner indefinitely.

## Local commands

```bash
npm install
npm run build
npm test
npm run test:smoke
npm run test:browser
npm run test:assistant
```

Use `npm run test:smoke` for a quick release-path check. Use `npm run test:browser` when changing broad UI behavior or before a release. `npm run test:assistant` remains available for focused Planner Assistant work.

## Release-source rule

The maintainable application source lives under `src/`. `index.html` and `dist/Classroom-Seating-Planner.html` are generated release outputs and must both match a fresh `npm run build` before merge.

`tools/validate-release.mjs` derives the expected release number from `package.json` and verifies that the HTML template, core app configuration, README badge, changelog heading, service-worker cache namespace, built HTML, and tracked generated outputs stay synchronized.
