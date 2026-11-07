---
date: 2026-11-07
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-25, SCRUM-22]
branch: feature/dashboard-refresh-and-disconnect
tool: Claude Code
pr: none
status: done
---

# Dashboard pull to refresh and Eliminar cuenta in Detalle de cuenta

## Instruction

From the follow-ups of the M4 and M5 end-to-end test: "Pull-to-refresh on the Dashboard. In `DashboardScreen.tsx` there is still a `TODO(M5)` comment; however, M5 already exports the necessary functionality: `import { syncNow } from '@modules/bank';`" (HU-011), and "Account details: The button to disconnect a bank is missing. You should use `disconnectLink(linkId)` from `@modules/bank`" (HU-008).

## What was done

* `accounts/ui/DashboardScreen.tsx`: `refresh` dep passed to `Screen`. A pull runs M5's sync and then `refetch()` of the accounts, also when the sync fails. The `TODO(M5)` is gone.
* `accounts/ui/AccountDetailScreen.tsx`: the design's "Eliminar cuenta" row (56 px square with a red border and the trash icon, plus the label, `CuentaDetalle.html`) under Movimientos, only for accounts with a bank link. `revoked` closes the detail, `cancelled` stays, and `not_found` shows a message. The row is busy while M4 checks.
* `accounts/index.ts`: passes `syncNow` and `disconnectLink` from `@modules/bank`, called only on a pull or a press (M5 imports this module too).
* `accounts/ui/strings.es-CO.ts`: `remove`, `removeNotFound`.
* Tests: Dashboard pull (sync then refetch; refetch after a failed sync; no pull without M5). Eliminar cuenta (calls `disconnect(linkId)` and closes on revoked; stays on cancel; message on not_found; busy, so a second press does nothing; hidden for cash and without M5).

## Result

* Tests: 157 of 157 pass in `accounts`, and 627 of 627 in bank, transactions, onboarding, consents and app. ESLint, Prettier and `tsc --noEmit` are clean.
* Pull request: not opened yet (stacked on the shared UI branch).

## Decisions and problems

* The whole row (square and label) is one press target with the label "Eliminar cuenta". The design marks the label `aria-hidden` and only the square is a button; one target is easier to hit and reads the same to screen readers.
* Deleting cash from Detalle de cuenta (also "Eliminar cuenta" in inventory row 12) is not part of this task, so cash shows no row.
* The pressed square uses `dangerBorder`, because the design has no pressed state for this button.

## Next step

Check on the emulator, in light and dark, against `docs/design/screens/*/CuentaDetalle.png`, and add screenshots to the pull request.
