# Security Policy

## Supported version

The actively supported release line is **V7.3.x**, including the current hosted build and matching portable single-file release. Older historical releases may remain available in repository history but should not be treated as the supported production baseline.

## Reporting a security issue

Please avoid filing student data, encryption keys, OAuth tokens, passwords, recovery secrets, or real classroom records in a public issue.

For a reproducible public-code problem, open a GitHub issue using sanitized sample data and include the application version, browser, operating system, and the smallest safe reproduction you can provide.

For a vulnerability that would expose real classroom data, credentials, or encryption material, use GitHub's private vulnerability reporting feature when it is available for the repository rather than posting the details publicly.

## Security boundaries

Classroom Seating Planner is a browser application. Encryption protects supported data at rest in planner saves, browser persistence, backups, and related encrypted packages. Data is necessarily available in browser memory while an unlocked workspace is actively using it.

Presentation Mode and page-lock controls reduce accidental access; they are not a substitute for device/account security. Google OAuth access remains governed by the user's Google account and the scopes authorized for the application.

The built-in V7.3 Planner Assistant runs locally in the browser and does not require an external AI provider for classroom requests.

## Safe reports and diagnostics

Support bundles and issue reports should use sanitized diagnostics only. Do not attach raw save files, screenshots containing student records, full browser storage dumps, OAuth tokens, or encryption/recovery secrets unless you have deliberately removed sensitive classroom data.
