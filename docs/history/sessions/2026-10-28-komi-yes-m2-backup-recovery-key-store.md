---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: feature/backup-recovery-key-store
tool: Claude Code
pr: none
status: done
---

# Backup schema and the recovery key rules

## Instruction

This is the next step of the M2 plan Daniel approved ("continue"): the backend schema and the rules for the recovery key, including activating a new phone with proof of the key.

## What was done

* **`backup/migrations`:**
  * the three tables of the M2 prompt: `records`, `recovery_keys` and `device_approvals`;
  * `recovery_keys.device_proof_hash`, the SHA-256 of `HKDF(DEK, 'fynk/device-proof/v1')`, never returned;
  * CHECK constraints on the key sizes (48, 12, 16 and 32 bytes);
  * indexes for paging records and for finding approvals.
* **`backup/recovery`:**
  * **`Set`:** only an active device; it replaces the old key, so the old code stops working, and audits `recovery_key.set`.
  * **`Get`:** never returns the hash.
  * **`Activate`:** compares `sha256(proof)` with the stored hash in constant time. On a match it activates the device through identity's `Activator` and audits `device.approved` and `backup.restored` with `method=recovery_code`.
  * **The failure limit:** 5 failed proofs per user per hour. Redis counts them when it's configured, otherwise an in-process rolling window does.
* **`backup/postgres`:** the repository, an upsert.
* **`module.go`:** the schema is migrated. Every route still answers 501 until the endpoint PR mounts them.

## Result

* `make lint-go` passes (0 issues), and so does `make test-go`.
* The Postgres integration tests pass on a throwaway Postgres 16.15. They cover replacing a key, isolation per user and the size check.

## Decisions and problems

* **Split from the endpoints** to keep each pull request under 400 lines. The handlers and the HTTP integration test come in the next PR of the stack.
* **The activation limit is checked before the comparison and counted only on a mismatch.** Two parallel guesses could slip past the count by one. That is acceptable because the proof is 256 bits derived from a 128-bit code: the limit is a second line of defense, not the main one.
* **A failed audit write after activation answers 500.** The device stays active, and a retry is a no-op. This is the same order identity uses.

## Next step

The endpoint PR mounts `PUT` and `GET /backup/recovery-key` and the activate route.
