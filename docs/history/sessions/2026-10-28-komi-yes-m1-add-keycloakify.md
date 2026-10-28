---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5]
branch: chore/add-keycloakify
tool: Claude Code
pr: none
status: done
---

# Add the Keycloakify project for the Fynk theme

## Instruction

M1's branch 2 in `docs/modules/M01-identity.md`: "Theme project `services/keycloak/theme/` with Keycloakify, theme name `fynk` (login, email)". CLAUDE.md asks for every new library to come in its own `chore/add-<library>` pull request, so this one only adds the project and records the libraries. The pages come next.

## What was done

* **`services/keycloak/theme/`:** a Keycloakify 11 project with its own pnpm lockfile, outside the root workspace (which only lists `apps/*`).
  * `themeName: fynk`, login only, account theme `none`, and targets for Keycloak 26.8.1 only.
  * Every page renders as Keycloak's default for now.
  * Exact versions, each out for at least 14 days: keycloakify 11.16.1, React 19.3, Vite 8.3.4, TypeScript 6.0.3 (same as the app), and the three Fontsource fonts of the design, served from the jar and never from a CDN.
* **Generated files aren't committed:** `src/kc.gen.tsx` and `public/keycloakify-dev-resources/` are recreated by `pnpm gen`, which `typecheck` and `build` run first.
* **`docs/adr/0001-stack.md`:** a "Keycloak theme" section with the libraries.
* **`services/keycloak/README.md`:** how to install and build it.

## Result

* `pnpm typecheck`, `pnpm format-check` and `pnpm build-keycloak-theme` pass. The jar `fynk-keycloak-theme.jar` has `theme/fynk/login` and no font CDN.
* The root `make format-check` and `make lint-mobile` still pass. Claude Code ran everything again itself.

## Decisions

* **React 19 and Vite 8.** Keycloakify's starter still uses React 18 and Vite 5. The typecheck and the jar build pass with the newer versions.
* **Generated files out of git.** The subagent had committed `kc.gen.tsx`. Claude Code moved it out of git, following the rule that generated code is not committed.

## Problems

* **Email theme.** Keycloakify 11 doesn't build the email theme from this scaffold, so it comes later.
* **Build tools.** The jar build needs a JDK and Maven. The Dockerfile stage and the CI build come with the theme pages.

## Next step

* `feature/keycloak-fynk-theme`: the shared layout, login and register, in light and dark.
