---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-73]
branch: feature/simulated-banks-history
tool: Claude Code
pr: none
status: done
---

# Simulator generator: 12 months of history built backwards

## Instruction

Step 3 of the approved plan, slice B: replace the opening-only transactions of non-demo customers with 12 months of history, built backwards from the final balances, keeping the demo user untouched.

## What was done

* `services/bank-simulator/internal/domain/history.go`: monthly fixed items (salary, rent, utilities, 4 subscriptions, transport, gym, card payment on day 5), variable spending scaled to the salary, transfers to the other entities (wallet, Banco Digital, Cooperativa APORTE and interest), the CDT funding, and the opening balance computed as final balance minus movements.
* A fixer keeps savings and wallet accounts from going below zero: it adds extra purchases after the lowest point, which raises the earlier balances and leaves the final one and the fixed items alone.
* Cards: charges stay under 35 % of the limit each month, and a last payment brings each card down to its final debt.
* `opening.go`: transactions are now sorted so that reading them backwards gives the same order the history was built in. The opening-only builder was removed. `entities.go` calls the history builder, and the Banco Demo card always has due day 5.
* `history_test.go`: determinism; over 1.000 customers, balances and limits along the whole history, sums, subscriptions in the last 12 complete months, salary and rent, transport on the card without a wallet, both sides of own transfers, provider ids, order and unique ids.

## Result

* Tests: all 34 tests of the simulator pass, none fail. The domain package takes about 6.5 seconds, of which the history tests take about 4. `go vet` and golangci-lint (Makefile version) report 0 issues.
* `git diff --exit-code fixtures/demo-user.json` is clean after `go test ./...`.
* `gofmt -l .` still lists `internal/store/store.go`, which was already unformatted before this work and was not touched.
* Pull request: none, not pushed.

## Decisions and problems

* Transactions dated after the reference time on the current day are dropped, so no movement is in the future.
* The current month is partial, so its variable spending is scaled by the days elapsed.
* The CDT account gets a credit on its opening date, so its transactions add up to its balance.
* Cooperativa APORTE is 3 % of its final balance per month, so its opening balance stays positive.

## Next step

Use `EntitySummaries` in `POST /demo/v1/customers`.
