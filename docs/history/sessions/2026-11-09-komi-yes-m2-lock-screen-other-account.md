---
date: 2026-11-09
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-96]
branch: fix/lock-screen-other-account
tool: Claude Code
pr: "#346"
status: done
---

# Say when another account signed in, and give the lock screen a way out

## Instruction

Same report as the owner binding: a new account made from the lock screen's Keycloak page ended in "no pudimos verificar tu contraseña, intenta de nuevo".

## What was done

* `identity/application/sessionService.ts`: `reauthenticate` answers `otherAccount` when the `sub` differs. `changePassword` still answers `failed`.
* `vault/adapters/confirmOwner.ts`: `otherAccount` throws like `failed`.
* `lockController.ts`: `unlockWithPassword` sets the notice `otherAccount` instead of the password error.
* `LockScreen.tsx`, `VaultFlow.tsx`, `strings.es-CO.ts`: the notice and the "Usar otra cuenta" link, which signs out and leads to Inicio. Hidden only while unlocking.
* Tests in `sessionService.test.ts`, `confirmOwner.test.ts`, `lockController.test.ts`, `LockScreen.test.tsx` and `VaultFlow.test.tsx`.

## Result

* Tests: 920 pass in `src/modules/vault` and `src/modules/identity`, `tsc` clean. ESLint and Prettier clean on the changed files.
* On the Android emulator: lock screen, "Ingresar con contraseña", "Regístrate", the email code, and the app now says "Ingresaste con una cuenta distinta a la de este teléfono". "Usar otra cuenta" went to Inicio.
* Pull request: #346.

## Decisions and problems

* Root cause: the new account has a different `sub`, `adopt()` correctly refused it, and the only message available was the password one.
* The password stays in the Keycloak page in the system browser (architecture rule 3). Daniel asked about typing it in the app; changing that is a team decision.

## Next step

Review of this pull request after the one below it.
