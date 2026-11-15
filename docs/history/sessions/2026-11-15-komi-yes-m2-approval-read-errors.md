---
date: 2026-11-15
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-63]
branch: fix/backup-approval-read-errors
tool: Claude Code
pr: "#384"
status: done
---

# Reading a device approval no longer turns a failed device lookup into 404

## Instruction

Daniel asked for "a deep code analysis of the whole Fynk repository" with "a verified list of real bugs", and to "fix the simple ones yourself" in his own modules (M1, M2, M16b), each with a test that fails before and passes after.

## What was done

* `internal/backup/approvals/service.go`: `Get` returns `ErrNotFound` only when the caller's device is not usable (`ErrNotActive`). Any other error of the device lookup goes back as it is.
* Test `TestGetReturnsTheDeviceLookupError` in `service_test.go`. It failed before the change.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests).
* golangci-lint with `--build-tags integration` reports 6 issues in files this branch does not touch (`internal/backup/postgres/*_integration_test.go` and `internal/platform/migrate/integration_test.go`). They are on `develop` too.
* Pull request: #384.

## Decisions and problems

* The bug: `GET /device-approvals/{id}` answered `404 approval_not_found` when the device lookup failed for any reason, for example a database error. The new phone polls this call and reads 404 as a request that no longer exists.
* The handler already returns other errors as 500, so no contract change was needed.
* Found in the same analysis and left for a decision: the backup reset deletes the backup before it removes the other devices. A test pins that order, so it was not changed.

## Next step

Fix the depguard issues of the integration tests of `internal/backup/postgres`, which import `internal/identity` directly.
