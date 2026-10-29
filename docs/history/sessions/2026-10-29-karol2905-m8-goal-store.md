---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-51]
branch: feature/savings-goal-store
tool: Claude Code
pr: none
status: done
---

# Savings goals in the vault: create, edit, delete and the suggested monthly amount

## Instruction

After SCRUM-56, Claude proposed starting M8 with SCRUM-51 and Karol answered "si". The story is HU-035 Crear meta: "Nombre, categoría, monto objetivo y fecha límite. Aporte mensual sugerido. Varias metas, editar y eliminar. Disponible en el paso 4 y desde el Dashboard. Bóveda cifrada."

## What was done

The story is split into stacked pull requests. This first one holds the vault and the service, without screens.

* **`savings/domain/goal.ts`:**
  * `validateGoal`: name 1 to 40 characters, target above $0 and up to $1.000.000.000, deadline a real month and not before the current one.
  * `summarizeGoal`: saved amount, percent, remaining, months left and suggested monthly, from the rules in `goals.ts`.
  * `byDeadline`: nearest deadline first, as in "Próximas metas · Por fecha límite".
* **`adapters/vault/migrations.ts`:** `savings_goals` and `savings_contributions`, as in the M8 prompt. A unique index makes the same movement count for one goal at most. The reminders table comes with SCRUM-53.
* **`adapters/vault/vaultGoalStore.ts`:** list, get, save (upsert), remove (the goal and its contributions in one transaction), and the saved amount per goal (the sum of contributions that are not deleted).
* **`application/goalService.ts`:**
  * create, update and remove; editing keeps the id and creation time.
  * list, nearest deadline first, with the numbers of each card.
  * `monthlyTotal`: goals already reached are left out.
  * subscribe.
* **`index.ts`:** registers the migrations and exports `getGoals()` and `getGoalsMonthlyTotal()` for M3. The Metas route is still M0's placeholder until the next pull request.
* **Tests:**
  * `domain/goal.test.ts` (9): form rules, "8 meses · $625.000", 64 %, the Regalos de Navidad card ($140.000 suggested, $280.000 left, 65 %), a reached goal, the order.
  * `application/goalService.test.ts` (13): vault round trip, several goals, saved as the sum of contributions, deleted contributions, edit, a past deadline, delete with contributions, invalid input, subscribers, "$840.000/mes", Bogotá date.

## Result

* Tests: 81 suites and 1063 tests pass. ESLint, tsc and Prettier are clean.
* Pull request: pushed. The browser that opens pull requests from Karol's account disconnected during the session, so the pull request still has to be opened.

## Decisions and problems

* **An old goal can be edited without changing its deadline,** even if that month already passed. A new deadline cannot be in the past.
* **Deleting a goal deletes its contributions.** They are only records, and no other module points to them yet. When SCRUM-52 links movements, the delete also has to clear the `goalId` of each movement.
* **Categories follow the M8 prompt** (Viaje, Fondo de emergencia, Educación, Hogar, Vehículo, Otro). The design's sample data also shows "Celebración" and "Tecnología"; they are not added until the team decides.

## Next step

The goal form (GoalForm, as in OnbMetas, with the live "Aporte mensual sugerido" box) and the Metas screen, stacked on this branch.
