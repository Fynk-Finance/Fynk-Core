---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23, SCRUM-44]
branch: chore/bank-link-settings
tool: Claude Code
pr: none
status: done
---

# Optional settings of the bank link in M0's config (M5 step 2, part 1)

## Instruction

After opening the M4 step 4 pull requests, the developer asked to continue with M5 step 2. Key sentence: "Then let's continue with M5 step 2 as better as possible." Before starting, the developer chose a small M0 pull request for the new settings and local keys now, with KMS in a follow-up (asked with two questions). M5 step 2 does not depend on the mobile stack #122, so it is a new stack from `develop`, split into eight branches to stay near 400 lines each.

## What was done

* `platform/config` (M0): `BANK_SIGNER_KEY_FILE`, `BANK_FINGERPRINT_KEY_FILE`, `BANK_REDIRECT_URI` (default `fynk://bank/callback`), `BANCO_DEMO_CLIENT_ID`, `BANCO_DEMO_ISSUER`, `BANCO_DEMO_AUTHORIZE_URL`. All optional. Outside local the authorize URL must be https.
* `services/api/.env.example`: the six variables, commented out, with the `openssl` commands for fake local keys.
* Tests: three new config tests; `TestLoadReadsEveryValue` only gets the redirect default.

## Result

* Tests: `make lint` and `make test` pass on the whole stack. The Postgres and Redis tests pass against Postgres 16 and Redis 7 in Docker.
* Pull request: not opened yet.

## Decisions and problems

* **The developer approved the M0 change first,** as with #53. Sofia reviews it.
* **Nothing is required,** so staging keeps starting; without the settings the link fails closed.
* **`docker-compose.yml` and `make certs` are unchanged.** Whether they should create and pass the local keys is left to Sofia.

## Next step

`feature/bank-link-signer`.
