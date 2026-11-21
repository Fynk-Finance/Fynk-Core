---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-73]
branch: feature/simulated-banks-provider-ids
tool: Claude Code
pr: none
status: done
---

# Move the demo generator to its own file and tag provider ids

## Instruction

Step 3 of the approved simulated banks plan. Daniel said "continue". Slice A of the generator went over the ~400 line limit, so the review split out its mechanical part into this branch first.

## What was done

* `services/bank-simulator/internal/domain/demo_customer.go`: the old body of `GenerateCustomerData`, moved unchanged into `generateDemoCustomer`.
* `generator.go`: `DemoCustomerID`, plus a `GenerateCustomerData` that still gives every customer the demo data and then sets the provider ids (`billetera-demo` on the wallet and its movements, `banco-demo` on the rest).
* `model.go`: `providerId` on `Account` and `Transaction`, as in `contracts/bank-simulator.yaml`.
* `entities.go`: only the four provider id constants for now.
* `export_fixture_test.go`: compares the generated JSON with `fixtures/demo-user.json` and writes it only with `UPDATE_DEMO_FIXTURE=1`. Before, it rewrote the file on every run, so a change would never fail.
* `entities_test.go`: the demo user's accounts and movements carry the right provider id.

## Result

* Tests: every package of the simulator passes. `go vet` is clean.
* `git diff --exit-code fixtures/demo-user.json` is clean after `go test ./...`.
* Pull request: not opened yet.

## Decisions and problems

* The fixture file ends with a newline, so the helper adds one. The comparison ignores CRLF checkouts on Windows.

## Next step

`feature/simulated-banks-generator`: the entities and their random balances.
