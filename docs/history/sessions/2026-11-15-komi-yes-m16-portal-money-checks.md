---
date: 2026-11-15
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-65]
branch: fix/bank-simulator-portal-money-checks
tool: Claude Code
pr: "#391"
status: done
---

# The Banco Demo portal checks funds, account types and the amount typed

## Instruction

After the code analysis of the whole repository, Daniel asked to "fix the bugs with the simple fixes" in the other modules too, and to "push that fixes with their PRs" so each owner reviews them. These are BUG-05 and BUG-10 of that analysis, in Juan Pablo's module.

## What was done

* `services/bank-simulator/internal/store/store.go`:
  * New `canSpend` and the errors `ErrWrongAccountType`, `ErrInvalidAmount`, `ErrSubscriptionInactive`. `ErrInsufficientFunds` is now used.
  * `RecordPayment`, `TransferOwn`, `PayCard`, `OpenCDT` and `ChargeSubscriptionNow` refuse an amount over the available money and a CDT or closed account as source.
  * `PayCard` pays only a credit card. `CancelCDT` cancels only an open CDT. `TransferOwn` refuses the same account and a CDT as destination.
  * `AddSubscription` and `UpdateSubscriptionPrice` refuse zero or negative amounts. A cancelled subscription is not charged.
* `services/bank-simulator/internal/portal/portal.go`: `parseMoneyInput` rewritten. `.` groups thousands, `,` starts the cents, one `.` with one or two digits after it is cents, and bad input is an error.
* Tests: `TestPortalMoneyActions_CheckFundsAndAccountTypes` and `TestSubscriptions_RefuseBadAmountsAndCancelledCharges` (store), `TestParseMoneyInput` and `TestPortalRefusesATransferBiggerThanTheBalance` (portal). The two portal tests were run on the old code and failed.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests). golangci-lint with `--build-tags integration` reports 0 issues in `services/bank-simulator`.
* Pull request: #391.
* A portal action can no longer leave a deposit account negative, and `1000.50` is one thousand pesos and fifty cents.

## Decisions and problems

* One rule for every source: the amount must fit in `AvailableMinor`, which is the balance of a deposit account and the credit left of a card.
* Not changed: `AdvanceTime` charges subscriptions without a funds check, and a card payment over the debt is accepted. Both are in the pull request for Juan Pablo.
* The store errors reach the portal in English, like the ones that were already there.
* The change is in another person's module. Juan Pablo reviews it as CODEOWNER.

## Next step

Juan Pablo reviews the pull request. The other two simulator fixes of the analysis (refresh token rotation and the read lock of transactions) go in their own branch.
