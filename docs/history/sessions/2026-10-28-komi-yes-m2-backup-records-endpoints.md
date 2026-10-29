---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: feature/backup-records-endpoints
tool: Claude Code
pr: none
status: done
---

# Serve the backup records endpoints

## Instruction

The HTTP half of the records step of the M2 plan: "PUT /backup/records: at most 200 records … MaxBytesReader; GET /backup/records with an updatedAfter cursor and a page limit".

## What was done

* **`records_http.go`:**
  * a batch of 1 to 200 records, strict base64, a 12-byte nonce, ciphertext from 16 bytes to 64 KiB, a `module.name` collection, and no duplicate record in one batch;
  * a 400 names only the field, never a value;
  * the upload body is capped at 6 MiB, which answers 413 `quota_exceeded`, because a bigger body can never fit the quota;
  * `GET` takes `limit` (1 to 500, 200 by default) and the opaque `updatedAfter` cursor, and returns `nextCursor` while a page is full;
  * a pending device gets 403 `device_not_active`.
* **`module.go`:** mounts the two routes behind `auth.Require`, next to the recovery key routes.
* **`app/app_test.go` (M0):** `/v1/backup/records` is no longer a 501 stub, so that one path leaves the stub list. `/v1/device-approvals/pending` still covers the backup stub.
* **Tests:** every status of both operations, the body limit, and no ciphertext in any problem.

## Result

* `go vet` and `go test` pass for the backup and app packages.
* `make test-go` passes. Redocly prints warnings about other modules' contracts, which are not errors.

## Decisions and problems

* **GET has no 400 in the contract,** so a bad cursor or limit goes through the generated default response with status 400.
* **The test edit in `app_test.go` is outside the module.** It is one line and is flagged for @sofia-ariza-783 in the PR.

## Next step

The integration test of the stored ciphertext (`test/backup-records-integration`).
