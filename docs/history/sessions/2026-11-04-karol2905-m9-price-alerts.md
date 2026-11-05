---
date: 2026-11-04
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-61]
branch: feature/subscription-price-alerts
tool: Claude Code
pr: none
status: done
---

# Price increase alerts and the red "Subió" chip (SCRUM-61)

## Instruction

"ya lo tengo abierto, estoy esperando aprobacion, sigue con lo que puedas". While the detected screen PR waits for approval: SCRUM-61, price increase alerts and the red "Subió" chip.

## What was done

* **Migration 4:** `recurring_price_alerts` (item, charge with a unique id, previous and new amount, dates).
* **`domain/priceChange.ts`:** `newestChargeIncrease` compares the newest charge with the one before it using the existing `priceIncrease` rule (more than 5 % and more than $1.000).
* **`createVaultPriceAlertStore`:**
  * open alerts;
  * `add`, which refuses a second alert for the same charge;
  * `dismiss`.
* **`createPriceAlertService`:**
  * `check()` looks at active detected subscriptions, reading M7's movements over 400 days (enough for a yearly one). For each new increase it saves one alert and sends M12's `notify` with kind `subscription_price_up`: "Streaming de series subió de $32.900 a $36.900 (+$4.000 al mes)." The notice deep links to the subscription.
  * `openByItem()` and `dismiss()`.
  * "al mes" is used for monthly subscriptions; the others say "por cobro".
* **UI:**
  * `PriceUpChip`: red "Subió" in the Billetera row.
  * Detalle: a card "Subió de precio · Pasó de $32.900 a $36.900: +$4.000 al mes." with "Entendido".
* **`index.ts`:** runs `check()` on `sync.completed`, and wires the chip and the detail card.
* **Tests:**
  * `application/priceAlertService.test.ts` (6):
    * the 33.500 and 36.900 references of the prompt;
    * one alert and notice per charge;
    * open until dismissed, and not back afterwards;
    * cancelled subscriptions are skipped.
  * `ui/PriceUp.test.tsx` (2): the chip in Billetera, and the detail card with "Entendido", in dark theme.

## Result

* 203 suites and 2413 tests pass after the rebase on #253 (detected screen). The conflicts were Billetera dependencies added next to each other, and both sides were kept. ESLint, tsc and Prettier are clean.
* About 660 changed lines, nearly half of them tests: over the 400 line guideline. Splitting the screen part out would have needed a stack on top of this branch.

## Decisions and problems

* **Only detected subscriptions are compared.** They are the only ones with a `merchantKey` to match charges. One typed by hand gets alerts once it is confirmed from a detected proposal.
* **The item amount does not change by itself.** The alert shows before and after; the person updates the amount with "Editar" if they want.
* **The shared `Badge` has no danger tone.** `PriceUpChip` copies its shape with the theme's `danger` and `dangerSoft` colors instead of editing M0's file. New element, needs design review.
* **Alerts are not backed up.** They are derived from the movements, and the notice's dedupe key is the charge id.

## Next step

The "Programar" payday reminder and "23 % de tus ingresos" in Metas (M8), and the app side of the merchant catalog (SCRUM-58).
