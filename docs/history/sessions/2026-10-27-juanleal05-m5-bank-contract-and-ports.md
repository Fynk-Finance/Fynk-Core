---
date: 2026-10-27
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23, SCRUM-44]
branch: feature/bank-provider-contract-and-ports
tool: Claude Code
pr: none
status: done
---

# Bank contract, provider port and GET /providers (M5 step 1, part 1 of 3)

## Instruction

After M4 step 1 was delivered, the developer asked what came next according to the kit and chose to go to M5 before M4 step 2, because M5 is Phase 1 and M4's revocation needs M5's `Revoker` port. Key sentence: "I would like to proceed with the order you gave me." Work-plan step 1 (`feature/bank-provider-port`) is split into 3 PRs: contract and ports (this one), the Banco Demo adapter, and the tests against the running simulator.

## What was done

* `contracts/modules/bank.yaml` (contract first, then `make generate`), with Prism examples for each endpoint:
  * `GET /providers`;
  * `POST /bank/authorizations` and `/bank/authorizations/{id}/exchange`;
  * `POST /bank/accounts/query`, `/bank/transactions/query` and `/bank/tokens/refresh`.
  * Bank tokens only in bodies, an `X-Request-Nonce` header for replay protection, `429` with `Retry-After`, and amounts in integer centavos.
* `internal/bank/ports`:
  * `Provider` (shared contracts, section 4.4);
  * `Revoker` for M4;
  * `AssertionSigner` for `private_key_jwt` (interface only; the signer is M5 step 2);
  * the shared `Account` and `Transaction` shapes (centavos, last 4 digits only);
  * stable bank errors (`consent_revoked`, `provider_unavailable`, `invalid_grant`, `rate_limited`);
  * the provider catalog.
* `internal/bank`: `GET /providers` serves the catalog. The other 5 endpoints need a token (checked before the request is parsed) and answer `501` until step 2.
* `internal/app/app_test.go` (M0's file, approved by the developer, Sofia asked to review): removed `/v1/providers` (now `200`) and `/v1/bank/accounts/query` (now a POST, so the test's GET gets `405`) from the stub list.
* Tests: catalog (HU-009, the user chooses the entity, simulated ones flagged), Bancolombia not offered without an adapter, the catalog cannot be changed by callers, errors keep their code, token required on every route, `GET /providers` body, the 5 endpoints answer `501` without echoing the request.

## Result

* Tests: `make lint` and `make test` pass (313 mobile tests plus every Go and script test).
* Pull request: opened right after this log, stacked on #42 (the oapi-codegen runtime library), which the bank's generated server also needs.
* Size: about 1,080 lines; 537 are the contract and 195 are tests.

## Decisions and problems

* Bancolombia is not in `GET /providers` until its adapter works (spike, step 5), so no consent can be given for an entity Fynk cannot reach.
* M4's domain still has its own copy of the provider scopes. M4's code is only in the open PRs #43 to #46, not on `develop`, so switching it to `bank/ports` moves to M4 step 2, which stacks on both.
* Reading Banco Demo's code for this step found three gaps for M16 (not changed here):
  * the client assertion's signature is not checked;
  * RS256 is accepted;
  * unknown access tokens fall back to `consent-demo-001`.

  They go to the M16 owner.

## Next step

Part 2: `adapters/bankdemo` through the Caddy egress (needs a setting for the egress URL in M0's `platform/config`, to be approved first).
