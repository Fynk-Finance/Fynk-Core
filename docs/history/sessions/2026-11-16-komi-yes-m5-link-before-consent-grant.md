---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M5
jira: [SCRUM-44]
branch: fix/bank-store-link-before-granting-consent
tool: Claude Code
pr: "#393"
status: done
---

# The bank link is stored before its consent is granted, and a refused sync is audited

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Juan Carlos's module, so Juan Carlos reviews it as CODEOWNER.

## What was done

* `services/api/internal/bank/service/service.go`: `Exchange` stores the link, then grants the consent, and deletes the link if the grant fails.
* `link/link.go`, `store/memory.go`, `store/postgres.go`: new `Delete`.
* `service/queries.go`: new `syncFailed`, used by the bank errors and by Fynk's own consent check.
* Tests: two in `service_test.go`, one in `queries_test.go`, one case in the store contract test.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests). golangci-lint with `--build-tags integration` reports only the 6 issues that are already on `develop` (backup and migrate integration tests), none in this change.
* Pull request: #393.
* A failed insert leaves a pending consent. A refused sync is always audited.
* The first and the third test were run on the old code and failed.

## Decisions and problems

* The link is deleted, not revoked, when the grant fails: `consent_id` is unique in `bank.links`, so a revoked row would block the consent for good.
* The movements count and the audit of Fynk's own rate limit are left for Juan Carlos, with the reasons in the pull request.
* Not done: the movements count in `bank.sync` (the M5 prompt asks for it). The API sees one page at a time, so it would be one event per page. That is your decision.
* Not done: Fynk's own rate limit writes no event. It would be one audit row per throttled request, and the provider is not known at that point.

## Next step

Juan Carlos reviews the pull request and decides on the movements count.
