---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23]
branch: feature/bank-link-authorizations
tool: Claude Code
pr: none
status: done
---

# Pending consent port and the 10 minute link authorizations (M5 step 2, part 4)

## Instruction

Same session as `2026-10-29-juanleal05-m5-bank-link-settings.md`. Key sentence: "Then let's continue with M5 step 2 as better as possible."

## What was done

* `internal/consents/ports` (M4, same owner): `PendingReader` gives M5 the user's pending consent with the scopes, purpose and term accepted. Another user's consent reads as not found. `ConsentChecker` does not change.
* `internal/bank/store`: the started links, in Redis with a 10 minute TTL and `GETDEL`, so one works once; a memory twin for tests. They hold ids only.
* Tests: the port's three cases; the store rules against memory and against Redis 7 in Docker.

## Result

* Tests: `make lint` and `make test` pass on the whole stack. The Postgres and Redis tests pass against Postgres 16 and Redis 7 in Docker.
* Pull request: not opened yet.

## Decisions and problems

* **A new port instead of a new method on `ConsentChecker`:** the checker is a shared contract, frozen after Gate A.

## Next step

`feature/bank-link-service`.
