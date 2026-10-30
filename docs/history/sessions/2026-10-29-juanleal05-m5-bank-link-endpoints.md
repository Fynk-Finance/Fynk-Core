---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23, SCRUM-44]
branch: feature/bank-link-endpoints
tool: Claude Code
pr: none
status: done
---

# Serve the link endpoints and install the real revoker (M5 step 2, part 6)

## Instruction

Same session as `2026-10-29-juanleal05-m5-bank-link-settings.md`. Key sentence: "Then let's continue with M5 step 2 as better as possible."

## What was done

* `server.go`: `POST /bank/authorizations` (201) and the exchange (200), with stable problem codes and `Cache-Control: no-store` on every bank answer.
* `wiring.go`: `bank.New` builds the Banco Demo and Billetera Demo adapters only when every setting is there, then installs the real revoker, which turns on M4's notices to the bank. Otherwise the link answers 503 `provider_unavailable`.
* Tests: start and exchange over HTTP, a second exchange refused, the error codes, both adapters built and the revoker installed with full settings, and each missing setting disabling the link.

## Result

* Tests: `make lint` and `make test` pass on the whole stack. The Postgres and Redis tests pass against Postgres 16 and Redis 7 in Docker.
* Pull request: not opened yet.

## Decisions and problems

* **A missing or broken key logs one line at startup and fails closed**, instead of stopping the API.

## Next step

`feature/bank-link-limits`.
