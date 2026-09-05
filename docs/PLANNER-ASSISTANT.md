# Planner Assistant

V7.1.0 adds a browser-local, deterministic command layer over Classroom Seating Planner. It interprets teacher requests into the same explicit rules and tools already used by the application; it does not introduce a hidden seating model or require an external AI provider.

## Interaction model

Planner Assistant follows four steps for actions that can change planner data:

1. **Request** — enter a classroom-planning request in ordinary language.
2. **Interpretation** — review the students, rules, layout, or planning tool the local interpreter matched.
3. **Impact** — review affected students, valid-seat changes, conflict counts, movement, or other available planner metrics.
4. **Apply** — explicitly commit the interpreted operation through the normal planner data model.

Ambiguous student names are not guessed. The assistant lists the matching students and requires a more specific name or nickname.

## Supported V7.1.0 intents

The initial command contract supports valid-seat guidance, current-placement explanations, conflict-cause summaries, student seating requirements, together/apart rules, existing group-rule changes, Testing Mode previews, Station Rotations, Activity Layout switching, and Classroom Intelligence repair previews.

The command bar can be opened with **Ctrl+Alt+P**. Applying mutating commands uses the planner's normal undo, persistence, and autosave paths.

## Privacy and command history

The built-in V7.1.0 interpreter runs in the browser and does not send commands to an external AI service. Up to 20 recent commands are stored per class in browser local storage for convenient reruns. That command history is separate from planner save/export data and can be cleared from Planner Assistant.

Because commands may contain student names or classroom details, browser command history should be treated as classroom data when using shared devices.

## Public command contract

`schemas/planner-command-v1.schema.json` documents the normalized Planner Assistant interpretation object. Future optional interpreters can target this contract while leaving the actual seating rules, previews, and apply operations inside the existing planner engine.
