---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-73]
branch: feature/simulated-banks-provisioning
tool: Claude Code
pr: none
status: done
---

# Banco Demo: create a demo customer from the Fynk sub over mTLS

## Instruction

Daniel said "continue" to step 4 of the approved simulated banks plan. This is the second slice: the demo-only endpoint that creates the customer at sign up. It sits on top of the branch `feature/simulated-banks-api-scoping`.

## What was done

* `internal/demo`: `POST /demo/v1/customers`. It answers 404 problem+json without a client certificate, 401 without a registered unexpired client token, 403 without the `demo:provision` scope, and 400 for a bad `customerRef` or bad JSON (body limit 4 KB, pattern `^[A-Za-z0-9._:-]{1,128}$`). It returns the entities from `EntitySummaries` and logs nothing.
* `internal/oauth`: the `client_credentials` grant now requires a client assertion (401 `invalid_client`), grants only the scope asked for, and gives `demo:provision` only to the client set with `WithProvisionClientID` (otherwise 400 `invalid_scope`). With no scope it still returns the admin token that the Fynk API uses to revoke a consent. The token is registered as kind client.
* `cmd/bank-simulator`: `config.ProvisionClientID` from `BANK_PROVISION_CLIENT_ID`, default `fynk`. `newBankMux` takes it, and the new route is registered there.
* Tests in `cmd/bank-simulator/provision_test.go`: idempotent answer, different customers, the demo customer, every access rule, bad bodies, scope rules for `client_credentials`, and a log-capture test that the customerRef and the token never appear in the logs.

## Result

* Tests: 56 test and subtest passes, 0 failures, from `go test -v ./...` in `services/bank-simulator`. `go vet` and golangci-lint v2.15.0 report nothing. `gofmt -l .` prints nothing. `fixtures/demo-user.json` is unchanged.
* Pull request: not opened yet.

## Decisions and problems

* The demo customer id is an email, so the `customerRef` pattern would reject it. The handler accepts that one constant as an exception, so the endpoint can return the demo user's two entities. Any other email gets 400.
* A scope other than `demo:provision` in `client_credentials` gets `invalid_scope`.
* The handler does not need the provision client id, because the scope on the token already carries that check. Only the oauth service takes it.
* The route sits on the mux that both listeners share. It protects itself by answering 404 when the request has no client certificate. Splitting the muxes per listener is not done in this slice.
* Tokens and consents live in memory. After a simulator restart Fynk's tokens get 401 and the person has to link again. That is the same as before this work.

## Next step

Step 5: the authorization page, which calls `CompleteAuthorization`, and "Ingresar con Fynk" in both realms.
