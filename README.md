# Classroom Seating Planner

Classroom Seating Planner is a privacy-conscious classroom management and seating-design application that helps educators build class rosters, create accurate classroom layouts, assign students manually or automatically, evaluate seating requirements, and produce audience-appropriate print and sharing materials.

The application guides users through five primary stages: Class Setup, Room Design, Seat Students, Review, and Save & Share. It supports both traditional grid-based seating charts and detailed Freeform classroom layouts, while incorporating student needs, accessibility considerations, group relationships, seating restrictions, zones, room objects, and teacher-defined rules.

Classroom Seating Planner is designed to run locally as a self-contained application, with encrypted browser saving, backups, snapshots, recovery tools, and optional Google Drive and Google Classroom integration. It emphasizes student-data privacy by allowing teachers to control which names, details, and note categories appear in printed charts or read-only sharing packages.

Hosted application: https://nomadcf.github.io/seatingchart/

## Main features

- **Five-stage guided workflow** — Class Setup, Room Design, Seat Students, Review, and Save & Share.
- **Multiple class and roster management** — classes, student records, archived rosters, class copies, term rollovers, and class-record comparisons or merges.
- **CSV, Google Classroom, and roster reconciliation** — CSV import plus optional read-only Google Classroom roster retrieval and reconciliation before changes are applied.
- **Duplicate-detection assistance** — flags duplicate and near-matching roster records for review rather than silently merging them.
- **Student information and categorized notes** — names, IDs, grades, nicknames, requirements, attendance information, and public, substitute, or private notes.
- **Student groups and classroom zones** — instructional groups, behavior groupings, reserved locations, classroom zones, and relationships between students, groups, seats, and room areas.
- **Detailed seating rules and requirements** — together, avoid, spread, anchor, front/back placement, accessibility, zone, room-object distance, and individual requirements.
- **Bulk requirements tools** — apply, inspect, and manage requirements across multiple students without editing each record independently.
- **Standard Grid room design** — row-and-column charts with seats, teacher areas, tables, doors, walls, windows, boards, projectors, walkways, carpets, ADA spaces, and custom objects.
- **Advanced Freeform room design** — move, resize, rotate, align, group, layer, lock, and arrange classroom objects on a physical-room canvas.
- **Freeform layout assistance** — collision handling, magnetic alignment guides, minimap navigation, object history, layout presets, print boundaries, overlap detection, and room-integrity audits.
- **Manual student placement** — drag, swap, move, clear, lock, or keyboard-place students while preserving intentional assignments and reserved seats.
- **Live seat guidance** — evaluates candidate placements and helps surface valid or problematic seats for the selected student.
- **Automatic seating-plan generation** — produces multiple candidates based on rules, student needs, room geometry, existing placements, and teacher priorities.
- **Explainable seating recommendations** — shows why generated plans differ by identifying rule matches, unmet requirements, conflicts, movement, and other factors.
- **Conflict-resolution planning tools** — identifies blocking requirements and supports actionable review rather than presenting only a score.
- **Preflight conflict inspection** — detects insufficient seats, inaccessible required seating, contradictory rules, invalid locked assignments, duplicate students, and unavailable zones.
- **Seating review and analysis** — finds unassigned students, rule violations, group outcomes, inaccessible placements, overlapping objects, hidden items, and inconsistent data.
- **Advanced roster/search filters** — quickly narrows students by seating and planning state, including unresolved or unseated cases.
- **Today Mode and temporary classroom changes** — attendance, absent students, temporary guests, daily notes, and seating only students currently present.
- **Named and scheduled seating plans** — saves, activates, compares, restores, schedules, and manages room arrangements or student-assignment versions.
- **Seating history and fairness analysis** — tracks seating patterns and movement so teachers can evaluate repeated placement outcomes and rotation fairness.
- **Visual plan comparison** — compares saved plans and highlights meaningful assignment/layout differences.
- **Seat, zone, and plan comments** — stores planning context alongside the relevant classroom element rather than forcing every note into a student record.
- **Undo, redo, snapshots, and selective restore** — editing history, automatic/manual snapshots, restore points, and restoration of selected classes or data sections.
- **Encrypted saving and recovery** — encrypted browser autosave, downloaded backups, linked working files, password rotation, startup recovery, and optional recovery packages.
- **Save-health and conflict protection** — storage monitoring, backup records, interrupted-write protection, multi-tab detection, and conflict-resolution options.
- **Optional Google Drive storage** — saves and loads encrypted planner files through Drive with file management, revisions, reconnect status, duplicate handling, and revision-aware conflict detection.
- **Drive collaboration checks** — optional polling, remote-change detection, three-way merge support, editing notices, and a bounded collaboration activity ledger while the app is open. This is not represented as realtime Google-Docs-style collaboration.
- **Privacy-controlled printing** — print-as-seen, names-only, substitute, detailed, and blank-room outputs with selectable fields, notes, groups, zones, paper sizes, scaling, tiling, and crop marks.
- **CSV export center** — exports current assignments and rule/violation information for downstream review or reporting.
- **Image and vector output** — copy chart as image plus PDF/SVG-oriented output paths for documents and presentations.
- **Sanitized support bundles** — diagnostic exports designed to omit student records, notes, passwords, encryption keys, OAuth tokens, and raw planner payloads.
- **Purpose-limited read-only sharing packages** — teacher, substitute, student-facing, support-team, anonymous, or room-only HTML packages containing only selected information.
- **Room and planning template libraries** — reusable layout/planning templates with import/export workflows for sharing without requiring a server-hosted template database.
- **Workspace security controls** — encrypted data, Settings protection, page locking, automatic locking, Eye/Presentation Mode, deliberate sensitive-note revealing, and secure reset workflows.
- **Responsive and accessible interface** — desktop, tablet, mobile, touch placement, keyboard navigation, focus-managed dialogs, screen-reader announcements, reduced motion, collapsible panels, and focus mode.
- **Integrated guidance and documentation** — Quick Start, searchable reference help, guided lessons, practice classes, contextual Guide Me tools, learning progress, diagnostics, and troubleshooting.
- **Customizable appearance and language support** — accessible themes, display preferences, collapsible workspaces, configurable defaults, privacy views, presentation modes, shortcuts, and localization infrastructure.
- **Portable and hosted deployment options** — runs as a self-contained HTML application or as a hosted/installable Progressive Web App with offline support and deployment verification.
- **Privacy-focused local operation** — keeps classroom information in the browser unless the user deliberately saves, exports, prints, shares, or connects an approved external service.

