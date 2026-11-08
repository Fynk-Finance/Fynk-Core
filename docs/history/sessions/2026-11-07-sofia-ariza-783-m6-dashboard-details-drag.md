---
date: 2026-11-07
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-88]
branch: feature/dashboard-details-drag
tool: Claude Code
pr: "#342"
status: done
---

# Drag the Dashboard header to open Detalle de cuentas, and a bigger tab (QA review G1)

## Instruction

Sofia asked to go on with the Dashboard findings of the 7 Nov app review: "Continuee with the next changes. Stack everything is related with the same screen." This session covers G1: the arrow is too small to open Detalle de cuentas; make it bigger, and let the user drag the header card down (or up) to open or close the details gradually, following the finger, with a smooth animation.

## What was done

* `accounts/ui/detailsDrag.ts` (new, pure): the openness while dragging (the finger's travel over the panel's height, kept between 0 and 1) and where it settles on release (a flick over 500 px/s wins, otherwise the nearest end). It replaces `dragIntent`, which only toggled after 24 px.
* `accounts/ui/DashboardScreen.tsx`: one vertical pan on the whole header drives the openness G3 already animates. Horizontal swipes fail it, so they stay with the tab pager. It only drags at the top of the page. On release it settles with the design's reveal curve (.38 s, cubic-bezier(.22,1,.36,1)), also used by a tap. The panel is always mounted so a drag can open it, but while closed nobody can read or touch it.
* `accounts/ui/AccountsPanel.tsx`: the tab is 176 × 30 (was 148 × 24) with a 20 px chevron and a wider touch area; the chevron turns with the openness. The tab has no gesture of its own any more.
* Tests: the drag math (follows the finger, limits, no height yet, flicks and slow releases), the tab size and touch area, and the closed panel hidden from screen readers and touches.
* `docs/design/README.md`: gesture table and inventory row 6.

## Result

* Tests: 2,710 of 2,710 in the app, 128 snapshots. Typecheck, ESLint and Prettier clean.
* Pull request: #342, stacked on #341 (first in stack #338; after #333 to #339 were merged, moved with #340 to #343 to stack #344).

## Decisions and problems

* The drag is on the whole header, not only the tab, as the finding asks; taps on the avatar, the icons and the rows still work because the pan starts only after 10 px of vertical travel.
* Jest cannot run native gestures, so the gesture is covered by the pure functions and must be checked on a phone, together with the tab pager swipe.

## Next step

Check the drag on a phone (slow, flick, horizontal swipe to Billetera), light and dark. Then F3.
