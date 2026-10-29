---
date: 2026-10-29
developer: Julián Castiblanco
github: JulCR34l
module: M15
jira: [SCRUM-38, SCRUM-66]
branch: feature/market-backend-v2
tool: Claude Code
pr: none
status: done
---

# Rebuild the M10, M11 and M15 branches on the latest develop and use M5's Banco Demo adapter

## Instruction

The chained pull requests were squash merged into each other instead of into `develop`, so only the recommendations SDK pull request (#109) reached `develop`. Julián asked to check that the work could still be opened as pull requests after the latest changes in `develop`: "revisa que pueda hacer el pr porque han habido cambios".

## What was done

* Rebuilt the work as six branches from the current `develop`, each one opened against `develop` after the one before it merges: `feature/recommendations-endpoint-v2`, `feature/analytics-core-functions-v2`, `feature/spending-caps-v2`, `feature/recommendations-screen-v2`, `feature/market-backend-v2`, `feature/investment-tab-v2`. No conflicts.
* `services/api/internal/market`: the CDT catalog now comes from M5's Banco Demo adapter (`bank/adapters/bankdemo`, merged in #55) through `catalog.FromProvider`. Banco Demo and Alpaca are called with M5's egress client (`bank/egress`). The interim `BankDemoProducts` reader and the module's own `egress.go` were deleted.
* `catalog_test.go`: the Banco Demo test now goes through `bankdemo.New` against a fake simulator and checks the path through the egress and that no user token is sent.
* ADR 0006, section 2.3, updated.

## Result

* Go: `go vet` and `go test -race` pass for market, recommendations, bank and app.
* Pull requests: opened one at a time against `develop`, none merged.

## Decisions and problems

* The earlier session log of `feature/market-backend` says the interim reader stays until M5 adds its adapter. That is now done; this log records the change instead of editing the old one.
* Still open: the Banco de la República download has no egress route (ask Juan Pablo, M14).

## Next step

Approval and merge of `feature/recommendations-endpoint-v2`, then rebase and open the next branch.
