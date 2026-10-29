---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: feature/keycloak-admin-client
tool: Claude Code
pr: none
status: done
---

# The Keycloak admin client for the profile and the device sessions

## Instruction

This continues the approved M1 plan. The developer asked for a Sonnet subagent to implement the work and for Claude Code to plan and verify it. The profile step of the plan needs a client of the Keycloak admin API. It reads the profile, changes the names and ends the session of a removed device.

## What was done

* **New package `internal/identity/kcadmin`.** It authenticates as the service account of `fynk-admin` with client credentials:
  * the secret goes in a form body and never in a URL;
  * the token is cached until 30 s before it expires, and concurrent callers share one token request;
  * every call has a 5 s timeout.
* **Methods:** `GetUser`, `PasswordUpdatedAt` (the `createdDate` of the password credential), `UpdateNames` and `DeleteSession`.
  * `UpdateNames` reads the whole user and writes it back without `attributes`. On Keycloak 26.8.1 that keeps the stored attributes, such as the terms acceptance.
  * `DeleteSession` treats a session that is already gone as success.
* **Errors:**
  * an error holds only the operation and the status code, never the body Keycloak sent back;
  * without the secret, every method returns `ErrUnavailable` and nothing goes to the network.
* **Tests:**
  * unit tests on an `httptest` server cover the form body, the cache, the refresh, one token request for concurrent callers, the 404 mapping, errors without bodies, and no secret;
  * an integration test against the Keycloak image reads a user and the date of the password. It checks that renaming keeps the email, the verified flag, the terms attribute and the password date, and that `DeleteSession` makes the refresh token fail with `invalid_grant`. A wrong secret gives `ErrUnavailable`.

## Result

* `go vet` with both tags, `go test ./...` and `make lint-go` are clean. `make test-keycloak` passed for the subagent and again for Claude Code.

## Decisions

* The D2 work came out at about 1,400 lines, so Claude Code split it into three stacked pull requests: this client, the profile endpoints, and revoking the session of a removed device.

## Problems

* The terms attribute can't be set through the admin API, because the realm's unmanaged attribute policy is `ADMIN_VIEW`. The integration test accepts the terms in the browser flow instead.

## Next step

* `feature/profile-endpoints`: `GET /me` and `PATCH /me`.
