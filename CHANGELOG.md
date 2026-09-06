## 7.2.1 - 2026-09-05

### Code audit and maintenance

- Removed proven-unused functions, parameters, locals, and an obsolete completed implementation-plan document.
- Repaired stale autosave calls in Interoperability, Digital Twin, Activity Layouts, Station Rotations, Testing Mode, and Planner Packs so they use the canonical autosave scheduler.
- Repaired the Digital Twin Freeform-mode transition to use the current layout-mode function.
- Removed dead modal compatibility branches for APIs that no longer exist; current dialogs continue through the installed Dialog Manager.
- Standardized Google Picker and Google Classroom access through the explicit `window.google` browser global.
- Refreshed architecture/accessibility documentation and regenerated the portable single-file build.

## 7.2.0 - 2026-09-05

### Planner Packs ecosystem
- Added a browser-local Planner Pack library backed by the existing IndexedDB data store.
- Added portable `.plannerpack.json` files with the public `classroom-seating-planner-pack-v1` contract.
- Packs can contain room templates, reusable student-need presets, custom room-object definitions, Activity Layouts, Station Rotation blueprints, and Testing Mode profiles.
- Added pack builder metadata for revision, publisher/credit, license, description, and tags.
- Added explicit import validation, install/update behavior, component counts, compatibility/impact preview, selective apply, export, and local-library removal.
- Generated packs structurally remove student assignments, roster/student IDs, note fields, student-to-zone/group links, and student-specific distance rules.
- Floor-plan images are excluded by default and require explicit opt-in; imports surface an embedded-image privacy warning.
- Activity Layout pack application requires matching seat counts and remaps seat identity deterministically so importing a layout does not silently reseat the current class.
- Station Rotation packs store station blueprints rather than student teams; stations must match uniquely in the current room and teams are rebuilt from the current active roster.
- Testing profiles load configuration only and do not move furniture until the teacher uses the normal Testing Mode preview/apply workflow.
- Added a bundled Classroom Essentials starter pack with reusable front/aisle/accessibility presets and a quiet-testing profile.
- Planner Packs stay out of Presentation mode and print output.
- Planner data schema remains 13 and encryption envelope remains 3; the pack schema is a separate public interchange contract.

## 7.1.0 - 2026-09-05

### Planner Assistant
- Added a browser-local deterministic Planner Assistant command bar available throughout the normal planning workflow.
- Natural-language classroom requests translate into explicit existing planner actions instead of hidden AI-owned rules.
- Added non-destructive interpretation and impact previews before mutating requirements, pair rules, group rules, or Activity Layout selection.
- Added student-name ambiguity detection; multiple matches are shown and the assistant refuses to guess.
- Added commands for valid-seat guidance, student-placement explanations, conflict-cause summaries, individual seating requirements, together/apart rules, Testing Mode previews, Station Rotations, Activity Layout switching, and Classroom Intelligence repair previews.
- Mutating assistant actions enter the existing undo path and use normal class persistence/autosave.
- Added a small per-class browser-local command history with explicit clear control; history is not part of planner save/export data.
- Added public planner command preview schema at schemas/planner-command-v1.schema.json for future optional interpreters/providers to target the same explicit action contract.
- Added responsive desktop/mobile regression coverage and kept the assistant out of Presentation mode and print output.
- Planner data schema remains 13 and encryption envelope remains 3.

## 7.0.3 - 2026-09-04

### Testing Mode
- Added a dedicated non-destructive Testing Mode preview for Freeform classrooms.
- Generates practical maximum-separation seat geometry without changing student assignments.
- Preserves locked seat positions by default and keeps fixed Digital Twin room objects as physical constraints.
- Uses Today Mode's active roster for spacing calculations while keeping absent/unused seat furniture in the room.
- Checks required accessibility/front/aisle needs during placement and calls out remaining teacher-review issues.
- Explains when requested center-to-center spacing cannot fit because of room size, fixed furniture, locked seats, or active roster count.
- Added ordered normal-room-to-testing transition instructions with feet/meters when physical room scale is enabled.
- Applying a preview creates a separate Testing Activity Layout and records the source layout for an explicit return path.
- Preview overlays are non-interactive, hidden from print, and responsive on desktop/mobile.
- Testing metadata is additive inside Freeform layout data; planner data schema remains 13 and encryption envelope remains 3.

## 7.0.2 - 2026-09-04

### Station Rotations
- Added station-rotation plans that run on top of the existing Freeform Classroom Digital Twin without changing seat assignments.
- Activity Stations, Lab Stations, and tables can be selected as explicit rotation destinations.
- Added size-balanced rotation teams from the active roster plus an option to seed teams from existing classroom groups; each student is assigned to at most one rotation team.
- Today Mode absences are excluded whenever rotation teams are created or rebuilt.
- Added deterministic round schedules, previous/next round controls, per-station timers, optional transition timers, and visible team-at-station badges on the room.
- Rotation plans remember the Activity Layout they were created for and can switch back to that arrangement explicitly when the current room arrangement differs.
- Added create, select, duplicate, rename, delete, rebuild-team, and saved-plan management with responsive desktop/mobile UI.
- Station rotation metadata is additive inside Freeform layout data; planner data schema remains 13 and encryption envelope remains 3.

## 7.0.1 - 2026-09-04

