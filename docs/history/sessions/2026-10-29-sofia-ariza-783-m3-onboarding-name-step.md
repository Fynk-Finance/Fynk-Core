---
date: 2026-10-29
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M3
jira: [SCRUM-69]
branch: feature/onboarding-name-step
tool: Claude Code
pr: none
status: done
---

# Onboarding step 1: Nombre

## Instruction

Same session as the other onboarding logs of 29 Oct. The plan Sofia approved ends with branch 2, "steps 1 and 2", which became just Nombre once the email step was dropped (ADR 0007). For the name field Sofia said to keep the design's single field "but take the second word separated by whitespace as the 'Apellido'". It was built as: the first word is the first name and everything after it is the last name, so "Laura Gómez Ruiz" keeps both last names.

## What was done

* **`domain/name.ts`:**
  * `splitFullName`, `joinName` and `greetingName`.
  * `nameProblem`, a copy of the API's `validName` rule:
    * 1 to 50 letters per part, of any script, counted in code points;
    * marks, spaces, apostrophes, hyphens and periods allowed;
    * starts with a letter and ends with a letter or a mark.
* **`adapters/api/profileNameApi.ts`:** reads the name with `GET /me` and saves it with `PATCH /me`, through the shared client and the identity contract. Nothing is imported from M1's internals, and the name travels only in the body.
* **`ui/NameStepScreen.tsx`:** content from `OnbNombre.html`.
  * The 88 px avatar with the 5 px ring in the theme's soft blue, which fixes the dark export bug.
  * "Hola, **Laura**!" from the first word, the field with the user icon and "Tu nombre", and the hint.
  * The field starts with the saved name, without ever replacing what the person typed.
  * "Continuar" stays disabled until the name is valid. It saves first and then opens Cuentas.
  * `invalid_profile` and network errors keep the person on the step with a message.
* **`StepLayout`:** a step can replace "Continuar" with its own save (`onContinue`, `busy`).
* **`index.ts`:** the flow uses the real Nombre step. Cuentas, Metas and Gastos are still placeholders.
* **`e2e/onboarding-complete.yaml`:** Maestro flow from Aviso to the Dashboard.
  * It skips Nombre, because the dev-token build has no API session.
  * It walks the placeholder steps, kills and reopens the app on step 3, then finishes.
  * It checks that the setup does not come back on the next launch.
* **Tests:**
  * `domain/name.test.ts` (24).
  * `adapters/api/profileNameApi.test.ts` (5): the body of `PATCH /me`, no query string, `invalid_profile`.
  * `ui/NameStepScreen.test.tsx` (10): disabled until valid, the greeting, the split saved before moving on, a refused name, network and API errors, the prefill, typed text not overwritten, and skipping.

## Result

* Tests: the whole app passes, 81 suites and 1101 tests (118 snapshots). ESLint, `tsc` and Prettier are clean.
* Pull request: not opened yet. Stacked on `feature/onboarding-intro-motion`.
* Maestro was not run: it is not installed on this computer and no emulator was available.
* The screens were not checked against the PNGs on a device from this session.

## Decisions and problems

* **"J. Gómez" is refused.** The API rule says a part must end with a letter, so a first name like "J." fails. The phone follows the API exactly so it never sends a name the API refuses. If the team wants initials, the API rule changes first (M1).
* **The validation messages are not in the design:** new copy, needs design review.
* **`Avatar` size 88 draws 32 px initials** (shared map), while the design says 30. Left as the shared component decides.

## Next step

Open the stacked pull requests. Then wait for M5, M6, M8 and M9 to export their step components (Cuentas, Metas, Gastos), and build Listo with the live totals.
