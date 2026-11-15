---
date: 2026-11-15
developer: Daniel Palacios
github: Komi-yes
module: M13
jira: [SCRUM-42]
branch: fix/privacy-deletion-needs-keycloak-ports
tool: Claude Code
pr: "#389"
status: done
---

# Account deletion is refused when it cannot reach Keycloak

## Instruction

After the code analysis of the whole repository, Daniel asked to "fix the bugs with the simple fixes" in the other modules too, and to "push that fixes with their PRs" so each owner reviews them. This is BUG-03 of that analysis, in Juan Pablo's module.

## What was done

* `internal/privacy/deleter.go`: new `ErrKeycloakRequired` and `RequireKeycloak()`. With it set, `DeleteAccount` returns the error before any step when `sessions` or `userDeleter` is missing. `keycloak_deleted` is added to the steps only after the Keycloak user was deleted.
* `internal/privacy/module.go`: calls `RequireKeycloak()` when the environment is not local.
* `internal/privacy/privacy_test.go`: `TestDeletionIsRefusedOutsideLocalWithoutTheKeycloakAdminClient` (HTTP 500 in staging without the secret, and no consent revoked) and `TestLocalDeletionWithoutKeycloakDoesNotClaimTheKeycloakStep`. The router helper takes the environment.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests).
* golangci-lint with `--build-tags integration` reports 6 issues in files this branch does not touch. They are on `develop` too. The integration suite was not run (no Docker).
* Pull request: #389.
* Staging and production without the admin secret no longer delete an account without the fresh login check, and no longer answer "completed" while the login is alive.

## Decisions and problems

* The refusal is a 500, because the contract has no 503 for `POST /privacy/deletion-requests` and a contract change was out of scope.
* Local keeps working without the secret, so the existing tests and a developer machine are unchanged, except that the steps no longer claim `keycloak_deleted`.
* Not fixed here (in the analysis report): a Keycloak failure after the cloud data is deleted leaves a half-deleted user, and audit errors are dropped.
* The change is in another person's module. Juan Pablo reviews it as CODEOWNER.

## Next step

Juan Pablo reviews the pull request and decides on a 503 in the contract. The staging task still needs `FYNK_ADMIN_CLIENT_SECRET` (BUG-04).
