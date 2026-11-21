---
date: 2026-11-07
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-74]
branch: feature/simulated-banks-authorize-helpers
tool: Claude Code
pr: none
status: done
---

# Banco Demo: helpers and contract for the authorization page

## Instruction

Daniel said "continue with the rest of the steps". Second PR of step 5 of the simulated banks plan (HU-057), between the OIDC client and the authorization page.

## What was done

* `internal/portal/style.go`: the portal CSS and the "Banco simulado para pruebas. No es un banco real." banner moved into constants, so the authorization page reuses them. The portal looks the same.
* `domain.EntityDisplayName`, and `demo.ValidCustomerRef`, which `ProvisionCustomer` now uses instead of its own check.
* `oauth.Service.LookupPAR` and `DropPAR`, so the page can read a pushed request without consuming it.
* `contracts/bank-simulator.yaml`: `GET /oauth/authorize/callback`, `POST /oauth/authorize/decision` and the 503 answer when the login is not configured.

## Result

* In `services/bank-simulator`, on this branch alone: `gofmt -l .` is empty, `go vet ./...` is clean, `go test ./...` passes and golangci-lint v2.15.0 with the `integration` tag reports 0 issues.
* Pull request: see the stack.

## Decisions and problems

* The contract YAML was not run through a validator or Prettier in this session (neither is installed in the worktree). CI checks it.
* Code by a Sonnet subagent, reviewed and split into PRs by Opus.

## Next step

The authorization page.
