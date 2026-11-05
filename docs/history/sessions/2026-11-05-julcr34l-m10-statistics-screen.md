---
date: 2026-11-05
developer: Julián Castiblanco
github: JulCR34l
module: M10
jira: [SCRUM-35, SCRUM-36]
branch: feature/analytics-statistics-screen
tool: Claude Code
pr: none
status: done
---

# Build the Estadísticas screen as in the design

## Instruction

Same session as the numbers of Estadísticas (#274): "sigamos haciendo las demás tareas hasta que queden al 100%".

## What was done

* `ui/SpendingScreen.tsx` is now the design's Estadísticas (screen 14), on the same route (`analytics.Spending`, path `analisis`):
  * `ui/statistics/SummaryCard.tsx`: the blue card with its shapes and shine, back button and title, "Gastaste en los últimos 30 días", the Ingresos pill, the legend, "Balance +$…", the cumulative spending of this period (solid) against the previous one (dotted) with the gradient, today's dot and the "Hoy" label, five dates and the period control. It shrinks while the page scrolls (Reanimated scroll handler, 563 px to 281 px, the summary fades out), as `--p` does in the design.
  * `ui/statistics/Sections.tsx`: Gastos por categoría (donut, legend, rows with icon and bar; a tap opens M7's list filtered by category and range), Tus estadísticas (four tiles), Por día de la semana (bars, the highest one lime, the sentence of the peak day) and Dónde más gastas.
  * Below the design's sections: the way into Topes, Tendencias (3, 6 or 12 months) and Ingresos recurrentes, for HU-022, HU-023 and HU-043.
* `ui/statistics/geometry.ts`: the chart paths in the design's 100 × 100 box, the five dates (every 7 days for "Mes", as the design), "$82k" bar labels and the change against the previous period.
* `index.ts`: `STATISTICS_ROUTE` for M6's Dashboard chart icon.
* Tests: chart geometry, and the screen with the design's numbers ($3.482.400, $5.580.000, Balance +$2.097.600, $116.080, Arriendo on 1 oct), the period control, the filtered movements, the weekday sentence, Dónde más gastas, Topes and dark.

## Result

* Mobile: tsc, ESLint, Prettier and 2,484 Jest tests pass.
* Pull request: opened against `develop` after #274 is merged, because it uses its functions.

## Decisions and problems

* The "Ahorraste" tile background (#f2fadf) is not in M0's palette: `accentSurface` is used, the closest token. Ask Sofía (M0) whether to add it.
* The design's drag along the chart to read a day is not built; the period control is the alternative the design README allows.
* The donut header says "Últimos 30 días" instead of the design's "Este mes", because the period is the last 30 days.
* The old custom date range of Gastos por categoría is gone: the period control and Tendencias cover the periods and ranges of HU-021 and HU-022.
* The Dashboard chart icon belongs to M6 (Sofía): she can open `STATISTICS_ROUTE` from it.

## Next step

Open the pull request when #274 is in `develop`, and take screenshots on a phone next to `docs/design/screens/light/Estadisticas.png` and its dark one.
