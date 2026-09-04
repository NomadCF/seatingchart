# Privacy

Classroom Seating Planner is designed to minimize unnecessary disclosure of student information.

## Default data handling

The application operates in the browser. Classroom data is stored locally unless the user deliberately saves, exports, prints, shares, or connects an external service such as Google Drive or Google Classroom.

## Analytics

The hosted application currently enables analytics storage by default, with the existing in-app opt-out control preserved. Analytics must not intentionally include student names, IDs, notes, seating assignments, encryption material, OAuth tokens, or planner file contents.

## Google integrations

Google Drive and Google Classroom access is initiated by the user. The app should request only the scopes needed for the selected feature. Google Drive planner files remain under the user's Google account and permissions.

## Sensitive classroom information

Private and substitute notes, student identifiers, requirements, attendance details, and other sensitive classroom information must never be included in diagnostics or support exports unless the user explicitly chooses a data-bearing export intended for that purpose.

## Sharing and printing

Audience-specific sharing and printing controls are intended to let teachers disclose only the information needed for the recipient. Users remain responsible for selecting appropriate fields and note categories before sharing or printing.

## Local clearing

The application provides reset and local-data clearing tools. Users should also remove exported files, downloaded backups, shared Drive files, and browser downloads separately when those copies are no longer needed.
