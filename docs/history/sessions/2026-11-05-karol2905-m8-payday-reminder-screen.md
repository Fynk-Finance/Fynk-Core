---
date: 2026-11-05
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-53]
branch: feature/savings-payday-reminder-screen
tool: Claude Code
pr: none
status: done
---

# Payday reminder of a goal, part 2: the screen

## Instruction

"sigue con lo que falta". Part 1 (#255, rule and service) was merged, so this is part 2: the screen of "Programar" in Recomendaciones.

## What was done

* **Review first:**
  * The pull request of "23 % de tus ingresos" (`feature/savings-income-share`) had never been opened. It was rebased on `develop` (2436 tests pass) and pushed again with `--force-with-lease`.
  * Sofia's #261 (`fix/configure-analytics-at-startup`) is open. Once it is merged, M10 works and the income share shows.
* **`ui/PaydayReminderScreen.tsx`:**
  * Route `savings.PaydayReminder`, path `metas/:goalId/dia-de-pago`, default push.
  * The amount comes from Recomendaciones, the saved reminder or the suggested monthly. The day comes from the saved reminder or the salary M10 found ("Tomado de tu nómina: llega el día 30.").
  * "Programar recordatorio" / "Guardar cambios" / "Quitar recordatorio", with the note "Fynk no mueve tu dinero: es solo un recordatorio."
  * Opened from a deep link, it goes to Metas instead of back.
* **`ui/usePaydayParams.ts` in Metas:** M11's "Programar" opens Metas with `{ goalId, paydayAmountMinor }`, its default. Metas then pushes the reminder of that goal once and clears the params, so no M11 file is touched.
* **`index.ts`:**
  * the route;
  * `openPaydayReminder(nav, goalId, amount)` and `PAYDAY_REMINDER_ROUTE`, for Julián to use directly;
  * the salary day from M10's `getRecurringIncome`.
  * The imports and the new code sit away from the lines the income branch changes, so the two branches merge in any order.
* **Tests:** `ui/PaydayReminderScreen.test.tsx` (5):
  * the prefilled amount and salary day;
  * "Programar recordatorio" schedules it, and a deep link goes home;
  * errors for a bad amount and day;
  * edit and remove in dark theme;
  * Metas opening it from M11's params.

## Result

* 208 suites and 2436 tests pass. ESLint, tsc and Prettier are clean. About 425 changed lines.

## Decisions and problems

* **No M11 change.** M11's default already navigates to `savings.Goals` with the goal and the amount, so Metas handles those params. Julián can switch to `openPaydayReminder` later.

## Next step

The app side of "Cómo cancelarla" with the merchant catalog (SCRUM-58).
