---
date: 2026-11-07
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-73]
branch: fix/simulated-banks-history-timing-test
tool: Claude Code
pr: none
status: done
---

# Banco Demo: history timing test fails on CI

## Instruction

Daniel said "some of the PRs fail the CI".

## What was done

* Every failing PR of stacks #314 and #323 and `develop` itself (since de81f3d) failed the same test: `TestHistoryRunsFast` in `services/bank-simulator/internal/domain`, at 20.1 to 20.3 s against its 20 s budget.
* CI runs `make test-go GOTESTFLAGS="-race -covermode=atomic -coverprofile=coverage.out"`. The race detector makes the generator about ten times slower (the package took about 123 s on CI and the test takes about 1 s locally), so the budget only holds by chance there.
* `race_on_test.go` and `race_off_test.go` set `raceEnabled` by build tag, and the test skips itself when it is true. Without `-race` the 20 s budget still applies. The other tests of the package still run on CI.

## Result

* Locally: `go vet ./...`, `go test` (the test passes in about 1 s) and golangci-lint v2.15.0 with the `integration` tag pass. `-race` cannot run on this PC (32-bit Windows Go toolchain), so the skip under `-race` is checked by CI.
* Pull request: see the PR of this branch.

## Decisions and problems

* Skipping under `-race` was chosen over raising the budget, because any fixed budget under the race detector depends on the runner's speed.
* The test came from the generator work (#307/#308), which was already merged, so `develop` was red.

## Next step

After this merges, rebase stacks #314 and #323 on `develop` so their CI runs green.
