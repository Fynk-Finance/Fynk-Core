---
date: 2026-11-15
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-64]
branch: fix/bank-simulator-refresh-rotation-and-read-lock
tool: Claude Code
pr: "#392"
status: done
---

# The simulator rotates refresh tokens and reads movements under the lock

## Instruction

After the code analysis of the whole repository, Daniel asked to "fix the bugs with the simple fixes" in the other modules too, and to "push that fixes with their PRs" so each owner reviews them. These are BUG-07 and the lock part of BUG-08 of that analysis, in Juan Pablo's module.

## What was done

* `services/bank-simulator/internal/store/store.go`: new `TakeRefreshToken`, which returns a live refresh token and forgets it. `GetTransactions` filters the movements before it releases the read lock.
* `services/bank-simulator/internal/oauth/oauth.go`: the `refresh_token` grant uses `TakeRefreshToken`.
* Tests: `TestRefresh_RotatesTheRefreshToken` (oauth), `TestTakeRefreshToken_WorksOnceAndOnlyForRefreshTokens` and `TestGetTransactions_IsSafeWhileThePortalWrites` (store). The rotation test was run on the old code and failed.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests). golangci-lint with `--build-tags integration` reports 0 issues in `services/bank-simulator`.
* Pull request: #392.
* A used refresh token answers `invalid_grant`. The new one keeps the same consent.
* Not verified here: the concurrency test only fails with `go test -race`, and this PC has no C compiler for the race detector. I did not see it fail on the old code. CI runs with `-race`.

## Decisions and problems

* I checked that Fynk keeps the new refresh token before making the old one useless: the API fingerprints and returns it (`bank/service/queries.go`) and the phone stores it (`syncEngine.ts`).
* The offset cursor of `GetTransactions` is not changed. A payment made between two pages still shifts the next page. It needs a cursor by movement, so it stays in the analysis report for Juan Pablo.
* This is a second branch for the simulator, apart from the portal money checks, to keep each pull request small.
* The change is in another person's module. Juan Pablo reviews it as CODEOWNER.

## Next step

Juan Pablo reviews the pull request and decides on the cursor.
