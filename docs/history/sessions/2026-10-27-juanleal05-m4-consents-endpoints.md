---
date: 2026-10-27
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-20, SCRUM-21]
branch: feature/consents-endpoints
tool: Claude Code
pr: none
status: done
---

# Consent text and consent endpoints (M4 step 1, part 4 of 4)

## Instruction

Same session as `feature/consents-domain-rules`. Last of the 4 stacked branches of `feature/consents-backend`. With it, step 1 of the M4 work plan is complete.

## What was done

* `contracts/modules/consents.yaml` (contract first, then `make generate`), each with an example for Prism:
  * `GET /consent-texts/current`: text, its SHA-256, purpose and 365-day term, so Conectar banco shows the scope and the term (HU-006).
  * `POST /consents`: needs `X-Device-Id`, accepts `Idempotency-Key`, `201` pending, `422` with the rule's code.
  * `GET /consents` and `GET /consents/{id}`: status, `grantedAt`, `expiresAt` as of now (HU-007).
* `internal/consents/server.go`: implements the generated strict server. Rule errors become problem JSON with their own code (422, 404 `consent_not_found`, 409 `consent_not_pending`); anything else is a 500 without details.
* `internal/consents/module.go`: every route goes through `auth.Require` before the generated server parses the request, except the public example health path. With a database, `New` starts the daily expiry job; `cmd/migrate` builds the modules without one, so it never starts it.
* `internal/app/app_test.go` (M0's file, approved by the developer, Sofia asked to review): removed the two consents paths from the list of routes that must answer 501.
* HTTP tests: token required before parsing, text with purpose and term, create then get and list, other users hidden, 422 with its code, idempotency.

## Result

* Tests: 6 HTTP tests pass; `make lint` and `make test` pass (313 mobile tests plus every Go and script test).
* By hand against the real API and Postgres 16 in Docker: the text hash matches its body, create gives `pending`, get and list return it, a wrong term gives `422 term_mismatch`, no token gives `401`, the evidence lands in the row.
* Pull request: opened right after this log.

## Decisions and problems

* The example health path stays, still answering `stub`, because M0's `TestGeneratedHealthPathsArePublicAndAnswerFromTheContract` expects it for every module. Removing it is left to M0.
* Revocation (`POST /consents/{id}/revoke`) is not in this step. It is step 2, `feature/consent-revocation-with-provider`.
* While running `make test`, a bank simulator test once rewrote `fixtures/demo-user.json` without its final newline. It belongs to M16, so it was reverted and not committed.

## Next step

Step 2 of the M4 work plan: `feature/consent-revocation-with-provider` (revoke, the call to M5's `Revoker`, the retry job, `consent.revoked`).
