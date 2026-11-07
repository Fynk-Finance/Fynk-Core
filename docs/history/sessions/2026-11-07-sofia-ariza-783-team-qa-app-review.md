---
date: 2026-11-07
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: team
jira: [SCRUM-76, SCRUM-77, SCRUM-78, SCRUM-79, SCRUM-80, SCRUM-81, SCRUM-82, SCRUM-83, SCRUM-84, SCRUM-85, SCRUM-86, SCRUM-87, SCRUM-88, SCRUM-89, SCRUM-90, SCRUM-91, SCRUM-92, SCRUM-93, SCRUM-94, SCRUM-95]
branch: docs/qa-app-review-findings
tool: Claude Code
pr: none
status: done
---

# App review findings written down and filed in Jira

## Instruction

Sofia tested the app and listed 12 visual issues, 3 gesture improvements and 5 functional issues. She asked to "agregarlos en la documentación del repositorio y agregarlos como tareas en Jira, si son cambios pequeños o visuales, asígnamelos a mí independientemente del módulo que afecte", and to state in the repository that the owner of each affected module gives the approval when the pull request is opened.

## What was done

* `docs/qa/2026-11-07-app-review.md`: one row per finding with its Jira key, module and files, assignee and the approvals the pull request needs. A section at the top explains the assignment and approval rule.
* Jira: 20 tasks of type Tarea, SCRUM-76 to SCRUM-95, label `qa-review` plus `ui`, `gestos` or `funcional`, under the epic of the affected area. Each one has criteria, technical detail with file paths, and an "Aprobación en la PR" line.
* The code was read only to point each task at the right files. No product code changed.

## Result

* 19 tasks assigned to Sofia, 1 (F4, savings goals in Billetera, SCRUM-94) to Karol, because it is new functionality of her modules M8 and M9.
* Pull request: not opened yet.

## Decisions and problems

* Small or visual changes go to Sofia whatever the module; the module owner approves the pull request, as CODEOWNERS already requires. Functional work in Sofia's own modules (F2, F3, F5) also went to her. F1 changes the Keycloak password policy of M1, but it is small, so it went to Sofia with Daniel's approval.
* F1 "al menos un caracter" was read as "at least one special character"; to confirm.
* Root causes found while mapping: V7 Billetera passes the fixed "Invitado" name to the header; V12 `SegmentedControl` is built for the blue header (white text) and is used on the page background; F3 the Dashboard has a `TODO(M5)` for pull to refresh; V2 the Dashboard never renders M8's goals.
* The Jira project has no Bug type, so bugs were filed as Tarea with priority High (V2, V12, F2, F5).

## Next step

Confirm the F1 reading, then start with the High priority tasks: F2 (onboarding not shown), F5 (cannot add money), V12 (unreadable selectors) and V2 (goals missing on the Dashboard).
