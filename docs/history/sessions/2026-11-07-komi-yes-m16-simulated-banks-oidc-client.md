---
date: 2026-11-07
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-74]
branch: feature/simulated-banks-oidc-client
tool: Claude Code
pr: none
status: done
---

# Banco Demo: OIDC client for the banco-demo realm

## Instruction

Daniel said "continue with the rest of the steps". This is the first PR of step 5 of the simulated banks plan (HU-057). Step 5's authorization page came back at about 1.700 lines, so it was split into three PRs: this OIDC client, the helpers and contract, and the page.

## What was done

* `internal/oidc`, standard library only. It builds the code flow URL with PKCE S256 and exchanges the code with `client_secret_post`.
* It checks the ID token: PS256 only, the signature against the realm JWKS (cached, one refetch for an unknown kid), `iss`, `aud`/`azp`, `exp` and `nonce`.
* Tests with a fake Keycloak and a generated RSA key cover RS256, HS256, `none`, a bad signature, wrong iss, aud and nonce, an expired token and the key cache.

## Result

* In `services/bank-simulator`, on this commit alone: `gofmt -l .` is empty, `go vet ./...` is clean, `go test ./...` passes and golangci-lint v2.15.0 with the `integration` tag reports 0 issues. Nothing uses the package yet.
* Pull request: see the stack.

## Decisions and problems

* No new dependency. RS256 and HS256 are rejected, as the security rules require.
* Code by a Sonnet subagent, reviewed and split into PRs by Opus.

## Next step

The helpers and contract PR, then the authorization page.
