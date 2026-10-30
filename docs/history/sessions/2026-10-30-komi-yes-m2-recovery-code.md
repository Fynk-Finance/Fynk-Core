---
date: 2026-10-30
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62, SCRUM-5]
branch: feature/recovery-code
tool: Claude Code
pr: none
status: done
---

# The recovery code

## Instruction

Build HU-045 on the finished backend (`PUT` and `GET /backup/recovery-key`): make the recovery code on the first phone, wrap the DEK with a key from the code, show the code once and ask for its last group before uploading. Also "Generar un código nuevo" in Seguridad, and the M1 criterion of SCRUM-5, "Al terminar el registro se genera el código de recuperación".

## What was done

* **Domain:** `recoveryKey.ts` (`wrapDek`, `unwrapDek` with the AAD `fynk/recovery/v1`, the contract's Argon2 parameters), `matchesRecoveryGroup` in `recoveryCode.ts`, and `base64.ts` for the API fields.
* **Ports and adapters:** `RecoveryKdf`, `RecoveryKeyApi`, `RandomBytes`, `RecoveryError`; `argon2Kdf` over `react-native-argon2` and `recoveryKeyApi` over the shared client.
* **Service:** `createRecoveryCodeService`. `prepare(dek)` makes the code, derives the key and wraps the DEK, and `commit()` is the only upload. `confirmRecoveryCode` compares the typed last group and then commits.
* **Lock controller:** new state `recoveryCode`. The first phone asks the server first: a recovery key means a backup exists, so it makes no key (`pendingDevice`), and a failed question is `offline`. After any open with a key, an active device asks the server and shows a new code when there is none. A network error leaves the vault unlocked.
* **UI:** `RecoveryCodeScreen` (two steps), shown by `VaultFlow` and by the pushed `NewRecoveryCodeScreen`; `RecoveryCodeRow` under "Desbloqueo" in Seguridad. The Maestro signup flow now saves the code.

## Result

* `make lint-mobile`, `make test-mobile` (119 suites, 1445 tests) and `make format-check` pass.
* Not run: the Maestro flow, which needs an emulator and the local Keycloak.

## Decisions and problems

* **The check after an open does not block it.** The vault shows as unlocked at once and the server check runs afterwards, so an offline phone opens normally. When the answer is "no recovery key", the flow replaces the tabs. This can flash the tabs for a moment.
* **The password step of "Generar un código nuevo" runs when the screen opens**, not on the row's tap, so the `boveda/recuperacion` deep link cannot skip it. `UnlockSetting` asks inside the controller on the action; this one asks inside `prepareNewRecoveryCode`.
* **`react-native-argon2` is loaded on first use** (`require` inside `argon2Kdf`). Its native module is read while the library loads, which broke the identity tests that import the vault index.
* The shared `fonts` token has no "mono" family; the code uses `fonts.amount.semibold` (IBM Plex Mono).
* The Argon2 password is the canonical 26 character code. The parameters are the contract's and were not changed.

## Next step

The restore on a new phone with the recovery code, and the backup records sync.
