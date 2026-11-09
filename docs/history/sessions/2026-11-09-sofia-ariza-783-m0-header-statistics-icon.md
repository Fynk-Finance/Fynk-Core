---
date: 2026-11-09
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-79]
branch: fix/header-statistics-icon-size
tool: Claude Code
pr: "#353"
status: done
---

# Draw the Estadísticas icon like the bell (QA review V4)

## Instruction

Part of "Lets fix all the visual problems at once", every pull request in one stack. V4: the Estadísticas icon and the bell must look the same, with the same size and stroke width as the bell, on purpose different from the design.

## What was done

* `shared/ui/components/HeaderBlue.tsx`: the chart icon goes from 32 px to 22 px, the bell's size. Both use the default stroke of 2 on the 24 grid, so the stroke now matches too (at 32 px it looked like 2.7 px).
* `shared/ui/icons/paths.ts`: the comment of `chartBars` says why it differs from the design.
* `components.test.tsx`: a test checks the chart icon and the bell have the same size and stroke. Catalog snapshots updated (only the size changes).
* `docs/design/README.md`: the Dashboard row of the inventory notes the difference.

## Result

* Tests: shared UI 307 of 307. Typecheck and ESLint clean.
* Pull request: #353, in stack #361 (#352 → #360).

## Decisions and problems

* The bars were already outlines (the `rect` shapes have no fill), so only the size had to change.

## Next step

V7: Billetera greets with the onboarding name instead of "Invitado".
