---
date: 2026-11-09
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-83]
branch: feature/fynk-dialog-callers
tool: Claude Code
pr: none
status: done
---

# Every dialog in the Fynk dialog (QA review V8, part 2 of 2)

## Instruction

Part of "Lets fix all the visual problems at once", every pull request in one stack. V8 part 2: move every `Alert.alert` to the Fynk dialog added in part 1.

## What was done

* 19 calls in 14 files now call `dialog.show()` with the same arguments: M1 (`MiCuentaScreen`, `SecurityScreen`), M2 (`NewRecoveryCodeScreen`), M4 (`useRevokeFlow`), M6 (`DashboardBalanceCard`), M7 (`CategoryPickerSheet`, `TransactionDetailScreen`, whose injected `ask` is now `typeof dialog.show`), M8 (`GoalFormScreen`), M9 (`RecurringFormScreen`, `SubscriptionDetailScreen`), M10 (`CapsScreen`), M12 (`expoLocalNotifier`, the explanation before the OS permission prompt) and M13 (`PrivacyScreen`).
* Their 10 test files spy on `dialog.show` instead of `Alert.alert`; the tests themselves did not change.
* No `Alert.alert` is left in the app.

## Result

* Tests: 2746 of 2746. Typecheck and ESLint clean.
* Pull request: not opened yet (opened with the whole stack). Approvals: Daniel (M1, M2), Juan Carlos (M4), Karol (M8, M9, M12), Julián (M10), Juan Pablo (M13).

## Decisions and problems

* The swap was done by a script and checked by typecheck: `dialog.show` keeps the signature of `Alert.alert`, including `{ cancelable, onDismiss }` used by M4 and M12.
* Tests that spied on `Alert.alert` without a mock now mock `dialog.show` too, so they do not leave dialogs in its queue.

## Next step

V11: the category dropdown with icons.
