---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-53]
branch: feature/savings-milestones
tool: Claude Code
pr: none
status: done
---

# Milestone notices at 50 %, 75 % and 100 %

## Instruction

While #174 (contributions) waited for approval, Karol asked: "revisa que puedes avanzar con lo que esta ya mezclado y ve avanzando". The milestone notices of SCRUM-53 (HU-037 Seguimiento: "Avisos en 50 %, 75 % y 100 %") depend only on what is already in `develop`.

## What was done

* **`domain/milestones.ts`:** `planMilestones(percent, noticed)`.
  * Records the milestones reached for the first time.
  * Notices only the highest of them: a jump from 40 % to 80 % gives one notice, for 75 %.
* **Migration 2 of `savings`:** table `savings_milestones (goal_id, milestone, reached_at)`. Deleting a goal deletes its milestones too (`vaultGoalStore.remove`).
* **`adapters/vault/vaultMilestoneStore.ts` and `application/milestonePorts.ts`.**
* **`application/milestoneNotifier.ts`:** `check()` notifies through M12's `NotificationsPort`.
  * Kind `goal_milestone`, title the goal's name, link `fynk://metas`, dedupe key `goal:<id>:<milestone>`.
  * Body as in the Notificaciones design ("Llegaste al 64 % de tu meta."), or "Cumpliste tu meta de $5.000.000. ¡Bien hecho!" at 100 %.
  * The notice goes first and the milestone is stored after, so a failure is retried and M12's key never shows it twice.
* **`index.ts`:** checks when the vault opens and after every change of the goals (with #174, also after every contribution). Only with the app open.
* **Tests:**
  * `domain/milestones.test.ts` (5).
  * `application/milestoneNotifier.test.ts` (7): the design's notice, nothing below 50 % and no repeats, 49, 51, 49, 51 notices once (M8 prompt test), one notice for a jump, 100 %, a failing M12, deleting a goal.

## Result

* Tests: 107 suites and 1301 tests pass. ESLint, tsc and Prettier are clean.
* Merged locally with #174's branch: no conflicts.
* Pull request: opened from Karol's account against `develop`.

## Decisions and problems

* **The module keeps its own record of the milestones reached,** besides M12's dedupe key. A milestone passed by a jump is stored without a notice and never comes later, even if the saving goes down and up again.
* **The notice shows the real percent** ("Llegaste al 80 %"), as in the design's example (64 %), not the milestone number.
* **"Vas a tiempo / Te faltan $X al mes" is the other half of SCRUM-53.** The rule is in `domain/goals.ts` (`pace`); it goes on the Metas card next.

## Next step

"Vas a tiempo" on the Metas card, then "Abonar a esta meta" once #174 is merged.
