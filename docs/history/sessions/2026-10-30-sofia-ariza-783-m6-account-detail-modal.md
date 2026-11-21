---
date: 2026-10-30
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-27, SCRUM-33]
branch: feature/account-detail-modal
tool: Claude Code
pr: none
status: done
---

# Detalle de cuenta modal, last part of M6 branch 3

## Instruction

"yes, start the modal": the third part of branch 3, the Detalle de cuenta screen (design `CuentaDetalle`, inventory row 12: "modal (chevron up, swipe down to close)", page dots), stacked on #202.

## What was done

* `ui/AccountDetailScreen.tsx`, route `accounts.AccountDetail` (`cuentas/:accountId`, transition `modal`):
  * Blue hero with the decorative squares, the chevron to close and "Mis cuentas".
  * The account card of the design: initials tile, entity, type, "Simulado", "Saldo disponible" and the amount, `•• 4821` and "Actualizado hace 5 min". Cash shows "Registrado manualmente" with no number and no update time.
  * Credit cards: "Cupo disponible" on the card, then "Cupo total" and "Pago el 5 nov" (HU-019).
  * Page dots (shared `PageDots`), one per account without CDTs, and a horizontal swipe (`swipeTarget`) to change account.
  * A `renderTransactions(accountId)` slot for M7's `TransactionList` (`TODO(M7)` in `index.ts`).
  * "Esta cuenta ya no está conectada." when the account is gone, for example after a revoked consent.
* Rows of Detalle de cuentas are now buttons that open the modal.
* Tests: 12 for the modal and its labels, 1 for opening it from a row.

## Result

* Tests: 1152 of 1152 in the app. Lint, typecheck and Prettier clean.
* Pull request: in stack #168 above #202. 521 changed lines, 164 of them tests, over the ~400 target (see below).

## Decisions and problems

* Left out for now: "Tarjetas asociadas" (no link between a card and an account in the `Account` model), "Eliminar cuenta" (needs M4's revoke, and there is no delete for cash yet), the "Conectar cuenta" page (M5), pull to refresh (M5) and the peek of the next card.
* The design's "1 de 4" counter is transparent, so it is not drawn.
* The PR is bigger than 400 lines. Splitting it again would leave a half-built modal in one PR, so it stays whole and the size is noted in the PR.
* Ink shadow `shadow.card` stands in for the card's `0 22px 36px -20px rgba(15,34,51,.55)`.

## Next step

Branch 4, `feature/cards-and-wallets-in-mi-cuenta-and-billetera`, after Daniel (M1) and Karol (M9) agree to the Mis cuentas sections. Later, M7 plugs `TransactionList` into the modal.
