---
date: 2026-10-30
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-28]
branch: feature/dashboard-balance-card
tool: Claude Code
pr: 201
status: done
---

# Dashboard balance card, first part of M6 branch 3

## Instruction

"yes, start branch 3 stacked on #200", with the order develop ← #164 ← #165 ← #166 ← #167 ← #200 ← branch 3. Branch 3 of the M6 work plan is "Dashboard card, Detalle de cuentas, Detalle de cuenta screen".

## What was done

* Stack: #200 (`feature/balance-card-tokens`) rebased onto #167 with no conflicts, pushed with `--force-with-lease`, retargeted to `feature/manual-cash-account` and linked into stack #168 (`gh stack link 164 165 166 167 200`). The chain line of #164 to #200 now ends in `#200`.
* Branch 3 is split in three pull requests to stay near 400 lines: this one (the card), `feature/dashboard-accounts-detail` (Detalle de cuentas) and the Detalle de cuenta modal.
* `ui/DashboardScreen.tsx`: the Dashboard tab replaces M0's placeholder. `HeaderBlue` (Dashboard tone) with "Hola, <nombre>" and the bell, the card, and an error state with "Reintentar".
* `ui/DashboardBalanceCard.tsx`: card of `Dashboard.html` with the #200 tokens (`balanceCard`, `balanceCardPill`, shadow `balanceCard`), the three decorative squares and the shine. "Balance total", the amount, "COP · N cuentas conectadas" (singular for 1) and the Ingresos and Gastos boxes, whose icon tiles use the DashboardDetalles version (`background`, `link`, `primaryDark`).
* "Cómo se calcula": a tap on "Balance total" opens an alert with the formula. It is not in the design, so it needs design review.
* `domain/dashboard.ts`: `monthSummary`, the temporary Ingresos and Gastos of the Bogotá calendar month from booked movements, marked `TODO(M10)`.
* `src/app/AppRoot.test.tsx` (M0): checks "Balance total" instead of the placeholder text.

## Result

* Tests: 1126 of 1126 in the app on this stack. Lint, typecheck and Prettier clean.
* Pull request: #201, in stack #168 above #200.

## Decisions and problems

* Ingresos and Gastos show $0 for now: M7 stores no movements yet, so `index.ts` runs `monthSummary` on an empty list (`TODO(M10)`, `TODO(M7)`).
* The name says "Invitado" until M3 exports the name typed in onboarding (`TODO(M3)`), the same as Billetera.
* The Estadísticas button of the design is left out: M10 has no screen yet and the bar chart icon is not in `@shared/ui`. It comes with M10 (an M0 icon and a `HeaderBlue` action).
* Pull to refresh waits for M5's sync (`TODO(M5)`).
* A test that unmounted and rendered again broke every later test in the file; it was split in two.
* The local `gh stack` record still had the old 4-branch stack. `gh stack unstack --local` and `gh stack checkout 168` fixed it without touching GitHub. The branch, first created as `feature/dashboard-balance-and-account-detail`, was renamed before pushing.

## Next step

`feature/dashboard-accounts-detail`: Detalle de cuentas expanding in place, by tap or drag on the tab. Then the Detalle de cuenta modal with a `TODO(M7)` slot for `TransactionList`.
