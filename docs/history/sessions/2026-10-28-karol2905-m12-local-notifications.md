---
date: 2026-10-28
developer: Karol
github: Karol2905
module: M12
jira: [SCRUM-70]
branch: feature/local-scheduled-notifications
tool: Claude Code
pr: none
status: done
---

# Scheduled reminders as local notifications (M12 step 2)

## Instruction

After #100 and #108 (expo-notifications) were merged, Karol asked what could go on while M2's vault is still open: "revisa en que podemos seguir". Step 2 of M12 no longer waited for anything, so Claude took it.

## What was done

* `application/ports.ts`: new `LocalNotifier` port (permission, ask, schedule, cancel), and three store methods to keep the OS id of each reminder (`os_id` was already in the table).
* `application/notificationService.ts`:
  * `schedule` asks the phone for a local notification at the reminder's time. The first time, it asks permission after a short explanation. Without permission the reminder still reaches the inbox.
  * Scheduling the same id again replaces the OS notification, and `cancel` removes it.
  * Turning a kind off cancels its pending reminders.
  * A time already passed goes straight to `deliverDue`, and an OS failure never breaks `schedule`.
* `adapters/os/expoLocalNotifier.ts`: the port on expo-notifications, with a date trigger.
  * Lock screen privacy: an Android channel with `VISIBILITY_PRIVATE`, and an iOS category with `previewPlaceholder` ("Abre Fynk para ver el detalle.").
  * The explanation before the OS prompt is a native dialog ("Activa los recordatorios", "Ahora no", "Continuar").
  * Listeners: a fired reminder goes into the inbox, a tap opens its `deepLink`, including the tap that launched the app.
* `index.ts`: the service gets the notifier. The listeners start the first time the vault opens, so nothing native runs before there is an inbox (and Jest never touches the native module).
* Tests: 7 for the service with a fake notifier on the sql.js vault, and 11 for the adapter with expo-notifications mocked.

## Result

* Tests: 55 suites and 738 tests of the app pass. ESLint, `tsc` and Prettier are clean.
* Pull request: not opened yet.
* Not checked on a phone yet. The criterion's manual test is still to do: on a real Android and iPhone, a reminder fires with the app closed and the amount is hidden on the lock screen.

## Decisions and problems

* The explanation is a native dialog, not a designed screen: the design has none. It is listed for design review.
* Android's private visibility hides the whole content on a secure lock screen, title included. That is stricter than "title only", and no amount ever shows.
* ESLint's `import/namespace` did not see the Android enums through `Notifications.*`, so they are imported by name.

## Next step

Open the pull request. Then do the manual test on a phone once the vault and the lock screen of M2 are in `develop`. After that, `feature/notification-settings` (step 3).
