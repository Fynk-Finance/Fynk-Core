---
date: 2026-10-30
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-33]
branch: feature/shared-screen-slots
tool: Claude Code
pr: none
status: done
---

# Screen slots in @shared/navigation, so Mis cuentas reaches Mi cuenta without an import cycle

## Instruction

While adding M6's "Mis cuentas" to Daniel's Mi cuenta, importing `@modules/accounts` from `MiCuentaScreen.tsx` broke 3 test suites (identity, notifications, vault) with an import cycle. Asked how Mis cuentas should reach Mi cuenta, Sofia picked "Slot in @shared (Recommended)".

## What was done

* `apps/mobile/src/shared/navigation/slots.tsx`: `registerSlot(name, component)` and `<Slot name />`, with the slot names listed once in `SlotName`. The first one is `miCuenta.misCuentas`. An empty slot renders nothing.
* Exported from `@shared/navigation`.
* `slots.test.tsx`: an empty slot renders nothing, and a registered section renders.

## Result

* Tests: 2 new ones pass. Lint, typecheck and Prettier clean.
* Pull request: in stack #168 above #203, below the Mis cuentas PRs that use it.

## Decisions and problems

* The cycle: `vault` already imports `identity`, so `identity → accounts → notifications → vault → identity` closed a loop. When a test loaded `identity` first, `vault` was half loaded when `notifications` called `registerVaultMigrations`.
* With a slot, M1 imports only `@shared/navigation`; M6 registers its section from `accounts/index.ts`, which the app's registry loads before anything renders. In M1's own tests M6 is not loaded, so the slot is empty and those tests do not change.
* `createElement` instead of JSX for the looked-up component, which `react-hooks/static-components` asks for.
* Billetera keeps its direct import: it has no cycle and Karol's tests pass.

## Next step

Rebase `feature/mis-cuentas-sections` on this branch and register `miCuenta.misCuentas` there.
