---
date: 2026-11-05
developer: Julián Castiblanco
github: JulCR34l
module: M11
jira: [SCRUM-39, SCRUM-66]
branch: feature/greet-by-name
tool: Claude Code
pr: none
status: done
---

# Greet by the onboarding name and open M8's payday reminder

## Instruction

Julián asked to review the latest updates and say what is missing: "revisando las actualizaciones, que falta??".

## What was done

* Review of `develop`: M3 now exports `useDisplayName()` (the name typed in onboarding) and the Dashboard greets the person with it; M8 exports `openPaydayReminder`. Recomendaciones and Inversión still showed "Invitado".
* `recommendations/index.ts`: the installed screen greets with M3's name ("Invitado" before there is one), and "Programar" opens M8's payday reminder directly instead of going through Metas. `configureRecommendations({ navigation })` can still override both.
* `investment/index.ts`: the header greets with M3's name the same way.
* Tests: `recommendations/index.test.tsx` and `investment/index.test.tsx` render the installed screens with the name and with "Invitado".

## Result

* Mobile: tsc, ESLint, Prettier and 2,566 Jest tests pass.
* Pull request: opened against `develop`.

## Decisions and problems

* The name is read inside each module's `index.ts`, so M0's `startup.ts` is not touched.
* Still open, owned by others: the Dashboard chart icon that opens Estadísticas (M6, Sofía); the staging settings of M11 and M15 and the Banco de la República egress route (M14, Juan Pablo); the manual download of the Banco de la República file; deleting the old remote branches by hand.

## Next step

Review and merge of this pull request. Then the staging check of SCRUM-38 and SCRUM-66 when M14 configures staging.
