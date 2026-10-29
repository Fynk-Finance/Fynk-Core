---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: test/backup-records-integration
tool: Claude Code
pr: none
status: done
---

# Prove the server stores only ciphertext

## Instruction

The M2 prompt's test: "A stored record never contains the plaintext bytes of the test payload". It runs through the real HTTP stack, identity and Postgres.

## What was done

* **`postgres/records_integration_test.go`:**
  * a known plaintext is sealed with AES-256-GCM and uploaded. The raw row text and the bytea columns are searched for it, and it is never there. The API round trip decrypts back to the original.
  * a real pending device gets 403 on GET and PUT, and an unknown device gets 403 on GET;
  * paging with `limit=2` returns every record once in seq order, and a record updated after page 1 comes back at the end;
  * a stale version gets 409, an equal-version retry is accepted, and a duplicate in one batch gets 400;
  * against real rows, 79 full-size records fit the 5 MB quota and the 80th gets 413 with nothing stored. A smaller new version then lets the batch fit.

## Result

* The integration tests pass with `-p 1` on Postgres 16.15, together with identity and migrate.

## Next step

The device approval endpoints (`feature/device-approval-endpoints`).
