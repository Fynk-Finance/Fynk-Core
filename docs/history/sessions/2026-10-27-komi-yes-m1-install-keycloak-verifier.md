---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: chore/install-keycloak-verifier
tool: Claude Code
pr: none
status: done
---

# Install M1's Keycloak verifier in the API (M0 files)

## Instruction

The developer asked that changes to M0 files go in "separate chore PRs", and decided to keep `dev-token` "as a local fallback". This one installs the verifier from `feature/api-jwt-middleware`.

## What was done

* `internal/platform/config`: `KEYCLOAK_URL` (Keycloak as the API reaches it) and `KEYCLOAK_REALM` (default `fynk`). The config test now uses named fields.
* `cmd/api/verifier.go`: `newVerifier` builds `token.Verifier`.
  * With `APP_ENV=local` it also accepts `dev-token`, and a local API without `KEYCLOAK_URL` runs on `dev-token` alone, with a warning.
  * Staging and prod refuse to start without the Keycloak settings.
* `cmd/api/main.go`: installs it with `auth.Install`, replacing M0's dev-only verifier.
* `docker-compose.yml` (`KEYCLOAK_URL: http://keycloak:8080`), `services/api/.env.example`, `docs/local-dev.md`.

## Result

* `go vet`, golangci-lint (0 issues), and the `cmd/api`, `config` and `identity/token` tests pass. `docker compose config` with `.env.example`: valid.

## Decisions

* The API reaches the JWKS on `KEYCLOAK_URL` and not on the issuer. Inside Docker the issuer host `localhost:8081` points at the API container itself.
* Missing Keycloak settings are checked when the verifier is built, not in `config.Load`. The existing config tests load `prod` without them, and the error is clearer next to the verifier.

## Problems

* None.

## Next step

* Branch 4 adds the `DeviceChecker` on `identity.devices` and the admin client, which reuses `KEYCLOAK_URL`.
