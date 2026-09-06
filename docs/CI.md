# Continuous integration

Classroom Seating Planner keeps the normal merge gate intentionally small. The application is distributed as a single HTML file, while the historical browser suite covers many specialized workflows; running that entire suite on every commit adds little signal and can take far longer than the build itself.

## Normal pull request and main-branch gate

`.github/workflows/ci.yml` runs one **build-check** job. It:

1. installs the small Node dependency set;
2. rejects trailing whitespace in modular source;
3. rebuilds the portable HTML;
4. verifies `index.html` and the tracked `dist/Classroom-Seating-Planner.html` exactly match modular source;
5. runs deterministic release validation;
6. runs `npm run test:smoke`, a fast critical V7.3 release-contract check;
7. parses the public JSON schemas;
8. checks service-worker syntax; and
9. uploads the portable build artifact.

The critical release contract validates the active V7.3 version surfaces, required PWA assets, critical static controls, first-run encryption/recovery contract, five primary workflow registrations, Presentation Mode access, the V7.3 Planner Assistant workspace, and the 42-module manifest order.

No Chromium download or full Playwright suite blocks an ordinary pull request or `main` push. The normal gate is meant to answer: **does this commit produce a coherent V7.3 release artifact with the required application contract intact?**

## Full browser regression

`.github/workflows/full-regression.yml` owns the heavyweight browser tests. It runs the complete Playwright directory for desktop and mobile:

- on its nightly schedule;
- when manually started with **Run workflow** in GitHub Actions; and
- before or during a major release when broad runtime regression evidence is needed.

Desktop and mobile use separate runners. There is no third duplicate Planner Assistant lane because Assistant tests are already included in the complete browser directory. Each full browser job has a hard 90-minute limit and no automatic retry, so a broken or pathological browser test cannot occupy CI indefinitely.

The V7.3 application is a large legacy single-page application with roughly 2.9 MB in the generated portable HTML. GitHub-hosted headless Chromium has shown unusually long startup/actionability delays on this historical stack even when all 42 source modules are delivered separately. Those browser characteristics are useful diagnostic information, but they are not an appropriate merge gate for documentation, schema, release-metadata, or ordinary maintenance changes.

## Local commands

```bash
npm install
npm run build
npm test
npm run test:smoke
npm run test:browser
npm run test:assistant
```

Use `npm run test:smoke` for the fast release-contract check. Use `npm run test:browser` when changing broad UI/runtime behavior or before a release. `npm run test:assistant` remains available for focused Planner Assistant work.

## Release-source rule

The maintainable application source lives under `src/`. `index.html` and `dist/Classroom-Seating-Planner.html` are generated release outputs and must both match a fresh `npm run build` before merge.

`tools/validate-release.mjs` derives the expected release number from `package.json` and verifies that the HTML template, core app configuration, README badge, changelog heading, service-worker cache namespace, built HTML, and tracked generated outputs stay synchronized. `tools/critical-release-check.mjs` adds the fast application-contract checks used by normal CI and release packaging.
