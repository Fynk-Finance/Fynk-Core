---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-44]
branch: feature/bank-link-limits
tool: Claude Code
pr: none
status: done
---

# Nonces and the per user rate limit in Redis (M5 step 2, part 7)

## Instruction

Same session as `2026-10-29-juanleal05-m5-bank-link-settings.md`. Key sentence: "Then let's continue with M5 step 2 as better as possible."

## What was done

* `internal/bank/store`: `Nonces` (`SET NX` with a TTL, per user) and `Limiter` (a fixed window that starts at the first query and answers how long until it ends), in Redis and in memory.
* Tests: a replayed nonce, a nonce per user, the limit and its retry time, the limit per user, and a new window after the old one; against memory and against Redis 7 in Docker.

## Result

* Tests: `make lint` and `make test` pass on the whole stack. The Postgres and Redis tests pass against Postgres 16 and Redis 7 in Docker.
* Pull request: not opened yet.

## Decisions and problems

* **A rate limit key left without an expiry gets one again,** so a user can never be blocked forever.

## Next step

`feature/bank-link-queries`.
