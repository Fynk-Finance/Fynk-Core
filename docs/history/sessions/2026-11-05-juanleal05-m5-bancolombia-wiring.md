---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23]
branch: feature/bancolombia-wiring
tool: Claude Code
pr: none
status: done
---

# Offer Bancolombia's sandbox when its settings are there

## Instruction

Juan Carlos asked to finish M4 and M5 and to build the Bancolombia part with the API Market access he got: "the idea es to use the sandbox"; "create that part and tell what to do so that we can link that." For the customer document that Bancolombia's consent API requires, he chose to send only the sandbox's fictional customer from the settings.

## What was done

* `bank/wiring.go`: the shared keys and egress load once; each bank whose settings are there is built. Bancolombia uses the egress routes `bancolombia-auth` and `bancolombia-api` and its own client id on the same signing key. A Bancolombia that cannot be built is logged and left out; Banco Demo keeps working.
* `bank/ports`: `Offer` lists Bancolombia in `GET /providers`, marked simulated in the sandbox.
* A tagged integration test reads the real sandbox with the developer's credentials (discovery, accounts, movements, a revoked consent), using the sandbox's documented example values.
* Checked the live discovery document: issuer, `/auth`, `/token`, `/par` and PS256 match the adapter.

## Result

* `go test ./internal/bank/... ./internal/consents/...` passes; golangci-lint 0 issues with and without the `integration` tag. The sandbox tests skip without credentials; they were not run with Fynk's credentials.
* Pull request: not opened yet. The phone needs no change: it already knows `bancolombia`.

## Decisions and problems

* The Caddy egress has a placeholder `/bancolombia` route to another host. The two routes are written for Juan Pablo in ADR 0003.

## Next step

Juan Carlos puts the API Market credentials in `.env` and runs the sandbox tests (ADR 0003, section 5).
