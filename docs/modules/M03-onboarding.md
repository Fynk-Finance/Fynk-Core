# M3 Guided onboarding

| Item | Value |
| --- | --- |
| Phase | 3 (can start in Phase 2 with stubs) |
| Stories | HU-052 SCRUM-69 (5) |
| Points | 5 |
| Owner | Sofia Nicolle Ariza (`@sofia-ariza-783`) |
| Owns | `apps/mobile/src/modules/onboarding/` |
| Depends on | M1 (`PATCH /me`), M2 (vault), M5 (link flow), M6 (cash), M8 (goal form), M9 (recurring form) |
| Used by | first run after registration |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M3 Guided onboarding of Fynk. This module owns the wizard and its navigation only. Each step embeds a component exported by another module. Never reimplement another module's logic here.

## Read first

1. `CLAUDE.md`, `docs/modules/00-shared-contracts.md` sections 3 and 7.
2. Design screens `OnbIntro`, `OnbNombre`, `OnbCuentas`, `OnbMetas`, `OnbGastos`, `OnbListo` and `OnbOmitir`, and the change notes in `docs/design/README.md`. `OnbCorreo` is not built (see Decisions of 29 Oct 2026). Read the code of these screens in `docs/design/sources/light/` and `docs/design/sources/dark/` first (inventory, gestures and transitions in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs in `docs/design/screens/light/` and `docs/design/screens/dark/` are for checking the result. Every screen works in light and dark (colors only from `useTheme()`), and uses the default transition and back gesture of its kind unless the inventory says otherwise.
3. Jira SCRUM-69.

## Story HU-052 (SCRUM-69), criteria

* Pasos: nombre, cuentas y efectivo, metas, gastos recurrentes (el correo se verifica en el registro, ADR 0007).
* Cada paso se puede omitir. Omitir toda la configuración muestra la advertencia de lo que quedará pendiente.
* Si el usuario cierra la aplicación, la configuración continúa en el paso donde quedó.
* La pantalla final resume correo, cuentas y efectivo, metas y gastos recurrentes con sus totales.
* Al terminar lleva al Dashboard.

## Screens (match the PNGs exactly)

**Decisions of 29 Oct 2026** (Sofia, with Claude Code; they change the design and the first version of this prompt):

* **4 steps, no Correo.** ADR 0007 verifies the email with a 6 digit code at sign up, before there is a session, and drops `EmailVerificationStep`. The steps are Nombre, Cuentas, Metas and Gastos: "Paso N de 4" and the chip "4 pasos". Omitir drops the item "Recuperar tu cuenta con tu correo". Listo still shows "Correo · Verificado".
* **The header "Omitir" skips only that step** and opens the next one ("Cada paso se puede omitir"). The warning opens from Aviso's "Omitir por ahora", and when the person skips the last step after skipping all the others. "Omitir de todos modos" ends the setup and fades to the Dashboard. The design links every "Omitir" straight to the warning.
* **One name field, like the design.** The first word is `firstName` and the rest is `lastName` ("Laura Gómez Ruiz" gives Laura / Gómez Ruiz).

Navigation: "Continuar" moves forward only when the step is valid. The back button and the back gesture return to the previous step. Omitir opens the warning as a modal. Listo has no back gesture, and "Ir a mi dashboard" fades into the tabs.

| Screen | Content | Component used |
| --- | --- | --- |
| Aviso | Blue illustration, chips "4 pasos" and "3 minutos", title "Configuremos tu cuenta", text "Te guiaremos paso a paso para dejar Fynk listo para ti.", button "Comenzar configuración", link "Omitir por ahora" | own |
| 1 Nombre | "Paso 1 de 4", "Omitir", title "¿Cómo te llamamos?", avatar with initials and "Hola, <nombre>", one name field split into first and last name, hint "Puedes cambiarlo cuando quieras desde Mi cuenta.", "Continuar" | own, saves with M1 `PATCH /me` |
| 2 Cuentas | "Agrega tus cuentas", "Cuentas bancarias" list with connected count, "Agregar otra cuenta", "Efectivo" input, "Total registrado" box | `BankLinkList` and `ConnectBankButton` from `@modules/bank`, `CashInput` from `@modules/accounts` |
| 3 Metas | "Crea tus metas", collapsible goal cards, "Agregar otra meta" | `GoalForm` and `GoalCardCompact` from `@modules/savings` |
| 4 Gastos recurrentes | "Gastos fijos" and "Suscripciones" lists with remove buttons, "Agregar gasto o suscripción", "Total mensual" box with "Te avisaremos 2 días antes de cada pago", button "Terminar configuración" | `RecurringQuickList` and `RecurringForm` from `@modules/recurring` |
| Listo | "¡Todo listo, <nombre>!", summary rows Correo, Cuentas y efectivo, Metas de ahorro, Gastos recurrentes with counts and totals, button "Ir a mi dashboard" | own, reads totals from each module's public API |
| Omitir (advertencia) | Warning icon, "¿Seguro que quieres omitir la configuración?", list of what stays pending, "Puedes configurarlo después en la aplicación", "Seguir configurando", "Omitir de todos modos" | own |

Add to Listo one row "Código de recuperación" with status "Guardado" or "Pendiente". When pending, the row opens M2's recovery code screen.

## Technical design

* Progress state stored in the vault table `onboarding_progress (step, completed_steps, skipped_steps, finished_at)` through `registerVaultMigrations('onboarding', ...)`. Steps are stored by id (`name`, `accounts`, `goals`, `recurring`), never by number. Resume on the saved step, with the earlier screens behind it so back still works.
* Gate in M0's registry (`gateOrder`, after sign in and unlock): open until `finished_at` is set. Expose `isOnboardingFinished()` and `OnboardingNavigator` from `index.ts`.
* Every total on Listo comes from the owning module (`getConnectedAccountsSummary()` from M6, `getGoalsMonthlyTotal()` from M8, `getRecurringMonthlyTotal()` from M9). If one of those modules is not merged yet, use the stub in `src/shared/testing` and leave a `TODO(M8)` comment with the Jira key.
* Strings in `modules/onboarding/ui/strings.es-CO.ts`.

## Work plan (one branch each, from `develop`)

1. `feature/onboarding-wizard-shell`: Aviso, step bar, skip logic, Omitir warning, progress persistence, resume.
2. `feature/onboarding-name-step`: step 1.
3. `feature/onboarding-accounts-goals-recurring-steps`: steps 2 to 4 embedding the other modules' components.
4. `feature/onboarding-summary`: Listo screen with live totals.

## Tests

* With the design fixtures, Listo shows `3 registradas $8.400.000`, `2 metas $840.000/mes` and `4 pagos $1.453.900/mes`.
* Killing the app on step 4 (Gastos) reopens step 4. Skipping all steps shows the warning first.
* Maestro flow `e2e/onboarding-complete.yaml` from Aviso to the Dashboard.

## Done when

* All criteria pass and the Gate D onboarding item passes on staging.

## Ask before

* Changing the order or number of steps, or adding a step that is not in the design.
