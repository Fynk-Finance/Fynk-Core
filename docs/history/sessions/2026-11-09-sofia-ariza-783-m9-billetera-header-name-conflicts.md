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

# Billetera greeting: conflicts with develop solved (QA review V7)

## Instruction

"Please solve the conflicts in PR #354."

## What was done

* `develop` got SCRUM-96 from Daniel Palacios ("greet by name in the Billetera tab"), the same fix as V7 on the same lines of `BilleteraScreen.tsx`, `BilleteraScreen.test.tsx` and `recurring/index.ts`. That is why #354 conflicted.
* The stack was rebased on `develop` with `gh stack rebase`. Every conflict kept `develop`'s version: the optional `useDisplayName?: () => string | null` dependency, with "Invitado" chosen inside the screen, and its two tests ("greets the person by the name typed in onboarding", "says Invitado while there is no name").
* The V7 code commit of this branch had nothing left and was dropped. The names it added to `DetectedScreen.test.tsx` and `PriceUp.test.tsx` are not needed with the optional dependency.
* The V7 test was also removed from #355 (V9) and #356 (V6), where it was carried in conflicting hunks. Their own tests stay.
* The earlier log of this branch (`2026-11-09-sofia-ariza-783-m9-billetera-header-name.md`) describes the code that was dropped. It is kept as the record of that session; this log corrects it.

## Result

* #354 now carries only its session logs: V7 is already fixed on `develop` by SCRUM-96.
* Typecheck, ESLint and Jest pass on all 9 branches of stack #361 after the rebase.

## Decisions and problems

* `develop`'s version was kept over ours because it is already merged and both did the same thing.

## Next step

Decide whether to close #354 or keep it only for its logs. Closing it needs a `gh stack` relink of #355 onto #353.
