---
date: 2026-10-30
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-28]
branch: feature/balance-card-tokens
tool: Claude Code
pr: none
status: done
---

# Balance card tokens before the M6 Dashboard branch, and the plan for the other two pending items

## Instruction

Before M6 branches 3 (`feature/dashboard-balance-and-account-detail`) and 4 (`feature/cards-and-wallets-in-mi-cuenta-and-billetera`), cover the three pending items: "The Dashboard card needs new color tokens", "Mis cuentas goes inside other people's screens" (Mi cuenta of M1, Billetera of M9) and "The account detail screen needs M7's movement list".

## What was done

* `apps/mobile/src/shared/ui/tokens.ts`: new tokens taken from `Dashboard.html` and `DashboardDetalles.html` in both themes:
  * `balanceCard` `#55C2EA`, the same in dark.
  * `balanceCardPill` `rgba(31, 147, 194, 0.4)` (`#1F93C266`), the same in dark.
  * `accountsPanel` `#30A9D9`, dark `#428FAF`.
  * Shadow `balanceCard` (`0 16px 32px -18px rgba(80,193,235,.9)`), the same in dark.
* Removed `onPrimarySubtle` (`rgba(255,255,255,.22)`, "income and spending boxes"): no file on any branch used it and no design file has that value.
* `tokens.test.ts`: 2 tests that pin the new values to the design code of both themes.

## Result

* Tests: 1359 of 1359 in the app. Lint, typecheck and Prettier clean.
* Pull request: not opened yet.

## Decisions and problems

* `scripts/design-color-pairs.mjs` cannot pair Dashboard and DashboardDetalles, so the light and dark files were compared by hand. The card and the pills keep their light colors in dark.
* In dark the Detalle de cuentas panel has no fill (it shows the header, `#4392B2`) and its tab is `#4290B0`. Both are the tone of `headerDashboard`, so `accountsPanel` uses `#428FAF` in dark, the same rounding the README already does for `#4392B2`.
* The two dark screens disagree on the Ingresos and Gastos icon tiles: Dashboard uses `#E8F1F6` with a `#A8E03A` arrow, DashboardDetalles uses `#13212D` with `#B6E45A` and `#62C8F0`. The card is one element that expands in place, so it needs one value. M6 will use the DashboardDetalles version, which matches existing tokens (`background`, `link`, `primaryDark`) and has better contrast. Flagged for design review in the pull request.
* The Jira key is SCRUM-28 (HU-014, total consolidado), the story that shows the card.
* `git fetch` over the default OpenSSL backend failed with "unable to get local issuer certificate". It works with `git -c http.sslBackend=schannel`.
* Mis cuentas in Mi cuenta and Billetera: M6 builds the sections and exports them from `accounts/index.ts`. Putting them on `MiCuentaScreen` (M1, Daniel) and `BilleteraScreen` (M9, Karol) needs their approval. Billetera already says "M6 adds Mis cuentas above". Mi cuenta (`DetalleCuentas.html`) has no Mis cuentas section in the design, so it is a new section that needs design review.
* Account detail and `TransactionList`: M7 is also Sofia's module, but its first branch (`feature/transactions-store-and-pagination`) has not started. Branch 3 leaves a `TODO(M7)` slot and is not blocked.

## Next step

Open the pull request for this branch, send the Mis cuentas message to Daniel and Karol, then start `feature/dashboard-balance-and-account-detail`.
