---
date: 2026-10-29
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M3
jira: [SCRUM-69]
branch: feature/onboarding-progress
tool: Claude Code
pr: none
status: done
---

# Keep the onboarding progress in the vault and resume it

## Instruction

Sofia gave Claude Code the M3 prompt ("You are building module M3 Guided onboarding of Fynk. This module owns the wizard and its navigation only."). Before any code, Claude Code checked `develop` and asked three questions. Sofia chose:

* **4 steps, no Correo.** ADR 0007 verifies the email with a code at sign up, so the email step and `EmailVerificationStep` no longer exist.
* **The header "Omitir" skips only that step.** The warning appears from "Omitir por ahora" and after skipping every step.
* **One name field, like the design.** "take the second word separated by whitespace as the Apellido".

Scope of the session: the wizard shell and the Nombre step. The shell was split into this branch (rules and storage) and `feature/onboarding-wizard-shell` (screens) to keep pull requests small.

## What was done

* **`domain/steps.ts`:** the four steps `name`, `accounts`, `goals` and `recurring`, with "Paso N de 4", next and previous.
* **`domain/progress.ts`:** pure rules of the setup:
  * `start`, `completeStep` and `skipStep`. `skipStep` reports `showWarning` when the last step is skipped after skipping all the others.
  * `visit` saves the screen on top, after the back button or the back gesture.
  * `skipAll` and `finish`, and `screensUpTo` for the resume stack.
  * A finished setup never moves again.
* **`adapters/vault/migrations.ts`:** table `onboarding_progress` (one row: step, completed and skipped steps as JSON, `finished_at`, `updated_at`).
* **`adapters/vault/vaultProgressStore.ts`:** load and upsert. Step ids this build does not know are dropped, so an old saved setup never breaks the app.
* **`application/onboardingService.ts`:** an external store, ready for React's `useSyncExternalStore`.
  * It reads the progress on `vault.unlocked` and forgets it on `vault.locked`.
  * It saves every move before showing it, and runs one move at a time.
  * It reports `failed` when the vault cannot be read for another reason.
* **Tests:**
  * 27 domain tests.
  * 4 vault contract tests on sql.js.
  * 11 service tests, including "reopens on step 4 after the app is killed on step 4" and "shows the warning before ending when every step was skipped".

## Result

* Tests: 3 suites, 42 tests pass. ESLint and `tsc` are clean.
* Pull request: not opened yet. Stacked on `refactor/share-screen-options`.
* Jira SCRUM-69: the criterion now reads "Pasos: nombre, cuentas y efectivo, metas, gastos recurrentes (el correo se verifica en el registro, ADR 0007)", with a comment explaining the change.

## Decisions and problems

* **Steps are stored by id, not by number,** so a later change of order does not move a saved setup to the wrong screen.
* **The saved step follows the screen on top** (`visit`). The back gesture can pop a screen without our button, so a separate "back" move would miss it.
* **Finding: the progress is not part of the encrypted backup.** A person who restores on a new phone would see the setup again. The team should decide whether a restore marks it as finished.

## Next step

The screens of the shell: Aviso, the step frame, Omitir and the gate (`feature/onboarding-wizard-shell`).
