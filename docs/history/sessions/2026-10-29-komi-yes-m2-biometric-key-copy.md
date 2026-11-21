---
date: 2026-10-29
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-7]
branch: feature/biometric-key-copy
tool: Claude Code
pr: none
status: done
---

# Unlock the vault with copy B of the key

## Instruction

Step 3 of the mobile plan Daniel approved ("continue"): "copy B with accessControl BIOMETRY_CURRENT_SET … If the read fails because of a new enrollment, delete copy B, ask for the password, and turn the switch off … Turning it on needs lastLoginAt() under 5 minutes, otherwise it calls reauthenticate() first."

## What was done

* **`dekStore.ts`, copy B** in `co.fynk.app.vault.key.biometric`:
  * `BIOMETRY_CURRENT_SET`, `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`, no cloud sync, and Android's biometric-bound `AES_GCM` storage. The options were checked in the react-native-keychain 10.0.0 source;
  * `hasGenericPassword` tells whether copy B exists without a prompt. That existence is the setting, with no other flag;
  * a read is `ok`, `cancelled`, `invalidated` or `failed`. Only the error's code and message are read, and never logged;
  * `removeAll()` removes copy B even when removing copy A fails.
* **`lockController.ts`:**
  * `unlockWithBiometrics()`: an invalidated copy is deleted and the lock screen says biometrics were turned off. A cancel stays locked without an error;
  * `autoPromptBiometric()` prompts once per lock;
  * `enableBiometrics()` needs a fresh login or `reauthenticate()` first, then copies A into B. `disableBiometrics()` deletes B.
* **Tests:** the Keychain options, the error classes, and every controller path, including "copy B disappears after an enrollment change".

## Result

* `make lint-mobile` and the vault, identity and app tests pass on this commit alone.

## Decisions and problems

* **Review fix:** `removeAll()` now removes copy B in a `finally`.
* `securityLevel` stays at the default. `SECURE_HARDWARE` fails on emulators and some phones.

## Next step

The button and the setting (`feature/biometric-unlock`).
