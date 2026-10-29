---
date: 2026-10-28
developer: Karol
github: Karol2905
module: M12
jira: [SCRUM-70]
branch: feature/notifications-port-and-inbox
tool: Claude Code
pr: none
status: partial
---

# NotificationsPort on the vault (second branch of the M12 stack)

## Instruction

Same session as `feature/notifications-inbox-rules`: start M12 with step 1 of its work plan. This branch has the tables and the port.

## What was done

* `adapters/vault/migrations.ts`: tables `notifications_inbox` (unique `dedupe_key`), `notifications_scheduled` and `notifications_settings`, as in the M12 prompt.
* `adapters/vault/vaultInboxStore.ts`: the `InboxStore` port of `application/ports.ts` on `VaultDb`. Times are stored as normalized ISO text so they sort and compare as text.
* `application/notificationService.ts`: implements the shared `NotificationsPort` plus the inbox actions. `notify` ignores a known dedupe key and a kind that is off, and trims the inbox to 200 rows. `schedule` stores the reminder (and does nothing for a kind that is off). `deliverDue` moves reminders whose time has passed into the inbox at their own time. `markRead`, `markAllRead`, `subscribe`.
* `adapters/vault/vaultAccess.ts`: M2 has not merged `getVaultDb` and `registerVaultMigrations` into develop, so for now the vault reads as locked and the migrations wait. When M2 merges, this file becomes a one line re-export from `@modules/vault`.
* `index.ts` exports `notificationsPort` and delivers due reminders on `vault.unlocked`. The inbox route is still M0's placeholder.
* Tests: 16 for the service on a real SQLite vault (sql.js) with the module's migrations, plus `index.test.ts`, which checks the exports and that no file of the module asks for a push token.

## Result

* Tests: 33 in the module pass, and the app registry and linking tests still pass. ESLint, `tsc` and Prettier are clean.
* Pull request: not opened, the session cannot push (see the first branch).
* The port works on the in-memory vault. In the app it reports `VaultLockedError` until M2's vault is merged.

## Decisions and problems

* While the vault is locked the port throws `VaultLockedError` instead of dropping the notification silently, so the caller knows nothing was stored.
* The OS notification of `schedule` (expo-notifications, permission screen, lock screen privacy) is step 2 of the work plan, `feature/local-scheduled-notifications`.

## Next step

When M2 merges the vault, replace `vaultAccess.ts` with the re-export and run the tests again.
