---
date: 2026-10-30
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: feature/backup-registry
tool: Claude Code
pr: none
status: done
---

# The backup record envelope and registry

## Instruction

Daniel asked to "continue the implementation of M2 and complete what is left". This is the first half of the backup engine on the phone: seal each record, know which collections take part and which records changed, and talk to `PUT` and `GET /backup/records`.

## What was done

* **`domain/backupEnvelope.ts`:**
  * `backupRecordId`: a UUID stays, and any other id maps to a stable version 8 UUID from SHA-256 of `collection|id`;
  * `sealRecord` and `openRecord`: AES-256-GCM with the record AAD, the plaintext `{id, data}`, and a typed error over 64 KiB.
* **`domain/base64.ts`:** standard base64 with padding, a copy of identity's helpers.
* **`adapters/vault/migrations.ts`:** the table `vault_backup_dirty`, registered in `defaultVault.ts`.
* **`application/backupRegistry.ts`:**
  * `registerBackupCollection` and `markDirty`, with the same rules as the in-memory registry of `@shared/testing`;
  * marks made while locked wait in memory and are written on unlock;
  * an upload clears only the marks it saw.
* **`adapters/api/backupRecordsApi.ts`:** the records API, with base64 fields, `X-Device-Id` and `BackupError` kinds.
* **M1:** `userId()` exported from `@modules/identity` (the `sub` of the session), for the record AAD.
* **Tests:**
  * envelope vectors and tamper cases (ciphertext, nonce, user, collection, id, version, key);
  * a check that the ciphertext never contains the plaintext;
  * the registry rules, the dirty table, and the API with a fake fetch.

## Result

* `make lint-mobile`, `make test-mobile` and `make format-check` pass.
* Pull request: not opened yet.
* Nothing uploads yet. The queue, restore and public exports come in `feature/backup-sync`.

## Decisions and problems

* **The `deleted` flag is not in the AAD,** so `openRecord` also checks that the content agrees with it. A server that flips the flag cannot delete or resurrect a record.
* **`markDirty` is synchronous** and only queues the write, so a module may call it inside its own vault transaction without waiting on it.
* The work was done by a Sonnet 5.5 agent and reviewed by the orchestrating session, which split it from the upload and restore half to keep each pull request reviewable.

## Next step

The upload queue and restore (`feature/backup-sync`).
