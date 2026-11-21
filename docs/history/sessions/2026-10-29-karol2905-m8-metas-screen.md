---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-51]
branch: feature/savings-goals-screen
tool: Claude Code
pr: none
status: done
---

# Metas de ahorro screen

## Instruction

After #172 brought the goal form to `develop`, Claude proposed the Metas screen next, as a pull request straight to `develop` without a stack. Karol answered "si".

## What was done

* **`ui/MetasScreen.tsx`** (route `savings.Goals`, path `metas`), replacing M0's placeholder. Design Metas, inventory row 15:
  * The blue header and the stats card over it.
  * "Próximas metas · Por fecha límite" with the goals not reached yet.
  * "Metas cumplidas".
  * The extended "Nueva meta" FAB, which opens the goal form.
  * Empty state with "Crear meta".
* **`ui/MetasHeader.tsx`:** the squares, the lime sparkle, the shine, the back button, the "N activas" pill, title and subtitle.
* **`ui/MetasStats.tsx`:**
  * Top: the 74 px ring with "23 % de tus ingresos va a tus metas · $X al mes de $Y" when an income is given.
  * Without an income: "$X al mes van a tus metas".
  * Bottom: Ahorrado, Abonado este mes (green, with a plus) and Cumplidas.
* **`ui/GoalCard.tsx`:**
  * Head: blue tile with the category icon, "Viaje · Jun 2027", the 8 px bar, "$3.200.000 de $5.000.000", "Faltan 8 meses" (lime when 2 months or less, blue otherwise) and the percent.
  * Tapping the head opens "Aporte sugerido $X/mes", "Te falta $X" and "Editar meta" with the `mt-open` animation (0.28 s, at rest with reduced motion). Only one goal is open at a time.
* **"Metas cumplidas":** the lime banner "Has ahorrado $X en metas cumplidas · Sigue así, vas muy bien." and a timeline of reached goals: "Otro · Cumplida en ago 2026", with the target amount.
* **Service changes:**
  * `overview()` gives Ahorrado, Abonado este mes, Cumplidas and the monthly total.
  * Each goal now carries `completedOn` (the day of its last contribution, once reached).
  * The store gained `contributedBetween` and the last contribution day per goal.
* **`ui/goalIcons.ts`:** an icon per category.
* **`index.ts`:** registers the screen and exports `METAS_ROUTE` for the Dashboard's "Ver todos".
* **Tests:**
  * `ui/MetasScreen.test.tsx` (11): the design's numbers by deadline, expand and collapse, edit, FAB, stats, the share of income, without income, reached goals, empty state, live update, dark theme.
  * `application/goalService.test.ts` (+1): overview and completion date.

## Result

* Tests: 102 suites and 1270 tests pass. ESLint, tsc and Prettier are clean.
* Pull request: opened from Karol's account against `develop`.

## Decisions and problems

* **"23 % de tus ingresos" needs M10's monthly income, which M10 does not export yet.** The screen takes it as a dependency, and `index.ts` passes "no income" until then. Meanwhile the card says "$X al mes van a tus metas" (new copy, needs review).
* **"Cumplida en ago 2026" uses the day of the last contribution** of a reached goal. The design's "En 9 meses" pill is left out: it needs a creation-to-completion rule that is not in the M8 prompt.
* **"Abonar a esta meta"** (amount chips and the Abonar button) is not in the expanded card yet; it belongs to SCRUM-52.
* **The design's "Ver todas las metas (5)" link is left out,** because the list already shows every goal.
* **The design shows 49 % for $4.860.000 of $10.000.000; the app shows 48 %.** The percent is rounded down (decision of 28 Oct in the goal rules), so a goal never reads more than it has.

## Next step

The Dashboard carousel "Planes de ahorro", then SCRUM-52 (contributions).
