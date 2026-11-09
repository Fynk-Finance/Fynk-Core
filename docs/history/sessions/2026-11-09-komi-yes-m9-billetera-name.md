---
date: 2026-11-09
developer: Daniel Palacios
github: Komi-yes
module: M9
jira: [SCRUM-96]
branch: fix/billetera-user-name
tool: Claude Code
pr: "#350"
status: done
---

# Greet by name in the Billetera tab

## Instruction

Daniel noticed that "in the billetera tab is not using the name of the user like the other tabs".

## What was done

* `recurring/ui/BilleteraScreen.tsx`: an optional `useDisplayName` dependency. The header shows it and falls back to the guest text.
* `recurring/index.ts`: wires `useDisplayName` from `@modules/onboarding`, lazily.
* Two tests in `BilleteraScreen.test.tsx`; the name test was seen failing first.

## Result

* Tests: 224 pass in `src/modules/recurring` and `src/app`, `tsc` clean. ESLint and Prettier clean on the changed files.
* On the Android emulator, with a test account: the Billetera header greets by the name given in onboarding.
* Pull request: #350.

## Decisions and problems

* This is a change in Karol's module, made because Daniel asked for it, so it needs Karol's approval.

## Next step

Karol reviews it.
