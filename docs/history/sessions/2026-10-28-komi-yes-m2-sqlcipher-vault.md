---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-8]
branch: feature/sqlcipher-vault
tool: Claude Code
pr: none
status: done
---

# The SQLCipher vault engine

## Instruction

This is step 1 of the M2 plan Daniel approved ("continue"): "VaultDb, migrations runner, key copy A, lock states, wipe. Test that the file cannot be read without the key." The lock states come in the next PR.

## What was done

* **`adapters/sqlite/opSqliteDriver.ts`:** op-sqlite with SQLCipher.
  * op-sqlite passes `encryptionKey` straight to `sqlite3_key_v2` (read in `OPBridge.cpp`). The DEK goes as SQLCipher's raw key `x'<64 hex>'`, so there is no passphrase derivation on top.
  * op-sqlite is loaded lazily, so importing `@modules/vault` touches no native code.
* **`application/vault.ts`, the engine:**
  * **Refuses to open when `PRAGMA cipher_version` is empty.** A build without SQLCipher must never write a plain file. It then reads `sqlite_master`, so a wrong key fails at once.
  * **Runs each module's migrations** in registration order, tracked in `vault_migrations(module, version, applied_at)`. It checks the `<module>_` table prefix and the versions. A module that registers after unlock gets its tables right away.
  * **One queue for everything:** transactions, migrations, and statements outside a transaction. A statement never lands inside another module's open transaction, where it would be rolled back with it.
  * **A kept `VaultDb` throws `VaultLockedError`** once the vault is closed.
  * **`wipe()`** closes, deletes the file and always removes both copies of the key, even if the delete fails. Without its key, a left-over file can never be read. It then emits `vault.locked`.
* **`adapters/keychain/dekStore.ts`:**
  * copy A in `co.fynk.app.vault.key`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, no cloud sync;
  * `co.fynk.app.vault.key.biometric` is reserved for copy B;
  * a corrupt entry reads as no key.
* **`index.ts`:** the real `registerVaultMigrations`, `getVaultDb` and `wipe`. M1 already calls `wipe` on a removed phone; with no vault yet it just clears the keychain.
* **Tests:**
  * the engine on a real SQLite (sql.js), plus a fake for the SQLCipher check;
  * the op-sqlite open options and pragmas, with a mock;
  * the keychain options;
  * random DEK creation.

## Result

* `make lint-mobile`, `make test-mobile` (50 suites, 682 tests) and `make format-check` pass.

## Decisions and problems

* **Three fixes made during review:**
  * statements outside a transaction now wait in the queue;
  * a kept `VaultDb` checks the lock;
  * `wipe` removes the keys in a `finally`.
* **"The file cannot be read without the key" can only be shown on a phone.** SQLCipher is native and Jest runs on Node. On a phone: open `fynk-vault.db` with `sqlite3` and expect "file is not a database". The `cipher_version` guard stops a build without SQLCipher from writing anything.
* **Nothing opens the vault yet.** The lock screen PR wires it to the session.

## Next step

Lock states, AppState and the lock screen.
