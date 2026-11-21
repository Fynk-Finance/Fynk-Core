---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-56]
branch: feature/subscriptions-usage-and-savings
tool: Claude Code
pr: none
status: done
---

# Usage marks, the subscriptions section and the savings banner in Billetera

## Instruction

Karol asked "listo, con que seguimos?" after SCRUM-54 and SCRUM-57 were merged. The agreed next story was SCRUM-56, HU-040 Poco uso: "El usuario marca el uso. Ahorro mensual potencial de las de poco uso. Se muestra en Billetera y alimenta recomendaciones. Montos verificables."

## What was done

* **The usage mark:**
  * `domain/item.ts`: `RecurringInput.usage`.
  * `application/recurringService.ts`: create saves the usage of a subscription. An edit without a usage keeps the current mark; null clears it. A fixed expense never has one.
  * `ui/formState.ts` and `ui/RecurringFormScreen.tsx`: "¿Cuánto la usas?" with the chips Mucho, A veces and Casi nunca, shown only for subscriptions. Tapping the chosen chip again clears it.
* **`ui/SavingsBanner.tsx`:** the design's "OPORTUNIDAD DE AHORRO · Ahorra $56.800 al mes · 2 suscripciones que casi no usas".
  * It is the blue card with squares and shine (M0's `Card variant="primary"`).
  * The bulb tile and the chevron use the theme colors, so in dark they take the dark values of the design.
  * Shown only when a subscription is marked "Casi nunca"; it opens Recomendaciones (inventory row 9).
* **`ui/SubscriptionRow.tsx`:** the design's rows, with the lime tile, the name, the "Poco uso" pill, "Renueva 28 sep" and the amount. Tapping a row opens the form.
* **`ui/BilleteraScreen.tsx`:** the cards are now only the fixed expenses. Below them come the banner and "Otros gastos · 4 activas · $112.600/mes" with the subscriptions. `useRecurringItems` also loads `subscriptionsSummary`.
* **`domain/card.ts`:** `dayMonth` ("28 sep").
* **Recommendations:** they already get the low use saving through `getSubscriptionsSummary()` (count, monthly total, low use count and amount), the shape of the analytics snapshot.
* **Tests:**
  * Service: `Ahorra $56.800`, and keeping or clearing the mark.
  * Form state and form screen: 2 each.
  * Billetera: 5 new (cards against "Otros gastos", no banner without low use, banner and "Poco uso" as in the design, banner opens Recomendaciones, a row opens the form), plus dark theme with the banner.
  * `dayMonth`: 1.

## Result

* Tests: 79 suites and 1053 tests pass. ESLint, tsc and Prettier are clean.
* Pull request: opened from Karol's account against `develop`.

## Decisions and problems

* **The usage is marked in the form,** not in the new "Detalle de suscripción" screen of the M9 prompt. That screen is part of SCRUM-58 (cancellation guide). When it lands, it gets the same selector.
* **The section is titled "Otros gastos"** as in the design. The M9 prompt says "Suscripciones"; the design is the visual source.
* **The rows show "Renueva 28 sep" without the account.** "Tarjeta de crédito ·" needs the accounts of M6.
* **Every subscription row uses the play icon.** The design has a different icon per merchant, which comes with the merchant catalog (SCRUM-58).
* **The banner's tile and chevron are drawn with theme colors.** The dark design uses the dark page color and light blue, not white, so `IconTile tone="white"` did not fit.

## Next step

SCRUM-51 and SCRUM-53 (M8 savings goals), or SCRUM-58 if the catalog backend can be built.
