---
date: 2026-10-27
developer: Juan Pablo Contreras
github: juancontrerasp
module: M16
jira: [SCRUM-64]
branch: feature/bank-simulator-api-and-seed
tool: Claude Code
pr: none
status: done
---

# M16 Step 1: Banco Demo data generator, OpenAPI contract and resource API

## Instruction

Juan Pablo started module M16 (Banco Demo): "You are building module M16 of Fynk: a simulated bank, 'Banco Demo', that behaves like a real Open Finance data provider. It lets the team demo every feature with realistic data, because only Bancolombia has a sandbox in Colombia today. Fynk only reads from it. All money actions happen in the Banco Demo's own web portal, never in the Fynk app."

## What was done

* `contracts/bank-simulator.yaml`: Defined complete OpenAPI 3.1 specification for Open Finance v1 endpoints: `GET /open-finance/v1/accounts`, `GET /open-finance/v1/accounts/{id}/transactions` (cursor pagination, `pageSize`), `DELETE /open-finance/v1/consents/{id}`, and `GET /open-finance/v1/products/cdt`, with RFC 9457 Problem Details and rate limiting headers (`429`, `Retry-After`).
* `services/bank-simulator/internal/domain/`:
  * `model.go`: Domain models for `Account`, `Transaction`, `Consent`, `CdtProduct`, `CdtDetails`, and `MinorToDecimal` COP formatting helper.
  * `generator.go`: Deterministic generator seeded by customer ID hash, covering 12 full months + current month, implementing all specified financial patterns: Salario (5.2M), Arriendo (1.4M), Servicios (186k ± 20%), 4 Subscriptions totaling 112.600 COP, Gimnasio (22.250/wk), Transporte (6.500/day), Antojos under 20k, Mercado, Restaurantes, Tarjeta payments on day 5, and CDT.
  * Opening balance adjustment at the genesis of the 12-month window ensures final balances land exactly on: Ahorros 3.200.000 COP, Billetera 4.600.000 COP, Tarjeta debt 500.000 COP, and CDT 2.000.000 COP.
  * `generator_test.go`: Tests for generator determinism, target balances, subscription totals, and formatting.
* `fixtures/demo-user.json`: Exported the canonical 12-month dataset in the shared domain shape (`Account` and `Transaction`) matching `docs/modules/00-shared-contracts.md` sections 2 and 7.
* `services/bank-simulator/internal/store/`:
  * `store.go`: Thread-safe customer data store, consent tracking, and rate limiter (60 req/min per consent).
* `services/bank-simulator/internal/api/`:
  * `handlers.go`: HTTP handlers for accounts, transactions with cursor-based pagination, consent revocation, and public CDT catalog.
  * `handlers_test.go`: Unit and contract tests covering 401 unauthorized, accounts retrieval, pagination, consent revocation returning 403 `consent_revoked`, public CDT access, and 429 rate limiting.
* `services/bank-simulator/cmd/bank-simulator/`:
  * Updated `server.go` and `main.go` to mount Open Finance routes on the HTTP listeners.

## Result

* Tests: 11 of 11 tests pass across `cmd/bank-simulator`, `internal/api`, and `internal/domain`.
* `go vet ./...` reports 0 issues.
* `fixtures/demo-user.json` generated and verified (378 KB).
* Pull request: not opened yet (working on `feature/simulatedbank`).

## Decisions and problems

* Go 1.27.3 was set up in `~/.local/go` to build and test the Go services.
* The generator uses SHA-256 hash of the customer ID to produce bit-for-bit identical history across runs.
* Genesis balance adjustment guarantees that summing all transactions equals the exact target balance for each account.

## Next step

Step 2: Internal listener client certificate verification and mTLS integration through Caddy egress (HU-031 / HU-047).
