---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M12
jira: [SCRUM-70]
branch: fix/notifications-use-the-vault
tool: Claude Code
pr: none
status: done
---

# Keep the notifications inbox in M2's vault

## Instruction

Same session as the notification settings. M2's SQLCipher vault (#105) and lock screen (#124, #125) reached `develop`, so the placeholder in M12 could go. Karol approved touching M0's `AppRoot.test.tsx`: "Sí, inclúyelo".

## What was done

* `modules/notifications/adapters/vault/vaultAccess.ts`: now re-exports `getVaultDb` and `registerVaultMigrations` from `@modules/vault`, replacing the stub that read the vault as locked. The inbox, scheduled reminders and settings tables are created when the vault opens.
* `src/app/AppRoot.test.tsx` (M0): its mock of `@modules/vault` gains `registerVaultMigrations` and a `getVaultDb` that throws `VaultLockedError`. Without them the test failed as soon as a module registered its tables while loading. M8 and M9 would hit the same failure.

## Result

* Tests: 67 suites and 949 tests of the app pass. ESLint and `tsc` are clean.
* Pull request: not opened yet. It touches a file of M0, so Sofia reviews it too.

## Decisions and problems

* `vault.unlocked` is emitted by M2's vault, so reminders that fired while the app was closed now reach the inbox when the person unlocks.

## Next step

Open the pull request with Sofia as reviewer. Then try the inbox and a reminder on a phone with the vault unlocked.
