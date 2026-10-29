---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-8]
branch: chore/add-vault-libraries
tool: Claude Code
pr: none
status: done
---

# Add the vault libraries

## Instruction

This is the M2 plan's library pull request. Daniel approved the plan and said "continue". The M2 prompt lists the libraries: op-sqlite with SQLCipher and FTS5, react-native-argon2, @noble/ciphers and @noble/hashes ("pin versions, record them in `docs/adr/`").

## What was done

* **`apps/mobile/package.json`:** all four pinned exactly:
  * `@op-engineering/op-sqlite` 18.2.5;
  * `react-native-argon2` 4.0.0;
  * `@noble/ciphers` 2.4.0;
  * `@noble/hashes` 2.4.0.

  It also gets the `"op-sqlite": { "sqlcipher": true, "fts5": true }` block.
* **The root `package.json` gets the same block.** pnpm hoists `node_modules` to the root. op-sqlite's podspec searches upwards from there and finds the root `package.json` first, so without it iOS would build without SQLCipher, an unencrypted vault. Gradle reads the app's file.
* **`app.json`:** `NSFaceIDUsageDescription` ("Fynk usa Face ID para desbloquear tu bóveda en este teléfono."). react-native-keychain has no config plugin, and its manifest already declares `USE_BIOMETRIC`.
* **`docs/adr/0001-stack.md`:** one row per library.
* **`pnpm-lock.yaml`:** additions only.

## Result

* `make lint-mobile` passes, and so does `make test-mobile` (44 suites, 615 tests).
* `make format-check` passes.
* Android `expo prebuild` works. iOS prebuild can't run on Windows.
* A throwaway test checked that the noble imports work in Jest and tsc. It was deleted.

## Decisions and problems

* **op-sqlite 18.2.5, not 19.0.2.** 19 came out two days ago with the same peers.
* **react-native-argon2 is a legacy bridge module.** React Native 0.88 loads it through the interop layer. It has to be tried on a phone, with the pure JavaScript Argon2 of @noble/hashes as the slow fallback.
* **The SQLCipher flag only shows in a real build.** The build log should print `[OP-SQLITE] using sqlcipher.`. The vault code will also refuse to open when `PRAGMA cipher_version` is empty.

## Next step

The vault code (`feature/sqlcipher-vault`) uses these libraries.
