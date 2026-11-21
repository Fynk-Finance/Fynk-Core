---
date: 2026-11-09
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M9
jira: [SCRUM-82]
branch: fix/billetera-header-name
tool: Claude Code
pr: "#354"
status: done
---

# Billetera greets with the onboarding name (QA review V7)

## Instruction

Part of "Lets fix all the visual problems at once", every pull request in one stack. V7: Billetera says "Hola, Invitado" while the other tabs say "Hola, Sofia".

## What was done

* `modules/recurring/ui/BilleteraScreen.tsx`: new `useDisplayName` dependency; the header shows it instead of the fixed `t.guest`.
* `modules/recurring/index.ts`: passes M3's `useDisplayName()`, or "Invitado" when there is none, as Inversión and Recomendaciones do.
* `BilleteraScreen.test.tsx`: a test checks the header shows the given name and not "Invitado". `DetectedScreen.test.tsx` and `PriceUp.test.tsx` pass a name to their Billetera.

## Result

* Tests: 2721 of 2721. Typecheck and ESLint clean.
* Pull request: #354, in stack #361 (#352 → #360). Karol approves (M9).

## Decisions and problems

* M3 imports this module for its recurring step, so the name is read inside the screen, never at import time, the same as the Dashboard does with M6.

## Next step

V9: the Estadísticas button on every tab, and a working bell and avatar in Recomendaciones and Inversión.
