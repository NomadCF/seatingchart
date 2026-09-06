# Planner Assistant

Planner Assistant in **V7.3.0** is a browser-local, deterministic planning workspace built on top of Classroom Seating Planner's existing rules, seating engine, analysis tools, and undo/persistence paths. It does not require an external AI provider and does not introduce hidden student scoring or a separate seating model.

V7.1 introduced the original command interpreter. V7.2.1 and V7.2.2 improved interface behavior and conversational follow-ups. V7.3 expands that foundation into a class-scoped planning workspace with short multi-turn context, candidate-seat workflows, classroom analysis, and direct access to existing planner tools.

## Interaction model

Planner Assistant keeps teacher control explicit:

1. **Ask** - describe a classroom-planning goal in ordinary language.
2. **Interpret** - review the students, rules, layout, or planner tool the local interpreter matched.
3. **Inspect** - review candidate seats, conflicts, movement, rule pressure, or other available planner evidence.
4. **Preview** - mutating requests show proposed operations before they change planner data.
5. **Apply** - explicitly commit an accepted change through the planner's normal state, persistence, autosave, and undo paths.

Ambiguous student names are not guessed. The Assistant asks for clarification when multiple students match. Keyword collisions are also guarded so a student's name, such as Ada, is not mistaken for an accessibility command.

## V7.3 workspace capabilities

The V7.3 workspace can help with:

- valid-seat discovery for a student
- current-placement explanations
- candidate-seat ranking and current-versus-proposed comparisons
- follow-ups such as "Keep Maya near the front" and then "But not next to Noah"
- explicit candidate selection such as "Use the second one"
- together/apart rules and visible student seating requirements
- conflict causes, hardest-to-seat students, unseated students, rule pressure, and repair priorities
- seating-history and fairness analysis using existing planner data
- Testing Mode planning while preserving locked seats and required accessibility placements
- Activity Layouts, Station Rotations, named seating plans, Today Mode, Planner Packs, snapshots, printing, undo, and redo
- clarification and suggested next actions when a request cannot be safely mapped

Planner mutations remain preview/apply operations. Analysis requests are read-only unless the teacher explicitly accepts a proposed change.

## Visibility and help

Planner Assistant has one centralized entry point with **Command bar**, **Compact**, and **Hidden** states. The selected state is stored locally in the browser. The Assistant can be restored from Help/Guides or Settings if it has been hidden.

Repeated contextual "Guide me" buttons are intentionally suppressed. Help is centralized so the planner does not scatter duplicate Assistant controls throughout the interface.

The workspace is responsive on desktop and mobile and is suppressed from Presentation Mode and print output.

## Privacy and command history

The built-in interpreter runs in the browser. Classroom requests are not sent to OpenAI, Anthropic, Google Gemini, or another external AI service by the Planner Assistant.

Short class-scoped conversational context and recent commands may be kept in browser-local storage to support follow-up requests and convenient reruns. This Assistant history is separate from the planner save/export model and can be cleared from the Assistant.

Because requests may contain student names or classroom details, browser-local Assistant history should still be treated as classroom data on shared devices.

## Safety and explainability

Planner Assistant does not infer behavior labels for students. Behavior or instructional labels are used only when they already exist in explicit teacher-defined groups, requirements, or rules.

When a request is ambiguous, unsupported, or would require guessing, the Assistant should clarify the request or suggest supported classroom-planning actions instead of silently changing planner data.

## Public command contract

`schemas/planner-command-v1.schema.json` documents the normalized Planner Assistant interpretation object. Optional future interpreters can target this public contract while leaving seating rules, previews, application of changes, persistence, and undo inside the existing planner engine.
