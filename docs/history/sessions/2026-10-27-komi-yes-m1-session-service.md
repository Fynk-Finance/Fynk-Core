---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6, SCRUM-5]
branch: feature/mobile-session-service
tool: Claude Code
pr: none
status: done
---

# Mobile session service with one refresh at a time

## Instruction

Branch 5 of the M1 plan (mobile sign-in with PKCE). The developer asked to resume after a usage limit and to "do the PRs now". The work was over the 400-line guideline, so it was split into three stacked branches. This is the first one: domain and application code, not wired into the app yet.

## What was done

* `domain/session.ts`: `TokenSet`, `SessionStatus`, `isRefreshDue` (60 s before expiry) and `parseTokenSet` (corrupt or incomplete data gives null).
* `application/ports.ts`: `OidcPort` (authorize, refresh, endSession) with typed `OidcError` kinds `cancelled`, `rejected` and `network`, and `TokenStorePort`.
* `application/sessionService.ts`: restore from the store without opening the browser, sign in and sign up (a second tap is ignored while the browser is open), sign out (forgets locally first, then ends the Keycloak session best effort). The refresh is single flight, because Keycloak rotates refresh tokens with max reuse 0. A rejected refresh signs out, a network error keeps the session, and a refresh that finishes after a sign out is dropped.
* `application/apiHooks.ts`: the hooks M0's API client calls (`getAccessToken`, `refreshAccessToken`, `getDeviceId`).
* `application/devSession.ts`: the `dev-token` session, used only when `__DEV__` and `EXPO_PUBLIC_DEV_AUTH=dev-token`.
* Tests: session rules, 15 session service tests, and through M0's real `createApiClient` "an expired access token triggers one refresh and one retry" and "sends no token when signed out".

## Result

* 26 identity tests pass on this branch alone; `tsc` and ESLint are clean. The whole app (309 tests) passes on the top branch of the stack.
* Pull request: opened right after this log.

## Decisions and problems

* `signOut` now uses `try/await` around `endSession` instead of `.catch`, so a failing or misbehaving adapter can never keep the user signed in. Found because a test fake returned `undefined`.
* Split into three branches (session service, adapters, UI) to keep each PR near the size guideline.

## Next step

* `feature/mobile-auth-adapters` (AppAuth and Keychain), then `feature/mobile-sign-in-with-pkce` (Inicio and wiring).
