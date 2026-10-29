---
date: 2026-10-27
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-20, SCRUM-21]
branch: feature/consents-schema-and-store
tool: Claude Code
pr: none
status: done
---

# Consents schema, text seed and Postgres store (M4 step 1, part 2 of 4)

## Instruction

Same session as `feature/consents-domain-rules`. This is the second of the 4 stacked branches of `feature/consents-backend`, which the developer chose to split to respect the 400-line guideline.

## What was done

* `internal/consents/migrations/1_create_consents`: tables `consent_texts` and `consents` as written in the M4 prompt, plus:
  * an `idempotency_key` column, unique per user, so `POST /consents` honours `Idempotency-Key` (shared contracts, section 1);
  * checks: `status` in the five values, at least one scope, the five evidence keys present, and an `active` row always with `granted_at`, `expires_at` and `provider_consent_id`;
  * indexes for the user's list and for the expiry job.
* `2_seed_consent_text`: text `2026-10-v1`, written only from the Conectar banco copy in the M4 prompt (receiver, data, purpose, term, what Fynk can never do, revocation, checkbox). Postgres computes the SHA-256.
* `store/postgres.go`: texts, insert with idempotency, get, list newest first, activate only while pending, and expire due consents with one `UPDATE ... RETURNING`, so each consent is reported once even with several API instances.
* `consents/module.go`: the module returns its migrations (routes are still the stub).
* `cmd/migrate/main_test.go` (M0's file, approved by the developer, Sofia asked to review): the test assumed no module has SQL. It now checks that exactly the schemas with SQL try to connect to the unreachable database.
* Integration tests (`-tags integration`, real Postgres 16): seeded text and hash, round trip with grant and expiry once, idempotency per user, the database refuses an active consent without its grant and a consent without evidence, a non-UUID id is not found.

## Result

* Tests: unit suite passes; the 5 store integration tests pass against `postgres:16.15-alpine` in Docker; `go run ./cmd/migrate up` applies version 2 and a second run changes nothing. golangci-lint is clean.
* Pull request: opened right after this log.

## Decisions and problems

* `make test-integration` (M0's Makefile) only runs `internal/platform/migrate`, so CI does not run the store integration tests yet. Left as a note for M0 instead of editing the Makefile.
* The consent text is assembled from wording the prompt already gives. Any new legal wording needs the team, so the pull request asks for that review.

## Next step

`feature/consents-service-and-checker`: use cases, the real `ConsentChecker` for M5, the expiry job and audit.
