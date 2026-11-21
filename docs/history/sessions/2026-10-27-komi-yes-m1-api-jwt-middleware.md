---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: feature/api-jwt-middleware
tool: Claude Code
pr: none
status: done
---

# Verify Keycloak access tokens in the API (PS256, cached JWKS)

## Instruction

Branch 3 of `docs/modules/M01-identity.md`: "JWKS middleware, tests with a locally signed PS256 token, remove the stub". The developer decided to "keep it as a local fallback": with `APP_ENV=local` the API still accepts M0's `dev-token`. Changes to M0 files go in separate chore PRs.

## What was done

* New package `services/api/internal/identity/token/`:
  * `Verifier` implements M0's `auth.Verifier`. It accepts PS256 only and checks `iss`, `aud=fynk-api`, a required `exp`, and `nbf` and `iat` with 30 s of skew. `typ` must be `Bearer`, which rejects ID and refresh tokens.
  * `jwks.go` keeps the realm's PS256 signing keys for 10 minutes. An unknown `kid` refetches at most every 30 s. Without fresh keys every token is rejected.
  * `DeviceChecker` port: `X-Device-Id` is only copied to `User.DeviceID` after the identity module checks it. Until the devices endpoints exist it stays empty.
  * `WithLocalDevToken` accepts `dev-token` only when `APP_ENV=local`.
* Tests (16 plus subtests):
  * RS256, PS384, HS256 (also keyed with the public key), `none`, no `kid`, and a foreign key behind a known `kid` are all rejected
  * issuer and audience checks; an audience list containing `fynk-api` passes
  * skew at 29 s passes and at 31 s fails
  * the JWKS is cached 10 minutes; rotation; the unknown-kid throttle; fail closed
  * non-PS256 keys are ignored; device trust; end to end through `auth.Require` (401 problem JSON)
  * `dev-token` works in local only; no token or email in the logs

## Result

* All tests pass. `go vet` and golangci-lint: 0 issues.
* One-off check: a token signed by a real Keycloak 26.8.1 with the realm of `feature/keycloak-realm-as-code` verified through this package's JWKS parsing (Java's PS256 salt length works with Go). The temporary test file and the container were deleted afterwards.
* Not installed yet. `cmd/api/main.go` and `platform/config` belong to M0, so `chore/install-keycloak-verifier` wires it in. M0's `DevVerifier` stays as the local fallback.

## Decisions

* golang-jwt for parsing, so the JWT code is not hand-written. The JWKS cache is our own small code, because the rules are specific: 10-minute TTL, unknown-kid throttle, fail closed, PS256 keys only.
* Keys are fetched on the first request, not at startup, so the API starts while Keycloak is still starting.
* No stale keys after 10 minutes, even if Keycloak is down. This follows the prompt's 10-minute cache strictly.
* `go.mod` is left as the chore PR set it. `go mod tidy` would drop testcontainers until the realm branch merges.

## Problems

* The test helper type `jwk` clashed with the package's own `jwk`. It was renamed `publishedKey`.

## Next step

* `chore/install-keycloak-verifier` (M0): add `KEYCLOAK_URL` to the config, and in `cmd/api` install `token.WithLocalDevToken(token.New(...), cfg.AppEnv)`.
* Branch 4 implements `DeviceChecker` on `identity.devices`.
