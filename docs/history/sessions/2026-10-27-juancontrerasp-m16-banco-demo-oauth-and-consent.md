---
date: 2026-10-27
developer: Juan Pablo Contreras
github: juancontrerasp
module: M16
jira: [SCRUM-44, SCRUM-64]
branch: feature/banco-demo-oauth-and-consent
tool: Claude Code
pr: none
status: done
---

# M16 Step 3: Banco Demo realm as code, PAR and token proxies, and PKCE verification

## Instruction

Juan Pablo instructed to continue with the next step of M16: "yep, keep going please".

## What was done

* Created branch `feature/banco-demo-oauth-and-consent` from `develop` / M16 step 2.
* `services/keycloak/realms/banco-demo-realm.json`:
  * Configured complete Keycloak realm definition for `banco-demo`.
  * Configured confidential `fynk` client with `client-jwt` (`private_key_jwt`), PAR required, PKCE S256 required, consent required, and redirect URIs.
  * Configured `bank-portal` client for web portal authentication.
  * Added client scopes `accounts` and `transactions` and roles `demo-admin` and `customer`.
* `services/bank-simulator/internal/oauth/`:
  * `oauth.go`: Implemented RFC 9126 Pushed Authorization Requests (`POST /oauth/par`), token endpoint (`POST /oauth/token`), and revocation endpoint (`POST /oauth/revoke`).
  * Enforced `private_key_jwt` structural validation (rejecting insecure algorithms like HS256/none, accepting PS256/RS256).
  * Enforced PKCE S256 code challenge and code verifier matching (`Base64URL(SHA256(verifier)) == challenge`).
  * Implemented consent registration and token revocation integration with `store.BankStore`.
  * `oauth_test.go`: Comprehensive test suite verifying PAR validation, PKCE verification, authorization code exchange, token refresh, and consent revocation.
* `services/bank-simulator/cmd/bank-simulator/server.go`:
  * Registered OAuth routes on the server multiplexer.

## Result

* Tests: 14 of 14 tests pass across all packages in `services/bank-simulator`.
* `go vet ./...` reports 0 issues.
* Pull request: not opened yet (working on `feature/banco-demo-oauth-and-consent`).

## Decisions and problems

* OAuth service operates both as a standalone FAPI 2.0 PKCE/PAR provider (for deterministic fast tests and local demo workflows) and as an mTLS proxy towards Keycloak's banco-demo realm.

## Next step

M16 Step 4: `feature/banco-demo-portal` (Phase 2): Web portal with Go html/template + HTMX, subscription management, payment registration, and admin demo tools.
