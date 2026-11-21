---
date: 2026-11-09
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-96]
branch: fix/vault-owner-binding
tool: Claude Code
pr: "#345"
status: done
---

# Tie the vault key to the account that created it

## Instruction

Daniel reported that creating an account and entering the Mailpit code sent them back to the first screen with an error: "no pudimos verificar tu contraseña, intenta de nuevo". Daniel asked why, and chose "Erase local, start fresh" for when a different account signs in on the same phone.

## What was done

* `DekStore` port and `adapters/keychain/dekStore.ts`: `readOwner` and `writeOwner` under a new Keychain service, `co.fynk.app.vault.owner`. `removeAll` removes it too.
* `lockController.ts`: an owner check before any existing key is used, in `run()`, `unlockWithPassword()` and `unlockWithBiometrics()`. Another account's key is erased with `vault.wipe()` and the first phone path runs. The tag is written at setup and at every move to `unlocked`.
* `adapters/defaultLock.ts`: wires `userId` and `resetBackupState`.
* `CLAUDE.md`, "Where data lives": a row for the vault owner.
* Tests in `lockController.test.ts` (`vault owner`) and `dekStore.test.ts` (`owner tag`).

## Result

* Tests: 906 pass in `src/modules/vault` and `src/modules/identity`, `tsc` clean. ESLint and Prettier clean on the changed files.
* On the Android emulator, with the whole stack and two test accounts: the second account got its own recovery code and an empty vault, with nothing from the first. The first account, back on the phone, got "Restaurar en un teléfono nuevo" and its recovery code worked, so its cloud backup was not overwritten.
* Pull request: #345.

## Decisions and problems

* Rejecting another account on the lock screen is correct. Without that, anyone holding the phone could open the vault with their own login. The bugs were the wrong message and no way out (next pull request).
* The bug found on the way: the key was not tied to any account, so a second account signing in got the first account's vault.
* A phone with no tag is adopted by the current account, because phones set up before this fix have none.
* A session that ended during an unlock has no `userId`. The first version read that as "another account" and could erase the vault. It now fails closed with a keychain error and no wipe.
* A lock that arrived during the tag write left the app marked as unlocked over a closed vault. Fixed with a generation check and a test.

## Next step

Sofia reviews the `CLAUDE.md` row, which is an M0 file.
