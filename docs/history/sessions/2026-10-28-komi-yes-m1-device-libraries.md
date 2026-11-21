---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: chore/add-device-libraries
tool: Claude Code
pr: none
status: done
---

# Add the libraries for the device key pair and the device name

## Instruction

Part of the plan to "finish M1 by finishing the pending task that we left until sofia's PRs were merged". Device registration (next branch) needs a secure random source, an X25519 key pair and the phone's model name. Per CLAUDE.md, adding a library is its own `chore/add-<library>` PR, reviewed by M0. Claude Code (Opus) did this one itself.

## What was done

* **`apps/mobile/package.json` and `pnpm-lock.yaml`:** `expo-crypto` 58.0.7 and `expo-device` 58.0.5 (the versions `npx expo install` picks for SDK 58), and `@noble/curves` 2.4.0. All are pinned exactly: `expo install` writes `~`, which was removed.
* **`apps/mobile/jest.config.js`:** `@noble/curves` ships only ES modules, so it is added to jest-expo's transform list. The pattern is built from jest-expo's own list, so it follows jest-expo upgrades. The config throws if that list ever changes shape.
* **`docs/adr/0001-stack.md`:** one row per library.

## Result

* A throwaway Jest test (not committed) imported the three libraries and computed an X25519 public key. It failed before the Jest change and passed after it.
* `make lint-mobile`, `make test-mobile` (471 tests) and `make format-check` pass.
* `expo prebuild --no-install --platform android` finishes. Neither Expo library needs a config plugin.

## Decisions and problems

* **`@noble/curves` instead of a native module.** It is audited pure JavaScript and runs on Hermes, so there is no native code to build.
* **`expo-device` is used only for the model name,** never a hardware id.

## Next step

`feature/device-registration`: the X25519 key pair in Keychain, `POST /devices` after sign-in, and `GET /devices/current` on start.
