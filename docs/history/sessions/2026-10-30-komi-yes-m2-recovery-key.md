---
date: 2026-10-30
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: feature/recovery-key
tool: Claude Code
pr: none
status: done
---

# Wrap the vault key with the recovery code

## Instruction

Daniel asked to "continue the implementation of M2 and complete what is left". This is the first half of the recovery code (HU-045). It turns a new recovery code into the wrapped DEK the server stores with `PUT /backup/recovery-key`.

## What was done

* **`domain/recoveryKey.ts`:**
  * the contract's Argon2id parameters (64 MiB, 3 passes, 1 lane), a 16-byte salt, and the AAD `fynk/recovery/v1`;
  * `wrapDek` and `unwrapDek` over AES-256-GCM.
* **`domain/recoveryCode.ts`:** `matchesRecoveryGroup`, for typing the last group back. It is tolerant to spaces, lowercase and I, L, O.
* **`domain/base64.ts`:** standard base64 with padding for the API fields.
* **Ports:** `RecoveryKdf`, `RecoveryKeyApi`, `RandomBytes` and `RecoveryError`.
* **`adapters/crypto/argon2Kdf.ts`:**
  * `react-native-argon2` with exactly the contract's parameters, and the hex hash converted to 32 bytes;
  * it loads on first use, because the library reads its native module while loading.
* **`adapters/api/recoveryKeyApi.ts`:**
  * GET answers null on `recovery_key_not_found`;
  * PUT sends the wrapped DEK, nonce, salt, parameters and the device proof hash.
* **`application/recoveryCode.ts`:**
  * `prepare(dek)` makes the code and the wrapped DEK in memory;
  * `commit()` is the only upload.
* **Tests:** wrap and unwrap vectors, and a changed byte, nonce, key or AAD fails. Also the KDF parameters, the API with a fake fetch, and the service with a fake KDF.

## Result

* `make lint-mobile`, `make test-mobile` and `make format-check` pass.
* Pull request: not opened yet.
* Nothing shows the code yet. The screens come in `feature/recovery-code`.

## Decisions and problems

* **The Argon2 password is the canonical 26-character code.** The parameters are the contract's and were not changed.
* **Nothing is uploaded until `commit()`.** The code lives only in memory while it is shown.
* Only a phone can measure Argon2id's time and memory through the legacy bridge.
* The work was done by a Sonnet 5.5 agent and reviewed by the orchestrating session, which split it from the screens to keep each pull request reviewable.

## Next step

The recovery code screens (`feature/recovery-code`).
