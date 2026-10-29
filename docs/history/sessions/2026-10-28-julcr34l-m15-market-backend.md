---
date: 2026-10-28
developer: Julián Castiblanco
github: JulCR34l
tool: Claude Code
pr: none
status: done
module: M15
jira: [SCRUM-66]
branch: feature/market-backend
---

# Market endpoints: CDT catalog, Banrep reference and Alpaca quotes

## Instruction

Julián asked Claude (claude.ai, Fynk project, session linked to the repository zip): "soy la persona 6, que hace la parte de analytics AI and investment, ayúdame a realizarlo con la información que hay en el repo y con respecto al módulo". Claude followed `docs/modules/M10-analytics.md`, `M11-recommendations.md` and `M15-investment.md`, `00-shared-contracts.md` and the design sources, and built the three modules as one stack of branches.

## What was done

* `contracts/modules/market.yaml`: `GET /market/cdt-products`, `GET /market/cdt-reference`, `POST /market/quotes`, all the same for every user, `503 market_unavailable`.
* `internal/market/catalog`: catalog behind a `Source` port with the shape of M5's `Products()`, Banco Demo adapter (public catalog), cached 1 hour.
* `internal/market/reference`: weekly Banrep rate, at most one download a day, last value kept, `stale` after 14 days; CSV parser without floating point; table `market.cdt_reference`.
* `internal/market/quotes`: fixed 10 symbols, Alpaca with `feed=iex` always, times converted to UTC (Eastern when no offset), cents and basis points, cached 15 minutes.
* `docs/adr/0006-market-data.md`.
* `internal/app/app_test.go` (M0's file): market is no longer a stub.

## Result

* `go vet` and `go test -race` pass for the module and for `internal/app` (Go 1.25, see the M11 endpoint log).

## Decisions and problems

* Interim Banco Demo adapter until M5 exports `Provider.Products()` (rule 7): ask Juan Carlos.
* The exact format of Banco de la República's file could not be confirmed from the build environment; the URL is configurable and ADR 0006 asks to confirm it before Gate E. No value is invented: without it the endpoint answers 503.
* Alpaca is non commercial reference data (finding in ADR 0006).
* "+ Invertir": the prompt says `/portal/cdt`, the simulator serves `/portal/actions`; ask M16.

## Next step

* `feature/investment-tab`.
