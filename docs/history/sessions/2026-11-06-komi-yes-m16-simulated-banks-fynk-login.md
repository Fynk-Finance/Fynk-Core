---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-74]
branch: feature/simulated-banks-fynk-login
tool: Claude Code
pr: none
status: partial
---

# Ingresar con Fynk in the realms and the compose stack

## Instruction

Daniel said "continue with the rest of the steps". This session is step 5 of the simulated banks plan, slice 5b: the realm changes and the compose wiring that the authorization page of slice 5a needs (HU-057).

## What was done

* `services/keycloak/realms/fynk-realm.json` (M1): confidential client `banco-demo-broker`, standard flow only, PKCE S256, secret `${BANCO_DEMO_BROKER_SECRET}`, redirect `http://localhost:8081/realms/banco-demo/broker/fynk/endpoint`. Its only default scope is `basic` (the `sub`) and it has one ID token mapper that repeats the user id as the claim `fynk_sub`. No email or name scope.
* `services/keycloak/realms/banco-demo-realm.json` (M16): identity provider `fynk` ("Ingresar con Fynk", authorization URL on `localhost:8081`, token and JWKS URLs on `keycloak:8080`, PKCE, signature validation with the JWKS, no user info call, secret `${BANCO_DEMO_BROKER_SECRET}`). First broker login uses the new flow `fynk first broker login` (create user if unique, auto link, no review-profile). Mappers: an attribute importer for `fynk_sub` and a username template `${ALIAS}.${CLAIM.fynk_sub}`. `bank-portal` got `client-secret` with `${BANK_PORTAL_CLIENT_SECRET}`, PKCE S256, no default scopes, and ID token mappers for `sub`, `preferred_username` and `fynk_sub`.
* The same realm also got a PS256 key provider (the simulator accepts PS256 only and the realm had no PS256 key) and its own user profile with an optional email. `registrationEmailAsUsername` is now `false`, because a brokered user has no email.
* `docker-compose.yml` and `.env.example` (M0 files): the two secrets for Keycloak and the `BANK_*` OIDC variables for the simulator, fake values ending in `-local-only`.
* `services/keycloak/README.md`: the new client, a section on the broker, the two secrets, and a note that existing local volumes need a re-import.
* Tests in `services/api/internal/identity/keycloak/`: one in `realm_test.go` for the fynk client, and `bancodemo_realm_test.go` for the banco-demo realm (provider and label, no review-profile flow, no email dependency, `fynk_sub` importer and ID token mapper, `bank-portal` client, PS256 key, no literal secret). The integration test environment got the two new secrets.

## Result

* Tests: `go test ./internal/identity/keycloak/...` passes, golangci-lint v2.15.0 with the `integration` tag reports 0 issues on that package, `docker compose config` is valid with `.env.example`.
* Not verified: the Docker daemon was not running on this machine, so Keycloak was never started with these files. The realm JSON follows Keycloak 26 behavior from memory and the static tests only check the file, not the import. The brokered login, the `fynk_sub` claim and the "Ingresar con Fynk" button on the login page still need a real run.
* Pull request: not opened yet.

## Decisions and problems

* The `fynk_sub` claim repeats the `sub` under another name. I was not sure the attribute importer and the username template can read the standard `sub` claim, and a claim with another name always works. It carries no extra data.
* An empty `defaultClientScopes` plus explicit mappers on `bank-portal`, because the realm declares its own `clientScopes` and the built-in ones may not exist there.
* The realm URLs are fixed to `localhost:8081` and `keycloak:8080`. Staging (M14) will need its own values and the two new secrets in Secrets Manager.
* The identity provider cannot pin PS256 itself: Keycloak checks the signature with the algorithm in the token header. The simulator is the one that rejects every algorithm but PS256.

## Next step

Start Docker, reset the local Keycloak volume, and check the login page, a brokered login and the ID token. Then M14 adds the secrets and staging URLs.
