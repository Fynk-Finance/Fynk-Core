# M3 Guided onboarding

| Item | Value |
| --- | --- |
| Phase | 3 (can start in Phase 2 with stubs) |
| Stories | HU-052 SCRUM-69 (5) |
| Points | 5 |
| Owner | Sofia Nicolle Ariza (`@sofia-ariza-783`) |
| Owns | `apps/mobile/src/modules/onboarding/` |
| Depends on | M1 (`EmailVerificationStep`, `PATCH /me`), M5 (link flow), M6 (cash), M8 (goal form), M9 (recurring form) |
| Used by | first run after registration |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M3 Guided onboarding of Fynk. This module owns the wizard and its navigation only. Each step embeds a component exported by another module. Never reimplement another module's logic here.

## Read first

1. `CLAUDE.md`, `docs/modules/00-shared-contracts.md` sections 3 and 7.
2. Design PNGs `12-config-aviso.png` to `19-config-omitir.png` and the change notes in `docs/design/README.md`. Read the code of the same screens in `docs/design/source/` first (file map in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs are for checking the result.
3. Jira SCRUM-69.

## Story HU-052 (SCRUM-69), criteria

* Pasos: nombre, verificación de correo, cuentas y efectivo, metas, gastos recurrentes.
* Cada paso se puede omitir. Omitir toda la configuración muestra la advertencia de lo que quedará pendiente.
* Si el usuario cierra la aplicación, la configuración continúa en el paso donde quedó.
* La pantalla final resume correo, cuentas y efectivo, metas y gastos recurrentes con sus totales.
* Al terminar lleva al Dashboard.

## Screens (match the PNGs exactly)

| Screen | Content | Component used |
| --- | --- | --- |
| Aviso | Blue illustration, chips "5 pasos" and "3 minutos", title "Configuremos tu cuenta", text "Te guiaremos paso a paso para dejar Fynk listo para ti.", button "Comenzar configuración", link "Omitir por ahora" | own |
| 1 Nombre | "Paso 1 de 5", "Omitir", title "¿Cómo te llamamos?", avatar with initials and "Hola, <nombre>", fields Nombre and Apellido, hint "Puedes cambiarlo cuando quieras desde Mi cuenta.", "Continuar" | own, saves with M1 `PATCH /me` |
| 2 Correo | "Verifica tu correo", link based (see M1) | `EmailVerificationStep` from `@modules/identity` |
| 3 Cuentas | "Agrega tus cuentas", "Cuentas bancarias" list with connected count, "Agregar otra cuenta", "Efectivo" input, "Total registrado" box | `BankLinkList` and `ConnectBankButton` from `@modules/bank`, `CashInput` from `@modules/accounts` |
| 4 Metas | "Crea tus metas", collapsible goal cards, "Agregar otra meta" | `GoalForm` and `GoalCardCompact` from `@modules/savings` |
| 5 Gastos recurrentes | "Gastos fijos" and "Suscripciones" lists with remove buttons, "Agregar gasto o suscripción", "Total mensual" box with "Te avisaremos 2 días antes de cada pago", button "Terminar configuración" | `RecurringQuickList` and `RecurringForm` from `@modules/recurring` |
| Listo | "¡Todo listo, <nombre>!", summary rows Correo, Cuentas y efectivo, Metas de ahorro, Gastos recurrentes with counts and totals, button "Ir a mi dashboard" | own, reads totals from each module's public API |
| Omitir (advertencia) | Warning icon, "¿Seguro que quieres omitir la configuración?", list of what stays pending, "Puedes configurarlo después en la aplicación", "Seguir configurando", "Omitir de todos modos" | own |

Add to Listo one row "Código de recuperación" with status "Guardado" or "Pendiente". When pending, the row opens M2's recovery code screen.

## Technical design

* Progress state stored in the vault table `onboarding_progress (step, completed_steps, skipped_steps, finished_at)` through `registerVaultMigrations('onboarding', ...)`. Resume on the saved step.
* Navigation guard in M0's registry: after login, if `finished_at` is null, show onboarding. Expose `isOnboardingFinished()` and `OnboardingNavigator` from `index.ts`.
* Every total on Listo comes from the owning module (`getConnectedAccountsSummary()` from M6, `getGoalsMonthlyTotal()` from M8, `getRecurringMonthlyTotal()` from M9). If one of those modules is not merged yet, use the stub in `src/shared/testing` and leave a `TODO(M8)` comment with the Jira key.
* Strings in `modules/onboarding/ui/strings.es-CO.ts`.

## Work plan (one branch each, from `develop`)

1. `feature/onboarding-wizard-shell`: Aviso, step bar, skip logic, Omitir warning, progress persistence, resume.
2. `feature/onboarding-name-and-email-steps`: steps 1 and 2.
3. `feature/onboarding-accounts-goals-recurring-steps`: steps 3 to 5 embedding the other modules' components.
4. `feature/onboarding-summary`: Listo screen with live totals.

## Tests

* With the design fixtures, Listo shows `3 registradas $8.400.000`, `2 metas $840.000/mes` and `4 pagos $1.453.900/mes`.
* Killing the app on step 4 reopens step 4. Skipping all steps shows the warning first.
* Maestro flow `e2e/onboarding-complete.yaml` from Aviso to the Dashboard.

## Done when

* All criteria pass and the Gate D onboarding item passes on staging.

## Ask before

* Changing the order or number of steps, or adding a step that is not in the design.