## V6.7 engineering and release model

The distributed portable application remains one self-contained HTML file, but development now uses the committed `src/` tree as the maintainable source of truth. The HTML shell lives in `src/index.template.html`, the application stylesheet in `src/styles/`, and the main runtime is split into 27 ordered JavaScript modules in `src/scripts/`.

Useful commands:

```text
npm install
npm run build
npm test
npm run test:browser
```

`npm run build` assembles `dist/Classroom-Seating-Planner.html` from the committed modular source. CI verifies that the result matches the deployed `index.html` exactly after line-ending normalization, then runs schema, service-worker, and desktop/mobile browser regression checks. The legacy `npm run migrate:monolith-to-src` command exists only for one-way migration or recovery from a monolithic source snapshot and is not part of the normal development workflow.

Tagged releases package the portable HTML, hosted PWA bundle, complete modular source archive, and SHA-256 checksums.

## Public data contracts

The repository includes forward-compatible JSON Schema documents for the current formats:

- `schemas/planner-v13.schema.json` — decrypted `classroom-seating-planner-save-v6` document using data schema 13.
- `schemas/envelope-v3.schema.json` — encrypted `classroom-seating-planner-encrypted-envelope-v6` document using encryption envelope 3.

These schemas are intended for validation and third-party tooling. Additive fields remain allowed so minor releases can evolve without forcing every external reader to update immediately.

## Privacy and security

See `PRIVACY.md`, `SECURITY.md`, and `DATA-HANDLING.md` for the public data-handling and security model. Classroom data should never be placed in bug reports or diagnostics unless the user deliberately creates a data-bearing export for that purpose.

The hosted application currently preserves its existing analytics behavior: analytics storage is enabled by default with the existing in-app opt-out. Analytics events must not intentionally contain roster data, student notes, student identifiers, seating assignments, encryption material, OAuth tokens, or planner payloads.

## Google integration

Ordinary Google Drive save/load workflows use OAuth and do not require Google Picker. The optional native Google Picker file-browser interface additionally requires a restricted browser API key. See `docs/OAUTH_DEPLOYMENT.md` for the exact deployment distinction and recommended restrictions.

## Accessibility

The app includes keyboard, touch, responsive, reduced-motion, screen-reader, and focus-management support. The V6.7 audit checklist in `docs/WCAG-2.2-AA-AUDIT.md` documents the release gate for WCAG 2.2 AA-oriented manual verification, including dragging alternatives, target size, reflow, focus, contrast, and Presentation Mode.

## License

MIT License. See `LICENSE`.
