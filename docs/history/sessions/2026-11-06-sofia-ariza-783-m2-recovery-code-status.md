---
date: 2026-11-06
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M2
jira: [SCRUM-69]
branch: feature/recovery-code-status
tool: Claude Code
pr: "#296"
status: done
---

# Export the recovery code status and its screen for onboarding's Listo

## Instruction

While finishing M3, Sofia asked to "complete all the onboarding module". The M3 prompt adds to Listo a row "Código de recuperación" with "Guardado" or "Pendiente" that opens M2's recovery code screen when pending, and M2 exported neither. Sofia chose a small pull request in M2 reviewed by its owner (@Komi-yes), rather than a stub in M3.

## What was done

* **`vault/application/recoveryCodeStatus.ts`** (new): `saved` when the server holds the recovery key, `pending` when it has none, `unavailable` without a backup or when the server cannot be asked. It reuses `RecoveryKeyApi.get()`, the same check the lock controller makes after an unlock.
* **`vault/adapters/defaultLock.ts`:** wires it to the existing recovery key API and `backupEnabled()`.
* **`vault/index.ts`:** exports `getRecoveryCodeStatus()`, the `RecoveryCodeStatus` type, `RECOVERY_CODE_ROUTE` and `NewRecoveryCodeScreen` (the same instance the Seguridad route already used), so onboarding's own stack can push "Generar un código nuevo".
* **Tests:** `recoveryCodeStatus.test.ts`, the four cases.

## Result

* Tests: vault and app suites, 45 suites, 658 pass. `tsc`, ESLint and Prettier are clean.
* Pull request: #296, in the M3 stack, under the Listo pull requests. Needs @Komi-yes's approval.

## Decisions and problems

* No answer from the server is shown as no status, never as "Pendiente", so an offline phone does not ask for a code that may already be saved.

## Next step

The Listo rules in M3.
