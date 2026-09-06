# Data Handling Guide

## Data classes

Classroom Seating Planner may handle student names, IDs, grades, nicknames, requirements, attendance status, seat assignments, groups, zones, categorized notes, room layouts, saved plans, and application settings.

## Storage locations

Data can exist in browser storage, in-memory application state, downloaded planner or backup files, user-selected working files, Google Drive when connected, generated print/PDF/image output, and purpose-limited read-only sharing packages.

## Encryption boundaries

Supported planner saves, browser persistence, backups, and recovery packages should use the application's encryption envelope when encryption is enabled. Encryption protects data at rest. Decrypted values can be present in browser memory while the workspace is unlocked and can be exposed by outputs the user deliberately creates.

## Diagnostics and support

Sanitized diagnostics must contain operational metadata only, such as application/build version, browser capabilities, PWA state, storage availability, save health, feature flags, and sanitized error identifiers. They must exclude student names, IDs, notes, assignments, roster contents, passwords, encryption keys, recovery secrets, OAuth access tokens, and raw planner payloads.

## External services

Google services are optional and user initiated. The app should request the narrowest practical OAuth scopes and should not send classroom payloads to unrelated third parties. Analytics events must never contain classroom records or sensitive note content.

## Retention

The application should make retention visible and controllable. Teachers should be able to clear local application data, remove snapshots, delete downloaded exports manually, and manage Drive copies using their Google account controls.

## Exports

Exports should identify their intended audience where practical and default to the minimum information required for that audience. Anonymous, room-only, student-facing, substitute, support-team, and teacher-facing outputs should remain distinct rather than relying on one all-data export.


## Planner Packs

V7.2.3 retains the V7.2 Planner Packs model: Planner Packs are reusable configuration files and are not planner save files. The built-in pack builder removes meaningful structured roster/student fields, seat assignments, student-specific distance relationships, student-to-zone/group links, and categorized student notes before a pack is created. Imported pack files that declare or contain meaningful structured student/roster data are refused. Floor-plan images are excluded from generated packs by default and require explicit opt-in because images can contain identifying classroom information. Pack names, descriptions, object labels, and station instructions are free text and are not semantically inspected, so users must review that text before sharing. Installed packs are stored in this browser's existing IndexedDB store and are not automatically inserted into planner saves or exports; applying selected pack content copies only the chosen reusable components into the current planner.
