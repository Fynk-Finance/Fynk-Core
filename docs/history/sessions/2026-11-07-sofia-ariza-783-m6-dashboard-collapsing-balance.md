---
date: 2026-11-07
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-90]
branch: feature/dashboard-collapsing-balance
tool: Claude Code
pr: none
status: done
---

# The Dashboard header shrinks to a compact balance while the page scrolls (QA review G3)

## Instruction

Sofia asked to go on with the Dashboard findings of the 7 Nov app review: "Continuee with the next changes. Stack everything is related with the same screen." This session covers G3: on scroll, the balance must shrink to a card of 1/5 of the screen, as in Estadísticas, and the movements list never scrolls on its own. Asked what the shrunk header keeps, Sofia picked "Greeting + compact balance".

## What was done

* `accounts/ui/dashboardCollapse.ts` (new, pure): one pixel of scroll takes one pixel off the header. An open Detalle de cuentas folds first, then the 206 px balance card shrinks to a compact height that leaves the header at a fifth of the screen (56 to 103 px).
* `accounts/ui/DashboardScreen.tsx`: one `Animated.ScrollView` for the whole page (goals and movements inside it, no scroll of their own), with the blue header pinned over it. The page starts with an animated spacer the size of the header at rest, so it stays attached while the header shrinks. Detalle de cuentas now opens and closes by animating its height (needed so it can fold with the scroll); opening it from a shrunk header scrolls back to the top. Pull to refresh stays, with its spinner moved below the header.
* `accounts/ui/DashboardBalanceCard.tsx`: takes the collapse state. The full content fades out and a compact line ("Balance total" and the amount) fades in.
* Tests: the collapse math (open, shrinking, the stop, panel first, half-open panel, compact heights), the pinned header and its spacer, the card at three scroll states, and the movements inside the page scroll.
* `docs/design/README.md`: inventory row 5 notes the override.

## Result

* Tests: 2,701 of 2,701 in the app, 128 snapshots. Typecheck, ESLint and Prettier clean.
* Pull request: not opened yet. Stacked on #339 (stack #338).

## Decisions and problems

* The Dashboard no longer uses the shared `Screen`, like Estadísticas, because the header must sit over the scroll.
* Jest cannot deliver scroll events to Reanimated's scroll handler (checked with a throwaway probe), so the card is tested with the states a scroll gives and the scroll itself through the pure function. The feel must be checked on a phone.
* The header's chrome (padding and greeting row) is measured once at rest, so a larger font size does not break the spacer.

## Next step

Check the scroll on a phone, light and dark, with and without Detalle de cuentas open. Then V10 on top of this scroll.
