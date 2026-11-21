---
date: 2026-11-05
developer: Julián Castiblanco
github: JulCR34l
module: M10
jira: [SCRUM-35, SCRUM-36]
branch: feature/analytics-statistics
tool: Claude Code
pr: none
status: done
---

# Add the numbers of the Estadísticas screen

## Instruction

Julián asked to keep working on his tasks until they are at 100 % while M14 answers about staging: "sigamos haciendo las demás tareas hasta que queden al 100%".

## What was done

* Review of the criteria of M10, M11 and M15 against `develop`. Everything is covered by tests, except that the design's Estadísticas screen (screen 14, M10) is only partly built and no button opens it: the design opens it from a chart icon on the Dashboard.
* `domain/statistics.ts` (pure, Bogotá days, integer centavos):
  * `periodSummary`: spending of "3 días", "Semana", "Mes" (last 30 days) or "Año" against the previous period, one cumulative point per day for both, income, balance and today's spending.
  * `periodStats`: daily average, highest expense, movement count and difference with the previous period, saving against the previous period.
  * `weekdayPattern`: average spending of each day of the week and the peak day against Monday to Friday ("Los sábados gastas en promedio el doble que entre semana").
  * `topPlaces`: the day to day places with the most spending. Fixed bills (rent, utilities, internet and phone, subscriptions) are left out, as in the design, because Billetera shows them.
* `analyticsService.getStatistics(period)` reads both periods once; `useStatistics(period)` for the screen.
* Tests on a fixture built from the design's numbers: $3.482.400, $116.080 a day, Balance +$2.097.600, Arriendo $1.400.000 on 1 oct, 64 movements (12 more), $302.800 saved, Supermercado, Recargas de transporte and Restaurantes.

## Result

* Mobile: tsc, ESLint, Prettier and 70 analytics tests pass.
* Pull request: opened against `develop`.

## Decisions and problems

* "Ahorraste … frente al mes anterior" is read as what was spent less than in the previous period.
* "Movimientos" counts every movement of the period, money in and out.
* The Banco de la República file could not be checked: its data portal (Suameca) blocks automated downloads. Someone has to download it once by hand.
* Old remote branches could not be deleted from this session (GitHub refuses it); Julián deletes them by hand.

## Next step

The Estadísticas screen itself, as in the design, in light and dark. Ask Sofía (M6) for the chart icon of the Dashboard that opens it.
