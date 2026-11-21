---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M5
jira: [SCRUM-75]
branch: feature/simulated-banks-entities-endpoint
tool: Claude Code
pr: none
status: done
---

# M5 backend: GET /bank/simulated-entities

## Instruction

Daniel said "continue with the rest of the steps". This is the second slice of step 6: the contract and the handler that tell the app where the user has simulated accounts.

## What was done

* `contracts/modules/bank.yaml`: new `GET /bank/simulated-entities` (user bearer auth, operation `listSimulatedEntities`) answering `{ "providerIds": [...] }`, with 200, 401 and 503. The `GET /providers` example now lists the four entities. `make generate` produced the server.
* `internal/bank/server.go`: `ListSimulatedEntities` takes the caller's `sub` from the auth context (`auth.User.ID`, documented as the Keycloak sub), calls `ports.InstalledDemoProvisioner()` and returns the ids that are in the catalog, in catalog order and without duplicates. Nothing is stored.
* A disabled simulator or a failing call answers `503 provider_unavailable` through the existing error handler, so the app can fall back to every simulated entity.
* Tests: `simulated_entities_test.go` (returns what the simulator returns and filters it, passes the caller's sub, needs a token, 503 when disabled or failing, and the captured log and body hold no sub, including on an unexpected 500), `service/multi_entity_test.go` (two simulated links read their own entity, and a revoked consent ends only its own link), and the new path in the token-first route list.

## Result

* `go vet ./...` and `go test ./...` pass in `services/api`. golangci-lint v2.15.0 with the integration tag reports nothing in `internal/bank`; its 6 issues are in `internal/backup` and `internal/platform/migrate`, which this branch does not touch.
* Pull request: not opened yet. It stacks on `feature/simulated-banks-fynk-providers`.

## Decisions and problems

* Status code: 503 `provider_unavailable` rather than 200 with an empty list, because an empty list would look like "the user has no accounts" and hide the fallback.
* The 60 second sync interval lives in the app (`modules/bank` mobile code), so the multi-link test for it goes with the mobile slice.

## Next step

Mobile list of simulated entities in `modules/bank`.
