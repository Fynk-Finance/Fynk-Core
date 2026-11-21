---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-67]
branch: chore/keycloak-image-and-ci
tool: Claude Code
pr: none
status: done
---

# Use M1's Keycloak image in compose and test the realm in CI (M0 files)

## Instruction

The developer asked that changes to M0 files go in "separate chore PRs" for Sofia to review. This one wires `feature/keycloak-realm-as-code` into the local stack and CI.

## What was done

* `docker-compose.yml`: the `keycloak` service builds `services/keycloak/Dockerfile` (the same Keycloak 26.8.1) and receives `FYNK_ADMIN_CLIENT_SECRET`.
* `.env.example`: `FYNK_ADMIN_CLIENT_SECRET` with a fake local value.
* `scripts/ci-changes.mjs` and its test: changes under `services/keycloak/` run the Go CI area, where the realm tests live.
* `Makefile`: new `make test-keycloak` (realm tests on Keycloak and Mailpit through testcontainers).
* `.github/workflows/ci.yml`: the Go job runs `make test-keycloak` and also builds the Keycloak image.
* `docs/local-dev.md` and `docs/adr/0001-stack.md`: the fynk realm is now M1's real realm; new accounts choose the password after verifying the email.

## Result

* `node --test scripts/*.test.mjs`: 22 pass. Prettier on the repository: clean. `docker compose config` with `.env.example`: valid.
* The `make test-keycloak` command passed on `feature/keycloak-realm-as-code` (11 tests, about 35 s).
* The running local stack was not restarted, so the developer's data is untouched.

## Decisions

* Compose keeps mounting `services/keycloak/realms/` over the image, so editing a realm still only needs a reset, not a rebuild.
* `FYNK_ADMIN_CLIENT_SECRET` uses the same `:?missing in .env` guard as the other variables. Existing `.env` files need the new line, and the PR says so.

## Problems

* None.

## Next step

* Branch 2 (theme) adds the Keycloakify build stage to the same Dockerfile.
