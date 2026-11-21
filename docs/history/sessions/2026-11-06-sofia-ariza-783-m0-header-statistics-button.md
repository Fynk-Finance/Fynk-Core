---
date: 2026-11-06
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-28]
branch: feature/header-statistics-button
tool: Claude Code
pr: "#304"
status: done
---

# Estadísticas chart button in the shared Dashboard header

## Instruction

Sofia asked to finish the missing link between the Dashboard and Estadísticas: "There is a missing part, the link between dashboard and stadistics. Complete this task. It is part of M6". The Dashboard header is M0's shared `HeaderBlue`, so the button goes in this shared pull request first, and M6 uses it in a pull request stacked on top.

## What was done

* `apps/mobile/src/shared/ui/icons/paths.ts`: new `chartBars` icon, the three rounded bars of `Dashboard.html` (`rx 1.5`).
* `apps/mobile/src/shared/ui/strings.es-CO.ts`: `statistics: 'Estadísticas'`, the design's `aria-label`.
* `apps/mobile/src/shared/ui/components/HeaderBlue.tsx`: optional `onPressStatistics`. When set, a 48 px button with the 32 px chart icon sits left of the bell, 2 px apart (`spacing.xxs`), as in the design. Without it the header renders exactly as before, so Billetera, Recomendaciones and Inversión do not change.
* Tests: `components.test.tsx` checks that the button only shows with the handler, has the label "Estadísticas" and calls it. A new `Dashboard` story in the catalog adds light and dark snapshots.

## Result

* Tests: 287 of 287 in `src/shared/ui`, 2 new snapshots, no existing snapshot changed. Typecheck, ESLint and Prettier clean.
* Pull request: #304, the bottom of stack #309, under #306.

## Decisions and problems

* The Gastos pill of the balance card stays a plain box. M10's code comment says M6 could also open Estadísticas from it, but the design only links the chart icon (inventory row 5). Sofia chose the chart icon only.
* The Jira key is SCRUM-28 (HU-014), the story already used for the Dashboard header and balance card.
* The local checkout had uncommitted test-only changes in `services/api/internal/audit/validation.go` that blocked `git pull`. The work was done in a separate git worktree, so those changes were left untouched.

## Next step

M6 passes `onPressStatistics` from the Dashboard with M10's `STATISTICS_ROUTE` (`feature/dashboard-statistics-link`, stacked on this branch).
