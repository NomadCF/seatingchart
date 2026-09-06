# Security Policy

## Supported version

Security fixes target V7.2.3, the current hosted and portable production release. Later experimental branches are not the production support baseline unless explicitly promoted.

## Reporting a vulnerability

Do not open a public issue containing student data, encryption material, OAuth tokens, passwords, recovery keys, or an exploit that exposes private classroom information.

Report security concerns privately to the repository owner through an appropriate private contact channel. Include the application version, browser, reproduction steps, expected behavior, observed behavior, and a sanitized proof of concept when possible.

## Security model

Classroom Seating Planner is a browser application. Classroom data is intended to remain local unless a user explicitly saves, exports, prints, shares, or connects an external service. Encryption protects supported data at rest; unlocked data necessarily exists in browser memory while the application is in use.

The application does not treat client-side OAuth identifiers or restricted browser API keys as secrets. OAuth access tokens, encryption passwords, derived keys, and decrypted student data must never be committed to this repository or included in support bundles.

## Supported disclosure expectations

Please allow a reasonable remediation window before public disclosure of a vulnerability that could expose private classroom information. Security fixes should include a regression test whenever practical.
