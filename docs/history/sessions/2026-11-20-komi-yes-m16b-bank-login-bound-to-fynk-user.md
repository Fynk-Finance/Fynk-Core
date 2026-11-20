---
date: 2026-11-20
developer: Daniel Palacios
github: Komi-yes
module: M16b
jira: [SCRUM-74]
branch: fix/bank-login-bound-to-fynk-user
tool: Claude Code
pr: none
status: partial
---

# Never authorize a bank link with another Fynk user's bank session

## Instruction

Daniel reported, locally and in staging, that creating a new account "just generates a single array of gastos e ingresos so it's the same for every account". When asked, Daniel confirmed that the second user saw exactly the same movements and amounts as the first. This session covers that problem. The other two (other entities not connecting, onboarding again after switching accounts) have their own branches and logs.

## What was done

* Cause: Android Custom Tabs keep cookies between Fynk users. When user B linked a bank on the same phone, the simulator reused user A's `bank_session` cookie (30 minutes), or the `banco-demo` realm logged A in again through its SSO session. The consent was authorized for A's customer, and B's app synced A's accounts and movements. The PAR did not say which Fynk user started it, so the simulator could not notice. `preferEphemeralSession` in the app only works on iOS.
* API (M5):
  * `ports.PARRequest` has a new `Subject`, the Keycloak `sub`.
  * `service.CreateAuthorization` sets it.
  * The `bankdemo` adapter sends it as `fynk_sub`. Bancolombia ignores it.
* Simulator (M16 / M16b):
  * `contracts/bank-simulator.yaml`: optional `fynk_sub` on the PAR request.
  * `oauth.go`: keeps `fynk_sub` in `PARData`, and rejects a value that is not a valid customer reference.
  * `authorize.go`:
    * A session for another customer is dropped, and the login starts again with `prompt=login`.
    * The session created by that forced login is accepted for that request only, so there is no loop.
    * A forced login must end as the Fynk user or as the seeded demo customer (`cliente.demo`). Anyone else gets a 403 page and no session.
  * `oidc.go`: `AuthURLWithPrompt`.
* Tests:
  * Simulator `authorize_binding_test.go`:
    * A session of another user forces the login.
    * The forced login ends in the consent page without looping, and a new request forces it again.
    * A matching session, or a PAR without `fynk_sub`, shows the consent as before.
    * A first login is not forced.
    * A forced login that returns another Fynk user is refused.
  * `oauth` stores `fynk_sub` and rejects bad values. `oidc` adds `prompt=login` only when asked.
  * API: the `bankdemo` PAR form carries `fynk_sub`, and the service passes the user's `sub`.

## Result

* With the change in `authorize.go` disabled, the three binding tests about another user fail. With it, `go test ./...` passes in `services/bank-simulator` except `TestResolveTLSFilesFromPEM`. That test also fails on `develop` on Windows (file mode 666, not 0600), so it is not from this change. `go test ./...` passes in `services/api`.
* `go vet` and golangci-lint: 0 issues in `services/bank-simulator`, and in `services/api` without the integration tag. With the integration tag, `services/api` has 6 findings in `internal/backup` and `internal/platform`, already on `develop`. `internal/bank` has 0.
* Not yet checked against a real Keycloak. The tests use a fake realm, so it is still open whether `prompt=login` through the `banco-demo` realm and its "Ingresar con Fynk" broker shows the login again. The pull request stays a draft until it is checked.

## Decisions and problems

* `fynk_sub` is the same opaque id the simulator already receives when it creates the demo accounts (ADR 0008), so no new data leaves the backend. Real banks never get it.
* The first version, from the implementer, accepted whatever customer the forced login returned. That still let a stale Fynk session in the browser authorize A for B. The callback now accepts only the Fynk user or the seeded demo customer, which the demo still needs.
* Deploy order: the simulator must be deployed before or with the API. An old simulator ignores `fynk_sub`, so the bug would stay.

## Next step

Start the local stack, link Banco Demo as user A, then as user B on the same emulator within 30 minutes. Check that the bank asks B to log in again and shows B's own data, then mark the pull request ready.
