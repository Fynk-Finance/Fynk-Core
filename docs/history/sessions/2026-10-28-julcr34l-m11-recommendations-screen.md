---
date: 2026-10-28
developer: Julián Castiblanco
github: JulCR34l
tool: Claude Code
pr: none
status: done
module: M11
jira: [SCRUM-38, SCRUM-39, SCRUM-40]
branch: feature/recommendations-screen
---

# Recomendaciones screen

## Instruction

Julián asked Claude (claude.ai, Fynk project, session linked to the repository zip): "soy la persona 6, que hace la parte de analytics AI and investment, ayúdame a realizarlo con la información que hay en el repo y con respecto al módulo". Claude followed `docs/modules/M10-analytics.md`, `M11-recommendations.md` and `M15-investment.md`, `00-shared-contracts.md` and the design sources, and built the three modules as one stack of branches.

## What was done

* `modules/recommendations`: steps built from M10's opportunities (order, numbers, actions); the model only replaces the title and text by factKey, with fixed templates otherwise.
* "Mayor impacto", the donut with the design colors, filters, numbered steps, "Basado en tus movimientos del … al …", the disclaimer in every render path.
* Actions: "Fijar tope" opens M10's cap form with category and suggested amount; "Programar" and "Revisar" go to M8 and M9 through replaceable targets.
* Vault cache `recommendations_cache` and the "Recomendaciones con IA" switch (`useAiRecommendationsSetting` for M13's Privacidad screen): off means no snapshot is sent and the cached text is dropped.

## Result

* 19 tests pass (domain, service, screen in light and dark, offline, fallback, AI off, not configured).

## Decisions and problems

* A model text is shown only next to the snapshot it was written from; when the numbers changed and the last call is less than an hour old, the steps show templates. So a text can never contradict a number on screen.
* M8's `openPaydayReminder` and M9's low use filter do not exist yet: the defaults navigate to `savings.Goals` and `Billetera` with params; `configureRecommendations({ navigation })` replaces them.
* Two React Navigation warnings appear when tests unmount; they come from the library's cleanup.

## Next step

* `feature/market-backend`.
