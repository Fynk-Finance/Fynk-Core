---
date: 2026-11-06
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M3
jira: [SCRUM-69]
branch: feature/onboarding-goals-recurring-steps
tool: Claude Code
pr: "#294"
status: done
---

# Embed M8's goals setup and M9's recurring setup in onboarding steps 3 and 4

## Instruction

Sofia asked: "There are some things missing in M3 Onboarding ... Lets complete all the onboarding module and fix that PR." Before coding, Claude Code planned the rest of M3 as a stack of small pull requests on #277: steps 3 and 4, one export in M9, one in M2, the Listo rules and the Listo screen. Sofia approved the plan and chose to ask M9 and M2 for their exports in small pull requests reviewed by their owners.

## What was done

* **`onboarding/ui/EmbeddedStep.tsx`** (new): the step frame around a part another module builds. Metas places M8's `GoalsSetup` and Gastos recurrentes places M9's `RecurringSetup`. Both parts bring their own cards, form, "Agregar…" button and totals and save in the vault themselves, so "Continuar" and "Terminar configuración" only move the setup forward.
* **`onboarding/index.ts`:** wires both steps. M8's and M9's parts are read on render only, like M5's and M6's.
* **Placeholder:** the app no longer uses it. `ui/PlaceholderStep.tsx` moved to `testing/placeholderSteps.tsx` for the tests that do not look at a step's content, and its strings ("Paso en construcción") left the module's copy. `createOnboardingNavigator` now needs the step screens.
* **Tests:** `EmbeddedStep.test.tsx`, 5 tests on the real navigator and vault with stand-ins for M8 and M9: step 3 of 4 and 4 of 4 with their titles and parts, "Continuar" on Metas, "Omitir" on Metas, the "Terminar configuración" button on Gastos, back from Gastos to Metas. Ending the setup from step 4 is already covered by `OnboardingNavigator.test.tsx`.

## Result

* Tests: onboarding, 12 suites, 129 pass. App suite and M8's and M9's setup tests, 40 pass. `tsc`, ESLint and Prettier are clean.
* Pull request: #294, stacked on #277.

## Decisions and problems

* One small factory for both steps instead of two screens, since both are the same frame around another module's part.
* **Import cycle, found by CI after the pull request opened.** M6 imports onboarding, and M9 reads M7's exports while it loads, so loading M7 first (M7 → M6 → onboarding → M9 → M7) left them undefined: `bank/loadOrder.test.ts` and `accounts/index.test.ts` failed. Onboarding now loads M8 and M9 with a lazy `require` on first render, the same fix M7 uses for M9. Full mobile suite: 232 suites, 2590 tests pass.
* "Terminar configuración" still ends the setup at once. The Listo screen comes in its own pull requests higher in the stack.

## Next step

M9's `getRecurringSummary()` and M2's `getRecoveryCodeStatus()`, then the Listo rules and screen.
