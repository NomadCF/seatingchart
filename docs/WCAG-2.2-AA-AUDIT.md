# WCAG 2.2 AA audit checklist

Classroom Seating Planner is interaction-heavy, so accessibility review must include actual keyboard, touch, and mobile workflows rather than static markup alone.

## Automated checks

The normal V7.3 critical smoke gate verifies startup, core workflow navigation, first-run security setup, hosted PWA files, Presentation Mode, uncaught runtime errors, and page-level desktop/mobile overflow. The complete historical Playwright suite runs separately on the scheduled/manual full-regression workflow described in `docs/CI.md`.

Future CI expansion should add an accessibility engine such as axe-core when the dependency is approved. Automated scanners do not replace the manual checks below.

## Manual WCAG 2.2 AA checks

### Keyboard and focus

- Every interactive control is reachable by keyboard.
- Focus order follows the visual and workflow order.
- Modal focus is trapped while open and restored to the invoking control on close.
- Escape closes dismissible dialogs without discarding unsaved work unexpectedly.
- No keyboard trap exists in Freeform, menus, settings, print options, Drive dialogs, or student placement.
- Visible focus indication remains clear in every theme.

### Dragging alternatives

WCAG 2.2 requires functionality that uses dragging to have a non-dragging alternative where practical. Verify:

- students can be placed through keyboard/button workflows as well as drag-and-drop
- Freeform objects can be moved with keyboard nudging
- rotation is available from buttons/keyboard, not only pointer gestures
- resize or arrangement tasks have explicit controls or an equivalent non-drag method where needed

### Target size

Verify touch targets meet WCAG 2.2 target-size expectations or qualify for an allowed exception. Pay special attention to:

- mobile close controls
- seat controls
- Freeform rotate/resize handles
- toolbar icons
- overflow menus
- compact student-card actions

### Reflow and zoom

At 320 CSS pixels wide and at browser zoom up to 400 percent:

- no essential information is clipped
- horizontal scrolling is limited to intentionally pannable room/canvas regions
- modal content remains reachable
- seat text-size and room-zoom controls remain usable
- mobile Settings and More Actions remain accessible

### Contrast and non-color cues

- text and controls meet AA contrast requirements in each supported theme
- valid/caution/invalid seat guidance is not conveyed by green/yellow/red alone
- focus and selection states remain distinguishable without color
- disabled controls remain identifiable

### Names, roles, and status

- icon-only buttons have accessible names
- labels reference the correct controls
- modal titles are connected through `aria-labelledby`
- live status announcements do not repeat excessively
- rule conflicts, save errors, and Drive status changes are announced accessibly

### Motion

- reduced-motion preference suppresses non-essential animation
- no required workflow depends on animation timing

### Printing and sharing

- accessibility-related display preferences do not leak private student fields into print/share outputs
- Presentation Mode does not expose editing controls through keyboard focus

## Release gate

A release should not be marked accessibility-verified until desktop keyboard, mobile touch, 200/400 percent zoom, reduced motion, high-contrast theme, Presentation Mode, Freeform placement, and at least one screen-reader smoke pass have been manually checked.
