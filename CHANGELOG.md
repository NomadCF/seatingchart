# Changelog

## 6.8.0 — 2026-09-04

### Classroom Intelligence

- Added six plain-English planning objectives: Balanced Classroom, Minimal Movement, Fair Rotation, Accessibility First, Quiet Testing, and Collaborative Lesson.
- Added plan-health summaries covering required conflicts, preference warnings, active unseated students, and seat capacity.
- Added smallest-change repair previews that reuse the existing seat-validity engine, show every proposed student move, and require explicit teacher approval before applying.
- Added concrete impossible-plan explanations for capacity shortages, repeated required conflicts, and students with no usable seat under the current explicit rules.
- Added fairness-aware repair scoring for Fair Rotation while keeping the teacher-defined rules and needs visible and authoritative.
- Kept V6.8 local-first and deterministic: no external AI service, hidden student scoring, or automatic rule rewriting was introduced.
- Updated the PWA cache generation and release validation to V6.8.0.

## 6.7.0 — 2026-09-04

### Engineering and release

- Added a committed modular development source tree while preserving the single-file portable application as the deployable artifact.
- Added deterministic source-to-`index.html` rebuild validation.
- Added desktop and mobile Chromium smoke tests in GitHub Actions.
- Added automated tagged-release packaging for the portable HTML, hosted PWA bundle, source archive, and SHA-256 checksums.
- Added public JSON Schema contracts for data schema 13 and encryption envelope 3.
- Added repository-level MIT licensing, security, privacy, data-handling, OAuth deployment, and WCAG 2.2 AA audit documentation.
- Updated the hosted PWA cache generation to V6.7.0.

### Collaboration

- Fixed shared-file editing presence metadata so it survives collaboration normalization and is included in planner saves.
- Added a bounded collaboration activity ledger for editing notices, detected remote revisions, and merge activity.
- Preserved the existing no-server model: Drive polling and three-way merge are explicitly presented as near-live coordination rather than realtime collaborative cursors or instant seat movement.

### Existing classroom capabilities retained

- Live seat guidance and valid-seat review.
- Conflict-resolution planning tools.
- Seating history and fairness analysis.
- Scheduled/named plans and visual plan comparison.
- Bulk requirements.
- Duplicate roster suggestions and advanced filters.
- Assignment/violation CSV exports.
- Sanitized support bundles.
- Copy chart as image and blank-room printing.
- Seat/zone/plan comments.
- Template libraries and import/export workflows.
- Desktop/mobile/PWA workflows.
- Google Drive save/load behavior.
- Analytics enabled by default with the existing opt-out.

### External configuration still optional

- Native Google Picker still requires a real restricted browser API key. Ordinary Google Drive save/load does not depend on Picker and remains available without it.

## 6.6.3 — 2026-09-04

- Completed hosted PWA manifest, service worker, icons, and update-aware deployment diagnostics.
- Added Google Picker project-number configuration and accurate missing-key diagnostics.
- Preserved default-on analytics behavior.
