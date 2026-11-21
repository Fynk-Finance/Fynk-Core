---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-44, SCRUM-22]
branch: feature/bank-provider-consent-at-par
tool: Claude Code
pr: none
status: done
---

# Keep the bank's consent id from the PAR and stop retrying unsupported revocations

## Instruction

Juan Carlos asked to finish M4 and M5 and to build the Bancolombia part with the API Market access he got: "the idea es to use the sandbox"; "create that part and tell what to do so that we can link that." For the customer document that Bancolombia's consent API requires, he chose to send only the sandbox's fictional customer from the settings. This branch is the bottom of the Bancolombia stack.

## What was done

* `bank/ports`: `PARResult.ProviderConsentID` for a bank that creates its consent before the PAR (Bancolombia), and `ErrRevocationNotSupported` for a bank without a third-party revocation API.
* `bank/link` and the service: the authorization keeps the PAR's consent id (memory and Redis), and the exchange grants M4's consent with the token answer's id or, if it has none, the PAR's.
* `consents/service`: when the bank answers `revocation_not_supported`, the notice gives up at once instead of retrying for 24 hours.
* Tests: 2 service tests for the consent id, the authorization store round trip, and 1 M4 test for the unsupported revocation.

## Result

* Tests: `go test ./internal/bank/... ./internal/consents/...` passes; golangci-lint 0 issues.
* Pull request: not opened yet. Banco Demo is unchanged.

## Decisions and problems

* The token answer's consent id wins over the PAR's when both exist, because the bank confirmed it last.

## Next step

The Bancolombia adapter on top of this branch.
