# Google OAuth and Picker deployment

Classroom Seating Planner separates ordinary Google Drive API access from the optional Google Picker file-browser interface.

## Existing Drive behavior

The hosted app uses the configured OAuth client ID to request user authorization and call Google Drive APIs. Saving, loading, updating, and managing planner files through the application's Drive workflow do not depend on Google Picker.

## Google Picker

The optional native Google Picker UI additionally requires:

- the existing OAuth client ID
- a Google Cloud project number used as the Picker App ID
- a browser API key enabled for Google Picker API and Google Drive API

The current project number is configured in the application. The browser API key remains intentionally blank until a real restricted key is created.

Recommended browser-key restrictions for the hosted GitHub Pages deployment:

- website/referrer restriction for `https://nomadcf.github.io/*`
- website/referrer restriction for `https://docs.google.com/*` because Picker content is rendered there
- API restrictions limited to Google Picker API and Google Drive API

A browser API key used by Picker is a public client identifier, not an encryption secret. Security comes from referrer and API restrictions. OAuth access tokens and classroom data must never be committed to the repository.

## OAuth verification readiness

Before broad external distribution of Google Classroom features, maintain a public application homepage, privacy policy, and support/contact information that accurately describe requested Google scopes and data handling. If Google requires verification for the configured scopes, complete that process in the Cloud project associated with the OAuth client.

## Custom domain

A custom domain is recommended for long-term public deployment because it provides a stable branded origin and simplifies ownership/verification. GitHub Pages can continue serving the site behind that custom domain; no continuously running application server is required.

## Deployment test

After changing Google credentials, verify all of the following in a fresh browser profile:

1. ordinary Drive connection succeeds
2. encrypted planner save and load succeeds
3. an existing Drive planner file can be updated
4. Google Picker either opens successfully or reports its specific missing configuration
5. disconnect/reconnect does not expose or retain stale tokens in diagnostics
6. Analytics preference remains independent of Google authorization
