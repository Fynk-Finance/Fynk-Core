---
date: 2026-10-30
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: feature/backup-sync
tool: Claude Code
pr: none
status: done
---

# Upload and restore the encrypted backup

## Instruction

Daniel asked to "continue the implementation of M2 and complete what is left". This is the second half of the backup engine on the phone. It uploads the changed records while the app is open and restores everything on a new phone, against the finished `PUT` and `GET /backup/records`.

## What was done

* **`application/backupSync.ts`:**
  * the upload runs 5 s after the last change, and at once when the app leaves the foreground;
  * it sends batches of 200, one upload at a time, and clears only the marks it saw;
  * a 409 downloads the newer versions, imports them and retries once;
  * `restoreAll` downloads every page and keeps the highest version of each record;
  * `exportAll` is for M13's data export.
* **`adapters/appStateBackup.ts`:** the AppState watcher for the background flush.
* **`adapters/defaultBackup.ts`:** the default registry and sync, reading copy A for the backup key.
* **`index.ts`:**
  * exports `registerBackupCollection`, `markDirty` and `exportAll`;
  * `wipe()` clears the backup state;
  * `restoreAll` stays inside the module for the restore screens.
* **Tests (fake timers and a sql.js vault):**
  * the debounce, the background flush, 201 records split 200 + 1, and a mark during an upload;
  * 409, 403 and offline;
  * restore paging (a full last page, then an empty one), the highest version, and unknown collections;
  * marks made while locked.

## Result

* `make lint-mobile`, `make test-mobile` (116 suites, 1447 tests) and `make format-check` pass.
* Pull request: not opened yet.

## Decisions and problems

* **The key cache lives in the sync,** and is dropped on `vault.locked` and on wipe, so it never outlives an unlocked vault.
* **A record the API would refuse (over 64 KiB) stays dirty** and does not block the rest of the batch.
* **The 409 retry works because the server refuses only a lower version than the stored one.** After the import, the local version is at least the remote one.
* **`importAll` is called only for collections that have records** in the download.
* **New error kind `noKey`** for `restoreAll` when the key or the account is missing.
* **A server that repeats its cursor** stops the restore with an error instead of looping.
* **The dev session has no registered device,** so the backup stays off there.
* **Only a phone can check** the dirty table upsert on SQLCipher, the AppState flush, and the real quota and cursor.
* The work was done by a Sonnet 5.5 agent and reviewed by the orchestrating session, which split the branch in two to keep each pull request reviewable.

## Next step

The restore screens on a new phone (`feature/restore-with-recovery-code`), which call `restoreAll` after the phone gets the DEK.
