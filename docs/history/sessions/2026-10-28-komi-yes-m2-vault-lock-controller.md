---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-8, SCRUM-6]
branch: feature/vault-lock-controller
tool: Claude Code
pr: none
status: done
---

# The vault's lock states

## Instruction

Step 2 of the M2 plan Daniel approved ("continue"): "lock states locked, unlocking, unlocked; AppState: lock after 5 minutes in the background, and on sign out … unlock with copy A when lastLoginAt() is under 5 minutes old; otherwise 'Ingresar con contraseña' calls reauthenticate(); the setup decision of decision 4".

## What was done

* **`domain/lockPolicy.ts`:** `shouldLock` (more than 5 minutes in the background; exactly 5 doesn't lock) and `isFreshLogin` (a login of the last 5 minutes, tolerating a phone clock up to 5 minutes behind).
* **`application/lockController.ts`:**
  * the states `locked`, `unlocking`, `unlocked`, `pendingDevice` and `error`;
  * **with copy A,** it opens only after a fresh login; otherwise it stays locked until `reauthenticate()` answers `ok`;
  * **without a key,** a pending phone waits for approval, and only an **active** phone gets a new DEK and copy A;
  * it locks on sign out and after more than 5 minutes in the background. A lock during an open closes the vault again;
  * a build without SQLCipher shows `notEncrypted` and is never retried.
* **Identity (M1, SCRUM-6):** `currentDevice()` waits for this sign in's registration before reading. The dev session's phone counts as active.
* **Tests:** the policy, and every state change with fakes and a fixed clock.

## Result

* `make lint-mobile`, `make test-mobile` (58 suites, 803 tests on the top branch) and `make format-check` pass. This commit passes alone too.

## Decisions and problems

* **The implementer stopped on the weekly usage limit** and was resumed after it reset.
* **A bug found in review:** `currentDevice()` is `null` while the phone is still registering, when the API doesn't know it, or right after it was removed. The controller treated `null` as the first phone and made a new DEK: a second phone could get its own key before the API had marked it pending, and a removed phone got a key right after its wipe. Now only `active` makes a key, `null` is an error with a retry, and identity waits for the registration first.
* **A reinstall on an active phone with a recovery key on the server** still counts as the first phone here. The recovery code PR asks the server first. Nothing uploads to the backup before then.
* Split into three PRs (controller, screen, gate) to stay near 400 lines. This one is 632 lines, 444 of them tests.

## Next step

The lock screen (`feature/vault-lock-screen`).
