---
date: 2026-11-07
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-78]
branch: fix/dashboard-details-tab
tool: Claude Code
pr: "#334"
status: done
---

# Detalle de cuentas tab below the header, in its color (QA review V3)

## Instruction

Sofia asked to fix the Dashboard findings of the 7 Nov app review (#332): "In pr #332 theer are several visual and gestual changes, lets solve them. Most af them are small changes, lets start for Dashboard screen changes." This session covers V3: the Detalle de cuentas arrow overlaps the header too much, is a different blue than the header when closed, and hides inside the header when open.

## What was done

* `apps/mobile/src/modules/accounts/ui/AccountsPanel.tsx` (`DetailsTab`): the tab now has `marginTop: -1` open and closed (it was -12 closed and -21 open), and its shape is always `headerDashboard` (it was `pullTab` closed and `accountsPanel` open).
* `DashboardScreen.test.tsx`: in light and dark, the tab hangs 1 px into the header and has the header's blue, before and after opening.
* `docs/design/README.md`: inventory row 6 notes the change.

## Result

* Tests: 159 of 159 in the accounts module. Typecheck, ESLint and Prettier clean.
* Pull request: #334.

## Decisions and problems

* The design PNGs (Dashboard, DashboardDetalles) show the tab fully below the header, so it starts at the header's edge; 1 px up hides the seam.
* The design code paints the closed tab `#47B6E2`, lighter than the header. The finding asks for the header's color, so this differs from the design on purpose and is written in the inventory. The `pullTab` token is no longer used; it stays in `tokens.ts` until an M0 cleanup.
* The arrow's size and the drag that follows the finger are G1 (SCRUM-88), not this change.

## Next step

Check it on a phone next to both PNGs, light and dark, then do G1.
