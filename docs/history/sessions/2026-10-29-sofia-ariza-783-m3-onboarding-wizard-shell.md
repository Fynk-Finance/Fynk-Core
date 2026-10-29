---
date: 2026-10-29
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M3
jira: [SCRUM-69]
branch: feature/onboarding-wizard-shell
tool: Claude Code
pr: none
status: done
---

# Onboarding shell: Aviso, the step frame, Omitir and the gate

## Instruction

Same session as `2026-10-29-sofia-ariza-783-m3-onboarding-progress.md`. Sofia approved the plan for the M3 prompt: "Branch 1 'feature/onboarding-wizard-shell' (Aviso, step bar, Omitir modal, vault progress, resume, gate)". To keep pull requests small, the shell was split into three branches. This one holds the screens. The illustration and the panel morph of Aviso come next.

## What was done

* **`ui/OnboardingNavigator.tsx`:** the flow's own native stack, inside a `NavigationIndependentTree`.
  * It holds Aviso, the four steps and Omitir. Omitir is a modal, per inventory row 28.
  * It opens on the saved step with the earlier screens behind it (`initialStateFor`), so back still works after a restart.
  * Before the progress is read it draws only the background; if the read fails, it shows `ErrorState` with a retry.
  * Transitions come from `screenOptionsFor` (`@shared/navigation`, the M0 branch below).
* **`ui/StepLayout.tsx`:** the frame of the steps from `OnbNombre.html`.
  * The blue panel with its squares and shine, and `StepProgress` with 4 steps.
  * The title and subtitle, and the body with `ob-rise`.
  * The bottom bar with "Continuar", or "Terminar configuración" on the last step.
* **`ui/useStepActions.ts`:**
  * "Continuar" and the header's "Omitir" save first, then navigate.
  * Skipping the last step after skipping all the others opens the warning.
  * The step on top is saved on focus.
* **`ui/IntroScreen.tsx`:** Aviso with the logo, the chips "4 pasos" and "3 minutos", the title, the text, "Comenzar configuración" and "Omitir por ahora".
* **`ui/SkipWarningScreen.tsx`:** content from `OnbOmitir.html`.
  * Three pending items: the email item left with the email step.
  * The footnote with the accent the design lacks ("después").
  * "Seguir configurando" goes back, and "Omitir de todos modos" ends the setup.
* **`ui/PlaceholderStep.tsx`:** Nombre, Cuentas, Metas and Gastos until their content exists, with `TODO(M5)`, `TODO(M6)`, `TODO(M8)` and `TODO(M9)` notes and Jira keys.
* **`ui/useOnboardingGate.ts` and `index.ts`:**
  * The gate stays open until `finished_at` is set.
  * The vault tables are registered at load.
  * `index.ts` exports `isOnboardingFinished()`, `OnboardingNavigator` and `routes`.
* **`src/app/AppRoot.test.tsx` (M0, Sofia's file):** a stand-in for the onboarding gate, plus two tests. Onboarding shows after sign in, and sign in wins when both gates are open.
* **`e2e/tabs.yaml` (Gate A, M0):** a fresh install now opens the setup first, so the flow skips it with "Omitir por ahora" and "Omitir de todos modos" when it shows.
* **`docs/modules/M03-onboarding.md`:** the decisions of 29 Oct (4 steps, Omitir per step, name split) and the new branch names.
* **Tests:** `ui/OnboardingNavigator.test.tsx`, 13 tests on sql.js.
  * Aviso's copy, and "Comenzar" opening "Paso 1 de 4".
  * "Omitir por ahora" showing the warning.
  * "Omitir de todos modos" closing the gate, and "Seguir configurando" not ending the setup.
  * The header "Omitir", the warning after skipping everything, and "Continuar".
  * "Terminar configuración", the back button and resume.
  * The loading and retry states.

## Result

* Tests: the whole app passes, 77 suites and 1057 tests (118 snapshots), with onboarding at 4 suites and 55 tests. ESLint and `tsc` are clean.
* Pull request: not opened yet. Stacked on `feature/onboarding-progress`.
* Works: the full flow from Aviso to the Dashboard with the placeholder steps. The skip rules and resume work too.
* Not yet: the Aviso illustration and morph (next branch), the real step contents and Listo.

## Decisions and problems

* **The flow uses its own navigation container (`NavigationIndependentTree`).** It can start from the saved stack, and the root keeps owning the gate fade.
* **While the progress is unread the gate stays open,** but sign in and unlock come first. A finished person sees only a short plain background after unlocking, never a flash of the tabs.
* **The shell was over 400 lines, so it was split.** Even split, this pull request is about 1,180 lines, a fifth of them tests.
* **Python on Windows wrote one doc with CRLF line endings.** It was converted back to LF before the commit.

* **M1's `e2e/identity/signup.yaml` will stop at the setup.** After sign up the setup shows, not the Dashboard. It is Daniel's file, so it was not changed. Its last step should wait for "Configuremos tu cuenta" (its own comment already says so).

## Next step

Aviso's illustration and the panel morph (`feature/onboarding-intro-motion`), then the Nombre step.
