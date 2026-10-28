---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-67, SCRUM-5, SCRUM-9]
branch: feature/keycloak-realm-as-code
tool: Claude Code
pr: none
status: done
---

# Define the fynk Keycloak realm as code, with tests on a real Keycloak

## Instruction

Branch 1 of `docs/modules/M01-identity.md`: "realm JSON, Dockerfile, local import, README with how to export changes". The developer decided against `offline_access` (open item 5), choosing "No offline_access" with 30-day sessions.

## What was done

* `services/keycloak/realms/fynk-realm.json`: written by hand with only what differs from Keycloak's defaults. It covers:
  * a PS256 key and tokens, 5-minute access tokens, rotating refresh tokens, 30-day idle and 90-day max sessions, no `offline_access`
  * the password policy, the brute-force lock (5 failures, 15 minutes), 10-minute email links
  * events kept 90 days without the `jboss-logging` listener
  * Spanish locale
  * clients `fynk-mobile`, `fynk-api` and `fynk-admin`
  * a custom registration flow with the terms checkbox, and a user profile that cannot store a cédula
  * SMTP and secrets from environment placeholders
* `services/keycloak/Dockerfile` (Keycloak 26.8.1, built for Postgres, realms copied in) and `.dockerignore`.
* `services/keycloak/README.md`: each setting and why, the variables staging must set, reset, how to change the realm, tests.
* `services/api/internal/identity/keycloak/realm_test.go`: 17 tests on the file, no Docker.
* `realm_integration_test.go` (`-tags integration`): 11 tests against a real Keycloak 26.8.1 and Mailpit started with testcontainers. They cover:
  * password policy (`abcdefgh` rejected, `abcdefg1` accepted) and duplicate email → 409
  * PKCE required, password grant off
  * PS256 tokens of 300 s for `aud=fynk-api`, refresh rotation
  * unverified users get no code
  * sign-up with terms, verification link and first password; acceptance date and creation date recorded, no cédula
  * password reset by email with a 10-minute link
  * lock after 5 failures, events stored

## Result

* Static tests: 17 pass. Integration tests: 11 pass, about 35 s, on Docker Desktop on Windows.
* `go vet` and golangci-lint (also with `--build-tags integration`): 0 issues.
* The image builds, and imports both the fynk realm and M16's banco-demo realm.

## Decisions

* A short hand-written realm instead of a full export, so the pull request can be reviewed. Keycloak keeps its default flows when the file adds a custom flow (checked on a throwaway Keycloak).
* **The password is chosen after the email is verified.** Keycloak 26 does this by default while email verification is on, to prevent account pre-hijacking (someone registering your email with a password they know). It matches HU-001 ("el correo debe validarse antes de crear la cuenta"). The design's "Crear cuenta" screen has a password field, so this needs a team and design review before the theme branch.
* `requiredActions` lists all of Keycloak 26.8's defaults. A partial list replaces the defaults: the tests showed unverified users getting tokens when only `TERMS_AND_CONDITIONS` was listed. A static test now guards `VERIFY_EMAIL` and `UPDATE_PASSWORD`.
* The `jboss-logging` event listener is removed, because it writes the username (the email) to Keycloak's logs. Events stay in Keycloak's database for M13.
* `fynk-admin` gets `view-users` and `manage-users`. Keycloak cannot narrow them further, and the README says so.
* `go.mod` is left as `chore/add-identity-go-libraries` set it. `go mod tidy` would drop golang-jwt until `feature/api-jwt-middleware` merges.

## Problems

* The terms acceptance date was not recorded at first. In 26.8.1 Keycloak only writes `terms_and_conditions` while the `TERMS_AND_CONDITIONS` required action is enabled (found by reading the Keycloak jar).

## Next step

* `chore/keycloak-image-and-ci` (M0 files): compose builds this image and passes `FYNK_ADMIN_CLIENT_SECRET`. CI runs these tests when `services/keycloak/` changes.
* Team: confirm the "password after verification" order before `feature/keycloak-fynk-theme`.
