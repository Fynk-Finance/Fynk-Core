---
date: 2026-11-20
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-96]
branch: fix/vault-legacy-erase-and-account-switch
tool: Claude Code
pr: "#443"
status: done
---

# Erase the single vault from before slots, and reset the backup state on an account switch

## Instruction

Second part of Daniel's request to keep "one vault per account" on the phone. The pull request below gives each account its own file and Keychain entries. This one changes the lock controller to match.

## What was done

* `application/lockController.ts`:
  * `keyOwner()` now answers `mine` or `corrupt`. Each account only reads its own slot, so a tag that is missing or names another account means the slot is damaged. `eraseCorruptSlot()` erases only that slot, then the first-phone path runs.
  * `run()` first erases the legacy single vault through the new `eraseLegacy` dependency. If the erase fails, the result is the keychain error and nothing is read, and the erase runs again on the next open.
  * With nobody signed in, `run()` reads no key.
  * When the signed in account differs from the account of the last run, `run()` calls `resetBackupState()` before reading the key. The backup marks kept in memory for the previous account then never reach the new account's vault. The old erase path did this reset, and the per-account vault had lost it. I found it in review.
* `adapters/legacyVault.ts`: erases `fynk-vault.db` and the four Keychain services without a slot, once per phone, and keeps a mark (`co.fynk.app.vault.legacyErased`). It never touches a slot.
* `adapters/defaultLock.ts`: wires `eraseLegacy`.
* Tests:
  * `lockController.test.ts`:
    * A sets up, B sets up without touching A, and A opens again with its own key and no setup.
    * B never gets A's key.
    * A mismatched tag erases only that slot.
    * The legacy erase runs first and only once.
    * A failed legacy erase fails closed.
    * Nobody signed in reads no key.
    * Sign out only closes the vault.
    * The backup state is reset on every account switch and not for the same account.
  * The old "vault owner" tests now run on the account's own slot under `owner tag inside a slot`.
  * `legacyVault.test.ts`: the erase runs once, a missing file is fine, and a failed removal is not marked done.

## Result

* `tsc --noEmit` is clean. The whole mobile suite passes: 251 suites, 2939 tests. ESLint and Prettier are clean on `src/modules/vault` and `identity/index.ts`. The implementer saw the new tests fail before the code: 5 lock controller failures in the first round, and 8 failures across the follow-up tests of both pull requests.
* Not tried on a phone yet. The first open after the update erases the vault from before slots, so each test phone needs its recovery code once.

## Decisions and problems

* A key without a tag in the account's own slot is still erased. A slot always gets its tag before its key, so an untagged key means something went wrong.
* Erasing the legacy vault follows #431: there are only team test phones, and the recovery code restores the backup.

## Next step

On the emulator:
1. A finishes onboarding and links banks, then signs out.
2. B signs in and finishes onboarding, then signs out.
3. A signs in again and goes straight to the lock screen or Inicio, with its banks and no onboarding.
4. B again sees B's data.
