---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M0
jira: [SCRUM-68]
branch: fix/app-panic-log-and-body-limit
tool: Claude Code
pr: "#417"
status: done
---

# A panic is logged by the application logger, and request bodies have a limit

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Sofia's module, so Sofia reviews it as CODEOWNER.

## What was done

* `services/api/internal/app/server.go`: `recoverer`, `limitBody` and `maxBodyBytes`.
* Tests: `recover_test.go` (new), with a module that panics and one that reads its body.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests). golangci-lint with `--build-tags integration` reports only the 6 issues that are already on `develop` (backup and migrate integration tests), none in this change.
* Pull request: #417.
* A panic answers problem JSON and reaches the log group without its text.
* Both tests were run on the old router and failed.

## Decisions and problems

* 8 MiB: one limit for every route, above the biggest body of the contract.
* Not done: BUG-13, `GET /internal/audit/verify` open to any signed-in user. The M13 prompt says "admin only", but no admin role exists in the token, the realm or `auth.User`. That needs the team (M0, M1, M13).

## Next step

Sofia reviews the pull request and takes the admin role for the audit endpoint to the team.
