---
date: 2026-10-25
developer: Daniel Palacios
github: Komi-yes
module: planning
jira: []
branch: none
tool: claude.ai
pr: none
status: done
---

# Team decisions, module prompts and Git rules

## Instruction

Review the team's answers to the 9 conflicts plus an encrypted cloud backup of manual data, suggest improvements, and then write a detailed prompt per module and per phase for Claude Code, including infrastructure. Key sentence: "make the detailed plan for each of the phases and modules of the project so the other developers for the modules in code can copy and paste the plan as a prompt with all the technical detail that it needs".

Also: change CLAUDE.md so developers do not conflict, make Claude Code branch from `develop` and commit correctly, and always use the design artifact for visual design. On branch names the developer chose: "make the branching naming more natural for the respective task".

## What was done

* Reviewed each decision and proposed improvements. The team chose: Inversión filters picked by the user (no filtering by balance, Decreto 2555), new phone through old phone approval or a recovery code, Banco Demo with its own portal for money actions, cédula not asked.
* Wrote 17 module prompts (`docs/modules/M00` to `M16`), `00-shared-contracts.md` and `00-phases-and-gates.md` with Gates A to E.
* Rewrote CLAUDE.md with ownership, conflict rules, Git workflow with `<type>/<short-description>` branches, and the decisions table.
* Added `.claude/settings.json` limits, the pull request template and CODEOWNERS.

## Result

* Developer kit ready: 17 prompts, shared contracts, gates, CLAUDE.md and repository settings.
* Plan doc updated with the decisions and redrawn diagrams.

## Decisions and problems

* Branches named `develop/Module1/featureX` cannot exist next to a `develop` branch in Git. Replaced by natural names like `feature/savings-goal-creation`.
* The CDT calculator reference value was corrected to $50.471.
* Internet was removed from the Banco Demo seed so the fixed expenses fixture stays at $1.930.600.

## Next step

Give Claude Code direct access to the screens of the design.
