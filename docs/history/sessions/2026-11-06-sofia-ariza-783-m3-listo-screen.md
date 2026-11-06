---
date: 2026-11-06
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M3
jira: [SCRUM-69]
branch: feature/onboarding-summary
tool: Claude Code
pr: "#302"
status: done
---

# Add the Listo screen with live totals

## Instruction

Part of Sofia's request to "complete all the onboarding module". SCRUM-69: "La pantalla final resume correo, cuentas y efectivo, metas y gastos recurrentes con sus totales" and "Al terminar lleva al Dashboard". The M3 prompt adds the row "Código de recuperación" with "Guardado" or "Pendiente", which opens M2's recovery code screen when pending.

## What was done

* **Progress (`domain/progress.ts`, `application/onboardingService.ts`, `adapters/vault/vaultProgressStore.ts`):** a new saved step `done`. "Terminar configuración", and "Omitir" on step 4 when an earlier step was done, now open Listo instead of ending the setup. `service.finish()` ends it from "Ir a mi dashboard". "Omitir de todos modos" still ends it at once (decision of 29 Oct). A restart on Listo reopens Listo alone. No migration: the step column is text.
* **`ui/ListoScreen.tsx`** (new): the blue hero with its squares and the lime check, "¡Todo listo, <nombre>!" with the first word of the name, and the sheet "Esto es lo que registraste" with the rows of `summaryRows` (#297): counts and totals ("3 registradas" and "$8.400.000", "2 metas" and "$840.000/mes", "4 pagos" and "$1.453.900/mes"), the lime check or "Pendiente". A pending recovery code row opens M2's "Generar un código nuevo"; the numbers are read again when Listo is back on top. The Android back button is held and the gesture is off.
* **Navigation (`OnboardingNavigator.tsx`, `routes.ts`, `useStepActions.ts`):** route `onboarding.Listo`, and M2's screen registered under its own route name (typed against M2's constant), like Conectar banco.
* **`index.ts`:** `loadSummary` reads M6's accounts summary and cash, M8's goals and monthly total, M9's `getRecurringSummary()` (#295) and M2's `getRecoveryCodeStatus()` (#296). M8 and M9 are read through the lazy getters of #294.
* **Maestro `e2e/onboarding-complete.yaml`:** Listo, a restart on Listo, then "Ir a mi dashboard".
* **Tests:** `ListoScreen.test.tsx`, 8 tests (the design numbers, no name, pending parts, the recovery code round trip, no recovery row without M2's answer, "Ir a mi dashboard", finishing when the summary cannot be read, no back button), plus the progress, service, store and navigator tests for the `done` step.

## Result

* Tests: full mobile suite, 235 suites, 2618 pass. `tsc`, ESLint and Prettier are clean.
* Not run on a phone or emulator: the Maestro flow and the screen against `OnbListo.png` still need a dev build.
* Pull request: #302, in the M3 stack, on top of #297.

## Decisions and problems

* **Size:** about 590 changed lines without the screen test, over the usual 400. The screen and the `done` step cannot be split: alone, the step leaves the app on step 4, and the screen alone is never reached. The design's motion goes in its own pull request.
* **The design shows counts only** ("3 registradas" with an empty second line). The M3 prompt and the story ask for totals, so the total goes on that second line. Needs design review, with "Pendiente" (empty badge) and the recovery code row.
* **The "repeat" icon** of Gastos recurrentes is not in the shared icon set, so it is drawn in the screen with the design's path, as Omitir does with its clock.
* **If the summary cannot be read**, a short message replaces the rows and "Ir a mi dashboard" still works, so the person is never stuck.

## Next step

The design's motion on Listo: the hero that moves up, the check, the burst and sparks, the sheet and the rows.
