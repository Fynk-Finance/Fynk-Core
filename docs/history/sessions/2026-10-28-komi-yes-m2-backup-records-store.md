---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: feature/backup-records-store
tool: Claude Code
pr: none
status: done
---

# Store the encrypted backup records

## Instruction

This is the next step of the M2 plan Daniel approved ("continue"): "PUT /backup/records … 409 stale_version when the version is lower, a 5 MB per-user quota counted with octet_length in the transaction". This PR is the storage half. The HTTP endpoints are the next PR of the stack.

## What was done

* **Migration 2:** a `seq` column from `backup.records_seq`, indexed by user. It is the paging cursor; timestamps are not safe across API instances.
* **`records/`:**
  * the envelope, the limits and the opaque cursor (base64url of the seq, decoded strictly);
  * the service: only an active device may read or write, a batch is stored all or nothing, and `backup.uploaded` is audited with the count only.
* **`postgres/records.go`:**
  * a per-user advisory lock serializes writes and page reads, so seq order is commit order and a page never skips a row committed later;
  * the version check is in the upsert itself (`WHERE version <= EXCLUDED.version`), so a lower version stores nothing and becomes `stale_version`;
  * the quota sums ciphertext plus nonce bytes in the same transaction.
* **Tests:** the service against fakes (pending, removed and unknown devices, stale, quota, cursors, audit meta), and the migration version check.

## Result

* `go vet` and `go test` pass for the backup module, alone on this commit.
* The Postgres integration tests pass with `-p 1` on Postgres 16.15.

## Decisions and problems

* **The implementer stopped on the weekly usage limit** and was resumed after it reset. Its work was split into three PRs to stay near 400 lines: this one is 527 lines, 206 of them tests.

## Next step

The HTTP endpoints (`feature/backup-records-endpoints`).
