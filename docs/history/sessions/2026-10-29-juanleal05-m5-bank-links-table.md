---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23]
branch: feature/bank-links-table
tool: Claude Code
pr: none
status: done
---

# The bank.links table and its store (M5 step 2, part 3)

## Instruction

Same session as `2026-10-29-juanleal05-m5-bank-link-settings.md`. Key sentence: "Then let's continue with M5 step 2 as better as possible."

## What was done

* Migration 1 of the `bank` schema: `links` exactly as the M5 prompt defines it, plus one link per consent (`consent_id` unique), a 32 byte fingerprint, and a check that a revoked link always has its date.
* `internal/bank/link`: the `Link` type, `UsableBy` (only its user on its device, and only while active) and the `Store` port.
* `internal/bank/store`: Postgres and memory stores. `Rotate` changes the fingerprint only from the current one, in one conditional update.
* Tests: one set of store tests run against both stores; on Postgres 16 in Docker they pass, including two concurrent refreshes where only one wins.

## Result

* Tests: `make lint` and `make test` pass on the whole stack. The Postgres and Redis tests pass against Postgres 16 and Redis 7 in Docker.
* Pull request: not opened yet.

## Decisions and problems

* **The table is already in CLAUDE.md, Where data lives** ("Bank link record with a KMS HMAC fingerprint of the token"), so nothing new is stored.
* **M0's `cmd/migrate` and `internal/app` tests needed no change.**

## Next step

`feature/bank-link-authorizations`.