### Activity Layouts
- Added multiple named Freeform arrangements inside one classroom while keeping physical room dimensions, floor-plan backgrounds, and fixed room features shared.
- Added six starter arrangements: Direct Instruction, Group Work, Discussion Circle, Lab / Stations, Independent Work, and Testing.
- Added quick switching, duplication, rename, delete, and explicit save-current-geometry actions.
- Matching Freeform seat assignments and lock state carry across arrangement switches so room changes do not silently reseat students.
- Added visual side-by-side arrangement comparison with moved/added/removed object counts and physical movement totals when room scale is enabled.
- Added responsive desktop/mobile controls and kept Presentation mode and print output free of arrangement-management UI.
- Activity-layout metadata is additive inside Freeform layout data; planner data schema remains 13 and encryption envelope remains 3.

## 7.0.0 - 2026-09-04

### Classroom Digital Twin foundation
- Added optional real-world room dimensions to Freeform layouts while leaving legacy/unscaled rooms fully valid.
- Added scaled room grid and rulers with feet/meters support and configurable physical grid spacing.
- Added physical width/height labels for Freeform room objects plus a two-object distance measurement tool.
- Added floor-plan/photo background import with in-browser optimization, opacity, scale, offset, rotation, visibility, and explicit print inclusion.
- Added fixed classroom object types for shelves/bookcases, cabinets/storage, lab stations, sinks/utilities, and activity stations using the existing Freeform object model.
- Kept drag/drop, rotation, resizing, groups, seating rules, Presentation mode, print, mobile panning, zoom, and the single-file deterministic build intact.
- Physical-room metadata is additive inside Freeform layout data; planner data schema remains 13 and encryption envelope remains 3.

## 6.8.2 - 2026-09-04

## 6.9.0 - 2026-09-04

### Roster interoperability
- Added one normalized roster reconciliation workflow for CSV/SIS, OneRoster 1.2 CSV, Microsoft Education/SDS CSV, and Google Classroom.
- Stable source IDs match first, unique email second, while name-only and ambiguous matches require explicit teacher review.
- Roster refreshes preserve planner-owned notes, requirements, assignments, locks, groups, and other teacher data. Students missing from the same source roster are preserved unless archive is explicitly selected.
- Added reusable CSV column mappings and compact per-class import history.
- Added Google Classroom student-group sync as inert source/reference groups; promotion into seating-affecting planner groups is explicit and off by default.
- Added public normalized interchange schema at schemas/roster-import-v1.schema.json.
- Data schema remains 13 and encryption envelope remains 3.

### Physical table and pod seating
- Refines Freeform table groups so the tabletop is the primary physical object and student seats read as attached positions rather than unrelated floating cards.
- Adds non-interactive chair cues derived from existing seat/table geometry and rotation without changing the saved seating model.
- Keeps the clean V6.8.1 student-card language for occupied, Open, locked, selected, valid, caution, conflict, and absence states.
- Rectangular and round tables receive distinct physical furniture treatment; logical groups without tables retain the softer grouped boundary.
- Presentation mode, print, mobile, zoom, and seat text scaling preserve the same table/seat relationships.
- Chair cues never intercept pointer input, preserving drag/drop, swapping, selection, table movement, rotation, locking, rules, undo/redo, and valid-seat previews.

# Changelog

## 6.8.1 — 2026-09-04

### Grouped seating visual refinement

- Refined Freeform tables and pods so grouped seating reads as a coherent classroom unit rather than unrelated rectangles.
- Added subtle pod boundaries and labels using existing Freeform group geometry and group colors, with nearby ungrouped seats visually associated to tables without modifying saved seating data.
- Refined occupied, open, locked, selected, valid, caution, conflict, and temporary-absence seat states while keeping the student name visually dominant.
- Added cleaner Presentation/Eye-mode treatment that removes secondary seat detail while retaining table and pod context.
- Preserved grouped seating in print with grayscale-safe boundaries and deliberate open-seat styling.
- Updated Copy chart as image to render tables, pod boundaries, seats, labels, rotations, open seats, locks, and rule-state cues from the same Freeform geometry.
- Updated Freeform plan-comparison previews to preserve table/pod relationships and changed-seat highlighting.
- Added zoom-aware detail reduction and seat-text-scale compatibility without altering drag/drop, swapping, movement, rotation, locking, rule evaluation, undo/redo, or the saved data schema.

## 6.8.0 — 2026-09-04

### Classroom Intelligence

- Added six plain-English planning objectives: Balanced Classroom, Minimal Movement, Fair Rotation, Accessibility First, Quiet Testing, and Collaborative Lesson.
- Added plan-health summaries covering required conflicts, preference warnings, active unseated students, and seat capacity.
- Added smallest-change repair previews that reuse the existing seat-validity engine, show every proposed student move, and require explicit teacher approval before applying.
- Added concrete impossible-plan explanations for capacity shortages, repeated required conflicts, and students with no usable seat under the current explicit rules.
- Added fairness-aware repair scoring for Fair Rotation while keeping the teacher-defined rules and needs visible and authoritative.
- Grouped Advanced planning tools into the modern More Actions menu so Classroom Intelligence and the existing planning suite follow the same visible desktop/mobile navigation model.
- Fixed the Advanced Planning entry point so it opens reliably from the propagation-isolated More Actions menu on both desktop and mobile.
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
- Fairness and seating history analysis.
- Scheduled plans and visual plan comparison.
- Bulk requirements and advanced roster filters.
- Duplicate roster suggestions.
- Seat, zone, and plan comments.
- Room/planning template libraries.
- Assignment/violation CSV exports, sanitized support bundles, chart-image copying, and blank-room printing.
