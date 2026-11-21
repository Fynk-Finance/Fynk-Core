---
date: 2026-10-29
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5]
branch: feature/keycloak-session-start
tool: Claude Code
pr: none
status: done
---

# Read when a Keycloak session started

## Instruction

The M2 plan Daniel approved says the backup reset is allowed only after a password reset by email code, "and after nothing older than the session". The API's user has no `auth_time`, so the session's start time is read from Keycloak instead.

## What was done

* **`kcadmin.Client.SessionStart`:** `GET /users/{id}/sessions`. It returns the start time of one sid, false when there's no such session, and `ErrNotFound` for an unknown user. Errors carry no ids or response body.
* **`ports.Sessions` and `NewSessions(cfg)`:** the port M2 uses, next to `EmailResets`.
* **Tests:** found, unknown and empty sid, 404, 500, bad JSON, and the client without configuration.

## Result

* `go vet` and `go test` pass on this commit alone.

## Decisions and problems

* **Why the session must be newer than the reset:** without this, someone holding an older session could use the person's own reset to delete their backup and remove their phones.

## Next step

The reset rules (`feature/backup-reset-service`).
