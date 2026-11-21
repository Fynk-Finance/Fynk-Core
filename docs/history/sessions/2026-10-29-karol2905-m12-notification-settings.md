---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M12
jira: [SCRUM-70]
branch: feature/notification-settings
tool: Claude Code
pr: none
status: partial
---

# Notification settings screen (M12 step 3)

## Instruction

Karol agreed to step 3 of M12 and asked to keep getting the work as a bundle that she pushes herself: "si, pero sigue dándome el bundle, yo los subo".

## What was done

* Started on 28 Oct, where the session stopped before the commit, and finished on 29 Oct. The branch is stacked on `feature/local-scheduled-notifications` (#116), which it needs.
* `domain/settings.ts`: the sections and rows of the screen, each row with its notification kinds, and the payment reminder lead time (0, 1 or 2 days, 2 by default as in the M9 prompt).
* Vault migration 2: table `notifications_preferences (key, value)` for "Permitir notificaciones" and the lead time.
* `application/notificationService.ts`: `settings()`, `setAllowAll()`, `paymentLeadDays()` and `setPaymentLeadDays()`.
  * "Permitir notificaciones" off silences every kind except new devices and keeps each switch's own value for when it is turned back on.
  * Turning a kind or everything off drops its pending reminders on the phone.
* `ui/NotificationSettingsScreen.tsx`: built from the design `CfgNotificaciones`.
  * The bell tile, the title, "Permitir notificaciones", and the sections "Pagos y gastos fijos", "Movimientos y saldos" and "Metas y recomendaciones" with their switches.
  * The chips "El mismo día", "1 día antes" and "2 días antes" under "Recordatorio de pagos".
* `index.ts`: route `notifications.Settings` (`fynk://notificaciones/ajustes`), plus `NotificationSettingsScreen` and `getPaymentReminderLeadDays()`, which M9 will read when it schedules a payment reminder.
* Tests: settings of the service on the sql.js vault, and the screen with its switches, chips, the master switch and both themes.

## Result

* Tests: 57 suites and 753 tests of the app pass. ESLint, `tsc` and Prettier are clean.
* Pull request: not opened yet. Karol pushes the bundle.

## Decisions and problems

* The design and the M12 prompt list different rows.
  * The screen follows the design's layout.
  * It adds the kinds the design lacks, marked for design review: "Aumentos de precio", "Sincronización", "Topes de gasto", and "Nuevos dispositivos" (always on).
* "Gastos grandes" and "Saldo bajo" are in the design but are not kinds of the shared contract, and no module detects them. They are left out until the team decides who builds them and adds the kinds.
* The design says goal notices at "25, 50, 75 y 100 %"; the M8 prompt says 50, 75 and 100. The copy follows the prompt, and this needs a team decision.
* The "Notificaciones" row of Mi cuenta lives in M1's `miCuentaRows.ts`, so it needs a small pull request approved by Daniel, linking it to `notifications.Settings`.
* The backup collection `notifications.settings` (M12 prompt) waits for M2 to export `registerBackupCollection`.
* The pull request is about 740 lines with tests, over the usual 400. It was kept as one because the screen and its settings only make sense together.

## Next step

Merge #116, then open this pull request on `develop`. After that, the Mi cuenta row with Daniel and the backup collection when M2 exports it.
