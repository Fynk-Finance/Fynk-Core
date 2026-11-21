---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-57, SCRUM-54]
branch: feature/recurring-payment-reminders
tool: Claude Code
pr: none
status: done
---

# Payment and renewal reminders of recurring items, and the rescue of the SCRUM-54 stack

## Instruction

Karol asked: "listo, sigue con SCRUM 57". The story is HU-041 Recordatorios: "2 días antes por defecto. Activar o desactivar. Notificaciones locales, sin segundo plano. También en Notificaciones." She had already said that Claude opens the pull requests from her account.

## What was done

* **Rescue of the SCRUM-54 stack.** #153 and #154 had merged into their stack branches instead of `develop`, so `develop` only had #152. Branch `feature/recurring-form-and-billetera` merges `feature/recurring-form` into `develop` (conflict only in `recurring/index.ts`, kept the reviewed version). This branch is stacked on it.
* **`recurring/domain/reminder.ts`:** `reminderPlan` finds the next charge whose reminder is still ahead: lead days before (0, 1 or 2) at 9:00 Bogotá (14:00 UTC). It uses the existing `nextCharge`, so the 31st becomes the 30th in a 30 day month. Fixed expenses give `payment_due`; subscriptions give `subscription_renewal`.
* **`recurring/application/reminders.ts`:** schedules the reminder through M12's `NotificationsPort`, or cancels it.
  * Each item has one id, `recurring.reminder.<id>`, so scheduling again replaces it.
  * The dedupe key includes the charge date.
  * The link is `fynk://billetera/recurrentes/<id>`.
  * Texts are in `strings.es-CO.ts`: "Vence en 2 días: $186.000." and "Se renueva el 28 sep por $38.900.".
* **`recurringService`:**
  * create and update schedule the reminder.
  * delete cancels it.
  * New `refreshReminders()` reschedules every item.
  * A failing notifier never blocks saving.
* **`recurring/index.ts`:**
  * The reminders refresh on `vault.unlocked`, on `sync.completed` and when Ajustes de notificaciones changes.
  * New route `recurring.Edit` with path `billetera/recurrentes/:id`, so the reminder's link opens the item in the form.
* **M12 (also Karol's):** the service has `onSettingsChanged`, exported as `onNotificationSettingsChanged`. It fires when a kind, "Permitir notificaciones" or the lead days change.
* **Tests:**
  * `domain/reminder.test.ts` (8): 2 days before at 9:00, chosen lead days, 31st in a 30 day month, reminder already passed, year change, weekly, renewal, nothing when off, cancelled or daily.
  * `application/reminders.test.ts` (9): scheduling on create, renewal text, lead days, moving and turning off, delete, refresh, a failing notifier, the texts.
  * `notifications/application/settings.test.ts` (+1).

## Result

* Tests: 79 suites and 1042 tests pass. ESLint, tsc and Prettier are clean.
* Checked that `billetera/recurrentes/<id>` resolves to `recurring.Edit` with the id, and that `billetera/recurrentes/nuevo` still opens the new item form.
* Pull request: stacked on the rescue pull request.

## Decisions and problems

* **Daily items get no reminder.** A notice every weekday for transport would only be noise. The switch still shows in the form; the team can change this.
* **When the reminder of the next charge already passed** (an item added the day before it is charged), the reminder is for the charge after, so no reminder is ever sent late with the wrong "Vence en 2 días".
* **No background work.** Reminders are rescheduled only with the app open; the phone rings the local notification that was already scheduled.
* **Merging the stack.** It reached the wrong branches because the upper pull requests were merged without first changing their base to `develop`. Next time: merge the bottom one, delete its branch (GitHub then moves the next base to `develop`), click "Update branch", and only then merge.

## Next step

SCRUM-56: usage marks, the subscriptions section and the savings banner in Billetera.
