---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-58, SCRUM-56, SCRUM-57]
branch: feature/subscription-detail
tool: Claude Code
pr: none
status: partial
---

# Detalle de suscripción: usage, reminder, "Ya la cancelé" and "No es una suscripción"

## Instruction

With #178 open, Karol asked: "puedes ir avanzando con esa sin necesidad de mezclar la 178? si es asi hazlo". The subscription detail belongs to M9 and does not touch the savings files of #178.

## What was done

* **`application/recurringService.ts`:**
  * `setUsage` (only subscriptions keep a mark).
  * `setReminder`.
  * `cancel`: "Ya la cancelé". Status `cancelled` and `cancelled_at`; it stops counting in Billetera and its reminder is cancelled; the row stays as a record.
  * `markNotSubscription`: kind `fixed`, usage cleared.
  * They share a `patch` helper that saves, notifies and plans the reminder again.
* **`application/ports.ts` and `adapters/vault/vaultRecurringStore.ts`:** `markCancelled(id, at)` on the existing `cancelled_at` column.
* **`ui/SubscriptionDetailScreen.tsx`** (route `recurring.Subscription`, path `billetera/suscripciones/:id`). New screen, needs design review.
  * Amount, periodicity, "Se renueva el 28 oct".
  * "¿Cuánto la usas?" chips.
  * The renewal reminder switch.
  * "Cómo cancelarla": generic text saying Fynk cancels nothing, until the merchant catalog gives the steps and the link.
  * "Ya la cancelé" with a confirmation, "No es una suscripción", "Editar".
* **`ui/BilleteraScreen.tsx`:** a row of "Otros gastos" now opens the detail instead of the form.
* **Tests:**
  * `application/recurringService.test.ts` (+5): cancelling leaves "3 activas · $73.700" and "$1.891.700" with the row kept as a record, usage only for subscriptions, reminder switch, not a subscription, missing item.
  * `application/reminders.test.ts` (+2): cancelling removes the renewal notice and a refresh does not bring it back; the switch schedules and cancels.
  * `ui/SubscriptionDetailScreen.test.tsx` (9).
  * `ui/BilleteraScreen.test.tsx`: the row opens the detail.

## Result

* Tests: 111 suites and 1349 tests pass. ESLint, tsc and Prettier are clean.
* Merged locally with #178: no conflicts.
* Pull request: opened from Karol's account against `develop`.

## Decisions and problems

* **"Ya la cancelé" keeps the row** (status `cancelled`) instead of deleting it, as the M9 prompt says: "stops counting it".
* **Still missing from the M9 prompt's detail:**
  * "Cómo cancelarla" with the catalog's steps and the "Abrir página de cancelación" button (SCRUM-58 backend, Go 1.27).
  * The account or card (M6).
  * The last 6 charges (M7).

## Next step

The merchant catalog backend for SCRUM-58 needs someone who can build Go 1.27; then the detail shows its steps and link.
