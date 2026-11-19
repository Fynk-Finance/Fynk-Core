---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M13
jira: [SCRUM-42]
branch: fix/privacy-deletion-audit-and-export-email
tool: Claude Code
pr: "#394"
status: done
---

# An account deletion keeps its audit, and the data export never invents an email

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Juan Pablo's module, so Juan Pablo reviews it as CODEOWNER.

## What was done

* `services/api/internal/privacy/deleter.go`: the two audit calls, and `LogTo`.
* `collector.go`: `fetchProfile` returns an error. `module.go`: passes the logger.
* Tests: three in `privacy_test.go`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests). golangci-lint with `--build-tags integration` reports only the 6 issues that are already on `develop` (backup and migrate integration tests), none in this change.
* Pull request: #394.
* A deletion without evidence does not start. The export never carries a made-up address.
* The three tests were run on the old code and failed.

## Decisions and problems

* The requested event stops the deletion, the completed event does not: before the first step the person can ask again, after the last one nothing can be undone.
* The log line carries the request id and the event type, never the user.
* Not done: a Keycloak failure after the cloud data is deleted still leaves the login alive. The steps look repeatable, so asking again should finish it, but I did not test that. A real fix needs a job that resumes.
* Not done: a failed update of the request row after everything is deleted still answers 500. It needs a database to test.
* Not done: the user's Banco Demo customer is never deleted. It needs an endpoint in the simulator.

## Next step

Juan Pablo reviews the pull request and decides on the three open points.
