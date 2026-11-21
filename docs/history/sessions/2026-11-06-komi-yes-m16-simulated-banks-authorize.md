---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-74]
branch: feature/simulated-banks-authorize
tool: Claude Code
pr: none
status: done
---

# Authorization page of the simulated bank with realm login

## Instruction

Daniel said "continue with the rest of the steps". This session is step 5 of the simulated banks plan, slice 5a: the authorization page in `services/bank-simulator` (HU-057).

## What was done

* `internal/oidc`: standard library OIDC client. Builds the code flow URL with PKCE S256, exchanges the code with `client_secret_post`, and checks the ID token: PS256 only, signature against the realm JWKS (cached, one refetch for an unknown kid), `iss`, `aud`/`azp`, `exp` and `nonce`. Tests use a fake Keycloak with a generated RSA key and cover RS256, HS256, `none`, a bad signature, wrong iss, aud and nonce, and an expired token.
* `internal/authorize`: `GET /oauth/authorize`, `GET /oauth/authorize/callback` and `POST /oauth/authorize/decision`. Server side sessions in memory with an opaque cookie (HttpOnly, SameSite Lax, Path `/oauth`, Secure when the request is TLS or `X-Forwarded-Proto` is https, 30 minutes). A login cookie ties the callback to the browser that started the login. The customer id is `fynk_sub`, else the demo id when `preferred_username` is the demo user, else the realm `sub`, checked with `demo.ValidCustomerRef`.
* Pages in Spanish (es-CO): the consent screen (entity, data, receiver Fynk, purpose, term in days) and "No tienes productos en <entidad>." with a "Volver a Fynk" button. Every page has the "Banco simulado para pruebas. No es un banco real." banner.
* `internal/portal/style.go`: the portal CSS and banner moved to constants so the new pages reuse them. `domain.EntityDisplayName`, `demo.ValidCustomerRef`, `oauth.Service.LookupPAR` and `DropPAR` were added.
* `cmd/bank-simulator`: new config `BANK_PUBLIC_URL`, `BANK_OIDC_ISSUER`, `BANK_OIDC_BACKCHANNEL_URL`, `BANK_OIDC_CLIENT_ID`, `BANK_OIDC_CLIENT_SECRET`. `newBankMux` takes an optional authorize config. With no issuer or no secret the page answers 503.
* `contracts/bank-simulator.yaml`: added the callback and decision paths and the 503 answer.
* `cmd/bank-simulator/authorize_test.go`: 12 tests. They cover 503 when not configured, unknown request_uri and client_id mismatch (400), a Fynk user authorizing and the token reading only that entity, no products (message, no active consent, a forced authorize still fails), cancel, a second entity with an existing session, the bank's own user, the demo user, a missing or wrong CSRF token (403), a forged callback, cookie flags and that logs hold no sub, email, code, secret or token.

## Result

* Tests: all of `services/bank-simulator` passes. `gofmt -l .` is empty, `go vet ./...` is clean, golangci-lint v2.15.0 with the `integration` tag reports 0 issues. `fixtures/demo-user.json` is unchanged.
* Pull request: not opened yet.
* Not verified here: a real Keycloak. The realm side (identity provider, mapper, client secret) is slice 5b.

## Decisions and problems

* Cancel and "Volver a Fynk" drop the pushed request and leave the consent pending with no customer. The pending consent cannot be activated any more.
* The page uses 302 to send the person to the realm and 303 after a POST.
* `CompleteAuthorization` builds its redirect without escaping, so the page builds its own redirect from the returned code and the PAR state.
* Step 5a came back at about 1.700 lines. In review it was split into three PRs: the OIDC client, the helpers and contract, and this page. The OIDC client, the helpers and the contract described above are in the two PRs below this one. This PR is still about 1.000 lines, half of them `authorize_test.go`, because the page is one handler and its tests.

## Next step

Slice 5b: the `banco-demo-broker` client in the fynk realm, the `fynk` identity provider and mappers in the banco-demo realm, compose and `.env.example`, and the realm tests.
