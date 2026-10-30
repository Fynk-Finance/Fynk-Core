---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23, SCRUM-44]
branch: feature/bank-link-service
tool: Claude Code
pr: none
status: done
---

# Start a link with PAR and finish it with the PKCE exchange (M5 step 2, part 5)

## Instruction

Same session as `2026-10-29-juanleal05-m5-bank-link-settings.md`. Key sentence: "Then let's continue with M5 step 2 as better as possible."

## What was done

* `internal/bank/service`, the same for every bank because it only uses `ports.Provider`:
  * `CreateAuthorization`: a trusted device, the user's pending consent for that entity, and a PAR with exactly what was accepted, a nonce, the PKCE challenge and the state;
  * `Exchange`: once, for the same user and device, before it expires; the code with the verifier; `MarkGranted` with the bank's consent id; the link with the fingerprint; `bank.link_created` with M13's allowed keys; the tokens returned and never stored.
* Tests, against a fake provider: the PAR contents, every refused start, a granted consent cannot start again, the exchange result and the stored fingerprint, the audit keys, once-only and expiry, and a rejected code granting nothing.

## Result

* Tests: `make lint` and `make test` pass on the whole stack. The Postgres and Redis tests pass against Postgres 16 and Redis 7 in Docker.
* Pull request: not opened yet.

## Decisions and problems

* **Tested against a fake provider,** because Banco Demo has no authorization page yet. This proves M5's logic, not a bank.

## Next step

`feature/bank-link-endpoints`.
