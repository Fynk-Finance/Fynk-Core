---
date: 2026-11-07
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-95]
branch: feature/dashboard-fab-menu
tool: Claude Code
pr: none
status: done
---

# The Dashboard + offers Ingreso or Gasto, and cash can always take money (QA review F5)

## Instruction

Sofia asked to go on with the Dashboard findings of the 7 Nov app review: "Continuee with the next changes. Stack everything is related with the same screen." This session covers F5: the + button cannot add money when the balance is zero, and if cash was skipped in onboarding there is no way to add money at all. Tapping + should offer Ingreso or Gasto, and each opens the existing form.

## What was done

* `accounts/ui/FabMenu.tsx` (new): a scrim and two actions above the FAB, "Ingreso" and "Gasto", built from the design's CSS (`fb-scrim`, `fb-act`). It closes from the scrim, the FAB, the system back button or an action. `DashboardScreen.tsx` opens it from the FAB, whose plus turns into a close mark, and opens M7's sheet with `{ kind }`.
* `accounts/application/cashService.ts`: `ensureCash()` returns the cash account's id, registering cash at $0 first when there is none. `accounts/index.ts` exports it as `ensureCashAccount`.
* `transactions/ui/ManualTransactionSheet.tsx`: reads `kind` from the route. Without a cash account it always offers "Efectivo" (selected by default) and calls M6's `ensureCash` on save, so there is no dead end with zero accounts. `transactions/index.ts` passes it.
* Tests: the menu, both actions with their type, closing by scrim, FAB and back button; the sheet on each type, Efectivo without cash (created only when picked), no dead end, and Efectivo still picked after M6 refuses a bigger Gasto; `ensureCash` with and without cash.
* `docs/design/README.md`: inventory row 5 lists the menu.

## Result

* Tests: 2,689 of 2,689 in the app, 128 snapshots. Typecheck, ESLint and Prettier clean.
* Pull request: not opened yet. Stacked on #336 (stack #338).

## Decisions and problems

* The menu lives in M6 next to the FAB, not in `shared/ui`: only the Dashboard uses it, so no shared pull request.
* With no cash, the sheet shows a "new cash" choice instead of creating cash when it opens, so cash is only registered when the person saves a movement in it. A Gasto in new cash still fails with "Tu efectivo es $0", as for any cash.
* Fynk never moves money: the actions only open the record form.

## Next step

Check the menu on a phone (scrim, pop, back button), light and dark, then G3.
