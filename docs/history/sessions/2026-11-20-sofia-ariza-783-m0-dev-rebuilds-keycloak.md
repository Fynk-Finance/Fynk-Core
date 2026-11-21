---
date: 2026-11-20
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: fix/dev-rebuilds-keycloak-image
tool: Claude Code
pr: none
status: done
---

# Make `make dev` rebuild the Keycloak image so sign up works after an extension change

## Instruction

Sofia said that her `.env` matches `.env.example`, but sign up in the app only shows "Algo salió mal. No pudimos
completar lo que pediste.", and asked: "Puedes ver cual es el problema por el que podria fallar?" After the cause was
found she asked to prepare the pull request for the `Makefile`.

## What was done

* Found that the message is the error page of the Keycloak theme, and that the Keycloak log showed
  `Unable to find factory for AuthenticatorFactory: fynk-registration-email-code` on every sign up.
* The realm `fynk` uses that authenticator since the sign-up code step was added (`cfb086d`, `27e5a00`, 19 Nov), but
  the local `fynk-keycloak:local` image had been built on 2 Nov, so its jar did not have it. The `.env` was not the
  cause.
* `make dev` started Postgres, Redis, Keycloak and Mailpit without `--build`, so it never rebuilt Keycloak once the
  image existed.
* Rebuilt the image on Sofia's machine (`docker compose up -d --build --wait keycloak`). The log no longer shows the
  error and the sign-up URL the app opens (`prompt=create`) answers 200.
* `Makefile`: `make dev` now starts that group with `--build`. Only Keycloak has a build section there, so the other
  three are unchanged.
* `docs/local-dev.md`: step 5 says the Keycloak image is built, and a troubleshooting row explains this error and how to
  fix it.

## Result

* `make dev` runs with the change and every service ends healthy (about 45 s with the Docker cache).
* Prettier passes on `docs/local-dev.md`. No code changed, so there are no new unit tests.
* Pull request: not opened yet.

## Decisions and problems

* Chose `--build` on the existing line instead of a separate build step: Docker reuses its cache, so a run with no
  change costs only a few seconds, and nobody has to remember to rebuild after a theme or extension change.
* The rest of the team still has the old image until they run `make dev` again after this merges. The troubleshooting
  row covers it.

## Next step

Ask the team to run `make dev` once after this merges, then try sign up again in the app.
