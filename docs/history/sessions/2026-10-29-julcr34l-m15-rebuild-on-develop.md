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

# Rebuild the M10, M11 and M15 branches on the latest develop and fix the Go linter

## Instruction

The chained pull requests were squash merged into each other instead of into `develop`, so only the recommendations SDK pull request (#109) reached `develop`. Julián asked to check that the work could still be opened as pull requests after the latest changes in `develop`: "revisa que pueda hacer el pr porque han habido cambios".

## What was done

* Rebuilt the work as six branches from the current `develop`, each one opened against `develop` after the one before it merges: `feature/recommendations-endpoint-v2`, `feature/analytics-core-functions-v2`, `feature/spending-caps-v2`, `feature/recommendations-screen-v2`, `feature/market-backend-v2`, `feature/investment-tab-v2`. No conflicts.
* Rebased the six branches again in the afternoon, after 52 new commits in `develop` (backup, notifications, Billetera). The only conflict was in M0's `app_test.go`: the stub list now has M2's `/v1/backup/unknown`, and the health test skips `identity`, `backup`, `recommendations` and `market`.
* The Go CI job of #149 failed on golangci-lint. Fixed:
  * `misspell` read Spanish words (`proteccion`, `productos`, `Restaurantes`) as English typos: marked with `//nolint:misspell` on those lines.
  * `errcheck`: the three deferred `resp.Body.Close()` of the market now ignore the error explicitly.
  * `depguard`: the market had switched to M5's Banco Demo adapter (`bank/adapters/bankdemo`, #55) and egress client (`bank/egress`), but the module isolation rule lets `internal/market` import only `internal/bank/ports`. That change was reverted: the market keeps its own `BankDemoProducts` reader and egress client. ADR 0006, section 2.3, explains it.

## Result

* Mobile: 1,139 tests, tsc, ESLint and Prettier pass.
* Go: `go vet`, `go test -race` and golangci-lint (with the repository config) pass for market, recommendations, bank and app.
* Pull requests: opened one at a time against `develop`, none merged.

## Decisions and problems

* To use M5's catalog, M5 has to expose it in `bank/ports`, the same way it exposes `InstalledRevoker`. Ask Juan Carlos (M5).
* Still open: the Banco de la República download has no egress route (ask Juan Pablo, M14).

## Next step

Approval and merge of `feature/recommendations-endpoint-v2`, then rebase and open the next branch.
