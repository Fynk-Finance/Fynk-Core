---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-21]
branch: feature/consents-row-in-mi-cuenta
tool: Claude Code
pr: none
status: done
---

# Open Consentimientos from Mi cuenta

## Instruction

The developer approved step A of the plan: "let's start with A which is quick". Part of A was to open, with his OK, the one-line pull request that adds M4's row to M1's Mi cuenta, with Daniel as reviewer, so HU-007 can be reached from the app.

## What was done

* `apps/mobile/src/modules/identity/ui/miCuentaRows.ts` (M1): adds `consentsMiCuentaRow` from `@modules/consents` between Apariencia and Cerrar sesión. The row already existed in M4's `index.ts`, with the same shape as M1's rows.
* `MiCuentaScreen.test.tsx` (M1): the order test now expects the row, and a new test opens Consentimientos.

## Result

* Tests: the identity suites pass (23 suites, 252 tests). Typecheck and ESLint pass.
* Pull request: not opened yet.
* Consentimientos (HU-007) now opens from Mi cuenta, not only by the deep link `fynk://consentimientos`.

## Decisions and problems

* **The row goes in Mi cuenta for now.** The design opens consents from Privacidad y datos › Cuentas conectadas (M13). That screen doesn't exist yet. When it does, M13 uses `ConnectedAccountsSection` and Daniel decides whether this row stays.
* **No import cycle.** M4 imports nothing from M1.
* **Outside our modules:** both files are M1's. The developer approved it. Daniel reviews and can reject it.

## Next step

Daniel reviews the pull request. Then close HU-007 (SCRUM-21) in Jira.
