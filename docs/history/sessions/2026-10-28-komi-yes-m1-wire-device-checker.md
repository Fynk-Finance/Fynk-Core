---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: chore/wire-device-checker
tool: Claude Code
pr: none
status: done
---

# The API trusts X-Device-Id only for a registered device

## Instruction

The last backend step of the M1 plan (D3): wire the devices checker into the API's token verifier. Then `User.DeviceID` holds a device only when it is registered to the user and not removed. M2 relies on that for device approval.

## What was done

* **`internal/identity/ports`:** `NewDeviceChecker(pool, clock)` over `identity.devices`, with a test that it builds without a pool.
* **`cmd/api/verifier.go` and `main.go` (M0):** `newVerifier` takes the checker, and `main` passes the identity one. The dev-token-only path didn't change.
* **`internal/identity/token/verifier.go`:** a device lookup that fails (for example, the database is down) now leaves the device untrusted instead of failing the token.
  * Before, `auth.Require` answered 401 to any verification error, and the app would have signed the person out over a database error.
  * The warning has no ids. A test covers it.

## Result

* `make generate`, `go vet` with both tags, `go test ./...` and `make lint-go` are clean.

## Decisions

* **Untrusted, not 401.** The subagent found that a lookup error became a 401. Claude Code chose to treat the device as untrusted, because the token is still valid. Device-bound actions fail closed, and nobody is signed out.

## Problems

* `cmd/api` has no helper to sign tokens, so the checker is not tested at that level. `token`'s own tests cover the behavior.

## Next step

* The Keycloakify theme (`chore/add-keycloakify`).
