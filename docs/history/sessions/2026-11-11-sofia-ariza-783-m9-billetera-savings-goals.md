---
date: 2026-11-11
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M9
jira: [SCRUM-94]
branch: feature/billetera-savings-goals
tool: Claude Code
pr: none
status: done
---

# Savings goals section in Billetera (QA review F4)

## Instruction

F4 of the 7 Nov app review was assigned to Karol, and the team decided it is Sofia's task: "Change the assignament in jira, and lets implement de requiremente QA-F4. The Screen should only show the current goals, the skeleton if there is not any goal and the button to see more."

## What was done

* Jira SCRUM-94: assigned to Sofia. The criteria now follow the narrowed scope: only the current goals, the ghost card without goals, and "Ver todos" to Metas.
* `modules/recurring/ui/BilleteraScreen.tsx`: new optional dependency `renderGoals`, rendered right under "Mis cuentas" and above "Gastos recurrentes". It shows whatever state the recurring list is in.
* `modules/recurring/index.ts`: wires M8's `GoalsCarousel` from `@modules/savings`, the same section the Dashboard shows (goals not reached yet, "Ver todos" and each card open Metas, ghost card "Crear meta" without goals).
* `BilleteraScreen.test.tsx`: the section shows above the recurring expenses, it shows also without recurring expenses, and it is absent when M8 is not wired. `GoalsCarousel.test.tsx` already covers the current goals only, the ghost card, "Ver todos" and the dark theme.
* `docs/qa/2026-11-07-app-review.md`: F4 is now Sofia's, Karol approves.
* `docs/design/README.md`: the Billetera inventory row notes the new section.

## Result

* Tests: 2857 of 2857 (3 new in Billetera). Typecheck, ESLint and Prettier clean.
* No change in `modules/savings` or `shared/ui`. Karol approves (M9).

## Decisions and problems

* Reused `GoalsCarousel` instead of a new list: it already does exactly the narrowed scope and keeps Billetera and the Dashboard the same.
* The title stays "Planes de ahorro", as on the Dashboard, so the same section has one name.
* Placed under "Mis cuentas", before the recurring expenses. New section, needs design review.
* No import cycle: `@modules/accounts` already loads `@modules/savings`, and transactions loads recurring lazily.

## Next step

Open the pull request and ask Karol for review.
