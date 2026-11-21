---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: feature/profile-endpoints
tool: Claude Code
pr: none
status: done
---

# GET /me and PATCH /me

## Instruction

Same plan as the admin client. `docs/modules/M01-identity.md` asks for `GET /me` (masked email, name, verified flag, creation date, cached 5 minutes) and `PATCH /me` (first and last name, written to Keycloak). The plan adds `passwordUpdatedAt` for the design's "Actualizada hace 3 meses" in `CfgSeguridad`.

## What was done

* **`contracts/modules/identity.yaml`:** `getProfile` and `updateProfile`, with the schemas `IdentityProfile` and `IdentityProfileUpdate` and fictional examples. Problem codes:
  * `invalid_profile` (400);
  * `profile_not_found` (404);
  * `identity_admin_unavailable` (503).
* **`mask.go`:** the email masking rule, `camila@correo.com` to `ca•••@correo.com`. It counts characters, not bytes. Input that isn't an address gives only the dots.
* **`profile_http.go`:**
  * `GET /me` reads the user and the password date through the admin client and caches the response in Redis for 5 minutes under `identity:me:<sub>`. The cache holds the masked email only.
  * `PATCH /me` validates both names, writes them to Keycloak and clears the cache. A valid name is trimmed, has 1 to 50 characters, contains only letters of any script, marks, spaces, apostrophes, hyphens and periods, and starts with a letter.
  * Without Redis, or when Redis fails, the request goes on without the cache.
* **`module.go`:** builds the admin client from the config. `/me` is no longer a 501 stub.
* **Tests:** handlers over a fake admin and an in-memory Redis hook. They cover:
  * the mask;
  * empty names;
  * the cache and its TTL;
  * a Redis failure;
  * validation in both scripts;
  * errors without values;
  * 404 and 503.

## Result

* `make generate`, `go vet` with both tags, `go test ./...`, `make lint-go` and `make lint-mobile` are clean.
* `make test-integration` and `make test-keycloak` passed on the full D2 work before the split. Claude Code ran them again after the split.

## Decisions

* **An account that is missing from Keycloak gives 404 `profile_not_found`.** The token is still valid, so 401 doesn't fit, and the problem isn't temporary, so 503 doesn't either. The app can sign out when it sees it.
* **The names stay only in Keycloak**, as M01 says. CLAUDE.md's "Where data lives" lists the profile name under the `identity` schema; the docs PR aligns that row.

## Problems

* The generated server doesn't enforce the contract's lengths, so the handler checks them itself.

## Next step

* `feature/revoke-device-sessions`: removing a device ends its Keycloak session.
