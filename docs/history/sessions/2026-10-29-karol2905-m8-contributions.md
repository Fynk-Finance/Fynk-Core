---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-52]
branch: feature/savings-contributions
tool: Claude Code
pr: none
status: partial
---

# Contributions to savings goals: manual record, linked movement and undo

## Instruction

After the Metas screen (#173) was opened, Claude offered the Dashboard carousel or SCRUM-52. Karol answered "con scrom 52". The story is HU-036 Registrar aportes: "Asociar un movimiento sincronizado. Aporte manual con monto y fecha. Fynk no ejecuta transferencias. Se refleja en movimientos como aporte a plan de ahorro. Se puede deshacer."

## What was done

M7 (movements) is still M0's placeholder and #173 was still open, so SCRUM-52 is split. This pull request holds the rules and the service, on `develop` and without touching the files of #173. The "Abonar" part of the Metas card comes after #173 is merged.

* **`domain/contribution.ts`:**
  * `validateContribution`: amount above $0 and up to $1.000.000.000, a real day that is not in the future, note of 80 characters or less.
  * `contributionFromMovement`: only a booked outflow that is not linked yet; the amount is the money that left, on its day in Bogotá.
* **`application/contributionService.ts`:**
  * `add`: a manual record.
  * `linkMovement`: creates the contribution and marks the movement in M7 with `setTransactionGoal`. If M7 fails, the contribution is undone.
  * `undo`: marks the row deleted and frees the movement.
  * `unlinkGoal`.
  * Errors: invalid input, goal not found, movement not eligible, movement already linked, movements unavailable.
* **`application/contributionPorts.ts`:** `ContributionStore`, and `MovementGoalLinker` (the shape of M7's `setTransactionGoal`).
* **`adapters/vault/vaultContributionStore.ts`:** on the existing `savings_contributions` table. A movement already linked is rejected before the unique index is reached.
* **`application/goalService.ts`:** `beforeRemove` (deleting a goal frees its movements first; if that fails the goal is not deleted) and `notifyChanged` (Metas reloads after a contribution).
* **`index.ts`:** wires both services. `movements` stays empty until M7 exports `setTransactionGoal`.
* **Tests:**
  * `domain/contribution.test.ts` (6).
  * `application/contributionService.test.ts` (15): manual record and saved amount, 64 % with several contributions, invalid input, Metas reload, linking marks M7, the same movement twice is rejected (M8 prompt test), inflow and pending refused, M7 failure, no M7 yet, undo keeps the row, undo frees and allows linking again, double undo, deleting a goal frees its movements, a failing unlink stops the delete.

## Result

* Tests: 106 suites and 1297 tests pass. ESLint, tsc and Prettier are clean.
* Merged locally with #173's branch: no conflicts, and the savings tests (89) and tsc pass together.
* Pull request: opened from Karol's account against `develop`.

## Decisions and problems

* **Undo is a soft delete** (`deleted_at`): the contribution stops counting, but the record stays.
* **Contribution ports have their own file,** so this branch does not conflict with #173, which changes `ports.ts`.
* **Blocked by M7 (Sofia):**
  * Linking a movement needs `setTransactionGoal`.
  * The movement picker needs the movement list.
  * Showing "Aporte a plan de ahorro" in Movimientos is M7's screen.

## Next step

After #173 is merged: "Abonar a esta meta" in the open goal card (amount chips $50.000, $100.000 and $200.000, a typed amount, the Abonar button, and a "Deshacer" toast), using `contributionService.add` and `undo`.
