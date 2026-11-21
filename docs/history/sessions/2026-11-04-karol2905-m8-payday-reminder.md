---
date: 2026-11-04
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-53]
branch: feature/savings-payday-reminder
tool: Claude Code
pr: none
status: done
---

# Payday reminder of a goal, part 1: rule, table and service

## Instruction

Karol said "si" to "Programar" in Recomendaciones. The M8 prompt says: "choose an amount and the salary day (prefilled from M10's recurring income), schedules a monthly M12 reminder 'Hoy es día de pago: aparta $300.000 para Viaje a Cartagena'. It never moves money."

## What was done

* **Split.** The whole feature was about 850 lines. It is split into two pull requests merged one after the other (no stack). This one has the rule and the service; the screen comes when this one is merged.
* **`domain/payday.ts` (pure):**
  * `validatePayday`: amount above $0, day from 1 to 31.
  * `nextPaydayAt(day, now)`: 9:00 Bogotá time (14:00 UTC). It moves to next month once 9:00 has passed, and falls on the last day of a shorter month.
  * `salaryDay(sources)`: the usual day of the biggest salary M10 found.
* **Migration 4:** `savings_payday_reminders` (one per goal: amount, day).
* **`createVaultPaydayStore`** and **`createPaydayService`**:
  * `save` validates and schedules the next M12 notification. The id is per goal, so editing replaces it; the dedupe key is per goal and month.
  * `remove` cancels it.
  * `refresh` schedules next month again, and drops the reminders of reached or deleted goals.
* **`index.ts`:** `refresh` runs on `vault.unlocked`. Deleting a goal also removes its reminder.
* **Strings:** `paydayStrings`, the screen's copy included.
* **Tests:**
  * `domain/payday.test.ts` (6): validation; the next payday; the last day of a short month; across the year; the Bogotá day; the salary day.
  * `application/paydayService.test.ts` (5): the design text at 9:00; editing replaces; removing cancels; bad input is refused; the vault opening schedules next month and drops a deleted goal.

## Result

* 205 suites and 2424 tests pass. ESLint, tsc and Prettier are clean.

## Decisions and problems

* **One notice per month, scheduled again on open.** M12's `schedule` fires once and there is no background work. So the next month is scheduled whenever the vault opens: if the app is not opened for a whole month, a month is skipped. The same limit applies to M9's reminders.
* **Kind `recommendation`.** It comes from a recommendation, and `NotificationKind` has no payday kind.
* **Not backed up yet.** The reminder is manual data, but it is not in the backup collections of shared contracts 3.2. It can join `savings.goals` later if the team wants.

## Next step

Part 2: the "Recordatorio de día de pago" screen, Metas opening it from M11's params, and `openPaydayReminder` for Julián. It is already written on the local branch `feature/savings-payday-screen`.
