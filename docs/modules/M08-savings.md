# M8 Savings goals

| Item | Value |
| --- | --- |
| Phase | 3 |
| Stories | HU-035 SCRUM-51 (3), HU-036 SCRUM-52 (3), HU-037 SCRUM-53 (3) |
| Points | 9 |
| Owner | Karol |
| Owns | `apps/mobile/src/modules/savings/` |
| Depends on | M2 (vault, backup), M7 (`setTransactionGoal`, movement list), M12 (milestone notifications) |
| Used by | M3 (onboarding step 4), M10 (goals in the snapshot), M11 ("Aporte automático" action), Dashboard |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M8 Savings goals of Fynk. Goals live only in the vault and in the encrypted backup. Fynk never moves money: a contribution is either a movement the user already made at the bank, or a manual record.

## Read first

1. `CLAUDE.md` (Architecture rule 6), `docs/modules/00-shared-contracts.md` sections 3 and 7.
2. Design PNGs `16-config-metas.png` and `16-config-metas-2.png`, `05-dashboard.png` (Planes de ahorro), `08-notificaciones.png` (milestone), `10-recomendaciones.png` and `10-recomendaciones-2.png` (Aporte automático). Read the code of the same screens in `docs/design/source/` first (file map in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs are for checking the result.
3. Jira SCRUM-51, SCRUM-52, SCRUM-53.

## Stories and criteria

* **HU-035 Crear meta (SCRUM-51)** Nombre, categoría, monto objetivo y fecha límite. Aporte mensual sugerido. Varias metas, editar y eliminar. Disponible en el paso 4 y desde el Dashboard. Bóveda cifrada.
* **HU-036 Registrar aportes (SCRUM-52)** Asociar un movimiento sincronizado. Aporte manual con monto y fecha. Fynk no ejecuta transferencias. Se refleja en movimientos como aporte a plan de ahorro. Se puede deshacer.
* **HU-037 Seguimiento (SCRUM-53)** Ahorrado, porcentaje y restante. Indica si el ritmo permite cumplir. Avisos en 50 %, 75 % y 100 %. Cálculos determinísticos y verificables.

## Rules (pure functions in `domain/`)

* `monthsLeft(today, deadline)`: number of calendar months after the current month up to and including the deadline month. October 2026 to June 2027 gives 8. Minimum 1.
* `suggestedMonthly(target, saved, monthsLeft)`: `ceil((target - saved) / monthsLeft)` rounded up to the next $1.000. $5.000.000 in 8 months gives $625.000. $3.000.000 in 14 months gives $215.000.
* `progress`: `saved / target`, shown as an integer percent (3.200.000 of 5.000.000 gives 64 %).
* `onTrack`: average contributions of the last 3 months (or since creation) are at least `suggestedMonthly`. Show "Vas a tiempo" or "Te faltan $X al mes para llegar".
* Milestones 50, 75 and 100 notify once each through M12 with dedupe key `goal:<id>:<milestone>`: title "<meta>", body "Llegaste al 64 % de tu meta." style.
* Goal categories: Viaje, Fondo de emergencia, Educación, Hogar, Vehículo, Otro (icon per category, the design uses a lime tile with a target icon or a plane).

## Screens

* **Planes de ahorro** on the Dashboard (`GoalsCarousel`): title, "Ver todos", horizontal cards with lime icon tile, name, progress bar, saved amount, percent.
* **Mis metas** (new, from "Ver todos"): list of goal cards plus "Nueva meta".
* **Detalle de meta** (new): progress ring or bar, saved, target, restante, deadline, suggested monthly, on track status, list of contributions, buttons "Agregar aporte" and "Vincular un movimiento".
* **GoalForm** (also used by onboarding step 4, collapsible card style from the PNG): Nombre de la meta, Categoría (selector), Monto objetivo, Fecha límite (month and year picker), live box "Aporte mensual sugerido · 8 meses para llegar a $5.000.000 · $625.000".
* **Agregar aporte**: amount, date, optional note. **Vincular un movimiento**: picker from M7 limited to outflows of the last 60 days, sets `goalId` with `setTransactionGoal`.
* **Payday reminder** (from Recomendaciones "Programar"): choose an amount and the salary day (prefilled from M10's recurring income), schedules a monthly M12 reminder "Hoy es día de pago: aparta $300.000 para Viaje a Cartagena". It never moves money.

## Technical design

* Vault tables through `registerVaultMigrations('savings', ...)`: `savings_goals (id, name, category, target_minor, deadline_month, created_at, archived_at)`, `savings_contributions (id, goal_id, amount_minor, contributed_on, source, transaction_id, note, deleted_at)`, `savings_reminders (id, goal_id, amount_minor, day_of_month)`.
* Saved amount = sum of non deleted contributions. Linking a movement creates a contribution with `source='movement'` pointing to it. Undo deletes the contribution and clears the movement's `goalId`.
* Backup collections `savings.goals` and `savings.contributions` (reminders inside goals).
* Exports in `index.ts`: `GoalsCarousel`, `GoalForm`, `GoalCardCompact`, `GoalsListScreen`, `GoalDetailScreen`, `getGoals()`, `getGoalsMonthlyTotal()` (sum of suggested monthly, used by M3), `getGoalsForSnapshot()` (used by M10), `openPaydayReminder(goalId, amount)`.

## Work plan (one branch each, from `develop`)

1. `feature/savings-goal-domain`: pure functions with the reference tests first.
2. `feature/savings-goal-creation`: tables, GoalForm, list, carousel, backup collections.
3. `feature/savings-contributions`: manual and linked contributions, undo, detail screen.
4. `feature/savings-progress-and-reminders`: on track logic, milestones, payday reminder.

## Tests

* The four reference values from the shared contracts section 7.
* Milestones fire once even if progress goes 49, 51, 49, 51.
* Linking the same movement twice is rejected.

## Done when

* All criteria pass and the Gate D goal item passes on staging.

## Ask before

* Adding automatic transfers or any wording that suggests Fynk moves the money.
