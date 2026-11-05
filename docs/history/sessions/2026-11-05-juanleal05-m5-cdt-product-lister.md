---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23]
branch: feature/bank-cdt-product-lister
tool: Claude Code
pr: none
status: done
---

# Expose Banco Demo's CDT catalog to M15 through bank/ports

## Instruction

Part of the plan Juan Carlos approved ("let's work in the order you proposed"). Julián asked for it in #248: M15 may import only `internal/bank/ports`, so it keeps its own Banco Demo reader until M5 exposes the catalog there.

## What was done

* `bank/ports/products.go`: `ProductCatalog`, `InstallProductCatalog` and `ProductsOf(provider)`. `ProductsOf` returns a `ProductLister` with the same method as `Provider.Products` and reads the installed catalog at every call, so M15 can build it at startup whatever the module order. Before anything is installed it answers `provider_unavailable`.
* `bank/wiring.go`: `installProductCatalog` installs Banco Demo's catalog with only `EGRESS_URL` and `EGRESS_CA_FILE`. The catalog needs no user, token or client assertion, so it works even while the link settings are missing (the local stack today). Only Banco Demo publishes CDTs.
* Tests: the port finds a catalog installed after it was built, and goes back to unavailable on `nil`; the wiring reads a fake catalog over TLS through the egress (no `Authorization` header), refuses other providers, and stays unavailable without the egress.

## Result

* Tests: `go test ./internal/bank/...` passes; `go vet` and golangci-lint: 0 issues.
* Checked that #248's `catalog.FromProvider{Lister: bankports.ProductsOf("banco-demo")}` compiles, in a scratch copy, without changing #248.
* Pull request: not opened yet.

## Decisions and problems

* One shape for Julián: `bankports.ProductsOf("banco-demo")` goes straight into `FromProvider.Lister`, and `catalog.BankDemoProducts` can be deleted. Julián decides when; nothing in M15 is changed here.
* The catalog is installed before, and apart from, the link settings check, so the Inversión tab doesn't lose its catalog when the link is disabled.

## Next step

Tell Julián (`@JulCR34l`) in #248 and in this pull request.
