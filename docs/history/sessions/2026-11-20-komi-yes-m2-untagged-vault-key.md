---
date: 2026-11-20
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-96]
branch: fix/vault-adopts-untagged-key
tool: Claude Code
pr: "#431"
status: done
---

# Never open a vault key that has no owner tag

## Instruction

On a physical phone against staging, Daniel signed in with a newly created account. The app showed "Hola, Invitado", skipped the onboarding, and Billetera listed recurring expenses the new account never had. Daniel asked why and then asked to "do the fix of the code that you are proposing so just the owner of the account can get access to their own data and not from another account".

## What was done

* `lockController.ts`, `keyOwner()`: a key with no owner tag now counts as another account's. It is erased and the first phone path runs, in `run()`, `unlockWithPassword()` and `unlockWithBiometrics()`.
* `lockController.ts`, `setUpFirstPhone()`: the tag is written after the wipe and before the new key. With nobody signed in, or a failed tag write, no key is made and the lock screen shows the keychain error.
* `completeRestore.ts`: the restores with the code and with the old phone's approval also write the tag after the wipe and before the key. The step takes the signed in account through a new `userId` dependency, wired in `adapters/defaultLock.ts` and passed through `restoreWithCode.ts`.
* The best-effort `tagOwner()` is removed. It ran on open, after a restore and after the recovery code, and every key now gets its tag when it is written.
* Tests:
  * `lockController.test.ts`: an untagged key is erased on the plain, password and biometric paths. The tag comes after the wipe and before the key. No key is made when the tag write fails or nobody is signed in.
  * `completeRestore.test.ts`: the new order (wipe, owner, write, open), and no key when nobody is signed in.
  * The test fixture now tags a stored key with the signed in account by default.

## Result

* Tests: all 248 mobile suites pass (2907 tests). `tsc --noEmit` is clean, and ESLint and Prettier are clean on `src/modules/vault`.
* Not tried on a phone yet. In staging every `POST /v1/devices` still answers 401, because the API cannot reach Keycloak (M14 is fixing the network). So after the fix, an untagged vault is erased and the new account then stops at "No pudimos abrir tu bóveda" until the device can register.
* The phone evidence: the new account's Billetera showed "Gimnasio $68.000" and another recurring expense of $32.000. That data lives only in the phone's vault, and the phone could not register to create a new vault, so the vault that opened was an older one.

## Decisions and problems

* This reverses a decision in `2026-11-09-komi-yes-m2-vault-owner-binding.md` (#345): "A phone with no tag is adopted by the current account". That rule kept vaults from before 9 November. There are no real users, only the team's test phones, and the rule let one account read another account's vault. A phone that loses its vault this way can still restore its account's backup with the recovery code.
* My first explanation looked at the emulator, where there was no vault file at all. The case was on Daniel's physical phone instead, and the screenshots matched the untagged vault explanation.
* The `vault.wipe()` before a new key also removes the owner tag. So the tag has to be written after the wipe, never before the setup. Otherwise every new key would be untagged and erased on the next open.
* The test "stays locked when a lock arrives while the owner tag is being written" was removed with `tagOwner()`, because the open path no longer writes a tag. `openVault()` still checks the generation after the open.

## Next step

Review #431. After M14's network fix, check on the phone that the old vault is erased and that the new account goes through onboarding.
