---
date: 2026-11-05
developer: Julián Castiblanco
github: JulCR34l
module: M15
jira: [SCRUM-66]
branch: feature/market-catalog-from-bank-port
tool: Claude Code
pr: none
status: done
---

# Read Banco Demo's CDT catalog from M5 through bank/ports

## Instruction

Julián asked what comes next after #248 and #266: "okay ahora que sigue". #260 (Juan Carlos, M5) had just been merged with `bankports.ProductsOf`, the catalog M15 asked for in #248.

## What was done

* `internal/market/module.go`: the CDT catalog is `catalog.FromProvider{Lister: bankports.ProductsOf("banco-demo")}`. M5 installs that catalog at startup with the egress; until then it fails closed.
* `internal/market/catalog`: `BankDemoProducts`, the market's own reader of Banco Demo's catalog, is deleted. `bankdemo.go` is renamed `provider.go`.
* Tests: the catalog comes from the catalog M5 installs, asking for `banco-demo`; without it the service answers unavailable.
* ADR 0006, section 2.3, updated.
* Also rebased #266 (Inversión tab) on `develop` after #259 and #260; no mobile change.

## Result

* Go: golangci-lint with the repository config 0 issues; `go test -race` passes for market, bank and app.
* Pull request: opened against `develop`.

## Decisions and problems

* Alpaca keeps the market's egress client: it is not a bank, so it does not go through M5's port.
* Still open: the Banco de la República download has no egress route (ask Juan Pablo, M14).

## Next step

Review and merge of this pull request and of #266.
