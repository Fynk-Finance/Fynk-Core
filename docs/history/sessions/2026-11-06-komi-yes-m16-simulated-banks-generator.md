---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-73]
branch: feature/simulated-banks-generator
tool: Claude Code
pr: none
status: done
---

# Simulator generator: several entities with random balances

## Instruction

Step 3 of the approved plan, slice A: build the data generator for several fictional entities (entities, accounts and balances), keeping the demo user exactly as it is.

## What was done

* The move of the demo generator, the provider ids and the fixture comparison are in the branch below, `feature/simulated-banks-provider-ids`.
* `generator.go`: `GenerateCustomerData` keeps the demo data for `DemoCustomerID` and calls the new generator for any other id.
* `entities.go`: entity table, presence constants, balance ranges, per-entity seeds, accounts and `EntitySummaries`.
* `opening.go`: one "SALDO INICIAL" transaction per account (slice A only), newest-first sort and ids.
* `entities_test.go`: determinism, variety, independence of entities, rules over 1.000 customers, transaction sums, summaries.

## Result

* Tests: all 30 tests of the simulator pass, none fail. `go vet` and golangci-lint (Makefile version) report 0 issues.
* `git diff --exit-code fixtures/demo-user.json` is clean after `go test ./...`.
* `gofmt -l .` still lists `internal/store/store.go`, which was already unformatted before this work and was not touched.
* Pull request: none, not pushed.
* Non-demo customers only have opening transactions. The 12-month history is the next slice.

## Decisions and problems

* The presence check in the test uses the random draw, before the fallback rule. The fallback adds Billetera Demo when no optional entity comes out, which raises its real rate to about 87 %, outside the 80 % +/- 8 band.
* The Banco Demo card is always due on day 5, as for the demo user. The Banco Digital card picks day 5, 10, 15 or 20; the CDT opening date is between 15 days ago and 15 days before maturity.

## Next step

Slice B: build 12 months of history backwards from each balance.
