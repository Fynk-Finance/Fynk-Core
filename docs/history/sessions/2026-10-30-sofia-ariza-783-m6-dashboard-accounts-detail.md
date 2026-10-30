---
date: 2026-10-30
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-26, SCRUM-28]
branch: feature/dashboard-accounts-detail
tool: Claude Code
pr: none
status: done
---

# Detalle de cuentas on the Dashboard, second part of M6 branch 3

## Instruction

Same session as `feature/dashboard-balance-card` (#201): "yes, start branch 3 stacked on #200". Branch 3 was split in three to stay near 400 lines; this is the second part, Detalle de cuentas (design `DashboardDetalles`, inventory row 6: "not a route. The Dashboard header expands in place, by tap or drag on the tab").

## What was done

* `domain/dashboard.ts`: `accountRows` (active accounts in display order, no CDTs, each with what it adds to the total, so a card is minus what is owed) and `entityOf` ("Banco Demo" from "Banco Demo · Ahorros").
* `ui/AccountsPanel.tsx`:
  * `AccountsPanel`: the `accountsPanel` box of the design with one row per account: entity, "Cuenta de ahorros · •• 4821", balance, the "Simulado" badge for simulated accounts, and "Efectivo · Registrado manualmente" for cash.
  * `DetailsTab`: the tab shape of the design (`pullTab` closed, `accountsPanel` open) with the chevron that turns. It opens and closes the panel by tap ("Ver detalle de cuentas", "Ocultar detalle de cuentas") or by a drag down or up (`dragIntent`, 24 px).
* `ui/DashboardScreen.tsx`: the panel fades in under the card and the header grows with it (Reanimated layout transition, 0.25 s as in the design).
* Tests: 5 for `accountRows`, 6 for the panel on the screen and 2 for `dragIntent`.

## Result

* Tests: 1139 of 1139 in the app. Lint, typecheck and Prettier clean.
* Pull request: in stack #168 above #201.

## Decisions and problems

* CDTs are not listed: the panel explains the balance total, and investment data stays in the Inversión tab (HU-014).
* Credit cards show minus what is owed (`−$500.000`), so the rows add up to the total. The design has no card in this panel, so this needs design review.
* The "Simulado" badge next to the entity is an M6 rule that is not drawn in the design; it needs design review.
* Masking: the test feeds a 10 digit number and checks that neither the text nor any accessibility label carries more than the last 4.
* The drag is not run in Jest (Gesture Handler has no native runtime there); `dragIntent` is tested on its own and the tap path is tested on the screen.
* Rows do not open anything yet. The Detalle de cuenta modal comes next.

## Next step

The Detalle de cuenta modal (design `CuentaDetalle`): opens from a row, page dots and swipe to change account, chevron or swipe down to close, credit data for cards, and a `TODO(M7)` slot for `TransactionList`.
