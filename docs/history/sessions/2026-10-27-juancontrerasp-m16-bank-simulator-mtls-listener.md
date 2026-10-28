---
date: 2026-10-27
developer: Juan Pablo Contreras
github: juancontrerasp
module: M16
jira: [SCRUM-45, SCRUM-64]
branch: feature/bank-simulator-mtls-listener
tool: Claude Code
pr: none
status: done
---

# M16 Step 2: Internal listener mTLS verification and certificate logging

## Instruction

Juan Pablo instructed to continue with M16 according to the work plan: "keep going with M16, this time, if we need to use other branches and even rename the one that we have depending on the documentation that we have, do it please".

## What was done

* Renamed previous branch to canonical `feature/bank-simulator-api-and-seed` and opened pull request #23 against `develop`.
* Created branch `feature/bank-simulator-mtls-listener` for Step 2 of the M16 work plan.
* `services/bank-simulator/cmd/bank-simulator/mtls_test.go`:
  * Implemented end-to-end mTLS integration tests verifying that calls to the internal listener (`:9443`) require and verify client certificates against the trusted CA.
  * Tested handshake rejection without a client certificate.
  * Tested handshake rejection with an untrusted client certificate.
  * Verified successful mTLS communication with valid client certificate (`fynk-client`).
  * Verified client certificate serial (`4821`) and subject CN (`fynk-client`) are logged in JSON format for Open Finance audit evidence (HU-031).
  * Tested consent revocation over mTLS and confirmed subsequent resource queries return 403 `consent_revoked`.

## Result

* Tests: 12 of 12 tests pass in `services/bank-simulator`.
* `go vet ./...` passes with 0 issues.
* Pull request: not opened yet (working on `feature/bank-simulator-mtls-listener`).

## Decisions and problems

* Local `httptest.Server` binds to `127.0.0.1`; tests configure `ServerName: "bank-simulator"` on the TLS client config to validate hostname against the server certificate SAN while enforcing mutual TLS.

## Next step

M16 Step 3: `feature/banco-demo-oauth-and-consent` (Phase 1): realm `banco-demo`, client policies, PAR and token proxies with private_key_jwt validation.
