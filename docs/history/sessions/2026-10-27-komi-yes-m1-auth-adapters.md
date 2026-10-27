---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6, SCRUM-5]
branch: feature/mobile-auth-adapters
tool: Claude Code
pr: none
status: done
---

# AppAuth and Keychain adapters for the mobile session

## Instruction

Second of the three branches that split M1 branch 5 (mobile sign-in with PKCE), after the developer asked to resume and open the PRs.

## What was done

* `adapters/oidc/config.ts`: issuer from `EXPO_PUBLIC_KEYCLOAK_ISSUER` (default local Keycloak), client `fynk-mobile`, redirect `co.fynk.app://oauth/callback`, scopes `openid profile email` (no `offline_access`), plain HTTP only in development builds.
* `adapters/oidc/appAuthOidc.ts`: `react-native-app-auth` with PKCE and an ephemeral browser session on iOS and Android, `prompt=create` for sign up. Errors are sorted from the library's real codes and messages (checked in its Android and iOS sources): user cancel, network or discovery failure, and everything else as rejected. The refresh keeps the old refresh token if Keycloak returns none. Sign out posts `client_id` and the refresh token in the form body to the logout endpoint.
* `adapters/keychain/keychainTokenStore.ts`: one Keychain entry, service `co.fynk.app.identity.session`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, no iCloud sync. A corrupt entry is deleted.
* `adapters/systemClock.ts`: the device clock for the session service.
* Tests: config, PKCE and no `offline_access`, `prompt=create`, the error table, the refresh rotation, the refresh token never in the logout URL, and the Keychain options.

## Result

* 48 identity tests pass on this branch alone; `tsc` and ESLint are clean.
* Pull request: opened right after this log.
* Not checked against a running Keycloak this session (Docker was not running): the logout call and the error messages of a real revoked session. They are on the manual check list of the sign-in PR.

## Decisions and problems

* The ephemeral browser session keeps Keycloak's cookie out of the shared browser, so after sign out "Ya tengo cuenta" asks for the password again.
* `prompt: 'create'` needs a cast, because the library's type lists only the older prompt values.

## Next step

* `feature/mobile-sign-in-with-pkce`: Inicio and the wiring in `index.ts`.
