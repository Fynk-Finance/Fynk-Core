---
date: 2026-10-27
developer: Juan Pablo Contreras
github: juancontrerasp
module: M16
jira: [SCRUM-65]
branch: feature/banco-demo-portal
tool: Claude Code
pr: 30
status: done
---

# M16 Step 4: Banco Demo interactive web portal and simulation tools

## Instruction

Juan Pablo instructed to build the Web Portal of Banco Demo (HU-048): "Yes continue please, after you finish, since it's a web portal, please let me know so I can test it properly!".

## What was done

* Created branch `feature/banco-demo-portal` from `develop` / M16 step 3.
* `services/bank-simulator/internal/store/store.go`:
  * Implemented banking domain actions: `RecordPayment`, `ReceiveMoney`, `TransferOwn`, `PayCard`, `OpenCDT`, and `CancelCDT`.
  * Implemented subscription lifecycle: `AddSubscription`, `UpdateSubscriptionPrice`, `ChargeSubscriptionNow`, and `CancelSubscription`.
  * Implemented demo controls: `ResetCustomer` (restoring canonical balances) and `AdvanceTime`.
* `services/bank-simulator/internal/portal/`:
  * `portal.go`: Web handlers for dashboard (`/portal`), account transaction history (`/portal/account`), banking operations (`/portal/actions`), subscriptions (`/portal/subscriptions`), Fynk consents (`/portal/consents`), and admin controls (`/portal/admin`).
  * `templates.go`: Embedded Go templates with Banco Demo styling in grey and green, responsive cards, and the required regulatory disclaimer banner ("Banco simulado para pruebas. No es un banco real.").
  * `portal_test.go`: Tested portal rendering, immediate API visibility of registered payments (verifying that payments created in the portal appear immediately in `GET /open-finance/v1/accounts/{id}/transactions`), transfers, card payments, subscription price updates, and admin state resets.
* `services/bank-simulator/cmd/bank-simulator/`:
  * `server.go`: Mounted portal routes and root redirect (`/` -> `/portal`) on the HTTP server.
  * `main.go`: Added `BANK_DEV_MODE=1` environment variable support to allow running standalone locally without pre-generating mTLS CA certificates while strictly keeping mutual TLS required in production.
* Verified live portal rendering and HTTP 200 response on `http://localhost:8082/portal`.

## Result

* Tests: All 18 unit, contract, and portal integration tests pass across `cmd/bank-simulator`, `internal/api`, `internal/domain`, `internal/oauth`, and `internal/portal`.
* `go vet ./...` reports 0 issues.
* Pull request: [#30](https://github.com/Fynk-Finance/Fynk-Core/pull/30) opened against `develop`.

## Decisions and problems

* Reentrant locking in `store.BankStore` was decoupled with `nowLocked()` to prevent read-lock contention during transaction creation.
* Built using native Go `html/template` with embedded modern CSS, avoiding node/asset build toolchains for the simulator container.

## Next step

Module M16 (Banco Demo) is complete across Phase 0, 1, and 2. Next: Module M14 (AWS Staging Infrastructure) or Module M13 (Append-Only Audit Store).
