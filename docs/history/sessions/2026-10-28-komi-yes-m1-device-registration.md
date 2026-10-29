---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: feature/device-registration
tool: Claude Code
pr: none
status: done
---

# Register the phone as a linked device and notice when it was removed

## Instruction

Part of the plan to "finish M1 by finishing the pending task that we left until sofia's PRs were merged". The backend devices endpoints (#71) were in `develop`, but the app never registered a device, and `deviceId()` always returned null. Claude Code (Opus) planned and reviewed the work. A Sonnet subagent wrote it, and Claude Code ran the checks again itself.

## What was done

* **`domain/device.ts`:** the stored record and its strict parser, the display name rule (trimmed, never empty, at most 64 characters), and a base64 encoder (Hermes has no `Buffer`).
* **`application/deviceService.ts`:**
  * The first sync makes an X25519 key pair and registers it with `POST /devices`. The Idempotency-Key is saved before the call, so a retry after a crash reuses it.
  * Later syncs call `GET /devices/current`:
    * `device_removed` (410) clears the id, signs out and wipes the vault;
    * `device_not_found` (404) registers again (idempotent for the same key);
    * offline errors keep everything for next time.
  * `device_key_removed` (409) makes a new key pair and retries once.
  * Concurrent syncs share one run.
  * `forget()` drops the id on sign out, and a run that started before the sign out keeps nothing.
* **`application/deviceSessionSync.ts`:** sync on every move into signed in (sign in, sign up, restore at start); forget on sign out.
* **Adapters:**
  * the Keychain store (service `co.fynk.app.identity.device`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, no cloud sync);
  * the API calls through the shared client;
  * `expo-crypto` with `@noble/curves` for the key pair;
  * `expo-device` for the model name.
* **`index.ts`:** wires it all and exports the real `deviceId()`. The dev session (`EXPO_PUBLIC_DEV_AUTH=dev-token`) registers nothing.
* **`vault/index.ts` (M2, same developer):** placeholders `wipe()`, `UnlockSetting` and `RecoveryCodeRow` until M2 builds them.
* **Tests:** one test file per new file, with fakes for every port. The x25519 test checks the RFC 7748 test vector.

## Result

* `make lint-mobile`, `make test-mobile` (512 tests) and `make format-check` pass.
* Not run on a phone. To check on an emulator:
  * Keychain writes;
  * X25519 on Hermes;
  * that a device removed from another phone signs this one out on its next start.

## Decisions and problems

* **404 registers again instead of signing out.** Only 410 (removed) signs out. A 404 happens after a server reset, or when another account signs in on this phone, and signing out there would loop. Registration is idempotent for the same public key, so registering again is safe.
* **The key pair outlives a sign out, and the device id does not.** The same person signing in again gets the same device row back instead of a new pending one. Another account gets its own row with the same key, which the server allows (`unique (user_id, public_key)`).
* **Claude Code added two things in review:**
  * a guard so that a sync reading the Keychain during a sign out keeps no id, plus its test;
  * one dev-auth check in `index.ts` instead of two.
* **The private key** never leaves the Keychain adapter and the key generator. Nothing is logged.
* **The PR is about 460 lines of code plus tests,** a little over the usual size. The ports, adapters and service only make sense together.

## Next step

`feature/mi-cuenta-screen`, after #74 (libraries) and #75 (Badge).
