---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-73]
branch: feature/simulated-banks-api-scoping
tool: Claude Code
pr: none
status: done
---

# Banco Demo: the Open Finance API reads only the token's consent

## Instruction

Third of the three layers of step 4 of the simulated banks plan (store, oauth, api). Daniel's instruction was "continue" to step 4.

## What was done

* `internal/api`: the bearer token is looked up in the registry, and only access tokens are accepted. `dev-token` and `test-token` still map to `consent-demo-001`. Any other token gets 401.
* A pending consent gets 403 `consent_not_authorized`. An account that is not covered by the consent gets 403 `account_not_in_consent`, and one that does not exist gets 404.
* `DELETE /open-finance/v1/consents/{id}` had no auth check: anyone who knew a consent id could revoke it. It now needs a client token (the Fynk API's revoke path), the consent's own access token, or a dev token for the demo consent. Otherwise it answers 401, or 403 for another consent's token.
* Tests in `internal/api/scoping_test.go`. Two older tests sent `Bearer consent-demo-001` after a revoke. That pass-through is gone, so they now send `dev-token` and still expect 403 `consent_revoked` (`internal/api/handlers_test.go`, `cmd/bank-simulator/mtls_test.go`).

## Result

* `go test ./...`, `go vet ./...` and `gofmt -l .` in `services/bank-simulator` pass on this commit alone. `fixtures/demo-user.json` is unchanged.
* Pull request: see the stack.

## Decisions and problems

* Bug fixed: any bearer token that did not start with `consent-` read the demo user's consent, so every Fynk link showed the demo user's data.
* The `DELETE` check was added in review (Opus). The rest of the code is by a Sonnet subagent.
* Tokens and consents live in memory. After a simulator restart Fynk's tokens get 401 and the person links again, as before.
* A search for `consent-` bearer use found only the two simulator tests above. The Fynk API sends the access token from the token exchange, or a client token to revoke.

## Next step

The provisioning slice: `POST /demo/v1/customers` over mTLS and the `client_credentials` scope check.
